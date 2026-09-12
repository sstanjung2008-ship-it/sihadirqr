import React from 'react';
import { 
  Volume2, 
  VolumeX, 
  Bell, 
  Clock, 
  BookOpen, 
  X, 
  Sparkles,
  Play,
  CheckCircle2,
  GraduationCap
} from 'lucide-react';
import { KbmReminderInfo, playTeacherKbmVoiceReminder, generateKbmSpeechText } from '../lib/kbmVoiceReminder';

interface KbmVoiceReminderBannerProps {
  reminder: KbmReminderInfo | null;
  onDismiss: () => void;
  onOpenJournal?: () => void;
}

export const KbmVoiceReminderBanner: React.FC<KbmVoiceReminderBannerProps> = ({
  reminder,
  onDismiss,
  onOpenJournal
}) => {
  const [isPlaying, setIsPlaying] = React.useState(false);

  if (!reminder) return null;

  const speechText = generateKbmSpeechText(reminder);

  const handleReplay = async () => {
    setIsPlaying(true);
    await playTeacherKbmVoiceReminder(reminder);
    setIsPlaying(false);
  };

  return (
    <div 
      id="kbm-voice-reminder-banner"
      className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 max-w-md w-[calc(100vw-2.5rem)] bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-5 shadow-2xl border-2 border-indigo-400/40 animate-in fade-in slide-in-from-bottom-5 duration-300 backdrop-blur-md"
      role="alert"
    >
      {/* Decorative Glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-amber-300 shadow-inner relative">
            <Bell className="w-5 h-5 animate-bounce" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-indigo-900 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                Pengingat Jadwal Mengajar (KBM)
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mt-0.5">
              Jam Mengajar Dimulai!
            </h4>
          </div>
        </div>

        <button
          onClick={onDismiss}
          id="btn-close-kbm-reminder"
          aria-label="Tutup Pengingat"
          className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* AI Voice Quote Speech Bubble */}
      <div className="mt-3.5 bg-white/10 border border-white/15 rounded-2xl p-3.5 backdrop-blur-sm relative z-10">
        <div className="flex items-start space-x-2.5">
          <div className="p-1.5 rounded-xl bg-pink-500/30 text-pink-300 mt-0.5 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-xs text-indigo-100 leading-relaxed font-medium">
            &ldquo;{speechText}&rdquo;
          </div>
        </div>
      </div>

      {/* Lesson Details Card */}
      <div className="mt-3 bg-slate-950/40 border border-white/10 rounded-2xl p-3 space-y-2 relative z-10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Guru Pengampu:</span>
          <span className="font-bold text-slate-100">{reminder.teacherName}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Mata Pelajaran:</span>
          <span className="font-bold text-emerald-300">{reminder.subject}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Kelas / Ruang:</span>
          <span className="font-bold text-sky-300">
            Kelas {reminder.className} {reminder.room ? `(${reminder.room})` : ''}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Alokasi Waktu:</span>
          <span className="font-extrabold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-400/30">
            {reminder.jpCount && reminder.jpCount > 1 ? `${reminder.jpCount} JP (Jam Ke-${reminder.periodNumber} s.d ${reminder.periodNumber + reminder.jpCount - 1})` : `1 JP (Jam Ke-${reminder.periodNumber})`}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/10">
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-indigo-300" />
            <span>Mulai Pukul:</span>
          </div>
          <span className="font-mono font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
            {reminder.startTime} {reminder.endTime ? `- ${reminder.endTime}` : ''}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2 relative z-10">
        <button
          onClick={handleReplay}
          id="btn-replay-kbm-voice"
          disabled={isPlaying}
          className="flex-1 min-w-[130px] flex items-center justify-center space-x-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-50"
        >
          <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse text-amber-300' : ''}`} />
          <span>{isPlaying ? 'Memutar Suara...' : 'Ulangi Suara AI'}</span>
        </button>

        {onOpenJournal && (
          <button
            onClick={() => {
              onOpenJournal();
              onDismiss();
            }}
            id="btn-open-journal-from-reminder"
            className="flex-1 min-w-[130px] flex items-center justify-center space-x-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Isi Jurnal KBM</span>
          </button>
        )}
      </div>
    </div>
  );
};
