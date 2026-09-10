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
  Clock 
} from 'lucide-react';
import { PWAInstallBanner } from './PWAInstallBanner';

interface LoginViewProps {
  schoolProfile: SchoolProfile;
  teachers: Teacher[];
  students: Student[];
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  schoolProfile,
  teachers,
  students,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState('');

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

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInputUser = username.trim();
    const cleanNoSpaceUser = cleanInputUser.replace(/\s+/g, '');
    const cleanDigitsUser = normalizePhone(cleanInputUser);

    if (!cleanInputUser) {
      setErrorMessage('Username / No. HP/WA / NIP / NISN wajib diisi!');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Kata sandi wajib diisi!');
      return;
    }

    // 1. ADMIN LOGIC
    if (cleanInputUser.toLowerCase() === 'admin') {
      if (password === 'admin123') {
        const session: UserSession = {
          isLoggedIn: true,
          role: 'ADMIN',
          username: 'admin',
          displayName: 'Administrator Utama (Admin Sekolah)',
          photoUrl: schoolProfile.schoolLogo || undefined
        };
        onLoginSuccess(session);
        return;
      } else {
        setErrorMessage('Password Admin salah! (Gunakan password admin yang benar)');
        return;
      }
    }

    // 2. SCANNER / SATPAM LOGIC
    if (cleanInputUser.toLowerCase() === 'satpam' || cleanInputUser.toLowerCase() === 'pos') {
      if (password === '123456' || password === 'satpam') {
        const session: UserSession = {
          isLoggedIn: true,
          role: 'SCANNER_POS',
          username: 'satpam',
          displayName: 'Petugas Pos Scanner Satpam',
        };
        onLoginSuccess(session);
        return;
      } else {
        setErrorMessage('Password Pos Scanner Satpam salah!');
        return;
      }
    }

    // 3. TEACHER (GURU) LOGIC - Match by No. Handphone / WhatsApp or NIP
    const matchedTeacher = teachers.find(t => {
      const tPhoneDigits = normalizePhone(t.phone);
      // Check phone number match
      if (tPhoneDigits && cleanDigitsUser && tPhoneDigits === cleanDigitsUser) {
        return true;
      }
      if (t.phone && t.phone.replace(/\s+/g, '') === cleanNoSpaceUser) {
        return true;
      }
      // Check NIP or ID match
      if (t.nip.replace(/\s+/g, '') === cleanNoSpaceUser ||
          t.nip.toLowerCase() === cleanInputUser.toLowerCase() ||
          t.id.toLowerCase() === cleanInputUser.toLowerCase()) {
        return true;
      }
      return false;
    });

    if (matchedTeacher) {
      const expectedPassword = matchedTeacher.password || '123456';
      if (password === expectedPassword) {
        const session: UserSession = {
          isLoggedIn: true,
          role: 'TEACHER',
          username: matchedTeacher.phone || matchedTeacher.nip,
          displayName: matchedTeacher.name,
          nipOrNisn: matchedTeacher.nip,
          teacherId: matchedTeacher.id,
          photoUrl: matchedTeacher.photoUrl
        };
        onLoginSuccess(session);
        return;
      } else {
        setErrorMessage('Password Guru salah! (Default password: 123456). Silakan periksa kembali atau hubungi Administrator.');
        return;
      }
    }

    // 4. PARENT / STUDENT (WALI MURID) LOGIC
    const matchedStudent = students.find(s => 
      s.nisn.replace(/\s+/g, '') === cleanNoSpaceUser || 
      s.nisn.toLowerCase() === cleanInputUser.toLowerCase() ||
      s.nis.toLowerCase() === cleanInputUser.toLowerCase()
    );

    if (matchedStudent) {
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
        return;
      } else {
        setErrorMessage('Password Wali / Siswa salah! (Default password: 123456). Silakan periksa kembali atau hubungi Administrator.');
        return;
      }
    }

    // If no match found
    setErrorMessage('No. HP/WA, NIP, NISN, atau Username tidak terdaftar! Periksa kembali data login Anda.');
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
              className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-lg shadow-indigo-600/25 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer transform active:scale-[0.98]"
            >
              <KeyRound className="w-4 h-4 text-indigo-100" />
              Masuk Ke Aplikasi
            </button>
          </form>

          {/* Footer Helper */}
          <div className="pt-2 border-t border-slate-100 text-center text-[11px]">
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

    </div>
  );
};
