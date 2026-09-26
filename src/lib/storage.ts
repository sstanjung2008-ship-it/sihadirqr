import { SchoolProfile, SchoolClass, Student, AttendanceRecord, LeaveRequest, Teacher, LearningJournal, CharacterTrait, StudentCharacterLog, CharacterPredicateSettings, UserSession, StudentGradeAssessment, LessonPeriod, ClassScheduleSlot } from '../types';
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
import { db, doc, setDoc, getDoc, deleteDoc, onSnapshot } from './firebase';
import firebaseConfigData from '../../firebase-applet-config.json';

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

export function isFirestoreQuotaExceeded(): boolean {
  if (typeof window === 'undefined') return false;
  // Database berbayar Blaze / custom database tidak terikat batas kuota harian gratis 20.000 write
  if (firebaseConfigData.firestoreDatabaseId && firebaseConfigData.firestoreDatabaseId !== '(default)') {
    return false;
  }
  try {
    const stored = Number(localStorage.getItem(QUOTA_COOLDOWN_KEY) || '0');
    return Date.now() < stored;
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
 * Safe LocalStorage setter that gracefully catches QuotaExceededError,
 * compacts attendance records, and removes stale temporary cache without crashing.
 */
export function safeSetLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;

  let valueToStore = value;

  // Selalu validasi & bersihkan data presensi sebelum disimpan ke LocalStorage & cadangan aman
  if (key === KEYS.ATTENDANCE) {
    try {
      const records = JSON.parse(value);
      if (Array.isArray(records)) {
        const clean = validateAndSanitizeAttendanceRecords(records);
        valueToStore = JSON.stringify(clean);
        if (clean.length > 0) {
          localStorage.setItem(SAFE_ATTENDANCE_BACKUP_KEY, valueToStore);
        }
      }
    } catch {}
  }

  try {
    localStorage.setItem(key, valueToStore);
  } catch (err: any) {
    console.warn(`[Storage Quota Warning] LocalStorage penuh saat menyimpan ${key}. Mengoptimalkan data...`);
    
    // 1. If key is ATTENDANCE, compact & trim older history with guaranteed real-date priority
    if (key === KEYS.ATTENDANCE) {
      try {
        const records = JSON.parse(valueToStore);
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

          let compStr = JSON.stringify(compacted);
          try {
            localStorage.setItem(key, compStr);
            return;
          } catch {
            // Keep the most recent 1,500 real records (strictly sorted by valid date)
            compacted.sort((a: any, b: any) => {
              const dComp = (b.date || '').localeCompare(a.date || '');
              if (dComp !== 0) return dComp;
              return (b.time || '').localeCompare(a.time || '');
            });
            const recent = compacted.slice(0, 1500);
            compStr = JSON.stringify(recent);
            localStorage.setItem(key, compStr);
            return;
          }
        }
      } catch (e) {
        console.error('[Storage Compact Error]:', e);
      }
    }

    // 2. Clear non-critical caches if any
    try {
      const keysToClear = ['sihadir_temp_cache', 'sihadir_cached_export', 'sihadir_wa_queue'];
      keysToClear.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(key, valueToStore);
    } catch {
      console.warn(`[Storage Quota Warning] Tidak dapat menulis ${key} ke LocalStorage (kuota penuh).`);
    }
  }
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
      isChunked: false,
      totalChunks: 1,
    });
    // Hapus pecahan chunk lama jika ada agar tidak lagi memicu getDoc read berlebih
    const previousChunks = knownChunkedDocs.get(key) || 0;
    if (previousChunks > 1) {
      for (let i = 1; i < previousChunks; i++) {
        deleteDoc(doc(db, 'sihadir_app_data', `${key}_chunk_${i}`)).catch(() => {});
      }
      knownChunkedDocs.delete(key);
    }
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
      isChunked: true,
      totalChunks: numChunks,
    });
  }
}

export async function writeCloudDocument(key: string, dataStr: string, timestamp: number): Promise<void> {
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
    return { data: fullDataStr, updatedAt };
  } catch (err) {
    console.error(`[Firestore Sync] Error reading cloud document for ${key}:`, err);
    return null;
  }
}

