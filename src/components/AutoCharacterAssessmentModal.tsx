import React, { useState, useMemo } from 'react';
import { 
  Student, 
  SchoolClass, 
  CharacterTrait, 
  StudentCharacterLog, 
  AttendanceRecord, 
  Teacher, 
  UserSession,
  LearningJournal,
  SchoolProfile
} from '../types';
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  Clock, 
  UserX, 
  CalendarCheck2, 
  Filter, 
  CheckSquare, 
  VolumeX, 
  UserCheck,
  Flame,
  ThumbsUp,
  ThumbsDown,
  Info,
  Layers,
  GraduationCap,
  Power,
  ShieldAlert,
  AlertTriangle,
  Lock
} from 'lucide-react';

export type AutoRuleType = 
  | 'LATE' 
  | 'ALPA' 
  | 'DISRUPTIVE_KBM' 
  | 'ABSENT_KBM'
  | 'VERY_ACTIVE_KBM'
  | 'ON_TIME_3_DAYS';

export interface AutoCharacterCandidate {
  id: string; // unique draft id
  studentId: string;
  studentName: string;
  nisn: string;
  classId: string;
  className: string;
  ruleType: AutoRuleType;
  ruleLabel: string;
  traitId: string;
  traitName: string;
  traitType: 'POSITIF' | 'NEGATIF';
  points: number;
  date: string; // YYYY-MM-DD
  notes: string;
  evaluatorName: string; // Guru penilai (dari Jurnal KBM atau sesi guru)
  attendanceDates: string[]; // reference dates
  sourceType: 'PRESENSI' | 'JURNAL_KBM';
  subjectName?: string;
  isSelected: boolean;
  isAlreadyLogged: boolean;
}

interface AutoCharacterAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classes: SchoolClass[];
  traits: CharacterTrait[];
  characterLogs: StudentCharacterLog[];
  attendanceRecords: AttendanceRecord[];
  learningJournals?: LearningJournal[];
  teachers: Teacher[];
  userSession?: UserSession | null;
  schoolProfile?: SchoolProfile;
  onUpdateSchoolProfile?: (profile: SchoolProfile) => void;
  onApplyLogs: (newLogs: StudentCharacterLog[]) => void;
}

