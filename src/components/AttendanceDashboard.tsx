import React, { useState } from 'react';
import { 
  AttendanceRecord, 
  Student, 
  SchoolClass, 
  UserRole,
  LearningJournal,
  CharacterTrait,
  StudentCharacterLog,
  CharacterPredicateSettings,
  UserSession
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
  Send,
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
  GraduationCap
} from 'lucide-react';
import { createWhatsAppUrl } from '../lib/exportUtils';

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
  currentRole: UserRole;
  selectedChildId?: string;
  learningJournals?: LearningJournal[];
  traits?: CharacterTrait[];
  characterLogs?: StudentCharacterLog[];
  predicateSettings?: CharacterPredicateSettings;
  userSession?: UserSession | null;
}

export const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({
  students,
  classes,
  attendanceRecords,
  onUpdateStatus,
  currentRole,
  selectedChildId,
  learningJournals = [],
  traits = [],
  characterLogs = [],
  predicateSettings = { minA: 30, minB: 10, minC: 0, minD: -20, minE: -50 },
  userSession
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedEntryStatusFilter, setSelectedEntryStatusFilter] = useState<string>('ALL');
  const [selectedReturnStatusFilter, setSelectedReturnStatusFilter] = useState<string>('ALL');

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceRecord['status']>('HADIR');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editReturnTime, setEditReturnTime] = useState<string>('');
  const [editReturnStatus, setEditReturnStatus] = useState<AttendanceRecord['returnStatus']>('PULANG');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const sortedClasses = [...classes].sort((a, b) =>
    a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
  );

  // Filter records for selected date
  const dateRecords = attendanceRecords.filter(r => r.date === selectedDate);

  const studentDateStatusMap = new Map<string, AttendanceRecord>();
  dateRecords.forEach(r => {
    studentDateStatusMap.set(r.studentId, r);
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
      const rec = studentDateStatusMap.get(std.id);
      const status = rec ? rec.status : 'ALPA';
      return status === selectedEntryStatusFilter;
    });
  }

  // Filter by Return Status (Status Pulang)
  if (selectedReturnStatusFilter !== 'ALL') {
    filteredStudents = filteredStudents.filter(std => {
      const rec = studentDateStatusMap.get(std.id);
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
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        status: 'HADIR',
        method: 'MANUAL',
        scannedBy: 'Guru Piket',
        parentNotified: false
      };
      setEditingRecord(newRec);
      setEditStatus('HADIR');
      setEditNotes('');
      setEditReturnTime('');
      setEditReturnStatus('PULANG');
    }
  };

  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      onUpdateStatus(
        editingRecord.id, 
        editStatus, 
        editNotes, 
        editReturnTime.trim() ? editReturnTime.trim() : undefined,
        editReturnTime.trim() ? editReturnStatus : undefined,
        editingRecord
      );
      setEditingRecord(null);
    }
  };

  const hasActiveFilters = selectedClassFilter !== 'ALL' || selectedEntryStatusFilter !== 'ALL' || selectedReturnStatusFilter !== 'ALL' || searchQuery.trim() !== '' || selectedDate !== todayStr;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
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
          {currentRole !== 'PARENT' && (
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
          )}

          {/* Status Masuk Filter */}
          {currentRole !== 'PARENT' && (
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
                <option value="ALPA">Status Masuk: Belum Absen / Alpa</option>
              </select>
            </div>
          )}

          {/* Status Pulang Filter */}
          {currentRole !== 'PARENT' && (
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
          )}

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
        </div>
      </div>

      {/* Overview Stat Cards Grid */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${currentRole === 'PARENT' ? 'lg:grid-cols-6' : 'lg:grid-cols-7'} gap-3 sm:gap-4`}>
        
        {/* Total Siswa (Hidden for Parent role) */}
        {currentRole !== 'PARENT' && (
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide">Total Siswa</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-3xl font-black text-indigo-600">{totalStudentsCount}</div>
            <p className="text-[11px] text-indigo-500 font-medium mt-1">Terdaftar</p>
          </div>
        )}

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

      {/* RENDER CONTENT BASED ON USER ROLE */}
      {currentRole === 'PARENT' ? (
        /* PARENT VIEW: REKAP KEAKTIFAN SISWA & REKAP NILAI KARAKTER */
        <div className="space-y-6">
          
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
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
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
                    childCharacterLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {log.timestamp || log.date}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
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
                    const rec = studentDateStatusMap.get(student.id);
                  const status = rec ? rec.status : 'ALPA';

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* Student Info */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={student.photoUrl}
                            alt={student.name}
                            className="w-9 h-9 rounded-xl object-cover ring-2 ring-indigo-100 shadow-sm"
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
                          <span className="bg-pink-100 text-pink-800 border border-pink-200 px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                            <XCircle className="w-3 h-3 text-pink-600" />
                            BELUM ABSEN / ALPA
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
                          {/* WA Alert Button */}
                          <a
                            href={createWhatsAppUrl(
                              student.parentPhone,
                              `Yth. Bpk/Ibu ${student.parentName}, memberitahukan bahwa status presensi ${student.name} (${student.className}) hari ini adalah: ${status}.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Kirim Notifikasi WA"
                            className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </a>

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

    </div>
  );
};
