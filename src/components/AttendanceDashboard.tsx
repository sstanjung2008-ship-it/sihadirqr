import React, { useState, useEffect } from 'react';
import { 
  AttendanceRecord, 
  Student, 
  SchoolClass, 
  UserRole,
  LearningJournal,
  CharacterTrait,
  StudentCharacterLog,
  CharacterPredicateSettings,
  UserSession,
  SchoolProfile
} from '../types';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  HeartPulse, 
  FileText, 
  XCircle, 
  Search, 
  Filter, 
  Edit3, 
  Zap,
  TrendingUp,
  Home,
  BookOpen,
  Award,
  Sparkles,
  ThumbsUp,
  AlertTriangle,
  Image,
  Calendar,
  X,
  GraduationCap,
  CalendarDays,
  UserCircle,
  ShieldCheck,
  QrCode,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  LayoutDashboard,
  BarChart3,
  UserX,
  UserCheck,
  Trash2,
  LogOut
} from 'lucide-react';
import { BulkAlpaManagementModal } from './BulkAlpaManagementModal';
import { BulkReturnManagementModal, BulkReturnUpdatePayload } from './BulkReturnManagementModal';
import { getLocalDateString } from '../lib/storage';

interface AttendanceDashboardProps {
  students: Student[];
  classes: SchoolClass[];
  attendanceRecords: AttendanceRecord[];
  onUpdateStatus: (
    recordId: string, 
    newStatus: AttendanceRecord['status'], 
    notes?: string, 
    returnTime?: string, 
    returnStatus?: AttendanceRecord['returnStatus'],
    fullRecord?: AttendanceRecord
  ) => void;
  onDeleteAttendanceRecords?: (recordIds: string[]) => void;
  onBulkUpdateAttendanceRecords?: (updates: {
    studentId: string;
    studentName: string;
    nisn: string;
    className: string;
    date: string;
    newStatus: AttendanceRecord['status'];
    notes?: string;
    existingRecordId?: string;
  }[]) => void;
  onBulkUpdateReturnStatus?: (updates: BulkReturnUpdatePayload[]) => void;
  currentRole: UserRole;
  selectedChildId?: string;
  learningJournals?: LearningJournal[];
  traits?: CharacterTrait[];
  characterLogs?: StudentCharacterLog[];
  predicateSettings?: CharacterPredicateSettings;
  userSession?: UserSession | null;
  onNavigateTab?: (tab: string) => void;
  schoolProfile?: SchoolProfile;
  unreadLeavesCount?: number;
}

