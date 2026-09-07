import React, { useState } from 'react';
import { Student, SchoolProfile } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { getSchoolProfile } from '../lib/storage';
import { exportBatchStudentCardsPdf, exportBatchQrStickersPdf } from '../lib/exportUtils';
import { X, Printer, GraduationCap, QrCode, FileText, Download, Loader2, Filter } from 'lucide-react';
import { SchoolClass } from '../types';

interface BatchPrintModalProps {
  initialMode: 'CARDS' | 'QR';
  students: Student[];
  allFilteredStudents: Student[];
  allStudents?: Student[];
  classes?: SchoolClass[];
  initialClass?: string;
  onClose: () => void;
}

export const BatchPrintModal: React.FC<BatchPrintModalProps> = ({
  initialMode,
  students,
  allFilteredStudents,
  allStudents = [],
  classes = [],
  initialClass = 'ALL',
  onClose,
}) => {
  const schoolProfile: SchoolProfile = getSchoolProfile();
  const [mode, setMode] = useState<'CARDS' | 'QR'>(initialMode);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(initialClass);
  const [scope, setScope] = useState<'PAGE' | 'ALL'>('PAGE');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('LANDSCAPE');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Pool of all students available
  const pool = React.useMemo(() => {
    return allStudents.length > 0 ? allStudents : allFilteredStudents;
  }, [allStudents, allFilteredStudents]);

  // List of sorted classes for dropdown
  const sortedClassesList = React.useMemo(() => {
    if (classes && classes.length > 0) {
      return [...classes].sort((a, b) =>
        a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
      );
    }
    const uniqueNames = Array.from(new Set<string>(pool.map(s => s.className))).filter(Boolean);
    return uniqueNames
      .sort((a: string, b: string) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }))
      .map(cName => ({ id: cName, name: cName, grade: 7, subClass: '' }));
  }, [classes, pool]);

  // Active students filtered by class selection or scope
  const activeStudents = React.useMemo(() => {
    if (selectedClassFilter === 'ALL') {
      return scope === 'PAGE' ? students : allFilteredStudents;
    }
    return pool.filter(
      s => s.className === selectedClassFilter || s.classId === selectedClassFilter
    );
  }, [selectedClassFilter, scope, students, allFilteredStudents, pool]);

  const handleDownloadPdf = async () => {
    if (activeStudents.length === 0) {
      alert('Tidak ada data siswa untuk diexport.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      if (mode === 'CARDS') {
        await exportBatchStudentCardsPdf(activeStudents, schoolProfile, orientation);
      } else {
        await exportBatchQrStickersPdf(activeStudents, schoolProfile);
      }
    } catch (err) {
      console.error('Failed to export batch PDF:', err);
      alert('Gagal membuat file PDF. Mencoba cetak standar browser...');
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-auto print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full">
        
        {/* Modal Top Control Header (Hidden when printing) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 print:hidden">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
              {mode === 'CARDS' ? (
                <>
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  Cetak / Download Kolektif Kartu Tanda Pelajar (KTS)
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5 text-emerald-600" />
                  Cetak / Download Kolektif Stiker QR Code Presensi
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Siap cetak dalam 1 halaman A4 untuk <span className="font-bold text-indigo-600">{activeStudents.length} Siswa</span> {
                selectedClassFilter !== 'ALL'
                  ? `(Kelas ${selectedClassFilter})`
                  : (scope === 'PAGE' ? '(Halaman Aktif)' : '(Semua Siswa Terfilter)')
              }
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setMode('CARDS')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'CARDS'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Kartu Pelajar
              </button>
              <button
                onClick={() => setMode('QR')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'QR'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                Stiker QR
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Options Toolbar (Hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs font-semibold print:hidden">
          
          {/* Filter Kelas Select */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-bold flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              Filter Kelas:
            </span>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
            >
              <option value="ALL">Semua Kelas ({pool.length} Siswa)</option>
              {sortedClassesList.map(c => {
                const count = pool.filter(s => s.className === c.name || s.classId === c.id || s.className === c.id).length;
                return (
                  <option key={c.id} value={c.name}>
                    Kelas {c.name} ({count} Siswa)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Scope Selector (Only shown if 'ALL' class is selected) */}
          {selectedClassFilter === 'ALL' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-600">Lingkup:</span>
              <button
                onClick={() => setScope('PAGE')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer font-bold ${
                  scope === 'PAGE'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Halaman Ini ({students.length} Siswa)
              </button>
              <button
                onClick={() => setScope('ALL')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer font-bold ${
                  scope === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Semua ({allFilteredStudents.length} Siswa)
              </button>
            </div>
          )}

          {mode === 'CARDS' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-600">Format Kartu:</span>
              <button
                onClick={() => setOrientation('LANDSCAPE')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer font-bold ${
                  orientation === 'LANDSCAPE'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Landscape
              </button>
              <button
                onClick={() => setOrientation('PORTRAIT')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer font-bold ${
                  orientation === 'PORTRAIT'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Portrait
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handlePrint}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl border border-slate-200 flex items-center gap-1.5 cursor-pointer text-xs transition-all"
              title="Buka dialog cetak browser (Ctrl+P)"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Cetak Browser
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold px-4 py-2 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all text-xs"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download File PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Print Preview Container */}
        <div className="max-h-[60vh] overflow-y-auto p-4 bg-slate-100/70 rounded-2xl border border-slate-200/80 print:max-h-none print:overflow-visible print:bg-white print:p-0 print:border-none">
          
          {mode === 'CARDS' ? (
            /* ================= BATCH STUDENT ID CARDS SHEET ================= */
            <div className={`grid gap-4 print:gap-3 ${
              orientation === 'LANDSCAPE' 
                ? 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2' 
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3'
            }`}>
              {activeStudents.map((std) => (
                <div
                  key={std.id}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-300 font-sans flex flex-col justify-between shrink-0 page-break-inside-avoid ${
                    orientation === 'LANDSCAPE' ? 'h-[200px]' : 'h-[300px]'
                  }`}
                >
                  {/* Card Header Banner */}
                  <div className="bg-gradient-to-r from-indigo-800 via-indigo-700 to-indigo-800 p-2 text-white flex items-center justify-between shrink-0">
                    <div className="w-7 h-7 rounded-lg bg-white p-0.5 flex items-center justify-center shrink-0">
                      <img
                        src={schoolProfile.schoolLogo}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="text-center px-1 flex-1">
                      <h4 className="text-[10px] font-black uppercase text-white truncate leading-tight">
                        {schoolProfile.name}
                      </h4>
                      <p className="text-[8px] text-amber-300 uppercase tracking-tight font-extrabold">
                        KARTU TANDA PELAJAR
                      </p>
                    </div>
                    <div className="w-6 h-6 rounded-lg bg-white p-0.5 flex items-center justify-center shrink-0">
                      <img
                        src={schoolProfile.regencyLogo}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                  </div>

                  {/* Accent bar */}
                  <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-500" />

                  {/* Card Main Body */}
                  {orientation === 'LANDSCAPE' ? (
                    <div className="p-2.5 flex items-center gap-3 flex-1 bg-white text-slate-800">
                      <img
                        src={std.photoUrl || (std.gender === 'P'
                          ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                          : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80')}
                        alt={std.name}
                        className="w-20 h-24 rounded-xl object-cover ring-2 ring-indigo-100 shadow-sm shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = std.gender === 'P'
                            ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                            : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80';
                        }}
                      />
                      <div className="flex-1 min-w-0 text-[10px] space-y-0.5">
                        <p className="font-black text-slate-900 uppercase truncate text-[11px]">{std.name}</p>
                        <p className="text-indigo-700 font-bold font-mono">NISN: {std.nisn}</p>
                        <p className="text-slate-600 font-semibold">NIS: {std.nis}</p>
                        <p className="text-slate-600 font-semibold">Kelas: {std.className}</p>
                        <p className="text-slate-500 text-[9px] truncate">TTL: {std.birthPlaceDate || '-'}</p>
                      </div>
                      <div className="p-1 bg-white border border-slate-200 rounded-xl shrink-0 flex items-center justify-center">
                        <QRCodeSVG value={std.qrCode} size={64} level="M" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 flex flex-col items-center justify-between flex-1 bg-white text-slate-800 text-center">
                      <img
                        src={std.photoUrl || (std.gender === 'P'
                          ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                          : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80')}
                        alt={std.name}
                        className="w-16 h-20 rounded-xl object-cover ring-2 ring-indigo-100 shadow-sm shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = std.gender === 'P'
                            ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                            : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80';
                        }}
                      />
                      <div className="w-full text-[10px] my-1 space-y-0.5">
                        <p className="font-black text-slate-900 uppercase truncate text-[11px]">{std.name}</p>
                        <p className="text-indigo-700 font-bold font-mono">NISN: {std.nisn}</p>
                        <p className="text-slate-600 font-semibold">Kelas: {std.className}</p>
                      </div>
                      <div className="p-1 bg-white border border-slate-200 rounded-xl shrink-0">
                        <QRCodeSVG value={std.qrCode} size={54} level="M" />
                      </div>
                    </div>
                  )}

                  {/* Card Footer */}
                  <div className="bg-slate-50 border-t border-slate-100 px-2 py-1 text-[8px] text-slate-400 font-mono text-center shrink-0">
                    ID: {std.qrCode}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ================= BATCH QR STICKERS SHEET ================= */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 print:grid-cols-4 print:gap-3">
              {activeStudents.map((std) => (
                <div
                  key={std.id}
                  className="bg-white border-2 border-emerald-200 rounded-2xl p-3 flex flex-col items-center text-center shadow-sm space-y-2 page-break-inside-avoid relative"
                >
                  <div className="w-full border-b border-emerald-100 pb-1 flex items-center justify-between">
                    <span className="text-[8px] font-black text-emerald-800 uppercase truncate">
                      {schoolProfile.name}
                    </span>
                    <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-md">
                      KLS {std.className}
                    </span>
                  </div>

                  <div className="bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm">
                    <QRCodeSVG value={std.qrCode} size={90} level="H" />
                  </div>

                  <div className="w-full">
                    <p className="text-[10px] font-extrabold text-slate-900 truncate uppercase">{std.name}</p>
                    <p className="text-[9px] text-slate-500 font-mono font-bold mt-0.5">NISN: {std.nisn}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Modal Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs font-semibold print:hidden">
          <p className="text-slate-500 flex items-center gap-1.5 text-xs">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            Format siap cetak A4. Anda dapat mengunduh langsung PDF atau gunakan cetak browser.
          </p>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer font-bold transition-all"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Cetak Browser
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl shadow-md font-extrabold flex items-center gap-2 cursor-pointer transition-all"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Simpan File PDF
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
