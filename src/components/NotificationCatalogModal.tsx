import React, { useState } from 'react';
import { 
  Bell, 
  Sparkles, 
  X, 
  Sun, 
  Home, 
  ScanLine, 
  Volume2, 
  User, 
  Clock, 
  HelpCircle 
} from 'lucide-react';

interface NotificationCatalogModalProps {
  onClose: () => void;
}

const NOTIFICATION_SAMPLES = [
  {
    id: 'masuk_hadir',
    conditionId: 'MASUK_HADIR' as const,
    category: 'MASUK',
    categoryBadge: '☀️ Mode Masuk',
    badgeText: '✅ SCAN MASUK BERHASIL (TEPAT WAKTU)',
    bgTheme: 'emerald' as const,
    soundLabel: 'Chime Positif (Ding-dong)',
    soundType: 'SUCCESS' as const,
    studentName: 'Ahmad Fauzi',
    isKnownStudent: true,
    className: 'VII-A',
    scanTimeFormatted: '07:05:20',
    messageText: 'Status: HADIR TEPAT WAKTU Berhasil Disimpan',
    condition: 'Siswa memindai QR sebelum atau tepat pukul 07:35:00 WITA (Batas Toleransi Sekolah).'
  },
  {
    id: 'masuk_terlambat',
    conditionId: 'MASUK_TERLAMBAT' as const,
    category: 'MASUK',
    categoryBadge: '☀️ Mode Masuk',
    badgeText: '⚠️ SCAN MASUK TERLAMBAT',
    bgTheme: 'emerald' as const,
    soundLabel: 'Nada Peringatan Terlambat',
    soundType: 'LATE' as const,
    studentName: 'Budi Pratama',
    isKnownStudent: true,
    className: 'VIII-B',
    scanTimeFormatted: '07:42:15',
    messageText: 'Status: TERLAMBAT (Lewat dari Batas 07:35 WITA)',
    condition: 'Siswa memindai QR setelah pukul 07:35:00 WITA namun masih sebelum jam masuk ditutup.'
  },
  {
    id: 'masuk_already',
    conditionId: 'MASUK_ALREADY' as const,
    category: 'MASUK',
    categoryBadge: '☀️ Mode Masuk',
    badgeText: 'ℹ️ SUDAH PERNAH SCAN MASUK HARI INI',
    bgTheme: 'amber' as const,
    soundLabel: 'Chime Peringatan Ganda (Double beep)',
    soundType: 'INFO' as const,
    studentName: 'Ahmad Fauzi',
    isKnownStudent: true,
    className: 'VII-A',
    scanTimeFormatted: '07:15:30',
    messageText: 'Sudah Tercatat Masuk Pukul 07:05:20 WITA (Hadir)',
    condition: 'Siswa memindai ulang kartu pada jam pagi padahal data masuknya sudah sukses tersimpan.'
  },
  {
    id: 'masuk_closed',
    conditionId: 'MASUK_CLOSED' as const,
    category: 'MASUK',
    categoryBadge: '☀️ Mode Masuk',
    badgeText: '⛔ SESI SCAN MASUK TELAH DITUTUP',
    bgTheme: 'rose' as const,
    soundLabel: 'Buzzer Rendah (Error)',
    soundType: 'ERROR' as const,
    studentName: 'Citra Dewi',
    isKnownStudent: true,
    className: 'IX-A',
    scanTimeFormatted: '12:05:10',
    messageText: 'Scan Masuk Ditutup Pukul 12:00 WITA. Silakan Hubungi Piket/Admin',
    condition: 'Pemindaian dilakukan setelah jam batas akhir scan masuk (12:00 WITA).'
  },
  {
    id: 'pulang_success',
    conditionId: 'PULANG_SUCCESS' as const,
    category: 'PULANG',
    categoryBadge: '🏠 Mode Pulang',
    badgeText: '🏠 SCAN PULANG BERHASIL (SELESAI KBM)',
    bgTheme: 'emerald' as const,
    soundLabel: 'Chime Positif Harmonis',
    soundType: 'SUCCESS' as const,
    studentName: 'Ahmad Fauzi',
    isKnownStudent: true,
    className: 'VII-A',
    scanTimeFormatted: '14:05:10',
    messageText: 'Kepulangan Siswa Berhasil Tercatat & Disinkronkan',
    condition: 'Siswa memindai kartu setelah jam kepulangan resmi sekolah (misal: 14:00 WITA).'
  },
  {
    id: 'pulang_cepat',
    conditionId: 'PULANG_CEPAT' as const,
    category: 'PULANG',
    categoryBadge: '🏠 Mode Pulang',
    badgeText: '⚠️ SCAN PULANG LEBIH AWAL (PULANG CEPAT)',
    bgTheme: 'amber' as const,
    soundLabel: 'Nada Peringatan Amber',
    soundType: 'LATE' as const,
    studentName: 'Dina Safitri',
    isKnownStudent: true,
    className: 'VII-C',
    scanTimeFormatted: '12:45:00',
    messageText: 'Tercatat Pulang Sebelum Jam Kepulangan Resmi Sekolah',
    condition: 'Siswa memindai pulang sebelum waktu kepulangan resmi yang ditentukan sekolah.'
  },
  {
    id: 'pulang_already',
    conditionId: 'PULANG_ALREADY' as const,
    category: 'PULANG',
    categoryBadge: '🏠 Mode Pulang',
    badgeText: 'ℹ️ SUDAH PERNAH SCAN PULANG HARI INI',
    bgTheme: 'amber' as const,
    soundLabel: 'Double Chime Peringatan',
    soundType: 'INFO' as const,
    studentName: 'Ahmad Fauzi',
    isKnownStudent: true,
    className: 'VII-A',
    scanTimeFormatted: '14:20:00',
    messageText: 'Sudah Tercatat Pulang Pukul 14:05:10 WITA',
    condition: 'Siswa memindai kartu kembali setelah kepulangannya sudah sukses tercatat.'
  },
  {
    id: 'pulang_no_entry',
    conditionId: 'PULANG_NO_ENTRY' as const,
    category: 'PULANG',
    categoryBadge: '🏠 Mode Pulang',
    badgeText: '⚠️ SCAN PULANG LANGSUNG (TANPA SCAN MASUK)',
    bgTheme: 'amber' as const,
    soundLabel: 'Nada Peringatan Khusus',
    soundType: 'LATE' as const,
    studentName: 'Eko Prasetyo',
    isKnownStudent: true,
    className: 'VIII-A',
    scanTimeFormatted: '14:10:00',
    messageText: 'Presensi Masuk Tidak Ditemukan. Status: HADIR (PULANG LANGSUNG)',
    condition: 'Siswa scan di mode pulang tanpa rekaman presensi masuk di pagi hari.'
  },
  {
    id: 'invalid_qr',
    conditionId: 'INVALID_QR' as const,
    category: 'VALIDASI',
    categoryBadge: '🔍 Validasi QR',
    badgeText: '❌ QR CODE TIDAK DIKENALI',
    bgTheme: 'rose' as const,
    soundLabel: 'Buzzer Datar (Error)',
    soundType: 'ERROR' as const,
    studentName: 'Data QR Tidak Valid',
    isKnownStudent: false,
    className: 'Tidak Terdaftar',
    scanTimeFormatted: '07:10:00',
    messageText: 'Kode QR tidak cocok dengan NISN/ID siswa mana pun di database.',
    condition: 'Kode QR yang dipindai bukan kartu resmi SiHadirQR atau belum terdaftar di sistem.'
  },
  {
    id: 'rate_limited',
    conditionId: 'RATE_LIMITED' as const,
    category: 'VALIDASI',
    categoryBadge: '🔍 Validasi QR',
    badgeText: '⏳ JEDA SCAN AKTIF (DEBOUNCE 2 DETIK)',
    bgTheme: 'amber' as const,
    soundLabel: 'Hening (Tanpa Suara)',
    soundType: 'INFO' as const,
    studentName: 'Siswa Yang Sama',
    isKnownStudent: true,
    className: 'Anti Multi-Trigger',
    scanTimeFormatted: '07:05:21',
    messageText: 'Kartu masih berada di depan kamera. Menunggu jeda 2 detik.',
    condition: 'Pencegahan multi-trigger otomatis saat kartu siswa tertahan di depan lensa kamera.'
  }
];

