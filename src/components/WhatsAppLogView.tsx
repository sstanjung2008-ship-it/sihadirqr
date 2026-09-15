import React, { useState, useMemo } from 'react';
import { WhatsAppLog } from '../types';
import { 
  Bell, 
  Send, 
  CheckCircle2, 
  Search, 
  ExternalLink, 
  LogOut, 
  LogIn, 
  AlertTriangle, 
  Filter, 
  BookOpen, 
  User, 
  GraduationCap, 
  Clock,
  Users,
  Copy,
  Check,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { createWhatsAppUrl } from '../lib/exportUtils';

interface WhatsAppLogViewProps {
  waLogs: WhatsAppLog[];
}

export const WhatsAppLogView: React.FC<WhatsAppLogViewProps> = ({ waLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'PARENT' | 'TEACHER'>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'MASUK' | 'PULANG' | 'ALPA' | 'GURU'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isTeacherLog = (log: WhatsAppLog) => {
    return log.type === 'JADWAL_GURU' || log.recipientRole === 'TEACHER' || log.message.toLowerCase().includes('mengajar') || Boolean(log.teacherName);
  };

  const isParentLog = (log: WhatsAppLog) => {
    return !isTeacherLog(log) || log.recipientRole === 'PARENT';
  };

  // Categorized counts
  const countGuruTotal = useMemo(() => waLogs.filter(isTeacherLog).length, [waLogs]);
  const countParentTotal = useMemo(() => waLogs.filter(isParentLog).length, [waLogs]);
  const countMasuk = useMemo(() => waLogs.filter(l => l.type === 'HADIR' || l.type === 'TERLAMBAT').length, [waLogs]);
  const countPulang = useMemo(() => waLogs.filter(l => l.type === 'PULANG' || l.message.toLowerCase().includes('pulang')).length, [waLogs]);
  const countAlpa = useMemo(() => waLogs.filter(l => l.type === 'ALPA' || l.message.toLowerCase().includes('alpa')).length, [waLogs]);

  const filteredLogs = useMemo(() => {
    return waLogs.filter(l => {
      const isTeacher = isTeacherLog(l);
      const isParent = !isTeacher;

      // Category filter
      if (activeCategory === 'PARENT' && !isParent) return false;
      if (activeCategory === 'TEACHER' && !isTeacher) return false;

      // Type filter
      if (selectedTypeFilter === 'MASUK' && !(l.type === 'HADIR' || l.type === 'TERLAMBAT')) return false;
      if (selectedTypeFilter === 'PULANG' && !(l.type === 'PULANG' || l.message.toLowerCase().includes('pulang'))) return false;
      if (selectedTypeFilter === 'ALPA' && !(l.type === 'ALPA' || l.message.toLowerCase().includes('alpa'))) return false;
      if (selectedTypeFilter === 'GURU' && !isTeacher) return false;

      // Search filter
      const studentOrTeacherName = (l.studentName || l.teacherName || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        studentOrTeacherName.includes(query) ||
        (l.phone && l.phone.includes(query)) ||
        (l.className && l.className.toLowerCase().includes(query)) ||
        (l.message && l.message.toLowerCase().includes(query));

      return matchesSearch;
    });
  }, [waLogs, activeCategory, selectedTypeFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <MessageSquare className="w-6 h-6" />
            </div>
            Log Pesan
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Riwayat log notifikasi pesan guru (pengingat jadwal mengajar KBM) dan pesan notifikasi orang tua (presensi masuk, pulang, alpa).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pesan, siswa, guru, kelas..."
              className="bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 w-64 sm:w-72 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Card */}
        <div 
          onClick={() => { setActiveCategory('ALL'); setSelectedTypeFilter('ALL'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === 'ALL' && selectedTypeFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeCategory === 'ALL' && selectedTypeFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              Semua Log Pesan
            </span>
            <Bell className={`w-4 h-4 ${activeCategory === 'ALL' && selectedTypeFilter === 'ALL' ? 'text-emerald-400' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black">{waLogs.length}</span>
            <span className={`text-xs ${activeCategory === 'ALL' && selectedTypeFilter === 'ALL' ? 'text-slate-400' : 'text-slate-500'}`}>Total Riwayat</span>
          </div>
        </div>

        {/* Notifikasi Orang Tua */}
        <div 
          onClick={() => { setActiveCategory('PARENT'); setSelectedTypeFilter('ALL'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === 'PARENT'
              ? 'bg-emerald-800 text-white border-emerald-800 shadow-md ring-2 ring-emerald-600/30'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-emerald-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeCategory === 'PARENT' ? 'text-emerald-200' : 'text-emerald-700'}`}>
              Pesan Notifikasi Orang Tua
            </span>
            <Users className={`w-4 h-4 ${activeCategory === 'PARENT' ? 'text-emerald-300' : 'text-emerald-600'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black">{countParentTotal}</span>
            <span className={`text-xs ${activeCategory === 'PARENT' ? 'text-emerald-200' : 'text-slate-500'}`}>
              Presensi Siswa (Masuk/Pulang/Alpa)
            </span>
          </div>
        </div>

        {/* Notifikasi Pesan Guru */}
        <div 
          onClick={() => { setActiveCategory('TEACHER'); setSelectedTypeFilter('ALL'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === 'TEACHER'
              ? 'bg-indigo-800 text-white border-indigo-800 shadow-md ring-2 ring-indigo-600/30'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-indigo-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeCategory === 'TEACHER' ? 'text-indigo-200' : 'text-indigo-700'}`}>
              Notifikasi Pesan Guru
            </span>
            <BookOpen className={`w-4 h-4 ${activeCategory === 'TEACHER' ? 'text-indigo-300' : 'text-indigo-600'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black">{countGuruTotal}</span>
            <span className={`text-xs ${activeCategory === 'TEACHER' ? 'text-indigo-200' : 'text-slate-500'}`}>
              Pengingat Jadwal KBM Guru
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="space-y-2.5">
        {/* Category Selector */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => { setActiveCategory('ALL'); setSelectedTypeFilter('ALL'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Semua Pesan ({waLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveCategory('PARENT'); setSelectedTypeFilter('ALL'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeCategory === 'PARENT'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Notifikasi Orang Tua ({countParentTotal})</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveCategory('TEACHER'); setSelectedTypeFilter('ALL'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeCategory === 'TEACHER'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Notifikasi Guru ({countGuruTotal})</span>
          </button>
        </div>

        {/* Sub-Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Tipe Pesan:</span>
          
          <button
            type="button"
            onClick={() => setSelectedTypeFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              selectedTypeFilter === 'ALL'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Tipe
          </button>

          <button
            type="button"
            onClick={() => { setSelectedTypeFilter('MASUK'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              selectedTypeFilter === 'MASUK'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <LogIn className="w-3 h-3" />
            Masuk / Hadir ({countMasuk})
          </button>

          <button
            type="button"
            onClick={() => { setSelectedTypeFilter('PULANG'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              selectedTypeFilter === 'PULANG'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <LogOut className="w-3 h-3" />
            Pulang ({countPulang})
          </button>

          <button
            type="button"
            onClick={() => { setSelectedTypeFilter('ALPA'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              selectedTypeFilter === 'ALPA'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Alpa ({countAlpa})
          </button>

          <button
            type="button"
            onClick={() => { setSelectedTypeFilter('GURU'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              selectedTypeFilter === 'GURU'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            Jadwal Guru ({countGuruTotal})
          </button>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold text-slate-800">
              Daftar Log Pesan Terkirim ({filteredLogs.length})
            </h2>
            {activeCategory !== 'ALL' && (
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                activeCategory === 'PARENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
              }`}>
                {activeCategory === 'PARENT' ? 'Orang Tua' : 'Guru'}
              </span>
            )}
          </div>
          <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Sistem Notifikasi Pesan Aktif
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4">Kategori & Tipe</th>
                <th className="py-3.5 px-4">Penerima</th>
                <th className="py-3.5 px-4">No. WhatsApp</th>
                <th className="py-3.5 px-4">Isi Pesan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium text-xs">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Belum ada riwayat log pesan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isTeacher = isTeacherLog(log);
                  const isPulang = log.type === 'PULANG' || log.message.toLowerCase().includes('pulang');
                  const isAlpa = log.type === 'ALPA' || log.message.toLowerCase().includes('alpa');
                  const isLate = log.type === 'TERLAMBAT' || log.message.toLowerCase().includes('terlambat');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Waktu */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(log.timestamp).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* Kategori & Tipe */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {isTeacher ? (
                            <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-extrabold text-[10px] inline-flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-indigo-600" />
                              Pesan Guru
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-extrabold text-[10px] inline-flex items-center gap-1">
                              <Users className="w-3 h-3 text-emerald-600" />
                              Pesan Orang Tua
                            </span>
                          )}

                          <div>
                            {isTeacher ? (
                              <span className="text-[10px] text-indigo-600 font-bold block">Pengingat Jadwal KBM</span>
                            ) : isPulang ? (
                              <span className="text-[10px] text-purple-600 font-bold block">Presensi Pulang</span>
                            ) : isAlpa ? (
                              <span className="text-[10px] text-rose-600 font-bold block">Otomatis Alpa</span>
                            ) : isLate ? (
                              <span className="text-[10px] text-amber-600 font-bold block">Scan Terlambat</span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-bold block">Scan Masuk</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Penerima */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isTeacher ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {isTeacher ? <User className="w-3.5 h-3.5" /> : <GraduationCap className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 leading-tight">
                              {log.studentName || log.teacherName || 'Pengguna'}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                              {isTeacher 
                                ? (log.className ? `Kelas ${log.className}` : 'Guru Mata Pelajaran') 
                                : `Siswa - ${log.className || '-'}`
                              }
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* No. WA */}
                      <td className="py-3.5 px-4 font-mono text-emerald-700 font-bold whitespace-nowrap">
                        {log.phone}
                      </td>

                      {/* Isi Pesan */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="relative group">
                          <p className="line-clamp-2 text-[11px] text-slate-700 italic bg-slate-50 p-2 rounded-xl border border-slate-200/80 font-medium">
                            "{log.message}"
                          </p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          TERKIRIM
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(log.id, log.message)}
                            title="Salin Isi Pesan"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                          >
                            {copiedId === log.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={createWhatsAppUrl(log.phone, log.message)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-2.5 py-1.5 rounded-xl text-[11px] inline-flex items-center gap-1 transition-colors shadow-xs"
                          >
                            <ExternalLink className="w-3 h-3 text-emerald-600" />
                            Buka WA
                          </a>
                        </div>
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
  );
};
