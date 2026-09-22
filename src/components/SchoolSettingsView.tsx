import React, { useState, useEffect, useMemo } from 'react';
import { SchoolProfile, Teacher, Student, SchoolHoliday } from '../types';
import { Settings, Save, School, Clock, RotateCcw, CreditCard, CheckCircle2, Upload, Image as ImageIcon, Link, BookOpen, Plus, X, KeyRound, Key, Lock, Eye, EyeOff, User, GraduationCap, Search, Check, RefreshCw, Users, ShieldAlert, ShieldCheck, AlertCircle, Calendar, Trash2, Edit3, Tag, Flag, AlertTriangle, Sparkles, Filter, Cloud, CloudDownload, CloudUpload, FileJson, Download, Volume2, VolumeX, Mic, Headphones, BellRing, UserCheck, Smile, UserX, Play, Square, MessageSquare, Flame, CalendarCheck2, Layers, Wrench } from 'lucide-react';
import { resetToDefaultData, forceUploadAllToCloud, forceDownloadAllFromCloud, getCloudSyncStatus, CloudSyncStatus, downloadDatabaseBackupFile, getLocalDateString } from '../lib/storage';
import { 
  DEFAULT_TEACHER_SPEECH_TEMPLATE,
  DEFAULT_PARENT_ARRIVAL_MESSAGE,
  DEFAULT_PARENT_LATE_MESSAGE,
  DEFAULT_PARENT_DEPARTURE_MESSAGE,
  DEFAULT_PARENT_ABSENT_MESSAGE,
  DEFAULT_PARENT_VOICE_ARRIVAL,
  DEFAULT_PARENT_VOICE_LATE,
  DEFAULT_PARENT_VOICE_DEPARTURE,
  DEFAULT_PARENT_VOICE_ABSENT,
  testKbmVoiceReminder,
  testParentVoiceNotification,
  playTeacherKbmVoiceReminder,
  playParentVoiceNotification,
  isKbmVoiceReminderEnabled,
  setKbmVoiceReminderEnabled,
  isParentVoiceEnabled,
  setParentVoiceEnabled,
  generateKbmSpeechText,
  generateParentNotificationContent,
  ParentAttendanceType
} from '../lib/kbmVoiceReminder';
import { MultiDeviceSyncModal } from './MultiDeviceSyncModal';

interface SchoolSettingsViewProps {
  schoolProfile: SchoolProfile;
  onSaveProfile: (profile: SchoolProfile) => void;
  teachers?: Teacher[];
  students?: Student[];
  onUpdateTeacher?: (teacher: Teacher) => void;
  onUpdateStudent?: (student: Student) => void;
  onBatchResetTeachersPassword?: () => void;
  onBatchResetStudentsPassword?: () => void;
}

