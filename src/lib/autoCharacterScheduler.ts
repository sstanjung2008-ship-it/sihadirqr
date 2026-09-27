import { 
  getSchoolProfile, 
  getStudents, 
  getAttendanceRecords, 
  getStudentCharacterLogs, 
  saveStudentCharacterLogs, 
  getCharacterTraits,
  getUserSession,
  getLearningJournals
} from './storage';
import { StudentCharacterLog } from '../types';

let serverClockOffsetMs = 0;
let hasSyncedServerClock = false;

/**
 * Sinkronisasi selisih waktu perangkat dengan Cloud Server Time
 * Menjamin 16:00 WITA berjalan serempak dan identik di semua perangkat
 */
export async function syncServerClockOffset(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try {
    const t0 = Date.now();
    const res = await fetch('/api/time');
    if (res.ok) {
      const data = await res.json();
      const t1 = Date.now();
      const roundTrip = Math.round((t1 - t0) / 2);
      if (typeof data.serverTime === 'number') {
        serverClockOffsetMs = (data.serverTime + roundTrip) - t1;
        hasSyncedServerClock = true;
      }
    }
  } catch {
    // Fallback gracefully to local UTC offset
  }
  return serverClockOffsetMs;
}

// Otomatis sinkronkan waktu server saat modul dimuat
if (typeof window !== 'undefined') {
  syncServerClockOffset();
}

/**
 * Menghitung waktu tanggal dan jam WITA (UTC+8) yang presisi berbasis Cloud Server Time
 */
export function getWitaDateTime(): { witaDate: Date; witaDateStr: string; witaTimeStr: string; totalMinutes: number; dayName: string } {
  // Gunakan waktu lokal yang sudah dikalibrasi selisihnya dengan Cloud Server
  const nowMs = Date.now() + serverClockOffsetMs;
  const now = new Date(nowMs);
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const witaDate = new Date(utc + (3600000 * 8));

  const yyyy = witaDate.getFullYear();
  const mm = String(witaDate.getMonth() + 1).padStart(2, '0');
  const dd = String(witaDate.getDate()).padStart(2, '0');
  const witaDateStr = `${yyyy}-${mm}-${dd}`;

  const hours = witaDate.getHours();
  const minutes = witaDate.getMinutes();
  const seconds = witaDate.getSeconds();
  const witaTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const totalMinutes = hours * 60 + minutes;

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = dayNames[witaDate.getDay()];

  return { witaDate, witaDateStr, witaTimeStr, totalMinutes, dayName };
}

/**
 * Menjalankan evaluasi penilaian karakter otomatis untuk seluruh aspek sekolah:
 * 1. Tepat Waktu Presensi (+1 Poin setiap 3 hari datang tepat waktu)
 * 2. Terlambat Presensi (-2 Poin)
 * 3. Alpa Presensi (-5 Poin)
 * 4. Belum Scan Presensi (-1 Poin, dievaluasi 16:00 WITA)
 * 5. Belum Scan Pulang (-1 Poin, dievaluasi 16:00 WITA)
 * 6. Jurnal KBM (Sangat Aktif +1, Tidak Hadir di Kelas -2, Mengganggu -1)
 *
 * Ditulis serentak oleh sistem dan dikirim dalam 1 pengiriman tunggal ke Cloud Firestore.
 */