export const NotificationCatalogModal: React.FC<NotificationCatalogModalProps> = ({ onClose }) => {
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MASUK' | 'PULANG' | 'VALIDASI'>('ALL');

  const filteredSamples = NOTIFICATION_SAMPLES.filter(
    s => categoryFilter === 'ALL' || s.category === categoryFilter
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 p-5 sm:p-6 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center font-extrabold shadow-inner shrink-0 border border-white/20">
              <Bell className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-xs font-bold mb-1 border border-amber-300/30">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Panduan Resmi Notifikasi Presensi QR</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Semua Jenis Notifikasi Scan QR (Masuk & Pulang)
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100/90 mt-0.5">
                Daftar lengkap 10 jenis notifikasi sistem saat scan presensi beserta aturan, suara, dan simulasi tampilan di layar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              categoryFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Semua Notifikasi (10)
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('MASUK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              categoryFilter === 'MASUK'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Mode Scan Masuk (4)</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('PULANG')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              categoryFilter === 'PULANG'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Mode Scan Pulang (4)</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('VALIDASI')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              categoryFilter === 'VALIDASI'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>Validasi QR & Format (2)</span>
          </button>
        </div>

        {/* Modal Body / Cards List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-100/60">
          {filteredSamples.map(sample => (
            <div
              key={sample.id}
              className={`rounded-2xl p-4 sm:p-5 border shadow-sm transition-all bg-white ${
                sample.bgTheme === 'emerald'
                  ? 'border-emerald-200 ring-1 ring-emerald-500/20'
                  : sample.bgTheme === 'amber'
                  ? 'border-amber-200 ring-1 ring-amber-500/20'
                  : 'border-rose-200 ring-1 ring-rose-500/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {sample.categoryBadge}
                </span>
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Audio: <strong>{sample.soundLabel}</strong></span>
                </span>
              </div>

              {/* Banner Preview */}
              <div
                className={`p-3.5 rounded-xl text-white mb-3 shadow-xs ${
                  sample.bgTheme === 'emerald'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
                    : sample.bgTheme === 'amber'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-700'
                    : 'bg-gradient-to-r from-rose-600 to-red-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-black mb-1">
                  <span>{sample.badgeText}</span>
                  <span className="font-mono bg-black/25 px-2 py-0.5 rounded-full text-[10px]">
                    {sample.scanTimeFormatted} WITA
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <User className="w-4 h-4 shrink-0 opacity-80" />
                  <span>{sample.studentName} ({sample.className})</span>
                </div>
                <div className="text-xs opacity-90 mt-1 font-medium">
                  {sample.messageText}
                </div>
              </div>

              {/* Kondisi Pemicu */}
              <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 font-bold">Kondisi Pemicu: </strong>
                  <span>{sample.condition}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Setiap pesan notifikasi hasil scan tampil selama <strong>2 detik</strong> lengkap dengan waktu tayang presisi (WITA).
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            Tutup Panduan
          </button>
        </div>

      </div>
    </div>
  );
};
