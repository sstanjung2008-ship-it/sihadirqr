import React, { useState, useMemo } from 'react';
import { Student, SchoolClass, AttendanceRecord, UserSession } from '../types';
import { getLocalDateString } from '../lib/storage';
import { 
  UserX, 
  Trash2, 
  X, 
  AlertTriangle, 
  CheckSquare, 
  Square, 
  Calendar, 
  Filter, 
  Search, 
  CheckCircle2, 
  HeartPulse, 
  FileText, 
  Sparkles, 
  Info, 
  ShieldCheck, 
  RotateCcw 
} from 'lucide-react';

export interface BulkAlpaItem {
  studentId: string;
  studentName: string;
  nisn: string;
  classId: string;
  className: string;
  date: string;
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
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Student IDs (or unique keys for this date)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Bulk action options
  const [actionType, setActionType] = useState<'DELETE' | 'CONVERT'>('DELETE');
  const [targetStatus, setTargetStatus] = useState<AttendanceRecord['status']>('IZIN');
  const [bulkNotes, setBulkNotes] = useState<string>('Disetujui Admin (Update Massal)');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  // Student map for fast lookup
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(s => map.set(s.id, s));
    return map;
  }, [students]);

  // Find all ALPA records for selectedDate
  const alpaItems = useMemo<BulkAlpaItem[]>(() => {
    if (!isOpen) return [];

    const items: BulkAlpaItem[] = [];

    // Filter attendance records on selectedDate that have status ALPA
    const dateAlpaRecords = attendanceRecords.filter(r => r.date === selectedDate && r.status === 'ALPA');
    
    dateAlpaRecords.forEach(rec => {
      const student = studentMap.get(rec.studentId) || students.find(s => s.nisn === rec.nisn || s.name.toLowerCase() === rec.studentName.toLowerCase());
      
      items.push({
        studentId: rec.studentId,
        studentName: rec.studentName || student?.name || 'Siswa',
        nisn: rec.nisn || student?.nisn || '-',
        classId: student?.classId || '',
        className: rec.className || student?.className || '-',
        date: rec.date,
        existingRecordId: rec.id,
        notes: rec.notes || 'Status ALPA',
        recordTime: rec.time
      });
    });

    return items;
  }, [isOpen, selectedDate, attendanceRecords, students, studentMap]);

  // Filtered Alpa items based on Class & Search query
  const filteredAlpaItems = useMemo(() => {
    return alpaItems.filter(item => {
      const matchesClass = selectedClassId === 'ALL' || item.classId === selectedClassId || item.className === selectedClassId;
      const matchesSearch = 
        item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nisn.includes(searchQuery) ||
        item.className.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesClass && matchesSearch;
    });
  }, [alpaItems, selectedClassId, searchQuery]);

  // Initialize selection when items change
  React.useEffect(() => {
    if (isOpen) {
      // Auto-select all items by default
      const allKeys = new Set(filteredAlpaItems.map(i => `${i.studentId}-${i.date}`));
      setSelectedKeys(allKeys);
    }
  }, [isOpen, selectedDate, selectedClassId]);

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
    const currentKeys = filteredAlpaItems.map(i => `${i.studentId}-${i.date}`);
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

  const selectedItemsToProcess = filteredAlpaItems.filter(i => selectedKeys.has(`${i.studentId}-${i.date}`));

  // Execute Bulk Action
  const handleExecuteAction = () => {
    if (selectedItemsToProcess.length === 0) {
      alert('Silakan pilih minimal satu data siswa berstatus Alpa!');
      return;
    }

    if (actionType === 'DELETE') {
      const recordIdsToDelete = selectedItemsToProcess
        .map(i => i.existingRecordId)
        .filter((id): id is string => Boolean(id));

      if (recordIdsToDelete.length === 0) {
        alert('Tidak ada record ID Alpa tersimpan yang dapat dihapus.');
        return;
      }

      onDeleteRecords(recordIdsToDelete);
      alert(`Berhasil menghapus ${recordIdsToDelete.length} data rekam presensi Alpa pada tanggal ${selectedDate}!`);
      setIsConfirming(false);
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
        notes: bulkNotes.trim() || `Diubah massal dari Alpa ke ${targetStatus} oleh Admin`,
        existingRecordId: i.existingRecordId
      }));

      onBulkUpdateStatus(updates);
      alert(`Berhasil mengubah ${updates.length} data siswa Alpa menjadi status ${targetStatus}!`);
      setIsConfirming(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-red-900 p-5 sm:p-6 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center font-extrabold shadow-inner shrink-0 border border-white/20">
              <UserX className="w-6 h-6 text-rose-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-200 text-xs font-bold mb-1 border border-rose-400/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Khusus Akun Admin</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Kelola & Hapus Data Alpa Massal
              </h2>
              <p className="text-xs sm:text-sm text-rose-100/90 mt-0.5">
                Hapus atau ubah status siswa Alpa secara serentak pada tanggal tertentu.
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
          {/* Filter Bar: Tanggal, Kelas, Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Date Filter */}
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-600" />
                  <span>Pilih Tanggal Presensi:</span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="ALL">Semua Kelas ({alpaItems.length} Alpa)</option>
                  {classes.map(c => {
                    const countInClass = alpaItems.filter(i => i.classId === c.id || i.className === c.name).length;
                    return (
                      <option key={c.id} value={c.id}>
                        Kelas {c.name} ({countInClass} Alpa)
                      </option>
                    );
                  })}
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
                  placeholder="Ketik nama atau NISN..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Info bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 text-slate-600 font-medium">
                <Info className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Ditemukan: <strong className="text-rose-700 font-black">{filteredAlpaItems.length}</strong> siswa berstatus Alpa pada <strong>{selectedDate}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-slate-600" />
                <span>
                  {filteredAlpaItems.length > 0 && filteredAlpaItems.every(i => selectedKeys.has(`${i.studentId}-${i.date}`))
                    ? 'Batal Pilih Semua'
                    : 'Pilih Semua'}
                </span>
              </button>
            </div>
          </div>

          {/* Action Configuration Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-600" />
              <span>Pilihan Tindakan Massal (Untuk {selectedItemsToProcess.length} Siswa Terpilih)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Delete Alpa Records */}
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
                    <span>Hapus Rekam Alpa (Reset)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Menghapus rekaman data Alpa sehingga riwayat Alpa dihapus bersih dari sistem dan rekap.
                  </p>
                </div>
              </label>

              {/* Option B: Convert Alpa to Other Status */}
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
                    <span>Ubah Status Massal</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Mengubah status Alpa menjadi Hadir, Izin, atau Sakit secara serentak.
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
                      Ubah Status Menjadi:
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
                      placeholder="Contoh: Izin susulan / Disetujui Admin"
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
                    <th className="p-3">Status Saat Ini</th>
                    <th className="p-3">Keterangan Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAlpaItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Tidak ada data siswa berstatus Alpa yang ditemukan pada tanggal {selectedDate} dengan filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    filteredAlpaItems.map((item) => {
                      const key = `${item.studentId}-${item.date}`;
                      const isSelected = selectedKeys.has(key);

                      return (
                        <tr 
                          key={key} 
                          className={`hover:bg-rose-50/40 transition-colors ${isSelected ? 'bg-rose-50/20' : ''}`}
                        >
                          <td className="p-3 pl-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleItem(key)}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
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
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-[10px] inline-flex items-center gap-1">
                              <UserX className="w-3 h-3" /> ALPA
                            </span>
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
            Total <strong>{selectedItemsToProcess.length}</strong> dari <strong>{filteredAlpaItems.length}</strong> siswa Alpa dipilih.
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
                <span>Hapus {selectedItemsToProcess.length} Data Alpa</span>
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
