import React, { useState, useMemo } from 'react';
import { Student, SchoolClass, AttendanceRecord, UserSession } from '../types';
import { getLocalDateString } from '../lib/storage';
import { 
  UserCheck, 
  Trash2, 
  X, 
  CheckSquare, 
  Calendar, 
  Filter, 
  Search, 
  Sparkles, 
  Info, 
  ShieldCheck, 
  RotateCcw,
  Clock,
  UserX
} from 'lucide-react';

export interface BulkAlpaItem {
  studentId: string;
  studentName: string;
  nisn: string;
  classId: string;
  className: string;
  date: string;
  status: AttendanceRecord['status'] | 'BELUM_ABSEN';
  existingRecordId?: string;
  notes?: string;
  recordTime?: string;
}

interface BulkAlpaManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classes: SchoolClass[];
  attendanceRecords: AttendanceRecord[];
  initialDate?: string;
  userSession?: UserSession | null;
  onDeleteRecords: (recordIds: string[]) => void;
  onBulkUpdateStatus: (updates: {
    studentId: string;
    studentName: string;
    nisn: string;
    className: string;
    date: string;
    newStatus: AttendanceRecord['status'];
    notes?: string;
    existingRecordId?: string;
  }[]) => void;
}

export const BulkAlpaManagementModal: React.FC<BulkAlpaManagementModalProps> = ({
  isOpen,
  onClose,
  students,
  classes,
  attendanceRecords,
  initialDate,
  userSession,
  onDeleteRecords,
  onBulkUpdateStatus,
}) => {
  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALPA');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Student IDs (or unique keys for this date)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Bulk action options (default to CONVERT / Ubah Status)
  const [actionType, setActionType] = useState<'CONVERT' | 'DELETE'>('CONVERT');
  const [targetStatus, setTargetStatus] = useState<AttendanceRecord['status']>('HADIR');
  const [bulkNotes, setBulkNotes] = useState<string>('Disetujui Admin (Update Massal)');

  // Student map for fast lookup
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(s => map.set(s.id, s));
    return map;
  }, [students]);

  // Find all student items for selectedDate
  const allDateItems = useMemo<BulkAlpaItem[]>(() => {
    if (!isOpen) return [];

    const dateRecordsMap = new Map<string, AttendanceRecord>();
    attendanceRecords
      .filter(r => r.date === selectedDate)
      .forEach(r => dateRecordsMap.set(r.studentId, r));

    return students.map(student => {
      const rec = dateRecordsMap.get(student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        nisn: student.nisn || '-',
        classId: student.classId || '',
        className: student.className || '-',
        date: selectedDate,
        status: rec ? rec.status : 'BELUM_ABSEN',
        existingRecordId: rec?.id,
        notes: rec?.notes || (rec ? `Status ${rec.status}` : 'Belum melakukan presensi'),
        recordTime: rec?.time
      };
    });
  }, [isOpen, selectedDate, attendanceRecords, students]);

  // Filtered items based on Class, Status filter, & Search query
  const filteredItems = useMemo(() => {
    return allDateItems.filter(item => {
      const matchesClass = selectedClassId === 'ALL' || item.classId === selectedClassId || item.className === selectedClassId;
      
      let matchesStatus = true;
      if (selectedStatusFilter === 'ALPA') {
        matchesStatus = item.status === 'ALPA';
      } else if (selectedStatusFilter === 'BELUM_ABSEN') {
        matchesStatus = item.status === 'BELUM_ABSEN';
      } else if (selectedStatusFilter === 'TERLAMBAT') {
        matchesStatus = item.status === 'TERLAMBAT';
      } else if (selectedStatusFilter === 'HADIR') {
        matchesStatus = item.status === 'HADIR';
      } else if (selectedStatusFilter === 'IZIN') {
        matchesStatus = item.status === 'IZIN';
      } else if (selectedStatusFilter === 'SAKIT') {
        matchesStatus = item.status === 'SAKIT';
      } else if (selectedStatusFilter === 'ALPA_OR_BELUM') {
        matchesStatus = item.status === 'ALPA' || item.status === 'BELUM_ABSEN';
      }

      const matchesSearch = 
        item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nisn.includes(searchQuery) ||
        item.className.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesClass && matchesStatus && matchesSearch;
    });
  }, [allDateItems, selectedClassId, selectedStatusFilter, searchQuery]);

  // Initialize selection when items change
  React.useEffect(() => {
    if (isOpen) {
      // Auto-select all items by default
      const allKeys = new Set(filteredItems.map(i => `${i.studentId}-${i.date}`));
      setSelectedKeys(allKeys);
    }
  }, [isOpen, selectedDate, selectedClassId, selectedStatusFilter]);

  const handleToggleItem = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const currentKeys = filteredItems.map(i => `${i.studentId}-${i.date}`);
    const isAllSelected = currentKeys.length > 0 && currentKeys.every(k => selectedKeys.has(k));

    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (isAllSelected) {
        currentKeys.forEach(k => next.delete(k));
      } else {
        currentKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const selectedItemsToProcess = filteredItems.filter(i => selectedKeys.has(`${i.studentId}-${i.date}`));

  // Execute Bulk Action
  const handleExecuteAction = () => {
    if (selectedItemsToProcess.length === 0) {
      alert('Silakan pilih minimal satu data siswa!');
      return;
    }

    if (actionType === 'DELETE') {
      const recordIdsToDelete = selectedItemsToProcess
        .map(i => i.existingRecordId)
        .filter((id): id is string => Boolean(id));

      if (recordIdsToDelete.length === 0) {
        alert('Tidak ada rekaman presensi tersimpan yang dapat direset/dihapus.');
        return;
      }

      onDeleteRecords(recordIdsToDelete);
      alert(`Berhasil menghapus/mereset ${recordIdsToDelete.length} rekaman presensi pada tanggal ${selectedDate}!`);
      onClose();
    } else {
      // CONVERT TO ANOTHER STATUS
      const updates = selectedItemsToProcess.map(i => ({
        studentId: i.studentId,
        studentName: i.studentName,
        nisn: i.nisn,
        className: i.className,
        date: i.date,
        newStatus: targetStatus,
        notes: bulkNotes.trim() || `Diubah massal menjadi ${targetStatus} oleh Admin`,
        existingRecordId: i.existingRecordId
      }));

      onBulkUpdateStatus(updates);
      alert(`Berhasil mengubah ${updates.length} data status masuk siswa menjadi ${targetStatus}!`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 p-5 sm:p-6 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center font-extrabold shadow-inner shrink-0 border border-white/20">
              <UserCheck className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-bold mb-1 border border-indigo-400/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Khusus Akun Admin</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Ubah Status Masuk Massal
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100/90 mt-0.5">
                Ubah status presensi masuk siswa secara serentak (Hadir, Izin, Sakit, Terlambat, Alpa) pada tanggal tertentu.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          {/* Filter Bar: Tanggal, Kelas, Status, Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Date Filter */}
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Tanggal:</span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Filter Status Saat Ini:</span>
                </label>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALPA">🔴 Khusus Alpa</option>
                  <option value="ALPA_OR_BELUM">🔴 Alpa & Belum Absen</option>
                  <option value="TERLAMBAT">⏰ Khusus Terlambat</option>
                  <option value="HADIR">✅ Khusus Hadir</option>
                  <option value="IZIN">📄 Khusus Izin</option>
                  <option value="SAKIT">🏥 Khusus Sakit</option>
                  <option value="BELUM_ABSEN">⚪ Belum Absen</option>
                  <option value="ALL">🌐 Semua Siswa</option>
                </select>
              </div>

              {/* Class Filter */}
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span>Filter Kelas:</span>
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cari Nama / NISN:</span>
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama / NISN..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Info bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 text-slate-600 font-medium">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Ditemukan: <strong className="text-indigo-700 font-black">{filteredItems.length}</strong> siswa pada <strong>{selectedDate}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-slate-600" />
                <span>
                  {filteredItems.length > 0 && filteredItems.every(i => selectedKeys.has(`${i.studentId}-${i.date}`))
                    ? 'Batal Pilih Semua'
                    : 'Pilih Semua'}
                </span>
              </button>
            </div>
          </div>

          {/* Action Configuration Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-indigo-200 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Tindakan Massal untuk {selectedItemsToProcess.length} Siswa Terpilih</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Convert to Other Status */}
              <label 
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                  actionType === 'CONVERT'
                    ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="actionType"
                  value="CONVERT"
                  checked={actionType === 'CONVERT'}
                  onChange={() => setActionType('CONVERT')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-black text-indigo-900 text-xs">
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Ubah Status Masuk Massal</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Ubah status absensi menjadi Hadir, Izin, Sakit, Terlambat, atau Alpa secara serentak.
                  </p>
                </div>
              </label>

              {/* Option B: Delete/Reset Records */}
              <label 
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                  actionType === 'DELETE'
                    ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="actionType"
                  value="DELETE"
                  checked={actionType === 'DELETE'}
                  onChange={() => setActionType('DELETE')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-black text-rose-800 text-xs">
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hapus Rekaman Presensi (Reset)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Hapus rekaman presensi sehingga status siswa kembali menjadi Belum Absen.
                  </p>
                </div>
              </label>
            </div>

            {/* If Convert Selected, show Target Status and Notes */}
            {actionType === 'CONVERT' && (
              <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ubah Status Masuk Menjadi:
                    </label>
                    <select
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value as AttendanceRecord['status'])}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="HADIR">✅ HADIR (Tepat Waktu)</option>
                      <option value="IZIN">📄 IZIN (Surat Izin)</option>
                      <option value="SAKIT">🏥 SAKIT (Surat Keterangan)</option>
                      <option value="TERLAMBAT">⏰ TERLAMBAT</option>
                      <option value="ALPA">🔴 ALPA (Tanpa Keterangan)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Catatan / Keterangan Massal:
                    </label>
                    <input
                      type="text"
                      value={bulkNotes}
                      onChange={(e) => setBulkNotes(e.target.value)}
                      placeholder="Contoh: Izin kegiatan / Disetujui Admin"
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Student List Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="p-3 pl-4 w-10 text-center">Pilih</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Kelas & NISN</th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Status Masuk Saat Ini</th>
                    <th className="p-3">Keterangan Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Tidak ada data siswa yang cocok dengan filter yang dipilih pada tanggal {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const key = `${item.studentId}-${item.date}`;
                      const isSelected = selectedKeys.has(key);

                      return (
                        <tr 
                          key={key} 
                          className={`hover:bg-indigo-50/40 transition-colors ${isSelected ? 'bg-indigo-50/20' : ''}`}
                        >
                          <td className="p-3 pl-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleItem(key)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-extrabold text-slate-800">
                            {item.studentName}
                          </td>
                          <td className="p-3 font-medium text-slate-600">
                            {item.className} • NISN: {item.nisn}
                          </td>
                          <td className="p-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {item.status === 'HADIR' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center gap-1">
                                <UserCheck className="w-3 h-3" /> HADIR
                              </span>
                            )}
                            {item.status === 'TERLAMBAT' && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" /> TERLAMBAT
                              </span>
                            )}
                            {item.status === 'IZIN' && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] inline-flex items-center gap-1">
                                📄 IZIN
                              </span>
                            )}
                            {item.status === 'SAKIT' && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] inline-flex items-center gap-1">
                                🏥 SAKIT
                              </span>
                            )}
                            {item.status === 'ALPA' && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-[10px] inline-flex items-center gap-1">
                                <UserX className="w-3 h-3" /> ALPA
                              </span>
                            )}
                            {item.status === 'BELUM_ABSEN' && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium text-[10px] inline-flex items-center gap-1">
                                ⚪ Belum Absen
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[11px] text-slate-500 truncate max-w-xs" title={item.notes}>
                            {item.notes}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 text-center sm:text-left">
            Total <strong>{selectedItemsToProcess.length}</strong> dari <strong>{filteredItems.length}</strong> siswa dipilih.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer w-full sm:w-auto"
            >
              Batal
            </button>

            {actionType === 'DELETE' ? (
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={selectedItemsToProcess.length === 0}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all transform active:scale-95 cursor-pointer w-full sm:w-auto"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus {selectedItemsToProcess.length} Data Rekam</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={selectedItemsToProcess.length === 0}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 cursor-pointer w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ubah {selectedItemsToProcess.length} Menjadi {targetStatus}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
