import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  UserRole, 
  SchoolProfile, 
  Student, 
  SchoolClass, 
  AttendanceRecord, 
  LeaveRequest, 
  WhatsAppLog,
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
  getLeaveRequests, 
  saveLeaveRequests,
  getWaLogs, 
  saveWaLogs,
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
  reconcileTeachersAndClasses
} from './lib/storage';
import { sendWhatsAppGatewayMessage } from './lib/exportUtils';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

import { Sidebar } from './components/Sidebar';
import { QRScannerView } from './components/QRScannerView';
import { AttendanceDashboard } from './components/AttendanceDashboard';
import { AnalyticsView } from './components/AnalyticsView';
import { StudentDirectoryView } from './components/StudentDirectoryView';
import { ClassManagementView } from './components/ClassManagementView';
import { LeaveRequestView } from './components/LeaveRequestView';
import { SchoolSettingsView } from './components/SchoolSettingsView';
import { WhatsAppLogView } from './components/WhatsAppLogView';
import { RecapExportView } from './components/RecapExportView';
import { TeacherDirectoryView } from './components/TeacherDirectoryView';
import { LearningJournalView } from './components/LearningJournalView';
import { DisciplineRulesView } from './components/DisciplineRulesView';
import { CharacterInputView } from './components/CharacterInputView';
import { CharacterPointsView } from './components/CharacterPointsView';
import { ScheduleManagementView } from './components/ScheduleManagementView';
import { ParentChatView } from './components/ParentChatView';
import { ParentAccountView } from './components/ParentAccountView';
import { TeacherAccountView } from './components/TeacherAccountView';
import { TeacherAssistantView } from './components/TeacherAssistantView';
import { LoginView } from './components/LoginView';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { KbmVoiceReminderBanner } from './components/KbmVoiceReminderBanner';
import { 
  KbmReminderInfo, 
  playTeacherKbmVoiceReminder, 
  isKbmVoiceReminderEnabled 
} from './lib/kbmVoiceReminder';

