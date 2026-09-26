import { 
  getSchoolProfile, 
  getStudents, 
  getAttendanceRecords, 
  getStudentCharacterLogs, 
  saveStudentCharacterLogs, 
  getCharacterTraits 
} from './storage';
import { StudentCharacterLog } from '../types';

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
 * Menjalankan evaluasi penilaian karakter otomatis untuk status "Belum Scan" dan "Belum Pulang"
 * Ditulis serentak oleh sistem dan dikirim dalam 1 pengiriman (single write) ke Cloud Firestore.
 */
export function run16WitaAutoCharacterAssessment(force: boolean = false): { executed: boolean; count: number; message: string } {
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

  // Cek apakah hari ini merupakan hari libur kalender sekolah / nasional
  const isHoliday = (profile.holidays || []).some(h => h.date === witaDateStr);
  if (!force && isHoliday) {
    return { executed: false, count: 0, message: `Hari ini (${witaDateStr}) tercatat sebagai hari libur sekolah.` };
  }

  // Cek apakah sudah pernah dieksekusi hari ini
  const lastRunKey = 'sihadir_auto_char_16wita_last_run';
  const lastRunDate = localStorage.getItem(lastRunKey);
  if (!force && lastRunDate === witaDateStr) {
    return { executed: false, count: 0, message: `Penilaian otomatis untuk tanggal ${witaDateStr} sudah pernah dijalankan.` };
  }

  // Ambil data siswa & absensi hari ini
  const students = getStudents();
  if (students.length === 0) {
    return { executed: false, count: 0, message: 'Tidak ada data siswa aktif yang ditemukan.' };
  }

  const attendanceRecords = getAttendanceRecords();
  const todayRecords = attendanceRecords.filter(r => r.date === witaDateStr);
  const todayRecordMap = new Map(todayRecords.map(r => [r.studentId, r]));

  // Ambil log karakter saat ini
  const currentLogs = getStudentCharacterLogs();

  // Pengaturan besaran poin (Default 1 poin negatif)
  const unscannedPoints = profile.autoCharacterPoints?.unscannedPoints ?? 1;
  const unreturnedPoints = profile.autoCharacterPoints?.unreturnedPoints ?? 1;

  // Dapatkan master trait terkait
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

  students.forEach(student => {
    const rec = todayRecordMap.get(student.id);

    // 1. ATURAN: BELUM SCAN PRESENSI (-unscannedPoints)
    // Data diambil dari daftar absensi siswa pada kolom Jam Masuk DENGAN KRITERIA STATUS MASUK HADIR.
    // Hanya berlaku bagi siswa yang memiliki status masuk 'HADIR', namun pada kolom Jam Masuk belum melakukan scan (time kosong atau '-').
    // Siswa dengan status masuk selain Hadir (Sakit, Izin, Alpa, Terlambat) TIDAK dinilai negatif belum scan presensi!
    const isStatusHadir = !!(rec && rec.status === 'HADIR');
    const isUnscannedEntry = isStatusHadir && (
      !rec.time || 
      rec.time === '-' || 
      rec.time.trim() === '' || 
      rec.time.toLowerCase().includes('belum')
    );

    if (isUnscannedEntry) {
      const alreadyLoggedUnscanned = currentLogs.some(l => 
        l.studentId === student.id && 
        l.date === witaDateStr && 
        (
          l.id === `auto-unscanned-${student.id}-${witaDateStr}` || 
          (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('scan'))
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
      }
    }

    // 2. ATURAN: BELUM PULANG SEKOLAH (-unreturnedPoints)
    // KRITERIA KETAT: Dinilai negatif HANYA jika siswa memiliki status masuk 'HADIR' atau 'TERLAMBAT'.
    // Jika status masuk selain Hadir dan Terlambat (misalnya SAKIT, IZIN, ALPA, atau belum presensi), aplikasi TIDAK menilai negatif belum pulang!
    const isPresent = !!(rec && (rec.status === 'HADIR' || rec.status === 'TERLAMBAT'));
    const hasReturned = !!(rec && (
      (rec.returnTime && rec.returnTime !== '-') || 
      rec.returnStatus === 'PULANG' || 
      rec.returnStatus === 'PULANG_TEPAT' || 
      rec.returnStatus === 'PULANG_CEPAT'
    ));

    if (isPresent && !hasReturned) {
      const alreadyLoggedUnreturned = currentLogs.some(l => 
        l.studentId === student.id && 
        l.date === witaDateStr && 
        (
          l.id === `auto-unreturned-${student.id}-${witaDateStr}` || 
          (l.traitType === 'NEGATIF' && l.traitName.toLowerCase().includes('belum') && l.traitName.toLowerCase().includes('pulang'))
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
      }
    }
  });

  // Tandai tanggal selesai dievaluasi agar tidak berjalan ganda pada detik/menit berikutnya
  localStorage.setItem(lastRunKey, witaDateStr);

  if (newLogs.length > 0) {
    // Gabungkan seluruh log dan simpan dalam 1 kali pengiriman tunggal ke Cloud Firestore
    const updatedLogs = [...currentLogs, ...newLogs];
    saveStudentCharacterLogs(updatedLogs);

    // Dispatch event notifikasi
    window.dispatchEvent(new CustomEvent('sihadir_auto_assessment_completed', {
      detail: {
        date: witaDateStr,
        newLogsCount: newLogs.length,
        unscannedCount: newLogs.filter(l => l.id.includes('unscanned')).length,
        unreturnedCount: newLogs.filter(l => l.id.includes('unreturned')).length
      }
    }));

    return { 
      executed: true, 
      count: newLogs.length, 
      message: `Berhasil mencatat ${newLogs.length} poin pelanggaran karakter (Belum Scan / Belum Pulang) serentak dalam 1 pengiriman ke Cloud!` 
    };
  }

  return { 
    executed: true, 
    count: 0, 
    message: `Pemeriksaan selesai: Seluruh siswa telah tertib presensi atau sudah memiliki catatan log untuk ${witaDateStr}.` 
  };
}
