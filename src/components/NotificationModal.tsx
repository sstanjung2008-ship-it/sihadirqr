import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  MessageSquare, 
  AlertCircle, 
  BookOpen, 
  Award, 
  UserCheck, 
  ChevronRight, 
  CheckCheck,
  Sparkles,
  Inbox,
  Volume2,
  HeartHandshake,
  GraduationCap
} from 'lucide-react';
import { 
  UserRole, 
  UserSession, 
  AttendanceRecord, 
  LeaveRequest, 
  LearningJournal, 
  StudentCharacterLog, 
  ClassScheduleSlot, 
  LessonPeriod,
  Student,
  SchoolClass
} from '../types';
import { 
  getAttendanceRecords, 
  getLeaveRequests, 
  getDirectChats, 
  getStudentCharacterLogs, 
  getLearningJournals, 
  getClassSchedules, 
  getLessonPeriods, 
  getStudents,
  getSchoolClasses,
  getTeachers
} from '../lib/storage';
import { playBkNotificationChime } from '../lib/kbmVoiceReminder';

export interface AppNotification {
  id: string;
  category: 'attendance' | 'leave' | 'chat' | 'journal' | 'character' | 'schedule' | 'bk' | 'wali_kelas';
  title: string;
  description: string;
  timestamp: string; // ISO or readable
  timeLabel: string;
  isUnread: boolean;
  targetTab: string;
  badgeColor: string;
  icon: 'attendance' | 'leave' | 'chat' | 'journal' | 'character' | 'schedule' | 'bk' | 'wali_kelas';
  studentId?: string;
  studentName?: string;
  characterLogId?: string;
}

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  userSession?: UserSession | null;
  onTabChange: (tab: string) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  userSession,
  onTabChange,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(() => {
    const storageKey = `sihadir_last_read_notif_${currentRole}_${userSession?.username || 'user'}`;
    const saved = localStorage.getItem(storageKey);
    return saved ? Number(saved) : 0;
  });

  // Check if current user is a Teacher with BK role (Tugas Tambahan BK / Guru BK)
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

  // Calculate notifications
  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const currentDayName = dayNames[new Date().getDay()];

    const students = getStudents();
    const attendanceRecords = getAttendanceRecords();
    const leaveRequests = getLeaveRequests();
    const directChats = getDirectChats();
    const journals = getLearningJournals();
    const characterLogs = getStudentCharacterLogs();
    const schedules = getClassSchedules();
    const periods = getLessonPeriods();
    const classes = getSchoolClasses();

    if (currentRole === 'PARENT') {
      // 1. Identify student
      let student = students.find(s => s.id === userSession?.studentId || s.nisn === userSession?.nipOrNisn);
      if (!student && userSession?.displayName) {
        student = students.find(s => s.name.toLowerCase().includes(userSession.displayName.toLowerCase()) || 
                                     s.parentName?.toLowerCase().includes(userSession.displayName.toLowerCase()));
      }
      if (!student && students.length > 0) {
        student = students[0]; // fallback
      }

      if (student) {
        // A. Attendance Notification for Today
        const todayAtt = attendanceRecords.find(a => a.studentId === student!.id && a.date === todayStr);
        if (todayAtt) {
          const isLate = todayAtt.status === 'TERLAMBAT';
          list.push({
            id: `att-${todayAtt.id || todayStr}`,
            category: 'attendance',
            title: isLate ? 'Presensi Masuk (Terlambat)' : 'Presensi Masuk Terkonfirmasi',
            description: `${student.name} telah melakukan presensi masuk pukul ${todayAtt.time} WIB.${todayAtt.returnTime ? ` Presensi Pulang tercatat pukul ${todayAtt.returnTime} WIB.` : ' Belum presensi pulang.'}`,
            timestamp: todayAtt.time ? `${todayStr}T${todayAtt.time}` : todayStr,
            timeLabel: todayAtt.time ? `Hari ini • ${todayAtt.time}` : 'Hari ini',
            isUnread: false,
            targetTab: 'parent-history',
            badgeColor: isLate ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300',
            icon: 'attendance'
          });
        }

        // B. Leave Requests
        const studentLeaves = leaveRequests
          .filter(l => l.studentId === student!.id || l.studentName === student!.name)
          .sort((a, b) => new Date(b.createdAt || b.startDate).getTime() - new Date(a.createdAt || a.startDate).getTime());
        
        studentLeaves.slice(0, 3).forEach(l => {
          const statusText = l.status === 'APPROVED' ? 'Disetujui oleh Sekolah' : l.status === 'REJECTED' ? 'Ditolak' : 'Menunggu Konfirmasi Sekolah';
          const isApproved = l.status === 'APPROVED';
          const isPending = l.status === 'PENDING';
          list.push({
            id: `leave-${l.id}`,
            category: 'leave',
            title: `Pengajuan Izin (${l.type}): ${statusText}`,
            description: `Izin periode ${l.startDate} s/d ${l.endDate}. Alasan: "${l.reason}".${l.adminNotes ? ` Catatan: ${l.adminNotes}` : ''}`,
            timestamp: l.createdAt || l.startDate,
            timeLabel: l.startDate === todayStr ? 'Hari ini' : l.startDate,
            isUnread: false,
            targetTab: 'parent-leave',
            badgeColor: isApproved ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : isPending ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300',
            icon: 'leave'
          });
        });

        // C. Direct Chats from Teachers/Staff
        Object.entries(directChats).forEach(([threadKey, messages]) => {
          if (threadKey.includes(student!.id) || threadKey.includes(student!.nisn) || threadKey.includes('parent')) {
            const staffMsgs = messages.filter(m => m.senderRole === 'STAFF');
            if (staffMsgs.length > 0) {
              const latest = staffMsgs[staffMsgs.length - 1];
              list.push({
                id: `chat-${latest.id}`,
                category: 'chat',
                title: `Pesan dari ${latest.senderName || 'Wali Kelas'}`,
                description: latest.message,
                timestamp: latest.timestamp,
                timeLabel: latest.timestamp ? latest.timestamp.split('T')[0] : 'Baru saja',
                isUnread: false,
                targetTab: 'parent-chat',
                badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
                icon: 'chat'
              });
            }
          }
        });

        // D. Character Logs for Student
        const studentCharLogs = characterLogs
          .filter(c => c.studentId === student!.id || c.nisn === student!.nisn)
          .sort((a, b) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime());
        
        studentCharLogs.slice(0, 5).forEach(c => {
          const isPos = c.traitType === 'POSITIF';
          list.push({
            id: `char-${c.id}`,
            category: 'character',
            studentId: c.studentId,
            studentName: c.studentName,
            characterLogId: c.id,
            title: isPos ? `Apresiasi Karakter (+${c.points} Poin)` : `Catatan Disiplin (${c.points} Poin)`,
            description: `${c.traitName}: ${c.notes || 'Dicatat oleh ' + c.evaluatorName}`,
            timestamp: c.timestamp || c.date,
            timeLabel: c.date === todayStr ? 'Hari ini' : c.date,
            isUnread: false,
            targetTab: 'dashboard',
            badgeColor: isPos ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300',
            icon: 'character'
          });
        });

        // E. Learning Journals for Student's Class Today
        const classJournals = journals
          .filter(j => (j.classId === student!.classId || j.className === student!.className) && j.date === todayStr)
          .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        
        classJournals.slice(0, 3).forEach(j => {
          list.push({
            id: `journal-${j.id}`,
            category: 'journal',
            title: `Materi Pelajaran: ${j.subject}`,
            description: `Guru: ${j.teacherName} • Materi: "${j.material}". ${j.notesOrTask ? `Tugas: ${j.notesOrTask}` : ''}`,
            timestamp: j.createdAt || j.date,
            timeLabel: 'Hari ini',
            isUnread: false,
            targetTab: 'parent-journal',
            badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
            icon: 'journal'
          });
        });
      }
    } else {
      // TEACHER & ADMIN ROLES
      const teacherName = userSession?.displayName || 'Guru';
      const homeroomClass = homeroomClasses.length > 0 ? homeroomClasses[0] : classes.find(c => c.homeroomTeacher?.toLowerCase() === teacherName.toLowerCase());

      // A. Special Section: For Guru with Tugas Tambahan WALI KELAS
      // Notify homeroom teacher whenever a student in their managed class receives a character assessment from any teacher
      if (isHomeroomTeacher && homeroomClasses.length > 0) {
        const myClassCharLogs = characterLogs
          .filter(c => {
            const matchStudentId = c.studentId && homeroomStudentIds.has(c.studentId);
            const matchNisn = c.nisn && homeroomStudentIds.has(c.nisn);
            const matchName = c.studentName && homeroomStudentNames.has(c.studentName.trim().toLowerCase());
            const matchClassName = homeroomClasses.some(hc => 
              hc.name.trim().toLowerCase() === c.className?.trim().toLowerCase() || 
              hc.id === c.classId || 
              hc.name.trim().toLowerCase() === c.classId?.trim().toLowerCase()
            );
            return matchStudentId || matchNisn || matchName || matchClassName;
          })
          .sort((a, b) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime());

        myClassCharLogs.slice(0, 12).forEach(c => {
          const isPos = c.traitType === 'POSITIF';
          list.push({
            id: `wali-char-${c.id}`,
            category: 'wali_kelas',
            studentId: c.studentId,
            studentName: c.studentName,
            characterLogId: c.id,
            title: `[Wali Kelas - ${c.className}] Penilaian Karakter: ${c.studentName}`,
            description: `${isPos ? '⭐ Apresiasi Karakter (+' + c.points + ' Poin)' : '⚠️ Catatan Disiplin/Pelanggaran (' + c.points + ' Poin)'} - "${c.traitName}". Penilai: ${c.evaluatorName}.${c.notes ? ` Catatan: "${c.notes}"` : ''}`,
            timestamp: c.timestamp || c.date,
            timeLabel: c.date === todayStr ? 'Hari ini' : c.date,
            isUnread: false,
            targetTab: 'character_points',
            badgeColor: isPos ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' : 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
            icon: 'wali_kelas'
          });
        });
      }

      // B. Special Section: For Guru with Tugas Tambahan BK (Bimbingan Konseling)
      if (isTeacherBk) {
        const sortedCharLogs = [...characterLogs].sort((a, b) => 
          new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime()
        );

        sortedCharLogs.slice(0, 10).forEach(c => {
          const isPos = c.traitType === 'POSITIF';
          const needsFollowUp = !isPos && !c.followUpDate;
          list.push({
            id: `bk-char-${c.id}`,
            category: 'bk',
            studentId: c.studentId,
            studentName: c.studentName,
            characterLogId: c.id,
            title: `[Tugas BK] Penilaian Karakter: ${c.studentName} (${c.className})`,
            description: `${isPos ? '⭐ Apresiasi Karakter (+' + c.points + ' Poin)' : '⚠️ Catatan Disiplin/Pelanggaran (' + c.points + ' Poin)'} - "${c.traitName}". Penilai: ${c.evaluatorName}.${c.notes ? ` Catatan: "${c.notes}"` : ''}${needsFollowUp ? ' • [Perlu Tindak Lanjut Konseling BK]' : c.followUpDate ? ' • [Sudah Ditindaklanjuti]' : ''}`,
            timestamp: c.timestamp || c.date,
            timeLabel: c.date === todayStr ? 'Hari ini' : c.date,
            isUnread: false,
            targetTab: 'character_points',
            badgeColor: isPos ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' : 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
            icon: 'bk'
          });
        });
      }

      // C. Pending Leave Requests from Students
      const pendingLeaves = leaveRequests.filter(l => {
        if (l.status !== 'PENDING') return false;
        if (homeroomClass && currentRole === 'TEACHER') return l.className === homeroomClass.name || l.className === homeroomClass.id;
        return true;
      });

      pendingLeaves.slice(0, 4).forEach(l => {
        list.push({
          id: `leave-${l.id}`,
          category: 'leave',
          title: `Pengajuan Izin Siswa (${l.className})`,
          description: `${l.studentName} mengajukan izin ${l.type} (${l.startDate} s/d ${l.endDate}): "${l.reason}"`,
          timestamp: l.createdAt || l.startDate,
          timeLabel: l.startDate === todayStr ? 'Hari ini' : l.startDate,
          isUnread: false,
          targetTab: 'leaves',
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: 'leave'
        });
      });

      // D. Incoming Parent Consultation Messages
      Object.entries(directChats).forEach(([threadKey, messages]) => {
        const parentMsgs = messages.filter(m => m.senderRole === 'PARENT');
        if (parentMsgs.length > 0) {
          const latest = parentMsgs[parentMsgs.length - 1];
          list.push({
            id: `chat-${latest.id}`,
            category: 'chat',
            title: `Konsultasi dari ${latest.senderName || 'Wali Murid'}`,
            description: latest.message,
            timestamp: latest.timestamp,
            timeLabel: latest.timestamp ? latest.timestamp.split('T')[0] : 'Baru saja',
            isUnread: false,
            targetTab: 'parent-chat',
            badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
            icon: 'chat'
          });
        }
      });

      // E. Today's Teaching Schedule Reminders (Teacher only)
      if (currentRole === 'TEACHER') {
        const mySchedulesToday = schedules.filter(s => {
          const matchDay = (s.day?.toLowerCase() === currentDayName.toLowerCase()) || (s.day?.toUpperCase() === 'SEMUA');
          const matchTeacher = s.teacherName?.toLowerCase() === teacherName.toLowerCase() || s.teacherId === userSession?.teacherId;
          return matchDay && matchTeacher;
        });

        if (mySchedulesToday.length > 0) {
          list.push({
            id: `sched-${currentDayName}-${todayStr}`,
            category: 'schedule',
            title: `Jadwal Mengajar Hari Ini (${currentDayName})`,
            description: `Anda memiliki ${mySchedulesToday.length} sesi mengajar hari ini: ${mySchedulesToday.map(s => `${s.className} (${s.subject})`).join(', ')}.`,
            timestamp: todayStr,
            timeLabel: 'Hari ini',
            isUnread: false,
            targetTab: 'journal',
            badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
            icon: 'schedule'
          });
        }
      }

      // F. If not BK teacher and not homeroom teacher, show general recent character logs in school
      if (!isTeacherBk && !isHomeroomTeacher) {
        const recentLogs = characterLogs
          .sort((a, b) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime())
          .slice(0, 5);

        recentLogs.forEach(c => {
          list.push({
            id: `char-${c.id}`,
            category: 'character',
            studentId: c.studentId,
            studentName: c.studentName,
            characterLogId: c.id,
            title: `Catatan Karakter Siswa: ${c.studentName} (${c.className})`,
            description: `${c.traitName} (${c.traitType === 'POSITIF' ? '+' : ''}${c.points} Poin) oleh ${c.evaluatorName}`,
            timestamp: c.timestamp || c.date,
            timeLabel: c.date === todayStr ? 'Hari ini' : c.date,
            isUnread: false,
            targetTab: 'character_points',
            badgeColor: c.traitType === 'POSITIF' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300',
            icon: 'character'
          });
        });
      }
    }

    // Sort by timestamp descending
    list.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeB - timeA;
    });

    // Mark isUnread if created after lastReadTimestamp
    return list.map(item => {
      const itemTime = new Date(item.timestamp).getTime() || 0;
      const isUnread = lastReadTimestamp === 0 || itemTime > lastReadTimestamp;
      return { ...item, isUnread };
    });
  }, [currentRole, userSession, lastReadTimestamp, isTeacherBk, isHomeroomTeacher, homeroomClasses, homeroomStudentIds, homeroomStudentNames]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => n.isUnread).length;
  }, [notifications]);

  // When modal is opened and user is Guru BK / Wali Kelas with unread character logs, play sound chime automatically once
  useEffect(() => {
    if (isOpen && (isTeacherBk || isHomeroomTeacher)) {
      const hasUnread = notifications.some(n => (n.category === 'bk' || n.category === 'wali_kelas') && n.isUnread);
      if (hasUnread) {
        playBkNotificationChime();
      }
    }
  }, [isOpen, isTeacherBk, isHomeroomTeacher, notifications]);

  const handleMarkAllRead = () => {
    const now = Date.now();
    setLastReadTimestamp(now);
    const storageKey = `sihadir_last_read_notif_${currentRole}_${userSession?.username || 'user'}`;
    localStorage.setItem(storageKey, String(now));
  };

  const handleNotificationClick = (notif: AppNotification) => {
    if (notif.category === 'bk' || notif.category === 'wali_kelas') {
      playBkNotificationChime();
    }

    // Change tab
    onTabChange(notif.targetTab);

    // Deep-link character detail if this is a character / BK / Wali Kelas notification
    if (notif.studentId || notif.studentName || notif.characterLogId) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('sihadir_open_character_detail', {
          detail: {
            studentId: notif.studentId,
            studentName: notif.studentName,
            characterLogId: notif.characterLogId,
            category: notif.category
          }
        }));
      }, 50);
    }

    onClose();
  };

  const handlePlayBkSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    playBkNotificationChime();
  };

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'ALL') return notifications;
    if (activeFilter === 'UNREAD') return notifications.filter(n => n.isUnread);
    return notifications.filter(n => n.category.toUpperCase() === activeFilter);
  }, [notifications, activeFilter]);

  if (!isOpen) return null;

  const renderIcon = (type: AppNotification['icon']) => {
    switch (type) {
      case 'wali_kelas':
        return <GraduationCap className="w-5 h-5 text-indigo-600" />;
      case 'bk':
        return <HeartHandshake className="w-5 h-5 text-rose-600" />;
      case 'attendance':
        return <UserCheck className="w-5 h-5 text-emerald-600" />;
      case 'leave':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'chat':
        return <MessageSquare className="w-5 h-5 text-indigo-600" />;
      case 'journal':
        return <BookOpen className="w-5 h-5 text-sky-600" />;
      case 'character':
        return <Award className="w-5 h-5 text-rose-600" />;
      case 'schedule':
        return <Calendar className="w-5 h-5 text-purple-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="relative p-2 rounded-2xl bg-transparent border border-yellow-400/50 flex items-center justify-center">
              <Bell className="w-6 h-6 text-yellow-400 stroke-[2.5]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-xs animate-pulse">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-lg text-white leading-tight">
                  Pusat Notifikasi
                </h3>
                {isHomeroomTeacher && homeroomClasses.length > 0 && (
                  <span className="bg-indigo-400/20 text-indigo-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-indigo-400/30 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Wali Kelas ({homeroomClasses.map(c => c.name).join(', ')})
                  </span>
                )}
                {isTeacherBk && (
                  <span className="bg-amber-400/20 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-amber-400/30 flex items-center gap-1">
                    <HeartHandshake className="w-3 h-3" /> Tugas BK
                  </span>
                )}
                {unreadCount > 0 && (
                  <span className="bg-rose-500/20 text-rose-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-rose-400/30">
                    {unreadCount} Baru
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentRole === 'PARENT' 
                  ? 'Notifikasi Aktivitas Anak & Sekolah' 
                  : isHomeroomTeacher
                    ? 'Pemberitahuan Nilai Karakter Siswa Kelas Binaan & KBM'
                    : isTeacherBk 
                      ? 'Pemberitahuan Penilaian Karakter Siswa & BK' 
                      : 'Pemberitahuan KBM & Permohonan Izin'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Play Sound Chime Test button */}
            <button
              type="button"
              onClick={handlePlayBkSound}
              className="flex items-center gap-1 text-[11px] font-bold text-yellow-300 hover:text-white bg-yellow-400/10 hover:bg-yellow-400/20 px-2.5 py-1.5 rounded-xl border border-yellow-400/30 transition-all cursor-pointer"
              title="Dengarkan / Uji Suara Nada Notifikasi"
            >
              <Volume2 className="w-3.5 h-3.5 text-yellow-400" />
              <span className="hidden sm:inline">Tes Nada</span>
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-xl border border-white/15 transition-all cursor-pointer"
                title="Tandai semua telah dibaca"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Baca Semua</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Semua ({notifications.length})
            </button>

            {isHomeroomTeacher && (
              <button
                type="button"
                onClick={() => setActiveFilter('WALI_KELAS')}
                className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  activeFilter === 'WALI_KELAS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                <GraduationCap className="w-3 h-3" />
                Wali Kelas ({notifications.filter(n => n.category === 'wali_kelas').length})
              </button>
            )}

            {isTeacherBk && (
              <button
                type="button"
                onClick={() => setActiveFilter('BK')}
                className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  activeFilter === 'BK'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                <HeartHandshake className="w-3 h-3" />
                Tugas BK ({notifications.filter(n => n.category === 'bk').length})
              </button>
            )}

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilter('UNREAD')}
                className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeFilter === 'UNREAD'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                Belum Dibaca ({unreadCount})
              </button>
            )}

            {currentRole === 'PARENT' && (
              <button
                type="button"
                onClick={() => setActiveFilter('ATTENDANCE')}
                className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeFilter === 'ATTENDANCE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Presensi
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveFilter('LEAVE')}
              className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'LEAVE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Izin
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('CHAT')}
              className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === 'CHAT'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Pesan
            </button>
          </div>

          {/* Mobile Read All button */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="sm:hidden text-[11px] font-bold text-indigo-700 hover:underline shrink-0 whitespace-nowrap"
            >
              Baca Semua
            </button>
          )}
        </div>

        {/* Notification List Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-500 flex items-center justify-center mx-auto shadow-inner">
                <Inbox className="w-8 h-8 opacity-80" />
              </div>
              <h4 className="font-bold text-slate-800 text-base">Tidak Ada Notifikasi</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {isHomeroomTeacher
                  ? 'Setiap penilaian karakter siswa di kelas binaan Anda yang dicatat oleh guru lain akan otomatis muncul dan membunyikan nada notifikasi di sini.'
                  : isTeacherBk 
                    ? 'Setiap penilaian karakter atau pelanggaran siswa yang dicatat oleh guru akan otomatis muncul dan membunyikan nada notifikasi di sini.' 
                    : 'Semua pembaruan dan informasi terkini dari aktivitas sekolah akan otomatis muncul di sini.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`pt-3 first:pt-0 group cursor-pointer transition-all duration-150 ${
                  notif.isUnread ? 'opacity-100' : 'opacity-85 hover:opacity-100'
                }`}
              >
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  notif.isUnread 
                    ? 'bg-indigo-50/70 border-indigo-200 shadow-xs hover:border-indigo-300' 
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-white border border-slate-100 shadow-2xs shrink-0 mt-0.5">
                      {renderIcon(notif.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border truncate ${notif.badgeColor}`}>
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {notif.timeLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                        {notif.description}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/80">
                        <span className="text-[10px] text-indigo-600 font-bold group-hover:underline flex items-center gap-0.5">
                          Buka Halaman Terkait
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                        {notif.isUnread && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px] font-medium text-slate-500">
            Total {notifications.length} pemberitahuan
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
