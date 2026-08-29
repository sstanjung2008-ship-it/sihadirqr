import React, { useState } from 'react';
import { AttendanceRecord, Student, SchoolProfile, StudentCharacterLog, LearningJournal } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  Sparkles, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Bot, 
  Lightbulb, 
  ShieldAlert, 
  Home, 
  Award, 
  Trophy, 
  Star, 
  ThumbsUp, 
  UserX, 
  Zap, 
  BookOpen,
  Filter,
  Frown,
  Check
} from 'lucide-react';

interface AnalyticsViewProps {
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  schoolProfile: SchoolProfile;
  characterLogs?: StudentCharacterLog[];
  learningJournals?: LearningJournal[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  students,
  attendanceRecords,
  schoolProfile,
  characterLogs = [],
  learningJournals = [],
}) => {
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<{ analysis: string; recommendations: string[] } | null>(null);
  
  // Tab/Filter view mode: 'ALL' | 'APPRECIATION' | 'ATTENTION'
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'APPRECIATION' | 'ATTENTION'>('ALL');

  // Group attendance records by past 7 days
  const past7DaysData = React.useMemo(() => {
    const days: { [key: string]: { date: string; Hadir: number; Terlambat: number; Sakit: number; Izin: number; Alpa: number } } = {};
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });

      days[dateStr] = {
        date: `${dayName} (${d.getDate()}/${d.getMonth() + 1})`,
        Hadir: 0,
        Terlambat: 0,
        Sakit: 0,
        Izin: 0,
        Alpa: 0,
      };
    }

    attendanceRecords.forEach((r) => {
      if (days[r.date]) {
        if (r.status === 'HADIR') days[r.date].Hadir++;
        else if (r.status === 'TERLAMBAT') days[r.date].Terlambat++;
        else if (r.status === 'SAKIT') days[r.date].Sakit++;
        else if (r.status === 'IZIN') days[r.date].Izin++;
        else if (r.status === 'ALPA') days[r.date].Alpa++;
      }
    });

    return Object.values(days);
  }, [attendanceRecords]);

  // Overall pie chart distribution
  const pieData = React.useMemo(() => {
    let hadir = 0, terlambat = 0, sakit = 0, izin = 0, alpa = 0;
    attendanceRecords.forEach(r => {
      if (r.status === 'HADIR') hadir++;
      else if (r.status === 'TERLAMBAT') terlambat++;
      else if (r.status === 'SAKIT') sakit++;
      else if (r.status === 'IZIN') izin++;
      else if (r.status === 'ALPA') alpa++;
    });

    return [
      { name: 'Hadir Tepat Waktu', value: hadir, color: '#10B981' },
      { name: 'Terlambat', value: terlambat, color: '#F59E0B' },
      { name: 'Sakit', value: sakit, color: '#F43F5E' },
      { name: 'Izin', value: izin, color: '#0EA5E9' },
      { name: 'Alpa', value: alpa, color: '#64748B' },
    ];
  }, [attendanceRecords]);

  // 1. Apresiasi Siswa: Hadir Paling Awal
  const earliestStudents = React.useMemo(() => {
    const map = new Map<string, { student: Student; earlyCount: number; earliestTime: string }>();
    
    students.forEach(std => {
      const stdRecs = attendanceRecords.filter(r => r.studentId === std.id && r.status === 'HADIR' && r.time && r.time !== '-');
      if (stdRecs.length > 0) {
        // Find early checkins (< 06:45:00 or earliest times)
        const times = stdRecs.map(r => r.time).sort();
        const earliest = times[0];
        const earlyCount = stdRecs.filter(r => r.time <= '06:45:00' || r.time <= (schoolProfile.startTime || '07:00')).length;
        map.set(std.id, { student: std, earlyCount: earlyCount || stdRecs.length, earliestTime: earliest });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.earlyCount - a.earlyCount || a.earliestTime.localeCompare(b.earliestTime))
      .slice(0, 6);
  }, [students, attendanceRecords, schoolProfile]);

  // 2. Apresiasi Siswa: Nilai Karakter Tertinggi
  const topCharacterStudents = React.useMemo(() => {
    const map = new Map<string, { student: Student; totalPoints: number; positiveCount: number; latestTrait: string }>();
    
    students.forEach(std => {
      const stdLogs = characterLogs.filter(l => l.studentId === std.id);
      if (stdLogs.length > 0) {
        let pts = 0;
        let posCount = 0;
        let latestTrait = '';
        stdLogs.forEach(l => {
          if (l.traitType === 'POSITIF') {
            pts += l.points;
            posCount++;
            if (!latestTrait) latestTrait = l.traitName;
          } else {
            pts -= l.points;
          }
        });
        if (pts > 0) {
          map.set(std.id, { student: std, totalPoints: pts, positiveCount: posCount, latestTrait: latestTrait || 'Perilaku Positif' });
        }
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 6);
  }, [students, characterLogs]);

  // 3. Apresiasi Siswa: Sering Aktif KBM
  const mostActiveKbmStudents = React.useMemo(() => {
    const map = new Map<string, { student: Student; activeCount: number; latestSubject: string; notes?: string }>();
    
    students.forEach(std => {
      let count = 0;
      let latestSubject = '';
      let lastNotes = '';
      learningJournals.forEach(j => {
        const att = j.studentAttendances?.find(a => a.studentId === std.id);
        if (att && att.status === 'Sangat aktif') {
          count++;
          latestSubject = j.subject;
          if (att.notes) lastNotes = att.notes;
        }
      });
      if (count > 0) {
        map.set(std.id, { student: std, activeCount: count, latestSubject, notes: lastNotes });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.activeCount - a.activeCount)
      .slice(0, 6);
  }, [students, learningJournals]);

  // 4. Perhatian Siswa: Nilai Karakter Terendah
  const lowestCharacterStudents = React.useMemo(() => {
    const map = new Map<string, { student: Student; totalPoints: number; negativeCount: number; latestViolation?: string }>();
    
    students.forEach(std => {
      const stdLogs = characterLogs.filter(l => l.studentId === std.id);
      let pts = 0;
      let negCount = 0;
      let latestViolation = '';
      stdLogs.forEach(l => {
        if (l.traitType === 'POSITIF') {
          pts += l.points;
        } else {
          pts -= l.points;
          negCount++;
          if (!latestViolation) latestViolation = l.traitName;
        }
      });
      if (negCount > 0 || pts < 10) {
        map.set(std.id, { 
          student: std, 
          totalPoints: pts, 
          negativeCount: negCount, 
          latestViolation: latestViolation || 'Catatan Pelanggaran' 
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.totalPoints - b.totalPoints || b.negativeCount - a.negativeCount)
      .slice(0, 6);
  }, [students, characterLogs]);

  // 5. Perhatian Siswa: Sering Mengganggu / Tidak Hadir KBM
  const disruptiveKbmStudents = React.useMemo(() => {
    const map = new Map<string, { student: Student; issueCount: number; latestSubject: string; notes?: string }>();
    
    students.forEach(std => {
      let count = 0;
      let latestSubject = '';
      let lastNotes = '';
      learningJournals.forEach(j => {
        const att = j.studentAttendances?.find(a => a.studentId === std.id);
        if (att && (att.status === 'Mengganggu' || att.status === 'Tidak hadir di kelas')) {
          count++;
          latestSubject = j.subject;
          if (att.notes) lastNotes = att.notes;
        }
      });
      if (count > 0) {
        map.set(std.id, { student: std, issueCount: count, latestSubject, notes: lastNotes });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 6);
  }, [students, learningJournals]);

  // Calculate Student Risk List (Students with lateCount >= 1)
  const studentRiskList = React.useMemo(() => {
    const map = new Map<string, { student: Student; lateCount: number; absentCount: number }>();

    students.forEach(std => {
      const stdRecs = attendanceRecords.filter(r => r.studentId === std.id);
      const lateCount = stdRecs.filter(r => r.status === 'TERLAMBAT').length;
      const absentCount = stdRecs.filter(r => r.status === 'ALPA' || r.status === 'SAKIT').length;

      if (lateCount >= 1) {
        map.set(std.id, { student: std, lateCount, absentCount });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.lateCount - a.lateCount);
  }, [students, attendanceRecords]);

  // Calculate Student Absent List (Students with ALPA >= 1)
  const studentAbsentList = React.useMemo(() => {
    const map = new Map<string, { student: Student; alpaCount: number; izinSakitCount: number }>();

    students.forEach(std => {
      const stdRecs = attendanceRecords.filter(r => r.studentId === std.id);
      const alpaCount = stdRecs.filter(r => r.status === 'ALPA').length;
      const izinSakitCount = stdRecs.filter(r => r.status === 'SAKIT' || r.status === 'IZIN').length;

      if (alpaCount >= 1) {
        map.set(std.id, { student: std, alpaCount, izinSakitCount });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.alpaCount - a.alpaCount);
  }, [students, attendanceRecords]);

  // Calculate Students who haven't scanned return today (Belum Scan Pulang Hari Ini)
  const notReturnedList = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords.filter(r => r.date === todayStr);

    const list: { student: Student; arrivalTime: string; status: AttendanceRecord['status'] }[] = [];

    students.forEach(std => {
      const rec = todayRecords.find(r => r.studentId === std.id);
      if (rec && (rec.status === 'HADIR' || rec.status === 'TERLAMBAT')) {
        if (!rec.returnTime && rec.returnStatus !== 'PULANG') {
          list.push({
            student: std,
            arrivalTime: rec.time,
            status: rec.status
          });
        }
      }
    });

    return list;
  }, [students, attendanceRecords]);

  // Call Gemini AI
  const handleRunAiAnalysis = async () => {
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: schoolProfile.name,
          attendanceSummary: past7DaysData,
          studentRiskList: studentRiskList.map(r => ({
            nama: r.student.name,
            kelas: r.student.className,
            jumlahTerlambat: r.lateCount,
            jumlahAbsen: r.absentCount
          }))
        })
      });

      const data = await response.json();
      setAiReport(data);
    } catch (err) {
      console.error("AI Analysis failed:", err);
      alert("Gagal menjalankan analisis AI. Pastikan server telah aktif.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* AI Assistant & Title Banner with Filter Buttons */}
      <div className="bg-indigo-700 text-white border border-indigo-800 rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        
        {/* Top Header & Buttons Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-indigo-500/30">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/20 text-indigo-100 text-xs px-3 py-1 rounded-full border border-white/20 font-semibold mb-2">
              <Bot className="w-3.5 h-3.5 text-amber-300" />
              Asisten AI Gemini Analisis Kehadiran
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Analitik & Evaluasi Performa Kehadiran Mingguan
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Evaluasi tren disiplin siswa secara otomatis, apresiasi kedisiplinan & keaktifan, serta rekomendasi tindak lanjut bagi guru BK & Kepala Sekolah.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRunAiAnalysis}
              disabled={isAiLoading}
              className="bg-white hover:bg-indigo-50 text-indigo-800 font-extrabold px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-2 text-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
              {isAiLoading ? 'Menganalisis Data...' : 'Jalankan Analisis AI Gemini'}
            </button>
          </div>
        </div>

        {/* Quick Category Filter Buttons (Apresiasi & Perhatian Siswa) */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-200">
            <Filter className="w-3.5 h-3.5 text-amber-300" /> Filter Tampilan Halaman:
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-white text-indigo-900 shadow-md ring-2 ring-white/50'
                  : 'bg-indigo-800/80 text-indigo-100 hover:bg-indigo-600 border border-indigo-500/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Semua Evaluasi
            </button>

            <button
              onClick={() => setActiveFilter('APPRECIATION')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeFilter === 'APPRECIATION'
                  ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-300'
                  : 'bg-indigo-800/80 text-indigo-100 hover:bg-emerald-600 border border-indigo-500/40'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
              🏆 Apresiasi Siswa
            </button>

            <button
              onClick={() => setActiveFilter('ATTENTION')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeFilter === 'ATTENTION'
                  ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-300'
                  : 'bg-indigo-800/80 text-indigo-100 hover:bg-rose-600 border border-indigo-500/40'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-200" />
              ⚠️ Perhatian Siswa
            </button>
          </div>
        </div>

        {/* AI Generated Report Drawer */}
        {aiReport && (
          <div className="mt-6 bg-white text-slate-800 rounded-2xl p-5 space-y-3 shadow-lg border border-indigo-100 animate-fadeIn">
            <h3 className="text-sm font-extrabold text-indigo-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Hasil Analisis Eksekutif AI Gemini
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100/60 font-medium">
              {aiReport.analysis}
            </p>

            <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 pt-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              Rekomendasi Tindak Lanjut Guru & Kepala Sekolah:
            </h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-slate-700">
              {aiReport.recommendations?.map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="font-medium">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Analytics Charts Grid (Shown in ALL or APPRECIATION mode) */}
      {(activeFilter === 'ALL' || activeFilter === 'APPRECIATION') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Weekly Bar Chart (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Grafik Kehadiran 7 Hari Terakhir
              </h2>
              <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">Total Scan Harian</span>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={past7DaysData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} fontWeight={600} />
                  <YAxis stroke="#64748b" fontSize={11} fontWeight={600} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '16px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Hadir" fill="#10B981" name="Hadir Tepat Waktu" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Terlambat" fill="#F59E0B" name="Terlambat" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Sakit" fill="#F43F5E" name="Sakit" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Izin" fill="#0EA5E9" name="Izin" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Alpa" fill="#64748B" name="Alpa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overall Pie Chart (4 cols) */}
          <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Persentase Status Kehadiran
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Distribusi akumulasi presensi</p>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '16px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Custom Legend List */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
              {pieData.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="truncate">{p.name}: <strong className="text-slate-900">{p.value}</strong></span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ========================================== */}
      {/* SECTION 1: KELOMPOK APRESIASI SISWA       */}
      {/* ========================================== */}
      {(activeFilter === 'ALL' || activeFilter === 'APPRECIATION') && (
        <div className="space-y-6 pt-2">
          
          <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
            <h2 className="text-lg font-black text-emerald-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Kelompok Apresiasi Siswa (Kedisiplinan & Keaktifan)
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-extrabold border border-emerald-200">
              3 Kategori Penghargaan
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* 1. Apresiasi Siswa: Hadir Paling Awal */}
            <div className="bg-white border border-emerald-200/90 rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Apresiasi: Hadir Paling Awal
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Siswa hadir paling pagi di sekolah</p>
                </div>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  {earliestStudents.length} Siswa
                </span>
              </div>

              {earliestStudents.length === 0 ? (
                <div className="bg-slate-50 p-4 rounded-2xl text-center text-xs text-slate-500 font-medium">
                  Belum ada data scan hadir masuk pagi.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {earliestStudents.map(({ student, earlyCount, earliestTime }, rank) => (
                    <div key={student.id} className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70 flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                        {rank + 1}
                      </div>
                      <img
                        src={student.photoUrl}
                        alt={student.name}
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-emerald-400/80 shadow-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{student.name}</h4>
                        <p className="text-[10px] text-emerald-700 font-bold">{student.className} | NISN: {student.nisn}</p>
                        
                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                          <span className="bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-600" /> Terpagi: {earliestTime}
                          </span>
                          <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                            {earlyCount}x Tepat Waktu
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Apresiasi Siswa: Nilai Karakter Tertinggi */}
            <div className="bg-white border border-emerald-200/90 rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <Award className="w-4 h-4 text-emerald-600" />
                    Apresiasi: Karakter Tertinggi
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Akumulasi poin positif siswa terbanyak</p>
                </div>
                <span className="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Top Poin
                </span>
              </div>

              {topCharacterStudents.length === 0 ? (
                <div className="bg-slate-50 p-4 rounded-2xl text-center text-xs text-slate-500 font-medium">
                  Belum ada data nilai karakter positif.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {topCharacterStudents.map(({ student, totalPoints, positiveCount, latestTrait }, rank) => (
                    <div key={student.id} className="bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100/80 flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                        {rank + 1}
                      </div>
                      <img
                        src={student.photoUrl}
                        alt={student.name}
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-amber-400 shadow-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{student.name}</h4>
                          <span className="bg-emerald-600 text-white font-mono font-black text-[11px] px-2 py-0.5 rounded-lg shrink-0">
                            +{totalPoints} Pts
                          </span>
                        </div>
                        <p className="text-[10px] text-indigo-700 font-bold">{student.className} | {positiveCount} Penilaian</p>
                        <p className="text-[10px] text-slate-600 mt-0.5 truncate font-medium">
                          ✨ {latestTrait}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Apresiasi Siswa: Sering Aktif KBM */}
            <div className="bg-white border border-emerald-200/90 rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <ThumbsUp className="w-4 h-4 text-indigo-600" />
                    Apresiasi: Sering Aktif KBM
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Siswa teraktif di Jurnal Pembelajaran Guru</p>
                </div>
                <span className="bg-indigo-100 text-indigo-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  {mostActiveKbmStudents.length} Siswa
                </span>
              </div>

              {mostActiveKbmStudents.length === 0 ? (
                <div className="bg-slate-50 p-4 rounded-2xl text-center text-xs text-slate-500 font-medium">
                  Belum ada catatan keaktifan siswa di Jurnal KBM.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {mostActiveKbmStudents.map(({ student, activeCount, latestSubject, notes }, rank) => (
                    <div key={student.id} className="bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100/80 flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                        {rank + 1}
                      </div>
                      <img
                        src={student.photoUrl}
                        alt={student.name}
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-400 shadow-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{student.name}</h4>
                          <span className="bg-indigo-700 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shrink-0">
                            {activeCount}x Sangat Aktif
                          </span>
                        </div>
                        <p className="text-[10px] text-indigo-700 font-bold">{student.className} | Mapel: {latestSubject}</p>
                        {notes && (
                          <p className="text-[10px] text-slate-600 mt-0.5 truncate italic">
                            "{notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SECTION 2: KELOMPOK PERHATIAN SISWA        */}
      {/* ========================================== */}
      {(activeFilter === 'ALL' || activeFilter === 'ATTENTION') && (
        <div className="space-y-6 pt-4 border-t border-slate-200/80">
          
          <div className="flex items-center justify-between border-b border-rose-200 pb-3">
            <h2 className="text-lg font-black text-rose-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Kelompok Perhatian Siswa (Perlu Pembinaan BK & Wali Kelas)
            </h2>
            <span className="bg-rose-100 text-rose-900 text-xs px-3 py-1 rounded-full font-extrabold border border-rose-200">
              Evaluasi Risiko Siswa
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">

            {/* 1. Perhatian: Nilai Karakter Terendah */}
            <div className="bg-white border border-rose-200/90 rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-rose-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <Frown className="w-4 h-4 text-rose-600" />
                    Daftar Perhatian: Nilai Karakter Terendah
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Siswa dengan akumulasi poin pelanggaran terbanyak</p>
                </div>
                <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200">
                  {lowestCharacterStudents.length} Siswa
                </span>
              </div>

              {lowestCharacterStudents.length === 0 ? (
                <div className="bg-emerald-50 p-4 rounded-2xl text-center text-xs text-emerald-800 font-medium">
                  Tidak ada siswa terdeteksi memiliki nilai karakter rendah.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lowestCharacterStudents.map(({ student, totalPoints, negativeCount, latestViolation }) => (
                    <div key={student.id} className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100 flex items-center gap-3">
                      <img
                        src={student.photoUrl}
                        alt={student.name}
                        className="w-11 h-11 rounded-xl object-cover ring-2 ring-rose-400 shadow-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{student.name}</h4>
                          <span className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded-md ${
                            totalPoints < 0 ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}>
                            {totalPoints} Pts Total
                          </span>
                        </div>
                        <p className="text-[10px] text-rose-700 font-bold">{student.className} | {negativeCount} Catatan Pelanggaran</p>
                        <p className="text-[10px] text-slate-600 mt-0.5 truncate font-medium">
                          ⚠️ {latestViolation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Perhatian: Sering Mengganggu / Tidak Hadir KBM */}
            <div className="bg-white border border-amber-200/90 rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <UserX className="w-4 h-4 text-amber-600" />
                    Daftar Perhatian: Sering Mengganggu / Bolos KBM
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Catatan ketertiban kelas dari Jurnal Guru</p>
                </div>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  {disruptiveKbmStudents.length} Siswa
                </span>
              </div>

              {disruptiveKbmStudents.length === 0 ? (
                <div className="bg-emerald-50 p-4 rounded-2xl text-center text-xs text-emerald-800 font-medium">
                  Tidak ada catatan siswa mengganggu atau membolos KBM.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {disruptiveKbmStudents.map(({ student, issueCount, latestSubject, notes }) => (
                    <div key={student.id} className="bg-amber-50/50 p-3 rounded-2xl border border-amber-100 flex items-center gap-3">
                      <img
                        src={student.photoUrl}
                        alt={student.name}
                        className="w-11 h-11 rounded-xl object-cover ring-2 ring-amber-400 shadow-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{student.name}</h4>
                          <span className="bg-amber-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shrink-0">
                            {issueCount}x Catatan KBM
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-800 font-bold">{student.className} | Mapel: {latestSubject}</p>
                        {notes && (
                          <p className="text-[10px] text-rose-700 mt-0.5 truncate font-medium">
                            🚨 {notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Existing Attendance Risk Lists (Belum Scan Pulang, Sering Terlambat, Sering Alpa) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">

            {/* Belum Scan Pulang */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-emerald-600" />
                  Belum Scan Pulang Hari Ini
                </h3>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {notReturnedList.length} Siswa
                </span>
              </div>

              {notReturnedList.length === 0 ? (
                <div className="text-center py-4 text-xs text-emerald-700 font-medium bg-emerald-50/60 rounded-xl">
                  Semua siswa hadir sudah scan pulang.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {notReturnedList.map(({ student, arrivalTime }) => (
                    <div key={student.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center gap-2 text-xs">
                      <img src={student.photoUrl} alt={student.name} className="w-8 h-8 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">{student.name}</p>
                        <p className="text-[10px] text-slate-500">{student.className} | Masuk: {arrivalTime}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sering Terlambat */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Sering Terlambat
                </h3>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {studentRiskList.length} Siswa
                </span>
              </div>

              {studentRiskList.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500 font-medium bg-slate-50 rounded-xl">
                  Tidak ada riwayat terlambat.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {studentRiskList.map(({ student, lateCount }) => (
                    <div key={student.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center gap-2 text-xs">
                      <img src={student.photoUrl} alt={student.name} className="w-8 h-8 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">{student.name}</p>
                        <p className="text-[10px] text-amber-700 font-bold">{student.className} | {lateCount}x Terlambat</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sering Alpa */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  Sering Alpa
                </h3>
                <span className="bg-rose-100 text-rose-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {studentAbsentList.length} Siswa
                </span>
              </div>

              {studentAbsentList.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500 font-medium bg-slate-50 rounded-xl">
                  Tidak ada riwayat Alpa.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {studentAbsentList.map(({ student, alpaCount }) => (
                    <div key={student.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center gap-2 text-xs">
                      <img src={student.photoUrl} alt={student.name} className="w-8 h-8 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">{student.name}</p>
                        <p className="text-[10px] text-rose-700 font-bold">{student.className} | {alpaCount}x Alpa</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
