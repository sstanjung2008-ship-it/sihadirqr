import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from '../lib/firebase';
import { db } from '../lib/firebase';
import { StudentCharacterLog } from '../types';
import { getDeletedCharacterLogIds } from '../lib/storage';

export interface UseStudentBehaviorNotesReturn {
  notes: StudentCharacterLog[];
  loading: boolean;
  error: string | null;
  isLive: boolean;
  totalPointsDelta: number;
}

/**
 * 2. REAL-TIME STUDENT BEHAVIOR NOTES HOOK (Catatan Perilaku Khusus Siswa)
 * - Menggunakan targeted onSnapshot() dengan filter where('studentId', '==', studentId)
 * - Menghemat kuota Firestore: Hanya mendengarkan saat modal detail siswa aktif
 * - Cloud-First: Data selalu berasal dari sinkronisasi Firestore langsung (tanpa stale cache lokal)
 * - Otomatis melepas listener (unsubscribe) saat komponen di-unmount atau siswa berganti
 */
export function useStudentBehaviorNotesRealtime(studentId?: string | null): UseStudentBehaviorNotesReturn {
  const [notes, setNotes] = useState<StudentCharacterLog[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(studentId));
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);

  useEffect(() => {
    const cleanStudentId = studentId ? String(studentId).trim() : '';

    // Jika studentId kosong (misal modal detail siswa ditutup), hentikan listener untuk hemat kuota!
    if (!cleanStudentId) {
      setNotes([]);
      setLoading(false);
      setIsLive(false);
      return;
    }

    setLoading(true);
    setError(null);

    // TARGETED QUERY SCOPE: Batasi pencarian HANYA pada studentId yang sedang dibuka
    const notesQuery = query(
      collection(db, 'character_logs'),
      where('studentId', '==', cleanStudentId)
    );

    const deletedIds = getDeletedCharacterLogIds();

    const unsubscribe = onSnapshot(
      notesQuery,
      (snapshot) => {
        const liveLogs: StudentCharacterLog[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && !deletedIds.has(docSnap.id)) {
            liveLogs.push({
              id: docSnap.id,
              studentId: data.studentId || cleanStudentId,
              studentName: data.studentName || '',
              nisn: data.nisn || '',
              classId: data.classId || '',
              className: data.className || '',
              traitId: data.traitId || '',
              traitName: data.traitName || '',
              traitType: data.traitType || 'POSITIF',
              points: typeof data.points === 'number' ? data.points : 0,
              evaluatorName: data.evaluatorName || 'Guru',
              timestamp: data.timestamp || '',
              date: data.date || '',
              photoProofUrl: data.photoProofUrl || undefined,
              notes: data.notes || '',
              followUpNotes: data.followUpNotes || undefined,
              followUpPhotoUrl: data.followUpPhotoUrl || undefined,
              followUpDate: data.followUpDate || undefined,
              followUpBy: data.followUpBy || undefined,
              isManual: data.isManual !== false,
              sourceType: data.sourceType || 'MANUAL_INPUT',
            });
          }
        });

        // Urutkan catatan dari yang terbaru (descending)
        liveLogs.sort((a, b) => {
          const timeA = a.timestamp || a.date || '';
          const timeB = b.timestamp || b.date || '';
          return timeB.localeCompare(timeA);
        });

        setNotes(liveLogs);
        setLoading(false);
        setIsLive(true);
      },
      (err) => {
        console.warn(`[RealtimeBehaviorNotes] Listener error untuk studentId ${cleanStudentId}:`, err);
        setError('Gagal memuat catatan perilaku langsung dari Cloud.');
        setLoading(false);
        setIsLive(false);
      }
    );

    // Cleanup: Lepas listener Firestore seketika saat dialog siswa ditutup atau ganti siswa
    return () => {
      unsubscribe();
      setIsLive(false);
    };
  }, [studentId]);

  // Hitung total akumulasi poin perilaku dari catatan live
  const totalPointsDelta = notes.reduce((sum, n) => {
    return sum + (n.traitType === 'POSITIF' ? Math.abs(n.points) : -Math.abs(n.points));
  }, 0);

  return {
    notes,
    loading,
    error,
    isLive,
    totalPointsDelta
  };
}
