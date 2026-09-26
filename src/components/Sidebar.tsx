import React, { useState, useEffect, useMemo } from 'react';
import { UserRole, SchoolProfile, UserSession, SchoolClass } from '../types';
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
  RefreshCw,
  CalendarDays,
  UserCircle
} from 'lucide-react';
import { getCloudSyncStatus, CloudSyncStatus, getStudents, getLeaveRequests, getAttendanceRecords, getTeachers, getStudentCharacterLogs, getSchoolClasses, getLocalDateString } from '../lib/storage';
import { MultiDeviceSyncModal } from './MultiDeviceSyncModal';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationModal } from './NotificationModal';
import { playBkNotificationChime } from '../lib/kbmVoiceReminder';

interface SidebarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  schoolProfile: SchoolProfile;
  unreadLeavesCount: number;
  userSession?: UserSession | null;
  onLogout?: () => void;
  studentCount?: number;
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
  studentCount,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() => getCloudSyncStatus());
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const currentStudentCount = studentCount !== undefined ? studentCount : getStudents().length;

  // Check if active user is a Teacher with BK role
  const isTeacherBk = useMemo(() => {
    if (currentRole !== 'TEACHER') return false;
    const teachers = getTeachers();
    const currentTeacher = teachers.find(t => 
      (userSession?.teacherId && t.id === userSession.teacherId) ||
      (userSession?.nipOrNisn && t.nip === userSession.nipOrNisn) ||
      (userSession?.displayName && t.name.toLowerCase() === userSession.displayName.toLowerCase())
    );

    return !!(
      (currentTeacher && (
        currentTeacher.additionalDuty?.toUpperCase().includes('BK') ||
        currentTeacher.additionalDuty?.toUpperCase().includes('BIMBINGAN') ||
        currentTeacher.additionalDuty?.toUpperCase().includes('KONSELING') ||
        currentTeacher.subject1?.toUpperCase().includes('BK') ||
        currentTeacher.subject1?.toUpperCase().includes('BIMBINGAN') ||
        currentTeacher.subject2?.toUpperCase().includes('BK') ||
        currentTeacher.subject2?.toUpperCase().includes('BIMBINGAN')
      )) ||
      userSession?.displayName?.toLowerCase().includes('bk') ||
      userSession?.username?.toLowerCase().includes('bk')
    );
  }, [currentRole, userSession]);

  // Check if current user is a Teacher with Wali Kelas (Homeroom) role from Classes & Teachers management
  const { isHomeroomTeacher, homeroomClasses, homeroomStudentIds, homeroomStudentNames } = useMemo(() => {
    if (currentRole !== 'TEACHER') {
      return { 
        isHomeroomTeacher: false, 
        homeroomClasses: [] as SchoolClass[], 
        homeroomStudentIds: new Set<string>(), 
        homeroomStudentNames: new Set<string>() 
      };
    }

    const teachers = getTeachers();
    const currentTeacher = teachers.find(t => 
      (userSession?.teacherId && t.id === userSession.teacherId) ||
      (userSession?.nipOrNisn && t.nip === userSession.nipOrNisn) ||
      (userSession?.displayName && t.name.toLowerCase() === userSession.displayName.toLowerCase())
    );

    const allClasses = getSchoolClasses();
    const allStudents = getStudents();

    // Find classes managed by this homeroom teacher
    const myClasses = allClasses.filter(c => {
      if (!c.homeroomTeacher) return false;
      const hName = c.homeroomTeacher.trim().toLowerCase();
      if (currentTeacher) {
        if (currentTeacher.name && hName === currentTeacher.name.trim().toLowerCase()) return true;
        if (currentTeacher.nip && (hName === currentTeacher.nip.trim().toLowerCase() || c.homeroomTeacher === currentTeacher.id)) return true;
        if (currentTeacher.homeroomClassId && (c.id === currentTeacher.homeroomClassId || c.name === currentTeacher.homeroomClassName)) return true;
      }
      if (userSession?.displayName && hName === userSession.displayName.trim().toLowerCase()) return true;
      return false;
    });

    const isWali = myClasses.length > 0 || !!(currentTeacher?.additionalDuty?.toUpperCase().includes('WALI'));

    // Extract all students belonging to these managed homeroom classes
    const studentIdSet = new Set<string>();
    const studentNameSet = new Set<string>();

    allStudents.forEach(s => {
      const matchClass = myClasses.some(c => 
        c.id === s.classId || 
        c.name.trim().toLowerCase() === s.className?.trim().toLowerCase() ||
        (c.id && s.className === c.id)
      );
      if (matchClass) {
        if (s.id) studentIdSet.add(s.id);
        if (s.nisn) studentIdSet.add(s.nisn);
        if (s.name) studentNameSet.add(s.name.trim().toLowerCase());
      }
    });

    return {
      isHomeroomTeacher: isWali,
      homeroomClasses: myClasses,
      homeroomStudentIds: studentIdSet,
      homeroomStudentNames: studentNameSet
    };
  }, [currentRole, userSession]);

  // Real-time audio chime for Guru BK and Wali Kelas when character assessment is added
  useEffect(() => {
    if (currentRole !== 'TEACHER' || (!isTeacherBk && !isHomeroomTeacher)) return;

    let prevCount = getStudentCharacterLogs().length;

    const handleStorageUpdate = () => {
      const currentLogs = getStudentCharacterLogs();
      if (currentLogs.length > prevCount) {
        if (isTeacherBk) {
          // Play notification chime for BK teacher
          playBkNotificationChime();
        } else if (isHomeroomTeacher && homeroomClasses.length > 0) {
          // Check if any new log is for a student in this homeroom teacher's class
          const newLogs = currentLogs.slice(prevCount);
          const hasStudentInClass = newLogs.some(c => {
            const matchStudentId = c.studentId && homeroomStudentIds.has(c.studentId);
            const matchNisn = c.nisn && homeroomStudentIds.has(c.nisn);
            const matchName = c.studentName && homeroomStudentNames.has(c.studentName.trim().toLowerCase());
            const matchClassName = homeroomClasses.some(hc => 
              hc.name.trim().toLowerCase() === c.className?.trim().toLowerCase() || 
              hc.id === c.classId || 
              hc.name.trim().toLowerCase() === c.classId?.trim().toLowerCase()
            );
            return matchStudentId || matchNisn || matchName || matchClassName;
          });

          if (hasStudentInClass) {
            playBkNotificationChime();
          }
        }
      }
      prevCount = currentLogs.length;
    };

    window.addEventListener('sihadir_storage_updated', handleStorageUpdate);
    return () => window.removeEventListener('sihadir_storage_updated', handleStorageUpdate);
  }, [currentRole, isTeacherBk, isHomeroomTeacher, homeroomClasses, homeroomStudentIds, homeroomStudentNames]);

  // Calculate unread badge count for mobile notification bell
  const notifBadgeCount = useMemo(() => {
    if (currentRole !== 'TEACHER' && currentRole !== 'PARENT') return 0;
    const storageKey = `sihadir_last_read_notif_${currentRole}_${userSession?.username || 'user'}`;
    const lastRead = Number(localStorage.getItem(storageKey)) || 0;

    if (currentRole === 'TEACHER') {
      const pendingLeaves = getLeaveRequests().filter(l => l.status === 'PENDING').length;

      // For Guru BK & Wali Kelas: include unread student character logs in badge count
      const charLogs = getStudentCharacterLogs();
      const unreadCharLogIds = new Set<string>();

      if (isTeacherBk) {
        charLogs.forEach(c => {
          if (new Date(c.timestamp || c.date).getTime() > lastRead) {
            unreadCharLogIds.add(c.id);
          }
        });
      }

      if (isHomeroomTeacher && homeroomClasses.length > 0) {
        charLogs.forEach(c => {
          const matchStudentId = c.studentId && homeroomStudentIds.has(c.studentId);
          const matchNisn = c.nisn && homeroomStudentIds.has(c.nisn);
          const matchName = c.studentName && homeroomStudentNames.has(c.studentName.trim().toLowerCase());
          const matchClassName = homeroomClasses.some(hc => 
            hc.name.trim().toLowerCase() === c.className?.trim().toLowerCase() || 
            hc.id === c.classId || 
            hc.name.trim().toLowerCase() === c.classId?.trim().toLowerCase()
          );
          if ((matchStudentId || matchNisn || matchName || matchClassName) && new Date(c.timestamp || c.date).getTime() > lastRead) {
            unreadCharLogIds.add(c.id);
          }
        });
      }

      return pendingLeaves + unreadCharLogIds.size;
    }

    if (currentRole === 'PARENT') {
      const students = getStudents();
      let student = students.find(s => s.id === userSession?.studentId || s.nisn === userSession?.nipOrNisn);
      if (!student && userSession?.displayName) {
        student = students.find(s => s.name.toLowerCase().includes(userSession.displayName.toLowerCase()) || 
                                     s.parentName?.toLowerCase().includes(userSession.displayName.toLowerCase()));
      }
      if (!student && students.length > 0) {
        student = students[0];
      }
      if (!student) return 0;

      const todayStr = getLocalDateString();
      let count = 0;
      
      const todayAtt = getAttendanceRecords().find(a => a.studentId === student!.id && a.date === todayStr);
      if (todayAtt && (!lastRead || lastRead < new Date().setHours(0, 0, 0, 0))) {
        count += 1;
      }

      const leaves = getLeaveRequests().filter(l => (l.studentId === student!.id || l.studentName === student!.name) && new Date(l.createdAt || l.startDate).getTime() > lastRead);
      count += leaves.length;

      return count;
    }

    return 0;
  }, [currentRole, userSession, unreadLeavesCount, isTeacherBk, isHomeroomTeacher, homeroomClasses, homeroomStudentIds, homeroomStudentNames]);

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
        { id: 'schedule', label: 'Jadwal Pelajaran', icon: CalendarDays, desc: 'Jadwal belajar putra/putri' },
        { id: 'discipline_rules', label: 'Tata Tertib', icon: Scale, desc: 'Aturan & poin karakter sekolah' },
        { id: 'leaves', label: 'Izin / Sakit', icon: FileText, desc: 'Ajukan permohonan izin/sakit', badge: unreadLeavesCount },
        { id: 'account', label: 'Akun', icon: UserCircle, desc: 'Lihat Kartu Pelajar & Ganti Password' },
      ];
    }
    if (currentRole === 'TEACHER') {
      return [
        { id: 'dashboard', label: 'Absensi Hari Ini', icon: UserCheck, desc: 'Dashboard presensi kelas' },
        { id: 'scanner', label: 'Scan QR Presensi', icon: ScanLine, desc: 'Scan QR manual siswa' },
        { id: 'schedule', label: 'Jadwal Pelajaran', icon: CalendarDays, desc: 'Jadwal KBM & jam mengajar' },
        { id: 'learning', label: 'Fitur Pembelajaran', icon: BookOpen, desc: 'Jurnal KBM & keaktifan siswa' },
        { id: 'character_points', label: 'Nilai Karakter', icon: Award, desc: 'Poin & bukti foto karakter' },
        { id: 'analytics', label: 'Analitik & AI', icon: Sparkles, desc: 'Laporan AI & grafik tren' },
        { id: 'leaves', label: 'Persetujuan Izin', icon: FileText, desc: 'Persetujuan wali murid', badge: unreadLeavesCount },
        { id: 'recap', label: 'Rekap Laporan', icon: FileText, desc: 'Ekspor laporan bulanan' },
        { id: 'account', label: 'Akun Guru', icon: UserCircle, desc: 'Identitas guru & ubah password' },
      ];
    }

    // ADMIN / GURU PIKET
    return [
      { id: 'dashboard', label: 'Dasbor Presensi', icon: BarChart3, desc: 'Ringkasan & statistik utama' },
      { id: 'scanner', label: 'Pos Scan QR', icon: ScanLine, desc: 'Pemindai barcode/QR harian' },
      { id: 'schedule', label: 'Jadwal Pelajaran', icon: CalendarDays, desc: 'Sesi JP, guru & mapel per kelas' },
      { id: 'learning', label: 'Jurnal Pembelajaran', icon: BookOpen, desc: 'Rekap KBM & keaktifan kelas' },
      { id: 'character_input', label: 'Input Karakter Siswa', icon: Sparkles, desc: 'Master data & bobot karakter (+/-)' },
      { id: 'character_points', label: 'Nilai Karakter', icon: Award, desc: 'Poin & bukti foto karakter' },
      { id: 'analytics', label: 'Analitik & AI', icon: Sparkles, desc: 'Laporan AI & grafik tren' },
      { id: 'teachers', label: 'Database Guru & TU', icon: UserCheck, desc: 'Kelola data guru & staf TU' },
      { id: 'students', label: 'Database Siswa', icon: Users, desc: 'Kelola data & kartu KTS' },
      { id: 'classes', label: 'Kelola Data Kelas', icon: Building2, desc: 'Daftar & wali kelas' },
      { id: 'leaves', label: 'Permohonan Izin', icon: FileText, desc: 'Verifikasi surat izin/sakit', badge: unreadLeavesCount },
      { id: 'recap', label: 'Rekap & Ekspor', icon: FileText, desc: 'Cetak laporan PDF/Excel' },
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
      <div className={`lg:hidden p-3.5 flex items-center justify-between sticky top-0 z-40 shadow-md ${
        currentRole === 'PARENT'
          ? 'bg-slate-900/85 backdrop-blur-2xl text-white border-b border-white/15'
          : 'bg-indigo-800 text-white border-b border-indigo-900'
      }`}>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className={`p-2 rounded-xl text-white transition-colors cursor-pointer ${
              currentRole === 'PARENT'
                ? 'bg-white/10 hover:bg-white/20 border border-white/15'
                : 'bg-indigo-700/80 hover:bg-indigo-700'
            }`}
            aria-label="Toggle Navigation Menu"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-xl p-0.5 flex items-center justify-center shrink-0 ${
              currentRole === 'PARENT'
                ? 'bg-gradient-to-tr from-emerald-500 to-indigo-600 shadow-md ring-1 ring-white/30'
                : 'bg-white'
            }`}>
              {schoolProfile.schoolLogo ? (
                <img 
                  src={schoolProfile.schoolLogo} 
                  alt="Logo" 
                  className="w-full h-full object-contain rounded-lg bg-white"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                <QrCode className={`w-4 h-4 ${currentRole === 'PARENT' ? 'text-white' : 'text-indigo-700'}`} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-sm tracking-tight leading-none text-white">
                  SiHadir<span className="text-amber-300">QR</span>
                </h1>
                {currentRole === 'PARENT' && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border border-emerald-400/30">
                    Portal Wali
                  </span>
                )}
              </div>
              <p className={`text-[10px] truncate max-w-[150px] font-medium mt-0.5 ${
                currentRole === 'PARENT' ? 'text-slate-300' : 'text-indigo-200'
              }`}>{schoolProfile.name}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bell Notification Icon for Teacher and Parent in Mobile Mode */}
          {(currentRole === 'TEACHER' || currentRole === 'PARENT') && (
            <button
              type="button"
              onClick={() => setShowNotificationModal(true)}
              className="relative p-2 rounded-xl bg-transparent hover:bg-white/10 text-yellow-400 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0"
              title="Pusat Notifikasi"
              aria-label="Pusat Notifikasi"
            >
              <Bell className="w-5 h-5 text-yellow-400 stroke-[2.5]" />
              {notifBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-xs animate-pulse ring-2 ring-slate-900">
                  {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
                </span>
              )}
            </button>
          )}

          {currentRole === 'TEACHER' ? (
            /* Khusus Role Guru: Tampilan Waktu di Bawah Tampilan Cloud Live */
            <div className="flex flex-col items-center gap-1 shrink-0 min-w-[76px]">
              {/* Cloud Sync Quick Button on top */}
              <button
                type="button"
                onClick={() => setShowSyncModal(true)}
                className={`flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 w-full ${
                  syncStatus === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-400/40 hover:bg-sky-500/30'
                }`}
                title="Sinkronisasi Cloud & Multi-Perangkat (Upload/Tarik Data)"
              >
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-300" />
                ) : syncStatus === 'connected' ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                ) : (
                  <Cloud className="w-3 h-3 text-sky-300" />
                )}
                <span className="text-[10px] font-extrabold leading-none">
                  {syncStatus === 'connected' ? 'Cloud Live' : syncStatus === 'syncing' ? 'Sync...' : 'Sinkron'}
                </span>
              </button>

              {/* Tampilan Waktu di Bawah Cloud Live */}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md font-bold border bg-indigo-900/90 text-amber-300 border-indigo-700 leading-tight text-center w-full shadow-inner tracking-tight">
                {timeStr}
              </span>
            </div>
          ) : (
            <>
              {/* Cloud Sync Quick Button for Mobile Header (Admins, Scanner Pos, etc.) */}
              <button
                type="button"
                onClick={() => setShowSyncModal(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${
                  syncStatus === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-400/40 hover:bg-sky-500/30'
                }`}
                title="Sinkronisasi Cloud & Multi-Perangkat (Upload/Tarik Data)"
              >
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                ) : syncStatus === 'connected' ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-sky-300" />
                )}
                <span className="text-[11px] font-extrabold">
                  {syncStatus === 'connected' ? 'Cloud Live' : syncStatus === 'syncing' ? 'Sync...' : 'Sinkron'}
                </span>
              </button>

              <span className={`text-[11px] font-mono px-2 py-1 rounded-lg font-bold border ${
                currentRole === 'PARENT'
                  ? 'bg-white/10 text-emerald-300 border-white/15 backdrop-blur-md'
                  : 'bg-indigo-900/80 text-amber-300 border-indigo-700'
              }`}>
                {timeStr}
              </span>
            </>
          )}
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
            <div className="mx-1 mb-2.5 p-3 bg-indigo-950/80 border border-indigo-800/80 rounded-2xl shadow-md">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/40 border border-indigo-500/50 flex items-center justify-center shrink-0 text-indigo-300">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider leading-none">
                        {isHomeroomTeacher && homeroomClasses.length > 0 
                          ? `Wali Kelas ${homeroomClasses.map(c => c.name).join(', ')}` 
                          : isTeacherBk 
                            ? 'Guru BK' 
                            : 'Akun Guru'}
                      </p>
                    </div>
                    <p className="text-xs font-black text-white truncate mt-0.5">{userSession?.displayName || 'Guru'}</p>
                    {userSession?.nipOrNisn && (
                      <p className="text-[10px] text-amber-400 font-mono font-bold mt-0.5">NIP: {userSession.nipOrNisn}</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNotificationModal(true)}
                  className="relative p-2 rounded-xl bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 hover:text-white border border-indigo-700/60 transition-colors cursor-pointer shrink-0"
                  title="Pusat Notifikasi"
                >
                  <Bell className="w-4 h-4" />
                  {notifBadgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-xs animate-pulse">
                      {notifBadgeCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {currentRole === 'PARENT' && (
            <div className="mx-1 mb-2.5 p-3 bg-indigo-950/80 border border-indigo-800/80 rounded-2xl flex items-center gap-2.5 shadow-md">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-300">
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider leading-none">Wali Murid Terhubung:</p>
                <p className="text-xs font-black text-white truncate mt-0.5">{userSession?.displayName || 'Orang Tua Siswa'}</p>
                {userSession?.nipOrNisn && (
                  <p className="text-[10px] text-amber-300 font-mono font-bold mt-0.5">NISN: {userSession.nipOrNisn}</p>
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

          {/* Dedicated PWA Install Button (Displays when opened in browser and not installed) */}
          <PWAInstallButton variant="sidebar" />

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

          {/* Cloud Database Sync Indicator (Interactive for all roles to sync data across devices) */}
          <button
            type="button"
            onClick={() => setShowSyncModal(true)}
            className="w-full flex items-center justify-between text-[11px] bg-sky-950/60 hover:bg-sky-900/70 border border-sky-700/60 p-2 rounded-xl text-sky-200 transition-all cursor-pointer text-left shadow-xs group"
            title="Klik untuk menyamakan dan menyinkronkan data antar-perangkat (Upload / Tarik Data Cloud)"
          >
            <div className="flex items-center space-x-2 truncate mr-1.5">
              {syncStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
              ) : syncStatus === 'connected' ? (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
              ) : syncStatus === 'quota_exceeded' ? (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                </span>
              ) : (
                <Cloud className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="font-bold text-[11px] text-sky-100 group-hover:text-white transition-colors truncate">
                {syncStatus === 'connected' ? 'Database: Live' : syncStatus === 'quota_exceeded' ? 'Cloud: Kuota Habis' : syncStatus === 'syncing' ? 'Menyinkronkan...' : 'Database: Offline'}
              </span>
            </div>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border transition-colors shrink-0 ${syncStatus === 'quota_exceeded' ? 'text-amber-300 bg-amber-950/80 border-amber-700 group-hover:bg-amber-600 group-hover:text-white' : 'text-sky-300 bg-sky-900/80 border-sky-600 group-hover:bg-sky-600 group-hover:text-white'}`}>
              {syncStatus === 'quota_exceeded' ? 'File ↗' : 'Sinkron ↗'}
            </span>
          </button>
        </div>

      </aside>

      {/* Multi-Device Cloud Sync Modal */}
      <MultiDeviceSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        currentStudentCount={currentStudentCount}
        syncStatus={syncStatus}
      />

      {/* Notification Center Modal for Teachers and Parents */}
      <NotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        currentRole={currentRole}
        userSession={userSession}
        onTabChange={(tab) => {
          onTabChange(tab);
          setIsMobileOpen(false);
        }}
      />
    </>
  );
};
