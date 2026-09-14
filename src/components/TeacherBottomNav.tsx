import React, { useState } from 'react';
import { 
  Home, 
  BookOpen, 
  QrCode, 
  Award, 
  UserCircle, 
  CalendarDays, 
  FileText, 
  MessageSquare, 
  Sparkles, 
  X, 
  ChevronRight,
  ShieldAlert,
  BarChart3,
  Layers
} from 'lucide-react';

interface TeacherBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadLeavesCount?: number;
  teacherName?: string;
  homeroomClassName?: string;
}

export const TeacherBottomNav: React.FC<TeacherBottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadLeavesCount = 0,
  teacherName,
  homeroomClassName,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Secondary Menu Items for Guru (available via Menu/Lainnya)
  const secondaryMenuItems = [
    {
      id: 'schedule',
      label: 'Jadwal Pelajaran',
      desc: 'Jadwal KBM & jam mengajar harian',
      icon: CalendarDays,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      id: 'leaves',
      label: 'Persetujuan Izin',
      desc: 'Verifikasi surat izin/sakit siswa',
      icon: FileText,
      badge: unreadLeavesCount,
      color: 'from-amber-500 to-orange-600',
    },
    {
      id: 'chat',
      label: 'Chat Wali Murid',
      desc: 'Pusat obrolan & konsultasi orang tua',
      icon: MessageSquare,
      color: 'from-sky-500 to-cyan-600',
    },
    {
      id: 'teacher_assistant',
      label: 'Asisten Guru (AI)',
      desc: 'Generator soal & modul ajar otomatis',
      icon: Sparkles,
      color: 'from-fuchsia-500 to-purple-600',
    },
    {
      id: 'analytics',
      label: 'Analitik & AI',
      desc: 'Laporan tren presensi & grafik siswa',
      icon: BarChart3,
      color: 'from-violet-500 to-purple-700',
    },
    {
      id: 'recap',
      label: 'Rekap & Ekspor Laporan',
      desc: 'Cetak rekapitulasi presensi bulanan',
      icon: Layers,
      color: 'from-teal-500 to-emerald-600',
    },
    {
      id: 'account',
      label: 'Profil & Akun Guru',
      desc: 'Identitas NIP, data diri & ubah password',
      icon: UserCircle,
      color: 'from-slate-600 to-slate-800',
    },
  ];

  const handleSelectTab = (tabId: string) => {
    onTabChange(tabId);
    setIsMenuOpen(false);
  };

  const isMoreMenuActive = [
    'schedule',
    'leaves',
    'chat',
    'teacher_assistant',
    'analytics',
    'recap',
    'account'
  ].includes(activeTab);

  return (
    <>
      {/* Quick Menu Sheet Backdrop & Modal */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={() => setIsMenuOpen(false)}
        >
          <div 
            className="bg-slate-900/95 border-t border-white/20 rounded-t-3xl p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl ring-1 ring-white/10 max-h-[80vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div>
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Menu Lengkap Guru
                </h3>
                {teacherName && (
                  <p className="text-slate-400 text-xs mt-0.5">
                    {teacherName} {homeroomClassName ? `• Wali ${homeroomClassName}` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Tutup Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items Grid */}
            <div className="overflow-y-auto space-y-2 pr-1 pb-4">
              {secondaryMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-200 text-left cursor-pointer group border ${
                      isActive
                        ? 'bg-gradient-to-r from-white/15 to-white/5 border-emerald-400/40 text-white shadow-inner'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${item.color} text-white shadow-md shadow-black/20 shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white group-hover:text-emerald-300 transition-colors">
                            {item.label}
                          </span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full animate-pulse shadow-sm">
                              {item.badge} Baru
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modern Glass Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi Bawah Guru"
        className="lg:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto"
      >
        <div className="relative rounded-3xl p-1.5 bg-slate-900/85 backdrop-blur-2xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.5)] ring-1 ring-black/10">
          <div className="flex items-center justify-between gap-1">
            
            {/* Slot 1: Beranda */}
            <button
              type="button"
              onClick={() => handleSelectTab('dashboard')}
              className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 cursor-pointer min-h-[52px] group ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-inner border border-white/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {activeTab === 'dashboard' && (
                <span className="absolute -top-1 w-6 h-1 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" />
              )}
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
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
              onClick={() => handleSelectTab('learning')}
              className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 cursor-pointer min-h-[52px] group ${
                activeTab === 'learning'
                  ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-inner border border-white/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {activeTab === 'learning' && (
                <span className="absolute -top-1 w-6 h-1 rounded-full bg-gradient-to-r from-indigo-400 via-blue-300 to-sky-400 shadow-[0_0_12px_rgba(99,102,241,0.8)] animate-pulse" />
              )}
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
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

            {/* Slot 3 (CENTER): Modern Floating Glass Scan QR Button */}
            <div className="relative -mt-6 flex flex-col items-center px-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSelectTab('scanner')}
                className={`relative group p-0.5 rounded-full transition-all duration-300 transform active:scale-95 cursor-pointer shadow-[0_10px_25px_rgba(16,185,129,0.4)] ${
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
                className={`text-[10px] mt-1 font-bold tracking-tight transition-colors ${
                  activeTab === 'scanner'
                    ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)] font-extrabold'
                    : 'text-slate-300 group-hover:text-white'
                }`}
              >
                Scan QR
              </span>
            </div>

            {/* Slot 4: Nilai Karakter */}
            <button
              type="button"
              onClick={() => handleSelectTab('character_points')}
              className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 cursor-pointer min-h-[52px] group ${
                activeTab === 'character_points'
                  ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-inner border border-white/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {activeTab === 'character_points' && (
                <span className="absolute -top-1 w-6 h-1 rounded-full bg-gradient-to-r from-amber-400 via-orange-300 to-rose-400 shadow-[0_0_12px_rgba(251,191,36,0.8)] animate-pulse" />
              )}
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  activeTab === 'character_points'
                    ? 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 scale-105'
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <Award className="w-4 h-4" />
              </div>
              <span
                className={`text-[10px] mt-1 font-semibold tracking-tight transition-colors ${
                  activeTab === 'character_points' ? 'text-white font-extrabold' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                Karakter
              </span>
            </button>

            {/* Slot 5: Menu & Akun */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 cursor-pointer min-h-[52px] group ${
                isMoreMenuActive
                  ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-inner border border-white/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {isMoreMenuActive && (
                <span className="absolute -top-1 w-6 h-1 rounded-full bg-gradient-to-r from-purple-400 via-pink-300 to-rose-400 shadow-[0_0_12px_rgba(192,132,252,0.8)] animate-pulse" />
              )}
              <div className="relative">
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    isMoreMenuActive
                      ? 'bg-gradient-to-tr from-purple-500 to-pink-600 text-white shadow-md shadow-purple-500/25 scale-105'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  <UserCircle className="w-4 h-4" />
                </div>

                {/* Badge for unread leaves / pending actions */}
                {unreadLeavesCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm animate-pulse">
                    {unreadLeavesCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 font-semibold tracking-tight transition-colors ${
                  isMoreMenuActive ? 'text-white font-extrabold' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                Menu Guru
              </span>
            </button>

          </div>
        </div>
      </nav>
    </>
  );
};
