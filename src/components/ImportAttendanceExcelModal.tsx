import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar,
  Clock,
  ArrowRight,
  Download,
  Users,
  Search,
  Filter,
  Check,
  Info
} from 'lucide-react';
import { AttendanceRecord, Student, SchoolProfile, SchoolClass } from '../types';
import { 
  saveAttendanceRecords, 
  getAttendanceRecords, 
  validateAndSanitizeAttendanceRecords,
  getLocalDateString
} from '../lib/storage';
import { exportDashboardAttendanceExcel } from '../lib/exportUtils';

interface ParsedAttendanceRow {
  rowNumber: number;
  nisn: string;
  nis: string;
  studentName: string;
  className: string;
  date: string;
  entryTime: string;
  entryStatus: AttendanceRecord['status'];
  entryScannedBy: string;
  returnTime?: string;
  returnStatus?: AttendanceRecord['returnStatus'];
  returnScannedBy?: string;
  notes?: string;
  matchedStudent?: Student;
  existingRecord?: AttendanceRecord;
  actionType: 'UPDATE' | 'CREATE';
}

interface ImportAttendanceExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classes: SchoolClass[];
  attendanceRecords: AttendanceRecord[];
  selectedDate: string;
  schoolProfile?: SchoolProfile;
  onImportSuccess: (count: number, message: string) => void;
}

