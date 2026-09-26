import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  UserRole, 
  SchoolProfile, 
  Student, 
  SchoolClass, 
  AttendanceRecord, 
  LeaveRequest, 
  ChatMessage,
  Teacher,
  LearningJournal,
  CharacterTrait,
  StudentCharacterLog,
  CharacterPredicateSettings,
  UserSession,
  LessonPeriod,
  ClassScheduleSlot
} from './types';
import { 
  getSchoolProfile, 
  saveSchoolProfile,
  getStudents, 
  saveStudents,
  getSchoolClasses, 
  saveSchoolClasses,
  getAttendanceRecords, 
  saveAttendanceRecords,
  saveAttendanceRecordsLocally,
  queueAttendanceScanRecord,
  getLeaveRequests, 
  saveLeaveRequests,
  getTeachers,
  saveTeachers,
  getLearningJournals,
  saveLearningJournals,
  getCharacterTraits,
  saveCharacterTraits,
  getStudentCharacterLogs,
  saveStudentCharacterLogs,
  getCharacterPredicateSettings,
  saveCharacterPredicateSettings,
  getLessonPeriods,
  saveLessonPeriods,
  getClassSchedules,
  saveClassSchedules,
  getUserSession,
  saveUserSession,
  initFirestoreRealtimeSync,
  stopFirestoreRealtimeSync,
  reconcileTeachersAndClasses,
  checkParentLoginAccess,
  KEYS
} from './lib/storage';
import { ShieldCheck, CheckCircle2, WifiOff, RefreshCw, Wifi } from 'lucide-react';

import { Sidebar } from './components/Sidebar';
import { QRScannerView } from './components/QRScannerView';
import { AttendanceDashboard } from './components/AttendanceDashboard';
import { AnalyticsView } from './components/AnalyticsView';
import { StudentDirectoryView } from './components/StudentDirectoryView';
import { ClassManagementView } from './components/ClassManagementView';
import { LeaveRequestView } from './components/LeaveRequestView';
import { BulkReturnUpdatePayload } from './components/BulkReturnManagementModal';
import { SchoolSettingsView } from './components/SchoolSettingsView';
import { RecapExportView } from './components/RecapExportView';
import { TeacherDirectoryView } from './components/TeacherDirectoryView';
import { LearningJournalView } from './components/LearningJournalView';
import { DisciplineRulesView } from './components/DisciplineRulesView';
import { CharacterInputView } from './components/CharacterInputView';
import { CharacterPointsView } from './components/CharacterPointsView';
import { ScheduleManagementView } from './components/ScheduleManagementView';
import { ParentAccountView } from './components/ParentAccountView';
import { TeacherAccountView } from './components/TeacherAccountView';
import { ParentBottomNav } from './components/ParentBottomNav';
import { TeacherBottomNav } from './components/TeacherBottomNav';
import { LoginView } from './components/LoginView';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { KbmVoiceReminderBanner } from './components/KbmVoiceReminderBanner';
import { 
  KbmReminderInfo, 
  playTeacherKbmVoiceReminder, 
  isKbmVoiceReminderEnabled 
} from './lib/kbmVoiceReminder';
import { run16WitaAutoCharacterAssessment } from './lib/autoCharacterScheduler';

