import React, { useState, useMemo } from 'react';
import { 
  SchoolClass, 
  Student, 
  Teacher, 
  SchoolProfile, 
  LearningJournal, 
  LearningParticipationStatus,
  StudentLearningAttendance,
  UserSession
} from '../types';
import { 
  BookOpen, 
  Plus, 
  CheckSquare, 
  Clock, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  History, 
  Trash2, 
  Search, 
  Filter, 
  Award, 
  Calendar, 
  BookMarked,
  User,
  Sparkles,
  ChevronDown,
  X,
  Eye,
  Layers,
  FileText,
  Download,
  Printer,
  GraduationCap,
  Edit,
  Edit3,
  Lock,
  Unlock,
  RotateCcw,
  PlusCircle
} from 'lucide-react';
import { exportLearningJournalPdf, exportTeacherJournalPdf } from '../lib/exportUtils';
import { StudentGradesSection } from './StudentGradesSection';

interface LearningJournalViewProps {
  classes: SchoolClass[];
  students: Student[];
  teachers: Teacher[];
  schoolProfile: SchoolProfile;
  journals: LearningJournal[];
  onSaveJournal: (journal: LearningJournal) => void;
  onDeleteJournal: (journalId: string) => void;
  userRole?: string;
  userSession?: UserSession | null;
}

const PARTICIPATION_OPTIONS: { 
  value: LearningParticipationStatus; 
  label: string; 
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  iconBg: string;
}[] = [
  { 
    value: 'Sangat aktif', 
    label: 'Sangat Aktif', 
    color: 'bg-emerald-600 text-white border-emerald-500', 
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200', 
    badgeText: 'text-emerald-700',
    borderColor: 'border-emerald-300',
    iconBg: 'bg-emerald-500'
  },
  { 
    value: 'Cukup aktif', 
    label: 'Cukup Aktif', 
    color: 'bg-indigo-600 text-white border-indigo-500', 
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200', 
    badgeText: 'text-indigo-700',
    borderColor: 'border-indigo-300',
    iconBg: 'bg-indigo-500'
  },
  { 
    value: 'Kurang aktif', 
    label: 'Kurang Aktif', 
    color: 'bg-amber-500 text-white border-amber-400', 
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200', 
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-300',
    iconBg: 'bg-amber-500'
  },
  { 
    value: 'Mengganggu', 
    label: 'Mengganggu', 
    color: 'bg-orange-600 text-white border-orange-500', 
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-200', 
    badgeText: 'text-orange-700',
    borderColor: 'border-orange-300',
    iconBg: 'bg-orange-500'
  },
  { 
    value: 'Tidak hadir di kelas', 
    label: 'Tidak Hadir di Kelas', 
    color: 'bg-rose-600 text-white border-rose-500', 
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200', 
    badgeText: 'text-rose-700',
    borderColor: 'border-rose-300',
    iconBg: 'bg-rose-500'
  }
];

