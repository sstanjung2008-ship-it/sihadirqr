import React, { useState } from 'react';
import { Teacher, SchoolProfile, UserSession, SchoolClass } from '../types';
import { 
  UserCircle, 
  GraduationCap, 
  KeyRound, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Phone, 
  Mail, 
  BookOpen, 
  Award, 
  Calendar, 
  MapPin, 
  Lock, 
  Sparkles, 
  Edit3, 
  Save, 
  X, 
  Info,
  Building2,
  Check,
  UserCheck,
  Volume2,
  VolumeX,
  Bell
} from 'lucide-react';
import { 
  isKbmVoiceReminderEnabled, 
  setKbmVoiceReminderEnabled, 
  testKbmVoiceReminder,
  playTeacherKbmVoiceReminder 
} from '../lib/kbmVoiceReminder';

interface TeacherAccountViewProps {
  teacher: Teacher | null;
  schoolProfile: SchoolProfile;
  userSession: UserSession | null;
  classes?: SchoolClass[];
  onUpdateTeacher: (teacher: Teacher) => void;
  onLogout?: () => void;
}

export const TeacherAccountView: React.FC<TeacherAccountViewProps> = ({
  teacher,
  schoolProfile,
  userSession,
  classes = [],
  onUpdateTeacher,
  onLogout
}) => {
  // Password change state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Profile edit state (Contact & Basic Info)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editPhone, setEditPhone] = useState(teacher?.phone || '');
  const [editEmail, setEditEmail] = useState(teacher?.email || '');
  const [editBirthPlace, setEditBirthPlace] = useState(teacher?.birthPlace || '');
  const [editBirthDate, setEditBirthDate] = useState(teacher?.birthDate || '');
  const [editPhotoUrl, setEditPhotoUrl] = useState(teacher?.photoUrl || '');
  const [profileNotice, setProfileNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // KBM Voice reminder state
  const [voiceReminderEnabled, setVoiceReminderEnabledState] = useState(isKbmVoiceReminderEnabled());
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  const handleToggleVoiceReminder = () => {
    const next = !voiceReminderEnabled;
    setVoiceReminderEnabledState(next);
    setKbmVoiceReminderEnabled(next);
  };

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    if (teacher) {
      await playTeacherKbmVoiceReminder({
        teacherName: teacher.name,
        subject: teacher.subject1 || 'Mata Pelajaran',
        className: teacher.homeroomClassName || '7A',
        room: 'Ruang Kelas',
        periodNumber: 1,
        jpCount: 2,
        startTime: '07:30',
        endTime: '09:00'
      });
    } else {
      await testKbmVoiceReminder();
    }
    setIsTestingVoice(false);
  };

  if (!teacher) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 space-y-3">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-amber-900">Data Akun Guru Tidak Ditemukan</h2>
          <p className="text-sm text-amber-700 max-w-md mx-auto">
            Sistem tidak menemukan profil data guru yang terkait dengan sesi login aktif ini. Silakan hubungi Administrator sekolah.
          </p>
          {onLogout && (
            <button
              onClick={onLogout}
              className="mt-4 px-5 py-2.5 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-700 transition shadow-sm cursor-pointer"
            >
              Keluar & Login Ulang
            </button>
          )}
        </div>
      </div>
    );
  }

  const isCustomPassword = Boolean(teacher.password && teacher.password !== '123456');

  // Format Additional Duty Label
  const getAdditionalDutyLabel = () => {
    switch (teacher.additionalDuty) {
      case 'WALI_KELAS':
        return `Wali Kelas ${teacher.homeroomClassName || ''}`;
      case 'BK':
        return 'Guru Bimbingan & Konseling (BK)';
      case 'HUMAS':
        return 'Hubungan Masyarakat (Humas)';
      case 'WAKIL_KEPALA_SEKOLAH':
        return 'Wakil Kepala Sekolah';
      case 'TIDAK_ADA':
      default:
        return 'Guru Mata Pelajaran';
    }
  };

  // Format Birth date
  const formatBirthDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Handle save profile changes
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);

    const updated: Teacher = {
      ...teacher,
      phone: editPhone.trim(),
      email: editEmail.trim(),
      birthPlace: editBirthPlace.trim(),
      birthDate: editBirthDate.trim(),
      photoUrl: editPhotoUrl.trim()
    };

    onUpdateTeacher(updated);
    setIsEditingProfile(false);
    setProfileNotice({
      type: 'success',
      message: 'Data identitas kontak berhasil diperbarui!'
    });
  };

  // Handle password submission
  const handleSubmitChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);

    const trimmedPass = newPassword.trim();
    if (trimmedPass.length < 6) {
      setPasswordNotice({
        type: 'error',
        message: 'Password baru minimal harus terdiri dari 6 karakter!'
      });
      return;
    }

    if (trimmedPass !== confirmPassword.trim()) {
      setPasswordNotice({
        type: 'error',
        message: 'Konfirmasi password tidak cocok dengan password baru!'
      });
      return;
    }

    const updatedTeacher: Teacher = {
      ...teacher,
      password: trimmedPass
    };

    onUpdateTeacher(updatedTeacher);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordNotice({
      type: 'success',
      message: 'Password berhasil diperbarui! Gunakan password baru ini untuk login berikutnya.'
    });
  };

  const handleResetToDefault = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset password akun guru ini ke default "123456"?')) {
      const updatedTeacher: Teacher = {
        ...teacher,
        password: '123456'
      };
      onUpdateTeacher(updatedTeacher);
      setPasswordNotice({
        type: 'success',
        message: 'Password berhasil dikembalikan ke default "123456".'
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Akun & Profil Guru
              </h1>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {teacher.status === 'NON_AKTIF' ? 'Non-Aktif' : 'Status Aktif'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Kelola data identitas pengajar, kontak resmi, dan keamanan kata sandi akun pendidik Anda.
            </p>
          </div>
        </div>

        {/* Action Button: Edit Contact or Change Password */}
        <div className="flex items-center gap-2">
          {!isEditingProfile ? (
            <button
              onClick={() => {
                setEditPhone(teacher.phone || '');
                setEditEmail(teacher.email || '');
                setEditBirthPlace(teacher.birthPlace || '');
                setEditBirthDate(teacher.birthDate || '');
                setEditPhotoUrl(teacher.photoUrl || '');
                setIsEditingProfile(true);
                setProfileNotice(null);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-slate-500" />
              <span>Edit Kontak Guru</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditingProfile(false)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Batal</span>
            </button>
          )}

          <button
            onClick={() => {
              setIsChangePasswordOpen(true);
              setPasswordNotice(null);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>Ubah Password</span>
          </button>
        </div>
      </div>

      {/* Profile Notice */}
      {profileNotice && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-3 ${
          profileNotice.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {profileNotice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-bold">{profileNotice.type === 'success' ? 'Berhasil!' : 'Terjadi Kesalahan'}</p>
            <p className="mt-0.5">{profileNotice.message}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Identity Card + Change Password / Edit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Teacher Identity Summary (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                Identitas Pendidik
              </h2>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                {teacher.nip ? `NIP: ${teacher.nip}` : 'Non-NIP'}
              </span>
            </div>

            {/* Teacher Avatar & Main Name */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {teacher.photoUrl ? (
                  <img
                    src={teacher.photoUrl}
                    alt={teacher.name}
                    className="w-20 h-24 rounded-2xl object-cover border-2 border-indigo-100 shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-20 h-24 rounded-2xl bg-indigo-50 border-2 border-indigo-100 flex flex-col items-center justify-center text-indigo-700 shadow-sm">
                    <UserCircle className="w-10 h-10 text-indigo-400" />
                    <span className="text-[10px] font-bold mt-1">Foto Guru</span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-xs" title="Akun Terverifikasi">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
              </div>

              <div className="min-w-0 space-y-1">
                <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                  {teacher.name}
                </h3>
                <div className="text-xs space-y-0.5 text-slate-600 font-mono">
                  <p><span className="text-slate-400 font-sans">NIP:</span> <strong className="text-indigo-700">{teacher.nip || '-'}</strong></p>
                  <p><span className="text-slate-400 font-sans">Kelamin:</span> <strong>{teacher.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</strong></p>
                </div>
                <div className="pt-1 flex flex-wrap gap-1">
                  <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    {getAdditionalDutyLabel()}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Data List */}
            <div className="border-t border-slate-100 pt-4 space-y-3.5 text-xs">
              
              {/* Subjects */}
              <div className="flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-400 font-medium">Mata Pelajaran yang Diampu</p>
                  <p className="font-bold text-slate-800">{teacher.subject1 || 'Mata Pelajaran Umum'}</p>
                  {teacher.subject2 && (
                    <p className="text-slate-600 text-[11px] mt-0.5 font-medium">Mapel 2: {teacher.subject2}</p>
                  )}
                </div>
              </div>

              {/* Homeroom Class */}
              {teacher.additionalDuty === 'WALI_KELAS' && (
                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Tugas Wali Kelas</p>
                    <p className="font-bold text-slate-800">
                      Kelas {teacher.homeroomClassName || 'Belum Ditentukan'}
                    </p>
                  </div>
                </div>
              )}

              {/* Birth Details */}
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Tempat & Tanggal Lahir</p>
                  <p className="font-bold text-slate-800">
                    {teacher.birthPlace ? `${teacher.birthPlace}, ` : ''}{formatBirthDate(teacher.birthDate)}
                  </p>
                </div>
              </div>

              {/* Phone / WA */}
              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">No. WhatsApp / HP</p>
                  <p className="font-bold text-slate-800 font-mono">{teacher.phone || '-'}</p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400 font-medium">Email Resmi</p>
                  <p className="font-medium text-slate-800 truncate">{teacher.email || '-'}</p>
                </div>
              </div>
            </div>

            {/* Login Account Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Username Login Guru:</span>
                <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {teacher.phone || teacher.nip}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Status Password:</span>
                {isCustomPassword ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Kustom (Aman)
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold flex items-center gap-1 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Default (123456)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* School Identity Card Info */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-5 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
              <Info className="w-4 h-4" />
              <span>Instansi Sekolah</span>
            </div>
            <p className="text-sm font-extrabold text-white">
              {schoolProfile.name || 'Sistem Presensi Digital'}
            </p>
            <p className="text-xs text-indigo-200 leading-relaxed">
              {schoolProfile.address || 'Akun Pengajar dan Pendidik Terintegrasi'}
            </p>
          </div>
        </div>

        {/* Right Column: Identity Form Edit & Change Password (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* EDIT CONTACT / IDENTITY FORM (If opened) */}
          {isEditingProfile && (
            <div className="bg-white border border-indigo-200 rounded-3xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Perbarui Kontak & Informasi Profil
                    </h2>
                    <p className="text-xs text-slate-500">
                      Sesuaikan nomor WhatsApp dan email untuk menerima notifikasi jadwal & notifikasi presensi.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Phone / WA */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      No. WhatsApp / HP (Username Login) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Nomor ini dapat digunakan sebagai username login.</p>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="guru@sekolah.sch.id"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  {/* Birth Place */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tempat Lahir
                    </label>
                    <input
                      type="text"
                      value={editBirthPlace}
                      onChange={(e) => setEditBirthPlace(e.target.value)}
                      placeholder="Kota Kelahiran"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  {/* Birth Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tanggal Lahir
                    </label>
                    <input
                      type="date"
                      value={editBirthDate}
                      onChange={(e) => setEditBirthDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>

                {/* Photo URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    URL Foto Profil (Opsional)
                  </label>
                  <input
                    type="url"
                    value={editPhotoUrl}
                    onChange={(e) => setEditPhotoUrl(e.target.value)}
                    placeholder="https://example.com/foto-guru.jpg"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium font-mono text-[11px]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Kontak</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* MAIN FEATURE: UBAH PASSWORD GURU */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Ubah Password Guru
                  </h2>
                  <p className="text-xs text-slate-500">
                    Amankan akun pendidik Anda dengan memperbarui kata sandi secara berkala.
                  </p>
                </div>
              </div>

              {!isChangePasswordOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setIsChangePasswordOpen(true);
                    setPasswordNotice(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition cursor-pointer self-start sm:self-auto"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Buka Form Ganti Password</span>
                </button>
              )}
            </div>

            {/* Notice Alert */}
            {passwordNotice && (
              <div className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-3 ${
                passwordNotice.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {passwordNotice.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold">{passwordNotice.type === 'success' ? 'Berhasil!' : 'Terjadi Kesalahan'}</p>
                  <p className="mt-0.5">{passwordNotice.message}</p>
                </div>
              </div>
            )}

            {/* Change Password Form */}
            {isChangePasswordOpen ? (
              <form onSubmit={handleSubmitChangePassword} className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Password Baru <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimal 6 karakter..."
                        required
                        minLength={6}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showNewPassword ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Konfirmasi Password Baru <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ketik ulang password baru..."
                        required
                        minLength={6}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showConfirmPassword ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Password baru akan tersimpan otomatis dan langsung berlaku untuk sesi login berikutnya menggunakan No. HP atau NIP Anda.</span>
                </div>

                {/* Form Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePasswordOpen(false);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>

                  <div className="flex items-center gap-2">
                    {isCustomPassword && (
                      <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="px-3.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-xl transition cursor-pointer"
                        title="Kembalikan password ke default 123456"
                      >
                        Reset ke Default (123456)
                      </button>
                    )}

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Simpan Password Baru</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <p className="font-bold text-slate-800">
                    Status Password Saat Ini: {isCustomPassword ? 'Sudah Diubah (Kustom)' : 'Password Bawaan (123456)'}
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    {isCustomPassword 
                      ? 'Akun Anda sudah dilindungi dengan kata sandi kustom. Anda dapat menggantinya kapan saja.'
                      : 'Akun Anda masih menggunakan password default "123456". Sangat disarankan menggantinya demi keamanan data pengajar.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsChangePasswordOpen(true);
                    setPasswordNotice(null);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer shrink-0"
                >
                  Ubah Password
                </button>
              </div>
            )}
          </div>

          {/* KBM Voice Reminder Audio Settings Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span>Pengingat Suara AI KBM Otomatis</span>
                    <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Suara Perempuan
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Membunyikan nada pengingat lonceng harmonis & Suara AI saat jam mengajar Anda dimulai sesuai jadwal pelajaran.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestVoice}
                  disabled={isTestingVoice}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  <Volume2 className={`w-3.5 h-3.5 ${isTestingVoice ? 'animate-pulse' : ''}`} />
                  <span>{isTestingVoice ? 'Memutar Suara...' : 'Uji Coba Suara AI'}</span>
                </button>
              </div>
            </div>

            {/* AI Speech Bubble */}
            <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 border border-purple-200/70 rounded-2xl p-3.5 flex items-start gap-3">
              <div className="p-1.5 bg-purple-600 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-purple-950 uppercase tracking-wider">
                  Contoh Panggilan Suara AI Pengingat Jadwal KBM:
                </p>
                <p className="text-xs text-slate-700 italic font-medium leading-relaxed">
                  &ldquo;Panggilan untuk {teacher ? teacher.name : 'Bapak/Ibu Guru'}, Anda memiliki jadwal mengajar mata pelajaran {teacher?.subject1 || 'Matematika'} di kelas {teacher?.homeroomClassName || '7A'} sebanyak 2 Jam Pelajaran saat ini. Selamat menjalankan tugas dan terima kasih.&rdquo;
                </p>
              </div>
            </div>

            {/* Toggle Status */}
            <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-slate-800">
                  Status Pengingat Suara: {voiceReminderEnabled ? 'Aktif (Otomatis)' : 'Dinonaktifkan'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {voiceReminderEnabled 
                    ? 'Browser akan otomatis membunyikan pengingat tepat saat jam JP Anda dimulai.' 
                    : 'Pengingat suara sedang dinonaktifkan di perangkat ini.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleVoiceReminder}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer border ${
                  voiceReminderEnabled 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' 
                    : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                }`}
              >
                {voiceReminderEnabled ? '🔊 Suara Aktif' : '🔇 Dinonaktifkan'}
              </button>
            </div>
          </div>

          {/* Quick Guidance Box */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-3">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              Petunjuk Hak Akses Pengajar
            </h3>
            <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside leading-relaxed">
              <li>
                <strong>Absensi & Jurnal KBM:</strong> Guru dapat memverifikasi presensi kehadiran siswa di kelas dan mengisi jurnal pembelajaran harian.
              </li>
              <li>
                <strong>Nilai & Poin Karakter:</strong> Input poin karakter positif dan pembinaan siswa secara langsung dari akun Anda.
              </li>
              <li>
                <strong>Persetujuan Surat Izin:</strong> Menyetujui atau menindaklanjuti permohonan izin/sakit yang diajukan oleh wali murid.
              </li>
            </ul>
          </div>

        </div>
      </div>

    </div>
  );
};