export const ImportAttendanceExcelModal: React.FC<ImportAttendanceExcelModalProps> = ({
  isOpen,
  onClose,
  students,
  classes,
  attendanceRecords,
  selectedDate,
  schoolProfile,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsedRows, setParsedRows] = useState<ParsedAttendanceRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to parse excel time format (decimals or strings)
  const normalizeExcelTime = (val: any): string => {
    if (val === undefined || val === null || val === '') return '-';
    if (typeof val === 'number') {
      // Excel fractional day
      if (val >= 0 && val < 1) {
        const totalMinutes = Math.round(val * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }
    const str = String(val).trim();
    if (str === '-' || str.toLowerCase() === 'belum absen' || str.toLowerCase() === 'belum pulang') return '-';
    
    // Matches "07:15", "07.15", "7:15", "07:15:00"
    const match = str.match(/^(\d{1,2})[:.](\d{2})/);
    if (match) {
      const h = String(parseInt(match[1], 10)).padStart(2, '0');
      const m = String(parseInt(match[2], 10)).padStart(2, '0');
      return `${h}:${m}`;
    }
    return str;
  };

  // Helper to parse date to YYYY-MM-DD
  const normalizeExcelDate = (val: any, fallbackDate: string): string => {
    if (!val) return fallbackDate;
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof val === 'number' && val > 30000 && val < 60000) {
      // Excel serial date code
      try {
        const parsed = XLSX.SSF.parse_date_code(val);
        if (parsed) {
          const y = parsed.y;
          const m = String(parsed.m).padStart(2, '0');
          const d = String(parsed.d).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      } catch {}
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // Matches DD/MM/YYYY or DD-MM-YYYY
    const matchDmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (matchDmy) {
      const d = String(parseInt(matchDmy[1], 10)).padStart(2, '0');
      const m = String(parseInt(matchDmy[2], 10)).padStart(2, '0');
      const y = matchDmy[3];
      return `${y}-${m}-${d}`;
    }
    return fallbackDate;
  };

  // Helper to parse status masuk
  const normalizeEntryStatus = (raw: string, time: string): AttendanceRecord['status'] => {
    const s = (raw || '').trim().toUpperCase();
    if (s.includes('TERLAMBAT') || s.includes('LAMBAT')) return 'TERLAMBAT';
    if (s.includes('SAKIT')) return 'SAKIT';
    if (s.includes('IZIN') || s.includes('IJIN')) return 'IZIN';
    if (s.includes('ALPA') || s.includes('ALPHA') || s.includes('TANPA KETERANGAN')) return 'ALPA';
    if (s.includes('HADIR') || s.includes('TEPAT WAKTU')) return 'HADIR';
    
    // Fallback if status empty but time exists
    if (time && time !== '-') return 'HADIR';
    return 'ALPA';
  };

  // Helper to parse return status
  const normalizeReturnStatus = (raw: string, returnTime: string): AttendanceRecord['returnStatus'] | undefined => {
    const s = (raw || '').trim().toUpperCase();
    if (s.includes('TEPAT')) return 'PULANG_TEPAT';
    if (s.includes('CEPAT') || s.includes('AWAL')) return 'PULANG_CEPAT';
    if (s.includes('SUDAH') || s.includes('PULANG')) return 'PULANG';
    if (returnTime && returnTime !== '-') return 'PULANG';
    return undefined;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    processExcelFile(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      processExcelFile(droppedFile);
    }
  };

  const processExcelFile = async (fileToProcess: File) => {
    setIsParsing(true);
    setParseError(null);
    setParsedRows([]);

    try {
      const arrayBuffer = await fileToProcess.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

      // Find the best sheet: 'Presensi Harian' (from app export) or Sheet 0
      const sheetName = workbook.SheetNames.find(n => 
        n.toLowerCase().includes('presensi') || n.toLowerCase().includes('harian')
      ) || workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error('Lembar kerja (sheet) tidak ditemukan dalam berkas Excel.');
      }

      // Convert to JSON with headers as keys
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('Berkas Excel kosong atau tidak memiliki baris data yang valid.');
      }

      // Build quick search index for registered students
      const studentMapByNisn = new Map<string, Student>();
      const studentMapByName = new Map<string, Student>();
      const studentMapByNameClass = new Map<string, Student>();

      students.forEach(s => {
        if (s.nisn && s.nisn !== '-') studentMapByNisn.set(s.nisn.trim(), s);
        if (s.name) {
          studentMapByName.set(s.name.trim().toLowerCase(), s);
          if (s.className) {
            studentMapByNameClass.set(`${s.className.trim().toLowerCase()}__${s.name.trim().toLowerCase()}`, s);
          }
        }
      });

      // Build quick search index for existing attendance records
      const existingRecordsMap = new Map<string, AttendanceRecord>();
      attendanceRecords.forEach(r => {
        if (r.date && r.studentId) existingRecordsMap.set(`${r.date}__${r.studentId}`, r);
        if (r.date && r.nisn && r.nisn !== '-') existingRecordsMap.set(`${r.date}__nisn_${r.nisn.trim()}`, r);
        if (r.date && r.studentName) existingRecordsMap.set(`${r.date}__name_${r.studentName.trim().toLowerCase()}`, r);
      });

      const parsedList: ParsedAttendanceRow[] = [];

      rawRows.forEach((row, idx) => {
        // Find keys case-insensitively
        const getCol = (...keys: string[]): any => {
          for (const k of keys) {
            const foundKey = Object.keys(row).find(
              rk => rk.trim().toLowerCase() === k.trim().toLowerCase()
            );
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
              return row[foundKey];
            }
          }
          return '';
        };

        const rawNisn = String(getCol('NISN', 'nisn', 'No. NISN', 'Nomor NISN')).trim();
        const rawNis = String(getCol('NIS', 'nis', 'No. Induk')).trim();
        const rawName = String(getCol('Nama Siswa', 'Nama Lengkap Siswa', 'Nama Lengkap', 'Nama', 'nama')).trim();
        const rawClass = String(getCol('Kelas', 'kelas', 'Rombel')).trim();

        // Skip header-only row or completely empty rows
        if (!rawName && !rawNisn) return;
        if (rawName.toLowerCase() === 'nama siswa' || rawName.toLowerCase() === 'nama') return;

        const rawDate = getCol('Tanggal', 'tanggal', 'Date', 'Tgl');
        const parsedDate = normalizeExcelDate(rawDate, selectedDate);

        const rawEntryTime = getCol('Jam Masuk', 'Waktu Masuk', 'Jam Hadir', 'Waktu Hadir');
        const parsedEntryTime = normalizeExcelTime(rawEntryTime);

        const rawEntryStatus = String(getCol('Status Masuk', 'Status Kehadiran', 'Status')).trim();
        const parsedEntryStatus = normalizeEntryStatus(rawEntryStatus, parsedEntryTime);

        const rawScannedBy = String(getCol('Petugas Scan Masuk', 'Petugas Masuk', 'Petugas Scan')).trim() || 'Import Excel (Admin)';

        const rawReturnTime = getCol('Jam Pulang', 'Waktu Pulang');
        const parsedReturnTime = normalizeExcelTime(rawReturnTime);
        const validReturnTime = (parsedReturnTime && parsedReturnTime !== '-') ? parsedReturnTime : undefined;

        const rawReturnStatus = String(getCol('Status Pulang', 'Status Kepulangan')).trim();
        const parsedReturnStatus = normalizeReturnStatus(rawReturnStatus, validReturnTime || '');

        const rawReturnScannedBy = String(getCol('Petugas Scan Pulang', 'Petugas Pulang')).trim() || (validReturnTime ? 'Import Excel (Admin)' : undefined);
        const rawNotes = String(getCol('Keterangan', 'Catatan', 'Notes')).trim();

        // Match student
        let matched: Student | undefined = undefined;
        if (rawNisn && rawNisn !== '-' && studentMapByNisn.has(rawNisn)) {
          matched = studentMapByNisn.get(rawNisn);
        } else if (rawClass && rawName && studentMapByNameClass.has(`${rawClass.trim().toLowerCase()}__${rawName.trim().toLowerCase()}`)) {
          matched = studentMapByNameClass.get(`${rawClass.trim().toLowerCase()}__${rawName.trim().toLowerCase()}`);
        } else if (rawName && studentMapByName.has(rawName.trim().toLowerCase())) {
          matched = studentMapByName.get(rawName.trim().toLowerCase());
        }

        // Check if attendance record already exists for this date
        const studentId = matched?.id;
        let existingRec: AttendanceRecord | undefined = undefined;
        if (studentId && existingRecordsMap.has(`${parsedDate}__${studentId}`)) {
          existingRec = existingRecordsMap.get(`${parsedDate}__${studentId}`);
        } else if (rawNisn && rawNisn !== '-' && existingRecordsMap.has(`${parsedDate}__nisn_${rawNisn}`)) {
          existingRec = existingRecordsMap.get(`${parsedDate}__nisn_${rawNisn}`);
        } else if (rawName && existingRecordsMap.has(`${parsedDate}__name_${rawName.toLowerCase()}`)) {
          existingRec = existingRecordsMap.get(`${parsedDate}__name_${rawName.toLowerCase()}`);
        }

        parsedList.push({
          rowNumber: idx + 1,
          nisn: rawNisn || matched?.nisn || '-',
          nis: rawNis || matched?.nis || '-',
          studentName: matched?.name || rawName,
          className: matched?.className || rawClass || '-',
          date: parsedDate,
          entryTime: parsedEntryTime,
          entryStatus: parsedEntryStatus,
          entryScannedBy: rawScannedBy,
          returnTime: validReturnTime,
          returnStatus: parsedReturnStatus,
          returnScannedBy: rawReturnScannedBy,
          notes: (rawNotes && rawNotes !== '-') ? rawNotes : undefined,
          matchedStudent: matched,
          existingRecord: existingRec,
          actionType: existingRec ? 'UPDATE' : 'CREATE'
        });
      });

      if (parsedList.length === 0) {
        throw new Error('Tidak ada baris data siswa yang cocok ditemukan dalam berkas Excel. Pastikan header kolom sesuai.');
      }

      setParsedRows(parsedList);
    } catch (err: any) {
      console.error('[Import Excel Parse Error]', err);
      setParseError(err?.message || 'Gagal membaca berkas Excel. Pastikan format file .xlsx valid.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      exportDashboardAttendanceExcel({
        schoolProfile,
        students,
        records: attendanceRecords,
        selectedDate,
        selectedClassFilter: 'ALL',
      });
    } catch (err) {
      console.error('Failed to download template', err);
    }
  };

  const handleApplyImport = async () => {
    if (parsedRows.length === 0) return;
    setIsApplying(true);

    try {
      const now = Date.now();
      const currentRecords = getAttendanceRecords();

      // Create indexed map of records
      const recordMap = new Map<string, AttendanceRecord>();
      currentRecords.forEach(r => {
        recordMap.set(r.id, { ...r });
      });

      let updatedCount = 0;
      let createdCount = 0;

      parsedRows.forEach(row => {
        const studentId = row.matchedStudent?.id || `std-imported-${(row.nisn !== '-' ? row.nisn : row.studentName).replace(/\s+/g, '_')}`;
        const dedupeKey = `${row.date}__${studentId}`;

        // Find existing record
        let existingId: string | undefined = undefined;
        for (const [id, rec] of recordMap.entries()) {
          if (
            (rec.date === row.date && rec.studentId === studentId) ||
            (row.nisn && row.nisn !== '-' && rec.date === row.date && rec.nisn === row.nisn) ||
            (rec.date === row.date && rec.studentName && row.studentName && rec.studentName.trim().toLowerCase() === row.studentName.trim().toLowerCase())
          ) {
            existingId = id;
            break;
          }
        }

        if (existingId && recordMap.has(existingId)) {
          // UPDATE existing record
          const existing = recordMap.get(existingId)!;
          const updated: AttendanceRecord = {
            ...existing,
            studentName: row.studentName || existing.studentName,
            nisn: row.nisn !== '-' ? row.nisn : existing.nisn,
            className: row.className !== '-' ? row.className : existing.className,
            status: row.entryStatus,
            time: row.entryTime !== '-' ? row.entryTime : (row.entryStatus === 'HADIR' ? '07:00' : (row.entryStatus === 'TERLAMBAT' ? '07:35' : '-')),
            notes: row.notes !== undefined ? row.notes : existing.notes,
            scannedBy: row.entryScannedBy || existing.scannedBy || 'Import Excel (Admin)',
            updatedAt: now,
            isRealScan: true,
            isSynthetic: false,
          };

          if (row.returnTime) {
            updated.returnTime = row.returnTime;
            updated.returnStatus = row.returnStatus || 'PULANG';
            updated.returnScannedBy = row.returnScannedBy || 'Import Excel (Admin)';
            updated.returnUpdatedAt = now;
          }

          recordMap.set(existingId, updated);
          updatedCount++;
        } else {
          // CREATE new attendance record
          const newId = `att-imp-${now}-${studentId.substring(0, 8)}-${Math.random().toString(36).substring(2, 6)}`;
          const newRec: AttendanceRecord = {
            id: newId,
            studentId,
            studentName: row.studentName,
            nisn: row.nisn !== '-' ? row.nisn : '',
            className: row.className !== '-' ? row.className : '',
            date: row.date,
            time: row.entryTime !== '-' ? row.entryTime : (row.entryStatus === 'HADIR' ? '07:00' : (row.entryStatus === 'TERLAMBAT' ? '07:35' : '-')),
            status: row.entryStatus,
            method: 'MANUAL',
            scannedBy: row.entryScannedBy || 'Import Excel (Admin)',
            notes: row.notes,
            returnTime: row.returnTime,
            returnStatus: row.returnStatus,
            returnScannedBy: row.returnScannedBy,
            parentNotified: false,
            updatedAt: now,
            returnUpdatedAt: row.returnTime ? now : undefined,
            isRealScan: true,
            isSynthetic: false,
          };

          recordMap.set(newId, newRec);
          createdCount++;
        }
      });

      const finalRecordsList = Array.from(recordMap.values());
      const sanitized = validateAndSanitizeAttendanceRecords(finalRecordsList);

      // Save to storage and sync to cloud
      saveAttendanceRecords(sanitized, true);

      const totalHandled = updatedCount + createdCount;
      const successMessage = `Berhasil mengimpor data presensi: ${updatedCount} diperbarui, ${createdCount} data baru ditambahkan!`;
      onImportSuccess(totalHandled, successMessage);
      onClose();
    } catch (err: any) {
      console.error('[Apply Import Error]', err);
      setParseError(err?.message || 'Gagal menyimpan hasil impor presensi.');
    } finally {
      setIsApplying(false);
    }
  };

  // Filtered rows for preview table
  const displayedRows = useMemo(() => {
    let list = parsedRows;
    if (statusFilter !== 'ALL') {
      list = list.filter(r => r.entryStatus === statusFilter);
    }
    const q = searchFilter.trim().toLowerCase();
    if (q) {
      list = list.filter(r => 
        r.studentName.toLowerCase().includes(q) ||
        r.className.toLowerCase().includes(q) ||
        r.nisn.includes(q)
      );
    }
    return list;
  }, [parsedRows, statusFilter, searchFilter]);

  // Statistics from parsed data
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const hadir = parsedRows.filter(r => r.entryStatus === 'HADIR').length;
    const terlambat = parsedRows.filter(r => r.entryStatus === 'TERLAMBAT').length;
    const sakit = parsedRows.filter(r => r.entryStatus === 'SAKIT').length;
    const izin = parsedRows.filter(r => r.entryStatus === 'IZIN').length;
    const alpa = parsedRows.filter(r => r.entryStatus === 'ALPA').length;
    const sudahPulang = parsedRows.filter(r => !!r.returnTime).length;
    const updateCount = parsedRows.filter(r => r.actionType === 'UPDATE').length;
    const createCount = parsedRows.filter(r => r.actionType === 'CREATE').length;
    const dates = Array.from(new Set(parsedRows.map(r => r.date)));

    return { total, hadir, terlambat, sakit, izin, alpa, sudahPulang, updateCount, createCount, dates };
  }, [parsedRows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Import Data Presensi Siswa (Excel)
                </h3>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-200">
                  Khusus Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Ubah & perbarui data kehadiran siswa menggunakan berkas format yang sama dengan &apos;Download Excel&apos;
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* File Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-5 text-center transition-all ${
              file ? 'border-blue-400 bg-blue-50/30' : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/20'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls"
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 text-left">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                    {file ? file.name : 'Pilih atau Tarik Berkas Excel Presensi (.xlsx / .xls)'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {file 
                      ? `${(file.size / 1024).toFixed(1)} KB • Klik untuk ganti berkas` 
                      : 'Format kolom otomatis mengikuti format hasil tombol "Download Excel"'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{file ? 'Ganti File' : 'Pilih Berkas'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  title="Unduh format Excel presensi saat ini sebagai template acuan"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Unduh Acuan Excel</span>
                </button>
              </div>
            </div>
          </div>

          {/* Error Notice */}
          {parseError && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-3 text-xs text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-extrabold block">Gagal Memproses Berkas:</strong>
                <p className="text-[11px] text-rose-800 mt-0.5">{parseError}</p>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isParsing && (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-500">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-700">Membaca dan memetakan data presensi dari Excel...</p>
            </div>
          )}

          {/* Parsed Summary and Table Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Baris</span>
                  <span className="text-base font-black text-slate-800">{stats.total}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 text-center">
                  <span className="text-[10px] font-bold text-emerald-600 block uppercase">Hadir</span>
                  <span className="text-base font-black text-emerald-700">{stats.hadir}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 text-center">
                  <span className="text-[10px] font-bold text-amber-600 block uppercase">Terlambat</span>
                  <span className="text-base font-black text-amber-700">{stats.terlambat}</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-2.5 text-center">
                  <span className="text-[10px] font-bold text-blue-600 block uppercase">Sakit</span>
                  <span className="text-base font-black text-blue-700">{stats.sakit}</span>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-2.5 text-center">
                  <span className="text-[10px] font-bold text-purple-600 block uppercase">Izin</span>
                  <span className="text-base font-black text-purple-700">{stats.izin}</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-2.5 text-center">
                  <span className="text-[10px] font-bold text-rose-600 block uppercase">Alpa</span>
                  <span className="text-base font-black text-rose-700">{stats.alpa}</span>
                </div>
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-2.5 text-center">
                  <span className="text-[10px] font-bold text-teal-600 block uppercase">Sudah Pulang</span>
                  <span className="text-base font-black text-teal-700">{stats.sudahPulang}</span>
                </div>
              </div>

              {/* Action Preview Banner */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-blue-900">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Tanggal Presensi Terdeteksi: <strong className="font-extrabold">{stats.dates.join(', ') || selectedDate}</strong> • 
                    <span className="ml-1 text-emerald-700 font-bold">{stats.updateCount} data akan diperbarui</span>, 
                    <span className="ml-1 text-indigo-700 font-bold">{stats.createCount} data baru</span>
                  </span>
                </div>
                <div className="text-[11px] font-bold text-slate-500">
                  Menampilkan {displayedRows.length} dari {parsedRows.length} baris
                </div>
              </div>

              {/* Table Search & Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Cari siswa / kelas / NISN..."
                      className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="HADIR">Hadir</option>
                    <option value="TERLAMBAT">Terlambat</option>
                    <option value="SAKIT">Sakit</option>
                    <option value="IZIN">Izin</option>
                    <option value="ALPA">Alpa</option>
                  </select>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 text-center">No</th>
                      <th className="py-2 px-3">Nama Siswa & Kelas</th>
                      <th className="py-2 px-3">Tanggal</th>
                      <th className="py-2 px-3">Masuk (Jam & Status)</th>
                      <th className="py-2 px-3">Pulang (Jam & Status)</th>
                      <th className="py-2 px-3">Keterangan</th>
                      <th className="py-2 px-3 text-center">Aksi Sistem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 font-medium">
                          Tidak ada baris yang sesuai dengan pencarian filter.
                        </td>
                      </tr>
                    ) : (
                      displayedRows.map((r, idx) => {
                        const getStatusBadge = (status: AttendanceRecord['status']) => {
                          switch (status) {
                            case 'HADIR':
                              return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md text-[10px]">Hadir</span>;
                            case 'TERLAMBAT':
                              return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold rounded-md text-[10px]">Terlambat</span>;
                            case 'SAKIT':
                              return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-extrabold rounded-md text-[10px]">Sakit</span>;
                            case 'IZIN':
                              return <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-extrabold rounded-md text-[10px]">Izin</span>;
                            case 'ALPA':
                              return <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-extrabold rounded-md text-[10px]">Alpa</span>;
                            default:
                              return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded-md text-[10px]">{status}</span>;
                          }
                        };

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                              {r.rowNumber}
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-extrabold text-slate-900 block leading-tight">{r.studentName}</span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                Kelas: {r.className} {r.nisn !== '-' ? `• NISN: ${r.nisn}` : ''}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {r.date}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {getStatusBadge(r.entryStatus)}
                                <span className="font-mono text-[11px] font-bold text-slate-700">
                                  {r.entryTime !== '-' ? `${r.entryTime} WITA` : '-'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              {r.returnTime ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 bg-teal-100 text-teal-800 font-extrabold rounded-md text-[10px]">
                                    Pulang
                                  </span>
                                  <span className="font-mono text-[11px] font-bold text-slate-700">
                                    {r.returnTime} WITA
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-medium italic">Belum Pulang</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-[11px] text-slate-600 max-w-[140px] truncate">
                              {r.notes || '-'}
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              {r.actionType === 'UPDATE' ? (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-md text-[10px]">
                                  Perbarui
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 font-bold rounded-md text-[10px]">
                                  + Data Baru
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/80">
          <div className="text-[11px] text-slate-500 font-medium text-center sm:text-left">
            Data yang diimpor akan langsung tersinkron ke Cloud Firestore dan memperbarui dasbor kehadiran secara instan.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-extrabold text-xs cursor-pointer transition-all disabled:opacity-60"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyImport}
              disabled={isApplying || parsedRows.length === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyimpan ke Cloud...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Terapkan Perubahan ({parsedRows.length} Data)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
