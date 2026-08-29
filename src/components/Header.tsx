import React from 'react';
import { UserRole, SchoolProfile } from '../types';
import { 
  QrCode, 
  ShieldCheck, 
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
  Clock
} from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  schoolProfile: SchoolProfile;
  unreadLeavesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  activeTab,
  onTabChange,
  schoolProfile,
  unreadLeavesCount,
}) => {
  const [timeStr, setTimeStr] = React.useState('');

  React.useEffect(() => {
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
        { id: 'scanner', label: 'Scan QR Presensi', icon: ScanLine },
        { id: 'dashboard', label: 'Feed Kehadiran', icon: BarChart3 },
      ];
    }
    if (currentRole === 'PARENT') {
      return [
        { id: 'dashboard', label: 'Kehadiran Anak', icon: UserCheck },
        { id: 'idcard', label: 'Kartu Pelajar Digital', icon: GraduationCap },
        { id: 'leaves', label: 'Izin / Sakit & Chat', icon: MessageSquare, badge: unreadLeavesCount },
      ];
    }
    if (currentRole === 'TEACHER') {
      return [
        { id: 'dashboard', label: 'Absensi Kelas Hari Ini', icon: UserCheck },
        { id: 'scanner', label: 'Scan QR', icon: ScanLine },
        { id: 'leaves', label: 'Persetujuan Izin', icon: MessageSquare, badge: unreadLeavesCount },
        { id: 'recap', label: 'Rekap Laporan', icon: FileText },
      ];
    }

    // ADMIN / GURU PIKET
    return [
      { id: 'dashboard', label: 'Dasbor', icon: BarChart3 },
      { id: 'scanner', label: 'Scan QR', icon: ScanLine },
      { id: 'analytics', label: 'Analitik & AI', icon: BarChart3 },
      { id: 'students', label: 'Database Siswa', icon: Users },
      { id: 'classes', label: 'Data Kelas', icon: Building2 },
      { id: 'leaves', label: 'Permohonan Izin', icon: MessageSquare, badge: unreadLeavesCount },
      { id: 'recap', label: 'Rekap & Ekspor', icon: FileText },
      { id: 'walogs', label: 'Log WhatsApp', icon: Bell },
      { id: 'settings', label: 'Pengaturan Sekolah', icon: Settings },
    ];
  };

  const navTabs = getNavTabs();

  return (
    <header className="bg-indigo-700 text-white shadow-md border-b border-indigo-800 sticky top-0 z-40">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand & School info */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-700 font-bold text-xl shadow-lg shrink-0">
            {schoolProfile.schoolLogo ? (
              <img 
                src={schoolProfile.schoolLogo} 
                alt="Logo" 
                className="w-full h-full object-cover rounded-xl"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <QrCode className="w-5 h-5 text-indigo-700" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                SiHadir<span className="text-indigo-200 font-medium text-sm">QR</span>
              </span>
              <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20">
                v2.0
              </span>
            </div>
            <p className="text-xs text-indigo-200 font-medium line-clamp-1">{schoolProfile.name}</p>
          </div>
        </div>

        {/* Center Live Clock */}
        <div className="hidden lg:flex items-center gap-2 bg-indigo-800/80 px-3.5 py-1.5 rounded-xl border border-indigo-500/30 text-indigo-100 text-xs font-mono shadow-inner">
          <Clock className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
          <span>{timeStr} WITA</span>
          <span className="text-indigo-400">|</span>
          <span className="text-indigo-200">Jam Masuk: {schoolProfile.startTime}</span>
        </div>

        {/* Status Indicator & Role Switcher */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full font-bold text-xs shadow-sm">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
            WhatsApp Gateway: Online
          </div>

          <div className="flex items-center bg-indigo-800/90 rounded-xl p-1 border border-indigo-500/30">
            <span className="text-xs text-indigo-200 font-medium px-2 hidden sm:inline">Role:</span>
            <select
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              className="bg-white text-indigo-900 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 border border-indigo-200 shadow-sm cursor-pointer"
            >
              <option value="ADMIN">👑 Admin / Guru Piket</option>
              <option value="TEACHER">👩‍🏫 Guru Kelas / Wali Kelas</option>
              <option value="PARENT">👨‍👩‍👧 Wali Murid (Orang Tua)</option>
              <option value="SCANNER_POS">📡 Pos QR Scanner (Satpam)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-indigo-600/60 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1 sm:space-x-2 py-2">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 relative cursor-pointer ${
                  isActive
                    ? 'bg-white text-indigo-800 shadow-lg font-extrabold'
                    : 'text-indigo-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-700' : 'text-indigo-200'}`} />
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span className="ml-1 bg-pink-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full border border-indigo-700 animate-pulse">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
