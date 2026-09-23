import React, { useState, useMemo, useEffect } from 'react';
import { Student, SchoolClass, AttendanceRecord, UserSession } from '../types';
import { getLocalDateString } from '../lib/storage';
import { 
  LogOut, 
  X, 
  CheckSquare, 
  Calendar, 
  Filter, 
  Search, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  UserCheck, 
  AlertCircle, 
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';

export interface BulkReturnItem {
  studentId: string;
  studentName: string;
  nisn: string;
  classId: string;
  className: string;
  date: string;
  entryStatus: AttendanceRecord['status'] | 'BELUM_ABSEN';
  entryTime?: string;
  returnStatus?: AttendanceRecord['returnStatus'];
  returnTime?: string;
  isReturned: boolean;
  existingRecordId?: string;
  notes?: string;
}

export interface BulkReturnUpdatePayload {
  studentId: string;
  studentName: string;
  nisn: string;
  className: string;
  date: string;
  newReturnStatus: 'PULANG' | 'PULANG_TEPAT' | 'PULANG_CEPAT' | 'BELUM_PULANG';
  newReturnTime?: string;
  notes?: string;
  existingRecordId?: string;
}

interface BulkReturnManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classes: SchoolClass[];
  attendanceRecords: AttendanceRecord[];
  initialDate?: string;
  userSession?: UserSession | null;
  onBulkUpdateReturnStatus: (updates: BulkReturnUpdatePayload[]) => void;
}

