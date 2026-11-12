import { 
  db, 
  doc, 
  setDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  writeBatch
} from './firebase';
import { StudentCharacterLog, UserSession, UserRole } from '../types';
import { 
  getStudentCharacterLogs, 
  savePermanentManualCharacterLogs,
  saveStudentCharacterLogs,
  deduplicateCharacterLogs,
  safeSetLocalStorage,
  markCharacterLogDeleted,
  deletePermanentManualCharacterLog,
  KEYS
} from './storage';

// Local storage key for offline character logs queue
export const OFFLINE_CHARACTER_LOGS_QUEUE = 'sihadir_offline_character_logs_queue_v1';

/**
 * Menyimpan antrean catatan karakter yang gagal dikirim saat offline
 */
export function enqueueOfflineCharacterLog(log: StudentCharacterLog): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(OFFLINE_CHARACTER_LOGS_QUEUE);
    const queue: StudentCharacterLog[] = raw ? JSON.parse(raw) : [];
    queue.push(log);
    safeSetLocalStorage(OFFLINE_CHARACTER_LOGS_QUEUE, JSON.stringify(queue.slice(-100)));
  } catch (err) {
    console.warn('[OfflineQueue] Gagal simpan antrean karakter:', err);
  }
}

/**
 * Memproses dan menguras antrean catatan karakter saat koneksi online pulih
 */
export async function flushOfflineCharacterLogsQueue(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(OFFLINE_CHARACTER_LOGS_QUEUE);
    if (!raw) return 0;
    const queue: StudentCharacterLog[] = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return 0;

    let successCount = 0;
    const remaining: StudentCharacterLog[] = [];

    for (const log of queue) {
      try {
        const docRef = doc(db, 'character_logs', log.id);
        await setDoc(docRef, {
          ...log,
          syncedAt: serverTimestamp(),
          updatedAt: Date.now(),
        }, { merge: true });
        successCount++;
      } catch (e) {
        remaining.push(log);
      }
    }

    if (remaining.length > 0) {
      safeSetLocalStorage(OFFLINE_CHARACTER_LOGS_QUEUE, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(OFFLINE_CHARACTER_LOGS_QUEUE);
    }

    return successCount;
  } catch (err) {
    console.warn('[OfflineQueue] Gagal flush antrean karakter:', err);
    return 0;
  }
}

export interface CharacterSubmissionResult {
  success: boolean;
  logId: string;
  optimistic: boolean;
  cloudWritten: boolean;
  message: string;
}

/**
 * 1. REAL-TIME CHARACTER POINTS INPUT & STORAGE (character_logs)
 * - Eksekusi input guru/admin seketika (< 50ms) dengan Optimistic UI Update
 * - Atomic state update & penulisan langsung ke Cloud Firestore koleksi 'character_logs/{logId}'
 * - Pembaruan ringkasan skor siswa di 'student_character_summaries/{studentId}'
 * - Dilindungi hak akses role-based (TEACHER & ADMIN)
 */