// Debounced and deduped push to Firestore with Auto-Chunking support
export function syncToCloud(key: string, data: any, instant: boolean = false, explicitTimestamp?: number) {
  if (typeof window === 'undefined') return;

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
 */
export function getLocalDateString(dateInput: Date | number | string = new Date()): string {
  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      d = new Date(dateInput);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = new Date();
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
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
        localStorage.setItem(k, str);
        localStorage.setItem(k + '_updatedAt', String(now));
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

export function mergeTeacherLists(local: Teacher[], cloud: Teacher[]): Teacher[] {
  const isDemoTeacher = (t: Teacher) => DEMO_TEACHER_IDS.has(t.id) || (!!t.nip && DEMO_TEACHER_NIPS.has(t.nip.trim()));
  const hasRealTeachers = local.some(t => !isDemoTeacher(t)) || cloud.some(t => !isDemoTeacher(t));
  const isDemoCleared = (typeof window !== 'undefined' && localStorage.getItem(DEMO_DATA_CLEARED_KEY) === 'true') || hasRealTeachers;

  // Once real teachers exist in local or cloud, demo teachers must never be preserved or resurrected!
  const effectiveCloud = isDemoCleared ? cloud.filter(t => !isDemoTeacher(t)) : cloud;
  const effectiveLocal = isDemoCleared ? local.filter(t => !isDemoTeacher(t)) : local;

  const map = new Map<string, Teacher>();
  
  // 1. Index cloud teachers
  effectiveCloud.forEach(t => {
    const key = (t.nip && t.nip.trim()) || t.id;
    if (key) map.set(key, { ...t });
  });

  // 2. Merge local teachers preserving custom passwords & photos across devices
  effectiveLocal.forEach(localItem => {
    const key = (localItem.nip && localItem.nip.trim()) || localItem.id;
    if (!key) return;

    if (map.has(key)) {
      const cloudItem = map.get(key)!;

      // Preserve custom password:
      // If either cloud or local has a custom password, prioritize it so it never reverts to default on device sync
      const isCloudCustomPass = !!cloudItem.password && cloudItem.password !== '123456';
      const isLocalCustomPass = !!localItem.password && localItem.password !== '123456';

      let bestPassword = cloudItem.password || localItem.password;
      if (isCloudCustomPass) {
        bestPassword = cloudItem.password;
      } else if (isLocalCustomPass) {
        bestPassword = localItem.password;
      }

      // Determine best photo
      const isCloudRealPhoto = !!cloudItem.photoUrl && !cloudItem.photoUrl.includes('unsplash.com');
      const isLocalRealPhoto = !!localItem.photoUrl && !localItem.photoUrl.includes('unsplash.com');
      let bestPhoto = cloudItem.photoUrl || localItem.photoUrl;
      if (isCloudRealPhoto && !isLocalRealPhoto) {
        bestPhoto = cloudItem.photoUrl;
      } else if (!isCloudRealPhoto && isLocalRealPhoto) {
        bestPhoto = localItem.photoUrl;
      }

      const merged: Teacher = {
        ...localItem,
        ...cloudItem,
        name: cloudItem.name || localItem.name,
        nip: cloudItem.nip || localItem.nip,
        phone: cloudItem.phone || localItem.phone,
        email: cloudItem.email || localItem.email,
        subject1: cloudItem.subject1 || localItem.subject1,
        subject2: cloudItem.subject2 !== undefined ? cloudItem.subject2 : localItem.subject2,
        additionalDuty: cloudItem.additionalDuty || localItem.additionalDuty,
        homeroomClassId: cloudItem.homeroomClassId !== undefined ? cloudItem.homeroomClassId : localItem.homeroomClassId,
        homeroomClassName: cloudItem.homeroomClassName !== undefined ? cloudItem.homeroomClassName : localItem.homeroomClassName,
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

  return {
    updatedTeachers,
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

export function mergeAttendanceLists(local: AttendanceRecord[], cloud: AttendanceRecord[]): AttendanceRecord[] {
  const cleanLocal = validateAndSanitizeAttendanceRecords(local);
  const cleanCloud = validateAndSanitizeAttendanceRecords(cloud);

  if (cleanLocal.length === 0) return cleanCloud;
  if (cleanCloud.length === 0) return cleanLocal;

  const getValidEntryTime = (t1?: string, t2?: string): string => {
    if (t1 && t1 !== '-' && t1.trim()) return t1;
    if (t2 && t2 !== '-' && t2.trim()) return t2;
    return '-';
  };

  const getValidReturnTime = (t1?: string, t2?: string): string | undefined => {
    if (t1 && t1 !== '-' && t1.trim()) return t1;
    if (t2 && t2 !== '-' && t2.trim()) return t2;
    return undefined;
  };

  const getValidReturnStatus = (s1?: AttendanceRecord['returnStatus'], s2?: AttendanceRecord['returnStatus']): AttendanceRecord['returnStatus'] | undefined => {
    const isCompleted = (s?: string) => s === 'PULANG' || s === 'PULANG_CEPAT' || s === 'PULANG_TEPAT';
    if (isCompleted(s1)) return s1;
    if (isCompleted(s2)) return s2;
    if (s1 && s1 !== 'BELUM_PULANG') return s1;
    if (s2 && s2 !== 'BELUM_PULANG') return s2;
    return s1 || s2;
  };

  const mergeSingleRecord = (localRec: AttendanceRecord, cloudRec: AttendanceRecord): AttendanceRecord => {
    const isLocalReal = isRealAttendance(localRec);
    const isCloudReal = isRealAttendance(cloudRec);

    let base: AttendanceRecord;
    if (isCloudReal && !isLocalReal) {
      base = { ...cloudRec };
    } else if (!isCloudReal && isLocalReal) {
      base = { ...localRec };
    } else {
      // Both are real, or both are auto-alpa
      const bestStatus = (cloudRec.status && cloudRec.status !== 'ALPA') 
        ? cloudRec.status 
        : (localRec.status && localRec.status !== 'ALPA' ? localRec.status : (cloudRec.status || localRec.status || 'HADIR'));
      const bestMethod = (cloudRec.method === 'QR_SCAN' || localRec.method === 'QR_SCAN') 
        ? 'QR_SCAN' 
        : (cloudRec.method || localRec.method || 'QR_SCAN');
      const bestScannedBy = (cloudRec.scannedBy && !cloudRec.scannedBy.includes('Sistem Otomatis')) 
        ? cloudRec.scannedBy 
        : (localRec.scannedBy || cloudRec.scannedBy);

      base = {
        ...localRec,
        ...cloudRec,
        status: bestStatus,
        method: bestMethod,
        scannedBy: bestScannedBy,
        notes: cloudRec.notes || localRec.notes || undefined,
      };
    }

    // Always merge entry time: if either has a non-'-' time, keep it!
    base.time = getValidEntryTime(cloudRec.time, localRec.time);

    // Always merge return time & return status: never lose pulang scan!
    const returnTime = getValidReturnTime(cloudRec.returnTime, localRec.returnTime);
    if (returnTime) {
      base.returnTime = returnTime;
    }
    const returnStatus = getValidReturnStatus(cloudRec.returnStatus, localRec.returnStatus);
    if (returnStatus) {
      base.returnStatus = returnStatus;
    }
    const returnScannedBy = (cloudRec.returnScannedBy && !cloudRec.returnScannedBy.includes('Sistem Otomatis'))
      ? cloudRec.returnScannedBy
      : (localRec.returnScannedBy || cloudRec.returnScannedBy);
    if (returnScannedBy) {
      base.returnScannedBy = returnScannedBy;
    }

    return base;
  };

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

  // 1. Add all local records (O(N))
  for (let i = 0; i < cleanLocal.length; i++) {
    const a = cleanLocal[i];
    if (!a) continue;
    const idx = findIndexForRecord(a);
    if (idx >= 0) {
      recordsList[idx] = mergeSingleRecord(recordsList[idx], a);
      registerIndices(idx, recordsList[idx]);
    } else {
      const newIdx = recordsList.length;
      recordsList.push({ ...a });
      registerIndices(newIdx, a);
    }
  }

  // 2. Merge cloud records (O(M))
  for (let i = 0; i < cleanCloud.length; i++) {
    const cloudRec = cleanCloud[i];
    if (!cloudRec) continue;
    const idx = findIndexForRecord(cloudRec);
    if (idx >= 0) {
      recordsList[idx] = mergeSingleRecord(recordsList[idx], cloudRec);
      registerIndices(idx, recordsList[idx]);
    } else {
      const newIdx = recordsList.length;
      recordsList.push({ ...cloudRec });
      registerIndices(newIdx, cloudRec);
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
        unscannedPoints: 1,
        unreturnedPoints: 1,
      }),
      ...(local.autoCharacterPoints || {}),
      ...(cloud.autoCharacterPoints || {}),
    },
    lateToleranceMinutes: typeof cloud.lateToleranceMinutes === 'number' ? cloud.lateToleranceMinutes : (typeof local.lateToleranceMinutes === 'number' ? local.lateToleranceMinutes : (INITIAL_SCHOOL_PROFILE.lateToleranceMinutes ?? 15)),
  };
}

// Comprehensive multi-device smart synchronization (Concurrent & High-Speed)
export async function smartSyncAndMergeAllWithCloud(): Promise<{ success: boolean; studentCount: number; message: string }> {
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
    safeSetLocalStorage(KEYS.PROFILE, profileStr);
    safeSetLocalStorage(KEYS.PROFILE + '_updatedAt', String(now));

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
    safeSetLocalStorage(KEYS.STUDENTS, studentsJsonStr);
    safeSetLocalStorage(KEYS.STUDENTS + '_updatedAt', String(now));

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
    safeSetLocalStorage(KEYS.CLASSES, classesJsonStr);
    safeSetLocalStorage(KEYS.CLASSES + '_updatedAt', String(now));
    safeSetLocalStorage(KEYS.TEACHERS, teachersJsonStr);
    safeSetLocalStorage(KEYS.TEACHERS + '_updatedAt', String(now));

    // Step D: Attendance Records
    let cloudAtt: AttendanceRecord[] = [];
    if (attCloud && attCloud.data) {
      try {
        const parsed = JSON.parse(attCloud.data);
        if (Array.isArray(parsed)) {
          cloudAtt = validateAndSanitizeAttendanceRecords(parsed);
        }
      } catch (e) {
        console.warn('[Sync] Attendance cloud parse error:', e);
      }
    }
    const currentLocalAtt = getAttendanceRecords();
    const mergedAtt = mergeAttendanceLists(currentLocalAtt, cloudAtt);
    const cleanMergedAtt = validateAndSanitizeAttendanceRecords(mergedAtt);
    const attJsonStr = JSON.stringify(cleanMergedAtt);
    safeSetLocalStorage(KEYS.ATTENDANCE, attJsonStr);
    safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(now));

    // Step E: Generic Entity Merging
    const mergeAndStoreGeneric = (key: string, cloudDoc: any, getLocal: () => any[]) => {
      let cloudItems: any[] = [];
      if (cloudDoc && cloudDoc.data) {
        try {
          cloudItems = JSON.parse(cloudDoc.data);
        } catch {}
      }
      const localItems = getLocal();
      const merged = mergeGenericListsById(localItems, cloudItems);
      const jsonStr = JSON.stringify(merged);
      safeSetLocalStorage(key, jsonStr);
      safeSetLocalStorage(key + '_updatedAt', String(now));
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
    safeSetLocalStorage(KEYS.CHARACTER_PREDICATES, predicatesJsonStr);
    safeSetLocalStorage(KEYS.CHARACTER_PREDICATES + '_updatedAt', String(now));

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
    if (!isFirestoreQuotaExceeded()) {
      const writePromises: Promise<void>[] = [];
      const pushIfChanged = (key: string, localStr: string, cloudDoc: any) => {
        const cloudStr = cloudDoc?.data;
        if (!localStr) return;
        
        // Hanya tulis ke Cloud jika:
        // 1. Cloud masih kosong sama sekali tapi lokal punya data, ATAU
        // 2. Data presensi dan ada antrean scan pending, ATAU
        // 3. Timestamp lokal terbukti lebih baru daripada Cloud (ada perubahan nyata dari user perangkat ini)
        const cloudUpdatedAt = Number(cloudDoc?.updatedAt || 0);
        const localUpdatedAt = Number(localStorage.getItem(key + '_updatedAt') || 0);
        const isCloudEmpty = !cloudStr || cloudStr === '[]' || cloudStr === '{}';
        const hasPendingScans = key === KEYS.ATTENDANCE && scanQueuePendingCount > 0;
        const isLocallyModified = localUpdatedAt > (cloudUpdatedAt + 1000);

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
 * Otomatis menyinkronkan seluruh database dua arah (lokal & cloud) saat perangkat terhubung online
 */
export async function triggerAutoSyncOnOnline(silent: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Jika koneksi fisik terdeteksi offline, abaikan
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setCloudSyncStatus('offline');
    return false;
  }

  const now = Date.now();
  // Cegah eksekusi ganda / spamming dalam interval < 3 detik
  if (isAutoSyncRunning || (now - lastAutoSyncTime < 3000)) {
    return false;
  }

  if (isFirestoreQuotaExceeded()) {
    setCloudSyncStatus('quota_exceeded');
    return false;
  }

  isAutoSyncRunning = true;
  lastAutoSyncTime = now;

  try {
    if (!silent) {
      window.dispatchEvent(new CustomEvent('sihadir_network_toast', {
        detail: {
          type: 'info',
          title: '🔄 Terhubung Kembali',
          message: 'Perangkat online. Memulai sinkronisasi otomatis dengan Cloud...'
        }
      }));
    }

    const res = await smartSyncAndMergeAllWithCloud();
    if (res.success) {
      setCloudSyncStatus('connected');
      if (!silent) {
        window.dispatchEvent(new CustomEvent('sihadir_network_toast', {
          detail: {
            type: 'success',
            title: '✅ Sinkronisasi Otomatis Selesai',
            message: 'Seluruh data presensi dan sekolah telah sinkron dengan Cloud dan perangkat lain.'
          }
        }));
      }
      notifyStorageUpdated();
      return true;
    } else {
      console.warn('[Auto-Sync] Gagal menjalankan sinkronisasi otomatis:', res.message);
      return false;
    }
  } catch (err) {
    console.error('[Auto-Sync Error]:', err);
    return false;
  } finally {
    isAutoSyncRunning = false;
  }
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
            localStorage.setItem(key, mergedStr);
            localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = mergedStr;
          } catch {
            localStorage.setItem(key, cloudDoc.data);
            localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = cloudDoc.data;
          }
        } else if (key === KEYS.TEACHERS) {
          try {
            const cloudTeachers = JSON.parse(cloudDoc.data);
            if (Array.isArray(cloudTeachers)) {
              const localTeachers = getTeachers();
              const mergedTeachers = mergeTeacherLists(localTeachers, cloudTeachers);
              const mergedStr = JSON.stringify(mergedTeachers);
              localStorage.setItem(key, mergedStr);
              localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = mergedStr;
            } else {
              localStorage.setItem(key, cloudDoc.data);
              localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = cloudDoc.data;
            }
          } catch {
            localStorage.setItem(key, cloudDoc.data);
            localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = cloudDoc.data;
          }
        } else if (key === KEYS.STUDENTS) {
          try {
            const cloudStudents = JSON.parse(cloudDoc.data);
            if (Array.isArray(cloudStudents)) {
              const localStudents = getStudents();
              const mergedStudents = mergeStudentLists(localStudents, cloudStudents);
              const mergedStr = JSON.stringify(mergedStudents);
              localStorage.setItem(key, mergedStr);
              localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = mergedStr;
            } else {
              localStorage.setItem(key, cloudDoc.data);
              localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = cloudDoc.data;
            }
          } catch {
            localStorage.setItem(key, cloudDoc.data);
            localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = cloudDoc.data;
          }
        } else if (key === KEYS.ATTENDANCE) {
          try {
            const parsed = JSON.parse(cloudDoc.data);
            if (Array.isArray(parsed)) {
              const cleanCloud = validateAndSanitizeAttendanceRecords(parsed);
              const localAtt = getAttendanceRecords();
              if (cleanCloud.length === 0 && localAtt.length > 0) {
                writeCloudDocument(key, JSON.stringify(localAtt), Date.now());
                lastSavedStringCache[key] = JSON.stringify(localAtt);
              } else {
                const mergedAtt = mergeAttendanceLists(localAtt, cleanCloud);
                const cleanMerged = validateAndSanitizeAttendanceRecords(mergedAtt);
                const mergedStr = JSON.stringify(cleanMerged);
                safeSetLocalStorage(key, mergedStr);
                safeSetLocalStorage(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
                lastSavedStringCache[key] = mergedStr;
              }
            }
          } catch (e) {
            console.warn('[Storage] Gagal memuat attendance records dari cloud:', e);
          }
        } else {
          localStorage.setItem(key, cloudDoc.data);
          localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
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

// Initialize Realtime Sync from Firestore
export function initFirestoreRealtimeSync() {
  if (isFirestoreInitialized || typeof window === 'undefined') return;
  if (isFirestoreQuotaExceeded()) {
    setCloudSyncStatus('quota_exceeded');
    return;
  }
  isFirestoreInitialized = true;

  const SYNC_KEYS: Array<{ 
    key: string; 
    getDefault: () => any;
  }> = [
    { key: KEYS.PROFILE, getDefault: () => INITIAL_SCHOOL_PROFILE },
    { key: KEYS.CLASSES, getDefault: () => INITIAL_CLASSES },
    { key: KEYS.STUDENTS, getDefault: () => INITIAL_STUDENTS },
    { key: KEYS.ATTENDANCE, getDefault: () => generateInitialAttendanceHistory(INITIAL_STUDENTS) },
    { key: KEYS.LEAVES, getDefault: () => INITIAL_LEAVE_REQUESTS },
    { key: KEYS.TEACHERS, getDefault: () => INITIAL_TEACHERS },
    { key: KEYS.LEARNING_JOURNALS, getDefault: () => INITIAL_LEARNING_JOURNALS },
    { key: KEYS.CHARACTER_TRAITS, getDefault: () => INITIAL_CHARACTER_TRAITS },
    { key: KEYS.CHARACTER_LOGS, getDefault: () => INITIAL_STUDENT_CHARACTER_LOGS },
    { key: KEYS.CHARACTER_PREDICATES, getDefault: () => INITIAL_CHARACTER_PREDICATES },
    { key: KEYS.GRADES, getDefault: () => [] },
    { key: KEYS.PERIODS, getDefault: () => INITIAL_LESSON_PERIODS },
    { key: KEYS.SCHEDULES, getDefault: () => INITIAL_CLASS_SCHEDULES },
  ];

  SYNC_KEYS.forEach(({ key }) => {
    try {
      const docRef = doc(db, 'sihadir_app_data', key);
      const unsub = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          const payload = docSnap.data();
          if (payload && payload.data !== undefined) {
            const cloudUpdatedAt = Number(payload.updatedAt) || 0;
            const localUpdatedAt = Number(localStorage.getItem(key + '_updatedAt') || '0');
            const currentLocalStr = localStorage.getItem(key);
            
            let finalDataToSave = '';
            if (payload.isChunked && Number(payload.totalChunks) > 1) {
              const totalChunks = Number(payload.totalChunks);
              const chunkPromises: Promise<string>[] = [];
              for (let i = 1; i < totalChunks; i++) {
                const chunkDocRef = doc(db, 'sihadir_app_data', `${key}_chunk_${i}`);
                chunkPromises.push(
                  getDoc(chunkDocRef).then((cSnap) => {
                    if (cSnap.exists() && cSnap.data()?.data) {
                      return String(cSnap.data().data);
                    }
                    return '';
                  }).catch(() => '')
                );
              }
              const otherChunks = await Promise.all(chunkPromises);
              finalDataToSave = (payload.data || '') + otherChunks.join('');
            } else {
              finalDataToSave = typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data);
            }

            // SPECIAL PROFILE MERGING:
            // For school profile, always merge subjects so new subjects added on other devices are immediately visible!
            if (key === KEYS.PROFILE) {
              try {
                const cloudProfile = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                const localProfile = getSchoolProfile();
                const mergedProfile = mergeSchoolProfile(localProfile, cloudProfile);
                finalDataToSave = JSON.stringify(mergedProfile);
                lastSavedStringCache[key] = finalDataToSave;
                safeSetLocalStorage(key, finalDataToSave);
                safeSetLocalStorage(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                notifyStorageUpdated();
                setCloudSyncStatus('connected');
                return;
              } catch (e) {
                console.warn('[Firestore Sync] Error merging school profile:', e);
              }
            }

            // SPECIAL TEACHERS SYNC:
            // Ensure teachers, custom passwords, and assignments sync across all devices without losing changes
            if (key === KEYS.TEACHERS) {
              try {
                const cloudTeachers = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                if (Array.isArray(cloudTeachers)) {
                  const currentLocalTeachers = getTeachers();
                  if (cloudTeachers.length === 0 && currentLocalTeachers.length > 0) {
                    // Database baru masih kosong -> jangan hapus data lokal, unggah data lokal ke Cloud
                    writeCloudDocument(key, JSON.stringify(currentLocalTeachers), Date.now());
                    lastSavedStringCache[key] = JSON.stringify(currentLocalTeachers);
                    setCloudSyncStatus('connected');
                    return;
                  }
                  const mergedTeachers = mergeTeacherLists(currentLocalTeachers, cloudTeachers);
                  const mergedStr = JSON.stringify(mergedTeachers);
                  if (currentLocalStr !== mergedStr) {
                    lastSavedStringCache[key] = mergedStr;
                    safeSetLocalStorage(key, mergedStr);
                    safeSetLocalStorage(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                    notifyStorageUpdated();
                  }
                  setCloudSyncStatus('connected');
                  return;
                }
              } catch (e) {
                console.warn('[Firestore Sync] Error updating teacher data:', e);
              }
            }

            // SPECIAL STUDENTS SYNC:
            // Ensure students, profile photos, and custom passwords sync seamlessly across devices
            if (key === KEYS.STUDENTS) {
              try {
                const cloudStudents = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                if (Array.isArray(cloudStudents)) {
                  const currentLocalStudents = getStudents();
                  if (cloudStudents.length === 0 && currentLocalStudents.length > 0) {
                    // Database baru masih kosong -> jangan hapus data lokal, unggah data lokal ke Cloud
                    writeCloudDocument(key, JSON.stringify(currentLocalStudents), Date.now());
                    lastSavedStringCache[key] = JSON.stringify(currentLocalStudents);
                    setCloudSyncStatus('connected');
                    return;
                  }
                  const mergedStudents = mergeStudentLists(currentLocalStudents, cloudStudents);
                  const mergedStr = JSON.stringify(mergedStudents);
                  if (currentLocalStr !== mergedStr) {
                    lastSavedStringCache[key] = mergedStr;
                    safeSetLocalStorage(key, mergedStr);
                    safeSetLocalStorage(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                    notifyStorageUpdated();
                  }
                  setCloudSyncStatus('connected');
                  return;
                }
              } catch (e) {
                console.warn('[Firestore Sync] Error updating student data:', e);
              }
            }

            // SPECIAL ATTENDANCE SYNC:
            // Ensure real-time attendance scans from scanner devices merge smoothly onto all other devices
            if (key === KEYS.ATTENDANCE) {
              try {
                const cloudAtt = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                if (Array.isArray(cloudAtt)) {
                  const currentLocalAtt = getAttendanceRecords();
                  const cleanCloudAtt = validateAndSanitizeAttendanceRecords(cloudAtt);
                  
                  // PERLINDUNGAN KRUSIAL: Jika Cloud kosong tapi lokal memiliki data riwayat presensi/scan,
                  // JANGAN PERNAH menimpa data lokal dengan array kosong! Sebaliknya unggah ke Cloud Firestore!
                  if (cleanCloudAtt.length === 0 && currentLocalAtt.length > 0) {
                    console.log('[Firestore Sync] Cloud attendance kosong tapi lokal ada data. Menyimpan data lokal dan mengunggah ke Cloud Blaze.');
                    writeCloudDocument(key, JSON.stringify(currentLocalAtt), Date.now());
                    lastSavedStringCache[key] = JSON.stringify(currentLocalAtt);
                    setCloudSyncStatus('connected');
                    return;
                  }
                  
                  const mergedAtt = mergeAttendanceLists(currentLocalAtt, cleanCloudAtt);
                  const cleanMergedAtt = validateAndSanitizeAttendanceRecords(mergedAtt);
                  const mergedStr = JSON.stringify(cleanMergedAtt);
                  
                  if (currentLocalStr !== mergedStr) {
                    lastSavedStringCache[key] = mergedStr;
                    safeSetLocalStorage(key, mergedStr);
                    safeSetLocalStorage(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                    notifyStorageUpdated();
                  }

                  // PERLINDUNGAN MULTI-DEVICE ANTI-TIMPA (CONCURRENT SCANNING SAFETY):
                  // HANYA sinkronkan balik ke Cloud jika perangkat ini memiliki antrean scan lokal yang sedang aktif (scanQueuePendingCount > 0)!
                  // JANGAN sinkronkan balik jika scanQueuePendingCount === 0 untuk mencegah loop ping-pong yang memboroskan kuota!
                  if (scanQueuePendingCount > 0) {
                    const hasLocalScansMissingInCloud = cleanMergedAtt.some(m =>
                      isRealAttendance(m) && !cleanCloudAtt.some(c => c.id === m.id || (c.studentId === m.studentId && c.date === m.date && isRealAttendance(c)))
                    );

                    if (hasLocalScansMissingInCloud) {
                      writeCloudDocument(key, mergedStr, Date.now());
                    }
                  }

                  setCloudSyncStatus('connected');
                  return;
                }
              } catch (e) {
                console.warn('[Firestore Sync] Error updating attendance data dari Cloud, mempertahankan data lokal:', e);
              }
              // PERLINDUNGAN UTAMA: Jangan pernah biarkan data presensi lolos ke fallback bawah
              // yang berpotensi menyimpan string rusak ke LocalStorage
              return;
            }

            // SPECIAL SCHOOL PROFILE SYNC:
            // Ensure school settings, jam masuk/pulang, hari libur, toleransi terlambat, mapel sync instantly across all devices
            if (key === KEYS.PROFILE) {
              try {
                const cloudProfile = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                if (cloudProfile && typeof cloudProfile === 'object') {
                  const currentLocalProfile = getSchoolProfile();
                  const mergedProfile = (localUpdatedAt <= 1 || cloudUpdatedAt >= localUpdatedAt)
                    ? { ...INITIAL_SCHOOL_PROFILE, ...currentLocalProfile, ...cloudProfile }
                    : mergeSchoolProfile(currentLocalProfile, cloudProfile);
                  const mergedStr = JSON.stringify(mergedProfile);
                  if (currentLocalStr !== mergedStr) {
                    lastSavedStringCache[key] = mergedStr;
                    safeSetLocalStorage(key, mergedStr);
                    safeSetLocalStorage(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                    notifyStorageUpdated();
                  }
                  setCloudSyncStatus('connected');
                  return;
                }
              } catch (e) {
                console.warn('[Firestore Sync] Error updating school profile data:', e);
              }
            }

            // SPECIAL LEARNING JOURNALS (KBM) SYNC:
            // Multi-guru concurrent safety: gabungkan input jurnal guru dari berbagai kelas tanpa saling tindih
            if (key === KEYS.LEARNING_JOURNALS) {
              try {
                const cloudJournals = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                if (Array.isArray(cloudJournals)) {
                  const currentLocalJournals = getLearningJournals();
                  if (cloudJournals.length === 0 && currentLocalJournals.length > 0) {
                    writeCloudDocument(key, JSON.stringify(currentLocalJournals), Date.now());
                    lastSavedStringCache[key] = JSON.stringify(currentLocalJournals);
                    setCloudSyncStatus('connected');
                    return;
                  }
                  const mergedJournals = mergeLearningJournals(currentLocalJournals, cloudJournals);
                  const mergedStr = JSON.stringify(mergedJournals);
                  if (currentLocalStr !== mergedStr) {
                    lastSavedStringCache[key] = mergedStr;
                    safeSetLocalStorage(key, mergedStr);
                    safeSetLocalStorage(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                    notifyStorageUpdated();
                  }
                  setCloudSyncStatus('connected');
                  return;
                }
              } catch (e) {
                console.warn('[Firestore Sync] Error updating learning journals data:', e);
              }
            }

            // SPECIAL STUDENT GRADES SYNC:
            // Multi-guru concurrent safety: gabungkan input nilai siswa dari berbagai mapel/guru tanpa saling tindih
            if (key === KEYS.GRADES) {
              try {
                const cloudGrades = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                if (Array.isArray(cloudGrades)) {
                  const currentLocalGrades = getStudentGradeAssessments();
                  if (cloudGrades.length === 0 && currentLocalGrades.length > 0) {
                    writeCloudDocument(key, JSON.stringify(currentLocalGrades), Date.now());
                    lastSavedStringCache[key] = JSON.stringify(currentLocalGrades);
                    setCloudSyncStatus('connected');
                    return;
                  }
                  const mergedGrades = mergeStudentGradeAssessments(currentLocalGrades, cloudGrades);
                  const mergedStr = JSON.stringify(mergedGrades);
                  if (currentLocalStr !== mergedStr) {
                    lastSavedStringCache[key] = mergedStr;
                    safeSetLocalStorage(key, mergedStr);
                    safeSetLocalStorage(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                    notifyStorageUpdated();
                  }
                  setCloudSyncStatus('connected');
                  return;
                }
              } catch (e) {
                console.warn('[Firestore Sync] Error updating student grades data:', e);
              }
            }

            // CRITICAL TIMESTAMP CHECK:
            if (currentLocalStr !== null && localUpdatedAt > 0) {
              if (cloudUpdatedAt > 0 && cloudUpdatedAt < localUpdatedAt) {
                console.log(`[Firestore Sync] Data lokal untuk ${key} lebih baru (${localUpdatedAt} > ${cloudUpdatedAt}). Mengabaikan snapshot lama dari Cloud.`);
                return;
              }
              if (cloudUpdatedAt === 0 && localUpdatedAt > 1) {
                return;
              }
            }

            // Cache cloud string so syncToCloud doesn't redundantly re-upload it
            lastSavedStringCache[key] = finalDataToSave;

            if (currentLocalStr !== finalDataToSave) {
              safeSetLocalStorage(key, finalDataToSave);
              safeSetLocalStorage(key + '_updatedAt', String(cloudUpdatedAt || Date.now()));
              notifyStorageUpdated();
            }
          }
          setCloudSyncStatus('connected');
        }
      }, (err) => {
        handleFirestoreError(err);
      });
      activeUnsubscribes.push(unsub);
    } catch (e) {
      setCloudSyncStatus('offline');
    }
  });

  // Startup background check for raw uncompressed student photos (>90KB base64)
  try {
    setTimeout(() => {
      const existingStudents = getStudents();
      const hasOversized = existingStudents.some(s => s.photoUrl?.startsWith('data:') && s.photoUrl.length > 90000);
      if (hasOversized && !isFirestoreQuotaExceeded()) {
        sanitizeAndCompressStudentPhotos(existingStudents).then(optimized => {
          if (optimized !== existingStudents) {
            saveStudents(optimized, false);
          }
        }).catch(() => {});
      }
    }, 3000);
  } catch {}

  // Register Automatic Network Status and Online Auto-Sync Listeners
  if (typeof window !== 'undefined') {
    // 1. When device comes back online (WiFi/Cellular reconnected)
    window.addEventListener('online', () => {
      if (!isFirestoreQuotaExceeded()) {
        console.log('[Network] Koneksi online terdeteksi! Menjalankan sinkronisasi database otomatis...');
        triggerAutoSyncOnOnline(false);
      }
    });

    // 2. When device loses connection (Offline)
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

    // 3. Listener online: Realtime Firestore onSnapshot sudah aktif mendengarkan perubahan secara real-time.
    // Tidak memerlukan polling berkala (setInterval) atau trigger tab visibility
    // agar kuota write/read Firestore tidak terkuras saat aplikasi/tab dibiarkan terbuka.

    // 4. Bersihkan residual cache lokal WA lama
    try {
      localStorage.removeItem('sihadir_wa_logs_v2');
      localStorage.removeItem('sihadir_wa_logs_v2_updatedAt');
      localStorage.removeItem('sihadir_wa_logs');
    } catch {}
  }
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
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(INITIAL_SCHOOL_PROFILE));
    localStorage.setItem(KEYS.PROFILE + '_updatedAt', '1');
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
            unscannedPoints: Number(parsed.autoCharacterPoints.unscannedPoints) || 1,
            unreturnedPoints: Number(parsed.autoCharacterPoints.unreturnedPoints) || 1,
          }
        : (INITIAL_SCHOOL_PROFILE.autoCharacterPoints || {
            latePoints: 2,
            alpaPoints: 5,
            disruptivePoints: 1,
            absentKbmPoints: 2,
            veryActiveKbmPoints: 1,
            onTimePoints: 1,
            onTimeRequiredDays: 3,
            unscannedPoints: 1,
            unreturnedPoints: 1,
          }),
      lateToleranceMinutes: typeof parsed.lateToleranceMinutes === 'number' ? parsed.lateToleranceMinutes : (INITIAL_SCHOOL_PROFILE.lateToleranceMinutes ?? 15),
      activeDays: parsed.activeDays && Array.isArray(parsed.activeDays) && parsed.activeDays.length > 0 ? parsed.activeDays : (INITIAL_SCHOOL_PROFILE.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']),
      holidays: parsed.holidays && Array.isArray(parsed.holidays) ? parsed.holidays : (INITIAL_SCHOOL_PROFILE.holidays || []),
      subjects: cleanSubjects.length > 0 ? cleanSubjects : ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PJOK', 'Seni Budaya', 'Informatika', 'PPKn']
    };
  } catch {
    return INITIAL_SCHOOL_PROFILE;
  }
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
  const data = localStorage.getItem(KEYS.ATTENDANCE);
  if (data === null) {
    // Cek cadangan aman terlebih dahulu jika localStorage pernah terhapus
    try {
      const backup = localStorage.getItem(SAFE_ATTENDANCE_BACKUP_KEY);
      if (backup) {
        const parsedBackup = JSON.parse(backup);
        const validBackup = validateAndSanitizeAttendanceRecords(parsedBackup);
        if (validBackup.length > 0) {
          const str = JSON.stringify(validBackup);
          safeSetLocalStorage(KEYS.ATTENDANCE, str);
          safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', String(Date.now()));
          return validBackup;
        }
      }
    } catch {}

    const initial = generateInitialAttendanceHistory(INITIAL_STUDENTS);
    const validInitial = validateAndSanitizeAttendanceRecords(initial);
    safeSetLocalStorage(KEYS.ATTENDANCE, JSON.stringify(validInitial));
    safeSetLocalStorage(KEYS.ATTENDANCE + '_updatedAt', '1');
    return validInitial;
  }
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      const sanitized = validateAndSanitizeAttendanceRecords(parsed);
      // Jika ada data rusak yang dibersihkan, perbarui LocalStorage agar tetap bersih
      if (sanitized.length !== parsed.length) {
        const cleanStr = JSON.stringify(sanitized);
        try {
          localStorage.setItem(KEYS.ATTENDANCE, cleanStr);
          if (sanitized.length > 0) {
            localStorage.setItem(SAFE_ATTENDANCE_BACKUP_KEY, cleanStr);
          }
        } catch {}
      }

      if (sanitized.length > 0) {
        return sanitized;
      }

      // Jika data kosong, selamatkan dari cadangan aman jika tersedia
      try {
        const backup = localStorage.getItem(SAFE_ATTENDANCE_BACKUP_KEY);
        if (backup) {
          const parsedBackup = JSON.parse(backup);
          const validBackup = validateAndSanitizeAttendanceRecords(parsedBackup);
          if (validBackup.length > 0) {
            const cleanStr = JSON.stringify(validBackup);
            safeSetLocalStorage(KEYS.ATTENDANCE, cleanStr);
            return validBackup;
          }
        }
      } catch {}

      return [];
    }
    return [];
  } catch (err) {
    console.warn('[Storage] Gagal parse attendance records, memulihkan dari cadangan aman:', err);
    try {
      const backup = localStorage.getItem(SAFE_ATTENDANCE_BACKUP_KEY);
      if (backup) {
        const parsedBackup = JSON.parse(backup);
        const validBackup = validateAndSanitizeAttendanceRecords(parsedBackup);
        if (validBackup.length > 0) {
          const cleanStr = JSON.stringify(validBackup);
          safeSetLocalStorage(KEYS.ATTENDANCE, cleanStr);
          return validBackup;
        }
      }
    } catch {}
    return [];
  }
}

// =========================================================================
// SCAN BATCHING QUEUE WORKER (REAL-TIME CLOUD SYNC & QUOTA SAVER)
// =========================================================================
export const SCAN_BATCH_THRESHOLD = 20; // Flush ke cloud jika antrean mencapai 20 siswa
export const SCAN_IDLE_TIMEOUT_MS = 10000; // Flush ke cloud jika 10 detik tanpa scan baru (idle)

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
    const records = getAttendanceRecords();
    const now = Date.now();
    // Flush to cloud Firestore
    syncToCloud(KEYS.ATTENDANCE, records, true, now);
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

  // Jika belum 20 siswa, atur countdown timer 10 detik & jadwalkan flush otomatis
  scanQueueCountdownSeconds = Math.round(SCAN_IDLE_TIMEOUT_MS / 1000);
  notifyScanQueueChanged();

  if (scanQueueIdleTimer) {
    clearTimeout(scanQueueIdleTimer);
    scanQueueIdleTimer = null;
  }
  if (scanQueueCountdownTimer) {
    clearInterval(scanQueueCountdownTimer);
    scanQueueCountdownTimer = null;
  }

  // Countdown timer setiap 1 detik untuk tampilan hitung mundur di UI
  scanQueueCountdownTimer = setInterval(() => {
    if (scanQueueCountdownSeconds > 1) {
      scanQueueCountdownSeconds -= 1;
      notifyScanQueueChanged();
    } else {
      clearInterval(scanQueueCountdownTimer);
      scanQueueCountdownTimer = null;
    }
  }, 1000);

  // Jadwalkan flush setelah 10 detik tanpa scan baru
  scanQueueIdleTimer = setTimeout(() => {
    flushAttendanceScanQueue(true);
  }, SCAN_IDLE_TIMEOUT_MS);
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
  syncToCloud(KEYS.ATTENDANCE, cleanRecords, instant, now);
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
    safeSetLocalStorage(KEYS.TEACHERS, JSON.stringify(INITIAL_TEACHERS));
    safeSetLocalStorage(KEYS.TEACHERS + '_updatedAt', '1');
    return INITIAL_TEACHERS;
  }
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const isDemoTeacher = (t: Teacher) => DEMO_TEACHER_IDS.has(t.id) || (!!t.nip && DEMO_TEACHER_NIPS.has(t.nip.trim()));
    if (parsed.some(t => !isDemoTeacher(t)) && parsed.some(isDemoTeacher)) {
      const cleaned = parsed.filter(t => !isDemoTeacher(t));
      safeSetLocalStorage(KEYS.TEACHERS, JSON.stringify(cleaned));
      return cleaned;
    }
    return parsed;
  } catch {
    return [];
  }
}

export function saveTeachers(teachers: Teacher[], instant: boolean = true): void {
  const now = Date.now();
  const dataStr = JSON.stringify(teachers);
  safeSetLocalStorage(KEYS.TEACHERS, dataStr);
  safeSetLocalStorage(KEYS.TEACHERS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.TEACHERS, teachers, instant, now);
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

export function saveLearningJournals(journals: LearningJournal[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(journals);
  safeSetLocalStorage(KEYS.LEARNING_JOURNALS, dataStr);
  safeSetLocalStorage(KEYS.LEARNING_JOURNALS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.LEARNING_JOURNALS, journals, false, now);
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
    if (updated) {
      safeSetLocalStorage(KEYS.CHARACTER_TRAITS, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return INITIAL_CHARACTER_TRAITS;
  }
}

export function saveCharacterTraits(traits: CharacterTrait[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(traits);
  safeSetLocalStorage(KEYS.CHARACTER_TRAITS, dataStr);
  safeSetLocalStorage(KEYS.CHARACTER_TRAITS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_TRAITS, traits, false, now);
}

export function getStudentCharacterLogs(): StudentCharacterLog[] {
  const data = localStorage.getItem(KEYS.CHARACTER_LOGS);
  if (data === null) {
    safeSetLocalStorage(KEYS.CHARACTER_LOGS, JSON.stringify(INITIAL_STUDENT_CHARACTER_LOGS));
    safeSetLocalStorage(KEYS.CHARACTER_LOGS + '_updatedAt', '1');
    return INITIAL_STUDENT_CHARACTER_LOGS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStudentCharacterLogs(logs: StudentCharacterLog[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(logs);
  safeSetLocalStorage(KEYS.CHARACTER_LOGS, dataStr);
  safeSetLocalStorage(KEYS.CHARACTER_LOGS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_LOGS, logs, false, now);
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

export function saveStudentGradeAssessments(assessments: StudentGradeAssessment[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(assessments);
  safeSetLocalStorage(KEYS.GRADES, dataStr);
  safeSetLocalStorage(KEYS.GRADES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.GRADES, assessments, false, now);
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

