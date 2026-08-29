export type UserRole = 'ADMIN' | 'TEACHER' | 'PARENT' | 'SCANNER_POS';

export interface UserSession {
  isLoggedIn: boolean;
  role: UserRole;
  username: string;
  displayName: string;
  nipOrNisn?: string;
  teacherId?: string;
  studentId?: string;
  photoUrl?: string;
}

export type AttendanceStatus = 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA';

export interface Student {
  id: string;
  nisn: string;
  nis: string;
  name: string;
  gender: 'L' | 'P';
  classId: string;
  className: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  photoUrl: string;
  qrCode: string; // unique code string, e.g., "STUDENT-3529012"
  birthPlaceDate: string; // e.g., "Jakarta, 12 Mei 2010"
  address: string;
  password?: string;
}

export interface SchoolClass {
  id: string;
  grade: string; // e.g. "7", "8", "9"
  name: string; // e.g. "7-A"
  homeroomTeacher: string;
  totalStudents?: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  nisn: string;
  className: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  status: AttendanceStatus;
  method: 'QR_SCAN' | 'MANUAL' | 'IZIN_APPROVED';
  scannedBy: string; // e.g., "Pos Satpam 1", "Pak Budi (Guru Piket)"
  notes?: string;
  parentNotified: boolean;
  waLogId?: string;
  returnTime?: string; // HH:mm:ss (Waktu Pulang)
  returnStatus?: 'PULANG' | 'PULANG_CEPAT' | 'PULANG_TEPAT' | 'BELUM_PULANG';
  returnScannedBy?: string;
  returnWaLogId?: string;
}

export type LeaveType = 'SAKIT' | 'IZIN' | 'DESAK';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ChatMessage {
  id: string;
  senderRole: 'PARENT' | 'ADMIN' | 'TEACHER';
  senderName: string;
  message: string;
  timestamp: string;
  attachmentUrl?: string;
}

export interface LeaveRequest {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  parentName: string;
  parentPhone: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type: LeaveType;
  reason: string;
  photoProofUrl?: string;
  status: LeaveStatus;
  createdAt: string;
  adminNotes?: string;
  chatHistory: ChatMessage[];
}

export interface SchoolHoliday {
  id: string;
  name: string; // e.g. "Tahun Baru Masehi", "Hari Raya Idul Fitri", "Hari Kemerdekaan RI"
  date: string; // YYYY-MM-DD (Tanggal Mulai Libur)
  endDate?: string; // YYYY-MM-DD (Tanggal Selesai Libur, opsional jika 1 hari)
  description?: string;
  type?: 'NASIONAL' | 'SEKOLAH' | 'CUTI_BERSAMA';
}

export interface SchoolProfile {
  name: string;
  npsn: string;
  schoolLogo: string;
  regencyLogo: string;
  address: string;
  district: string;
  regency: string;
  province: string;
  phone: string;
  email: string;
  principalName: string;
  principalNip: string;
  principalSignatureUrl?: string;
  schoolStampUrl?: string;
  startTime: string; // "07:00"
  endTime?: string; // e.g. "15:00" Waktu Pulang Sekolah (Scan QR Pulang Aktif)
  autoAlpaTime?: string; // e.g. "08:30" Waktu Batas Otomatis Alpa
  lateToleranceMinutes: number; // e.g. 15 -> after 07:15 is TERLAMBAT
  educationLevel: string; // e.g. "SMP / MTs"
  gradeLevels: string[]; // e.g. ["Kelas 7", "Kelas 8", "Kelas 9"]
  academicYear?: string; // e.g. "2025/2026"
  semester?: 'GANJIL' | 'GENAP' | string; // e.g. "GANJIL" | "GENAP"
  waTemplateArrival: string;
  waTemplateLate: string;
  waTemplateAbsent: string;
  waTemplateDeparture?: string;
  waApiKey?: string; // Kode API Key / Token Device Gateway WhatsApp (Fonnte/Lainnya)
  waGatewayProvider?: string; // e.g., 'Fonnte' | 'Wablas' | 'Lainnya'
  waGatewayEnabled?: boolean; // Status aktif pengiriman WhatsApp via API Gateway
  activeDays?: string[]; // e.g. ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] Hari Aktif Belajar
  holidays?: SchoolHoliday[]; // Daftar Hari Libur Khusus / Libur Nasional
  cardOrientation?: 'PORTRAIT' | 'LANDSCAPE';
  subjects?: string[];
}