export const AutoCharacterAssessmentModal: React.FC<AutoCharacterAssessmentModalProps> = ({
  isOpen,
  onClose,
  students,
  classes,
  traits,
  characterLogs,
  attendanceRecords,
  learningJournals = [],
  teachers,
  userSession,
  schoolProfile,
  onUpdateSchoolProfile,
  onApplyLogs,
}) => {
  // Auto assessment status (Defaults to true if undefined)
  const isAutoEnabled = schoolProfile?.autoCharacterAssessmentEnabled !== false;

  const handleToggleAutoAssessment = (targetState?: boolean) => {
    const nextState = targetState !== undefined ? targetState : !isAutoEnabled;
    if (schoolProfile && onUpdateSchoolProfile) {
      const updatedProfile: SchoolProfile = {
        ...schoolProfile,
        autoCharacterAssessmentEnabled: nextState,
      };
      onUpdateSchoolProfile(updatedProfile);
    }
  };
  // Configurable parameters with user-specified defaults
  const [latePoints, setLatePoints] = useState<number>(2);
  const [alpaPoints, setAlpaPoints] = useState<number>(5);
  const [disruptivePoints, setDisruptivePoints] = useState<number>(1);
  const [absentKbmPoints, setAbsentKbmPoints] = useState<number>(2); // Default 2 poin negatif
  const [veryActiveKbmPoints, setVeryActiveKbmPoints] = useState<number>(1); // Default 1 poin positif
  const [onTimePoints, setOnTimePoints] = useState<number>(1);
  const [onTimeRequiredDays, setOnTimeRequiredDays] = useState<number>(3);

  // Group Filter (POSITIF / NEGATIF / ALL)
  const [groupFilter, setGroupFilter] = useState<'ALL' | 'POSITIF' | 'NEGATIF'>('ALL');
  
  // Specific Rule Filter inside Modal
  const [ruleFilter, setRuleFilter] = useState<'ALL' | AutoRuleType>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [onlyUnrecorded, setOnlyUnrecorded] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected candidates state (set of draft IDs)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());

  // Evaluator name default for general presence rules
  const defaultGeneralEvaluator = useMemo(() => {
    if (userSession?.displayName) {
      const matchTeacher = teachers.find(t => 
        t.name.toLowerCase() === userSession.displayName.toLowerCase() ||
        (userSession.nipOrNisn && t.nip === userSession.nipOrNisn)
      );
      if (matchTeacher) return matchTeacher.name;
      return userSession.displayName;
    }
    return teachers[0]?.name || 'Sistem Penilaian Otomatis Presensi';
  }, [userSession, teachers]);

  const [generalEvaluatorName, setGeneralEvaluatorName] = useState<string>(defaultGeneralEvaluator);

  // Find or determine matching traits from trait list
  const lateTrait = useMemo(() => {
    return traits.find(t => 
      t.type === 'NEGATIF' && 
      (t.name.toLowerCase().includes('terlambat') || t.name.toLowerCase().includes('masuk sekolah'))
    ) || traits.find(t => t.type === 'NEGATIF') || {
      id: 'trait-auto-late',
      name: 'Terlambat Masuk Sekolah',
      type: 'NEGATIF' as const,
      points: latePoints,
      category: 'Kedisiplinan'
    };
  }, [traits, latePoints]);

  const alpaTrait = useMemo(() => {
    return traits.find(t => 
      t.type === 'NEGATIF' && 
      (t.name.toLowerCase().includes('alpa') || t.name.toLowerCase().includes('membolos') || t.name.toLowerCase().includes('tanpa keterangan'))
    ) || traits.find(t => t.type === 'NEGATIF') || {
      id: 'trait-auto-alpa',
      name: 'Alpa / Tanpa Keterangan',
      type: 'NEGATIF' as const,
      points: alpaPoints,
      category: 'Kedisiplinan'
    };
  }, [traits, alpaPoints]);

  const disruptiveTrait = useMemo(() => {
    return traits.find(t => 
      t.type === 'NEGATIF' && 
      (t.name.toLowerCase().includes('mengganggu') || t.name.toLowerCase().includes('kbm') || t.name.toLowerCase().includes('gaduh') || t.name.toLowerCase().includes('ribut'))
    ) || traits.find(t => t.type === 'NEGATIF') || {
      id: 'trait-auto-disruptive',
      name: 'Mengganggu KBM di Kelas',
      type: 'NEGATIF' as const,
      points: disruptivePoints,
      category: 'Kedisiplinan & Sikap'
    };
  }, [traits, disruptivePoints]);

  const absentKbmTrait = useMemo(() => {
    return traits.find(t => 
      t.type === 'NEGATIF' && 
      (t.name.toLowerCase().includes('tidak hadir di kelas') || t.name.toLowerCase().includes('absen di kelas') || t.name.toLowerCase().includes('membolos jam') || t.name.toLowerCase().includes('tidak hadir'))
    ) || traits.find(t => t.type === 'NEGATIF') || {
      id: 'trait-auto-absent-kbm',
      name: 'Tidak Hadir di Kelas saat KBM',
      type: 'NEGATIF' as const,
      points: absentKbmPoints,
      category: 'Kedisiplinan'
    };
  }, [traits, absentKbmPoints]);

  const veryActiveKbmTrait = useMemo(() => {
    return traits.find(t => 
      t.type === 'POSITIF' && 
      (t.name.toLowerCase().includes('sangat aktif') || t.name.toLowerCase().includes('aktif bertanya') || t.name.toLowerCase().includes('keaktifan') || t.name.toLowerCase().includes('aktif'))
    ) || traits.find(t => t.type === 'POSITIF') || {
      id: 'trait-auto-very-active-kbm',
      name: 'Sangat Aktif saat KBM',
      type: 'POSITIF' as const,
      points: veryActiveKbmPoints,
      category: 'Keaktifan & Prestasi'
    };
  }, [traits, veryActiveKbmPoints]);

  const onTimeTrait = useMemo(() => {
    return traits.find(t => 
      t.type === 'POSITIF' && 
      (t.name.toLowerCase().includes('tepat waktu') || t.name.toLowerCase().includes('disiplin') || t.name.toLowerCase().includes('hadir tepat'))
    ) || traits.find(t => t.type === 'POSITIF') || {
      id: 'trait-auto-ontime',
      name: 'Datang Tepat Waktu',
      type: 'POSITIF' as const,
      points: onTimePoints,
      category: 'Kedisiplinan'
    };
  }, [traits, onTimePoints]);

  // Compute all potential candidates from Attendance Records & Jurnal KBM
  const allCandidates = useMemo<AutoCharacterCandidate[]>(() => {
    if (!isOpen) return [];

    const candidates: AutoCharacterCandidate[] = [];
    const studentMap = new Map<string, Student>();
    students.forEach(s => studentMap.set(s.id, s));

    // 1. Group attendance records by student
    const studentAttendanceMap = new Map<string, AttendanceRecord[]>();
    attendanceRecords.forEach(rec => {
      if (!studentAttendanceMap.has(rec.studentId)) {
        studentAttendanceMap.set(rec.studentId, []);
      }
      studentAttendanceMap.get(rec.studentId)!.push(rec);
    });

    // 2. Process attendance records (Late, Alpa, On-Time 3 Days)
    students.forEach(student => {
      const records = studentAttendanceMap.get(student.id) || [];
      const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));

      // Rule 1: Terlambat Masuk Sekolah -> Nilai Karakter Negatif (-latePoints)
      sortedRecords.forEach(rec => {
        if (rec.status === 'TERLAMBAT') {
          const isAlready = characterLogs.some(l => 
            l.studentId === student.id && 
            l.date === rec.date && 
            (l.traitType === 'NEGATIF' && (l.traitName.toLowerCase().includes('terlambat') || l.notes?.toLowerCase().includes('terlambat') || l.notes?.toLowerCase().includes('otomatis')))
          );

          candidates.push({
            id: `auto-late-${student.id}-${rec.date}`,
            studentId: student.id,
            studentName: student.name,
            nisn: student.nisn,
            classId: student.classId,
            className: student.className,
            ruleType: 'LATE',
            ruleLabel: 'Terlambat Masuk Sekolah',
            traitId: lateTrait.id,
            traitName: lateTrait.name || 'Terlambat Masuk Sekolah',
            traitType: 'NEGATIF',
            points: latePoints,
            date: rec.date,
            evaluatorName: generalEvaluatorName || 'Sistem Presensi QR',
            notes: `Penilaian Otomatis Presensi: Scan Hadir Terlambat pukul ${rec.time || 'Pagi'} (${rec.date})`,
            attendanceDates: [rec.date],
            sourceType: 'PRESENSI',
            isSelected: !isAlready,
            isAlreadyLogged: isAlready,
          });
        }

        // Rule 2: Alpa -> Nilai Karakter Negatif (-alpaPoints)
        if (rec.status === 'ALPA') {
          const isAlready = characterLogs.some(l => 
            l.studentId === student.id && 
            l.date === rec.date && 
            (l.traitType === 'NEGATIF' && (l.traitName.toLowerCase().includes('alpa') || l.notes?.toLowerCase().includes('alpa') || l.notes?.toLowerCase().includes('otomatis')))
          );

          candidates.push({
            id: `auto-alpa-${student.id}-${rec.date}`,
            studentId: student.id,
            studentName: student.name,
            nisn: student.nisn,
            classId: student.classId,
            className: student.className,
            ruleType: 'ALPA',
            ruleLabel: 'Alpa / Tanpa Keterangan',
            traitId: alpaTrait.id,
            traitName: alpaTrait.name || 'Alpa Tanpa Keterangan',
            traitType: 'NEGATIF',
            points: alpaPoints,
            date: rec.date,
            evaluatorName: generalEvaluatorName || 'Sistem Presensi QR',
            notes: `Penilaian Otomatis Presensi: Terekam Alpa pada tanggal ${rec.date}`,
            attendanceDates: [rec.date],
            sourceType: 'PRESENSI',
            isSelected: !isAlready,
            isAlreadyLogged: isAlready,
          });
        }
      });

      // Rule: Datang Tepat Waktu (HADIR) selama 3 hari -> Nilai Karakter Positif (+onTimePoints)
      const onTimeRecords = sortedRecords.filter(r => r.status === 'HADIR');
      if (onTimeRecords.length >= onTimeRequiredDays) {
        const totalGroups = Math.floor(onTimeRecords.length / onTimeRequiredDays);
        for (let g = 0; g < totalGroups; g++) {
          const groupRecords = onTimeRecords.slice(g * onTimeRequiredDays, (g + 1) * onTimeRequiredDays);
          const lastRecord = groupRecords[groupRecords.length - 1];
          const datesFormatted = groupRecords.map(r => r.date).join(', ');
          const targetDate = lastRecord.date;

          const isAlready = characterLogs.some(l => 
            l.studentId === student.id && 
            (l.notes?.includes(datesFormatted) || (l.date === targetDate && l.traitType === 'POSITIF' && l.traitName.toLowerCase().includes('tepat waktu')))
          );

          candidates.push({
            id: `auto-ontime-${student.id}-group-${g}-${targetDate}`,
            studentId: student.id,
            studentName: student.name,
            nisn: student.nisn,
            classId: student.classId,
            className: student.className,
            ruleType: 'ON_TIME_3_DAYS',
            ruleLabel: `Datang Tepat Waktu (${onTimeRequiredDays} Hari)`,
            traitId: onTimeTrait.id,
            traitName: onTimeTrait.name || 'Datang Tepat Waktu',
            traitType: 'POSITIF',
            points: onTimePoints,
            date: targetDate,
            evaluatorName: generalEvaluatorName || 'Sistem Presensi QR',
            notes: `Penilaian Otomatis Presensi: Datang Tepat Waktu ${onTimeRequiredDays} hari (${datesFormatted})`,
            attendanceDates: groupRecords.map(r => r.date),
            sourceType: 'PRESENSI',
            isSelected: !isAlready,
            isAlreadyLogged: isAlready,
          });
        }
      }
    });

    // 3. Process Jurnal KBM entries (Mengganggu, Tidak Hadir di Kelas, Sangat Aktif)
    learningJournals.forEach(journal => {
      if (!journal.studentAttendances || !Array.isArray(journal.studentAttendances)) return;

      journal.studentAttendances.forEach(sa => {
        const student = studentMap.get(sa.studentId) || students.find(s => 
          s.id === sa.studentId || 
          (sa.nisn && s.nisn === sa.nisn) || 
          s.name.toLowerCase() === sa.studentName.toLowerCase()
        );

        const sId = student?.id || sa.studentId;
        const sName = student?.name || sa.studentName;
        const sNisn = student?.nisn || sa.nisn || '-';
        const cId = student?.classId || journal.classId;
        const cName = student?.className || journal.className;
        const teacherEvaluator = journal.teacherName?.trim() || 'Guru Pengampu KBM';

        const noteDetails = sa.notes ? ` (Catatan: ${sa.notes})` : '';
        const periodsText = journal.periods && journal.periods.length > 0 ? ` (Jam ke-${journal.periods.join(', ')})` : '';

        // Jurnal KBM - A. Status: 'Mengganggu' -> Negatif (disruptivePoints, default 1)
        if (sa.status === 'Mengganggu') {
          const isAlready = characterLogs.some(l => 
            l.studentId === sId && 
            l.date === journal.date && 
            (
              (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('mengganggu') && (l.evaluatorName.toLowerCase() === teacherEvaluator.toLowerCase() || l.notes?.includes(journal.subject))) ||
              l.notes?.includes(`Jurnal KBM ${journal.subject}`) ||
              (l.notes?.toLowerCase().includes('mengganggu') && l.notes?.toLowerCase().includes(journal.subject.toLowerCase()))
            )
          );

          candidates.push({
            id: `auto-disruptive-${journal.id}-${sId}`,
            studentId: sId,
            studentName: sName,
            nisn: sNisn,
            classId: cId,
            className: cName,
            ruleType: 'DISRUPTIVE_KBM',
            ruleLabel: 'Mengganggu KBM di Kelas',
            traitId: disruptiveTrait.id,
            traitName: disruptiveTrait.name || 'Mengganggu KBM di Kelas',
            traitType: 'NEGATIF',
            points: disruptivePoints,
            date: journal.date,
            evaluatorName: teacherEvaluator,
            notes: `Penilaian Otomatis Jurnal KBM: Mengganggu saat KBM Mapel ${journal.subject}${periodsText} - Guru: ${teacherEvaluator}${noteDetails}`,
            attendanceDates: [journal.date],
            sourceType: 'JURNAL_KBM',
            subjectName: journal.subject,
            isSelected: !isAlready,
            isAlreadyLogged: isAlready,
          });
        }

        // Jurnal KBM - B. Status: 'Tidak hadir di kelas' -> Negatif (absentKbmPoints, default 2)
        if (sa.status === 'Tidak hadir di kelas') {
          const isAlready = characterLogs.some(l => 
            l.studentId === sId && 
            l.date === journal.date && 
            (
              (l.traitType === 'NEGATIF' && (l.traitName.toLowerCase().includes('tidak hadir') || l.traitName.toLowerCase().includes('bolos') || l.traitName.toLowerCase().includes('absen')) && (l.evaluatorName.toLowerCase() === teacherEvaluator.toLowerCase() || l.notes?.includes(journal.subject))) ||
              (l.notes?.toLowerCase().includes('tidak hadir di kelas') && l.notes?.toLowerCase().includes(journal.subject.toLowerCase()))
            )
          );

          candidates.push({
            id: `auto-absent-kbm-${journal.id}-${sId}`,
            studentId: sId,
            studentName: sName,
            nisn: sNisn,
            classId: cId,
            className: cName,
            ruleType: 'ABSENT_KBM',
            ruleLabel: 'Tidak Hadir di Kelas (KBM)',
            traitId: absentKbmTrait.id,
            traitName: absentKbmTrait.name || 'Tidak Hadir di Kelas saat KBM',
            traitType: 'NEGATIF',
            points: absentKbmPoints,
            date: journal.date,
            evaluatorName: teacherEvaluator,
            notes: `Penilaian Otomatis Jurnal KBM: Tidak hadir di kelas saat KBM Mapel ${journal.subject}${periodsText} - Guru: ${teacherEvaluator}${noteDetails}`,
            attendanceDates: [journal.date],
            sourceType: 'JURNAL_KBM',
            subjectName: journal.subject,
            isSelected: !isAlready,
            isAlreadyLogged: isAlready,
          });
        }

        // Jurnal KBM - C. Status: 'Sangat aktif' -> Positif (veryActiveKbmPoints, default 1)
        if (sa.status === 'Sangat aktif') {
          const isAlready = characterLogs.some(l => 
            l.studentId === sId && 
            l.date === journal.date && 
            (
              (l.traitType === 'POSITIF' && (l.traitName.toLowerCase().includes('sangat aktif') || l.traitName.toLowerCase().includes('keaktifan') || l.traitName.toLowerCase().includes('aktif')) && (l.evaluatorName.toLowerCase() === teacherEvaluator.toLowerCase() || l.notes?.includes(journal.subject))) ||
              (l.notes?.toLowerCase().includes('sangat aktif') && l.notes?.toLowerCase().includes(journal.subject.toLowerCase()))
            )
          );

          candidates.push({
            id: `auto-active-kbm-${journal.id}-${sId}`,
            studentId: sId,
            studentName: sName,
            nisn: sNisn,
            classId: cId,
            className: cName,
            ruleType: 'VERY_ACTIVE_KBM',
            ruleLabel: 'Sangat Aktif saat KBM',
            traitId: veryActiveKbmTrait.id,
            traitName: veryActiveKbmTrait.name || 'Sangat Aktif saat KBM',
            traitType: 'POSITIF',
            points: veryActiveKbmPoints,
            date: journal.date,
            evaluatorName: teacherEvaluator,
            notes: `Penilaian Otomatis Jurnal KBM: Sangat aktif dalam KBM Mapel ${journal.subject}${periodsText} - Guru: ${teacherEvaluator}${noteDetails}`,
            attendanceDates: [journal.date],
            sourceType: 'JURNAL_KBM',
            subjectName: journal.subject,
            isSelected: !isAlready,
            isAlreadyLogged: isAlready,
          });
        }
      });
    });

    // Sort candidates: unrecorded first, then date descending
    return candidates.sort((a, b) => {
      if (a.isAlreadyLogged !== b.isAlreadyLogged) {
        return a.isAlreadyLogged ? 1 : -1;
      }
      return b.date.localeCompare(a.date);
    });
  }, [
    isOpen, 
    students, 
    attendanceRecords, 
    learningJournals,
    characterLogs, 
    latePoints, 
    alpaPoints, 
    disruptivePoints,
    absentKbmPoints,
    veryActiveKbmPoints,
    onTimePoints, 
    onTimeRequiredDays, 
    generalEvaluatorName,
    lateTrait, 
    alpaTrait, 
    disruptiveTrait,
    absentKbmTrait,
    veryActiveKbmTrait,
    onTimeTrait
  ]);

  // Counts by rule and group
  const totalLateCount = useMemo(() => allCandidates.filter(c => c.ruleType === 'LATE').length, [allCandidates]);
  const totalAlpaCount = useMemo(() => allCandidates.filter(c => c.ruleType === 'ALPA').length, [allCandidates]);
  const totalDisruptiveCount = useMemo(() => allCandidates.filter(c => c.ruleType === 'DISRUPTIVE_KBM').length, [allCandidates]);
  const totalAbsentKbmCount = useMemo(() => allCandidates.filter(c => c.ruleType === 'ABSENT_KBM').length, [allCandidates]);
  const totalVeryActiveCount = useMemo(() => allCandidates.filter(c => c.ruleType === 'VERY_ACTIVE_KBM').length, [allCandidates]);
  const totalOnTimeCount = useMemo(() => allCandidates.filter(c => c.ruleType === 'ON_TIME_3_DAYS').length, [allCandidates]);

  const totalPositiveCount = useMemo(() => allCandidates.filter(c => c.traitType === 'POSITIF').length, [allCandidates]);
  const totalNegativeCount = useMemo(() => allCandidates.filter(c => c.traitType === 'NEGATIF').length, [allCandidates]);

  // Initialize selected IDs whenever candidates are re-computed
  React.useEffect(() => {
    if (isOpen) {
      const initialSelected = new Set<string>();
      allCandidates.forEach(c => {
        if (!c.isAlreadyLogged) {
          initialSelected.add(c.id);
        }
      });
      setSelectedCandidateIds(initialSelected);
    }
  }, [isOpen, allCandidates.length]);

  // Filtered view candidates
  const filteredCandidates = useMemo(() => {
    return allCandidates.filter(c => {
      // 1. Group filter: ALL, POSITIF, NEGATIF
      const matchesGroup = groupFilter === 'ALL' || c.traitType === groupFilter;
      
      // 2. Specific rule filter
      const matchesRule = ruleFilter === 'ALL' || c.ruleType === ruleFilter;
      
      // 3. Class filter
      const matchesClass = classFilter === 'ALL' || c.classId === classFilter;
      
      // 4. Record status filter
      const matchesStatus = onlyUnrecorded ? !c.isAlreadyLogged : true;
      
      // 5. Search query
      const matchesSearch = 
        c.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.nisn.includes(searchQuery) ||
        c.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.evaluatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.subjectName && c.subjectName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.ruleLabel.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesGroup && matchesRule && matchesClass && matchesStatus && matchesSearch;
    });
  }, [allCandidates, groupFilter, ruleFilter, classFilter, onlyUnrecorded, searchQuery]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const unrecordedInView = filteredCandidates.filter(c => !c.isAlreadyLogged);
    const allSelected = unrecordedInView.length > 0 && unrecordedInView.every(c => selectedCandidateIds.has(c.id));

    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        unrecordedInView.forEach(c => next.delete(c.id));
      } else {
        unrecordedInView.forEach(c => next.add(c.id));
      }
      return next;
    });
  };

  // Submit and save selected candidates to Character Logs
  const handleProcessSubmit = () => {
    if (!isAutoEnabled) {
      alert('Penilaian Karakter Otomatis saat ini sedang NON-AKTIF. Silakan aktifkan terlebih dahulu tombol di bagian atas.');
      return;
    }

    const toApply = allCandidates.filter(c => selectedCandidateIds.has(c.id) && !c.isAlreadyLogged);

    if (toApply.length === 0) {
      alert('Pilih setidaknya satu data siswa untuk diberikan penilaian otomatis!');
      return;
    }

    const now = new Date();

    const newLogs: StudentCharacterLog[] = toApply.map(c => ({
      id: 'log-auto-' + Date.now() + '-' + Math.random().toString(36).substr(2, 7),
      studentId: c.studentId,
      studentName: c.studentName,
      nisn: c.nisn,
      classId: c.classId,
      className: c.className,
      traitId: c.traitId,
      traitName: c.traitName,
      traitType: c.traitType,
      points: c.points,
      // For JURNAL_KBM rules, evaluator is the teacher who inputted the KBM Journal
      evaluatorName: c.evaluatorName || generalEvaluatorName.trim() || 'Sistem Otomatis',
      timestamp: `${c.date} ${now.toTimeString().substring(0, 8)}`,
      date: c.date,
      notes: c.notes,
      photoProofUrl: undefined,
    }));

    onApplyLogs(newLogs);
    alert(`Berhasil menambahkan ${newLogs.length} catatan penilaian karakter otomatis dari data Presensi & Jurnal KBM!`);
    onClose();
  };

  if (!isOpen) return null;

  const selectedCount = allCandidates.filter(c => selectedCandidateIds.has(c.id) && !c.isAlreadyLogged).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[94vh]">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-5 sm:p-6 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-900 flex items-center justify-center font-extrabold shadow-lg shadow-amber-400/20 shrink-0">
              <Sparkles className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-amber-300 text-xs font-bold mb-1 border border-white/10">
                <span>Sinkronisasi Presensi & Jurnal KBM ke Karakter</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Penilaian Karakter Otomatis
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100/90 mt-0.5">
                Otomatisasi input poin karakter siswa dari Scan Presensi QR & Jurnal Pembelajaran KBM Guru.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          
          {/* Top Control Bar: Saklar Aktif & Non-Aktif Penilaian Karakter Otomatis */}
          <div className={`p-4 sm:p-5 rounded-2xl border-2 transition-all shadow-sm ${
            isAutoEnabled 
              ? 'bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white border-emerald-300' 
              : 'bg-gradient-to-r from-rose-50 via-orange-50/50 to-white border-rose-300'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold shadow-sm shrink-0 transition-all ${
                  isAutoEnabled 
                    ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-4 ring-emerald-100' 
                    : 'bg-rose-600 text-white shadow-rose-600/30 ring-4 ring-rose-100'
                }`}>
                  <Power className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-sm sm:text-base text-slate-900">
                      Status Penilaian Karakter Otomatis
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full border shadow-2xs ${
                      isAutoEnabled
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${isAutoEnabled ? 'bg-emerald-600 animate-ping' : 'bg-rose-600'}`}></span>
                      {isAutoEnabled ? '🟢 SISTEM AKTIF' : '🔴 NON-AKTIF'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                    {isAutoEnabled
                      ? 'Sistem sedang AKTIF memproses sinkronisasi data presensi QR (Terlambat, Alpa, Datang Tepat Waktu) dan catatan Jurnal KBM menjadi nilai karakter siswa.'
                      : 'Sistem TIDAK menjalankan penilaian karakter otomatis (NON-AKTIF). Tidak ada poin karakter yang diproses atau disinkronkan ke siswa.'}
                  </p>
                </div>
              </div>

              {/* Tombol Toggle Aktif / Non-Aktif */}
              <div className="flex items-center gap-1.5 shrink-0 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs">
                <button
                  type="button"
                  onClick={() => handleToggleAutoAssessment(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    isAutoEnabled
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/60 scale-102'
                      : 'bg-transparent text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/80'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aktif</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAutoAssessment(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    !isAutoEnabled
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400/60 scale-102'
                      : 'bg-transparent text-slate-500 hover:text-rose-700 hover:bg-rose-50/80'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span>Non-Aktif</span>
                </button>
              </div>
            </div>

            {/* Peringatan Banner saat Non-Aktif */}
            {!isAutoEnabled && (
              <div className="mt-3.5 pt-3.5 border-t border-rose-200 flex items-start sm:items-center gap-3 text-rose-900 text-xs font-semibold bg-white/90 p-3.5 rounded-xl border border-rose-300">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                <div className="flex-1">
                  <strong className="text-rose-950 block sm:inline font-black">Mode Non-Aktif Sedang Berjalan: </strong>
                  Sistem menghentikan seluruh proses penilaian karakter otomatis. Untuk kembali memproses data, klik tombol <strong>"Aktif"</strong> di sebelah kanan.
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Pengaturan Poin Aturan Otomatis</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Total terdeteksi: <strong>{allCandidates.length}</strong> kandidat ({totalPositiveCount} Positif, {totalNegativeCount} Negatif)
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 1. Rule Positif Baru: Sangat Aktif KBM */}
              <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-300/80 shadow-xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs uppercase tracking-wider">
                      <Flame className="w-4 h-4 text-emerald-600" />
                      <span>Sangat Aktif KBM</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                      🟢 POSITIF
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed mt-1">
                    Status <strong>'Sangat aktif'</strong> pada Jurnal KBM Guru:
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">Nilai:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={veryActiveKbmPoints}
                      onChange={(e) => setVeryActiveKbmPoints(Math.abs(Number(e.target.value)) || 1)}
                      className="w-12 px-1.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-black text-center text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-emerald-700">+Poin</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-900 bg-emerald-100/80 px-2 py-1 rounded-lg border border-emerald-200">
                    {totalVeryActiveCount} Kasus
                  </div>
                </div>
              </div>

              {/* 2. Rule Negatif Baru: Tidak Hadir di Kelas KBM */}
              <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-300 shadow-xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-rose-800 font-black text-xs uppercase tracking-wider">
                      <UserX className="w-4 h-4 text-rose-600" />
                      <span>Tidak Hadir di Kelas (KBM)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-200">
                      🔴 NEGATIF
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed mt-1">
                    Status <strong>'Tidak hadir di kelas'</strong> pada Jurnal KBM:
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-rose-200/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">Nilai:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={absentKbmPoints}
                      onChange={(e) => setAbsentKbmPoints(Math.abs(Number(e.target.value)) || 2)}
                      className="w-12 px-1.5 py-1 bg-white border border-rose-300 rounded-lg text-xs font-black text-center text-rose-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <span className="text-xs font-bold text-rose-700">-Poin</span>
                  </div>
                  <div className="text-xs font-bold text-rose-900 bg-rose-100/80 px-2 py-1 rounded-lg border border-rose-200">
                    {totalAbsentKbmCount} Kasus
                  </div>
                </div>
              </div>

              {/* 3. Rule Negatif: Mengganggu KBM */}
              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-300 shadow-xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-amber-800 font-black text-xs uppercase tracking-wider">
                      <VolumeX className="w-4 h-4 text-amber-600" />
                      <span>Mengganggu KBM</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-200">
                      🔴 NEGATIF
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed mt-1">
                    Status <strong>'Mengganggu'</strong> pada Jurnal KBM Guru:
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-amber-200/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">Nilai:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={disruptivePoints}
                      onChange={(e) => setDisruptivePoints(Math.abs(Number(e.target.value)) || 1)}
                      className="w-12 px-1.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-black text-center text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-amber-700">-Poin</span>
                  </div>
                  <div className="text-xs font-bold text-amber-900 bg-amber-100/80 px-2 py-1 rounded-lg border border-amber-200">
                    {totalDisruptiveCount} Kasus
                  </div>
                </div>
              </div>

              {/* 4. Rule Positif: Datang Tepat Waktu Presensi */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                      <CalendarCheck2 className="w-4 h-4" />
                      <span>Tepat Waktu ({onTimeRequiredDays} Hari)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      🟢 POSITIF
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed mt-1">
                    Hadir tepat waktu berturut-turut pada Presensi:
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">Nilai:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={onTimePoints}
                      onChange={(e) => setOnTimePoints(Math.abs(Number(e.target.value)) || 1)}
                      className="w-12 px-1.5 py-1 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs font-black text-center text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-emerald-600">+Poin</span>
                  </div>
                  <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                    {totalOnTimeCount} Paket
                  </div>
                </div>
              </div>

              {/* 5. Rule Negatif: Terlambat Masuk Sekolah */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs uppercase tracking-wider">
                      <Clock className="w-4 h-4" />
                      <span>Terlambat Sekolah</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                      🔴 NEGATIF
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed mt-1">
                    Scan hadir terlambat pada Presensi Sekolah:
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">Nilai:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={latePoints}
                      onChange={(e) => setLatePoints(Math.abs(Number(e.target.value)) || 2)}
                      className="w-12 px-1.5 py-1 bg-red-50/70 border border-red-200 rounded-lg text-xs font-black text-center text-red-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <span className="text-xs font-bold text-red-600">-Poin</span>
                  </div>
                  <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                    {totalLateCount} Kasus
                  </div>
                </div>
              </div>

              {/* 6. Rule Negatif: Siswa Alpa */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs uppercase tracking-wider">
                      <UserX className="w-4 h-4" />
                      <span>Siswa Alpa</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                      🔴 NEGATIF
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed mt-1">
                    Terekam status Alpa pada Presensi Sekolah:
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">Nilai:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={alpaPoints}
                      onChange={(e) => setAlpaPoints(Math.abs(Number(e.target.value)) || 5)}
                      className="w-12 px-1.5 py-1 bg-rose-50/70 border border-rose-200 rounded-lg text-xs font-black text-center text-rose-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <span className="text-xs font-bold text-rose-600">-Poin</span>
                  </div>
                  <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                    {totalAlpaCount} Kasus
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Evaluator Name Config for Presensi */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                Nama Penilai Default Presensi (Catatan: Kasus Jurnal KBM dinilai langsung oleh Guru Pengampu terkait):
              </span>
            </div>
            <input
              type="text"
              value={generalEvaluatorName}
              onChange={(e) => setGeneralEvaluatorName(e.target.value)}
              placeholder="Contoh: Sistem Presensi Otomatis / Nama Guru"
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter Panel & Candidate List Controls */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3.5">
            
            {/* TOMBOL KELOMPOK KARAKTER UTAMA: POSITIF vs NEGATIF vs SEMUA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-100/70 p-2 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-xs font-black text-slate-600 uppercase tracking-wider px-2 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Kelompok Karakter:</span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto">
                {/* 1. Semua Kelompok */}
                <button
                  type="button"
                  onClick={() => {
                    setGroupFilter('ALL');
                    setRuleFilter('ALL');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    groupFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-slate-900/20 scale-102'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Semua</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${groupFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {allCandidates.length}
                  </span>
                </button>

                {/* 2. Kelompok Karakter POSITIF */}
                <button
                  type="button"
                  onClick={() => {
                    setGroupFilter('POSITIF');
                    if (ruleFilter !== 'ALL' && ruleFilter !== 'VERY_ACTIVE_KBM' && ruleFilter !== 'ON_TIME_3_DAYS') {
                      setRuleFilter('ALL');
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    groupFilter === 'POSITIF'
                      ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/40 scale-102'
                      : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-500 group-hover:text-emerald-700" />
                  <span>Positif</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${groupFilter === 'POSITIF' ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-900'}`}>
                    {totalPositiveCount}
                  </span>
                </button>

                {/* 3. Kelompok Karakter NEGATIF */}
                <button
                  type="button"
                  onClick={() => {
                    setGroupFilter('NEGATIF');
                    if (ruleFilter === 'VERY_ACTIVE_KBM' || ruleFilter === 'ON_TIME_3_DAYS') {
                      setRuleFilter('ALL');
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    groupFilter === 'NEGATIF'
                      ? 'bg-rose-600 text-white shadow-rose-600/30 ring-2 ring-rose-400/40 scale-102'
                      : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5 text-rose-500 group-hover:text-rose-700" />
                  <span>Negatif</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${groupFilter === 'NEGATIF' ? 'bg-white text-rose-800' : 'bg-rose-100 text-rose-900'}`}>
                    {totalNegativeCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Sub-Filters: Rules Pills, Class Selector, & Checkbox */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pt-1">
              {/* Specific Rule Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1.5 lg:pb-0 text-xs">
                <button
                  onClick={() => setRuleFilter('ALL')}
                  className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 text-xs ${
                    ruleFilter === 'ALL'
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Aturan
                </button>

                {/* Positif: Sangat Aktif */}
                {(groupFilter === 'ALL' || groupFilter === 'POSITIF') && (
                  <button
                    onClick={() => setRuleFilter('VERY_ACTIVE_KBM')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 text-xs flex items-center gap-1 ${
                      ruleFilter === 'VERY_ACTIVE_KBM'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                    }`}
                  >
                    <Flame className="w-3 h-3" />
                    <span>Sangat Aktif KBM ({totalVeryActiveCount})</span>
                  </button>
                )}

                {/* Positif: Tepat Waktu */}
                {(groupFilter === 'ALL' || groupFilter === 'POSITIF') && (
                  <button
                    onClick={() => setRuleFilter('ON_TIME_3_DAYS')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 text-xs flex items-center gap-1 ${
                      ruleFilter === 'ON_TIME_3_DAYS'
                        ? 'bg-teal-600 text-white'
                        : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/60'
                    }`}
                  >
                    <CalendarCheck2 className="w-3 h-3" />
                    <span>Tepat Waktu ({totalOnTimeCount})</span>
                  </button>
                )}

                {/* Negatif: Tidak Hadir di Kelas KBM */}
                {(groupFilter === 'ALL' || groupFilter === 'NEGATIF') && (
                  <button
                    onClick={() => setRuleFilter('ABSENT_KBM')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 text-xs flex items-center gap-1 ${
                      ruleFilter === 'ABSENT_KBM'
                        ? 'bg-rose-700 text-white'
                        : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
                    }`}
                  >
                    <UserX className="w-3 h-3" />
                    <span>Tidak Hadir KBM ({totalAbsentKbmCount})</span>
                  </button>
                )}

                {/* Negatif: Mengganggu KBM */}
                {(groupFilter === 'ALL' || groupFilter === 'NEGATIF') && (
                  <button
                    onClick={() => setRuleFilter('DISRUPTIVE_KBM')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 text-xs flex items-center gap-1 ${
                      ruleFilter === 'DISRUPTIVE_KBM'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                    }`}
                  >
                    <VolumeX className="w-3 h-3" />
                    <span>Mengganggu KBM ({totalDisruptiveCount})</span>
                  </button>
                )}

                {/* Negatif: Terlambat */}
                {(groupFilter === 'ALL' || groupFilter === 'NEGATIF') && (
                  <button
                    onClick={() => setRuleFilter('LATE')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 text-xs flex items-center gap-1 ${
                      ruleFilter === 'LATE'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>Terlambat ({totalLateCount})</span>
                  </button>
                )}

                {/* Negatif: Alpa */}
                {(groupFilter === 'ALL' || groupFilter === 'NEGATIF') && (
                  <button
                    onClick={() => setRuleFilter('ALPA')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 text-xs flex items-center gap-1 ${
                      ruleFilter === 'ALPA'
                        ? 'bg-red-700 text-white'
                        : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200/60'
                    }`}
                  >
                    <UserX className="w-3 h-3" />
                    <span>Alpa ({totalAlpaCount})</span>
                  </button>
                )}
              </div>

              {/* Class Filter & Checkbox Only Unrecorded */}
              <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer select-none bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={onlyUnrecorded}
                    onChange={(e) => setOnlyUnrecorded(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Belum Dinilai</span>
                </label>
              </div>
            </div>

            {/* Search and Select All Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Pilih Semua di Tampilan</span>
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  {selectedCount} item dipilih untuk diproses
                </span>
              </div>

              <input
                type="text"
                placeholder="Cari nama siswa, NISN, mapel, atau guru..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Candidate Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="p-3 pl-4 w-10 text-center">Pilih</th>
                    <th className="p-3">Siswa & Kelas</th>
                    <th className="p-3">Kelompok & Aturan Sumber</th>
                    <th className="p-3">Guru Penilai</th>
                    <th className="p-3">Tanggal Terkait</th>
                    <th className="p-3 text-center">Nilai Poin</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Tidak ada data yang cocok dengan kriteria filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((candidate) => {
                      const isSelected = selectedCandidateIds.has(candidate.id);
                      return (
                        <tr 
                          key={candidate.id} 
                          className={`hover:bg-indigo-50/40 transition-colors ${
                            candidate.isAlreadyLogged ? 'opacity-60 bg-slate-50/60' : ''
                          }`}
                        >
                          <td className="p-3 pl-4 text-center">
                            <input
                              type="checkbox"
                              disabled={candidate.isAlreadyLogged}
                              checked={isSelected}
                              onChange={() => handleToggleSelect(candidate.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-extrabold text-slate-800">{candidate.studentName}</div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {candidate.className} • NISN: {candidate.nisn}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 font-bold flex-wrap">
                              {candidate.traitType === 'POSITIF' ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[9px]">
                                  🟢 POSITIF
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-[9px]">
                                  🔴 NEGATIF
                                </span>
                              )}

                              {candidate.ruleType === 'VERY_ACTIVE_KBM' && <Flame className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              {candidate.ruleType === 'ABSENT_KBM' && <UserX className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                              {candidate.ruleType === 'LATE' && <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                              {candidate.ruleType === 'ALPA' && <UserX className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                              {candidate.ruleType === 'DISRUPTIVE_KBM' && <VolumeX className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                              {candidate.ruleType === 'ON_TIME_3_DAYS' && <CalendarCheck2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                              
                              <span className={
                                candidate.traitType === 'POSITIF' 
                                  ? 'text-emerald-700 font-extrabold' 
                                  : candidate.ruleType === 'DISRUPTIVE_KBM' 
                                    ? 'text-amber-800 font-extrabold' 
                                    : 'text-rose-700 font-extrabold'
                              }>
                                {candidate.ruleLabel}
                              </span>

                              {candidate.sourceType === 'JURNAL_KBM' && (
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-semibold text-[9px]">
                                  Jurnal KBM
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5" title={candidate.notes}>
                              {candidate.notes}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1 font-bold text-slate-700">
                              <UserCheck className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span className="truncate max-w-[140px]" title={candidate.evaluatorName}>
                                {candidate.evaluatorName}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-slate-600 whitespace-nowrap">
                            {candidate.date}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            {candidate.traitType === 'POSITIF' ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-black rounded-lg text-xs">
                                +{candidate.points} Poin
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-black rounded-lg text-xs">
                                -{candidate.points} Poin
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            {candidate.isAlreadyLogged ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3 text-slate-500" /> Sudah Ada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold text-[10px]">
                                Siap Input
                              </span>
                            )}
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

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            {isAutoEnabled ? (
              <span>Total <strong>{selectedCount}</strong> data nilai karakter ({groupFilter === 'ALL' ? 'Positif & Negatif' : groupFilter}) akan dimasukkan ke log siswa.</span>
            ) : (
              <span className="text-rose-600 font-bold flex items-center gap-1.5 justify-center sm:justify-start">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Sistem Penilaian Karakter Otomatis sedang Non-Aktif. Tidak ada data yang dapat disimpan.
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer w-full sm:w-auto"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleProcessSubmit}
              disabled={!isAutoEnabled || selectedCount === 0}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 font-extrabold text-xs rounded-xl shadow-lg transition-all transform active:scale-95 cursor-pointer w-full sm:w-auto ${
                !isAutoEnabled
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white shadow-indigo-600/30'
              }`}
            >
              {!isAutoEnabled ? (
                <>
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>Sistem Non-Aktif</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Simpan {selectedCount} Nilai Otomatis</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
