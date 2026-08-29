import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Student, SchoolClass } from '../types';
import { downloadStudentImportTemplate } from '../lib/exportUtils';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  FileCheck,
  Trash2,
  HelpCircle,
  Loader2
} from 'lucide-react';

interface ParsedStudentRow {
  nisn: string;
  nis: string;
  name: string;
  gender: 'L' | 'P';
  className: string;
  birthPlaceDate: string;
  address: string;
  parentPhone: string;
  parentName: string;
  isDuplicate: boolean;
  isValid: boolean;
  validationError?: string;
  selected: boolean;
}

interface ImportStudentsModalProps {
  existingStudents: Student[];
  classes: SchoolClass[];
  onImportStudents: (newStudents: Student[], newClasses?: SchoolClass[]) => void;
  onClose: () => void;
}

export const ImportStudentsModal: React.FC<ImportStudentsModalProps> = ({
  existingStudents,
  classes,
  onImportStudents,
  onClose,
}) => {
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  // Handle Excel/CSV File Upload & Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    setImportSuccessCount(null);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // Convert sheet to JSON array of objects
        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rawJson.length === 0) {
          alert('File Excel kosong atau tidak memiliki data.');
          setIsLoading(false);
          return;
        }

        const existingNisnMap = new Set(existingStudents.map(s => s.nisn.trim().toLowerCase()));
        const existingNisMap = new Set(existingStudents.map(s => s.nis.trim().toLowerCase()));

        const rows: ParsedStudentRow[] = rawJson.map((row) => {
          // Flexible key lookup
          const findVal = (keys: string[]) => {
            for (const key of keys) {
              const matchedKey = Object.keys(row).find(
                k => k.trim().toLowerCase() === key.toLowerCase()
              );
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
                return String(row[matchedKey]).trim();
              }
            }
            return '';
          };

          const nisn = findVal(['nisn', 'nomor induk siswa nasional', 'no nisn']);
          const nis = findVal(['nis', 'nomor induk sekolah', 'no nis']);
          const name = findVal(['nama lengkap', 'nama siswa', 'nama', 'name']);
          const rawGender = findVal(['jenis kelamin (l/p)', 'jenis kelamin', 'jk', 'gender', 'l/p']);
          const className = findVal(['kelas', 'class', 'nama kelas']);
          const birthPlaceDate = findVal(['tempat, tgl lahir', 'tempat tgl lahir', 'ttl', 'tempat tanggal lahir']);
          const address = findVal(['alamat', 'alamat rumah', 'address']);
          const parentPhone = findVal(['no hp ortu', 'no hp', 'no whatsapp', 'no wa ortu', 'no hp orang tua', 'parent phone']);
          const parentName = findVal(['nama orang tua / wali', 'nama orang tua', 'nama ortu', 'nama wali', 'parent name']);

          // Determine gender
          let gender: 'L' | 'P' = 'L';
          const gUpper = rawGender.toUpperCase();
          if (gUpper.startsWith('P') || gUpper.includes('PEREMPUAN') || gUpper.includes('FEMALE')) {
            gender = 'P';
          }

          // Validation
          const isValid = Boolean(name.length > 0);
          let validationError = '';

          if (!name) {
            validationError = 'Nama wajib diisi';
          }

          const isDuplicate = Boolean(
            (nisn && existingNisnMap.has(nisn.toLowerCase())) ||
            (nis && existingNisMap.has(nis.toLowerCase()))
          );

          if (isDuplicate) {
            validationError = validationError ? `${validationError}, NISN/NIS sudah terdaftar` : 'NISN/NIS sudah terdaftar';
          }

          return {
            nisn: nisn || `008${Math.floor(1000000 + Math.random() * 9000000)}`,
            nis: nis || `${new Date().getFullYear()}${Math.floor(100 + Math.random() * 900)}`,
            name: name || 'Siswa Tanpa Nama',
            gender,
            className: className || 'Kelas Umum',
            birthPlaceDate: birthPlaceDate || '-',
            address: address || '-',
            parentPhone: parentPhone || '081234567890',
            parentName: parentName || 'Orang Tua Siswa',
            isDuplicate,
            isValid,
            validationError,
            selected: isValid && !isDuplicate
          };
        });

        setParsedRows(rows);
      } catch (err) {
        console.error('Error reading excel:', err);
        alert('Gagal membaca file Excel/CSV. Pastikan format file sesuai.');
      } finally {
        setIsLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleToggleSelectRow = (index: number) => {
    setParsedRows(prev => prev.map((r, idx) => idx === index ? { ...r, selected: !r.selected } : r));
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setParsedRows(prev => prev.map(r => ({ ...r, selected: checked && r.isValid })));
  };

  const handleRemoveRow = (index: number) => {
    setParsedRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirmImport = () => {
    const selectedRows = parsedRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      alert('Tidak ada data siswa yang dipilih untuk diimport.');
      return;
    }

    const newClassesMap = new Map<string, SchoolClass>();

    const newStudents: Student[] = selectedRows.map((r, idx) => {
      const rawClassName = (r.className || 'Kelas Umum').trim();
      const classNameLower = rawClassName.toLowerCase();

      let matchedClass = classes.find(c => c.name.trim().toLowerCase() === classNameLower);

      if (!matchedClass) {
        if (!newClassesMap.has(classNameLower)) {
          const createdClass: SchoolClass = {
            id: `cls-${classNameLower.replace(/[^a-z0-9]/g, '-')}-${Date.now()}-${idx}`,
            grade: rawClassName.split(' ')[0] || 'Umum',
            name: rawClassName,
            homeroomTeacher: 'Wali Kelas - Belum Ditentukan'
          };
          newClassesMap.set(classNameLower, createdClass);
        }
        matchedClass = newClassesMap.get(classNameLower);
      }

      // Avatar photo default based on gender
      const photoUrl = r.gender === 'P'
        ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80';

      return {
        id: `std-${Date.now()}-${idx}`,
        nisn: r.nisn,
        nis: r.nis,
        name: r.name,
        gender: r.gender,
        classId: matchedClass ? matchedClass.id : 'cls-umum',
        className: rawClassName,
        parentName: r.parentName,
        parentPhone: r.parentPhone,
        photoUrl,
        qrCode: `STUDENT-${r.nisn || Date.now()}`,
        birthPlaceDate: r.birthPlaceDate,
        address: r.address
      };
    });

    const newClasses = Array.from(newClassesMap.values());
    onImportStudents(newStudents, newClasses);
    setImportSuccessCount(newStudents.length);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const totalRows = parsedRows.length;
  const selectedCount = parsedRows.filter(r => r.selected).length;
  const duplicateCount = parsedRows.filter(r => r.isDuplicate).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Import Data Siswa Baru via Excel / CSV
              </h3>
              <p className="text-xs text-slate-500">
                Tambah puluhan hingga ratusan siswa sekaligus menggunakan file Excel
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Download Template Banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">
                Belum punya format file Excel yang sesuai?
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Unduh file contoh format Excel berikut. Isi data siswa Anda lalu upload di bawah.
              </p>
            </div>
          </div>

          <button
            onClick={downloadStudentImportTemplate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer shrink-0 self-stretch sm:self-auto justify-center"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Format Contoh Excel (.xlsx)
          </button>
        </div>

        {/* Step 2: Upload Area */}
        {parsedRows.length === 0 ? (
          <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-8 text-center bg-slate-50/50 hover:bg-emerald-50/30 transition-all group relative cursor-pointer">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
            />
            <div className="flex flex-col items-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 group-hover:bg-emerald-100 text-indigo-600 group-hover:text-emerald-700 flex items-center justify-center transition-colors">
                {isLoading ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <Upload className="w-7 h-7" />
                )}
              </div>
              <div>
                <p className="font-extrabold text-slate-800 text-sm">
                  {isLoading ? 'Membaca data file Excel...' : 'Klik atau seret file Excel / CSV di sini'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Mendukung format .XLSX, .XLS, atau .CSV (Maksimal 5.000 siswa sekaligus)
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Step 3: Preview Table & Controls */
          <div className="space-y-4">
            
            {/* Top Stats Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-semibold">
              <div className="flex items-center space-x-3 flex-wrap">
                <span className="text-slate-700">File: <strong className="text-indigo-700">{fileName}</strong></span>
                <span className="bg-slate-200 px-2.5 py-1 rounded-lg text-slate-800">
                  Total: {totalRows} Siswa
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                  Dipilih: {selectedCount}
                </span>
                {duplicateCount > 0 && (
                  <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Duplikat: {duplicateCount}
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg">
                    Invalidd: {invalidCount}
                  </span>
                )}
              </div>

              <label className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                Ganti File Excel
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Parsed Preview Table */}
            <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-extrabold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCount > 0 && selectedCount === parsedRows.filter(r => r.isValid).length}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">NISN / NIS</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3">JK</th>
                    <th className="p-3">No HP Ortu</th>
                    <th className="p-3">Status Validasi</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {parsedRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50 transition-colors ${
                        row.isDuplicate ? 'bg-amber-50/60' : !row.isValid ? 'bg-rose-50/60' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          disabled={!row.isValid}
                          checked={row.selected}
                          onChange={() => handleToggleSelectRow(idx)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                        />
                      </td>
                      <td className="p-3 font-extrabold text-slate-900">{row.name}</td>
                      <td className="p-3 font-mono text-[11px]">
                        <span className="text-slate-800 font-bold">{row.nisn}</span>
                        <span className="text-slate-400 block text-[10px]">NIS: {row.nis}</span>
                      </td>
                      <td className="p-3">
                        <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md">
                          {row.className}
                        </span>
                      </td>
                      <td className="p-3 font-bold">{row.gender}</td>
                      <td className="p-3 font-mono">{row.parentPhone}</td>
                      <td className="p-3">
                        {row.selected ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Siap Import
                          </span>
                        ) : row.isDuplicate ? (
                          <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            {row.validationError}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold text-[11px]">
                            Tidak Dipilih
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* Success Alert Banner */}
        {importSuccessCount !== null && (
          <div className="bg-emerald-600 text-white p-3.5 rounded-2xl flex items-center gap-3 font-extrabold text-xs shadow-lg animate-bounce">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Berhasil mengimpor {importSuccessCount} siswa baru ke dalam database! Menutup jendela...</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-semibold">
          <p className="text-slate-500 flex items-center gap-1.5 text-xs">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
            Format yang didukung: XLSX, XLS, CSV (Header kolom otomatis dicocokkan)
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer font-bold transition-all"
            >
              Batal
            </button>

            {parsedRows.length > 0 && (
              <button
                onClick={handleConfirmImport}
                disabled={selectedCount === 0 || importSuccessCount !== null}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-md font-extrabold flex items-center gap-2 cursor-pointer transition-all"
              >
                <FileCheck className="w-4 h-4" />
                Import ({selectedCount}) Siswa Terpilih
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
