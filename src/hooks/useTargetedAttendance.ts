import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  limit, 
  getDocs, 
  getDoc, 
  doc, 
  startAfter, 
  QueryDocumentSnapshot, 
  DocumentData,
  orderBy
} from '../lib/firebase';
import { db } from '../lib/firebase';
import { AttendanceRecord } from '../types';

export interface UseTargetedAttendanceOptions {
  date: string;
  className?: string; // Optional class filter (e.g. 'KELAS 7 A')
  pageSize?: number;
  autoFetch?: boolean;
}

export interface UseTargetedAttendanceReturn {
  records: AttendanceRecord[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
  fetchSingleRecord: (studentId: string, date?: string) => Promise<AttendanceRecord | null>;
  totalReadsIncurred: number;
}

/**
 * Hook Presensi Terfokus (Page-Specific & Targeted Reads)
 * 
 * Aturan Arsitektur Hemat Kuota Spark Free Tier:
 * 1. Fetch-on-Demand: Query getDocs HANYA dieksekusi saat halaman/komponen dipasang (mount) atau filter berganti.
 * 2. Filter Granular: Menggunakan where('date', '==', date) dan where('className', '==', className) dengan limit(pageSize).
 * 3. Tidak Ada Polling Background: Bebas dari listener onSnapshot global atau interval getDocs berkala saat tab tidak aktif.
 * 4. Pembaruan 1 Dokumen Sasaran (Single-Record Patch): Saat siswa check-in, hanya mengambil 1 dokumen terkait
 *    via getDoc(doc(db, 'attendance_records', recordId)) tanpa memuat ulang seluruh tabel (hanya 1 read!).
 */
export function useTargetedAttendance({
  date,
  className,
  pageSize = 25,
  autoFetch = true,
}: UseTargetedAttendanceOptions): UseTargetedAttendanceReturn {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalReadsIncurred, setTotalReadsIncurred] = useState<number>(0);

  // Kursor pagination untuk membaca halaman berikutnya secara terarah
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Reset mounted ref pada unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Mengambil halaman pertama data presensi berdasarkan tanggal dan kelas aktif
   */
  const fetchPage = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);
    lastDocRef.current = null;

    try {
      // Susun query terarah dengan limit pagination ketat
      let baseQuery = query(
        collection(db, 'attendance_records'),
        where('date', '==', date)
      );

      // Jika ada filter kelas spesifik, tambahkan klausa where untuk menghemat pembacaan
      if (className && className !== 'ALL') {
        baseQuery = query(baseQuery, where('className', '==', className));
      }

      // Terapkan limit halaman agar tidak membaca seluruh koleksi
      const paginatedQuery = query(
        baseQuery,
        orderBy('studentName', 'asc'),
        limit(pageSize)
      );

      const snapshot = await getDocs(paginatedQuery);

      if (!isMountedRef.current) return;

      const pageRecords: AttendanceRecord[] = [];
      snapshot.forEach((d) => {
        const val = d.data() as AttendanceRecord;
        if (val && val.studentId) {
          pageRecords.push({
            ...val,
            id: val.id || d.id,
          });
        }
      });

      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setRecords(pageRecords);
      setHasMore(snapshot.docs.length >= pageSize);
      setTotalReadsIncurred((prev) => prev + snapshot.size);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.warn('[useTargetedAttendance] Fetch error:', err);
      setError(err?.message || 'Gagal memuat data presensi terarah.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [date, className, pageSize]);

  /**
   * Mengambil halaman berikutnya secara inkremental (hanya membaca sejumlah pageSize baru)
   */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !lastDocRef.current || !date) return;
    setLoading(true);

    try {
      let baseQuery = query(
        collection(db, 'attendance_records'),
        where('date', '==', date)
      );

      if (className && className !== 'ALL') {
        baseQuery = query(baseQuery, where('className', '==', className));
      }

      const nextQuery = query(
        baseQuery,
        orderBy('studentName', 'asc'),
        startAfter(lastDocRef.current),
        limit(pageSize)
      );

      const snapshot = await getDocs(nextQuery);

      if (!isMountedRef.current) return;

      const nextPageRecords: AttendanceRecord[] = [];
      snapshot.forEach((d) => {
        const val = d.data() as AttendanceRecord;
        if (val && val.studentId) {
          nextPageRecords.push({
            ...val,
            id: val.id || d.id,
          });
        }
      });

      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setRecords((prev) => [...prev, ...nextPageRecords]);
      setHasMore(snapshot.docs.length >= pageSize);
      setTotalReadsIncurred((prev) => prev + snapshot.size);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.warn('[useTargetedAttendance] Load more error:', err);
      setError(err?.message || 'Gagal memuat halaman lanjutan.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [loading, hasMore, date, className, pageSize]);

  /**
   * TARGETED SINGLE-RECORD UPDATE:
   * Mengambil HANYA 1 dokumen record presensi siswa sasaran dari Cloud Firestore.
   * Hanya menghabiskan 1 read Firestore (alih-alih ratusan/ribuan read).
   * Langsung memperbarui (patch) item siswa di state lokal secara instan.
   */
  const fetchSingleRecord = useCallback(
    async (studentId: string, targetDate?: string): Promise<AttendanceRecord | null> => {
      const dStr = targetDate || date;
      if (!studentId || !dStr) return null;

      const deterministicId = `attendance_${studentId}_${dStr}`;
      try {
        let docRef = doc(db, 'attendance_records', deterministicId);
        let snap = await getDoc(docRef);
        if (!snap.exists()) {
          // Fallback ke legacy format docId
          const legacyDocRef = doc(db, 'attendance_records', `${studentId}_${dStr}`);
          const legacySnap = await getDoc(legacyDocRef);
          if (legacySnap.exists()) {
            snap = legacySnap;
            docRef = legacyDocRef;
          }
        }

        if (!isMountedRef.current) return null;
        setTotalReadsIncurred((prev) => prev + 1); // 1 read Firestore

        if (snap.exists()) {
          const updated = snap.data() as AttendanceRecord;
          // Patch state lokal siswa sasaran tanpa re-fetch tabel
          setRecords((prev) => {
            const index = prev.findIndex((r) => r.studentId === studentId && r.date === dStr);
            if (index >= 0) {
              const copy = [...prev];
              copy[index] = { ...copy[index], ...updated, id: snap.id };
              return copy;
            } else {
              return [{ ...updated, id: snap.id }, ...prev];
            }
          });
          return updated;
        }
        return null;
      } catch (err) {
        console.warn(`[useTargetedAttendance] Single doc fetch notice (${deterministicId}):`, err);
        return null;
      }
    },
    [date]
  );

  // Eksekusi pemuatan HANYA saat komponen terpasang atau filter berubah
  useEffect(() => {
    if (autoFetch) {
      fetchPage();
    }
  }, [fetchPage, autoFetch]);

  return {
    records,
    loading,
    error,
    hasMore,
    loadMore,
    refetch: fetchPage,
    fetchSingleRecord,
    totalReadsIncurred,
  };
}
