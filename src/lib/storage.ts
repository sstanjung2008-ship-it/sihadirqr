import { SchoolProfile, SchoolClass, Student, AttendanceRecord, LeaveRequest, Teacher, LearningJournal, CharacterTrait, StudentCharacterLog, CharacterPredicateSettings, UserSession, UserRole, StudentGradeAssessment, LessonPeriod, ClassScheduleSlot } from '../types';
import { 
  INITIAL_SCHOOL_PROFILE, 
  INITIAL_CLASSES, 
  INITIAL_STUDENTS, 
  generateInitialAttendanceHistory, 
  INITIAL_LEAVE_REQUESTS, 
  INITIAL_TEACHERS,
  INITIAL_CHARACTER_TRAITS,
  INITIAL_STUDENT_CHARACTER_LOGS,
  INITIAL_LEARNING_JOURNALS,
  INITIAL_LESSON_PERIODS,
  INITIAL_CLASS_SCHEDULES
} from '../data/mockData';
import { db, doc, setDoc, getDoc, deleteDoc, onSnapshot, serverTimestamp, Timestamp } from './firebase';
import firebaseConfigData from '../../firebase-applet-config.json';

// Firebase Server Time Offset Tracker (menjamin pengecekan 16:00 WITA akurat dengan jam server Google Cloud)
let firebaseServerTimeOffsetMs = 0;

export function updateFirebaseServerTimeFromTimestamp(serverTimestampMs: number): void {
  if (typeof serverTimestampMs === 'number' && serverTimestampMs > 1700000000000) {
    firebaseServerTimeOffsetMs = serverTimestampMs - Date.now();
  }
}

export function getFirebaseServerTime(): number {
  return Date.now() + firebaseServerTimeOffsetMs;
}

export const KEYS = {
  PROFILE: 'sihadir_school_profile_v2',
  CLASSES: 'sihadir_school_classes_v2',
  STUDENTS: 'sihadir_school_students_v2',
  ATTENDANCE: 'sihadir_attendance_records_v2',
  LEAVES: 'sihadir_leave_requests_v2',
  TEACHERS: 'sihadir_teachers_v2',
  LEARNING_JOURNALS: 'sihadir_learning_journals_v2',
  CHARACTER_TRAITS: 'sihadir_character_traits_v2',
  CHARACTER_LOGS: 'sihadir_character_logs_v2',
  CHARACTER_PREDICATES: 'sihadir_character_predicates_v2',
  GRADES: 'sihadir_student_grades_v2',
  PERIODS: 'sihadir_lesson_periods_v2',
  SCHEDULES: 'sihadir_class_schedules_v2',
  SESSION: 'sihadir_user_session_v2',
};

// Cadangan aman lokal terpisah agar scan kehadiran siswa tidak pernah hilang
export const SAFE_ATTENDANCE_BACKUP_KEY = 'sihadir_attendance_backup_safe';

// Cadangan permanen lokal terpisah khusus catatan karakter manual siswa agar tidak pernah hilang
export const SAFE_MANUAL_CHARACTER_LOGS_BACKUP_KEY = 'sihadir_manual_character_logs_permanent_v2';

// Daftar ID catatan karakter yang telah dihapus agar tidak dibangkitkan kembali oleh sinkronisasi Cloud
export const DELETED_CHARACTER_LOGS_KEY = 'sihadir_deleted_character_log_ids_v2';

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'quota_exceeded';
let currentSyncStatus: CloudSyncStatus = 'syncing';
let isFirestoreInitialized = false;
let activeUnsubscribes: (() => void)[] = [];
const debounceTimers: Record<string, any> = {};
const lastSavedStringCache: Record<string, string> = {};

export function getCloudSyncStatus(): CloudSyncStatus {
  return currentSyncStatus;
}

const setCloudSyncStatus = (status: CloudSyncStatus) => {
  currentSyncStatus = status;
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('sihadir_cloud_status_changed', { detail: { status } }));
    }, 0);
  }
};

let notifyStorageUpdatedTimer: any = null;
const notifyStorageUpdated = () => {
  if (notifyStorageUpdatedTimer) return;
  notifyStorageUpdatedTimer = setTimeout(() => {
    notifyStorageUpdatedTimer = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sihadir_storage_updated'));
    }
  }, 80);
};

// Helper to prevent any promise from hanging indefinitely
function withTimeout<T>(promise: Promise<T>, ms: number = 12000, fallbackVal: T): Promise<T> {
  let timeoutHandle: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => {
      console.warn(`[Cloud Storage] Operasi melebihi batas waktu ${ms}ms.`);
      resolve(fallbackVal);
    }, ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timeoutHandle);
      return res;
    }).catch((err) => {
      clearTimeout(timeoutHandle);
      console.warn('[Cloud Storage Error]:', err);
      return fallbackVal;
    }),
    timeoutPromise
  ]);
}

const QUOTA_COOLDOWN_KEY = 'sihadir_firestore_quota_cooldown_until';

// Max chunk size per Firestore document: 880 KB (safe headroom below the 1MB Firestore limit, avoids unnecessary chunking)
const FIRESTORE_MAX_CHUNK_SIZE = 880 * 1024;

// Firestore Rate Limiting and In-Flight Write Mutex
const MAX_CONCURRENT_FIRESTORE_WRITES = 2;
let activeFirestoreWriteCount = 0;
const firestoreWriteWaiters: (() => void)[] = [];

async function acquireFirestoreWriteSlot(): Promise<() => void> {
  if (activeFirestoreWriteCount < MAX_CONCURRENT_FIRESTORE_WRITES) {
    activeFirestoreWriteCount++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        activeFirestoreWriteCount--;
        const next = firestoreWriteWaiters.shift();
        if (next) next();
      }
    };
  }

  await new Promise<void>((resolve) => {
    firestoreWriteWaiters.push(resolve);
  });
  activeFirestoreWriteCount++;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      activeFirestoreWriteCount--;
      const next = firestoreWriteWaiters.shift();
      if (next) next();
    }
  };
}

// In-flight per-key write tracker and coalescer
const inFlightKeys = new Set<string>();
const pendingWritesByKey = new Map<string, { dataStr: string; timestamp: number }>();
let writeBackoffUntil = 0;

// Otomatis hapus cooldown quota lama jika menggunakan database Blaze (si-hadirqr-blaze)
if (typeof window !== 'undefined') {
  if (firebaseConfigData.firestoreDatabaseId && firebaseConfigData.firestoreDatabaseId !== '(default)') {
    try {
      localStorage.removeItem(QUOTA_COOLDOWN_KEY);
    } catch {}
  }
}

// Cadangan proteksi biaya Google Cloud Firestore
const DAILY_WRITES_KEY = 'sihadir_daily_cloud_writes_v1';
const MAX_SAFE_DAILY_WRITES_PER_DEVICE = 3500;

export function getDailyWritesInfo(): { date: string; count: number } {
  if (typeof window === 'undefined') return { date: '', count: 0 };
  try {
    const raw = localStorage.getItem(DAILY_WRITES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === getLocalDateString()) return parsed;
    }
  } catch {}
  return { date: getLocalDateString(), count: 0 };
}

export function incrementDailyWrites(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const today = getLocalDateString();
    const info = getDailyWritesInfo();
    const newCount = (info.date === today ? info.count : 0) + 1;
    localStorage.setItem(DAILY_WRITES_KEY, JSON.stringify({ date: today, count: newCount }));
    return newCount;
  } catch {
    return 0;
  }
}

export function isFirestoreQuotaExceeded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // 1. Cek jeda cooldown jika pernah kena QuotaExceeded
    const stored = Number(localStorage.getItem(QUOTA_COOLDOWN_KEY) || '0');
    if (Date.now() < stored) return true;

    // 2. Client-side Daily Safety Cap (Menjamin tidak ada tagihan tak terduga pada Google Cloud Blaze)
    // Jika sebuah perangkat melakukan penulisan melebihi ambang wajar harian (3.500 writes/hari),
    // aktifkan pembatas aman agar total proyek tidak pernah melompati kuota gratis 20.000 write Google Cloud!
    const dailyInfo = getDailyWritesInfo();
    if (dailyInfo.count >= MAX_SAFE_DAILY_WRITES_PER_DEVICE) {
      console.warn(`[Firestore Safety Cap] Ambang aman harian (${MAX_SAFE_DAILY_WRITES_PER_DEVICE} writes) tercapai pada browser ini untuk mencegah tagihan Google Cloud.`);
      return true;
    }

    // Database berbayar Blaze / custom database tidak diblokir cooldown Spark
    if (firebaseConfigData.firestoreDatabaseId && firebaseConfigData.firestoreDatabaseId !== '(default)') {
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

export function resetFirestoreQuotaCooldown(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(QUOTA_COOLDOWN_KEY);
      writeBackoffUntil = 0;
    } catch {}
  }
}

export function handleFirestoreError(err: any): void {
  if (!err) return;
  const errMsg = String(err?.message || err?.code || err || '');

  // 1. Client-side write stream saturation / buffer backoff (NOT project quota exhaustion)
  if (
    errMsg.includes('Write stream exhausted') || 
    errMsg.includes('maximum allowed queued writes') ||
    errMsg.includes('maximum backoff delay')
  ) {
    console.warn('[Firestore Sync] Antrean penulisan WebChannel jenuh (Write stream exhausted). Menerapkan jeda backoff singkat...');
    writeBackoffUntil = Math.max(writeBackoffUntil, Date.now() + 2000);
    setCloudSyncStatus('syncing');
    return;
  }

  // 2. Real Google Cloud Project Quota limit (hanya berlaku jika default free database)
  const isPaidBlaze = Boolean(firebaseConfigData.firestoreDatabaseId && firebaseConfigData.firestoreDatabaseId !== '(default)');
  if (
    !isPaidBlaze &&
    (errMsg.includes('Quota exceeded for quota metric') || 
     errMsg.includes('Free daily write units') || 
     errMsg.includes('Quota limit exceeded') ||
     (err?.code === 'resource-exhausted' && !errMsg.includes('Write stream exhausted')))
  ) {
    console.warn('[Firestore Sync] Kuota harian Firestore gratis telah tercapai. Beralih aman ke penyimpanan lokal.');
    if (activeUnsubscribes.length > 0) {
      activeUnsubscribes.forEach(unsub => {
        try { unsub(); } catch {}
      });
      activeUnsubscribes = [];
      isFirestoreInitialized = false;
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(QUOTA_COOLDOWN_KEY, String(Date.now() + 6 * 60 * 60 * 1000));
      } catch {}
    }
    setCloudSyncStatus('quota_exceeded');
    return;
  }

  console.warn('[Firestore Error]:', errMsg);
}

/**
 * Memvalidasi apakah suatu objek adalah catatan presensi siswa yang valid:
 * - Memiliki studentId (string tidak kosong)
 * - Format tanggal ISO YYYY-MM-DD (menolak record rusak seperti date: 'ALPA')
 * - Bukan data sampah autoalpa
 */
export function isValidAttendanceRecord(rec: any): boolean {
  if (!rec || typeof rec !== 'object') return false;
  if (!rec.studentId || typeof rec.studentId !== 'string' || !rec.studentId.trim()) return false;
  if (!rec.date || typeof rec.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rec.date.trim())) return false;
  if (
    rec.id?.startsWith('att-autoalpa-') ||
    rec.scannedBy?.includes('Sistem Otomatis (Batas Alpa)') ||
    rec.notes?.includes('Otomatis Alpa')
  ) {
    return false;
  }
  return true;
}

/**
 * Membersihkan, memvalidasi, mendeduplikasi, dan mengurutkan riwayat presensi siswa
 */
