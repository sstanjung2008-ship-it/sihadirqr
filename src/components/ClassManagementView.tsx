import React, { useState, useMemo } from 'react';
import { SchoolClass, Student, Teacher, LearningJournal, SchoolProfile, StudentCharacterLog, CharacterTrait, CharacterPredicateSettings, AttendanceRecord } from '../types';
import { 
  Building2, Plus, Edit, Trash2, Users, UserCheck, 
  BookOpen, ArrowLeft, Download, Search, Filter, 
  Award, AlertCircle, CheckCircle2, Eye, Sparkles, FileText, Calendar, X, Activity, MessageSquare,
  ShieldAlert, FileSpreadsheet, TrendingUp, TrendingDown, Star, AlertTriangle, ShieldCheck,
  CalendarCheck, Clock, UserX, CheckCheck, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { 
  exportClassParticipationPdf, 
  exportCharacterPointsPdf, 
  exportCharacterPointsExcel, 
  exportLearningJournalPdf,
  exportAttendancePdf,
  exportAttendanceExcel,
  exportMonthlyAttendanceMatrixPdf,
  exportMonthlyAttendanceMatrixExcel
} from '../lib/exportUtils';

const INDONESIAN_MONTH_OPTIONS = [
  { value: 1, name: 'Januari' },
  { value: 2, name: 'Februari' },
  { value: 3, name: 'Maret' },
  { value: 4, name: 'April' },
  { value: 5, name: 'Mei' },
  { value: 6, name: 'Juni' },
  { value: 7, name: 'Juli' },
  { value: 8, name: 'Agustus' },
  { value: 9, name: 'September' },
  { value: 10, name: 'Oktober' },
  { value: 11, name: 'November' },
  { value: 12, name: 'Desember' }
];

interface ClassManagementViewProps {
  classes: SchoolClass[];
  students: Student[];
  teachers: Teacher[];
  attendanceRecords?: AttendanceRecord[];
  journals?: LearningJournal[];
  characterLogs?: StudentCharacterLog[];
  traits?: CharacterTrait[];
  predicateSettings?: CharacterPredicateSettings;
  schoolProfile?: SchoolProfile;
  onAddClass: (newClass: SchoolClass) => void;
  onUpdateClass: (updatedClass: SchoolClass) => void;
  onDeleteClass: (classId: string) => void;
}

export const ClassManagementView: React.FC<ClassManagementViewProps> = ({
  classes,
  students,
  teachers,
  attendanceRecords = [],
  journals = [],
  characterLogs = [],
  traits = [],
  predicateSettings = { minA: 30, minB: 10, minC: 0, minD: -20, minE: -50 },
  schoolProfile,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [classToDelete, setClassToDelete] = useState<SchoolClass | null>(null);

  // Teachers sorted alphabetically ascending by name (A-Z)
  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' }));
  }, [teachers]);

  // Class Selection for Detail / Recap View
  const [selectedClassForRecap, setSelectedClassForRecap] = useState<SchoolClass | null>(null);
  const [recapSubTab, setRecapSubTab] = useState<'REKAP_PRESENSI' | 'REKAP_KARAKTER' | 'PER_SISWA' | 'JURNAL_KBM'>('REKAP_PRESENSI');

  // Search & Filter state for Attendance Recap
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [attendanceDateRange, setAttendanceDateRange] = useState<'TODAY' | '7DAYS' | '30DAYS' | 'MONTH' | 'ALL' | 'CUSTOM'>('MONTH');
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedAttendanceYear, setSelectedAttendanceYear] = useState<number>(() => new Date().getFullYear());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);

  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Student Attendance Log Detail Modal state
  const [selectedStudentAttendanceModal, setSelectedStudentAttendanceModal] = useState<{
    student: Student;
    records: AttendanceRecord[];
    hadir: number;
    terlambat: number;
    pulang: number;
    izin: number;
    sakit: number;
    alpa: number;
    pct: number;
  } | null>(null);

  // Search & Filter state for KBM Participation
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Search & Filter state for Character Recap
  const [characterSearchQuery, setCharacterSearchQuery] = useState('');
  const [characterPredicateFilter, setCharacterPredicateFilter] = useState('ALL');

  // Student KBM Detail Modal state
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<{
    student: Student;
    history: { journal: LearningJournal; status: string; notes?: string }[];
  } | null>(null);

  // Student Character Log Detail Modal state
  const [selectedStudentCharacterModal, setSelectedStudentCharacterModal] = useState<{
    student: Student;
    logs: StudentCharacterLog[];
    posPoints: number;
    negPoints: number;
    netPoints: number;
  } | null>(null);

  const [formData, setFormData] = useState({
    grade: 'Kelas 7',
    name: '7-C',
    homeroomTeacher: '',
  });

  const getHomeroomTeacherName = (c: SchoolClass) => {
    if (c.homeroomTeacher && c.homeroomTeacher !== 'Belum Ditentukan') {
      return c.homeroomTeacher;
    }
    const teacher = teachers.find(
      (t) =>
        t.additionalDuty === 'WALI_KELAS' &&
        (t.homeroomClassId === c.id ||
          t.homeroomClassName === c.name ||
          t.homeroomClassName === `${c.grade} ${c.name}` ||
          t.homeroomClassName === `${c.grade}-${c.name}`)
    );
    if (teacher) {
      return teacher.name;
    }
    return 'Belum Ditentukan';
  };

  // Predicate evaluation helper
  const getCharacterPredicate = (netPoints: number) => {
    const minA = predicateSettings?.minA ?? 30;
    const minB = predicateSettings?.minB ?? 10;
    const minC = predicateSettings?.minC ?? 0;
    const minD = predicateSettings?.minD ?? -20;
    const minE = predicateSettings?.minE ?? -50;

    if (netPoints >= minA) return { code: 'A', label: 'Sangat Baik (A)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' };
    if (netPoints >= minB) return { code: 'B', label: 'Baik (B)', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', badgeBg: 'bg-blue-100 text-blue-800 border-blue-300 font-bold' };
    if (netPoints >= minC) return { code: 'C', label: 'Cukup (C)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', badgeBg: 'bg-amber-100 text-amber-800 border-amber-300 font-bold' };
    if (netPoints >= minD) return { code: 'D', label: 'Perlu Pembinaan (D)', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', badgeBg: 'bg-orange-100 text-orange-800 border-orange-300 font-bold' };
    if (netPoints >= minE) return { code: 'E', label: 'Tidak Naik Kelas (E)', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', badgeBg: 'bg-rose-100 text-rose-800 border-rose-300 font-bold' };
    return { code: 'F', label: 'Pindah Sekolah (F)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', badgeBg: 'bg-purple-100 text-purple-800 border-purple-300 font-bold' };
  };

  const handleOpenAdd = () => {
    setEditingClass(null);
    setFormData({
      grade: 'Kelas 7',
      name: '7-C',
      homeroomTeacher: teachers[0]?.name || '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: SchoolClass) => {
    setEditingClass(c);
    setFormData({
      grade: c.grade,
      name: c.name,
      homeroomTeacher: c.homeroomTeacher || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedHomeroom = formData.homeroomTeacher || 'Belum Ditentukan';

    if (editingClass) {
      onUpdateClass({
        ...editingClass,
        grade: formData.grade,
        name: formData.name,
        homeroomTeacher: selectedHomeroom,
      });
    } else {
      onAddClass({
        id: `class-${Date.now()}`,
        grade: formData.grade,
        name: formData.name,
        homeroomTeacher: selectedHomeroom,
      });
    }
    setIsModalOpen(false);
  };

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      const gradeCompare = (a.grade || '').localeCompare(b.grade || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (gradeCompare !== 0) return gradeCompare;

      return (a.name || '').localeCompare(b.name || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [classes]);

  // Data for currently selected class (sorted Ascending by name)
  const selectedClassStudents = useMemo(() => {
    if (!selectedClassForRecap) return [];
    return students
      .filter(s => s.classId === selectedClassForRecap.id || s.className === selectedClassForRecap.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }));
  }, [students, selectedClassForRecap]);

  const selectedClassJournals = useMemo(() => {
    if (!selectedClassForRecap) return [];
    return journals.filter(j => j.classId === selectedClassForRecap.id || j.className === selectedClassForRecap.name);
  }, [journals, selectedClassForRecap]);

  // Participation Stats for currently selected class
  const classParticipationStats = useMemo(() => {
    let sangatAktif = 0;
    let cukupAktif = 0;
    let kurangAktif = 0;
    let mengganggu = 0;
    let tidakHadir = 0;

    selectedClassJournals.forEach(j => {
      j.studentAttendances?.forEach(att => {
        if (att.status === 'Sangat aktif') sangatAktif++;
        else if (att.status === 'Cukup aktif') cukupAktif++;
        else if (att.status === 'Kurang aktif') kurangAktif++;
        else if (att.status === 'Mengganggu') mengganggu++;
        else if (att.status === 'Tidak hadir di kelas') tidakHadir++;
      });
    });

    const totalEvaluations = sangatAktif + cukupAktif + kurangAktif + mengganggu + tidakHadir;

    return {
      sangatAktif,
      cukupAktif,
      kurangAktif,
      mengganggu,
      tidakHadir,
      totalEvaluations
    };
  }, [selectedClassJournals]);

  // Student level KBM participation calculations
  const studentRecapData = useMemo(() => {
    if (!selectedClassForRecap) return [];

    return selectedClassStudents.map(std => {
      let sangatAktif = 0;
      let cukupAktif = 0;
      let kurangAktif = 0;
      let mengganggu = 0;
      let tidakHadir = 0;
      let totalPertemuan = 0;
      let lastNotes = '';
      const history: { journal: LearningJournal; status: string; notes?: string }[] = [];

      selectedClassJournals.forEach(j => {
        const match = j.studentAttendances?.find(a => a.studentId === std.id || a.nisn === std.nisn || a.studentName === std.name);
        if (match) {
          totalPertemuan++;
          if (match.status === 'Sangat aktif') sangatAktif++;
          else if (match.status === 'Cukup aktif') cukupAktif++;
          else if (match.status === 'Kurang aktif') kurangAktif++;
          else if (match.status === 'Mengganggu') mengganggu++;
          else if (match.status === 'Tidak hadir di kelas') tidakHadir++;

          if (match.notes && match.notes.trim() !== '') {
            lastNotes = match.notes;
          }

          history.push({
            journal: j,
            status: match.status,
            notes: match.notes
          });
        }
      });

      let predikat = 'Sangat Aktif';
      let predikatColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

      if (totalPertemuan === 0) {
        predikat = 'Belum Ada Data';
        predikatColor = 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      } else if (mengganggu > 0 || kurangAktif > 2) {
        predikat = 'Perlu Perhatian';
        predikatColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      } else if (sangatAktif >= cukupAktif && sangatAktif >= kurangAktif) {
        predikat = 'Sangat Aktif';
        predikatColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      } else if (cukupAktif >= kurangAktif) {
        predikat = 'Cukup Aktif';
        predikatColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      } else {
        predikat = 'Kurang Aktif';
        predikatColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      }

      return {
        student: std,
        totalPertemuan,
        sangatAktif,
        cukupAktif,
        kurangAktif,
        mengganggu,
        tidakHadir,
        predikat,
        predikatColor,
        lastNotes,
        history
      };
    });
  }, [selectedClassStudents, selectedClassJournals, selectedClassForRecap]);

  // Filtered student list for KBM
  const filteredStudentRecapData = useMemo(() => {
    return studentRecapData.filter(item => {
      const q = studentSearchQuery.toLowerCase();
      const matchQuery = item.student.name.toLowerCase().includes(q) || (item.student.nisn && item.student.nisn.includes(q));
      if (!matchQuery) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PERLU_PERHATIAN') return item.predikat === 'Perlu Perhatian' || item.kurangAktif > 0 || item.mengganggu > 0;
      if (statusFilter === 'Sangat aktif') return item.sangatAktif > 0;
      if (statusFilter === 'Cukup aktif') return item.cukupAktif > 0;
      if (statusFilter === 'Kurang aktif') return item.kurangAktif > 0;
      if (statusFilter === 'Mengganggu') return item.mengganggu > 0;

      return true;
    });
  }, [studentRecapData, studentSearchQuery, statusFilter]);

  // --- CHARACTER SCORE RECAP CALCULATIONS FOR SELECTED CLASS ---
  const classCharacterRecapPerStudent = useMemo(() => {
    if (!selectedClassForRecap) return [];

    return selectedClassStudents.map(std => {
      const stdLogs = characterLogs.filter(l => l.studentId === std.id);
      const posLogs = stdLogs.filter(l => l.traitType === 'POSITIF');
      const negLogs = stdLogs.filter(l => l.traitType === 'NEGATIF');

      const posPoints = posLogs.reduce((sum, item) => sum + (item.points || 0), 0);
      const negPoints = negLogs.reduce((sum, item) => sum + (item.points || 0), 0);
      const netPoints = posPoints - negPoints;

      const pred = getCharacterPredicate(netPoints);
      const lastLog = stdLogs.length > 0 ? stdLogs[stdLogs.length - 1] : null;

      return {
        student: std,
        posLogs,
        negLogs,
        posPoints,
        negPoints,
        netPoints,
        pred,
        totalLogs: stdLogs.length,
        lastLog,
        allLogs: stdLogs
      };
    });
  }, [selectedClassStudents, characterLogs, selectedClassForRecap, predicateSettings]);

  // Class character statistics overview
  const classCharacterOverviewStats = useMemo(() => {
    if (classCharacterRecapPerStudent.length === 0) {
      return {
        totalPosPoints: 0,
        totalNegPoints: 0,
        avgNetPoints: 0,
        countA: 0,
        countB: 0,
        countC: 0,
        countD: 0,
        countE: 0,
        countF: 0
      };
    }

    let totalPosPoints = 0;
    let totalNegPoints = 0;
    let totalNetPoints = 0;
    let countA = 0;
    let countB = 0;
    let countC = 0;
    let countD = 0;
    let countE = 0;
    let countF = 0;

    classCharacterRecapPerStudent.forEach(item => {
      totalPosPoints += item.posPoints;
      totalNegPoints += item.negPoints;
      totalNetPoints += item.netPoints;

      if (item.pred.code === 'A') countA++;
      else if (item.pred.code === 'B') countB++;
      else if (item.pred.code === 'C') countC++;
      else if (item.pred.code === 'D') countD++;
      else if (item.pred.code === 'E') countE++;
      else if (item.pred.code === 'F') countF++;
    });

    const avgNetPoints = Math.round((totalNetPoints / classCharacterRecapPerStudent.length) * 10) / 10;

    return {
      totalPosPoints,
      totalNegPoints,
      avgNetPoints,
      countA,
      countB,
      countC,
      countD,
      countE,
      countF
    };
  }, [classCharacterRecapPerStudent]);

  // Filtered character recap data for selected class
  const filteredCharacterRecapData = useMemo(() => {
    return classCharacterRecapPerStudent.filter(item => {
      const q = characterSearchQuery.toLowerCase();
      const matchQuery = item.student.name.toLowerCase().includes(q) || (item.student.nisn && item.student.nisn.includes(q));
      if (!matchQuery) return false;

      if (characterPredicateFilter === 'ALL') return true;
      return item.pred.code === characterPredicateFilter;
    });
  }, [classCharacterRecapPerStudent, characterSearchQuery, characterPredicateFilter]);

  // Helper function to get summary character score for ANY class card in the main list
  const getClassCharacterSummary = (classId: string, className: string) => {
    const classStd = students.filter(s => s.classId === classId || s.className === className);
    if (classStd.length === 0) return { avgScore: 0, countA: 0, countB: 0, countC: 0, countD: 0, countE: 0, countF: 0, totalLogs: 0 };

    const classStdIds = new Set(classStd.map(s => s.id));
    const logs = characterLogs.filter(l => classStdIds.has(l.studentId));

    let sumNet = 0;
    let countA = 0, countB = 0, countC = 0, countD = 0, countE = 0, countF = 0;

    classStd.forEach(std => {
      const stdLogs = logs.filter(l => l.studentId === std.id);
      const posPoints = stdLogs.filter(l => l.traitType === 'POSITIF').reduce((s, i) => s + (i.points || 0), 0);
      const negPoints = stdLogs.filter(l => l.traitType === 'NEGATIF').reduce((s, i) => s + (i.points || 0), 0);
      const net = posPoints - negPoints;
      sumNet += net;

      const pred = getCharacterPredicate(net);
      if (pred.code === 'A') countA++;
      else if (pred.code === 'B') countB++;
      else if (pred.code === 'C') countC++;
      else if (pred.code === 'D') countD++;
      else if (pred.code === 'E') countE++;
      else if (pred.code === 'F') countF++;
    });

    const avgScore = Math.round((sumNet / classStd.length) * 10) / 10;
    return { avgScore, countA, countB, countC, countD, countE, countF, totalLogs: logs.length };
  };

  const handleDownloadClassPdf = async () => {
    if (!selectedClassForRecap) return;
    const defaultProfile: SchoolProfile = schoolProfile || {
      name: 'SMP NEGERI 1 KELU',
      npsn: '50102030',
      address: 'Jl. Pendidikan No. 1, Kabupaten',
      principalName: 'Drs. H. Ahmad Fauzi, M.Pd.',
      principalNip: '196805121994031005',
      district: 'Klu',
      regency: 'Kabupaten Lombok Utara',
      phone: '081234567890',
      email: 'info@sekolah.sch.id',
      website: 'www.sekolah.sch.id',
      regencyLogo: '',
      schoolLogo: ''
    };

    await exportClassParticipationPdf(
      defaultProfile,
      selectedClassForRecap,
      selectedClassStudents,
      selectedClassJournals
    );
  };

  const handleDownloadJournalPdf = async () => {
    if (!selectedClassForRecap) return;
    const defaultProfile: SchoolProfile = schoolProfile || {
      name: 'SMP NEGERI 1 KELU',
      npsn: '50102030',
      address: 'Jl. Pendidikan No. 1, Kabupaten',
      principalName: 'Drs. H. Ahmad Fauzi, M.Pd.',
      principalNip: '196805121994031005',
      district: 'Klu',
      regency: 'Kabupaten Lombok Utara',
      phone: '081234567890',
      email: 'info@sekolah.sch.id',
      website: 'www.sekolah.sch.id',
      regencyLogo: '',
      schoolLogo: ''
    };

    const homeroomName = getHomeroomTeacherName(selectedClassForRecap);

    await exportLearningJournalPdf(
      defaultProfile,
      selectedClassJournals,
      `Jurnal KBM Kelas ${selectedClassForRecap.name}`,
      selectedClassForRecap.name,
      null,
      { name: homeroomName }
    );
  };

  const handleExportCharacterPdf = async () => {
    if (!selectedClassForRecap) return;
    const defaultProfile: SchoolProfile = schoolProfile || {
      name: 'SMP NEGERI 1 KELU',
      npsn: '50102030',
      address: 'Jl. Pendidikan No. 1, Kabupaten',
      principalName: 'Drs. H. Ahmad Fauzi, M.Pd.',
      principalNip: '196805121994031005',
      district: 'Klu',
      regency: 'Kabupaten Lombok Utara',
      phone: '081234567890',
      email: 'info@sekolah.sch.id',
      website: 'www.sekolah.sch.id',
      regencyLogo: '',
      schoolLogo: ''
    };

    const homeroomName = getHomeroomTeacherName(selectedClassForRecap);

    await exportCharacterPointsPdf(
      defaultProfile,
      selectedClassStudents,
      classes,
      traits,
      characterLogs,
      selectedClassForRecap.id,
      homeroomName,
      predicateSettings
    );
  };

  const handleExportCharacterExcel = () => {
    if (!selectedClassForRecap) return;
    const defaultProfile: SchoolProfile = schoolProfile || {
      name: 'SMP NEGERI 1 KELU',
      npsn: '50102030',
      address: 'Jl. Pendidikan No. 1, Kabupaten',
      principalName: 'Drs. H. Ahmad Fauzi, M.Pd.',
      principalNip: '196805121994031005',
      district: 'Klu',
      regency: 'Kabupaten Lombok Utara',
      phone: '081234567890',
      email: 'info@sekolah.sch.id',
      website: 'www.sekolah.sch.id',
      regencyLogo: '',
      schoolLogo: ''
    };

    exportCharacterPointsExcel(
      defaultProfile,
      selectedClassStudents,
      characterLogs,
      `Kelas ${selectedClassForRecap.name}`,
      predicateSettings
    );
  };

  // Selected class attendance records based on selected date range
  const { dateFilteredRecords, startDateStr, endDateStr } = useMemo(() => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (attendanceDateRange === 'TODAY') {
      // today only
    } else if (attendanceDateRange === '7DAYS') {
      start.setDate(today.getDate() - 7);
    } else if (attendanceDateRange === '30DAYS') {
      start.setDate(today.getDate() - 30);
    } else if (attendanceDateRange === 'MONTH') {
      start = new Date(selectedAttendanceYear, selectedAttendanceMonth - 1, 1);
      end = new Date(selectedAttendanceYear, selectedAttendanceMonth, 0);
    } else if (attendanceDateRange === 'CUSTOM') {
      start = new Date(customStartDate);
      end = new Date(customEndDate);
    } else {
      // ALL
      start = new Date(2020, 0, 1);
    }

    const sStr = attendanceDateRange === 'CUSTOM' ? customStartDate :
                 attendanceDateRange === 'MONTH' ? `${selectedAttendanceYear}-${String(selectedAttendanceMonth).padStart(2, '0')}-01` :
                 start.toISOString().split('T')[0];

    const eStr = attendanceDateRange === 'CUSTOM' ? customEndDate :
                 attendanceDateRange === 'MONTH' ? `${selectedAttendanceYear}-${String(selectedAttendanceMonth).padStart(2, '0')}-${String(new Date(selectedAttendanceYear, selectedAttendanceMonth, 0).getDate()).padStart(2, '0')}` :
                 end.toISOString().split('T')[0];

    const records = attendanceRecords.filter(r => {
      if (attendanceDateRange === 'ALL') return true;
      return r.date >= sStr && r.date <= eStr;
    });

    return {
      dateFilteredRecords: records,
      startDateStr: sStr,
      endDateStr: eStr
    };
  }, [attendanceRecords, attendanceDateRange, selectedAttendanceMonth, selectedAttendanceYear, customStartDate, customEndDate]);

  // Per student attendance summary in the selected class (sorted Ascending by name)
  const classAttendanceRecapPerStudent = useMemo(() => {
    if (!selectedClassForRecap) return [];

    return selectedClassStudents.map(std => {
      const stdRecords = dateFilteredRecords.filter(r => r.studentId === std.id || r.nisn === std.nisn);
      const hadir = stdRecords.filter(r => r.status === 'HADIR').length;
      const terlambat = stdRecords.filter(r => r.status === 'TERLAMBAT').length;
      const pulang = stdRecords.filter(r => r.returnTime || r.returnStatus === 'PULANG' || r.returnStatus === 'PULANG_TEPAT' || r.returnStatus === 'PULANG_CEPAT').length;
      const izin = stdRecords.filter(r => r.status === 'IZIN').length;
      const sakit = stdRecords.filter(r => r.status === 'SAKIT').length;
      const alpa = stdRecords.filter(r => r.status === 'ALPA').length;

      const totalRecorded = stdRecords.length;
      const totalHadir = hadir + terlambat;
      const pct = totalRecorded > 0 ? Math.round((totalHadir / totalRecorded) * 100) : 0;

      return {
        student: std,
        hadir,
        terlambat,
        pulang,
        izin,
        sakit,
        alpa,
        totalRecorded,
        totalHadir,
        pct,
        records: stdRecords
      };
    });
  }, [selectedClassStudents, dateFilteredRecords, selectedClassForRecap]);

  // Filtered student attendance list by search query
  const filteredAttendanceRecapData = useMemo(() => {
    return classAttendanceRecapPerStudent.filter(item => {
      const q = attendanceSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return item.student.name.toLowerCase().includes(q) || 
             (item.student.nisn && item.student.nisn.includes(q)) ||
             (item.student.nis && item.student.nis.includes(q));
    });
  }, [classAttendanceRecapPerStudent, attendanceSearchQuery]);

  // Overall attendance statistics for selected class
  const classAttendanceOverviewStats = useMemo(() => {
    let totalHadir = 0;
    let totalTerlambat = 0;
    let totalPulang = 0;
    let totalIzin = 0;
    let totalSakit = 0;
    let totalAlpa = 0;
    let sumPct = 0;

    classAttendanceRecapPerStudent.forEach(s => {
      totalHadir += s.hadir;
      totalTerlambat += s.terlambat;
      totalPulang += s.pulang;
      totalIzin += s.izin;
      totalSakit += s.sakit;
      totalAlpa += s.alpa;
      sumPct += s.pct;
    });

    const avgPct = classAttendanceRecapPerStudent.length > 0 
      ? Math.round(sumPct / classAttendanceRecapPerStudent.length) 
      : 0;

    return {
      totalHadir,
      totalTerlambat,
      totalPulang,
      totalIzin,
      totalSakit,
      totalAlpa,
      avgPct,
      totalStudents: classAttendanceRecapPerStudent.length
    };
  }, [classAttendanceRecapPerStudent]);

  // Attendance PDF & Excel Export Handlers
  const handleExportAttendancePdf = async () => {
    if (!selectedClassForRecap) return;
    const defaultProfile: SchoolProfile = schoolProfile || {
      name: 'SMP NEGERI 1 KELU',
      npsn: '50102030',
      address: 'Jl. Pendidikan No. 1, Kabupaten',
      principalName: 'Drs. H. Ahmad Fauzi, M.Pd.',
      principalNip: '196805121994031005',
      district: 'Klu',
      regency: 'Kabupaten Lombok Utara',
      phone: '081234567890',
      email: 'info@sekolah.sch.id',
      website: 'www.sekolah.sch.id',
      regencyLogo: '',
      schoolLogo: ''
    };

    const homeroomName = getHomeroomTeacherName(selectedClassForRecap);
    const homeroomTeacher = teachers.find(t => t.id === selectedClassForRecap.homeroomTeacherId || t.name === homeroomName);
    const homeroomInfo = {
      name: homeroomName || homeroomTeacher?.name || 'Wali Kelas',
      nip: homeroomTeacher?.nip || '-'
    };

    if (attendanceDateRange === 'MONTH') {
      await exportMonthlyAttendanceMatrixPdf(
        defaultProfile,
        dateFilteredRecords,
        selectedClassStudents,
        selectedClassForRecap.name,
        selectedAttendanceYear,
        selectedAttendanceMonth,
        homeroomInfo
      );
    } else {
      await exportAttendancePdf(
        defaultProfile,
        dateFilteredRecords,
        selectedClassStudents,
        `Kelas ${selectedClassForRecap.name}`,
        startDateStr,
        endDateStr
      );
    }
  };

  const handleExportAttendanceExcel = () => {
    if (!selectedClassForRecap) return;
    const defaultProfile: SchoolProfile = schoolProfile || {
      name: 'SMP NEGERI 1 KELU',
      npsn: '50102030',
      address: 'Jl. Pendidikan No. 1, Kabupaten',
      principalName: 'Drs. H. Ahmad Fauzi, M.Pd.',
      principalNip: '196805121994031005',
      district: 'Klu',
      regency: 'Kabupaten Lombok Utara',
      phone: '081234567890',
      email: 'info@sekolah.sch.id',
      website: 'www.sekolah.sch.id',
      regencyLogo: '',
      schoolLogo: ''
    };

    const homeroomName = getHomeroomTeacherName(selectedClassForRecap);
    const homeroomTeacher = teachers.find(t => t.id === selectedClassForRecap.homeroomTeacherId || t.name === homeroomName);
    const homeroomInfo = {
      name: homeroomName || homeroomTeacher?.name || 'Wali Kelas',
      nip: homeroomTeacher?.nip || '-'
    };

    if (attendanceDateRange === 'MONTH') {
      exportMonthlyAttendanceMatrixExcel(
        defaultProfile,
        dateFilteredRecords,
        selectedClassStudents,
        selectedClassForRecap.name,
        selectedAttendanceYear,
        selectedAttendanceMonth,
        homeroomInfo
      );
    } else {
      exportAttendanceExcel(
        defaultProfile,
        dateFilteredRecords,
        selectedClassStudents,
        `Kelas ${selectedClassForRecap.name}`,
        startDateStr,
        endDateStr
      );
    }
  };

  // Helper function to get summary attendance score for ANY class card in the main list
  const getClassAttendanceSummary = (classId: string, className: string) => {
    const classStd = students.filter(s => s.classId === classId || s.className === className);
    if (classStd.length === 0) return { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, todayPresent: 0, totalStudents: 0, pct: 0 };
    
    const stdIds = new Set(classStd.map(s => s.id));
    const classRecords = attendanceRecords.filter(r => stdIds.has(r.studentId));
    
    const hadir = classRecords.filter(r => r.status === 'HADIR').length;
    const terlambat = classRecords.filter(r => r.status === 'TERLAMBAT').length;
    const izin = classRecords.filter(r => r.status === 'IZIN').length;
    const sakit = classRecords.filter(r => r.status === 'SAKIT').length;
    const alpa = classRecords.filter(r => r.status === 'ALPA').length;
    const totalRec = classRecords.length;
    const pct = totalRec > 0 ? Math.round(((hadir + terlambat) / totalRec) * 100) : 0;

    return {
      hadir,
      terlambat,
      izin,
      sakit,
      alpa,
      todayPresent: hadir + terlambat,
      totalStudents: classStd.length,
      pct
    };
  };

  // If a class is selected for Rekap, display full recap view
  if (selectedClassForRecap) {
    const homeroomName = getHomeroomTeacherName(selectedClassForRecap);

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-200">
        
        {/* Top Bar Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedClassForRecap(null)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4 text-blue-400" />
              Kembali ke Daftar Kelas
            </button>

            <div className="hidden sm:block h-6 w-px bg-slate-800" />

            {/* Class Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold hidden md:inline">Pilih Kelas:</span>
              <select
                value={selectedClassForRecap.id}
                onChange={(e) => {
                  const target = sortedClasses.find(c => c.id === e.target.value);
                  if (target) setSelectedClassForRecap(target);
                }}
                className="bg-slate-800 border border-slate-700 text-white text-xs font-bold px-3 py-2 rounded-2xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {sortedClasses.map(c => (
                  <option key={c.id} value={c.id}>Kelas {c.name} ({c.grade})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {recapSubTab === 'REKAP_PRESENSI' ? (
              <>
                <button
                  onClick={handleExportAttendancePdf}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-2 rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 text-xs transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <Download className="w-4 h-4 text-emerald-200" />
                  PDF Presensi Kelas
                </button>
                <button
                  onClick={handleExportAttendanceExcel}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-3.5 py-2 rounded-2xl shadow-lg shadow-blue-600/30 flex items-center gap-1.5 text-xs transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-200" />
                  Excel Presensi
                </button>
              </>
            ) : recapSubTab === 'REKAP_KARAKTER' ? (
              <>
                <button
                  onClick={handleExportCharacterPdf}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-2 rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 text-xs transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <Download className="w-4 h-4 text-emerald-200" />
                  PDF Nilai Karakter
                </button>
                <button
                  onClick={handleExportCharacterExcel}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-3.5 py-2 rounded-2xl shadow-lg shadow-blue-600/30 flex items-center gap-1.5 text-xs transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-200" />
                  Excel Karakter
                </button>
              </>
            ) : recapSubTab === 'JURNAL_KBM' ? (
              <button
                onClick={handleDownloadJournalPdf}
                disabled={selectedClassJournals.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2.5 rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 text-xs transition-all cursor-pointer hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 text-emerald-200" />
                Download Jurnal KBM
              </button>
            ) : (
              <button
                onClick={handleDownloadClassPdf}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2.5 rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 text-xs transition-all cursor-pointer hover:scale-[1.02]"
              >
                <Download className="w-4 h-4 text-emerald-200" />
                Download Rekap PDF Keaktifan
              </button>
            )}
          </div>
        </div>

        {/* Header Profile Info */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-900/40 p-6 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-600/10 to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 text-xs font-black px-3 py-1 rounded-xl border border-indigo-500/30 uppercase tracking-wider">
                  {selectedClassForRecap.grade}
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-xl border border-emerald-500/30">
                  Wali Kelas: {homeroomName}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <Building2 className="w-8 h-8 text-blue-400 shrink-0" />
                Database & Rekapitulasi Kelas {selectedClassForRecap.name}
              </h1>

              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Ringkasan menyeluruh data presensi kehadiran siswa, nilai karakter, partisipasi KBM, dan riwayat jurnal kelas yang terintegrasi.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl text-center min-w-[110px]">
                <p className="text-2xl font-black text-blue-400">{selectedClassStudents.length}</p>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">Total Siswa</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl text-center min-w-[110px]">
                <p className="text-2xl font-black text-emerald-400">
                  {classAttendanceOverviewStats.avgPct}%
                </p>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">Rata-Rata Hadir</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl text-center min-w-[110px]">
                <p className="text-2xl font-black text-amber-400">
                  {classCharacterOverviewStats.avgNetPoints >= 0 ? `+${classCharacterOverviewStats.avgNetPoints}` : classCharacterOverviewStats.avgNetPoints}
                </p>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">Rata-Rata Karakter</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subtab Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setRecapSubTab('REKAP_PRESENSI')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              recapSubTab === 'REKAP_PRESENSI'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4 text-blue-300" />
            Rekap Presensi Siswa ({selectedClassStudents.length} Siswa)
          </button>

          <button
            onClick={() => setRecapSubTab('REKAP_KARAKTER')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              recapSubTab === 'REKAP_KARAKTER'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Award className="w-4 h-4 text-amber-300" />
            Rekap Nilai Karakter Kelas ({selectedClassStudents.length})
          </button>

          <button
            onClick={() => setRecapSubTab('PER_SISWA')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              recapSubTab === 'PER_SISWA'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-blue-300" />
            Keaktifan KBM Per Siswa ({selectedClassStudents.length})
          </button>

          <button
            onClick={() => setRecapSubTab('JURNAL_KBM')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              recapSubTab === 'JURNAL_KBM'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-300" />
            Riwayat Jurnal KBM ({selectedClassJournals.length})
          </button>
        </div>

        {/* SUBTAB 0: REKAP PRESENSI KELAS */}
        {recapSubTab === 'REKAP_PRESENSI' && (
          <div className="space-y-5">
            {/* Filter Rentang Tanggal Presensi */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5 mr-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  Rentang Tanggal:
                </span>
                <button
                  onClick={() => setAttendanceDateRange('TODAY')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    attendanceDateRange === 'TODAY'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => setAttendanceDateRange('7DAYS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    attendanceDateRange === '7DAYS'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  7 Hari Terakhir
                </button>
                <button
                  onClick={() => setAttendanceDateRange('30DAYS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    attendanceDateRange === '30DAYS'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  30 Hari Terakhir
                </button>
                <div className="relative">
                  <button
                    onClick={() => {
                      setAttendanceDateRange('MONTH');
                      setIsMonthPickerOpen(!isMonthPickerOpen);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                      attendanceDateRange === 'MONTH'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-blue-300" />
                    <span>Bulan: {INDONESIAN_MONTH_OPTIONS.find(m => m.value === selectedAttendanceMonth)?.name} {selectedAttendanceYear}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMonthPickerOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Month Picker Dropdown Popover */}
                  {isMonthPickerOpen && (
                    <div className="absolute left-0 top-full mt-2 z-50 bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-2xl w-72 sm:w-80 space-y-3 backdrop-blur-md">
                      {/* Year Selector */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <span className="text-xs font-bold text-slate-300">Pilih Bulan & Tahun</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAttendanceYear(prev => prev - 1);
                            }}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-black text-blue-400 px-2">{selectedAttendanceYear}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAttendanceYear(prev => prev + 1);
                            }}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* 12 Months Grid */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {INDONESIAN_MONTH_OPTIONS.map((m) => {
                          const isSelected = attendanceDateRange === 'MONTH' && selectedAttendanceMonth === m.value;
                          const isCurrentMonth = new Date().getMonth() + 1 === m.value && new Date().getFullYear() === selectedAttendanceYear;
                          return (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => {
                                setSelectedAttendanceMonth(m.value);
                                setAttendanceDateRange('MONTH');
                                setIsMonthPickerOpen(false);
                              }}
                              className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-md font-black ring-2 ring-blue-400'
                                  : isCurrentMonth
                                  ? 'bg-slate-800 text-blue-400 hover:bg-slate-700 border border-blue-500/30'
                                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                              }`}
                            >
                              {m.name}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            setSelectedAttendanceMonth(now.getMonth() + 1);
                            setSelectedAttendanceYear(now.getFullYear());
                            setAttendanceDateRange('MONTH');
                            setIsMonthPickerOpen(false);
                          }}
                          className="text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                        >
                          Bulan Sekarang
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsMonthPickerOpen(false)}
                          className="text-slate-400 hover:text-white font-bold cursor-pointer"
                        >
                          Tutup
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setAttendanceDateRange('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    attendanceDateRange === 'ALL'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setAttendanceDateRange('CUSTOM')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    attendanceDateRange === 'CUSTOM'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Kustom
                </button>
              </div>

              {attendanceDateRange === 'CUSTOM' && (
                <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold px-2.5 py-1.5 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-400 font-bold">s/d</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold px-2.5 py-1.5 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="text-xs text-slate-400 font-mono font-semibold">
                Periode: <strong className="text-blue-300">{startDateStr}</strong> s/d <strong className="text-blue-300">{endDateStr}</strong>
              </div>
            </div>

            {/* Attendance Overview Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-emerald-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Hadir Tepat</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-emerald-300">{classAttendanceOverviewStats.totalHadir}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Tepat Waktu</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-amber-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Terlambat</span>
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-amber-300">{classAttendanceOverviewStats.totalTerlambat}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Masuk Terlambat</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-indigo-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Scan Pulang</span>
                  <CheckCheck className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-indigo-300">{classAttendanceOverviewStats.totalPulang}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Presensi Keluar</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-blue-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Izin</span>
                  <CalendarCheck className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-blue-300">{classAttendanceOverviewStats.totalIzin}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Izin Resmi</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-purple-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Sakit</span>
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-purple-300">{classAttendanceOverviewStats.totalSakit}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Surat Sakit</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-rose-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Alpa (Tanpa Ket.)</span>
                  <UserX className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-rose-300">{classAttendanceOverviewStats.totalAlpa}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Tanpa Keterangan</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1 col-span-2 sm:col-span-3 lg:col-span-1">
                <div className="flex items-center justify-between text-cyan-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">% Kehadiran</span>
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-cyan-300">{classAttendanceOverviewStats.avgPct}%</p>
                <p className="text-[10px] text-slate-400 font-semibold">Rata-rata Kelas</p>
              </div>
            </div>

            {/* Attendance Table Container */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              {/* Search Control */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={attendanceSearchQuery}
                    onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                    placeholder="Cari nama siswa atau NISN..."
                    className="w-full bg-slate-800 border border-slate-700 pl-10 pr-4 py-2.5 rounded-2xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">
                    Menampilkan: <strong className="text-white">{filteredAttendanceRecapData.length}</strong> dari {classAttendanceRecapPerStudent.length} Siswa
                  </span>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-300 uppercase font-extrabold text-[11px] border-b border-slate-700 tracking-wider">
                      <th className="py-3 px-3 text-center rounded-l-xl w-12">No</th>
                      <th className="py-3 px-4">NISN / NIS</th>
                      <th className="py-3 px-4">Nama Siswa</th>
                      <th className="py-3 px-3 text-center">Hadir</th>
                      <th className="py-3 px-3 text-center">Terlambat</th>
                      <th className="py-3 px-3 text-center">Pulang</th>
                      <th className="py-3 px-3 text-center">Izin</th>
                      <th className="py-3 px-3 text-center">Sakit</th>
                      <th className="py-3 px-3 text-center">Alpa</th>
                      <th className="py-3 px-4 text-center">% Kehadiran</th>
                      <th className="py-3 px-4 text-center rounded-r-xl">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredAttendanceRecapData.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-400">
                          Tidak ada data siswa ditemukan untuk kriteria pencarian ini.
                        </td>
                      </tr>
                    ) : (
                      filteredAttendanceRecapData.map((item, idx) => (
                        <tr key={item.student.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{item.student.nisn || item.student.nis || '-'}</td>
                          <td className="py-3 px-4 font-bold text-white">
                            {item.student.name}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-500/20 text-emerald-300">
                              {item.hadir}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300">
                              {item.terlambat}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-indigo-500/20 text-indigo-300">
                              {item.pulang}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-blue-500/20 text-blue-300">
                              {item.izin}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-purple-500/20 text-purple-300">
                              {item.sakit}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-rose-500/20 text-rose-300">
                              {item.alpa}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`font-black text-xs ${
                                item.pct >= 85 ? 'text-emerald-400' :
                                item.pct >= 70 ? 'text-blue-400' :
                                item.pct >= 50 ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                {item.pct}%
                              </span>
                              <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    item.pct >= 85 ? 'bg-emerald-500' :
                                    item.pct >= 70 ? 'bg-blue-500' :
                                    item.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(item.pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setSelectedStudentAttendanceModal(item)}
                              className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 mx-auto cursor-pointer transition-all hover:scale-105"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Riwayat
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 1: REKAP NILAI KARAKTER KELAS */}
        {recapSubTab === 'REKAP_KARAKTER' && (
          <div className="space-y-5">
            {/* Summary Stat Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-emerald-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Sangat Baik (A)</span>
                  <Award className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-white">{classCharacterOverviewStats.countA}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Poin ≥ {predicateSettings.minA}</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-blue-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Baik (B)</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-white">{classCharacterOverviewStats.countB}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Poin ≥ {predicateSettings.minB}</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-amber-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Cukup (C)</span>
                  <Star className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-white">{classCharacterOverviewStats.countC}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Poin ≥ {predicateSettings.minC}</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-orange-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Perlu Pembinaan (D)</span>
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-white">{classCharacterOverviewStats.countD}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Poin ≥ {predicateSettings.minD}</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-rose-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Tidak Naik (E)</span>
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-white">{classCharacterOverviewStats.countE}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Poin ≥ {predicateSettings.minE}</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-purple-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Pindah Sekolah (F)</span>
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <p className="text-2xl font-black text-white">{classCharacterOverviewStats.countF}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Poin &lt; {predicateSettings.minE}</p>
              </div>
            </div>

            {/* Main Table Container */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              {/* Search & Filter Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={characterSearchQuery}
                    onChange={(e) => setCharacterSearchQuery(e.target.value)}
                    placeholder="Cari nama atau NISN siswa..."
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs font-bold pl-10 pr-4 py-2.5 rounded-2xl focus:ring-2 focus:ring-amber-500 placeholder-slate-400"
                  />
                  {characterSearchQuery && (
                    <button
                      onClick={() => setCharacterSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-extrabold text-slate-300 shrink-0">Filter Predikat:</span>
                  <select
                    value={characterPredicateFilter}
                    onChange={(e) => setCharacterPredicateFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white text-xs font-bold px-3 py-2.5 rounded-2xl focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="ALL">Semua Predikat Karakter</option>
                    <option value="A">🟢 Sangat Baik (A)</option>
                    <option value="B">🔵 Baik (B)</option>
                    <option value="C">🟡 Cukup (C)</option>
                    <option value="D">🟠 Perlu Pembinaan (D)</option>
                    <option value="E">🔴 Tidak Naik Kelas (E)</option>
                    <option value="F">🟣 Pindah Sekolah (F)</option>
                  </select>
                </div>
              </div>

              {/* Student Character Score Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-300 text-[11px] font-black uppercase tracking-wider border-b border-slate-700">
                      <th className="py-3.5 px-4 text-center">No</th>
                      <th className="py-3.5 px-4">NISN</th>
                      <th className="py-3.5 px-4">Nama Siswa</th>
                      <th className="py-3.5 px-4 text-center">Log Positif (+)</th>
                      <th className="py-3.5 px-4 text-center">Log Negatif (-)</th>
                      <th className="py-3.5 px-4 text-center">Poin Bersih</th>
                      <th className="py-3.5 px-4 text-center">Predikat Karakter</th>
                      <th className="py-3.5 px-4">Catatan Terakhir</th>
                      <th className="py-3.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs text-slate-200">
                    {filteredCharacterRecapData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-400 font-bold">
                          {selectedClassStudents.length === 0
                            ? 'Belum ada siswa yang terdaftar di kelas ini.'
                            : 'Tidak ada data siswa yang sesuai dengan filter predikat/pencarian.'}
                        </td>
                      </tr>
                    ) : (
                      filteredCharacterRecapData.map((item, idx) => (
                        <tr key={item.student.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-300">{item.student.nisn || '-'}</td>
                          <td className="py-3 px-4 font-bold text-white">
                            {item.student.name}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {item.student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-400">
                            +{item.posPoints} <span className="text-[10px] text-slate-500 font-normal">({item.posLogs.length} log)</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-rose-400">
                            -{item.negPoints} <span className="text-[10px] text-slate-500 font-normal">({item.negLogs.length} log)</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black ${
                              item.netPoints > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              item.netPoints < 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                              'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {item.netPoints > 0 ? `+${item.netPoints}` : item.netPoints}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-black border ${item.pred.color}`}>
                              {item.pred.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 max-w-xs truncate italic">
                            {item.lastLog ? (
                              <span>
                                <strong className="text-amber-300 not-italic">{item.lastLog.traitName}</strong>: "{item.lastLog.notes || '-'}"
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setSelectedStudentCharacterModal({
                                student: item.student,
                                logs: item.allLogs,
                                posPoints: item.posPoints,
                                negPoints: item.negPoints,
                                netPoints: item.netPoints
                              })}
                              className="bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-400" />
                              Detail Log ({item.totalLogs})
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: REKAP KEAKTIFAN PER SISWA (KBM) */}
        {recapSubTab === 'PER_SISWA' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            {/* Search & Filter Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="Cari nama atau NISN siswa..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs font-bold pl-10 pr-4 py-2.5 rounded-2xl focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
                />
                {studentSearchQuery && (
                  <button
                    onClick={() => setStudentSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-extrabold text-slate-300 shrink-0">Filter Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-bold px-3 py-2.5 rounded-2xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">Semua Status Keaktifan</option>
                  <option value="PERLU_PERHATIAN">⚠️ Perlu Perhatian (Kurang/Mengganggu)</option>
                  <option value="Sangat aktif">🟢 Sangat Aktif</option>
                  <option value="Cukup aktif">🔵 Cukup Aktif</option>
                  <option value="Kurang aktif">🟠 Kurang Aktif</option>
                  <option value="Mengganggu">🔴 Mengganggu</option>
                </select>
              </div>
            </div>

            {/* Student Recap Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300 text-[11px] font-black uppercase tracking-wider border-b border-slate-700">
                    <th className="py-3.5 px-4 text-center">No</th>
                    <th className="py-3.5 px-4">NISN</th>
                    <th className="py-3.5 px-4">Nama Siswa</th>
                    <th className="py-3.5 px-4 text-center">Pertemuan</th>
                    <th className="py-3.5 px-4 text-center">Sangat Aktif</th>
                    <th className="py-3.5 px-4 text-center">Cukup Aktif</th>
                    <th className="py-3.5 px-4 text-center">Kurang Aktif</th>
                    <th className="py-3.5 px-4 text-center">Mengganggu/Absen</th>
                    <th className="py-3.5 px-4 text-center">Predikat Dominan</th>
                    <th className="py-3.5 px-4">Catatan Guru Terakhir</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs text-slate-200">
                  {filteredStudentRecapData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400 font-bold">
                        {selectedClassStudents.length === 0
                          ? 'Belum ada siswa yang terdaftar di kelas ini.'
                          : 'Tidak ada data siswa yang sesuai dengan kata kunci pencarian/filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudentRecapData.map((item, idx) => (
                      <tr key={item.student.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-300">{item.student.nisn || '-'}</td>
                        <td className="py-3 px-4 font-bold text-white">
                          {item.student.name}
                          <span className="block text-[10px] text-slate-400 font-normal">{item.student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-extrabold text-blue-400">
                          {item.totalPertemuan}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-400">
                          {item.sangatAktif}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-blue-400">
                          {item.cukupAktif}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-amber-400">
                          {item.kurangAktif}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-rose-400">
                          {item.mengganggu + item.tidakHadir}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-extrabold border ${item.predikatColor}`}>
                            {item.predikat}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-xs truncate italic">
                          {item.lastNotes ? `"${item.lastNotes}"` : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedStudentDetail({
                              student: item.student,
                              history: item.history
                            })}
                            className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            Detail KBM
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 3: RIWAYAT JURNAL KBM KELAS */}
        {recapSubTab === 'JURNAL_KBM' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Daftar Jurnal KBM Terdata Kelas {selectedClassForRecap.name}
              </h3>
              <button
                type="button"
                onClick={handleDownloadJournalPdf}
                disabled={selectedClassJournals.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2 text-xs transition-all cursor-pointer hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
              >
                <Download className="w-4 h-4 text-emerald-200" />
                Download Jurnal KBM
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs text-slate-200">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300 text-[11px] font-black uppercase tracking-wider border-b border-slate-700">
                    <th className="py-3.5 px-4 text-center">No</th>
                    <th className="py-3.5 px-4">Tanggal & Jam</th>
                    <th className="py-3.5 px-4">Mata Pelajaran</th>
                    <th className="py-3.5 px-4">Guru Pengajar</th>
                    <th className="py-3.5 px-4">Materi Pembelajaran</th>
                    <th className="py-3.5 px-4 text-center">Evaluasi Siswa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {selectedClassJournals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 font-bold">
                        Belum ada jurnal KBM yang diisi untuk kelas ini.
                      </td>
                    </tr>
                  ) : (
                    selectedClassJournals.map((j, idx) => (
                      <tr key={j.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-300">
                          {j.date}
                          <span className="block text-[10px] text-slate-400 font-normal">Jam ke-{j.periods?.join(', ') || '-'}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{j.subject}</td>
                        <td className="py-3 px-4 text-slate-300">{j.teacherName}</td>
                        <td className="py-3 px-4 text-slate-300 max-w-sm truncate">{j.material || '-'}</td>
                        <td className="py-3 px-4 text-center font-bold text-blue-400">
                          {j.studentAttendances?.length || 0} Siswa Dievaluasi
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Detail Student KBM History */}
        {selectedStudentDetail && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-400" />
                    Riwayat Keaktifan KBM: {selectedStudentDetail.student.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    NISN: {selectedStudentDetail.student.nisn || '-'} • Kelas {selectedClassForRecap.name}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedStudentDetail(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-3 pr-1 flex-1">
                {selectedStudentDetail.history.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Belum ada catatan jurnal KBM untuk siswa ini.</p>
                ) : (
                  selectedStudentDetail.history.map((h, idx) => (
                    <div key={idx} className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-amber-300">{h.journal.subject}</span>
                        <span className="text-slate-400 font-mono text-[11px]">{h.journal.date} (Jam ke-{h.journal.periods?.join(', ')})</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">Guru: {h.journal.teacherName}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                          h.status === 'Sangat aktif' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          h.status === 'Cukup aktif' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                          h.status === 'Kurang aktif' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                          'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}>
                          {h.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <strong className="text-slate-400 font-semibold block text-[10px]">Materi:</strong>
                        {h.journal.material || '-'}
                      </p>

                      {h.notes && (
                        <p className="text-xs text-amber-200 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span><strong>Catatan Guru:</strong> "{h.notes}"</span>
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedStudentDetail(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Modal Detail Student Attendance History */}
        {selectedStudentAttendanceModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-400" />
                    Riwayat Presensi: {selectedStudentAttendanceModal.student.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    NISN: {selectedStudentAttendanceModal.student.nisn || '-'} • Kelas {selectedClassForRecap.name} • Kehadiran: <strong className="text-emerald-400">{selectedStudentAttendanceModal.pct}%</strong>
                  </p>
                </div>

                <button
                  onClick={() => setSelectedStudentAttendanceModal(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Attendance Quick Stats in Modal */}
              <div className="grid grid-cols-6 gap-2 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Hadir</span>
                  <span className="text-sm font-black text-emerald-300">{selectedStudentAttendanceModal.hadir}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Terlambat</span>
                  <span className="text-sm font-black text-amber-300">{selectedStudentAttendanceModal.terlambat}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Pulang</span>
                  <span className="text-sm font-black text-indigo-300">{selectedStudentAttendanceModal.pulang}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Izin</span>
                  <span className="text-sm font-black text-blue-300">{selectedStudentAttendanceModal.izin}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Sakit</span>
                  <span className="text-sm font-black text-purple-300">{selectedStudentAttendanceModal.sakit}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Alpa</span>
                  <span className="text-sm font-black text-rose-300">{selectedStudentAttendanceModal.alpa}</span>
                </div>
              </div>

              <div className="overflow-y-auto space-y-2 pr-1 flex-1">
                {selectedStudentAttendanceModal.records.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Belum ada rekaman presensi pada periode tanggal ini.</p>
                ) : (
                  selectedStudentAttendanceModal.records
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((rec) => (
                      <div
                        key={rec.id}
                        className="bg-slate-800/70 border border-slate-700/70 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-extrabold text-white">{rec.date}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                              rec.status === 'HADIR' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              rec.status === 'TERLAMBAT' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              rec.status === 'IZIN' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                              rec.status === 'SAKIT' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                              'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}>
                              {rec.status}
                            </span>
                          </div>
                          {rec.notes && (
                            <p className="text-[11px] text-slate-400 italic">"{rec.notes}"</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">Masuk:</span>
                            <span className="font-mono font-bold text-slate-200">{rec.time || '-'}</span>
                          </div>
                          <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">Pulang:</span>
                            <span className="font-mono font-bold text-slate-200">{rec.returnTime || '-'}</span>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedStudentAttendanceModal(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Detail Student Character Logs History */}
        {selectedStudentCharacterModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    Riwayat Log Nilai Karakter: {selectedStudentCharacterModal.student.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    NISN: {selectedStudentCharacterModal.student.nisn || '-'} • Total Poin Bersih:{' '}
                    <strong className={selectedStudentCharacterModal.netPoints >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {selectedStudentCharacterModal.netPoints > 0 ? `+${selectedStudentCharacterModal.netPoints}` : selectedStudentCharacterModal.netPoints}
                    </strong>
                  </p>
                </div>

                <button
                  onClick={() => setSelectedStudentCharacterModal(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-3 pr-1 flex-1">
                {selectedStudentCharacterModal.logs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Belum ada catatan log nilai karakter untuk siswa ini.</p>
                ) : (
                  selectedStudentCharacterModal.logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-4 rounded-2xl border space-y-2 ${
                        log.traitType === 'POSITIF'
                          ? 'bg-emerald-950/20 border-emerald-900/40'
                          : 'bg-rose-950/20 border-rose-900/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-white flex items-center gap-2">
                          {log.traitType === 'POSITIF' ? (
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-rose-400" />
                          )}
                          {log.traitName}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                          log.traitType === 'POSITIF' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {log.traitType === 'POSITIF' ? `+${log.points}` : `-${log.points}`} Poin
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Pencatat: <strong className="text-slate-300">{log.recorderName}</strong></span>
                        <span className="font-mono">{log.date}</span>
                      </div>

                      {log.notes && (
                        <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 italic">
                          "{log.notes}"
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedStudentCharacterModal(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    );
  }

  // DEFAULT VIEW: Main Class List Grid
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-400" />
            Pengaturan Data Kelas & Rekap Nilai Karakter
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Kelola daftar rombel (rombongan belajar), Wali Kelas, serta lihat rekapitulasi nilai karakter dan keaktifan KBM kelas.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 text-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Tambah Kelas Baru
        </button>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedClasses.map((c) => {
          const classStudentsCount = students.filter(s => s.classId === c.id || s.className === c.name).length;
          const classJournalsCount = journals.filter(j => j.classId === c.id || j.className === c.name).length;
          const charSummary = getClassCharacterSummary(c.id, c.name);
          const attSummary = getClassAttendanceSummary(c.id, c.name);

          return (
            <div
              key={c.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 hover:border-blue-500/40 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-blue-500/30">
                    {c.grade}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    {classStudentsCount} Siswa
                  </span>
                </div>

                <div>
                  <h3 
                    onClick={() => {
                      setSelectedClassForRecap(c);
                      setRecapSubTab('REKAP_PRESENSI');
                    }}
                    className="text-xl font-black text-white hover:text-blue-400 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>Kelas {c.name}</span>
                    <Building2 className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                  </h3>
                  <p className="text-xs text-slate-300 font-semibold mt-1 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Wali Kelas: {getHomeroomTeacherName(c)}
                  </p>
                </div>

                {/* Attendance Summary Mini-Card */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-300 flex items-center gap-1.5 text-[11px]">
                      <CalendarCheck className="w-3.5 h-3.5 text-blue-400" /> Rata-rata Presensi:
                    </span>
                    <span className={`font-black px-2 py-0.5 rounded-md text-xs ${
                      attSummary.pct >= 85 ? 'bg-emerald-500/20 text-emerald-300' :
                      attSummary.pct >= 70 ? 'bg-blue-500/20 text-blue-300' :
                      'bg-amber-500/20 text-amber-300'
                    }`}>
                      {attSummary.pct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <span className="text-emerald-400 font-bold">Hadir: {attSummary.hadir}</span>
                    <span>•</span>
                    <span className="text-amber-400 font-bold">Telat: {attSummary.terlambat}</span>
                    <span>•</span>
                    <span className="text-rose-400 font-bold">Alpa: {attSummary.alpa}</span>
                  </div>
                </div>

                {/* Character Summary Box inside Class Card */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-300 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-400" /> Rata-Rata Karakter:
                    </span>
                    <span className={`font-black px-2 py-0.5 rounded-md text-xs ${
                      charSummary.avgScore >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {charSummary.avgScore >= 0 ? `+${charSummary.avgScore}` : charSummary.avgScore} Poin
                    </span>
                  </div>

                  {/* Predicate Counts Pill */}
                  <div className="flex flex-wrap items-center gap-1 text-[10px] font-extrabold pt-1">
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">A: {charSummary.countA}</span>
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">B: {charSummary.countB}</span>
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">C: {charSummary.countC}</span>
                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded">D: {charSummary.countD}</span>
                    <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded">E: {charSummary.countE}</span>
                    <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">F: {charSummary.countF}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-800">
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedClassForRecap(c);
                      setRecapSubTab('REKAP_PRESENSI');
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-2 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer hover:scale-[1.02]"
                    title="Rekap Presensi Kehadiran Kelas"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                    <span className="truncate font-black">Rekap Presensi</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedClassForRecap(c);
                      setRecapSubTab('REKAP_KARAKTER');
                    }}
                    className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold px-2 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer hover:scale-[1.02]"
                    title="Rekap Nilai Karakter Kelas"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                    <span className="truncate font-black">Karakter</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedClassForRecap(c);
                      setRecapSubTab('PER_SISWA');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold px-2 py-1.5 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-[1.01]"
                    title="Keaktifan KBM Per Siswa"
                  >
                    <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">Keaktifan</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedClassForRecap(c);
                      setRecapSubTab('JURNAL_KBM');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold px-2 py-1.5 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-[1.01]"
                    title="Riwayat Jurnal KBM Kelas"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">Jurnal KBM</span>
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => setClassToDelete(c)}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Class Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-2">
              {editingClass ? 'Edit Kelas' : 'Tambah Kelas Baru'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Jenjang Pendidikan</label>
                <input
                  type="text"
                  required
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  placeholder="Contoh: Kelas 7"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nama Rombel / Kelas</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: 7-A"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Wali Kelas</label>
                <select
                  value={formData.homeroomTeacher}
                  onChange={(e) => setFormData({ ...formData, homeroomTeacher: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Belum Ditentukan">Belum Ditentukan</option>
                  {sortedTeachers.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.additionalDuty || 'Guru Mapel'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {classToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/30">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Konfirmasi Hapus Kelas</h3>
              <p className="text-xs text-slate-400 mt-1">
                Apakah Anda yakin ingin menghapus kelas <strong className="text-white">{classToDelete.name}</strong>? Data siswa di dalamnya tidak akan terhapus namun asosiasi kelasnya akan disesuaikan.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setClassToDelete(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeleteClass(classToDelete.id);
                  setClassToDelete(null);
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Hapus Kelas
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
