import React from 'react';
import { useStudentBehaviorNotesRealtime } from '../hooks/useStudentBehaviorNotesRealtime';
import { StudentCharacterLog } from '../types';
import { 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  FileText, 
  Trash2, 
  Wifi, 
  WifiOff, 
  Loader2,
  Clock,
  Sparkles
} from 'lucide-react';

interface StudentBehaviorNotesRealtimeSectionProps {
  studentId: string;
  studentName: string;
  className: string;
  fallbackLogs?: StudentCharacterLog[];
  onOpenFollowUp?: (log: StudentCharacterLog) => void;
  onPreviewPhoto?: (url: string) => void;
  onDeleteLog?: (log: StudentCharacterLog) => void;
  isAdmin?: boolean;
  highlightedLogId?: string | null;
}

export const StudentBehaviorNotesRealtimeSection: React.FC<StudentBehaviorNotesRealtimeSectionProps> = ({
  studentId,
  studentName,
  className,
  fallbackLogs = [],
  onOpenFollowUp,
  onPreviewPhoto,
  onDeleteLog,
  isAdmin = false,
  highlightedLogId = null,
}) => {
  // Targeted onSnapshot listener: strictly scoped to studentId
  const { notes: liveNotes, loading, error, isLive } = useStudentBehaviorNotesRealtime(studentId);

  // Cloud-First Display: Gunakan data live Firestore jika ada, fallback ke cache lokal jika offline/gagal
  const displayNotes = (!loading && liveNotes.length > 0)
    ? liveNotes
    : (liveNotes.length === 0 && !loading && !error)
      ? []
      : fallbackLogs;

  // Perhitungan Akumulasi & Ringkasan Jumlah Entri (Konsisten dengan Rekapitulasi Presensi & Belum Scan Pulang)
  const totalEntries = displayNotes.length;
  const positiveNotes = displayNotes.filter(n => n.traitType === 'POSITIF');
  const negativeNotes = displayNotes.filter(n => n.traitType === 'NEGATIF');
  const positiveCount = positiveNotes.length;
  const negativeCount = negativeNotes.length;
  const totalPositivePoints = positiveNotes.reduce((acc, n) => acc + (Number(n.points) || 0), 0);
  const totalNegativePoints = negativeNotes.reduce((acc, n) => acc + Math.abs(Number(n.points) || 0), 0);
  const netPoints = totalPositivePoints - totalNegativePoints;

  const isRealPhotoProof = (url?: string) => {
    if (!url) return false;
    return url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://');
  };

  return (
    <div className="space-y-3 pt-3 border-t border-slate-200">
      {/* Header Bar dengan Live Sync Indicator & Ringkasan Poin */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 sm:p-2 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-xl shadow-xs shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h5 className="font-black text-slate-800 text-xs sm:text-sm">
                Catatan Perilaku Khusus Siswa (Input Guru)
              </h5>
              {/* Status Real-Time Indicator */}
              {isLive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Cloud
                </span>
              ) : loading ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Menghubungkan...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  <WifiOff className="w-2.5 h-2.5" />
                  Lokal / Offline
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Evaluasi karakter dan catatan sikap siswa tersinkronisasi langsung dari Cloud Firestore
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200 shadow-2xs">
            {totalEntries} Catatan
          </span>
          <span className={`text-[10px] sm:text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs border ${
            netPoints > 0 
              ? 'bg-blue-600 text-white border-blue-500' 
              : netPoints < 0 
                ? 'bg-rose-600 text-white border-rose-500' 
                : 'bg-slate-700 text-white border-slate-600'
          }`}>
            {netPoints > 0 ? `+${netPoints}` : netPoints} Poin
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KARTU PENGHITUNG TOTAL & RINGKASAN JUMLAH ENTRI CATATAN PERILAKU */}
      {/* (KONSISTEN DENGAN REKAPITULASI PRESENSI & BELUM SCAN PULANG) */}
      {/* ========================================================================= */}
      <div className="p-3 sm:p-3.5 rounded-2xl border border-indigo-200 bg-white hover:border-indigo-300 shadow-2xs space-y-2.5 transition-all">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                  Akumulasi Catatan Perilaku Khusus Siswa
                </p>
                <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold text-[9px] sm:text-[10px]">
                  Input Guru (Cloud)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {totalEntries}x entri catatan guru • {positiveCount}x perilaku positif, {negativeCount}x pelanggaran/pembinaan
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 font-black text-xs rounded-xl shadow-2xs shrink-0 ${
            netPoints > 0
              ? 'bg-blue-600 text-white'
              : netPoints < 0
                ? 'bg-rose-600 text-white'
                : 'bg-slate-700 text-white'
          }`}>
            {netPoints > 0 ? `+${netPoints}` : netPoints} Poin
          </span>
        </div>

        {/* 3 Kotak Indikator Mini Sub-Counter (Konsisten dengan panel rincian) */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-[10px] sm:text-[11px]">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 shadow-2xs">
            <span className="text-slate-600 font-medium">Total Entri:</span>
            <strong className="text-slate-800 font-black">{totalEntries} Catatan</strong>
          </div>
          <div className="p-2 rounded-xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 shadow-2xs">
            <span className="text-blue-800 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
              Positif:
            </span>
            <strong className="text-blue-700 font-black">+{totalPositivePoints} Poin ({positiveCount}x)</strong>
          </div>
          <div className="p-2 rounded-xl bg-rose-50/80 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 shadow-2xs">
            <span className="text-rose-800 font-medium flex items-center gap-1">
              <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
              Negatif:
            </span>
            <strong className="text-rose-700 font-black">-{totalNegativePoints} Poin ({negativeCount}x)</strong>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && displayNotes.length === 0 && (
        <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60 animate-pulse flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span>Memuat catatan perilaku langsung dari Firestore...</span>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{error} Menampilkan data catatan dari cadangan lokal.</span>
        </div>
      )}

      {/* List Catatan Perilaku */}
      {displayNotes.length > 0 ? (
        <div className="space-y-2">
          {displayNotes.map((log, idx) => {
            const isHighlighted = log.id === highlightedLogId;
            return (
              <div
                key={`${log.id}_realtime_${idx}`}
                id={`char-log-${log.id}`}
                className={`p-3 rounded-2xl border transition-all space-y-2 ${
                  isHighlighted
                    ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="shrink-0 mt-0.5">
                      {log.traitType === 'POSITIF' ? (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                          <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 text-xs sm:text-sm">
                          {log.traitName}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black ${
                          log.traitType === 'POSITIF' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {log.traitType === 'POSITIF' ? `+${log.points}` : `-${log.points}`} Poin
                        </span>
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                          Input Guru
                        </span>
                        {isHighlighted && (
                          <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                            Terpilih
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span>Oleh: <strong className="text-slate-700">{log.evaluatorName || 'Guru'}</strong></span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-400" />
                          {log.timestamp || log.date}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {log.photoProofUrl && isRealPhotoProof(log.photoProofUrl) && onPreviewPhoto && (
                      <button
                        type="button"
                        onClick={() => onPreviewPhoto(log.photoProofUrl || '')}
                        className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-500 transition-all cursor-pointer shrink-0"
                        title="Lihat Foto Bukti"
                      >
                        <img
                          src={log.photoProofUrl}
                          alt="Bukti"
                          loading="lazy"
                          className="w-7 h-7 sm:w-8 sm:h-8 object-cover group-hover:scale-105 transition-transform"
                        />
                      </button>
                    )}

                    {onOpenFollowUp && (
                      <button
                        type="button"
                        onClick={() => onOpenFollowUp(log)}
                        className="px-2 sm:px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                        title="Tindak Lanjut Catatan"
                      >
                        <FileText className="w-3 h-3" />
                        <span className="hidden sm:inline">{log.followUpNotes ? 'Edit' : 'Tindak Lanjut'}</span>
                      </button>
                    )}

                    {isAdmin && onDeleteLog && (
                      <button
                        type="button"
                        onClick={() => onDeleteLog(log)}
                        className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Hapus Catatan (Admin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Deskripsi & Catatan Spesifik Perilaku */}
                {log.notes && (
                  <div className="text-[11px] sm:text-xs text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 leading-snug font-normal">
                    "{log.notes}"
                  </div>
                )}

                {/* Info Tindak Lanjut Guru BK / Wali Kelas */}
                {log.followUpNotes && (
                  <div className="mt-1 p-2 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[10px] sm:text-[11px] text-indigo-900 space-y-0.5">
                    <div className="font-bold flex items-center gap-1 text-indigo-700">
                      <FileText className="w-3 h-3 text-indigo-600" />
                      <span>Tindak Lanjut ({log.followUpBy || 'Guru BK'}):</span>
                    </div>
                    <p className="text-slate-700 italic">"{log.followUpNotes}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !loading ? (
        <div className="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center space-y-1">
          <p className="text-xs font-bold text-slate-600">
            Belum ada catatan perilaku khusus untuk {studentName} ({className}).
          </p>
          <p className="text-[11px] text-slate-400">
            Catatan yang diinput oleh guru akan langsung muncul di sini secara real-time.
          </p>
        </div>
      ) : null}
    </div>
  );
};