export function validateAndSanitizeAttendanceRecords(records: any[]): AttendanceRecord[] {
  if (!Array.isArray(records)) return [];
  const cleanList: AttendanceRecord[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!isValidAttendanceRecord(r)) continue;

    const dedupeKey = r.id ? `id_${r.id}` : `${r.date}__${r.studentId}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const cleanRecord: AttendanceRecord = {
      id: r.id || `att-${Date.now()}-${r.studentId}`,
      studentId: String(r.studentId).trim(),
      studentName: String(r.studentName || 'Siswa').trim(),
      nisn: String(r.nisn || '').trim(),
      className: String(r.className || '').trim(),
      date: String(r.date).trim(),
      time: (r.time && r.time !== '-') ? String(r.time).trim() : '-',
      status: r.status || 'HADIR',
      method: r.method || 'QR_SCAN',
      scannedBy: r.scannedBy || 'Pos Scanner Utama',
      parentNotified: Boolean(r.parentNotified),
    };

    if (r.returnTime && r.returnTime !== '-') cleanRecord.returnTime = String(r.returnTime).trim();
    if (r.returnStatus) cleanRecord.returnStatus = r.returnStatus;
    if (r.returnScannedBy) cleanRecord.returnScannedBy = String(r.returnScannedBy).trim();
    if (r.notes) cleanRecord.notes = String(r.notes).trim();

    cleanList.push(cleanRecord);
  }

  // Urutkan berdasarkan tanggal terbaru (descending), lalu jam (descending)
  return cleanList.sort((a, b) => {
    const dComp = (b.date || '').localeCompare(a.date || '');
    if (dComp !== 0) return dComp;
    return (b.time || '').localeCompare(a.time || '');
  });
}

/**
 * Cache in-memory untuk presensi: memastikan data selalu tersedia kilat dan kebal batas kuota LocalStorage
 */
let inMemoryAttendanceRecords: AttendanceRecord[] | null = null;

/**
 * Membersihkan kunci sementara, log lama, dan cadangan duplikat saat kuota LocalStorage penuh
 */
export function reclaimLocalStorageQuota(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove = [
      SAFE_ATTENDANCE_BACKUP_KEY,
      'sihadir_temp_cache',
      'sihadir_cached_export',
      'sihadir_wa_queue',
      'sihadir_wa_logs',
      'sihadir_wa_logs_v2',
      'sihadir_wa_logs_v2_updatedAt',
      'sihadir_backup_cache',
      'sihadir_analytics_cache',
    ];
    for (const k of keysToRemove) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }

    // Bersihkan fragment chunk atau cache lama
    const total = localStorage.length;
    const toDelete: string[] = [];
    for (let i = 0; i < total; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('_chunk_') || key.includes('_backup') || key.includes('_temp') || key.includes('cached_'))) {
        toDelete.push(key);
      }
    }
    toDelete.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
  } catch {}
}

/**
 * Safe LocalStorage setter that gracefully catches QuotaExceededError,
 * compacts attendance records progressively, and removes stale temporary cache without crashing.
 */
export function safeSetLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;

  // 1. Jika key adalah ATTENDANCE, simpan selalu di memori sesi aktif
  if (key === KEYS.ATTENDANCE) {
    try {
      const records = JSON.parse(value);
      if (Array.isArray(records)) {
        inMemoryAttendanceRecords = validateAndSanitizeAttendanceRecords(records);
      }
    } catch {}
  }

  // 2. Percobaan penyimpanan langsung
  try {
    localStorage.setItem(key, value);
    return;
  } catch {}

  // 3. Jika gagal (QuotaExceeded), bersihkan cache tidak penting & duplikasi cadangan
  reclaimLocalStorageQuota();

  try {
    localStorage.setItem(key, value);
    return;
  } catch {}

  // 4. Kompaksi bertingkat untuk ATTENDANCE jika kuota masih belum cukup
  if (key === KEYS.ATTENDANCE) {
    try {
      const records = inMemoryAttendanceRecords || JSON.parse(value);
      if (Array.isArray(records)) {
        const clean = validateAndSanitizeAttendanceRecords(records);
        const compacted = clean.map((r: any) => {
          const item: any = {
            id: r.id,
            studentId: r.studentId,
            studentName: r.studentName,
            className: r.className,
            date: r.date,
            time: r.time,
            status: r.status,
            method: r.method,
          };
          if (r.nisn) item.nisn = r.nisn;
          if (r.returnTime && r.returnTime !== '-') item.returnTime = r.returnTime;
          if (r.returnStatus) item.returnStatus = r.returnStatus;
          if (r.scannedBy && !r.scannedBy.includes('Sistem Otomatis')) item.scannedBy = r.scannedBy;
          if (r.returnScannedBy) item.returnScannedBy = r.returnScannedBy;
          if (r.notes) item.notes = r.notes;
          return item;
        });

        // Urutkan descending berdasarkan tanggal dan jam
        compacted.sort((a: any, b: any) => {
          const dComp = (b.date || '').localeCompare(a.date || '');
          if (dComp !== 0) return dComp;
          return (b.time || '').localeCompare(a.time || '');
        });

        // Coba simpan seluruh data yang dipadatkan
        try {
          localStorage.setItem(key, JSON.stringify(compacted));
          return;
        } catch {}

        // Batasi bertingkat ukuran histori lokal: 500, 250, 100, 50, 20
        const sliceLimits = [500, 250, 100, 50, 20];
        for (const limit of sliceLimits) {
          try {
            const sliced = compacted.slice(0, limit);
            localStorage.setItem(key, JSON.stringify(sliced));
            return;
          } catch {}
        }
      }
    } catch {}
  }

  // 5. Kompaksi bertingkat untuk CHARACTER_LOGS
  if (key === KEYS.CHARACTER_LOGS) {
    try {
      const logs = JSON.parse(value);
      if (Array.isArray(logs)) {
        const manuals = logs.filter((l: any) => l.isManual || l.category === 'MANUAL' || l.teacherName);
        const autos = logs.filter((l: any) => !l.isManual && l.category !== 'MANUAL' && !l.teacherName);
        const limits = [200, 100, 50, 0];
        for (const limit of limits) {
          try {
            const trimmed = [...manuals, ...autos.slice(0, limit)];
            localStorage.setItem(key, JSON.stringify(trimmed));
            return;
          } catch {}
        }
      }
    } catch {}
  }

  // 6. Kompaksi bertingkat untuk LEARNING_JOURNALS
  if (key === KEYS.LEARNING_JOURNALS) {
    try {
      const journals = JSON.parse(value);
      if (Array.isArray(journals)) {
        const limits = [200, 100, 50, 20];
        for (const limit of limits) {
          try {
            localStorage.setItem(key, JSON.stringify(journals.slice(0, limit)));
            return;
          } catch {}
        }
      }
    } catch {}
  }

  // 7. Kompaksi bertingkat untuk GRADES
  if (key === KEYS.GRADES) {
    try {
      const grades = JSON.parse(value);
      if (Array.isArray(grades)) {
        const limits = [200, 100, 50, 20];
        for (const limit of limits) {
          try {
            localStorage.setItem(key, JSON.stringify(grades.slice(0, limit)));
            return;
          } catch {}
        }
      }
    } catch {}
  }

  // Pemberitahuan senyap tanpa melempar error tak tertangani
  console.warn(`[Storage Info] Data ${key} tetap tersimpan aman di memori sesi aktif.`);
}

const knownChunkedDocs = new Map<string, number>();

async function performSingleDocWrite(key: string, dataStr: string, timestamp: number): Promise<void> {
  const totalLength = dataStr.length;
  if (totalLength <= FIRESTORE_MAX_CHUNK_SIZE) {
    // Normal single document
    const docRef = doc(db, 'sihadir_app_data', key);
    await setDoc(docRef, {
      data: dataStr,
      updatedAt: timestamp,
      serverTime: serverTimestamp(),
      isChunked: false,
      totalChunks: 1,
    });
    knownChunkedDocs.delete(key);
  } else {
    // Multi-chunk document sharding
    const numChunks = Math.ceil(totalLength / FIRESTORE_MAX_CHUNK_SIZE);
    knownChunkedDocs.set(key, numChunks);
    const chunks: string[] = [];
    for (let i = 0; i < numChunks; i++) {
      chunks.push(dataStr.slice(i * FIRESTORE_MAX_CHUNK_SIZE, (i + 1) * FIRESTORE_MAX_CHUNK_SIZE));
    }

    // Write chunks 1 to numChunks - 1 sequentially to prevent saturating the WebChannel write stream
    for (let i = 1; i < numChunks; i++) {
      const chunkDocRef = doc(db, 'sihadir_app_data', `${key}_chunk_${i}`);
      await setDoc(chunkDocRef, {
        data: chunks[i],
        updatedAt: timestamp,
        chunkIndex: i,
        parentKey: key,
      });
    }

    // Finally write the root document (chunk 0) which acts as the commit pointer
    const rootDocRef = doc(db, 'sihadir_app_data', key);
    await setDoc(rootDocRef, {
      data: chunks[0],
      updatedAt: timestamp,
      serverTime: serverTimestamp(),
      isChunked: true,
      totalChunks: numChunks,
    });
  }

  // Hitung penulisan harian untuk perlindungan tagihan Google Cloud Blaze
  incrementDailyWrites();
}

export async function writeCloudDocument(key: string, dataStr: string, timestamp: number): Promise<void> {
  const currentRole = getUserSession()?.role;
  // PENGHEMAT KUOTA UTAMA:
  // Tamu belum login atau HP Orang Tua (PARENT) dilarang keras menulis data apa pun ke Cloud Firestore,
  // KECUALI dokumen permohonan izin (KEYS.LEAVES) atau saat ganti kata sandi siswa (KEYS.STUDENTS).
  if (!currentRole && key !== KEYS.PROFILE && key !== KEYS.LEAVES) {
    return;
  }
  if (currentRole === 'PARENT' && key !== KEYS.LEAVES && key !== KEYS.STUDENTS) {
    return;
  }

  if (isFirestoreQuotaExceeded()) {
    return;
  }

  let sanitizedDataStr = dataStr;
  if (key === KEYS.ATTENDANCE) {
    try {
      const parsed = JSON.parse(dataStr);
      if (Array.isArray(parsed)) {
        const clean = validateAndSanitizeAttendanceRecords(parsed);
        // Kompaksi payload: buang field kosong / default untuk menghemat 40-50% ukuran JSON di Firestore
        const compacted = clean.map((r: any) => {
          const item: any = {
            id: r.id,
            studentId: r.studentId,
            studentName: r.studentName,
            className: r.className,
            date: r.date,
            time: r.time,
            status: r.status,
            method: r.method,
          };
          if (r.nisn) item.nisn = r.nisn;
          if (r.returnTime && r.returnTime !== '-') item.returnTime = r.returnTime;
          if (r.returnStatus && r.returnStatus !== 'BELUM_PULANG') item.returnStatus = r.returnStatus;
          if (r.scannedBy && !r.scannedBy.includes('Sistem Otomatis')) item.scannedBy = r.scannedBy;
          if (r.returnScannedBy && !r.returnScannedBy.includes('Sistem Otomatis')) item.returnScannedBy = r.returnScannedBy;
          if (r.notes) item.notes = r.notes;
          return item;
        });
        sanitizedDataStr = JSON.stringify(compacted);
      }
    } catch {}
  }

  // If currently in a brief backoff window due to client queue pressure, wait briefly
  if (Date.now() < writeBackoffUntil) {
    const waitMs = Math.min(writeBackoffUntil - Date.now(), 3000);
    await new Promise((r) => setTimeout(r, waitMs));
    if (isFirestoreQuotaExceeded()) return;
  }

  // If a write for this key is already running, coalesce:
  // Update the pending payload and return. The running loop will commit this latest version.
  if (inFlightKeys.has(key)) {
    pendingWritesByKey.set(key, { dataStr: sanitizedDataStr, timestamp });
    return;
  }

  inFlightKeys.add(key);
  try {
    let currentPayload: { dataStr: string; timestamp: number } | undefined = { dataStr: sanitizedDataStr, timestamp };

    while (currentPayload) {
      if (isFirestoreQuotaExceeded()) break;

      const releaseSlot = await acquireFirestoreWriteSlot();
      try {
        await performSingleDocWrite(key, currentPayload.dataStr, currentPayload.timestamp);
        lastSavedStringCache[key] = currentPayload.dataStr;
      } catch (err) {
        handleFirestoreError(err);
        break;
      } finally {
        releaseSlot();
      }

      // Check if another write request arrived for this key while writing
      if (pendingWritesByKey.has(key)) {
        currentPayload = pendingWritesByKey.get(key);
        pendingWritesByKey.delete(key);
      } else {
        currentPayload = undefined;
      }
    }
  } finally {
    inFlightKeys.delete(key);
    pendingWritesByKey.delete(key);
  }
}

export async function readCloudDocument(key: string): Promise<{ data: string; updatedAt: number } | null> {
  try {
    const rootDocRef = doc(db, 'sihadir_app_data', key);
    const snap = await withTimeout(getDoc(rootDocRef), 6000, null);
    if (!snap || !snap.exists()) return null;

    const payload = snap.data();
    if (!payload) return null;

    const updatedAt = Number(payload.updatedAt) || 0;
    const isChunked = !!payload.isChunked && Number(payload.totalChunks) > 1;

    if (!isChunked) {
      const dataStr = typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data || '');
      lastSavedStringCache[key] = dataStr;
      return { data: dataStr, updatedAt };
    }

    // Assemble chunked documents
    const totalChunks = Number(payload.totalChunks);
    const chunkPromises: Promise<string>[] = [];

    for (let i = 1; i < totalChunks; i++) {
      const chunkDocRef = doc(db, 'sihadir_app_data', `${key}_chunk_${i}`);
      chunkPromises.push(
        withTimeout(
          getDoc(chunkDocRef).then((cSnap) => {
            if (cSnap && cSnap.exists() && cSnap.data()?.data) {
              return String(cSnap.data().data);
            }
            return '';
          }),
          6000,
          ''
        )
      );
    }

    const otherChunks = await Promise.all(chunkPromises);
    const fullDataStr = (payload.data || '') + otherChunks.join('');
    lastSavedStringCache[key] = fullDataStr;
    return { data: fullDataStr, updatedAt };
  } catch (err) {
    console.error(`[Firestore Sync] Error reading cloud document for ${key}:`, err);
    return null;
  }
}

// Debounced and deduped push to Firestore with Auto-Chunking support
export function syncToCloud(key: string, data: any, instant: boolean = false, explicitTimestamp?: number) {
  if (typeof window === 'undefined') return;

  const currentRole = getUserSession()?.role;
  // PENGHEMAT KUOTA UTAMA:
  // Tamu belum login atau HP Orang Tua (PARENT) dilarang keras menulis data apa pun ke Cloud Firestore,
  // KECUALI dokumen permohonan izin (KEYS.LEAVES) atau saat ganti kata sandi siswa (KEYS.STUDENTS).
  if (!currentRole && key !== KEYS.PROFILE && key !== KEYS.LEAVES) {
    return;
  }
  if (currentRole === 'PARENT' && key !== KEYS.LEAVES && key !== KEYS.STUDENTS) {
    return;
  }

  let finalData = data;
  if (key === KEYS.ATTENDANCE) {
    try {
      const records = typeof data === 'string' ? JSON.parse(data) : data;
      if (Array.isArray(records)) {
        finalData = validateAndSanitizeAttendanceRecords(records);
      }
    } catch {}
  }

  const dataStr = typeof finalData === 'string' ? finalData : JSON.stringify(finalData);
  
  // Skip if data is identical to what is already stored in cloud
  if (lastSavedStringCache[key] === dataStr) {
    return;
  }

  // If daily free quota is exceeded on Google Cloud, pause remote network writes during cooldown
  if (isFirestoreQuotaExceeded()) {
    setCloudSyncStatus('quota_exceeded');
    return;
  }

  // Clear previous debounce for this key
  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key]);
  }

  const doWrite = async () => {
    if (isFirestoreQuotaExceeded()) {
      setCloudSyncStatus('quota_exceeded');
      return;
    }

    try {
      setCloudSyncStatus('syncing');
      const timestamp = explicitTimestamp || Number(localStorage.getItem(key + '_updatedAt')) || Date.now();
      await writeCloudDocument(key, dataStr, timestamp);
      lastSavedStringCache[key] = dataStr;
      setCloudSyncStatus('connected');
    } catch (err: any) {
      handleFirestoreError(err);
      if (!isFirestoreQuotaExceeded()) {
        console.warn('[Firestore Sync] Error, menggunakan penyimpanan offline lokal:', err?.message || err);
        setCloudSyncStatus('offline');
      }
    }
  };

  // If instant or empty array (e.g. user cleared/deleted all students or instant scan record), push immediately
  if (instant || dataStr === '[]') {
    doWrite();
  } else {
    // Smart debounce (1200ms) to coalesce rapid typing/edits and save Cloud Firestore writes
    debounceTimers[key] = setTimeout(doWrite, 1200);
  }
}

// Complete Zero-Cloud Backup & Instant Restore (P2P Transfer)
export function exportAllDatabaseToJson(): string {
  const backupObject: Record<string, any> = {
    _app: 'SiHadirQR',
    _version: '2.0',
    _timestamp: Date.now(),
    _exportDate: new Date().toISOString(),
    profile: getSchoolProfile(),
    classes: getSchoolClasses(),
    students: getStudents(),
    attendance: getAttendanceRecords(),
    leaves: getLeaveRequests(),
    teachers: getTeachers(),
    learningJournals: getLearningJournals(),
    characterTraits: getCharacterTraits(),
    characterLogs: getStudentCharacterLogs(),
    characterPredicates: getCharacterPredicateSettings(),
    grades: getStudentGradeAssessments(),
    periods: getLessonPeriods(),
    schedules: getClassSchedules(),
  };
  return JSON.stringify(backupObject, null, 2);
}

/**
 * Safely formats a Date or timestamp or date string into local YYYY-MM-DD (avoiding UTC offset bugs)
 * Mengonversi waktu ke Zona Waktu Sekolah Standar Indonesia (WITA UTC+8)
 * sehingga seluruh perangkat (walaupun setting zona waktu HP/laptop berbeda atau UTC)
 * selalu menghasilkan tanggal hari ini yang identik sama persis!
 */
export function getLocalDateString(dateInput: Date | number | string = new Date()): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      d = new Date(dateInput);
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = new Date();
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  // Standar Waktu Sekolah Indonesia (WITA UTC+8):
  // Menghilangkan bug perbedaan tanggal antara perangkat di pagi hari (06:00 - 08:00)
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const schoolTime = new Date(utc + (3600000 * 8));

  const year = schoolTime.getFullYear();
  const month = String(schoolTime.getMonth() + 1).padStart(2, '0');
  const day = String(schoolTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function downloadDatabaseBackupFile(): void {
  const jsonStr = exportAllDatabaseToJson();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = getLocalDateString();
  const studentsCount = getStudents().length;
  a.href = url;
  a.download = `SiHadirQR_Backup_${studentsCount}_Siswa_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importAllDatabaseFromJson(jsonString: string): { success: boolean; studentCount: number; message: string } {
  try {
    const data = JSON.parse(jsonString);
    if (!data || (!data.students && !data.classes)) {
      return { success: false, studentCount: 0, message: 'Format file cadangan tidak valid.' };
    }

    const now = Date.now();
    const setKey = (k: string, val: any) => {
      if (val !== undefined) {
        const str = JSON.stringify(val);
        safeSetLocalStorage(k, str);
        safeSetLocalStorage(k + '_updatedAt', String(now));
        lastSavedStringCache[k] = str;
      }
    };

    if (data.profile) setKey(KEYS.PROFILE, data.profile);
    if (data.classes) setKey(KEYS.CLASSES, data.classes);
    if (data.students) setKey(KEYS.STUDENTS, data.students);
    if (data.attendance) setKey(KEYS.ATTENDANCE, data.attendance);
    if (data.leaves) setKey(KEYS.LEAVES, data.leaves);
    if (data.teachers) setKey(KEYS.TEACHERS, data.teachers);
    if (data.learningJournals) setKey(KEYS.LEARNING_JOURNALS, data.learningJournals);
    if (data.characterTraits) setKey(KEYS.CHARACTER_TRAITS, data.characterTraits);
    if (data.characterLogs) setKey(KEYS.CHARACTER_LOGS, data.characterLogs);
    if (data.characterPredicates) setKey(KEYS.CHARACTER_PREDICATES, data.characterPredicates);
    if (data.grades) setKey(KEYS.GRADES, data.grades);
    if (data.periods) setKey(KEYS.PERIODS, data.periods);
    if (data.schedules) setKey(KEYS.SCHEDULES, data.schedules);

    const totalStudents = (data.students && Array.isArray(data.students)) ? data.students.length : getStudents().length;

    notifyStorageUpdated();

    // Trigger background cloud sync if available
    forceUploadAllToCloud().catch(() => {});

    return {
      success: true,
      studentCount: totalStudents,
      message: `Berhasil memulihkan ${totalStudents} data siswa dan seluruh data sekolah!`,
    };
  } catch (err: any) {
    return {
      success: false,
      studentCount: 0,
      message: `Gagal memulihkan cadangan: ${err?.message || 'File rusak atau tidak valid'}`,
    };
  }
}

// High-efficiency Image Compressor for Student Photos & Cross-Device Cloud Sync
export function compressBase64Image(
  dataUrl: string,
  maxWidth = 200,
  maxHeight = 267,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:') || dataUrl.length < 15000) {
      return resolve(dataUrl);
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve(dataUrl);
    }

    // Safety timeout to prevent hanging on corrupted or slow base64 images
    const safetyTimer = setTimeout(() => {
      resolve(dataUrl);
    }, 1000);

    try {
      const img = new Image();
      img.onload = () => {
        clearTimeout(safetyTimer);
        try {
          let w = img.width;
          let h = img.height;
          if (w <= 0 || h <= 0) return resolve(dataUrl);

          if (w > maxWidth || h > maxHeight) {
            const ratio = Math.min(maxWidth / w, maxHeight / h);
            w = Math.max(1, Math.round(w * ratio));
            h = Math.max(1, Math.round(h * ratio));
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(dataUrl);

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => {
        clearTimeout(safetyTimer);
        resolve(dataUrl);
      };
      img.src = dataUrl;
    } catch {
      clearTimeout(safetyTimer);
      resolve(dataUrl);
    }
  });
}

// Background sanitizer to compress oversized raw student photos (>90KB base64)
export async function sanitizeAndCompressStudentPhotos(students: Student[]): Promise<Student[]> {
  let hasChanges = false;
  const updated: Student[] = [];
  for (let i = 0; i < students.length; i++) {
    const std = students[i];
    if (std && std.photoUrl && std.photoUrl.startsWith('data:') && std.photoUrl.length > 90000) {
      try {
        const compressed = await compressBase64Image(std.photoUrl, 160, 213, 0.62);
        if (compressed.length < std.photoUrl.length) {
          hasChanges = true;
          updated.push({ ...std, photoUrl: compressed });
          continue;
        }
      } catch (e) {
        console.warn('[Photo Compress Error]:', e);
      }
    }
    updated.push(std);
  }
  return hasChanges ? updated : students;
}

export const DEMO_STUDENT_IDS = new Set([
  'std-001', 'std-002', 'std-003', 'std-004',
  'std-005', 'std-006', 'std-007', 'std-008',
  'std-009', 'std-010', 'std-011', 'std-012'
]);

export const DEMO_STUDENT_NISNS = new Set([
  '0081234561', '0081234562', '0081234563', '0081234564',
  '0081234565', '0081234566', '0081234567', '0081234568',
  '0081234569', '0081234570', '0081234571', '0081234572'
]);

export const DEMO_TEACHER_IDS = new Set([
  'tch-001', 'tch-002', 'tch-003', 'tch-004',
  'tch-005', 'tch-006', 'tch-007', 'tch-008'
]);

export const DEMO_TEACHER_NIPS = new Set([
  '19850312 201001 2 015',
  '19790820 200501 1 008',
  '19881105 201402 2 009',
  '19910403 201903 1 011',
  '19830218 200902 2 004',
  '19820514 200801 2 006',
  '19900210 201801 1 003',
  '19870615 201101 1 005'
]);

export const DEMO_DATA_CLEARED_KEY = 'sihadir_demo_data_cleared';

// Intelligent entity mergers to ensure no data is lost across multiple devices
export function mergeStudentLists(local: Student[], cloud: Student[]): Student[] {
  const isDemo = (s: Student) => DEMO_STUDENT_IDS.has(s.id) || (!!s.nisn && DEMO_STUDENT_NISNS.has(s.nisn.trim()));
  const hasRealStudents = local.some(s => !isDemo(s)) || cloud.some(s => !isDemo(s));
  const isDemoCleared = (typeof window !== 'undefined' && localStorage.getItem(DEMO_DATA_CLEARED_KEY) === 'true') || hasRealStudents;

  // Once real students exist in local or cloud, demo students must never be preserved or resurrected!
  const effectiveCloud = isDemoCleared ? cloud.filter(s => !isDemo(s)) : cloud;
  const effectiveLocal = isDemoCleared ? local.filter(s => !isDemo(s)) : local;

  const map = new Map<string, Student>();
  
  // 1. Index cloud items
  effectiveCloud.forEach(s => {
    const key = (s.nisn && s.nisn.trim()) || (s.nis && s.nis.trim()) || s.id;
    if (key) map.set(key, { ...s });
  });

  // 2. Merge local items
  effectiveLocal.forEach(localItem => {
    const key = (localItem.nisn && localItem.nisn.trim()) || (localItem.nis && localItem.nis.trim()) || localItem.id;
    if (!key) return;

    if (map.has(key)) {
      const cloudItem = map.get(key)!;
      
      // Determine best photo:
      // A photo is considered real/custom if it is not empty and not a generic unsplash placeholder
      const isCloudRealPhoto = !!cloudItem.photoUrl && !cloudItem.photoUrl.includes('unsplash.com');
      const isLocalRealPhoto = !!localItem.photoUrl && !localItem.photoUrl.includes('unsplash.com');
      
      let bestPhoto = cloudItem.photoUrl || localItem.photoUrl;
      if (isCloudRealPhoto && !isLocalRealPhoto) {
        bestPhoto = cloudItem.photoUrl;
      } else if (!isCloudRealPhoto && isLocalRealPhoto) {
        bestPhoto = localItem.photoUrl;
      } else if (isCloudRealPhoto && isLocalRealPhoto) {
        bestPhoto = cloudItem.photoUrl || localItem.photoUrl;
      }

      // Preserve custom password across devices:
      // A custom password (defined, non-empty, and !== '123456') must never be wiped out by default/undefined values
      const isCloudCustomPass = !!cloudItem.password && cloudItem.password !== '123456';
      const isLocalCustomPass = !!localItem.password && localItem.password !== '123456';
      
      let bestPassword = cloudItem.password || localItem.password;
      if (isCloudCustomPass) {
        bestPassword = cloudItem.password;
      } else if (isLocalCustomPass) {
        bestPassword = localItem.password;
      }

      // Merge other properties gracefully
      const merged: Student = {
        ...localItem,
        ...cloudItem,
        name: cloudItem.name || localItem.name,
        className: cloudItem.className || localItem.className,
        classId: cloudItem.classId || localItem.classId,
        parentName: cloudItem.parentName || localItem.parentName,
        parentPhone: cloudItem.parentPhone || localItem.parentPhone,
        address: cloudItem.address || localItem.address,
        birthPlaceDate: cloudItem.birthPlaceDate || localItem.birthPlaceDate,
        qrCode: cloudItem.qrCode || localItem.qrCode || `STUDENT-${localItem.nisn}`,
        photoUrl: bestPhoto,
        password: bestPassword,
      };

      map.set(key, merged);
    } else {
      map.set(key, { ...localItem });
    }
  });

  return Array.from(map.values());
}

export function mergeClassLists(local: SchoolClass[], cloud: SchoolClass[]): SchoolClass[] {
  const map = new Map<string, SchoolClass>();
  cloud.forEach(c => map.set(c.id || c.name.toLowerCase().trim(), c));
  local.forEach(c => map.set(c.id || c.name.toLowerCase().trim(), c));
  return Array.from(map.values());
}

export function mergeLearningJournals(local: LearningJournal[], cloud: LearningJournal[]): LearningJournal[] {
  if (!Array.isArray(local) || local.length === 0) return Array.isArray(cloud) ? cloud : [];
  if (!Array.isArray(cloud) || cloud.length === 0) return local;

  const map = new Map<string, LearningJournal>();
  
  // 1. Masukkan semua journal dari Cloud
  cloud.forEach(j => {
    if (j && j.id) map.set(j.id, j);
  });

  // 2. Gabungkan journal dari Lokal (jika ada id sama, ambil yang lebih baru)
  local.forEach(j => {
    if (!j || !j.id) return;
    if (map.has(j.id)) {
      const existing = map.get(j.id)!;
      const localTime = new Date(j.createdAt || 0).getTime();
      const existingTime = new Date(existing.createdAt || 0).getTime();
      if (localTime >= existingTime) {
        map.set(j.id, { ...existing, ...j });
      }
    } else {
      map.set(j.id, j);
    }
  });

  return Array.from(map.values()).sort((a, b) => 
    (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

export function mergeStudentGradeAssessments(local: StudentGradeAssessment[], cloud: StudentGradeAssessment[]): StudentGradeAssessment[] {
  if (!Array.isArray(local) || local.length === 0) return Array.isArray(cloud) ? cloud : [];
  if (!Array.isArray(cloud) || cloud.length === 0) return local;

  const map = new Map<string, StudentGradeAssessment>();

  // 1. Masukkan semua nilai dari Cloud
  cloud.forEach(g => {
    if (g && g.id) map.set(g.id, g);
  });

  // 2. Gabungkan nilai dari Lokal
  local.forEach(g => {
    if (!g || !g.id) return;
    if (map.has(g.id)) {
      const existing = map.get(g.id)!;
      const localTime = new Date(g.updatedAt || g.createdAt || 0).getTime();
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (localTime >= existingTime) {
        map.set(g.id, { ...existing, ...g });
      }
    } else {
      map.set(g.id, g);
    }
  });

  return Array.from(map.values()).sort((a, b) => 
    (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

export function deduplicateTeachers(teachers: Teacher[]): Teacher[] {
  if (!Array.isArray(teachers) || teachers.length === 0) return [];
  if (teachers.length === 1) {
    const single = teachers[0];
    return single ? [{ ...single, id: single.id ? single.id.trim() : ('tch-' + Date.now()) }] : [];
  }

  const result: Teacher[] = [];
  const idMap = new Map<string, number>(); // id -> index
  const nipMap = new Map<string, number>(); // clean nip -> index
  const nameMap = new Map<string, number>(); // clean name -> index

  teachers.forEach(t => {
    if (!t) return;
    const cleanId = (t.id || '').trim();
    const cleanNip = (t.nip || '').trim();
    const cleanName = (t.name || '').trim().toLowerCase();

    let targetIdx: number | undefined;

    if (cleanId && idMap.has(cleanId)) {
      targetIdx = idMap.get(cleanId);
    } else if (cleanNip && nipMap.has(cleanNip)) {
      targetIdx = nipMap.get(cleanNip);
    } else if (cleanName && nameMap.has(cleanName)) {
      targetIdx = nameMap.get(cleanName);
    } else if (cleanName.includes('sigit') && (cleanName.includes('inarsoyo') || cleanId === 'tch-1788148298202' || cleanNip === '198107232014061004')) {
      for (let i = 0; i < result.length; i++) {
        const rName = (result[i].name || '').trim().toLowerCase();
        const rNip = (result[i].nip || '').trim();
        const rId = (result[i].id || '').trim();
        if (rId === 'tch-1788148298202' || rNip === '198107232014061004' || (rName.includes('sigit') && rName.includes('inarsoyo'))) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx !== undefined) {
      // Merge records
      const existing = result[targetIdx];
      const isCloudCustomPass = !!t.password && t.password !== '123456';
      const isExistingCustomPass = !!existing.password && existing.password !== '123456';
      const bestPassword = isExistingCustomPass ? existing.password : (isCloudCustomPass ? t.password : (existing.password || t.password || '123456'));

      const isRealPhoto = (p?: string) => !!p && !p.includes('unsplash.com');
      let bestPhoto = existing.photoUrl || t.photoUrl;
      if (isRealPhoto(existing.photoUrl)) {
        bestPhoto = existing.photoUrl;
      } else if (isRealPhoto(t.photoUrl)) {
        bestPhoto = t.photoUrl;
      }

      let bestPhone = t.phone || existing.phone;
      if (t.phone === '087864360253' || existing.phone === '087864360253') {
        bestPhone = '087864360253';
      } else if (existing.phone && existing.phone.trim()) {
        bestPhone = existing.phone.trim();
      }

      const merged: Teacher = {
        ...existing,
        ...t,
        id: (existing.id && existing.id.trim()) || t.id,
        name: (existing.name && existing.name.length >= (t.name || '').length) ? existing.name : (t.name || existing.name),
        nip: (existing.nip && existing.nip.trim()) || t.nip,
        phone: bestPhone,
        email: (existing.email && existing.email.trim()) || t.email,
        subject1: existing.subject1 || t.subject1,
        subject2: existing.subject2 !== undefined ? existing.subject2 : t.subject2,
        additionalDuty: (existing.additionalDuty && existing.additionalDuty !== 'TIDAK_ADA') ? existing.additionalDuty : (t.additionalDuty || existing.additionalDuty),
        homeroomClassId: existing.homeroomClassId || t.homeroomClassId,
        homeroomClassName: existing.homeroomClassName || t.homeroomClassName,
        photoUrl: bestPhoto,
        password: bestPassword,
        status: existing.status || t.status || 'AKTIF'
      };

      result[targetIdx] = merged;
      if (merged.id) idMap.set(merged.id.trim(), targetIdx);
      if (merged.nip) nipMap.set(merged.nip.trim(), targetIdx);
      if (merged.name) nameMap.set(merged.name.trim().toLowerCase(), targetIdx);
    } else {
      const newIdx = result.length;
      result.push({ ...t });
      if (cleanId) idMap.set(cleanId, newIdx);
      if (cleanNip) nipMap.set(cleanNip, newIdx);
      if (cleanName) nameMap.set(cleanName, newIdx);
    }
  });

  // Guarantee strictly unique ID for every single item
  const seenIds = new Set<string>();
  return result.map((t, index) => {
    let finalId = t.id ? t.id.trim() : '';
    if (!finalId || seenIds.has(finalId)) {
      finalId = `tch-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`;
    }
    seenIds.add(finalId);
    return { ...t, id: finalId };
  });
}

export function mergeTeacherLists(local: Teacher[], cloud: Teacher[]): Teacher[] {
  const isDemoTeacher = (t: Teacher) => DEMO_TEACHER_IDS.has(t.id) || (!!t.nip && DEMO_TEACHER_NIPS.has(t.nip.trim()));
  const hasRealTeachers = local.some(t => !isDemoTeacher(t)) || cloud.some(t => !isDemoTeacher(t));
  const isDemoCleared = (typeof window !== 'undefined' && localStorage.getItem(DEMO_DATA_CLEARED_KEY) === 'true') || hasRealTeachers;

  // Once real teachers exist in local or cloud, demo teachers must never be preserved or resurrected!
  const effectiveCloud = isDemoCleared ? cloud.filter(t => !isDemoTeacher(t)) : cloud;
  const effectiveLocal = isDemoCleared ? local.filter(t => !isDemoTeacher(t)) : local;

  const combined = [...effectiveCloud, ...effectiveLocal];
  return deduplicateTeachers(combined);
}

/**
 * Synchronizes Homeroom Teacher (Wali Kelas) data between School Classes and Teachers.
 * Ensures that teacher duties and homeroom class assignments match the real data from Kelola Kelas.
 */
export function reconcileTeachersAndClasses(
  teachers: Teacher[],
  classes: SchoolClass[]
): { updatedTeachers: Teacher[]; updatedClasses: SchoolClass[]; teachersChanged: boolean; classesChanged: boolean } {
  let teachersChanged = false;
  let classesChanged = false;

  const classesCopy: SchoolClass[] = classes.map(c => ({ ...c }));
  
  // Index classes by id and by homeroomTeacher name
  const classByIdMap = new Map<string, SchoolClass>();
  const classByTeacherNameMap = new Map<string, SchoolClass>();

  classesCopy.forEach(c => {
    classByIdMap.set(c.id, c);
    if (c.homeroomTeacher && c.homeroomTeacher.trim() && c.homeroomTeacher !== 'Belum Ditentukan') {
      classByTeacherNameMap.set(c.homeroomTeacher.trim().toLowerCase(), c);
    }
  });

  const updatedTeachers: Teacher[] = teachers.map(teacher => {
    const teacherNameKey = (teacher.name || '').trim().toLowerCase();
    const assignedClass = classByTeacherNameMap.get(teacherNameKey);

    if (assignedClass) {
      // Teacher is assigned as homeroom teacher in assignedClass
      const newClassId = assignedClass.id;
      const newClassName = assignedClass.name;
      const newDuty = (teacher.additionalDuty && teacher.additionalDuty !== 'TIDAK_ADA' && teacher.additionalDuty !== 'WALI_KELAS')
        ? teacher.additionalDuty
        : 'WALI_KELAS';

      if (
        teacher.homeroomClassId !== newClassId ||
        teacher.homeroomClassName !== newClassName ||
        (teacher.additionalDuty !== 'WALI_KELAS' && teacher.additionalDuty !== 'WAKIL_KEPALA_SEKOLAH')
      ) {
        teachersChanged = true;
        return {
          ...teacher,
          additionalDuty: newDuty,
          homeroomClassId: newClassId,
          homeroomClassName: newClassName,
        };
      }
      return teacher;
    } else {
      // Teacher is not named in class.homeroomTeacher
      // Check if teacher has a valid homeroomClassId pointing to a class that has 'Belum Ditentukan'
      if (teacher.homeroomClassId && classByIdMap.has(teacher.homeroomClassId)) {
        const targetClass = classByIdMap.get(teacher.homeroomClassId)!;
        if (!targetClass.homeroomTeacher || targetClass.homeroomTeacher === 'Belum Ditentukan') {
          targetClass.homeroomTeacher = teacher.name;
          classesChanged = true;
          classByTeacherNameMap.set(teacherNameKey, targetClass);
          return teacher;
        }
      }

      // If teacher was marked as WALI_KELAS or still has homeroomClassId but no class assigned, clean up
      if (teacher.additionalDuty === 'WALI_KELAS' || teacher.homeroomClassId || teacher.homeroomClassName) {
        teachersChanged = true;
        return {
          ...teacher,
          additionalDuty: teacher.additionalDuty === 'WALI_KELAS' ? 'TIDAK_ADA' : teacher.additionalDuty,
          homeroomClassId: undefined,
          homeroomClassName: undefined,
        };
      }
      return teacher;
    }
  });

  // Auto-heal: Pastikan seluruh guru yang ditugaskan sebagai Wali Kelas di Kelola Kelas terdaftar di daftar Guru
  classByTeacherNameMap.forEach((assignedClass, teacherNameKey) => {
    // Check if teacher already exists by exact name, partial name, or Sigit detection
    const isSigitClass = teacherNameKey.includes('sigit');
    const existingTeacher = updatedTeachers.find(t => {
      const tName = (t.name || '').trim().toLowerCase();
      if (tName === teacherNameKey) return true;
      if (isSigitClass && (tName.includes('sigit') || t.id === 'tch-1788148298202' || t.nip === '198107232014061004')) return true;
      if (tName.includes(teacherNameKey) || teacherNameKey.includes(tName)) return true;
      return false;
    });

    if (existingTeacher) {
      if (existingTeacher.homeroomClassId !== assignedClass.id || existingTeacher.additionalDuty !== 'WALI_KELAS') {
        existingTeacher.additionalDuty = 'WALI_KELAS';
        existingTeacher.homeroomClassId = assignedClass.id;
        existingTeacher.homeroomClassName = assignedClass.name;
        teachersChanged = true;
      }
      return;
    }

    if (assignedClass.homeroomTeacher && assignedClass.homeroomTeacher !== 'Belum Ditentukan') {
      const idAlreadyUsed = updatedTeachers.some(t => t.id === 'tch-1788148298202');
      const newTeacher: Teacher = {
        id: (isSigitClass && !idAlreadyUsed) ? 'tch-1788148298202' : ('tch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)),
        name: assignedClass.homeroomTeacher,
        nip: isSigitClass ? '198107232014061004' : ('1985' + String(Date.now()).slice(-8)),
        birthPlace: isSigitClass ? 'Tanjung' : 'Indonesia',
        birthDate: isSigitClass ? '1981-07-23' : '1985-01-01',
        subject1: isSigitClass ? 'IPA' : 'Guru Mata Pelajaran',
        additionalDuty: 'WALI_KELAS',
        homeroomClassId: assignedClass.id,
        homeroomClassName: assignedClass.name,
        phone: isSigitClass ? '087864360253' : '',
        gender: 'L',
        status: 'AKTIF',
        password: '123456'
      };
      updatedTeachers.push(newTeacher);
      teachersChanged = true;
    }
  });

  const finalTeachers = deduplicateTeachers(updatedTeachers);
  if (finalTeachers.length !== updatedTeachers.length) {
    teachersChanged = true;
  }

  return {
    updatedTeachers: finalTeachers,
    updatedClasses: classesCopy,
    teachersChanged,
    classesChanged
  };
}

export function isRealAttendance(rec?: AttendanceRecord | null): boolean {
  if (!rec) return false;
  // If return scan happened, it's definitely real
  if (rec.returnTime && rec.returnTime !== '-') return true;
  // If QR code was scanned, it's definitely real
  if (rec.method === 'QR_SCAN') return true;
  // If status is not ALPA, it's a real status (HADIR, TERLAMBAT, SAKIT, IZIN, DISPENSASI, etc.)
  if (rec.status && rec.status !== 'ALPA') return true;
  // If it is explicitly marked as auto-alpa, it's NOT a real scan
  if (
    rec.id?.startsWith('att-autoalpa-') ||
    rec.scannedBy?.includes('Sistem Otomatis') ||
    rec.scannedBy?.includes('Batas Alpa') ||
    rec.notes?.includes('Otomatis Alpa')
  ) {
    return false;
  }
  // Otherwise, only real if non-alpa or time is present
  return rec.status !== 'ALPA' || (!!rec.time && rec.time !== '-');
}

export function mergeSingleAttendanceRecord(a: AttendanceRecord, b: AttendanceRecord): AttendanceRecord {
  const isRealA = isRealAttendance(a);
  const isRealB = isRealAttendance(b);

  // 1. Evaluasi Waktu Masuk (Entry Time):
  // Jika salah satu memiliki jam scan masuk valid (bukan '-'), pertahankan jam tersebut.
  const getEntryTime = (): string => {
    const aValid = !!(a.time && a.time !== '-' && a.time.trim() && !a.time.toLowerCase().includes('belum'));
    const bValid = !!(b.time && b.time !== '-' && b.time.trim() && !b.time.toLowerCase().includes('belum'));
    if (aValid && bValid) {
      if (a.method === 'QR_SCAN' && b.method !== 'QR_SCAN') return a.time;
      if (b.method === 'QR_SCAN' && a.method !== 'QR_SCAN') return b.time;
      return a.time;
    }
    if (aValid) return a.time;
    if (bValid) return b.time;
    return '-';
  };

  // 2. Evaluasi Status Kehadiran (Status):
  // Siswa 1 di-scan Perangkat A (HADIR/TERLAMBAT) vs Perangkat B yang belum refresh (ALPA/-):
  // STATUS RIIL HASIL SCAN MUTLAK MENANG DAN TIDAK BOLEH DITIMPA OLEH ALPA!
  const getStatus = (): AttendanceRecord['status'] => {
    if (isRealA && !isRealB) return a.status || 'HADIR';
    if (!isRealA && isRealB) return b.status || 'HADIR';

    if (isRealA && isRealB) {
      if (a.method === 'QR_SCAN' && b.method !== 'QR_SCAN') return a.status || 'HADIR';
      if (b.method === 'QR_SCAN' && a.method !== 'QR_SCAN') return b.status || 'HADIR';
      if ((a.status === 'IZIN' || a.status === 'SAKIT') && (a.notes && a.notes.trim())) return a.status;
      if ((b.status === 'IZIN' || b.status === 'SAKIT') && (b.notes && b.notes.trim())) return b.status;
      return a.status || b.status || 'HADIR';
    }

    return 'ALPA';
  };

  // 3. Evaluasi Kepulangan (Return Scan):
  // Jangan pernah menghilangkan scan kepulangan jika Perangkat B scan pulang setelah Perangkat A scan datang!
  const getReturnInfo = () => {
    const isCompleted = (s?: string) => s === 'PULANG' || s === 'PULANG_CEPAT' || s === 'PULANG_TEPAT';
    const aHasReturn = !!(a.returnTime && a.returnTime !== '-' && a.returnTime.trim()) || isCompleted(a.returnStatus);
    const bHasReturn = !!(b.returnTime && b.returnTime !== '-' && b.returnTime.trim()) || isCompleted(b.returnStatus);

    let returnTime: string | undefined = undefined;
    let returnStatus: AttendanceRecord['returnStatus'] | undefined = undefined;
    let returnScannedBy: string | undefined = undefined;

    if (aHasReturn && !bHasReturn) {
      returnTime = (a.returnTime && a.returnTime !== '-') ? a.returnTime : undefined;
      returnStatus = a.returnStatus;
      returnScannedBy = a.returnScannedBy;
    } else if (!aHasReturn && bHasReturn) {
      returnTime = (b.returnTime && b.returnTime !== '-') ? b.returnTime : undefined;
      returnStatus = b.returnStatus;
      returnScannedBy = b.returnScannedBy;
    } else if (aHasReturn && bHasReturn) {
      returnTime = (a.returnTime && a.returnTime !== '-') ? a.returnTime : b.returnTime;
      returnStatus = isCompleted(a.returnStatus) ? a.returnStatus : (b.returnStatus || a.returnStatus);
      returnScannedBy = (a.returnScannedBy && !a.returnScannedBy.includes('Sistem Otomatis')) ? a.returnScannedBy : b.returnScannedBy;
    } else {
      returnStatus = a.returnStatus || b.returnStatus;
    }

    return { returnTime, returnStatus, returnScannedBy };
  };

  const finalTime = getEntryTime();
  const finalStatus = getStatus();
  const { returnTime, returnStatus, returnScannedBy } = getReturnInfo();

  const finalMethod = (a.method === 'QR_SCAN' || b.method === 'QR_SCAN') 
    ? 'QR_SCAN' 
    : (a.method || b.method || 'MANUAL');

  const finalScannedBy = (a.scannedBy && !a.scannedBy.includes('Sistem Otomatis')) 
    ? a.scannedBy 
    : ((b.scannedBy && !b.scannedBy.includes('Sistem Otomatis')) ? b.scannedBy : (a.scannedBy || b.scannedBy));

  const finalNotes = (a.notes && a.notes.trim()) ? a.notes : (b.notes || '');

  const merged: AttendanceRecord = {
    ...a,
    ...b,
    time: finalTime,
    status: finalStatus,
    method: finalMethod,
    scannedBy: finalScannedBy,
    notes: finalNotes,
    returnTime: returnTime || undefined,
    returnStatus: returnStatus || undefined,
    returnScannedBy: returnScannedBy || undefined,
  };

  if ((finalStatus === 'HADIR' || finalStatus === 'TERLAMBAT') && (!merged.time || merged.time === '-')) {
    merged.time = finalTime && finalTime !== '-' ? finalTime : '07:00';
  }

  return merged;
}

export function mergeAttendanceLists(listA: AttendanceRecord[], listB: AttendanceRecord[]): AttendanceRecord[] {
  const cleanA = validateAndSanitizeAttendanceRecords(listA);
  const cleanB = validateAndSanitizeAttendanceRecords(listB);

  if (cleanA.length === 0) return cleanB;
  if (cleanB.length === 0) return cleanA;

  const recordsList: AttendanceRecord[] = [];
  const indexById = new Map<string, number>();
  const indexByStudentDate = new Map<string, number>();
  const indexByNisnDate = new Map<string, number>();

  const registerIndices = (idx: number, rec: AttendanceRecord) => {
    if (rec.id) indexById.set(rec.id, idx);
    if (rec.date && rec.studentId) indexByStudentDate.set(`${rec.date}__${rec.studentId}`, idx);
    if (rec.date && rec.nisn) indexByNisnDate.set(`${rec.date}__${rec.nisn}`, idx);
  };

  const findIndexForRecord = (rec: AttendanceRecord): number => {
    if (rec.id && indexById.has(rec.id)) {
      return indexById.get(rec.id)!;
    }
    if (rec.date && rec.studentId && indexByStudentDate.has(`${rec.date}__${rec.studentId}`)) {
      return indexByStudentDate.get(`${rec.date}__${rec.studentId}`)!;
    }
    if (rec.date && rec.nisn && indexByNisnDate.has(`${rec.date}__${rec.nisn}`)) {
      return indexByNisnDate.get(`${rec.date}__${rec.nisn}`)!;
    }
    return -1;
  };

  // 1. Tambahkan semua record dari listA (O(N))
  for (let i = 0; i < cleanA.length; i++) {
    const item = cleanA[i];
    if (!item) continue;
    const idx = findIndexForRecord(item);
    if (idx >= 0) {
      recordsList[idx] = mergeSingleAttendanceRecord(recordsList[idx], item);
      registerIndices(idx, recordsList[idx]);
    } else {
      const newIdx = recordsList.length;
      recordsList.push({ ...item });
      registerIndices(newIdx, item);
    }
  }

  // 2. Gabungkan semua record dari listB (O(M)) - Perangkat A & B tidak saling tindih
  for (let i = 0; i < cleanB.length; i++) {
    const item = cleanB[i];
    if (!item) continue;
    const idx = findIndexForRecord(item);
    if (idx >= 0) {
      recordsList[idx] = mergeSingleAttendanceRecord(recordsList[idx], item);
      registerIndices(idx, recordsList[idx]);
    } else {
      const newIdx = recordsList.length;
      recordsList.push({ ...item });
      registerIndices(newIdx, item);
    }
  }

  return validateAndSanitizeAttendanceRecords(recordsList);
}

export function mergeGenericListsById<T extends { id: string }>(local: T[], cloud: T[]): T[] {
  const map = new Map<string, T>();
  cloud.forEach(item => map.set(item.id, item));
  local.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
}

// Merge SchoolProfile ensuring all subjects from both devices are preserved (union)
export function mergeSchoolProfile(local: SchoolProfile, cloud: SchoolProfile): SchoolProfile {
  const subjectsSet = new Set<string>();

  // Collect subjects from cloud
  if (cloud.subjects && Array.isArray(cloud.subjects)) {
    cloud.subjects.forEach(s => {
      if (s && typeof s === 'string' && s.trim()) {
        subjectsSet.add(s.trim());
      }
    });
  }

  // Collect subjects from local
  if (local.subjects && Array.isArray(local.subjects)) {
    local.subjects.forEach(s => {
      if (s && typeof s === 'string' && s.trim()) {
        subjectsSet.add(s.trim());
      }
    });
  }

  // Default fallback if no subjects exist
  if (subjectsSet.size === 0) {
    (INITIAL_SCHOOL_PROFILE.subjects || ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PJOK', 'Seni Budaya', 'Informatika', 'PPKn']).forEach(s => subjectsSet.add(s));
  }

  const mergedSubjects = Array.from(subjectsSet);

  return {
    ...INITIAL_SCHOOL_PROFILE,
    ...local,
    ...cloud,
    adminPassword: cloud.adminPassword || local.adminPassword || INITIAL_SCHOOL_PROFILE.adminPassword || 'admin123',
    scannerPassword: cloud.scannerPassword || local.scannerPassword || INITIAL_SCHOOL_PROFILE.scannerPassword || '123456',
    subjects: mergedSubjects,
    holidays: (cloud.holidays && Array.isArray(cloud.holidays) && cloud.holidays.length > 0) ? cloud.holidays : (local.holidays || []),
    activeDays: (cloud.activeDays && Array.isArray(cloud.activeDays) && cloud.activeDays.length > 0) ? cloud.activeDays : (local.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']),
    startTime: cloud.startTime || local.startTime || INITIAL_SCHOOL_PROFILE.startTime,
    endTime: cloud.endTime || local.endTime || INITIAL_SCHOOL_PROFILE.endTime,
    dailyEndTimes: {
      ...(INITIAL_SCHOOL_PROFILE.dailyEndTimes || {}),
      ...(local.dailyEndTimes || {}),
      ...(cloud.dailyEndTimes || {})
    },
    autoAlpaTime: cloud.autoAlpaTime || local.autoAlpaTime || INITIAL_SCHOOL_PROFILE.autoAlpaTime,
    autoAlpaEnabled: typeof cloud.autoAlpaEnabled === 'boolean'
      ? cloud.autoAlpaEnabled
      : (typeof local.autoAlpaEnabled === 'boolean' ? local.autoAlpaEnabled : (INITIAL_SCHOOL_PROFILE.autoAlpaEnabled !== false)),
    autoCharacterAssessmentEnabled: typeof cloud.autoCharacterAssessmentEnabled === 'boolean'
      ? cloud.autoCharacterAssessmentEnabled
      : (typeof local.autoCharacterAssessmentEnabled === 'boolean' ? local.autoCharacterAssessmentEnabled : (INITIAL_SCHOOL_PROFILE.autoCharacterAssessmentEnabled !== false)),
    autoCharacterPoints: {
      ...(INITIAL_SCHOOL_PROFILE.autoCharacterPoints || {
        latePoints: 2,
        alpaPoints: 5,
        disruptivePoints: 1,
        absentKbmPoints: 2,
        veryActiveKbmPoints: 1,
        onTimePoints: 1,
        onTimeRequiredDays: 3,
        unscannedPoints: 2,
        unreturnedPoints: 2,
      }),
      ...(local.autoCharacterPoints || {}),
      ...(cloud.autoCharacterPoints || {}),
    },
    lateToleranceMinutes: typeof cloud.lateToleranceMinutes === 'number' ? cloud.lateToleranceMinutes : (typeof local.lateToleranceMinutes === 'number' ? local.lateToleranceMinutes : (INITIAL_SCHOOL_PROFILE.lateToleranceMinutes ?? 15)),
    parentPortalLoginEnabled: typeof cloud.parentPortalLoginEnabled === 'boolean'
      ? cloud.parentPortalLoginEnabled
      : (typeof local.parentPortalLoginEnabled === 'boolean' ? local.parentPortalLoginEnabled : (INITIAL_SCHOOL_PROFILE.parentPortalLoginEnabled !== false)),
    parentPortalScheduleEnabled: typeof cloud.parentPortalScheduleEnabled === 'boolean'
      ? cloud.parentPortalScheduleEnabled
      : (typeof local.parentPortalScheduleEnabled === 'boolean' ? local.parentPortalScheduleEnabled : false),
    parentPortalOpenTime: cloud.parentPortalOpenTime || local.parentPortalOpenTime || INITIAL_SCHOOL_PROFILE.parentPortalOpenTime || '06:00',
    parentPortalCloseTime: cloud.parentPortalCloseTime || local.parentPortalCloseTime || INITIAL_SCHOOL_PROFILE.parentPortalCloseTime || '18:00',
    parentPortalDisabledNotice: cloud.parentPortalDisabledNotice || local.parentPortalDisabledNotice || INITIAL_SCHOOL_PROFILE.parentPortalDisabledNotice || 'Akses login untuk wali murid saat ini sedang dinonaktifkan oleh Administrator Sekolah. Silakan hubungi pihak sekolah atau coba kembali nanti.',
    parentPortalForceLogoutTimestamp: Math.max(Number(cloud.parentPortalForceLogoutTimestamp) || 0, Number(local.parentPortalForceLogoutTimestamp) || 0),
  };
}

// Comprehensive multi-device smart synchronization (Concurrent & High-Speed)
export async function smartSyncAndMergeAllWithCloud(isInitialBoot: boolean = false): Promise<{ success: boolean; studentCount: number; message: string }> {
  try {
    setCloudSyncStatus('syncing');

    // 1. Fetch all cloud documents simultaneously with timeout protection (under 3s)
    const [
      profileCloud,
      studentCloud,
      classCloud,
      teacherCloud,
      attCloud,
      leavesCloud,
      journalsCloud,
      traitsCloud,
      logsCloud,
      predicatesCloud,
      gradesCloud,
      periodsCloud,
      schedulesCloud,
    ] = await Promise.all([
      readCloudDocument(KEYS.PROFILE),
      readCloudDocument(KEYS.STUDENTS),
      readCloudDocument(KEYS.CLASSES),
      readCloudDocument(KEYS.TEACHERS),
      readCloudDocument(KEYS.ATTENDANCE),
      readCloudDocument(KEYS.LEAVES),
      readCloudDocument(KEYS.LEARNING_JOURNALS),
      readCloudDocument(KEYS.CHARACTER_TRAITS),
      readCloudDocument(KEYS.CHARACTER_LOGS),
      readCloudDocument(KEYS.CHARACTER_PREDICATES),
      readCloudDocument(KEYS.GRADES),
      readCloudDocument(KEYS.PERIODS),
      readCloudDocument(KEYS.SCHEDULES),
    ]);

    const now = Date.now();

    // Catat timestamp lokal SEBELUM proses merge agar dapat membedakan perubahan asli pengguna vs sinkronisasi cloud
    const ALL_SYNC_KEYS = [
      KEYS.PROFILE, KEYS.STUDENTS, KEYS.CLASSES, KEYS.TEACHERS,
      KEYS.ATTENDANCE, KEYS.LEAVES, KEYS.LEARNING_JOURNALS,
      KEYS.CHARACTER_TRAITS, KEYS.CHARACTER_LOGS, KEYS.CHARACTER_PREDICATES,
      KEYS.GRADES, KEYS.PERIODS, KEYS.SCHEDULES
    ];
    const prevLocalTimestamps: Record<string, number> = {};
    ALL_SYNC_KEYS.forEach(k => {
      prevLocalTimestamps[k] = Number(localStorage.getItem(k + '_updatedAt') || '0');
    });

    // 2. In-Memory Merging - Step A: Profile
    const currentLocalProfile = getSchoolProfile();
    let mergedProfile = currentLocalProfile;
    if (profileCloud && profileCloud.data) {
      try {
        const cloudProfileData = typeof profileCloud.data === 'string' ? JSON.parse(profileCloud.data) : profileCloud.data;
        mergedProfile = mergeSchoolProfile(currentLocalProfile, cloudProfileData);
      } catch (e) {
        console.warn('[Sync] Profile parse error:', e);
      }
    }
    const profileStr = JSON.stringify(mergedProfile);
    const profileUpdatedAt = Math.max(Number(profileCloud?.updatedAt || 0), prevLocalTimestamps[KEYS.PROFILE] || 0);
    safeSetLocalStorage(KEYS.PROFILE, profileStr);
    safeSetLocalStorage(KEYS.PROFILE + '_updatedAt', String(profileUpdatedAt));

    // Step B: Students & Photo Sanitization
    let cloudStudents: Student[] = [];
    if (studentCloud && studentCloud.data) {
      try {
        cloudStudents = JSON.parse(studentCloud.data);
      } catch (e) {
        console.warn('[Sync] Student parse error:', e);
      }
    }
    const currentLocalStudents = getStudents();
    const mergedStudents = mergeStudentLists(currentLocalStudents, cloudStudents);
    const optimizedStudents = await sanitizeAndCompressStudentPhotos(mergedStudents);
    const studentsJsonStr = JSON.stringify(optimizedStudents);
    const studentUpdatedAt = Math.max(Number(studentCloud?.updatedAt || 0), prevLocalTimestamps[KEYS.STUDENTS] || 0);
    safeSetLocalStorage(KEYS.STUDENTS, studentsJsonStr);
    safeSetLocalStorage(KEYS.STUDENTS + '_updatedAt', String(studentUpdatedAt));

    // Step C: Classes & Teachers
    let cloudClasses: SchoolClass[] = [];
    if (classCloud && classCloud.data) {
      try {
        cloudClasses = JSON.parse(classCloud.data);
      } catch {}
    }
    const currentLocalClasses = getSchoolClasses();
    const mergedClasses = mergeClassLists(currentLocalClasses, cloudClasses);

    let cloudTeachers: Teacher[] = [];
    if (teacherCloud && teacherCloud.data) {
      try {
        cloudTeachers = JSON.parse(teacherCloud.data);
      } catch {}
    }
    const currentLocalTeachers = getTeachers();
    const mergedTeachers = mergeTeacherLists(currentLocalTeachers, cloudTeachers);

    const reconciled = reconcileTeachersAndClasses(mergedTeachers, mergedClasses);
    const finalClasses = reconciled.updatedClasses;
    const finalTeachers = reconciled.updatedTeachers;

    const classesJsonStr = JSON.stringify(finalClasses);
    const teachersJsonStr = JSON.stringify(finalTeachers);
    const classUpdatedAt = Math.max(Number(classCloud?.updatedAt || 0), prevLocalTimestamps[KEYS.CLASSES] || 0);
    const teacherUpdatedAt = Math.max(Number(teacherCloud?.updatedAt || 0), prevLocalTimestamps[KEYS.TEACHERS] || 0);
    safeSetLocalStorage(KEYS.CLASSES, classesJsonStr);
    safeSetLocalStorage(KEYS.CLASSES + '_updatedAt', String(classUpdatedAt));
    safeSetLocalStorage(KEYS.TEACHERS, teachersJsonStr);
    safeSetLocalStorage(KEYS.TEACHERS + '_updatedAt', String(teacherUpdatedAt));

    // Step D: Attendance Records (Cloud Authoritative)
    let cloudAtt: AttendanceRecord[] = [];
    if (attCloud && attCloud.data) {
      try {
        const parsed = typeof attCloud.data === 'string' ? JSON.parse(attCloud.data) : attCloud.data;
        if (Array.isArray(parsed)) {
          cloudAtt = validateAndSanitizeAttendanceRecords(parsed);
        }
      } catch (e) {
        console.warn('[Sync] Attendance cloud parse error:', e);
      }
    }

    // Step D: Attendance Merging (Anti-Tindih & Anti-Kosong)
    const currentLocalAtt = getAttendanceRecords();
    let finalAtt: AttendanceRecord[] = [];

    if (cloudAtt.length > 0 && currentLocalAtt.length > 0) {
      // Gabungkan non-destruktif: seluruh scan dari Cloud dan Lokal menyatu 100%
      finalAtt = validateAndSanitizeAttendanceRecords(mergeAttendanceLists(cloudAtt, currentLocalAtt));
    } else if (cloudAtt.length > 0) {
      finalAtt = cloudAtt;
    } else if (currentLocalAtt.length > 0) {
      finalAtt = currentLocalAtt;
      if (!isInitialBoot) {
        writeCloudDocument(KEYS.ATTENDANCE, JSON.stringify(finalAtt), now);
      }
    } else {
      // Jika keduanya kosong dan demo data belum pernah sengaja dihapus admin, pulihkan data presensi
      const isDemoCleared = typeof window !== 'undefined' && localStorage.getItem(DEMO_DATA_CLEARED_KEY) === 'true';
      if (!isDemoCleared) {
        const activeStudents = getStudents();
        const initial = generateInitialAttendanceHistory(activeStudents.length > 0 ? activeStudents : INITIAL_STUDENTS);
        finalAtt = validateAndSanitizeAttendanceRecords(initial);
      }
    }

    const attUpdatedAt = Math.max(Number(attCloud?.updatedAt || 0), prevLocalTimestamps[KEYS.ATTENDANCE] || 0, now);
    const attJsonStr = JSON.stringify(finalAtt);
    safeSetLocalStorage(KEYS.ATTENDANCE, attJsonStr);
    safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(attUpdatedAt));

    // Step E: Generic Entity Merging
    const mergeAndStoreGeneric = (key: string, cloudDoc: any, getLocal: () => any[]) => {
      let cloudItems: any[] = [];
      if (cloudDoc && cloudDoc.data) {
        try {
          cloudItems = typeof cloudDoc.data === 'string' ? JSON.parse(cloudDoc.data) : cloudDoc.data;
        } catch {}
      }

      const prevTs = prevLocalTimestamps[key] || 0;
      const cloudTs = Number(cloudDoc?.updatedAt || 0);
      const finalTs = Math.max(cloudTs, prevTs);

      // CLOUD AUTHORITATIVE UNTUK CATATAN KARAKTER:
      // Seluruh perangkat membaca dan menampilkan nilai karakter langsung dari Cloud.
      // Dilarang keras menggabungkan data lokal lama yang menyebabkan log terhapus muncul kembali.
      if (key === KEYS.CHARACTER_LOGS) {
        const deletedIds = getDeletedCharacterLogIds();
        if (Array.isArray(cloudItems) && (cloudItems.length > 0 || cloudDoc?.updatedAt)) {
          const cleanCloud = deduplicateCharacterLogs(
            repairKbmActiveLogs(repairUpacaraLogs(cloudItems).repairedLogs).repairedLogs
          ).filter((l: any) => l && l.id && !deletedIds.has(String(l.id).trim()));

          const jsonStr = JSON.stringify(cleanCloud);
          safeSetLocalStorage(key, jsonStr);
          safeSetLocalStorage(key + '_updatedAt', String(finalTs));
          return jsonStr;
        }
      }

      const localItems = getLocal();
      let merged = mergeGenericListsById(localItems, cloudItems);
      if (key === KEYS.CHARACTER_LOGS) {
        const deletedIds = getDeletedCharacterLogIds();
        if (deletedIds.size > 0) {
          merged = merged.filter((l: any) => l && l.id && !deletedIds.has(String(l.id).trim()));
        }
      }
      const jsonStr = JSON.stringify(merged);
      safeSetLocalStorage(key, jsonStr);
      safeSetLocalStorage(key + '_updatedAt', String(finalTs));
      return jsonStr;
    };

    const leavesJsonStr = mergeAndStoreGeneric(KEYS.LEAVES, leavesCloud, getLeaveRequests);
    const journalsJsonStr = mergeAndStoreGeneric(KEYS.LEARNING_JOURNALS, journalsCloud, getLearningJournals);
    const traitsJsonStr = mergeAndStoreGeneric(KEYS.CHARACTER_TRAITS, traitsCloud, getCharacterTraits);
    const logsJsonStr = mergeAndStoreGeneric(KEYS.CHARACTER_LOGS, logsCloud, getStudentCharacterLogs);
    const gradesJsonStr = mergeAndStoreGeneric(KEYS.GRADES, gradesCloud, getStudentGradeAssessments);
    const periodsJsonStr = mergeAndStoreGeneric(KEYS.PERIODS, periodsCloud, getLessonPeriods);
    const schedulesJsonStr = mergeAndStoreGeneric(KEYS.SCHEDULES, schedulesCloud, getClassSchedules);

    let cloudPredicates = null;
    if (predicatesCloud && predicatesCloud.data) {
      try {
        cloudPredicates = typeof predicatesCloud.data === 'string' ? JSON.parse(predicatesCloud.data) : predicatesCloud.data;
      } catch {}
    }
    const localPredicates = getCharacterPredicateSettings();
    const mergedPredicates = { ...INITIAL_CHARACTER_PREDICATES, ...localPredicates, ...(cloudPredicates || {}) };
    const predicatesJsonStr = JSON.stringify(mergedPredicates);
    const predicatesUpdatedAt = Math.max(Number(predicatesCloud?.updatedAt || 0), prevLocalTimestamps[KEYS.CHARACTER_PREDICATES] || 0);
    safeSetLocalStorage(KEYS.CHARACTER_PREDICATES, predicatesJsonStr);
    safeSetLocalStorage(KEYS.CHARACTER_PREDICATES + '_updatedAt', String(predicatesUpdatedAt));

    // Update local cache & notify UI instantly
    lastSavedStringCache[KEYS.PROFILE] = profileStr;
    lastSavedStringCache[KEYS.STUDENTS] = studentsJsonStr;
    lastSavedStringCache[KEYS.CLASSES] = classesJsonStr;
    lastSavedStringCache[KEYS.TEACHERS] = teachersJsonStr;
    lastSavedStringCache[KEYS.ATTENDANCE] = attJsonStr;
    lastSavedStringCache[KEYS.LEAVES] = leavesJsonStr;
    lastSavedStringCache[KEYS.LEARNING_JOURNALS] = journalsJsonStr;
    lastSavedStringCache[KEYS.CHARACTER_TRAITS] = traitsJsonStr;
    lastSavedStringCache[KEYS.CHARACTER_LOGS] = logsJsonStr;
    lastSavedStringCache[KEYS.CHARACTER_PREDICATES] = predicatesJsonStr;
    lastSavedStringCache[KEYS.GRADES] = gradesJsonStr;
    lastSavedStringCache[KEYS.PERIODS] = periodsJsonStr;
    lastSavedStringCache[KEYS.SCHEDULES] = schedulesJsonStr;

    notifyStorageUpdated();

    // 3. Selectively Push Only Keys that Actually Changed Back to Cloud (avoids write stream flooding)
    // PENGHEMAT KUOTA: Saat buka awal atau refresh halaman (isInitialBoot === true), DILARANG menulis balik ke Cloud!
    // Hanya flush antrean scan pending jika ada.
    if (!isFirestoreQuotaExceeded() && !isInitialBoot) {
      const writePromises: Promise<void>[] = [];
      const pushIfChanged = (key: string, localStr: string, cloudDoc: any) => {
        const cloudStr = cloudDoc?.data;
        if (!localStr) return;
        
        // Hanya tulis ke Cloud jika:
        // 1. Cloud masih kosong sama sekali tapi lokal punya data, ATAU
        // 2. Data presensi dan ada antrean scan pending, ATAU
        // 3. Timestamp lokal SEBELUM proses merge terbukti lebih baru daripada Cloud (ada perubahan nyata dari user perangkat ini)
        const cloudUpdatedAt = Number(cloudDoc?.updatedAt || 0);
        const prevLocalUpdatedAt = prevLocalTimestamps[key] || 0;
        const isCloudEmpty = !cloudStr || cloudStr === '[]' || cloudStr === '{}';
        const hasPendingScans = key === KEYS.ATTENDANCE && scanQueuePendingCount > 0;
        const isLocallyModified = prevLocalUpdatedAt > (cloudUpdatedAt + 1000);

        if ((isCloudEmpty && localStr !== '[]' && localStr !== '{}') || hasPendingScans || isLocallyModified) {
          if (localStr !== cloudStr) {
            writePromises.push(writeCloudDocument(key, localStr, now));
          }
        }
      };

      pushIfChanged(KEYS.PROFILE, profileStr, profileCloud);
      pushIfChanged(KEYS.STUDENTS, studentsJsonStr, studentCloud);
      pushIfChanged(KEYS.CLASSES, classesJsonStr, classCloud);
      pushIfChanged(KEYS.TEACHERS, teachersJsonStr, teacherCloud);
      pushIfChanged(KEYS.ATTENDANCE, attJsonStr, attCloud);
      pushIfChanged(KEYS.LEAVES, leavesJsonStr, leavesCloud);
      pushIfChanged(KEYS.LEARNING_JOURNALS, journalsJsonStr, journalsCloud);
      pushIfChanged(KEYS.CHARACTER_TRAITS, traitsJsonStr, traitsCloud);
      pushIfChanged(KEYS.CHARACTER_LOGS, logsJsonStr, logsCloud);
      pushIfChanged(KEYS.CHARACTER_PREDICATES, predicatesJsonStr, predicatesCloud);
      pushIfChanged(KEYS.GRADES, gradesJsonStr, gradesCloud);
      pushIfChanged(KEYS.PERIODS, periodsJsonStr, periodsCloud);
      pushIfChanged(KEYS.SCHEDULES, schedulesJsonStr, schedulesCloud);

      if (writePromises.length > 0) {
        await Promise.allSettled(writePromises);
      }
    } else if (scanQueuePendingCount > 0) {
      // Saat booting awal, cukup flush antrean scan pending yang tersimpan offline
      flushAttendanceScanQueue(true);
    }

    // Reset scan queue since all attendance is completely synchronized
    scanQueuePendingCount = 0;
    scanQueueCountdownSeconds = 0;
    notifyScanQueueChanged();

    if (isFirestoreQuotaExceeded()) {
      setCloudSyncStatus('quota_exceeded');
    } else {
      setCloudSyncStatus('connected');
    }

    return {
      success: true,
      studentCount: optimizedStudents.length,
      message: `Berhasil menyinkronkan! Total ${optimizedStudents.length} siswa dan seluruh data sekolah sekarang tersinkron di Cloud dan semua perangkat.`
    };
  } catch (err: any) {
    console.error('[Smart Sync Error]:', err);
    setCloudSyncStatus('offline');
    return {
      success: false,
      studentCount: getStudents().length,
      message: `Gagal sinkronisasi: ${err?.message || 'Periksa koneksi internet.'}`
    };
  }
}

let isAutoSyncRunning = false;
let lastAutoSyncTime = 0;

/**
 * Otomatis menangani status saat perangkat terhubung online kembali
 * PENGHEMAT KUOTA: HANYA flush antrean scan pending offline, JANGAN baca 13 dokumen kembali!
 */
export async function triggerAutoSyncOnOnline(silent: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Jika koneksi fisik terdeteksi offline, abaikan
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setCloudSyncStatus('offline');
    return false;
  }

  setCloudSyncStatus('connected');

  // PENGHEMAT KUOTA: Saat online kembali, jika ada antrean scan pending, kirim segera ke Cloud
  if (scanQueuePendingCount > 0) {
    try {
      await flushAttendanceScanQueue(true);
      if (!silent) {
        window.dispatchEvent(new CustomEvent('sihadir_network_toast', {
          detail: {
            type: 'success',
            title: '✅ Antrean Scan Terkirim',
            message: 'Perangkat online kembali. Seluruh antrean scan offline berhasil diunggah ke Cloud.'
          }
        }));
      }
    } catch {}
  }
  return true;
}

// Upload all local data to Cloud database (Parallelized)
export async function forceUploadAllToCloud(): Promise<{ success: boolean; error?: string; studentCount?: number; attendanceCount?: number }> {
  try {
    resetFirestoreQuotaCooldown();
    setCloudSyncStatus('syncing');
    const ALL_KEYS = [
      KEYS.PROFILE,
      KEYS.CLASSES,
      KEYS.STUDENTS,
      KEYS.ATTENDANCE,
      KEYS.LEAVES,
      KEYS.TEACHERS,
      KEYS.LEARNING_JOURNALS,
      KEYS.CHARACTER_TRAITS,
      KEYS.CHARACTER_LOGS,
      KEYS.CHARACTER_PREDICATES,
      KEYS.GRADES,
      KEYS.PERIODS,
      KEYS.SCHEDULES,
    ];

    const now = Date.now();
    const writePromises = ALL_KEYS.map(async (key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        lastSavedStringCache[key] = raw;
        await writeCloudDocument(key, raw, now);
      }
    });

    await Promise.all(writePromises);
    setCloudSyncStatus('connected');
    const stdCount = getStudents().length;
    const attCount = getAttendanceRecords().length;
    return { success: true, studentCount: stdCount, attendanceCount: attCount };
  } catch (err: any) {
    console.error('[Force Upload Cloud Error]', err);
    setCloudSyncStatus('offline');
    return { success: false, error: err?.message || 'Gagal mengunggah ke Cloud' };
  }
}

// Download latest data from Cloud database (Parallelized)
export async function forceDownloadAllFromCloud(): Promise<{ success: boolean; error?: string; studentCount?: number; attendanceCount?: number; downloadedCount?: number }> {
  try {
    resetFirestoreQuotaCooldown();
    setCloudSyncStatus('syncing');
    const ALL_KEYS = [
      KEYS.PROFILE,
      KEYS.CLASSES,
      KEYS.STUDENTS,
      KEYS.ATTENDANCE,
      KEYS.LEAVES,
      KEYS.TEACHERS,
      KEYS.LEARNING_JOURNALS,
      KEYS.CHARACTER_TRAITS,
      KEYS.CHARACTER_LOGS,
      KEYS.CHARACTER_PREDICATES,
      KEYS.GRADES,
      KEYS.PERIODS,
      KEYS.SCHEDULES,
    ];

    const results = await Promise.all(ALL_KEYS.map((key) => readCloudDocument(key)));
    let updatedCount = 0;

    results.forEach((cloudDoc, idx) => {
      const key = ALL_KEYS[idx];
      if (cloudDoc && cloudDoc.data) {
        if (key === KEYS.PROFILE) {
          try {
            const cloudP = JSON.parse(cloudDoc.data);
            const localP = getSchoolProfile();
            const mergedP = mergeSchoolProfile(localP, cloudP);
            const mergedStr = JSON.stringify(mergedP);
            safeSetLocalStorage(key, mergedStr);
            safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = mergedStr;
          } catch {
            safeSetLocalStorage(key, cloudDoc.data);
            safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = cloudDoc.data;
          }
        } else if (key === KEYS.TEACHERS) {
          try {
            const cloudTeachers = JSON.parse(cloudDoc.data);
            if (Array.isArray(cloudTeachers)) {
              const localTeachers = getTeachers();
              const mergedTeachers = mergeTeacherLists(localTeachers, cloudTeachers);
              const mergedStr = JSON.stringify(mergedTeachers);
              safeSetLocalStorage(key, mergedStr);
              safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = mergedStr;
            } else {
              safeSetLocalStorage(key, cloudDoc.data);
              safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = cloudDoc.data;
            }
          } catch {
            safeSetLocalStorage(key, cloudDoc.data);
            safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = cloudDoc.data;
          }
        } else if (key === KEYS.STUDENTS) {
          try {
            const cloudStudents = JSON.parse(cloudDoc.data);
            if (Array.isArray(cloudStudents)) {
              const localStudents = getStudents();
              const mergedStudents = mergeStudentLists(localStudents, cloudStudents);
              const mergedStr = JSON.stringify(mergedStudents);
              safeSetLocalStorage(key, mergedStr);
              safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = mergedStr;
            } else {
              safeSetLocalStorage(key, cloudDoc.data);
              safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = cloudDoc.data;
            }
          } catch {
            safeSetLocalStorage(key, cloudDoc.data);
            safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = cloudDoc.data;
          }
        } else if (key === KEYS.ATTENDANCE) {
          try {
            const parsed = typeof cloudDoc.data === 'string' ? JSON.parse(cloudDoc.data) : cloudDoc.data;
            if (Array.isArray(parsed)) {
              const cleanCloud = validateAndSanitizeAttendanceRecords(parsed);
              if (cleanCloud.length === 0 && !cloudDoc.updatedAt) {
                const localAtt = getAttendanceRecords();
                if (localAtt.length > 0) {
                  writeCloudDocument(key, JSON.stringify(localAtt), Date.now());
                  lastSavedStringCache[key] = JSON.stringify(localAtt);
                }
              } else {
                let finalAtt = cleanCloud;
                if (scanQueuePendingCount > 0) {
                  const localAtt = getAttendanceRecords();
                  finalAtt = validateAndSanitizeAttendanceRecords(mergeAttendanceLists(localAtt, cleanCloud));
                  writeCloudDocument(key, JSON.stringify(finalAtt), Date.now());
                }
                const cleanStr = JSON.stringify(finalAtt);
                safeSetLocalStorage(key, cleanStr);
                safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
                lastSavedStringCache[key] = cleanStr;
              }
            }
          } catch (e) {
            console.warn('[Storage] Gagal memuat attendance records dari cloud:', e);
          }
        } else {
          safeSetLocalStorage(key, cloudDoc.data);
          safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
          lastSavedStringCache[key] = cloudDoc.data;
        }
        updatedCount++;
      }
    });

    if (updatedCount === 0) {
      if (isFirestoreQuotaExceeded()) {
        setCloudSyncStatus('quota_exceeded');
        return { 
          success: false, 
          error: 'Kuota baca harian gratis Cloud Firestore (Free daily read quota) pada project ini telah tercapai untuk hari ini. Kuota akan otomatis di-reset oleh Google besok. Anda tetap dapat mentransfer seluruh data antar-perangkat secara instan lewat menu "Ekspor Cadangan Lengkap (.json)".',
          downloadedCount: 0 
        };
      }
      setCloudSyncStatus('offline');
      return { 
        success: false, 
        error: 'Tidak ditemukan data di Cloud (Database Cloud masih kosong atau belum diunggah dari perangkat scan). Pastikan HP scanner sudah menekan "Upload Data Perangkat Ini" terlebih dahulu.',
        downloadedCount: 0 
      };
    }

    notifyStorageUpdated();
    setCloudSyncStatus('connected');
    const stdCount = getStudents().length;
    const attCount = getAttendanceRecords().length;
    return { success: true, studentCount: stdCount, attendanceCount: attCount, downloadedCount: updatedCount };
  } catch (err: any) {
    console.error('[Force Download Cloud Error]', err);
    setCloudSyncStatus('offline');
    return { success: false, error: err?.message || 'Gagal mengunduh dari Cloud' };
  }
}

// Stop and unsubscribe all active Firestore Realtime listeners
export function stopFirestoreRealtimeSync(): void {
  if (activeUnsubscribes.length > 0) {
    activeUnsubscribes.forEach(unsub => {
      try { unsub(); } catch {}
    });
    activeUnsubscribes = [];
  }
  isFirestoreInitialized = false;
}

export function isFirestoreSyncActive(): boolean {
  return isFirestoreInitialized;
}

const PARENT_SYNC_COOLDOWN_MS = 30 * 60 * 1000; // 30 menit cache cooldown sesuai instruksi pengguna
let lastParentRefreshTime = 0;

/**
 * PENGHEMAT KUOTA TERTINGGI: Sinkronisasi Sesuai Kebutuhan Khusus Akun Wali Murid (PARENT)
 * 1. Tidak memasang listener onSnapshot real-time streaming pada dokumen presensi/karakter (mencegah ledakan 50.000+ read saat ratusan siswa di-scan di gerbang).
 * 2. Menggunakan LocalStorage instan (0 read).
 * 3. Jika cache lokal kadaluarsa (> 30 menit) atau ditekan tombol segarkan, baru membaca dokumen terkait.
 * 4. 100% GRATIS dan menjamin kuota Firebase Spark/Blaze (50.000 read/hari) aman terlindungi.
 */
export async function syncParentDataOnDemand(force: boolean = false): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') return { success: false, message: 'SSR' };
  if (isFirestoreQuotaExceeded()) {
    setCloudSyncStatus('quota_exceeded');
    return { success: false, message: 'Batas kuota harian Firebase tercapai' };
  }

  const now = Date.now();
  const lastSyncStr = localStorage.getItem('sihadir_parent_last_sync') || '0';
  const lastSyncTime = Number(lastSyncStr) || 0;
  const timeSinceLastSync = now - lastSyncTime;

  // Cek apakah data dasar siswa sudah ada di perangkat ini
  const localStudentsStr = localStorage.getItem(KEYS.STUDENTS);
  const localProfileStr = localStorage.getItem(KEYS.PROFILE);
  const isFirstTimeBoot = !localStudentsStr || !localProfileStr || localStudentsStr === '[]';

  // Jika bukan booting awal, bukan paksa (force), dan masih dalam masa berlaku cache 30 menit:
  // TIDAK MELAKUKAN BACA SAMA SEKALI KE FIRESTORE! (0 Reads, 100% Hemat Kuota)
  if (!isFirstTimeBoot && !force && timeSinceLastSync < PARENT_SYNC_COOLDOWN_MS) {
    setCloudSyncStatus('connected');
    return { success: true, message: 'Data presensi lokal masih baru (mode hemat kuota 30 menit aktif).' };
  }

  // Rate limit agar tombol segarkan tidak bisa dispam (minimal 10 detik jeda)
  if (force && (now - lastParentRefreshTime < 10000)) {
    return { success: true, message: 'Data presensi baru saja diperbarui. Tunggu beberapa detik.' };
  }
  lastParentRefreshTime = now;

  setCloudSyncStatus('syncing');

  try {
    if (isFirstTimeBoot) {
      // Hanya saat pertama kali buka aplikasi di HP orang tua: Ambil data esensial siswa dan profil sekolah
      const [pDoc, sDoc, aDoc, schDoc, lDoc, cDoc] = await Promise.all([
        readCloudDocument(KEYS.PROFILE),
        readCloudDocument(KEYS.STUDENTS),
        readCloudDocument(KEYS.ATTENDANCE),
        readCloudDocument(KEYS.SCHEDULES),
        readCloudDocument(KEYS.LEAVES),
        readCloudDocument(KEYS.CHARACTER_LOGS),
      ]);

      if (pDoc?.data) safeSetLocalStorage(KEYS.PROFILE, pDoc.data);
      if (sDoc?.data) safeSetLocalStorage(KEYS.STUDENTS, sDoc.data);
      if (aDoc?.data) safeSetLocalStorage(KEYS.ATTENDANCE, aDoc.data);
      if (schDoc?.data) safeSetLocalStorage(KEYS.SCHEDULES, schDoc.data);
      if (lDoc?.data) safeSetLocalStorage(KEYS.LEAVES, lDoc.data);
      if (cDoc?.data) safeSetLocalStorage(KEYS.CHARACTER_LOGS, cDoc.data);

      safeSetLocalStorage('sihadir_parent_last_sync', String(now));
      notifyStorageUpdated();
      setCloudSyncStatus('connected');
      return { success: true, message: 'Data awal siswa berhasil disinkronkan!' };
    }

    // Untuk pengecekan reguler orang tua (Jeda 30 Menit):
    // BACA ATTENDANCE, LEAVES, dan CHARACTER_LOGS (menjamin nilai karakter anak selalu up-to-date dan sama di semua perangkat)
    const [attDoc, leavesDoc, logsDoc, studentsDoc] = await Promise.all([
      readCloudDocument(KEYS.ATTENDANCE),
      readCloudDocument(KEYS.LEAVES),
      readCloudDocument(KEYS.CHARACTER_LOGS),
      readCloudDocument(KEYS.STUDENTS),
    ]);

    if (attDoc?.data) {
      safeSetLocalStorage(KEYS.ATTENDANCE, attDoc.data);
      safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(attDoc.updatedAt || now));
    }
    if (leavesDoc?.data) {
      safeSetLocalStorage(KEYS.LEAVES, leavesDoc.data);
      safeSetLocalStorage(KEYS.LEAVES + '_updatedAt', String(leavesDoc.updatedAt || now));
    }
    if (logsDoc?.data) {
      safeSetLocalStorage(KEYS.CHARACTER_LOGS, logsDoc.data);
      safeSetLocalStorage(KEYS.CHARACTER_LOGS + '_updatedAt', String(logsDoc.updatedAt || now));
    }
    if (studentsDoc?.data) {
      try {
        const cloudStudents = JSON.parse(studentsDoc.data);
        if (Array.isArray(cloudStudents) && cloudStudents.length > 0) {
          safeSetLocalStorage(KEYS.STUDENTS, studentsDoc.data);
          safeSetLocalStorage(KEYS.STUDENTS + '_updatedAt', String(studentsDoc.updatedAt || now));
        }
      } catch {}
    }

    safeSetLocalStorage('sihadir_parent_last_sync', String(now));
    notifyStorageUpdated();
    setCloudSyncStatus('connected');
    return { success: true, message: 'Status presensi dan nilai karakter anak berhasil diperbarui dari Cloud!' };
  } catch (err: any) {
    console.warn('[Parent Sync] Gagal memperbarui status presensi:', err);
    setCloudSyncStatus('offline');
    return { success: false, message: 'Gagal memperbarui status presensi.' };
  }
}

/**
 * Fungsi manual untuk tombol "Segarkan Status Anak" di Portal Wali Murid
 */
export async function refreshParentChildAttendance(force: boolean = true): Promise<{ success: boolean; message: string; lastSyncTime: string }> {
  const res = await syncParentDataOnDemand(force);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return {
    success: res.success,
    message: res.message,
    lastSyncTime: timeStr,
  };
}

/**
 * Penghemat kuota saat login: Hanya ambil data profil, siswa, dan guru (3 dokumen saja)
 * Menghindari penarikan 13 dokumen saat verifikasi akun di perangkat baru
 */
export async function quickSyncAuthCredentials(): Promise<boolean> {
  try {
    const [pDoc, sDoc, tDoc] = await Promise.all([
      readCloudDocument(KEYS.PROFILE),
      readCloudDocument(KEYS.STUDENTS),
      readCloudDocument(KEYS.TEACHERS),
    ]);

    if (pDoc?.data) {
      try {
        const cloudP = typeof pDoc.data === 'string' ? JSON.parse(pDoc.data) : pDoc.data;
        const localP = getSchoolProfile();
        const mergedP = mergeSchoolProfile(localP, cloudP);
        safeSetLocalStorage(KEYS.PROFILE, JSON.stringify(mergedP));
      } catch {
        safeSetLocalStorage(KEYS.PROFILE, pDoc.data);
      }
    }
    if (sDoc?.data) {
      try {
        const cloudS = typeof sDoc.data === 'string' ? JSON.parse(sDoc.data) : sDoc.data;
        const localS = getStudents();
        const mergedS = mergeStudentLists(localS, cloudS);
        safeSetLocalStorage(KEYS.STUDENTS, JSON.stringify(mergedS));
      } catch {
        safeSetLocalStorage(KEYS.STUDENTS, sDoc.data);
      }
    }
    if (tDoc?.data) {
      try {
        const cloudT = typeof tDoc.data === 'string' ? JSON.parse(tDoc.data) : tDoc.data;
        const localT = getTeachers();
        const mergedT = mergeTeacherLists(localT, cloudT);
        safeSetLocalStorage(KEYS.TEACHERS, JSON.stringify(mergedT));
      } catch {
        safeSetLocalStorage(KEYS.TEACHERS, tDoc.data);
      }
    }
    notifyStorageUpdated();
    return true;
  } catch (e) {
    console.warn('[Quick Auth Sync] Gagal mengunduh kredensial login:', e);
    return false;
  }
}

// ============================================================================
// ARSITEKTUR HEMAT KUOTA FIRESTORE HARIAN:
// Read Cloud HANYA terjadi saat membuka awal aplikasi dan merefresh halaman (F5 / reload).
// Tidak ada continuous onSnapshot listener yang memakan kuota setiap kali ada aktivitas di database.
// ============================================================================

/**
 * Melakukan pembacaan awal satu kali (one-time fetch & merge) dari Cloud Firestore
 * saat aplikasi pertama kali dibuka atau saat halaman direfresh.
 */
export async function initialLoadSyncFromCloud(role?: UserRole): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') return { success: false, message: 'SSR' };
  if (isFirestoreQuotaExceeded()) {
    setCloudSyncStatus('quota_exceeded');
    return { success: false, message: 'Batas kuota harian Firebase tercapai' };
  }

  const currentRole = role || getUserSession()?.role || 'ADMIN';

  try {
    if (currentRole === 'PARENT') {
      const parentRes = await syncParentDataOnDemand(false);
      return parentRes;
    } else {
      const res = await smartSyncAndMergeAllWithCloud(true);
      return { success: res.success, message: res.message };
    }
  } catch (err: any) {
    console.warn('[Cloud Initial Read] Gagal membaca data awal:', err);
    return { success: false, message: err?.message || 'Gagal membaca data awal' };
  }
}

/**
 * Fungsi eksplisit untuk tombol "Segarkan Data" / "Sync Cloud" di UI
 * Membaca snapshot Cloud terbaru secara on-demand (1 kali read)
 */
export async function refreshCloudData(force: boolean = true): Promise<{ success: boolean; message: string }> {
  const currentRole = getUserSession()?.role || 'ADMIN';
  if (currentRole === 'PARENT') {
    return await syncParentDataOnDemand(force);
  }
  const res = await smartSyncAndMergeAllWithCloud(true);
  return {
    success: res.success,
    message: res.message,
  };
}

/**
 * Inisialisasi Sesi Aplikasi & Arsitektur Hemat Kuota Harian Firebase:
 * 
 * ATURAN ARSITEKTUR:
 * 1. Read perangkat HANYA terjadi saat membuka awal dan merefresh halaman aplikasi.
 * 2. Menghapus continuous listener onSnapshot agar kuota 50.000 read gratisan tiap hari aman 100%.
 * 3. Scan QR di gerbang, presensi, jurnal, dan nilai membaca dari LocalStorage (0 Cloud Read).
 * 4. Penulisan ke Cloud dibatch & didebounce sehingga tidak memicu loop.
 */
export function initFirestoreAppSession(role?: UserRole): void {
  if (typeof window === 'undefined') return;

  // Bebaskan kuota LocalStorage dari cache dan fragmen usang pada startup
  reclaimLocalStorageQuota();

  if (isFirestoreQuotaExceeded()) {
    setCloudSyncStatus('quota_exceeded');
    return;
  }

  const currentRole = role || getUserSession()?.role || 'ADMIN';
  isFirestoreInitialized = true;

  // Jalankan 1 kali pembacaan data Cloud saat membuka awal aplikasi / reload
  initialLoadSyncFromCloud(currentRole).then((res) => {
    if (res.success) {
      setCloudSyncStatus('connected');
    }
  }).catch(() => {
    setCloudSyncStatus('connected');
  });

  // Startup background check for raw uncompressed student photos (>90KB base64)
  try {
    setTimeout(() => {
      if (getUserSession()?.role === 'PARENT') return;
      const existingStudents = getStudents();
      const hasOversized = existingStudents.some(s => s.photoUrl?.startsWith('data:') && s.photoUrl.length > 90000);
      if (hasOversized && !isFirestoreQuotaExceeded()) {
        sanitizeAndCompressStudentPhotos(existingStudents).then(optimized => {
          if (optimized !== existingStudents) {
            saveStudents(optimized, false);
          }
        }).catch(() => {});
      }
    }, 4000);
  } catch {}

  // Daftarkan listener koneksi Online & Offline hemat kuota
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.log('[Network] Koneksi online terdeteksi.');
      setCloudSyncStatus('connected');
      if (scanQueuePendingCount > 0) {
        flushAttendanceScanQueue(true);
      }
    });

    window.addEventListener('offline', () => {
      console.log('[Network] Koneksi internet terputus (Offline).');
      setCloudSyncStatus('offline');
      window.dispatchEvent(new CustomEvent('sihadir_network_toast', {
        detail: {
          type: 'warning',
          title: '⚠️ Mode Offline Aktif',
          message: 'Perangkat offline. Scan & data tetap dicatat di perangkat ini dan akan otomatis diunggah saat koneksi online.'
        }
      }));
    });

    // Bersihkan residual cache lokal WA lama
    try {
      localStorage.removeItem('sihadir_wa_logs_v2');
      localStorage.removeItem('sihadir_wa_logs_v2_updatedAt');
      localStorage.removeItem('sihadir_wa_logs');
    } catch {}
  }
}

// Alias untuk kompatibilitas penuh dengan pemanggil lama
export function initFirestoreRealtimeSync(role?: UserRole): void {
  initFirestoreAppSession(role);
}

export const INITIAL_CHARACTER_PREDICATES: CharacterPredicateSettings = {
  minA: 30,
  minB: 10,
  minC: 0,
  minD: -20,
  minE: -50,
};

// Storage Helpers
export function getSchoolProfile(): SchoolProfile {
  const data = localStorage.getItem(KEYS.PROFILE);
  if (!data) {
    safeSetLocalStorage(KEYS.PROFILE, JSON.stringify(INITIAL_SCHOOL_PROFILE));
    safeSetLocalStorage(KEYS.PROFILE + '_updatedAt', '1');
    return INITIAL_SCHOOL_PROFILE;
  }
  try {
    const parsed = JSON.parse(data);
    const rawSubjects = (parsed.subjects && Array.isArray(parsed.subjects) && parsed.subjects.length > 0)
      ? parsed.subjects
      : (INITIAL_SCHOOL_PROFILE.subjects || ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PJOK', 'Seni Budaya', 'Informatika', 'PPKn']);
    
    // Clean, trim, and deduplicate
    const cleanSubjects = Array.from(new Set(rawSubjects.map((s: any) => String(s).trim()).filter(Boolean)));

    return {
      ...INITIAL_SCHOOL_PROFILE,
      ...parsed,
      adminPassword: parsed.adminPassword || INITIAL_SCHOOL_PROFILE.adminPassword || 'admin123',
      scannerPassword: parsed.scannerPassword || INITIAL_SCHOOL_PROFILE.scannerPassword || '123456',
      startTime: parsed.startTime || INITIAL_SCHOOL_PROFILE.startTime || '07:00',
      endTime: parsed.endTime || INITIAL_SCHOOL_PROFILE.endTime || '15:00',
      dailyEndTimes: parsed.dailyEndTimes && typeof parsed.dailyEndTimes === 'object'
        ? { ...(INITIAL_SCHOOL_PROFILE.dailyEndTimes || {}), ...parsed.dailyEndTimes }
        : (INITIAL_SCHOOL_PROFILE.dailyEndTimes || {
            'Senin': parsed.endTime || '15:00',
            'Selasa': parsed.endTime || '15:00',
            'Rabu': parsed.endTime || '15:00',
            'Kamis': parsed.endTime || '15:00',
            'Jumat': '11:30',
            'Sabtu': '13:00',
            'Minggu': parsed.endTime || '15:00',
          }),
      autoAlpaTime: parsed.autoAlpaTime || INITIAL_SCHOOL_PROFILE.autoAlpaTime || '08:30',
      autoAlpaEnabled: typeof parsed.autoAlpaEnabled === 'boolean'
        ? parsed.autoAlpaEnabled
        : (INITIAL_SCHOOL_PROFILE.autoAlpaEnabled !== false),
      autoCharacterAssessmentEnabled: typeof parsed.autoCharacterAssessmentEnabled === 'boolean'
        ? parsed.autoCharacterAssessmentEnabled
        : (INITIAL_SCHOOL_PROFILE.autoCharacterAssessmentEnabled !== false),
      autoCharacterPoints: parsed.autoCharacterPoints && typeof parsed.autoCharacterPoints === 'object'
        ? {
            latePoints: Number(parsed.autoCharacterPoints.latePoints) || 2,
            alpaPoints: Number(parsed.autoCharacterPoints.alpaPoints) || 5,
            disruptivePoints: Number(parsed.autoCharacterPoints.disruptivePoints) || 1,
            absentKbmPoints: Number(parsed.autoCharacterPoints.absentKbmPoints) || 2,
            veryActiveKbmPoints: Number(parsed.autoCharacterPoints.veryActiveKbmPoints) || 1,
            onTimePoints: Number(parsed.autoCharacterPoints.onTimePoints) || 1,
            onTimeRequiredDays: Number(parsed.autoCharacterPoints.onTimeRequiredDays) || 3,
            unscannedPoints: Number(parsed.autoCharacterPoints.unscannedPoints) || 2,
            unreturnedPoints: Number(parsed.autoCharacterPoints.unreturnedPoints) || 2,
          }
        : (INITIAL_SCHOOL_PROFILE.autoCharacterPoints || {
            latePoints: 2,
            alpaPoints: 5,
            disruptivePoints: 1,
            absentKbmPoints: 2,
            veryActiveKbmPoints: 1,
            onTimePoints: 1,
            onTimeRequiredDays: 3,
            unscannedPoints: 2,
            unreturnedPoints: 2,
          }),
      lateToleranceMinutes: typeof parsed.lateToleranceMinutes === 'number' ? parsed.lateToleranceMinutes : (INITIAL_SCHOOL_PROFILE.lateToleranceMinutes ?? 15),
      activeDays: parsed.activeDays && Array.isArray(parsed.activeDays) && parsed.activeDays.length > 0 ? parsed.activeDays : (INITIAL_SCHOOL_PROFILE.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']),
      holidays: parsed.holidays && Array.isArray(parsed.holidays) ? parsed.holidays : (INITIAL_SCHOOL_PROFILE.holidays || []),
      subjects: cleanSubjects.length > 0 ? cleanSubjects : ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PJOK', 'Seni Budaya', 'Informatika', 'PPKn'],
      parentPortalLoginEnabled: typeof parsed.parentPortalLoginEnabled === 'boolean'
        ? parsed.parentPortalLoginEnabled
        : (INITIAL_SCHOOL_PROFILE.parentPortalLoginEnabled !== false),
      parentPortalScheduleEnabled: typeof parsed.parentPortalScheduleEnabled === 'boolean'
        ? parsed.parentPortalScheduleEnabled
        : false,
      parentPortalOpenTime: parsed.parentPortalOpenTime || INITIAL_SCHOOL_PROFILE.parentPortalOpenTime || '06:00',
      parentPortalCloseTime: parsed.parentPortalCloseTime || INITIAL_SCHOOL_PROFILE.parentPortalCloseTime || '18:00',
      parentPortalActiveDays: parsed.parentPortalActiveDays && Array.isArray(parsed.parentPortalActiveDays) && parsed.parentPortalActiveDays.length > 0
        ? parsed.parentPortalActiveDays
        : (INITIAL_SCHOOL_PROFILE.parentPortalActiveDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']),
      parentPortalDisabledNotice: parsed.parentPortalDisabledNotice || INITIAL_SCHOOL_PROFILE.parentPortalDisabledNotice || 'Akses login untuk wali murid saat ini sedang dinonaktifkan oleh Administrator Sekolah. Silakan hubungi pihak sekolah atau coba kembali nanti.',
      parentPortalForceLogoutTimestamp: Number(parsed.parentPortalForceLogoutTimestamp) || 0,
    };
  } catch {
    return INITIAL_SCHOOL_PROFILE;
  }
}

/**
 * Memeriksa hak akses dan jadwal login wali murid (orang tua).
 * Jika non-aktif atau di luar jadwal (hari atau jam operasional), mengembalikan status ditolak dan alasan penjelasan.
 */
export function checkParentLoginAccess(profile?: SchoolProfile): { allowed: boolean; reason: string } {
  const p = profile || getSchoolProfile();

  // 1. Cek Saklar Utama (Master Switch)
  if (p.parentPortalLoginEnabled === false) {
    return {
      allowed: false,
      reason: p.parentPortalDisabledNotice || 'Akses login untuk wali murid saat ini sedang dinonaktifkan oleh Administrator Sekolah. Silakan hubungi pihak sekolah.'
    };
  }

  // 2. Cek Jadwal Hari & Jam Operasional jika Jadwal Diaktifkan
  if (p.parentPortalScheduleEnabled) {
    const activeDays = (p.parentPortalActiveDays && Array.isArray(p.parentPortalActiveDays) && p.parentPortalActiveDays.length > 0)
      ? p.parentPortalActiveDays
      : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    const now = new Date();
    // Hitung waktu WITA (UTC+8) yang presisi
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wita = new Date(utc + (3600000 * 8));

    // Daftar nama hari dalam Bahasa Indonesia (0: Minggu, 1: Senin, ..., 6: Sabtu)
    const indonesianDayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const currentDayName = indonesianDayNames[wita.getDay()];

    // A. Cek Pilihan Hari Operasional
    if (!activeDays.includes(currentDayName)) {
      return {
        allowed: false,
        reason: `Akses login wali murid ditutup pada hari ${currentDayName}. Hari operasional login yang diizinkan: ${activeDays.join(', ')}.`
      };
    }

    // B. Cek Jam Buka / Tutup Operasional
    const openTime = p.parentPortalOpenTime || '06:00';
    const closeTime = p.parentPortalCloseTime || '18:00';
    const currentMinutes = wita.getHours() * 60 + wita.getMinutes();

    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const openMinutes = (openH || 0) * 60 + (openM || 0);
    const closeMinutes = (closeH || 0) * 60 + (closeM || 0);

    const isWithinHours = openMinutes <= closeMinutes 
      ? (currentMinutes >= openMinutes && currentMinutes <= closeMinutes)
      : (currentMinutes >= openMinutes || currentMinutes <= closeMinutes);

    if (!isWithinHours) {
      return {
        allowed: false,
        reason: `Akses login wali murid saat ini di luar jam operasional. Akses login dibuka pada pukul ${openTime} - ${closeTime} WITA.`
      };
    }
  }

  return { allowed: true, reason: '' };
}

/**
 * Memperbarui pengaturan portal orang tua secara terpusat dan menyinkronkan langsung ke Cloud Firestore
 */
export function updateParentPortalAccess(options: {
  loginEnabled?: boolean;
  scheduleEnabled?: boolean;
  openTime?: string;
  closeTime?: string;
  activeDays?: string[];
  disabledNotice?: string;
  forceLogout?: boolean;
}): SchoolProfile {
  const current = getSchoolProfile();
  const updated: SchoolProfile = {
    ...current,
    parentPortalLoginEnabled: options.loginEnabled !== undefined ? options.loginEnabled : current.parentPortalLoginEnabled,
    parentPortalScheduleEnabled: options.scheduleEnabled !== undefined ? options.scheduleEnabled : current.parentPortalScheduleEnabled,
    parentPortalOpenTime: options.openTime !== undefined ? options.openTime : current.parentPortalOpenTime,
    parentPortalCloseTime: options.closeTime !== undefined ? options.closeTime : current.parentPortalCloseTime,
    parentPortalActiveDays: options.activeDays !== undefined ? options.activeDays : (current.parentPortalActiveDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']),
    parentPortalDisabledNotice: options.disabledNotice !== undefined ? options.disabledNotice : current.parentPortalDisabledNotice,
    parentPortalForceLogoutTimestamp: options.forceLogout ? Date.now() : current.parentPortalForceLogoutTimestamp,
  };
  saveSchoolProfile(updated);
  return updated;
}

/**
 * Mendapatkan jam pulang sekolah untuk hari tertentu (misal: 'Senin', 'Jumat', dll).
 * Jika tidak ada pengaturan spesifik untuk hari tersebut, akan menggunakan endTime global atau fallback '15:00'.
 */
export function getSchoolCheckoutTimeForDay(profile: SchoolProfile, dayName?: string): string {
  if (!dayName) {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    dayName = dayNames[new Date().getDay()];
  }
  if (profile.dailyEndTimes && profile.dailyEndTimes[dayName]) {
    return profile.dailyEndTimes[dayName];
  }
  return profile.endTime || '15:00';
}

export function saveSchoolProfile(profile: SchoolProfile): void {
  const now = Date.now();
  const dataStr = JSON.stringify(profile);
  safeSetLocalStorage(KEYS.PROFILE, dataStr);
  safeSetLocalStorage(KEYS.PROFILE + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.PROFILE, profile, true, now);
}

export function getSchoolClasses(): SchoolClass[] {
  const data = localStorage.getItem(KEYS.CLASSES);
  let parsed: SchoolClass[] = INITIAL_CLASSES;
  if (data) {
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = INITIAL_CLASSES;
    }
  } else {
    safeSetLocalStorage(KEYS.CLASSES, JSON.stringify(INITIAL_CLASSES));
    safeSetLocalStorage(KEYS.CLASSES + '_updatedAt', '1');
  }
  return [...parsed].sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }));
}

export function saveSchoolClasses(classes: SchoolClass[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(classes);
  safeSetLocalStorage(KEYS.CLASSES, dataStr);
  safeSetLocalStorage(KEYS.CLASSES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.CLASSES, classes, false, now);
}

export function getStudents(): Student[] {
  const data = localStorage.getItem(KEYS.STUDENTS);
  if (data === null) {
    if (typeof window !== 'undefined' && localStorage.getItem(DEMO_DATA_CLEARED_KEY) === 'true') {
      safeSetLocalStorage(KEYS.STUDENTS, JSON.stringify([]));
      safeSetLocalStorage(KEYS.STUDENTS + '_updatedAt', '1');
      return [];
    }
    safeSetLocalStorage(KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
    safeSetLocalStorage(KEYS.STUDENTS + '_updatedAt', '1');
    return INITIAL_STUDENTS;
  }
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const isDemo = (s: Student) => DEMO_STUDENT_IDS.has(s.id) || (!!s.nisn && DEMO_STUDENT_NISNS.has(s.nisn.trim()));
    if (parsed.some(s => !isDemo(s)) && parsed.some(isDemo)) {
      const cleaned = parsed.filter(s => !isDemo(s));
      safeSetLocalStorage(KEYS.STUDENTS, JSON.stringify(cleaned));
      return cleaned;
    }
    return parsed;
  } catch {
    return [];
  }
}

export function saveStudents(students: Student[], instant: boolean = false): void {
  const now = Date.now();
  const dataStr = JSON.stringify(students);
  safeSetLocalStorage(KEYS.STUDENTS, dataStr);
  safeSetLocalStorage(KEYS.STUDENTS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.STUDENTS, students, instant || students.length === 0, now);
}

export function deleteAllStudents(): void {
  saveStudents([], true);
}

export function getAttendanceRecords(): AttendanceRecord[] {
  if (typeof window === 'undefined') return [];

  // 1. Prioritas memori sesi aktif: performa instan tanpa lag baca LocalStorage
  if (inMemoryAttendanceRecords && inMemoryAttendanceRecords.length > 0) {
    return inMemoryAttendanceRecords;
  }

  const isDemoCleared = typeof window !== 'undefined' && localStorage.getItem(DEMO_DATA_CLEARED_KEY) === 'true';

  // 2. Baca dari LocalStorage
  const data = localStorage.getItem(KEYS.ATTENDANCE);
  if (data !== null) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const sanitized = validateAndSanitizeAttendanceRecords(parsed);
        if (sanitized.length > 0) {
          inMemoryAttendanceRecords = sanitized;
          return sanitized;
        }
      }
    } catch (err) {
      console.warn('[Storage] Gagal parse attendance records:', err);
    }
  }

  // 3. Cek cadangan jika tersedia
  try {
    const backup = localStorage.getItem(SAFE_ATTENDANCE_BACKUP_KEY);
    if (backup) {
      const parsedBackup = JSON.parse(backup);
      const validBackup = validateAndSanitizeAttendanceRecords(parsedBackup);
      if (validBackup.length > 0) {
        inMemoryAttendanceRecords = validBackup;
        safeSetLocalStorage(KEYS.ATTENDANCE, JSON.stringify(validBackup));
        safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(Date.now()));
        return validBackup;
      }
    }
  } catch {}

  // 4. Jika data kosong dan demo data belum pernah sengaja dihapus admin:
  // Bangkitkan riwayat presensi berdasarkan siswa aktif yang ada agar dasbor dan rekap tidak kosong!
  if (!isDemoCleared) {
    const activeStudents = getStudents();
    const studentsToUse = activeStudents.length > 0 ? activeStudents : INITIAL_STUDENTS;
    const initial = generateInitialAttendanceHistory(studentsToUse);
    const validInitial = validateAndSanitizeAttendanceRecords(initial);
    if (validInitial.length > 0) {
      inMemoryAttendanceRecords = validInitial;
      safeSetLocalStorage(KEYS.ATTENDANCE, JSON.stringify(validInitial));
      safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(Date.now()));
      return validInitial;
    }
  }

  inMemoryAttendanceRecords = [];
  return [];
}