export default function App() {
  const [userSession, setUserSessionState] = useState<UserSession | null>(() => getUserSession());
  const [currentRole, setCurrentRole] = useState<UserRole>(userSession?.role || 'ADMIN');
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (window.history.state && window.history.state.tab) {
      return window.history.state.tab;
    }
    return userSession?.role === 'SCANNER_POS' ? 'scanner' : 'dashboard';
  });

  const activeTabRef = useRef<string>(activeTab);
  activeTabRef.current = activeTab;
  const currentRoleRef = useRef<UserRole>(currentRole);
  currentRoleRef.current = currentRole;

  // Track tab changes in browser history for Hardware Back Button & Browser Back Button support
  const handleTabChange = useCallback((tabId: string, replace: boolean = false) => {
    if (activeTabRef.current === tabId) return;
    setActiveTab(tabId);
    activeTabRef.current = tabId;

    try {
      if (replace) {
        window.history.replaceState({ tab: tabId, role: currentRoleRef.current }, '', `#${tabId}`);
      } else {
        // Only push new history entry if different from current history state
        if (window.history.state?.tab !== tabId) {
          window.history.pushState({ tab: tabId, role: currentRoleRef.current }, '', `#${tabId}`);
        }
      }
    } catch {
      // Ignore iframe history restrictions
    }
  }, []);

  // Hardware/Device & Browser Back Button Handler (popstate)
  useEffect(() => {
    // Initialize initial state if empty
    try {
      if (!window.history.state || !window.history.state.tab) {
        window.history.replaceState(
          { tab: activeTabRef.current, role: currentRoleRef.current },
          '',
          `#${activeTabRef.current}`
        );
      }
    } catch {
      // Ignore
    }

    const handlePopState = (event: PopStateEvent) => {
      // 1. Check if any open modal / full-screen overlay exists and close it first
      const closeButtons = document.querySelectorAll<HTMLButtonElement>(
        '[data-modal-close="true"], .modal-close-btn, [aria-label="Close modal"], [aria-label="Tutup"]'
      );
      if (closeButtons.length > 0) {
        const topCloseBtn = closeButtons[closeButtons.length - 1];
        if (topCloseBtn && typeof topCloseBtn.click === 'function') {
          topCloseBtn.click();
          // Keep history balanced
          try {
            window.history.pushState({ tab: activeTabRef.current, role: currentRoleRef.current }, '', `#${activeTabRef.current}`);
          } catch {
            // Ignore
          }
          return;
        }
      }

      // 2. Navigate back to previous tab
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
        activeTabRef.current = event.state.tab;
        if (event.state.role && event.state.role !== currentRoleRef.current) {
          setCurrentRole(event.state.role);
          currentRoleRef.current = event.state.role;
        }
      } else {
        // Default to home / dashboard instead of letting the browser exit the app
        const defaultTab = currentRoleRef.current === 'SCANNER_POS' ? 'scanner' : 'dashboard';
        if (activeTabRef.current !== defaultTab) {
          setActiveTab(defaultTab);
          activeTabRef.current = defaultTab;
          try {
            window.history.replaceState({ tab: defaultTab, role: currentRoleRef.current }, '', `#${defaultTab}`);
          } catch {
            // Ignore
          }
        } else {
          // If already at default tab, re-push state to prevent accidental app exit on mobile WebView/PWA
          try {
            window.history.pushState({ tab: defaultTab, role: currentRoleRef.current }, '', `#${defaultTab}`);
          } catch {
            // Ignore
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Core Data States
  const [schoolProfile, setSchoolProfileState] = useState<SchoolProfile>(getSchoolProfile());
  const [students, setStudentsState] = useState<Student[]>(getStudents());
  const [classes, setClassesState] = useState<SchoolClass[]>(getSchoolClasses());
  const [attendanceRecords, setAttendanceRecordsState] = useState<AttendanceRecord[]>(getAttendanceRecords());
  const [leaveRequests, setLeaveRequestsState] = useState<LeaveRequest[]>(getLeaveRequests());
  const [teachers, setTeachersState] = useState<Teacher[]>(getTeachers());
  const [journals, setJournalsState] = useState<LearningJournal[]>(getLearningJournals());
  const [traits, setTraitsState] = useState<CharacterTrait[]>(getCharacterTraits());
  const [characterLogs, setCharacterLogsState] = useState<StudentCharacterLog[]>(getStudentCharacterLogs());
  const [predicateSettings, setPredicateSettingsState] = useState<CharacterPredicateSettings>(getCharacterPredicateSettings());
  const [periods, setPeriodsState] = useState<LessonPeriod[]>(getLessonPeriods());
  const [schedules, setSchedulesState] = useState<ClassScheduleSlot[]>(getClassSchedules());

  // Parent Child Identification (Strictly Bound to Logged-in NISN, studentId, or username)
  const parentStudent = useMemo(() => {
    if (currentRole !== 'PARENT') return null;

    // 1. By studentId from session
    if (userSession?.studentId) {
      const found = students.find(s => s.id === userSession.studentId);
      if (found) return found;
    }

    // 2. By nipOrNisn from session (exact match, trimming spaces)
    if (userSession?.nipOrNisn) {
      const cleanNisn = userSession.nipOrNisn.replace(/\s+/g, '').toLowerCase();
      const found = students.find(s => 
        s.nisn.replace(/\s+/g, '').toLowerCase() === cleanNisn ||
        s.nis.toLowerCase() === cleanNisn
      );
      if (found) return found;
    }

    // 3. By username from session
    if (userSession?.username) {
      const cleanUser = userSession.username.replace(/\s+/g, '').toLowerCase();
      const found = students.find(s => 
        s.nisn.replace(/\s+/g, '').toLowerCase() === cleanUser ||
        s.nis.toLowerCase() === cleanUser
      );
      if (found) return found;
    }

    // Fallback if role switched in demo
    return students[0] || null;
  }, [currentRole, userSession, students]);

  // Teacher Identification (Strictly Bound to Logged-in teacherId, NIP, phone, username, or displayName)
  const currentTeacher = useMemo(() => {
    if (currentRole !== 'TEACHER') return null;

    // 1. By teacherId from session
    if (userSession?.teacherId) {
      const found = teachers.find(t => t.id === userSession.teacherId);
      if (found) return found;
    }

    // 2. By nipOrNisn from session (exact match, trimming spaces)
    if (userSession?.nipOrNisn) {
      const cleanNip = userSession.nipOrNisn.replace(/[\.,\s\-_]/g, '').toLowerCase();
      const found = teachers.find(t => t.nip.replace(/[\.,\s\-_]/g, '').toLowerCase() === cleanNip);
      if (found) return found;
    }

    // 3. By username from session (phone or nip)
    if (userSession?.username) {
      const cleanUser = userSession.username.replace(/[\.,\s\-_]/g, '').toLowerCase();
      const found = teachers.find(t => 
        t.nip.replace(/[\.,\s\-_]/g, '').toLowerCase() === cleanUser ||
        (t.phone && t.phone.replace(/[\.,\s\-_]/g, '').toLowerCase() === cleanUser)
      );
      if (found) return found;
    }

    // 4. By displayName from session
    if (userSession?.displayName) {
      const cleanDisplay = userSession.displayName.replace(/[\.,\s\-_]/g, '').toLowerCase();
      const found = teachers.find(t => t.name.replace(/[\.,\s\-_]/g, '').toLowerCase() === cleanDisplay);
      if (found) return found;

      // Also try normalized academic titles
      const normDisplay = userSession.displayName.toLowerCase().replace(/\b(dr|dra|drs|h|hj|prof|ir|s\.pd|m\.pd|s\.kom|m\.kom|s\.ag|m\.ag|s\.si|m\.si|s\.e|m\.m|s\.sos|m\.sos|s\.t|m\.t|b\.sc|m\.sc|gr|lc)\b/gi, '').replace(/[\.,\s\-_]/g, '');
      if (normDisplay) {
        const foundNorm = teachers.find(t => {
          const normT = t.name.toLowerCase().replace(/\b(dr|dra|drs|h|hj|prof|ir|s\.pd|m\.pd|s\.kom|m\.kom|s\.ag|m\.ag|s\.si|m\.si|s\.e|m\.m|s\.sos|m\.sos|s\.t|m\.t|b\.sc|m\.sc|gr|lc)\b/gi, '').replace(/[\.,\s\-_]/g, '');
          return normT && (normT === normDisplay || normT.includes(normDisplay) || normDisplay.includes(normT));
        });
        if (foundNorm) return foundNorm;
      }
    }

    // Fallback only if no userSession exists (demo/preview unauthenticated mode)
    if (!userSession || !userSession.isLoggedIn) {
      return teachers[0] || null;
    }

    return null;
  }, [currentRole, userSession, teachers]);

  // Selected Child ID state (for Parent role, automatically locked to parentStudent)
  const [selectedChildId, setSelectedChildId] = useState<string>(() => {
    if (userSession?.role === 'PARENT') {
      if (userSession.studentId) return userSession.studentId;
      if (userSession.nipOrNisn) {
        const cleanNisn = userSession.nipOrNisn.replace(/\s+/g, '').toLowerCase();
        const found = students.find(s => s.nisn.replace(/\s+/g, '').toLowerCase() === cleanNisn || s.nis.toLowerCase() === cleanNisn);
        if (found) return found.id;
      }
    }
    return students[0]?.id || '';
  });

  // Keep selectedChildId locked strictly to parentStudent whenever in PARENT role
  useEffect(() => {
    if (currentRole === 'PARENT' && parentStudent && selectedChildId !== parentStudent.id) {
      setSelectedChildId(parentStudent.id);
    }
  }, [currentRole, parentStudent, selectedChildId]);

  // Effective child ID passed down to views
  const effectiveChildId = (currentRole === 'PARENT' && parentStudent) ? parentStudent.id : (selectedChildId || students[0]?.id || '');

  // Active KBM Voice Reminder Popup
  const [activeVoiceReminder, setActiveVoiceReminder] = useState<KbmReminderInfo | null>(null);
  const triggeredVoiceReminderKeysRef = useRef<Set<string>>(new Set());

  // Automatic Network / Auto-Sync Toast notification state
  const [networkToast, setNetworkToast] = useState<{
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
  } | null>(null);

  // Debounced sync state on local storage events to prevent UI freeze and DOM thrashing
  const refreshTimerRef = useRef<any>(null);
  const refreshDataFromStorage = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      const rawProfile = getSchoolProfile();
      const rawStudents = getStudents();
      const rawClasses = getSchoolClasses();
      const rawTeachers = getTeachers();

      const { updatedTeachers, updatedClasses } = reconcileTeachersAndClasses(rawTeachers, rawClasses);

      setSchoolProfileState(rawProfile);
      setStudentsState(rawStudents);
      setClassesState(updatedClasses);
      setTeachersState(updatedTeachers);
      setAttendanceRecordsState(getAttendanceRecords());
      setLeaveRequestsState(getLeaveRequests());
      setJournalsState(getLearningJournals());
      setTraitsState(getCharacterTraits());
      setCharacterLogsState(getStudentCharacterLogs());
      setPredicateSettingsState(getCharacterPredicateSettings());
      setPeriodsState(getLessonPeriods());
      setSchedulesState(getClassSchedules());
      setUserSessionState(getUserSession());
    }, 150);
  }, []);


  useEffect(() => {
    // Jalankan sinkronisasi real-time berbasis role
    initFirestoreRealtimeSync(currentRole);

    // Initial reconciliation on boot to make sure in-memory state is consistent without overwriting Cloud Firestore
    const initialRawClasses = getSchoolClasses();
    const initialRawTeachers = getTeachers();
    const { updatedTeachers, updatedClasses, teachersChanged, classesChanged } = reconcileTeachersAndClasses(initialRawTeachers, initialRawClasses);
    if (teachersChanged) {
      localStorage.setItem(KEYS.TEACHERS, JSON.stringify(updatedTeachers));
      setTeachersState(updatedTeachers);
    }
    if (classesChanged) {
      localStorage.setItem(KEYS.CLASSES, JSON.stringify(updatedClasses));
      setClassesState(updatedClasses);
    }

    // PENGHEMAT KUOTA UTAMA:
    // Saat HP Orang Tua atau Guru mengunci layar, beralih ke aplikasi lain (WA), atau tab diminimalkan (document.hidden),
    // HENTIKAN sementara seluruh listener Firestore onSnapshot (stopFirestoreRealtimeSync).
    // Saat tab dibuka kembali (visible), sambungkan ulang. Ini memangkas ribuan read pasif di latar belakang!
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopFirestoreRealtimeSync();
      } else {
        initFirestoreRealtimeSync(currentRole);
      }
    };

    const handleNetworkToast = (e: any) => {
      if (e?.detail) {
        setNetworkToast(e.detail);
        setTimeout(() => {
          setNetworkToast((prev) => (prev === e.detail ? null : prev));
        }, 4500);
      }
    };

    window.addEventListener('sihadir_storage_updated', refreshDataFromStorage);
    window.addEventListener('sihadir_network_toast', handleNetworkToast);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('sihadir_storage_updated', refreshDataFromStorage);
      window.removeEventListener('sihadir_network_toast', handleNetworkToast);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopFirestoreRealtimeSync();
    };
  }, [currentRole]);

  // Penilaian Karakter Otomatis 16:00 WITA (Belum Scan & Belum Pulang)
  useEffect(() => {
    // PENGHEMAT KUOTA: Khusus Admin & Scanner Pos, jangan pernah dijalankan oleh akun Wali Murid (PARENT)!
    if (currentRole === 'PARENT') return;

    // Jalankan pemeriksaan saat aplikasi dimuat
    run16WitaAutoCharacterAssessment();

    // Periksa secara berkala setiap 20 detik
    const interval = setInterval(() => {
      run16WitaAutoCharacterAssessment();
    }, 20000);

    const handleAutoAssessmentEvent = (e: any) => {
      if (e.detail?.newLogsCount > 0) {
        setNetworkToast({
          type: 'info',
          title: '⭐ Penilaian Karakter Otomatis (16:00 WITA)',
          message: `Sistem otomatis mencatat ${e.detail.newLogsCount} penilaian karakter negatif baru (${e.detail.unscannedCount} Belum Scan, ${e.detail.unreturnedCount} Belum Pulang) dan disinkronkan ke Cloud dalam 1 pengiriman.`
        });
        setTimeout(() => setNetworkToast(null), 6000);
      }
    };

    window.addEventListener('sihadir_auto_assessment_completed', handleAutoAssessmentEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sihadir_auto_assessment_completed', handleAutoAssessmentEvent);
    };
  }, [currentRole]);

  // Track latest state references to avoid cascading re-render loops in periodic background intervals
  const attendanceRecordsRef = useRef(attendanceRecords);
  attendanceRecordsRef.current = attendanceRecords;

  const studentsRef = useRef(students);
  studentsRef.current = students;

  const leaveRequestsRef = useRef(leaveRequests);
  leaveRequestsRef.current = leaveRequests;

  // Membersihkan record korup atau auto-alpa peninggalan versi lama saat aplikasi dimuat
  useEffect(() => {
    if (currentRole === 'PARENT') return;
    setAttendanceRecordsState(prev => {
      const hasCorrupt = prev.some(r => (
        !r ||
        !r.studentId ||
        !r.date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
        r.id?.startsWith('att-autoalpa-') ||
        r.scannedBy?.includes('Sistem Otomatis (Batas Alpa)') ||
        r.notes?.includes('Otomatis Alpa')
      ));
      if (!hasCorrupt) return prev;
      const cleaned = prev.filter(r => (
        r &&
        r.studentId &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
        !r.id?.startsWith('att-autoalpa-') &&
        !r.scannedBy?.includes('Sistem Otomatis (Batas Alpa)') &&
        !r.notes?.includes('Otomatis Alpa')
      ));
      saveAttendanceRecords(cleaned, true);
      return cleaned;
    });
  }, []);

  // -------------------------------------------------------------
  // Real-Time AI Voice Reminder for Teachers with Active KBM Slots
  // STRICT RULE: Suara notifikasi jadwal HANYA muncul pada akun yang sesuai dengan akun nama login pada jadwal pelajaran
  // -------------------------------------------------------------
  useEffect(() => {
    const checkAndTriggerKbmVoiceReminder = () => {
      // If voice reminder is globally disabled in schoolProfile, do nothing
      if (schoolProfile.aiVoiceTeacherReminderEnabled === false) return;
      if (!isKbmVoiceReminderEnabled()) return;

      // 1. Must be strictly logged in as TEACHER role
      if (currentRole !== 'TEACHER') return;
      if (!userSession || !userSession.isLoggedIn) return;

      // 2. Identify the logged-in teacher credentials
      const loggedTeacherId = currentTeacher?.id || userSession.teacherId || '';
      const loggedTeacherNip = currentTeacher?.nip || userSession.nipOrNisn || '';
      const loggedTeacherName = currentTeacher?.name || userSession.displayName || '';
      const loggedUsername = userSession.username || '';

      if (!loggedTeacherId && !loggedTeacherNip && !loggedTeacherName) return;

      const cleanStr = (s?: string) => (s || '').replace(/[\.,\s\-_]/g, '').toLowerCase();
      const normalizeAcademicName = (name?: string) => {
        if (!name) return '';
        return name
          .toLowerCase()
          .replace(/\b(dr|dra|drs|h|hj|prof|ir|s\.pd|m\.pd|s\.kom|m\.kom|s\.ag|m\.ag|s\.si|m\.si|s\.e|m\.m|s\.sos|m\.sos|s\.t|m\.t|b\.sc|m\.sc|gr|lc)\b/gi, '')
          .replace(/[\.,\s\-_]/g, '');
      };

      const now = new Date();
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const currentDayName = dayNames[now.getDay()];

      // 3. Check active school day
      const activeDays = schoolProfile.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      if (!activeDays.includes(currentDayName)) return;

      // 4. Check holiday
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const holidays = schoolProfile.holidays || [];
      const isTodayHoliday = holidays.some(h => {
        if (h.endDate) {
          return dateStr >= h.date && dateStr <= h.endDate;
        }
        return h.date === dateStr;
      });
      if (isTodayHoliday) return;

      // 5. Periods for today
      const daySpecificPeriods = periods.filter(p => p.day === currentDayName || p.daySpecific === currentDayName);
      const todayPeriods = (daySpecificPeriods.length > 0 
        ? daySpecificPeriods 
        : periods.filter(p => !p.day || p.day === 'SEMUA')
      ).filter(p => p.type === 'KBM');

      if (todayPeriods.length === 0) return;

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const todaySchedules = schedules.filter(s => s.day === currentDayName);
      if (todaySchedules.length === 0) return;

      todayPeriods.forEach(period => {
        if (!period.startTime) return;
        const [pH, pM] = period.startTime.split(':').map(Number);
        if (isNaN(pH) || isNaN(pM)) return;

        const periodStartMinutes = pH * 60 + pM;

        // Trigger window: right at start time (within first 2 minutes of the period)
        if (currentMinutes >= periodStartMinutes && currentMinutes <= periodStartMinutes + 2) {
          const matchingSlots = todaySchedules.filter(s => s.periodNumber === period.periodNumber);

          matchingSlots.forEach(slot => {
            if (!slot.teacherId && !slot.teacherName) return;

            // STRICT FILTER: Match slot only to currently logged in teacher
            let isMySlot = false;

            // Match A: ID
            if (loggedTeacherId && slot.teacherId && slot.teacherId === loggedTeacherId) {
              isMySlot = true;
            }

            // Match B: NIP
            if (!isMySlot && loggedTeacherNip && slot.teacherNip && cleanStr(slot.teacherNip) === cleanStr(loggedTeacherNip)) {
              isMySlot = true;
            }

            // Match C: Exact or cleaned Name / Academic title match
            if (!isMySlot && slot.teacherName && loggedTeacherName) {
              const cleanSlotName = cleanStr(slot.teacherName);
              const cleanLoggedName = cleanStr(loggedTeacherName);
              if (cleanSlotName === cleanLoggedName) {
                isMySlot = true;
              } else {
                const normSlot = normalizeAcademicName(slot.teacherName);
                const normLogged = normalizeAcademicName(loggedTeacherName);
                if (normSlot && normLogged && (normSlot === normLogged || normSlot.includes(normLogged) || normLogged.includes(normSlot))) {
                  isMySlot = true;
                }
              }
            }

            // Match D: Master teacher record link
            if (!isMySlot && slot.teacherId) {
              const masterTeacher = teachers.find(t => t.id === slot.teacherId);
              if (masterTeacher) {
                if (loggedTeacherId && masterTeacher.id === loggedTeacherId) isMySlot = true;
                if (loggedTeacherNip && cleanStr(masterTeacher.nip) === cleanStr(loggedTeacherNip)) isMySlot = true;
                if (loggedTeacherName && (
                  cleanStr(masterTeacher.name) === cleanStr(loggedTeacherName) ||
                  normalizeAcademicName(masterTeacher.name) === normalizeAcademicName(loggedTeacherName)
                )) {
                  isMySlot = true;
                }
                if (loggedUsername && (
                  cleanStr(masterTeacher.nip) === cleanStr(loggedUsername) ||
                  cleanStr(masterTeacher.phone) === cleanStr(loggedUsername)
                )) {
                  isMySlot = true;
                }
              }
            }

            // If this schedule slot does not belong to the logged-in teacher account, SKIP!
            if (!isMySlot) return;

            const voiceKey = `voice-kbm-${dateStr}-${slot.id || `${slot.classId}-${slot.periodNumber}-${slot.teacherId}`}-${period.startTime}`;
            if (triggeredVoiceReminderKeysRef.current.has(voiceKey)) return;

            triggeredVoiceReminderKeysRef.current.add(voiceKey);

            // Calculate consecutive JP count for this teaching session block
            let consecutiveJp = 1;
            let nextPeriodNum = slot.periodNumber + 1;
            while (todaySchedules.some(s => 
              s.periodNumber === nextPeriodNum && 
              s.classId === slot.classId && 
              ((slot.teacherId && s.teacherId === slot.teacherId) || (slot.teacherName && s.teacherName === slot.teacherName)) && 
              s.subject === slot.subject
            )) {
              consecutiveJp++;
              nextPeriodNum++;
            }

            // Determine final end time of the block
            const lastPeriodInBlock = todayPeriods.find(p => p.periodNumber === slot.periodNumber + consecutiveJp - 1);
            const finalEndTime = lastPeriodInBlock?.endTime || period.endTime;

            const reminderInfo: KbmReminderInfo = {
              teacherName: slot.teacherName || loggedTeacherName || 'Bapak/Ibu Guru',
              subject: slot.subject,
              className: slot.className,
              room: slot.room,
              periodNumber: slot.periodNumber,
              jpCount: consecutiveJp,
              startTime: period.startTime,
              endTime: finalEndTime,
              slotId: slot.id
            };

            // Play Chime + Female AI Speech: Menyebutkan nama guru, kelas, mata pelajaran, dan jumlah JP
            playTeacherKbmVoiceReminder(reminderInfo);

            // Pop up interactive banner
            setActiveVoiceReminder(reminderInfo);
          });
        }
      });
    };

    checkAndTriggerKbmVoiceReminder();
    const interval = setInterval(checkAndTriggerKbmVoiceReminder, 12000);
    return () => clearInterval(interval);
  }, [
    currentRole,
    userSession,
    currentTeacher,
    teachers,
    schoolProfile.activeDays,
    schoolProfile.holidays,
    schoolProfile.aiVoiceTeacherReminderEnabled,
    periods,
    schedules
  ]);

  // Update session role changes
  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    if (userSession) {
      const updatedSession: UserSession = {
        ...userSession,
        role
      };
      setUserSessionState(updatedSession);
      saveUserSession(updatedSession);
    }
    const targetTab = role === 'SCANNER_POS' ? 'scanner' : 'dashboard';
    handleTabChange(targetTab);
  };

  const handleLoginSuccess = (session: UserSession) => {
    setUserSessionState(session);
    saveUserSession(session);
    setCurrentRole(session.role);
    if (session.role === 'PARENT' && session.studentId) {
      setSelectedChildId(session.studentId);
    }
    const targetTab = session.role === 'SCANNER_POS' ? 'scanner' : 'dashboard';
    handleTabChange(targetTab, true);
  };

  const handleLogout = () => {
    setUserSessionState(null);
    saveUserSession(null);
  };

  // Pemeriksaan Hak Akses & Jadwal Login Orang Tua (Otomatis Log Off jika dinonaktifkan Admin atau di luar jadwal)
  useEffect(() => {
    if (userSession?.role !== 'PARENT') return;

    const performParentAccessValidation = () => {
      const accessCheck = checkParentLoginAccess(schoolProfile);
      const forceLogoutTime = Number(schoolProfile.parentPortalForceLogoutTimestamp) || 0;
      const userLoginTime = Number(userSession.loginTimestamp) || 0;
      const isForceLoggedOut = forceLogoutTime > 0 && (!userLoginTime || userLoginTime <= forceLogoutTime);

      if (!accessCheck.allowed || isForceLoggedOut) {
        handleLogout();
        setNetworkToast({
          type: 'warning',
          title: '🔒 Sesi Akses Ditutup',
          message: !accessCheck.allowed 
            ? accessCheck.reason 
            : 'Akses seluruh akun orang tua telah di-log off oleh Administrator Sekolah.'
        });
        setTimeout(() => setNetworkToast(null), 8000);
      }
    };

    // Periksa seketika saat schoolProfile atau sesi berubah
    performParentAccessValidation();

    // Periksa secara berkala setiap 25 detik untuk pembatasan jam operasional
    const interval = setInterval(performParentAccessValidation, 25000);

    return () => clearInterval(interval);
  }, [schoolProfile, userSession]);

  // Add Attendance Record (from scanner or manual)
  const handleAddAttendance = (record: AttendanceRecord) => {
    if (!record || !record.studentId || !record.date || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
      console.warn('[Attendance] Record presensi tidak valid diabaikan:', record);
      return;
    }

    setAttendanceRecordsState(prev => {
      // Pastikan array lama bebas dari item rusak
      const validPrev = prev.filter(r => r && r.studentId && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
      const existingIndex = validPrev.findIndex(r => (
        (record.id && r.id === record.id) ||
        (r.studentId && record.studentId && r.studentId === record.studentId) ||
        (r.nisn && record.nisn && r.nisn === record.nisn)
      ) && r.date === record.date);

      let newRecord = { ...record };
      if (existingIndex >= 0) {
        const existing = validPrev[existingIndex];
        const mergedTime = (record.time && record.time !== '-')
          ? record.time
          : (existing.time && existing.time !== '-' ? existing.time : '-');
        const mergedReturnTime = (record.returnTime && record.returnTime !== '-')
          ? record.returnTime
          : (existing.returnTime && existing.returnTime !== '-' ? existing.returnTime : undefined);
        const isCompletedReturn = (s?: string) => s === 'PULANG' || s === 'PULANG_CEPAT' || s === 'PULANG_TEPAT';
        const mergedReturnStatus = isCompletedReturn(record.returnStatus)
          ? record.returnStatus
          : (isCompletedReturn(existing.returnStatus) ? existing.returnStatus : (record.returnStatus || existing.returnStatus));

        newRecord = {
          ...existing,
          ...record,
          time: mergedTime,
          status: (record.status && record.status !== 'ALPA') ? record.status : existing.status,
          method: (record.method === 'QR_SCAN' || existing.method === 'QR_SCAN') ? 'QR_SCAN' : (record.method || existing.method),
          scannedBy: (record.scannedBy && !record.scannedBy.includes('Sistem Otomatis')) ? record.scannedBy : existing.scannedBy,
          returnTime: mergedReturnTime,
          returnStatus: mergedReturnStatus,
          returnScannedBy: record.returnScannedBy || existing.returnScannedBy,
        };
      }
      const updated = [newRecord, ...validPrev.filter((_, idx) => idx !== existingIndex)];
      // Simpan segera ke antrean/cloud dengan auto-flush cepat (1.5 detik)
      if (newRecord.method === 'QR_SCAN') {
        queueAttendanceScanRecord(updated);
      } else {
        saveAttendanceRecords(updated, true);
      }
      return updated;
    });
  };

  // Update Attendance Status manually
  const handleUpdateAttendanceStatus = (
    recordId: string, 
    newStatus: AttendanceRecord['status'], 
    notes?: string,
    returnTime?: string,
    returnStatus?: AttendanceRecord['returnStatus'],
    fullRecord?: AttendanceRecord
  ) => {
    let exists = false;
    let targetStudentId = fullRecord?.studentId;
    let targetDate = fullRecord?.date;

    const updated = attendanceRecords.map(r => {
      const isMatch = r.id === recordId || (fullRecord && r.studentId === fullRecord.studentId && r.date === fullRecord.date);
      if (isMatch) {
        exists = true;
        targetStudentId = r.studentId;
        targetDate = r.date;
        return { 
          ...r, 
          status: newStatus, 
          time: fullRecord?.time !== undefined ? fullRecord.time : r.time,
          notes: notes !== undefined ? notes : r.notes,
          returnTime: returnTime !== undefined ? (returnTime || undefined) : r.returnTime,
          returnStatus: returnTime !== undefined ? (returnTime ? (returnStatus || 'PULANG') : undefined) : r.returnStatus
        };
      }
      return r;
    });

    if (!exists && fullRecord) {
      targetStudentId = fullRecord.studentId;
      targetDate = fullRecord.date;
      const createdRecord: AttendanceRecord = {
        ...fullRecord,
        status: newStatus,
        notes: notes !== undefined ? notes : fullRecord.notes,
        returnTime: returnTime && returnTime.trim() ? returnTime.trim() : undefined,
        returnStatus: returnTime && returnTime.trim() ? (returnStatus || 'PULANG') : undefined
      };
      updated.unshift(createdRecord);
    }

    setAttendanceRecordsState(updated);
    saveAttendanceRecords(updated);

    // Auto-sync & cleanup character logs if attendance status changed away from ALPA / TERLAMBAT
    if (targetStudentId && targetDate) {
      setCharacterLogsState(prevLogs => {
        let logsChanged = false;
        const cleanedLogs = prevLogs.filter(l => {
          if (l.studentId === targetStudentId && l.date === targetDate) {
            // If status is not ALPA, remove auto-alpa penalty logs
            if (newStatus !== 'ALPA' && (l.notes?.toLowerCase().includes('terekam alpa') || l.id.includes('auto-alpa') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('alpa') && l.notes?.includes('Otomatis')))) {
              logsChanged = true;
              return false;
            }
            // If status is not TERLAMBAT, remove auto-late penalty logs
            if (newStatus !== 'TERLAMBAT' && (l.notes?.toLowerCase().includes('scan hadir terlambat') || l.id.includes('auto-late') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('terlambat') && l.notes?.includes('Otomatis')))) {
              logsChanged = true;
              return false;
            }
          }
          return true;
        });

        if (logsChanged) {
          saveStudentCharacterLogs(cleanedLogs);
          return cleanedLogs;
        }
        return prevLogs;
      });
    }
  };

  // Delete multiple attendance records (e.g. Alpa massal)
  const handleDeleteAttendanceRecords = (recordIds: string[]) => {
    const idSet = new Set(recordIds);
    const deletedRecords = attendanceRecords.filter(r => idSet.has(r.id));
    
    setAttendanceRecordsState(prev => {
      const updated = prev.filter(r => !idSet.has(r.id));
      saveAttendanceRecords(updated);
      return updated;
    });

    // Clean up corresponding auto character logs for deleted attendance records
    if (deletedRecords.length > 0) {
      setCharacterLogsState(prevLogs => {
        let logsChanged = false;
        const cleanedLogs = prevLogs.filter(l => {
          const isFromDeleted = deletedRecords.some(d => 
            d.studentId === l.studentId && 
            d.date === l.date && 
            (l.notes?.includes('Penilaian Otomatis Presensi') || l.id.startsWith('log-auto-'))
          );
          if (isFromDeleted) {
            logsChanged = true;
            return false;
          }
          return true;
        });

        if (logsChanged) {
          saveStudentCharacterLogs(cleanedLogs);
          return cleanedLogs;
        }
        return prevLogs;
      });
    }
  };

  // Bulk update attendance status (e.g. convert Alpa to Hadir/Izin/Sakit)
  const handleBulkUpdateAttendanceRecords = (
    updates: {
      studentId: string;
      studentName: string;
      nisn: string;
      className: string;
      date: string;
      newStatus: AttendanceRecord['status'];
      notes?: string;
      existingRecordId?: string;
    }[]
  ) => {
    setAttendanceRecordsState(prev => {
      const updated = [...prev];
      const nowTime = new Date().toTimeString().substring(0, 5);

      updates.forEach(u => {
        const existingIdx = updated.findIndex(r => 
          (u.existingRecordId && r.id === u.existingRecordId) || 
          (r.studentId === u.studentId && r.date === u.date)
        );

        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            status: u.newStatus,
            notes: u.notes !== undefined ? u.notes : updated[existingIdx].notes,
            time: u.newStatus === 'HADIR' ? (updated[existingIdx].time && updated[existingIdx].time !== '-' ? updated[existingIdx].time : nowTime) : updated[existingIdx].time,
          };
        } else {
          // Create new record
          const newRecord: AttendanceRecord = {
            id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            studentId: u.studentId,
            studentName: u.studentName,
            nisn: u.nisn,
            className: u.className,
            date: u.date,
            time: u.newStatus === 'HADIR' ? nowTime : '-',
            status: u.newStatus,
            method: 'MANUAL',
            scannedBy: userSession?.displayName ? `Admin (${userSession.displayName})` : 'Admin Sekolah',
            notes: u.notes,
            parentNotified: false
          };
          updated.unshift(newRecord);
        }
      });

      saveAttendanceRecords(updated);
      return updated;
    });

    // Auto-sync & cleanup character logs for bulk updates
    if (updates.length > 0) {
      setCharacterLogsState(prevLogs => {
        let logsChanged = false;
        const cleanedLogs = prevLogs.filter(l => {
          const matchUpdate = updates.find(u => u.studentId === l.studentId && u.date === l.date);
          if (matchUpdate) {
            if (matchUpdate.newStatus !== 'ALPA' && (l.notes?.toLowerCase().includes('terekam alpa') || l.id.includes('auto-alpa') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('alpa') && l.notes?.includes('Otomatis')))) {
              logsChanged = true;
              return false;
            }
            if (matchUpdate.newStatus !== 'TERLAMBAT' && (l.notes?.toLowerCase().includes('scan hadir terlambat') || l.id.includes('auto-late') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('terlambat') && l.notes?.includes('Otomatis')))) {
              logsChanged = true;
              return false;
            }
          }
          return true;
        });

        if (logsChanged) {
          saveStudentCharacterLogs(cleanedLogs);
          return cleanedLogs;
        }
        return prevLogs;
      });
    }
  };

  // Bulk update return status (e.g. mark multiple students as Pulang / Pulang Cepat or reset return status)
  const handleBulkUpdateReturnStatus = (updates: BulkReturnUpdatePayload[]) => {
    const nowTime = new Date().toTimeString().substring(0, 5);

    setAttendanceRecordsState(prev => {
      const updated = [...prev];

      updates.forEach(u => {
        const existingIdx = updated.findIndex(r =>
          (u.existingRecordId && r.id === u.existingRecordId) ||
          (r.studentId === u.studentId && r.date === u.date)
        );

        if (existingIdx >= 0) {
          if (u.newReturnStatus === 'BELUM_PULANG') {
            updated[existingIdx] = {
              ...updated[existingIdx],
              returnTime: undefined,
              returnStatus: undefined,
              returnScannedBy: undefined,
            };
          } else {
            updated[existingIdx] = {
              ...updated[existingIdx],
              returnTime: u.newReturnTime || nowTime,
              returnStatus: u.newReturnStatus,
              returnScannedBy: userSession?.displayName ? `Admin (${userSession.displayName})` : 'Admin (Update Massal)',
              notes: u.notes !== undefined ? u.notes : updated[existingIdx].notes,
            };
          }
        } else {
          // If record does not exist yet for this student on this date:
          if (u.newReturnStatus !== 'BELUM_PULANG') {
            const newRecord: AttendanceRecord = {
              id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              studentId: u.studentId,
              studentName: u.studentName,
              nisn: u.nisn,
              className: u.className,
              date: u.date,
              time: '-',
              status: 'HADIR',
              method: 'MANUAL',
              scannedBy: userSession?.displayName ? `Admin (${userSession.displayName})` : 'Admin Sekolah',
              returnTime: u.newReturnTime || nowTime,
              returnStatus: u.newReturnStatus,
              returnScannedBy: userSession?.displayName ? `Admin (${userSession.displayName})` : 'Admin (Update Massal)',
              notes: u.notes,
              parentNotified: false,
            };
            updated.unshift(newRecord);
          }
        }
      });

      saveAttendanceRecords(updated);
      return updated;
    });
  };

  // Student CRUD
  const handleAddStudent = (newStudent: Student) => {
    setStudentsState(prev => {
      const updated = [newStudent, ...prev];
      setTimeout(() => saveStudents(updated, true), 0);
      return updated;
    });
  };

  const handleBatchAddStudents = (newStudents: Student[], newClasses?: SchoolClass[]) => {
    setStudentsState(prev => {
      const updated = [...newStudents, ...prev];
      setTimeout(() => saveStudents(updated, true), 0);
      return updated;
    });

    if (newClasses && newClasses.length > 0) {
      setClassesState(prevClasses => {
        const existingNames = new Set(prevClasses.map(c => c.name.trim().toLowerCase()));
        const uniqueNew = newClasses.filter(c => !existingNames.has(c.name.trim().toLowerCase()));
        if (uniqueNew.length > 0) {
          const updatedClasses = [...prevClasses, ...uniqueNew];
          setTimeout(() => saveSchoolClasses(updatedClasses), 0);
          return updatedClasses;
        }
        return prevClasses;
      });
    }
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    setStudentsState(prev => {
      const updated = prev.map(s => s.id === updatedStudent.id ? updatedStudent : s);
      setTimeout(() => saveStudents(updated, true), 0);
      return updated;
    });
  };

  const handleDeleteStudent = (id: string) => {
    // Filter students
    setStudentsState(prev => {
      const updated = prev.filter(s => s.id !== id);
      setTimeout(() => saveStudents(updated, true), 0);
      return updated;
    });

    // Clean up related attendance records
    setAttendanceRecordsState(prev => {
      const updated = prev.filter(a => a.studentId !== id);
      setTimeout(() => saveAttendanceRecords(updated), 0);
      return updated;
    });

    // Clean up related leave requests
    setLeaveRequestsState(prev => {
      const updated = prev.filter(l => l.studentId !== id);
      setTimeout(() => saveLeaveRequests(updated), 0);
      return updated;
    });

    // Clean up related character logs
    setCharacterLogsState(prev => {
      const updated = prev.filter(l => l.studentId !== id);
      setTimeout(() => saveStudentCharacterLogs(updated), 0);
      return updated;
    });
  };

  const handleBatchDeleteStudents = (ids: string[]) => {
    const idSet = new Set(ids);
    setStudentsState(prev => {
      const updated = prev.filter(s => !idSet.has(s.id));
      setTimeout(() => saveStudents(updated, true), 0);
      return updated;
    });

    setAttendanceRecordsState(prev => {
      const updated = prev.filter(a => !idSet.has(a.studentId));
      setTimeout(() => saveAttendanceRecords(updated), 0);
      return updated;
    });

    setLeaveRequestsState(prev => {
      const updated = prev.filter(l => !idSet.has(l.studentId));
      setTimeout(() => saveLeaveRequests(updated), 0);
      return updated;
    });

    setCharacterLogsState(prev => {
      const updated = prev.filter(l => !idSet.has(l.studentId));
      setTimeout(() => saveStudentCharacterLogs(updated), 0);
      return updated;
    });
  };

  // Class CRUD
  const handleAddClass = (newClass: SchoolClass) => {
    const updated = [...classes, newClass];
    const { updatedTeachers, updatedClasses } = reconcileTeachersAndClasses(teachers, updated);
    setClassesState(updatedClasses);
    setTeachersState(updatedTeachers);
    saveSchoolClasses(updatedClasses);
    saveTeachers(updatedTeachers);
  };

  const handleUpdateClass = (updatedClass: SchoolClass) => {
    const updated = classes.map(c => c.id === updatedClass.id ? updatedClass : c);
    const { updatedTeachers, updatedClasses } = reconcileTeachersAndClasses(teachers, updated);
    setClassesState(updatedClasses);
    setTeachersState(updatedTeachers);
    saveSchoolClasses(updatedClasses);
    saveTeachers(updatedTeachers);
  };

  const handleDeleteClass = (classId: string) => {
    const updated = classes.filter(c => c.id !== classId);
    const { updatedTeachers, updatedClasses } = reconcileTeachersAndClasses(teachers, updated);
    setClassesState(updatedClasses);
    setTeachersState(updatedTeachers);
    saveSchoolClasses(updatedClasses);
    saveTeachers(updatedTeachers);
  };

  // Leave Request Handlers
  const handleAddLeaveRequest = (req: LeaveRequest) => {
    const updated = [req, ...leaveRequests];
    setLeaveRequestsState(updated);
    saveLeaveRequests(updated);

    // If auto-approved, mark attendance
    if (req.status === 'APPROVED') {
      const attStatus: AttendanceRecord['status'] = req.type === 'SAKIT' ? 'SAKIT' : 'IZIN';
      const newAtt: AttendanceRecord = {
        id: `att-${req.startDate}-${req.studentId}`,
        studentId: req.studentId,
        studentName: req.studentName,
        nisn: students.find(s => s.id === req.studentId)?.nisn || '',
        className: req.className,
        date: req.startDate,
        time: '07:00:00',
        status: attStatus,
        method: 'IZIN_APPROVED',
        scannedBy: 'Wali Kelas / System',
        parentNotified: true,
        notes: req.reason
      };
      handleAddAttendance(newAtt);
    }
  };

  const handleUpdateLeaveStatus = (reqId: string, status: LeaveRequest['status'], adminNotes?: string) => {
    let targetReq: LeaveRequest | undefined;
    const updated = leaveRequests.map(r => {
      if (r.id === reqId) {
        targetReq = { ...r, status, adminNotes: adminNotes || r.adminNotes };
        return targetReq;
      }
      return r;
    });

    setLeaveRequestsState(updated);
    saveLeaveRequests(updated);

    if (targetReq && status === 'APPROVED') {
      const attStatus: AttendanceRecord['status'] = targetReq.type === 'SAKIT' ? 'SAKIT' : 'IZIN';
      const newAtt: AttendanceRecord = {
        id: `att-${targetReq.startDate}-${targetReq.studentId}`,
        studentId: targetReq.studentId,
        studentName: targetReq.studentName,
        nisn: students.find(s => s.id === targetReq.studentId)?.nisn || '',
        className: targetReq.className,
        date: targetReq.startDate,
        time: '07:00:00',
        status: attStatus,
        method: 'IZIN_APPROVED',
        scannedBy: 'Wali Kelas / System',
        parentNotified: true,
        notes: targetReq.reason
      };
      handleAddAttendance(newAtt);
    }
  };

  const handleSendChatMessage = (reqId: string, message: ChatMessage) => {
    const updated = leaveRequests.map(r => {
      if (r.id === reqId) {
        return {
          ...r,
          chatHistory: [...(r.chatHistory || []), message]
        };
      }
      return r;
    });
    setLeaveRequestsState(updated);
    saveLeaveRequests(updated);
  };

  // Teacher Handlers
  const handleSaveJournal = (journal: LearningJournal) => {
    const updated = [journal, ...journals.filter(j => j.id !== journal.id)];
    setJournalsState(updated);
    saveLearningJournals(updated);
  };

  const handleDeleteJournal = (journalId: string) => {
    const updated = journals.filter(j => j.id !== journalId);
    setJournalsState(updated);
    saveLearningJournals(updated);
  };

  const handleAddTeacher = (newTeacherData: Omit<Teacher, 'id'>) => {
    const newTeacher: Teacher = {
      ...newTeacherData,
      id: `tch-${Date.now()}`
    };
    const updated = [newTeacher, ...teachers];
    const { updatedTeachers, updatedClasses } = reconcileTeachersAndClasses(updated, classes);
    setTeachersState(updatedTeachers);
    setClassesState(updatedClasses);
    saveTeachers(updatedTeachers);
    saveSchoolClasses(updatedClasses);
  };

  const handleImportTeachers = (newTeachers: Teacher[]) => {
    const updated = [...newTeachers, ...teachers];
    const { updatedTeachers, updatedClasses } = reconcileTeachersAndClasses(updated, classes);
    setTeachersState(updatedTeachers);
    setClassesState(updatedClasses);
    saveTeachers(updatedTeachers);
    saveSchoolClasses(updatedClasses);
  };

  const handleUpdateTeacher = (updatedTeacher: Teacher) => {
    const updated = teachers.map(t => t.id === updatedTeacher.id ? updatedTeacher : t);
    const { updatedTeachers, updatedClasses } = reconcileTeachersAndClasses(updated, classes);
    setTeachersState(updatedTeachers);
    setClassesState(updatedClasses);
    saveTeachers(updatedTeachers, true);
    saveSchoolClasses(updatedClasses);
  };

  const handleBatchResetTeachersPassword = () => {
    setTeachersState(prev => {
      const updated = prev.map(t => ({ ...t, password: '123456' }));
      saveTeachers(updated, true);
      return updated;
    });
  };

  const handleBatchResetStudentsPassword = () => {
    setStudentsState(prev => {
      const updated = prev.map(s => ({ ...s, password: '123456' }));
      saveStudents(updated, true);
      return updated;
    });
  };

  const handleDeleteTeacher = (id: string) => {
    setTeachersState(prev => {
      const updated = prev.filter(t => t.id !== id);
      const { updatedTeachers, updatedClasses } = reconcileTeachersAndClasses(updated, classes);
      setClassesState(updatedClasses);
      saveTeachers(updatedTeachers, true);
      saveSchoolClasses(updatedClasses);
      return updatedTeachers;
    });
  };

  const handleBatchDeleteTeachers = (ids: string[]) => {
    const idSet = new Set(ids);
    setTeachersState(prev => {
      const updated = prev.filter(t => !idSet.has(t.id));
      const { updatedTeachers, updatedClasses } = reconcileTeachersAndClasses(updated, classes);
      setClassesState(updatedClasses);
      saveTeachers(updatedTeachers, true);
      saveSchoolClasses(updatedClasses);
      return updatedTeachers;
    });
  };

  // Character Traits Catalog Handlers
  const handleAddTrait = (newTrait: CharacterTrait) => {
    const updated = [newTrait, ...traits];
    setTraitsState(updated);
    saveCharacterTraits(updated);
  };

  const handleUpdateTrait = (updatedTrait: CharacterTrait) => {
    const updated = traits.map(t => t.id === updatedTrait.id ? updatedTrait : t);
    setTraitsState(updated);
    saveCharacterTraits(updated);
  };

  const handleDeleteTrait = (id: string) => {
    const updated = traits.filter(t => t.id !== id);
    setTraitsState(updated);
    saveCharacterTraits(updated);
  };

  // Character Points Log Handlers
  const handleAddCharacterLog = (newLog: StudentCharacterLog) => {
    const updated = [newLog, ...characterLogs];
    setCharacterLogsState(updated);
    saveStudentCharacterLogs(updated);
  };

  const handleAddMultipleCharacterLogs = (newLogs: StudentCharacterLog[]) => {
    if (!newLogs || newLogs.length === 0) return;
    const updated = [...newLogs, ...characterLogs];
    setCharacterLogsState(updated);
    saveStudentCharacterLogs(updated);
  };

  const handleUpdateCharacterLog = (updatedLog: StudentCharacterLog) => {
    const updated = characterLogs.map(l => l.id === updatedLog.id ? updatedLog : l);
    setCharacterLogsState(updated);
    saveStudentCharacterLogs(updated);
  };

  const handleDeleteCharacterLog = (logId: string) => {
    const updated = characterLogs.filter(l => l.id !== logId);
    setCharacterLogsState(updated);
    saveStudentCharacterLogs(updated);
  };

  const handleSavePredicateSettings = (settings: CharacterPredicateSettings) => {
    setPredicateSettingsState(settings);
    saveCharacterPredicateSettings(settings);
  };

  // School Settings Handler
  const handleSaveSchoolProfile = (profile: SchoolProfile) => {
    setSchoolProfileState(profile);
    saveSchoolProfile(profile);
  };

  // Schedule & Period Handlers
  const handleSavePeriods = (newPeriods: LessonPeriod[]) => {
    setPeriodsState(newPeriods);
    saveLessonPeriods(newPeriods);
  };

  const handleSaveSchedules = (newSchedules: ClassScheduleSlot[]) => {
    setSchedulesState(newSchedules);
    saveClassSchedules(newSchedules);
  };


  const unreadLeavesCount = leaveRequests.filter(r => r.status === 'PENDING').length;

  if (!userSession || !userSession.isLoggedIn) {
    return (
      <LoginView
        schoolProfile={schoolProfile}
        teachers={teachers}
        students={students}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-indigo-500 selection:text-white flex flex-col lg:flex-row">
      
      {/* Left Sidebar - Vertical 1-Column Feature Menu */}
      <Sidebar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        schoolProfile={schoolProfile}
        unreadLeavesCount={unreadLeavesCount}
        userSession={userSession}
        onLogout={handleLogout}
        studentCount={students.length}
      />

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* PWA In-App Install Prompt Banner (Visible on browser and not installed) */}
        <PWAInstallBanner />
        
        {/* Parent Student Info Banner (Automatic by Logged-in NISN, No Selection) */}
        {currentRole === 'PARENT' && parentStudent && (
          <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white border-b border-indigo-800/80 py-3 px-4 lg:px-8 shadow-xs">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                {/* Student Avatar / Photo */}
                <div className="relative shrink-0">
                  {parentStudent.photoUrl ? (
                    <img
                      src={parentStudent.photoUrl}
                      alt={parentStudent.name}
                      className="w-10 h-10 rounded-xl object-cover border-2 border-emerald-400 shadow-sm"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-indigo-700 border-2 border-emerald-400 flex items-center justify-center font-bold text-white shadow-sm text-xs">
                      {parentStudent.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-indigo-950 rounded-full" title="Akun Terverifikasi"></span>
                </div>

                {/* Student Details */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-extrabold text-sm tracking-tight">{parentStudent.name}</span>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      Kelas {parentStudent.className}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-indigo-200 text-[11px] mt-0.5 flex-wrap">
                    <span>NISN: <strong className="text-amber-300 font-mono">{parentStudent.nisn}</strong></span>
                    <span>•</span>
                    <span>Wali: <strong className="text-white">{parentStudent.parentName || 'Orang Tua Siswa'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Automatic Binding Badge (No choices/selection) */}
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs border border-white/15 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-indigo-100 self-stretch sm:self-auto justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Akun NISN Terhubung Otomatis</span>
              </div>
            </div>
          </div>
        )}

        {/* Main View Router */}
        <main className={`flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto ${(currentRole === 'PARENT' || currentRole === 'TEACHER') ? 'pb-28 lg:pb-8' : ''}`}>
          {activeTab === 'scanner' && (
            <QRScannerView
              students={students}
              classes={classes}
              schoolProfile={schoolProfile}
              attendanceRecords={attendanceRecords}
              onAddAttendance={handleAddAttendance}
              currentRole={currentRole}
              userRole={currentRole}
            />
          )}

          {activeTab === 'dashboard' && (
            <AttendanceDashboard
              students={students}
              classes={classes}
              attendanceRecords={attendanceRecords}
              onUpdateStatus={handleUpdateAttendanceStatus}
              onDeleteAttendanceRecords={handleDeleteAttendanceRecords}
              onBulkUpdateAttendanceRecords={handleBulkUpdateAttendanceRecords}
              onBulkUpdateReturnStatus={handleBulkUpdateReturnStatus}
              currentRole={currentRole}
              selectedChildId={effectiveChildId}
              learningJournals={journals}
              traits={traits}
              characterLogs={characterLogs}
              predicateSettings={predicateSettings}
              userSession={userSession}
              onNavigateTab={handleTabChange}
              schoolProfile={schoolProfile}
              unreadLeavesCount={leaveRequests.filter(l => l.status === 'PENDING').length}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleManagementView
              schoolProfile={schoolProfile}
              classes={classes}
              teachers={teachers}
              periods={periods}
              schedules={schedules}
              onSavePeriods={handleSavePeriods}
              onSaveSchedules={handleSaveSchedules}
              currentRole={currentRole}
              userSession={userSession}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              students={students}
              attendanceRecords={attendanceRecords}
              schoolProfile={schoolProfile}
              characterLogs={characterLogs}
              learningJournals={journals}
            />
          )}

          {activeTab === 'learning' && (
            <LearningJournalView
              classes={classes}
              students={students}
              teachers={teachers}
              schoolProfile={schoolProfile}
              journals={journals}
              attendanceRecords={attendanceRecords}
              onSaveJournal={handleSaveJournal}
              onDeleteJournal={handleDeleteJournal}
              userRole={currentRole}
              userSession={userSession}
            />
          )}

          {activeTab === 'teachers' && (
            <TeacherDirectoryView
              teachers={teachers}
              classes={classes}
              schoolProfile={schoolProfile}
              onAddTeacher={handleAddTeacher}
              onUpdateTeacher={handleUpdateTeacher}
              onDeleteTeacher={handleDeleteTeacher}
              onBatchDeleteTeachers={handleBatchDeleteTeachers}
              onImportTeachers={handleImportTeachers}
            />
          )}

          {activeTab === 'students' && (
            <StudentDirectoryView
              students={students}
              classes={classes}
              schoolProfile={schoolProfile}
              teachers={teachers}
              onAddStudent={handleAddStudent}
              onBatchAddStudents={handleBatchAddStudents}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onBatchDeleteStudents={handleBatchDeleteStudents}
            />
          )}

          {activeTab === 'classes' && (
            <ClassManagementView
              classes={classes}
              students={students}
              teachers={teachers}
              attendanceRecords={attendanceRecords}
              journals={journals}
              characterLogs={characterLogs}
              traits={traits}
              predicateSettings={predicateSettings}
              schoolProfile={schoolProfile}
              onAddClass={handleAddClass}
              onUpdateClass={handleUpdateClass}
              onDeleteClass={handleDeleteClass}
            />
          )}

          {activeTab === 'leaves' && (
            <LeaveRequestView
              leaveRequests={leaveRequests}
              students={students}
              currentRole={currentRole}
              selectedChildId={effectiveChildId}
              onAddLeaveRequest={handleAddLeaveRequest}
              onUpdateLeaveStatus={handleUpdateLeaveStatus}
              onSendChatMessage={handleSendChatMessage}
            />
          )}

          {activeTab === 'account' && currentRole === 'TEACHER' && (
            <TeacherAccountView
              teacher={currentTeacher}
              schoolProfile={schoolProfile}
              userSession={userSession}
              classes={classes}
              onUpdateTeacher={handleUpdateTeacher}
              onLogout={handleLogout}
            />
          )}

          {(activeTab === 'account' || activeTab === 'idcard') && currentRole !== 'TEACHER' && (
            <ParentAccountView
              student={parentStudent}
              schoolProfile={schoolProfile}
              userSession={userSession}
              onUpdateStudent={handleUpdateStudent}
              onLogout={handleLogout}
            />
          )}

          {activeTab === 'discipline_rules' && (
            <DisciplineRulesView
              traits={traits}
              predicateSettings={predicateSettings}
              schoolProfile={schoolProfile}
              userRole={currentRole}
              userSession={userSession}
              onNavigateToMasterInput={() => handleTabChange('character_input')}
            />
          )}

          {activeTab === 'character_input' && (
            <CharacterInputView
              traits={traits}
              students={students}
              classes={classes}
              characterLogs={characterLogs}
              attendanceRecords={attendanceRecords}
              learningJournals={journals}
              teachers={teachers}
              userSession={userSession}
              predicateSettings={predicateSettings}
              schoolProfile={schoolProfile}
              onUpdateSchoolProfile={handleSaveSchoolProfile}
              onAddTrait={handleAddTrait}
              onUpdateTrait={handleUpdateTrait}
              onDeleteTrait={handleDeleteTrait}
              onSavePredicateSettings={handleSavePredicateSettings}
              onApplyAutoCharacterLogs={handleAddMultipleCharacterLogs}
            />
          )}

          {activeTab === 'character_points' && (
            <CharacterPointsView
              students={students}
              classes={classes}
              traits={traits}
              logs={characterLogs}
              teachers={teachers}
              attendanceRecords={attendanceRecords}
              learningJournals={journals}
              onAddLog={handleAddCharacterLog}
              onApplyMultipleLogs={handleAddMultipleCharacterLogs}
              onUpdateLog={handleUpdateCharacterLog}
              onDeleteLog={handleDeleteCharacterLog}
              currentUserRole={currentRole}
              schoolProfile={schoolProfile}
              onUpdateSchoolProfile={handleSaveSchoolProfile}
              predicateSettings={predicateSettings}
              userSession={userSession}
            />
          )}


          {activeTab === 'recap' && (
            <RecapExportView
              students={students}
              classes={classes}
              attendanceRecords={attendanceRecords}
              schoolProfile={schoolProfile}
              learningJournals={journals}
              traits={traits}
              characterLogs={characterLogs}
              predicateSettings={predicateSettings}
            />
          )}

          {activeTab === 'settings' && (
            <SchoolSettingsView
              schoolProfile={schoolProfile}
              onSaveProfile={handleSaveSchoolProfile}
              teachers={teachers}
              students={students}
              onUpdateTeacher={handleUpdateTeacher}
              onUpdateStudent={handleUpdateStudent}
              onDeleteTeacher={handleDeleteTeacher}
              onBatchDeleteStudents={handleBatchDeleteStudents}
              onBatchResetTeachersPassword={handleBatchResetTeachersPassword}
              onBatchResetStudentsPassword={handleBatchResetStudentsPassword}
            />
          )}
        </main>
      </div>

      {/* Floating KBM Voice Reminder Alert Banner */}
      <KbmVoiceReminderBanner
        reminder={activeVoiceReminder}
        onDismiss={() => setActiveVoiceReminder(null)}
        onOpenJournal={() => {
          handleTabChange('learning');
          setActiveVoiceReminder(null);
        }}
      />

      {/* Mobile Glass Bottom Navigation Bar for Parent Role */}
      {currentRole === 'PARENT' && (
        <ParentBottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          unreadLeavesCount={leaveRequests.filter(l => l.status === 'PENDING').length}
        />
      )}

      {/* Mobile Glass Bottom Navigation Bar for Teacher Role */}
      {currentRole === 'TEACHER' && (
        <TeacherBottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          unreadLeavesCount={leaveRequests.filter(l => l.status === 'PENDING').length}
          teacherName={currentTeacher?.name}
          homeroomClassName={currentTeacher?.homeroomClassName}
        />
      )}

      {/* Floating Auto-Sync & Network Toast Notification */}
      {networkToast && (
        <div
          className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 max-w-sm p-3.5 rounded-2xl shadow-2xl border flex items-start space-x-3 transition-all animate-in fade-in slide-in-from-bottom-5 backdrop-blur-md ${
            networkToast.type === 'success'
              ? 'bg-slate-900/95 text-emerald-100 border-emerald-500/50 shadow-emerald-950/40'
              : networkToast.type === 'warning'
              ? 'bg-slate-900/95 text-amber-100 border-amber-500/50 shadow-amber-950/40'
              : 'bg-slate-900/95 text-sky-100 border-sky-500/50 shadow-sky-950/40'
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {networkToast.type === 'success' ? (
              <span className="flex h-6 w-6 rounded-full bg-emerald-500/20 items-center justify-center border border-emerald-500/40">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </span>
            ) : networkToast.type === 'warning' ? (
              <span className="flex h-6 w-6 rounded-full bg-amber-500/20 items-center justify-center border border-amber-500/40">
                <WifiOff className="w-4 h-4 text-amber-400" />
              </span>
            ) : (
              <span className="flex h-6 w-6 rounded-full bg-sky-500/20 items-center justify-center border border-sky-500/40">
                <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <h4 className="font-bold text-xs uppercase tracking-wider text-white">
              {networkToast.title}
            </h4>
            <p className="text-[11.5px] opacity-85 mt-0.5 leading-snug">
              {networkToast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNetworkToast(null)}
            className="text-slate-400 hover:text-white text-xs p-1 cursor-pointer transition-colors"
            title="Tutup Notifikasi"
          >
            ✕
          </button>
        </div>
      )}

    </div>
  );
}
