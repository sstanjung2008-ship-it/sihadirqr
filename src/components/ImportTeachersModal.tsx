import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Teacher, SchoolClass } from '../types';
import { downloadTeacherImportTemplate } from '../lib/exportUtils';
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

interface ParsedTeacherRow {
  nip: string;
  name: string;
  gender: 'L' | 'P';
  birthPlace: string;
  birthDate: string;
  subject1: string;
  subject2: string;
  additionalDuty: 'WAKIL_KEPALA_SEKOLAH' | 'HUMAS' | 'BK' | 'WALI_KELAS' | 'ADMIN' | 'TU' | 'PERPUSTAKAAN' | 'TIDAK_ADA';
  homeroomClassName: string;
  phone: string;
  email: string;
  isDuplicate: boolean;
  isValid: boolean;
  validationError?: string;
  selected: boolean;
}

interface ImportTeachersModalProps {
  existingTeachers: Teacher[];
  classes: SchoolClass[];
  onImportTeachers: (newTeachers: Teacher[]) => void;
  onClose: () => void;
}

export const ImportTeachersModal: React.FC<ImportTeachersModalProps> = ({
  existingTeachers,
  classes,
  onImportTeachers,
  onClose,
}) => {
  const [parsedRows, setParsedRows] = useState<ParsedTeacherRow[]>([]);
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

        const existingNipSet = new Set(
          existingTeachers
            .filter(t => t.nip && t.nip.trim() !== '')
            .map(t => t.nip.trim().toLowerCase())
        );

        const rows: ParsedTeacherRow[] = rawJson.map((row) => {
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

          const nip = findVal(['nip', 'nomor induk pegawai', 'no nip']);
          const name = findVal(['nama guru', 'nama lengkap', 'nama', 'name']);
          const rawGender = findVal(['jenis kelamin (l/p)', 'jenis kelamin', 'jk', 'gender', 'l/p']);
          const birthPlace = findVal(['tempat lahir', 'tempat_lahir', 'birth place']);
          const birthDate = findVal(['tanggal lahir', 'tgl lahir', 'tanggal_lahir', 'tgl_lahir', 'birth date']);
          const subject1 = findVal(['mata pelajaran utama', 'mapel 1', 'mapel utama', 'mata pelajaran 1', 'subject1', 'mapel']);
          const subject2 = findVal(['mata pelajaran kedua', 'mapel 2', 'mapel kedua', 'mata pelajaran 2', 'subject2']);
          const rawDuty = findVal(['tugas tambahan', 'tugas_tambahan', 'jabatan', 'tugas', 'additional duty']);
          const homeroomClassName = findVal(['wali kelas', 'kelas wali', 'wali_kelas', 'homeroom class']);
          const phone = findVal(['no hp / wa', 'no hp', 'no whatsapp', 'no wa', 'phone', 'telepon', 'hp']);
          const email = findVal(['email', 'e-mail']);

          // Determine gender
          let gender: 'L' | 'P' = 'L';
          const gUpper = rawGender.toUpperCase();
          if (gUpper.startsWith('P') || gUpper.includes('PEREMPUAN') || gUpper.includes('FEMALE')) {
            gender = 'P';
          }

          // Determine additional duty
          let additionalDuty: 'WAKIL_KEPALA_SEKOLAH' | 'HUMAS' | 'BK' | 'WALI_KELAS' | 'ADMIN' | 'TU' | 'PERPUSTAKAAN' | 'TIDAK_ADA' = 'TIDAK_ADA';
          const dUpper = rawDuty.toUpperCase();
          if (dUpper.includes('WAKIL') || dUpper.includes('WAKASEK')) {
            additionalDuty = 'WAKIL_KEPALA_SEKOLAH';
          } else if (dUpper.includes('HUMAS')) {
            additionalDuty = 'HUMAS';
          } else if (dUpper.includes('BK') || dUpper.includes('BIMBINGAN') || dUpper.includes('KONSELING')) {
            additionalDuty = 'BK';
          } else if (dUpper.includes('ADMIN')) {
            additionalDuty = 'ADMIN';
          } else if (dUpper.includes('TU') || dUpper.includes('TATA USAHA')) {
            additionalDuty = 'TU';
          } else if (dUpper.includes('PERPUS') || dUpper.includes('PUSTAKA')) {
            additionalDuty = 'PERPUSTAKAAN';
          } else if (dUpper.includes('WALI')) {
            additionalDuty = 'WALI_KELAS';
          } else {
            additionalDuty = 'TIDAK_ADA';
          }

          // Validation
          const isValid = Boolean(name.length > 0);
          let validationError = '';

          if (!name) {
            validationError = 'Nama guru wajib diisi';
          }

          const isDuplicate = Boolean(nip && existingNipSet.has(nip.toLowerCase()));

          if (isDuplicate) {
            validationError = validationError ? `${validationError}, NIP sudah terdaftar` : 'NIP sudah terdaftar';
          }

          return {
            nip: nip || `199${Math.floor(10000000000 + Math.random() * 90000000000)}`,
            name: name || 'Guru Tanpa Nama',
            gender,
            birthPlace: birthPlace || '-',
            birthDate: birthDate || '1990-01-01',
            subject1: subject1 === '-' ? '' : (subject1 || ''),
            subject2: subject2 === '-' ? '' : subject2,
            additionalDuty,
            homeroomClassName: homeroomClassName === '-' ? '' : homeroomClassName,
            phone: phone || '081234567890',
            email: email || '',
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
      alert('Tidak ada data guru yang dipilih untuk diimport.');
      return;
    }

    const newTeachers: Teacher[] = selectedRows.map((r, idx) => {
      let targetClassId = '';
      let targetClassName = r.homeroomClassName;

      if (r.additionalDuty === 'WALI_KELAS' && targetClassName) {
        const foundClass = classes.find(
          c => c.name.trim().toLowerCase() === targetClassName.trim().toLowerCase()
        );
        if (foundClass) {
          targetClassId = foundClass.id;
          targetClassName = foundClass.name;
        }
      }

      const photoUrl = r.gender === 'P'
        ? 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&auto=format&fit=crop&q=80';

      return {
        id: `tch-${Date.now()}-${idx}`,
        nip: r.nip,
        name: r.name,
        gender: r.gender,
        birthPlace: r.birthPlace,
        birthDate: r.birthDate,
        subject1: r.subject1,
        subject2: r.subject2,
        additionalDuty: r.additionalDuty,
        homeroomClassId: targetClassId,
        homeroomClassName: targetClassName,
        phone: r.phone,
        email: r.email,
        status: 'AKTIF',
        photoUrl
      };
    });

    onImportTeachers(newTeachers);
    setImportSuccessCount(newTeachers.length);
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
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Import Data Guru Baru via Excel / CSV
              </h3>
              <p className="text-xs text-slate-500">
                Tambah data bapak/ibu guru sekaligus menggunakan file Excel
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
        <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">
                Belum punya format file Excel yang sesuai?
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Unduh file contoh format Excel berikut. Isi data guru Anda lalu upload di bawah.
              </p>
            </div>
          </div>

          <button
            onClick={downloadTeacherImportTemplate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0 self-stretch sm:self-auto justify-center"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Format Contoh Excel (.xlsx)
          </button>
        </div>

        {/* Step 2: Upload Area */}
        {parsedRows.length === 0 ? (
          <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-3xl p-8 text-center bg-slate-50/50 hover:bg-indigo-50/30 transition-all group relative cursor-pointer">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
            />
            <div className="flex flex-col items-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-colors">
                {isLoading ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <Upload className="w-7 h-7" />
                )}
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-800">
                  Klik atau Tarik File Excel / CSV di Sini
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Format yang didukung: .xlsx, .xls, .csv (Maksimal 10MB)
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Step 3: Parsed Data Preview Table */
          <div className="space-y-4">
            {/* Stats Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs font-bold text-slate-700">
              <div className="flex items-center space-x-4">
                <span>📁 File: <strong className="text-slate-900">{fileName}</strong></span>
                <span className="text-indigo-600">Total: {totalRows} Guru</span>
                <span className="text-emerald-600">Siap Import: {selectedCount}</span>
                {duplicateCount > 0 && <span className="text-amber-600">NIP Duplikat: {duplicateCount}</span>}
                {invalidCount > 0 && <span className="text-rose-600">Tidak Valid: {invalidCount}</span>}
              </div>

              <button
                onClick={() => {
                  setParsedRows([]);
                  setFileName('');
                }}
                className="text-rose-600 hover:text-rose-700 font-extrabold cursor-pointer"
              >
                Ganti File Excel
              </button>
            </div>

            {/* Table Container */}
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-2xl shadow-inner">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-extrabold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCount === parsedRows.filter(r => r.isValid).length && selectedCount > 0}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">NIP</th>
                    <th className="p-3">Nama Guru</th>
                    <th className="p-3">JK</th>
                    <th className="p-3">Mapel Utama</th>
                    <th className="p-3">Tugas Tambahan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {parsedRows.map((row, idx) => (
                    <tr 
                      key={idx} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !row.isValid ? 'bg-rose-50/50' : row.isDuplicate ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={!row.isValid}
                          onChange={() => handleToggleSelectRow(idx)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{row.nip}</td>
                      <td className="p-3 font-extrabold text-slate-900">{row.name}</td>
                      <td className="p-3">{row.gender}</td>
                      <td className="p-3 font-bold text-indigo-700">{row.subject1}</td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          {row.additionalDuty === 'WAKIL_KEPALA_SEKOLAH' ? 'Wakasek' :
                           row.additionalDuty === 'HUMAS' ? 'Humas' :
                           row.additionalDuty === 'BK' ? 'BK' :
                           row.additionalDuty === 'ADMIN' ? 'Admin' :
                           row.additionalDuty === 'TU' ? 'TU' :
                           row.additionalDuty === 'PERPUSTAKAAN' ? 'Perpustakaan' :
                           row.additionalDuty === 'WALI_KELAS' ? `Wali Kelas ${row.homeroomClassName || ''}` : 'Guru Mapel'}
                        </span>
                      </td>
                      <td className="p-3">
                        {row.isDuplicate ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3" /> NIP Duplikat
                          </span>
                        ) : !row.isValid ? (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3" /> {row.validationError}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3" /> Valid
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleRemoveRow(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="Hapus Baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importSuccessCount !== null && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-xl font-bold text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Berhasil mengimport {importSuccessCount} data guru baru ke database!
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-extrabold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={selectedCount === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold px-6 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                Import {selectedCount} Data Guru
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