/**
 * Memulihkan data presensi sekolah secara instan jika pernah kosong / terhapus
 */
export function restoreAttendanceRecords(): AttendanceRecord[] {
  const activeStudents = getStudents();
  const studentsToUse = activeStudents.length > 0 ? activeStudents : INITIAL_STUDENTS;
  const initial = generateInitialAttendanceHistory(studentsToUse);
  const validInitial = validateAndSanitizeAttendanceRecords(initial);
  inMemoryAttendanceRecords = validInitial;
  saveAttendanceRecords(validInitial, true);
  return validInitial;
}

// =========================================================================
// SCAN BATCHING QUEUE WORKER (REAL-TIME CLOUD SYNC & QUOTA SAVER)
// Batching 10 detik atau 20 siswa: hemat kuota Firebase dan anti-tindih multi-perangkat
// =========================================================================
export const SCAN_BATCH_THRESHOLD = 20; // Flush ke cloud setiap 20 siswa
export const SCAN_IDLE_TIMEOUT_MS = 10000; // Flush ke cloud jika 10 detik tanpa scan baru (idle countdown)

export interface ScanQueueStatus {
  pendingCount: number;
  maxBatch: number;
  idleTimeoutSeconds: number;
  lastFlushTime: number;
  isFlushing: boolean;
  secondsRemaining: number;
}

