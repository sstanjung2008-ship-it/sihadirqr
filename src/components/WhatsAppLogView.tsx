import React, { useState } from 'react';
import { WhatsAppLog } from '../types';
import { Bell, Send, CheckCircle2, Search, ExternalLink, LogOut, LogIn, AlertTriangle, Filter } from 'lucide-react';
import { createWhatsAppUrl } from '../lib/exportUtils';

interface WhatsAppLogViewProps {
  waLogs: WhatsAppLog[];
}

export const WhatsAppLogView: React.FC<WhatsAppLogViewProps> = ({ waLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'MASUK' | 'PULANG' | 'ALPA'>('ALL');

  const filteredLogs = waLogs.filter(l => {
    const matchesSearch = 
      l.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery) ||
      l.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.message.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedTypeFilter === 'MASUK') {
      return l.type === 'HADIR' || l.type === 'TERLAMBAT';
    } else if (selectedTypeFilter === 'PULANG') {
      return l.type === 'PULANG' || l.message.toLowerCase().includes('pulang');
    } else if (selectedTypeFilter === 'ALPA') {
      return l.type === 'ALPA' || l.message.toLowerCase().includes('alpa');
    }

    return true;
  });

  const countMasuk = waLogs.filter(l => l.type === 'HADIR' || l.type === 'TERLAMBAT').length;
  const countPulang = waLogs.filter(l => l.type === 'PULANG' || l.message.toLowerCase().includes('pulang')).length;
  const countAlpa = waLogs.filter(l => l.type === 'ALPA' || l.message.toLowerCase().includes('alpa')).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-emerald-600" />
            Riwayat Log Notifikasi WhatsApp Orang Tua
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daftar notifikasi presensi otomatis (Masuk, Pulang, dan Alpa) yang terkirim ke WhatsApp wali murid.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Log WA Siswa..."
              className="bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={() => setSelectedTypeFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
            selectedTypeFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Semua Log ({waLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTypeFilter('MASUK')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
            selectedTypeFilter === 'MASUK'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
          }`}
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Presensi Masuk ({countMasuk})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTypeFilter('PULANG')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
            selectedTypeFilter === 'PULANG'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
          }`}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Presensi Pulang ({countPulang})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTypeFilter('ALPA')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
            selectedTypeFilter === 'ALPA'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-rose-700 bg-rose-50 hover:bg-rose-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Otomatis Alpa ({countAlpa})</span>
        </button>
      </div>

      {/* Log Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-sm font-extrabold text-slate-800">
            Total Log Terdaftar ({filteredLogs.length})
          </h2>
          <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Sistem Notifikasi Terintegrasi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Waktu Terkirim</th>
                <th className="py-3.5 px-4">Tipe Notifikasi</th>
                <th className="py-3.5 px-4">Siswa</th>
                <th className="py-3.5 px-4">No. WA Tujuan</th>
                <th className="py-3.5 px-4">Isi Pesan Notifikasi</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium text-xs">
                    Belum ada riwayat log notifikasi WhatsApp yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isPulang = log.type === 'PULANG' || log.message.toLowerCase().includes('pulang');
                  const isAlpa = log.type === 'ALPA' || log.message.toLowerCase().includes('alpa');
                  const isLate = log.type === 'TERLAMBAT' || log.message.toLowerCase().includes('terlambat');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPulang ? (
                          <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-full font-extrabold text-[10px] inline-flex items-center gap-1">
                            <LogOut className="w-3 h-3 text-purple-600" />
                            Scan Pulang
                          </span>
                        ) : isAlpa ? (
                          <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full font-extrabold text-[10px] inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Otomatis Alpa
                          </span>
                        ) : isLate ? (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full font-extrabold text-[10px] inline-flex items-center gap-1">
                            <LogIn className="w-3 h-3 text-amber-600" />
                            Scan Terlambat
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-extrabold text-[10px] inline-flex items-center gap-1">
                            <LogIn className="w-3 h-3 text-emerald-600" />
                            Scan Masuk
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-extrabold text-slate-900">{log.studentName}</p>
                        <p className="text-[10px] text-indigo-600 font-bold">{log.className}</p>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-emerald-700 font-bold whitespace-nowrap">
                        {log.phone}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="line-clamp-2 text-[11px] text-slate-700 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 font-medium">
                          "{log.message}"
                        </p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          TERKIRIM
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <a
                          href={createWhatsAppUrl(log.phone, log.message)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-3 py-1.5 rounded-xl text-[11px] inline-flex items-center gap-1 transition-colors shadow-xs"
                        >
                          <ExternalLink className="w-3 h-3 text-emerald-600" />
                          Buka WA
                        </a>
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
