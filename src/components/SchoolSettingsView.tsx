import React, { useState, useEffect } from 'react';
import { SchoolProfile, Teacher, Student, SchoolHoliday } from '../types';
import { Settings, Save, School, Clock, MessageSquare, RotateCcw, CreditCard, CheckCircle2, Upload, Image as ImageIcon, Link, BookOpen, Plus, X, KeyRound, Lock, Eye, EyeOff, User, GraduationCap, Search, Check, RefreshCw, Users, ShieldAlert, Send, Smartphone, ShieldCheck, Zap, AlertCircle, Calendar, Trash2, Edit3, Tag, Flag, AlertTriangle, Sparkles, Filter, Cloud, CloudDownload, CloudUpload, FileJson, Download } from 'lucide-react';
import { resetToDefaultData, forceUploadAllToCloud, forceDownloadAllFromCloud, getCloudSyncStatus, CloudSyncStatus, downloadDatabaseBackupFile } from '../lib/storage';
import { sendWhatsAppGatewayMessage } from '../lib/exportUtils';
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
    { id: 'section-akademik', key: 'akademik', label: 'Akademik', icon: GraduationCap, color: 'text-blue-600', activeBg: 'bg-blue-600 text-white shadow-blue-100' },
    { id: 'section-whatsapp', key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-600', activeBg: 'bg-emerald-600 text-white shadow-emerald-100' },
    { id: 'section-password', key: 'password', label: 'Password', icon: KeyRound, color: 'text-purple-600', activeBg: 'bg-purple-600 text-white shadow-purple-100' },
  ];

  const handleJumpToSection = (sectionId: string, key: string) => {
    setActiveNavTab(key);
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -80;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

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

  // WhatsApp Gateway API Key state
  const [showWaApiKeySecret, setShowWaApiKeySecret] = useState<boolean>(false);
  const [testPhoneInput, setTestPhoneInput] = useState<string>('081234567890');
  const [isTestingWaApi, setIsTestingWaApi] = useState<boolean>(false);
  const [testWaResult, setTestWaResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestWaGateway = async () => {
    if (!formData.waApiKey || !formData.waApiKey.trim()) {
      setTestWaResult({
        success: false,
        message: 'Silakan isi kode API Key Gateway WhatsApp terlebih dahulu!'
      });
      return;
    }
    if (!testPhoneInput.trim()) {
      setTestWaResult({
        success: false,
        message: 'Masukkan nomor HP penerima uji coba terlebih dahulu!'
      });
      return;
    }

    setIsTestingWaApi(true);
    setTestWaResult(null);

    const testMsg = `[UJI COBA GATEWAY WA] Halo, ini adalah pesan tes dari Sistem Presensi SiHadirQR (${formData.name}) menggunakan ${formData.waGatewayProvider || 'Fonnte'}. Layanan notifikasi WhatsApp bekerja dengan baik!`;

    const result = await sendWhatsAppGatewayMessage(
      testPhoneInput,
      testMsg,
      formData.waApiKey,
      formData.waGatewayProvider || 'Fonnte'
    );

    setIsTestingWaApi(false);
    if (result.success) {
      setTestWaResult({
        success: true,
        message: `BERHASIL! Pesan uji coba WhatsApp sukses dikirim ke nomor ${testPhoneInput} via ${formData.waGatewayProvider || 'Fonnte'}.`
      });
    } else {
      setTestWaResult({
        success: false,
        message: `GAGAL KIRIM: ${result.error || 'Respon dari Gateway menunjukkan kesalahan API Key, Token Device tidak aktif, atau kuota habis.'}`
      });
    }
  };

  // Uji coba pengingat jadwal guru via WhatsApp
  const [selectedTestTeacherId, setSelectedTestTeacherId] = useState<string>('');
  const [isTestingTeacherWa, setIsTestingTeacherWa] = useState<boolean>(false);
  const [testTeacherWaResult, setTestTeacherWaResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestTeacherWaReminder = async () => {
    if (!formData.waApiKey || !formData.waApiKey.trim()) {
      setTestTeacherWaResult({
        success: false,
        message: 'Silakan masukkan kode API Key Gateway WhatsApp terlebih dahulu di atas!'
      });
      return;
    }

    const teacher = teachers.find(t => t.id === selectedTestTeacherId) || teachers[0];
    if (!teacher) {
      setTestTeacherWaResult({
        success: false,
        message: 'Belum ada data guru yang terdaftar di sistem.'
      });
      return;
    }

    if (!teacher.phone || !teacher.phone.trim()) {
      setTestTeacherWaResult({
        success: false,
        message: `Guru ${teacher.name} belum memiliki nomor telepon / WhatsApp yang terdaftar!`
      });
      return;
    }

    setIsTestingTeacherWa(true);
    setTestTeacherWaResult(null);

    const template = formData.waTemplateTeacherReminder || 
      "PENGINGAT MENGAJAR: Yth. Bpk/Ibu [TeacherName], mengingatkan bahwa jadwal mengajar mata pelajaran [Subject] di Kelas [ClassName] ([Room]) akan dimulai pada pukul [Time] WITA ([PeriodLabel]). Selamat menjalankan KBM!";

    const previewMsg = template
      .replace(/\[TeacherName\]/g, teacher.name)
      .replace(/\[Subject\]/g, teacher.subject1 || 'Mata Pelajaran')
      .replace(/\[ClassName\]/g, teacher.homeroomClassName || 'Kelas 7A')
      .replace(/\[Room\]/g, 'Ruang Kelas')
      .replace(/\[Time\]/g, formData.startTime || '07:30')
      .replace(/\[PeriodLabel\]/g, 'JP 1')
      .replace(/\[Period\]/g, '1')
      .replace(/\[SchoolName\]/g, formData.name);

    const result = await sendWhatsAppGatewayMessage(
      teacher.phone,
      previewMsg,
      formData.waApiKey,
      formData.waGatewayProvider || 'Fonnte'
    );

    setIsTestingTeacherWa(false);
    if (result.success) {
      setTestTeacherWaResult({
        success: true,
        message: `BERHASIL! Pesan pengingat jadwal berhasil dikirim ke WhatsApp Guru: ${teacher.name} (${teacher.phone}).`
      });
    } else {
      setTestTeacherWaResult({
        success: false,
        message: `GAGAL: ${result.error || 'Periksa status Token Device dan koneksi WhatsApp Gateway.'}`
      });
    }
  };

  // Reset Default Templates Constants & Handlers
  const DEFAULT_WA_TEACHER_REMINDER = "PENGINGAT MENGAJAR: Yth. Bpk/Ibu [TeacherName], mengingatkan bahwa jadwal mengajar mata pelajaran [Subject] di Kelas [ClassName] ([Room]) akan dimulai pada pukul [Time] WITA ([PeriodLabel]). Selamat menjalankan KBM!";
  const DEFAULT_WA_ARRIVAL = "Yth. Bpk/Ibu [ParentName], memberitahukan bahwa siswa [StudentName] ([ClassName]) telah Tiba di Sekolah pada [Time] WITA dalam keadaan TEPAT WAKTU.";
  const DEFAULT_WA_LATE = "PEMBERITAHUAN TERLAMBAT: Yth. Bpk/Ibu [ParentName], siswa [StudentName] ([ClassName]) Tiba di Sekolah pukul [Time] WITA (Terlambat). Mohon perhatiannya.";
  const DEFAULT_WA_DEPARTURE = "PEMBERITAHUAN PULANG: Yth. Bpk/Ibu [ParentName], memberitahukan bahwa siswa [StudentName] ([ClassName]) telah Pulang dari Sekolah pada pukul [Time] WITA. Terima kasih.";
  const DEFAULT_WA_ABSENT = "PERHATIAN: Yth. Bpk/Ibu [ParentName], siswa [StudentName] ([ClassName]) Belum Absen hingga pukul 08:30 WITA hari ini tanpa keterangan. Mohon konfirmasi.";

  const [templateResetToast, setTemplateResetToast] = useState<string | null>(null);

  const handleResetTeacherTemplate = () => {
    setFormData(prev => ({
      ...prev,
      waTemplateTeacherReminder: DEFAULT_WA_TEACHER_REMINDER
    }));
    setTemplateResetToast('Format pesan pengingat jadwal guru berhasil dikembalikan ke format awal (default).');
    setTimeout(() => setTemplateResetToast(null), 3500);
  };

  const handleResetAllParentTemplates = () => {
    setFormData(prev => ({
      ...prev,
      waTemplateArrival: DEFAULT_WA_ARRIVAL,
      waTemplateLate: DEFAULT_WA_LATE,
      waTemplateDeparture: DEFAULT_WA_DEPARTURE,
      waTemplateAbsent: DEFAULT_WA_ABSENT
    }));
    setTemplateResetToast('Semua format pesan presensi orang tua (Hadir, Terlambat, Pulang, Alpa) berhasil dikembalikan ke format awal (default).');
    setTimeout(() => setTemplateResetToast(null), 3500);
  };

  const handleResetSingleParentTemplate = (type: 'ARRIVAL' | 'LATE' | 'DEPARTURE' | 'ABSENT') => {
    if (type === 'ARRIVAL') {
      setFormData(prev => ({ ...prev, waTemplateArrival: DEFAULT_WA_ARRIVAL }));
      setTemplateResetToast('Format pesan presensi Hadir berhasil di-reset ke format awal.');
    } else if (type === 'LATE') {
      setFormData(prev => ({ ...prev, waTemplateLate: DEFAULT_WA_LATE }));
      setTemplateResetToast('Format pesan presensi Terlambat berhasil di-reset ke format awal.');
    } else if (type === 'DEPARTURE') {
      setFormData(prev => ({ ...prev, waTemplateDeparture: DEFAULT_WA_DEPARTURE }));
      setTemplateResetToast('Format pesan presensi Pulang berhasil di-reset ke format awal.');
    } else if (type === 'ABSENT') {
      setFormData(prev => ({ ...prev, waTemplateAbsent: DEFAULT_WA_ABSENT }));
      setTemplateResetToast('Format pesan presensi Alpa berhasil di-reset ke format awal.');
    }
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
  const [holidayDateInput, setHolidayDateInput] = useState<string>(() => new Date().toISOString().split('T')[0]);
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
    const effectiveDate = holidayDateInput || new Date().toISOString().split('T')[0];

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
  const [passwordRoleTab, setPasswordRoleTab] = useState<'TEACHER' | 'STUDENT'>('TEACHER');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('123456');
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);
  const [studentClassFilter, setStudentClassFilter] = useState<string>('ALL');
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const [teacherSearchTerm, setTeacherSearchTerm] = useState<string>('');
  const [passwordResetNotice, setPasswordResetNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

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
            Pengaturan Profil Sekolah & Kartu Pelajar
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
        
        {/* Identitas Utama Sekolah */}
        <div id="section-profil-sekolah" className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4 scroll-mt-24">
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

        {/* Format & Bentuk Layout Kartu Pelajar */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            Pengaturan Bentuk & Format Kartu Pelajar (KTS Digital)
          </h2>

          <p className="text-xs text-slate-500">
            Pilih orientasi cetak dan tampilan Kartu Tanda Pelajar (KTS) yang tersimpan untuk seluruh database siswa.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            
            {/* Opsi Portrait */}
            <div
              onClick={() => setFormData({ ...formData, cardOrientation: 'PORTRAIT' })}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 relative ${
                formData.cardOrientation === 'PORTRAIT' || !formData.cardOrientation
                  ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-12 h-16 bg-gradient-to-b from-indigo-800 to-indigo-900 rounded-lg p-1 flex flex-col items-center justify-between border border-indigo-400 shrink-0 shadow-sm">
                <div className="w-full h-3 bg-white/20 rounded-xs"></div>
                <div className="w-5 h-6 bg-white/80 rounded-sm my-1"></div>
                <div className="w-4 h-4 bg-white rounded-xs"></div>
              </div>

              <div className="space-y-1 pr-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-extrabold text-slate-900">Bentuk Portrait (Tegak)</h3>
                  {(formData.cardOrientation === 'PORTRAIT' || !formData.cardOrientation) && (
                    <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                      AKTIF
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Header biru indigo dengan logo sekolah & kabupaten, foto pas foto di tengah, data biodata rapi, dan QR code presensi di bagian bawah (Sesuai Desain Resmi).
                </p>
              </div>

              {(formData.cardOrientation === 'PORTRAIT' || !formData.cardOrientation) && (
                <CheckCircle2 className="w-5 h-5 text-indigo-600 absolute top-3.5 right-3.5" />
              )}
            </div>

            {/* Opsi Landscape */}
            <div
              onClick={() => setFormData({ ...formData, cardOrientation: 'LANDSCAPE' })}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 relative ${
                formData.cardOrientation === 'LANDSCAPE'
                  ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-16 h-12 bg-gradient-to-r from-indigo-900 to-slate-900 rounded-lg p-1.5 flex items-center justify-between border border-indigo-400 shrink-0 shadow-sm">
                <div className="w-4 h-6 bg-amber-400 rounded-xs"></div>
                <div className="flex-1 px-1 space-y-1">
                  <div className="w-full h-1.5 bg-white/60 rounded-xs"></div>
                  <div className="w-3/4 h-1 bg-white/40 rounded-xs"></div>
                </div>
                <div className="w-3 h-3 bg-white rounded-xs"></div>
              </div>

              <div className="space-y-1 pr-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-extrabold text-slate-900">Bentuk Landscape (Mendatar)</h3>
                  {formData.cardOrientation === 'LANDSCAPE' && (
                    <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                      AKTIF
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Desain kartu pelajar standar horisontal dengan foto siswa di kiri, biodata di tengah, serta tanda tangan kepala sekolah & QR code di kanan bawah.
                </p>
              </div>

              {formData.cardOrientation === 'LANDSCAPE' && (
                <CheckCircle2 className="w-5 h-5 text-indigo-600 absolute top-3.5 right-3.5" />
              )}
            </div>

          </div>
        </div>

        {/* Aturan Jam Masuk, Jam Pulang & Otomatis Alpa */}
        <div id="section-jam-libur" className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5 scroll-mt-24">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
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

            {/* Jam Pulang Sekolah (Scan QR Pulang Aktif) */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-1">
              <label className="block text-amber-950 font-extrabold mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Jam Pulang Sekolah (Scan QR Pulang Mulai Bekerja)
              </label>
              <input
                type="text"
                value={formData.endTime || '15:00'}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full bg-white border border-amber-300 text-slate-900 rounded-xl p-2.5 font-mono font-bold focus:ring-2 focus:ring-amber-500 shadow-xs text-xs"
                placeholder="15:00"
              />
              <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                🎯 Menentukan jam berapa fitur <strong>Scan QR Pulang</strong> mulai bisa digunakan di scanner pada hari aktif belajar.
              </p>
            </div>

            {/* Waktu Batas Otomatis Alpa */}
            <div className={`border rounded-2xl p-3.5 space-y-2 transition-all ${
              formData.autoAlpaEnabled !== false
                ? 'bg-rose-50/60 border-rose-200/80'
                : 'bg-slate-50 border-slate-200 opacity-90'
            }`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="block text-slate-900 font-extrabold flex items-center gap-1.5 text-xs">
                    <Clock className={`w-3.5 h-3.5 ${formData.autoAlpaEnabled !== false ? 'text-rose-600' : 'text-slate-400'}`} />
                    Waktu Batas Otomatis Alpa (WITA)
                  </label>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    formData.autoAlpaEnabled !== false
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}>
                    {formData.autoAlpaEnabled !== false ? 'AKTIF' : 'NON-AKTIF'}
                  </span>
                </div>

                {/* Saklar / Toggle Switch Menonaktifkan / Mengaktifkan Otomatis Alpa */}
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={formData.autoAlpaEnabled !== false}
                    onChange={(e) => setFormData({ ...formData, autoAlpaEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-rose-600"></div>
                  <span className="ml-2 text-xs font-bold text-slate-800">
                    {formData.autoAlpaEnabled !== false ? 'Aktif' : 'Non-aktif'}
                  </span>
                </label>
              </div>

              <input
                type="text"
                disabled={formData.autoAlpaEnabled === false}
                value={formData.autoAlpaTime || '08:30'}
                onChange={(e) => setFormData({ ...formData, autoAlpaTime: e.target.value })}
                className={`w-full rounded-xl p-2.5 font-mono font-bold focus:ring-2 shadow-xs text-xs transition-all ${
                  formData.autoAlpaEnabled !== false
                    ? 'bg-white border border-rose-300 text-slate-900 focus:ring-rose-500'
                    : 'bg-slate-100 border border-slate-300 text-slate-400 cursor-not-allowed'
                }`}
                placeholder="08:30"
              />

              {formData.autoAlpaEnabled !== false ? (
                <p className="text-[11px] text-rose-900 font-medium leading-relaxed">
                  ⚠️ Pada hari aktif belajar, siswa yang belum presensi atau izin hingga jam ini secara otomatis diubah menjadi <strong>ALPA</strong>. Jam ini juga menjadi <strong>BATAS MODE SCAN MASUK DITUTUP (TIDAK BEKERJA)</strong> dan akan dibuka kembali pada jam masuk sekolah ({formData.startTime || '07:00'} WITA).
                </p>
              ) : (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2.5 text-[11px] font-medium flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Otomatis Alpa Dinonaktifkan.</strong> Siswa yang belum hadir tidak akan diubah menjadi ALPA secara otomatis oleh sistem, dan mode scan masuk tidak akan ditutup oleh batas jam alpa.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pengaturan Daftar Mata Pelajaran & Periode Akademik Sekolah */}
        <div id="section-akademik" className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5 scroll-mt-24">
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

        {/* Templates & Gateway WhatsApp */}
        <div id="section-whatsapp" className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6 scroll-mt-24">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Template Pesan Otomatis & API Key Gateway WhatsApp Orang Tua
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasikan API Key Gateway (Fonnte/Lainnya) agar pesan notifikasi presensi terkirim secara otomatis tanpa perlu konfirmasi manual.
              </p>
            </div>

            {/* Gateway Status Badge */}
            <div className="shrink-0">
              {formData.waApiKey && formData.waApiKey.trim() ? (
                <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Gateway Terhubung ({formData.waGatewayProvider || 'Fonnte'})
                </span>
              ) : (
                <span className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Mode Manual (Link wa.me)
                </span>
              )}
            </div>
          </div>

          {/* SECTION 1: KODE API KEY GATEWAY WHATSAPP (FONNTE / LAINNYA) */}
          <div className="bg-gradient-to-br from-emerald-50/60 via-slate-50 to-emerald-50/30 border border-emerald-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Pengaturan API Key Gateway WhatsApp (Fonnte / Lainnya)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Masukkan Token Device / API Key dari penyedia gateway (seperti <strong className="text-emerald-700">fonnte.com</strong>) agar pesan otomatis bekerja.
                  </p>
                </div>
              </div>

              {/* Gateway Enable Toggle */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.waGatewayEnabled !== false}
                  onChange={(e) => setFormData({ ...formData, waGatewayEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-2 text-xs font-bold text-slate-700 hidden sm:inline">
                  {formData.waGatewayEnabled !== false ? 'Otomatis Aktif' : 'Non-aktif'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Provider Selection */}
              <div>
                <label className="block text-slate-800 font-bold text-xs mb-1">
                  Penyedia Gateway WhatsApp
                </label>
                <select
                  value={formData.waGatewayProvider || 'Fonnte'}
                  onChange={(e) => setFormData({ ...formData, waGatewayProvider: e.target.value })}
                  className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
                >
                  <option value="Fonnte">Fonnte (Rekomendasi - fonnte.com)</option>
                  <option value="Wablas">Wablas Gateway</option>
                  <option value="Lainnya">Lainnya / Generic Fonnte API</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Layanan disarankan: <strong>fonnte.com</strong></p>
              </div>

              {/* API Key Input */}
              <div className="md:col-span-2">
                <label className="block text-slate-800 font-bold text-xs mb-1 flex items-center justify-between">
                  <span>Kode API Key / Device Token Gateway</span>
                  <a
                    href="https://fonnte.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-emerald-700 hover:underline flex items-center gap-0.5 font-bold"
                  >
                    Dapatkan Token di fonnte.com
                    <Link className="w-2.5 h-2.5" />
                  </a>
                </label>
                <div className="relative">
                  <input
                    type={showWaApiKeySecret ? 'text' : 'password'}
                    value={formData.waApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, waApiKey: e.target.value })}
                    placeholder="Contoh: x8K9p2L1zQ... (Token Device Fonnte)"
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 pr-10 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWaApiKeySecret(!showWaApiKeySecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showWaApiKeySecret ? "Sembunyikan API Key" : "Tampilkan API Key"}
                  >
                    {showWaApiKeySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  🔑 Tempelkan kode Token Fonnte Anda dari Menu <strong>Device</strong> di Fonnte.
                </p>
              </div>
            </div>

            {/* Test WhatsApp API Key Live Sandbox */}
            <div className="bg-white border border-emerald-200/80 rounded-xl p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  Uji Coba Pengiriman Pesan WhatsApp (Test API Key)
                </span>
                <span className="text-[10px] text-slate-500">Pastikan perangkat Anda terhubung di Fonnte</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={testPhoneInput}
                    onChange={(e) => setTestPhoneInput(e.target.value)}
                    placeholder="Nomor HP tujuan (misal: 081234567890)..."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTestWaGateway}
                  disabled={isTestingWaApi}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isTestingWaApi ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Mengirim Test...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Tes Kirim Pesan WA
                    </>
                  )}
                </button>
              </div>

              {testWaResult && (
                <div className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                  testWaResult.success 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                }`}>
                  {testWaResult.success ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="flex-1">{testWaResult.message}</span>
                </div>
              )}
            </div>

          </div>

          {/* SECTION 2: PENGINGAT JADWAL KBM GURU VIA WHATSAPP */}
          <div className="bg-gradient-to-br from-indigo-50/80 via-white to-emerald-50/60 border border-indigo-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Pengingat Otomatis Jadwal Mengajar Guru via WhatsApp (KBM)
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    formData.waTeacherReminderEnabled !== false
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}>
                    {formData.waTeacherReminderEnabled !== false ? 'AKTIF' : 'NON-AKTIF'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Sistem membaca jadwal pelajaran KBM dari database, mencocokkan waktu aktif real-time, dan mengirim pesan pengingat ke nomor WA guru saat jam mengajar dimulai.
                </p>
              </div>

              {/* Saklar / Toggle Switch Menonaktifkan / Mengaktifkan Fitur Pengingat WhatsApp Guru */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={formData.waTeacherReminderEnabled !== false}
                  onChange={(e) => setFormData({ ...formData, waTeacherReminderEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-2.5 text-xs font-bold text-slate-800">
                  {formData.waTeacherReminderEnabled !== false ? 'Pengingat Aktif' : 'Non-aktif'}
                </span>
              </label>
            </div>

            {/* Waktu Kirim & Template */}
            <div className={`space-y-4 transition-all ${formData.waTeacherReminderEnabled === false ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-slate-800 font-bold text-xs mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Waktu Pengiriman Pengingat
                  </label>
                  <select
                    value={formData.waTeacherReminderMinutesBefore ?? 0}
                    onChange={(e) => setFormData({ ...formData, waTeacherReminderMinutesBefore: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
                  >
                    <option value={0}>Tepat jam dimulai</option>
                    <option value={3}>3 menit sebelum jam dimulai</option>
                    <option value={5}>5 menit sebelum jam dimulai</option>
                    <option value={10}>10 menit sebelum jam dimulai</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Pesan pengingat dikirim bertahap tiap 30 detik ke nomor WA guru untuk mencegah pemblokiran.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-800 font-bold text-xs">
                      Format Template Pesan Pengingat Jadwal Guru
                    </label>
                    <button
                      type="button"
                      onClick={handleResetTeacherTemplate}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                      title="Kembalikan format pesan pengingat jadwal guru ke format default awal"
                    >
                      <RotateCcw className="w-3 h-3 text-indigo-600" />
                      Reset Default Pesan
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={formData.waTemplateTeacherReminder || DEFAULT_WA_TEACHER_REMINDER}
                    onChange={(e) => setFormData({ ...formData, waTemplateTeacherReminder: e.target.value })}
                    placeholder="Tuliskan format pesan pengingat jadwal mengajar guru..."
                    className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs font-medium shadow-xs"
                  />
                  
                  <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100 mt-1.5 space-y-1">
                    <p className="text-[10px] font-bold text-slate-700">
                      Variabel dinamis yang dapat digunakan:
                    </p>
                    <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                      <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-bold">[TeacherName]</span>
                      <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-bold">[Subject]</span>
                      <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-bold">[ClassName]</span>
                      <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-bold">[Room]</span>
                      <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-bold">[Time]</span>
                      <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-bold">[PeriodLabel]</span>
                      <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-bold">[SchoolName]</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uji Coba Pengingat Guru Sandbox */}
              <div className="bg-white border border-indigo-200/90 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-indigo-600" />
                    Uji Coba Pengiriman Pengingat Jadwal ke WhatsApp Guru
                  </span>
                  <span className="text-[10px] text-slate-500">Kirim pesan simulasi ke nomor WA guru</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <select
                      value={selectedTestTeacherId}
                      onChange={(e) => setSelectedTestTeacherId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">-- Pilih Guru Tujuan Uji Coba --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.subject1}) - {t.phone || 'No WA belum ada'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestTeacherWaReminder}
                    disabled={isTestingTeacherWa}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isTestingTeacherWa ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Tes Kirim Pengingat Guru
                      </>
                    )}
                  </button>
                </div>

                {testTeacherWaResult && (
                  <div className={`p-2.5 rounded-xl text-xs font-medium flex items-start gap-2 ${
                    testTeacherWaResult.success 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                      : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}>
                    {testTeacherWaResult.success ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="flex-1">{testTeacherWaResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Toast / Alert Feedback saat Template di-Reset */}
          {templateResetToast && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{templateResetToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setTemplateResetToast(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* SECTION 3: TEMPLATE PESAN NOTIFIKASI PRESENSI SISWA (NOTIFIKASI ORANG TUA) */}
          <div className="bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 border border-emerald-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    Format Template Pesan Presensi Siswa (Notifikasi WhatsApp Orang Tua)
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    formData.waParentNotificationEnabled !== false
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}>
                    {formData.waParentNotificationEnabled !== false ? 'AKTIF' : 'NON-AKTIF'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Kirim notifikasi otomatis ke nomor WhatsApp orang tua/wali murid saat siswa scan masuk, pulang, atau saat dinyatakan alpa.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                {/* Tombol Reset Default Semua Pesan Presensi */}
                <button
                  type="button"
                  onClick={handleResetAllParentTemplates}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-white hover:bg-emerald-100/70 px-3 py-1.5 rounded-xl border border-emerald-300 transition-all cursor-pointer shadow-2xs"
                  title="Kembalikan semua template pesan presensi orang tua (Hadir, Terlambat, Pulang, Alpa) ke format default awal"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Reset Default Pesan</span>
                </button>

                {/* Saklar / Toggle Switch Menonaktifkan / Mengaktifkan Pesan WhatsApp ke Orang Tua */}
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={formData.waParentNotificationEnabled !== false}
                    onChange={(e) => setFormData({ ...formData, waParentNotificationEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-2 text-xs font-bold text-slate-800">
                    {formData.waParentNotificationEnabled !== false ? 'Aktif' : 'Non-aktif'}
                  </span>
                </label>
              </div>
            </div>

            {formData.waParentNotificationEnabled === false && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Notifikasi WhatsApp ke Orang Tua sedang Dinonaktifkan.</strong> Sistem tetap mencatat riwayat presensi siswa, namun tidak akan mengirimkan pesan WhatsApp ke nomor orang tua/wali saat scan masuk, pulang, maupun alpa.
                </span>
              </div>
            )}

            <div className={`space-y-3.5 text-xs transition-all ${formData.waParentNotificationEnabled === false ? 'opacity-70' : ''}`}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">
                    Pesan Notifikasi Presensi Tepat Waktu (Hadir)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleResetSingleParentTemplate('ARRIVAL')}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-emerald-700 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer"
                    title="Kembalikan pesan Hadir ke format awal"
                  >
                    <RotateCcw className="w-2.5 h-2.5 text-slate-400 group-hover:text-emerald-600" />
                    Reset
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={formData.waTemplateArrival}
                  onChange={(e) => setFormData({ ...formData, waTemplateArrival: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 font-medium shadow-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">
                    Pesan Notifikasi Siswa Terlambat
                  </label>
                  <button
                    type="button"
                    onClick={() => handleResetSingleParentTemplate('LATE')}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-emerald-700 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer"
                    title="Kembalikan pesan Terlambat ke format awal"
                  >
                    <RotateCcw className="w-2.5 h-2.5 text-slate-400 group-hover:text-emerald-600" />
                    Reset
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={formData.waTemplateLate}
                  onChange={(e) => setFormData({ ...formData, waTemplateLate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 font-medium shadow-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">
                    Pesan Notifikasi Siswa Sudah Pulang
                  </label>
                  <button
                    type="button"
                    onClick={() => handleResetSingleParentTemplate('DEPARTURE')}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-emerald-700 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer"
                    title="Kembalikan pesan Pulang ke format awal"
                  >
                    <RotateCcw className="w-2.5 h-2.5 text-slate-400 group-hover:text-emerald-600" />
                    Reset
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={formData.waTemplateDeparture || DEFAULT_WA_DEPARTURE}
                  onChange={(e) => setFormData({ ...formData, waTemplateDeparture: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 font-medium shadow-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">
                    Pesan Notifikasi Siswa Belum Absen / Alpa
                  </label>
                  <button
                    type="button"
                    onClick={() => handleResetSingleParentTemplate('ABSENT')}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-emerald-700 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer"
                    title="Kembalikan pesan Alpa ke format awal"
                  >
                    <RotateCcw className="w-2.5 h-2.5 text-slate-400 group-hover:text-emerald-600" />
                    Reset
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={formData.waTemplateAbsent || DEFAULT_WA_ABSENT}
                  onChange={(e) => setFormData({ ...formData, waTemplateAbsent: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 font-medium shadow-xs"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5">
                <p className="text-[11px] font-bold text-slate-700">
                  Variabel otomatis yang dapat digunakan pada template:
                </p>
                <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-emerald-700 font-bold">[ParentName]</span>
                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-emerald-700 font-bold">[StudentName]</span>
                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-emerald-700 font-bold">[ClassName]</span>
                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-emerald-700 font-bold">[Time]</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reset Password Akun Guru & Siswa */}
        <div id="section-password" className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                Pengaturan & Reset Password Akun Login (Guru & Siswa)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur ulang kata sandi login untuk akun Guru (No. HP / WA atau NIP) dan Siswa / Wali Murid (NISN).
              </p>
            </div>

            {/* Role Tab Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setPasswordRoleTab('TEACHER');
                  setSelectedTeacherId('');
                  setNewPasswordInput('123456');
                  setPasswordResetNotice(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  passwordRoleTab === 'TEACHER'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Password Guru ({teachers.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordRoleTab('STUDENT');
                  setSelectedStudentId('');
                  setNewPasswordInput('123456');
                  setPasswordResetNotice(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  passwordRoleTab === 'STUDENT'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Password Siswa ({students.length})
              </button>
            </div>
          </div>

          {/* Alert Notification */}
          {passwordResetNotice && (
            <div className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2 animate-fadeIn ${
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

          {/* TAB RESET GURU */}
          {passwordRoleTab === 'TEACHER' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Select Teacher */}
                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-bold">Pilih Akun Guru (No. HP / WA)</label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => handleSelectTeacherForReset(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Pilih Guru / No. HP --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} (WA: {t.phone || '-'} | NIP: {t.nip}) {t.password ? '🔑 [Custom Password]' : '🔒 [Default: 123456]'}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">Pilih nama guru yang akan diatur ulang passwordnya (Username Login: No. HP / WA).</p>
                </div>

                {/* Password Input & Show/Hide */}
                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-bold">Password Baru</label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Masukkan password baru..."
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 pr-10 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
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
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleBatchResetTeachers}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Kembalikan password semua guru ke 123456"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
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
          )}

          {/* TAB RESET SISWA */}
          {passwordRoleTab === 'STUDENT' && (
            <div className="space-y-4 text-xs">
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
                      className="text-[11px] bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg px-2 py-0.5 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                  <p className="text-[11px] text-slate-400">Dipakai siswa & wali murid saat login menggunakan NISN.</p>
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
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 pr-10 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
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
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleBatchResetStudents}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Kembalikan password semua siswa ke 123456"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  Reset Massal Semua Password Siswa ke 123456
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
                    onClick={handleSaveStudentPassword}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Simpan Password Siswa
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

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

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-3 rounded-2xl shadow-md flex items-center gap-2 text-xs transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Seluruh Pengaturan
          </button>
        </div>

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
              Apakah Anda yakin ingin mereset kata sandi login <strong>SELURUH SISWA ({students.length} orang)</strong> menjadi kata sandi bawaan <code className="font-mono bg-white px-1.5 py-0.5 rounded text-indigo-600 font-bold border border-indigo-200">123456</code>?
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
