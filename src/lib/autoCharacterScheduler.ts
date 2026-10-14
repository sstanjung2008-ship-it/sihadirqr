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

  // Evaluasi penalti otomatis (Alpa, Belum Scan Masuk, Belum Scan Pulang)
  // kini seluruhnya dihitung secara dinamis langsung pada Detail Nilai Karakter Siswa.
  // Tidak ada pembuatan draf log statis penalti presensi agar tidak terjadi penulisan berulang.
  const newLogs: StudentCharacterLog[] = [];
  const addedUnscannedCount = 0;
  const addedUnreturnedCount = 0;
  const addedOnTimeCount = 0;

  // Pembersihan log penalti otomatis versi lama (bukan log manual guru)
  // agar nilai di Detail Karakter murni diambil secara dinamis dari rekap presensi
  let removedCount = 0;
  const filteredExisting = currentLogs.filter(l => {
    // JAMINAN MUTLAK: Log yang disimpan secara sadar oleh Guru/Admin (isManual atau saved-) DILARANG DIHAPUS!
    if (l.isManual === true || isManualCharacterLog(l) || l.id?.startsWith('saved-auto-') || l.id?.startsWith('saved-') || l.id?.startsWith('user-saved-')) {
      return true;
    }

    const isAutoUnscanned = l.id?.startsWith('auto-unscanned-') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('scan') && l.notes?.includes('Otomatis'));
    const isAutoUnreturned = l.id?.startsWith('auto-unreturned-') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('pulang') && l.notes?.includes('Otomatis'));
    const isAutoAlpa = l.id?.startsWith('auto-alpa-') || (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('alpa') && l.notes?.includes('Otomatis'));

    if (isAutoUnscanned || isAutoUnreturned || isAutoAlpa) {
      removedCount++;
      return false;
    }

    return true;
  });

  const totalAdded = newLogs.length;
  if (removedCount > 0) {
    const merged = deduplicateCharacterLogs(filteredExisting);
    const currentStr = JSON.stringify(currentLogs);
    const mergedStr = JSON.stringify(merged);

    // HANYA simpan ke LocalStorage & Cloud jika memang ada perubahan data nyata (mencegah loop write berulang)
    if (currentStr !== mergedStr) {
      saveStudentCharacterLogs(merged);
    }
  }

  // Kunci status batch selesai untuk hari ini agar tidak berulang memeriksa
  if (isPast16Wita) {
    setAutoAssessmentBatchDone(witaDateStr, true);
  }

  const finalAttendanceUpdatedAt = (typeof window !== 'undefined' ? localStorage.getItem(KEYS.ATTENDANCE + '_updatedAt') : null) || '0';
  const finalLogsUpdatedAt = (typeof window !== 'undefined' ? localStorage.getItem(KEYS.CHARACTER_LOGS + '_updatedAt') : null) || '0';
  lastEvaluationSignature = `${attendanceRecords.length}_${finalAttendanceUpdatedAt}_${finalLogsUpdatedAt}_${witaDateStr}_${isPast16Wita ? '16wita' : 'pre16'}_${isAutoAssessmentBatchDone(witaDateStr) ? 'done' : 'pending'}`;

  return {
    executed: true,
    count: 0,
    unscannedCount: 0,
    unreturnedCount: 0,
    onTimeCount: 0,
    message: `Penilaian karakter otomatis presensi (Alpa, Belum Scan Masuk, dan Belum Scan Pulang) terakumulasi dinamis pada Detail Nilai Karakter Siswa.`
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
