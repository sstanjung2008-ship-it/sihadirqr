import React, { useState, useEffect } from 'react';
import { SchoolProfile, Teacher, Student, UserSession } from '../types';
import { 
  Lock, 
  User, 
  QrCode, 
  Eye, 
  EyeOff, 
  KeyRound, 
  AlertCircle, 
  Sparkles, 
  Clock,
  RefreshCw,
  CheckCircle2,
  Wrench,
  ShieldAlert,
  AlertTriangle,
  X
} from 'lucide-react';
import { PWAInstallBanner } from './PWAInstallBanner';
import { smartSyncAndMergeAllWithCloud, getTeachers, getStudents, getSchoolProfile } from '../lib/storage';

interface LoginViewProps {
  schoolProfile: SchoolProfile;
  teachers: Teacher[];
  students: Student[];
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  schoolProfile: initialSchoolProfile,
  teachers: initialTeachers,
  students: initialStudents,
  onLoginSuccess,
}) => {
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(initialSchoolProfile);
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [maintenanceNotice, setMaintenanceNotice] = useState<{
    title: string;
    message: string;
    studentName: string;
    parentName: string;
    nisn: string;
  } | null>(null);

  useEffect(() => {
    setSchoolProfile(initialSchoolProfile);
  }, [initialSchoolProfile]);

  useEffect(() => {
    setTeachers(initialTeachers);
  }, [initialTeachers]);

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  // Keep state synchronized with storage events in real-time
  useEffect(() => {
    const handleStorageUpdate = () => {
      setSchoolProfile(getSchoolProfile());
      setTeachers(getTeachers());
      setStudents(getStudents());
    };
    window.addEventListener('sihadir_storage_updated', handleStorageUpdate);
    return () => window.removeEventListener('sihadir_storage_updated', handleStorageUpdate);
  }, []);

  // Update clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const normalizePhone = (p?: string) => {
    if (!p) return '';
    let digits = p.replace(/\D/g, '');
    if (digits.startsWith('62')) {
      digits = '0' + digits.slice(2);
    }
    return digits;
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    setSyncSuccessMsg(null);
    try {
      const res = await smartSyncAndMergeAllWithCloud();
      const updatedTeachers = getTeachers();
      const updatedStudents = getStudents();
      const updatedProfile = getSchoolProfile();
      setTeachers(updatedTeachers);
      setStudents(updatedStudents);
      setSchoolProfile(updatedProfile);
      setSyncSuccessMsg(`Data berhasil diperbarui dari Cloud! (${updatedTeachers.length} Guru, ${updatedStudents.length} Siswa)`);
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMessage(`Gagal memperbarui data dari Cloud: ${err?.message || 'Pastikan koneksi internet aktif'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const performLoginCheck = (
    currentTeachers: Teacher[],
    currentStudents: Student[],
    currentProfile: SchoolProfile
  ): boolean => {
    const cleanInputUser = username.trim();
    const cleanNoSpaceUser = cleanInputUser.replace(/\s+/g, '');
    const cleanDigitsUser = normalizePhone(cleanInputUser);
    const pureDigitsInput = cleanInputUser.replace(/\D/g, '');

    // 1. ADMIN LOGIC
    if (cleanInputUser.toLowerCase() === 'admin') {
      const expectedAdminPassword = currentProfile.adminPassword || 'admin123';
      if (password === expectedAdminPassword) {
        const session: UserSession = {
          isLoggedIn: true,
          role: 'ADMIN',
          username: 'admin',
          displayName: 'Administrator Utama (Admin Sekolah)',
          photoUrl: currentProfile.schoolLogo || undefined
        };
        onLoginSuccess(session);
        return true;
      } else {
        setErrorMessage('Password Admin salah! Silakan periksa kembali password yang telah diatur.');
        return true;
      }
    }

    // 2. SCANNER / SATPAM LOGIC
    if (cleanInputUser.toLowerCase() === 'satpam' || cleanInputUser.toLowerCase() === 'pos') {
      const expectedScannerPassword = currentProfile.scannerPassword || '123456';
      if (password === expectedScannerPassword || password === 'satpam' || (expectedScannerPassword === '123456' && password === '123456')) {
        const session: UserSession = {
          isLoggedIn: true,
          role: 'SCANNER_POS',
          username: 'satpam',
          displayName: 'Petugas Pos Scanner Satpam',
        };
        onLoginSuccess(session);
        return true;
      } else {
        setErrorMessage('Password Pos Scanner Satpam salah!');
        return true;
      }
    }

    // 3. TEACHER (GURU) LOGIC - Match by No. Handphone / WhatsApp, NIP, Email, or Nama Guru
    const matchedTeacher = currentTeachers.find(t => {
      const tPhoneDigits = normalizePhone(t.phone);
      // Check phone number match
      if (tPhoneDigits && cleanDigitsUser && tPhoneDigits === cleanDigitsUser) {
        return true;
      }
      if (t.phone && t.phone.replace(/\s+/g, '') === cleanNoSpaceUser) {
        return true;
      }
      // Check Email match
      if (t.email && t.email.trim().toLowerCase() === cleanInputUser.toLowerCase()) {
        return true;
      }
      // Check NIP or ID match
      if (t.nip) {
        const tNipPure = t.nip.replace(/\D/g, '');
        if (pureDigitsInput && tNipPure && pureDigitsInput === tNipPure) return true;
        if (t.nip.replace(/\s+/g, '') === cleanNoSpaceUser) return true;
        if (t.nip.toLowerCase() === cleanInputUser.toLowerCase()) return true;
      }
      if (t.id && t.id.toLowerCase() === cleanInputUser.toLowerCase()) {
        return true;
      }
      // Check Teacher Name match (case-insensitive)
      if (t.name) {
        if (t.name.toLowerCase().trim() === cleanInputUser.toLowerCase()) return true;
        if (t.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanInputUser.toLowerCase().replace(/[^a-z0-9]/g, '')) return true;
      }
      return false;
    });

    if (matchedTeacher) {
      const expectedPassword = matchedTeacher.password || '123456';
      if (password === expectedPassword) {
        const session: UserSession = {
          isLoggedIn: true,
          role: 'TEACHER',
          username: matchedTeacher.phone || matchedTeacher.nip || matchedTeacher.id,
          displayName: matchedTeacher.name,
          nipOrNisn: matchedTeacher.nip,
          teacherId: matchedTeacher.id,
          photoUrl: matchedTeacher.photoUrl
        };
        onLoginSuccess(session);
        return true;
      } else {
        setErrorMessage('Password Guru salah! (Default password: 123456). Silakan periksa kembali atau hubungi Administrator.');
        return true;
      }
    }

    // 4. PARENT / STUDENT (WALI MURID) LOGIC
    const matchedStudent = currentStudents.find(s => {
      const sNisnPure = (s.nisn || '').replace(/\D/g, '');
      const sNisPure = (s.nis || '').replace(/\D/g, '');
      const sParentPhoneDigits = normalizePhone(s.parentPhone);

      if (pureDigitsInput && sNisnPure && pureDigitsInput === sNisnPure) return true;
      if (pureDigitsInput && sNisPure && pureDigitsInput === sNisPure) return true;
      if (cleanDigitsUser && sParentPhoneDigits && cleanDigitsUser === sParentPhoneDigits) return true;
      if (s.nisn && s.nisn.replace(/\s+/g, '') === cleanNoSpaceUser) return true;
      if (s.nisn && s.nisn.toLowerCase() === cleanInputUser.toLowerCase()) return true;
      if (s.nis && s.nis.toLowerCase() === cleanInputUser.toLowerCase()) return true;
      return false;
    });

    if (matchedStudent) {
      // PERIKSA STATUS PERBAIKAN SEBELUM AUTHENTIKASI BERHASIL
      const isGlobalMaintenance = Boolean(currentProfile?.parentPortalMaintenance);
      const isStudentMaintenance = Boolean(matchedStudent.statusPerbaikan);

      if (isGlobalMaintenance || isStudentMaintenance) {
        const infoDetail = matchedStudent.perbaikanReason || 
          currentProfile?.parentMaintenanceMessage || 
          'Maaf ada perbaikan Sistem. Akses login akun orang tua sementara ditutup.';
        
        setMaintenanceNotice({
          title: 'Maaf ada perbaikan Sistem',
          message: infoDetail,
          studentName: matchedStudent.name,
          parentName: matchedStudent.parentName || 'Orang Tua / Wali Siswa',
          nisn: matchedStudent.nisn
        });

        setErrorMessage('Maaf ada perbaikan Sistem');
        return true;
      }

      const expectedPassword = matchedStudent.password || '123456';
      if (password === expectedPassword) {
        const session: UserSession = {
          isLoggedIn: true,
          role: 'PARENT',
          username: matchedStudent.nisn,
          displayName: `${matchedStudent.parentName || 'Orang Tua'} (Wali ${matchedStudent.name})`,
          nipOrNisn: matchedStudent.nisn,
          studentId: matchedStudent.id,
          photoUrl: matchedStudent.photoUrl
        };
        onLoginSuccess(session);
        return true;
      } else {
        setErrorMessage('Password Wali / Siswa salah! (Default password: 123456). Silakan periksa kembali atau hubungi Administrator.');
        return true;
      }
    }

    return false;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSyncSuccessMsg(null);

    const cleanInputUser = username.trim();
    if (!cleanInputUser) {
      setErrorMessage('Username / No. HP/WA / NIP / Email / NISN wajib diisi!');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Kata sandi wajib diisi!');
      return;
    }

    // Fetch most current ground truth from storage first
    const freshProfile = getSchoolProfile();
    const freshTeachers = getTeachers();
    const freshStudents = getStudents();
    setSchoolProfile(freshProfile);
    setTeachers(freshTeachers);
    setStudents(freshStudents);

    // Attempt local match first with fresh state
    const localFound = performLoginCheck(freshTeachers, freshStudents, freshProfile);
    if (localFound) return;

    // If not found locally, attempt instant cloud sync in case this device just installed the app
    setIsSyncing(true);
    try {
      await smartSyncAndMergeAllWithCloud();
      const freshTeachers = getTeachers();
      const freshStudents = getStudents();
      const freshProfile = getSchoolProfile();
      setTeachers(freshTeachers);
      setStudents(freshStudents);
      setSchoolProfile(freshProfile);

      const cloudFound = performLoginCheck(freshTeachers, freshStudents, freshProfile);
      if (!cloudFound) {
        setErrorMessage('No. HP/WA, NIP, Email, atau Akun tidak ditemukan di Database Sekolah. Pastikan data guru sudah diinput oleh Admin di Master Data Guru.');
      }
    } catch {
      setErrorMessage('No. HP/WA, NIP, NISN, atau Akun tidak terdaftar. Periksa kembali atau hubungi Admin Sekolah.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50/50 to-blue-100/60 text-slate-800 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      
      {/* Background Decorative Soft Glow Blobs */}
      <div className="absolute top-0 left-1/4 -mt-20 w-96 h-96 bg-indigo-300/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 -mb-20 w-96 h-96 bg-amber-300/25 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between relative z-10 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            {schoolProfile.schoolLogo ? (
              <img 
                src={schoolProfile.schoolLogo} 
                alt="Logo Sekolah" 
                className="w-full h-full object-cover rounded-xl bg-white"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <QrCode className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-xl tracking-tight text-slate-900">
                SiHadir<span className="text-amber-500">QR</span>
              </span>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
                v2.0 Portal Resmi
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium truncate max-w-xs sm:max-w-md">{schoolProfile.name}</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-white/90 border border-slate-200/80 shadow-xs px-3.5 py-1.5 rounded-2xl text-xs backdrop-blur-xs">
          <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
          <span className="font-mono font-bold text-slate-700">{timeStr} WITA</span>
        </div>
      </div>

      {/* Dedicated PWA Install Banner */}
      <div className="max-w-md sm:max-w-2xl w-full mx-auto relative z-10 mb-4">
        <PWAInstallBanner floating={true} />
      </div>

      {/* Main Login Card Center Container */}
      <div className="max-w-md w-full mx-auto my-auto relative z-10">
        <div className="bg-white/95 border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-300/50 backdrop-blur-md space-y-6">
          
          {/* Card Title Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200/80 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Sistem Informasi Kehadiran & KBM
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Selamat Datang
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Masukkan kredensial akun Anda untuk masuk ke sistem.
            </p>
          </div>

          {/* Unified Login Info Banner */}
          <div className="bg-indigo-50/90 border border-indigo-200/90 rounded-2xl p-3.5 text-xs flex items-center gap-3 shadow-2xs">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
              <KeyRound className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <p className="font-extrabold text-indigo-950">
                Portal Login Terpadu
              </p>
              <p className="text-[11px] text-indigo-700 mt-0.5 leading-snug font-medium">
                Gunakan No. HP/WA (Guru), NISN (Wali Murid), atau Username (Admin/Satpam)
              </p>
            </div>
          </div>

          {/* Global Parent Maintenance Notice Banner */}
          {Boolean(schoolProfile.parentPortalMaintenance) && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-3.5 text-xs flex items-start gap-2.5 shadow-xs animate-fadeIn">
              <Wrench className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block text-amber-950">Info Perbaikan Sistem Aktif</span>
                <span className="text-[11px] text-amber-800 leading-snug font-medium block mt-0.5">
                  {schoolProfile.parentMaintenanceMessage || 'Maaf ada perbaikan Sistem. Akses login akun orang tua sementara ditutup.'}
                </span>
              </div>
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3.5 text-xs flex items-start gap-2.5 animate-shake shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-semibold leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            {/* Username / No. HP / NIP / NISN Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>No. HP / WA (Guru) • NISN / Username</span>
                <span className="text-[10px] text-indigo-600 font-mono font-bold">*Wajib</span>
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan No. Handphone/WA, NIP, atau NISN..."
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-900 placeholder-slate-400 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Kata Sandi (Password)</span>
                <span className="text-[10px] text-indigo-600 font-mono font-bold">*Wajib</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl pl-10 pr-10 py-3 text-xs text-slate-900 placeholder-slate-400 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>

            {/* Submit Login Button */}
            <button
              type="submit"
              disabled={isSyncing}
              className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-lg shadow-indigo-600/25 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer transform active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 text-indigo-200 animate-spin" />
                  <span>Memeriksa & Menyinkronkan Data Cloud...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-indigo-100" />
                  <span>Masuk Ke Aplikasi</span>
                </>
              )}
            </button>
          </form>

          {/* Sync Success Message */}
          {syncSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-3 text-xs flex items-center gap-2 shadow-2xs animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{syncSuccessMsg}</span>
            </div>
          )}

          {/* Cloud Sync Manual Button & Helper */}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2 text-center text-[11px]">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center justify-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sedang Sinkronisasi...' : 'Akun baru belum terdeteksi? Sinkronkan Data Cloud'}</span>
            </button>
            <span className="text-slate-400 italic font-medium">Bantuan Lupa Password? Hubungi Administrator Sekolah</span>
          </div>

        </div>

      </div>

      {/* Footer Branding */}
      <div className="max-w-6xl w-full mx-auto text-center relative z-10 pt-6">
        <p className="text-[11px] text-slate-500 font-medium">
          © {new Date().getFullYear()} {schoolProfile.name}. Hak Cipta Dilindungi. Sistem Presensi QR & Manajemen Sekolah.
        </p>
      </div>

      {/* SISTEM DALAM PERBAIKAN - POPUP NOTIFIKASI INFORMASI */}
      {maintenanceNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white border border-amber-200 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-scaleUp relative overflow-hidden">
            
            {/* Top Amber Accent Stripe */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600"></div>

            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 shadow-inner text-amber-700">
                  <Wrench className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300/60 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Akses Login Ditolak
                  </div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {maintenanceNotice.title || 'Maaf ada perbaikan Sistem'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMaintenanceNotice(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Account Info */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Nama Siswa:</span>
                <span className="font-bold text-slate-800">{maintenanceNotice.studentName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>NISN:</span>
                <span className="font-mono font-bold text-slate-800">{maintenanceNotice.nisn}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Akun Wali:</span>
                <span className="font-semibold text-slate-700">{maintenanceNotice.parentName}</span>
              </div>
            </div>

            {/* Message Announcement Body */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs space-y-2 text-amber-950">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                Informasi Pemeliharaan & Perbaikan Sistem:
              </div>
              <p className="leading-relaxed font-medium text-slate-700">
                {maintenanceNotice.message}
              </p>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed text-center">
              Selama status perbaikan aktif, otentikasi login untuk akun orang tua dinonaktifkan sementara demi keamanan dan sinkronisasi data sekolah.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMaintenanceNotice(null)}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                Mengerti & Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
