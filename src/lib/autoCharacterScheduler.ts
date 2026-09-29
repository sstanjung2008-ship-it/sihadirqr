import { 
  getSchoolProfile, 
  getStudents, 
  getAttendanceRecords, 
  getStudentCharacterLogs, 
  saveStudentCharacterLogs, 
  getCharacterTraits,
  getUserSession,
  isManualCharacterLog,
  deduplicateCharacterLogs,
  KEYS
} from './storage';
import { StudentCharacterLog, AttendanceRecord } from '../types';

// In-memory signature to guarantee 0 Cloud Reads, 0 Cloud Writes, and 0 CPU overhead during 20s interval ticks
let lastEvaluationSignature = '';

/**
 * Menghitung waktu tanggal dan jam WITA (UTC+8) yang presisi
 */
export function getWitaDateTime(): { witaDate: Date; witaDateStr: string; witaTimeStr: string; totalMinutes: number; dayName: string } {
  const now = new Date();
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
 * Rekonsiliasi Menyeluruh Penilaian Karakter Otomatis:
 * 1. Belum Scan Presensi (-unscannedPoints, default -1 poin)
 * 2. Belum Scan Pulang (-unreturnedPoints, default -1 poin)
 *
 * Memeriksa seluruh rekaman absensi siswa yang terdapat catatan belum scan presensi dan belum scan pulang,
 * mencatat poin penalti otomatis tanpa duplikasi, dan membersihkan penalti jika siswa sudah melakukan scan.
 */
export function reconcileAutoCharacterPenalties(forceToday: boolean = false): { 
  executed: boolean; 
  count: number; 
  unscannedCount: number; 
  unreturnedCount: number; 
  message: string 
} {
  const session = getUserSession();
  if (session?.role === 'PARENT') {
    return { executed: false, count: 0, unscannedCount: 0, unreturnedCount: 0, message: 'Role Orang Tua tidak menjalankan evaluasi otomatis sekolah.' };
  }

  const profile = getSchoolProfile();
  if (profile.autoCharacterAssessmentEnabled === false) {
    return { executed: false, count: 0, unscannedCount: 0, unreturnedCount: 0, message: 'Sistem Penilaian Karakter Otomatis sedang non-aktif di Pengaturan.' };
  }

  const { witaDateStr, totalMinutes } = getWitaDateTime();
  const students = getStudents();
  if (students.length === 0) {
    return { executed: false, count: 0, unscannedCount: 0, unreturnedCount: 0, message: 'Tidak ada data siswa aktif yang ditemukan.' };
  }

  const attendanceRecords = getAttendanceRecords();
  if (attendanceRecords.length === 0) {
    return { executed: false, count: 0, unscannedCount: 0, unreturnedCount: 0, message: 'Tidak ada rekaman absensi untuk dievaluasi.' };
  }

  // JAMINAN HEMAT KUOTA FIRESTORE (0 Cloud Read & 0 Cloud Write):
  // Cek sidik jari (signature) data lokal: jika rekaman absensi tidak bertambah/berubah dan belum melewati pukul 16:00 WITA,
  // proses evaluasi dihentikan seketika tanpa perhitungan atau akses jaringan sama sekali.
  const attendanceUpdatedAt = (typeof window !== 'undefined' ? localStorage.getItem(KEYS.ATTENDANCE + '_updatedAt') : null) || '0';
  const logsUpdatedAt = (typeof window !== 'undefined' ? localStorage.getItem(KEYS.CHARACTER_LOGS + '_updatedAt') : null) || '0';
  const isPast16Wita = totalMinutes >= 16 * 60;
  const currentSignature = `${attendanceRecords.length}_${attendanceUpdatedAt}_${logsUpdatedAt}_${witaDateStr}_${isPast16Wita ? '16wita' : 'pre16'}`;

  if (!forceToday && lastEvaluationSignature === currentSignature) {
    return {
      executed: false,
      count: 0,
      unscannedCount: 0,
      unreturnedCount: 0,
      message: 'Data presensi tidak berubah sejak evaluasi terakhir (Pemeriksaan hemat kuota).'
    };
  }

  const currentLogs = getStudentCharacterLogs();
  const unscannedPoints = profile.autoCharacterPoints?.unscannedPoints ?? 1;
  const unreturnedPoints = profile.autoCharacterPoints?.unreturnedPoints ?? 1;

  const traits = getCharacterTraits();
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

  const newLogs: StudentCharacterLog[] = [];
  let addedUnscannedCount = 0;
  let addedUnreturnedCount = 0;

  // Evaluasi setiap rekaman absensi siswa
  attendanceRecords.forEach(rec => {
    const student = students.find(s => 
      s.id === rec.studentId || 
      (rec.nisn && s.nisn === rec.nisn) || 
      (rec.studentName && s.name.trim().toLowerCase() === rec.studentName.trim().toLowerCase())
    );
    if (!student) return;

    const studentId = student.id;
    const studentName = student.name;
    const nisn = student.nisn || rec.nisn || '-';
    const classId = student.classId || '';
    const className = student.className || rec.className || '';
    const attDate = rec.date;

    // 1. ATURAN: BELUM SCAN PRESENSI
    // Terpenuhi jika siswa tidak izin/sakit, dan kolom Jam Masuk kosong/belum scan/'-', atau status BELUM_ABSEN
    const isLegitPermit = rec.status === 'SAKIT' || rec.status === 'IZIN';
    const isUnscannedEntry = !isLegitPermit && (
      !rec.time || 
      rec.time === '-' || 
      rec.time.trim() === '' || 
      rec.time.toLowerCase().includes('belum') || 
      (rec.status as string) === 'BELUM_ABSEN' ||
      (rec.notes && rec.notes.toLowerCase().includes('belum scan'))
    );

    if (isUnscannedEntry) {
      const alreadyHasUnscannedLog = [...currentLogs, ...newLogs].some(l => 
        (l.studentId === studentId || (nisn !== '-' && l.nisn === nisn) || (studentName && l.studentName && l.studentName.trim().toLowerCase() === studentName.trim().toLowerCase())) &&
        l.date === attDate &&
        l.traitType === 'NEGATIF' &&
        (
          l.id === `auto-unscanned-${studentId}-${attDate}` || 
          (l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('scan'))
        )
      );

      if (!alreadyHasUnscannedLog) {
        newLogs.push({
          id: `auto-unscanned-${studentId}-${attDate}`,
          studentId: studentId,
          studentName: studentName,
          nisn: nisn,
          classId: classId,
          className: className,
          traitId: unscannedTrait.id,
          traitName: unscannedTrait.name,
          traitType: 'NEGATIF',
          points: unscannedPoints,
          evaluatorName: 'Sistem Presensi Otomatis',
          timestamp: `${attDate} 16:00:00`,
          date: attDate,
          notes: `Penilaian Otomatis Presensi: Kolom Jam Masuk belum melakukan scan presensi (${attDate})`,
        });
        addedUnscannedCount++;
      }
    }

    // 2. ATURAN: BELUM SCAN PULANG
    // Terpenuhi jika siswa hadir di sekolah (HADIR atau TERLAMBAT), namun belum melakukan scan kepulangan
    // Untuk hari yang sudah berlalu (attDate < witaDateStr), atau hari ini jika sudah pukul 16:00 WITA / force
    const isPresent = rec.status === 'HADIR' || rec.status === 'TERLAMBAT';
    const hasReturned = !!(
      (rec.returnTime && rec.returnTime !== '-' && rec.returnTime.trim() !== '' && !rec.returnTime.toLowerCase().includes('belum')) || 
      rec.returnStatus === 'PULANG' || 
      rec.returnStatus === 'PULANG_TEPAT' || 
      rec.returnStatus === 'PULANG_CEPAT'
    );

    const isEligibleForReturnEvaluation = attDate < witaDateStr || forceToday || totalMinutes >= (16 * 60);

    if (isPresent && !hasReturned && isEligibleForReturnEvaluation) {
      const alreadyHasUnreturnedLog = [...currentLogs, ...newLogs].some(l => 
        (l.studentId === studentId || (nisn !== '-' && l.nisn === nisn) || (studentName && l.studentName && l.studentName.trim().toLowerCase() === studentName.trim().toLowerCase())) &&
        l.date === attDate &&
        l.traitType === 'NEGATIF' &&
        (
          l.id === `auto-unreturned-${studentId}-${attDate}` || 
          (l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('pulang'))
        )
      );

      if (!alreadyHasUnreturnedLog) {
        newLogs.push({
          id: `auto-unreturned-${studentId}-${attDate}`,
          studentId: studentId,
          studentName: studentName,
          nisn: nisn,
          classId: classId,
          className: className,
          traitId: unreturnedTrait.id,
          traitName: unreturnedTrait.name,
          traitType: 'NEGATIF',
          points: unreturnedPoints,
          evaluatorName: 'Sistem Presensi Otomatis',
          timestamp: `${attDate} 16:00:00`,
          date: attDate,
          notes: `Penilaian Otomatis Presensi: Status Masuk (${rec.status === 'HADIR' ? 'Hadir Tepat Waktu' : 'Terlambat'}) pukul ${rec.time || 'Pagi'} tetapi belum melakukan scan pulang (${attDate})`,
        });
        addedUnreturnedCount++;
      }
    }
  });

  // Pembersihan log penalti otomatis jika data presensi sudah dikoreksi/siswa sudah scan
  let removedCount = 0;
  const filteredExisting = currentLogs.filter(l => {
    if (isManualCharacterLog(l)) return true;

    // Bersihkan penalti Belum Scan Masuk jika siswa sudah memiliki jam scan valid atau berstatus izin/sakit
    const isAutoUnscanned = l.id?.startsWith('auto-unscanned-') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('scan') && l.notes?.includes('Otomatis'));
    if (isAutoUnscanned) {
      const matchingRec = attendanceRecords.find(r => 
        (r.studentId === l.studentId || (l.nisn && l.nisn !== '-' && r.nisn === l.nisn) || (l.studentName && r.studentName?.toLowerCase() === l.studentName.toLowerCase())) &&
        r.date === l.date
      );
      if (matchingRec) {
        const hasValidTime = matchingRec.time && matchingRec.time !== '-' && !matchingRec.time.toLowerCase().includes('belum');
        const isExempt = matchingRec.status === 'SAKIT' || matchingRec.status === 'IZIN';
        if (hasValidTime || isExempt) {
          removedCount++;
          return false;
        }
      }
    }

    // Bersihkan penalti Belum Scan Pulang jika siswa sudah scan pulang
    const isAutoUnreturned = l.id?.startsWith('auto-unreturned-') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('pulang') && l.notes?.includes('Otomatis'));
    if (isAutoUnreturned) {
      const matchingRec = attendanceRecords.find(r => 
        (r.studentId === l.studentId || (l.nisn && l.nisn !== '-' && r.nisn === l.nisn) || (l.studentName && r.studentName?.toLowerCase() === l.studentName.toLowerCase())) &&
        r.date === l.date
      );
      if (matchingRec) {
        const hasReturned = !!((matchingRec.returnTime && matchingRec.returnTime !== '-' && !matchingRec.returnTime.toLowerCase().includes('belum')) || matchingRec.returnStatus === 'PULANG' || matchingRec.returnStatus === 'PULANG_TEPAT' || matchingRec.returnStatus === 'PULANG_CEPAT');
        const isNotPresent = matchingRec.status !== 'HADIR' && matchingRec.status !== 'TERLAMBAT';
        if (hasReturned || isNotPresent) {
          removedCount++;
          return false;
        }
      }
    }

    return true;
  });

  const totalAdded = newLogs.length;
  lastEvaluationSignature = currentSignature;

  if (totalAdded > 0 || removedCount > 0) {
    const merged = deduplicateCharacterLogs([...filteredExisting, ...newLogs]);
    saveStudentCharacterLogs(merged);

    window.dispatchEvent(new CustomEvent('sihadir_auto_assessment_completed', {
      detail: {
        date: witaDateStr,
        newLogsCount: totalAdded,
        unscannedCount: addedUnscannedCount,
        unreturnedCount: addedUnreturnedCount,
        removedCount
      }
    }));

    return {
      executed: true,
      count: totalAdded,
      unscannedCount: addedUnscannedCount,
      unreturnedCount: addedUnreturnedCount,
      message: `Berhasil mencatat ${totalAdded} penilaian karakter otomatis baru (${addedUnscannedCount} Belum Scan Masuk, ${addedUnreturnedCount} Belum Scan Pulang) ke dalam sistem!`
    };
  }

  return {
    executed: true,
    count: 0,
    unscannedCount: 0,
    unreturnedCount: 0,
    message: 'Seluruh siswa telah memiliki catatan penilaian karakter yang sesuai dengan data presensi.'
  };
}

/**
 * Menjalankan evaluasi terjadwal 16:00 WITA untuk seluruh aspek sekolah
 */
export function run16WitaAutoCharacterAssessment(force: boolean = false): { executed: boolean; count: number; message: string } {
  const result = reconcileAutoCharacterPenalties(force);
  return {
    executed: result.executed,
    count: result.count,
    message: result.message
  };
}