export default function App() {
  const [userSession, setUserSessionState] = useState<UserSession | null>(() => getUserSession());
  const [currentRole, setCurrentRole] = useState<UserRole>(userSession?.role || 'ADMIN');
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (window.history.state && window.history.state.tab) {
      return window.history.state.tab;
    }
    return userSession?.role === 'SCANNER_POS' ? 'scanner' : 'dashboard';
  });

  // Track tab changes in browser history for Hardware Back Button & Browser Back Button support
  const handleTabChange = (tabId: string, replace: boolean = false) => {
    setActiveTab(tabId);
    if (replace) {
      window.history.replaceState({ tab: tabId, role: currentRole }, '', `#${tabId}`);
    } else {
      // Only push new history entry if different from current history state
      if (window.history.state?.tab !== tabId) {
        window.history.pushState({ tab: tabId, role: currentRole }, '', `#${tabId}`);
      }
    }
  };

  // Hardware/Device & Browser Back Button Handler (popstate)
  useEffect(() => {
    // Initialize initial state if empty
    if (!window.history.state || !window.history.state.tab) {
      window.history.replaceState(
        { tab: activeTab, role: currentRole },
        '',
        `#${activeTab}`
      );
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
          window.history.pushState({ tab: activeTab, role: currentRole }, '', `#${activeTab}`);
          return;
        }
      }

      // 2. Navigate back to previous tab
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
        if (event.state.role && event.state.role !== currentRole) {
          setCurrentRole(event.state.role);
        }
      } else {
        // Default to home / dashboard instead of letting the browser exit the app
        const defaultTab = currentRole === 'SCANNER_POS' ? 'scanner' : 'dashboard';
        if (activeTab !== defaultTab) {
          setActiveTab(defaultTab);
          window.history.replaceState({ tab: defaultTab, role: currentRole }, '', `#${defaultTab}`);
        } else {
          // If already at default tab, re-push state to prevent accidental app exit on mobile WebView/PWA
          window.history.pushState({ tab: defaultTab, role: currentRole }, '', `#${defaultTab}`);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeTab, currentRole]);

  // Core Data States
  const [schoolProfile, setSchoolProfileState] = useState<SchoolProfile>(getSchoolProfile());
  const [students, setStudentsState] = useState<Student[]>(getStudents());
  const [classes, setClassesState] = useState<SchoolClass[]>(getSchoolClasses());
  const [attendanceRecords, setAttendanceRecordsState] = useState<AttendanceRecord[]>(getAttendanceRecords());
  const [leaveRequests, setLeaveRequestsState] = useState<LeaveRequest[]>(getLeaveRequests());
  const [waLogs, setWaLogsState] = useState<WhatsAppLog[]>(getWaLogs());
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

  // Teacher Identification (Strictly Bound to Logged-in teacherId, NIP, phone or username)
  const currentTeacher = useMemo(() => {
    if (currentRole !== 'TEACHER') return null;

    // 1. By teacherId from session
    if (userSession?.teacherId) {
      const found = teachers.find(t => t.id === userSession.teacherId);
      if (found) return found;
    }

    // 2. By nipOrNisn from session (exact match, trimming spaces)
    if (userSession?.nipOrNisn) {
      const cleanNip = userSession.nipOrNisn.replace(/\s+/g, '').toLowerCase();
      const found = teachers.find(t => t.nip.replace(/\s+/g, '').toLowerCase() === cleanNip);
      if (found) return found;
    }

    // 3. By username from session (phone or nip)
    if (userSession?.username) {
      const cleanUser = userSession.username.replace(/\s+/g, '').toLowerCase();
      const found = teachers.find(t => 
        t.nip.replace(/\s+/g, '').toLowerCase() === cleanUser ||
        (t.phone && t.phone.replace(/\s+/g, '').toLowerCase() === cleanUser)
      );
      if (found) return found;
    }

    // Fallback
    return teachers[0] || null;
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

  // Sync state on local storage events
  const refreshDataFromStorage = () => {
    const rawProfile = getSchoolProfile();
    const rawStudents = getStudents();
    const rawClasses = getSchoolClasses();
    const rawTeachers = getTeachers();

    const { updatedTeachers, updatedClasses, teachersChanged, classesChanged } = reconcileTeachersAndClasses(rawTeachers, rawClasses);

    if (teachersChanged) {
      saveTeachers(updatedTeachers);
    }
    if (classesChanged) {
      saveSchoolClasses(updatedClasses);
    }

    setSchoolProfileState(rawProfile);
    setStudentsState(rawStudents);
    setClassesState(updatedClasses);
    setTeachersState(updatedTeachers);
    setAttendanceRecordsState(getAttendanceRecords());
    setLeaveRequestsState(getLeaveRequests());
    setWaLogsState(getWaLogs());
    setJournalsState(getLearningJournals());
    setTraitsState(getCharacterTraits());
    setCharacterLogsState(getStudentCharacterLogs());
    setPredicateSettingsState(getCharacterPredicateSettings());
    setPeriodsState(getLessonPeriods());
    setSchedulesState(getClassSchedules());
    setUserSessionState(getUserSession());
  };


  useEffect(() => {
    initFirestoreRealtimeSync();

    // Initial reconciliation on boot to make sure teachers & classes match
    const initialRawClasses = getSchoolClasses();
    const initialRawTeachers = getTeachers();
    const { updatedTeachers, updatedClasses, teachersChanged, classesChanged } = reconcileTeachersAndClasses(initialRawTeachers, initialRawClasses);
    if (teachersChanged) {
      saveTeachers(updatedTeachers);
      setTeachersState(updatedTeachers);
    }
    if (classesChanged) {
      saveSchoolClasses(updatedClasses);
      setClassesState(updatedClasses);
    }

    window.addEventListener('sihadir_storage_updated', refreshDataFromStorage);
    return () => {
      window.removeEventListener('sihadir_storage_updated', refreshDataFromStorage);
    };
  }, []);

  // Automatic ALPA status assignment when autoAlpaTime is reached
  useEffect(() => {
    // Check if auto ALPA is disabled by admin in settings
    if (schoolProfile.autoAlpaEnabled === false) return;

    const autoAlpaTime = schoolProfile.autoAlpaTime || '08:30';
    const [targetH, targetM] = autoAlpaTime.split(':').map(Number);
    if (isNaN(targetH) || isNaN(targetM)) return;

    const checkAndApplyAutoAlpa = () => {
      const now = new Date();

      // Check if today is an active learning day
      const activeDays = schoolProfile.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const currentDayName = dayNames[now.getDay()];

      if (!activeDays.includes(currentDayName)) {
        // Hari ini adalah hari libur / non-aktif belajar. Abaikan penetapan Alpa otomatis.
        return;
      }

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const targetMinutes = targetH * 60 + targetM;

      if (currentMinutes < targetMinutes) return;

      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Check if today is a registered holiday
      const holidays = schoolProfile.holidays || [];
      const isTodayHoliday = holidays.some(h => {
        if (h.endDate) {
          return dateStr >= h.date && dateStr <= h.endDate;
        }
        return h.date === dateStr;
      });

      if (isTodayHoliday) {
        // Hari ini adalah hari libur khusus / libur nasional. Abaikan penetapan Alpa otomatis.
        return;
      }

      let hasChanges = false;
      const updatedAttendance = [...attendanceRecords];
      const updatedWaLogs = [...waLogs];

      students.forEach(student => {
        // Check if student already has attendance today
        const existingAtt = updatedAttendance.find(r => r.studentId === student.id && r.date === dateStr);
        if (existingAtt) return;

        // Check if student has approved leave request
        const hasApprovedLeave = leaveRequests.some(l => 
          l.studentId === student.id && 
          l.status === 'APPROVED' && 
          l.startDate <= dateStr && 
          l.endDate >= dateStr
        );
        if (hasApprovedLeave) return;

        // Auto assign ALPA
        const waLogId = `wa-autoalpa-${Date.now()}-${student.id}`;
        const isParentWaEnabled = schoolProfile.waParentNotificationEnabled !== false;

        const record: AttendanceRecord = {
          id: `att-autoalpa-${dateStr}-${student.id}`,
          studentId: student.id,
          studentName: student.name,
          nisn: student.nisn,
          className: student.className,
          date: dateStr,
          time: autoAlpaTime,
          status: 'ALPA',
          method: 'MANUAL',
          scannedBy: 'Sistem Otomatis (Batas Alpa)',
          notes: `Otomatis Alpa (Melewati batas jam ${autoAlpaTime} WITA)`,
          parentNotified: isParentWaEnabled,
          waLogId: isParentWaEnabled ? waLogId : undefined
        };

        updatedAttendance.push(record);
        hasChanges = true;

        if (isParentWaEnabled && schoolProfile.waTemplateAbsent) {
          const waMsg = schoolProfile.waTemplateAbsent
            .replace('[ParentName]', student.parentName)
            .replace('[StudentName]', student.name)
            .replace('[ClassName]', student.className)
            .replace('[Time]', autoAlpaTime);

          // Automatic dispatch via WhatsApp Gateway API if configured
          if (schoolProfile.waApiKey && schoolProfile.waApiKey.trim() && schoolProfile.waGatewayEnabled !== false) {
            sendWhatsAppGatewayMessage(
              student.parentPhone,
              waMsg,
              schoolProfile.waApiKey,
              schoolProfile.waGatewayProvider || 'Fonnte'
            );
          }

          const waLog: WhatsAppLog = {
            id: waLogId,
            studentId: student.id,
            studentName: student.name,
            className: student.className,
            phone: student.parentPhone,
            message: waMsg,
            status: 'TERKIRIM',
            timestamp: now.toISOString(),
            type: 'ALPA'
          };
          updatedWaLogs.push(waLog);
        }
      });

      if (hasChanges) {
        setAttendanceRecordsState(updatedAttendance);
        saveAttendanceRecords(updatedAttendance);
        if (updatedWaLogs.length > waLogs.length) {
          setWaLogsState(updatedWaLogs);
          saveWaLogs(updatedWaLogs);
        }
      }
    };

    checkAndApplyAutoAlpa();
    const interval = setInterval(checkAndApplyAutoAlpa, 30000);
    return () => clearInterval(interval);
  }, [
    schoolProfile.autoAlpaEnabled,
    schoolProfile.autoAlpaTime, 
    schoolProfile.activeDays, 
    schoolProfile.holidays, 
    schoolProfile.waParentNotificationEnabled,
    schoolProfile.waTemplateAbsent,
    schoolProfile.waApiKey,
    schoolProfile.waGatewayProvider,
    schoolProfile.waGatewayEnabled,
    students, 
    attendanceRecords, 
    leaveRequests, 
    waLogs
  ]);

  // Teacher WhatsApp Reminder Queue for 30s staggered delivery (to prevent spam/blocking)
  const teacherReminderQueueRef = useRef<{
    id: string;
    phone: string;
    message: string;
    apiKey: string;
    provider: string;
  }[]>([]);
  const isProcessingTeacherQueueRef = useRef<boolean>(false);
  const queuedReminderIdsRef = useRef<Set<string>>(new Set());

  const processTeacherReminderQueue = async () => {
    if (isProcessingTeacherQueueRef.current) return;
    isProcessingTeacherQueueRef.current = true;

    while (teacherReminderQueueRef.current.length > 0) {
      const item = teacherReminderQueueRef.current.shift();
      if (item) {
        try {
          if (item.apiKey && item.apiKey.trim()) {
            await sendWhatsAppGatewayMessage(
              item.phone,
              item.message,
              item.apiKey,
              item.provider || 'Fonnte'
            );
          }
        } catch (err) {
          console.error('[Staggered WA Sender] Error sending teacher reminder to', item.phone, err);
        }

        // If more items remain in the queue, wait exactly 30 seconds before sending the next reminder
        if (teacherReminderQueueRef.current.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }
    }

    isProcessingTeacherQueueRef.current = false;
  };

  // Automatic WhatsApp Reminder for Teachers based on KBM Schedule
  useEffect(() => {
    // Check if feature is enabled in settings
    if (schoolProfile.waTeacherReminderEnabled === false) return;

    const checkAndSendTeacherScheduleReminders = () => {
      const now = new Date();
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const currentDayName = dayNames[now.getDay()];

      // 1. Check if today is an active learning day
      const activeDays = schoolProfile.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      if (!activeDays.includes(currentDayName)) return;

      // 2. Check if today is a registered holiday
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

      // 3. Get periods for today
      const daySpecificPeriods = periods.filter(p => p.day === currentDayName || p.daySpecific === currentDayName);
      const todayPeriods = (daySpecificPeriods.length > 0 
        ? daySpecificPeriods 
        : periods.filter(p => !p.day || p.day === 'SEMUA')
      ).filter(p => p.type === 'KBM');

      if (todayPeriods.length === 0) return;

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const minutesBefore = schoolProfile.waTeacherReminderMinutesBefore ?? 0;

      // Schedules for today
      const todaySchedules = schedules.filter(s => s.day === currentDayName);
      if (todaySchedules.length === 0) return;

      const currentWaLogs = getWaLogs();
      const newWaLogs: WhatsAppLog[] = [];

      todayPeriods.forEach(period => {
        if (!period.startTime) return;
        const [pH, pM] = period.startTime.split(':').map(Number);
        if (isNaN(pH) || isNaN(pM)) return;

        const periodStartMinutes = pH * 60 + pM;
        const triggerMinutes = periodStartMinutes - minutesBefore;

        // Trigger window: within 20 minutes from target trigger time
        if (currentMinutes >= triggerMinutes && currentMinutes <= triggerMinutes + 20) {
          const matchingSlots = todaySchedules.filter(s => s.periodNumber === period.periodNumber);

          matchingSlots.forEach(slot => {
            if (!slot.teacherId && !slot.teacherName) return;

            // Unique log ID for today's reminder per slot
            const reminderLogId = `wa-teacher-kbm-${dateStr}-${slot.id || `${slot.classId}-${slot.periodNumber}-${slot.teacherId}`}`;

            // Check if reminder was already sent today or already in queue
            const alreadySent = 
              currentWaLogs.some(l => l.id === reminderLogId) || 
              newWaLogs.some(l => l.id === reminderLogId) ||
              queuedReminderIdsRef.current.has(reminderLogId);
            if (alreadySent) return;

            // Mark as queued immediately to avoid duplicate dispatch on 25s check interval
            queuedReminderIdsRef.current.add(reminderLogId);

            // Find teacher
            const teacher = teachers.find(t => t.id === slot.teacherId || t.name.toLowerCase() === (slot.teacherName || '').toLowerCase());
            if (!teacher || !teacher.phone || !teacher.phone.trim()) return;

            // Build reminder message
            const template = schoolProfile.waTemplateTeacherReminder || 
              "PENGINGAT MENGAJAR: Yth. Bpk/Ibu [TeacherName], mengingatkan bahwa jadwal mengajar mata pelajaran [Subject] di Kelas [ClassName] ([Room]) akan dimulai pada pukul [Time] WITA ([PeriodLabel]). Selamat menjalankan KBM!";

            const periodLabel = period.label || `JP ${slot.periodNumber}`;
            const roomLabel = slot.room ? `Ruang ${slot.room}` : `Kelas ${slot.className}`;

            const waMsg = template
              .replace(/\[TeacherName\]/g, teacher.name)
              .replace(/\[Subject\]/g, slot.subject)
              .replace(/\[ClassName\]/g, slot.className)
              .replace(/\[Room\]/g, roomLabel)
              .replace(/\[Time\]/g, period.startTime)
              .replace(/\[PeriodLabel\]/g, periodLabel)
              .replace(/\[Period\]/g, String(slot.periodNumber))
              .replace(/\[SchoolName\]/g, schoolProfile.name);

            // Queue for staggered sending (every 30 seconds) via WhatsApp Gateway if configured & enabled
            if (schoolProfile.waApiKey && schoolProfile.waApiKey.trim() && schoolProfile.waGatewayEnabled !== false) {
              teacherReminderQueueRef.current.push({
                id: reminderLogId,
                phone: teacher.phone,
                message: waMsg,
                apiKey: schoolProfile.waApiKey,
                provider: schoolProfile.waGatewayProvider || 'Fonnte'
              });
              processTeacherReminderQueue();
            }

            const waLog: WhatsAppLog = {
              id: reminderLogId,
              studentId: '',
              studentName: teacher.name,
              className: slot.className,
              phone: teacher.phone,
              message: waMsg,
              status: 'TERKIRIM',
              timestamp: now.toISOString(),
              type: 'JADWAL_GURU',
              recipientRole: 'TEACHER',
              teacherId: teacher.id,
              teacherName: teacher.name,
              slotId: slot.id,
              periodNumber: slot.periodNumber
            };

            newWaLogs.push(waLog);
          });
        }
      });

      if (newWaLogs.length > 0) {
        const updated = [...newWaLogs, ...currentWaLogs];
        setWaLogsState(updated);
        saveWaLogs(updated);
      }
    };

    checkAndSendTeacherScheduleReminders();
    const interval = setInterval(checkAndSendTeacherScheduleReminders, 25000);
    return () => clearInterval(interval);
  }, [
    schoolProfile.waTeacherReminderEnabled,
    schoolProfile.waTeacherReminderMinutesBefore,
    schoolProfile.waTemplateTeacherReminder,
    schoolProfile.activeDays,
    schoolProfile.holidays,
    schoolProfile.waApiKey,
    schoolProfile.waGatewayProvider,
    schoolProfile.waGatewayEnabled,
    periods,
    schedules,
    teachers
  ]);

  // -------------------------------------------------------------
  // Real-Time AI Voice Reminder for Teachers with Active KBM Slots
  // Plays pleasant chime + female AI speech:
  // "Anda Memiliki Jam Mengajar Saat ini, Selamat Menjalankan Tugas. Terima Kasih "
  // -------------------------------------------------------------
  useEffect(() => {
    const checkAndTriggerKbmVoiceReminder = () => {
      if (!isKbmVoiceReminderEnabled()) return;

      const now = new Date();
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const currentDayName = dayNames[now.getDay()];

      // 1. Check active school day
      const activeDays = schoolProfile.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      if (!activeDays.includes(currentDayName)) return;

      // 2. Check holiday
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

      // 3. Periods for today
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

            // If in TEACHER role, trigger specifically for the logged-in teacher
            if (currentRole === 'TEACHER' && currentTeacher) {
              const isMySlot = 
                (slot.teacherId && slot.teacherId === currentTeacher.id) ||
                (slot.teacherName && slot.teacherName.toLowerCase() === currentTeacher.name.toLowerCase());
              if (!isMySlot) return;
            }

            const voiceKey = `voice-kbm-${dateStr}-${slot.id || `${slot.classId}-${slot.periodNumber}-${slot.teacherId}`}-${period.startTime}`;
            if (triggeredVoiceReminderKeysRef.current.has(voiceKey)) return;

            triggeredVoiceReminderKeysRef.current.add(voiceKey);

            const reminderInfo: KbmReminderInfo = {
              teacherName: slot.teacherName || currentTeacher?.name || 'Bapak/Ibu Guru',
              subject: slot.subject,
              className: slot.className,
              room: slot.room,
              periodNumber: slot.periodNumber,
              startTime: period.startTime,
              endTime: period.endTime,
              slotId: slot.id
            };

            // Play Chime + Female AI Speech: "Anda Memiliki Jam Mengajar Saat ini, Selamat Menjalankan Tugas. Terima Kasih "
            playTeacherKbmVoiceReminder(
              reminderInfo,
              "Anda Memiliki Jam Mengajar Saat ini, Selamat Menjalankan Tugas. Terima Kasih "
            );

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
    currentTeacher,
    schoolProfile.activeDays,
    schoolProfile.holidays,
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

  // Add Attendance Record (from scanner or manual)
  const handleAddAttendance = (record: AttendanceRecord, waLog?: WhatsAppLog) => {
    setAttendanceRecordsState(prev => {
      const updated = [record, ...prev.filter(r => !(r.studentId === record.studentId && r.date === record.date))];
      saveAttendanceRecords(updated);
      return updated;
    });

    if (waLog) {
      setWaLogsState(prevWa => {
        const updatedWa = [waLog, ...prevWa.filter(l => l.id !== waLog.id)];
        saveWaLogs(updatedWa);
        return updatedWa;
      });
    }
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
    const updated = attendanceRecords.map(r => {
      const isMatch = r.id === recordId || (fullRecord && r.studentId === fullRecord.studentId && r.date === fullRecord.date);
      if (isMatch) {
        exists = true;
        return { 
          ...r, 
          status: newStatus, 
          notes: notes !== undefined ? notes : r.notes,
          returnTime: returnTime !== undefined ? (returnTime || undefined) : r.returnTime,
          returnStatus: returnTime !== undefined ? (returnTime ? (returnStatus || 'PULANG') : undefined) : r.returnStatus
        };
      }
      return r;
    });

    if (!exists && fullRecord) {
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
  };

  // Student CRUD
  const handleAddStudent = (newStudent: Student) => {
    setStudentsState(prev => {
      const updated = [newStudent, ...prev];
      saveStudents(updated, true);
      return updated;
    });
  };

  const handleBatchAddStudents = (newStudents: Student[], newClasses?: SchoolClass[]) => {
    setStudentsState(prev => {
      const updated = [...newStudents, ...prev];
      saveStudents(updated, true);
      return updated;
    });

    if (newClasses && newClasses.length > 0) {
      setClassesState(prevClasses => {
        const existingNames = new Set(prevClasses.map(c => c.name.trim().toLowerCase()));
        const uniqueNew = newClasses.filter(c => !existingNames.has(c.name.trim().toLowerCase()));
        if (uniqueNew.length > 0) {
          const updatedClasses = [...prevClasses, ...uniqueNew];
          saveSchoolClasses(updatedClasses);
          return updatedClasses;
        }
        return prevClasses;
      });
    }
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    setStudentsState(prev => {
      const updated = prev.map(s => s.id === updatedStudent.id ? updatedStudent : s);
      saveStudents(updated, true);
      return updated;
    });
  };

  const handleDeleteStudent = (id: string) => {
    // Filter students
    setStudentsState(prev => {
      const updated = prev.filter(s => s.id !== id);
      saveStudents(updated, true);
      return updated;
    });

    // Clean up related attendance records
    setAttendanceRecordsState(prev => {
      const updated = prev.filter(a => a.studentId !== id);
      saveAttendanceRecords(updated);
      return updated;
    });

    // Clean up related leave requests
    setLeaveRequestsState(prev => {
      const updated = prev.filter(l => l.studentId !== id);
      saveLeaveRequests(updated);
      return updated;
    });

    // Clean up related character logs
    setCharacterLogsState(prev => {
      const updated = prev.filter(l => l.studentId !== id);
      saveStudentCharacterLogs(updated);
      return updated;
    });
  };

  const handleBatchDeleteStudents = (ids: string[]) => {
    const idSet = new Set(ids);
    setStudentsState(prev => {
      const updated = prev.filter(s => !idSet.has(s.id));
      saveStudents(updated, true);
      return updated;
    });

    setAttendanceRecordsState(prev => {
      const updated = prev.filter(a => !idSet.has(a.studentId));
      saveAttendanceRecords(updated);
      return updated;
    });

    setLeaveRequestsState(prev => {
      const updated = prev.filter(l => !idSet.has(l.studentId));
      saveLeaveRequests(updated);
      return updated;
    });

    setCharacterLogsState(prev => {
      const updated = prev.filter(l => !idSet.has(l.studentId));
      saveStudentCharacterLogs(updated);
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
    saveTeachers(updatedTeachers);
    saveSchoolClasses(updatedClasses);
  };

  const handleBatchResetTeachersPassword = () => {
    setTeachersState(prev => {
      const updated = prev.map(t => ({ ...t, password: '123456' }));
      saveTeachers(updated);
      return updated;
    });
  };

  const handleBatchResetStudentsPassword = () => {
    setStudentsState(prev => {
      const updated = prev.map(s => ({ ...s, password: '123456' }));
      saveStudents(updated);
      return updated;
    });
  };

  const handleDeleteTeacher = (id: string) => {
    const updated = teachers.filter(t => t.id !== id);
    const { updatedTeachers, updatedClasses } = reconcileTeachersAndClasses(updated, classes);
    setTeachersState(updatedTeachers);
    setClassesState(updatedClasses);
    saveTeachers(updatedTeachers);
    saveSchoolClasses(updatedClasses);
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'scanner' && (
            <QRScannerView
              students={students}
              classes={classes}
              schoolProfile={schoolProfile}
              attendanceRecords={attendanceRecords}
              onAddAttendance={handleAddAttendance}
            />
          )}

          {activeTab === 'dashboard' && (
            <AttendanceDashboard
              students={students}
              classes={classes}
              attendanceRecords={attendanceRecords}
              onUpdateStatus={handleUpdateAttendanceStatus}
              currentRole={currentRole}
              selectedChildId={effectiveChildId}
              learningJournals={journals}
              traits={traits}
              characterLogs={characterLogs}
              predicateSettings={predicateSettings}
              userSession={userSession}
            />
          )}

          {activeTab === 'teacher_assistant' && (
            <TeacherAssistantView
              schoolProfile={schoolProfile}
              userSession={userSession}
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

          {activeTab === 'chat' && (
            <ParentChatView
              students={students}
              teachers={teachers}
              classes={classes}
              selectedChildId={effectiveChildId}
              schoolProfile={schoolProfile}
              userRole={currentRole}
              userSession={userSession}
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
              predicateSettings={predicateSettings}
              onAddTrait={handleAddTrait}
              onUpdateTrait={handleUpdateTrait}
              onDeleteTrait={handleDeleteTrait}
              onSavePredicateSettings={handleSavePredicateSettings}
            />
          )}

          {activeTab === 'character_points' && (
            <CharacterPointsView
              students={students}
              classes={classes}
              traits={traits}
              logs={characterLogs}
              teachers={teachers}
              onAddLog={handleAddCharacterLog}
              onUpdateLog={handleUpdateCharacterLog}
              onDeleteLog={handleDeleteCharacterLog}
              currentUserRole={currentRole}
              schoolProfile={schoolProfile}
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

          {activeTab === 'walogs' && (
            <WhatsAppLogView waLogs={waLogs} />
          )}

          {activeTab === 'settings' && (
            <SchoolSettingsView
              schoolProfile={schoolProfile}
              onSaveProfile={handleSaveSchoolProfile}
              teachers={teachers}
              students={students}
              onUpdateTeacher={handleUpdateTeacher}
              onUpdateStudent={handleUpdateStudent}
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

    </div>
  );
}
