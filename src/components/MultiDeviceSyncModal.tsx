import React, { useState } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { 
  smartSyncAndMergeAllWithCloud, 
  forceUploadAllToCloud, 
  forceDownloadAllFromCloud, 
  CloudSyncStatus 
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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-sky-800/80 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-white">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900/90 to-indigo-950 px-6 py-4 border-b border-sky-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shadow-inner">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Sinkronisasi Multi-Perangkat
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  Cloud Firestore
                </span>
              </h2>
              <p className="text-xs text-sky-200/70">
                Penyelarasan data siswa, guru, & absensi di semua HP & Laptop
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

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Status Box */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/80 border border-slate-700/70 p-3.5 rounded-2xl">
              <span className="text-[11px] text-slate-400 font-semibold block mb-1">Siswa di Perangkat Ini</span>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <span className="text-xl font-extrabold text-white font-mono">{currentStudentCount}</span>
                <span className="text-xs text-slate-400">Siswa</span>
              </div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/70 p-3.5 rounded-2xl">
              <span className="text-[11px] text-slate-400 font-semibold block mb-1">Status Cloud Database</span>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <span className="text-sm font-bold text-emerald-300">
                  {syncStatus === 'connected' ? 'Terhubung Live' : syncStatus === 'syncing' ? 'Menyinkronkan...' : 'Mode Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Explanation Alert */}
          <div className="bg-sky-950/40 border border-sky-800/50 rounded-2xl p-4 text-xs text-sky-200/80 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sky-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Solusi Jumlah Siswa Berbeda Antar Perangkat</span>
            </div>
            <p className="leading-relaxed text-[11px]">
              Jika Anda menginput atau mengimpor data siswa di satu perangkat (misal laptop dengan <strong>425 siswa</strong>), dan perangkat lain (misal HP kedua) masih menampilkan jumlah berbeda (misal <strong>154 siswa</strong>), klik tombol <strong>"Samakan ke Semua Perangkat"</strong> di bawah pada perangkat dengan data 425 siswa tersebut.
            </p>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div className={`p-4 rounded-2xl text-xs font-bold border flex items-start gap-2.5 ${feedback.type === 'success' ? 'bg-emerald-950/70 border-emerald-700 text-emerald-200' : 'bg-rose-950/70 border-rose-700 text-rose-200'}`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
              <div className="flex-1 leading-relaxed">{feedback.message}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            
            {/* Main Action: Smart Sync */}
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
              <span>Enkripsi Cloud</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
