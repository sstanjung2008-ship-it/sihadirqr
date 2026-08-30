import React, { useState, useRef } from 'react';
import { 
  X, 
  Cloud, 
  CloudUpload, 
  CloudDownload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Smartphone, 
  Laptop, 
  Sparkles,
  Users,
  ShieldCheck,
  FileJson,
  Download,
  Upload,
  Copy,
  Check,
  Info
} from 'lucide-react';
import { 
  smartSyncAndMergeAllWithCloud, 
  forceUploadAllToCloud, 
  forceDownloadAllFromCloud, 
  CloudSyncStatus,
  downloadDatabaseBackupFile,
  importAllDatabaseFromJson,
  exportAllDatabaseToJson
} from '../lib/storage';

interface MultiDeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStudentCount: number;
  syncStatus: CloudSyncStatus;
}

export const MultiDeviceSyncModal: React.FC<MultiDeviceSyncModalProps> = ({
  isOpen,
  onClose,
  currentStudentCount,
  syncStatus,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'cloud' | 'direct'>('cloud');
  const [copiedCode, setCopiedCode] = useState(false);
  const [pasteCodeInput, setPasteCodeInput] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSmartSync = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await smartSyncAndMergeAllWithCloud();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message,
        });
      }
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: `Terjadi kendala: ${e?.message || 'Koneksi gagal'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceUpload = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await forceUploadAllToCloud();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Berhasil mengunggah seluruh data (${currentStudentCount} siswa) ke Cloud Firestore! Perangkat lain sekarang dapat menarik data ini.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Gagal mengunggah data.',
        });
      }
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: e?.message || 'Gagal mengunggah.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceDownload = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await forceDownloadAllFromCloud();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Berhasil mengunduh dan menyinkronkan data terbaru dari Cloud Firestore ke perangkat ini!',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Gagal mengunduh data.',
        });
      }
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: e?.message || 'Gagal mengunduh.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    try {
      downloadDatabaseBackupFile();
      setFeedback({
        type: 'success',
        message: 'File cadangan lengkap (.json) berhasil diunduh! Buka file ini di perangkat lain untuk memulihkan seluruh data dalam 1 detik.',
      });
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: `Gagal mengunduh cadangan: ${e?.message}`,
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importAllDatabaseFromJson(content);
        if (res.success) {
          setFeedback({
            type: 'success',
            message: res.message,
          });
        } else {
          setFeedback({
            type: 'error',
            message: res.message,
          });
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopyCode = () => {
    try {
      const json = exportAllDatabaseToJson();
      navigator.clipboard.writeText(json);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
      setFeedback({
        type: 'success',
        message: 'Kode teks database lengkap disalin ke clipboard! Anda dapat mengirimnya via WA atau menempelnya langsung di HP lain.',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Gagal menyalin kode database.',
      });
    }
  };

  const handleApplyPastedCode = () => {
    if (!pasteCodeInput.trim()) {
      setFeedback({
        type: 'error',
        message: 'Silakan tempel teks kode database terlebih dahulu.',
      });
      return;
    }
    const res = importAllDatabaseFromJson(pasteCodeInput);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: res.message,
      });
      setPasteCodeInput('');
      setShowPasteArea(false);
    } else {
      setFeedback({
        type: 'error',
        message: res.message,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-sky-800/80 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-white">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900/90 to-indigo-950 px-6 py-4 border-b border-sky-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shadow-inner">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Penyelarasan Multi-Perangkat
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  Real-Time & Offline
                </span>
              </h2>
              <p className="text-xs text-sky-200/70">
                Samakan 425 data siswa, guru, & absensi di semua HP & Laptop
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1.5 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'cloud' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
          >
            <Cloud className="w-4 h-4" />
            <span>Sinkronisasi Cloud</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'direct' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
          >
            <FileJson className="w-4 h-4 text-emerald-300" />
            <span>Transfer Instan (Cadangan File)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Status Box */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/80 border border-slate-700/70 p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">Siswa di Perangkat Ini</span>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <span className="text-xl font-extrabold text-white font-mono">{currentStudentCount}</span>
                <span className="text-xs text-slate-400">Siswa</span>
              </div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/70 p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">Status Cloud Database</span>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${syncStatus === 'connected' ? 'bg-emerald-400' : syncStatus === 'quota_exceeded' ? 'bg-amber-400' : 'bg-slate-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${syncStatus === 'connected' ? 'bg-emerald-400' : syncStatus === 'quota_exceeded' ? 'bg-amber-400' : 'bg-slate-400'}`}></span>
                </span>
                <span className={`text-xs font-extrabold ${syncStatus === 'connected' ? 'text-emerald-300' : syncStatus === 'quota_exceeded' ? 'text-amber-300' : 'text-slate-300'}`}>
                  {syncStatus === 'connected' ? 'Terhubung Live' : syncStatus === 'quota_exceeded' ? 'Batas Kuota Cloud Harian' : syncStatus === 'syncing' ? 'Menyinkronkan...' : 'Mode Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Quota Exceeded Notice if applicable */}
          {syncStatus === 'quota_exceeded' && (
            <div className="bg-amber-950/50 border border-amber-800/60 rounded-2xl p-4 text-xs text-amber-200/90 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Pemberitahuan Kuota Harian Firebase (20.000 Write Limit)</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                Batas kuota tulis gratis harian Firestore di Google Cloud telah tercapai hari ini. <strong>Semua data di perangkat Anda tetap aman 100%</strong>. Anda dapat langsung menggunakan tab <strong>"Transfer Instan (Cadangan File)"</strong> di atas untuk menyamakan data 425 siswa ke HP/laptop lain tanpa kuota internet!
              </p>
            </div>
          )}

          {/* Feedback message */}
          {feedback && (
            <div className={`p-4 rounded-2xl text-xs font-bold border flex items-start gap-2.5 ${feedback.type === 'success' ? 'bg-emerald-950/70 border-emerald-700 text-emerald-200' : feedback.type === 'info' ? 'bg-sky-950/70 border-sky-700 text-sky-200' : 'bg-rose-950/70 border-rose-700 text-rose-200'}`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> : feedback.type === 'info' ? <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
              <div className="flex-1 leading-relaxed">{feedback.message}</div>
            </div>
          )}

          {/* TAB 1: CLOUD SYNC */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="bg-sky-950/40 border border-sky-800/50 rounded-2xl p-4 text-xs text-sky-200/80 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sky-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Sinkronisasi Otomatis Cloud</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Gunakan tombol di bawah pada perangkat yang memiliki data terlengkap (misal laptop dengan <strong>425 siswa</strong>) untuk menggabungkan dan memperbarui database Cloud.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleSmartSync}
                  className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg shadow-sky-950 disabled:opacity-50 text-sm"
                >
                  {isLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  )}
                  <span>Samakan & Gabungkan Data ke Seluruh Perangkat</span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleForceUpload}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs disabled:opacity-50"
                  >
                    <CloudUpload className="w-4 h-4 text-sky-400" />
                    Upload Data Perangkat Ini
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleForceDownload}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs disabled:opacity-50"
                  >
                    <CloudDownload className="w-4 h-4 text-emerald-400" />
                    Tarik Data Terbanyak Cloud
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT FILE / ZERO-CLOUD TRANSFER */}
          {activeTab === 'direct' && (
            <div className="space-y-4">
              <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-4 text-xs text-emerald-200/90 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <FileJson className="w-4 h-4 text-emerald-400" />
                  <span>Transfer Data Instan (Tanpa Kuota Cloud)</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Fitur ini memungkinkan Anda memindahkan seluruh <strong>425 data siswa, kelas, guru, dan absensi</strong> dari laptop utama ke HP/laptop lain secara langsung dalam 1 detik.
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Download Backup */}
                <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-2.5 flex flex-col justify-between">
                  <div>
                    <span className="font-extrabold text-sky-300 text-xs flex items-center gap-1.5 mb-1">
                      <Download className="w-4 h-4 text-sky-400" />
                      1. Unduh Cadangan
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Unduh seluruh data ({currentStudentCount} siswa) menjadi file `.json` dari perangkat ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="w-full mt-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Unduh File Cadangan (.json)
                  </button>
                </div>

                {/* Restore Backup */}
                <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-2.5 flex flex-col justify-between">
                  <div>
                    <span className="font-extrabold text-emerald-300 text-xs flex items-center gap-1.5 mb-1">
                      <Upload className="w-4 h-4 text-emerald-400" />
                      2. Pulihkan di Perangkat Lain
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Pilih file `.json` yang sudah diunduh untuk diterapkan ke perangkat ini seketika.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Pilih & Buka File (.json)
                  </button>
                </div>
              </div>

              {/* Quick Text Code Transfer */}
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">Transfer via Salin-Tempel Teks:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="text-sky-400 hover:text-sky-300 text-[11px] font-bold flex items-center gap-1 bg-sky-950/60 border border-sky-800/60 px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Tersalin!' : 'Salin Kode Data'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasteArea(!showPasteArea)}
                      className="text-emerald-400 hover:text-emerald-300 text-[11px] font-bold flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{showPasteArea ? 'Tutup Kolom Tempel' : 'Tempel Kode'}</span>
                    </button>
                  </div>
                </div>

                {showPasteArea && (
                  <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <textarea
                      rows={3}
                      value={pasteCodeInput}
                      onChange={(e) => setPasteCodeInput(e.target.value)}
                      placeholder="Tempel teks kode database JSON di sini..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPastedCode}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Terapkan Kode ke Perangkat Ini Sekarang
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Device Sync Info Footer */}
          <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              <span>Laptop Admin</span>
              <span className="text-slate-600">↔</span>
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span>HP Guru / Pos Jaga</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Data Aman & Terproteksi</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