export function run16WitaAutoCharacterAssessment(force: boolean = false): { executed: boolean; count: number; message: string } {
  // PENGHEMAT KUOTA UTAMA: Dilarang keras dijalankan oleh selain role ADMIN
  // Akun Guru, Pos Scanner, dan Orang Tua tidak mengevaluasi poin otomatis
  const session = getUserSession();
  if (!force && session?.role !== 'ADMIN') {
    return { executed: false, count: 0, message: 'Hanya akun Administrator yang berhak menjalankan evaluasi otomatis sekolah.' };
  }

  const profile = getSchoolProfile();

  // Jika saklar master penilaian karakter dinonaktifkan
  if (profile.autoCharacterAssessmentEnabled === false) {
    return { executed: false, count: 0, message: 'Sistem Penilaian Karakter Otomatis sedang non-aktif di Pengaturan.' };
  }

  const { witaDateStr, totalMinutes, dayName } = getWitaDateTime();

  // Waktu target: 16:00 WITA (16 * 60 = 960 menit)
  const targetMinutes = 16 * 60; // 16:00 WITA

  if (!force && totalMinutes < targetMinutes) {
    return { 
      executed: false, 
      count: 0, 
      message: `Belum mencapai waktu 16:00 WITA (Sekarang pukul ${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')} WITA).` 
    };
  }

  // Cek apakah hari ini merupakan hari aktif sekolah
  const activeDays = profile.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  if (!force && !activeDays.includes(dayName)) {
    return { executed: false, count: 0, message: `Hari ini (${dayName}) adalah hari libur mingguan belajar.` };
  }

  // Cek apakah hari ini merupakan hari libur kalender sekolah / nasional (termasuk rentang libur)
  const isHoliday = (profile.holidays || []).some(h => {
    if (h.endDate) {
      return witaDateStr >= h.date && witaDateStr <= h.endDate;
    }
    return h.date === witaDateStr;
  });
  if (!force && isHoliday) {
    return { executed: false, count: 0, message: `Hari ini (${witaDateStr}) tercatat sebagai hari libur sekolah.` };
  }

  // Cek apakah sudah pernah dieksekusi hari ini
  const lastRunKey = 'sihadir_auto_char_16wita_last_run';
  const lastRunDate = localStorage.getItem(lastRunKey);
  if (!force && lastRunDate === witaDateStr) {
    return { executed: false, count: 0, message: `Penilaian otomatis 16:00 WITA untuk tanggal ${witaDateStr} sudah pernah dijalankan.` };
  }

  // Jalankan evaluasi komprehensif seluruh aturan karakter (termasuk aturan 16:00 WITA)
  const result = reconcileAllAutoCharacterLogs(true);
  
  localStorage.setItem(lastRunKey, witaDateStr);

  return {
    executed: true,
    count: result.addedCount,
    message: result.addedCount > 0 
      ? `Evaluasi otomatis 16:00 WITA berhasil mencatat ${result.addedCount} penilaian karakter baru (Tepat Waktu, Terlambat, Alpa, Belum Scan, Belum Pulang, KBM) ke Cloud!`
      : `Pemeriksaan selesai: Seluruh siswa telah lengkap dinilai dan tertib presensi untuk tanggal ${witaDateStr}.`
  };
}

/**
 * Rekonsiliasi Menyeluruh SEMUA Aturan Penilaian Karakter Otomatis:
 * 1. TEPAT WAKTU PRESENSI (HADIR N HARI) -> +onTimePoints (default +1 poin per 3 hari)
 * 2. TERLAMBAT PRESENSI -> -latePoints (default -2 poin)
 * 3. ALPA PRESENSI -> -alpaPoints (default -5 poin)
 * 4. BELUM SCAN PRESENSI -> -unscannedPoints (default -1 poin)
 * 5. BELUM SCAN PULANG -> -unreturnedPoints (default -1 poin)
 * 6. JURNAL KBM -> Sangat Aktif (+1), Tidak Hadir di Kelas (-2), Mengganggu (-1)
 *
 * Menjamin penilaian karakter sekolah berjalan 100% otomatis, adil, konsisten, dan anti-duplikasi.
 */
