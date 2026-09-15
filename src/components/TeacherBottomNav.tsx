import React from 'react';
import { 
  Home, 
  BookOpen, 
  QrCode, 
  Award, 
  FileText
} from 'lucide-react';

interface TeacherBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadLeavesCount?: number;
  teacherName?: string;
  homeroomClassName?: string;
}

export const TeacherBottomNav: React.FC<TeacherBottomNavProps> = React.memo(({
  activeTab,
  onTabChange,
  unreadLeavesCount = 0,
}) => {
  return (
    <nav
      aria-label="Navigasi Bawah Guru"
      className="lg:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto pointer-events-auto"
    >
      <div className="relative rounded-3xl p-1.5 bg-slate-900/90 backdrop-blur-2xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.5)] ring-1 ring-black/10">
        <div className="flex items-center justify-between gap-1">
          
          {/* Slot 1: Beranda */}
          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-transform duration-100 touch-manipulation select-none active:scale-95 cursor-pointer min-h-[52px] group ${
              activeTab === 'dashboard'
                ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-inner border border-white/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {activeTab === 'dashboard' && (
              <span className="absolute -top-1 w-6 h-1 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" />
            )}
            <div
              className={`p-1.5 rounded-xl transition-all duration-150 ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 scale-105'
                  : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              <Home className="w-4 h-4" />
            </div>
            <span
              className={`text-[10px] mt-1 font-semibold tracking-tight transition-colors ${
                activeTab === 'dashboard' ? 'text-white font-extrabold' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              Beranda
            </span>
          </button>

          {/* Slot 2: Jurnal KBM */}
          <button
            type="button"
            onClick={() => onTabChange('learning')}
            className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-transform duration-100 touch-manipulation select-none active:scale-95 cursor-pointer min-h-[52px] group ${
              activeTab === 'learning'
                ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-inner border border-white/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {activeTab === 'learning' && (
              <span className="absolute -top-1 w-6 h-1 rounded-full bg-gradient-to-r from-indigo-400 via-blue-300 to-sky-400 shadow-[0_0_12px_rgba(99,102,241,0.8)] animate-pulse" />
            )}
            <div
              className={`p-1.5 rounded-xl transition-all duration-150 ${
                activeTab === 'learning'
                  ? 'bg-gradient-to-tr from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/25 scale-105'
                  : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
            </div>
            <span
              className={`text-[10px] mt-1 font-semibold tracking-tight transition-colors ${
                activeTab === 'learning' ? 'text-white font-extrabold' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              Jurnal KBM
            </span>
          </button>

          {/* Slot 3 (CENTER): Floating Scan QR Button */}
          <div className="relative -mt-6 flex flex-col items-center px-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onTabChange('scanner')}
              className={`relative group p-0.5 rounded-full transition-transform duration-100 touch-manipulation select-none transform active:scale-90 cursor-pointer shadow-[0_10px_25px_rgba(16,185,129,0.4)] ${
                activeTab === 'scanner'
                  ? 'ring-4 ring-emerald-400/40 ring-offset-2 ring-offset-slate-900 scale-105'
                  : 'hover:scale-105'
              }`}
              title="Pindai QR Presensi Siswa"
            >
              {/* Glowing Aura Ring */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 opacity-75 blur-md group-hover:opacity-100 transition-opacity animate-pulse" />

              {/* Inner Modern Glass Disc */}
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-0.5 flex flex-col items-center justify-center border border-white/40 shadow-inner">
                <div className="w-full h-full rounded-full bg-slate-900/30 backdrop-blur-md flex items-center justify-center">
                  <QrCode className="w-7 h-7 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110" />
                </div>
              </div>
            </button>

            {/* Center Label */}
            <span
              className={`text-[10px] mt-1 font-bold tracking-tight transition-colors select-none ${
                activeTab === 'scanner'
                  ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)] font-extrabold'
                  : 'text-slate-300 group-hover:text-white'
              }`}
            >
              Scan QR
            </span>
          </div>

          {/* Slot 4: Izin (Permohonan / Persetujuan Izin Siswa) */}
          <button
            type="button"
            onClick={() => onTabChange('leaves')}
            className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-transform duration-100 touch-manipulation select-none active:scale-95 cursor-pointer min-h-[52px] group ${
              activeTab === 'leaves'
                ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-inner border border-white/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {activeTab === 'leaves' && (
              <span className="absolute -top-1 w-6 h-1 rounded-full bg-gradient-to-r from-amber-400 via-orange-300 to-rose-400 shadow-[0_0_12px_rgba(251,191,36,0.8)] animate-pulse" />
            )}
            <div className="relative">
              <div
                className={`p-1.5 rounded-xl transition-all duration-150 ${
                  activeTab === 'leaves'
                    ? 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 scale-105'
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
              </div>

              {/* Badge Tanda Angka Pengajuan Belum Disetujui */}
              {unreadLeavesCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 shadow-md shadow-rose-500/50 animate-pulse">
                  {unreadLeavesCount}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] mt-1 font-semibold tracking-tight transition-colors ${
                activeTab === 'leaves' ? 'text-white font-extrabold' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              Izin
            </span>
          </button>

          {/* Slot 5: Karakter (Nilai Karakter Siswa) */}
          <button
            type="button"
            onClick={() => onTabChange('character_points')}
            className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-transform duration-100 touch-manipulation select-none active:scale-95 cursor-pointer min-h-[52px] group ${
              activeTab === 'character_points'
                ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-inner border border-white/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {activeTab === 'character_points' && (
              <span className="absolute -top-1 w-6 h-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 shadow-[0_0_12px_rgba(251,191,36,0.8)] animate-pulse" />
            )}
            <div className="relative">
              <div
                className={`p-1.5 rounded-xl transition-all duration-150 ${
                  activeTab === 'character_points'
                    ? 'bg-gradient-to-tr from-amber-500 to-yellow-600 text-white shadow-md shadow-amber-500/25 scale-105'
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <Award className="w-4 h-4" />
              </div>
            </div>
            <span
              className={`text-[10px] mt-1 font-semibold tracking-tight transition-colors ${
                activeTab === 'character_points' ? 'text-white font-extrabold' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              Karakter
            </span>
          </button>

        </div>
      </div>
    </nav>
  );
});

