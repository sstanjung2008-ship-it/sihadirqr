/**
 * IndexedDB Architecture for SiHadirQR (sihadir_db)
 * - Object Store: 'attendance_queue' (Primary Offline-First Scan Queue)
 * - Object Store: 'app_cache' (General Cache Store)
 * 
 * Standarisasi Zona Waktu Indonesia (WITA UTC+8) menggunakan Intl.DateTimeFormat 'Asia/Makassar'.
 * Skema Dokumen Deterministik: attendance_${studentId}_${dateString}
 */

import { AttendanceQueueItem } from '../types';

export const DB_NAME = 'sihadir_db';
export const DB_VERSION = 2;
export const STORE_ATTENDANCE_QUEUE = 'attendance_queue';
export const STORE_APP_CACHE = 'app_cache';

/**
 * Standarisasi Format Tanggal & Zona Waktu (WITA UTC+8).
 * Menghilangkan bug rollback tanggal sebelum pukul 08:00 pagi WITA.
 */
export const getTodayDateKey = (dateInput: Date | number | string = new Date()): string => {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
    d = new Date(dateInput);
  } else {
    d = new Date();
  }
  if (isNaN(d.getTime())) d = new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d);
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        // 1. Primary Offline Attendance Queue Store
        if (!db.objectStoreNames.contains(STORE_ATTENDANCE_QUEUE)) {
          const queueStore = db.createObjectStore(STORE_ATTENDANCE_QUEUE, { keyPath: 'id' });
          queueStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          queueStore.createIndex('date', 'date', { unique: false });
          queueStore.createIndex('studentId', 'studentId', { unique: false });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 2. App Cache Store
        if (!db.objectStoreNames.contains(STORE_APP_CACHE)) {
          db.createObjectStore(STORE_APP_CACHE);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = (err) => {
        console.warn('[IndexedDB] Gagal membuka sihadir_db:', err);
        dbPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database connection blocked.');
        dbPromise = null;
        resolve(null);
      };
    } catch (e) {
      console.warn('[IndexedDB] Exception opening db:', e);
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

// =========================================================================
// ATTENDANCE QUEUE CRUD OPERATIONS (sihadir_db -> attendance_queue)
// =========================================================================

/**
 * Menulis / memperbarui item antrean scan ke IndexedDB lokal secara deterministik.
 * Skema ID: attendance_${studentId}_${dateString}
 */
export async function enqueueAttendance(item: AttendanceQueueItem): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ATTENDANCE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_ATTENDANCE_QUEUE);

      // Pastikan format ID deterministik seragam
      const dateKey = item.date || getTodayDateKey(new Date(item.timestamp || Date.now()));
      const deterministicId = item.id.startsWith('attendance_')
        ? item.id
        : `attendance_${item.studentId}_${dateKey}`;

      const normalizedItem: AttendanceQueueItem = {
        ...item,
        id: deterministicId,
        date: dateKey,
        createdAt: item.createdAt || Date.now(),
        retryCount: item.retryCount ?? 0,
        syncStatus: item.syncStatus || 'pending'
      };

      const req = store.put(normalizedItem);
      req.onsuccess = () => {
        dispatchQueueChangeEvent();
        resolve(true);
      };
      req.onerror = (e) => {
        console.warn('[IndexedDB] Enqueue error:', e);
        resolve(false);
      };
    } catch (err) {
      console.warn('[IndexedDB] Enqueue exception:', err);
      resolve(false);
    }
  });
}

/**
 * Menambahkan batch antrean scan sekaligus
 */
export async function enqueueAttendanceBatch(items: AttendanceQueueItem[]): Promise<boolean> {
  if (!items || items.length === 0) return true;
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ATTENDANCE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_ATTENDANCE_QUEUE);

      items.forEach((item) => {
        const dateKey = item.date || getTodayDateKey(new Date(item.timestamp || Date.now()));
        const deterministicId = item.id.startsWith('attendance_')
          ? item.id
          : `attendance_${item.studentId}_${dateKey}`;

        store.put({
          ...item,
          id: deterministicId,
          date: dateKey,
          createdAt: item.createdAt || Date.now(),
          retryCount: item.retryCount ?? 0,
          syncStatus: item.syncStatus || 'pending'
        });
      });

      tx.oncomplete = () => {
        dispatchQueueChangeEvent();
        resolve(true);
      };
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Mengambil seluruh isi antrean presensi di IndexedDB
 */