export const BulkReturnManagementModal: React.FC<BulkReturnManagementModalProps> = ({
  isOpen,
  onClose,
  students,
  classes,
  attendanceRecords,
  initialDate,
  userSession,
  onBulkUpdateReturnStatus,
}) => {
  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [returnStatusFilter, setReturnStatusFilter] = useState<'BELUM_PULANG' | 'SUDAH_PULANG' | 'ALL'>('BELUM_PULANG');
  const [entryStatusFilter, setEntryStatusFilter] = useState<'HADIR_ONLY' | 'ALL'>('HADIR_ONLY');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Student Keys for this modal
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Action configuration
  const [actionType, setActionType] = useState<'SET_RETURN' | 'RESET_RETURN'>('SET_RETURN');
  const [targetReturnStatus, setTargetReturnStatus] = useState<'PULANG' | 'PULANG_TEPAT' | 'PULANG_CEPAT'>('PULANG');
  
  // Current time default (HH:mm)
  const getCurrentTimeString = () => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const [returnTimeInput, setReturnTimeInput] = useState<string>(getCurrentTimeString());
  const [bulkNotes, setBulkNotes] = useState<string>('Disetujui Admin (Pulang Massal)');

  // Map students for quick access
  const allDateItems = useMemo<BulkReturnItem[]>(() => {
    if (!isOpen) return [];

    const dateRecordsMap = new Map<string, AttendanceRecord>();
    attendanceRecords
      .filter(r => r.date === selectedDate)
      .forEach(r => {
        if (r.studentId) dateRecordsMap.set(r.studentId, r);
        if (r.nisn) dateRecordsMap.set(r.nisn, r);
      });

    return students.map(student => {
      const rec = dateRecordsMap.get(student.id) || (student.nisn ? dateRecordsMap.get(student.nisn) : undefined);
      const isReturned = !!(rec && (rec.returnTime || rec.returnStatus === 'PULANG' || rec.returnStatus === 'PULANG_TEPAT' || rec.returnStatus === 'PULANG_CEPAT'));

      return {
        studentId: student.id,
        studentName: student.name,
        nisn: student.nisn || '-',
        classId: student.classId || '',
        className: student.className || '-',
        date: selectedDate,
        entryStatus: rec ? rec.status : 'BELUM_ABSEN',
        entryTime: rec?.time && rec.time !== '-' ? rec.time : undefined,
        returnStatus: rec?.returnStatus,
        returnTime: rec?.returnTime && rec.returnTime !== '-' ? rec.returnTime : undefined,
        isReturned,
        existingRecordId: rec?.id,
        notes: rec?.notes,
      };
    });
  }, [isOpen, selectedDate, attendanceRecords, students]);

  // Filter items
  const filteredItems = useMemo(() => {
    return allDateItems.filter(item => {
      // 1. Class filter
      const matchesClass = selectedClassId === 'ALL' || item.classId === selectedClassId || item.className === selectedClassId;

      // 2. Return status filter
      let matchesReturn = true;
      if (returnStatusFilter === 'BELUM_PULANG') {
        matchesReturn = !item.isReturned;
      } else if (returnStatusFilter === 'SUDAH_PULANG') {
        matchesReturn = item.isReturned;
      }

      // 3. Entry status filter
      let matchesEntry = true;
      if (entryStatusFilter === 'HADIR_ONLY') {
        matchesEntry = item.entryStatus === 'HADIR' || item.entryStatus === 'TERLAMBAT';
      }

      // 4. Search query
      const matchesSearch =
        item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nisn.includes(searchQuery) ||
        item.className.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesClass && matchesReturn && matchesEntry && matchesSearch;
    });
  }, [allDateItems, selectedClassId, returnStatusFilter, entryStatusFilter, searchQuery]);

  // Auto-select all filtered items whenever filters change
  useEffect(() => {
    if (isOpen) {
      const allKeys = new Set(filteredItems.map(i => `${i.studentId}-${i.date}`));
      setSelectedKeys(allKeys);
    }
  }, [isOpen, selectedDate, selectedClassId, returnStatusFilter, entryStatusFilter]);

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

  // Execute Action
  const handleExecute = () => {
    if (selectedItemsToProcess.length === 0) {
      alert('Silakan pilih minimal satu siswa terlebih dahulu!');
      return;
    }

    if (actionType === 'SET_RETURN') {
      const timeToUse = returnTimeInput.trim() || getCurrentTimeString();
      const updates: BulkReturnUpdatePayload[] = selectedItemsToProcess.map(item => ({
        studentId: item.studentId,
        studentName: item.studentName,
        nisn: item.nisn,
        className: item.className,
        date: item.date,
        newReturnStatus: targetReturnStatus,
        newReturnTime: timeToUse,
        notes: bulkNotes.trim() || undefined,
        existingRecordId: item.existingRecordId,
      }));

      onBulkUpdateReturnStatus(updates);
      alert(`Berhasil memperbarui status pulang untuk ${updates.length} siswa menjadi ${targetReturnStatus === 'PULANG_CEPAT' ? 'Pulang Cepat' : 'Pulang'} pada jam ${timeToUse}!`);
      onClose();
    } else {
      // RESET_RETURN
      const updates: BulkReturnUpdatePayload[] = selectedItemsToProcess.map(item => ({
        studentId: item.studentId,
        studentName: item.studentName,
        nisn: item.nisn,
        className: item.className,
        date: item.date,
        newReturnStatus: 'BELUM_PULANG',
        newReturnTime: undefined,
        existingRecordId: item.existingRecordId,
      }));

      onBulkUpdateReturnStatus(updates);
      alert(`Berhasil mereset status kepulangan ${updates.length} siswa menjadi Belum Pulang!`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 p-5 sm:p-6 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center font-extrabold shadow-inner shrink-0 border border-white/20">
              <LogOut className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-xs font-bold mb-1 border border-emerald-400/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Khusus Akun Admin</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Ubah Status Pulang Massal
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5">
                Atur status dan jam kepulangan siswa secara serentak (Pulang Normal, Pulang Cepat, atau Batalkan Pulang).
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

        {/* Action Configuration Bar */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 p-4 sm:p-5 shrink-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide">
                Pilih Jenis Tindakan:
              </span>
              <div className="inline-flex rounded-xl bg-white p-1 border border-emerald-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActionType('SET_RETURN')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    actionType === 'SET_RETURN'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tandai Pulang Massal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('RESET_RETURN')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    actionType === 'RESET_RETURN'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Batalkan / Reset Pulang</span>
                </button>
              </div>
            </div>

            {actionType === 'SET_RETURN' && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Pulang Target */}
                <div className="flex items-center gap-1.5 bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
                  <span className="text-slate-500 font-bold">Status:</span>
                  <select
                    value={targetReturnStatus}
                    onChange={e => setTargetReturnStatus(e.target.value as any)}
                    className="bg-transparent font-extrabold text-emerald-900 focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="PULANG">PULANG (Normal / Tepat Waktu)</option>
                    <option value="PULANG_TEPAT">PULANG_TEPAT (Tepat Waktu)</option>
                    <option value="PULANG_CEPAT">PULANG_CEPAT (Dispensasi / Sakit)</option>
                  </select>
                </div>

                {/* Jam Pulang Target */}
                <div className="flex items-center gap-1.5 bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-slate-500 font-bold">Jam Pulang:</span>
                  <input
                    type="time"
                    value={returnTimeInput}
                    onChange={e => setReturnTimeInput(e.target.value)}
                    className="bg-transparent font-mono font-bold text-slate-900 focus:outline-none cursor-pointer text-xs w-20"
                  />
                  <button
                    type="button"
                    onClick={() => setReturnTimeInput(getCurrentTimeString())}
                    className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                    title="Gunakan Jam Sekarang"
                  >
                    Sekarang
                  </button>
                </div>
              </div>
            )}
          </div>

          {actionType === 'SET_RETURN' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <span className="text-xs font-bold text-slate-600 shrink-0">Catatan Pulang (Opsional):</span>
              <input
                type="text"
                value={bulkNotes}
                onChange={e => setBulkNotes(e.target.value)}
                placeholder="Contoh: Kepulangan massal disetujui Admin / Ekstrakurikuler selesai..."
                className="bg-white border border-emerald-200 text-slate-800 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-1 font-medium shadow-2xs"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Siswa yang dipilih akan direset status kepulangannya kembali menjadi <strong>Belum Pulang</strong> (jam pulang dihapus). Status absensi masuk siswa tetap aman.
              </span>
            </div>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 shrink-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Filter Tanggal */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-slate-500 font-bold shrink-0">Tgl:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent font-mono font-bold text-slate-800 focus:outline-none cursor-pointer w-full text-xs"
              />
            </div>

            {/* Filter Kelas */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer w-full text-xs"
              >
                <option value="ALL">Semua Kelas</option>
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Filter Status Pulang Saat Ini */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs">
              <span className="text-slate-500 font-bold shrink-0">Pulang:</span>
              <select
                value={returnStatusFilter}
                onChange={e => setReturnStatusFilter(e.target.value as any)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer w-full text-xs"
              >
                <option value="BELUM_PULANG">Hanya Belum Pulang</option>
                <option value="SUDAH_PULANG">Hanya Sudah Pulang</option>
                <option value="ALL">Semua Siswa</option>
              </select>
            </div>

            {/* Filter Status Masuk */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs">
              <span className="text-slate-500 font-bold shrink-0">Masuk:</span>
              <select
                value={entryStatusFilter}
                onChange={e => setEntryStatusFilter(e.target.value as any)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer w-full text-xs"
              >
                <option value="HADIR_ONLY">Hanya Hadir &amp; Terlambat</option>
                <option value="ALL">Semua Status Masuk</option>
              </select>
            </div>
          </div>

          {/* Search Box & Quick Selection Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa, NISN, atau kelas..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs font-medium"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {filteredItems.length > 0 && filteredItems.every(i => selectedKeys.has(`${i.studentId}-${i.date}`))
                    ? 'Batal Pilih Semua'
                    : 'Pilih Semua Siswa'}
                </span>
              </button>

              <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-xl">
                {selectedItemsToProcess.length} dari {filteredItems.length} siswa dipilih
              </span>
            </div>
          </div>
        </div>

        {/* Student Table List */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Info className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-700">Tidak ada data siswa yang cocok dengan filter</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Coba sesuaikan tanggal, filter kelas, atau filter status pulang di bagian atas.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredItems.length > 0 && filteredItems.every(i => selectedKeys.has(`${i.studentId}-${i.date}`))}
                        onChange={handleToggleSelectAll}
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Nama Siswa &amp; NISN</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3">Status Masuk</th>
                    <th className="p-3">Status Pulang Saat Ini</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map(item => {
                    const key = `${item.studentId}-${item.date}`;
                    const isSelected = selectedKeys.has(key);

                    return (
                      <tr
                        key={key}
                        onClick={() => handleToggleItem(key)}
                        className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${
                          isSelected ? 'bg-emerald-50/60' : ''
                        }`}
                      >
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleItem(key)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <p className="font-extrabold text-slate-800">{item.studentName}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">NISN: {item.nisn}</p>
                        </td>
                        <td className="p-3 font-bold text-slate-700">
                          {item.className}
                        </td>
                        <td className="p-3">
                          {item.entryStatus === 'HADIR' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                              Hadir {item.entryTime ? `(${item.entryTime})` : ''}
                            </span>
                          )}
                          {item.entryStatus === 'TERLAMBAT' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Terlambat {item.entryTime ? `(${item.entryTime})` : ''}
                            </span>
                          )}
                          {item.entryStatus === 'SAKIT' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                              Sakit
                            </span>
                          )}
                          {item.entryStatus === 'IZIN' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                              Izin
                            </span>
                          )}
                          {item.entryStatus === 'ALPA' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300">
                              Alpa
                            </span>
                          )}
                          {item.entryStatus === 'BELUM_ABSEN' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200">
                              Belum Absen
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {item.isReturned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <LogOut className="w-3 h-3 text-emerald-600" />
                              {item.returnStatus === 'PULANG_CEPAT' ? 'Pulang Cepat' : 'Sudah Pulang'}{' '}
                              {item.returnTime ? `(${item.returnTime})` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Belum Pulang
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {selectedItemsToProcess.length > 0 ? (
              <span>
                Akan memproses <strong className="text-emerald-900 font-extrabold">{selectedItemsToProcess.length} siswa</strong> pada tanggal {selectedDate}.
              </span>
            ) : (
              <span>Pilih siswa di atas untuk memulai tindakan massal.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={selectedItemsToProcess.length === 0}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                selectedItemsToProcess.length === 0
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : actionType === 'SET_RETURN'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/25 active:scale-95'
                  : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-600/25 active:scale-95'
              }`}
            >
              {actionType === 'SET_RETURN' ? (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>Terapkan Pulang ({selectedItemsToProcess.length} Siswa)</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Pulang ({selectedItemsToProcess.length} Siswa)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
