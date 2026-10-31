import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  ShieldCheck, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Calendar,
  Database,
  ArrowRight,
  Info
} from 'lucide-react';
import { 
  getAttendanceRecords, 
  replaceAttendanceRangeStrictly, 
  downloadAttendanceBackupJson, 
  ReplaceAttendanceRangeResult 
} from '../lib/storage';

interface UploadAttendanceJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: ReplaceAttendanceRangeResult) => void;
}

export const UploadAttendanceJsonModal: React.FC<UploadAttendanceJsonModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successResult, setSuccessResult] = useState<ReplaceAttendanceRangeResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ambil data database saat ini untuk analisis proteksi
  const currentRecords = useMemo(() => {
    return getAttendanceRecords();
  }, [isOpen]);

  const currentOct26To28Count = useMemo(() => {
    return currentRecords.filter(r => r.date >= '2026-10-26' && r.date <= '2026-10-28').length;
  }, [currentRecords]);

  const currentOct1To24Count = useMemo(() => {
    return currentRecords.filter(r => r.date >= '2026-10-01' && r.date <= '2026-10-24').length;
  }, [currentRecords]);

  const currentOutsideTargetCount = useMemo(() => {
    return currentRecords.filter(r => r.date < '2026-10-01' || r.date > '2026-10-24').length;
  }, [currentRecords]);

  // Parse JSON dari input teks / file
  const parsedRecords = useMemo<any[] | null>(() => {
    if (!rawJsonText.trim()) {
      return null;
    }
    try {
      const parsed = JSON.parse(rawJsonText);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && Array.isArray(parsed.data)) {
        return parsed.data;
      }
      if (parsed && Array.isArray(parsed.records)) {
        return parsed.records;
      }
      return null;
    } catch {
      return null;
    }
  }, [rawJsonText]);

  // Analisis isi data upload
  const uploadAnalysis = useMemo(() => {
    if (!parsedRecords) return null;

    let inRangeCount = 0;
    let outsideCount = 0;
    const dateCounts: Record<string, number> = {};

    for (const item of parsedRecords) {
      if (item && typeof item.date === 'string') {
        const d = item.date.trim();
        dateCounts[d] = (dateCounts[d] || 0) + 1;
        if (d >= '2026-10-01' && d <= '2026-10-24') {
          inRangeCount++;
        } else {
          outsideCount++;
        }
      }
    }

    const sortedDates = Object.keys(dateCounts).sort();

    return {
      total: parsedRecords.length,
      inRangeCount,
      outsideCount,
      dateCounts,
      sortedDates,
      hasTargetData: inRangeCount > 0,
    };
  }, [parsedRecords]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setRawJsonText(content);
        JSON.parse(content);
      } catch (err) {
        setParseError('Format file tidak valid. Pastikan file berisi JSON yang benar.');
      }
    };
    reader.onerror = () => {
      setParseError('Gagal membaca file.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setParseError('Harap pilih file dengan format .json');
      return;
    }

    setFileName(file.name);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setRawJsonText(content);
        JSON.parse(content);
      } catch (err) {
        setParseError('Format file tidak valid. Pastikan file berisi JSON yang benar.');
      }
    };
    reader.readAsText(file);
  };

  const handleApplyReplacement = async () => {
    if (!parsedRecords || !uploadAnalysis?.hasTargetData) return;

    setIsProcessing(true);
    setParseError(null);

    try {
      // Panggil fungsi penggantian ketat (HANYA menimpa 1-24 Oktober 2026)
      const result = await replaceAttendanceRangeStrictly(
        parsedRecords,
        '2026-10-01',
        '2026-10-24'
      );

      setSuccessResult(result);
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: any) {
      console.error('Error saat menimpa data presensi:', err);
      setParseError(err?.message || 'Terjadi kesalahan saat memproses data presensi.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <Upload className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Upload Data Presensi (Tgl 1–24 Oktober 2026)
              </h2>
              <p className="text-xs text-indigo-200 font-medium">
                Ganti riwayat presensi simulasi dengan data scan riil tanpa menghapus tgl 26–28 Oktober
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Jaminan Proteksi & Keamanan (Highlight Hijau) */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                  Jaminan Proteksi: Data Scan 26, 27, dan 28 Oktober 2026 100% AMAN
                </h3>
                <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                  Sistem menerapkan filter ketat: <strong className="text-emerald-950">HANYA data tanggal 1 s/d 24 Oktober 2026</strong> yang akan ditimpa.
                  Seluruh <strong>{currentOct26To28Count} data scan riil tanggal 26, 27, dan 28 Oktober 2026</strong> serta data September diproteksi secara permanen dan <u>tidak akan pernah terhapus</u>.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-200/70 text-emerald-900 text-[11px] font-black border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    {currentOct26To28Count} Scan Tgl 26–28 Okt Terproteksi
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-black border border-amber-300">
                    <Database className="w-3.5 h-3.5 text-amber-700" />
                    {currentOct1To24Count} Data Tgl 1–24 Okt Siap Diganti
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tombol Unduh Backup Pra-Upload */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3 px-4">
            <div className="flex items-center gap-2.5">
              <Info className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs text-slate-600 font-semibold">
                Ingin menyimpan salinan seluruh presensi saat ini sebelum mengunggah?
              </span>
            </div>
            <button
              type="button"
              onClick={downloadAttendanceBackupJson}
              className="bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
              title="Unduh file JSON cadangan saat ini"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Unduh Cadangan (.json)</span>
            </button>
          </div>

          {/* Success Screen */}
          {successResult ? (
            <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-emerald-950">
                  Data Presensi Berhasil Diperbarui!
                </h3>
                <p className="text-xs text-emerald-800 font-medium max-w-lg mx-auto">
                  {successResult.message}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-left">
                <div className="bg-white p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 font-bold block">Data Baru Masuk</span>
                  <span className="text-sm font-black text-indigo-600">{successResult.newCountInserted}</span>
                  <span className="text-[10px] text-slate-400 block">Tgl 1–24 Okt</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 font-bold block">Data Lama Diganti</span>
                  <span className="text-sm font-black text-amber-600">{successResult.oldCountInRange}</span>
                  <span className="text-[10px] text-slate-400 block">Tgl 1–24 Okt</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 font-bold block">Diproteksi Utuh</span>
                  <span className="text-sm font-black text-emerald-600">{successResult.preservedOctober26To28Count}</span>
                  <span className="text-[10px] text-slate-400 block">Tgl 26–28 Okt</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 font-bold block">Total Database</span>
                  <span className="text-sm font-black text-slate-800">{successResult.totalRecordsNow}</span>
                  <span className="text-[10px] text-slate-400 block">Rekaman aktif</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  Selesai & Lihat Dasbor
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('file')}
                  className={`pb-2.5 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'file'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File .JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`pb-2.5 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'paste'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Tempel Teks JSON</span>
                </button>
              </div>

              {/* Tab Content: File Input */}
              {activeTab === 'file' && (
                <div className="space-y-3">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                        : fileName
                        ? 'border-emerald-400 bg-emerald-50/30 hover:border-emerald-500'
                        : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                      {fileName ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <Upload className="w-6 h-6" />}
                    </div>

                    {fileName ? (
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          File terpilih: <span className="text-indigo-600 font-mono">{fileName}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Klik untuk mengganti file lain
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-extrabold text-slate-700">
                          Klik untuk memilih file JSON atau seret file ke sini
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Mendukung file .json hasil ekspor presensi riil
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab Content: Paste Textarea */}
              {activeTab === 'paste' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Tempel Konten JSON di Bawah Ini:</span>
                    {rawJsonText && (
                      <button
                        type="button"
                        onClick={() => setRawJsonText('')}
                        className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                      >
                        Bersihkan Teks
                      </button>
                    )}
                  </label>
                  <textarea
                    rows={7}
                    value={rawJsonText}
                    onChange={(e) => {
                      setRawJsonText(e.target.value);
                      setParseError(null);
                    }}
                    placeholder={`[\n  {\n    "id": "scan-123",\n    "studentId": "std-001",\n    "studentName": "Nama Siswa",\n    "className": "X.A",\n    "date": "2026-10-01",\n    "time": "06:45",\n    "status": "HADIR",\n    "method": "QR_SCAN"\n  }\n]`}
                    className="w-full text-xs font-mono p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                </div>
              )}

              {/* Error Alert */}
              {parseError && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Preview Hasil Analisis JSON */}
              {uploadAnalysis && (
                <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Hasil Pemeriksaan Isi File JSON:
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      ✓ Format JSON Valid
                    </span>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">Total di File</span>
                      <span className="text-xs font-black text-slate-800">{uploadAnalysis.total} rekaman</span>
                    </div>

                    <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-200">
                      <span className="text-[10px] text-indigo-600 font-bold block">Tgl 1–24 Okt (Diambil)</span>
                      <span className="text-xs font-black text-indigo-700">{uploadAnalysis.inRangeCount} rekaman</span>
                    </div>

                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-600 font-bold block">Tgl 26–28 Okt (Aman)</span>
                      <span className="text-xs font-black text-emerald-700">{currentOct26To28Count} scan (Utuh)</span>
                    </div>

                    <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">Total Akhir Gabungan</span>
                      <span className="text-xs font-black text-slate-900">
                        {currentOutsideTargetCount + uploadAnalysis.inRangeCount} rekaman
                      </span>
                    </div>
                  </div>

                  {/* Peringatan jika file mengandung tanggal di luar 1-24 */}
                  {uploadAnalysis.outsideCount > 0 && (
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Ditemukan {uploadAnalysis.outsideCount} data di luar rentang tgl 1–24 Oktober dalam file ini. 
                        <strong> Sistem otomatis mengabaikan data tersebut</strong> demi menjamin keamanan data tgl 26–28 Oktober Anda.
                      </span>
                    </div>
                  )}

                  {/* Rincian Tanggal yang Terdeteksi */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-600 block">
                      Rincian Tanggal yang Ditemukan dalam File:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200">
                      {uploadAnalysis.sortedDates.map((dateStr) => {
                        const count = uploadAnalysis.dateCounts[dateStr];
                        const isTarget = dateStr >= '2026-10-01' && dateStr <= '2026-10-24';
                        return (
                          <span
                            key={dateStr}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isTarget
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200 line-through'
                            }`}
                            title={isTarget ? 'Akan dimasukkan' : 'Diabaikan (di luar rentang 1-24 Okt)'}
                          >
                            <Calendar className="w-2.5 h-2.5" />
                            <span>{dateStr}</span>
                            <span className="font-extrabold text-[9px] bg-white px-1 rounded-sm">
                              {count}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {!uploadAnalysis.hasTargetData && (
                    <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        Tidak ditemukan data presensi dengan tanggal antara 2026-10-01 s/d 2026-10-24 dalam file JSON ini.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleApplyReplacement}
                  disabled={isProcessing || !uploadAnalysis?.hasTargetData}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all ${
                    isProcessing || !uploadAnalysis?.hasTargetData
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-600/30 active:scale-95 cursor-pointer'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Menyimpan ke Cloud Firestore...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-indigo-200" />
                      <span>Terapkan & Timpa Hanya Tgl 1–24 Oktober</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
