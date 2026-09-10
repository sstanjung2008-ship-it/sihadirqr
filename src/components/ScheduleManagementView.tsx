import React, { useState, useMemo, useEffect } from 'react';
import { 
  SchoolProfile, 
  SchoolClass, 
  Teacher, 
  LessonPeriod, 
  ClassScheduleSlot, 
  ScheduleConflict,
  UserRole,
  UserSession,
  LessonPeriodType
} from '../types';
import { 
  CalendarDays, 
  Clock, 
  UserCheck, 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Download, 
  FileText, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  Search, 
  Layers, 
  Sliders, 
  Building2, 
  HelpCircle,
  Eye,
  Info,
  X,
  Calendar,
  Check,
  ArrowRight,
  ShieldAlert,
  Palette,
  Filter,
  Volume2
} from 'lucide-react';
import { 
  exportClassSchedulePdf, 
  exportTeacherSchedulePdf, 
  exportClassScheduleExcel,
  getPeriodsForDay as getExportPeriodsForDay
} from '../lib/exportUtils';
import { INITIAL_LESSON_PERIODS } from '../data/mockData';
import { testKbmVoiceReminder } from '../lib/kbmVoiceReminder';

export interface TeacherColorTheme {
  id: string;
  name: string;
  colorName: string;
  bg: string;
  hoverBg: string;
  border: string;
  borderLeft: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  iconColor: string;
  dotBg: string;
  ringColor: string;
  hex: string;
}

export const TEACHER_COLOR_PALETTES: TeacherColorTheme[] = [
  {
    id: 'emerald',
    name: 'emerald',
    colorName: 'Emerald (Hijau Zamrud)',
    bg: 'bg-emerald-50/90',
    hoverBg: 'hover:bg-emerald-100',
    border: 'border-emerald-300',
    borderLeft: 'border-l-emerald-600',
    text: 'text-emerald-950',
    badgeBg: 'bg-emerald-100/90',
    badgeText: 'text-emerald-900',
    iconColor: 'text-emerald-700',
    dotBg: 'bg-emerald-500',
    ringColor: 'ring-emerald-400',
    hex: '#10b981',
  },
  {
    id: 'sky',
    name: 'sky',
    colorName: 'Sky (Biru Langit)',
    bg: 'bg-sky-50/90',
    hoverBg: 'hover:bg-sky-100',
    border: 'border-sky-300',
    borderLeft: 'border-l-sky-600',
    text: 'text-sky-950',
    badgeBg: 'bg-sky-100/90',
    badgeText: 'text-sky-900',
    iconColor: 'text-sky-700',
    dotBg: 'bg-sky-500',
    ringColor: 'ring-sky-400',
    hex: '#0ea5e9',
  },
  {
    id: 'amber',
    name: 'amber',
    colorName: 'Amber (Kuning Emas)',
    bg: 'bg-amber-50/90',
    hoverBg: 'hover:bg-amber-100',
    border: 'border-amber-300',
    borderLeft: 'border-l-amber-600',
    text: 'text-amber-950',
    badgeBg: 'bg-amber-100/90',
    badgeText: 'text-amber-900',
    iconColor: 'text-amber-700',
    dotBg: 'bg-amber-500',
    ringColor: 'ring-amber-400',
    hex: '#f59e0b',
  },
  {
    id: 'purple',
    name: 'purple',
    colorName: 'Purple (Ungu)',
    bg: 'bg-purple-50/90',
    hoverBg: 'hover:bg-purple-100',
    border: 'border-purple-300',
    borderLeft: 'border-l-purple-600',
    text: 'text-purple-950',
    badgeBg: 'bg-purple-100/90',
    badgeText: 'text-purple-900',
    iconColor: 'text-purple-700',
    dotBg: 'bg-purple-500',
    ringColor: 'ring-purple-400',
    hex: '#a855f7',
  },
  {
    id: 'rose',
    name: 'rose',
    colorName: 'Rose (Merah Mawar)',
    bg: 'bg-rose-50/90',
    hoverBg: 'hover:bg-rose-100',
    border: 'border-rose-300',
    borderLeft: 'border-l-rose-600',
    text: 'text-rose-950',
    badgeBg: 'bg-rose-100/90',
    badgeText: 'text-rose-900',
    iconColor: 'text-rose-700',
    dotBg: 'bg-rose-500',
    ringColor: 'ring-rose-400',
    hex: '#f43f5e',
  },
  {
    id: 'indigo',
    name: 'indigo',
    colorName: 'Indigo (Biru Tua)',
    bg: 'bg-indigo-50/90',
    hoverBg: 'hover:bg-indigo-100',
    border: 'border-indigo-300',
    borderLeft: 'border-l-indigo-600',
    text: 'text-indigo-950',
    badgeBg: 'bg-indigo-100/90',
    badgeText: 'text-indigo-900',
    iconColor: 'text-indigo-700',
    dotBg: 'bg-indigo-500',
    ringColor: 'ring-indigo-400',
    hex: '#6366f1',
  },
  {
    id: 'teal',
    name: 'teal',
    colorName: 'Teal (Toska Segar)',
    bg: 'bg-teal-50/90',
    hoverBg: 'hover:bg-teal-100',
    border: 'border-teal-300',
    borderLeft: 'border-l-teal-600',
    text: 'text-teal-950',
    badgeBg: 'bg-teal-100/90',
    badgeText: 'text-teal-900',
    iconColor: 'text-teal-700',
    dotBg: 'bg-teal-500',
    ringColor: 'ring-teal-400',
    hex: '#14b8a6',
  },
  {
    id: 'orange',
    name: 'orange',
    colorName: 'Orange (Jingga Cerah)',
    bg: 'bg-orange-50/90',
    hoverBg: 'hover:bg-orange-100',
    border: 'border-orange-300',
    borderLeft: 'border-l-orange-600',
    text: 'text-orange-950',
    badgeBg: 'bg-orange-100/90',
    badgeText: 'text-orange-900',
    iconColor: 'text-orange-700',
    dotBg: 'bg-orange-500',
    ringColor: 'ring-orange-400',
    hex: '#f97316',
  },
  {
    id: 'violet',
    name: 'violet',
    colorName: 'Violet (Ungu Violet)',
    bg: 'bg-violet-50/90',
    hoverBg: 'hover:bg-violet-100',
    border: 'border-violet-300',
    borderLeft: 'border-l-violet-600',
    text: 'text-violet-950',
    badgeBg: 'bg-violet-100/90',
    badgeText: 'text-violet-900',
    iconColor: 'text-violet-700',
    dotBg: 'bg-violet-500',
    ringColor: 'ring-violet-400',
    hex: '#8b5cf6',
  },
  {
    id: 'cyan',
    name: 'cyan',
    colorName: 'Cyan (Sian Pesisir)',
    bg: 'bg-cyan-50/90',
    hoverBg: 'hover:bg-cyan-100',
    border: 'border-cyan-300',
    borderLeft: 'border-l-cyan-600',
    text: 'text-cyan-950',
    badgeBg: 'bg-cyan-100/90',
    badgeText: 'text-cyan-900',
    iconColor: 'text-cyan-700',
    dotBg: 'bg-cyan-500',
    ringColor: 'ring-cyan-400',
    hex: '#06b6d4',
  },
  {
    id: 'fuchsia',
    name: 'fuchsia',
    colorName: 'Fuchsia (Fanta Magenta)',
    bg: 'bg-fuchsia-50/90',
    hoverBg: 'hover:bg-fuchsia-100',
    border: 'border-fuchsia-300',
    borderLeft: 'border-l-fuchsia-600',
    text: 'text-fuchsia-950',
    badgeBg: 'bg-fuchsia-100/90',
    badgeText: 'text-fuchsia-900',
    iconColor: 'text-fuchsia-700',
    dotBg: 'bg-fuchsia-500',
    ringColor: 'ring-fuchsia-400',
    hex: '#d946ef',
  },
  {
    id: 'lime',
    name: 'lime',
    colorName: 'Lime (Hijau Daun)',
    bg: 'bg-lime-50/90',
    hoverBg: 'hover:bg-lime-100',
    border: 'border-lime-300',
    borderLeft: 'border-l-lime-600',
    text: 'text-lime-950',
    badgeBg: 'bg-lime-100/90',
    badgeText: 'text-lime-900',
    iconColor: 'text-lime-700',
    dotBg: 'bg-lime-500',
    ringColor: 'ring-lime-400',
    hex: '#84cc16',
  },
  {
    id: 'blue',
    name: 'blue',
    colorName: 'Blue (Biru Royal)',
    bg: 'bg-blue-50/90',
    hoverBg: 'hover:bg-blue-100',
    border: 'border-blue-300',
    borderLeft: 'border-l-blue-600',
    text: 'text-blue-950',
    badgeBg: 'bg-blue-100/90',
    badgeText: 'text-blue-900',
    iconColor: 'text-blue-700',
    dotBg: 'bg-blue-500',
    ringColor: 'ring-blue-400',
    hex: '#3b82f6',
  },
  {
    id: 'pink',
    name: 'pink',
    colorName: 'Pink (Merah Muda)',
    bg: 'bg-pink-50/90',
    hoverBg: 'hover:bg-pink-100',
    border: 'border-pink-300',
    borderLeft: 'border-l-pink-600',
    text: 'text-pink-950',
    badgeBg: 'bg-pink-100/90',
    badgeText: 'text-pink-900',
    iconColor: 'text-pink-700',
    dotBg: 'bg-pink-500',
    ringColor: 'ring-pink-400',
    hex: '#ec4899',
  },
  {
    id: 'yellow',
    name: 'yellow',
    colorName: 'Yellow (Kuning Lemon)',
    bg: 'bg-yellow-50/90',
    hoverBg: 'hover:bg-yellow-100',
    border: 'border-yellow-300',
    borderLeft: 'border-l-yellow-600',
    text: 'text-yellow-950',
    badgeBg: 'bg-yellow-100/90',
    badgeText: 'text-yellow-900',
    iconColor: 'text-yellow-700',
    dotBg: 'bg-yellow-500',
    ringColor: 'ring-yellow-400',
    hex: '#eab308',
  },
  {
    id: 'slate',
    name: 'slate',
    colorName: 'Slate (Abu-abu Baja)',
    bg: 'bg-slate-100/90',
    hoverBg: 'hover:bg-slate-200',
    border: 'border-slate-300',
    borderLeft: 'border-l-slate-600',
    text: 'text-slate-900',
    badgeBg: 'bg-slate-200/90',
    badgeText: 'text-slate-800',
    iconColor: 'text-slate-700',
    dotBg: 'bg-slate-500',
    ringColor: 'ring-slate-400',
    hex: '#64748b',
  },
];