export const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({
  students,
  classes,
  attendanceRecords,
  onUpdateStatus,
  onDeleteAttendanceRecords,
  onBulkUpdateAttendanceRecords,
  onBulkUpdateReturnStatus,
  currentRole,
  selectedChildId,
  learningJournals = [],
  traits = [],
  characterLogs = [],
  predicateSettings = { minA: 30, minB: 10, minC: 0, minD: -20, minE: -50 },
  userSession,
  onNavigateTab,
  schoolProfile,
  unreadLeavesCount = 0
}) => {
  const todayStr = getLocalDateString();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedEntryStatusFilter, setSelectedEntryStatusFilter] = useState<string>('ALL');
  const [selectedReturnStatusFilter, setSelectedReturnStatusFilter] = useState<string>('ALL');
  const [parentView, setParentView] = useState<'beranda' | 'dashbor'>('beranda');

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceRecord['status']>('HADIR');
  const [editTime, setEditTime] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editReturnTime, setEditReturnTime] = useState<string>('');
  const [editReturnStatus, setEditReturnStatus] = useState<AttendanceRecord['returnStatus']>('PULANG');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showBulkAlpaModal, setShowBulkAlpaModal] = useState<boolean>(false);
  const [showBulkReturnModal, setShowBulkReturnModal] = useState<boolean>(false);
  const [highlightedCharLogId, setHighlightedCharLogId] = useState<string | null>(null);

  // Listen to deep linking notification event for PARENT role
  useEffect(() => {
    const handleOpenCharDetail = (e: any) => {
      if (currentRole === 'PARENT') {
        const { characterLogId } = e.detail || {};
        setParentView('dashbor');
        if (characterLogId) {
          setHighlightedCharLogId(characterLogId);
        }
        setTimeout(() => {
          const el = document.getElementById('parent-character-recap');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      }
    };

    window.addEventListener('sihadir_open_character_detail', handleOpenCharDetail);
    return () => window.removeEventListener('sihadir_open_character_detail', handleOpenCharDetail);
  }, [currentRole]);

  const sortedClasses = [...classes].sort((a, b) =>
    a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
  );

  // Filter records for selected date
  const dateRecords = attendanceRecords.filter(r => r.date === selectedDate);

  const studentDateStatusMap = new Map<string, AttendanceRecord>();
  dateRecords.forEach(r => {
    if (r.studentId) studentDateStatusMap.set(r.studentId, r);
    if (r.nisn) studentDateStatusMap.set(r.nisn, r);
  });

  // Base student list based on role/class filter
  let filteredStudents = students;
  if (currentRole === 'PARENT' && selectedChildId) {
    filteredStudents = students.filter(s => s.id === selectedChildId);
  } else if (selectedClassFilter !== 'ALL') {
    filteredStudents = students.filter(s => s.className === selectedClassFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredStudents = filteredStudents.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.nisn.includes(q) ||
      s.className.toLowerCase().includes(q)
    );
  }

  // Filter by Entry Status (Status Masuk)
  if (selectedEntryStatusFilter !== 'ALL') {
    filteredStudents = filteredStudents.filter(std => {
      const rec = studentDateStatusMap.get(std.id) || (std.nisn ? studentDateStatusMap.get(std.nisn) : undefined);
      if (selectedEntryStatusFilter === 'BELUM_ABSEN') {
        return !rec;
      }
      if (selectedEntryStatusFilter === 'ALPA') {
        return rec?.status === 'ALPA';
      }
      return rec?.status === selectedEntryStatusFilter;
    });
  }

  // Filter by Return Status (Status Pulang)
  if (selectedReturnStatusFilter !== 'ALL') {
    filteredStudents = filteredStudents.filter(std => {
      const rec = studentDateStatusMap.get(std.id) || (std.nisn ? studentDateStatusMap.get(std.nisn) : undefined);
      const isPulang = !!(rec && (rec.returnTime || rec.returnStatus === 'PULANG' || rec.returnStatus === 'PULANG_TEPAT' || rec.returnStatus === 'PULANG_CEPAT'));
      if (selectedReturnStatusFilter === 'PULANG') {
        return isPulang;
      } else if (selectedReturnStatusFilter === 'BELUM_PULANG') {
        return !isPulang;
      }
      return true;
    });
  }

  // Ensure students are sorted Ascending by name
  filteredStudents = [...filteredStudents].sort((a, b) => 
    a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
  );

  // Calculate statistics for selected date
  let baseStudentsForStats = students;
  if (currentRole === 'PARENT' && selectedChildId) {
    baseStudentsForStats = students.filter(s => s.id === selectedChildId);
  } else if (selectedClassFilter !== 'ALL') {
    baseStudentsForStats = students.filter(s => s.className === selectedClassFilter);
  }

  const totalStudentsCount = baseStudentsForStats.length;

  let countHadir = 0;
  let countTerlambat = 0;
  let countSakit = 0;
  let countIzin = 0;
  let countAlpa = 0;
  let countPulang = 0;

  baseStudentsForStats.forEach(std => {
    const rec = studentDateStatusMap.get(std.id);
    if (!rec) {
      countAlpa++;
    } else if (rec.status === 'HADIR') countHadir++;
    else if (rec.status === 'TERLAMBAT') countTerlambat++;
    else if (rec.status === 'SAKIT') countSakit++;
    else if (rec.status === 'IZIN') countIzin++;
    else if (rec.status === 'ALPA') countAlpa++;

    if (rec && (rec.returnTime || rec.returnStatus === 'PULANG' || rec.returnStatus === 'PULANG_TEPAT' || rec.returnStatus === 'PULANG_CEPAT')) {
      countPulang++;
    }
  });

  const totalPresent = countHadir + countTerlambat;
  const countBelumPulang = Math.max(0, totalStudentsCount - countPulang);
  const attendanceRate = totalStudentsCount > 0 ? Math.round((totalPresent / totalStudentsCount) * 100) : 0;

  const displayDateFormatted = React.useMemo(() => {
    try {
      const d = new Date(selectedDate + 'T00:00:00');
      if (isNaN(d.getTime())) return selectedDate;
      return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Selected child for Parent Role
  const targetStudent = currentRole === 'PARENT'
    ? (students.find(s => s.id === selectedChildId) || filteredStudents[0])
    : null;

  // Child's attendance record for the selected date
  const childRecord = targetStudent 
    ? attendanceRecords.find(r => (r.studentId === targetStudent.id || r.nisn === targetStudent.nisn) && r.date === selectedDate)
    : undefined;

  // Compute Keaktifan KBM data for target child
  const childJournals = learningJournals.filter(j => {
    if (!targetStudent) return false;
    return j.studentAttendances?.some(a => 
      a.studentId === targetStudent.id || 
      a.nisn === targetStudent.nisn || 
      a.studentName === targetStudent.name
    );
  });

  let sangAtifCount = 0;
  let cukupAktifCount = 0;
  let kurangAktifCount = 0;
  let menggangguCount = 0;
  let tidakHadirCount = 0;
  let sakitIjinCount = 0;

  childJournals.forEach(j => {
    const att = j.studentAttendances?.find(a => 
      a.studentId === targetStudent?.id || 
      a.nisn === targetStudent?.nisn || 
      a.studentName === targetStudent?.name
    );
    if (att) {
      if (att.status === 'Sangat aktif') sangAtifCount++;
      else if (att.status === 'Cukup aktif') cukupAktifCount++;
      else if (att.status === 'Kurang aktif') kurangAktifCount++;
      else if (att.status === 'Mengganggu') menggangguCount++;
      else if (att.status === 'Tidak hadir di kelas') tidakHadirCount++;
      else if (att.status === 'Sakit / Ijin' || att.status === 'Sakit/Ijin' || att.status === 'Sakit / Izin') sakitIjinCount++;
    }
  });

  const totalKbmPertemuan = childJournals.length;

  let overallKeaktifan = { label: 'Sangat Aktif', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (totalKbmPertemuan === 0) {
    overallKeaktifan = { label: 'Belum Ada Data', color: 'bg-slate-100 text-slate-600 border-slate-300' };
  } else if (menggangguCount > 0 || kurangAktifCount > 2) {
    overallKeaktifan = { label: 'Perlu Perhatian', color: 'bg-rose-100 text-rose-800 border-rose-300' };
  } else if (sangAtifCount >= cukupAktifCount && sangAtifCount >= kurangAktifCount) {
    overallKeaktifan = { label: 'Sangat Aktif', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  } else if (cukupAktifCount >= kurangAktifCount) {
    overallKeaktifan = { label: 'Cukup Aktif', color: 'bg-blue-100 text-blue-800 border-blue-300' };
  } else {
    overallKeaktifan = { label: 'Kurang Aktif', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  }

  // Compute Character Points data for target child
  const childCharacterLogs = characterLogs.filter(l => 
    targetStudent && (l.studentId === targetStudent.id || l.nisn === targetStudent.nisn)
  );

  const posLogs = childCharacterLogs.filter(l => l.traitType === 'POSITIF');
  const negLogs = childCharacterLogs.filter(l => l.traitType === 'NEGATIF');

  const posPoints = posLogs.reduce((sum, item) => sum + (item.points || 0), 0);
  const negPoints = negLogs.reduce((sum, item) => sum + (item.points || 0), 0);
  const netPoints = posPoints - negPoints;

  const minA = predicateSettings?.minA ?? 30;
  const minB = predicateSettings?.minB ?? 10;
  const minC = predicateSettings?.minC ?? 0;
  const minD = predicateSettings?.minD ?? -20;
  const minE = predicateSettings?.minE ?? -50;

  let characterPred = { label: 'Baik (B)', color: 'bg-blue-100 text-blue-800 border-blue-300' };
  if (netPoints >= minA) characterPred = { label: 'Sangat Baik (A)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  else if (netPoints >= minB) characterPred = { label: 'Baik (B)', color: 'bg-blue-100 text-blue-800 border-blue-300' };
  else if (netPoints >= minC) characterPred = { label: 'Cukup (C)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  else if (netPoints >= minD) characterPred = { label: 'Perlu Pembinaan (D)', color: 'bg-orange-100 text-orange-800 border-orange-300' };
  else if (netPoints >= minE) characterPred = { label: 'Tidak Naik Kelas (E)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
  else characterPred = { label: 'Pindah Sekolah (F)', color: 'bg-purple-100 text-purple-800 border-purple-300' };


  const handleOpenEdit = (rec: AttendanceRecord | undefined, student: Student) => {
    if (rec) {
      setEditingRecord(rec);
      setEditStatus(rec.status);
      setEditTime(rec.time && rec.time !== '-' ? rec.time : '');
      setEditNotes(rec.notes || '');
      setEditReturnTime(rec.returnTime || '');
      setEditReturnStatus(rec.returnStatus || 'PULANG');
    } else {
      const newRec: AttendanceRecord = {
        id: `att-${selectedDate}-${student.id}`,
        studentId: student.id,
        studentName: student.name,
        nisn: student.nisn,
        className: student.className,
        date: selectedDate,
        time: '-',
        status: 'HADIR',
        method: 'MANUAL',
        scannedBy: 'Guru Piket',
        parentNotified: false
      };
      setEditingRecord(newRec);
      setEditStatus('HADIR');
      setEditTime('');
      setEditNotes('');
      setEditReturnTime('');
      setEditReturnStatus('PULANG');
    }
  };

  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      const recordWithTime: AttendanceRecord = {
        ...editingRecord,
        time: editTime.trim() ? editTime.trim() : '-',
      };
      onUpdateStatus(
        editingRecord.id, 
        editStatus, 
        editNotes, 
        editReturnTime.trim() ? editReturnTime.trim() : undefined,
        editReturnTime.trim() ? editReturnStatus : undefined,
        recordWithTime
      );
      setEditingRecord(null);
    }
  };

  const hasActiveFilters = selectedClassFilter !== 'ALL' || selectedEntryStatusFilter !== 'ALL' || selectedReturnStatusFilter !== 'ALL' || searchQuery.trim() !== '' || selectedDate !== todayStr;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* PARENT MODE: MODERN GLASS DASHBOARD & NAVIGATION HUB */}
      {currentRole === 'PARENT' ? (
        parentView === 'beranda' ? (
          /* PARENT VIEW: BERANDA */
          <div className="space-y-6">
            {/* 1. HERO HEADER KACA MODERN DENGAN LOGO SEKOLAH */}
            <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 backdrop-blur-2xl bg-white/75 border border-white/80 shadow-[0_12px_40px_rgba(31,38,135,0.08)] bg-gradient-to-br from-white/95 via-white/80 to-indigo-50/50">
              {/* Ambient Background Glows */}
              <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-indigo-400/20 to-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-gradient-to-tr from-amber-400/15 to-sky-400/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                {/* Left: School Logo & Parent Portal Branding */}
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-1 bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 shadow-lg shadow-indigo-500/20 ring-2 ring-white/80 shrink-0 flex items-center justify-center">
                    {schoolProfile?.schoolLogo ? (
                      <img 
                        src={schoolProfile.schoolLogo} 
                        alt="Logo Sekolah" 
                        className="w-full h-full object-contain rounded-xl bg-white"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <QrCode className="w-8 h-8 text-white" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-emerald-500/15 text-emerald-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Portal Pintar Wali Murid
                      </span>
                      <span className="bg-indigo-50 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                        {schoolProfile?.academicYear || 'Tahun Ajaran Aktif'}
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                      {schoolProfile?.name || 'Sistem Kehadiran Digital'}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">
                      Monitoring kehadiran, jadwal KBM, nilai karakter & komunikasi sekolah secara real-time.
                    </p>
                  </div>
                </div>

                {/* Right: Date info in Modern Glass */}
                <div className="flex items-center gap-2 self-start md:self-auto shrink-0 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl px-3.5 py-2 text-xs shadow-xs">
                  <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-700 font-mono">
                    {displayDateFormatted}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. MENU NAVIGASI TEMA KACA MODERN (5 FITUR UTAMA DENGAN LOGO/ICON) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Menu Navigasi Fitur Orang Tua (Tema Kaca Modern)
                </h3>
                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Pilih menu untuk membuka halaman</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {/* ITEM 1: DASHBOR */}
                <button
                  type="button"
                  onClick={() => setParentView('dashbor')}
                  className="group relative overflow-hidden rounded-3xl p-4 text-left backdrop-blur-xl bg-white/80 hover:bg-white/95 border border-emerald-300/70 hover:border-emerald-400 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[120px] ring-2 ring-emerald-500/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                      <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Dashbor
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                      Status & Rekap Lengkap
                    </p>
                  </div>
                </button>

                {/* ITEM 2: JADWAL PELAJARAN */}
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('schedule')}
                  className="group relative overflow-hidden rounded-3xl p-4 text-left backdrop-blur-xl bg-white/75 hover:bg-white/95 border border-indigo-200/80 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[120px]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
                      Jadwal
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                      Jadwal KBM & Guru Mapel
                    </p>
                  </div>
                </button>

                {/* ITEM 3: PENGAJUAN IZIN / SAKIT */}
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('leaves')}
                  className="group relative overflow-hidden rounded-3xl p-4 text-left backdrop-blur-xl bg-white/75 hover:bg-white/95 border border-amber-200/80 hover:border-amber-400 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[120px]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    {unreadLeavesCount > 0 ? (
                      <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                        {unreadLeavesCount}
                      </span>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-black text-slate-900 group-hover:text-amber-700 transition-colors">
                      Izin
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                      Surat Izin & Sakit Digital
                    </p>
                  </div>
                </button>

                {/* ITEM 4: AKUN & KARTU KTS */}
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('account')}
                  className="group relative overflow-hidden rounded-3xl p-4 text-left backdrop-blur-xl bg-white/75 hover:bg-white/95 border border-purple-200/80 hover:border-purple-400 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[120px]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                      <UserCircle className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-black text-slate-900 group-hover:text-purple-700 transition-colors">
                      Akun
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                      Kartu Pelajar & Data Akun
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. CARD UTAMA BERANDA: RINGKASAN CEPAT & CTA MENUJU DASHBOR LENGKAP */}
            <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-2xl bg-white/80 border border-emerald-200/80 shadow-md bg-gradient-to-br from-emerald-50/40 via-white/90 to-teal-50/30">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 flex-1">
                  <div className="inline-flex items-center gap-2 bg-emerald-100/80 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full border border-emerald-300/60">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Ringkasan Kehadiran Putra/Putri Anda
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">
                    {targetStudent?.name || 'Siswa Terdaftar'}
                  </h2>
                  <p className="text-xs text-slate-600 font-medium">
                    Kelas <strong className="text-slate-900">{targetStudent?.className || '-'}</strong> • NISN: <span className="font-mono">{targetStudent?.nisn || '-'}</span>
                  </p>

                  {/* Mini Status Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                    <div className="bg-white/90 rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Masuk</span>
                      <span className="text-xs font-black text-slate-900 block mt-0.5">
                        {childRecord ? childRecord.status : 'BELUM SCAN'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {childRecord?.time ? `${childRecord.time} WITA` : '-'}
                      </span>
                    </div>

                    <div className="bg-white/90 rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pulang</span>
                      <span className="text-xs font-black text-slate-900 block mt-0.5">
                        {childRecord?.returnTime ? 'SUDAH PULANG' : 'BELUM PULANG'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {childRecord?.returnTime ? `${childRecord.returnTime} WITA` : '-'}
                      </span>
                    </div>

                    <div className="bg-white/90 rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Keaktifan KBM</span>
                      <span className="text-xs font-black text-indigo-700 block mt-0.5">
                        {overallKeaktifan.label}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {totalKbmPertemuan} Pertemuan
                      </span>
                    </div>

                    <div className="bg-white/90 rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Karakter</span>
                      <span className="text-xs font-black text-amber-700 block mt-0.5">
                        Predikat {characterPred.label}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {netPoints > 0 ? `+${netPoints}` : netPoints} Poin Net
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Button to Open Full Dashbor */}
                <div className="shrink-0 flex flex-col items-start lg:items-end justify-center">
                  <button
                    type="button"
                    onClick={() => setParentView('dashbor')}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/35 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                  >
                    <LayoutDashboard className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Buka Dashbor & Rekap Lengkap</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium text-center lg:text-right">
                    Rincian lengkap status masuk, pulang, keaktifan KBM & poin karakter
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PARENT VIEW: DASHBOR (STATUS MASUK, PULANG, KEAKTIFAN KBM, NILAI KARAKTER & REKAP TABEL) */
          <div className="space-y-6">
            {/* HEADER DASHBOR LENGKAP SISWA */}
            <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 backdrop-blur-2xl bg-white/80 border border-white/80 shadow-[0_12px_40px_rgba(31,38,135,0.08)] bg-gradient-to-br from-white/95 via-white/85 to-indigo-50/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setParentView('beranda')}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100/80 px-3 py-1.5 rounded-xl border border-indigo-200/80 transition-colors cursor-pointer mb-1 shadow-2xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali ke Beranda</span>
                  </button>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <LayoutDashboard className="w-6 h-6 text-emerald-600" />
                    Dashbor Kehadiran & Rekap Siswa
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Rincian absensi, keaktifan belajar & poin karakter untuk <strong className="text-slate-900">{targetStudent?.name || 'Siswa'}</strong> (Kelas {targetStudent?.className || '-'})
                  </p>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                  <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl px-3.5 py-2 text-xs shadow-xs">
                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500">Tanggal:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs font-mono"
                    />
                  </div>
                  {selectedDate !== todayStr && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayStr)}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-2xl transition-all cursor-pointer shadow-xs"
                    >
                      Hari Ini
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 4 KARTU STATUS PRESENSI (MASUK, PULANG, KEAKTIFAN KBM, NILAI KARAKTER) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Masuk */}
              <div className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-xl bg-white/80 border border-white/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status Masuk</span>
                  <CheckCircle2 className={`w-5 h-5 ${
                    childRecord?.status === 'HADIR' ? 'text-emerald-500' :
                    childRecord?.status === 'TERLAMBAT' ? 'text-amber-500' :
                    childRecord?.status === 'SAKIT' ? 'text-rose-500' :
                    childRecord?.status === 'IZIN' ? 'text-sky-500' : 'text-slate-400'
                  }`} />
                </div>
                <div className="space-y-1">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold border ${
                    childRecord?.status === 'HADIR' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                    childRecord?.status === 'TERLAMBAT' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                    childRecord?.status === 'SAKIT' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                    childRecord?.status === 'IZIN' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                    childRecord?.status === 'ALPA' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                    'bg-slate-100 text-slate-700 border-slate-300'
                  }`}>
                    {childRecord ? childRecord.status : 'BELUM ABSEN'}
                  </span>
                  <p className="text-xs text-slate-500 font-medium">
                    {childRecord ? `Pukul ${childRecord.time} WITA` : 'Menunggu scan masuk'}
                  </p>
                </div>
              </div>

              {/* Status Pulang */}
              <div className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-xl bg-white/80 border border-white/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status Pulang</span>
                  <Home className={`w-5 h-5 ${childRecord?.returnTime ? 'text-emerald-500' : 'text-slate-400'}`} />
                </div>
                <div className="space-y-1">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold border ${
                    childRecord?.returnTime 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}>
                    {childRecord?.returnTime ? 'SUDAH PULANG' : 'BELUM PULANG'}
                  </span>
                  <p className="text-xs text-slate-500 font-medium">
                    {childRecord?.returnTime ? `Pukul ${childRecord.returnTime} WITA` : 'KBM Masih Berlangsung'}
                  </p>
                </div>
              </div>

              {/* Predikat Keaktifan KBM */}
              <div className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-xl bg-white/80 border border-white/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Keaktifan KBM</span>
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="space-y-1">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold border ${overallKeaktifan.color}`}>
                    {overallKeaktifan.label}
                  </span>
                  <p className="text-xs text-slate-500 font-medium">
                    {totalKbmPertemuan} Pertemuan Terdata
                  </p>
                </div>
              </div>

              {/* Nilai Karakter */}
              <div className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-xl bg-white/80 border border-white/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nilai Karakter</span>
                  <Award className="w-5 h-5 text-amber-500" />
                </div>
                <div className="space-y-1">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold border ${characterPred.color}`}>
                    {characterPred.label}
                  </span>
                  <p className="text-xs text-slate-500 font-medium">
                    Poin Bersih: <strong className={netPoints >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{netPoints > 0 ? `+${netPoints}` : netPoints}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* 1. REKAP KEAKTIFAN SISWA (JURNAL KBM) */}
            <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/40">
                <div>
                  <h2 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-600" />
                    Rekap Keaktifan Siswa dalam Pembelajaran (KBM)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Laporan partisipasi & catatan aktivitas belajar putra/putri Anda ({targetStudent?.name || 'Siswa'}) dari jurnal mengajar guru.
                  </p>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-600">Predikat Keaktifan:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold border shadow-2xs ${overallKeaktifan.color}`}>
                    {overallKeaktifan.label}
                  </span>
                </div>
              </div>

              {/* Stat Summary Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="bg-white p-2.5 rounded-2xl border border-slate-200">
                  <p className="text-[11px] font-bold text-slate-500">Total KBM</p>
                  <p className="text-base font-black text-slate-800">{totalKbmPertemuan} Pertemuan</p>
                </div>
                <div className="bg-white p-2.5 rounded-2xl border border-emerald-200">
                  <p className="text-[11px] font-bold text-emerald-700">Sangat Aktif</p>
                  <p className="text-base font-black text-emerald-800">{sangAtifCount}</p>
                </div>
                <div className="bg-white p-2.5 rounded-2xl border border-blue-200">
                  <p className="text-[11px] font-bold text-blue-700">Cukup Aktif</p>
                  <p className="text-base font-black text-blue-800">{cukupAktifCount}</p>
                </div>
                <div className="bg-white p-2.5 rounded-2xl border border-amber-200">
                  <p className="text-[11px] font-bold text-amber-700">Kurang Aktif</p>
                  <p className="text-base font-black text-amber-800">{kurangAktifCount}</p>
                </div>
                <div className="bg-white p-2.5 rounded-2xl border border-rose-200 col-span-2 sm:col-span-1">
                  <p className="text-[11px] font-bold text-rose-700">Mengganggu / Absen</p>
                  <p className="text-base font-black text-rose-800">{menggangguCount + tidakHadirCount}</p>
                </div>
              </div>

              {/* Journal Entries Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/70 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Tanggal & Jam</th>
                      <th className="py-3 px-4">Mata Pelajaran</th>
                      <th className="py-3 px-4">Guru Pengampu</th>
                      <th className="py-3 px-4 text-center">Status Keaktifan</th>
                      <th className="py-3 px-4">Catatan Guru</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {childJournals.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                          Belum ada catatan jurnal keaktifan KBM untuk putra/putri Anda.
                        </td>
                      </tr>
                    ) : (
                      childJournals.map((j) => {
                        const att = j.studentAttendances?.find(a => 
                          a.studentId === targetStudent?.id || 
                          a.nisn === targetStudent?.nisn || 
                          a.studentName === targetStudent?.name
                        );
                        const status = att ? att.status : 'Sangat aktif';

                        let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                        if (status === 'Cukup aktif') badgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
                        else if (status === 'Kurang aktif') badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
                        else if (status === 'Mengganggu' || status === 'Tidak hadir di kelas') badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
                        else if (status === 'Sakit / Ijin' || status === 'Sakit/Ijin' || status === 'Sakit / Izin') badgeClass = 'bg-purple-100 text-purple-800 border-purple-300';

                        return (
                          <tr key={j.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono">
                              <span className="font-bold text-slate-800 block">{j.date}</span>
                              <span className="text-[10px] text-slate-400">Jam Ke: {j.periods?.join(', ') || '-'}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-indigo-700 block">{j.subject}</span>
                              <span className="text-[10px] text-slate-400">Materi: {j.material}</span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{j.teacherName}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border inline-block ${badgeClass}`}>
                                {status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 italic">
                              {att?.notes && att.notes.trim() !== '' ? att.notes : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. REKAP NILAI KARAKTER SISWA */}
            <div id="parent-character-recap" className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden scroll-mt-20">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/40">
                <div>
                  <h2 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-600" />
                    Rekap Nilai & Poin Karakter Siswa
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Catatan pembinaan karakter, poin kedisiplinan, dan penghargaan siswa ({targetStudent?.name || 'Siswa'}).
                  </p>
                </div>

                {/* Predikat Badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-600">Predikat Karakter:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold border shadow-2xs ${characterPred.color}`}>
                    {characterPred.label}
                  </span>
                </div>
              </div>

              {/* Score Overview Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white p-2.5 rounded-2xl border border-emerald-200">
                  <p className="text-[11px] font-bold text-emerald-700">Poin Positif (+)</p>
                  <p className="text-base font-black text-emerald-800">+{posPoints}</p>
                </div>
                <div className="bg-white p-2.5 rounded-2xl border border-rose-200">
                  <p className="text-[11px] font-bold text-rose-700">Poin Negatif (-)</p>
                  <p className="text-base font-black text-rose-800">-{negPoints}</p>
                </div>
                <div className="bg-white p-2.5 rounded-2xl border border-indigo-200">
                  <p className="text-[11px] font-bold text-indigo-700">Jumlah Nilai Net</p>
                  <p className={`text-base font-black ${netPoints >= 0 ? 'text-indigo-800' : 'text-rose-700'}`}>
                    {netPoints >= 0 ? `+${netPoints}` : netPoints}
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-2xl border border-amber-200 flex flex-col items-center justify-center">
                  <p className="text-[11px] font-bold text-amber-800">Predikat Rapor</p>
                  <span className={`mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold border ${characterPred.color}`}>
                    {characterPred.label}
                  </span>
                </div>
              </div>

              {/* Character Logs Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/70 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Tanggal & Waktu</th>
                      <th className="py-3 px-4">Perilaku / Karakter</th>
                      <th className="py-3 px-4 text-center">Jenis & Poin</th>
                      <th className="py-3 px-4">Guru Penilai</th>
                      <th className="py-3 px-4">Catatan & Foto Bukti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {childCharacterLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                          Belum ada riwayat penilaian karakter untuk putra/putri Anda.
                        </td>
                      </tr>
                    ) : (
                      childCharacterLogs.map((log) => {
                        const isHighlighted = log.id === highlightedCharLogId;
                        return (
                        <tr 
                          key={log.id} 
                          id={`parent-char-log-${log.id}`} 
                          className={`transition-colors ${
                            isHighlighted 
                              ? 'bg-amber-100/80 font-bold ring-2 ring-amber-400' 
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{log.timestamp || log.date}</span>
                              {isHighlighted && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-600 text-white animate-pulse">
                                  Dipilih
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-extrabold text-slate-900">
                            {log.traitName}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {log.traitType === 'POSITIF' ? (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1">
                                <ThumbsUp className="w-3 h-3 text-emerald-600" />
                                +{log.points} Poin
                              </span>
                            ) : (
                              <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                -{log.points} Poin
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {log.evaluatorName}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600 italic">
                                {log.notes && log.notes.trim() !== '' ? log.notes : '-'}
                              </span>
                              {log.photoProofUrl && (
                                <button
                                  onClick={() => setSelectedImage(log.photoProofUrl || null)}
                                  className="p-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer text-[10px] font-bold flex items-center gap-1 shrink-0"
                                >
                                  <Image className="w-3 h-3" /> Foto Bukti
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      ) : (
        /* TEACHER & ADMIN HEADER */
        <>
          {/* Title & Filter Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              {/* Teacher Account Badge above Dashboard Title */}
              {currentRole === 'TEACHER' && (
                <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl text-xs font-bold text-indigo-900 mb-2 shadow-2xs">
                  <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Akun Guru: <strong className="font-extrabold text-indigo-950">{userSession?.displayName || 'Guru Terdaftar'}</strong></span>
                  {userSession?.nipOrNisn && (
                    <span className="text-[10px] text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md font-mono font-bold">
                      NIP: {userSession.nipOrNisn}
                    </span>
                  )}
                </div>
              )}

              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <Zap className="w-6 h-6 text-indigo-600" />
                Dasbor Kehadiran Siswa {selectedDate === todayStr ? 'Hari Ini' : ''}
              </h1>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                <span>Tanggal: <strong className="font-semibold text-slate-700">{displayDateFormatted}</strong></span>
                {selectedDate !== todayStr && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                  >
                    Reset Ke Hari Ini
                  </button>
                )}
              </p>
            </div>

            {/* Search & Multi Filters Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari siswa / NISN..."
                  className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-3 py-2 w-36 sm:w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium"
                />
              </div>

              {/* Date Picker Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-sm">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Tanggal:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs font-mono"
                />
              </div>

              {/* Class Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-sm">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">Semua Kelas</option>
                  {sortedClasses.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Masuk Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <select
                  value={selectedEntryStatusFilter}
                  onChange={(e) => setSelectedEntryStatusFilter(e.target.value)}
                  className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">Status Masuk: Semua</option>
                  <option value="HADIR">Status Masuk: Hadir (Tepat Waktu)</option>
                  <option value="TERLAMBAT">Status Masuk: Terlambat</option>
                  <option value="SAKIT">Status Masuk: Sakit</option>
                  <option value="IZIN">Status Masuk: Izin</option>
                  <option value="ALPA">Status Masuk: Alpa (Tanpa Keterangan)</option>
                  <option value="BELUM_ABSEN">Status Masuk: Belum Absen</option>
                </select>
              </div>

              {/* Status Pulang Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-sm">
                <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <select
                  value={selectedReturnStatusFilter}
                  onChange={(e) => setSelectedReturnStatusFilter(e.target.value)}
                  className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">Status Pulang: Semua</option>
                  <option value="PULANG">Status Pulang: Sudah Pulang</option>
                  <option value="BELUM_PULANG">Status Pulang: Belum Pulang</option>
                </select>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClassFilter('ALL');
                    setSelectedEntryStatusFilter('ALL');
                    setSelectedReturnStatusFilter('ALL');
                    setSearchQuery('');
                    setSelectedDate(todayStr);
                  }}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                  title="Reset Semua Filter"
                >
                  <X className="w-3.5 h-3.5" />
                  Reset Filter
                </button>
              )}

              {/* KHUSUS ADMIN: Tombol Ubah Status Masuk Massal */}
              {currentRole === 'ADMIN' && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBulkAlpaModal(true)}
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-600/25 active:scale-95 shrink-0"
                    title="Ubah Status Masuk Siswa secara Massal (Khusus Admin)"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-indigo-200 shrink-0" />
                    <span>Ubah Status Masuk Massal</span>
                    {countAlpa > 0 && (
                      <span className="bg-white text-indigo-700 text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-2xs">
                        {countAlpa}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBulkReturnModal(true)}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-emerald-600/25 active:scale-95 shrink-0"
                    title="Ubah Status Pulang Siswa secara Massal (Khusus Admin)"
                  >
                    <LogOut className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                    <span>Ubah Status Pulang Massal</span>
                    {countBelumPulang > 0 && (
                      <span className="bg-white text-emerald-700 text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-2xs">
                        {countBelumPulang}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Overview Stat Cards Grid for Admin / Teacher */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
            {/* Total Siswa */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide">Total Siswa</span>
                <Users className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-3xl font-black text-indigo-600">{totalStudentsCount}</div>
              <p className="text-[11px] text-indigo-500 font-medium mt-1">Terdaftar</p>
            </div>

            {/* Hadir Tepat Waktu */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide">Tepat Waktu</span>
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-black text-blue-600">{countHadir}</div>
              <p className="text-[11px] text-blue-500 font-medium mt-1">Scan &lt; 07:15</p>
            </div>

            {/* Terlambat */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide">Terlambat</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-black text-amber-500">{countTerlambat}</div>
              <p className="text-[11px] text-amber-600 font-medium mt-1">Scan &gt; 07:15</p>
            </div>

            {/* Sakit */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide">Sakit</span>
                <HeartPulse className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-3xl font-black text-rose-500">{countSakit}</div>
              <p className="text-[11px] text-rose-500 font-medium mt-1">Surat Dokter</p>
            </div>

            {/* Izin */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide">Izin</span>
                <FileText className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-3xl font-black text-sky-500">{countIzin}</div>
              <p className="text-[11px] text-sky-600 font-medium mt-1">Surat Ortu</p>
            </div>

            {/* Sudah Pulang */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide">Sudah Pulang</span>
                <Home className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-600">{countPulang}</div>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">Scan Pulang</p>
            </div>

            {/* Kehadiran Rate */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide">% Kehadiran</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-black text-emerald-600">{attendanceRate}%</div>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">Rata-rata Hari Ini</p>
            </div>
          </div>
        </>
      )}

      {/* RENDER CONTENT BASED ON USER ROLE */}
      {currentRole !== 'PARENT' && (
        /* ADMIN / TEACHER / PIKET VIEW: TABLE OF TODAY'S STUDENT ATTENDANCE */
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-800">
              Daftar Absensi Siswa ({filteredStudents.length} Siswa)
            </h2>
            <span className="text-xs text-indigo-700 bg-indigo-50 font-bold px-3 py-1 rounded-full border border-indigo-100">
              {dateRecords.length} Sudah Melakukan Scan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/70 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-5">Siswa</th>
                  <th className="py-3.5 px-5">Kelas</th>
                  <th className="py-3.5 px-5">Jam Masuk</th>
                  <th className="py-3.5 px-5">Status Masuk</th>
                  <th className="py-3.5 px-5">Status Pulang</th>
                  <th className="py-3.5 px-5">Wali Murid</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Filter className="w-8 h-8 text-slate-300" />
                        <p className="font-bold text-slate-600 text-xs">Tidak ada data siswa yang cocok dengan filter yang dipilih.</p>
                        <p className="text-[11px] text-slate-400">Coba ubah tanggal, kata kunci pencarian, kelas, atau status absensi.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => {
                    const rec = studentDateStatusMap.get(student.id) || (student.nisn ? studentDateStatusMap.get(student.nisn) : undefined);
                    const status = rec ? rec.status : 'BELUM_ABSEN';

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* Student Info */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <img
                              src={student.photoUrl || (student.gender === 'P'
                                ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                                : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80')}
                              alt={student.name}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = student.gender === 'P'
                                  ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                                  : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80';
                              }}
                              className="w-9 h-9 rounded-xl object-cover ring-2 ring-indigo-100 shadow-sm bg-slate-100"
                            />
                            <div>
                              <p className="font-bold text-slate-900">{student.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">NISN: {student.nisn}</p>
                            </div>
                          </div>
                        </td>

                        {/* Class */}
                        <td className="py-3.5 px-5 font-bold text-indigo-700">
                          {student.className}
                        </td>

                        {/* Scan Time */}
                        <td className="py-3.5 px-5 font-mono">
                          {rec && rec.time !== '-' ? (
                            <span className="text-slate-800 font-bold">{rec.time} WITA</span>
                          ) : (
                            <span className="text-slate-400 italic">Belum Scan</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-5">
                          {status === 'HADIR' && (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3" />
                              HADIR
                            </span>
                          )}
                          {status === 'TERLAMBAT' && (
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                              <Clock className="w-3 h-3" />
                              TERLAMBAT
                            </span>
                          )}
                          {status === 'SAKIT' && (
                            <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                              <HeartPulse className="w-3 h-3" />
                              SAKIT
                            </span>
                          )}
                          {status === 'IZIN' && (
                            <span className="bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                              <FileText className="w-3 h-3" />
                              IZIN
                            </span>
                          )}
                          {status === 'ALPA' && (
                            <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              ALPA
                            </span>
                          )}
                          {status === 'BELUM_ABSEN' && (
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                              <UserX className="w-3 h-3 text-slate-500" />
                              BELUM ABSEN
                            </span>
                          )}
                        </td>

                      {/* Return Status (Status Pulang) */}
                      <td className="py-3.5 px-5 font-mono">
                        {rec && (rec.returnTime || rec.returnStatus === 'PULANG') ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                            <Home className="w-3 h-3 text-emerald-600" />
                            {rec.returnTime ? `${rec.returnTime} WITA` : 'SUDAH PULANG'}
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-lg font-semibold text-[10px] inline-flex items-center gap-1">
                            Belum Pulang
                          </span>
                        )}
                      </td>

                      {/* Parent Contact */}
                      <td className="py-3.5 px-5">
                        <p className="text-slate-700 font-medium">{student.parentName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{student.parentPhone}</p>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit Status Button (for Admin & Teacher) */}
                          {currentRole !== 'PARENT' && (
                            <button
                              onClick={() => handleOpenEdit(rec, student)}
                              title="Ubah Status Kehadiran"
                              className="p-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Attendance Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3">
              Ubah Status Kehadiran: {editingRecord.studentName}
            </h3>

            <form onSubmit={handleSaveStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pilih Status Kehadiran Masuk
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as AttendanceRecord['status'])}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="HADIR">HADIR (Tepat Waktu)</option>
                  <option value="TERLAMBAT">TERLAMBAT</option>
                  <option value="SAKIT">SAKIT</option>
                  <option value="IZIN">IZIN</option>
                  <option value="ALPA">ALPA (Tanpa Keterangan)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Jam Masuk (Format HH:MM)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Kosongkan jika Belum Scan</span>
                </label>
                <input
                  type="text"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  placeholder="Contoh: 06:45 atau kosongkan untuk 'Belum Scan'"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jam Pulang (Format HH:MM, Kosongkan jika belum pulang)
                </label>
                <input
                  type="text"
                  value={editReturnTime}
                  onChange={(e) => setEditReturnTime(e.target.value)}
                  placeholder="Contoh: 14:00"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Contoh: Surat dokter terlampir..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-full cursor-pointer transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-4 text-center">
              <p className="text-xs font-extrabold text-slate-700 mb-2">Foto Bukti Penilaian Karakter</p>
              <img
                src={selectedImage}
                alt="Bukti Foto Karakter"
                className="w-full h-auto max-h-[70vh] object-contain rounded-2xl border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Kelola & Hapus Alpa Massal (Khusus Admin) */}
      {currentRole === 'ADMIN' && showBulkAlpaModal && (
        <BulkAlpaManagementModal
          isOpen={showBulkAlpaModal}
          onClose={() => setShowBulkAlpaModal(false)}
          students={students}
          classes={classes}
          attendanceRecords={attendanceRecords}
          initialDate={selectedDate}
          userSession={userSession}
          onDeleteRecords={(recordIds) => {
            if (onDeleteAttendanceRecords) {
              onDeleteAttendanceRecords(recordIds);
            }
          }}
          onBulkUpdateStatus={(updates) => {
            if (onBulkUpdateAttendanceRecords) {
              onBulkUpdateAttendanceRecords(updates);
            }
          }}
        />
      )}

      {/* Modal Kelola & Ubah Status Pulang Massal (Khusus Admin) */}
      {currentRole === 'ADMIN' && showBulkReturnModal && (
        <BulkReturnManagementModal
          isOpen={showBulkReturnModal}
          onClose={() => setShowBulkReturnModal(false)}
          students={students}
          classes={classes}
          attendanceRecords={attendanceRecords}
          initialDate={selectedDate}
          userSession={userSession}
          onBulkUpdateReturnStatus={(updates) => {
            if (onBulkUpdateReturnStatus) {
              onBulkUpdateReturnStatus(updates);
            }
          }}
        />
      )}

    </div>
  );
};
