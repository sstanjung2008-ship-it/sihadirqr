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
  getDeletedCharacterLogIds,
  isLogForStudent,
  safeSetLocalStorage,
  getFirebaseServerTime,
  KEYS
} from './storage';
import { StudentCharacterLog, AttendanceRecord } from '../types';

// In-memory signature to guarantee 0 Cloud Reads, 0 Cloud Writes, and 0 CPU overhead during interval ticks
let lastEvaluationSignature = '';

export const AUTO_BATCH_DONE_KEY_PREFIX = 'sihadir_auto_char_batch_done_';

/**
 * Memeriksa apakah batch penilaian karakter otomatis 16:00 WITA sudah pernah dieksekusi untuk tanggal tertentu
 */
export function isAutoAssessmentBatchDone(dateStr: string): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(AUTO_BATCH_DONE_KEY_PREFIX + dateStr) === 'true') return true;
  // Periksa apakah di catatan karakter sudah ada penalti otomatis untuk tanggal ini (sinkron antar-perangkat)
  const logs = getStudentCharacterLogs();
  return logs.some(l => l.date === dateStr && (l.id.startsWith('auto-unscanned-') || l.id.startsWith('auto-unreturned-')));
}

/**
 * Menandai status selesai eksekusi batch penilaian karakter otomatis 16:00 WITA
 */
export function setAutoAssessmentBatchDone(dateStr: string, done: boolean = true): void {
  if (typeof window === 'undefined') return;
  if (done) {
    safeSetLocalStorage(AUTO_BATCH_DONE_KEY_PREFIX + dateStr, 'true');
  } else {
    try {
      localStorage.removeItem(AUTO_BATCH_DONE_KEY_PREFIX + dateStr);
    } catch (e) {
      console.warn('Gagal menghapus status batch auto assessment', e);
    }
  }
}

/**
 * Menghitung waktu tanggal dan jam WITA (UTC+8) yang presisi berbasis Firebase Server Timestamp
 */