export interface Teacher {
  id: string;
  nip: string;
  name: string;
  birthPlace: string;
  birthDate: string; // YYYY-MM-DD
  subject1: string;
  subject2?: string;
  additionalDuty: 'WAKIL_KEPALA_SEKOLAH' | 'HUMAS' | 'BK' | 'WALI_KELAS' | 'TIDAK_ADA' | string;
  homeroomClassId?: string;
  homeroomClassName?: string;
  phone?: string;
  email?: string;
  gender?: 'L' | 'P';
  status?: 'AKTIF' | 'NON_AKTIF';
  photoUrl?: string;
  password?: string;
}

export interface WhatsAppLog {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  phone: string;
  message: string;
  status: 'TERKIRIM' | 'PENDING' | 'GAGAL';
  timestamp: string;
  type: 'HADIR' | 'TERLAMBAT' | 'ALPA' | 'IZIN' | 'SAKIT' | 'PULANG';
}

export type LearningParticipationStatus = 
  | 'Sangat aktif' 
  | 'Cukup aktif' 
  | 'Kurang aktif' 
  | 'Mengganggu' 
  | 'Tidak hadir di kelas';

export interface StudentLearningAttendance {
  studentId: string;
  studentName: string;
  nisn: string;
  status: LearningParticipationStatus;
  notes?: string;
}

export interface LearningJournal {
  id: string;
  date: string; // YYYY-MM-DD
  teacherName: string;
  classId: string;
  className: string;
  subject: string; // Mata Pelajaran
  periods: number[]; // Jam ke, e.g. [1, 2]
  material: string; // Materi yang diajarkan
  materialLimit?: string; // Batasan materi (target / cakupan materi)
  notesOrTask?: string; // Catatan & Tugas Pembelajaran
  studentAttendances: StudentLearningAttendance[];
  createdAt: string;
}

export interface CharacterPredicateSettings {
  minA: number; // e.g. 30 (Sangat Baik A)
  minB: number; // e.g. 10 (Baik B)
  minC: number; // e.g. 0 (Cukup C)
  minD: number; // e.g. -20 (Perlu Pembinaan D)
  minE: number; // e.g. -50 (Kriteria Tidak Naik Kelas E)
}

export type CharacterType = 'POSITIF' | 'NEGATIF';

export interface CharacterTrait {
  id: string;
  name: string; // Nama Karakter
  type: CharacterType; // 'POSITIF' | 'NEGATIF'
  points: number; // e.g. 10 or 5 (positive number or negative value)
  category?: string; // e.g. "Kedisiplinan", "Sikap", "Prestasi", "Pelanggaran"
}

export interface StudentCharacterLog {
  id: string;
  studentId: string;
  studentName: string;
  nisn: string;
  classId: string;
  className: string;
  traitId?: string;
  traitName: string;
  traitType: CharacterType; // 'POSITIF' | 'NEGATIF'
  points: number; // Poin
  evaluatorName: string; // Nama penilai / Guru
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  date: string; // YYYY-MM-DD
  photoProofUrl?: string; // Bukti foto
  notes?: string; // Catatan tambahan
  followUpNotes?: string; // Catatan tindak lanjut
  followUpPhotoUrl?: string; // Upload bukti foto tindak lanjut
  followUpDate?: string; // Waktu/tanggal tindak lanjut
  followUpBy?: string; // Petugas / Penindak Lanjut
}

export interface StudentGradeItem {
  studentId: string;
  studentName: string;
  nisn: string;
  nis?: string;
  dailyScore: number | null; // Nilai Harian
  assignmentScore: number | null; // Nilai Tugas
  examScore: number | null; // Nilai Ulangan
  finalScore?: number | null; // Rata-Rata Nilai
  predicate?: string; // e.g. "A", "B", "C", "D"
  notes?: string;
}

export interface StudentGradeAssessment {
  id: string;
  date: string; // YYYY-MM-DD
  teacherName: string;
  classId: string;
  className: string;
  subject: string; // Mata Pelajaran
  material: string; // Materi Pelajaran
  semester?: string;
  grades: StudentGradeItem[];
  createdAt: string;
  updatedAt?: string;
}


