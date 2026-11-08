import React, { useState } from 'react';
import { useTargetedAttendance } from '../hooks/useTargetedAttendance';
import { getLocalDateString } from '../lib/storage';
import { 
  Calendar, 
  Filter, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  UserCheck, 
  ChevronDown, 
  Sparkles,
  Zap,
  ShieldCheck
} from 'lucide-react';

interface TargetedAttendanceTableProps {
  initialDate?: string;
  initialClass?: string;
  availableClasses?: string[];
  onRecordUpdated?: (recordId: string) => void;
}

/**
 * Komponen Presensi Terarah (Targeted / On-Demand Attendance Module)
 * 
 * Implementasi Nyata Arsitektur Spark Free Tier:
 * - Page-Specific Reads: Hanya membaca data saat komponen ini dibuka di layar.
 * - On-Demand with getDocs: Menggunakan limit(pageSize) dan where() granular per tanggal & kelas.
 * - Single-Record Patching: Saat siswa melakukan absensi, hanya menarik 1 dokumen (1 read) tanpa reload tabel.
 * - Zero Background Polling: Otomatis berhenti membaca data saat berpindah ke tab lain.
 */
export const TargetedAttendanceTable: React.FC<TargetedAttendanceTableProps> = ({
  initialDate,
  initialClass = 'ALL',
  availableClasses = ['KELAS 7 A', 'KELAS 7 B', 'KELAS 8 A', 'KELAS 8 B', 'KELAS 9 A', 'KELAS 9 E'],
  onRecordUpdated,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || getLocalDateString());
  const [selectedClass, setSelectedClass] = useState<string>(initialClass);
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);

  // Hook targeted reads dengan limit pagination 15 siswa per halaman
  const {
    records,
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
    fetchSingleRecord,
    totalReadsIncurred,
  } = useTargetedAttendance({
    date: selectedDate,
    className: selectedClass,
    pageSize: 15,
  });

  /**
   * Simulasi Targeted Single-Record Refresh:
   * Mengambil HANYA 1 dokumen record siswa yang bersangkutan dari Cloud Firestore (1 read!).
   */
  const handleSimulateSingleCheckIn = async (studentId: string) => {
    setUpdatingStudentId(studentId);
    try {
      const updated = await fetchSingleRecord(studentId, selectedDate);
      if (updated && onRecordUpdated) {
        onRecordUpdated(updated.id);
      }
    } finally {
      setUpdatingStudentId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header & Spark Free Tier Monitor */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Zap className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                Dasbor Presensi On-Demand (Hemat Kuota)
              </h3>
              <p className="text-xs text-slate-500">
                Pemuatan data terarah dengan filter tanggal & kelas aktif (Page-Specific Reads)
              </p>
            </div>
          </div>
        </div>

        {/* Free Tier Quota Badge */}
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-1.5 rounded-2xl text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Penggunaan Kuota: <strong>{totalReadsIncurred} Read</strong></span>
          <span className="text-[10px] text-emerald-600/80 font-mono font-medium">(Spark Free Tier)</span>
        </div>
      </div>

      {/* Filter Bar: Date & Class */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs">
          <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-bold text-slate-500">Tanggal:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs font-mono"
          />
        </div>

        {/* Class Filter */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="font-bold text-slate-500">Kelas:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
          >
            <option value="ALL">Semua Kelas</option>
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        {/* Manual On-Demand Refresh Button */}
        <button
          type="button"
          onClick={() => refetch()}
          disabled={loading}
          className="ml-auto px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan ({selectedClass})</span>
        </button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Paginated Attendance Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-[11px] uppercase font-extrabold text-slate-500 tracking-wider border-b border-slate-100">
            <tr>
              <th className="py-3 px-4">Nama Siswa</th>
              <th className="py-3 px-4">Kelas</th>
              <th className="py-3 px-4">Jam Masuk</th>
              <th className="py-3 px-4">Status Masuk</th>
              <th className="py-3 px-4">Jam Pulang</th>
              <th className="py-3 px-4 text-right">Targeted Patch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length > 0 ? (
              records.map((rec) => {
                const isHadir = rec.status === 'HADIR';
                const isTerlambat = rec.status === 'TERLAMBAT';
                const isUpdatingThis = updatingStudentId === rec.studentId;

                return (
                  <tr key={rec.id || `${rec.studentId}_${rec.date}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>{rec.studentName || 'Nama Siswa'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {rec.studentId}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-600">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono text-[10px]">
                        {rec.className || selectedClass}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {rec.time && rec.time !== '-' ? rec.time : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {isHadir ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Hadir
                        </span>
                      ) : isTerlambat ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                          <Clock className="w-3 h-3 text-amber-500" />
                          Terlambat
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {rec.status || 'Belum Absen'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {rec.returnTime && rec.returnTime !== '-' ? rec.returnTime : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {/* Tombol Patch 1 Dokumen Sasaran (1 Read Firestore) */}
                      <button
                        type="button"
                        onClick={() => handleSimulateSingleCheckIn(rec.studentId)}
                        disabled={isUpdatingThis}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                        title="Pembaruan 1 Dokumen Sasaran: Hanya membaca 1 record di Firestore (1 Read)"
                      >
                        <UserCheck className={`w-3 h-3 ${isUpdatingThis ? 'animate-spin' : ''}`} />
                        <span>{isUpdatingThis ? 'Sync 1...' : 'Targeted Sync'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : !loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-600 text-xs">Belum ada data presensi pada filter ini.</p>
                    <p className="text-[11px] text-slate-400">Pilih tanggal atau kelas lain untuk memuat data terarah.</p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagination Load More Button */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
          >
            <ChevronDown className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Memuat 15 Siswa Berikutnya...' : 'Muat 15 Siswa Berikutnya (+15 Read)'}</span>
          </button>
        </div>
      )}

      {/* Educational Footer Note */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-[11px] text-slate-500 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
        <span>
          <strong>Prinsip Arsitektur:</strong> Query <code>getDocs</code> hanya dieksekusi saat komponen ini aktif di layar. Saat pengguna beralih menu, pembacaan terhenti total (Zero-Background Reads) untuk memastikan kuota harian 50.000 read tetap aman.
        </span>
      </div>
    </div>
  );
};