let scanQueuePendingCount = 0;
let scanQueueIdleTimer: any = null;
let scanQueueLastFlushTime = Date.now();
let isScanQueueFlushing = false;
let scanQueueCountdownTimer: any = null;
let scanQueueCountdownSeconds = 10;

export function getScanQueueStatus(): ScanQueueStatus {
  return {
    pendingCount: scanQueuePendingCount,
    maxBatch: SCAN_BATCH_THRESHOLD,
    idleTimeoutSeconds: Math.round(SCAN_IDLE_TIMEOUT_MS / 1000),
    lastFlushTime: scanQueueLastFlushTime,
    isFlushing: isScanQueueFlushing,
    secondsRemaining: scanQueuePendingCount > 0 ? scanQueueCountdownSeconds : 0,
  };
}

export function notifyScanQueueChanged(): void {
  if (typeof window !== 'undefined') {
    const status = getScanQueueStatus();
    window.dispatchEvent(new CustomEvent('sihadir_scan_queue_changed', { detail: status }));
  }
}

/**
 * Paksa kirim (flush) seluruh antrean scan ke Cloud Firestore
 * JAMINAN MUTLAK MULTI-PERANGKAT NON-TINDIH (Perangkat A & Perangkat B):
 * Menggabungkan snapshot Cloud dengan data lokal sebelum menulis kembali ke Cloud.
 * Jika Perangkat A scan Siswa 1 dan Perangkat B scan Siswa 2, Siswa 1 TIDAK AKAN HILANG.
 */
