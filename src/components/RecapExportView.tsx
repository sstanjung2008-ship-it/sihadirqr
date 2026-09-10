import React, { useState, useMemo, useEffect } from 'react';
import { 
  AttendanceRecord, 
  Student, 
  SchoolClass, 
  SchoolProfile, 
  LearningJournal, 
  CharacterTrait, 
  StudentCharacterLog, 
  CharacterPredicateSettings,
  StudentGradeAssessment,
  StudentGradeItem
} from '../types';
import { 
  exportAttendancePdf, 
  exportAttendanceExcel,
  exportMonthlyAttendanceMatrixPdf,
  exportMonthlyAttendanceMatrixExcel,
  exportKeaktifanPdf,
  exportKeaktifanExcel,
  exportCharacterPointsPdf,
  exportCharacterPointsExcel,
  exportRecapStudentGradesPdf,
  exportRecapStudentGradesExcel,
  exportStudentGradesPdf,
  exportStudentGradesExcel
} from '../lib/exportUtils';
import { getStudentGradeAssessments } from '../lib/storage';
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  Users,
  Search,
  BookOpen,
  Award,
  UserCheck,
  Sparkles,
  Layers,
  GraduationCap,
  Calculator,
  Eye,
  X,
  BookOpenCheck,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  User
} from 'lucide-react';

interface RecapExportViewProps {
  students: Student[];
  classes: SchoolClass[];
  attendanceRecords: AttendanceRecord[];
  schoolProfile: SchoolProfile;
  learningJournals?: LearningJournal[];
  traits?: CharacterTrait[];
  characterLogs?: StudentCharacterLog[];
  predicateSettings?: CharacterPredicateSettings;
  gradeAssessments?: StudentGradeAssessment[];
}

type RecapMenuType = 'PRESENSI' | 'KEAKTIFAN' | 'KARAKTER' | 'NILAI';