export function reconcileAllAutoCharacterLogs(include16WitaRules: boolean = false): { addedCount: number; removedCount: number } {
  const profile = getSchoolProfile();
  if (profile.autoCharacterAssessmentEnabled === false) {
    return { addedCount: 0, removedCount: 0 };
  }

  const attendanceRecords = getAttendanceRecords();
  const currentLogs = getStudentCharacterLogs();
  const students = getStudents();
  const traits = getCharacterTraits();
  const learningJournals = getLearningJournals();

  // Pengaturan besaran poin dari konfigurasi sekolah
  const unscannedPoints = profile.autoCharacterPoints?.unscannedPoints ?? 1;
  const unreturnedPoints = profile.autoCharacterPoints?.unreturnedPoints ?? 1;
  const unscannedBothPoints = profile.autoCharacterPoints?.unscannedBothPoints ?? 3;
  const alpaPoints = profile.autoCharacterPoints?.alpaPoints ?? 5;
  const latePoints = profile.autoCharacterPoints?.latePoints ?? 2;
  const onTimePoints = profile.autoCharacterPoints?.onTimePoints ?? 1;
  const onTimeRequiredDays = profile.autoCharacterPoints?.onTimeRequiredDays ?? 3;
  const veryActiveKbmPoints = profile.autoCharacterPoints?.veryActiveKbmPoints ?? 1;
  const absentKbmPoints = profile.autoCharacterPoints?.absentKbmPoints ?? 2;
  const disruptivePoints = profile.autoCharacterPoints?.disruptivePoints ?? 1;

  // Dapatkan master traits terkait
  const alpaTrait = traits.find(t => 
    t.id === 'trait-auto-alpa' || 
    t.id === 'trait-011' ||
    (t.type === 'NEGATIF' && (t.name.toLowerCase().includes('alpa') || t.name.toLowerCase().includes('tanpa keterangan') || t.name.toLowerCase().includes('tidak masuk sekolah')))
  ) || {
    id: 'trait-auto-alpa',
    name: 'Tidak Masuk Sekolah Tanpa Keterangan / Alpa',
    type: 'NEGATIF' as const,
    points: alpaPoints,
    category: 'Kedisiplinan'
  };

  const unscannedBothTrait = traits.find(t => 
    t.id === 'trait-auto-unscanned-both' || 
    (t.type === 'NEGATIF' && t.name.toLowerCase().includes('belum scan masuk dan pulang'))
  ) || {
    id: 'trait-auto-unscanned-both',
    name: 'Karakter Belum scan Masuk dan Pulang',
    type: 'NEGATIF' as const,
    points: unscannedBothPoints,
    category: 'Kedisiplinan'
  };

  const lateTrait = traits.find(t => 
    t.id === 'trait-auto-late' || 
    (t.type === 'NEGATIF' && t.name.toLowerCase().includes('terlambat') && t.name.toLowerCase().includes('sekolah'))
  ) || {
    id: 'trait-auto-late',
    name: 'Terlambat Masuk Sekolah',
    type: 'NEGATIF' as const,
    points: latePoints,
    category: 'Kedisiplinan'
  };

  const onTimeTrait = traits.find(t => 
    t.id === 'trait-auto-ontime' || 
    (t.type === 'POSITIF' && t.name.toLowerCase().includes('tepat') && t.name.toLowerCase().includes('waktu'))
  ) || {
    id: 'trait-auto-ontime',
    name: 'Datang Tepat Waktu Presensi',
    type: 'POSITIF' as const,
    points: onTimePoints,
    category: 'Kedisiplinan'
  };

  const unscannedTrait = traits.find(t => 
    t.id === 'trait-015' || 
    (t.type === 'NEGATIF' && t.name.toLowerCase().includes('belum') && t.name.toLowerCase().includes('scan'))
  ) || {
    id: 'trait-auto-unscanned',
    name: 'Belum Melakukan Scan Presensi',
    type: 'NEGATIF' as const,
    points: unscannedPoints,
    category: 'Kedisiplinan'
  };

  const unreturnedTrait = traits.find(t => 
    t.id === 'trait-016' || 
    (t.type === 'NEGATIF' && t.name.toLowerCase().includes('belum') && t.name.toLowerCase().includes('pulang'))
  ) || {
    id: 'trait-auto-unreturned',
    name: 'Belum Melakukan Scan Pulang',
    type: 'NEGATIF' as const,
    points: unreturnedPoints,
    category: 'Kedisiplinan'
  };

  const veryActiveTrait = traits.find(t => 
    t.id === 'trait-013' || 
    (t.type === 'POSITIF' && t.name.toLowerCase().includes('sangat aktif'))
  ) || {
    id: 'trait-013',
    name: 'Sangat Aktif saat KBM',
    type: 'POSITIF' as const,
    points: veryActiveKbmPoints,
    category: 'Keaktifan'
  };

  const absentKbmTrait = traits.find(t => 
    t.id === 'trait-014' || 
    (t.type === 'NEGATIF' && t.name.toLowerCase().includes('tidak hadir di kelas'))
  ) || {
    id: 'trait-014',
    name: 'Tidak Hadir di Kelas saat KBM',
    type: 'NEGATIF' as const,
    points: absentKbmPoints,
    category: 'Kedisiplinan'
  };

  const disruptiveTrait = traits.find(t => 
    t.id === 'trait-009' || 
    (t.type === 'NEGATIF' && t.name.toLowerCase().includes('mengganggu'))
  ) || {
    id: 'trait-auto-disruptive',
    name: 'Mengganggu KBM di Kelas',
    type: 'NEGATIF' as const,
    points: disruptivePoints,
    category: 'Pelanggaran'
  };

  const newLogs: StudentCharacterLog[] = [];
  let addedCount = 0;

  // Pemetaan absensi per siswa untuk evaluasi beruntun
  const studentAttendanceMap = new Map<string, typeof attendanceRecords>();
  students.forEach(s => studentAttendanceMap.set(s.id, []));

  attendanceRecords.forEach(rec => {
    if (rec.studentId && studentAttendanceMap.has(rec.studentId)) {
      studentAttendanceMap.get(rec.studentId)!.push(rec);
    }
  });

  // -------------------------------------------------------------
  // 1. ATURAN REWARD: TEPAT WAKTU PRESENSI (+onTimePoints per N hari HADIR)
  // -------------------------------------------------------------
  students.forEach(student => {
    const records = studentAttendanceMap.get(student.id) || [];
    const sortedOnTimeRecords = records
      .filter(r => r.status === 'HADIR')
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sortedOnTimeRecords.length >= onTimeRequiredDays) {
      const totalGroups = Math.floor(sortedOnTimeRecords.length / onTimeRequiredDays);
      for (let g = 0; g < totalGroups; g++) {
        const groupRecords = sortedOnTimeRecords.slice(g * onTimeRequiredDays, (g + 1) * onTimeRequiredDays);
        const lastRecord = groupRecords[groupRecords.length - 1];
        const datesFormatted = groupRecords.map(r => r.date).join(', ');
        const targetDate = lastRecord.date;

        const alreadyLoggedOnTime = [...currentLogs, ...newLogs].some(l => 
          (l.studentId === student.id || (student.nisn && l.nisn === student.nisn) || (student.name && l.studentName && l.studentName.toLowerCase() === student.name.toLowerCase())) &&
          (
            l.id === `auto-ontime-${student.id}-group-${g}-${targetDate}` ||
            l.notes?.includes(datesFormatted) ||
            (l.date === targetDate && l.traitType === 'POSITIF' && l.traitName.toLowerCase().includes('tepat waktu'))
          )
        );

        if (!alreadyLoggedOnTime) {
          newLogs.push({
            id: `auto-ontime-${student.id}-group-${g}-${targetDate}`,
            studentId: student.id,
            studentName: student.name,
            nisn: student.nisn || '-',
            classId: student.classId,
            className: student.className,
            traitId: onTimeTrait.id,
            traitName: onTimeTrait.name,
            traitType: 'POSITIF',
            points: onTimePoints,
            evaluatorName: 'Sistem Otomatis Presensi',
            timestamp: `${targetDate} 16:00:00`,
            date: targetDate,
            notes: `Penilaian Otomatis Presensi: Datang Tepat Waktu ${onTimeRequiredDays} hari (${datesFormatted})`,
          });
          addedCount++;
        }
      }
    }
  });

  // -------------------------------------------------------------
  // 2. ATURAN PENALTI: TERLAMBAT PRESENSI (-latePoints)
  // -------------------------------------------------------------
  attendanceRecords.forEach(attRec => {
    if (attRec.status === 'TERLAMBAT' && attRec.studentId && attRec.date) {
      const std = students.find(s => 
        s.id === attRec.studentId || 
        (attRec.nisn && s.nisn === attRec.nisn) || 
        (attRec.studentName && s.name.toLowerCase() === attRec.studentName.toLowerCase())
      );
      const studentId = std?.id || attRec.studentId;
      const studentName = std?.name || attRec.studentName || 'Siswa';
      const nisn = std?.nisn || attRec.nisn || '-';
      const classId = std?.classId || '';
      const className = std?.className || attRec.className || '';

      const alreadyHasLateLog = [...currentLogs, ...newLogs].some(l => 
        (l.studentId === studentId || (nisn !== '-' && l.nisn === nisn) || (studentName && l.studentName && l.studentName.toLowerCase() === studentName.toLowerCase())) &&
        l.date === attRec.date &&
        l.traitType === 'NEGATIF' &&
        (
          l.id === `auto-late-${studentId}-${attRec.date}` || 
          l.traitName.toLowerCase().includes('terlambat') || 
          l.notes?.toLowerCase().includes('terlambat')
        )
      );

      if (!alreadyHasLateLog) {
        newLogs.push({
          id: `auto-late-${studentId}-${attRec.date}`,
          studentId: studentId,
          studentName: studentName,
          nisn: nisn,
          classId: classId,
          className: className,
          traitId: lateTrait.id,
          traitName: lateTrait.name,
          traitType: 'NEGATIF',
          points: latePoints,
          evaluatorName: 'Sistem Otomatis Presensi',
          timestamp: `${attRec.date} ${attRec.time && attRec.time !== '-' ? attRec.time : '16:00:00'}`,
          date: attRec.date,
          notes: `Penilaian Otomatis Presensi: Scan Hadir Terlambat pukul ${attRec.time || 'Pagi'} (${attRec.date})`,
        });
        addedCount++;
      }
    }
  });

  // -------------------------------------------------------------
  // 3. ATURAN PENALTI: ALPA PRESENSI (-alpaPoints, default 5 poin)
  // -------------------------------------------------------------
  attendanceRecords.forEach(attRec => {
    if (attRec.status === 'ALPA' && attRec.studentId && attRec.date) {
      const std = students.find(s => 
        s.id === attRec.studentId || 
        (attRec.nisn && s.nisn === attRec.nisn) || 
        (attRec.studentName && s.name.toLowerCase() === attRec.studentName.toLowerCase())
      );
      const studentId = std?.id || attRec.studentId;
      const studentName = std?.name || attRec.studentName || 'Siswa';
      const nisn = std?.nisn || attRec.nisn || '-';
      const classId = std?.classId || '';
      const className = std?.className || attRec.className || '';

      const alreadyHasAlpaLog = [...currentLogs, ...newLogs].some(l => 
        (l.studentId === studentId || (nisn !== '-' && l.nisn === nisn) || (studentName && l.studentName && l.studentName.toLowerCase() === studentName.toLowerCase())) &&
        l.date === attRec.date &&
        l.traitType === 'NEGATIF' &&
        (
          l.id === `auto-alpa-${studentId}-${attRec.date}` || 
          l.traitName.toLowerCase().includes('alpa') || 
          l.notes?.toLowerCase().includes('alpa')
        )
      );

      if (!alreadyHasAlpaLog) {
        newLogs.push({
          id: `auto-alpa-${studentId}-${attRec.date}`,
          studentId: studentId,
          studentName: studentName,
          nisn: nisn,
          classId: classId,
          className: className,
          traitId: alpaTrait.id,
          traitName: alpaTrait.name,
          traitType: 'NEGATIF',
          points: alpaPoints,
          evaluatorName: 'Sistem Otomatis Presensi',
          timestamp: `${attRec.date} 16:00:00`,
          date: attRec.date,
          notes: `Penilaian Otomatis Presensi: Terekam status ALPA (Tidak Masuk Sekolah Tanpa Keterangan / Alpa) pada tanggal ${attRec.date}`,
        });
        addedCount++;
      }
    }
  });

  // -------------------------------------------------------------
  // 4. ATURAN PENALTI EVALUASI 16:00 WITA:
  //    4A. Belum Scan Presensi (-unscannedPoints, default -1 poin)
  //    4B. Belum Scan Pulang (-unreturnedPoints, default -1 poin)
  //    4C. Karakter Belum scan Masuk dan Pulang (Status Masuk Belum Absen) (-unscannedBothPoints, default -3 poin)
  //    HANYA dievaluasi jika include16WitaRules === true DAN totalMinutes >= 16 * 60!
  //    Mencegah siswa dikenai penalti "belum pulang / belum scan" saat jam belajar pagi/siang masih berlangsung!
  // -------------------------------------------------------------
  const { witaDateStr, totalMinutes } = getWitaDateTime();
  const isEligibleFor16Wita = include16WitaRules && totalMinutes >= (16 * 60);

  if (isEligibleFor16Wita) {
    const todayRecords = attendanceRecords.filter(r => r.date === witaDateStr);
    const todayRecordMap = new Map(todayRecords.map(r => [r.studentId, r]));

    students.forEach(student => {
      const rec = todayRecordMap.get(student.id);

      // 4A. Belum Scan Presensi
      // Khusus siswa dengan status masuk HADIR tetapi pada kolom Jam Masuk belum scan
      const isStatusHadir = !!(rec && rec.status === 'HADIR');
      const isUnscannedEntry = isStatusHadir && (
        !rec.time || 
        rec.time === '-' || 
        rec.time.trim() === '' || 
        rec.time.toLowerCase().includes('belum')
      );

      if (isUnscannedEntry) {
        const alreadyLoggedUnscanned = [...currentLogs, ...newLogs].some(l => 
          l.studentId === student.id && 
          l.date === witaDateStr && 
          (
            l.id === `auto-unscanned-${student.id}-${witaDateStr}` || 
            (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('scan') && !l.traitName.toLowerCase().includes('masuk dan pulang'))
          )
        );

        if (!alreadyLoggedUnscanned) {
          newLogs.push({
            id: `auto-unscanned-${student.id}-${witaDateStr}`,
            studentId: student.id,
            studentName: student.name,
            nisn: student.nisn || '-',
            classId: student.classId,
            className: student.className,
            traitId: unscannedTrait.id,
            traitName: unscannedTrait.name,
            traitType: 'NEGATIF',
            points: unscannedPoints,
            evaluatorName: 'Sistem Otomatis (16:00 WITA)',
            timestamp: `${witaDateStr} 16:00:00`,
            date: witaDateStr,
            notes: `Penilaian Otomatis 16:00 WITA: Status Masuk Hadir tetapi pada kolom Jam Masuk belum melakukan scan presensi (${witaDateStr})`,
          });
          addedCount++;
        }
      }

      // 4B. Belum Scan Pulang
      // Khusus siswa dengan status masuk Hadir atau Terlambat yang belum scan kepulangan
      const isPresent = !!(rec && (rec.status === 'HADIR' || rec.status === 'TERLAMBAT'));
      const hasReturned = !!(rec && (
        (rec.returnTime && rec.returnTime !== '-') || 
        rec.returnStatus === 'PULANG' || 
        rec.returnStatus === 'PULANG_CEPAT' ||
        rec.returnStatus === 'PULANG_TEPAT'
      ));

      if (isPresent && !hasReturned) {
        const alreadyLoggedUnreturned = [...currentLogs, ...newLogs].some(l => 
          l.studentId === student.id && 
          l.date === witaDateStr && 
          (
            l.id === `auto-unreturned-${student.id}-${witaDateStr}` || 
            (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('pulang') && !l.traitName.toLowerCase().includes('masuk dan pulang'))
          )
        );

        if (!alreadyLoggedUnreturned) {
          newLogs.push({
            id: `auto-unreturned-${student.id}-${witaDateStr}`,
            studentId: student.id,
            studentName: student.name,
            nisn: student.nisn || '-',
            classId: student.classId,
            className: student.className,
            traitId: unreturnedTrait.id,
            traitName: unreturnedTrait.name,
            traitType: 'NEGATIF',
            points: unreturnedPoints,
            evaluatorName: 'Sistem Otomatis (16:00 WITA)',
            timestamp: `${witaDateStr} 16:00:00`,
            date: witaDateStr,
            notes: `Penilaian Otomatis 16:00 WITA: Status Masuk (${rec.status === 'HADIR' ? 'Hadir Tepat Waktu' : 'Terlambat'}) pukul ${rec.time || 'Pagi'} tetapi belum melakukan scan pulang hingga batas waktu 16:00 WITA (${witaDateStr})`,
          });
          addedCount++;
        }
      }

      // 4C. Karakter Belum scan Masuk dan Pulang (Kriteria Status Masuk: Belum Absen)
      // Siswa yang kriteria status masuknya Belum Absen (tidak memiliki rekaman absensi atau statusnya 'BELUM_ABSEN') hingga 16:00 WITA
      const isBelumAbsen = !rec || (rec.status as string) === 'BELUM_ABSEN';
      if (isBelumAbsen) {
        const alreadyLoggedUnscannedBoth = [...currentLogs, ...newLogs].some(l => 
          l.studentId === student.id && 
          l.date === witaDateStr && 
          (
            l.id === `auto-unscanned-both-${student.id}-${witaDateStr}` || 
            (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum scan masuk dan pulang'))
          )
        );

        if (!alreadyLoggedUnscannedBoth) {
          newLogs.push({
            id: `auto-unscanned-both-${student.id}-${witaDateStr}`,
            studentId: student.id,
            studentName: student.name,
            nisn: student.nisn || '-',
            classId: student.classId,
            className: student.className,
            traitId: unscannedBothTrait.id,
            traitName: unscannedBothTrait.name,
            traitType: 'NEGATIF',
            points: unscannedBothPoints,
            evaluatorName: 'Sistem Otomatis (16:00 WITA)',
            timestamp: `${witaDateStr} 16:00:00`,
            date: witaDateStr,
            notes: `Penilaian Otomatis 16:00 WITA: Kriteria status masuk Belum Absen (Karakter Belum scan Masuk dan Pulang) (${witaDateStr})`,
          });
          addedCount++;
        }
      }
    });
  }

  // -------------------------------------------------------------
  // 5. ATURAN JURNAL HARIAN KBM (Sangat Aktif, Tidak Hadir di Kelas, Mengganggu)
  // -------------------------------------------------------------
  if (Array.isArray(learningJournals)) {
    learningJournals.forEach(journal => {
      if (!journal.studentAttendances || !Array.isArray(journal.studentAttendances)) return;

      journal.studentAttendances.forEach(sa => {
        const student = students.find(s => 
          s.id === sa.studentId || 
          (sa.nisn && s.nisn === sa.nisn) || 
          s.name.toLowerCase() === sa.studentName.toLowerCase()
        );

        const sId = student?.id || sa.studentId;
        const sName = student?.name || sa.studentName;
        const sNisn = student?.nisn || sa.nisn || '-';
        const cId = student?.classId || journal.classId;
        const cName = student?.className || journal.className;
        const teacherEvaluator = journal.teacherName?.trim() || 'Guru Pengampu KBM';
        const periodsText = journal.periods && journal.periods.length > 0 ? ` (Jam ke-${journal.periods.join(', ')})` : '';

        // Jurnal KBM - A. Status: 'Mengganggu' -> Negatif
        if (sa.status === 'Mengganggu') {
          const isAlready = [...currentLogs, ...newLogs].some(l => 
            l.studentId === sId && 
            l.date === journal.date && 
            (
              l.id === `auto-disruptive-${journal.id}-${sId}` ||
              (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('mengganggu') && l.notes?.includes(journal.subject))
            )
          );

          if (!isAlready) {
            newLogs.push({
              id: `auto-disruptive-${journal.id}-${sId}`,
              studentId: sId,
              studentName: sName,
              nisn: sNisn,
              classId: cId,
              className: cName,
              traitId: disruptiveTrait.id,
              traitName: disruptiveTrait.name,
              traitType: 'NEGATIF',
              points: disruptivePoints,
              date: journal.date,
              evaluatorName: teacherEvaluator,
              timestamp: `${journal.date} 16:00:00`,
              notes: `Penilaian Otomatis Jurnal KBM: Mengganggu saat KBM Mapel ${journal.subject}${periodsText} - Guru: ${teacherEvaluator}`,
            });
            addedCount++;
          }
        }

        // Jurnal KBM - B. Status: 'Tidak hadir di kelas' -> Negatif
        if (sa.status === 'Tidak hadir di kelas') {
          const isAlready = [...currentLogs, ...newLogs].some(l => 
            l.studentId === sId && 
            l.date === journal.date && 
            (
              l.id === `auto-absent-kbm-${journal.id}-${sId}` ||
              (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('tidak hadir') && l.notes?.includes(journal.subject))
            )
          );

          if (!isAlready) {
            newLogs.push({
              id: `auto-absent-kbm-${journal.id}-${sId}`,
              studentId: sId,
              studentName: sName,
              nisn: sNisn,
              classId: cId,
              className: cName,
              traitId: absentKbmTrait.id,
              traitName: absentKbmTrait.name,
              traitType: 'NEGATIF',
              points: absentKbmPoints,
              date: journal.date,
              evaluatorName: teacherEvaluator,
              timestamp: `${journal.date} 16:00:00`,
              notes: `Penilaian Otomatis Jurnal KBM: Tidak hadir di kelas saat KBM Mapel ${journal.subject}${periodsText} - Guru: ${teacherEvaluator}`,
            });
            addedCount++;
          }
        }

        // Jurnal KBM - C. Status: 'Sangat aktif' -> Positif
        if (sa.status === 'Sangat aktif') {
          const isAlready = [...currentLogs, ...newLogs].some(l => 
            l.studentId === sId && 
            l.date === journal.date && 
            (
              l.id === `auto-active-kbm-${journal.id}-${sId}` ||
              (l.traitType === 'POSITIF' && l.traitName.toLowerCase().includes('aktif') && l.notes?.includes(journal.subject))
            )
          );

          if (!isAlready) {
            newLogs.push({
              id: `auto-active-kbm-${journal.id}-${sId}`,
              studentId: sId,
              studentName: sName,
              nisn: sNisn,
              classId: cId,
              className: cName,
              traitId: veryActiveTrait.id,
              traitName: veryActiveTrait.name,
              traitType: 'POSITIF',
              points: veryActiveKbmPoints,
              date: journal.date,
              evaluatorName: teacherEvaluator,
              timestamp: `${journal.date} 16:00:00`,
              notes: `Penilaian Otomatis Jurnal KBM: Sangat aktif saat KBM Mapel ${journal.subject}${periodsText} - Guru: ${teacherEvaluator}`,
            });
            addedCount++;
          }
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 6. PEMBERSIHAN LOG YATIM PIATU (JIKA STATUS PRESENSI DIUBAH / DIHAPUS)
  // -------------------------------------------------------------
  let removedCount = 0;
  const filteredExisting = currentLogs.filter(l => {
    // A. Bersihkan log ALPA jika absensi siswa pada tanggal ini sudah BUKAN ALPA atau dihapus
    const isAutoAlpaLog = l.id?.startsWith('auto-alpa-') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('alpa') && l.notes?.includes('Penilaian Otomatis Presensi'));
    if (isAutoAlpaLog) {
      const stillAlpa = attendanceRecords.some(r => 
        (r.studentId === l.studentId || (l.nisn && l.nisn !== '-' && r.nisn === l.nisn) || (l.studentName && r.studentName?.toLowerCase() === l.studentName.toLowerCase())) &&
        r.date === l.date &&
        r.status === 'ALPA'
      );
      if (!stillAlpa) {
        removedCount++;
        return false;
      }
    }

    // B. Bersihkan log TERLAMBAT jika absensi siswa pada tanggal ini sudah BUKAN TERLAMBAT atau dihapus
    const isAutoLateLog = l.id?.startsWith('auto-late-') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('terlambat') && l.notes?.includes('Scan Hadir Terlambat'));
    if (isAutoLateLog) {
      const stillLate = attendanceRecords.some(r => 
        (r.studentId === l.studentId || (l.nisn && l.nisn !== '-' && r.nisn === l.nisn) || (l.studentName && r.studentName?.toLowerCase() === l.studentName.toLowerCase())) &&
        r.date === l.date &&
        r.status === 'TERLAMBAT'
      );
      if (!stillLate) {
        removedCount++;
        return false;
      }
    }

    // C. Bersihkan log Belum scan Masuk dan Pulang jika status absensi siswa sudah bukan Belum Absen (sudah terdaftar HADIR, TERLAMBAT, SAKIT, IZIN, atau ALPA)
    const isAutoUnscannedBothLog = l.id?.startsWith('auto-unscanned-both-') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum scan masuk dan pulang'));
    if (isAutoUnscannedBothLog) {
      const hasFormalStatus = attendanceRecords.some(r => 
        (r.studentId === l.studentId || (l.nisn && l.nisn !== '-' && r.nisn === l.nisn) || (l.studentName && r.studentName?.toLowerCase() === l.studentName.toLowerCase())) &&
        r.date === l.date &&
        ['HADIR', 'TERLAMBAT', 'SAKIT', 'IZIN', 'ALPA'].includes(r.status)
      );
      if (hasFormalStatus) {
        removedCount++;
        return false;
      }
    }

    return true;
  });

  if (addedCount > 0 || removedCount > 0) {
    const merged = [...filteredExisting, ...newLogs];
    saveStudentCharacterLogs(merged);

    const onTimeCount = newLogs.filter(l => l.id.includes('ontime')).length;
    const lateCount = newLogs.filter(l => l.id.includes('late')).length;
    const alpaCount = newLogs.filter(l => l.id.includes('alpa')).length;
    const unscannedCount = newLogs.filter(l => l.id.includes('unscanned') && !l.id.includes('both')).length;
    const unreturnedCount = newLogs.filter(l => l.id.includes('unreturned')).length;
    const unscannedBothCount = newLogs.filter(l => l.id.includes('unscanned-both')).length;

    // Dispatch event notifikasi
    window.dispatchEvent(new CustomEvent('sihadir_auto_assessment_completed', {
      detail: {
        date: witaDateStr,
        newLogsCount: newLogs.length,
        onTimeCount,
        lateCount,
        alpaCount,
        unscannedCount,
        unreturnedCount,
        unscannedBothCount
      }
    }));

    return { addedCount, removedCount };
  }

  return { addedCount: 0, removedCount: 0 };
}

/**
 * Alias untuk kompatibilitas ke belakang (backwards compatibility)
 */
export function reconcileAllAlpaCharacterLogs(): { addedCount: number; removedCount: number } {
  return reconcileAllAutoCharacterLogs();
}