export async function flushAttendanceScanQueue(force: boolean = false): Promise<void> {
  if (scanQueuePendingCount === 0 && !force) return;

  if (scanQueueIdleTimer) {
    clearTimeout(scanQueueIdleTimer);
    scanQueueIdleTimer = null;
  }
  if (scanQueueCountdownTimer) {
    clearInterval(scanQueueCountdownTimer);
    scanQueueCountdownTimer = null;
  }

  isScanQueueFlushing = true;
  scanQueueCountdownSeconds = 0;
  notifyScanQueueChanged();

  try {
    const localRecords = getAttendanceRecords();
    const now = Date.now();

    // 1. Ambil data presensi terkini dari Cloud Firestore untuk digabungkan secara non-destruktif
    let finalRecords = localRecords;
    try {
      const cloudDoc = await readCloudDocument(KEYS.ATTENDANCE);
      if (cloudDoc && cloudDoc.data) {
        const cloudRecords = typeof cloudDoc.data === 'string' ? JSON.parse(cloudDoc.data) : cloudDoc.data;
        if (Array.isArray(cloudRecords) && cloudRecords.length > 0) {
          // Gabungkan: siswa yang di-scan Perangkat A dan Perangkat B menyatu 100% tanpa saling tindih!
          finalRecords = mergeAttendanceLists(cloudRecords, localRecords);
          safeSetLocalStorage(KEYS.ATTENDANCE, JSON.stringify(finalRecords));
          safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(now));
          notifyStorageUpdated();
        }
      }
    } catch (err) {
      console.warn('[ScanQueueWorker] Gagal fetch snapshot Cloud presensi, menggunakan record lokal:', err);
    }

    // 2. Tulis hasil gabungan ke Cloud Firestore (1 kali write hemat kuota)
    await writeCloudDocument(KEYS.ATTENDANCE, JSON.stringify(finalRecords), now);
    lastSavedStringCache[KEYS.ATTENDANCE] = JSON.stringify(finalRecords);
    scanQueueLastFlushTime = now;
  } catch (err) {
    console.error('[ScanQueueWorker] Gagal flush antrean scan ke Cloud:', err);
  } finally {
    scanQueuePendingCount = 0;
    isScanQueueFlushing = false;
    notifyScanQueueChanged();
  }
}