export async function getAttendanceQueue(): Promise<AttendanceQueueItem[]> {
  const db = await openDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ATTENDANCE_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_ATTENDANCE_QUEUE);
      const req = store.getAll();

      req.onsuccess = () => {
        resolve((req.result as AttendanceQueueItem[]) || []);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Mengambil data antrean yang belum tersinkronisasi (syncStatus: 'pending' atau 'error')
 */
export async function getPendingAttendanceQueue(): Promise<AttendanceQueueItem[]> {
  const all = await getAttendanceQueue();
  return all.filter((item) => item.syncStatus === 'pending' || item.syncStatus === 'error');
}

/**
 * Memperbarui item antrean spesifik berdasarkan ID
 */
export async function updateAttendanceQueueItem(
  id: string,
  updates: Partial<AttendanceQueueItem>
): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ATTENDANCE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_ATTENDANCE_QUEUE);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const current = getReq.result as AttendanceQueueItem;
        if (!current) {
          resolve(false);
          return;
        }

        const merged: AttendanceQueueItem = {
          ...current,
          ...updates,
          id: current.id, // ID tidak boleh berubah
        };

        const putReq = store.put(merged);
        putReq.onsuccess = () => {
          dispatchQueueChangeEvent();
          resolve(true);
        };
        putReq.onerror = () => resolve(false);
      };
      getReq.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Menandai item antrean berhasil disinkronisasi ke Cloud
 */
export async function markAttendanceQueueItemSynced(id: string): Promise<boolean> {
  return updateAttendanceQueueItem(id, {
    syncStatus: 'synced',
    errorMessage: undefined,
    lastAttemptAt: Date.now()
  });
}

/**
 * Menghapus satu item antrean dari IndexedDB
 */
export async function deleteAttendanceQueueItem(id: string): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ATTENDANCE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_ATTENDANCE_QUEUE);
      const req = store.delete(id);
      req.onsuccess = () => {
        dispatchQueueChangeEvent();
        resolve(true);
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Membersihkan data antrean yang sudah 'synced' lebih lama dari retentionMs (default 7 hari)
 */
export async function clearOldSyncedQueue(retentionMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = await openDB();
  if (!db) return 0;

  const now = Date.now();
  const cutoff = now - retentionMs;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ATTENDANCE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_ATTENDANCE_QUEUE);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = (req.result as AttendanceQueueItem[]) || [];
        let deleted = 0;
        items.forEach((item) => {
          if (item.syncStatus === 'synced' && item.timestamp < cutoff) {
            store.delete(item.id);
            deleted++;
          }
        });
        tx.oncomplete = () => resolve(deleted);
      };
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

/**
 * Statistik antrean IndexedDB untuk pemantauan real-time
 */
export async function getAttendanceQueueStats(): Promise<{
  total: number;
  pending: number;
  syncing: number;
  synced: number;
  error: number;
}> {
  const items = await getAttendanceQueue();
  const stats = { total: items.length, pending: 0, syncing: 0, synced: 0, error: 0 };
  items.forEach((it) => {
    if (it.syncStatus === 'pending') stats.pending++;
    else if (it.syncStatus === 'syncing') stats.syncing++;
    else if (it.syncStatus === 'synced') stats.synced++;
    else if (it.syncStatus === 'error') stats.error++;
  });
  return stats;
}

function dispatchQueueChangeEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sihadir_idb_queue_changed'));
  }
}

// =========================================================================
// GENERAL APP CACHE (STORE_APP_CACHE) - Backward Compatibility
// =========================================================================

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_APP_CACHE, 'readonly');
      const store = tx.objectStore(STORE_APP_CACHE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet<T>(key: string, val: T): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_APP_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_APP_CACHE);
      const req = store.put(val, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function idbDelete(key: string): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_APP_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_APP_CACHE);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