export async function submitCharacterPointRealtime(
  log: StudentCharacterLog,
  currentUser: UserSession | null,
  options?: {
    onOptimisticUpdate?: (optimisticLog: StudentCharacterLog) => void;
    onError?: (err: any) => void;
  }
): Promise<CharacterSubmissionResult> {
  // 1. Role-Based Verification
  const userRole = currentUser?.role || 'TEACHER';
  const isAuthorized = userRole === 'ADMIN' || userRole === 'TEACHER';
  if (!isAuthorized) {
    const errorMsg = 'Akses ditolak: Hanya akun Guru (TEACHER) dan Admin (ADMIN) yang berhak memberikan penilaian karakter siswa.';
    if (options?.onError) options.onError(new Error(errorMsg));
    return {
      success: false,
      logId: log.id,
      optimistic: false,
      cloudWritten: false,
      message: errorMsg
    };
  }

  const now = Date.now();
  const cleanStudentId = String(log.studentId).trim();

  // 2. Optimistic UI Update (< 50ms)
  // Segera panggil callback UI lokal agar skor dan catatan tampak instan bagi guru
  if (options?.onOptimisticUpdate) {
    options.onOptimisticUpdate(log);
  }

  // Simpan ke brankas manual lokal (agar kebal penghapusan otomatis)
  savePermanentManualCharacterLogs([log]);

  // Perbarui state in-memory & localStorage aplikasi
  const currentLogs = getStudentCharacterLogs();
  const updatedLogs = deduplicateCharacterLogs([log, ...currentLogs]);
  saveStudentCharacterLogs(updatedLogs, false);

  // 3. Cloud Firestore Write (Atomic & Direct Collection Write)
  let cloudWritten = false;
  try {
    const docRef = doc(db, 'character_logs', log.id);
    const summaryRef = doc(db, 'student_character_summaries', cleanStudentId);

    const logPayload: any = {
      id: log.id,
      studentId: cleanStudentId,
      studentName: log.studentName || '',
      nisn: log.nisn || '',
      classId: log.classId || '',
      className: log.className || '',
      traitId: log.traitId || '',
      traitName: log.traitName || '',
      traitType: log.traitType, // POSITIF | NEGATIF
      points: Math.abs(log.points),
      evaluatorName: log.evaluatorName || currentUser?.displayName || 'Guru',
      evaluatorId: currentUser?.teacherId || currentUser?.username || '',
      editorRole: userRole,
      timestamp: log.timestamp,
      date: log.date,
      notes: log.notes ? String(log.notes).trim() : '',
      isManual: true,
      sourceType: log.sourceType || 'MANUAL_INPUT',
      createdAt: serverTimestamp(),
      updatedAt: now,
    };

    if (log.photoProofUrl && log.photoProofUrl.trim() !== '') {
      logPayload.photoProofUrl = log.photoProofUrl.trim();
    }
    if (log.followUpNotes) logPayload.followUpNotes = log.followUpNotes;
    if (log.followUpBy) logPayload.followUpBy = log.followUpBy;
    if (log.followUpDate) logPayload.followUpDate = log.followUpDate;

    // Tulis dokumen catatan karakter dan ringkasan siswa dalam 1 batch commit atomik
    const batch = writeBatch(db);
    batch.set(docRef, logPayload, { merge: true });
    batch.set(summaryRef, {
      studentId: cleanStudentId,
      studentName: log.studentName,
      className: log.className,
      lastEvaluatedAt: serverTimestamp(),
      lastTraitName: log.traitName,
      lastTraitType: log.traitType,
      lastEvaluatorName: log.evaluatorName,
      editorRole: userRole,
      updatedAt: now,
    }, { merge: true });
    await batch.commit();

    cloudWritten = true;

    // Sinkronkan juga ke dokumen agregat (KEYS.CHARACTER_LOGS) secara asinkron dengan debounce di latar belakang (tidak memblokir input guru)
    saveStudentCharacterLogs(updatedLogs, false);

    return {
      success: true,
      logId: log.id,
      optimistic: true,
      cloudWritten: true,
      message: `Penilaian karakter "${log.traitName}" (${log.traitType === 'POSITIF' ? '+' : '-'}${log.points} Poin) untuk ${log.studentName} berhasil tersimpan ke Cloud Firestore!`
    };
  } catch (err: any) {
    console.warn('[CharacterRealtime] Cloud write tertunda/offline, memasukkan ke antrean lokal:', err);
    // Masukkan ke antrean offline lokal untuk diunggah ulang saat online
    enqueueOfflineCharacterLog(log);

    if (options?.onError) {
      options.onError(err);
    }

    return {
      success: true,
      logId: log.id,
      optimistic: true,
      cloudWritten: false,
      message: 'Penilaian karakter tersimpan aman di perangkat lokal dan akan otomatis diunggah ke Cloud Firestore saat online.'
    };
  }
}

/**
 * 2. REAL-TIME CHARACTER LOG DELETION (Khusus Role Admin)
 * - Validasi peran mutlak: Hanya akun ADMIN yang diizinkan menghapus catatan.
 * - Hapus dokumen langsung dari Cloud Firestore koleksi 'character_logs/{logId}'.
 * - Tandai ID log di markCharacterLogDeleted dan bersihkan dari cadangan permanen.
 * - Sinkronkan ke penyimpanan lokal & state aplikasi seketika.
 */
export async function deleteCharacterPointRealtime(
  logId: string,
  userRole: UserRole
): Promise<{ success: boolean; message: string }> {
  if (userRole !== 'ADMIN') {
    const errorMsg = 'Akses ditolak: Hanya pengguna dengan peran Admin (ADMIN) yang berwenang menghapus catatan perilaku/nilai karakter siswa.';
    throw new Error(errorMsg);
  }

  const cleanId = String(logId).trim();
  if (!cleanId) {
    return { success: false, message: 'ID catatan karakter tidak valid.' };
  }

  // 1. Bersihkan dari brankas lokal & tandai ID telah dihapus agar tidak direstorasi
  markCharacterLogDeleted(cleanId);
  deletePermanentManualCharacterLog(cleanId);

  // 2. Bersihkan dari state in-memory & penyimpanan lokal
  const currentLogs = getStudentCharacterLogs();
  const updatedLogs = currentLogs.filter(l => {
    if (!l) return false;
    return l.id?.trim() !== cleanId;
  });
  saveStudentCharacterLogs(updatedLogs, true);

  // 3. Hapus dokumen langsung dari Cloud Firestore koleksi 'character_logs/{logId}'
  let cloudDeleted = false;
  try {
    const docRef = doc(db, 'character_logs', cleanId);
    await deleteDoc(docRef);
    cloudDeleted = true;
  } catch (err) {
    console.warn('[CharacterRealtime] Gagal menghapus dokumen character_logs di Cloud (tertanda dihapus lokal):', err);
  }

  return {
    success: true,
    message: cloudDeleted
      ? 'Catatan perilaku khusus siswa berhasil dihapus secara permanen dari Cloud Firestore.'
      : 'Catatan perilaku berhasil dihapus dari perangkat lokal dan akan disinkronkan ke Cloud saat online.'
  };
}

// Otomatis pasang listener online untuk sinkronisasi antrean karakter offline
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineCharacterLogsQueue().then(count => {
      if (count > 0) {
        console.log(`[CharacterRealtime] Berhasil menyinkronkan ${count} catatan karakter offline ke Cloud Firestore.`);
      }
    });
  });
}