export function getWitaDateTime(customTimestampMs?: number): { 
  witaDate: Date; 
  witaDateStr: string; 
  witaTimeStr: string; 
  totalMinutes: number; 
  hours: number;
  minutes: number;
  dayName: string;
  isPast16Wita: boolean;
  serverTimestampMs: number;
} {
  const timeMs = customTimestampMs ?? getFirebaseServerTime();
  // WITA is UTC + 8 hours
  const witaEpoch = timeMs + (8 * 3600 * 1000);
  const witaDate = new Date(witaEpoch);

  const yyyy = witaDate.getUTCFullYear();
  const mm = String(witaDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(witaDate.getUTCDate()).padStart(2, '0');
  const witaDateStr = `${yyyy}-${mm}-${dd}`;

  const hours = witaDate.getUTCHours();
  const minutes = witaDate.getUTCMinutes();
  const seconds = witaDate.getUTCSeconds();
  const witaTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const totalMinutes = hours * 60 + minutes;
  const isPast16Wita = totalMinutes >= 16 * 60; // Jam 16:00 WITA or later

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = dayNames[witaDate.getUTCDay()];

  return { witaDate, witaDateStr, witaTimeStr, totalMinutes, hours, minutes, dayName, isPast16Wita, serverTimestampMs: timeMs };
}

/**
 * Rekonsiliasi Menyeluruh Penilaian Karakter Otomatis:
 * 1. Belum Scan Presensi Masuk (pinalti -2 poin)
 * 2. Belum Scan Pulang (pinalti -2 poin)
 * 3. Hadir Tepat Waktu (kelipatan 3 hari = +1 poin, 6 hari = +2 poin, dst.)
 *
 * REGULASI KETAT & CEGAH PENULISAN BERULANG:
 * - Penilaian otomatis presensi hari ini HANYA boleh dieksekusi mulai jam 16:00 WITA (berbasis Firebase Server Timestamp).
 * - Sebelum jam 16:00 WITA, fungsi ini langsung berhenti tanpa memproses penalti hari ini dan tanpa penulisan ke database.
 * - Dilakukan secara BATCHING 1 KALI WRITE agar tidak berulang melakukan penilaian dan menjamin seluruh perangkat sinkron.
 */
export function reconcileAutoCharacterPenalties(forceToday: boolean = false): { 
  executed: boolean; 
  count: number; 
  unscannedCount: number; 
  unreturnedCount: number; 
  onTimeCount: number; 
  message: string 
} {
  const session = getUserSession();
  if (session?.role === 'PARENT') {
    return { executed: false, count: 0, unscannedCount: 0, unreturnedCount: 0, onTimeCount: 0, message: 'Role Orang Tua tidak menjalankan evaluasi otomatis sekolah.' };
  }

  const profile = getSchoolProfile();
  if (profile.autoCharacterAssessmentEnabled === false) {
    return { executed: false, count: 0, unscannedCount: 0, unreturnedCount: 0, onTimeCount: 0, message: 'Sistem Penilaian Karakter Otomatis sedang non-aktif di Pengaturan.' };
  }

  const { witaDateStr, witaTimeStr, isPast16Wita } = getWitaDateTime();

  // ATURAN MUTLAK & CEGAH PENULISAN ULANG SEBELUM 16:00 WITA:
  // Evaluasi presensi hari ini HANYA dieksekusi setelah jam 16:00 WITA berdasarkan Firebase Server Timestamp.
  // Sebelum jam 16:00 WITA, fungsi ini langsung berhenti tanpa memproses penalti hari ini
  // dan tanpa penulisan ulang yang tidak diperlukan ke database.
  if (!isPast16Wita && !forceToday) {
    return {
      executed: false,
      count: 0,
      unscannedCount: 0,
      unreturnedCount: 0,
      onTimeCount: 0,
      message: `Waktu Firebase Server saat ini (${witaTimeStr} WITA) belum mencapai 16:00 WITA. Penilaian presensi otomatis hari ini ditunda hingga 16:00 WITA untuk mencegah penulisan berulang.`
    };
  }

  const isBatchDoneToday = isAutoAssessmentBatchDone(witaDateStr);
  // JAMINAN 1 KALI WRITE: Jika batch 16:00 WITA hari ini sudah selesai, jangan ulangi penulisan
  if (isBatchDoneToday && !forceToday) {
    return {
      executed: false,
      count: 0,
      unscannedCount: 0,
      unreturnedCount: 0,
      onTimeCount: 0,
      message: `Batch penilaian karakter otomatis 16:00 WITA untuk tanggal ${witaDateStr} sudah selesai dieksekusi. Tidak ada penulisan ulang.`
    };
  }

  const students = getStudents();
  if (students.length === 0) {
    return { executed: false, count: 0, unscannedCount: 0, unreturnedCount: 0, onTimeCount: 0, message: 'Tidak ada data siswa aktif yang ditemukan.' };
  }

  const attendanceRecords = getAttendanceRecords();
  if (attendanceRecords.length === 0) {
    return { executed: false, count: 0, unscannedCount: 0, unreturnedCount: 0, onTimeCount: 0, message: 'Tidak ada rekaman absensi untuk dievaluasi.' };
  }

  // JAMINAN HEMAT KUOTA FIRESTORE (0 Cloud Read & 0 Cloud Write):
  const attendanceUpdatedAt = (typeof window !== 'undefined' ? localStorage.getItem(KEYS.ATTENDANCE + '_updatedAt') : null) || '0';
  const logsUpdatedAt = (typeof window !== 'undefined' ? localStorage.getItem(KEYS.CHARACTER_LOGS + '_updatedAt') : null) || '0';
  const currentSignature = `${attendanceRecords.length}_${attendanceUpdatedAt}_${logsUpdatedAt}_${witaDateStr}_${isPast16Wita ? '16wita' : 'pre16'}_${isBatchDoneToday ? 'done' : 'pending'}`;

  if (!forceToday && lastEvaluationSignature === currentSignature) {
    return {
      executed: false,
      count: 0,
      unscannedCount: 0,
      unreturnedCount: 0,
      onTimeCount: 0,
      message: 'Data presensi tidak berubah sejak evaluasi terakhir (Pemeriksaan hemat kuota).'
    };
  }

  const currentLogs = getStudentCharacterLogs();
  // REGULASI POIN: Belum scan masuk pinalti -2, Belum scan pulang pinalti -2, Hadir tepat waktu +1 per 3 hari
  const unscannedPoints = profile.autoCharacterPoints?.unscannedPoints ?? 2;
  const unreturnedPoints = profile.autoCharacterPoints?.unreturnedPoints ?? 2;
  const onTimeRequiredDays = profile.autoCharacterPoints?.onTimeRequiredDays ?? 3;
  const onTimePoints = profile.autoCharacterPoints?.onTimePoints ?? 1;

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

  const onTimeTrait = traits.find(t => 
    t.id === 'trait-001' || 
    (t.type === 'POSITIF' && t.name.toLowerCase().includes('tepat') && t.name.toLowerCase().includes('waktu'))
  ) || traits.find(t => t.type === 'POSITIF') || {
    id: 'trait-auto-ontime',
    name: 'Datang Tepat Waktu & Disiplin',
    type: 'POSITIF' as const,
    points: onTimePoints,
    category: 'Kedisiplinan'
  };

  const newLogs: StudentCharacterLog[] = [];
  let addedUnscannedCount = 0;
  let addedUnreturnedCount = 0;
  let addedOnTimeCount = 0;

  // Evaluasi setiap rekaman absensi siswa untuk Aturan 1 & 2
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

    // Jangan pernah mengevaluasi tanggal masa depan
    if (attDate > witaDateStr) return;

    // ATURAN WAKTU EVALUASI PENALTI (MULAI PUKUL 16:00 WITA):
    // Penilaian karakter belum scan presensi dan belum scan pulang untuk hari ini HANYA dimulai pukul 16:00 WITA.
    // Jika batch 16:00 WITA hari ini sudah selesai diproses (isBatchDoneToday) dan tidak dipaksa (forceToday=false),
    // jangan tambahkan lagi penalti untuk hari berjalan.
    // Untuk tanggal lampau (attDate < witaDateStr), sudah melewati pukul 16:00 hari tersebut sehingga otomatis eligible.
    const isEligibleFor16WitaEvaluation = attDate < witaDateStr || (attDate === witaDateStr && (isPast16Wita || forceToday) && (!isBatchDoneToday || forceToday));
    if (!isEligibleFor16WitaEvaluation) return;

    const deletedIds = getDeletedCharacterLogIds();

    // 1. ATURAN: BELUM SCAN PRESENSI
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
      const logId = `auto-unscanned-${studentId}-${attDate}`;
      // Jika pernah dihapus oleh pengguna/sistem, JANGAN PERNAH dibuat ulang!
      if (!deletedIds.has(logId)) {
        const alreadyHasUnscannedLog = [...currentLogs, ...newLogs].some(l => 
          (l.studentId === studentId || (nisn !== '-' && l.nisn === nisn) || (studentName && l.studentName && l.studentName.trim().toLowerCase() === studentName.trim().toLowerCase())) &&
          l.date === attDate &&
          l.traitType === 'NEGATIF' &&
          (
            l.id === logId || 
            (l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('scan'))
          )
        );

        if (!alreadyHasUnscannedLog) {
          newLogs.push({
            id: logId,
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
    }

    // 2. ATURAN: BELUM SCAN PULANG
    // Terpenuhi jika siswa hadir di sekolah (HADIR atau TERLAMBAT), namun belum melakukan scan kepulangan
    const isPresent = rec.status === 'HADIR' || rec.status === 'TERLAMBAT';
    const hasReturned = !!(
      (rec.returnTime && rec.returnTime !== '-' && rec.returnTime.trim() !== '' && !rec.returnTime.toLowerCase().includes('belum')) || 
      rec.returnStatus === 'PULANG' || 
      rec.returnStatus === 'PULANG_TEPAT' || 
      rec.returnStatus === 'PULANG_CEPAT'
    );

    if (isPresent && !hasReturned) {
      const logId = `auto-unreturned-${studentId}-${attDate}`;
      // Jika pernah dihapus oleh pengguna/sistem, JANGAN PERNAH dibuat ulang!
      if (!deletedIds.has(logId)) {
        const alreadyHasUnreturnedLog = [...currentLogs, ...newLogs].some(l => 
          (l.studentId === studentId || (nisn !== '-' && l.nisn === nisn) || (studentName && l.studentName && l.studentName.trim().toLowerCase() === studentName.trim().toLowerCase())) &&
          l.date === attDate &&
          l.traitType === 'NEGATIF' &&
          (
            l.id === logId || 
            (l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('pulang'))
          )
        );

        if (!alreadyHasUnreturnedLog) {
          newLogs.push({
            id: logId,
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
    }
  });

  // 3. ATURAN POSITIF: HADIR TEPAT WAKTU (Setiap 3 Hari = 1 Poin, 6 Hari = 2 Poin, dan Kelipatannya)
  // Mengelompokkan rekaman absensi per siswa untuk menghitung jumlah hari HADIR
  const studentAttendanceMap = new Map<string, AttendanceRecord[]>();
  attendanceRecords.forEach(rec => {
    if (!studentAttendanceMap.has(rec.studentId)) {
      studentAttendanceMap.set(rec.studentId, []);
    }
    studentAttendanceMap.get(rec.studentId)!.push(rec);
  });

  const distinctOnTimeDatesMap = new Map<string, number>();

  students.forEach(student => {
    const studentId = student.id;
    const studentName = student.name;
    const nisn = student.nisn || '-';
    const classId = student.classId || '';
    const className = student.className || '';

    const records = studentAttendanceMap.get(studentId) || [];
    // Rekaman kehadiran berstatus HADIR
    const onTimeRecords = records.filter(r => r.status === 'HADIR');
    // Tanggal unik dan diurutkan
    const distinctDates = Array.from(new Set(onTimeRecords.map(r => r.date))).sort();
    distinctOnTimeDatesMap.set(studentId, distinctDates.length);

    // Hitung setiap kelipatan 3 hari hadir tepat waktu (3 hari = 1 poin, 6 hari = 2 poin, 9 hari = 3 poin, dst.)
    if (distinctDates.length >= onTimeRequiredDays) {
      const totalGroups = Math.floor(distinctDates.length / onTimeRequiredDays);
      for (let g = 0; g < totalGroups; g++) {
        const groupDates = distinctDates.slice(g * onTimeRequiredDays, (g + 1) * onTimeRequiredDays);
        const milestoneCount = (g + 1) * onTimeRequiredDays;
        const targetDate = groupDates[groupDates.length - 1];
        const logId = `auto-ontime-${studentId}-milestone-${milestoneCount}`;

        // Jika log ini sudah pernah dihapus oleh pengguna, jangan dibuat ulang
        const deletedIds = getDeletedCharacterLogIds();
        if (deletedIds.has(logId)) continue;

        const alreadyHasLog = [...currentLogs, ...newLogs].some(l => 
          (l.studentId === studentId || (nisn !== '-' && l.nisn === nisn) || (studentName && l.studentName && l.studentName.trim().toLowerCase() === studentName.trim().toLowerCase())) &&
          (
            l.id === logId || 
            l.id === `auto-ontime-${studentId}-group-${g}-${targetDate}` ||
            (l.traitType === 'POSITIF' && l.notes?.includes(`kelipatan ${onTimeRequiredDays} hari ke-${g + 1}`)) ||
            (l.traitType === 'POSITIF' && l.notes?.includes(`${milestoneCount} hari hadir`))
          )
        );

        if (!alreadyHasLog) {
          newLogs.push({
            id: logId,
            studentId: studentId,
            studentName: studentName,
            nisn: nisn,
            classId: classId,
            className: className,
            traitId: onTimeTrait.id,
            traitName: onTimeTrait.name,
            traitType: 'POSITIF',
            points: onTimePoints, // dinilai 1 untuk setiap kelipatan 3 hari (akumulasi: 3 hari = 1 poin, 6 hari = 2 poin, 9 hari = 3 poin, dst)
            evaluatorName: 'Sistem Presensi Otomatis (Tepat Waktu)',
            timestamp: `${targetDate} 16:00:00`,
            date: targetDate,
            notes: `Penilaian Karakter Positif Presensi: Datang tepat waktu kelipatan ${onTimeRequiredDays} hari ke-${g + 1} (Total ${milestoneCount} kali hadir tepat waktu dinilai akumulasi ${g + 1} poin: ${groupDates.join(', ')})`,
          });
          addedOnTimeCount++;
        }
      }
    }
  });

  // Pembersihan log penalti otomatis jika data presensi sudah dikoreksi/siswa sudah scan,
  // ATAU jika waktu hari ini belum mencapai pukul 16:00 WITA (mencegah penalti prematur)
  let removedCount = 0;
  const filteredExisting = currentLogs.filter(l => {
    if (isManualCharacterLog(l)) return true;

    const isAutoUnscanned = l.id?.startsWith('auto-unscanned-') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('scan') && l.notes?.includes('Otomatis'));
    const isAutoUnreturned = l.id?.startsWith('auto-unreturned-') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('pulang') && l.notes?.includes('Otomatis'));
    const isAutoOnTime = l.id?.startsWith('auto-ontime-') || (l.traitType === 'POSITIF' && l.traitName.toLowerCase().includes('tepat') && l.traitName.toLowerCase().includes('waktu') && l.notes?.includes('kelipatan'));

    // JAMINAN MUTLAK: Catatan karakter positif Hadir Tepat Waktu yang sudah tersimpan di detail karakter
    // TIDAK BOLEH diubah atau dihapus sendiri oleh sistem!
    if (isAutoOnTime) {
      return true;
    }

    // Pencegahan log prematur hari berjalan:
    // Jika HARI INI dan belum mencapai pukul 16:00 WITA dan tidak forceToday, bersihkan log penalti hari ini
    if (!isPast16Wita && !forceToday && l.date === witaDateStr) {
      if (isAutoUnscanned || isAutoUnreturned) {
        removedCount++;
        return false;
      }
    }

    // Bersihkan penalti Belum Scan Masuk jika siswa sudah memiliki jam scan valid atau berstatus izin/sakit
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
  // BATCHING 1 KALI WRITE:
  // Seluruh penilaian (Hadir Tepat Waktu + Belum Scan + Belum Pulang) dikumpulkan dan ditulis sekaligus dalam 1 kali pemanggilan saveStudentCharacterLogs
  if (totalAdded > 0 || removedCount > 0) {
    const merged = deduplicateCharacterLogs([...filteredExisting, ...newLogs]);
    const currentStr = JSON.stringify(currentLogs);
    const mergedStr = JSON.stringify(merged);

    // HANYA simpan ke LocalStorage & Cloud jika memang ada perubahan data nyata (mencegah loop write berulang)
    if (currentStr !== mergedStr) {
      saveStudentCharacterLogs(merged);
    }

    // Kunci status batch selesai untuk hari ini agar tidak berulang menulis ke database
    if (isPast16Wita) {
      setAutoAssessmentBatchDone(witaDateStr, true);
    }

    // Perbarui signature dengan timestamp LocalStorage terbaru agar interval berikutnya langsung mengenali bahwa data sudah up-to-date
    const finalAttendanceUpdatedAt = (typeof window !== 'undefined' ? localStorage.getItem(KEYS.ATTENDANCE + '_updatedAt') : null) || '0';
    const finalLogsUpdatedAt = (typeof window !== 'undefined' ? localStorage.getItem(KEYS.CHARACTER_LOGS + '_updatedAt') : null) || '0';
    lastEvaluationSignature = `${attendanceRecords.length}_${finalAttendanceUpdatedAt}_${finalLogsUpdatedAt}_${witaDateStr}_${isPast16Wita ? '16wita' : 'pre16'}_${isAutoAssessmentBatchDone(witaDateStr) ? 'done' : 'pending'}`;

    window.dispatchEvent(new CustomEvent('sihadir_auto_assessment_completed', {
      detail: {
        date: witaDateStr,
        newLogsCount: totalAdded,
        unscannedCount: addedUnscannedCount,
        unreturnedCount: addedUnreturnedCount,
        onTimeCount: addedOnTimeCount,
        removedCount
      }
    }));

    return {
      executed: true,
      count: totalAdded,
      unscannedCount: addedUnscannedCount,
      unreturnedCount: addedUnreturnedCount,
      onTimeCount: addedOnTimeCount,
      message: `Batching 1 kali write berhasil mencatat ${totalAdded} penilaian karakter otomatis (${addedOnTimeCount} Tepat Waktu, ${addedUnscannedCount} Belum Scan Masuk, ${addedUnreturnedCount} Belum Scan Pulang).`
    };
  }

  lastEvaluationSignature = currentSignature;

  // Jika waktu >= 16:00 WITA dan seluruh data sudah konsisten, tandai batch hari ini selesai
  if (isPast16Wita) {
    setAutoAssessmentBatchDone(witaDateStr, true);
  }

  return {
    executed: true,
    count: 0,
    unscannedCount: 0,
    unreturnedCount: 0,
    onTimeCount: 0,
    message: isPast16Wita 
      ? `Seluruh siswa telah memiliki catatan penilaian karakter yang sesuai (Batch 16:00 WITA selesai).`
      : `Waktu saat ini (${witaTimeStr} WITA) belum mencapai 16:00 WITA. Evaluasi karakter otomatis akan aktif mulai pukul 16:00 WITA.`
  };
}

/**
 * Menjalankan evaluasi terjadwal 16:00 WITA untuk seluruh aspek sekolah secara batching
 */
export function run16WitaAutoCharacterAssessment(force: boolean = false): { executed: boolean; count: number; message: string } {
  const result = reconcileAutoCharacterPenalties(force);
  return {
    executed: result.executed,
    count: result.count,
    message: result.message
  };
}

/**
 * Menjalankan evaluasi penilaian karakter positif Hadir Tepat Waktu (kelipatan 3 hari) secara eksplisit
 */
export function runOnTimeAttendanceAssessment(): { 
  executed: boolean; 
  count: number; 
  addedOnTimeCount: number; 
  message: string 
} {
  const result = reconcileAutoCharacterPenalties(true);
  return {
    executed: result.executed,
    count: result.count,
    addedOnTimeCount: result.onTimeCount,
    message: result.message
  };
}
