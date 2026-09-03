import React, { useState } from 'react';
import { Student, SchoolProfile, UserSession } from '../types';
import { StudentIdCardModal } from './StudentIdCardModal';
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
  MapPin, 
  CreditCard,
  Lock,
  Sparkles,
  Download,
  Printer,
  ChevronRight,
  Info
} from 'lucide-react';
import { exportSingleStudentCardPdf } from '../lib/exportUtils';

interface ParentAccountViewProps {
  student: Student | null;
  schoolProfile: SchoolProfile;
  userSession: UserSession | null;
  onUpdateStudent: (student: Student) => void;
  onLogout?: () => void;
}

export const ParentAccountView: React.FC<ParentAccountViewProps> = ({
  student,
  schoolProfile,
  userSession,
  onUpdateStudent,
  onLogout
}) => {
  // Modal states
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Password change form states
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!student) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 space-y-3">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-amber-900">Data Siswa Tidak Ditemukan</h2>
          <p className="text-sm text-amber-700 max-w-md mx-auto">
            Sistem tidak menemukan data siswa yang terkait dengan sesi login saat ini. Silakan login kembali dengan NISN yang valid.
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

  const isCustomPassword = Boolean(student.password && student.password !== '123456');

  // Handle direct PDF export
  const handleQuickDownloadCardPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportSingleStudentCardPdf(student, schoolProfile, schoolProfile.cardOrientation || 'PORTRAIT');
    } catch (err) {
      console.error('Failed to export student card:', err);
      // Fallback open modal
      setIsCardModalOpen(true);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle password change submission
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

    // Save updated password to student
    const updatedStudent: Student = {
      ...student,
      password: trimmedPass
    };

    onUpdateStudent(updatedStudent);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordNotice({
      type: 'success',
      message: 'Password berhasil diperbarui! Gunakan password baru ini untuk login berikutnya.'
    });
  };

  const handleResetToDefault = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset password akun ke default "123456"?')) {
      const updatedStudent: Student = {
        ...student,
        password: '123456'
      };
      onUpdateStudent(updatedStudent);
      setPasswordNotice({
        type: 'success',
        message: 'Password berhasil dikembalikan ke default "123456".'
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
            <UserCircle className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Akun Wali Murid
              </h1>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Terhubung Otomatis
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Informasi identitas siswa, akses Kartu Pelajar Digital, dan pengelolaan kata sandi akun.
            </p>
          </div>
        </div>

        {/* Action Button: Open Card */}
        <div className="flex items-center gap-2 sm:self-center">
          <button
            onClick={() => setIsCardModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Lihat Kartu Pelajar</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Student Profile + Main Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Student & Guardian Profile Summary (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                Profil Siswa Terhubung
              </h2>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                Kelas {student.className}
              </span>
            </div>

            {/* Student Avatar & Basic Info */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt={student.name}
                    className="w-20 h-24 rounded-2xl object-cover border-2 border-indigo-100 shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-20 h-24 rounded-2xl bg-indigo-50 border-2 border-indigo-100 flex flex-col items-center justify-center text-indigo-700 shadow-sm">
                    <UserCircle className="w-10 h-10 text-indigo-400" />
                    <span className="text-[10px] font-bold mt-1">Foto 3:4</span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-xs" title="Akun Terhubung">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
              </div>

              <div className="min-w-0 space-y-1">
                <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                  {student.name}
                </h3>
                <div className="text-xs space-y-0.5 text-slate-600 font-mono">
                  <p><span className="text-slate-400 font-sans">NISN:</span> <strong className="text-indigo-700">{student.nisn}</strong></p>
                  <p><span className="text-slate-400 font-sans">NIS:</span> <strong>{student.nis}</strong></p>
                </div>
                <div className="pt-1">
                  <span className="inline-block bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                    {student.gender === 'M' ? 'Laki-laki' : 'Perempuan'}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Data List */}
            <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <UserCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Orang Tua / Wali Murid</p>
                  <p className="font-bold text-slate-800">{student.parentName || 'Orang Tua Siswa'}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">No. WhatsApp / HP</p>
                  <p className="font-bold text-slate-800 font-mono">{student.parentPhone || '-'}</p>
                </div>
              </div>

              {student.address && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Alamat Tinggal</p>
                    <p className="font-medium text-slate-700">{student.address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Login Account Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Username Login:</span>
                <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {student.nisn}
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

          {/* Quick Notice Card */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
              <Info className="w-4 h-4" />
              <span>Informasi Akses Wali Murid</span>
            </div>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Akun ini dikhususkan bagi orang tua siswa untuk memantau presensi harian, kartu tanda pelajar digital, serta berkomunikasi dengan pihak sekolah secara aman.
            </p>
          </div>
        </div>

        {/* Right Column: Two Primary Features (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* FEATURE 1: KARTU PELAJAR DIGITAL */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Kartu Tanda Pelajar (KTS Digital)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kartu identitas resmi siswa dilengkapi barcode presensi dan logo sekolah.
                  </p>
                </div>
              </div>
            </div>

            {/* Mini Card Preview Showcase */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-indigo-100/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5">
              
              {/* Card visual mockup */}
              <div className="w-full sm:w-56 bg-white rounded-xl shadow-md border border-slate-200 p-3 space-y-2.5 relative overflow-hidden shrink-0">
                <div className="h-1.5 bg-indigo-600 rounded-full w-1/3"></div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  {schoolProfile.logo ? (
                    <img src={schoolProfile.logo} alt="Logo" className="w-7 h-7 object-contain" />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-black text-[10px] flex items-center justify-center">
                      SCH
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-800 truncate leading-tight uppercase">
                      {schoolProfile.name || 'KARTU TANDA PELAJAR'}
                    </p>
                    <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">KTS Digital</p>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                    {student.photoUrl ? (
                      <img src={student.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-[8px] font-bold">
                        3:4
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 text-[9px] space-y-0.5">
                    <p className="font-extrabold text-slate-900 truncate leading-tight">{student.name}</p>
                    <p className="text-slate-500 font-mono text-[8px]">NISN: {student.nisn}</p>
                    <p className="text-indigo-600 font-bold text-[8px]">Kelas {student.className}</p>
                  </div>
                </div>

                <div className="text-[8px] text-center font-mono text-slate-400 pt-1 border-t border-slate-100">
                  CR-80 • 85.6 × 54 mm
                </div>
              </div>

              {/* Action Details & Buttons */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Kartu Siswa Aktif Siap Digunakan
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Dapat dilihat dalam format Tegak (Portrait) maupun Mendatar (Landscape), diunduh sebagai berkas PDF standar cetak, atau dicetak langsung.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                  <button
                    onClick={() => setIsCardModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Lihat Kartu Pelajar</span>
                  </button>

                  <button
                    onClick={handleQuickDownloadCardPdf}
                    disabled={isExportingPdf}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    <Download className="w-4 h-4 text-indigo-600" />
                    <span>{isExportingPdf ? 'Memproses PDF...' : 'Unduh PDF'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* FEATURE 2: GANTI PASSWORD */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Ganti Password Akun
                  </h2>
                  <p className="text-xs text-slate-500">
                    Amankan akses login dengan memperbarui kata sandi akun secara berkala.
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
                  <span>Password baru akan tersimpan otomatis dan langsung berlaku untuk sesi login berikutnya menggunakan NISN Anda.</span>
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
                        title="Kembalikan password ke 123456"
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
                      : 'Akun Anda masih menggunakan password default "123456". Sangat disarankan menggantinya demi keamanan.'}
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
                  Ganti Password
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Student ID Card Modal Popup */}
      {isCardModalOpen && (
        <StudentIdCardModal
          student={student}
          onClose={() => setIsCardModalOpen(false)}
        />
      )}

    </div>
  );
};