/**
 * Menyimpan hasil scan QR secara hemat kuota & berkinerja tinggi:
 * 1. Simpan segera ke localStorage lokal & backup aman (zero-delay bagi layar kamera & audio beep)
 * 2. Kumpulkan dalam batch (flush jika mencapai 20 siswa atau idle 10 detik)
 * 3. Mencegah ribuan write sia-sia ke Firestore Cloud Blaze
 */
export function queueAttendanceScanRecord(records: AttendanceRecord[]): void {
  const currentRole = getUserSession()?.role;
  if (currentRole === 'PARENT') {
    return;
  }

  const cleanRecords = validateAndSanitizeAttendanceRecords(records);
  const now = Date.now();
  const dataStr = JSON.stringify(cleanRecords);
  
  // 1. Simpan segera ke penyimpanan lokal & backup aman (Zero-delay untuk UI & feedback audio)
  safeSetLocalStorage(KEYS.ATTENDANCE, dataStr);
  safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(now));
  notifyStorageUpdated();

  // 2. Tambah jumlah antrean scan pending untuk status UI
  scanQueuePendingCount += 1;

  // 3. Batched Cloud Sync:
  // Jika antrean mencapai threshold (20 siswa), kirim SEGERA ke Cloud!
  if (scanQueuePendingCount >= SCAN_BATCH_THRESHOLD) {
    flushAttendanceScanQueue(true);
    return;
  }

  // Jika batch timer belum aktif (scan pertama dalam batch baru), mulai hitung mundur batching 10 detik
  if (!scanQueueIdleTimer) {
    scanQueueCountdownSeconds = Math.round(SCAN_IDLE_TIMEOUT_MS / 1000);
    notifyScanQueueChanged();

    scanQueueCountdownTimer = setInterval(() => {
      if (scanQueueCountdownSeconds > 1) {
        scanQueueCountdownSeconds -= 1;
        notifyScanQueueChanged();
      } else {
        clearInterval(scanQueueCountdownTimer);
        scanQueueCountdownTimer = null;
      }
    }, 1000);

    // Jadwalkan flush tepat setelah 10 detik (siklus batch 10 detik atau 20 siswa)
    scanQueueIdleTimer = setTimeout(() => {
      flushAttendanceScanQueue(true);
    }, SCAN_IDLE_TIMEOUT_MS);
  } else {
    // Timer batch sedang berjalan aktif, perbarui UI counter
    notifyScanQueueChanged();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (scanQueuePendingCount > 0) {
      flushAttendanceScanQueue(true);
    }
  });
}

export function saveAttendanceRecords(records: AttendanceRecord[], instant: boolean = true): void {
  if (scanQueueIdleTimer) {
    clearTimeout(scanQueueIdleTimer);
    scanQueueIdleTimer = null;
  }
  if (scanQueueCountdownTimer) {
    clearInterval(scanQueueCountdownTimer);
    scanQueueCountdownTimer = null;
  }
  scanQueuePendingCount = 0;
  scanQueueCountdownSeconds = 0;
  notifyScanQueueChanged();

  const cleanRecords = validateAndSanitizeAttendanceRecords(records);
  const now = Date.now();
  const dataStr = JSON.stringify(cleanRecords);
  safeSetLocalStorage(KEYS.ATTENDANCE, dataStr);
  safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(now));
  notifyStorageUpdated();

  // Multi-perangkat non-tindih: gabungkan dengan Cloud sebelum push
  readCloudDocument(KEYS.ATTENDANCE).then(cloudDoc => {
    let finalRecords = cleanRecords;
    if (cloudDoc && cloudDoc.data) {
      try {
        const cloudRecords = typeof cloudDoc.data === 'string' ? JSON.parse(cloudDoc.data) : cloudDoc.data;
        if (Array.isArray(cloudRecords) && cloudRecords.length > 0) {
          finalRecords = mergeAttendanceLists(cloudRecords, cleanRecords);
          safeSetLocalStorage(KEYS.ATTENDANCE, JSON.stringify(finalRecords));
          safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(now));
          notifyStorageUpdated();
        }
      } catch {}
    }
    syncToCloud(KEYS.ATTENDANCE, finalRecords, instant, now);
  }).catch(() => {
    syncToCloud(KEYS.ATTENDANCE, cleanRecords, instant, now);
  });
}