export const LearningJournalView: React.FC<LearningJournalViewProps> = ({
  classes,
  students,
  teachers,
  schoolProfile,
  journals,
  onSaveJournal,
  onDeleteJournal,
  userRole,
  userSession,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'kbm' | 'grades'>('create');
  
  // Form States
  const todayStr = new Date().toISOString().split('T')[0];

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) =>
      a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  // Determine initial teacher name automatically based on logged-in user session
  const initialTeacherName = useMemo(() => {
    if (userSession?.displayName) {
      if (userSession.teacherId) {
        const matched = teachers.find(t => t.id === userSession.teacherId);
        if (matched) return matched.name;
      }
      const matched = teachers.find(
        t => t.name.toLowerCase() === userSession.displayName.toLowerCase() ||
             (t.nip && userSession.username && t.nip.trim() === userSession.username.trim()) ||
             (t.nip && userSession.nipOrNisn && t.nip.trim() === userSession.nipOrNisn.trim())
      );
      if (matched) return matched.name;

      if (userSession.role === 'TEACHER' || userSession.displayName) {
        return userSession.displayName;
      }
    }
    return teachers[0]?.name || '';
  }, [userSession, teachers]);

  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [selectedSubject, setSelectedSubject] = useState<string>(schoolProfile.subjects?.[0] || 'Matematika');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([1, 2]);
  const [material, setMaterial] = useState<string>('');
  const [materialLimit, setMaterialLimit] = useState<string>('');
  const [notesOrTask, setNotesOrTask] = useState<string>('');
  const [teacherName, setTeacherName] = useState<string>(initialTeacherName);
  const [journalDate, setJournalDate] = useState<string>(todayStr);

  // Journal Persistence & Edit States
  const [savedJournalId, setSavedJournalId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(true);

  // Sync teacherName when logged in user session or teacher list changes
  React.useEffect(() => {
    if (initialTeacherName) {
      setTeacherName(initialTeacherName);
    }
  }, [initialTeacherName]);

  // Auto-set subject to teacher's subject1 or first available subject in list (only when creating new journal)
  React.useEffect(() => {
    if (isSaved) return; // Do not overwrite when in saved/edit mode
    const currentName = teacherName || initialTeacherName || userSession?.displayName;
    if (!currentName) {
      const defaultSub = schoolProfile.subjects?.[0] || 'Matematika';
      setSelectedSubject(defaultSub);
      return;
    }
    const matchedTeacher = teachers.find(
      t => t.name.toLowerCase() === currentName.toLowerCase() ||
           (userSession?.teacherId && t.id === userSession.teacherId) ||
           (t.nip && userSession?.username && t.nip.trim() === userSession.username.trim()) ||
           (t.nip && userSession?.nipOrNisn && t.nip.trim() === userSession.nipOrNisn.trim())
    );
    if (matchedTeacher && matchedTeacher.subject1) {
      setSelectedSubject(matchedTeacher.subject1);
    } else {
      const defaultSub = schoolProfile.subjects?.[0] || 'Matematika';
      setSelectedSubject(defaultSub);
    }
  }, [teacherName, initialTeacherName, userSession, teachers, schoolProfile.subjects, isSaved]);

  const availableSubjectsList = useMemo(() => {
    const defaultList = schoolProfile.subjects || [
      "Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS", 
      "Pendidikan Agama", "PJOK", "Seni Budaya", "Informatika", "PPKn"
    ];
    const list = [...defaultList];

    // Find matched teacher
    const currentName = teacherName || initialTeacherName || userSession?.displayName;
    const matchedTeacher = teachers.find(
      t => (currentName && t.name.toLowerCase() === currentName.toLowerCase()) ||
           (userSession?.teacherId && t.id === userSession.teacherId) ||
           (t.nip && userSession?.username && t.nip.trim() === userSession.username.trim()) ||
           (t.nip && userSession?.nipOrNisn && t.nip.trim() === userSession.nipOrNisn.trim())
    );

    if (matchedTeacher) {
      if (matchedTeacher.subject2 && !list.includes(matchedTeacher.subject2)) {
        list.unshift(matchedTeacher.subject2);
      }
      if (matchedTeacher.subject1 && !list.includes(matchedTeacher.subject1)) {
        list.unshift(matchedTeacher.subject1);
      }
    }

    if (selectedSubject && selectedSubject !== 'LAINNYA' && !list.includes(selectedSubject)) {
      list.unshift(selectedSubject);
    }
    return Array.from(new Set(list));
  }, [schoolProfile.subjects, teacherName, initialTeacherName, userSession, teachers, selectedSubject]);

  // Active logged-in teacher name for KBM filter
  const activeLoggedInTeacherName = useMemo(() => {
    return teacherName || initialTeacherName || userSession?.displayName || '';
  }, [teacherName, initialTeacherName, userSession]);

  // KBM Table Filter States (Filter Kelas & Pencarian)
  const [kbmClassFilter, setKbmClassFilter] = useState<string>('ALL');
  const [kbmSearchQuery, setKbmSearchQuery] = useState<string>('');
  const [exportClassFilter, setExportClassFilter] = useState<string>(classes[0]?.id || '');

  React.useEffect(() => {
    if (!kbmClassFilter && sortedClasses.length > 0) {
      setKbmClassFilter('ALL');
    }
    if ((!exportClassFilter || exportClassFilter === 'ALL') && sortedClasses.length > 0) {
      setExportClassFilter(sortedClasses[0].id);
    }
  }, [sortedClasses, kbmClassFilter, exportClassFilter]);

  // Student Attendance Ratings State: Map studentId -> { status, notes }
  const [studentRatings, setStudentRatings] = useState<Record<string, { status: LearningParticipationStatus; notes: string }>>({});

  // Feedback Notification
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Detail Modal for History
  const [selectedHistoryJournal, setSelectedHistoryJournal] = useState<LearningJournal | null>(null);

  // History Filter States
  const [historyClassFilter, setHistoryClassFilter] = useState<string>('ALL');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // PDF Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportPeriodType, setExportPeriodType] = useState<'WEEK' | 'MONTH'>('WEEK');

  // Delete Confirm State
  const [deleteConfirmJournal, setDeleteConfirmJournal] = useState<LearningJournal | null>(null);

  const now = new Date();
  const [exportMonth, setExportMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const [exportYear, setExportYear] = useState<number>(now.getFullYear());
  const [exportWeek, setExportWeek] = useState<string>('minggu_ini'); // 'minggu_ini', 'w1', 'w2', 'w3', 'w4'

  const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Helper to calculate Indonesian Day Name
  const getIndonesianDayName = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          return days[d.getDay()];
        }
      }
    } catch (e) {}
    return '-';
  };

  const formatDateFormatted = (dateStr: string): string => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Filtered KBM Table Journals (filtered by Logged-in Teacher Name and Class)
  const kbmFilteredJournals = useMemo(() => {
    return journals.filter(j => {
      const isTeacherRole = userSession?.role === 'TEACHER' || userRole === 'TEACHER';
      const matchTeacher = !isTeacherRole || !activeLoggedInTeacherName ||
        j.teacherName.toLowerCase() === activeLoggedInTeacherName.toLowerCase();
      const selectedClassObj = classes.find(c => c.id === kbmClassFilter || c.name === kbmClassFilter);
      const matchClass = kbmClassFilter === 'ALL' ||
        j.classId === kbmClassFilter ||
        j.className === kbmClassFilter ||
        (selectedClassObj && j.className === selectedClassObj.name);
      const query = kbmSearchQuery.toLowerCase().trim();
      const matchSearch = query === '' ||
        j.subject.toLowerCase().includes(query) ||
        j.material.toLowerCase().includes(query) ||
        (j.materialLimit && j.materialLimit.toLowerCase().includes(query)) ||
        (j.notesOrTask && j.notesOrTask.toLowerCase().includes(query)) ||
        j.teacherName.toLowerCase().includes(query) ||
        j.className.toLowerCase().includes(query);
      return matchTeacher && matchClass && matchSearch;
    }).sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [journals, activeLoggedInTeacherName, userSession, userRole, kbmClassFilter, kbmSearchQuery, classes]);
  const exportJournalsList = useMemo(() => {
    return journals.filter(j => {
      // Class Filter
      const matchClass = exportClassFilter === 'ALL' || j.classId === exportClassFilter || j.className === exportClassFilter;
      if (!matchClass) return false;

      if (!j.date) return false;
      const parts = j.date.split('-');
      if (parts.length !== 3) return false;
      const jYear = parseInt(parts[0], 10);
      const jMonth = parseInt(parts[1], 10);
      const jDay = parseInt(parts[2], 10);

      if (exportPeriodType === 'MONTH') {
        return jYear === exportYear && jMonth === exportMonth;
      } else {
        if (exportWeek === 'minggu_ini') {
          const jDateObj = new Date(jYear, jMonth - 1, jDay);
          const today = new Date();
          const diffDays = Math.abs((today.getTime() - jDateObj.getTime()) / (1000 * 3600 * 24));
          return diffDays <= 7;
        } else if (exportWeek === 'w1') {
          return jYear === exportYear && jMonth === exportMonth && jDay >= 1 && jDay <= 7;
        } else if (exportWeek === 'w2') {
          return jYear === exportYear && jMonth === exportMonth && jDay >= 8 && jDay <= 14;
        } else if (exportWeek === 'w3') {
          return jYear === exportYear && jMonth === exportMonth && jDay >= 15 && jDay <= 21;
        } else if (exportWeek === 'w4') {
          return jYear === exportYear && jMonth === exportMonth && jDay >= 22;
        }
        return true;
      }
    });
  }, [journals, exportPeriodType, exportMonth, exportYear, exportWeek, exportClassFilter]);

  const handleDownloadPdf = async () => {
    let periodTitle = '';
    const monthName = MONTH_NAMES[exportMonth - 1];

    if (exportPeriodType === 'MONTH') {
      periodTitle = `Bulan ${monthName} ${exportYear}`;
    } else {
      if (exportWeek === 'minggu_ini') {
        periodTitle = `Minggu Ini (${new Date().toLocaleDateString('id-ID')})`;
      } else if (exportWeek === 'w1') {
        periodTitle = `Minggu ke-1 ${monthName} ${exportYear} (Tgl 1 - 7)`;
      } else if (exportWeek === 'w2') {
        periodTitle = `Minggu ke-2 ${monthName} ${exportYear} (Tgl 8 - 14)`;
      } else if (exportWeek === 'w3') {
        periodTitle = `Minggu ke-3 ${monthName} ${exportYear} (Tgl 15 - 21)`;
      } else if (exportWeek === 'w4') {
        periodTitle = `Minggu ke-4 ${monthName} ${exportYear} (Tgl 22 - akhir)`;
      }
    }

    const selectedClassObj = classes.find(c => c.id === exportClassFilter || c.name === exportClassFilter);
    const classNameTitle = exportClassFilter === 'ALL'
      ? 'Semua Kelas'
      : `Kelas ${selectedClassObj ? selectedClassObj.name : exportClassFilter}`;

    // Determine Homeroom Teacher Info for Signature
    let modalHomeroomTeacherInfo: { name: string; nip?: string } | null = null;
    if (selectedClassObj && selectedClassObj.homeroomTeacher) {
      const foundTeacher = teachers.find(t => t.name === selectedClassObj.homeroomTeacher || t.id === selectedClassObj.homeroomTeacher);
      modalHomeroomTeacherInfo = {
        name: selectedClassObj.homeroomTeacher,
        nip: foundTeacher?.nip || ''
      };
    } else if (exportJournalsList.length > 0) {
      const firstClass = exportJournalsList[0].className || exportJournalsList[0].classId;
      if (firstClass && exportJournalsList.every(j => (j.className === firstClass || j.classId === firstClass))) {
        const foundClass = classes.find(c => c.id === firstClass || c.name === firstClass);
        if (foundClass && foundClass.homeroomTeacher) {
          const foundTeacher = teachers.find(t => t.name === foundClass.homeroomTeacher || t.id === foundClass.homeroomTeacher);
          modalHomeroomTeacherInfo = {
            name: foundClass.homeroomTeacher,
            nip: foundTeacher?.nip || ''
          };
        }
      }
    }

    // Determine Teacher Info for Signature in Modal
    let modalTeacherInfo: { name: string; nip?: string } | null = null;
    const firstTeacherInExport = exportJournalsList[0]?.teacherName;
    if (firstTeacherInExport && exportJournalsList.every(j => j.teacherName === firstTeacherInExport)) {
      const foundTeacher = teachers.find(t => t.name === firstTeacherInExport || t.id === firstTeacherInExport);
      modalTeacherInfo = {
        name: firstTeacherInExport,
        nip: foundTeacher?.nip || ''
      };
    } else {
      const activeName = teacherName || initialTeacherName || userSession?.displayName;
      if (activeName) {
        const foundTeacher = teachers.find(
          t => t.name.toLowerCase() === activeName.toLowerCase() ||
               (t.nip && userSession?.username && t.nip.trim() === userSession.username.trim()) ||
               (t.id && userSession?.teacherId && t.id === userSession.teacherId)
        );
        modalTeacherInfo = {
          name: foundTeacher?.name || activeName,
          nip: foundTeacher?.nip || ''
        };
      }
    }

    await exportLearningJournalPdf(schoolProfile, exportJournalsList, periodTitle, classNameTitle, modalTeacherInfo, modalHomeroomTeacherInfo);
    setIsExportModalOpen(false);
  };

  // Download Filtered KBM Jurnal PDF with Teacher Signature
  const handleDownloadKbmFilteredPdf = async () => {
    if (kbmFilteredJournals.length === 0) {
      alert('Tidak ada data Jurnal KBM yang sesuai dengan filter saat ini!');
      return;
    }

    // Determine Teacher Info for Signature
    let teacherInfo: { name: string; nip?: string } | null = null;
    const activeName = activeLoggedInTeacherName;
    if (activeName) {
      const foundTeacher = teachers.find(
        t => t.name.toLowerCase() === activeName.toLowerCase() ||
             (t.nip && userSession?.username && t.nip.trim() === userSession.username.trim()) ||
             (t.id && userSession?.teacherId && t.id === userSession.teacherId)
      );
      teacherInfo = {
        name: foundTeacher?.name || activeName,
        nip: foundTeacher?.nip || ''
      };
    } else {
      const firstTeacher = kbmFilteredJournals[0]?.teacherName;
      if (firstTeacher && kbmFilteredJournals.every(j => j.teacherName === firstTeacher)) {
        const foundTeacher = teachers.find(t => t.name === firstTeacher || t.id === firstTeacher);
        teacherInfo = {
          name: firstTeacher,
          nip: foundTeacher?.nip || ''
        };
      }
    }

    // Class Title & Homeroom Teacher Info
    let classNameFilter = 'Semua Kelas';
    let filterHomeroomTeacherInfo: { name: string; nip?: string } | null = null;

    if (kbmClassFilter !== 'ALL') {
      const foundClass = classes.find(c => c.id === kbmClassFilter || c.name === kbmClassFilter);
      classNameFilter = foundClass ? `Kelas ${foundClass.name}` : kbmClassFilter;
      if (foundClass && foundClass.homeroomTeacher) {
        const foundTeacher = teachers.find(t => t.name === foundClass.homeroomTeacher || t.id === foundClass.homeroomTeacher);
        filterHomeroomTeacherInfo = {
          name: foundClass.homeroomTeacher,
          nip: foundTeacher?.nip || ''
        };
      }
    } else if (kbmFilteredJournals.length > 0) {
      const firstClass = kbmFilteredJournals[0].className || kbmFilteredJournals[0].classId;
      if (firstClass && kbmFilteredJournals.every(j => (j.className === firstClass || j.classId === firstClass))) {
        const foundClass = classes.find(c => c.id === firstClass || c.name === firstClass);
        if (foundClass && foundClass.homeroomTeacher) {
          const foundTeacher = teachers.find(t => t.name === foundClass.homeroomTeacher || t.id === foundClass.homeroomTeacher);
          filterHomeroomTeacherInfo = {
            name: foundClass.homeroomTeacher,
            nip: foundTeacher?.nip || ''
          };
        }
      }
    }

    // Filter Title
    const teacherTitle = activeName || 'Semua Guru';
    const filterTitle = `Pengajar: ${teacherTitle}`;

    await exportTeacherJournalPdf(
      schoolProfile,
      kbmFilteredJournals,
      filterTitle,
      classNameFilter,
      teacherInfo,
      filterHomeroomTeacherInfo
    );
  };

  // Get current class object
  const currentClass = useMemo(() => {
    return classes.find(c => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Students belonging to the currently selected class (sorted Ascending by name)
  const currentClassStudents = useMemo(() => {
    if (!currentClass) return [];
    return students
      .filter(s => s.classId === currentClass.id || s.className === currentClass.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }));
  }, [students, currentClass]);

  // Initialize or update default ratings when selected class changes
  React.useEffect(() => {
    if (currentClassStudents.length > 0) {
      setStudentRatings(prev => {
        const initial: Record<string, { status: LearningParticipationStatus; notes: string }> = { ...prev };
        currentClassStudents.forEach(std => {
          // preserve existing if already touched, else default 'Sangat aktif'
          if (!initial[std.id]) {
            initial[std.id] = { status: 'Sangat aktif', notes: '' };
          }
        });
        return initial;
      });
    }
  }, [selectedClassId, currentClassStudents]);

  // Toggle Jam Ke (1-8)
  const togglePeriod = (periodNum: number) => {
    if (isSaved && !isEditing) return;
    if (selectedPeriods.includes(periodNum)) {
      if (selectedPeriods.length > 1) {
        setSelectedPeriods(selectedPeriods.filter(p => p !== periodNum).sort((a, b) => a - b));
      }
    } else {
      setSelectedPeriods([...selectedPeriods, periodNum].sort((a, b) => a - b));
    }
  };

  // Bulk set all students to a specific status
  const handleBulkSetStatus = (status: LearningParticipationStatus) => {
    if (isSaved && !isEditing) return;
    const updated = { ...studentRatings };
    currentClassStudents.forEach(std => {
      updated[std.id] = {
        status,
        notes: updated[std.id]?.notes || ''
      };
    });
    setStudentRatings(updated);
  };

  // Update individual student status
  const handleStudentStatusChange = (studentId: string, status: LearningParticipationStatus) => {
    if (isSaved && !isEditing) return;
    setStudentRatings(prev => ({
      ...prev,
      [studentId]: {
        status,
        notes: prev[studentId]?.notes || ''
      }
    }));
  };

  // Update individual student notes
  const handleStudentNoteChange = (studentId: string, notes: string) => {
    if (isSaved && !isEditing) return;
    setStudentRatings(prev => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || 'Sangat aktif',
        notes
      }
    }));
  };

  // Reset form to fill a brand new journal
  const handleResetToNewJournal = () => {
    setSavedJournalId(null);
    setIsSaved(false);
    setIsEditing(true);
    setMaterial('');
    setMaterialLimit('');
    setNotesOrTask('');
    setJournalDate(todayStr);
    setSelectedPeriods([1, 2]);

    // Reset default subject based on current teacher
    const currentName = teacherName || initialTeacherName || userSession?.displayName;
    const matchedTeacher = teachers.find(
      t => (currentName && t.name.toLowerCase() === currentName.toLowerCase()) ||
           (userSession?.teacherId && t.id === userSession.teacherId) ||
           (t.nip && userSession?.username && t.nip.trim() === userSession.username.trim()) ||
           (t.nip && userSession?.nipOrNisn && t.nip.trim() === userSession.nipOrNisn.trim())
    );
    if (matchedTeacher && matchedTeacher.subject1) {
      setSelectedSubject(matchedTeacher.subject1);
    } else {
      setSelectedSubject(schoolProfile.subjects?.[0] || 'Matematika');
    }
    setCustomSubject('');

    // Reset student ratings
    if (currentClassStudents.length > 0) {
      const initial: Record<string, { status: LearningParticipationStatus; notes: string }> = {};
      currentClassStudents.forEach(std => {
        initial[std.id] = { status: 'Sangat aktif', notes: '' };
      });
      setStudentRatings(initial);
    }

    setActiveSubTab('create');
    setSuccessToast('Formulir siap untuk pengisian Jurnal KBM baru.');
    setTimeout(() => setSuccessToast(null), 2500);
  };

  // Load an existing journal into the form for editing
  const handleLoadJournalForEdit = (journal: LearningJournal) => {
    setSavedJournalId(journal.id);
    setIsSaved(true);
    setIsEditing(true);
    setJournalDate(journal.date);
    setTeacherName(journal.teacherName);
    setSelectedClassId(journal.classId);

    const isCustom = !availableSubjectsList.includes(journal.subject);
    if (isCustom) {
      setSelectedSubject('LAINNYA');
      setCustomSubject(journal.subject);
    } else {
      setSelectedSubject(journal.subject);
      setCustomSubject('');
    }

    setSelectedPeriods(journal.periods || [1, 2]);
    setMaterial(journal.material || '');
    setMaterialLimit(journal.materialLimit || '');
    setNotesOrTask(journal.notesOrTask || '');

    // Map student ratings
    const ratings: Record<string, { status: LearningParticipationStatus; notes: string }> = {};
    if (journal.studentAttendances && journal.studentAttendances.length > 0) {
      journal.studentAttendances.forEach(att => {
        ratings[att.studentId] = {
          status: att.status,
          notes: att.notes || ''
        };
      });
    }
    setStudentRatings(ratings);

    setActiveSubTab('create');
    setSelectedHistoryJournal(null);
    setSuccessToast(`Memuat data Jurnal KBM (${journal.className} - ${journal.subject}) untuk diedit.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalSubject = selectedSubject === 'LAINNYA' ? customSubject.trim() : selectedSubject;

    if (!finalSubject) {
      alert('Silakan pilih atau tulis Mata Pelajaran!');
      return;
    }

    if (!material.trim()) {
      alert('Silakan isi Materi yang diajarkan dalam pembelajaran!');
      return;
    }

    if (selectedPeriods.length === 0) {
      alert('Pilih minimal 1 Jam Pembelajaran (Jam Ke)!');
      return;
    }

    if (!currentClass) {
      alert('Silakan pilih Kelas terlebih dahulu!');
      return;
    }

    const studentAttendancesList: StudentLearningAttendance[] = currentClassStudents.map(std => ({
      studentId: std.id,
      studentName: std.name,
      nisn: std.nisn,
      status: studentRatings[std.id]?.status || 'Sangat aktif',
      notes: studentRatings[std.id]?.notes?.trim() || undefined
    }));

    const targetJournalId = savedJournalId || `lj-${Date.now()}`;
    const existingJournal = journals.find(j => j.id === targetJournalId);

    const savedJournal: LearningJournal = {
      id: targetJournalId,
      date: journalDate,
      teacherName: teacherName || 'Guru Pengajar',
      classId: currentClass.id,
      className: currentClass.name,
      subject: finalSubject,
      periods: selectedPeriods,
      material: material.trim(),
      materialLimit: materialLimit.trim() || undefined,
      notesOrTask: notesOrTask.trim() || undefined,
      studentAttendances: studentAttendancesList,
      createdAt: existingJournal?.createdAt || new Date().toISOString()
    };

    onSaveJournal(savedJournal);

    // Save state & transition to saved mode
    setSavedJournalId(targetJournalId);
    setIsSaved(true);
    setIsEditing(false);

    // Show Toast Success
    const toastMsg = existingJournal
      ? `Perubahan Jurnal KBM ${finalSubject} (${currentClass.name}) berhasil disimpan!`
      : `Jurnal KBM ${finalSubject} (${currentClass.name}) berhasil disimpan! Data tersimpan dan dapat diedit.`;
    setSuccessToast(toastMsg);
    setTimeout(() => setSuccessToast(null), 4000);

    // Note: Form data (material, limit, notes, ratings) remains on screen!
  };

  // Filtered History Journals
  const filteredJournals = useMemo(() => {
    return journals.filter(j => {
      const matchClass = historyClassFilter === 'ALL' || j.classId === historyClassFilter || j.className === historyClassFilter;
      const matchSearch = historySearchQuery === '' || 
        j.subject.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        j.material.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        j.teacherName.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        j.className.toLowerCase().includes(historySearchQuery.toLowerCase());
      return matchClass && matchSearch;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [journals, historyClassFilter, historySearchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Success Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-6 h-6 text-emerald-200 shrink-0" />
          <div>
            <h4 className="font-extrabold text-sm">BERHASIL DISIMPAN!</h4>
            <p className="text-xs text-emerald-100">{successToast}</p>
          </div>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 text-xs font-black px-3.5 py-1 rounded-full border border-indigo-500/30">
              <BookOpen className="w-3.5 h-3.5 text-amber-300" />
              AKSES GURU & JURNAL KBM
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Fitur Pembelajaran & Aktivitas Siswa
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 max-w-2xl font-medium leading-relaxed">
              Catat jurnal kegiatan belajar mengajar (KBM), jam pelajaran, materi yang diajarkan, serta evaluasi tingkat keaktifan & kehadiran belajar siswa di kelas.
            </p>
          </div>

          {/* Tab Selection Switcher - Vertical Layout */}
          <div className="bg-slate-900/90 p-2 rounded-2xl border border-slate-700/80 flex flex-col gap-2 w-full sm:w-64 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activeSubTab === 'create' && isSaved) {
                  handleResetToNewJournal();
                } else {
                  handleResetToNewJournal();
                }
              }}
              className={`w-full px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2.5 justify-start ${
                activeSubTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Plus className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Input Jurnal KBM</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('kbm')}
              className={`w-full px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2.5 justify-start ${
                activeSubTab === 'kbm'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Tabel KBM & Filter</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('grades')}
              className={`w-full px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2.5 justify-start ${
                activeSubTab === 'grades'
                  ? 'bg-indigo-600 text-white shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Input Nilai Siswa</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2.5 justify-start shadow-md shadow-emerald-600/20"
            >
              <FileText className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>Download Jurnal KBM</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUBTAB 1: INPUT JURNAL PEMBELAJARAN BARU */}
      {activeSubTab === 'create' && (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Saved / Editing Status Banner */}
          {isSaved && (
            <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm ${
              isEditing 
                ? 'bg-amber-50/90 border-amber-300 text-amber-950' 
                : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
            }`}>
              <div className="flex items-start sm:items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  isEditing ? 'bg-amber-500 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md'
                }`}>
                  {isEditing ? <Unlock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black">
                      {isEditing ? 'Mode Edit Jurnal KBM Aktif' : 'Jurnal KBM Telah Disimpan'}
                    </h3>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                      isEditing 
                        ? 'bg-amber-200/80 text-amber-900 border-amber-300' 
                        : 'bg-emerald-200/80 text-emerald-900 border-emerald-300'
                    }`}>
                      {isEditing ? 'Bisa Diedit' : 'Tersimpan & Tampil Lengkap'}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 opacity-90">
                    {isEditing 
                      ? 'Silakan ubah isian data jurnal atau keaktifan siswa di bawah, lalu klik "Simpan Perubahan".'
                      : 'Semua data jurnal tetap ditampilkan. Klik tombol "Edit Jurnal" di bawah jika ingin mengubah data, atau klik "Input Jurnal Baru" untuk membuat jurnal baru.'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 text-amber-300" />
                    Edit Jurnal
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    Batal Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetToNewJournal}
                  className="bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 transition-all cursor-pointer flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Input Baru
                </button>
              </div>
            </div>
          )}
          
          {/* Card 1: Informasi Dasar Pembelajaran */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <BookMarked className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Form Jurnal Kegiatan Belajar Mengajar</h2>
                  <p className="text-xs text-slate-500">Lengkapi data mata pelajaran, jam ke, materi, dan pilih kelas yang diajar.</p>
                </div>
              </div>

              {isSaved && !isEditing && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Mode Tinjau (Terkunci)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Tanggal */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  Tanggal Pembelajaran
                </label>
                <input
                  type="date"
                  required
                  disabled={isSaved && !isEditing}
                  value={journalDate}
                  onChange={(e) => setJournalDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                />
              </div>

              {/* Nama Guru Pengajar (Akun Login) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Nama Guru Pengajar (Akun Login)
                </label>
                <div className="w-full bg-slate-100/90 border border-slate-200/80 text-slate-800 text-xs font-bold rounded-xl p-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">{activeLoggedInTeacherName || 'Guru Pengajar'}</span>
                </div>
              </div>

              {/* Pilih Kelas */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Pilih Kelas
                </label>
                <select
                  value={selectedClassId}
                  disabled={isSaved && !isEditing}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-black rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                >
                  {sortedClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name} ({c.grade})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pilih Mata Pelajaran */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  Mata Pelajaran
                </label>
                <select
                  value={selectedSubject}
                  disabled={isSaved && !isEditing}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                >
                  {availableSubjectsList.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                  <option value="LAINNYA">+ Ketik Mata Pelajaran Lain</option>
                </select>

                {selectedSubject === 'LAINNYA' && (
                  <input
                    type="text"
                    required
                    disabled={isSaved && !isEditing}
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Tulis Mata Pelajaran..."
                    className="mt-2 w-full bg-white border border-indigo-300 text-slate-900 text-xs font-bold rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                  />
                )}
              </div>

            </div>

            {/* Jam Ke (Checkbox Options 1 to 8) */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
              <label className="block text-xs font-extrabold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Jam Ke (Centang Jam Pembelajaran 1 - 8):
                </span>
                <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200 font-bold">
                  Pilihan: Jam ke-{selectedPeriods.join(', ')}
                </span>
              </label>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(pNum => {
                  const isChecked = selectedPeriods.includes(pNum);
                  const isLocked = isSaved && !isEditing;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      disabled={isLocked}
                      onClick={() => togglePeriod(pNum)}
                      className={`p-3 rounded-2xl border text-center transition-all font-black text-xs flex flex-col items-center justify-center gap-1 ${
                        isLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                      } ${
                        isChecked 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300' 
                          : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isLocked}
                          onChange={() => {}} // handled by parent button
                          className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span>Jam {pNum}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Materi Yang Diajarkan */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Materi yang Diajarkan / Pokok Bahasan
                </label>
                <textarea
                  required
                  rows={2}
                  disabled={isSaved && !isEditing}
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="Contoh: Bab 3 - Persamaan Kuadrat dan Aplikasi Kontekstual dalam Kehidupan Sehari-hari..."
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium rounded-2xl p-3.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                />
              </div>

              {/* Input Batasan Materi */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <BookMarked className="w-4 h-4 text-indigo-600" />
                  Batasan Materi / Target Sub-Pokok Bahasan
                </label>
                <input
                  type="text"
                  disabled={isSaved && !isEditing}
                  value={materialLimit}
                  onChange={(e) => setMaterialLimit(e.target.value)}
                  placeholder="Contoh: Sub-bab 2.1 s.d 2.3 (Buku Paket Hal. 45-58) / Capaian Pembelajaran KD 3.2..."
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium rounded-2xl p-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                />
              </div>

              {/* Input Catatan / Tugas Pembelajaran */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Catatan & Tugas Pembelajaran
                </label>
                <textarea
                  rows={2}
                  disabled={isSaved && !isEditing}
                  value={notesOrTask}
                  onChange={(e) => setNotesOrTask(e.target.value)}
                  placeholder="Contoh: Kerjakan Soal Latihan Mandiri 2.3 Nomor 1-5 Halaman 60, dikumpulkan minggu depan..."
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium rounded-2xl p-3.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                />
              </div>
            </div>

          </div>

          {/* Card 2: Evaluasi Kehadiran & Keaktifan Siswa di Kelas */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Kehadiran & Keaktifan Pembelajaran Siswa ({currentClassStudents.length} Siswa)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi nilai kehadiran & keaktifan belajar setiap siswa di kelas saat mata pelajaran berlangsung.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500">Pilih Cepat:</span>
                <button
                  type="button"
                  disabled={isSaved && !isEditing}
                  onClick={() => handleBulkSetStatus('Sangat aktif')}
                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-emerald-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Set Semua Sangat Aktif
                </button>
                <button
                  type="button"
                  disabled={isSaved && !isEditing}
                  onClick={() => handleBulkSetStatus('Cukup aktif')}
                  className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-indigo-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Set Semua Cukup Aktif
                </button>
              </div>
            </div>

            {/* Student List Grid */}
            {currentClassStudents.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-800 text-xs font-semibold">
                Belum ada siswa terdaftar di Kelas {currentClass?.name}. Silakan tambahkan data siswa di menu Database Siswa.
              </div>
            ) : (
              <div className="space-y-3">
                {currentClassStudents.map((std, idx) => {
                  const rating = studentRatings[std.id] || { status: 'Sangat aktif', notes: '' };
                  const isLocked = isSaved && !isEditing;

                  return (
                    <div 
                      key={std.id}
                      className="bg-slate-50/80 hover:bg-slate-50 p-4 rounded-2xl border border-slate-200/80 transition-all space-y-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        
                        {/* Student Info */}
                        <div className="flex items-center gap-3 shrink-0 min-w-[220px]">
                          <span className="text-xs font-mono font-bold text-slate-400 w-5">
                            #{idx + 1}
                          </span>
                          <img
                            src={std.photoUrl}
                            alt={std.name}
                            className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-200 shadow-xs"
                          />
                          <div>
                            <h4 className="text-xs font-black text-slate-900">{std.name}</h4>
                            <p className="text-[11px] font-mono text-indigo-600 font-bold">
                              NISN: {std.nisn} • {std.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                            </p>
                          </div>
                        </div>

                        {/* Rating Buttons Group (5 Options as requested) */}
                        <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-start lg:justify-end">
                          {PARTICIPATION_OPTIONS.map((opt) => {
                            const isSelected = rating.status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleStudentStatusChange(std.id, opt.value)}
                                className={`px-3 py-2 rounded-xl text-[11px] font-extrabold transition-all border flex items-center gap-1.5 ${
                                  isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                                } ${
                                  isSelected 
                                    ? `${opt.color} shadow-sm ring-2 ring-offset-1 ring-slate-400 scale-[1.02]` 
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : opt.iconBg}`}></span>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>

                      </div>

                      {/* Optional Notes Input */}
                      <div className="pt-1">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={rating.notes}
                          onChange={(e) => handleStudentNoteChange(std.id, e.target.value)}
                          placeholder="Catatan keaktifan / perilaku siswa saat KBM (Opsional)..."
                          className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submit Bar with Edit Button & New Input */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
                {isSaved ? (
                  <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Data Jurnal KBM tersimpan. Klik "Edit Jurnal" untuk memodifikasi atau "Input Jurnal KBM" untuk sesi baru.
                  </span>
                ) : (
                  <span>Pastikan seluruh data KBM & keaktifan siswa telah terisi dengan benar.</span>
                )}
              </div>

              <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
                {isSaved && !isEditing ? (
                  <>
                    {/* EDIT BUTTON BESIDE SAVE */}
                    <button
                      type="button"
                      id="btn-edit-jurnal"
                      onClick={() => setIsEditing(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-6 py-3.5 rounded-2xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.01]"
                    >
                      <Edit3 className="w-4 h-4 text-amber-300" />
                      Edit Jurnal KBM
                    </button>

                    {/* NEW JOURNAL BUTTON */}
                    <button
                      type="button"
                      id="btn-input-jurnal-baru"
                      onClick={handleResetToNewJournal}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-5 py-3.5 rounded-2xl shadow-md flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.01]"
                    >
                      <PlusCircle className="w-4 h-4 text-emerald-400" />
                      Input Jurnal Baru
                    </button>
                  </>
                ) : isSaved && isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-3.5 rounded-2xl border border-slate-300 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Lock className="w-4 h-4 text-slate-500" />
                      Batal Edit
                    </button>

                    <button
                      type="submit"
                      id="btn-simpan-perubahan-jurnal"
                      disabled={currentClassStudents.length === 0}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-6 py-3.5 rounded-2xl shadow-lg shadow-amber-600/20 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4 text-amber-200" />
                      Simpan Perubahan Jurnal
                    </button>
                  </>
                ) : (
                  <button
                    type="submit"
                    id="btn-simpan-jurnal"
                    disabled={currentClassStudents.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4 text-emerald-200" />
                    Simpan Jurnal KBM
                  </button>
                )}
              </div>
            </div>

          </div>

        </form>
      )}

      {/* SUBTAB KBM: TABEL KBM DENGAN FILTER KELAS & AKUN GURU LOGIN */}
      {activeSubTab === 'kbm' && (
        <div className="space-y-6">
          
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-indigo-600" />
                  Filter Data KBM (Kelas)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tampilkan tabel kegiatan belajar mengajar berdasarkan kelas dan nama guru sesuai akun login.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
                  Ditemukan: {kbmFilteredJournals.length} Jurnal KBM
                </span>

                <button
                  type="button"
                  onClick={handleDownloadKbmFilteredPdf}
                  disabled={kbmFilteredJournals.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download PDF Jurnal KBM sesuai hasil filter (disertai tanda tangan guru)"
                >
                  <Download className="w-4 h-4 text-emerald-200 shrink-0" />
                  <span>Download Jurnal Guru (PDF)</span>
                </button>

                {(kbmClassFilter !== 'ALL' || kbmSearchQuery !== '') && (
                  <button
                    onClick={() => {
                      setKbmClassFilter('ALL');
                      setKbmSearchQuery('');
                    }}
                    className="text-xs font-extrabold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Nama Guru (Akun Login) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Nama Guru (Akun Login)
                </label>
                <div className="w-full bg-slate-100/90 border border-slate-200/80 text-slate-800 text-xs font-bold rounded-xl p-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">{activeLoggedInTeacherName || 'Akun Guru'}</span>
                </div>
              </div>

              {/* Filter Kelas */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Filter Kelas
                </label>
                <select
                  value={kbmClassFilter}
                  onChange={(e) => setKbmClassFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">Semua Kelas</option>
                  {sortedClasses.map(c => (
                    <option key={c.id} value={c.id}>Kelas {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Pencarian Text */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  Cari Materi / Catatan
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={kbmSearchQuery}
                    onChange={(e) => setKbmSearchQuery(e.target.value)}
                    placeholder="Ketik materi, batasan, tugas..."
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium rounded-xl p-3 pl-9 focus:ring-2 focus:ring-indigo-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>
            </div>

          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
            {kbmFilteredJournals.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                <h3 className="text-sm font-extrabold text-slate-800">Tidak ada data Jurnal KBM ditemukan</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Coba ubah atau reset filter Nama Guru dan Kelas di atas untuk menampilkan data jurnal.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] uppercase tracking-wider font-black">
                      <th className="p-4 text-center border-b border-slate-800 w-24">Tanggal</th>
                      <th className="p-4 text-center border-b border-slate-800 w-20">Hari</th>
                      <th className="p-4 border-b border-slate-800 min-w-[140px]">Kelas</th>
                      <th className="p-4 border-b border-slate-800 min-w-[180px]">Materi</th>
                      <th className="p-4 border-b border-slate-800 min-w-[180px]">Batasan Materi</th>
                      <th className="p-4 border-b border-slate-800 min-w-[180px]">Tugas & Catatan</th>
                      <th className="p-4 text-center border-b border-slate-800 min-w-[200px]">Rekap Keaktifan Siswa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {kbmFilteredJournals.map((j) => {
                      const sangatAktif = j.studentAttendances?.filter(a => a.status === 'Sangat aktif').length || 0;
                      const cukupAktif = j.studentAttendances?.filter(a => a.status === 'Cukup aktif').length || 0;
                      const kurangAktif = j.studentAttendances?.filter(a => a.status === 'Kurang aktif').length || 0;
                      const menggangguOrAbsen = j.studentAttendances?.filter(a => a.status === 'Mengganggu' || a.status === 'Tidak hadir di kelas').length || 0;
                      const totalStudents = j.studentAttendances?.length || 0;

                      return (
                        <tr key={j.id} className="hover:bg-slate-50/80 transition-colors">
                          
                          {/* Tanggal */}
                          <td className="p-4 text-center font-mono font-bold text-slate-900 whitespace-nowrap align-top">
                            {formatDateFormatted(j.date)}
                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                              Jam ke-{j.periods.join(', ')}
                            </span>
                          </td>

                          {/* Hari */}
                          <td className="p-4 text-center align-top whitespace-nowrap">
                            <span className="inline-block font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200/80 text-[11px]">
                              {getIndonesianDayName(j.date)}
                            </span>
                          </td>

                          {/* Kelas */}
                          <td className="p-4 align-top">
                            <span className="inline-block font-black text-slate-900 text-xs bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                              Kelas {j.className}
                            </span>
                            <p className="text-xs font-bold text-indigo-600 mt-1">{j.subject}</p>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                              Guru: <span className="text-slate-700 font-semibold">{j.teacherName}</span>
                            </p>
                          </td>

                          {/* Materi */}
                          <td className="p-4 align-top">
                            <p className="font-bold text-slate-800 leading-snug">{j.material}</p>
                          </td>

                          {/* Batasan Materi */}
                          <td className="p-4 align-top">
                            {j.materialLimit ? (
                              <span className="inline-block bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-1.5 rounded-xl text-[11px] font-medium leading-relaxed">
                                {j.materialLimit}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
                          </td>

                          {/* Tugas dan Catatan */}
                          <td className="p-4 align-top">
                            {j.notesOrTask ? (
                              <span className="inline-block bg-indigo-50 text-indigo-900 border border-indigo-200/80 px-2.5 py-1.5 rounded-xl text-[11px] font-medium leading-relaxed">
                                {j.notesOrTask}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
                          </td>

                          {/* Rekap Keaktifan Siswa */}
                          <td className="p-4 align-top text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200" title="Sangat Aktif">
                                  SA: {sangatAktif}
                                </span>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200" title="Cukup Aktif">
                                  CA: {cukupAktif}
                                </span>
                                {kurangAktif > 0 && (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200" title="Kurang Aktif">
                                    KA: {kurangAktif}
                                  </span>
                                )}
                                {menggangguOrAbsen > 0 && (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200" title="Perlu Perhatian / Absen">
                                    M/A: {menggangguOrAbsen}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-500 font-bold">{totalStudents} Siswa</span>
                                <button
                                  type="button"
                                  onClick={() => handleLoadJournalForEdit(j)}
                                  className="text-[10px] font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                  title="Edit Jurnal KBM ini di formulir input"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedHistoryJournal(j)}
                                  className="text-[10px] font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                >
                                  <Eye className="w-3 h-3" />
                                  Detail Siswa
                                </button>
                              </div>
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* SUBTAB: INPUT NILAI SISWA */}
      {activeSubTab === 'grades' && (
        <StudentGradesSection
          classes={classes}
          students={students}
          teachers={teachers}
          schoolProfile={schoolProfile}
          journals={journals}
          activeLoggedInTeacherName={activeLoggedInTeacherName}
          onShowSuccessToast={(msg) => {
            setSuccessToast(msg);
            setTimeout(() => setSuccessToast(null), 4000);
          }}
          userSession={userSession}
        />
      )}


      {/* DETAIL MODAL FOR HISTORY JOURNAL */}
      {selectedHistoryJournal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-indigo-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-md">
                    Kelas {selectedHistoryJournal.className}
                  </span>
                  <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-amber-200">
                    Jam ke-{selectedHistoryJournal.periods.join(', ')}
                  </span>
                  <span className="text-xs font-mono text-slate-500 font-bold">
                    {selectedHistoryJournal.date}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900">{selectedHistoryJournal.subject}</h3>
                <p className="text-xs text-slate-500 font-medium">Pengajar: {selectedHistoryJournal.teacherName}</p>
              </div>

              <button
                onClick={() => setSelectedHistoryJournal(null)}
                className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-2xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Material Banner */}
            <div className="bg-indigo-50 border border-indigo-200/80 p-4 rounded-2xl text-xs text-indigo-950 space-y-2.5">
              <div>
                <strong className="text-indigo-900 font-extrabold block mb-0.5">Materi Pembelajaran:</strong>
                <p className="leading-relaxed">{selectedHistoryJournal.material}</p>
              </div>

              {selectedHistoryJournal.materialLimit && (
                <div className="pt-2 border-t border-indigo-100">
                  <strong className="text-indigo-900 font-extrabold block mb-0.5">Batasan Materi / Target Sub-Pokok Bahasan:</strong>
                  <p className="text-indigo-900 leading-relaxed">{selectedHistoryJournal.materialLimit}</p>
                </div>
              )}

              {selectedHistoryJournal.notesOrTask && (
                <div className="pt-2 border-t border-indigo-100">
                  <strong className="text-indigo-900 font-extrabold block mb-0.5">Catatan & Tugas Pembelajaran:</strong>
                  <p className="text-indigo-900 leading-relaxed">{selectedHistoryJournal.notesOrTask}</p>
                </div>
              )}
            </div>

            {/* Student List Ratings */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Daftar Kehadiran & Keaktifan Siswa ({selectedHistoryJournal.studentAttendances.length} Siswa)
              </h4>

              <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-1">
                {selectedHistoryJournal.studentAttendances.map((sa, idx) => {
                  const opt = PARTICIPATION_OPTIONS.find(p => p.value === sa.status) || PARTICIPATION_OPTIONS[0];

                  return (
                    <div key={sa.studentId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-400 font-mono text-[11px] font-bold w-5">#{idx + 1}</span>
                        <div>
                          <p className="font-bold text-slate-900 truncate">{sa.studentName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">NISN: {sa.nisn}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border ${opt.badgeBg}`}>
                          {sa.status}
                        </span>
                        {sa.notes && (
                          <p className="text-[10px] text-slate-500 italic mt-0.5 max-w-[200px] truncate">
                            "{sa.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  handleLoadJournalForEdit(selectedHistoryJournal);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <Edit3 className="w-4 h-4 text-amber-300" />
                Edit Jurnal Ini
              </button>

              <button
                onClick={() => setSelectedHistoryJournal(null)}
                className="bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-slate-900 cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DOWNLOAD REKAP JURNAL KBM PDF */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-400/20 rounded-2xl border border-amber-400/30 text-amber-300">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-white">Download Rekap Jurnal KBM (PDF)</h3>
                    <p className="text-xs text-indigo-200 mt-0.5 font-medium">Pilih periode mingguan atau bulanan untuk ekspor PDF rekap KBM</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-2 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              
              {/* Jenis Periode Switcher */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  1. Pilih Jenis Periode Rekap
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setExportPeriodType('WEEK')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      exportPeriodType === 'WEEK'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Pilihan Minggu
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportPeriodType('MONTH')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      exportPeriodType === 'MONTH'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BookMarked className="w-4 h-4" />
                    Pilihan Bulan
                  </button>
                </div>
              </div>

              {/* Detail Options based on Period Type */}
              {exportPeriodType === 'WEEK' ? (
                <div className="space-y-4 bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Pilihan Minggu:</label>
                    <select
                      value={exportWeek}
                      onChange={(e) => setExportWeek(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="minggu_ini">Minggu Ini (7 Hari Terakhir / Minggu Aktif)</option>
                      <option value="w1">Minggu ke-1 (Tanggal 1 s.d 7)</option>
                      <option value="w2">Minggu ke-2 (Tanggal 8 s.d 14)</option>
                      <option value="w3">Minggu ke-3 (Tanggal 15 s.d 21)</option>
                      <option value="w4">Minggu ke-4 (Tanggal 22 s.d Akhir Bulan)</option>
                    </select>
                  </div>

                  {exportWeek !== 'minggu_ini' && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Bulan:</label>
                        <select
                          value={exportMonth}
                          onChange={(e) => setExportMonth(parseInt(e.target.value, 10))}
                          className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          {MONTH_NAMES.map((m, idx) => (
                            <option key={idx} value={idx + 1}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Tahun:</label>
                        <select
                          value={exportYear}
                          onChange={(e) => setExportYear(parseInt(e.target.value, 10))}
                          className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value={2025}>2025</option>
                          <option value={2026}>2026</option>
                          <option value={2027}>2027</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Bulan:</label>
                      <select
                        value={exportMonth}
                        onChange={(e) => setExportMonth(parseInt(e.target.value, 10))}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {MONTH_NAMES.map((m, idx) => (
                          <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Tahun:</label>
                      <select
                        value={exportYear}
                        onChange={(e) => setExportYear(parseInt(e.target.value, 10))}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Filter Kelas */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  2. Pilih Filter Kelas
                </label>
                <select
                  value={exportClassFilter}
                  onChange={(e) => setExportClassFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2.5 rounded-2xl focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {sortedClasses.map(c => (
                    <option key={c.id} value={c.id}>Kelas {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Total Ready Count */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                exportJournalsList.length > 0 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {exportJournalsList.length > 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <span>
                    {exportJournalsList.length > 0
                      ? `Terdapat ${exportJournalsList.length} Jurnal KBM siap diunduh.`
                      : 'Tidak ada jurnal KBM untuk kriteria ini.'}
                  </span>
                </div>
                <span className="font-extrabold text-xs px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-xs">
                  {exportJournalsList.length} Item
                </span>
              </div>

              {/* Table Preview Info */}
              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-700 mb-1">Kolom Tabel PDF yang akan diekspor:</p>
                <p className="leading-tight">
                  • Tanggal &nbsp;• Hari &nbsp;• Jam Ke &nbsp;• Nama Guru &nbsp;• Mata Pelajaran &nbsp;• Materi Pelajaran
                </p>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:text-slate-900 hover:bg-slate-200 cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={exportJournalsList.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 text-emerald-200" />
                Download PDF Rekap KBM
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Jurnal Pembelajaran */}
      {deleteConfirmJournal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shrink-0">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Konfirmasi Hapus Jurnal</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Apakah Anda yakin ingin menghapus jurnal pembelajaran <strong className="text-slate-900">{deleteConfirmJournal.subject}</strong> kelas <strong className="text-slate-900">{deleteConfirmJournal.className}</strong> tanggal {formatDateFormatted(deleteConfirmJournal.date)}?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmJournal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteJournal(deleteConfirmJournal.id);
                  setDeleteConfirmJournal(null);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/30 transition-all cursor-pointer"
              >
                Ya, Hapus Jurnal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