export const RecapExportView: React.FC<RecapExportViewProps> = ({
  students,
  classes,
  attendanceRecords,
  schoolProfile,
  learningJournals = [],
  traits = [],
  characterLogs = [],
  predicateSettings = { minA: 30, minB: 10, minC: 0, minD: -20, minE: -50 },
  gradeAssessments
}) => {
  const [activeMenu, setActiveMenu] = useState<RecapMenuType>('PRESENSI');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>(() => {
    return (schoolProfile?.subjects && schoolProfile.subjects[0]) || "Matematika";
  });
  const [selectedKeaktifanSubject, setSelectedKeaktifanSubject] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'>('MONTHLY');
  const [selectedGradeType, setSelectedGradeType] = useState<'ALL' | 'HARIAN' | 'TUGAS' | 'ULANGAN'>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [selectedAssessmentDetail, setSelectedAssessmentDetail] = useState<StudentGradeAssessment | null>(null);

  // Grade assessments state (loaded from prop or localStorage)
  const [assessmentsList, setAssessmentsList] = useState<StudentGradeAssessment[]>(() => {
    return gradeAssessments || getStudentGradeAssessments();
  });

  // Re-sync assessments if prop updates, activeMenu changes, or storage updates
  useEffect(() => {
    if (gradeAssessments) {
      setAssessmentsList(gradeAssessments);
    } else {
      setAssessmentsList(getStudentGradeAssessments());
    }

    const handleStorageUpdate = () => {
      if (!gradeAssessments) {
        setAssessmentsList(getStudentGradeAssessments());
      }
    };

    window.addEventListener('sihadir_storage_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('sihadir_storage_updated', handleStorageUpdate);
    };
  }, [gradeAssessments, activeMenu]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) =>
      a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  const MONTH_NAMES = [
    { value: 0, label: 'Januari' },
    { value: 1, label: 'Februari' },
    { value: 2, label: 'Maret' },
    { value: 3, label: 'April' },
    { value: 4, label: 'Mei' },
    { value: 5, label: 'Juni' },
    { value: 6, label: 'Juli' },
    { value: 7, label: 'Agustus' },
    { value: 8, label: 'September' },
    { value: 9, label: 'Oktober' },
    { value: 10, label: 'November' },
    { value: 11, label: 'Desember' }
  ];

  const getMonthDateRange = (year: number, month: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      startStr: `${year}-${pad(month + 1)}-01`,
      endStr: `${year}-${pad(month + 1)}-${pad(lastDay)}`
    };
  };

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  const initialRange = useMemo(() => {
    return getMonthDateRange(today.getFullYear(), today.getMonth());
  }, []);

  const [startDate, setStartDate] = useState(initialRange.startStr);
  const [endDate, setEndDate] = useState(initialRange.endStr);

  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    return [currentY - 2, currentY - 1, currentY, currentY + 1, currentY + 2];
  }, []);

  const [attendanceViewMode, setAttendanceViewMode] = useState<'MATRIX' | 'SUMMARY'>('MATRIX');

  // Days in selected month for Daily Attendance Matrix
  const monthlyCalendarDays = useMemo(() => {
    if (filterPeriod !== 'MONTHLY') return [];
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const days: {
      day: number;
      dateStr: string;
      dayShort: string;
      fullDay: string;
      isSunday: boolean;
      isNonActive: boolean;
      isHoliday: boolean;
      holidayName?: string;
    }[] = [];

    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const fullDayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const activeDays = schoolProfile?.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    for (let d = 1; d <= totalDays; d++) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(d)}`;
      const dateObj = new Date(selectedYear, selectedMonth, d);
      const dayOfWeek = dateObj.getDay();
      const dayShort = dayNames[dayOfWeek];
      const fullDay = fullDayNames[dayOfWeek];
      const isNonActive = !activeDays.includes(fullDay);
      const isSunday = dayOfWeek === 0;

      const holidayMatch = (schoolProfile?.holidays || []).find(h => {
        if (h.endDate) return dateStr >= h.date && dateStr <= h.endDate;
        return h.date === dateStr;
      });

      days.push({
        day: d,
        dateStr,
        dayShort,
        fullDay,
        isSunday,
        isNonActive,
        isHoliday: isSunday || isNonActive || !!holidayMatch,
        holidayName: holidayMatch?.name
      });
    }

    return days;
  }, [filterPeriod, selectedYear, selectedMonth, schoolProfile?.activeDays, schoolProfile?.holidays]);

  // Filter students by class and search query (sorted Ascending by student name)
  const filteredStudents = useMemo(() => {
    return students
      .filter(s => {
        const matchesClass = selectedClass === 'ALL' || s.className === selectedClass;
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch = !q || 
          s.name.toLowerCase().includes(q) || 
          (s.nis && s.nis.toLowerCase().includes(q)) || 
          (s.nisn && s.nisn.toLowerCase().includes(q));
        return matchesClass && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }));
  }, [students, selectedClass, searchQuery]);

  // Filter attendance records by date range
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter(r => {
      return r.date >= startDate && r.date <= endDate;
    });
  }, [attendanceRecords, startDate, endDate]);

  // Overall monthly statistics
  const monthlyOverallSummary = useMemo(() => {
    let totalHadir = 0;
    let totalTerlambat = 0;
    let totalPulang = 0;
    let totalIzin = 0;
    let totalSakit = 0;
    let totalAlpa = 0;

    filteredStudents.forEach(std => {
      const stdRecords = filteredRecords.filter(r => r.studentId === std.id || (std.nisn && r.nisn === std.nisn));
      totalHadir += stdRecords.filter(r => r.status === 'HADIR').length;
      totalTerlambat += stdRecords.filter(r => r.status === 'TERLAMBAT').length;
      totalPulang += stdRecords.filter(r => r.returnTime || r.returnStatus === 'PULANG' || r.returnStatus === 'PULANG_TEPAT' || r.returnStatus === 'PULANG_CEPAT').length;
      totalIzin += stdRecords.filter(r => r.status === 'IZIN').length;
      totalSakit += stdRecords.filter(r => r.status === 'SAKIT').length;
      totalAlpa += stdRecords.filter(r => r.status === 'ALPA').length;
    });

    const totalDaysRecorded = totalHadir + totalTerlambat + totalIzin + totalSakit + totalAlpa;
    const avgAttendancePct = totalDaysRecorded > 0 
      ? Math.round(((totalHadir + totalTerlambat) / totalDaysRecorded) * 100) 
      : 0;

    return {
      totalHadir,
      totalTerlambat,
      totalPulang,
      totalIzin,
      totalSakit,
      totalAlpa,
      avgAttendancePct,
      totalStudents: filteredStudents.length
    };
  }, [filteredStudents, filteredRecords]);

  // Adjust dates when period preset changes
  const handlePeriodChange = (p: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM') => {
    setFilterPeriod(p);
    const now = new Date();

    if (p === 'MONTHLY') {
      const { startStr, endStr } = getMonthDateRange(selectedYear, selectedMonth);
      setStartDate(startStr);
      setEndDate(endStr);
    } else if (p === 'WEEKLY') {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (p === 'YEARLY') {
      const start = new Date();
      start.setFullYear(now.getFullYear() - 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  const handleMonthChange = (monthIdx: number) => {
    setSelectedMonth(monthIdx);
    const { startStr, endStr } = getMonthDateRange(selectedYear, monthIdx);
    setStartDate(startStr);
    setEndDate(endStr);
  };

  const handleYearChange = (yearNum: number) => {
    setSelectedYear(yearNum);
    const { startStr, endStr } = getMonthDateRange(yearNum, selectedMonth);
    setStartDate(startStr);
    setEndDate(endStr);
  };

  // Available subjects for filter
  const availableSubjects = useMemo(() => {
    const defaultList = schoolProfile?.subjects || [
      "Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS", 
      "Pendidikan Agama", "PJOK", "Seni Budaya", "Informatika", "PPKn"
    ];
    const subjectsFromAssessments = assessmentsList.map(a => a.subject).filter(Boolean);
    const subjectsFromJournals = learningJournals.map(j => j.subject).filter(Boolean);
    return Array.from(new Set([...defaultList, ...subjectsFromAssessments, ...subjectsFromJournals]));
  }, [schoolProfile?.subjects, assessmentsList, learningJournals]);

  // Keep selectedSubject valid if available subjects change
  useEffect(() => {
    if (availableSubjects.length > 0) {
      if (!selectedSubject || selectedSubject === 'ALL' || !availableSubjects.includes(selectedSubject)) {
        setSelectedSubject(availableSubjects[0]);
      }
    }
  }, [availableSubjects, selectedSubject]);

  // Filter journals by date range, class, and subject
  const filteredJournals = useMemo(() => {
    return learningJournals.filter(j => {
      const matchesDate = j.date >= startDate && j.date <= endDate;
      const matchesClass = selectedClass === 'ALL' || j.className === selectedClass;
      const matchesSubject = selectedKeaktifanSubject === 'ALL' || !selectedKeaktifanSubject || j.subject === selectedKeaktifanSubject;
      return matchesDate && matchesClass && matchesSubject;
    });
  }, [learningJournals, startDate, endDate, selectedClass, selectedKeaktifanSubject]);

  // Filter character logs by date range
  const filteredCharacterLogs = useMemo(() => {
    return characterLogs.filter(l => {
      if (l.date) {
        return l.date >= startDate && l.date <= endDate;
      }
      return true;
    });
  }, [characterLogs, startDate, endDate]);

  // Filter grade assessments by date range, class, and subject
  const filteredAssessments = useMemo(() => {
    return assessmentsList.filter(a => {
      const matchesDate = a.date >= startDate && a.date <= endDate;
      const matchesClass = selectedClass === 'ALL' || a.className === selectedClass;
      const matchesSubject = !selectedSubject || a.subject === selectedSubject;
      return matchesDate && matchesClass && matchesSubject;
    });
  }, [assessmentsList, startDate, endDate, selectedClass, selectedSubject]);

  // Flattened student grade items for Detailed Mode in NILAI
  const detailedGradeRows = useMemo(() => {
    const rows: {
      id: string;
      assessmentId: string;
      date: string;
      className: string;
      subject: string;
      material: string;
      teacherName: string;
      studentId: string;
      studentName: string;
      nisn?: string;
      nis?: string;
      dailyScore: number | null;
      assignmentScore: number | null;
      examScore: number | null;
      finalScore: number | null;
      predicate: string;
      notes: string;
      originalAssessment: StudentGradeAssessment;
    }[] = [];

    const q = searchQuery.toLowerCase().trim();

    filteredAssessments.forEach(ass => {
      ass.grades.forEach((g, idx) => {
        // Filter by student search query or student in filteredStudents
        const matchesQuery = !q ||
          g.studentName.toLowerCase().includes(q) ||
          (g.nisn && g.nisn.includes(q)) ||
          (g.nis && g.nis.includes(q)) ||
          ass.subject.toLowerCase().includes(q) ||
          ass.material.toLowerCase().includes(q) ||
          ass.teacherName.toLowerCase().includes(q);

        const matchesStudentList = filteredStudents.some(
          s => s.id === g.studentId || (g.nisn && s.nisn === g.nisn) || s.name.toLowerCase() === g.studentName.toLowerCase()
        );

        if (matchesQuery && (matchesStudentList || selectedClass === 'ALL')) {
          const finalSc = g.finalScore ?? (
            (g.dailyScore !== null || g.assignmentScore !== null || g.examScore !== null)
              ? Number((
                  ((g.dailyScore || 0) + (g.assignmentScore || 0) + (g.examScore || 0)) /
                  ((g.dailyScore !== null ? 1 : 0) + (g.assignmentScore !== null ? 1 : 0) + (g.examScore !== null ? 1 : 0) || 1)
                ).toFixed(1))
              : null
          );

          let pred = g.predicate || '';
          if (!pred && finalSc !== null) {
            pred = finalSc >= 85 ? 'A (Sangat Baik)' : finalSc >= 75 ? 'B (Baik)' : finalSc >= 60 ? 'C (Cukup)' : 'D (Kurang)';
          }

          rows.push({
            id: `${ass.id}-${g.studentId || idx}`,
            assessmentId: ass.id,
            date: ass.date,
            className: ass.className,
            subject: ass.subject,
            material: ass.material,
            teacherName: ass.teacherName,
            studentId: g.studentId,
            studentName: g.studentName,
            nisn: g.nisn,
            nis: g.nis,
            dailyScore: g.dailyScore,
            assignmentScore: g.assignmentScore,
            examScore: g.examScore,
            finalScore: finalSc,
            predicate: pred,
            notes: g.notes || '',
            originalAssessment: ass
          });
        }
      });
    });

    return rows.sort((a, b) => 
      a.studentName.localeCompare(b.studentName, 'id', { numeric: true, sensitivity: 'base' }) || 
      b.date.localeCompare(a.date)
    );
  }, [filteredAssessments, searchQuery, filteredStudents, selectedClass]);

  // Chronological assessment columns (earliest to latest) for NH1, NH2..., NT1, NT2..., NU1, NU2...
  const chronologicalAssessments = useMemo(() => {
    return [...filteredAssessments].sort((a, b) => 
      a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '')
    );
  }, [filteredAssessments]);

  // Assessments containing Nilai Harian (NH1, NH2, NH3...)
  const harianAssessmentColumns = useMemo(() => {
    return chronologicalAssessments.filter(ass => 
      ass.grades && ass.grades.some(g => g.dailyScore !== null && g.dailyScore !== undefined)
    );
  }, [chronologicalAssessments]);

  // Assessments containing Nilai Tugas (NT1, NT2, NT3...)
  const tugasAssessmentColumns = useMemo(() => {
    return chronologicalAssessments.filter(ass => 
      ass.grades && ass.grades.some(g => g.assignmentScore !== null && g.assignmentScore !== undefined)
    );
  }, [chronologicalAssessments]);

  // Assessments containing Nilai Ulangan (NU1, NU2, NU3...)
  const ulanganAssessmentColumns = useMemo(() => {
    return chronologicalAssessments.filter(ass => 
      ass.grades && ass.grades.some(g => g.examScore !== null && g.examScore !== undefined)
    );
  }, [chronologicalAssessments]);

  // Student Grade Matrix with chronological NH1..NHn, NT1..NTn, NU1..NUn
  const studentGradeMatrix = useMemo(() => {
    return filteredStudents.map((std, idx) => {
      const nhScores = harianAssessmentColumns.map(ass => {
        const item = ass.grades?.find(g => g.studentId === std.id || (g.nisn && std.nisn === g.nisn) || g.studentName.toLowerCase() === std.name.toLowerCase());
        return {
          score: item?.dailyScore ?? null,
          assessment: ass,
          notes: item?.notes || ''
        };
      });

      const ntScores = tugasAssessmentColumns.map(ass => {
        const item = ass.grades?.find(g => g.studentId === std.id || (g.nisn && std.nisn === g.nisn) || g.studentName.toLowerCase() === std.name.toLowerCase());
        return {
          score: item?.assignmentScore ?? null,
          assessment: ass,
          notes: item?.notes || ''
        };
      });

      const nuScores = ulanganAssessmentColumns.map(ass => {
        const item = ass.grades?.find(g => g.studentId === std.id || (g.nisn && std.nisn === g.nisn) || g.studentName.toLowerCase() === std.name.toLowerCase());
        return {
          score: item?.examScore ?? null,
          assessment: ass,
          notes: item?.notes || ''
        };
      });

      const validNh = nhScores.filter(s => s.score !== null).map(s => s.score as number);
      const validNt = ntScores.filter(s => s.score !== null).map(s => s.score as number);
      const validNu = nuScores.filter(s => s.score !== null).map(s => s.score as number);

      const avgNh = validNh.length > 0 ? Number((validNh.reduce((a, b) => a + b, 0) / validNh.length).toFixed(1)) : null;
      const avgNt = validNt.length > 0 ? Number((validNt.reduce((a, b) => a + b, 0) / validNt.length).toFixed(1)) : null;
      const avgNu = validNu.length > 0 ? Number((validNu.reduce((a, b) => a + b, 0) / validNu.length).toFixed(1)) : null;

      const validAvgs = [avgNh, avgNt, avgNu].filter((v): v is number => v !== null);
      const finalScore = validAvgs.length > 0 ? Number((validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length).toFixed(1)) : null;

      let predicate = '-';
      let isTuntas = false;

      let displayScore: number | null = finalScore;
      if (selectedGradeType === 'HARIAN') displayScore = avgNh;
      else if (selectedGradeType === 'TUGAS') displayScore = avgNt;
      else if (selectedGradeType === 'ULANGAN') displayScore = avgNu;

      if (displayScore !== null) {
        if (displayScore >= 85) predicate = 'A (Sangat Baik)';
        else if (displayScore >= 75) predicate = 'B (Baik)';
        else if (displayScore >= 60) predicate = 'C (Cukup)';
        else predicate = 'D (Kurang)';
        isTuntas = displayScore >= 75;
      }

      return {
        no: idx + 1,
        student: std,
        nhScores,
        ntScores,
        nuScores,
        avgNh,
        avgNt,
        avgNu,
        finalScore,
        displayScore,
        predicate,
        isTuntas
      };
    });
  }, [filteredStudents, harianAssessmentColumns, tugasAssessmentColumns, ulanganAssessmentColumns, selectedGradeType]);

  // Grade category counts for badge indicators
  const gradeCategoryCounts = useMemo(() => {
    return { 
      countAll: chronologicalAssessments.length, 
      countHarian: harianAssessmentColumns.length, 
      countTugas: tugasAssessmentColumns.length, 
      countUlangan: ulanganAssessmentColumns.length 
    };
  }, [chronologicalAssessments, harianAssessmentColumns, tugasAssessmentColumns, ulanganAssessmentColumns]);

  // Filtered rows for detailed view based on selectedGradeType
  const displayDetailedGradeRows = useMemo(() => {
    if (selectedGradeType === 'HARIAN') {
      return detailedGradeRows.filter(r => r.dailyScore !== null && r.dailyScore !== undefined);
    }
    if (selectedGradeType === 'TUGAS') {
      return detailedGradeRows.filter(r => r.assignmentScore !== null && r.assignmentScore !== undefined);
    }
    if (selectedGradeType === 'ULANGAN') {
      return detailedGradeRows.filter(r => r.examScore !== null && r.examScore !== undefined);
    }
    return detailedGradeRows;
  }, [detailedGradeRows, selectedGradeType]);

  // Overall metrics calculation for NILAI
  const gradeStats = useMemo(() => {
    let sumHarian = 0, countHarian = 0;
    let sumTugas = 0, countTugas = 0;
    let sumUlangan = 0, countUlangan = 0;
    let sumFinal = 0, countFinal = 0;
    let tuntasCount = 0;

    detailedGradeRows.forEach(r => {
      if (r.dailyScore !== null && r.dailyScore !== undefined) {
        sumHarian += r.dailyScore;
        countHarian++;
      }
      if (r.assignmentScore !== null && r.assignmentScore !== undefined) {
        sumTugas += r.assignmentScore;
        countTugas++;
      }
      if (r.examScore !== null && r.examScore !== undefined) {
        sumUlangan += r.examScore;
        countUlangan++;
      }
      if (r.finalScore !== null && r.finalScore !== undefined) {
        sumFinal += r.finalScore;
        countFinal++;
        if (r.finalScore >= 75) {
          tuntasCount++;
        }
      }
    });

    const avgHarian = countHarian > 0 ? (sumHarian / countHarian).toFixed(1) : '-';
    const avgTugas = countTugas > 0 ? (sumTugas / countTugas).toFixed(1) : '-';
    const avgUlangan = countUlangan > 0 ? (sumUlangan / countUlangan).toFixed(1) : '-';
    const avgFinal = countFinal > 0 ? (sumFinal / countFinal).toFixed(1) : '-';
    const pctTuntas = countFinal > 0 ? Math.round((tuntasCount / countFinal) * 100) : 0;

    return {
      totalAssessments: filteredAssessments.length,
      totalRows: detailedGradeRows.length,
      avgHarian,
      avgTugas,
      avgUlangan,
      avgFinal,
      pctTuntas,
      tuntasCount
    };
  }, [detailedGradeRows, filteredAssessments]);

  const filterTitle = useMemo(() => {
    let periodStr = '';
    if (filterPeriod === 'MONTHLY') {
      const mLabel = MONTH_NAMES[selectedMonth]?.label || 'Bulan';
      periodStr = `Bulan ${mLabel} ${selectedYear}`;
    } else if (filterPeriod === 'WEEKLY') {
      periodStr = '7 Hari Terakhir';
    } else if (filterPeriod === 'YEARLY') {
      periodStr = `1 Tahun Terakhir`;
    } else {
      periodStr = `${startDate} s/d ${endDate}`;
    }

    return selectedClass === 'ALL' 
      ? `Semua Kelas (${periodStr})` 
      : `Kelas ${selectedClass} (${periodStr})`;
  }, [selectedClass, filterPeriod, selectedMonth, selectedYear, startDate, endDate]);

  const selectedHomeroomTeacher = useMemo(() => {
    if (selectedClass === 'ALL') return null;
    const cls = classes.find(c => c.name === selectedClass);
    return cls?.homeroomTeacher ? { name: cls.homeroomTeacher } : null;
  }, [classes, selectedClass]);

  const handleExportExcel = () => {
    if (activeMenu === 'PRESENSI') {
      if (filterPeriod === 'MONTHLY') {
        exportMonthlyAttendanceMatrixExcel(
          schoolProfile,
          filteredRecords,
          filteredStudents,
          selectedClass === 'ALL' ? 'Semua Kelas' : selectedClass,
          selectedYear,
          selectedMonth + 1,
          selectedHomeroomTeacher
        );
      } else {
        exportAttendanceExcel(
          schoolProfile,
          filteredRecords,
          filteredStudents,
          filterTitle,
          startDate,
          endDate
        );
      }
    } else if (activeMenu === 'KEAKTIFAN') {
      const keaktifanTitle = selectedKeaktifanSubject !== 'ALL'
        ? `${filterTitle} - Mapel ${selectedKeaktifanSubject}`
        : filterTitle;
      exportKeaktifanExcel(
        schoolProfile,
        filteredStudents,
        filteredJournals,
        keaktifanTitle,
        startDate,
        endDate,
        selectedKeaktifanSubject
      );
    } else if (activeMenu === 'KARAKTER') {
      exportCharacterPointsExcel(
        schoolProfile,
        filteredStudents,
        filteredCharacterLogs,
        filterTitle,
        predicateSettings
      );
    } else if (activeMenu === 'NILAI') {
      exportRecapStudentGradesExcel(
        schoolProfile,
        filteredAssessments,
        filteredStudents,
        filterTitle,
        startDate,
        endDate,
        selectedClass,
        selectedSubject,
        selectedGradeType
      );
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      if (activeMenu === 'PRESENSI') {
        if (filterPeriod === 'MONTHLY') {
          await exportMonthlyAttendanceMatrixPdf(
            schoolProfile,
            filteredRecords,
            filteredStudents,
            selectedClass === 'ALL' ? 'Semua Kelas' : selectedClass,
            selectedYear,
            selectedMonth + 1,
            selectedHomeroomTeacher
          );
        } else {
          await exportAttendancePdf(
            schoolProfile,
            filteredRecords,
            filteredStudents,
            filterTitle,
            startDate,
            endDate
          );
        }
      } else if (activeMenu === 'KEAKTIFAN') {
        const keaktifanTitle = selectedKeaktifanSubject !== 'ALL'
          ? `${filterTitle} - Mapel ${selectedKeaktifanSubject}`
          : filterTitle;
        await exportKeaktifanPdf(
          schoolProfile,
          filteredStudents,
          filteredJournals,
          keaktifanTitle,
          startDate,
          endDate,
          selectedClass,
          selectedKeaktifanSubject
        );
      } else if (activeMenu === 'KARAKTER') {
        await exportCharacterPointsPdf(
          schoolProfile,
          filteredStudents,
          classes,
          traits,
          filteredCharacterLogs,
          selectedClass,
          undefined,
          predicateSettings
        );
      } else if (activeMenu === 'NILAI') {
        await exportRecapStudentGradesPdf(
          schoolProfile,
          filteredAssessments,
          filteredStudents,
          filterTitle,
          startDate,
          endDate,
          selectedClass,
          selectedSubject,
          'DETAILED',
          selectedGradeType
        );
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Gagal mencetak laporan PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full text-xs font-bold border border-indigo-400/30 mb-2">
            <Layers className="w-4 h-4 text-indigo-400" /> Pusat Rekapitulasi & Laporan Sekolah
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-amber-400" />
            Rekap & Ekspor Laporan
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Pusat terpadu rekapitulasi data presensi, keaktifan KBM, penilaian karakter, serta rincian lengkap nilai siswa (Harian, Tugas, Ulangan) dalam format PDF resmi dan Excel (.xlsx).
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleExportExcel}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 text-xs transition-all transform active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Unduh Excel (.xlsx)
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-extrabold px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 text-xs transition-all transform active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Mencetak PDF...' : 'Unduh Laporan PDF'}
          </button>
        </div>
      </div>

      {/* Sub Menu Selector Tabs - 4 Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-100 p-2 rounded-2xl border border-slate-200/80 shadow-inner">
        
        {/* Sub Menu 1: Presensi */}
        <button
          onClick={() => setActiveMenu('PRESENSI')}
          className={`flex items-center gap-3.5 p-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer text-left ${
            activeMenu === 'PRESENSI'
              ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50'
              : 'bg-white/70 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <div className={`p-2.5 rounded-xl shrink-0 ${activeMenu === 'PRESENSI' ? 'bg-indigo-500/40 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black">1. Rekap Presensi Siswa</div>
            <div className={`text-[11px] font-medium ${activeMenu === 'PRESENSI' ? 'text-indigo-100' : 'text-slate-500'}`}>
              Data Absensi, Hadir, Sakit, Alpa & %
            </div>
          </div>
        </button>

        {/* Sub Menu 2: Keaktifan */}
        <button
          onClick={() => setActiveMenu('KEAKTIFAN')}
          className={`flex items-center gap-3.5 p-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer text-left ${
            activeMenu === 'KEAKTIFAN'
              ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/50'
              : 'bg-white/70 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <div className={`p-2.5 rounded-xl shrink-0 ${activeMenu === 'KEAKTIFAN' ? 'bg-emerald-500/40 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black">2. Rekap Keaktifan Siswa</div>
            <div className={`text-[11px] font-medium ${activeMenu === 'KEAKTIFAN' ? 'text-emerald-100' : 'text-slate-500'}`}>
              Jurnal KBM & Partisipasi Belajar
            </div>
          </div>
        </button>

        {/* Sub Menu 3: Nilai Karakter */}
        <button
          onClick={() => setActiveMenu('KARAKTER')}
          className={`flex items-center gap-3.5 p-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer text-left ${
            activeMenu === 'KARAKTER'
              ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/50'
              : 'bg-white/70 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <div className={`p-2.5 rounded-xl shrink-0 ${activeMenu === 'KARAKTER' ? 'bg-slate-900/10 text-slate-950' : 'bg-amber-100 text-amber-700'}`}>
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black">3. Rekap Nilai Karakter</div>
            <div className={`text-[11px] font-medium ${activeMenu === 'KARAKTER' ? 'text-slate-900/80' : 'text-slate-500'}`}>
              Poin Karakter & Predikat Siswa
            </div>
          </div>
        </button>

        {/* Sub Menu 4: Rekap Nilai Siswa */}
        <button
          onClick={() => setActiveMenu('NILAI')}
          className={`flex items-center gap-3.5 p-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer text-left ${
            activeMenu === 'NILAI'
              ? 'bg-violet-600 text-white shadow-md ring-2 ring-violet-400/50'
              : 'bg-white/70 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <div className={`p-2.5 rounded-xl shrink-0 ${activeMenu === 'NILAI' ? 'bg-violet-500/40 text-white' : 'bg-violet-100 text-violet-700'}`}>
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black">4. Rekap Nilai Siswa</div>
            <div className={`text-[11px] font-medium ${activeMenu === 'NILAI' ? 'text-violet-100' : 'text-slate-500'}`}>
              Rincian Nilai Harian, Tugas & Ulangan
            </div>
          </div>
        </button>

      </div>

      {/* Filter Control Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-600" />
          Filter Rekap Laporan: {
            activeMenu === 'PRESENSI' ? 'Presensi Siswa' : 
            activeMenu === 'KEAKTIFAN' ? 'Keaktifan KBM' : 
            activeMenu === 'KARAKTER' ? 'Nilai Karakter' : 
            'Nilai Siswa (Harian, Tugas & Ulangan)'
          }
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 text-xs">
          
          {/* Search Filter */}
          <div className={(activeMenu === 'NILAI' || activeMenu === 'KEAKTIFAN') ? "sm:col-span-2 md:col-span-1 lg:col-span-1" : "sm:col-span-2 md:col-span-1 lg:col-span-2"}>
            <label className="block text-slate-700 font-semibold mb-1">
              {activeMenu === 'NILAI' ? 'Cari Siswa / Mapel / Materi' : 'Cari Nama / NIS / NISN'}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari kata kunci..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 p-2.5 font-semibold focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Class Filter */}
          <div className="col-span-1">
            <label className="block text-slate-700 font-semibold mb-1">Pilih Kelas</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">Semua Kelas ({students.length} Siswa)</option>
              {sortedClasses.map(c => (
                <option key={c.id} value={c.name}>Kelas {c.name}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter (For KEAKTIFAN) */}
          {activeMenu === 'KEAKTIFAN' && (
            <div className="col-span-1">
              <label className="block text-slate-700 font-semibold mb-1">Mata Pelajaran</label>
              <select
                value={selectedKeaktifanSubject}
                onChange={(e) => setSelectedKeaktifanSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Mapel ({availableSubjects.length})</option>
                {availableSubjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          )}

          {/* Subject Filter (For NILAI) */}
          {activeMenu === 'NILAI' && (
            <div className="col-span-1">
              <label className="block text-slate-700 font-semibold mb-1">Mata Pelajaran</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold focus:ring-2 focus:ring-violet-500 cursor-pointer"
              >
                {availableSubjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          )}

          {/* Period Preset */}
          <div className="col-span-1">
            <label className="block text-slate-700 font-semibold mb-1">Periode Waktu</label>
            <select
              value={filterPeriod}
              onChange={(e) => handlePeriodChange(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="MONTHLY">Bulanan (Pilih Bulan)</option>
              <option value="CUSTOM">Rentang Waktu Custom</option>
              <option value="WEEKLY">Mingguan (7 Hari Terakhir)</option>
              <option value="YEARLY">Tahunan (1 Tahun Terakhir)</option>
            </select>
          </div>

          {/* DYNAMIC PERIOD CONTROLS */}
          {filterPeriod === 'MONTHLY' && (
            <>
              {/* Month Dropdown (12 Months in 1 Year) */}
              <div className="col-span-1">
                <label className="block text-slate-700 font-semibold mb-1">Pilih Bulan</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {MONTH_NAMES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Year Dropdown */}
              <div className="col-span-1">
                <label className="block text-slate-700 font-semibold mb-1">Tahun</label>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {filterPeriod === 'CUSTOM' && (
            <>
              {/* Start Date */}
              <div className="col-span-1">
                <label className="block text-slate-700 font-semibold mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* End Date */}
              <div className="col-span-1">
                <label className="block text-slate-700 font-semibold mb-1">Tanggal Selesai</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
            </>
          )}

          {(filterPeriod === 'WEEKLY' || filterPeriod === 'YEARLY') && (
            <div className="sm:col-span-2 md:col-span-2 lg:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Rentang Tanggal Aktif</label>
              <div className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2.5 font-semibold font-mono text-center flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{startDate} s/d {endDate}</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* SUB MENU 1: TABEL REKAP PRESENSI */}
      {activeMenu === 'PRESENSI' && (
        <div className="space-y-4">
          
          {/* Monthly Overall Summary Stat Cards (When MONTHLY period is active) */}
          {filterPeriod === 'MONTHLY' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-white border border-emerald-200/80 p-3.5 rounded-2xl shadow-xs">
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Hadir (H)
                </div>
                <div className="text-xl font-black text-emerald-900 mt-1 font-mono">{monthlyOverallSummary.totalHadir}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Total presensi tepat</div>
              </div>

              <div className="bg-white border border-amber-200/80 p-3.5 rounded-2xl shadow-xs">
                <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Terlambat (T)
                </div>
                <div className="text-xl font-black text-amber-900 mt-1 font-mono">{monthlyOverallSummary.totalTerlambat}</div>
                <div className="text-[10px] text-amber-600 mt-0.5">Total terlambat hadir</div>
              </div>

              <div className="bg-white border border-teal-200/80 p-3.5 rounded-2xl shadow-xs">
                <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span> Pulang (P)
                </div>
                <div className="text-xl font-black text-teal-900 mt-1 font-mono">{monthlyOverallSummary.totalPulang}</div>
                <div className="text-[10px] text-teal-600 mt-0.5">Scan kepulangan terdata</div>
              </div>

              <div className="bg-white border border-sky-200/80 p-3.5 rounded-2xl shadow-xs">
                <div className="text-[11px] font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span> Izin (I)
                </div>
                <div className="text-xl font-black text-sky-900 mt-1 font-mono">{monthlyOverallSummary.totalIzin}</div>
                <div className="text-[10px] text-sky-600 mt-0.5">Disetujui / surat</div>
              </div>

              <div className="bg-white border border-purple-200/80 p-3.5 rounded-2xl shadow-xs">
                <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span> Sakit (S)
                </div>
                <div className="text-xl font-black text-purple-900 mt-1 font-mono">{monthlyOverallSummary.totalSakit}</div>
                <div className="text-[10px] text-purple-600 mt-0.5">Keterangan sakit</div>
              </div>

              <div className="bg-white border border-rose-200/80 p-3.5 rounded-2xl shadow-xs">
                <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Alpa (A)
                </div>
                <div className="text-xl font-black text-rose-900 mt-1 font-mono">{monthlyOverallSummary.totalAlpa}</div>
                <div className="text-[10px] text-rose-600 mt-0.5">Tanpa keterangan</div>
              </div>

              <div className="bg-white border border-indigo-200/80 p-3.5 rounded-2xl shadow-xs col-span-2 sm:col-span-4 lg:col-span-1">
                <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" /> % Kehadiran
                </div>
                <div className="text-xl font-black text-indigo-900 mt-1 font-mono">{monthlyOverallSummary.avgAttendancePct}%</div>
                <div className="text-[10px] text-indigo-600 mt-0.5">Rata-rata kelas</div>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  Tabel Rekapitulasi Presensi: {filterTitle} {searchQuery && `(Filter: "${searchQuery}")`}
                </h2>
                <div className="text-xs text-slate-500 font-mono font-semibold mt-0.5">
                  Hasil: {filteredStudents.length} Siswa | Periode: {startDate} s/d {endDate}
                </div>
              </div>

              {/* View Mode Toggle when MONTHLY period is active */}
              {filterPeriod === 'MONTHLY' && (
                <div className="inline-flex bg-slate-200/80 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => setAttendanceViewMode('MATRIX')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      attendanceViewMode === 'MATRIX'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Matriks Harian (1 - {monthlyCalendarDays.length}) & Total
                  </button>
                  <button
                    onClick={() => setAttendanceViewMode('SUMMARY')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      attendanceViewMode === 'SUMMARY'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Ringkasan Total Saja
                  </button>
                </div>
              )}
            </div>

            {/* VIEW MODE 1: MATRIX HARIAN + TOTAL BULANAN */}
            {filterPeriod === 'MONTHLY' && attendanceViewMode === 'MATRIX' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200">
                    {/* Header Top Row */}
                    <tr className="border-b border-slate-200/60 bg-slate-100/70 text-[11px]">
                      <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200 text-center w-10">No</th>
                      <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200 text-center min-w-[100px]">NISN</th>
                      <th rowSpan={2} className="py-2.5 px-4 border-r border-slate-200 min-w-[180px]">Nama Siswa</th>
                      <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200 text-center w-16">Kelas</th>
                      <th 
                        colSpan={monthlyCalendarDays.length} 
                        className="py-1.5 px-2 text-center bg-indigo-50/70 text-indigo-900 border-r border-slate-200 font-black tracking-normal"
                      >
                        Presensi Harian Bulan {MONTH_NAMES[selectedMonth]?.label} {selectedYear} (Tanggal 1 s/d {monthlyCalendarDays.length})
                      </th>
                      <th 
                        colSpan={7} 
                        className="py-1.5 px-2 text-center bg-slate-200/80 text-slate-900 font-black tracking-normal"
                      >
                        Total Presensi Bulan Ini
                      </th>
                    </tr>

                    {/* Header Bottom Row (Daily columns + Summary columns) */}
                    <tr className="text-[10px] text-slate-600 bg-slate-50">
                      {monthlyCalendarDays.map((d) => (
                        <th 
                          key={d.day} 
                          className={`py-1.5 px-1 text-center font-mono border-r border-slate-200/70 min-w-[28px] ${
                            d.isHoliday ? 'bg-rose-50/80 text-rose-700 font-bold' : ''
                          }`}
                          title={`${d.fullDay}, ${d.day} ${MONTH_NAMES[selectedMonth]?.label} ${selectedYear}${d.holidayName ? ` (${d.holidayName})` : ''}`}
                        >
                          <div className="font-extrabold">{d.day}</div>
                          <div className="text-[9px] font-sans font-medium text-slate-400">{d.dayShort}</div>
                        </th>
                      ))}
                      
                      {/* Summary Columns */}
                      <th className="py-1.5 px-2 text-center bg-emerald-50/80 text-emerald-800 font-extrabold border-r border-slate-200 w-9" title="Total Hadir (H)">H</th>
                      <th className="py-1.5 px-2 text-center bg-amber-50/80 text-amber-800 font-extrabold border-r border-slate-200 w-9" title="Total Terlambat (T)">T</th>
                      <th className="py-1.5 px-2 text-center bg-teal-50/80 text-teal-800 font-extrabold border-r border-slate-200 w-9" title="Total Pulang (P)">P</th>
                      <th className="py-1.5 px-2 text-center bg-sky-50/80 text-sky-800 font-extrabold border-r border-slate-200 w-9" title="Total Izin (I)">I</th>
                      <th className="py-1.5 px-2 text-center bg-purple-50/80 text-purple-800 font-extrabold border-r border-slate-200 w-9" title="Total Sakit (S)">S</th>
                      <th className="py-1.5 px-2 text-center bg-rose-50/80 text-rose-800 font-extrabold border-r border-slate-200 w-9" title="Total Alpa (A)">A</th>
                      <th className="py-1.5 px-2.5 text-center bg-indigo-50/80 text-indigo-900 font-extrabold w-14" title="Persentase Kehadiran">%</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={4 + monthlyCalendarDays.length + 7} className="py-12 text-center text-slate-400 font-sans font-medium">
                          Tidak ada siswa yang sesuai dengan filter pencarian "{searchQuery}" atau kelas yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((std, idx) => {
                        const stdRecords = filteredRecords.filter(r => r.studentId === std.id || (std.nisn && r.nisn === std.nisn));
                        
                        let hadirCount = 0;
                        let terlambatCount = 0;
                        let pulangCount = 0;
                        let izinCount = 0;
                        let sakitCount = 0;
                        let alpaCount = 0;

                        return (
                          <tr key={std.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-semibold border-r border-slate-100">{idx + 1}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600 font-semibold border-r border-slate-100">{std.nisn || '-'}</td>
                            <td className="py-2.5 px-4 font-sans font-extrabold text-slate-900 border-r border-slate-100 whitespace-nowrap">{std.name}</td>
                            <td className="py-2.5 px-3 text-center text-indigo-600 font-bold border-r border-slate-100">{std.className}</td>
                            
                            {/* Day Cells */}
                            {monthlyCalendarDays.map((d) => {
                              const rec = stdRecords.find(r => r.date === d.dateStr);

                              if (rec) {
                                if (rec.status === 'HADIR') {
                                  hadirCount++;
                                  if (rec.returnTime || rec.returnStatus === 'PULANG' || rec.returnStatus === 'PULANG_TEPAT' || rec.returnStatus === 'PULANG_CEPAT') pulangCount++;
                                  return (
                                    <td key={d.day} className="py-2 px-1 text-center border-r border-slate-100">
                                      <span 
                                        className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-help"
                                        title={`HADIR (${rec.time || '-'})${rec.returnTime ? ` | Pulang: ${rec.returnTime}` : ''}`}
                                      >
                                        H
                                      </span>
                                    </td>
                                  );
                                } else if (rec.status === 'TERLAMBAT') {
                                  terlambatCount++;
                                  if (rec.returnTime || rec.returnStatus === 'PULANG' || rec.returnStatus === 'PULANG_TEPAT' || rec.returnStatus === 'PULANG_CEPAT') pulangCount++;
                                  return (
                                    <td key={d.day} className="py-2 px-1 text-center border-r border-slate-100">
                                      <span 
                                        className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 cursor-help"
                                        title={`TERLAMBAT (${rec.time || '-'})${rec.returnTime ? ` | Pulang: ${rec.returnTime}` : ''}`}
                                      >
                                        T
                                      </span>
                                    </td>
                                  );
                                } else if (rec.status === 'IZIN') {
                                  izinCount++;
                                  return (
                                    <td key={d.day} className="py-2 px-1 text-center border-r border-slate-100">
                                      <span 
                                        className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300 cursor-help"
                                        title={`IZIN${rec.notes ? `: ${rec.notes}` : ''}`}
                                      >
                                        I
                                      </span>
                                    </td>
                                  );
                                } else if (rec.status === 'SAKIT') {
                                  sakitCount++;
                                  return (
                                    <td key={d.day} className="py-2 px-1 text-center border-r border-slate-100">
                                      <span 
                                        className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300 cursor-help"
                                        title={`SAKIT${rec.notes ? `: ${rec.notes}` : ''}`}
                                      >
                                        S
                                      </span>
                                    </td>
                                  );
                                } else if (rec.status === 'ALPA') {
                                  alpaCount++;
                                  return (
                                    <td key={d.day} className="py-2 px-1 text-center border-r border-slate-100">
                                      <span 
                                        className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 cursor-help"
                                        title="ALPA (Tanpa Keterangan)"
                                      >
                                        A
                                      </span>
                                    </td>
                                  );
                                }
                              }

                              // No Record on this date
                              if (d.isHoliday) {
                                return (
                                  <td key={d.day} className="py-2 px-1 text-center border-r border-slate-100 bg-slate-50/70">
                                    <span 
                                      className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-medium bg-slate-200/80 text-slate-500 cursor-help"
                                      title={d.holidayName || `${d.fullDay} (Hari Libur)`}
                                    >
                                      L
                                    </span>
                                  </td>
                                );
                              }

                              return (
                                <td key={d.day} className="py-2 px-1 text-center border-r border-slate-100">
                                  <span className="text-slate-300 font-mono text-[11px]">-</span>
                                </td>
                              );
                            })}

                            {/* Total Presensi Bulan Ini */}
                            {(() => {
                              const totalDaysRecorded = hadirCount + terlambatCount + izinCount + sakitCount + alpaCount;
                              const pct = totalDaysRecorded > 0 ? Math.round(((hadirCount + terlambatCount) / totalDaysRecorded) * 100) : 0;
                              return (
                                <>
                                  <td className="py-2.5 px-2 text-center text-emerald-600 font-extrabold border-r border-slate-100 bg-emerald-50/30">{hadirCount}</td>
                                  <td className="py-2.5 px-2 text-center text-amber-600 font-extrabold border-r border-slate-100 bg-amber-50/30">{terlambatCount}</td>
                                  <td className="py-2.5 px-2 text-center text-teal-600 font-extrabold border-r border-slate-100 bg-teal-50/30">{pulangCount}</td>
                                  <td className="py-2.5 px-2 text-center text-sky-600 font-bold border-r border-slate-100 bg-sky-50/30">{izinCount}</td>
                                  <td className="py-2.5 px-2 text-center text-purple-600 font-bold border-r border-slate-100 bg-purple-50/30">{sakitCount}</td>
                                  <td className="py-2.5 px-2 text-center text-rose-600 font-bold border-r border-slate-100 bg-rose-50/30">{alpaCount}</td>
                                  <td className="py-2.5 px-2.5 text-center font-extrabold text-indigo-600 bg-indigo-50/40">{pct}%</td>
                                </>
                              );
                            })()}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* VIEW MODE 2: RINGKASAN REKAP STANDAR */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200/80">
                    <tr>
                      <th className="py-3.5 px-4">No</th>
                      <th className="py-3.5 px-4">NISN</th>
                      <th className="py-3.5 px-4">Nama Siswa</th>
                      <th className="py-3.5 px-4">Kelas</th>
                      <th className="py-3.5 px-4 text-center">Hadir (H)</th>
                      <th className="py-3.5 px-4 text-center">Terlambat (T)</th>
                      <th className="py-3.5 px-4 text-center">Pulang (P)</th>
                      <th className="py-3.5 px-4 text-center">Izin (I)</th>
                      <th className="py-3.5 px-4 text-center">Sakit (S)</th>
                      <th className="py-3.5 px-4 text-center">Alpa (A)</th>
                      <th className="py-3.5 px-4 text-right">% Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400 font-sans font-medium">
                          Tidak ada siswa yang sesuai dengan filter pencarian "{searchQuery}" atau kelas yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((std, idx) => {
                        const stdRecords = filteredRecords.filter(r => r.studentId === std.id || (std.nisn && r.nisn === std.nisn));
                        const hadir = stdRecords.filter(r => r.status === 'HADIR').length;
                        const terlambat = stdRecords.filter(r => r.status === 'TERLAMBAT').length;
                        const pulang = stdRecords.filter(r => r.returnTime || r.returnStatus === 'PULANG' || r.returnStatus === 'PULANG_TEPAT' || r.returnStatus === 'PULANG_CEPAT').length;
                        const izin = stdRecords.filter(r => r.status === 'IZIN').length;
                        const sakit = stdRecords.filter(r => r.status === 'SAKIT').length;
                        const alpa = stdRecords.filter(r => r.status === 'ALPA').length;

                        const totalDaysRecorded = hadir + terlambat + izin + sakit + alpa;
                        const presentCount = hadir + terlambat;
                        const pct = totalDaysRecorded > 0 ? Math.round((presentCount / totalDaysRecorded) * 100) : 0;

                        return (
                          <tr key={std.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 text-slate-400 font-semibold">{idx + 1}</td>
                            <td className="py-3.5 px-4 text-slate-600 font-semibold">{std.nisn || '-'}</td>
                            <td className="py-3.5 px-4 font-sans font-extrabold text-slate-900">{std.name}</td>
                            <td className="py-3.5 px-4 text-indigo-600 font-bold">{std.className}</td>
                            <td className="py-3.5 px-4 text-center text-emerald-600 font-extrabold">{hadir}</td>
                            <td className="py-3.5 px-4 text-center text-amber-600 font-extrabold">{terlambat}</td>
                            <td className="py-3.5 px-4 text-center text-teal-600 font-extrabold">{pulang}</td>
                            <td className="py-3.5 px-4 text-center text-sky-600 font-bold">{izin}</td>
                            <td className="py-3.5 px-4 text-center text-purple-600 font-bold">{sakit}</td>
                            <td className="py-3.5 px-4 text-center text-rose-600 font-bold">{alpa}</td>
                            <td className="py-3.5 px-4 text-right font-extrabold text-indigo-600">{pct}%</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legend / Keterangan Kode Matriks */}
            {filterPeriod === 'MONTHLY' && attendanceViewMode === 'MATRIX' && (
              <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-extrabold text-slate-800">Keterangan Kode:</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold inline-flex items-center justify-center text-[10px]">H</span>
                    <span>Hadir Tepat</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-extrabold inline-flex items-center justify-center text-[10px]">T</span>
                    <span>Terlambat</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 border border-teal-300 font-extrabold inline-flex items-center justify-center text-[10px]">P</span>
                    <span>Scan Pulang</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-sky-100 text-sky-800 border border-sky-300 font-extrabold inline-flex items-center justify-center text-[10px]">I</span>
                    <span>Izin</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 border border-purple-300 font-extrabold inline-flex items-center justify-center text-[10px]">S</span>
                    <span>Sakit</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-extrabold inline-flex items-center justify-center text-[10px]">A</span>
                    <span>Alpa</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-600 font-medium inline-flex items-center justify-center text-[10px]">L</span>
                    <span>Libur / Akhir Pekan</span>
                  </span>
                </div>

                <div className="text-slate-400 font-mono text-[11px]">
                  * Sorot badge huruf untuk melihat jam presensi & catatan
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* SUB MENU 2: TABEL REKAP KEAKTIFAN SISWA */}
      {activeMenu === 'KEAKTIFAN' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/40">
            <h2 className="text-sm font-extrabold text-emerald-900 flex flex-wrap items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Tabel Rekapitulasi Keaktifan Siswa (Jurnal KBM): {filterTitle}</span>
              {selectedKeaktifanSubject !== 'ALL' && (
                <span className="bg-emerald-200 text-emerald-900 text-xs px-2.5 py-0.5 rounded-full font-black border border-emerald-300">
                  Mapel: {selectedKeaktifanSubject}
                </span>
              )}
            </h2>
            <span className="text-xs text-emerald-700 font-mono font-bold">
              Total Jurnal Terdata: {filteredJournals.length} Jurnal | {filteredStudents.length} Siswa
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">No</th>
                  <th className="py-3.5 px-4">NISN</th>
                  <th className="py-3.5 px-4">Nama Siswa</th>
                  <th className="py-3.5 px-4">Kelas</th>
                  <th className="py-3.5 px-4 text-center">Pertemuan KBM</th>
                  <th className="py-3.5 px-4 text-center">Sangat Aktif</th>
                  <th className="py-3.5 px-4 text-center">Cukup Aktif</th>
                  <th className="py-3.5 px-4 text-center">Kurang Aktif</th>
                  <th className="py-3.5 px-4 text-center">Mengganggu / Absen</th>
                  <th className="py-3.5 px-4 text-center">Predikat Keaktifan</th>
                  <th className="py-3.5 px-4">Catatan Guru Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                      Tidak ada siswa ditemukan untuk filter keaktifan KBM ini.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((std, idx) => {
                    let sangatAktif = 0;
                    let cukupAktif = 0;
                    let kurangAktif = 0;
                    let mengganggu = 0;
                    let tidakHadir = 0;
                    let totalPertemuan = 0;
                    let lastNotes = '-';

                    filteredJournals.forEach((j) => {
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
                      }
                    });

                    let predikat = { label: 'Sangat Aktif', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
                    if (totalPertemuan === 0) {
                      predikat = { label: 'Belum Ada Data', color: 'bg-slate-100 text-slate-600 border-slate-300' };
                    } else if (mengganggu > 0 || kurangAktif > 2) {
                      predikat = { label: 'Perlu Perhatian', color: 'bg-rose-100 text-rose-800 border-rose-300' };
                    } else if (sangatAktif >= cukupAktif && sangatAktif >= kurangAktif) {
                      predikat = { label: 'Sangat Aktif', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
                    } else if (cukupAktif >= kurangAktif) {
                      predikat = { label: 'Cukup Aktif', color: 'bg-blue-100 text-blue-800 border-blue-300' };
                    } else {
                      predikat = { label: 'Kurang Aktif', color: 'bg-amber-100 text-amber-800 border-amber-300' };
                    }

                    return (
                      <tr key={std.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 font-semibold">{std.nisn || '-'}</td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-900">{std.name}</td>
                        <td className="py-3.5 px-4 font-bold text-indigo-600">{std.className}</td>
                        <td className="py-3.5 px-4 text-center font-mono font-black text-slate-800">{totalPertemuan}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-emerald-600 font-extrabold">{sangatAktif}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-blue-600 font-extrabold">{cukupAktif}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-amber-600 font-bold">{kurangAktif}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-rose-600 font-bold">{mengganggu + tidakHadir}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border inline-block whitespace-nowrap ${predikat.color}`}>
                            {predikat.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 italic max-w-xs truncate">{lastNotes}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB MENU 3: TABEL REKAP NILAI KARAKTER SISWA */}
      {activeMenu === 'KARAKTER' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/40">
            <h2 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              Tabel Rekapitulasi Nilai Karakter Siswa: {filterTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-amber-900">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">A ≥ {predicateSettings.minA ?? 30}</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">B ≥ {predicateSettings.minB ?? 10}</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">C ≥ {predicateSettings.minC ?? 0}</span>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full">D ≥ {predicateSettings.minD ?? -20}</span>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full">E ≥ {predicateSettings.minE ?? -50}</span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">F &lt; {predicateSettings.minE ?? -50}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">No</th>
                  <th className="py-3.5 px-4">NISN</th>
                  <th className="py-3.5 px-4">Nama Siswa</th>
                  <th className="py-3.5 px-4">Kelas</th>
                  <th className="py-3.5 px-4 text-center">Poin Positif (+)</th>
                  <th className="py-3.5 px-4 text-center">Poin Negatif (-)</th>
                  <th className="py-3.5 px-4 text-center">Total Poin Net</th>
                  <th className="py-3.5 px-4 text-center">Predikat Karakter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                      Tidak ada siswa ditemukan untuk filter penilaian karakter ini.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((std, idx) => {
                    const studentLogs = filteredCharacterLogs.filter(l => l.studentId === std.id);
                    const posLogs = studentLogs.filter(l => l.traitType === 'POSITIF');
                    const negLogs = studentLogs.filter(l => l.traitType === 'NEGATIF');

                    const posPoints = posLogs.reduce((sum, item) => sum + (item.points || 0), 0);
                    const negPoints = negLogs.reduce((sum, item) => sum + (item.points || 0), 0);
                    const netPoints = posPoints - negPoints;

                    const minA = predicateSettings.minA ?? 30;
                    const minB = predicateSettings.minB ?? 10;
                    const minC = predicateSettings.minC ?? 0;
                    const minD = predicateSettings.minD ?? -20;
                    const minE = predicateSettings.minE ?? -50;

                    let predikat = { label: 'Baik (B)', color: 'bg-blue-100 text-blue-800 border-blue-300' };
                    if (netPoints >= minA) {
                      predikat = { label: 'Sangat Baik (A)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
                    } else if (netPoints >= minB) {
                      predikat = { label: 'Baik (B)', color: 'bg-blue-100 text-blue-800 border-blue-300' };
                    } else if (netPoints >= minC) {
                      predikat = { label: 'Cukup (C)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
                    } else if (netPoints >= minD) {
                      predikat = { label: 'Perlu Pembinaan (D)', color: 'bg-orange-100 text-orange-800 border-orange-300' };
                    } else if (netPoints >= minE) {
                      predikat = { label: 'Tidak Naik Kelas (E)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
                    } else {
                      predikat = { label: 'Pindah Sekolah (F)', color: 'bg-purple-100 text-purple-800 border-purple-300' };
                    }

                    return (
                      <tr key={std.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 font-semibold">{std.nisn || '-'}</td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-900">{std.name}</td>
                        <td className="py-3.5 px-4 font-bold text-indigo-600">{std.className}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-emerald-600 font-extrabold">+{posPoints}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-rose-600 font-extrabold">-{negPoints}</td>
                        <td className={`py-3.5 px-4 text-center font-mono font-black ${
                          netPoints >= 0 ? 'text-indigo-800' : 'text-rose-700'
                        }`}>
                          {netPoints >= 0 ? `+${netPoints}` : netPoints}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-extrabold border inline-block whitespace-nowrap ${predikat.color}`}>
                            {predikat.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB MENU 4: TABEL REKAP NILAI SISWA (HARIAN, TUGAS, & ULANGAN) */}
      {activeMenu === 'NILAI' && (
        <div className="space-y-6">
          
          {/* Quick Metrics Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Penilaian</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1">
                {gradeStats.totalAssessments} <span className="text-xs font-semibold text-slate-400">KBM</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 font-medium">{gradeStats.totalRows} baris nilai</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Rata Nilai Harian (NH)</span>
              <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1">
                {gradeStats.avgHarian}
              </div>
              <span className="text-[10px] text-indigo-500 mt-1 font-medium">Skala 0 - 100</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Rata Nilai Tugas (NT)</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                {gradeStats.avgTugas}
              </div>
              <span className="text-[10px] text-emerald-500 mt-1 font-medium">Tugas & PR Siswa</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Rata Nilai Ulangan (NU)</span>
              <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
                {gradeStats.avgUlangan}
              </div>
              <span className="text-[10px] text-amber-500 mt-1 font-medium">UH / Formatif / Sumatif</span>
            </div>

            <div className="bg-white border border-violet-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between bg-violet-50/40">
              <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Rata-Rata Akhir</span>
              <div className="text-xl sm:text-2xl font-black text-violet-900 mt-1">
                {gradeStats.avgFinal}
              </div>
              <span className="text-[10px] text-violet-600 mt-1 font-medium">Gabungan Seluruh Nilai</span>
            </div>

            <div className="bg-white border border-teal-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between bg-teal-50/40">
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Kelulusan / Ketuntasan</span>
              <div className="text-xl sm:text-2xl font-black text-teal-900 mt-1 flex items-baseline gap-1">
                {gradeStats.pctTuntas}% <span className="text-xs font-bold text-teal-700">Tuntas</span>
              </div>
              <span className="text-[10px] text-teal-600 mt-1 font-medium">{gradeStats.tuntasCount} siswa ≥ 75</span>
            </div>

          </div>

          {/* Main Table Container */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
            
            {/* Table Header */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-violet-50/40">
              <div>
                <h2 className="text-sm font-extrabold text-violet-950 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-violet-600" />
                  Rekapitulasi Nilai Siswa (Harian, Tugas, & Ulangan): {filterTitle}
                </h2>
                <p className="text-xs text-violet-700 mt-0.5">
                  {selectedSubject ? `Mata Pelajaran: ${selectedSubject} | ` : ''} 
                  {selectedClass !== 'ALL' ? `Kelas ${selectedClass} | ` : 'Semua Kelas | '}
                  Periode {startDate} s/d {endDate}
                </p>
              </div>
              <div className="text-xs font-bold text-violet-900 bg-white/90 px-3 py-1.5 rounded-xl border border-violet-200 shadow-2xs self-start sm:self-auto flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-violet-600" />
                <span>{filteredStudents.length} Siswa Terdaftar</span>
              </div>
            </div>

            {/* BARIS TOMBOL PILIHAN RINCIAN NILAI (HARIAN, TUGAS, DAN ULANGAN) */}
            <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  Pilihan Rincian Nilai:
                </span>

                {/* Tombol 1: Semua Rincian Nilai */}
                <button
                  type="button"
                  onClick={() => setSelectedGradeType('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer border ${
                    selectedGradeType === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Semua Nilai (Gabungan)
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    selectedGradeType === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {gradeCategoryCounts.countAll}
                  </span>
                </button>

                {/* Tombol 2: Nilai Harian (NH) */}
                <button
                  type="button"
                  onClick={() => setSelectedGradeType('HARIAN')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer border ${
                    selectedGradeType === 'HARIAN'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                      : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Rincian Nilai Harian (NH)
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    selectedGradeType === 'HARIAN' ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {gradeCategoryCounts.countHarian}
                  </span>
                </button>

                {/* Tombol 3: Nilai Tugas (NT) */}
                <button
                  type="button"
                  onClick={() => setSelectedGradeType('TUGAS')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer border ${
                    selectedGradeType === 'TUGAS'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-200'
                      : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300'
                  }`}
                >
                  <BookOpenCheck className="w-3.5 h-3.5" />
                  Rincian Nilai Tugas (NT)
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    selectedGradeType === 'TUGAS' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {gradeCategoryCounts.countTugas}
                  </span>
                </button>

                {/* Tombol 4: Nilai Ulangan (NU) */}
                <button
                  type="button"
                  onClick={() => setSelectedGradeType('ULANGAN')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer border ${
                    selectedGradeType === 'ULANGAN'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200'
                      : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  Rincian Nilai Ulangan (NU)
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    selectedGradeType === 'ULANGAN' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {gradeCategoryCounts.countUlangan}
                  </span>
                </button>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Kategori aktif: <strong className="text-slate-800">{
                  selectedGradeType === 'HARIAN' ? 'Nilai Harian (NH)' :
                  selectedGradeType === 'TUGAS' ? 'Nilai Tugas (NT)' :
                  selectedGradeType === 'ULANGAN' ? 'Nilai Ulangan (NU)' :
                  'Semua Kategori Nilai'
                }</strong>
              </div>
            </div>

            {/* MATRIKS RINCIAN NILAI SISWA (NH1..n, NT1..n, NU1..n) */}
            <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                    
                    {/* Header Table: Multi-column Grouped if ALL, or Direct Columns if Specific Category */}
                    {selectedGradeType === 'ALL' ? (
                      <thead>
                        {/* Top Header Group Row */}
                        <tr className="bg-slate-100/90 text-slate-700 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                          <th colSpan={4} className="py-3 px-3 border-r border-slate-200 text-slate-800 bg-slate-100">
                            Identitas Siswa
                          </th>
                          <th colSpan={Math.max(1, harianAssessmentColumns.length) + 1} className="py-3 px-3 text-center border-r border-indigo-200 bg-indigo-50/90 text-indigo-950 font-black">
                            Nilai Harian (NH)
                          </th>
                          <th colSpan={Math.max(1, tugasAssessmentColumns.length) + 1} className="py-3 px-3 text-center border-r border-emerald-200 bg-emerald-50/90 text-emerald-950 font-black">
                            Nilai Tugas (NT)
                          </th>
                          <th colSpan={Math.max(1, ulanganAssessmentColumns.length) + 1} className="py-3 px-3 text-center border-r border-amber-200 bg-amber-50/90 text-amber-950 font-black">
                            Nilai Ulangan (NU)
                          </th>
                          <th colSpan={3} className="py-3 px-3 text-center bg-violet-50/90 text-violet-950 font-black">
                            Hasil Akhir
                          </th>
                        </tr>

                        {/* Sub Header Columns */}
                        <tr className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <th className="py-2.5 px-3 text-center w-10">No</th>
                          <th className="py-2.5 px-3 w-28">NISN</th>
                          <th className="py-2.5 px-3 min-w-[170px]">Nama Siswa</th>
                          <th className="py-2.5 px-3 w-16 border-r border-slate-200">Kelas</th>

                          {/* NH Columns */}
                          {harianAssessmentColumns.length === 0 ? (
                            <th className="py-2.5 px-2 text-center text-slate-400 bg-indigo-50/30">NH1</th>
                          ) : (
                            harianAssessmentColumns.map((col, idx) => (
                              <th 
                                key={col.id} 
                                className="py-2.5 px-2 text-center bg-indigo-50/40 text-indigo-900 border-r border-indigo-100 min-w-[55px] cursor-help"
                                title={`NH${idx + 1} • Tanggal: ${col.date} • Materi: ${col.material}`}
                              >
                                <div className="font-mono font-black text-indigo-700">NH{idx + 1}</div>
                                <div className="text-[9px] text-slate-500 font-normal font-mono">{col.date.substring(5)}</div>
                              </th>
                            ))
                          )}
                          <th className="py-2.5 px-2 text-center bg-indigo-100 text-indigo-950 font-black border-r border-indigo-200 min-w-[65px]">
                            Rata NH
                          </th>

                          {/* NT Columns */}
                          {tugasAssessmentColumns.length === 0 ? (
                            <th className="py-2.5 px-2 text-center text-slate-400 bg-emerald-50/30">NT1</th>
                          ) : (
                            tugasAssessmentColumns.map((col, idx) => (
                              <th 
                                key={col.id} 
                                className="py-2.5 px-2 text-center bg-emerald-50/40 text-emerald-900 border-r border-emerald-100 min-w-[55px] cursor-help"
                                title={`NT${idx + 1} • Tanggal: ${col.date} • Materi: ${col.material}`}
                              >
                                <div className="font-mono font-black text-emerald-700">NT{idx + 1}</div>
                                <div className="text-[9px] text-slate-500 font-normal font-mono">{col.date.substring(5)}</div>
                              </th>
                            ))
                          )}
                          <th className="py-2.5 px-2 text-center bg-emerald-100 text-emerald-950 font-black border-r border-emerald-200 min-w-[65px]">
                            Rata NT
                          </th>

                          {/* NU Columns */}
                          {ulanganAssessmentColumns.length === 0 ? (
                            <th className="py-2.5 px-2 text-center text-slate-400 bg-amber-50/30">NU1</th>
                          ) : (
                            ulanganAssessmentColumns.map((col, idx) => (
                              <th 
                                key={col.id} 
                                className="py-2.5 px-2 text-center bg-amber-50/40 text-amber-900 border-r border-amber-100 min-w-[55px] cursor-help"
                                title={`NU${idx + 1} • Tanggal: ${col.date} • Materi: ${col.material}`}
                              >
                                <div className="font-mono font-black text-amber-700">NU{idx + 1}</div>
                                <div className="text-[9px] text-slate-500 font-normal font-mono">{col.date.substring(5)}</div>
                              </th>
                            ))
                          )}
                          <th className="py-2.5 px-2 text-center bg-amber-100 text-amber-950 font-black border-r border-amber-200 min-w-[65px]">
                            Rata NU
                          </th>

                          {/* Hasil Akhir */}
                          <th className="py-2.5 px-2 text-center bg-violet-100 text-violet-950 font-black min-w-[65px]">
                            Nilai Akhir
                          </th>
                          <th className="py-2.5 px-3 text-center min-w-[80px]">Predikat</th>
                          <th className="py-2.5 px-3 text-center min-w-[85px]">Status</th>
                        </tr>
                      </thead>
                    ) : (
                      /* Single Category Table Header (HARIAN, TUGAS, OR ULANGAN) */
                      <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[11px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3 text-center w-10">No</th>
                          <th className="py-3 px-3 w-28">NISN</th>
                          <th className="py-3 px-3 min-w-[180px]">Nama Siswa</th>
                          <th className="py-3 px-3 w-16">Kelas</th>

                          {/* Dynamic Columns for Specific Grade Type */}
                          {selectedGradeType === 'HARIAN' && (
                            <>
                              {harianAssessmentColumns.length === 0 ? (
                                <th className="py-3 px-3 text-center text-slate-400 bg-indigo-50/30">
                                  NH1 (Belum Ada Data)
                                </th>
                              ) : (
                                harianAssessmentColumns.map((col, idx) => (
                                  <th 
                                    key={col.id} 
                                    className="py-3 px-2 text-center bg-indigo-50 text-indigo-900 border-x border-indigo-100 min-w-[70px] cursor-help"
                                    title={`NH${idx + 1} • Tanggal: ${col.date} • Materi: ${col.material}`}
                                  >
                                    <div className="font-mono font-black text-indigo-700 text-xs">NH{idx + 1}</div>
                                    <div className="text-[10px] text-slate-500 font-medium font-mono">{col.date.substring(5)}</div>
                                  </th>
                                ))
                              )}
                              <th className="py-3 px-3 text-center bg-indigo-100 text-indigo-950 font-black border-l border-indigo-200 min-w-[80px]">
                                Rata-Rata NH
                              </th>
                            </>
                          )}

                          {selectedGradeType === 'TUGAS' && (
                            <>
                              {tugasAssessmentColumns.length === 0 ? (
                                <th className="py-3 px-3 text-center text-slate-400 bg-emerald-50/30">
                                  NT1 (Belum Ada Data)
                                </th>
                              ) : (
                                tugasAssessmentColumns.map((col, idx) => (
                                  <th 
                                    key={col.id} 
                                    className="py-3 px-2 text-center bg-emerald-50 text-emerald-900 border-x border-emerald-100 min-w-[70px] cursor-help"
                                    title={`NT${idx + 1} • Tanggal: ${col.date} • Materi: ${col.material}`}
                                  >
                                    <div className="font-mono font-black text-emerald-700 text-xs">NT{idx + 1}</div>
                                    <div className="text-[10px] text-slate-500 font-medium font-mono">{col.date.substring(5)}</div>
                                  </th>
                                ))
                              )}
                              <th className="py-3 px-3 text-center bg-emerald-100 text-emerald-950 font-black border-l border-emerald-200 min-w-[80px]">
                                Rata-Rata NT
                              </th>
                            </>
                          )}

                          {selectedGradeType === 'ULANGAN' && (
                            <>
                              {ulanganAssessmentColumns.length === 0 ? (
                                <th className="py-3 px-3 text-center text-slate-400 bg-amber-50/30">
                                  NU1 (Belum Ada Data)
                                </th>
                              ) : (
                                ulanganAssessmentColumns.map((col, idx) => (
                                  <th 
                                    key={col.id} 
                                    className="py-3 px-2 text-center bg-amber-50 text-amber-900 border-x border-amber-100 min-w-[70px] cursor-help"
                                    title={`NU${idx + 1} • Tanggal: ${col.date} • Materi: ${col.material}`}
                                  >
                                    <div className="font-mono font-black text-amber-700 text-xs">NU{idx + 1}</div>
                                    <div className="text-[10px] text-slate-500 font-medium font-mono">{col.date.substring(5)}</div>
                                  </th>
                                ))
                              )}
                              <th className="py-3 px-3 text-center bg-amber-100 text-amber-950 font-black border-l border-amber-200 min-w-[80px]">
                                Rata-Rata NU
                              </th>
                            </>
                          )}

                          <th className="py-3 px-3 text-center min-w-[90px]">Predikat</th>
                          <th className="py-3 px-3 text-center min-w-[90px]">Status</th>
                        </tr>
                      </thead>
                    )}

                    {/* Table Body */}
                    <tbody className="divide-y divide-slate-100">
                      {studentGradeMatrix.length === 0 ? (
                        <tr>
                          <td colSpan={20} className="py-12 text-center text-slate-400 font-medium">
                            Tidak ada siswa yang ditemukan untuk kelas dan filter pencarian ini.
                          </td>
                        </tr>
                      ) : (
                        studentGradeMatrix.map((row) => {
                          return (
                            <tr key={row.student.id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Identitas Siswa */}
                              <td className="py-3 px-3 font-mono text-slate-400 font-semibold text-center">{row.no}</td>
                              <td className="py-3 px-3 font-mono text-slate-600 font-semibold whitespace-nowrap">{row.student.nisn || '-'}</td>
                              <td className="py-3 px-3 font-extrabold text-slate-900 whitespace-nowrap">{row.student.name}</td>
                              <td className="py-3 px-3 font-bold text-indigo-600 border-r border-slate-100">{row.student.className}</td>

                              {/* Mode 1: SEMUA NILAI (GABUNGAN) */}
                              {selectedGradeType === 'ALL' && (
                                <>
                                  {/* NH cells */}
                                  {harianAssessmentColumns.length === 0 ? (
                                    <td className="py-3 px-2 text-center text-slate-300 font-mono">-</td>
                                  ) : (
                                    row.nhScores.map((s, idx) => (
                                      <td 
                                        key={idx} 
                                        className="py-3 px-2 text-center font-mono font-bold border-r border-indigo-50/80"
                                        title={`NH${idx + 1}: ${s.score !== null ? s.score : 'Kosong'} • Catatan: ${s.notes || '-'}`}
                                      >
                                        {s.score !== null ? (
                                          <span className="text-indigo-700 font-extrabold">{s.score}</span>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    ))
                                  )}
                                  <td className="py-3 px-2 text-center font-mono font-black text-indigo-900 bg-indigo-50/50 border-r border-indigo-200">
                                    {row.avgNh !== null ? row.avgNh : '-'}
                                  </td>

                                  {/* NT cells */}
                                  {tugasAssessmentColumns.length === 0 ? (
                                    <td className="py-3 px-2 text-center text-slate-300 font-mono">-</td>
                                  ) : (
                                    row.ntScores.map((s, idx) => (
                                      <td 
                                        key={idx} 
                                        className="py-3 px-2 text-center font-mono font-bold border-r border-emerald-50/80"
                                        title={`NT${idx + 1}: ${s.score !== null ? s.score : 'Kosong'} • Catatan: ${s.notes || '-'}`}
                                      >
                                        {s.score !== null ? (
                                          <span className="text-emerald-700 font-extrabold">{s.score}</span>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    ))
                                  )}
                                  <td className="py-3 px-2 text-center font-mono font-black text-emerald-900 bg-emerald-50/50 border-r border-emerald-200">
                                    {row.avgNt !== null ? row.avgNt : '-'}
                                  </td>

                                  {/* NU cells */}
                                  {ulanganAssessmentColumns.length === 0 ? (
                                    <td className="py-3 px-2 text-center text-slate-300 font-mono">-</td>
                                  ) : (
                                    row.nuScores.map((s, idx) => (
                                      <td 
                                        key={idx} 
                                        className="py-3 px-2 text-center font-mono font-bold border-r border-amber-50/80"
                                        title={`NU${idx + 1}: ${s.score !== null ? s.score : 'Kosong'} • Catatan: ${s.notes || '-'}`}
                                      >
                                        {s.score !== null ? (
                                          <span className="text-amber-700 font-extrabold">{s.score}</span>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    ))
                                  )}
                                  <td className="py-3 px-2 text-center font-mono font-black text-amber-900 bg-amber-50/50 border-r border-amber-200">
                                    {row.avgNu !== null ? row.avgNu : '-'}
                                  </td>

                                  {/* Nilai Akhir */}
                                  <td className="py-3 px-2 text-center font-mono font-black text-violet-800 bg-violet-50/80 text-sm">
                                    {row.finalScore !== null ? row.finalScore : '-'}
                                  </td>
                                </>
                              )}

                              {/* Mode 2: KHUSUS NILAI HARIAN (NH1, NH2, NH3...) */}
                              {selectedGradeType === 'HARIAN' && (
                                <>
                                  {harianAssessmentColumns.length === 0 ? (
                                    <td className="py-3 px-3 text-center text-slate-300 font-mono">-</td>
                                  ) : (
                                    row.nhScores.map((s, idx) => (
                                      <td 
                                        key={idx} 
                                        className="py-3 px-2 text-center font-mono border-x border-indigo-50"
                                        title={`NH${idx + 1}: ${s.score !== null ? s.score : 'Kosong'} • Catatan: ${s.notes || '-'}`}
                                      >
                                        {s.score !== null ? (
                                          <span className="text-indigo-700 font-black text-xs">{s.score}</span>
                                        ) : (
                                          <span className="text-slate-300 font-semibold">-</span>
                                        )}
                                      </td>
                                    ))
                                  )}
                                  <td className="py-3 px-3 text-center font-mono font-black text-indigo-900 bg-indigo-50 border-l border-indigo-200 text-sm">
                                    {row.avgNh !== null ? row.avgNh : '-'}
                                  </td>
                                </>
                              )}

                              {/* Mode 3: KHUSUS NILAI TUGAS (NT1, NT2, NT3...) */}
                              {selectedGradeType === 'TUGAS' && (
                                <>
                                  {tugasAssessmentColumns.length === 0 ? (
                                    <td className="py-3 px-3 text-center text-slate-300 font-mono">-</td>
                                  ) : (
                                    row.ntScores.map((s, idx) => (
                                      <td 
                                        key={idx} 
                                        className="py-3 px-2 text-center font-mono border-x border-emerald-50"
                                        title={`NT${idx + 1}: ${s.score !== null ? s.score : 'Kosong'} • Catatan: ${s.notes || '-'}`}
                                      >
                                        {s.score !== null ? (
                                          <span className="text-emerald-700 font-black text-xs">{s.score}</span>
                                        ) : (
                                          <span className="text-slate-300 font-semibold">-</span>
                                        )}
                                      </td>
                                    ))
                                  )}
                                  <td className="py-3 px-3 text-center font-mono font-black text-emerald-900 bg-emerald-50 border-l border-emerald-200 text-sm">
                                    {row.avgNt !== null ? row.avgNt : '-'}
                                  </td>
                                </>
                              )}

                              {/* Mode 4: KHUSUS NILAI ULANGAN (NU1, NU2, NU3...) */}
                              {selectedGradeType === 'ULANGAN' && (
                                <>
                                  {ulanganAssessmentColumns.length === 0 ? (
                                    <td className="py-3 px-3 text-center text-slate-300 font-mono">-</td>
                                  ) : (
                                    row.nuScores.map((s, idx) => (
                                      <td 
                                        key={idx} 
                                        className="py-3 px-2 text-center font-mono border-x border-amber-50"
                                        title={`NU${idx + 1}: ${s.score !== null ? s.score : 'Kosong'} • Catatan: ${s.notes || '-'}`}
                                      >
                                        {s.score !== null ? (
                                          <span className="text-amber-700 font-black text-xs">{s.score}</span>
                                        ) : (
                                          <span className="text-slate-300 font-semibold">-</span>
                                        )}
                                      </td>
                                    ))
                                  )}
                                  <td className="py-3 px-3 text-center font-mono font-black text-amber-900 bg-amber-50 border-l border-amber-200 text-sm">
                                    {row.avgNu !== null ? row.avgNu : '-'}
                                  </td>
                                </>
                              )}

                              {/* Predikat */}
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                {row.displayScore !== null ? (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                    row.displayScore >= 85 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                    row.displayScore >= 75 ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                    row.displayScore >= 60 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                    'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}>
                                    {row.predicate}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono">-</span>
                                )}
                              </td>

                              {/* Status Ketuntasan */}
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                {row.displayScore !== null ? (
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                    row.isTuntas 
                                      ? 'bg-teal-100 text-teal-800 border-teal-300' 
                                      : 'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}>
                                    {row.isTuntas ? 'TUNTAS' : 'REMEDIAL'}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono">-</span>
                                )}
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* KETERANGAN RINCIAN KOLOM PENILAIAN (Legend of NH1, NH2..., NT1..., NU1...) */}
                {filteredAssessments.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-violet-600" />
                        Keterangan Rincian Kolom Kegiatan Penilaian:
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Total {filteredAssessments.length} Kegiatan Terjadwal
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      
                      {/* Kolom NH */}
                      {(selectedGradeType === 'ALL' || selectedGradeType === 'HARIAN') && (
                        <div className="bg-white border border-indigo-100 rounded-xl p-3 space-y-2 shadow-2xs">
                          <div className="font-extrabold text-indigo-900 flex items-center justify-between border-b border-indigo-50 pb-1.5">
                            <span>Nilai Harian ({harianAssessmentColumns.length})</span>
                            <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">NH1, NH2...</span>
                          </div>
                          {harianAssessmentColumns.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">Belum ada sesi Nilai Harian pada periode ini.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {harianAssessmentColumns.map((ass, i) => (
                                <div 
                                  key={ass.id} 
                                  onClick={() => setSelectedAssessmentDetail(ass)}
                                  className="flex items-start justify-between gap-2 p-1.5 rounded-lg hover:bg-indigo-50/60 cursor-pointer transition-colors"
                                >
                                  <div>
                                    <span className="font-mono font-black text-indigo-700 mr-1.5">NH{i + 1}:</span>
                                    <span className="text-slate-800 font-bold">{ass.material}</span>
                                    <div className="text-[10px] text-slate-500">Tgl: {ass.date} • Pengajar: {ass.teacherName}</div>
                                  </div>
                                  <Eye className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Kolom NT */}
                      {(selectedGradeType === 'ALL' || selectedGradeType === 'TUGAS') && (
                        <div className="bg-white border border-emerald-100 rounded-xl p-3 space-y-2 shadow-2xs">
                          <div className="font-extrabold text-emerald-900 flex items-center justify-between border-b border-emerald-50 pb-1.5">
                            <span>Nilai Tugas ({tugasAssessmentColumns.length})</span>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">NT1, NT2...</span>
                          </div>
                          {tugasAssessmentColumns.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">Belum ada sesi Nilai Tugas pada periode ini.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {tugasAssessmentColumns.map((ass, i) => (
                                <div 
                                  key={ass.id} 
                                  onClick={() => setSelectedAssessmentDetail(ass)}
                                  className="flex items-start justify-between gap-2 p-1.5 rounded-lg hover:bg-emerald-50/60 cursor-pointer transition-colors"
                                >
                                  <div>
                                    <span className="font-mono font-black text-emerald-700 mr-1.5">NT{i + 1}:</span>
                                    <span className="text-slate-800 font-bold">{ass.material}</span>
                                    <div className="text-[10px] text-slate-500">Tgl: {ass.date} • Pengajar: {ass.teacherName}</div>
                                  </div>
                                  <Eye className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Kolom NU */}
                      {(selectedGradeType === 'ALL' || selectedGradeType === 'ULANGAN') && (
                        <div className="bg-white border border-amber-100 rounded-xl p-3 space-y-2 shadow-2xs">
                          <div className="font-extrabold text-amber-900 flex items-center justify-between border-b border-amber-50 pb-1.5">
                            <span>Nilai Ulangan ({ulanganAssessmentColumns.length})</span>
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">NU1, NU2...</span>
                          </div>
                          {ulanganAssessmentColumns.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">Belum ada sesi Nilai Ulangan pada periode ini.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {ulanganAssessmentColumns.map((ass, i) => (
                                <div 
                                  key={ass.id} 
                                  onClick={() => setSelectedAssessmentDetail(ass)}
                                  className="flex items-start justify-between gap-2 p-1.5 rounded-lg hover:bg-amber-50/60 cursor-pointer transition-colors"
                                >
                                  <div>
                                    <span className="font-mono font-black text-amber-700 mr-1.5">NU{i + 1}:</span>
                                    <span className="text-slate-800 font-bold">{ass.material}</span>
                                    <div className="text-[10px] text-slate-500">Tgl: {ass.date} • Pengajar: {ass.teacherName}</div>
                                  </div>
                                  <Eye className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                )}
            </div>

          </div>

        </div>
      )}

      {/* DETAIL MODAL FOR INDIVIDUAL ASSESSMENT */}
      {selectedAssessmentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-violet-900 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-800/80 rounded-2xl">
                  <GraduationCap className="w-5 h-5 text-violet-200" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    Detail Penilaian: {selectedAssessmentDetail.subject}
                  </h3>
                  <p className="text-xs text-violet-200">
                    Kelas {selectedAssessmentDetail.className} • Tanggal {selectedAssessmentDetail.date} • Pengajar: {selectedAssessmentDetail.teacherName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAssessmentDetail(null)}
                className="text-violet-200 hover:text-white p-2 rounded-xl hover:bg-violet-800/50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              
              {/* Material Info Box */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-2">
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Materi Pembelajaran</div>
                <div className="text-sm font-bold text-slate-800 leading-relaxed">
                  {selectedAssessmentDetail.material}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1 font-medium">
                  <span>Semester: <strong>{selectedAssessmentDetail.semester || '1 (Ganjil)'}</strong></span>
                  <span>Total Siswa: <strong>{selectedAssessmentDetail.grades.length} Siswa</strong></span>
                </div>
              </div>

              {/* Table of student scores */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">No</th>
                      <th className="py-3 px-3">NISN</th>
                      <th className="py-3 px-3">Nama Siswa</th>
                      <th className="py-3 px-3 text-center">Nilai Harian</th>
                      <th className="py-3 px-3 text-center">Nilai Tugas</th>
                      <th className="py-3 px-3 text-center">Nilai Ulangan</th>
                      <th className="py-3 px-3 text-center">Rata-Rata</th>
                      <th className="py-3 px-3 text-center">Predikat</th>
                      <th className="py-3 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedAssessmentDetail.grades.map((g, idx) => {
                      const finalSc = g.finalScore ?? (
                        (g.dailyScore !== null || g.assignmentScore !== null || g.examScore !== null)
                          ? Number((
                              ((g.dailyScore || 0) + (g.assignmentScore || 0) + (g.examScore || 0)) /
                              ((g.dailyScore !== null ? 1 : 0) + (g.assignmentScore !== null ? 1 : 0) + (g.examScore !== null ? 1 : 0) || 1)
                            ).toFixed(1))
                          : null
                      );

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{g.nisn || '-'}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{g.studentName}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600">
                            {g.dailyScore !== null ? g.dailyScore : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">
                            {g.assignmentScore !== null ? g.assignmentScore : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600">
                            {g.examScore !== null ? g.examScore : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-violet-700 bg-violet-50/50">
                            {finalSc !== null ? finalSc : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {finalSc !== null ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                                {g.predicate || (finalSc >= 85 ? 'A' : finalSc >= 75 ? 'B' : finalSc >= 60 ? 'C' : 'D')}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 italic max-w-xs truncate">{g.notes || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50">
              <span className="text-xs text-slate-500 font-medium">
                ID Penilaian: <code className="font-mono text-slate-700">{selectedAssessmentDetail.id}</code>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportStudentGradesExcel(selectedAssessmentDetail, schoolProfile)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel Lembar Ini
                </button>
                <button
                  type="button"
                  onClick={() => exportStudentGradesPdf(selectedAssessmentDetail, schoolProfile)}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF Lembar Ini
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