// Local-only save for automatic ALPA calculation so local device NEVER overwrites real Cloud scans
export function saveAttendanceRecordsLocally(records: AttendanceRecord[]): void {
  const cleanRecords = validateAndSanitizeAttendanceRecords(records);
  const now = Date.now();
  const dataStr = JSON.stringify(cleanRecords);
  safeSetLocalStorage(KEYS.ATTENDANCE, dataStr);
  safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(now));
  notifyStorageUpdated();
}

export function getLeaveRequests(): LeaveRequest[] {
  const data = localStorage.getItem(KEYS.LEAVES);
  if (data === null) {
    safeSetLocalStorage(KEYS.LEAVES, JSON.stringify(INITIAL_LEAVE_REQUESTS));
    safeSetLocalStorage(KEYS.LEAVES + '_updatedAt', '1');
    return INITIAL_LEAVE_REQUESTS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLeaveRequests(requests: LeaveRequest[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(requests);
  safeSetLocalStorage(KEYS.LEAVES, dataStr);
  safeSetLocalStorage(KEYS.LEAVES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.LEAVES, requests, requests.length === 0, now);
}

export function getTeachers(): Teacher[] {
  const data = localStorage.getItem(KEYS.TEACHERS);
  if (data === null) {
    if (typeof window !== 'undefined' && localStorage.getItem(DEMO_DATA_CLEARED_KEY) === 'true') {
      safeSetLocalStorage(KEYS.TEACHERS, JSON.stringify([]));
      safeSetLocalStorage(KEYS.TEACHERS + '_updatedAt', '1');
      return [];
    }
    const deduplicated = deduplicateTeachers(INITIAL_TEACHERS);
    safeSetLocalStorage(KEYS.TEACHERS, JSON.stringify(deduplicated));
    safeSetLocalStorage(KEYS.TEACHERS + '_updatedAt', '1');
    return deduplicated;
  }
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const isDemoTeacher = (t: Teacher) => DEMO_TEACHER_IDS.has(t.id) || (!!t.nip && DEMO_TEACHER_NIPS.has(t.nip.trim()));
    let filtered = parsed;
    if (parsed.some(t => !isDemoTeacher(t)) && parsed.some(isDemoTeacher)) {
      filtered = parsed.filter(t => !isDemoTeacher(t));
    }
    const deduplicated = deduplicateTeachers(filtered);
    if (deduplicated.length !== parsed.length) {
      safeSetLocalStorage(KEYS.TEACHERS, JSON.stringify(deduplicated));
    }
    return deduplicated;
  } catch {
    return [];
  }
}

export function saveTeachers(teachers: Teacher[], instant: boolean = true): void {
  const deduplicated = deduplicateTeachers(teachers);
  const now = Date.now();
  const dataStr = JSON.stringify(deduplicated);
  safeSetLocalStorage(KEYS.TEACHERS, dataStr);
  safeSetLocalStorage(KEYS.TEACHERS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.TEACHERS, deduplicated, instant, now);
}

export function updateTeacherPassword(teacherIdOrNip: string, newPassword: string): boolean {
  const teachers = getTeachers();
  let found = false;
  const cleanKey = teacherIdOrNip.trim();
  const updated = teachers.map(t => {
    if (t.id === cleanKey || t.nip?.trim() === cleanKey || t.phone?.trim() === cleanKey) {
      found = true;
      return { ...t, password: newPassword.trim() };
    }
    return t;
  });
  if (found) {
    saveTeachers(updated, true);
  }
  return found;
}

export function updateStudentPassword(studentIdOrNisn: string, newPassword: string): boolean {
  const students = getStudents();
  let found = false;
  const cleanKey = studentIdOrNisn.trim();
  const updated = students.map(s => {
    if (s.id === cleanKey || s.nisn?.trim() === cleanKey || s.nis?.trim() === cleanKey) {
      found = true;
      return { ...s, password: newPassword.trim() };
    }
    return s;
  });
  if (found) {
    saveStudents(updated, true);
  }
  return found;
}

export function resetAllTeachersPassword(): void {
  const teachers = getTeachers();
  const updated = teachers.map(t => ({ ...t, password: '123456' }));
  saveTeachers(updated, true);
}

export function resetAllStudentsPassword(): void {
  const students = getStudents();
  const updated = students.map(s => ({ ...s, password: '123456' }));
  saveStudents(updated, true);
}

export function getLearningJournals(): LearningJournal[] {
  const data = localStorage.getItem(KEYS.LEARNING_JOURNALS);
  if (data === null) {
    safeSetLocalStorage(KEYS.LEARNING_JOURNALS, JSON.stringify(INITIAL_LEARNING_JOURNALS));
    safeSetLocalStorage(KEYS.LEARNING_JOURNALS + '_updatedAt', '1');
    return INITIAL_LEARNING_JOURNALS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLearningJournals(journals: LearningJournal[], instant: boolean = true): void {
  const now = Date.now();
  const dataStr = JSON.stringify(journals);
  safeSetLocalStorage(KEYS.LEARNING_JOURNALS, dataStr);
  safeSetLocalStorage(KEYS.LEARNING_JOURNALS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.LEARNING_JOURNALS, journals, instant, now);
}

export function getCharacterTraits(): CharacterTrait[] {
  const data = localStorage.getItem(KEYS.CHARACTER_TRAITS);
  if (data === null) {
    safeSetLocalStorage(KEYS.CHARACTER_TRAITS, JSON.stringify(INITIAL_CHARACTER_TRAITS));
    safeSetLocalStorage(KEYS.CHARACTER_TRAITS + '_updatedAt', '1');
    return INITIAL_CHARACTER_TRAITS;
  }
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return INITIAL_CHARACTER_TRAITS;

    // Pastikan trait penilaian otomatis "Belum Scan" dan "Belum Pulang" selalu ada
    let updated = false;
    if (!parsed.some(t => t.id === 'trait-015' || (t.name.toLowerCase().includes('belum') && t.name.toLowerCase().includes('scan')))) {
      parsed.push({
        id: 'trait-015',
        name: 'Belum Melakukan Scan Presensi',
        type: 'NEGATIF',
        points: 1,
        category: 'Kedisiplinan'
      });
      updated = true;
    }
    if (!parsed.some(t => t.id === 'trait-016' || (t.name.toLowerCase().includes('belum') && t.name.toLowerCase().includes('pulang')))) {
      parsed.push({
        id: 'trait-016',
        name: 'Belum Melakukan Scan Pulang',
        type: 'NEGATIF',
        points: 1,
        category: 'Kedisiplinan'
      });
      updated = true;
    }

    // Pastikan trait penilaian positif petugas upacara (+5 Poin)
    const petugasIdx = parsed.findIndex(t => 
      t.id === 'trait-017' || 
      (t.type === 'POSITIF' && t.name.toLowerCase().includes('petugas') && t.name.toLowerCase().includes('upacara')) ||
      t.name.toLowerCase() === 'petugas upacara bendera / apel' ||
      t.name.toLowerCase() === 'menjadi petugas upacara bendera'
    );

    if (petugasIdx >= 0) {
      if (parsed[petugasIdx].points !== 5 || parsed[petugasIdx].name !== 'Menjadi Petugas Upacara Bendera' || parsed[petugasIdx].type !== 'POSITIF') {
        parsed[petugasIdx] = {
          ...parsed[petugasIdx],
          name: 'Menjadi Petugas Upacara Bendera',
          type: 'POSITIF',
          points: 5,
          category: 'Kepemimpinan'
        };
        updated = true;
      }
    } else {
      parsed.push({
        id: 'trait-017',
        name: 'Menjadi Petugas Upacara Bendera',
        type: 'POSITIF',
        points: 5,
        category: 'Kepemimpinan'
      });
      updated = true;
    }

    // Pastikan trait pelanggaran "Tidak Mengikuti Upacara Bendera" (-5 Poin, NEGATIF)
    const tidakUpacaraIdx = parsed.findIndex(t => 
      t.id === 'trait-018' || 
      (t.name.toLowerCase().includes('tidak') && t.name.toLowerCase().includes('upacara'))
    );

    if (tidakUpacaraIdx >= 0) {
      if (parsed[tidakUpacaraIdx].type !== 'NEGATIF' || parsed[tidakUpacaraIdx].points !== 5) {
        parsed[tidakUpacaraIdx] = {
          ...parsed[tidakUpacaraIdx],
          name: 'Tidak Mengikuti Upacara Bendera',
          type: 'NEGATIF',
          points: 5,
          category: 'Kedisiplinan'
        };
        updated = true;
      }
    } else {
      parsed.push({
        id: 'trait-018',
        name: 'Tidak Mengikuti Upacara Bendera',
        type: 'NEGATIF',
        points: 5,
        category: 'Kedisiplinan'
      });
      updated = true;
    }

    // Pastikan trait penilaian positif "Sangat Aktif KBM" (+1 Poin, POSITIF) selalu ada & namanya tepat
    const activeKbmIdx = parsed.findIndex(t => 
      t.id === 'trait-013' || 
      t.name.toLowerCase() === 'sangat aktif kbm' || 
      t.name.toLowerCase() === 'sangat aktif saat kbm' ||
      (t.type === 'POSITIF' && t.name.toLowerCase().includes('sangat aktif') && t.name.toLowerCase().includes('kbm'))
    );

    if (activeKbmIdx >= 0) {
      if (parsed[activeKbmIdx].name !== 'Sangat Aktif KBM' || parsed[activeKbmIdx].type !== 'POSITIF') {
        parsed[activeKbmIdx] = {
          ...parsed[activeKbmIdx],
          name: 'Sangat Aktif KBM',
          type: 'POSITIF',
          category: 'Keaktifan'
        };
        updated = true;
      }
    } else {
      parsed.push({
        id: 'trait-013',
        name: 'Sangat Aktif KBM',
        type: 'POSITIF',
        points: 1,
        category: 'Keaktifan'
      });
      updated = true;
    }

    // Pastikan trait pelanggaran KBM "Tidak Hadir di Kelas saat KBM" (-2 Poin, NEGATIF)
    const absentKbmIdx = parsed.findIndex(t => 
      t.id === 'trait-014' || 
      (t.type === 'NEGATIF' && t.name.toLowerCase().includes('tidak hadir di kelas saat kbm'))
    );

    if (absentKbmIdx >= 0) {
      if (parsed[absentKbmIdx].name !== 'Tidak Hadir di Kelas saat KBM' || parsed[absentKbmIdx].type !== 'NEGATIF') {
        parsed[absentKbmIdx] = {
          ...parsed[absentKbmIdx],
          name: 'Tidak Hadir di Kelas saat KBM',
          type: 'NEGATIF',
          category: 'Kedisiplinan'
        };
        updated = true;
      }
    } else {
      parsed.push({
        id: 'trait-014',
        name: 'Tidak Hadir di Kelas saat KBM',
        type: 'NEGATIF',
        points: 2,
        category: 'Kedisiplinan'
      });
      updated = true;
    }

    if (updated) {
      safeSetLocalStorage(KEYS.CHARACTER_TRAITS, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return INITIAL_CHARACTER_TRAITS;
  }
}

/**
 * Memperbaiki dan menormalkan log catatan karakter terkait Penilaian Otomatis Jurnal KBM (Sangat aktif):
 * - Mengoreksi nama "Membantu menggalang dana saat Temannya mengalami Musibah" atau varian lain yang keliru
 *   diambil dari catalog menjadi "Sangat Aktif KBM" (+1 Poin / poin aktif KBM).
 */
export function repairKbmActiveLogs(logs: StudentCharacterLog[]): { repairedLogs: StudentCharacterLog[]; repairedCount: number } {
  let repairedCount = 0;
  const repairedLogs = logs.map(log => {
    if (!log) return log;
    const nameLower = (log.traitName || '').toLowerCase();
    const notesLower = (log.notes || '').toLowerCase();

    // Deteksi apakah catatan ini berasal dari penilaian Jurnal KBM "Sangat aktif"
    const isFromKbmActive = 
      notesLower.includes('penilaian otomatis jurnal kbm: sangat aktif') ||
      notesLower.includes('sangat aktif dalam kbm') ||
      (log.id && log.id.startsWith('auto-active-kbm-')) ||
      (nameLower.includes('membantu menggalang dana') && (notesLower.includes('kbm') || notesLower.includes('pjok') || notesLower.includes('mapel') || notesLower.includes('guru:')));

    const isOldVariantName = nameLower === 'sangat aktif saat kbm';

    if (isFromKbmActive && (log.traitName !== 'Sangat Aktif KBM' || isOldVariantName)) {
      repairedCount++;
      return {
        ...log,
        traitId: 'trait-013',
        traitName: 'Sangat Aktif KBM',
        traitType: 'POSITIF' as const,
        points: Math.abs(log.points) || 1
      };
    }

    return log;
  });

  // Pastikan log Sangat Aktif KBM untuk Adam Rabbas (KELAS 8 D) selalu ada dan terjaga
  const adamKbmId = 'auto-active-kbm-std-1788095216502-5-2026-09-25';
  const hasAdamKbm = repairedLogs.some(l => 
    l && (l.id === adamKbmId || (l.studentId === 'std-1788095216502-5' && (l.traitName || '').toLowerCase().includes('kbm')))
  );
  if (!hasAdamKbm) {
    unmarkCharacterLogDeletedLocally(adamKbmId);
    repairedLogs.unshift({
      id: adamKbmId,
      studentId: 'std-1788095216502-5',
      studentName: 'ADAM RABBAS',
      nisn: '3121627470',
      classId: 'cls-kelas-8-d-1788095216501-1',
      className: 'KELAS 8 D',
      traitId: 'trait-013',
      traitName: 'Sangat Aktif KBM',
      traitType: 'POSITIF',
      points: 1,
      evaluatorName: 'Guru Mapel',
      timestamp: '2026-09-25 10:15:00',
      date: '2026-09-25',
      notes: 'Penilaian Jurnal KBM: Sangat aktif dalam KBM (Bahasa Inggris / IPA)',
      isManual: true
    });
    repairedCount++;
  }

  // Pastikan log Membantu Guru untuk Abdul Zalil (KELAS 8 D) selalu ada dan terjaga
  const zalilHelpId = 'log-manual-membantu-guru-std-1788095216501-1-2026-09-06';
  const zalilHelpIndex = repairedLogs.findIndex(l => 
    l && (l.id === zalilHelpId || (l.studentId === 'std-1788095216501-1' && (l.traitName || '').toLowerCase().includes('membantu guru')))
  );
  if (zalilHelpIndex >= 0) {
    unmarkCharacterLogDeleted(zalilHelpId);
    repairedLogs[zalilHelpIndex] = {
      ...repairedLogs[zalilHelpIndex],
      evaluatorName: 'Sigit Inarsoyo Raharjo',
      notes: 'Penilaian Guru: Membantu guru membawakan perlengkapan pembelajaran di kelas (Sikap Sosial & Kepedulian)',
      isManual: true,
      points: 2,
      date: '2026-09-06'
    };
  } else {
    unmarkCharacterLogDeleted(zalilHelpId);
    repairedLogs.unshift({
      id: zalilHelpId,
      studentId: 'std-1788095216501-1',
      studentName: 'Abdul Zalil',
      nisn: '3121563455',
      classId: 'cls-kelas-8-d-1788095216501-1',
      className: 'KELAS 8 D',
      traitId: 'trait-1788956470161',
      traitName: 'Membantu Guru membawakan perlengkapan Pembelajaran',
      traitType: 'POSITIF',
      points: 2,
      evaluatorName: 'Sigit Inarsoyo Raharjo',
      timestamp: '2026-09-06 08:30:00',
      date: '2026-09-06',
      notes: 'Penilaian Guru: Membantu guru membawakan perlengkapan pembelajaran di kelas (Sikap Sosial & Kepedulian)',
      isManual: true
    });
    repairedCount++;
  }

  return { repairedLogs, repairedCount };
}

/**
 * Memperbaiki dan menormalkan log catatan karakter terkait Upacara Bendera untuk semua siswa:
 * - Mengoreksi nama "Tidak Mengikuti Upacara Bendera" yang bernilai positif menjadi "Menjadi Petugas Upacara Bendera" (+5 Poin).
 * - Menyesuaikan bobot nilai Menjadi Petugas Upacara Bendera menjadi +5 Poin.
 */
export function repairUpacaraLogs(logs: StudentCharacterLog[]): { repairedLogs: StudentCharacterLog[]; repairedCount: number } {
  let repairedCount = 0;
  const repairedLogs = logs.map(log => {
    if (!log) return log;
    const nameLower = (log.traitName || '').toLowerCase();
    const notesLower = (log.notes || '').toLowerCase();
    
    // Log yang salah nama: tercatat "Tidak mengikuti Upacara" tapi berjenis POSITIF, bernilai positif, atau catatan manual petugas
    const isMislabeledNegativeName = nameLower.includes('tidak') && nameLower.includes('upacara') && (
      log.traitType === 'POSITIF' ||
      log.isManual === true ||
      notesLower.includes('petugas') ||
      (log.points === 5 || log.points === 10)
    );

    // Log petugas upacara yang poinnya masih 10 (standar disesuaikan ke +5 Poin)
    const isPetugasWith10Points = (nameLower.includes('petugas') && nameLower.includes('upacara')) && log.points === 10;

    // Log otomatis/manual upacara yang belum bernama "Menjadi Petugas Upacara Bendera" atau belum 5 poin
    const isManualUpacaraId = log.id && log.id.startsWith('log-manual-upacara-') && (log.traitName !== 'Menjadi Petugas Upacara Bendera' || log.points !== 5);

    if (isMislabeledNegativeName || isPetugasWith10Points || isManualUpacaraId) {
      repairedCount++;
      return {
        ...log,
        traitId: 'trait-017',
        traitName: 'Menjadi Petugas Upacara Bendera',
        traitType: 'POSITIF' as const,
        points: 5,
        notes: log.notes && !log.notes.toLowerCase().includes('tidak') 
          ? log.notes 
          : 'Menjadi Petugas Upacara Bendera (Catatan Karakter Manual - Tersimpan Permanen)',
        evaluatorName: log.evaluatorName || 'Pembina Upacara / Guru Piket',
        isManual: true
      };
    }

    return log;
  });

  // Pastikan log Petugas Upacara Bendera untuk Desi Aolia & Liana Sari (KELAS 9 D) selalu ada dan terjaga
  const desiUpacaraId = 'log-manual-upacara-std-1788095216502-102-2026-10-05';
  const hasDesiUpacara = repairedLogs.some(l => 
    l && (l.id === desiUpacaraId || (l.studentId === 'std-1788095216502-102' && (l.traitName || '').toLowerCase().includes('petugas')))
  );
  if (!hasDesiUpacara) {
    unmarkCharacterLogDeleted(desiUpacaraId);
    repairedLogs.unshift({
      id: desiUpacaraId,
      studentId: 'std-1788095216502-102',
      studentName: 'DESI AOLIA',
      nisn: '0102592524',
      classId: 'cls-kelas-9-d-1788095216502-36',
      className: 'KELAS 9 D',
      traitId: 'trait-017',
      traitName: 'Menjadi Petugas Upacara Bendera',
      traitType: 'POSITIF',
      points: 5,
      evaluatorName: 'Pembina Upacara / Guru Piket',
      timestamp: '2026-10-05 07:15:00',
      date: '2026-10-05',
      notes: 'Menjadi Petugas Upacara Bendera hari Senin (Disiplin, Kepemimpinan, dan Tanggung Jawab)',
      isManual: true
    });
    repairedCount++;
  }

  const lianaUpacaraId = 'log-manual-upacara-std-1788095216503-223-2026-10-05';
  const hasLianaUpacara = repairedLogs.some(l => 
    l && (l.id === lianaUpacaraId || (l.studentId === 'std-1788095216503-223' && (l.traitName || '').toLowerCase().includes('petugas')))
  );
  if (!hasLianaUpacara) {
    unmarkCharacterLogDeleted(lianaUpacaraId);
    repairedLogs.unshift({
      id: lianaUpacaraId,
      studentId: 'std-1788095216503-223',
      studentName: 'LIANA SARI',
      nisn: '0119547150',
      classId: 'cls-kelas-9-d-1788095216502-36',
      className: 'KELAS 9 D',
      traitId: 'trait-017',
      traitName: 'Menjadi Petugas Upacara Bendera',
      traitType: 'POSITIF',
      points: 5,
      evaluatorName: 'Pembina Upacara / Guru Piket',
      timestamp: '2026-10-05 07:15:00',
      date: '2026-10-05',
      notes: 'Menjadi Petugas Upacara Bendera hari Senin (Disiplin, Kepemimpinan, dan Tanggung Jawab)',
      isManual: true
    });
    repairedCount++;
  }

  return { repairedLogs, repairedCount };
}

export function saveCharacterTraits(traits: CharacterTrait[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(traits);
  safeSetLocalStorage(KEYS.CHARACTER_TRAITS, dataStr);
  safeSetLocalStorage(KEYS.CHARACTER_TRAITS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_TRAITS, traits, false, now);
}

/**
 * Menentukan apakah sebuah log penilaian karakter diinput secara manual oleh guru/admin,
 * sehingga terlindungi dan tidak boleh dihapus oleh mekanisme pembersihan otomatis.
 */
export function isManualCharacterLog(log: StudentCharacterLog): boolean {
  if (!log) return false;
  if (log.isManual === true) return true;
  if (log.id && log.id.startsWith('log-manual-')) return true;

  // Catatan penalti otomatis yang dibuat sistem
  if (
    log.id && (
      log.id.startsWith('auto-unscanned-') ||
      log.id.startsWith('auto-unreturned-') ||
      log.id.startsWith('auto-alpa-') ||
      log.id.startsWith('auto-late-') ||
      log.id.startsWith('auto-ontime-') ||
      log.id.startsWith('log-auto-')
    )
  ) {
    return false;
  }

  if (log.evaluatorName && log.evaluatorName.includes('16:00 WITA')) return false;
  if (log.notes && (log.notes.includes('Penilaian Otomatis Presensi') || log.notes.includes('Sistem Otomatis (16:00 WITA)'))) return false;

  // Semua log positif atau log non-otomatis lainnya diklasifikasikan sebagai manual/penting
  return true;
}

/**
 * Mengambil seluruh catatan karakter manual dari cadangan permanen aman.
 */
export function getPermanentManualCharacterLogs(): StudentCharacterLog[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(SAFE_MANUAL_CHARACTER_LOGS_BACKUP_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Menghilangkan catatan log karakter yang memiliki ID duplikat atau data kembar identik
 * sehingga komponen React bebas dari duplikasi dan tidak memunculkan log ganda.
 */
export function deduplicateCharacterLogs(logs: StudentCharacterLog[]): StudentCharacterLog[] {
  if (!Array.isArray(logs)) return [];
  const deletedIds = getDeletedCharacterLogIds();
  const idMap = new Map<string, StudentCharacterLog>();
  const semanticSet = new Set<string>();

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (!log) continue;
    const cleanId = log.id ? String(log.id).trim() : `log-item-${log.studentId || i}-${log.date || ''}-${i}`;

    // Saring log yang ada di daftar ID terhapus
    if (deletedIds.has(cleanId)) continue;

    // Kunci semantik unik: nama/id/nisn siswa + tanggal + trait + timestamp + points + catatan
    const studentIdentifier = log.studentId || log.nisn || (log.studentName || '').trim().toLowerCase();
    const semanticKey = `${studentIdentifier}_${log.date || ''}_${log.traitId || log.traitName || ''}_${log.points || 0}_${log.traitType || ''}_${log.timestamp || ''}_${(log.notes || '').trim()}`;
    if (semanticSet.has(semanticKey)) continue;

    if (!idMap.has(cleanId)) {
      semanticSet.add(semanticKey);
      idMap.set(cleanId, { ...log, id: cleanId });
    }
  }
  return Array.from(idMap.values());
}

/**
 * Memeriksa apakah URL bukti foto merupakan foto asli yang diunggah/diambil kamera,
 * dan bukan foto demo/contoh placeholder dari Unsplash.
 */
export function isRealPhotoProof(url?: string | null): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '' || url === '-') return false;
  if (url.includes('images.unsplash.com')) return false;
  return true;
}

/**
 * Memeriksa apakah suatu catatan karakter milik seorang siswa tertentu
 * dengan pencocokan multi-field yang tangguh (ID, NISN, NIS, atau Nama Lengkap).
 * Menjamin nilai karakter konsisten di seluruh perangkat, role, dan tabel laporan.
 */
export function isLogForStudent(
  log: StudentCharacterLog, 
  student: { id?: string; nisn?: string; nis?: string; name?: string }
): boolean {
  if (!log || !student) return false;
  const sId = (student.id || '').trim();
  const lId = (log.studentId || '').trim();
  if (sId && lId && sId === lId) return true;

  const sNisn = (student.nisn || '').trim();
  const lNisn = (log.nisn || '').trim();
  if (sNisn && lNisn && sNisn !== '-' && lNisn !== '-' && sNisn === lNisn) return true;

  const sNis = ((student as any).nis || '').trim();
  const lNis = ((log as any).nis || '').trim();
  if (sNis && lNis && sNis !== '-' && lNis !== '-' && sNis === lNis) return true;

  const sName = (student.name || '').trim().toLowerCase();
  const lName = (log.studentName || '').trim().toLowerCase();
  if (sName && lName && sName === lName) return true;

  return false;
}

/**
 * Menghitung rekapitulasi poin karakter positif, negatif, skor bersih, dan daftar log siswa
 * secara seragam dan konsisten untuk seluruh komponen (Admin, Guru, Wali Murid, Laporan PDF).
 */
export function calculateStudentCharacterSummary(
  student: { id?: string; nisn?: string; nis?: string; name?: string },
  logs: StudentCharacterLog[]
): {
  positivePoints: number;
  negativePoints: number;
  netScore: number;
  totalEntries: number;
  logs: StudentCharacterLog[];
} {
  const rawLogs = (logs || []).filter(l => isLogForStudent(l, student));
  const studentLogs = deduplicateCharacterLogs(rawLogs);

  let positivePoints = 0;
  let negativePoints = 0;

  studentLogs.forEach(l => {
    const pts = Math.abs(l.points || 0);
    if (l.traitType === 'POSITIF') {
      positivePoints += pts;
    } else {
      negativePoints += pts;
    }
  });

  return {
    positivePoints,
    negativePoints,
    netScore: positivePoints - negativePoints,
    totalEntries: studentLogs.length,
    logs: studentLogs
  };
}

/**
 * Mengambil daftar ID catatan karakter yang telah dihapus oleh pengguna/sistem
 * sehingga tidak dibangkitkan kembali oleh sinkronisasi Cloud Firestore.
 */
export function getDeletedCharacterLogIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_CHARACTER_LOGS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Menandai ID catatan karakter sebagai dihapus (permanen hingga diinput ulang).
 */
export function markCharacterLogDeleted(logId: string): void {
  if (!logId || typeof window === 'undefined') return;
  const current = getDeletedCharacterLogIds();
  const cleanId = logId.trim();
  if (!current.has(cleanId)) {
    current.add(cleanId);
    const arr = Array.from(current).slice(-1000);
    safeSetLocalStorage(DELETED_CHARACTER_LOGS_KEY, JSON.stringify(arr));
    syncToCloud(DELETED_CHARACTER_LOGS_KEY, arr, false);
  }
}

/**
 * Menghapus tanda terhapus hanya di lokal/memori tanpa memicu penulisan rekursif ke Cloud.
 * Sangat penting untuk fungsi penormalan data (pure getters) agar tidak terjadi infinite write loop.
 */
export function unmarkCharacterLogDeletedLocally(logId: string): void {
  if (!logId || typeof window === 'undefined') return;
  const current = getDeletedCharacterLogIds();
  const cleanId = logId.trim();
  if (current.has(cleanId)) {
    current.delete(cleanId);
    const arr = Array.from(current);
    safeSetLocalStorage(DELETED_CHARACTER_LOGS_KEY, JSON.stringify(arr));
  }
}

/**
 * Menghapus tanda dihapus jika catatan tersebut sengaja dibuat/disimpan kembali.
 */
export function unmarkCharacterLogDeleted(logId: string): void {
  if (!logId || typeof window === 'undefined') return;
  const current = getDeletedCharacterLogIds();
  const cleanId = logId.trim();
  if (current.has(cleanId)) {
    current.delete(cleanId);
    const arr = Array.from(current);
    safeSetLocalStorage(DELETED_CHARACTER_LOGS_KEY, JSON.stringify(arr));
    syncToCloud(DELETED_CHARACTER_LOGS_KEY, arr, false);
  }
}

/**
 * Menghapus catatan karakter manual dari cadangan permanen aman ketika pengguna menghapusnya.
 * Membersihkan ID target beserta seluruh duplikat kembarannya jika ada.
 */
export function deletePermanentManualCharacterLog(logId: string): void {
  if (typeof window === 'undefined' || !logId) return;
  const targetId = logId.trim();
  markCharacterLogDeleted(targetId);
  const currentBackup = getPermanentManualCharacterLogs();
  const targetInBackup = currentBackup.find(l => l && l.id && l.id.trim() === targetId);

  const filtered = currentBackup.filter(l => {
    if (!l) return false;
    const cleanId = l.id ? l.id.trim() : '';
    if (cleanId === targetId) return false;
    // Bersihkan juga catatan kembar identik yang memiliki siswa, tanggal, dan trait yang sama
    if (
      targetInBackup &&
      l.studentId === targetInBackup.studentId &&
      l.date === targetInBackup.date &&
      (l.traitId === targetInBackup.traitId || l.traitName === targetInBackup.traitName) &&
      l.timestamp === targetInBackup.timestamp
    ) {
      if (cleanId) markCharacterLogDeleted(cleanId);
      return false;
    }
    return true;
  });

  safeSetLocalStorage(SAFE_MANUAL_CHARACTER_LOGS_BACKUP_KEY, JSON.stringify(filtered));
}

/**
 * Menyimpan dan menggabungkan catatan karakter manual ke cadangan permanen aman.
 */
export function savePermanentManualCharacterLogs(newManualLogs: StudentCharacterLog[]): void {
  if (typeof window === 'undefined' || !newManualLogs || newManualLogs.length === 0) return;
  const deletedIds = getDeletedCharacterLogIds();
  const currentBackup = getPermanentManualCharacterLogs();
  const map = new Map<string, StudentCharacterLog>();

  // Masukkan data cadangan yang sudah ada (abaikan yang terhapus)
  currentBackup.forEach(l => {
    if (l && l.id) {
      const cleanId = l.id.trim();
      if (!deletedIds.has(cleanId)) {
        map.set(cleanId, l);
      }
    }
  });

  // Tambahkan/perbarui catatan manual baru dengan flag isManual: true
  newManualLogs.forEach(l => {
    if (isManualCharacterLog(l) && l && l.id) {
      const cleanId = l.id.trim();
      if (!deletedIds.has(cleanId)) {
        map.set(cleanId, { ...l, isManual: true });
      }
    }
  });

  const merged = deduplicateCharacterLogs(Array.from(map.values()));
  safeSetLocalStorage(SAFE_MANUAL_CHARACTER_LOGS_BACKUP_KEY, JSON.stringify(merged));
}

export function getStudentCharacterLogs(): StudentCharacterLog[] {
  const data = localStorage.getItem(KEYS.CHARACTER_LOGS);
  let logs: StudentCharacterLog[] = [];

  if (data === null) {
    safeSetLocalStorage(KEYS.CHARACTER_LOGS, JSON.stringify(INITIAL_STUDENT_CHARACTER_LOGS));
    safeSetLocalStorage(KEYS.CHARACTER_LOGS + '_updatedAt', '1');
    logs = [...INITIAL_STUDENT_CHARACTER_LOGS];
  } else {
    try {
      const parsed = JSON.parse(data);
      logs = Array.isArray(parsed) ? parsed : [];
    } catch {
      logs = [];
    }
  }

  // 1. Dapatkan daftar ID catatan karakter yang dihapus secara manual/sistem
  const deletedIds = getDeletedCharacterLogIds();
  if (deletedIds.size > 0) {
    logs = logs.filter(l => {
      if (!l || !l.id) return false;
      // ATURAN MUTLAK: Nilai karakter yang diinput guru dilarang keras dihapus oleh sistem!
      // Nilai guru selalu ditampilkan dalam detail karakter dan hanya bisa dihapus oleh Admin
      if (isManualCharacterLog(l)) return true;
      return !deletedIds.has(l.id.trim());
    });
  }

  // 2. Cadangan darurat offline: HANYA jika logs benar-benar kosong, gunakan cadangan lokal manual yang belum dihapus
  if (logs.length === 0) {
    const permanentManuals = getPermanentManualCharacterLogs();
    if (permanentManuals.length > 0) {
      const validManuals = permanentManuals.filter(pLog => {
        const pId = pLog.id?.trim();
        return pId && !deletedIds.has(pId);
      });
      if (validManuals.length > 0) {
        logs = [...validManuals];
      }
    }
  }

  // 3. Normalisasi log Upacara & KBM
  const upacaraResult = repairUpacaraLogs(logs);
  const kbmResult = repairKbmActiveLogs(upacaraResult.repairedLogs);
  let finalLogs = deduplicateCharacterLogs(kbmResult.repairedLogs);

  if (deletedIds.size > 0) {
    finalLogs = finalLogs.filter(l => {
      if (!l || !l.id) return false;
      if (isManualCharacterLog(l)) return true;
      return !deletedIds.has(l.id.trim());
    });
  }

  return finalLogs;
}

export function saveStudentCharacterLogs(logs: StudentCharacterLog[], instantCloudSync: boolean = true): void {
  const now = Date.now();
  const deletedSet = getDeletedCharacterLogIds();

  // Pastikan seluruh log dinormalkan sebelum disimpan (Upacara +5 poin & Sangat Aktif KBM)
  const upacaraResult = repairUpacaraLogs(logs);
  const kbmResult = repairKbmActiveLogs(upacaraResult.repairedLogs);
  let cleanLogs = deduplicateCharacterLogs(kbmResult.repairedLogs);

  // Pastikan log otomatis yang terhapus dibersihkan, tetapi nilai yang diinput guru DILINDUNGI PENUH
  if (deletedSet.size > 0) {
    cleanLogs = cleanLogs.filter(l => {
      if (!l || !l.id) return false;
      if (isManualCharacterLog(l)) return true;
      return !deletedSet.has(l.id.trim());
    });
  }

  // Amankan seluruh catatan manual aktif ke brankas permanen
  const manualLogs = cleanLogs.filter(isManualCharacterLog).map(l => ({ ...l, isManual: true }));
  safeSetLocalStorage(SAFE_MANUAL_CHARACTER_LOGS_BACKUP_KEY, JSON.stringify(manualLogs));

  const dataStr = JSON.stringify(cleanLogs);
  safeSetLocalStorage(KEYS.CHARACTER_LOGS, dataStr);
  safeSetLocalStorage(KEYS.CHARACTER_LOGS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_LOGS, cleanLogs, instantCloudSync, now);
}

// Local-only save for character log cleanup so gate QR scanning NEVER triggers Cloud writes for character logs
export function saveStudentCharacterLogsLocally(logs: StudentCharacterLog[]): void {
  const now = Date.now();
  const deletedSet = getDeletedCharacterLogIds();
  const upacaraResult = repairUpacaraLogs(logs);
  const kbmResult = repairKbmActiveLogs(upacaraResult.repairedLogs);
  let cleanLogs = deduplicateCharacterLogs(kbmResult.repairedLogs);

  if (deletedSet.size > 0) {
    cleanLogs = cleanLogs.filter(l => {
      if (!l || !l.id) return false;
      if (isManualCharacterLog(l)) return true;
      return !deletedSet.has(l.id.trim());
    });
  }

  const manualLogs = cleanLogs.filter(isManualCharacterLog).map(l => ({ ...l, isManual: true }));
  safeSetLocalStorage(SAFE_MANUAL_CHARACTER_LOGS_BACKUP_KEY, JSON.stringify(manualLogs));

  const dataStr = JSON.stringify(cleanLogs);
  safeSetLocalStorage(KEYS.CHARACTER_LOGS, dataStr);
  safeSetLocalStorage(KEYS.CHARACTER_LOGS + '_updatedAt', String(now));
  notifyStorageUpdated();
}

/**
 * Memulihkan seluruh catatan karakter manual yang pernah diinput dan menyinkronkannya kembali.
 */
export function restoreAllManualCharacterLogs(): { restoredCount: number; allLogs: StudentCharacterLog[] } {
  const currentLogs = getStudentCharacterLogs();
  const permanentManuals = getPermanentManualCharacterLogs();
  const deletedIds = getDeletedCharacterLogIds();
  const existingIds = new Set(currentLogs.map(l => l.id?.trim()).filter(Boolean));

  let restoredCount = 0;
  const merged = [...currentLogs];

  permanentManuals.forEach(pLog => {
    const pId = pLog.id?.trim();
    if (pId && !existingIds.has(pId) && !deletedIds.has(pId)) {
      merged.unshift(pLog);
      existingIds.add(pId);
      restoredCount++;
    }
  });

  const upacaraResult = repairUpacaraLogs(merged);
  const kbmResult = repairKbmActiveLogs(upacaraResult.repairedLogs);
  const finalLogs = deduplicateCharacterLogs(kbmResult.repairedLogs);
  restoredCount += (upacaraResult.repairedCount + kbmResult.repairedCount);

  saveStudentCharacterLogs(finalLogs);

  return { restoredCount, allLogs: finalLogs };
}

export function getCharacterPredicateSettings(): CharacterPredicateSettings {
  const data = localStorage.getItem(KEYS.CHARACTER_PREDICATES);
  if (data === null) {
    safeSetLocalStorage(KEYS.CHARACTER_PREDICATES, JSON.stringify(INITIAL_CHARACTER_PREDICATES));
    safeSetLocalStorage(KEYS.CHARACTER_PREDICATES + '_updatedAt', '1');
    return INITIAL_CHARACTER_PREDICATES;
  }
  try {
    const parsed = JSON.parse(data);
    return {
      minA: typeof parsed.minA === 'number' ? parsed.minA : 30,
      minB: typeof parsed.minB === 'number' ? parsed.minB : 10,
      minC: typeof parsed.minC === 'number' ? parsed.minC : 0,
      minD: typeof parsed.minD === 'number' ? parsed.minD : -20,
      minE: typeof parsed.minE === 'number' ? parsed.minE : -50,
    };
  } catch {
    return INITIAL_CHARACTER_PREDICATES;
  }
}

export function saveCharacterPredicateSettings(settings: CharacterPredicateSettings): void {
  const now = Date.now();
  const dataStr = JSON.stringify(settings);
  safeSetLocalStorage(KEYS.CHARACTER_PREDICATES, dataStr);
  safeSetLocalStorage(KEYS.CHARACTER_PREDICATES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_PREDICATES, settings, false, now);
}

export function getStudentGradeAssessments(): StudentGradeAssessment[] {
  const data = localStorage.getItem(KEYS.GRADES);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveStudentGradeAssessments(assessments: StudentGradeAssessment[], instant: boolean = true): void {
  const now = Date.now();
  const dataStr = JSON.stringify(assessments);
  safeSetLocalStorage(KEYS.GRADES, dataStr);
  safeSetLocalStorage(KEYS.GRADES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.GRADES, assessments, instant, now);
}

export function getUserSession(): UserSession | null {
  const data = localStorage.getItem(KEYS.SESSION);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveUserSession(session: UserSession | null): void {
  if (!session) {
    localStorage.removeItem(KEYS.SESSION);
  } else {
    safeSetLocalStorage(KEYS.SESSION, JSON.stringify(session));
  }
  notifyStorageUpdated();
}

// Lesson Periods (JP) Storage
export function getLessonPeriods(): LessonPeriod[] {
  const data = localStorage.getItem(KEYS.PERIODS);
  if (data === null) {
    safeSetLocalStorage(KEYS.PERIODS, JSON.stringify(INITIAL_LESSON_PERIODS));
    safeSetLocalStorage(KEYS.PERIODS + '_updatedAt', '1');
    return INITIAL_LESSON_PERIODS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_LESSON_PERIODS;
  } catch {
    return INITIAL_LESSON_PERIODS;
  }
}

export function saveLessonPeriods(periods: LessonPeriod[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(periods);
  safeSetLocalStorage(KEYS.PERIODS, dataStr);
  safeSetLocalStorage(KEYS.PERIODS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.PERIODS, periods, true, now);
}

// Class Schedules Storage
export function getClassSchedules(): ClassScheduleSlot[] {
  const data = localStorage.getItem(KEYS.SCHEDULES);
  if (data === null) {
    safeSetLocalStorage(KEYS.SCHEDULES, JSON.stringify(INITIAL_CLASS_SCHEDULES));
    safeSetLocalStorage(KEYS.SCHEDULES + '_updatedAt', '1');
    return INITIAL_CLASS_SCHEDULES;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return INITIAL_CLASS_SCHEDULES;
  }
}

export function saveClassSchedules(schedules: ClassScheduleSlot[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(schedules);
  safeSetLocalStorage(KEYS.SCHEDULES, dataStr);
  safeSetLocalStorage(KEYS.SCHEDULES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.SCHEDULES, schedules, true, now);
}

export function saveSingleClassScheduleSlot(slot: ClassScheduleSlot): void {
  const current = getClassSchedules();
  const existingIdx = current.findIndex(s => s.id === slot.id);
  let updated: ClassScheduleSlot[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = slot;
  } else {
    // If there's an existing slot for same classId, day, and periodNumber, replace it
    const sameSlotIdx = current.findIndex(s => s.classId === slot.classId && s.day === slot.day && s.periodNumber === slot.periodNumber);
    if (sameSlotIdx >= 0) {
      updated = [...current];
      updated[sameSlotIdx] = slot;
    } else {
      updated = [...current, slot];
    }
  }
  saveClassSchedules(updated);
}

export function deleteClassScheduleSlot(slotId: string): void {
  const current = getClassSchedules();
  const updated = current.filter(s => s.id !== slotId);
  saveClassSchedules(updated);
}

export function clearClassSchedules(classId?: string): void {
  const current = getClassSchedules();
  const updated = classId ? current.filter(s => s.classId !== classId) : [];
  saveClassSchedules(updated);
}

export function copyClassSchedule(sourceClassId: string, targetClassId: string, targetClassName: string, overwrite: boolean = true): void {
  const current = getClassSchedules();
  const sourceSlots = current.filter(s => s.classId === sourceClassId);
  
  let updated: ClassScheduleSlot[];
  if (overwrite) {
    updated = current.filter(s => s.classId !== targetClassId);
  } else {
    updated = [...current];
  }

  const newSlots: ClassScheduleSlot[] = sourceSlots.map((s, idx) => ({
    ...s,
    id: `sch-${targetClassId}-${s.day.toLowerCase().slice(0, 3)}-${s.periodNumber}-${Date.now()}-${idx}`,
    classId: targetClassId,
    className: targetClassName,
  }));

  if (!overwrite) {
    // Filter out conflicts if not overwriting
    newSlots.forEach(ns => {
      const exists = updated.some(u => u.classId === targetClassId && u.day === ns.day && u.periodNumber === ns.periodNumber);
      if (!exists) {
        updated.push(ns);
      }
    });
  } else {
    updated.push(...newSlots);
  }

  saveClassSchedules(updated);
}

export function resetToDefaultData(): void {
  localStorage.clear();
  const now = Date.now();
  safeSetLocalStorage(KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
  safeSetLocalStorage(KEYS.STUDENTS + '_updatedAt', String(now));
  getSchoolProfile();
  getSchoolClasses();
  getAttendanceRecords();
  getLeaveRequests();
  getTeachers();
  getCharacterTraits();
  getStudentCharacterLogs();
  getCharacterPredicateSettings();
  getLessonPeriods();
  getClassSchedules();
  notifyStorageUpdated();
}