/**
 * Returns a consistent and unique color theme for each teacher.
 */
export function getTeacherColor(
  teacherIdOrName: string | undefined | null,
  teachersList: Teacher[] = []
): TeacherColorTheme {
  if (!teacherIdOrName) return TEACHER_COLOR_PALETTES[0];

  const clean = teacherIdOrName.trim().toLowerCase();

  // 1. Match by ID in teacherList
  const idxById = teachersList.findIndex(t => t.id && t.id.toLowerCase() === clean);
  if (idxById >= 0) {
    return TEACHER_COLOR_PALETTES[idxById % TEACHER_COLOR_PALETTES.length];
  }

  // 2. Match by Name in teacherList
  const idxByName = teachersList.findIndex(t => t.name && t.name.trim().toLowerCase() === clean);
  if (idxByName >= 0) {
    return TEACHER_COLOR_PALETTES[idxByName % TEACHER_COLOR_PALETTES.length];
  }

  // 3. Fallback deterministic hash based on string
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TEACHER_COLOR_PALETTES.length;
  return TEACHER_COLOR_PALETTES[index];
}

interface ScheduleManagementViewProps {
  schoolProfile: SchoolProfile;
  classes: SchoolClass[];
  teachers: Teacher[];
  periods: LessonPeriod[];
  schedules: ClassScheduleSlot[];
  onSavePeriods: (periods: LessonPeriod[]) => void;
  onSaveSchedules: (schedules: ClassScheduleSlot[]) => void;
  currentRole: UserRole;
  userSession?: UserSession | null;
}