export const SchoolSettingsView: React.FC<SchoolSettingsViewProps> = ({
  schoolProfile,
  onSaveProfile,
  teachers = [],
  students = [],
  onUpdateTeacher,
  onUpdateStudent,
  onBatchResetTeachersPassword,
  onBatchResetStudentsPassword,
}) => {
  const [formData, setFormData] = useState<SchoolProfile>({ ...schoolProfile });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmBatchTeacherModal, setConfirmBatchTeacherModal] = useState(false);
  const [confirmBatchStudentModal, setConfirmBatchStudentModal] = useState(false);

  // Teachers sorted alphabetically ascending by name (A-Z)
  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' }));
  }, [teachers]);

  // Cloud Database Sync State
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>(() => getCloudSyncStatus());
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudSyncFeedback, setCloudSyncFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showMultiSyncModal, setShowMultiSyncModal] = useState(false);

  // Top Section Navigation State
  const [activeNavTab, setActiveNavTab] = useState<string>('profil');

  const navItems = [
    { id: 'section-profil-sekolah', key: 'profil', label: 'Profil Sekolah', icon: School, color: 'text-indigo-600', activeBg: 'bg-indigo-600 text-white shadow-indigo-100' },
    { id: 'section-jam-libur', key: 'jam-libur', label: 'Jam Masuk & Libur', icon: Clock, color: 'text-amber-600', activeBg: 'bg-amber-600 text-white shadow-amber-100' },
    { id: 'section-akademik', key: 'akademik', label: 'Akademik & Mapel', icon: GraduationCap, color: 'text-blue-600', activeBg: 'bg-blue-600 text-white shadow-blue-100' },
    { id: 'section-suara-ai', key: 'suara-ai', label: 'Suara AI & Notifikasi', icon: Volume2, color: 'text-violet-600', activeBg: 'bg-violet-600 text-white shadow-violet-100' },
    { id: 'section-password', key: 'password', label: 'Pengaturan & Reset Password', icon: KeyRound, color: 'text-purple-600', activeBg: 'bg-purple-600 text-white shadow-purple-100' },
    { id: 'section-database', key: 'database', label: 'Database & Sinkronisasi', icon: Cloud, color: 'text-sky-600', activeBg: 'bg-sky-600 text-white shadow-sky-100' },
  ];

  const handleJumpToSection = (sectionId: string, key: string) => {
    setActiveNavTab(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setFormData({ ...schoolProfile });
  }, [schoolProfile]);

  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e.detail?.status) {
        setCloudStatus(e.detail.status);
      }
    };
    window.addEventListener('sihadir_cloud_status_changed', handleStatus);
    return () => window.removeEventListener('sihadir_cloud_status_changed', handleStatus);
  }, []);

  const handleManualUploadToCloud = async () => {
    setIsCloudSyncing(true);
    setCloudSyncFeedback(null);
    const res = await forceUploadAllToCloud();
    setIsCloudSyncing(false);
    if (res.success) {
      setCloudSyncFeedback({
        type: 'success',
        msg: 'Berhasil mengunggah dan menyinkronkan seluruh data lokal (siswa, guru, kelas, presensi) ke Cloud Firestore!',
      });
    } else {
      setCloudSyncFeedback({
        type: 'error',
        msg: `Gagal sinkronisasi ke Cloud: ${res.error || 'Periksa koneksi internet Anda.'}`,
      });
    }
  };

  const handleManualDownloadFromCloud = async () => {
    setIsCloudSyncing(true);
    setCloudSyncFeedback(null);
    const res = await forceDownloadAllFromCloud();
    setIsCloudSyncing(false);
    if (res.success) {
      setCloudSyncFeedback({
        type: 'success',
        msg: 'Berhasil mengunduh dan memperbarui data terbaru dari Cloud Firestore ke perangkat ini!',
      });
    } else {
      setCloudSyncFeedback({
        type: 'error',
        msg: `Gagal mengunduh dari Cloud: ${res.error || 'Periksa koneksi internet Anda.'}`,
      });
    }
  };

  const [showSchoolLogoUrlInput, setShowSchoolLogoUrlInput] = useState(false);
  const [showRegencyLogoUrlInput, setShowRegencyLogoUrlInput] = useState(false);
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [subjectSavedNotice, setSubjectSavedNotice] = useState<string | null>(null);

  // ==========================================
  // FITUR SUARA AI & NOTIFIKASI PERAN (GURU & ORANG TUA)
  // ==========================================

  // Toast / Feedback Notice saat Template di-Reset
  const [templateResetToast, setTemplateResetToast] = useState<string | null>(null);

  // Uji Coba Suara AI Pengingat Jadwal KBM Guru
  const [selectedTestTeacherId, setSelectedTestTeacherId] = useState<string>('');
  const [isTestingTeacherVoice, setIsTestingTeacherVoice] = useState<boolean>(false);
  const [testTeacherVoicePlayingText, setTestTeacherVoicePlayingText] = useState<string | null>(null);

  const handleTestTeacherVoice = async () => {
    const teacher = sortedTeachers.find(t => t.id === selectedTestTeacherId) || sortedTeachers[0];
    if (!teacher) {
      setTemplateResetToast('Belum ada data guru yang terdaftar di sistem untuk diuji coba.');
      setTimeout(() => setTemplateResetToast(null), 3500);
      return;
    }

    setIsTestingTeacherVoice(true);
    const template = formData.aiVoiceTemplateTeacherReminder || formData.waTemplateTeacherReminder || DEFAULT_TEACHER_SPEECH_TEMPLATE;
    const info = {
      teacherName: teacher.name,
      subject: teacher.subject1 || 'Mata Pelajaran',
      className: teacher.homeroomClassName || 'Kelas 7A',
      room: 'Ruang Kelas',
      periodNumber: 1,
      jpCount: 2,
      startTime: formData.startTime || '07:30',
      endTime: '09:00'
    };
    
    const speechText = generateKbmSpeechText(info, template, formData.name);
    setTestTeacherVoicePlayingText(speechText);

    try {
      await testKbmVoiceReminder(template, info);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTestingTeacherVoice(false);
    }
  };

  const handleResetTeacherVoiceTemplate = () => {
    setFormData(prev => ({
      ...prev,
      aiVoiceTemplateTeacherReminder: DEFAULT_TEACHER_SPEECH_TEMPLATE,
      waTemplateTeacherReminder: DEFAULT_TEACHER_SPEECH_TEMPLATE
    }));
    setTemplateResetToast('Format Suara AI & Pengingat Jadwal Guru berhasil dikembalikan ke format awal.');
    setTimeout(() => setTemplateResetToast(null), 3500);
  };

  // Uji Coba & Manajemen Suara AI / Notifikasi Orang Tua
  const [selectedTestStudentId, setSelectedTestStudentId] = useState<string>('');
  const [selectedTestParentType, setSelectedTestParentType] = useState<ParentAttendanceType>('ARRIVAL');
  const [isTestingParentVoice, setIsTestingParentVoice] = useState<boolean>(false);
  const [activeSingleTestingKey, setActiveSingleTestingKey] = useState<string | null>(null);
  const [testParentVoicePlayingText, setTestParentVoicePlayingText] = useState<string | null>(null);

  const handleTestParentVoice = async (type: ParentAttendanceType, studentIdOverride?: string) => {
    const student = students.find(s => s.id === (studentIdOverride || selectedTestStudentId)) || students[0];
    
    // Waktu dinamis per kondisi presensi (Untuk ABSENT diambil dari Waktu Batas Otomatis Alpa)
    const getNotificationTime = (t: ParentAttendanceType) => {
      if (t === 'ABSENT') return formData.autoAlpaTime || '08:30';
      if (t === 'DEPARTURE') return formData.endTime || '15:00';
      if (t === 'LATE') return formData.lateToleranceTime || formData.startTime || '07:35';
      return formData.startTime || '07:10';
    };

    const sampleStudent = {
      name: student ? student.name : "Muhammad Rizky Pratama",
      className: student ? student.className : "7A",
      parentName: student?.parentName || "Bpk. Hendra Pratama",
      time: getNotificationTime(type)
    };

    setIsTestingParentVoice(true);
    setActiveSingleTestingKey(type);

    let customVoiceTemplate: string | undefined;
    if (type === 'ARRIVAL') customVoiceTemplate = formData.parentVoiceTemplateArrival || DEFAULT_PARENT_VOICE_ARRIVAL;
    else if (type === 'LATE') customVoiceTemplate = formData.parentVoiceTemplateLate || DEFAULT_PARENT_VOICE_LATE;
    else if (type === 'DEPARTURE') customVoiceTemplate = formData.parentVoiceTemplateDeparture || DEFAULT_PARENT_VOICE_DEPARTURE;
    else if (type === 'ABSENT') customVoiceTemplate = formData.parentVoiceTemplateAbsent || DEFAULT_PARENT_VOICE_ABSENT;

    const speechText = generateParentNotificationContent(type, {
      studentName: sampleStudent.name,
      className: sampleStudent.className,
      time: sampleStudent.time,
      parentName: sampleStudent.parentName,
      schoolName: formData.name
    }, { isVoice: true, customTemplate: customVoiceTemplate });

    setTestParentVoicePlayingText(speechText);

    try {
      await testParentVoiceNotification(type, sampleStudent, customVoiceTemplate);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTestingParentVoice(false);
      setActiveSingleTestingKey(null);
    }
  };

  const handleResetSingleParentTemplate = (type: ParentAttendanceType) => {
    if (type === 'ARRIVAL') {
      setFormData(prev => ({
        ...prev,
        parentTemplateArrival: DEFAULT_PARENT_ARRIVAL_MESSAGE,
        waTemplateArrival: DEFAULT_PARENT_ARRIVAL_MESSAGE,
        parentVoiceTemplateArrival: DEFAULT_PARENT_VOICE_ARRIVAL
      }));
      setTemplateResetToast('Format pesan & Suara AI Hadir Tepat Waktu berhasil di-reset ke format awal.');
    } else if (type === 'LATE') {
      setFormData(prev => ({
        ...prev,
        parentTemplateLate: DEFAULT_PARENT_LATE_MESSAGE,
        waTemplateLate: DEFAULT_PARENT_LATE_MESSAGE,
        parentVoiceTemplateLate: DEFAULT_PARENT_VOICE_LATE
      }));
      setTemplateResetToast('Format pesan & Suara AI Terlambat berhasil di-reset ke format awal.');
    } else if (type === 'DEPARTURE') {
      setFormData(prev => ({
        ...prev,
        parentTemplateDeparture: DEFAULT_PARENT_DEPARTURE_MESSAGE,
        waTemplateDeparture: DEFAULT_PARENT_DEPARTURE_MESSAGE,
        parentVoiceTemplateDeparture: DEFAULT_PARENT_VOICE_DEPARTURE
      }));
      setTemplateResetToast('Format pesan & Suara AI Pulang Sekolah berhasil di-reset ke format awal.');
    } else if (type === 'ABSENT') {
      setFormData(prev => ({
        ...prev,
        parentTemplateAbsent: DEFAULT_PARENT_ABSENT_MESSAGE,
        waTemplateAbsent: DEFAULT_PARENT_ABSENT_MESSAGE,
        parentVoiceTemplateAbsent: DEFAULT_PARENT_VOICE_ABSENT
      }));
      setTemplateResetToast('Format pesan & Suara AI Belum Absen / Alpa berhasil di-reset ke format awal.');
    }
    setTimeout(() => setTemplateResetToast(null), 3500);
  };

  const handleResetAllParentTemplates = () => {
    setFormData(prev => ({
      ...prev,
      parentTemplateArrival: DEFAULT_PARENT_ARRIVAL_MESSAGE,
      waTemplateArrival: DEFAULT_PARENT_ARRIVAL_MESSAGE,
      parentVoiceTemplateArrival: DEFAULT_PARENT_VOICE_ARRIVAL,
      parentTemplateLate: DEFAULT_PARENT_LATE_MESSAGE,
      waTemplateLate: DEFAULT_PARENT_LATE_MESSAGE,
      parentVoiceTemplateLate: DEFAULT_PARENT_VOICE_LATE,
      parentTemplateDeparture: DEFAULT_PARENT_DEPARTURE_MESSAGE,
      waTemplateDeparture: DEFAULT_PARENT_DEPARTURE_MESSAGE,
      parentVoiceTemplateDeparture: DEFAULT_PARENT_VOICE_DEPARTURE,
      parentTemplateAbsent: DEFAULT_PARENT_ABSENT_MESSAGE,
      waTemplateAbsent: DEFAULT_PARENT_ABSENT_MESSAGE,
      parentVoiceTemplateAbsent: DEFAULT_PARENT_VOICE_ABSENT
    }));
    setTemplateResetToast('Semua format pesan & Suara AI notifikasi orang tua berhasil dikembalikan ke format awal.');
    setTimeout(() => setTemplateResetToast(null), 3500);
  };

  // Hari Aktif Belajar State & Handlers
  const ALL_WEEK_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const currentActiveDays = formData.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  const toggleActiveDay = (day: string) => {
    if (currentActiveDays.includes(day)) {
      if (currentActiveDays.length <= 1) return; // minimal 1 hari aktif
      setFormData({
        ...formData,
        activeDays: currentActiveDays.filter(d => d !== day)
      });
    } else {
      setFormData({
        ...formData,
        activeDays: [...currentActiveDays, day]
      });
    }
  };

  const handleSelectDaysPreset = (preset: '5_DAYS' | '6_DAYS' | 'ALL') => {
    if (preset === '5_DAYS') {
      setFormData({ ...formData, activeDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] });
    } else if (preset === '6_DAYS') {
      setFormData({ ...formData, activeDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] });
    } else {
      setFormData({ ...formData, activeDays: ALL_WEEK_DAYS });
    }
  };

  // Pengaturan Jam Pulang Berbeda Tiap Hari (Berdasarkan Hari Aktif Belajar)
  const defaultDailyEndTimes: Record<string, string> = {
    'Senin': '15:00',
    'Selasa': '15:00',
    'Rabu': '15:00',
    'Kamis': '15:00',
    'Jumat': '11:30',
    'Sabtu': '13:00',
    'Minggu': '15:00',
  };

  const currentDailyEndTimes: Record<string, string> = {
    ...defaultDailyEndTimes,
    ...(formData.dailyEndTimes || {}),
  };

  const handleDailyEndTimeChange = (day: string, timeValue: string) => {
    const updated = {
      ...currentDailyEndTimes,
      [day]: timeValue,
    };
    setFormData(prev => ({
      ...prev,
      dailyEndTimes: updated,
      endTime: updated[currentActiveDays[0] || 'Senin'] || prev.endTime || '15:00',
    }));
  };

  const [bulkTimeInput, setBulkTimeInput] = useState<string>('15:00');

  const handleApplyTimeToAllActiveDays = (targetTime: string) => {
    const updated = { ...currentDailyEndTimes };
    currentActiveDays.forEach(day => {
      updated[day] = targetTime;
    });
    setFormData(prev => ({
      ...prev,
      dailyEndTimes: updated,
      endTime: targetTime,
    }));
  };

  const handleApplyDailyPreset = (presetType: 'STANDARD_5_DAYS' | 'STANDARD_6_DAYS' | 'FULL_DAY') => {
    const updated = { ...currentDailyEndTimes };
    if (presetType === 'STANDARD_5_DAYS') {
      ['Senin', 'Selasa', 'Rabu', 'Kamis'].forEach(d => { updated[d] = '15:00'; });
      updated['Jumat'] = '11:30';
      updated['Sabtu'] = '13:00';
    } else if (presetType === 'STANDARD_6_DAYS') {
      ['Senin', 'Selasa', 'Rabu', 'Kamis'].forEach(d => { updated[d] = '14:00'; });
      updated['Jumat'] = '11:30';
      updated['Sabtu'] = '13:00';
    } else if (presetType === 'FULL_DAY') {
      ALL_WEEK_DAYS.forEach(d => { updated[d] = '15:30'; });
    }
    setFormData(prev => ({
      ...prev,
      dailyEndTimes: updated,
      endTime: updated[currentActiveDays[0] || 'Senin'] || '15:00',
    }));
  };

  // Preset Libur Nasional Indonesia
  const INDONESIAN_NATIONAL_HOLIDAYS_PRESET: Omit<SchoolHoliday, 'id'>[] = [
    { name: 'Tahun Baru Masehi', date: '2026-01-01', type: 'NASIONAL', description: 'Tahun Baru Masehi 2026' },
    { name: "Isra Mi'raj Nabi Muhammad SAW", date: '2026-01-16', type: 'NASIONAL', description: 'Libur Nasional Keagamaan' },
    { name: 'Tahun Baru Imlek 2577 Kongzili', date: '2026-02-17', type: 'NASIONAL', description: 'Tahun Baru Imlek' },
    { name: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', date: '2026-03-20', type: 'NASIONAL', description: 'Hari Suci Nyepi' },
    { name: 'Hari Raya Idul Fitri 1447 H', date: '2026-03-21', endDate: '2026-03-23', type: 'NASIONAL', description: 'Libur Nasional & Cuti Bersama Idul Fitri' },
    { name: 'Hari Buruh Internasional', date: '2026-05-01', type: 'NASIONAL', description: 'Hari Buruh Internasional' },
    { name: 'Kenaikan Yesus Kristus', date: '2026-05-14', type: 'NASIONAL', description: 'Kenaikan Yesus Kristus' },
    { name: 'Hari Raya Waisak 2570 BE', date: '2026-05-31', type: 'NASIONAL', description: 'Hari Raya Waisak' },
    { name: 'Hari Lahir Pancasila', date: '2026-06-01', type: 'NASIONAL', description: 'Hari Lahir Pancasila' },
    { name: 'Hari Raya Idul Adha 1447 H', date: '2026-05-27', type: 'NASIONAL', description: 'Hari Raya Idul Adha' },
    { name: 'Tahun Baru Islam 1448 Hijriah', date: '2026-06-16', type: 'NASIONAL', description: 'Tahun Baru Islam 1 Muharram' },
    { name: 'Hari Kemerdekaan Republik Indonesia ke-81', date: '2026-08-17', type: 'NASIONAL', description: 'HUT Kemerdekaan RI ke-81' },
    { name: 'Maulid Nabi Muhammad SAW', date: '2026-08-25', type: 'NASIONAL', description: 'Maulid Nabi Muhammad SAW' },
    { name: 'Hari Raya Natal', date: '2026-12-25', type: 'NASIONAL', description: 'Hari Raya Natal' }
  ];

  // Holiday Management State & Handlers
  const currentHolidays = formData.holidays || [];
  const [holidayNameInput, setHolidayNameInput] = useState<string>('');
  const [holidayDateInput, setHolidayDateInput] = useState<string>(() => getLocalDateString());
  const [holidayEndDateInput, setHolidayEndDateInput] = useState<string>('');
  const [isMultiDayHoliday, setIsMultiDayHoliday] = useState<boolean>(false);
  const [holidayTypeInput, setHolidayTypeInput] = useState<'NASIONAL' | 'SEKOLAH' | 'CUTI_BERSAMA'>('NASIONAL');
  const [holidayDescInput, setHolidayDescInput] = useState<string>('');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);

  // Search & Filter for Holidays
  const [holidaySearchQuery, setHolidaySearchQuery] = useState<string>('');
  const [holidayFilterType, setHolidayFilterType] = useState<string>('ALL');
  const [holidayNotice, setHolidayNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleAddOrUpdateHoliday = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const effectiveName = holidayNameInput.trim() || 'Hari Libur Sekolah';
    const effectiveDate = holidayDateInput || getLocalDateString();

    if (isMultiDayHoliday && holidayEndDateInput && holidayEndDateInput < effectiveDate) {
      setHolidayNotice({ type: 'error', msg: 'Tanggal selesai libur tidak boleh lebih awal dari tanggal mulai!' });
      return;
    }

    if (editingHolidayId) {
      // Update existing holiday
      const updatedList = currentHolidays.map(h => {
        if (h.id === editingHolidayId) {
          return {
            ...h,
            name: effectiveName,
            date: effectiveDate,
            endDate: isMultiDayHoliday && holidayEndDateInput ? holidayEndDateInput : undefined,
            type: holidayTypeInput,
            description: holidayDescInput.trim() || undefined
          };
        }
        return h;
      });

      setFormData({ ...formData, holidays: updatedList });
      setEditingHolidayId(null);
      setHolidayNameInput('');
      setHolidayEndDateInput('');
      setIsMultiDayHoliday(false);
      setHolidayDescInput('');
      setHolidayNotice({ type: 'success', msg: `Hari libur "${effectiveName}" berhasil diperbarui!` });
    } else {
      // Add new holiday
      const newHoliday: SchoolHoliday = {
        id: `hol-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: effectiveName,
        date: effectiveDate,
        endDate: isMultiDayHoliday && holidayEndDateInput ? holidayEndDateInput : undefined,
        type: holidayTypeInput,
        description: holidayDescInput.trim() || undefined
      };

      setFormData({
        ...formData,
        holidays: [...currentHolidays, newHoliday]
      });

      setHolidayNameInput('');
      setHolidayEndDateInput('');
      setIsMultiDayHoliday(false);
      setHolidayDescInput('');
      setHolidayNotice({ type: 'success', msg: `Hari libur "${newHoliday.name}" berhasil ditambahkan ke kalender!` });
    }
  };

  const handleEditHoliday = (holiday: SchoolHoliday) => {
    setEditingHolidayId(holiday.id);
    setHolidayNameInput(holiday.name);
    setHolidayDateInput(holiday.date);
    if (holiday.endDate) {
      setIsMultiDayHoliday(true);
      setHolidayEndDateInput(holiday.endDate);
    } else {
      setIsMultiDayHoliday(false);
      setHolidayEndDateInput('');
    }
    setHolidayTypeInput(holiday.type || 'NASIONAL');
    setHolidayDescInput(holiday.description || '');
    setHolidayNotice(null);
  };

  const handleCancelEditHoliday = () => {
    setEditingHolidayId(null);
    setHolidayNameInput('');
    setHolidayEndDateInput('');
    setIsMultiDayHoliday(false);
    setHolidayDescInput('');
    setHolidayNotice(null);
  };

  const handleDeleteHoliday = (id: string, name: string) => {
    const updated = currentHolidays.filter(h => h.id !== id);
    setFormData({ ...formData, holidays: updated });
    if (editingHolidayId === id) {
      handleCancelEditHoliday();
    }
    setHolidayNotice({ type: 'success', msg: `Hari libur "${name}" berhasil dihapus dari kalender sekolah.` });
  };

  const handleLoadNationalHolidaysPreset = () => {
    const existingKeys = new Set(currentHolidays.map(h => `${h.date}_${h.name.toLowerCase()}`));
    const newItems: SchoolHoliday[] = [];

    INDONESIAN_NATIONAL_HOLIDAYS_PRESET.forEach((preset, idx) => {
      const key = `${preset.date}_${preset.name.toLowerCase()}`;
      if (!existingKeys.has(key)) {
        newItems.push({
          id: `hol-preset-${Date.now()}-${idx}`,
          ...preset
        });
      }
    });

    if (newItems.length === 0) {
      setHolidayNotice({ type: 'success', msg: 'Semua daftar hari libur nasional sudah ada dalam kalender sekolah!' });
      return;
    }

    setFormData({
      ...formData,
      holidays: [...currentHolidays, ...newItems]
    });
    setHolidayNotice({ type: 'success', msg: `Berhasil menambahkan ${newItems.length} hari libur nasional ke kalender sekolah!` });
  };

  const filteredHolidays = currentHolidays
    .filter(h => {
      const matchType = holidayFilterType === 'ALL' || h.type === holidayFilterType;
      const q = holidaySearchQuery.trim().toLowerCase();
      const matchQuery = !q || h.name.toLowerCase().includes(q) || (h.description && h.description.toLowerCase().includes(q)) || h.date.includes(q);
      return matchType && matchQuery;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Password Reset State
  const [passwordRoleTab, setPasswordRoleTab] = useState<'ADMIN_SCANNER' | 'TEACHER' | 'STUDENT'>('ADMIN_SCANNER');
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>(schoolProfile.adminPassword || 'admin123');
  const [scannerPasswordInput, setScannerPasswordInput] = useState<string>(schoolProfile.scannerPassword || '123456');
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [showScannerPassword, setShowScannerPassword] = useState<boolean>(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('123456');
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);
  const [studentClassFilter, setStudentClassFilter] = useState<string>('ALL');
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const [teacherSearchTerm, setTeacherSearchTerm] = useState<string>('');
  const [passwordResetNotice, setPasswordResetNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (schoolProfile.adminPassword) {
      setAdminPasswordInput(schoolProfile.adminPassword);
    }
    if (schoolProfile.scannerPassword) {
      setScannerPasswordInput(schoolProfile.scannerPassword);
    }
  }, [schoolProfile.adminPassword, schoolProfile.scannerPassword]);

  const handleSaveAdminPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = adminPasswordInput.trim();
    if (!trimmed) {
      setPasswordResetNotice({ type: 'error', msg: 'Password Admin tidak boleh kosong!' });
      return;
    }
    if (trimmed.length < 4) {
      setPasswordResetNotice({ type: 'error', msg: 'Password Admin minimal 4 karakter!' });
      return;
    }

    const updatedProfile = {
      ...formData,
      adminPassword: trimmed
    };
    setFormData(updatedProfile);
    onSaveProfile(updatedProfile);
    setPasswordResetNotice({
      type: 'success',
      msg: `Password Akun Admin berhasil disimpan dan disinkronkan ke Cloud: "${trimmed}".`
    });
    setTimeout(() => setPasswordResetNotice(null), 5000);
  };

  const handleSaveScannerPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = scannerPasswordInput.trim();
    if (!trimmed) {
      setPasswordResetNotice({ type: 'error', msg: 'Password Pos Scanner tidak boleh kosong!' });
      return;
    }

    const updatedProfile = {
      ...formData,
      scannerPassword: trimmed
    };
    setFormData(updatedProfile);
    onSaveProfile(updatedProfile);
    setPasswordResetNotice({
      type: 'success',
      msg: `Password Pos Scanner Satpam berhasil disimpan dan disinkronkan ke Cloud: "${trimmed}".`
    });
    setTimeout(() => setPasswordResetNotice(null), 5000);
  };

  const handleSelectTeacherForReset = (id: string) => {
    setSelectedTeacherId(id);
    const t = teachers.find(item => item.id === id);
    if (t) {
      setNewPasswordInput(t.password || '123456');
    }
  };

  const handleSelectStudentForReset = (id: string) => {
    setSelectedStudentId(id);
    const s = students.find(item => item.id === id);
    if (s) {
      setNewPasswordInput(s.password || '123456');
    }
  };

  const handleSaveTeacherPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTeacherId) {
      setPasswordResetNotice({ type: 'error', msg: 'Pilih Guru terlebih dahulu!' });
      return;
    }
    const t = teachers.find(item => item.id === selectedTeacherId);
    if (!t || !onUpdateTeacher) return;

    const trimmedPass = newPasswordInput.trim();
    if (!trimmedPass) {
      setPasswordResetNotice({ type: 'error', msg: 'Password tidak boleh kosong!' });
      return;
    }

    onUpdateTeacher({ ...t, password: trimmedPass });
    setPasswordResetNotice({
      type: 'success',
      msg: `Password akun Guru ${t.name} (NIP: ${t.nip}) berhasil diubah menjadi "${trimmedPass}".`
    });
    setTimeout(() => setPasswordResetNotice(null), 5000);
  };

  const handleSaveStudentPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedStudentId) {
      setPasswordResetNotice({ type: 'error', msg: 'Pilih Siswa terlebih dahulu!' });
      return;
    }
    const s = students.find(item => item.id === selectedStudentId);
    if (!s || !onUpdateStudent) return;

    const trimmedPass = newPasswordInput.trim();
    if (!trimmedPass) {
      setPasswordResetNotice({ type: 'error', msg: 'Password tidak boleh kosong!' });
      return;
    }

    onUpdateStudent({ ...s, password: trimmedPass });
    setPasswordResetNotice({
      type: 'success',
      msg: `Password akun Siswa ${s.name} (NISN: ${s.nisn}) berhasil diubah menjadi "${trimmedPass}".`
    });
    setTimeout(() => setPasswordResetNotice(null), 5000);
  };

  const handleBatchResetTeachers = () => {
    if (!teachers || teachers.length === 0) {
      setPasswordResetNotice({ type: 'error', msg: 'Data guru belum tersedia.' });
      return;
    }
    setConfirmBatchTeacherModal(true);
  };

  const executeBatchResetTeachers = () => {
    if (onBatchResetTeachersPassword) {
      onBatchResetTeachersPassword();
    } else if (onUpdateTeacher && teachers) {
      teachers.forEach(t => onUpdateTeacher({ ...t, password: '123456' }));
    }
    setConfirmBatchTeacherModal(false);
    setPasswordResetNotice({
      type: 'success',
      msg: `Berhasil mereset password SELURUH AKUN GURU (${teachers.length} orang) menjadi default "123456".`
    });
    setNewPasswordInput('123456');
    setTimeout(() => setPasswordResetNotice(null), 6000);
  };

  const handleBatchResetStudents = () => {
    if (!students || students.length === 0) {
      setPasswordResetNotice({ type: 'error', msg: 'Data siswa belum tersedia.' });
      return;
    }
    setConfirmBatchStudentModal(true);
  };

  const executeBatchResetStudents = () => {
    if (onBatchResetStudentsPassword) {
      onBatchResetStudentsPassword();
    } else if (onUpdateStudent && students) {
      students.forEach(s => onUpdateStudent({ ...s, password: '123456' }));
    }
    setConfirmBatchStudentModal(false);
    setPasswordResetNotice({
      type: 'success',
      msg: `Berhasil mereset password SELURUH AKUN SISWA (${students.length} orang) menjadi default "123456".`
    });
    setNewPasswordInput('123456');
    setTimeout(() => setPasswordResetNotice(null), 6000);
  };

  const handleQuickResetTeacher = (t: Teacher) => {
    if (!onUpdateTeacher) return;
    onUpdateTeacher({ ...t, password: '123456' });
    setPasswordResetNotice({
      type: 'success',
      msg: `Password akun Guru ${t.name} (NIP: ${t.nip}) berhasil direset kembali ke default: "123456".`
    });
    if (selectedTeacherId === t.id) {
      setNewPasswordInput('123456');
    }
    setTimeout(() => setPasswordResetNotice(null), 5000);
  };

  const handleQuickResetStudent = (s: Student) => {
    if (!onUpdateStudent) return;
    onUpdateStudent({ ...s, password: '123456' });
    setPasswordResetNotice({
      type: 'success',
      msg: `Password akun Siswa ${s.name} (${s.className} - NISN: ${s.nisn}) berhasil direset kembali ke default: "123456".`
    });
    if (selectedStudentId === s.id) {
      setNewPasswordInput('123456');
    }
    setTimeout(() => setPasswordResetNotice(null), 5000);
  };

  const handleToggleStudentPerbaikan = (s: Student) => {
    if (!onUpdateStudent) return;
    const newStatus = !s.statusPerbaikan;
    onUpdateStudent({ ...s, statusPerbaikan: newStatus });
    setPasswordResetNotice({
      type: 'success',
      msg: `Status akun Orang Tua siswa ${s.name} (NISN: ${s.nisn}) berhasil diubah: ${newStatus ? '🛠️ MODE PERBAIKAN AKTIF (Login Ditolak)' : '🟢 AKTIF NORMAL (Login Diizinkan)'}.`
    });
    setTimeout(() => setPasswordResetNotice(null), 5000);
  };

  const handleBatchSetStudentsPerbaikan = (status: boolean) => {
    if (!onUpdateStudent || !students || students.length === 0) return;
    students.forEach(s => {
      onUpdateStudent({ ...s, statusPerbaikan: status });
    });
    setPasswordResetNotice({
      type: 'success',
      msg: status
        ? `Status seluruh akun orang tua siswa (${students.length} orang) berhasil diset ke mode "🛠️ PERBAIKAN (Login Ditolak)".`
        : `Status seluruh akun orang tua siswa (${students.length} orang) berhasil dinormalkan (🟢 AKTIF NORMAL).`
    });
    setTimeout(() => setPasswordResetNotice(null), 6000);
  };

  const handleToggleGlobalPerbaikan = (newStatus?: boolean) => {
    const updatedStatus = newStatus !== undefined ? newStatus : !formData.parentPortalMaintenance;
    const defaultMsg = formData.parentMaintenanceMessage?.trim() || 'Maaf ada perbaikan Sistem';
    const updatedProfile: SchoolProfile = {
      ...formData,
      parentPortalMaintenance: updatedStatus,
      parentMaintenanceMessage: defaultMsg
    };
    setFormData(updatedProfile);
    onSaveProfile(updatedProfile);
    setPasswordResetNotice({
      type: updatedStatus ? 'error' : 'success',
      msg: updatedStatus
        ? '🛠️ Mode "Info Perbaikan Sistem" AKTIF: Seluruh akses login role Orang Tua/Siswa kini DITOLAK dengan pesan "Maaf ada perbaikan Sistem".'
        : '🟢 Mode Perbaikan DINONAKTIFKAN: Seluruh akun Orang Tua/Siswa kini dapat login normal kembali.'
    });
    setTimeout(() => setPasswordResetNotice(null), 6000);
  };

  const filteredTeachersForPassword = useMemo(() => {
    return sortedTeachers.filter(t => {
      const q = teacherSearchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        (t.phone && t.phone.toLowerCase().includes(q))
      );
    });
  }, [sortedTeachers, teacherSearchTerm]);

  const filteredStudentsForPassword = useMemo(() => {
    return students.filter(s => {
      const matchClass = studentClassFilter === 'ALL' || s.className === studentClassFilter;
      const q = studentSearchTerm.trim().toLowerCase();
      const matchQuery = !q || s.name.toLowerCase().includes(q) || s.nisn.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q);
      return matchClass && matchQuery;
    });
  }, [students, studentClassFilter, studentSearchTerm]);

  const DEFAULT_SUBJECTS = ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PJOK', 'Seni Budaya', 'Informatika', 'PPKn'];
  const currentSubjects = (formData.subjects && formData.subjects.length > 0) ? formData.subjects : DEFAULT_SUBJECTS;

  const handleAddSubject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newSubjectInput.trim();
    if (!trimmed) return;
    if (currentSubjects.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      alert(`Mata pelajaran "${trimmed}" sudah ada dalam daftar.`);
      return;
    }
    const updatedSubjects = Array.from(new Set([...currentSubjects, trimmed]));
    const updatedProfile: SchoolProfile = {
      ...formData,
      subjects: updatedSubjects
    };
    setFormData(updatedProfile);
    setNewSubjectInput('');
    // Auto-save & sync directly to Cloud Firestore so other devices get it immediately
    onSaveProfile(updatedProfile);
    setSubjectSavedNotice(`Mata pelajaran "${trimmed}" berhasil ditambahkan & disinkronkan ke seluruh perangkat.`);
    setTimeout(() => setSubjectSavedNotice(null), 4000);
  };

  const handleRemoveSubject = (subjectToRemove: string) => {
    const updatedSubjects = currentSubjects.filter(s => s !== subjectToRemove);
    const updatedProfile: SchoolProfile = {
      ...formData,
      subjects: updatedSubjects.length > 0 ? updatedSubjects : ['Matematika']
    };
    setFormData(updatedProfile);
    onSaveProfile(updatedProfile);
    setSubjectSavedNotice(`Mata pelajaran "${subjectToRemove}" berhasil dihapus & disinkronkan.`);
    setTimeout(() => setSubjectSavedNotice(null), 3000);
  };

  useEffect(() => {
    setFormData({ ...schoolProfile });
  }, [schoolProfile]);

  const handleFileUpload = (field: 'schoolLogo' | 'regencyLogo') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file foto logo terlalu besar. Maksimal 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const resizedDataUrl = canvas.toDataURL('image/png');
            setFormData(prev => ({ ...prev, [field]: resizedDataUrl }));
          } else {
            setFormData(prev => ({ ...prev, [field]: evt.target!.result as string }));
          }
        };
        img.src = evt.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSaveProfile(formData);
      setSaveSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Gagal menyimpan profil sekolah:', err);
      alert('Gagal menyimpan pengaturan. Silakan periksa kembali data yang dimasukkan.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-600" />
            Pengaturan Profil & Sistem Sekolah
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Atur identitas sekolah, logo kabupaten, logo sekolah, aturan jam masuk presensi, serta pemicu notifikasi WhatsApp.
          </p>
        </div>

        <button
          onClick={() => setShowResetModal(true)}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 self-start cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
          Reset Data Sampel
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl text-xs font-bold text-center shadow-sm animate-fadeIn">
          ✓ Pengaturan profil sekolah berhasil disimpan! Kartu Pelajar Digital & Laporan secara otomatis disesuaikan.
        </div>
      )}

      {/* Navigasi Cepat Pengaturan (Tombol Bagian Atas) */}
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-2 shadow-xs sticky top-2 z-20">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNavTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleJumpToSection(item.id, item.key)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? `${item.activeBg} shadow-sm scale-[1.02]`
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/70 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.color}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* TAB 1: PROFIL SEKOLAH */}
        {activeNavTab === 'profil' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Identitas Utama Sekolah */}
            <div id="section-profil-sekolah" className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                <School className="w-4 h-4 text-indigo-600" />
                Identitas & Logo Sekolah (Muncul di Kartu Pelajar Digital)
              </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nama Resmi Sekolah</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">NPSN (Nomor Pokok Sekolah Nasional)</label>
              <input
                type="text"
                required
                value={formData.npsn}
                onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Upload Logo Sekolah */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-extrabold text-xs flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  Foto Logo Resmi Sekolah
                </label>
                <button
                  type="button"
                  onClick={() => setShowSchoolLogoUrlInput(!showSchoolLogoUrlInput)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Link className="w-3 h-3" />
                  {showSchoolLogoUrlInput ? 'Sembunyikan URL' : 'Atur via Link URL'}
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                  {formData.schoolLogo ? (
                    <img
                      src={formData.schoolLogo}
                      alt="Logo Sekolah"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=120&auto=format&fit=crop&q=80';
                      }}
                    />
                  ) : (
                    <School className="w-8 h-8 text-slate-300" />
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <label className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl cursor-pointer shadow-sm transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Foto Logo Sekolah
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload('schoolLogo')}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Format PNG/JPG (Rasio 1:1 disarankan, maks 3 MB).
                  </p>
                </div>
              </div>

              {showSchoolLogoUrlInput && (
                <div className="pt-2 border-t border-slate-200/60">
                  <input
                    type="text"
                    value={formData.schoolLogo}
                    onChange={(e) => setFormData({ ...formData, schoolLogo: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl p-2 text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Upload Logo Kabupaten */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-extrabold text-xs flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  Foto Logo Kabupaten / Provinsi
                </label>
                <button
                  type="button"
                  onClick={() => setShowRegencyLogoUrlInput(!showRegencyLogoUrlInput)}
                  className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Link className="w-3 h-3" />
                  {showRegencyLogoUrlInput ? 'Sembunyikan URL' : 'Atur via Link URL'}
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                  {formData.regencyLogo ? (
                    <img
                      src={formData.regencyLogo}
                      alt="Logo Kabupaten"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=120&auto=format&fit=crop&q=80';
                      }}
                    />
                  ) : (
                    <School className="w-8 h-8 text-slate-300" />
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <label className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl cursor-pointer shadow-sm transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Foto Logo Kabupaten
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload('regencyLogo')}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Format PNG/JPG (Rasio 1:1 disarankan, maks 3 MB).
                  </p>
                </div>
              </div>

              {showRegencyLogoUrlInput && (
                <div className="pt-2 border-t border-slate-200/60">
                  <input
                    type="text"
                    value={formData.regencyLogo}
                    onChange={(e) => setFormData({ ...formData, regencyLogo: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl p-2 text-xs focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Alamat Lengkap Sekolah</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Kecamatan</label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Kabupaten / Kota</label>
                <input
                  type="text"
                  value={formData.regency}
                  onChange={(e) => setFormData({ ...formData, regency: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nama Kepala Sekolah & Gelar</label>
              <input
                type="text"
                required
                value={formData.principalName}
                onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">NIP Kepala Sekolah</label>
              <input
                type="text"
                required
                value={formData.principalNip}
                onChange={(e) => setFormData({ ...formData, principalNip: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* STATUS PERBAIKAN & PEMELIHARAAN PORTAL ORANG TUA */}
        <div id="section-perbaikan-orangtua" className="bg-white border border-amber-200/90 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    Status & Mode Perbaikan Portal Orang Tua
                  </h2>
                  {formData.parentPortalMaintenance ? (
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-rose-600" />
                      PERBAIKAN AKTIF (LOGIN DITOLAK)
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      PORTAL AKTIF NORMAL
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kontrol izin akses login seluruh akun Orang Tua / Siswa saat sistem database dalam pemeliharaan.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-2.5 bg-amber-50/80 border border-amber-200 px-3.5 py-2 rounded-2xl">
              <span className="text-xs font-bold text-slate-700">
                Mode Perbaikan:
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.parentPortalMaintenance}
                  onChange={(e) => setFormData({ ...formData, parentPortalMaintenance: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
              <span className={`text-xs font-extrabold ${formData.parentPortalMaintenance ? 'text-rose-600' : 'text-emerald-700'}`}>
                {formData.parentPortalMaintenance ? 'Aktif' : 'Non-Aktif'}
              </span>
            </div>
          </div>

          {/* Info Banner when Active */}
          {formData.parentPortalMaintenance && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs space-y-1.5 text-rose-950">
              <div className="flex items-center gap-2 font-extrabold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                Akses Login Orang Tua Sedang Dinonaktifkan
              </div>
              <p className="leading-relaxed text-slate-700">
                Ketika status perbaikan ini aktif, seluruh orang tua/wali murid yang mencoba masuk ke aplikasi akan langsung ditolak sebelum otentikasi, dan sistem akan menampilkan pesan perbaikan di bawah.
              </p>
            </div>
          )}

          {/* Custom Announcement Message Input */}
          <div className="space-y-1.5">
            <label className="block text-slate-700 font-bold text-xs flex items-center justify-between">
              <span>Informasi / Pesan Perbaikan untuk Orang Tua</span>
              <span className="text-[11px] text-slate-400 font-normal">Tampil otomatis saat orang tua mencoba login</span>
            </label>
            <textarea
              rows={2}
              value={formData.parentMaintenanceMessage || ''}
              onChange={(e) => setFormData({ ...formData, parentMaintenanceMessage: e.target.value })}
              placeholder="Contoh: Mohon maaf, Portal Orang Tua saat ini sedang dalam status perbaikan dan sinkronisasi data. Silakan hubungi pihak sekolah."
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-amber-500 font-medium leading-relaxed"
            />
          </div>
        </div>

        {/* Action Button Section 1 */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-3 rounded-2xl shadow-md flex items-center gap-2 text-xs transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Pengaturan Profil
          </button>
        </div>
      </div>
    )}

    {/* TAB 2: ATURAN JAM MASUK, JAM PULANG & HARI LIBUR */}
    {activeNavTab === 'jam-libur' && (
      <div className="space-y-6 animate-fadeIn">
        <div id="section-jam-libur" className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Aturan Jam Masuk, Jam Pulang & Waktu Batas Otomatis Alpa
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur jam operasional presensi dan tentukan pada hari apa saja aturan presensi & penentuan status Alpa otomatis berlaku.
            </p>
          </div>

          {/* Pengaturan Hari Aktif Belajar */}
          <div className="bg-gradient-to-br from-indigo-50/60 via-slate-50 to-indigo-50/30 border border-indigo-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Hari Aktif Belajar Sekolah
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Aturan presensi & Alpa otomatis hanya akan berjalan aktif pada hari-hari yang dicentang di bawah ini.
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectDaysPreset('5_DAYS')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    currentActiveDays.length === 5 && !currentActiveDays.includes('Sabtu') && !currentActiveDays.includes('Minggu')
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  5 Hari (Sen-Jum)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectDaysPreset('6_DAYS')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    currentActiveDays.length === 6 && !currentActiveDays.includes('Minggu')
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  6 Hari (Sen-Sab)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectDaysPreset('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    currentActiveDays.length === 7
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Semua (7 Hari)
                </button>
              </div>
            </div>

            {/* Checkbox pills for days */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
              {ALL_WEEK_DAYS.map((day) => {
                const isActive = currentActiveDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleActiveDay(day)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                    }`}
                  >
                    <span>{day}</span>
                    {isActive ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block"></span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
              <span className="font-bold text-indigo-700 shrink-0">ℹ️ Info Bekerja Aturan:</span>
              <span>
                Pada hari non-aktif (seperti <strong>{ALL_WEEK_DAYS.filter(d => !currentActiveDays.includes(d)).join(', ') || 'tidak ada'}</strong>), sistem otomatis Alpa <strong>TIDAK akan berjalan</strong> dan scanner tidak akan mewajibkan presensi.
              </span>
            </div>
          </div>

          {/* Pengaturan Tanggal Libur Khusus / Libur Nasional / Cuti Bersama */}
          <div className="bg-gradient-to-br from-rose-50/50 via-slate-50 to-amber-50/40 border border-rose-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Kelola Tanggal Libur Sekolah & Libur Nasional
                    </h3>
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-200">
                      {currentHolidays.length} Tanggal Libur
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tambahkan tanggal libur nasional (Tahun Baru, Idul Fitri, dsb) atau libur khusus sekolah agar sistem presensi tidak menerapkan Alpa otomatis.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleLoadNationalHolidaysPreset}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Muat tanggal libur nasional Indonesia otomatis"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+ Muat Libur Nasional 2026</span>
                </button>
              </div>
            </div>

            {holidayNotice && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn ${
                holidayNotice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  {holidayNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{holidayNotice.msg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHolidayNotice(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Form Input Tanggal Libur */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-bold text-slate-800">
                    {editingHolidayId ? '✏️ Edit Tanggal Libur Terpilih' : '➕ Tambah Tanggal Libur Baru'}
                  </span>
                </div>
                {editingHolidayId && (
                  <button
                    type="button"
                    onClick={handleCancelEditHoliday}
                    className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {/* Nama Libur */}
                <div className="lg:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">
                    Nama Hari Libur <span className="text-slate-400 font-normal text-[11px]">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={holidayNameInput}
                    onChange={(e) => setHolidayNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOrUpdateHoliday();
                      }
                    }}
                    placeholder="Contoh: Tahun Baru Masehi, Libur Semester Ganjil, dll."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all"
                  />
                </div>

                {/* Jenis Libur */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Kategori / Jenis Libur
                  </label>
                  <select
                    value={holidayTypeInput}
                    onChange={(e) => setHolidayTypeInput(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all cursor-pointer"
                  >
                    <option value="NASIONAL">Libur Nasional (Resmi 🇮🇩)</option>
                    <option value="CUTI_BERSAMA">Cuti Bersama 🌴</option>
                    <option value="SEKOLAH">Libur Khusus Sekolah 🏫</option>
                  </select>
                </div>

                {/* Tanggal Mulai Libur */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Tanggal Mulai Libur <span className="text-slate-400 font-normal text-[11px]">(Opsional)</span>
                  </label>
                  <input
                    type="date"
                    value={holidayDateInput}
                    onChange={(e) => setHolidayDateInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all"
                  />
                </div>

                {/* Multi-day toggle & Selesai Libur */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">
                      Tanggal Selesai (Opsional)
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-[11px] text-indigo-600 font-semibold">
                      <input
                        type="checkbox"
                        checked={isMultiDayHoliday}
                        onChange={(e) => {
                          setIsMultiDayHoliday(e.target.checked);
                          if (!e.target.checked) setHolidayEndDateInput('');
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Rentang &gt; 1 Hari</span>
                    </label>
                  </div>
                  <input
                    type="date"
                    disabled={!isMultiDayHoliday}
                    value={holidayEndDateInput}
                    min={holidayDateInput}
                    onChange={(e) => setHolidayEndDateInput(e.target.value)}
                    className={`w-full border rounded-xl p-2 text-xs font-mono font-bold transition-all ${
                      isMultiDayHoliday
                        ? 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500'
                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    placeholder="YYYY-MM-DD"
                  />
                </div>

                {/* Keterangan / Deskripsi */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Catatan / Keterangan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={holidayDescInput}
                    onChange={(e) => setHolidayDescInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOrUpdateHoliday();
                      }
                    }}
                    placeholder="Contoh: Surat Edaran Dinas No. 12/2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all"
                  />
                </div>
              </div>

              {/* Submit button */}
              <div className="flex items-center justify-end gap-2 pt-1">
                {editingHolidayId && (
                  <button
                    type="button"
                    onClick={handleCancelEditHoliday}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAddOrUpdateHoliday()}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {editingHolidayId ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan Perubahan Hari Libur</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Tambahkan ke Kalender Libur</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* List of Holidays with Search & Filter */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              {/* Header List */}
              <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-extrabold text-slate-800">
                    Daftar Hari Libur Terdaftar ({filteredHolidays.length} dari {currentHolidays.length})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Filter Jenis */}
                  <select
                    value={holidayFilterType}
                    onChange={(e) => setHolidayFilterType(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-rose-500 cursor-pointer"
                  >
                    <option value="ALL">Semua Kategori</option>
                    <option value="NASIONAL">🇮🇩 Libur Nasional</option>
                    <option value="CUTI_BERSAMA">🌴 Cuti Bersama</option>
                    <option value="SEKOLAH">🏫 Libur Sekolah</option>
                  </select>

                  {/* Search input */}
                  <div className="relative flex-1 sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={holidaySearchQuery}
                      onChange={(e) => setHolidaySearchQuery(e.target.value)}
                      placeholder="Cari hari libur..."
                      className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-[11px] text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-rose-500"
                    />
                    {holidaySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setHolidaySearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Table or Cards */}
              {filteredHolidays.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Calendar className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                  <p className="text-xs font-semibold text-slate-600">
                    {currentHolidays.length === 0
                      ? 'Belum ada tanggal libur yang ditambahkan ke kalender sekolah.'
                      : 'Tidak ada tanggal libur yang sesuai dengan pencarian / filter.'}
                  </p>
                  {currentHolidays.length === 0 && (
                    <button
                      type="button"
                      onClick={handleLoadNationalHolidaysPreset}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer mt-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Klik di sini untuk Memuat Hari Libur Nasional 2026</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {filteredHolidays.map((holiday) => {
                    const isEditingThis = editingHolidayId === holiday.id;

                    const dateDisplay = holiday.endDate && holiday.endDate !== holiday.date
                      ? `${new Date(holiday.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} s/d ${new Date(holiday.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : new Date(holiday.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

                    return (
                      <div
                        key={holiday.id}
                        className={`p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isEditingThis ? 'bg-rose-50/70 border-l-4 border-rose-600' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                            holiday.type === 'NASIONAL'
                              ? 'bg-rose-100 text-rose-700'
                              : holiday.type === 'CUTI_BERSAMA'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            <Flag className="w-4 h-4" />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-xs text-slate-900">
                                {holiday.name}
                              </span>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                holiday.type === 'NASIONAL'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : holiday.type === 'CUTI_BERSAMA'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                                {holiday.type === 'NASIONAL' ? 'Libur Nasional 🇮🇩' : holiday.type === 'CUTI_BERSAMA' ? 'Cuti Bersama 🌴' : 'Libur Sekolah 🏫'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {dateDisplay}
                              </span>
                              {holiday.description && (
                                <>
                                  <span>•</span>
                                  <span className="italic text-slate-500">{holiday.description}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditHoliday(holiday)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Hari Libur"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHoliday(holiday.id, holiday.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Hari Libur"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white/90 border border-rose-100 rounded-xl p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
              <span className="font-bold text-rose-700 shrink-0">🛡️ Proteksi Otomatis:</span>
              <span>
                Pada setiap tanggal libur yang tercatat di atas, sistem presensi akan <strong>menonaktifkan proses penetapan status Alpa otomatis</strong> serta menandai kolom presensi dengan kode <strong>'L' (Libur)</strong> pada laporan rekap bulanan kelas.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-1">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Jam Masuk Sekolah (WITA)</label>
              <input
                type="text"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                placeholder="07:00"
              />
              <p className="text-[11px] text-slate-500 mt-1">Waktu batas normal hadir siswa pada hari aktif belajar.</p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Batas Toleransi Terlambat (Menit)</label>
              <input
                type="number"
                required
                value={formData.lateToleranceMinutes}
                onChange={(e) => setFormData({ ...formData, lateToleranceMinutes: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Siswa hadir setelah menit ini berstatus Terlambat.</p>
            </div>

            {/* Waktu Batas Otomatis Alpa */}
            <div className={`border rounded-2xl p-3 space-y-2 transition-all ${
              formData.autoAlpaEnabled !== false
                ? 'bg-rose-50/60 border-rose-200/80'
                : 'bg-slate-50 border-slate-200 opacity-90'
            }`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="block text-slate-900 font-extrabold flex items-center gap-1.5 text-xs">
                    <Clock className={`w-3.5 h-3.5 ${formData.autoAlpaEnabled !== false ? 'text-rose-600' : 'text-slate-400'}`} />
                    Batas Otomatis Alpa (WITA)
                  </label>
                </div>

                {/* Saklar / Toggle Switch Menonaktifkan / Mengaktifkan Otomatis Alpa */}
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={formData.autoAlpaEnabled !== false}
                    onChange={(e) => setFormData({ ...formData, autoAlpaEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                  <span className="ml-1.5 text-[11px] font-bold text-slate-800">
                    {formData.autoAlpaEnabled !== false ? 'Aktif' : 'Non-aktif'}
                  </span>
                </label>
              </div>

              <input
                type="text"
                disabled={formData.autoAlpaEnabled === false}
                value={formData.autoAlpaTime || '08:30'}
                onChange={(e) => setFormData({ ...formData, autoAlpaTime: e.target.value })}
                className={`w-full rounded-xl p-2 font-mono font-bold focus:ring-2 shadow-xs text-xs transition-all ${
                  formData.autoAlpaEnabled !== false
                    ? 'bg-white border border-rose-300 text-slate-900 focus:ring-rose-500'
                    : 'bg-slate-100 border border-slate-300 text-slate-400 cursor-not-allowed'
                }`}
                placeholder="08:30"
              />
              <p className="text-[10.5px] text-slate-500 leading-tight">
                {formData.autoAlpaEnabled !== false ? (
                  <span>Siswa yang belum presensi hingga jam ini otomatis berstatus <strong className="text-rose-700">ALPA</strong>.</span>
                ) : (
                  <span className="text-emerald-700 font-medium">✓ Fitur Alpa Otomatis dinonaktifkan. Mode Scan Masuk tetap terbuka.</span>
                )}
              </p>
            </div>
          </div>

          {/* Pengaturan Jam Pulang Berbeda Tiap Hari (Berdasarkan Hari Aktif Belajar Sekolah) */}
          <div className="bg-amber-50/50 border border-amber-200/90 rounded-3xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-amber-200/60 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Pengaturan Jam Pulang Berbeda Tiap Hari
                </h4>
                <p className="text-xs text-amber-900/80 mt-0.5">
                  Atur waktu kepulangan siswa secara spesifik untuk masing-masing hari aktif belajar (contoh: Jumat pulang lebih awal pukul 11:30, Senin-Kamis pukul 15:00).
                </p>
              </div>

              {/* Quick Presets for Departure Times */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-amber-900 mr-1">Preset Cepat:</span>
                <button
                  type="button"
                  onClick={() => handleApplyDailyPreset('STANDARD_5_DAYS')}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 text-[11px] font-bold rounded-lg border border-amber-300 shadow-2xs transition-all cursor-pointer"
                  title="Sen-Kam 15:00, Jum 11:30, Sab 13:00"
                >
                  🏫 Standar 5 Hari (Jum 11:30)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyDailyPreset('STANDARD_6_DAYS')}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 text-[11px] font-bold rounded-lg border border-amber-300 shadow-2xs transition-all cursor-pointer"
                  title="Sen-Kam 14:00, Jum 11:30, Sab 13:00"
                >
                  📅 Standar 6 Hari (Sab 13:00)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyDailyPreset('FULL_DAY')}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 text-[11px] font-bold rounded-lg border border-amber-300 shadow-2xs transition-all cursor-pointer"
                  title="Semua hari 15:30"
                >
                  ⚡ Full Day (15:30)
                </button>
              </div>
            </div>

            {/* Quick Bulk Tool: Samakan Jam Pulang ke Semua Hari Aktif */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 p-3 rounded-2xl border border-amber-200">
              <div className="flex items-center gap-2 text-xs text-amber-950 font-semibold">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Samakan jam pulang untuk seluruh hari aktif belajar:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bulkTimeInput}
                  onChange={(e) => setBulkTimeInput(e.target.value)}
                  className="w-20 bg-white border border-amber-300 text-slate-900 text-xs font-mono font-bold rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500"
                  placeholder="15:00"
                />
                <button
                  type="button"
                  onClick={() => handleApplyTimeToAllActiveDays(bulkTimeInput)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Terapkan ke Semua Hari Aktif
                </button>
              </div>
            </div>

            {/* Day Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {ALL_WEEK_DAYS.map((day) => {
                const isActive = currentActiveDays.includes(day);
                const currentTime = currentDailyEndTimes[day] || '15:00';
                const isFriday = day === 'Jumat';

                return (
                  <div
                    key={day}
                    className={`rounded-2xl p-3.5 border transition-all flex flex-col justify-between ${
                      isActive
                        ? isFriday
                          ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                          : 'bg-white border-amber-300 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div>
                      {/* Day Header */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${isActive ? (isFriday ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-300'}`} />
                          <span className="font-extrabold text-xs text-slate-900">{day}</span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            isActive
                              ? isFriday
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-slate-200 text-slate-600 border-slate-300'
                          }`}
                        >
                          {isActive ? (isFriday ? 'Jumat Berkah' : 'Hari Aktif') : 'Libur'}
                        </span>
                      </div>

                      {/* Time Input */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span>Jam Pulang (WITA):</span>
                          {isFriday && isActive && (
                            <span className="text-[10px] text-emerald-700 font-semibold">Pulang Awal</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={currentTime}
                            onChange={(e) => handleDailyEndTimeChange(day, e.target.value)}
                            disabled={!isActive}
                            className={`w-full font-mono font-black text-sm rounded-xl py-2 px-3 pl-8 border transition-all ${
                              isActive
                                ? isFriday
                                  ? 'bg-white border-emerald-400 text-emerald-950 focus:ring-2 focus:ring-emerald-500'
                                  : 'bg-white border-amber-300 text-amber-950 focus:ring-2 focus:ring-amber-500'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                            placeholder="15:00"
                          />
                          <Clock className={`w-4 h-4 absolute left-2.5 top-2.5 ${isActive ? (isFriday ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-400'}`} />
                        </div>
                      </div>
                    </div>

                    {!isActive && (
                      <div className="mt-3 text-[10.5px] text-slate-500 italic bg-slate-100 p-2 rounded-xl border border-slate-200">
                        Hari ini berstatus non-aktif pada pengaturan Hari Aktif Belajar Sekolah.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Smart Summary Info */}
            <div className="bg-amber-100/70 border border-amber-300/80 rounded-2xl p-3 text-xs text-amber-950 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-extrabold text-amber-950">Otomatisasi Scanner Presensi & Notifikasi WhatsApp:</span>
                <p className="text-[11.5px] text-amber-900 leading-relaxed font-medium">
                  Modul Scanner QR akan secara otomatis beralih dari <strong>Mode Scan Masuk</strong> ke <strong>Mode Scan Pulang</strong> tepat pada jam kepulangan hari yang bersangkutan (misal: hari Jumat pukul <strong>{currentDailyEndTimes['Jumat'] || '11:30'} WITA</strong>, hari Senin-Kamis pukul <strong>{currentDailyEndTimes['Senin'] || '15:00'} WITA</strong>). Pada pukul 01:00 WITA, modul scanner akan otomatis reset kembali ke Mode Masuk.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Section 2 */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-6 py-3 rounded-2xl shadow-md flex items-center gap-2 text-xs transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Pengaturan Jam & Libur
          </button>
        </div>
      </div>
    )}

    {/* TAB 3: AKADEMIK & MAPEL */}
    {activeNavTab === 'akademik' && (
      <div className="space-y-6 animate-fadeIn">
        <div id="section-akademik" className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Kelola Mata Pelajaran Sekolah & Periode Akademik
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur Tahun Ajaran, Semester aktif, dan daftar mata pelajaran kurikulum untuk seluruh kelas dan laporan penilaian.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full w-fit">
              Total: {currentSubjects.length} Mata Pelajaran
            </span>
          </div>

          {/* Pengaturan Tahun Ajaran dan Pilihan Semester Ganjil / Genap */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-indigo-50/40 border border-indigo-200/90 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Tahun Ajaran & Semester Aktif
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tahun ajaran dan semester ini menjadi rujukan otomatis pada Jurnal Pembelajaran, Rekap Nilai, dan Cetak Laporan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Input Tahun Ajaran */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Tahun Ajaran Sekolah
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={formData.academicYear || '2025/2026'}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    placeholder="Contoh: 2025/2026"
                    className="flex-1 bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                  {/* Preset quick buttons */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, academicYear: '2025/2026' })}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                      formData.academicYear === '2025/2026'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    2025/2026
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, academicYear: '2026/2027' })}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                      formData.academicYear === '2026/2027'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    2026/2027
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">Format standar: Tahun/Tahun (misal: 2025/2026)</p>
              </div>

              {/* Input Pilihan Semester Ganjil / Genap */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Pilihan Semester Berjalan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, semester: 'GANJIL' })}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-extrabold transition-all cursor-pointer ${
                      (formData.semester || 'GANJIL') === 'GANJIL'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${formData.semester === 'GANJIL' || !formData.semester ? 'opacity-100' : 'opacity-0'}`} />
                    <span>Semester Ganjil (1)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, semester: 'GENAP' })}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-extrabold transition-all cursor-pointer ${
                      formData.semester === 'GENAP'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${formData.semester === 'GENAP' ? 'opacity-100' : 'opacity-0'}`} />
                    <span>Semester Genap (2)</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">Pilih semester aktif yang sedang berjalan di sekolah.</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Tambahkan mata pelajaran atau daftar kurikulum yang diajarkan di sekolah ini untuk kebutuhan akademik dan pencatatan presensi.
          </p>

          {subjectSavedNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{subjectSavedNotice}</span>
            </div>
          )}

          {/* Form Tambah Mata Pelajaran Baru */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newSubjectInput}
              onChange={(e) => setNewSubjectInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubject();
                }
              }}
              placeholder="Ketik nama mata pelajaran baru (misal: Fisika, Prakarya, Bahasa Daerah)..."
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleAddSubject}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tambah Mata Pelajaran
            </button>
          </div>

          {/* List Badge Mata Pelajaran */}
          <div className="pt-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Daftar Mata Pelajaran Terdaftar:
            </label>
            {currentSubjects.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">Belum ada mata pelajaran. Silakan tambahkan melalui form di atas.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentSubjects.map((sub, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/80 px-3 py-1.5 rounded-xl text-xs font-bold transition-all group"
                  >
                    <span>{sub}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(sub)}
                      title={`Hapus ${sub}`}
                      className="text-indigo-400 hover:text-rose-600 p-0.5 rounded-md hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card Penilaian Karakter Otomatis & Konfigurasi Poin */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  Penilaian Karakter Otomatis & Besaran Nilai Poin
                </h3>
                <p className="text-xs text-slate-500">
                  Konfigurasi besaran poin untuk sistem evaluasi otomatis dari presensi sekolah & jurnal harian KBM.
                </p>
              </div>
            </div>

            {/* Master Toggle */}
            <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto">
              <input
                type="checkbox"
                checked={formData.autoCharacterAssessmentEnabled !== false}
                onChange={(e) => setFormData({
                  ...formData,
                  autoCharacterAssessmentEnabled: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-2.5 text-xs font-bold text-slate-800">
                {formData.autoCharacterAssessmentEnabled !== false ? '🟢 Sistem Aktif' : '🔴 Non-Aktif'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1 text-xs">
            {/* 1. Sangat Aktif KBM */}
            <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-emerald-600" />
                  Sangat Aktif KBM
                </span>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  +POSITIF
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-600 font-medium">Nilai Poin:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.autoCharacterPoints?.veryActiveKbmPoints ?? 1}
                    onChange={(e) => setFormData({
                      ...formData,
                      autoCharacterPoints: {
                        ...(formData.autoCharacterPoints || {
                          latePoints: 2,
                          alpaPoints: 5,
                          disruptivePoints: 1,
                          absentKbmPoints: 2,
                          veryActiveKbmPoints: 1,
                          onTimePoints: 1,
                          onTimeRequiredDays: 3,
                        }),
                        veryActiveKbmPoints: Math.max(1, Math.abs(Number(e.target.value)) || 1)
                      }
                    })}
                    className="w-14 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-black text-center text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] font-bold text-emerald-700">+Poin</span>
                </div>
              </div>
            </div>

            {/* 2. Tidak Hadir di Kelas KBM */}
            <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-rose-900 flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-rose-600" />
                  Tidak Hadir di Kelas KBM
                </span>
                <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                  -NEGATIF
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-600 font-medium">Nilai Poin:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.autoCharacterPoints?.absentKbmPoints ?? 2}
                    onChange={(e) => setFormData({
                      ...formData,
                      autoCharacterPoints: {
                        ...(formData.autoCharacterPoints || {
                          latePoints: 2,
                          alpaPoints: 5,
                          disruptivePoints: 1,
                          absentKbmPoints: 2,
                          veryActiveKbmPoints: 1,
                          onTimePoints: 1,
                          onTimeRequiredDays: 3,
                        }),
                        absentKbmPoints: Math.max(1, Math.abs(Number(e.target.value)) || 2)
                      }
                    })}
                    className="w-14 px-2 py-1 bg-white border border-rose-300 rounded-lg text-xs font-black text-center text-rose-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <span className="text-[11px] font-bold text-rose-700">-Poin</span>
                </div>
              </div>
            </div>

            {/* 3. Mengganggu KBM */}
            <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-amber-900 flex items-center gap-1.5">
                  <VolumeX className="w-4 h-4 text-amber-600" />
                  Mengganggu KBM
                </span>
                <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  -NEGATIF
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-600 font-medium">Nilai Poin:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.autoCharacterPoints?.disruptivePoints ?? 1}
                    onChange={(e) => setFormData({
                      ...formData,
                      autoCharacterPoints: {
                        ...(formData.autoCharacterPoints || {
                          latePoints: 2,
                          alpaPoints: 5,
                          disruptivePoints: 1,
                          absentKbmPoints: 2,
                          veryActiveKbmPoints: 1,
                          onTimePoints: 1,
                          onTimeRequiredDays: 3,
                        }),
                        disruptivePoints: Math.max(1, Math.abs(Number(e.target.value)) || 1)
                      }
                    })}
                    className="w-14 px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-black text-center text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="text-[11px] font-bold text-amber-700">-Poin</span>
                </div>
              </div>
            </div>

            {/* 4. Tepat Waktu Presensi */}
            <div className="p-3.5 bg-emerald-50/30 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-emerald-800 flex items-center gap-1.5">
                  <CalendarCheck2 className="w-4 h-4 text-emerald-600" />
                  Tepat Waktu Presensi
                </span>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  +POSITIF
                </span>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600 font-medium">Syarat Kehadiran:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={formData.autoCharacterPoints?.onTimeRequiredDays ?? 3}
                      onChange={(e) => setFormData({
                        ...formData,
                        autoCharacterPoints: {
                          ...(formData.autoCharacterPoints || {
                            latePoints: 2,
                            alpaPoints: 5,
                            disruptivePoints: 1,
                            absentKbmPoints: 2,
                            veryActiveKbmPoints: 1,
                            onTimePoints: 1,
                            onTimeRequiredDays: 3,
                          }),
                          onTimeRequiredDays: Math.max(1, Math.abs(Number(e.target.value)) || 3)
                        }
                      })}
                      className="w-12 px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-black text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] text-slate-500 font-semibold">Hari</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600 font-medium">Nilai Poin:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.autoCharacterPoints?.onTimePoints ?? 1}
                      onChange={(e) => setFormData({
                        ...formData,
                        autoCharacterPoints: {
                          ...(formData.autoCharacterPoints || {
                            latePoints: 2,
                            alpaPoints: 5,
                            disruptivePoints: 1,
                            absentKbmPoints: 2,
                            veryActiveKbmPoints: 1,
                            onTimePoints: 1,
                            onTimeRequiredDays: 3,
                          }),
                          onTimePoints: Math.max(1, Math.abs(Number(e.target.value)) || 1)
                        }
                      })}
                      className="w-14 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-black text-center text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] font-bold text-emerald-700">+Poin</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Terlambat Presensi */}
            <div className="p-3.5 bg-red-50/30 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-red-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-red-600" />
                  Terlambat Presensi
                </span>
                <span className="text-[10px] font-black bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                  -NEGATIF
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-600 font-medium">Nilai Poin:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.autoCharacterPoints?.latePoints ?? 2}
                    onChange={(e) => setFormData({
                      ...formData,
                      autoCharacterPoints: {
                        ...(formData.autoCharacterPoints || {
                          latePoints: 2,
                          alpaPoints: 5,
                          disruptivePoints: 1,
                          absentKbmPoints: 2,
                          veryActiveKbmPoints: 1,
                          onTimePoints: 1,
                          onTimeRequiredDays: 3,
                        }),
                        latePoints: Math.max(1, Math.abs(Number(e.target.value)) || 2)
                      }
                    })}
                    className="w-14 px-2 py-1 bg-white border border-red-300 rounded-lg text-xs font-black text-center text-red-800 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <span className="text-[11px] font-bold text-red-700">-Poin</span>
                </div>
              </div>
            </div>

            {/* 6. Alpa Presensi */}
            <div className="p-3.5 bg-rose-50/30 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-rose-800 flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-rose-600" />
                  Alpa Presensi
                </span>
                <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                  -NEGATIF
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-600 font-medium">Nilai Poin:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.autoCharacterPoints?.alpaPoints ?? 5}
                    onChange={(e) => setFormData({
                      ...formData,
                      autoCharacterPoints: {
                        ...(formData.autoCharacterPoints || {
                          latePoints: 2,
                          alpaPoints: 5,
                          disruptivePoints: 1,
                          absentKbmPoints: 2,
                          veryActiveKbmPoints: 1,
                          onTimePoints: 1,
                          onTimeRequiredDays: 3,
                        }),
                        alpaPoints: Math.max(1, Math.abs(Number(e.target.value)) || 5)
                      }
                    })}
                    className="w-14 px-2 py-1 bg-white border border-rose-300 rounded-lg text-xs font-black text-center text-rose-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <span className="text-[11px] font-bold text-rose-700">-Poin</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Section 3 */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-3 rounded-2xl shadow-md flex items-center gap-2 text-xs transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Pengaturan Akademik
          </button>
        </div>
      </div>
    )}

    {/* TAB 4: SUARA AI & NOTIFIKASI */}
    {activeNavTab === 'suara-ai' && (
      <div className="space-y-6 animate-fadeIn">
        {/* ========================================================= */}
        {/* FITUR SUARA AI & NOTIFIKASI PERAN (GURU & ORANG TUA)       */}
        {/* ========================================================= */}
        <div id="section-suara-ai" className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-100 shrink-0 mt-0.5">
                <Volume2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    Fitur Suara AI & Pengaturan Notifikasi Peran
                  </h2>
                  <span className="bg-violet-50 text-violet-700 border border-violet-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-violet-600" />
                    AI Voice & Audio Engine
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Kelola notifikasi suara pintar berbasis AI dan template pesan otomatis untuk pengingat jadwal mengajar Guru serta notifikasi kehadiran Putra-Putri bagi Orang Tua/Wali Murid.
                </p>
              </div>
            </div>

            {/* Global Engine Indicator */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-2xl">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-bold text-slate-700">Web Speech & Audio API Aktif</span>
            </div>
          </div>

          {/* Reset Feedback Notice Toast */}
          {templateResetToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2.5 shadow-xs animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{templateResetToast}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUB-BAGIAN 1: PENGINGAT SUARA AI JADWAL KBM GURU         */}
          {/* ======================================================== */}
          <div className="bg-gradient-to-br from-violet-50/70 via-white to-indigo-50/40 border border-violet-200/80 rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-violet-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    1. Pengingat Jadwal Mengajar Guru (Suara AI KBM)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Memadukan lonceng harmonis 4-akord dan Suara AI alami untuk mengingatkan guru saat jam mengajar dimulai.
                  </p>
                </div>
              </div>

              {/* Master Toggle Suara AI Guru */}
              <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto">
                <input
                  type="checkbox"
                  checked={formData.aiVoiceTeacherReminderEnabled ?? formData.waTeacherReminderEnabled ?? true}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setFormData({
                      ...formData,
                      aiVoiceTeacherReminderEnabled: val,
                      waTeacherReminderEnabled: val
                    });
                    setKbmVoiceReminderEnabled(val);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                <span className="ml-2.5 text-xs font-bold text-slate-800">
                  {(formData.aiVoiceTeacherReminderEnabled ?? formData.waTeacherReminderEnabled ?? true) ? '🔊 Suara AI Aktif' : '🔇 Dinonaktifkan'}
                </span>
              </label>
            </div>

            {/* Setting: Waktu Pengingat Menit Sebelum */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-white border border-violet-100/80 rounded-2xl p-4 shadow-2xs">
              <div className="sm:col-span-8">
                <label className="block text-xs font-bold text-slate-800">
                  Waktu Pemutaran Pengingat Suara AI
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tentukan kapan nada lonceng dan panggilan Suara AI dibunyikan sebelum jam mengajar dimulai.
                </p>
              </div>
              <div className="sm:col-span-4">
                <select
                  value={formData.aiVoiceTeacherReminderMinutesBefore ?? formData.waTeacherReminderMinutesBefore ?? 0}
                  onChange={(e) => setFormData({
                    ...formData,
                    aiVoiceTeacherReminderMinutesBefore: Number(e.target.value),
                    waTeacherReminderMinutesBefore: Number(e.target.value)
                  })}
                  className="w-full text-xs font-bold bg-violet-50/50 border border-violet-200 rounded-xl px-3 py-2.5 text-violet-900 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                >
                  <option value={0}>⏰ Tepat Saat Jam KBM Dimulai (0 Menit)</option>
                  <option value={3}>⏳ 3 Menit Sebelum KBM Dimulai</option>
                  <option value={5}>⏳ 5 Menit Sebelum KBM Dimulai</option>
                  <option value={10}>⏳ 10 Menit Sebelum KBM Dimulai</option>
                </select>
              </div>
            </div>

            {/* Format Kalimat Suara AI Pengingat Guru */}
            <div className="space-y-2 bg-white border border-violet-100/80 rounded-2xl p-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-violet-600" />
                  Format Kalimat Suara AI & Pesan Pengingat Guru:
                </label>
                <button
                  type="button"
                  onClick={handleResetTeacherVoiceTemplate}
                  className="text-[11px] text-violet-600 hover:text-violet-800 font-bold underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw className="w-3 h-3" />
                  Kembalikan Format Default
                </button>
              </div>

              <textarea
                rows={3}
                value={formData.aiVoiceTemplateTeacherReminder ?? formData.waTemplateTeacherReminder ?? DEFAULT_TEACHER_SPEECH_TEMPLATE}
                onChange={(e) => setFormData({
                  ...formData,
                  aiVoiceTemplateTeacherReminder: e.target.value,
                  waTemplateTeacherReminder: e.target.value
                })}
                placeholder="Contoh: Pemberitahuan kepada [TeacherName]. Anda memiliki jadwal mengajar mata pelajaran [Subject] di [ClassName] [PeriodLabel]..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:bg-white focus:ring-2 focus:ring-violet-500 focus:outline-none font-mono leading-relaxed"
              />

              {/* Dynamic Variable Chips */}
              <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 font-bold">Variabel Tersedia:</span>
                {['[TeacherName]', '[Subject]', '[ClassName]', '[Room]', '[Time]', '[PeriodLabel]', '[SchoolName]'].map((v) => (
                  <span
                    key={v}
                    onClick={() => {
                      const cur = formData.aiVoiceTemplateTeacherReminder ?? formData.waTemplateTeacherReminder ?? DEFAULT_TEACHER_SPEECH_TEMPLATE;
                      setFormData({
                        ...formData,
                        aiVoiceTemplateTeacherReminder: `${cur} ${v}`,
                        waTemplateTeacherReminder: `${cur} ${v}`
                      });
                    }}
                    className="bg-violet-100/70 hover:bg-violet-200 text-violet-800 border border-violet-300/60 font-mono font-bold px-2 py-0.5 rounded-md cursor-pointer transition shadow-2xs"
                    title={`Klik untuk menyisipkan ${v}`}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>

            {/* Interactive Live Testing Sandbox for Teacher AI Voice */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-700 text-white rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-violet-200" />
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-200">
                    Live Testing Suara AI Pengingat Guru
                  </span>
                </div>
                <span className="text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full font-medium">
                  Lonceng Harmonis + Suara Wanita
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-8">
                  <label className="block text-[11px] text-violet-200 font-medium mb-1">
                    Pilih Guru untuk Simulasi Pengingat KBM:
                  </label>
                  <select
                    value={selectedTestTeacherId || (sortedTeachers[0]?.id || '')}
                    onChange={(e) => setSelectedTestTeacherId(e.target.value)}
                    className="w-full text-xs font-bold bg-white text-slate-900 border border-violet-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-white focus:outline-none"
                  >
                    {sortedTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — ({t.subject1 || 'Mata Pelajaran'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4 flex items-end">
                  <button
                    type="button"
                    onClick={handleTestTeacherVoice}
                    disabled={isTestingTeacherVoice}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-violet-900 hover:bg-violet-50 font-black rounded-xl text-xs transition shadow-md cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-4 sm:mt-0"
                  >
                    <Volume2 className={`w-4 h-4 text-violet-600 ${isTestingTeacherVoice ? 'animate-pulse text-amber-500' : ''}`} />
                    <span>{isTestingTeacherVoice ? 'Memutar Suara AI...' : 'Uji Coba Suara AI Guru'}</span>
                  </button>
                </div>
              </div>

              {testTeacherVoicePlayingText && (
                <div className="bg-black/25 border border-white/20 rounded-xl p-3 text-xs space-y-1 mt-2">
                  <p className="text-[11px] text-violet-200 font-bold flex items-center gap-1">
                    <Volume2 className="w-3 h-3 animate-pulse" />
                    Kalimat yang Diucapkan AI:
                  </p>
                  <p className="italic text-white leading-relaxed font-sans">
                    "{testTeacherVoicePlayingText}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* SUB-BAGIAN 2: NOTIFIKASI & SUARA AI UNTUK ROLE ORANG TUA */}
          {/* ======================================================== */}
          <div className="bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 border border-emerald-200/80 rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    2. Notifikasi & Suara AI untuk Role Orang Tua (Wali Murid)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Konfigurasi pesan teks dan pembacaan Suara AI untuk status kehadiran Datang Tepat Waktu, Terlambat, Belum Absen/Alpa, dan Pulang.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Master Switch Notifikasi Orang Tua */}
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.aiVoiceParentEnabled ?? formData.waParentNotificationEnabled ?? true}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setFormData({
                        ...formData,
                        aiVoiceParentEnabled: val,
                        waParentNotificationEnabled: val
                      });
                      setParentVoiceEnabled(val);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-2 text-xs font-bold text-slate-800">
                    {(formData.aiVoiceParentEnabled ?? formData.waParentNotificationEnabled ?? true) ? 'Notifikasi Aktif' : 'Non-aktif'}
                  </span>
                </label>

                {/* Reset All Parent Templates Button */}
                <button
                  type="button"
                  onClick={handleResetAllParentTemplates}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Reset Semua Format Orang Tua</span>
                </button>
              </div>
            </div>

            {/* Audio Speech Switch for Attendance Events */}
            <div className="bg-white border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  Putar Suara AI Saat Presensi Kehadiran Siswa
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  AI akan mengumumkan status kehadiran siswa dengan suara natural dan nada lonceng harmonis saat scan presensi tercatat.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto">
                <input
                  type="checkbox"
                  checked={formData.aiVoiceParentSpeechEnabled ?? true}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setFormData({
                      ...formData,
                      aiVoiceParentSpeechEnabled: val
                    });
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-2 text-xs font-bold text-slate-700">
                  {(formData.aiVoiceParentSpeechEnabled ?? true) ? '🔊 Suara AI Presensi Aktif' : '🔇 Hening'}
                </span>
              </label>
            </div>

            {/* 4 BENTO CARDS FOR PARENT NOTIFICATION ROLES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* CARD 1: DATANG TEPAT WAKTU (HADIR) */}
              <div className="bg-white border border-emerald-200/90 rounded-2xl p-4 space-y-3.5 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
                        A. Datang Tepat Waktu (Hadir)
                      </h4>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      Status: Hadir
                    </span>
                  </div>

                  {/* Pesan Teks */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span>Format Pesan Notifikasi:</span>
                      <button
                        type="button"
                        onClick={() => handleResetSingleParentTemplate('ARRIVAL')}
                        className="text-[10px] text-emerald-700 hover:underline font-semibold"
                      >
                        Reset Default
                      </button>
                    </label>
                    <textarea
                      rows={2}
                      value={formData.parentTemplateArrival ?? formData.waTemplateArrival ?? DEFAULT_PARENT_ARRIVAL_MESSAGE}
                      onChange={(e) => setFormData({
                        ...formData,
                        parentTemplateArrival: e.target.value,
                        waTemplateArrival: e.target.value
                      })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    />
                  </div>

                  {/* Kalimat Suara AI */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-emerald-600" />
                      Kalimat yang Diucapkan Suara AI:
                    </label>
                    <textarea
                      rows={2}
                      value={formData.parentVoiceTemplateArrival ?? DEFAULT_PARENT_VOICE_ARRIVAL}
                      onChange={(e) => setFormData({
                        ...formData,
                        parentVoiceTemplateArrival: e.target.value
                      })}
                      className="w-full text-xs bg-emerald-50/40 border border-emerald-200 rounded-xl p-2.5 text-emerald-950 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-sans"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">Melodi: Ceria (3-Akord)</span>
                  <button
                    type="button"
                    onClick={() => handleTestParentVoice('ARRIVAL')}
                    disabled={isTestingParentVoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-70"
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${activeSingleTestingKey === 'ARRIVAL' ? 'animate-pulse' : ''}`} />
                    <span>{activeSingleTestingKey === 'ARRIVAL' ? 'Memutar...' : 'Tes Suara Hadir'}</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: TERLAMBAT MASUK SEKOLAH */}
              <div className="bg-white border border-amber-200/90 rounded-2xl p-4 space-y-3.5 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <h4 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                        B. Terlambat Masuk Sekolah
                      </h4>
                    </div>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      Status: Terlambat
                    </span>
                  </div>

                  {/* Pesan Teks */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span>Format Pesan Notifikasi:</span>
                      <button
                        type="button"
                        onClick={() => handleResetSingleParentTemplate('LATE')}
                        className="text-[10px] text-amber-700 hover:underline font-semibold"
                      >
                        Reset Default
                      </button>
                    </label>
                    <textarea
                      rows={2}
                      value={formData.parentTemplateLate ?? formData.waTemplateLate ?? DEFAULT_PARENT_LATE_MESSAGE}
                      onChange={(e) => setFormData({
                        ...formData,
                        parentTemplateLate: e.target.value,
                        waTemplateLate: e.target.value
                      })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>

                  {/* Kalimat Suara AI */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-amber-600" />
                      Kalimat yang Diucapkan Suara AI:
                    </label>
                    <textarea
                      rows={2}
                      value={formData.parentVoiceTemplateLate ?? DEFAULT_PARENT_VOICE_LATE}
                      onChange={(e) => setFormData({
                        ...formData,
                        parentVoiceTemplateLate: e.target.value
                      })}
                      className="w-full text-xs bg-amber-50/40 border border-amber-200 rounded-xl p-2.5 text-amber-950 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-sans"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">Melodi: Peringatan (2-Akord)</span>
                  <button
                    type="button"
                    onClick={() => handleTestParentVoice('LATE')}
                    disabled={isTestingParentVoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-70"
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${activeSingleTestingKey === 'LATE' ? 'animate-pulse' : ''}`} />
                    <span>{activeSingleTestingKey === 'LATE' ? 'Memutar...' : 'Tes Suara Terlambat'}</span>
                  </button>
                </div>
              </div>

              {/* CARD 3: BELUM ABSEN / ALPA */}
              <div className="bg-white border border-rose-200/90 rounded-2xl p-4 space-y-3.5 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      <h4 className="text-xs font-extrabold text-rose-950 uppercase tracking-wider">
                        C. Belum Absen / Alpa (Peringatan)
                      </h4>
                    </div>
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      Status: Belum Absen
                    </span>
                  </div>

                  {/* Pesan Teks */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700">
                        Format Pesan Notifikasi:
                      </label>
                      <button
                        type="button"
                        onClick={() => handleResetSingleParentTemplate('ABSENT')}
                        className="text-[10px] text-rose-700 hover:underline font-semibold"
                      >
                        Reset Default
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={formData.parentTemplateAbsent ?? formData.waTemplateAbsent ?? DEFAULT_PARENT_ABSENT_MESSAGE}
                      onChange={(e) => setFormData({
                        ...formData,
                        parentTemplateAbsent: e.target.value,
                        waTemplateAbsent: e.target.value
                      })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none font-mono"
                    />
                  </div>

                  {/* Indikator Sumber [Time] Otomatis Batas Alpa */}
                  <div className="bg-rose-50/90 border border-rose-200/80 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] text-rose-900">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      Variabel <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-rose-300">[Time]</code> diambil dari:
                    </span>
                    <span className="font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                      Batas Otomatis Alpa ({formData.autoAlpaTime || '08:30'} WITA)
                    </span>
                  </div>

                  {/* Kalimat Suara AI */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-rose-600" />
                      Kalimat yang Diucapkan Suara AI:
                    </label>
                    <textarea
                      rows={2}
                      value={formData.parentVoiceTemplateAbsent ?? DEFAULT_PARENT_VOICE_ABSENT}
                      onChange={(e) => setFormData({
                        ...formData,
                        parentVoiceTemplateAbsent: e.target.value
                      })}
                      className="w-full text-xs bg-rose-50/40 border border-rose-200 rounded-xl p-2.5 text-rose-950 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none font-sans"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">Melodi: Perhatian Khusus</span>
                  <button
                    type="button"
                    onClick={() => handleTestParentVoice('ABSENT')}
                    disabled={isTestingParentVoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-70"
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${activeSingleTestingKey === 'ABSENT' ? 'animate-pulse' : ''}`} />
                    <span>{activeSingleTestingKey === 'ABSENT' ? 'Memutar...' : 'Tes Suara Belum Absen'}</span>
                  </button>
                </div>
              </div>

              {/* CARD 4: NOTIFIKASI PULANG SEKOLAH */}
              <div className="bg-white border border-blue-200/90 rounded-2xl p-4 space-y-3.5 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      <h4 className="text-xs font-extrabold text-blue-950 uppercase tracking-wider">
                        D. Notifikasi Pulang Sekolah
                      </h4>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      Status: Pulang
                    </span>
                  </div>

                  {/* Pesan Teks */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span>Format Pesan Notifikasi:</span>
                      <button
                        type="button"
                        onClick={() => handleResetSingleParentTemplate('DEPARTURE')}
                        className="text-[10px] text-blue-700 hover:underline font-semibold"
                      >
                        Reset Default
                      </button>
                    </label>
                    <textarea
                      rows={2}
                      value={formData.parentTemplateDeparture ?? formData.waTemplateDeparture ?? DEFAULT_PARENT_DEPARTURE_MESSAGE}
                      onChange={(e) => setFormData({
                        ...formData,
                        parentTemplateDeparture: e.target.value,
                        waTemplateDeparture: e.target.value
                      })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  {/* Kalimat Suara AI */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-blue-600" />
                      Kalimat yang Diucapkan Suara AI:
                    </label>
                    <textarea
                      rows={2}
                      value={formData.parentVoiceTemplateDeparture ?? DEFAULT_PARENT_VOICE_DEPARTURE}
                      onChange={(e) => setFormData({
                        ...formData,
                        parentVoiceTemplateDeparture: e.target.value
                      })}
                      className="w-full text-xs bg-blue-50/40 border border-blue-200 rounded-xl p-2.5 text-blue-950 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-sans"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">Melodi: Harmonis Pulang</span>
                  <button
                    type="button"
                    onClick={() => handleTestParentVoice('DEPARTURE')}
                    disabled={isTestingParentVoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-70"
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${activeSingleTestingKey === 'DEPARTURE' ? 'animate-pulse' : ''}`} />
                    <span>{activeSingleTestingKey === 'DEPARTURE' ? 'Memutar...' : 'Tes Suara Pulang'}</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Variable Tag Chips for Parent Notifications */}
            <div className="bg-white border border-emerald-100 rounded-2xl p-3 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-500 font-bold">Variabel Format Orang Tua:</span>
              {['[ParentName]', '[StudentName]', '[ClassName]', '[Time]', '[SchoolName]'].map((v) => (
                <span
                  key={v}
                  className="bg-emerald-100/70 text-emerald-800 border border-emerald-300/60 font-mono font-bold px-2 py-0.5 rounded-md"
                >
                  {v}
                </span>
              ))}
            </div>

            {/* Interactive Parent Voice Live Simulator Box */}
            <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-emerald-200" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                    Live Testing Suara AI Kehadiran Siswa (Orang Tua)
                  </span>
                </div>
                <span className="text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full font-medium">
                  Simulasi Audio Lengkap
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] text-emerald-200 font-medium mb-1">
                    Pilih Siswa:
                  </label>
                  <select
                    value={selectedTestStudentId || (students[0]?.id || '')}
                    onChange={(e) => setSelectedTestStudentId(e.target.value)}
                    className="w-full text-xs font-bold bg-white text-slate-900 border border-emerald-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-white focus:outline-none"
                  >
                    {students.slice(0, 30).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Kelas {s.className})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] text-emerald-200 font-medium mb-1">
                    Pilih Jenis Notifikasi:
                  </label>
                  <select
                    value={selectedTestParentType}
                    onChange={(e) => setSelectedTestParentType(e.target.value as ParentAttendanceType)}
                    className="w-full text-xs font-bold bg-white text-slate-900 border border-emerald-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-white focus:outline-none"
                  >
                    <option value="ARRIVAL">✅ Datang Tepat Waktu (Hadir)</option>
                    <option value="LATE">⚠️ Terlambat Masuk Sekolah</option>
                    <option value="ABSENT">🚨 Belum Absen / Alpa</option>
                    <option value="DEPARTURE">🏠 Notifikasi Pulang Sekolah</option>
                  </select>
                </div>

                <div className="sm:col-span-3 flex items-end">
                  <button
                    type="button"
                    onClick={() => handleTestParentVoice(selectedTestParentType)}
                    disabled={isTestingParentVoice}
                    className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white text-emerald-950 hover:bg-emerald-50 font-black rounded-xl text-xs transition shadow-md cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-2 sm:mt-0"
                  >
                    <Volume2 className={`w-4 h-4 text-emerald-600 ${isTestingParentVoice ? 'animate-pulse text-amber-500' : ''}`} />
                    <span>{isTestingParentVoice ? 'Memutar...' : 'Putar Suara AI'}</span>
                  </button>
                </div>
              </div>

              {testParentVoicePlayingText && (
                <div className="bg-black/25 border border-white/20 rounded-xl p-3 text-xs space-y-1 mt-2">
                  <p className="text-[11px] text-emerald-200 font-bold flex items-center gap-1">
                    <Volume2 className="w-3 h-3 animate-pulse" />
                    Simulasi Kalimat Suara AI:
                  </p>
                  <p className="italic text-white leading-relaxed font-sans">
                    "{testParentVoicePlayingText}"
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Action Button Section 4 */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="bg-violet-600 hover:bg-violet-700 text-white font-extrabold px-6 py-3 rounded-2xl shadow-md flex items-center gap-2 text-xs transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Pengaturan Suara & Notifikasi
          </button>
        </div>
      </div>
    )}

    {/* ========================================================================= */}
    {/* TAB 5: HALAMAN TERPISAH PENGATURAN & RESET PASSWORD (ADMIN, GURU & SISWA) */}
    {/* ========================================================================= */}
    {activeNavTab === 'password' && (
      <div id="section-password" className="space-y-6 animate-fadeIn">
        
        {/* Header Section Password */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  Pengaturan & Reset Password Akun Login
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola dan atur ulang kata sandi login untuk Akun Admin Utama, Pos Scanner Satpam, Seluruh Guru (No. HP/WA), dan Seluruh Siswa/Wali Murid (NISN).
                </p>
              </div>
            </div>

            {/* Role Tab Toggle */}
            <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl shrink-0 self-start sm:self-auto gap-1 border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setPasswordRoleTab('ADMIN_SCANNER');
                  setPasswordResetNotice(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  passwordRoleTab === 'ADMIN_SCANNER'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin & Scanner
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordRoleTab('TEACHER');
                  setSelectedTeacherId('');
                  setNewPasswordInput('123456');
                  setPasswordResetNotice(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  passwordRoleTab === 'TEACHER'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Akun Guru ({teachers.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordRoleTab('STUDENT');
                  setSelectedStudentId('');
                  setNewPasswordInput('123456');
                  setPasswordResetNotice(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  passwordRoleTab === 'STUDENT'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Akun Siswa ({students.length})
              </button>
            </div>
          </div>

          {/* Alert Notification */}
          {passwordResetNotice && (
            <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-fadeIn ${
              passwordResetNotice.type === 'success' 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}>
              {passwordResetNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="flex-1">{passwordResetNotice.msg}</span>
            </div>
          )}

          {/* ======================================= */}
          {/* TAB 1: ADMIN & POS SCANNER SATPAM      */}
          {/* ======================================= */}
          {passwordRoleTab === 'ADMIN_SCANNER' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Admin Password Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      Password Akun Admin Utama
                    </span>
                    <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      Username: admin
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-600 font-medium">Kata Sandi Baru</label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        placeholder="Masukkan password admin..."
                        className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 pr-10 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Default awal: <code className="font-mono bg-white border border-slate-200 px-1 py-0.5 rounded text-indigo-600 font-bold">admin123</code>
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setAdminPasswordInput('admin123')}
                      className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Default
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAdminPassword}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan Password Admin
                    </button>
                  </div>
                </div>

                {/* Scanner / Satpam Password Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-sky-600" />
                      Password Pos Scanner Satpam
                    </span>
                    <span className="text-[10px] font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-bold">
                      Username: satpam / pos
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-600 font-medium">Kata Sandi Baru</label>
                    <div className="relative">
                      <input
                        type={showScannerPassword ? 'text' : 'password'}
                        value={scannerPasswordInput}
                        onChange={(e) => setScannerPasswordInput(e.target.value)}
                        placeholder="Masukkan password scanner/satpam..."
                        className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 pr-10 font-mono font-bold focus:ring-2 focus:ring-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowScannerPassword(!showScannerPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showScannerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Default awal: <code className="font-mono bg-white border border-slate-200 px-1 py-0.5 rounded text-sky-600 font-bold">123456</code>
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setScannerPasswordInput('123456')}
                      className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Default
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveScannerPassword}
                      className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan Password Scanner
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Password yang disimpan akan langsung dienkripsi lokal dan otomatis disinkronkan ke Cloud Firestore sehingga tetap berlaku di semua HP, komputer, dan perangkat lain.
                </p>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* TAB 2: AKUN GURU (PENGATURAN & RESET)  */}
          {/* ======================================= */}
          {passwordRoleTab === 'TEACHER' && (
            <div className="space-y-6 text-xs">
              {/* Form Input Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Key className="w-4 h-4 text-indigo-600" />
                  Form Ganti / Reset Password Guru Spesifik
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Teacher */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-700 font-bold">Pilih Akun Guru (No. HP / WA)</label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => handleSelectTeacherForReset(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">-- Pilih Guru / No. HP --</option>
                      {sortedTeachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} (WA: {t.phone || '-'} | NIP: {t.nip}) {t.password ? '🔑 [Custom Password]' : '🔒 [Default: 123456]'}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">Username Login Guru adalah No. HP/WA atau NIP.</p>
                  </div>

                  {/* Password Input & Show/Hide */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-700 font-bold">Password Baru Guru</label>
                    <div className="relative">
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Masukkan password baru..."
                        className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 pr-10 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">Default password awal: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">123456</code></p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={handleBatchResetTeachers}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Kembalikan password semua guru ke 123456"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
                    Reset Massal Semua Password Guru ke 123456
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPasswordInput('123456')}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      Set Default (123456)
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTeacherPassword}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan Password Guru
                    </button>
                  </div>
                </div>
              </div>

              {/* Teacher Account Management Table */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-bold text-slate-800">Daftar Akun Guru & Reset Cepat</h4>
                    <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {filteredTeachersForPassword.length} Guru
                    </span>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari guru / NIP / HP..."
                      value={teacherSearchTerm}
                      onChange={(e) => setTeacherSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 pl-8 pr-3 py-1.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Nama Guru & NIP</th>
                        <th className="py-2.5 px-3">Username Login (No. HP)</th>
                        <th className="py-2.5 px-3">Status Password</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredTeachersForPassword.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                            Tidak ada data guru yang cocok dengan pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredTeachersForPassword.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-800 block">{t.name}</span>
                              <span className="text-[11px] text-slate-400 font-mono">NIP: {t.nip}</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {t.phone || <span className="text-slate-400 italic">-</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              {t.password ? (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                  <Key className="w-2.5 h-2.5 text-amber-600" />
                                  Password Kustom
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                  <Lock className="w-2.5 h-2.5 text-emerald-600" />
                                  Default: 123456
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleSelectTeacherForReset(t.id)}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] transition cursor-pointer"
                                >
                                  Pilih
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickResetTeacher(t)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 font-bold rounded-lg text-[11px] transition cursor-pointer"
                                  title="Reset password guru ini ke 123456"
                                >
                                  Reset ke 123456
                                </button>
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
          )}

          {/* ======================================= */}
          {/* TAB 3: AKUN SISWA (PENGATURAN & RESET) */}
          {/* ======================================= */}
          {passwordRoleTab === 'STUDENT' && (
            <div className="space-y-6 text-xs">
              
              {/* TOMBOL & KONTROL INFO PERBAIKAN SISTEM (PORTAL ORANG TUA) */}
              <div className={`border rounded-2xl p-4 sm:p-5 transition-all shadow-xs space-y-3.5 ${
                formData.parentPortalMaintenance 
                  ? 'bg-rose-50/90 border-rose-300 ring-1 ring-rose-200' 
                  : 'bg-amber-50/80 border-amber-200'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                      formData.parentPortalMaintenance
                        ? 'bg-rose-200 text-rose-800 border border-rose-300'
                        : 'bg-amber-100 text-amber-700 border border-amber-300'
                    }`}>
                      <Wrench className={`w-5 h-5 ${formData.parentPortalMaintenance ? 'animate-bounce' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">
                          Info & Status Perbaikan Sistem (Portal Orang Tua)
                        </h3>
                        {formData.parentPortalMaintenance ? (
                          <span className="bg-rose-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                            <ShieldAlert className="w-3 h-3" />
                            PERBAIKAN AKTIF (LOGIN ORANG TUA DITOLAK)
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            NORMAL (LOGIN DIIZINKAN)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Jika status perbaikan aktif, maka <strong className="text-rose-700">seluruh role Orang Tua/Siswa tidak bisa login (ditolak)</strong> meski user & password benar, dan akan muncul tulisan <strong className="text-rose-800">"Maaf ada perbaikan Sistem"</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Tombol Info Perbaikan Sistem & Toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleGlobalPerbaikan()}
                      className={`font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                        formData.parentPortalMaintenance
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                      }`}
                    >
                      <Wrench className="w-4 h-4" />
                      {formData.parentPortalMaintenance
                        ? 'Nonaktifkan Perbaikan (Buka Login)'
                        : 'Tombol Info Perbaikan Sistem (Tolak Login)'}
                    </button>
                  </div>
                </div>

                {/* Pesan Info Perbaikan Preview & Edit */}
                <div className="bg-white/90 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Teks Tampilan Saat Login Ditolak:
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">Tersimpan Otomatis</span>
                  </div>
                  <input
                    type="text"
                    value={formData.parentMaintenanceMessage || 'Maaf ada perbaikan Sistem'}
                    onChange={(e) => {
                      const updated = { ...formData, parentMaintenanceMessage: e.target.value };
                      setFormData(updated);
                      onSaveProfile(updated);
                    }}
                    placeholder="Maaf ada perbaikan Sistem"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 italic">
                    Teks di atas akan ditampilkan kepada pengguna orang tua ketika mencoba login saat mode perbaikan aktif.
                  </p>
                </div>
              </div>

              {/* Form Input Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Key className="w-4 h-4 text-indigo-600" />
                  Form Ganti / Reset Password Siswa Spesifik
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Student */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-slate-700 font-bold">Pilih Siswa / NISN Account</label>
                      {/* Class Filter */}
                      <select
                        value={studentClassFilter}
                        onChange={(e) => {
                          setStudentClassFilter(e.target.value);
                          setSelectedStudentId('');
                        }}
                        className="text-[11px] bg-white border border-slate-200 text-slate-700 font-bold rounded-lg px-2 py-0.5 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="ALL">Semua Kelas</option>
                        {Array.from(new Set(students.map(s => s.className))).sort().map(cls => (
                          <option key={cls} value={cls}>Kelas {cls}</option>
                        ))}
                      </select>
                    </div>

                    <select
                      value={selectedStudentId}
                      onChange={(e) => handleSelectStudentForReset(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">-- Pilih Siswa / NISN --</option>
                      {students
                        .filter(s => studentClassFilter === 'ALL' || s.className === studentClassFilter)
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.className}) - NISN: {s.nisn} {s.password ? '🔑 [Custom Password]' : '🔒 [Default: 123456]'}
                          </option>
                        ))}
                    </select>
                    <p className="text-[11px] text-slate-400">Username Login Siswa/Wali adalah Nomor NISN siswa.</p>
                  </div>

                  {/* Password Input & Show/Hide */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-700 font-bold">Password Baru Siswa</label>
                    <div className="relative">
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Masukkan password baru..."
                        className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl p-2.5 pr-10 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">Default password awal: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">123456</code></p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={handleBatchResetStudents}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Kembalikan password semua siswa ke 123456"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
                    Reset Massal Password ke 123456
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPasswordInput('123456')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      Set Input 123456
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveStudentPassword}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan Password Siswa
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {/* ========================================================================= */}
    {/* TAB 6: DATABASE & SINKRONISASI MULTI-PERANGKAT                           */}
    {/* ========================================================================= */}
    {activeNavTab === 'database' && (
      <div id="section-database" className="space-y-6 animate-fadeIn">
        {/* Cloud Database Synchronization & Direct Transfer Manager */}
        <div className="bg-gradient-to-br from-slate-900 to-sky-950 border border-sky-800/60 rounded-3xl p-6 shadow-md text-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-800/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5 text-sky-300" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                  Sinkronisasi Database Multi-Perangkat
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cloudStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : cloudStatus === 'quota_exceeded' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : cloudStatus === 'syncing' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-slate-700 text-slate-300'}`}>
                    {cloudStatus === 'connected' ? '● Terhubung Real-Time' : cloudStatus === 'quota_exceeded' ? 'Batas Kuota Cloud (Gunakan Transfer File)' : cloudStatus === 'syncing' ? 'Menyinkronkan...' : 'Mode Offline'}
                  </span>
                </h2>
                <p className="text-xs text-sky-200/70">
                  Penyelarasan seluruh 425 data siswa, guru, kelas, dan riwayat absensi antar HP dan Laptop sekolah.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMultiSyncModal(true)}
              className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md shadow-sky-950 transition-all cursor-pointer shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              Buka Panel Sinkronisasi Lengkap
            </button>
          </div>

          {cloudSyncFeedback && (
            <div className={`p-3.5 rounded-2xl text-xs font-bold border flex items-center gap-2 ${cloudSyncFeedback.type === 'success' ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200' : 'bg-rose-950/60 border-rose-700 text-rose-200'}`}>
              {cloudSyncFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{cloudSyncFeedback.msg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-sky-950/40 border border-sky-800/40 p-4 rounded-2xl space-y-2 flex flex-col justify-between">
              <div>
                <span className="font-extrabold text-sky-300 flex items-center gap-1.5">
                  <CloudUpload className="w-4 h-4 text-sky-400" />
                  1. Upload ke Cloud
                </span>
                <p className="text-[11px] text-sky-200/60 leading-relaxed mt-1">
                  Kirim data dari laptop ini ke Cloud agar bisa diakses perangkat lain.
                </p>
              </div>
              <button
                type="button"
                disabled={isCloudSyncing}
                onClick={handleManualUploadToCloud}
                className="w-full mt-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-extrabold py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm text-xs"
              >
                {isCloudSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                Upload ke Cloud
              </button>
            </div>

            <div className="bg-sky-950/40 border border-sky-800/40 p-4 rounded-2xl space-y-2 flex flex-col justify-between">
              <div>
                <span className="font-extrabold text-emerald-300 flex items-center gap-1.5">
                  <CloudDownload className="w-4 h-4 text-emerald-400" />
                  2. Unduh dari Cloud
                </span>
                <p className="text-[11px] text-sky-200/60 leading-relaxed mt-1">
                  Tarik data terbaru dari Cloud ke perangkat ini.
                </p>
              </div>
              <button
                type="button"
                disabled={isCloudSyncing}
                onClick={handleManualDownloadFromCloud}
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm text-xs"
              >
                {isCloudSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
                Unduh dari Cloud
              </button>
            </div>

            <div className="bg-sky-950/40 border border-sky-800/40 p-4 rounded-2xl space-y-2 flex flex-col justify-between">
              <div>
                <span className="font-extrabold text-amber-300 flex items-center gap-1.5">
                  <FileJson className="w-4 h-4 text-amber-400" />
                  3. Backup File Instan
                </span>
                <p className="text-[11px] text-sky-200/60 leading-relaxed mt-1">
                  Unduh file cadangan .json (bebas kuota & transfer instan 1 detik).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    downloadDatabaseBackupFile();
                  } catch (e: any) {
                    alert('Gagal mengunduh: ' + e?.message);
                  }
                }}
                className="w-full mt-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh File .JSON
              </button>
            </div>
          </div>
        </div>

        {/* Reset Data Default / Sampel Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              Reset ke Data Awal Sampel (425 Siswa)
            </h3>
            <p className="text-xs text-slate-500">
              Jika Anda ingin mengembalikan seluruh profil sekolah, daftar guru, dan data siswa ke konfigurasi contoh bawaan sistem.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <RotateCcw className="w-4 h-4 text-amber-600" />
            Reset Data Sampel
          </button>
        </div>
      </div>
    )}

      </form>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Reset Data Sampel</h3>
                <p className="text-xs text-slate-500">Kembalikan ke data awal bawaan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/50 p-3 rounded-2xl border border-amber-100">
              Apakah Anda yakin ingin mereset ulang seluruh data siswa, kelas, dan riwayat presensi ke sampel default sekolah? Data yang baru ditambahkan akan terhapus.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  resetToDefaultData();
                  window.location.reload();
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-amber-600/20 transition-all cursor-pointer"
              >
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Batch Reset Teacher Passwords Modal */}
      {confirmBatchTeacherModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center space-x-3 text-indigo-600">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Reset Massal Password Guru</h3>
                <p className="text-xs text-slate-500">Total {teachers.length} akun guru</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100">
              Apakah Anda yakin ingin mereset kata sandi login <strong>SELURUH GURU ({teachers.length} orang)</strong> menjadi kata sandi bawaan <code className="font-mono bg-white px-1.5 py-0.5 rounded text-indigo-600 font-bold border border-indigo-200">123456</code>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBatchTeacherModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeBatchResetTeachers}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Batch Reset Student Passwords Modal */}
      {confirmBatchStudentModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center space-x-3 text-indigo-600">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Reset Massal Password Siswa</h3>
                <p className="text-xs text-slate-500">Total {students.length} akun siswa</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100">
              Apakah Anda yakin ingin mereset kata sandi login <strong>SELURUH SISWA ({students.length} orang)</strong> menjadi kata sandi bawaan <code className="font-mono bg-white px-1.5 py-0.5 rounded text-indigo-600 font-bold border border-indigo-200">123123</code>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBatchStudentModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeBatchResetStudents}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Device Cloud & Direct Sync Modal */}
      <MultiDeviceSyncModal
        isOpen={showMultiSyncModal}
        onClose={() => setShowMultiSyncModal(false)}
        currentStudentCount={students.length}
        syncStatus={cloudStatus}
      />

    </div>
  );
};
