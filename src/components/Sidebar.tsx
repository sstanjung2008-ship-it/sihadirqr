import React, { useState, useEffect } from 'react';
import { UserRole, SchoolProfile, UserSession } from '../types';
import { 
  QrCode, 
  UserCheck, 
  Users, 
  ScanLine, 
  Bell, 
  Building2, 
  GraduationCap, 
  FileText, 
  Settings, 
  MessageSquare, 
  BarChart3,
  Clock,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Award,
  CheckCircle2,
  LogOut,
  User,
  Scale,
  Cloud,
  CloudCheck,
  RefreshCw
} from 'lucide-react';
import { getCloudSyncStatus, CloudSyncStatus } from '../lib/storage';


interface SidebarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  schoolProfile: SchoolProfile;
  unreadLeavesCount: number;
  userSession?: UserSession | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  onRoleChange,
  activeTab,
  onTabChange,
  schoolProfile,
  unreadLeavesCount,
  userSession,
  onLogout,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() => getCloudSyncStatus());

  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e.detail?.status) {
        setSyncStatus(e.detail.status);
      }
    };
    window.addEventListener('sihadir_cloud_status_changed', handleStatus);
    return () => window.removeEventListener('sihadir_cloud_status_changed', handleStatus);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter tabs based on active role
  const getNavTabs = () => {
    if (currentRole === 'SCANNER_POS') {
      return [
        { id: 'scanner', label: 'Scan QR Presensi', icon: ScanLine, desc: 'Pemindai QR Masuk & Pulang' },
        { id: 'dashboard', label: 'Feed Kehadiran', icon: BarChart3, desc: 'Aktivitas presensi real-time' },
      ];
    }
    if (currentRole === 'PARENT') {
      return [
        { id: 'dashboard', label: 'Kehadiran Anak', icon: UserCheck, desc: 'Status absensi putra/putri' },
        { id: 'discipline_rules', label: 'Tata Tertib', icon: Scale, desc: 'Aturan & poin karakter sekolah' },
        { id: 'chat', label: 'Fitur Chat Sekolah', icon: MessageSquare, desc: 'Hubungi Humas, Wali Kelas & BK' },
        { id: 'leaves', label: 'Izin / Sakit', icon: FileText, desc: 'Ajukan permohonan izin/sakit', badge: unreadLeavesCount },
      ];
    }
    if (currentRole === 'TEACHER') {
      return [
        { id: 'dashboard', label: 'Absensi Hari Ini', icon: UserCheck, desc: 'Dashboard presensi kelas' },
        { id: 'scanner', label: 'Scan QR Presensi', icon: ScanLine, desc: 'Scan QR manual siswa' },
        { id: 'learning', label: 'Fitur Pembelajaran', icon: BookOpen, desc: 'Jurnal KBM & keaktifan siswa' },
        { id: 'character_points', label: 'Nilai Karakter', icon: Award, desc: 'Poin & bukti foto karakter' },
        { id: 'analytics', label: 'Analitik & AI', icon: Sparkles, desc: 'Laporan AI & grafik tren' },
        { id: 'leaves', label: 'Persetujuan Izin', icon: MessageSquare, desc: 'Persetujuan wali murid', badge: unreadLeavesCount },
        { id: 'recap', label: 'Rekap Laporan', icon: FileText, desc: 'Ekspor laporan bulanan' },
        { id: 'chat', label: 'Fitur Chat Wali Murid', icon: MessageSquare, desc: 'Obrolan Wali Kelas, Humas & BK' },
      ];
    }

    // ADMIN / GURU PIKET
    return [
      { id: 'dashboard', label: 'Dasbor Presensi', icon: BarChart3, desc: 'Ringkasan & statistik utama' },
      { id: 'scanner', label: 'Pos Scan QR', icon: ScanLine, desc: 'Pemindai barcode/QR harian' },
      { id: 'learning', label: 'Jurnal Pembelajaran', icon: BookOpen, desc: 'Rekap KBM & keaktifan kelas' },
      { id: 'character_input', label: 'Input Karakter Siswa', icon: Sparkles, desc: 'Master data & bobot karakter (+/-)' },
      { id: 'character_points', label: 'Nilai Karakter', icon: Award, desc: 'Poin & bukti foto karakter' },
      { id: 'chat', label: 'Fitur Chat Wali Murid', icon: MessageSquare, desc: 'Pusat obrolan Wali Kelas, Humas & BK' },
      { id: 'analytics', label: 'Analitik & AI', icon: Sparkles, desc: 'Laporan AI & grafik tren' },
      { id: 'teachers', label: 'Database Guru', icon: UserCheck, desc: 'Kelola data & NIP guru' },
      { id: 'students', label: 'Database Siswa', icon: Users, desc: 'Kelola data & kartu KTS' },
      { id: 'classes', label: 'Kelola Data Kelas', icon: Building2, desc: 'Daftar & wali kelas' },
      { id: 'leaves', label: 'Permohonan Izin', icon: MessageSquare, desc: 'Verifikasi surat izin/sakit', badge: unreadLeavesCount },
      { id: 'recap', label: 'Rekap & Ekspor', icon: FileText, desc: 'Cetak laporan PDF/Excel' },
      { id: 'walogs', label: 'Log WhatsApp', icon: Bell, desc: 'Riwayat notifikasi WA' },
      { id: 'settings', label: 'Pengaturan Sekolah', icon: Settings, desc: 'Profil & jam operasional' },
    ];

  };

  const navTabs = getNavTabs();

  const handleTabSelect = (tabId: string) => {
    onTabChange(tabId);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Header Bar */}
      <div className="lg:hidden bg-indigo-800 text-white p-3.5 flex items-center justify-between sticky top-0 z-40 border-b border-indigo-900 shadow-md">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 bg-indigo-700/80 hover:bg-indigo-700 rounded-xl text-white transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-white p-0.5 flex items-center justify-center shrink-0">
              {schoolProfile.schoolLogo ? (
                <img 
                  src={schoolProfile.schoolLogo} 
                  alt="Logo" 
                  className="w-full h-full object-contain rounded-md"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                <QrCode className="w-4 h-4 text-indigo-700" />
              )}
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight leading-none text-white">
                SiHadir<span className="text-amber-300">QR</span>
              </h1>
              <p className="text-[10px] text-indigo-200 truncate max-w-[160px] font-medium">{schoolProfile.name}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono bg-indigo-900/80 px-2 py-1 rounded-lg text-amber-300 font-bold border border-indigo-700">
            {timeStr}
          </span>
        </div>
      </div>

      {/* Mobile Sidebar Overlay Backdrop */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Left Sidebar Container (Single Column Menu) */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 lg:z-30
        w-72 h-screen bg-slate-900 text-slate-100 flex flex-col justify-between
        border-r border-slate-800 shadow-xl transition-transform duration-300 ease-in-out shrink-0
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Top Section: Brand & School Header */}
        <div className="p-4 border-b border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-700 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                {schoolProfile.schoolLogo ? (
                  <img 
                    src={schoolProfile.schoolLogo} 
                    alt="Logo" 
                    className="w-full h-full object-cover rounded-xl bg-white"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <QrCode className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white">
                    SiHadir<span className="text-amber-400 font-black">QR</span>
                  </span>
                  <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md border border-indigo-500/30">
                    v2.0
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{schoolProfile.name}</p>
              </div>
            </div>

            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role Switcher Box (Only shown for Admin) */}
          {currentRole === 'ADMIN' && (
            <div className="bg-slate-800/90 rounded-2xl p-2.5 border border-slate-700/80 space-y-1.5 shadow-inner">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
                <span>Akses Hak Akses:</span>
                <span className="text-amber-400 font-bold flex items-center gap-1 text-[10px]">
                  <ShieldCheck className="w-3 h-3" />
                  {currentRole}
                </span>
              </div>
              <select
                value={currentRole}
                onChange={(e) => onRoleChange(e.target.value as UserRole)}
                className="w-full bg-slate-900 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 cursor-pointer transition-all"
              >
                <option value="ADMIN">👑 Admin / Guru Piket</option>
                <option value="TEACHER">👩‍🏫 Guru Kelas / Wali Kelas</option>
                <option value="PARENT">👨‍👩‍👧 Wali Murid (Orang Tua)</option>
                <option value="SCANNER_POS">📡 Pos QR Scanner (Satpam)</option>
              </select>
            </div>
          )}
        </div>

        {/* Middle Section: SINGLE COLUMN FEATURE MENU LIST */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {currentRole === 'TEACHER' && (
            <div className="mx-1 mb-2.5 p-3 bg-indigo-950/80 border border-indigo-800/80 rounded-2xl flex items-center gap-2.5 shadow-md">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/40 border border-indigo-500/50 flex items-center justify-center shrink-0 text-indigo-300">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider leading-none">Akun Guru:</p>
                <p className="text-xs font-black text-white truncate mt-0.5">{userSession?.displayName || 'Guru'}</p>
                {userSession?.nipOrNisn && (
                  <p className="text-[10px] text-amber-400 font-mono font-bold mt-0.5">NIP: {userSession.nipOrNisn}</p>
                )}
              </div>
            </div>
          )}

          <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Fitur Menu Utama
          </div>

          <nav className="space-y-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabSelect(tab.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer group text-left ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500/50'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`p-2 rounded-xl transition-colors shrink-0 ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : 'bg-slate-800 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`truncate text-xs ${isActive ? 'font-black text-white' : 'font-bold text-slate-200'}`}>
                        {tab.label}
                      </p>
                      <p className={`text-[10px] truncate ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {tab.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    {tab.badge && tab.badge > 0 ? (
                      <span className="bg-pink-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                        {tab.badge}
                      </span>
                    ) : (
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${
                        isActive ? 'text-indigo-200 translate-x-0.5' : 'text-slate-600 group-hover:text-slate-300'
                      }`} />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Footer Info (Logged-in User, Live Clock & Logout) */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-900/90 space-y-2.5">
          
          {/* Active Logged-in User Card */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {userSession?.photoUrl ? (
                <img 
                  src={userSession.photoUrl} 
                  alt="User" 
                  className="w-8 h-8 rounded-xl object-cover border border-slate-600 shrink-0"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-300">
                  <User className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 text-xs">
                <p className="font-extrabold text-white truncate text-[11px]">
                  {userSession?.displayName || 'Pengguna Terdaftar'}
                </p>
                <p className="text-[10px] text-amber-400 font-bold truncate">
                  Role: {currentRole} {userSession?.nipOrNisn ? `• ${userSession.nipOrNisn}` : ''}
                </p>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 bg-red-950/60 hover:bg-red-900 text-red-300 hover:text-white rounded-xl border border-red-800/60 transition-colors shrink-0 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                title="Keluar dari Akun"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            )}
          </div>

          {/* Realtime Clock Widget */}
          <div className="flex items-center justify-between bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700/60 text-slate-300 text-xs">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="font-mono font-bold text-slate-200">{timeStr} WITA</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700">
              Masuk: {schoolProfile.startTime}
            </span>
          </div>

          {/* Cloud Database Sync Indicator */}
          <div className="flex items-center justify-between text-[11px] bg-sky-950/40 border border-sky-800/50 p-2 rounded-xl text-sky-300">
            <div className="flex items-center space-x-2">
              {syncStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              ) : syncStatus === 'connected' ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
              ) : (
                <Cloud className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="font-bold text-[11px]">
                {syncStatus === 'connected' ? 'Cloud Database: Terhubung' : syncStatus === 'syncing' ? 'Menyinkronkan Cloud...' : 'Database: Mode Offline'}
              </span>
            </div>
            <span className={`text-[10px] font-bold ${syncStatus === 'connected' ? 'text-emerald-400' : syncStatus === 'syncing' ? 'text-amber-400' : 'text-slate-400'}`}>
              {syncStatus === 'connected' ? 'Real-time' : syncStatus === 'syncing' ? 'Sync' : 'Lokal'}
            </span>
          </div>

          {/* WhatsApp Status Indicator */}
          <div className="flex items-center justify-between text-[11px] bg-emerald-950/40 border border-emerald-800/50 p-2 rounded-xl text-emerald-300">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-[11px]">WA Gateway: Online</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">Aktif</span>
          </div>
        </div>

      </aside>
    </>
  );
};