export const ScheduleManagementView: React.FC<ScheduleManagementViewProps> = ({
  schoolProfile,
  classes,
  teachers,
  periods,
  schedules,
  onSavePeriods,
  onSaveSchedules,
  currentRole,
  userSession,
}) => {
  // Main view mode: 'class_matrix' | 'teacher_view' | 'period_settings'
  const [activeTab, setActiveTab] = useState<'class_matrix' | 'teacher_view' | 'period_settings'>('class_matrix');
  
  // Selected Class (Default to first class or user's class)
  const defaultClassId = classes.length > 0 ? classes[0].id : '';
  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClassId);

  // Match logged-in teacher based on userSession (by teacherId, NIP, username, or displayName)
  const loggedInTeacher = useMemo(() => {
    if (!userSession) return null;
    if (userSession.teacherId) {
      const found = teachers.find(t => t.id === userSession.teacherId);
      if (found) return found;
    }
    if (userSession.nipOrNisn) {
      const cleanNip = userSession.nipOrNisn.replace(/\s+/g, '').toLowerCase();
      const found = teachers.find(t => t.nip && t.nip.replace(/\s+/g, '').toLowerCase() === cleanNip);
      if (found) return found;
    }
    if (userSession.username) {
      const cleanUser = userSession.username.replace(/\s+/g, '').toLowerCase();
      const found = teachers.find(t => 
        (t.nip && t.nip.replace(/\s+/g, '').toLowerCase() === cleanUser) ||
        (t.name && t.name.toLowerCase() === cleanUser)
      );
      if (found) return found;
    }
    if (userSession.displayName) {
      const cleanName = userSession.displayName.trim().toLowerCase();
      const found = teachers.find(t => t.name.trim().toLowerCase() === cleanName);
      if (found) return found;
    }
    return null;
  }, [userSession, teachers]);

  // Teachers sorted alphabetically ascending by name (A-Z)
  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' }));
  }, [teachers]);

  // Selected Teacher for Teacher View (Default automatically to logged-in teacher if available)
  const defaultTeacherId = loggedInTeacher?.id || (sortedTeachers.length > 0 ? sortedTeachers[0].id : '');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(defaultTeacherId);

  // Keep selectedTeacherId synchronized when logged-in teacher or teachers list loads/changes
  useEffect(() => {
    if (loggedInTeacher?.id) {
      setSelectedTeacherId(loggedInTeacher.id);
    } else if (sortedTeachers.length > 0 && !selectedTeacherId) {
      setSelectedTeacherId(sortedTeachers[0].id);
    }
  }, [loggedInTeacher?.id, sortedTeachers, selectedTeacherId]);

  // Day tab in Period Settings: 'SEMUA' | 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu'
  const [selectedPeriodDayTab, setSelectedPeriodDayTab] = useState<string>('SEMUA');

  // Edit / Add Slot Modal State
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{
    id?: string;
    day: string;
    periodNumber: number;
    subject: string;
    teacherId: string;
    room: string;
    notes: string;
    durationJP: number; // for multi-JP batch fill
  } | null>(null);

  // Copy Schedule Modal State (Class to Class)
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargetClassId, setCopyTargetClassId] = useState<string>('');
  const [copyOverwrite, setCopyOverwrite] = useState(true);

  // Copy Day Period Structure Modal State (Day to Days)
  const [copyDayPeriodModalOpen, setCopyDayPeriodModalOpen] = useState(false);
  const [copySourceDay, setCopySourceDay] = useState<string>('SEMUA');
  const [copyTargetDays, setCopyTargetDays] = useState<string[]>([]);

  // Period Settings Edit Modal State
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<LessonPeriod | null>(null);

  // Highlighted Teacher filter state for timetable
  const [highlightedTeacherId, setHighlightedTeacherId] = useState<string | null>(null);

  // Confirmation Modal State (replaces all window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Notification / Toast message
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Active Days from SchoolProfile (fallback if empty)
  const activeDays = useMemo(() => {
    if (schoolProfile.activeDays && schoolProfile.activeDays.length > 0) {
      return schoolProfile.activeDays;
    }
    return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  }, [schoolProfile.activeDays]);

  // Selected Class Object
  const selectedClass = useMemo(() => {
    return classes.find(c => c.id === selectedClassId) || classes[0] || { id: 'default', name: 'Kelas 7-A', gradeLevel: '7', major: 'Umum' };
  }, [classes, selectedClassId]);

  // Selected Teacher Object
  const selectedTeacher = useMemo(() => {
    return teachers.find(t => t.id === selectedTeacherId) || teachers[0];
  }, [teachers, selectedTeacherId]);

  // Helper: Get periods for a specific day
  const getPeriodsForDay = (day: string): LessonPeriod[] => {
    const daySpecific = periods.filter(p => p.day === day || p.daySpecific === day);
    if (daySpecific.length > 0) {
      return [...daySpecific].sort((a, b) => {
        if (a.periodNumber !== b.periodNumber) {
          if (a.periodNumber === 0) return -1;
          if (b.periodNumber === 0) return 1;
          return a.periodNumber - b.periodNumber;
        }
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
    }
    const defaultPeriods = periods.filter(p => !p.day || p.day === 'SEMUA');
    if (defaultPeriods.length > 0) {
      return [...defaultPeriods].sort((a, b) => {
        if (a.periodNumber !== b.periodNumber) {
          if (a.periodNumber === 0) return -1;
          if (b.periodNumber === 0) return 1;
          return a.periodNumber - b.periodNumber;
        }
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
    }
    return INITIAL_LESSON_PERIODS;
  };

  // Standard Periods (Day = 'SEMUA' or undefined)
  const standardPeriods = useMemo(() => {
    const def = periods.filter(p => !p.day || p.day === 'SEMUA');
    return def.length > 0 ? [...def].sort((a, b) => {
      if (a.periodNumber !== b.periodNumber) {
        if (a.periodNumber === 0) return -1;
        if (b.periodNumber === 0) return 1;
        return a.periodNumber - b.periodNumber;
      }
      return (a.startTime || '').localeCompare(b.startTime || '');
    }) : INITIAL_LESSON_PERIODS;
  }, [periods]);

  // Check which days have custom timing
  const daysCustomMap = useMemo(() => {
    const map = new Map<string, { hasCustom: boolean; count: number; kbmCount: number }>();
    activeDays.forEach(day => {
      const daySpecific = periods.filter(p => p.day === day || p.daySpecific === day);
      const hasCustom = daySpecific.length > 0;
      const dayPeriodsList = hasCustom ? daySpecific : standardPeriods;
      const kbmCount = dayPeriodsList.filter(p => p.type === 'KBM').length;
      map.set(day, {
        hasCustom,
        count: dayPeriodsList.length,
        kbmCount
      });
    });
    return map;
  }, [periods, activeDays, standardPeriods]);

  // Calculate Maximum JP count across all days for matrix rows
  const maxJPOverall = useMemo(() => {
    let max = 8;
    activeDays.forEach(day => {
      const pList = getPeriodsForDay(day);
      const kbmNums = pList.filter(p => p.type === 'KBM').map(p => p.periodNumber);
      if (kbmNums.length > 0) {
        max = Math.max(max, ...kbmNums);
      }
    });
    return max;
  }, [periods, activeDays]);

  // Sorted Periods for active Period Tab in Settings
  const periodsInCurrentTab = useMemo(() => {
    if (selectedPeriodDayTab === 'SEMUA') {
      return standardPeriods;
    }
    const daySpecific = periods.filter(p => p.day === selectedPeriodDayTab || p.daySpecific === selectedPeriodDayTab);
    return daySpecific.length > 0 
      ? [...daySpecific].sort((a, b) => {
          if (a.periodNumber !== b.periodNumber) {
            if (a.periodNumber === 0) return -1;
            if (b.periodNumber === 0) return 1;
            return a.periodNumber - b.periodNumber;
          }
          return (a.startTime || '').localeCompare(b.startTime || '');
        })
      : [];
  }, [selectedPeriodDayTab, periods, standardPeriods]);

  // Calculate Conflicts across ALL schedules
  const detectedConflicts = useMemo(() => {
    const conflicts: ScheduleConflict[] = [];
    const map = new Map<string, ClassScheduleSlot[]>();

    schedules.forEach(slot => {
      if (!slot.teacherId) return;
      const key = `${slot.day}_JP${slot.periodNumber}_T_${slot.teacherId}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(slot);
    });

    map.forEach((slots) => {
      if (slots.length > 1) {
        const first = slots[0];
        conflicts.push({
          day: first.day,
          periodNumber: first.periodNumber,
          teacherId: first.teacherId,
          teacherName: first.teacherName,
          conflictingSlots: slots.map(s => ({
            slotId: s.id,
            classId: s.classId,
            className: s.className,
            subject: s.subject
          })),
        });
      }
    });

    return conflicts;
  }, [schedules]);

  // Helper to check if a specific slot has teacher conflict
  const checkSlotConflict = (day: string, periodNumber: number, teacherId: string, currentSlotId?: string) => {
    if (!teacherId) return null;
    const sameTimeSlots = schedules.filter(s => 
      s.day === day && 
      s.periodNumber === periodNumber && 
      s.teacherId === teacherId &&
      s.id !== currentSlotId
    );
    if (sameTimeSlots.length > 0) {
      return sameTimeSlots.map(s => s.className).join(', ');
    }
    return null;
  };

  // Distinct subjects available from school profile + teachers' subjects or general list
  const availableSubjects = useMemo(() => {
    const subs = new Set<string>();
    if (schoolProfile.subjects && Array.isArray(schoolProfile.subjects) && schoolProfile.subjects.length > 0) {
      schoolProfile.subjects.forEach(s => {
        if (s && s.trim()) subs.add(s.trim());
      });
    }
    teachers.forEach(t => {
      if (t.subject1 && t.subject1.trim()) subs.add(t.subject1.trim());
      if (t.subject2 && t.subject2.trim()) subs.add(t.subject2.trim());
    });
    // Default curriculum subjects
    [
      'Pendidikan Agama & Budi Pekerti',
      'Pendidikan Pancasila / PPKn',
      'Bahasa Indonesia',
      'Matematika',
      'Ilmu Pengetahuan Alam (IPA)',
      'Ilmu Pengetahuan Sosial (IPS)',
      'Bahasa Inggris',
      'Pendidikan Jasmani (PJOK)',
      'Informatika',
      'Seni Budaya & Prakarya',
      'Bahasa Daerah / Mulok',
      'Bimbingan Konseling (BK)',
      'Projek P5'
    ].forEach(s => subs.add(s));

    return Array.from(subs);
  }, [schoolProfile.subjects, teachers]);

  // Unique list of teachers teaching in the current class along with their distinct color theme & total JPs
  const classTeachersWithColors = useMemo(() => {
    const classSlots = schedules.filter(s => s.classId === selectedClass.id);
    const teacherMap = new Map<string, {
      teacherId: string;
      teacherName: string;
      teacherNip?: string;
      subjects: Set<string>;
      jpCount: number;
      colorTheme: TeacherColorTheme;
    }>();

    classSlots.forEach(s => {
      const tKey = s.teacherId || s.teacherName || 'unknown';
      if (!teacherMap.has(tKey)) {
        const theme = getTeacherColor(s.teacherId || s.teacherName, teachers);
        teacherMap.set(tKey, {
          teacherId: s.teacherId || '',
          teacherName: s.teacherName || 'Guru Pengajar',
          teacherNip: s.teacherNip,
          subjects: new Set(s.subject ? [s.subject] : []),
          jpCount: 0,
          colorTheme: theme,
        });
      }
      const existing = teacherMap.get(tKey)!;
      if (s.subject) existing.subjects.add(s.subject);
      existing.jpCount += 1;
    });

    return Array.from(teacherMap.values()).sort((a, b) => b.jpCount - a.jpCount);
  }, [schedules, selectedClass.id, teachers]);

  // Handle Opening Slot Modal for cell click
  const handleCellClick = (day: string, periodNumber: number) => {
    if (currentRole !== 'ADMIN' && currentRole !== 'SUPER_ADMIN') return;

    const dayPeriods = getPeriodsForDay(day);
    const dayJP = dayPeriods.find(p => p.periodNumber === periodNumber && p.type === 'KBM');
    if (!dayJP) {
      showToast(`Hari ${day} tidak memiliki sesi KBM untuk JP ${periodNumber}.`, 'info');
      return;
    }

    const existing = schedules.find(s => s.classId === selectedClass.id && s.day === day && s.periodNumber === periodNumber);
    if (existing) {
      setEditingSlot({
        id: existing.id,
        day: existing.day,
        periodNumber: existing.periodNumber,
        subject: existing.subject,
        teacherId: existing.teacherId,
        room: existing.room || `Ruang ${selectedClass.name}`,
        notes: existing.notes || '',
        durationJP: 1
      });
    } else {
      const defaultTeacher = loggedInTeacher || teachers[0];
      const defaultSubject = (defaultTeacher && defaultTeacher.subject1 && availableSubjects.includes(defaultTeacher.subject1))
        ? defaultTeacher.subject1
        : (availableSubjects[0] || 'Matematika');

      setEditingSlot({
        day,
        periodNumber: periodNumber,
        subject: defaultSubject,
        teacherId: defaultTeacher?.id || '',
        room: `Ruang ${selectedClass.name}`,
        notes: '',
        durationJP: 1
      });
    }
    setSlotModalOpen(true);
  };

  // Save Slot (Single or Multi-JP batch fill)
  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;

    const targetTeacher = teachers.find(t => t.id === editingSlot.teacherId);
    const teacherName = targetTeacher ? targetTeacher.name : 'Guru Pengajar';
    const teacherNip = targetTeacher?.nip || '';

    const newSchedules = [...schedules];
    const duration = Math.max(1, Math.min(4, Number(editingSlot.durationJP) || 1));
    const dayPeriods = getPeriodsForDay(editingSlot.day);

    for (let i = 0; i < duration; i++) {
      const currentJP = editingSlot.periodNumber + i;
      
      // Ensure period exists and is KBM for that day
      const periodExists = dayPeriods.find(p => p.periodNumber === currentJP && p.type === 'KBM');
      if (!periodExists) continue;

      const slotId = editingSlot.id && i === 0
        ? editingSlot.id
        : `sch-${selectedClass.id}-${editingSlot.day.toLowerCase().slice(0, 3)}-${currentJP}-${Date.now()}-${i}`;

      const teacherColorTheme = getTeacherColor(editingSlot.teacherId, teachers);

      const slotData: ClassScheduleSlot = {
        id: slotId,
        classId: selectedClass.id,
        className: selectedClass.name,
        day: editingSlot.day,
        periodNumber: currentJP,
        subject: editingSlot.subject,
        teacherId: editingSlot.teacherId,
        teacherName: teacherName,
        teacherNip: teacherNip,
        room: editingSlot.room,
        notes: editingSlot.notes,
        color: teacherColorTheme.name
      };

      const existingIndex = newSchedules.findIndex(s => s.classId === selectedClass.id && s.day === editingSlot.day && s.periodNumber === currentJP);
      if (existingIndex >= 0) {
        newSchedules[existingIndex] = slotData;
      } else {
        newSchedules.push(slotData);
      }
    }

    onSaveSchedules(newSchedules);
    setSlotModalOpen(false);
    setEditingSlot(null);
    showToast(`Jadwal ${editingSlot.subject} kelas ${selectedClass.name} berhasil disimpan!`);
  };

  // Delete Slot
  const handleDeleteSlot = (slotId: string) => {
    const updated = schedules.filter(s => s.id !== slotId);
    onSaveSchedules(updated);
    setSlotModalOpen(false);
    setEditingSlot(null);
    showToast('Slot jadwal berhasil dikosongkan.');
  };

  // Clear All Slots for current class
  const handleClearClassSchedule = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Kosongkan Seluruh Jadwal Kelas',
      message: `Apakah Anda yakin ingin mengosongkan seluruh mata pelajaran untuk Kelas ${selectedClass.name}? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Ya, Kosongkan Jadwal',
      isDestructive: true,
      onConfirm: () => {
        const updated = schedules.filter(s => s.classId !== selectedClass.id);
        onSaveSchedules(updated);
        setConfirmModal(null);
        showToast(`Seluruh jadwal kelas ${selectedClass.name} berhasil dikosongkan.`);
      }
    });
  };

  // Execute Copy Schedule to target class
  const handleExecuteCopy = () => {
    if (!copyTargetClassId) {
      showToast('Pilih kelas tujuan terlebih dahulu!', 'error');
      return;
    }
    const targetClass = classes.find(c => c.id === copyTargetClassId);
    if (!targetClass) return;

    const sourceSlots = schedules.filter(s => s.classId === selectedClass.id);
    if (sourceSlots.length === 0) {
      showToast(`Kelas sumber (${selectedClass.name}) belum memiliki jadwal untuk disalin.`, 'error');
      return;
    }

    let updated = copyOverwrite 
      ? schedules.filter(s => s.classId !== targetClass.id)
      : [...schedules];

    sourceSlots.forEach((s, idx) => {
      const newSlot: ClassScheduleSlot = {
        ...s,
        id: `sch-${targetClass.id}-${s.day.toLowerCase().slice(0, 3)}-${s.periodNumber}-${Date.now()}-${idx}`,
        classId: targetClass.id,
        className: targetClass.name,
        room: `Ruang ${targetClass.name}`
      };
      const exists = updated.some(u => u.classId === targetClass.id && u.day === s.day && u.periodNumber === s.periodNumber);
      if (copyOverwrite || !exists) {
        updated.push(newSlot);
      }
    });

    onSaveSchedules(updated);
    setCopyModalOpen(false);
    showToast(`Berhasil menyalin jadwal dari ${selectedClass.name} ke ${targetClass.name}!`);
  };

  // Period Settings Management: Save Period
  const handleSavePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod) return;

    const targetDay = editingPeriod.day || selectedPeriodDayTab;
    const periodToSave: LessonPeriod = {
      ...editingPeriod,
      day: targetDay === 'SEMUA' ? undefined : targetDay,
      daySpecific: targetDay === 'SEMUA' ? undefined : targetDay
    };

    const newPeriods = [...periods];
    const idx = newPeriods.findIndex(p => p.id === periodToSave.id);
    if (idx >= 0) {
      newPeriods[idx] = periodToSave;
    } else {
      newPeriods.push(periodToSave);
    }
    onSavePeriods(newPeriods);
    setPeriodModalOpen(false);
    setEditingPeriod(null);
    showToast('Sesi Jam Pelajaran berhasil disimpan.');
  };

  // Period Settings: Delete Period (FIXED with modal)
  const handleDeletePeriod = (periodId: string) => {
    const targetPeriod = periods.find(p => p.id === periodId);
    const label = targetPeriod ? (targetPeriod.type === 'KBM' ? `JP ${targetPeriod.periodNumber}` : targetPeriod.label) : 'Sesi ini';
    
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Sesi Jam Pelajaran',
      message: `Apakah Anda yakin ingin menghapus "${label}" (${targetPeriod?.startTime || ''} - ${targetPeriod?.endTime || ''})?`,
      confirmLabel: 'Ya, Hapus Sesi',
      isDestructive: true,
      onConfirm: () => {
        const updated = periods.filter(p => p.id !== periodId);
        onSavePeriods(updated);
        setConfirmModal(null);
        showToast('Sesi Jam Pelajaran berhasil dihapus.');
      }
    });
  };

  // Revert Day-specific periods back to Standard
  const handleRevertDayToStandard = (day: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Kembalikan Jam Hari ${day} ke Standar`,
      message: `Hapus pengaturan jam khusus hari ${day} dan gunakan kembali struktur jam standar sekolah?`,
      confirmLabel: 'Ya, Gunakan Jam Standar',
      isDestructive: false,
      onConfirm: () => {
        const updated = periods.filter(p => p.day !== day && p.daySpecific !== day);
        onSavePeriods(updated);
        setConfirmModal(null);
        showToast(`Hari ${day} sekarang kembali mengikuti jadwal standar sekolah.`);
      }
    });
  };

  // Activate Custom Day Timing by copying standard periods
  const handleActivateCustomDayTiming = (day: string) => {
    const copied: LessonPeriod[] = standardPeriods.map((p, idx) => ({
      ...p,
      id: `p-${day.toLowerCase()}-${p.periodNumber}-${Date.now()}-${idx}`,
      day: day,
      daySpecific: day
    }));

    const withoutCurrent = periods.filter(p => p.day !== day && p.daySpecific !== day);
    onSavePeriods([...withoutCurrent, ...copied]);
    showToast(`Jam khusus hari ${day} telah diaktifkan. Anda sekarang dapat mengubah waktu JP hari ini.`);
  };

  // Reset ALL default periods
  const handleResetDefaultPeriods = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Jam Pelajaran ke Standar Nasional',
      message: 'Kembalikan seluruh sesi jam pelajaran ke template standar nasional (8 JP KBM + 2 Istirahat)? Pengaturan kustom semua hari akan diatur ulang.',
      confirmLabel: 'Ya, Reset ke Standar',
      isDestructive: true,
      onConfirm: () => {
        onSavePeriods(INITIAL_LESSON_PERIODS);
        setConfirmModal(null);
        showToast('Sesi Jam Pelajaran berhasil direset ke standar.');
      }
    });
  };

  // Apply Quick Presets
  const handleApplyPreset = (preset: 'SMP_8JP' | 'SD_6JP' | 'FULLDAY_9JP' | 'JUMAT_5JP' | 'SENIN_UPACARA' | 'SABTU_6JP') => {
    const currentDay = selectedPeriodDayTab;
    const isGlobal = currentDay === 'SEMUA';

    setConfirmModal({
      isOpen: true,
      title: `Terapkan Template Waktu`,
      message: `Terapkan preset waktu "${preset.replace('_', ' ')}" untuk ${isGlobal ? 'Seluruh Hari (Standar)' : `Hari ${currentDay}`}?`,
      confirmLabel: 'Ya, Terapkan Template',
      isDestructive: false,
      onConfirm: () => {
        let generated: LessonPeriod[] = [];
        const dayTag = isGlobal ? undefined : currentDay;

        if (preset === 'JUMAT_5JP') {
          generated = [
            { id: `p-fri-0-${Date.now()}`, periodNumber: 0, startTime: '07:00', endTime: '07:30', type: 'LITERASI', label: 'Pembiasaan Pagi / Sholat Dhuha', day: dayTag, daySpecific: dayTag },
            { id: `p-fri-1-${Date.now()}`, periodNumber: 1, startTime: '07:30', endTime: '08:05', type: 'KBM', label: 'JP 1 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fri-2-${Date.now()}`, periodNumber: 2, startTime: '08:05', endTime: '08:40', type: 'KBM', label: 'JP 2 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fri-brk-${Date.now()}`, periodNumber: 0, startTime: '08:40', endTime: '09:00', type: 'ISTIRAHAT', label: 'Istirahat Pagi', day: dayTag, daySpecific: dayTag },
            { id: `p-fri-3-${Date.now()}`, periodNumber: 3, startTime: '09:00', endTime: '09:35', type: 'KBM', label: 'JP 3 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fri-4-${Date.now()}`, periodNumber: 4, startTime: '09:35', endTime: '10:10', type: 'KBM', label: 'JP 4 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fri-5-${Date.now()}`, periodNumber: 5, startTime: '10:10', endTime: '10:45', type: 'KBM', label: 'JP 5 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fri-jumat-${Date.now()}`, periodNumber: 0, startTime: '10:45', endTime: '11:20', type: 'IBADAH', label: 'Persiapan Sholat Jumat / Keputrian / Pulang', day: dayTag, daySpecific: dayTag },
          ];
        } else if (preset === 'SENIN_UPACARA') {
          generated = [
            { id: `p-mon-0-${Date.now()}`, periodNumber: 0, startTime: '07:00', endTime: '07:45', type: 'UPACARA', label: 'Upacara Bendera', day: dayTag, daySpecific: dayTag },
            { id: `p-mon-1-${Date.now()}`, periodNumber: 1, startTime: '07:45', endTime: '08:25', type: 'KBM', label: 'JP 1', day: dayTag, daySpecific: dayTag },
            { id: `p-mon-2-${Date.now()}`, periodNumber: 2, startTime: '08:25', endTime: '09:05', type: 'KBM', label: 'JP 2', day: dayTag, daySpecific: dayTag },
            { id: `p-mon-3-${Date.now()}`, periodNumber: 3, startTime: '09:05', endTime: '09:45', type: 'KBM', label: 'JP 3', day: dayTag, daySpecific: dayTag },
            { id: `p-mon-brk1-${Date.now()}`, periodNumber: 0, startTime: '09:45', endTime: '10:15', type: 'ISTIRAHAT', label: 'Istirahat 1', day: dayTag, daySpecific: dayTag },
            { id: `p-mon-4-${Date.now()}`, periodNumber: 4, startTime: '10:15', endTime: '10:55', type: 'KBM', label: 'JP 4', day: dayTag, daySpecific: dayTag },
            { id: `p-mon-5-${Date.now()}`, periodNumber: 5, startTime: '10:55', endTime: '11:35', type: 'KBM', label: 'JP 5', day: dayTag, daySpecific: dayTag },
            { id: `p-mon-6-${Date.now()}`, periodNumber: 6, startTime: '11:35', endTime: '12:15', type: 'KBM', label: 'JP 6', day: dayTag, daySpecific: dayTag },
            { id: `p-mon-brk2-${Date.now()}`, periodNumber: 0, startTime: '12:15', endTime: '12:55', type: 'IBADAH', label: 'Sholat Dzuhur & Istirahat 2', day: dayTag, daySpecific: dayTag },
            { id: `p-mon-7-${Date.now()}`, periodNumber: 7, startTime: '12:55', endTime: '13:35', type: 'KBM', label: 'JP 7', day: dayTag, daySpecific: dayTag },
            { id: `p-mon-8-${Date.now()}`, periodNumber: 8, startTime: '13:35', endTime: '14:15', type: 'KBM', label: 'JP 8', day: dayTag, daySpecific: dayTag },
          ];
        } else if (preset === 'SABTU_6JP') {
          generated = [
            { id: `p-sat-0-${Date.now()}`, periodNumber: 0, startTime: '07:00', endTime: '07:40', type: 'LITERASI', label: 'Senam Pagi / Pembinaan Karakter', day: dayTag, daySpecific: dayTag },
            { id: `p-sat-1-${Date.now()}`, periodNumber: 1, startTime: '07:40', endTime: '08:15', type: 'KBM', label: 'JP 1 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sat-2-${Date.now()}`, periodNumber: 2, startTime: '08:15', endTime: '08:50', type: 'KBM', label: 'JP 2 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sat-3-${Date.now()}`, periodNumber: 3, startTime: '08:50', endTime: '09:25', type: 'KBM', label: 'JP 3 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sat-brk-${Date.now()}`, periodNumber: 0, startTime: '09:25', endTime: '09:45', type: 'ISTIRAHAT', label: 'Istirahat Pagi', day: dayTag, daySpecific: dayTag },
            { id: `p-sat-4-${Date.now()}`, periodNumber: 4, startTime: '09:45', endTime: '10:20', type: 'KBM', label: 'JP 4 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sat-5-${Date.now()}`, periodNumber: 5, startTime: '10:20', endTime: '10:55', type: 'KBM', label: 'JP 5 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sat-6-${Date.now()}`, periodNumber: 6, startTime: '10:55', endTime: '11:30', type: 'KBM', label: 'JP 6 / Pramuka', day: dayTag, daySpecific: dayTag },
          ];
        } else if (preset === 'SD_6JP') {
          generated = [
            { id: `p-sd-0-${Date.now()}`, periodNumber: 0, startTime: '07:00', endTime: '07:15', type: 'UPACARA', label: 'Apel / Literasi Pagi', day: dayTag, daySpecific: dayTag },
            { id: `p-sd-1-${Date.now()}`, periodNumber: 1, startTime: '07:15', endTime: '07:50', type: 'KBM', label: 'JP 1 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sd-2-${Date.now()}`, periodNumber: 2, startTime: '07:50', endTime: '08:25', type: 'KBM', label: 'JP 2 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sd-3-${Date.now()}`, periodNumber: 3, startTime: '08:25', endTime: '09:00', type: 'KBM', label: 'JP 3 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sd-brk1-${Date.now()}`, periodNumber: 0, startTime: '09:00', endTime: '09:20', type: 'ISTIRAHAT', label: 'Istirahat 1', day: dayTag, daySpecific: dayTag },
            { id: `p-sd-4-${Date.now()}`, periodNumber: 4, startTime: '09:20', endTime: '09:55', type: 'KBM', label: 'JP 4 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sd-5-${Date.now()}`, periodNumber: 5, startTime: '09:55', endTime: '10:30', type: 'KBM', label: 'JP 5 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sd-6-${Date.now()}`, periodNumber: 6, startTime: '10:30', endTime: '11:05', type: 'KBM', label: 'JP 6 (35m)', day: dayTag, daySpecific: dayTag },
            { id: `p-sd-brk2-${Date.now()}`, periodNumber: 0, startTime: '11:05', endTime: '11:30', type: 'LAINNYA', label: 'Doa Bersama / Pulang', day: dayTag, daySpecific: dayTag },
          ];
        } else if (preset === 'FULLDAY_9JP') {
          generated = [
            { id: `p-fd-0-${Date.now()}`, periodNumber: 0, startTime: '07:00', endTime: '07:30', type: 'UPACARA', label: 'Upacara / Sholat Dhuha / Literasi', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-1-${Date.now()}`, periodNumber: 1, startTime: '07:30', endTime: '08:15', type: 'KBM', label: 'JP 1 (45m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-2-${Date.now()}`, periodNumber: 2, startTime: '08:15', endTime: '09:00', type: 'KBM', label: 'JP 2 (45m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-3-${Date.now()}`, periodNumber: 3, startTime: '09:00', endTime: '09:45', type: 'KBM', label: 'JP 3 (45m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-brk1-${Date.now()}`, periodNumber: 0, startTime: '09:45', endTime: '10:05', type: 'ISTIRAHAT', label: 'Istirahat 1', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-4-${Date.now()}`, periodNumber: 4, startTime: '10:05', endTime: '10:50', type: 'KBM', label: 'JP 4 (45m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-5-${Date.now()}`, periodNumber: 5, startTime: '10:50', endTime: '11:35', type: 'KBM', label: 'JP 5 (45m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-6-${Date.now()}`, periodNumber: 6, startTime: '11:35', endTime: '12:15', type: 'KBM', label: 'JP 6 (40m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-brk2-${Date.now()}`, periodNumber: 0, startTime: '12:15', endTime: '13:00', type: 'IBADAH', label: 'Sholat Dzuhur & Makan Siang', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-7-${Date.now()}`, periodNumber: 7, startTime: '13:00', endTime: '13:45', type: 'KBM', label: 'JP 7 (45m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-8-${Date.now()}`, periodNumber: 8, startTime: '13:45', endTime: '14:30', type: 'KBM', label: 'JP 8 (45m)', day: dayTag, daySpecific: dayTag },
            { id: `p-fd-9-${Date.now()}`, periodNumber: 9, startTime: '14:30', endTime: '15:15', type: 'KBM', label: 'JP 9 (45m)', day: dayTag, daySpecific: dayTag },
          ];
        } else {
          // Standard SMP/SMA 8 JP
          generated = INITIAL_LESSON_PERIODS.map((p, idx) => ({
            ...p,
            id: `p-std-${p.periodNumber}-${Date.now()}-${idx}`,
            day: dayTag,
            daySpecific: dayTag
          }));
        }

        if (isGlobal) {
          // Replace standard periods
          const customDaysPeriods = periods.filter(p => p.day && p.day !== 'SEMUA');
          onSavePeriods([...customDaysPeriods, ...generated]);
        } else {
          // Replace specific day periods
          const otherPeriods = periods.filter(p => p.day !== currentDay && p.daySpecific !== currentDay);
          onSavePeriods([...otherPeriods, ...generated]);
        }

        setConfirmModal(null);
        showToast(`Preset jadwal berhasil diterapkan!`);
      }
    });
  };

  // Copy Day Structure to Other Days
  const handleExecuteCopyDayStructure = () => {
    if (copyTargetDays.length === 0) {
      showToast('Pilih minimal satu hari tujuan!', 'error');
      return;
    }

    const sourcePeriods = copySourceDay === 'SEMUA' 
      ? standardPeriods 
      : getPeriodsForDay(copySourceDay);

    let updated = [...periods];

    copyTargetDays.forEach(targetDay => {
      // Remove existing custom periods for targetDay
      updated = updated.filter(p => p.day !== targetDay && p.daySpecific !== targetDay);
      
      // Inject cloned periods
      sourcePeriods.forEach((p, idx) => {
        updated.push({
          ...p,
          id: `p-${targetDay.toLowerCase()}-${p.periodNumber}-${Date.now()}-${idx}`,
          day: targetDay,
          daySpecific: targetDay
        });
      });
    });

    onSavePeriods(updated);
    setCopyDayPeriodModalOpen(false);
    showToast(`Berhasil menyalin struktur sesi ke: ${copyTargetDays.join(', ')}!`);
  };

  const isAdmin = currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN';

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-white text-sm animate-bounce ${
          toastMessage.type === 'success' ? 'bg-emerald-600' : toastMessage.type === 'error' ? 'bg-rose-600' : 'bg-indigo-600'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className={`p-4 text-white flex items-center space-x-2 ${confirmModal.isDestructive ? 'bg-rose-600' : 'bg-indigo-700'}`}>
              <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
              <h3 className="font-bold text-sm">{confirmModal.title}</h3>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 text-sm leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  {confirmModal.cancelLabel || 'Batal'}
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className={`px-4 py-2 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer ${
                    confirmModal.isDestructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {confirmModal.confirmLabel || 'Ya, Lanjutkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-700/60 rounded-xl">
                <CalendarDays className="w-6 h-6 text-amber-300" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Jadwal Pelajaran & Jam KBM</h1>
            </div>
            <p className="text-indigo-200 text-sm max-w-2xl">
              Kelola struktur jam pelajaran (JP) tiap hari secara fleksibel, pemetaan guru dan mata pelajaran tiap kelas, serta deteksi otomatis bentrok jam mengajar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {detectedConflicts.length > 0 && (
              <div className="px-3 py-1.5 bg-rose-500/20 border border-rose-400/30 text-rose-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-xs">
                <AlertTriangle className="w-4 h-4 text-rose-300" />
                <span>{detectedConflicts.length} Bentrok Jadwal Terdeteksi</span>
              </div>
            )}
            <div className="px-3 py-1.5 bg-white/10 rounded-xl text-xs text-indigo-200 border border-white/10 font-medium">
              Tahun Ajaran: <span className="text-white font-bold">{schoolProfile.academicYear || '2025/2026'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveTab('class_matrix')}
          className={`flex items-center space-x-2 px-4 py-3 font-semibold text-xs rounded-t-xl transition-all border-b-2 cursor-pointer ${
            activeTab === 'class_matrix'
              ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Matriks Jadwal Kelas</span>
        </button>

        <button
          onClick={() => setActiveTab('teacher_view')}
          className={`flex items-center space-x-2 px-4 py-3 font-semibold text-xs rounded-t-xl transition-all border-b-2 cursor-pointer ${
            activeTab === 'teacher_view'
              ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Jadwal Mengajar Guru</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('period_settings')}
            className={`flex items-center space-x-2 px-4 py-3 font-semibold text-xs rounded-t-xl transition-all border-b-2 cursor-pointer ${
              activeTab === 'period_settings'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pengaturan Sesi Jam (JP) Tiap Hari</span>
          </button>
        )}
      </div>

      {/* TAB 1: MATRIKS JADWAL KELAS */}
      {activeTab === 'class_matrix' && (
        <div className="space-y-4">
          {/* Controls Bar: Class Selection & Actions */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-slate-700 flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Pilih Kelas:</span>
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm font-bold rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer shadow-sm"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.gradeLevel ? `Tingkat ${c.gradeLevel}` : ''} {c.major ? `- ${c.major}` : ''})
                  </option>
                ))}
              </select>

              {selectedClass.homeroomTeacher && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  Wali Kelas: <strong className="text-slate-800">{selectedClass.homeroomTeacher}</strong>
                </span>
              )}
            </div>

            {/* Action buttons: Export & Copy */}
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setCopyTargetClassId(classes.find(c => c.id !== selectedClass.id)?.id || '');
                      setCopyModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Salin ke Kelas Lain</span>
                  </button>

                  <button
                    onClick={handleClearClassSchedule}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Kosongkan Jadwal</span>
                  </button>
                </>
              )}

              <button
                onClick={async () => {
                  showToast('Memutar Nada & Suara AI Pengingat KBM...');
                  await testKbmVoiceReminder();
                }}
                title="Putar nada lonceng & Suara AI Pengingat KBM perempuan"
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-xl border border-purple-200 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-purple-600" />
                <span>Tes Suara KBM</span>
              </button>

              <button
                onClick={() => exportClassSchedulePdf(selectedClass, schedules, periods, schoolProfile)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Unduh PDF</span>
              </button>

              <button
                onClick={() => exportClassScheduleExcel(selectedClass, schedules, periods, schoolProfile)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Unduh Excel</span>
              </button>
            </div>
          </div>

          {/* Active Days Notice */}
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Hari aktif belajar: <strong>{activeDays.join(', ')}</strong> ({activeDays.length} Hari Kerja). Setiap hari memiliki alokasi waktu JP yang disesuaikan secara otomatis.
              </span>
            </div>
            {isAdmin && (
              <span className="text-[11px] text-amber-800 font-medium">
                Klik sel KBM untuk mengisi / mengubah guru & mapel.
              </span>
            )}
          </div>

          {/* Teacher Color Legend & Quick Filter */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>Warna Kotak Guru di Kelas {selectedClass.name}</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      ({classTeachersWithColors.length} Guru Aktif)
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Setiap guru memiliki warna kotak tersendiri agar mudah dibedakan. Klik nama guru untuk menyorot jadwalnya di tabel.
                  </p>
                </div>
              </div>

              {highlightedTeacherId && (
                <button
                  onClick={() => setHighlightedTeacherId(null)}
                  className="self-start sm:self-auto text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-xl transition-colors cursor-pointer flex items-center space-x-1 border border-indigo-200 shadow-xs"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Hapus Sorotan Guru</span>
                </button>
              )}
            </div>

            {classTeachersWithColors.length === 0 ? (
              <div className="text-xs text-slate-400 italic py-1.5 px-1 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                Belum ada jadwal guru yang diplot untuk Kelas {selectedClass.name}. Klik tombol "Isi Mapel" pada sel tabel untuk mulai menyusun jadwal.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {classTeachersWithColors.map(t => {
                  const isSelected = highlightedTeacherId === t.teacherId || (!!t.teacherName && highlightedTeacherId === t.teacherName);
                  const color = t.colorTheme;

                  return (
                    <button
                      key={t.teacherId || t.teacherName}
                      onClick={() => {
                        const targetKey = t.teacherId || t.teacherName;
                        setHighlightedTeacherId(prev => (prev === targetKey ? null : targetKey));
                      }}
                      title={`Klik untuk menyorot seluruh jadwal ${t.teacherName} (${color.colorName})`}
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                        color.bg
                      } ${color.border} ${color.text} ${
                        isSelected 
                          ? `ring-3 ${color.ringColor} font-bold shadow-md scale-[1.03] brightness-105 border-l-4 ${color.borderLeft}` 
                          : 'hover:shadow-sm hover:scale-[1.01]'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${color.dotBg} shrink-0 ring-2 ring-white shadow-xs`} />
                      <span className="font-bold">{t.teacherName}</span>
                      <span className="text-[10px] opacity-80 font-medium">
                        ({Array.from(t.subjects).join(', ')})
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${color.badgeBg} ${color.badgeText} border ${color.border}`}>
                        {t.jpCount} JP
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timetable Matrix Grid Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-3 w-20 text-center border-r border-slate-700">JP</th>
                    {activeDays.map(day => {
                      const dayMeta = daysCustomMap.get(day);
                      return (
                        <th key={day} className="py-3 px-3 text-center border-r border-slate-700 last:border-r-0">
                          <div>{day}</div>
                          <div className="text-[10px] font-normal lowercase tracking-normal text-indigo-200">
                            ({dayMeta?.kbmCount || 0} JP KBM)
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {/* Apel / Upacara / Literasi Pagi Row */}
                  {standardPeriods.find(p => p.periodNumber === 0 && (p.type === 'UPACARA' || p.type === 'LITERASI' || (p.startTime || '') < '07:30')) && (
                    <tr className="bg-slate-50/80 hover:bg-slate-100/60 transition-colors">
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-500 border-r border-slate-200">
                        -
                      </td>
                      {activeDays.map(day => {
                        const dPeriods = getPeriodsForDay(day);
                        const morningActivity = dPeriods.find(p => p.periodNumber === 0 && (p.type === 'UPACARA' || p.type === 'LITERASI' || (p.startTime || '') < '07:30'));
                        return (
                          <td key={day} className="py-2.5 px-2 text-center text-slate-500 font-medium italic bg-amber-50/40 border-r border-slate-200 last:border-r-0">
                            <span className="inline-flex items-center space-x-1 text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-200 text-[11px] font-semibold">
                              <Clock className="w-3 h-3" />
                              <span>{morningActivity?.label || 'Upacara / Pembiasaan'}</span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* KBM Rows from JP 1 to maxJPOverall */}
                  {Array.from({ length: maxJPOverall }, (_, i) => i + 1).map(jpNumber => {
                    return (
                      <React.Fragment key={`row-jp-${jpNumber}`}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-3 text-center font-bold text-indigo-900 bg-indigo-50/40 border-r border-slate-200">
                            JP {jpNumber}
                          </td>
                          {activeDays.map(day => {
                            const dayPeriods = getPeriodsForDay(day);
                            const dayJP = dayPeriods.find(p => p.periodNumber === jpNumber && p.type === 'KBM');
                            const hasKbmThisJP = !!dayJP;

                            if (!hasKbmThisJP) {
                              // Day has fewer JPs (e.g. Friday 5 JP or Saturday 6 JP)
                              return (
                                <td key={day} className="p-2 border-r border-slate-200 last:border-r-0 bg-slate-50/70 align-middle text-center">
                                  <div className="py-3 px-2 rounded-xl border border-dashed border-slate-200 text-slate-400 text-[11px]">
                                    <span>Non-KBM / Pulang</span>
                                  </div>
                                </td>
                              );
                            }

                            const slot = schedules.find(s => s.classId === selectedClass.id && s.day === day && s.periodNumber === jpNumber);
                            const conflictTeacherClasses = slot ? checkSlotConflict(day, jpNumber, slot.teacherId, slot.id) : null;
                            const slotColor = slot ? getTeacherColor(slot.teacherId || slot.teacherName, teachers) : null;
                            const isSlotHighlighted = highlightedTeacherId && slot && (slot.teacherId === highlightedTeacherId || slot.teacherName === highlightedTeacherId);
                            const isSlotDimmed = highlightedTeacherId && slot && (slot.teacherId !== highlightedTeacherId && slot.teacherName !== highlightedTeacherId);

                            return (
                              <td 
                                key={day} 
                                onClick={() => handleCellClick(day, jpNumber)}
                                className={`p-2 border-r border-slate-200 last:border-r-0 align-top transition-all ${
                                  isAdmin ? 'cursor-pointer hover:bg-indigo-50/60' : ''
                                } ${slot ? 'bg-white' : 'bg-slate-50/20'}`}
                              >
                                {slot && slotColor ? (
                                  <div className={`p-2.5 rounded-xl border transition-all text-xs relative group border-l-[5px] ${
                                    conflictTeacherClasses 
                                      ? 'bg-rose-50 border-rose-300 border-l-rose-600 text-rose-900 shadow-sm' 
                                      : `${slotColor.bg} ${slotColor.hoverBg} ${slotColor.border} ${slotColor.borderLeft} ${slotColor.text} shadow-xs`
                                  } ${
                                    isSlotHighlighted ? `ring-3 ${slotColor.ringColor} shadow-md scale-[1.03] z-10 brightness-105` : ''
                                  } ${
                                    isSlotDimmed ? 'opacity-35 grayscale-[20%]' : ''
                                  }`}>
                                    {/* Subject Title & Color Indicator Dot */}
                                    <div className="font-bold text-slate-900 text-xs line-clamp-1 mb-1.5 flex items-center justify-between">
                                      <span className="truncate">{slot.subject}</span>
                                      <span 
                                        className={`w-2.5 h-2.5 rounded-full ${slotColor.dotBg} shrink-0 ml-1 shadow-xs`} 
                                        title={`Guru: ${slot.teacherName} (${slotColor.colorName})`}
                                      />
                                    </div>

                                    {/* Teacher with Distinct Color Badge */}
                                    <div className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold mb-1.5 max-w-full ${slotColor.badgeBg} ${slotColor.badgeText} border ${slotColor.border}`}>
                                      <UserCheck className={`w-3 h-3 ${slotColor.iconColor} shrink-0`} />
                                      <span className="truncate">{slot.teacherName}</span>
                                    </div>

                                    {/* Time Badge for this specific day */}
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200/70">
                                      <span>{dayJP.startTime} - {dayJP.endTime}</span>
                                      {slot.room && (
                                        <span className="bg-white/90 border border-slate-200 px-1 rounded text-[9px] font-sans font-medium text-slate-600">
                                          {slot.room}
                                        </span>
                                      )}
                                    </div>

                                    {/* Conflict Warning Badge */}
                                    {conflictTeacherClasses && (
                                      <div className="mt-1.5 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center space-x-1 shadow-xs">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>Bentrok: {conflictTeacherClasses}</span>
                                      </div>
                                    )}

                                    {isAdmin && (
                                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="p-1 bg-white rounded-lg shadow-sm border border-slate-200 text-indigo-600 block hover:bg-indigo-50">
                                          <Edit3 className="w-3 h-3" />
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="h-16 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors p-1">
                                    {isAdmin ? (
                                      <>
                                        <div className="flex items-center space-x-1 text-[11px] font-medium">
                                          <Plus className="w-3 h-3" />
                                          <span>Isi Mapel</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                          {dayJP.startTime} - {dayJP.endTime}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-[11px] text-slate-300 font-mono">-</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Midday Break insertion after JP 4 */}
                        {jpNumber === 4 && (
                          <tr className="bg-amber-50/50 hover:bg-amber-50/80 transition-colors">
                            <td className="py-2 px-3 text-center font-semibold text-amber-800 border-r border-slate-200">
                              IST
                            </td>
                            {activeDays.map(day => {
                              const dPeriods = getPeriodsForDay(day);
                              const brk = dPeriods.find(p => p.type === 'ISTIRAHAT');
                              return (
                                <td key={day} className="py-2 px-2 text-center text-amber-800 font-medium italic border-r border-slate-200 last:border-r-0">
                                  <span className="inline-flex items-center space-x-1 text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-200">
                                    <Clock className="w-3 h-3" />
                                    <span>{brk?.label || 'Istirahat Pagi'} ({brk?.startTime || ''}-{brk?.endTime || ''})</span>
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BEBAN MENGAJAR GURU (TEACHER VIEW) */}
      {activeTab === 'teacher_view' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-slate-700 flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>Pilih Guru Pengajar:</span>
              </label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm font-bold rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer shadow-sm"
              >
                {sortedTeachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.nip ? `(NIP: ${t.nip})` : ''} - {t.subject1} {loggedInTeacher?.id === t.id ? '⭐ (Akun Anda)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedTeacher && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => exportTeacherSchedulePdf(selectedTeacher, schedules, periods, schoolProfile)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh PDF Jadwal Guru</span>
                </button>
              </div>
            )}
          </div>

          {selectedTeacher && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Teacher Summary Card */}
              <div className="bg-indigo-900 text-white p-5 rounded-2xl shadow-md space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-xl font-bold text-amber-300 border border-white/20">
                    {selectedTeacher.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{selectedTeacher.name}</h3>
                    <p className="text-xs text-indigo-200">NIP: {selectedTeacher.nip || '-'}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-indigo-700/60 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-indigo-300">Mata Pelajaran:</span>
                    <span className="font-semibold text-white">{selectedTeacher.subject1 || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-300">Total Beban Mengajar:</span>
                    <span className="font-bold text-amber-300 text-sm">
                      {schedules.filter(s => s.teacherId === selectedTeacher.id).length} JP / Minggu
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-300">Kelas yang Diajar:</span>
                    <span className="font-semibold text-white">
                      {Array.from(new Set(schedules.filter(s => s.teacherId === selectedTeacher.id).map(s => s.className))).join(', ') || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Teacher Weekly Timetable */}
              <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <CalendarDays className="w-4 h-4 text-indigo-600" />
                    <span>Jadwal Mengajar Mingguan: {selectedTeacher.name}</span>
                  </span>
                  <span className="text-slate-500 font-normal">
                    {schedules.filter(s => s.teacherId === selectedTeacher.id).length} Jam Pelajaran
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-xs font-bold">
                        <th className="py-2.5 px-3 w-16 text-center border-r border-slate-200">JP</th>
                        {activeDays.map(day => (
                          <th key={day} className="py-2.5 px-3 text-center border-r border-slate-200 last:border-r-0">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {Array.from({ length: maxJPOverall }, (_, i) => i + 1).map(jpNumber => {
                        return (
                          <tr key={jpNumber}>
                            <td className="py-2.5 px-3 text-center font-bold text-indigo-900 bg-indigo-50/40 border-r border-slate-200">
                              JP {jpNumber}
                            </td>
                            {activeDays.map(day => {
                              const dayPeriods = getPeriodsForDay(day);
                              const dayJP = dayPeriods.find(p => p.periodNumber === jpNumber && p.type === 'KBM');

                              if (!dayJP) {
                                return (
                                  <td key={day} className="p-2 border-r border-slate-200 last:border-r-0 bg-slate-50 text-center text-slate-300 text-xs">
                                    -
                                  </td>
                                );
                              }

                              const mySlots = schedules.filter(s => s.teacherId === selectedTeacher.id && s.day === day && s.periodNumber === jpNumber);
                              const isConflict = mySlots.length > 1;
                              const teacherColor = getTeacherColor(selectedTeacher.id, teachers);

                              return (
                                <td key={day} className="p-2 border-r border-slate-200 last:border-r-0 align-middle text-center">
                                  {mySlots.length > 0 ? (
                                    <div className={`p-2 rounded-xl border text-xs font-semibold border-l-4 ${
                                      isConflict 
                                        ? 'bg-rose-100 border-rose-300 border-l-rose-600 text-rose-900 shadow-sm' 
                                        : `${teacherColor.bg} ${teacherColor.border} ${teacherColor.borderLeft} ${teacherColor.text} shadow-xs`
                                    }`}>
                                      {mySlots.map((ms, idx) => (
                                        <div key={idx} className="space-y-0.5">
                                          <div className="font-bold text-slate-900 flex items-center justify-center space-x-1">
                                            <span>Kelas {ms.className}</span>
                                          </div>
                                          <div className="text-[11px] text-slate-700 font-medium">{ms.subject}</div>
                                          <div className="text-[10px] text-slate-500 font-mono">{dayJP.startTime}-{dayJP.endTime}</div>
                                        </div>
                                      ))}
                                      {isConflict && (
                                        <div className="mt-1 text-[10px] text-rose-700 font-bold">
                                          ⚠️ BENTROK ({mySlots.length} KELAS)
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PENGATURAN SESI JAM PELAJARAN (JP) TIAP HARI - ADMIN ONLY */}
      {activeTab === 'period_settings' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <span>Struktur Sesi Jam Pelajaran (JP) Sekolah Tiap Hari</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur waktu mulai & selesai JP secara fleksibel per hari (misal Jumat durasi lebih ringkas @ 35m atau Senin ditambah Upacara).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const currentPeriods = selectedPeriodDayTab === 'SEMUA' ? standardPeriods : getPeriodsForDay(selectedPeriodDayTab);
                    const kbmList = currentPeriods.filter(p => p.type === 'KBM');
                    const nextJP = kbmList.length + 1;
                    setEditingPeriod({
                      id: `p-${selectedPeriodDayTab.toLowerCase()}-${Date.now()}`,
                      periodNumber: nextJP,
                      startTime: '07:00',
                      endTime: '07:45',
                      type: 'KBM',
                      label: `JP ${nextJP}`,
                      day: selectedPeriodDayTab === 'SEMUA' ? undefined : selectedPeriodDayTab,
                      daySpecific: selectedPeriodDayTab === 'SEMUA' ? undefined : selectedPeriodDayTab
                    });
                    setPeriodModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Sesi JP</span>
                </button>

                <button
                  onClick={() => {
                    setCopySourceDay(selectedPeriodDayTab);
                    setCopyTargetDays(activeDays.filter(d => d !== selectedPeriodDayTab));
                    setCopyDayPeriodModalOpen(true);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin ke Hari Lain...</span>
                </button>

                <button
                  onClick={handleResetDefaultPeriods}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              </div>
            </div>

            {/* DAY SELECTOR TABS */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedPeriodDayTab('SEMUA')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                  selectedPeriodDayTab === 'SEMUA'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>Semua Hari (Standar)</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  selectedPeriodDayTab === 'SEMUA' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'
                }`}>
                  {standardPeriods.filter(p => p.type === 'KBM').length} JP
                </span>
              </button>

              {activeDays.map(day => {
                const dayMeta = daysCustomMap.get(day);
                const isSelected = selectedPeriodDayTab === day;
                const hasCustom = dayMeta?.hasCustom;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedPeriodDayTab(day)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md'
                        : hasCustom
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{day}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      isSelected
                        ? 'bg-indigo-800 text-indigo-100'
                        : hasCustom
                        ? 'bg-emerald-200 text-emerald-900 font-bold'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {hasCustom ? `Khusus (${dayMeta?.kbmCount} JP)` : `Standar (${dayMeta?.kbmCount} JP)`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Current Day Status Banner & Actions */}
            {selectedPeriodDayTab !== 'SEMUA' && (
              <div className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                daysCustomMap.get(selectedPeriodDayTab)?.hasCustom 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center space-x-2">
                  {daysCustomMap.get(selectedPeriodDayTab)?.hasCustom ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <Info className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                  <div>
                    <strong>Hari {selectedPeriodDayTab}:</strong>{' '}
                    {daysCustomMap.get(selectedPeriodDayTab)?.hasCustom ? (
                      <span>Memiliki pengaturan waktu JP khusus ({periodsInCurrentTab.length} sesi, {periodsInCurrentTab.filter(p => p.type === 'KBM').length} JP KBM).</span>
                    ) : (
                      <span>Saat ini menggunakan pengaturan jam standar sekolah ({standardPeriods.filter(p => p.type === 'KBM').length} JP KBM).</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {daysCustomMap.get(selectedPeriodDayTab)?.hasCustom ? (
                    <button
                      onClick={() => handleRevertDayToStandard(selectedPeriodDayTab)}
                      className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 font-semibold rounded-lg border border-rose-200 transition-colors cursor-pointer"
                    >
                      Hapus Jam Khusus & Gunakan Standar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivateCustomDayTiming(selectedPeriodDayTab)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      ⚡ Aktifkan Jam Khusus Hari {selectedPeriodDayTab}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Presets Bar */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2 text-slate-700 font-semibold">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>
                  Template Cepat ({selectedPeriodDayTab === 'SEMUA' ? 'Standar Semua Hari' : `Hari ${selectedPeriodDayTab}`}):
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedPeriodDayTab === 'Jumat' ? (
                  <button
                    onClick={() => handleApplyPreset('JUMAT_5JP')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Preset Khusus Jumat (5 JP @ 35m + Pulang 11.20)</span>
                  </button>
                ) : selectedPeriodDayTab === 'Senin' ? (
                  <button
                    onClick={() => handleApplyPreset('SENIN_UPACARA')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Preset Khusus Senin (Upacara 07.00 + 8 JP)</span>
                  </button>
                ) : selectedPeriodDayTab === 'Sabtu' ? (
                  <button
                    onClick={() => handleApplyPreset('SABTU_6JP')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Preset Khusus Sabtu (6 JP @ 35m + Senam)</span>
                  </button>
                ) : null}

                <button
                  onClick={() => handleApplyPreset('SMP_8JP')}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 font-medium rounded-lg border border-slate-300 shadow-xs transition-colors cursor-pointer"
                >
                  Standar SMP/SMA (8 JP @ 40m)
                </button>
                <button
                  onClick={() => handleApplyPreset('SD_6JP')}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 font-medium rounded-lg border border-slate-300 shadow-xs transition-colors cursor-pointer"
                >
                  Standar SD (6 JP @ 35m)
                </button>
                <button
                  onClick={() => handleApplyPreset('FULLDAY_9JP')}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 font-medium rounded-lg border border-slate-300 shadow-xs transition-colors cursor-pointer"
                >
                  Full Day (9 JP @ 45m)
                </button>
              </div>
            </div>

            {/* List of Periods for current selected Day Tab */}
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {periodsInCurrentTab.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700 text-sm">
                    Hari {selectedPeriodDayTab} belum memiliki pengaturan jam khusus.
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Secara default, hari ini mengikuti struktur jam standar. Klik tombol di bawah untuk menyesuaikan jam khusus hari {selectedPeriodDayTab}.
                  </p>
                  <button
                    onClick={() => handleActivateCustomDayTiming(selectedPeriodDayTab)}
                    className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                  >
                    ⚡ Aktifkan Jam Khusus Hari {selectedPeriodDayTab}
                  </button>
                </div>
              ) : (
                periodsInCurrentTab.map((p, idx) => (
                  <div key={p.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="w-6 text-slate-400 font-mono">{idx + 1}.</span>
                      <span className={`px-2.5 py-1 rounded-lg font-bold ${
                        p.type === 'KBM' 
                          ? 'bg-indigo-100 text-indigo-800' 
                          : p.type === 'ISTIRAHAT'
                          ? 'bg-amber-100 text-amber-800'
                          : p.type === 'IBADAH'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {p.type === 'KBM' ? `JP ${p.periodNumber}` : p.label || p.type}
                      </span>
                      <span className="font-mono text-slate-800 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        {p.startTime} - {p.endTime}
                      </span>
                      {p.notes && (
                        <span className="text-slate-400 italic text-[11px]">
                          ({p.notes})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingPeriod({ ...p });
                          setPeriodModalOpen(true);
                        }}
                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Sesi Jam"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePeriod(p.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Sesi Jam"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / ASSIGN SLOT (MAPEL & GURU) */}
      {slotModalOpen && editingSlot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">
                  Atur Jadwal: {selectedClass.name} - Hari {editingSlot.day} (JP {editingSlot.periodNumber})
                </h3>
              </div>
              <button 
                onClick={() => { setSlotModalOpen(false); setEditingSlot(null); }}
                className="text-indigo-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="p-5 space-y-4 text-xs">
              {/* Conflict check warning */}
              {checkSlotConflict(editingSlot.day, editingSlot.periodNumber, editingSlot.teacherId, editingSlot.id) && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-rose-900 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Peringatan Bentrok Jadwal Guru:</span>
                    <p className="text-[11px] text-rose-700">
                      Guru yang Anda pilih sudah terdaftar mengajar pada <strong>Hari {editingSlot.day} JP {editingSlot.periodNumber}</strong> di <strong>Kelas {checkSlotConflict(editingSlot.day, editingSlot.periodNumber, editingSlot.teacherId, editingSlot.id)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Subject Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                <select
                  value={editingSlot.subject}
                  onChange={(e) => setEditingSlot(prev => prev ? ({ ...prev, subject: e.target.value }) : null)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  {availableSubjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Teacher Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Guru Pengajar</label>
                <select
                  value={editingSlot.teacherId}
                  onChange={(e) => setEditingSlot(prev => prev ? ({ ...prev, teacherId: e.target.value }) : null)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Guru Pengajar --</option>
                  {sortedTeachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.nip ? `(NIP: ${t.nip})` : ''} - {t.subject1} {loggedInTeacher?.id === t.id ? '⭐ (Akun Anda)' : ''}
                    </option>
                  ))}
                </select>

                {editingSlot.teacherId && (() => {
                  const tColor = getTeacherColor(editingSlot.teacherId, teachers);
                  const tObj = teachers.find(t => t.id === editingSlot.teacherId);
                  return (
                    <div className={`mt-2 p-2 rounded-xl border flex items-center justify-between text-xs ${tColor.bg} ${tColor.border} ${tColor.text} border-l-4 ${tColor.borderLeft}`}>
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${tColor.dotBg} shrink-0 ring-2 ring-white shadow-xs`} />
                        <span className="font-bold">Warna Kotak: {tColor.colorName}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${tColor.badgeBg} ${tColor.badgeText} border ${tColor.border}`}>
                        {tObj?.name || 'Guru Terpilih'}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Room & Multi-JP Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ruangan / Lab</label>
                  <input
                    type="text"
                    value={editingSlot.room}
                    onChange={(e) => setEditingSlot(prev => prev ? ({ ...prev, room: e.target.value }) : null)}
                    placeholder="Contoh: Lab Komputer / Ruang 7A"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Durasi JP Sekaligus</label>
                  <select
                    value={editingSlot.durationJP}
                    onChange={(e) => setEditingSlot(prev => prev ? ({ ...prev, durationJP: Number(e.target.value) }) : null)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value={1}>1 JP (Hanya sesi ini)</option>
                    <option value={2}>2 JP Berturut-turut</option>
                    <option value={3}>3 JP Berturut-turut</option>
                    <option value={4}>4 JP Berturut-turut</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  value={editingSlot.notes}
                  onChange={(e) => setEditingSlot(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                  placeholder="Contoh: Membawa buku gambar / pakaian olahraga"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                {editingSlot.id ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(editingSlot.id!)}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Kosongkan Sesi Ini</span>
                  </button>
                ) : <div />}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => { setSlotModalOpen(false); setEditingSlot(null); }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    Simpan Jadwal
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SALIN JADWAL KE KELAS LAIN */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Copy className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">Salin Jadwal Kelas</h3>
              </div>
              <button 
                onClick={() => setCopyModalOpen(false)}
                className="text-indigo-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-indigo-900">
                Menyalin seluruh susunan mata pelajaran dari <strong>Kelas {selectedClass.name}</strong> ke kelas tujuan.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Kelas Tujuan</label>
                <select
                  value={copyTargetClassId}
                  onChange={(e) => setCopyTargetClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {classes.filter(c => c.id !== selectedClass.id).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.gradeLevel ? `Tingkat ${c.gradeLevel}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="copyOverwrite"
                  checked={copyOverwrite}
                  onChange={(e) => setCopyOverwrite(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="copyOverwrite" className="text-slate-700 font-medium cursor-pointer">
                  Timpa jadwal yang sudah ada di kelas tujuan
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCopyModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCopy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Copy className="w-4 h-4" />
                  <span>Salin Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SALIN STRUKTUR SESI HARI KE HARI LAIN */}
      {copyDayPeriodModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">Salin Struktur Sesi Jam Pelajaran</h3>
              </div>
              <button 
                onClick={() => setCopyDayPeriodModalOpen(false)}
                className="text-indigo-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-indigo-900">
                Salin daftar waktu dan sesi jam dari <strong>{copySourceDay === 'SEMUA' ? 'Jam Standar' : `Hari ${copySourceDay}`}</strong> ke satu atau beberapa hari lainnya.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Hari Sumber</label>
                <select
                  value={copySourceDay}
                  onChange={(e) => {
                    setCopySourceDay(e.target.value);
                    setCopyTargetDays(activeDays.filter(d => d !== e.target.value));
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="SEMUA">Semua Hari (Standar)</option>
                  {activeDays.map(d => (
                    <option key={d} value={d}>Hari {d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-2">Pilih Hari Tujuan (Bisa Lebih Dari Satu)</label>
                <div className="grid grid-cols-2 gap-2">
                  {activeDays.filter(d => d !== copySourceDay).map(day => {
                    const isChecked = copyTargetDays.includes(day);
                    return (
                      <label 
                        key={day} 
                        className={`flex items-center space-x-2 p-2 rounded-xl border cursor-pointer transition-all ${
                          isChecked ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCopyTargetDays([...copyTargetDays, day]);
                            } else {
                              setCopyTargetDays(copyTargetDays.filter(d => d !== day));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Hari {day}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCopyDayPeriodModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCopyDayStructure}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Copy className="w-4 h-4" />
                  <span>Terapkan ke {copyTargetDays.length} Hari</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / TAMBAH SESI JAM (JP) */}
      {periodModalOpen && editingPeriod && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">
                  {editingPeriod.id.includes('Date.now') ? 'Tambah Sesi Jam Baru' : 'Edit Sesi Jam Pelajaran'}
                </h3>
              </div>
              <button 
                onClick={() => { setPeriodModalOpen(false); setEditingPeriod(null); }}
                className="text-indigo-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePeriod} className="p-5 space-y-4 text-xs">
              {/* Day Scope Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Berlaku Untuk</label>
                <select
                  value={editingPeriod.day || 'SEMUA'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingPeriod(prev => prev ? ({
                      ...prev,
                      day: val === 'SEMUA' ? undefined : val,
                      daySpecific: val === 'SEMUA' ? undefined : val
                    }) : null);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="SEMUA">Semua Hari (Standar)</option>
                  {activeDays.map(d => (
                    <option key={d} value={d}>Khusus Hari {d}</option>
                  ))}
                </select>
              </div>

              {/* Type Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipe Sesi Kegiatan</label>
                <select
                  value={editingPeriod.type}
                  onChange={(e) => {
                    const type = e.target.value as LessonPeriodType;
                    setEditingPeriod(prev => prev ? ({
                      ...prev,
                      type,
                      label: type === 'KBM' ? `JP ${prev.periodNumber}` : (prev.label || type)
                    }) : null);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="KBM">KBM (Jam Pelajaran Belajar)</option>
                  <option value="ISTIRAHAT">Istirahat Pagi / Snack</option>
                  <option value="IBADAH">Ibadah / Sholat Dzuhur & Jumat</option>
                  <option value="UPACARA">Upacara Bendera / Apel</option>
                  <option value="LITERASI">Literasi / Dhuha / Senam Pagi</option>
                  <option value="LAINNYA">Kegiatan Khusus / Ekstrakurikuler</option>
                </select>
              </div>

              {editingPeriod.type === 'KBM' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Urut JP</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={editingPeriod.periodNumber}
                    onChange={(e) => setEditingPeriod(prev => prev ? ({ ...prev, periodNumber: Number(e.target.value), label: `JP ${e.target.value}` }) : null)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              {editingPeriod.type !== 'KBM' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Label Keterangan Sesi</label>
                  <input
                    type="text"
                    value={editingPeriod.label || ''}
                    onChange={(e) => setEditingPeriod(prev => prev ? ({ ...prev, label: e.target.value }) : null)}
                    placeholder="Contoh: Istirahat 1 / Sholat Dzuhur / Upacara"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={editingPeriod.startTime}
                    onChange={(e) => setEditingPeriod(prev => prev ? ({ ...prev, startTime: e.target.value }) : null)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={editingPeriod.endTime}
                    onChange={(e) => setEditingPeriod(prev => prev ? ({ ...prev, endTime: e.target.value }) : null)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  value={editingPeriod.notes || ''}
                  onChange={(e) => setEditingPeriod(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                  placeholder="Contoh: Khusus sebelum Sholat Jumat"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => { setPeriodModalOpen(false); setEditingPeriod(null); }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Simpan Sesi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
