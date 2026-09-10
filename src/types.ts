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
  website?: string;
  principalName: string;
  principalNip: string;
  principalSignatureUrl?: string;
  schoolStampUrl?: string;
  startTime: string; // "07:00"
  endTime?: string; // e.g. "15:00" Waktu Pulang Sekolah (Scan QR Pulang Aktif)
  autoAlpaTime?: string; // e.g. "08:30" Waktu Batas Otomatis Alpa
  autoAlpaEnabled?: boolean; // Saklar aktif/non-aktif penentuan otomatis status ALPA
  lateToleranceMinutes: number; // e.g. 15 -> after 07:15 is TERLAMBAT
  educationLevel: string; // e.g. "SMP / MTs"
  gradeLevels: string[]; // e.g. ["Kelas 7", "Kelas 8", "Kelas 9"]
  academicYear?: string; // e.g. "2025/2026"
  semester?: 'GANJIL' | 'GENAP' | string; // e.g. "GANJIL" | "GENAP"
  waTemplateArrival: string;
  waTemplateLate: string;
  waTemplateAbsent: string;
  waTemplateDeparture?: string;
  waParentNotificationEnabled?: boolean; // Saklar aktif/non-aktif pengiriman notifikasi WhatsApp ke orang tua (Masuk, Pulang, Alpa)
  waTemplateTeacherReminder?: string; // Template pengingat jam mengajar KBM guru
  waTeacherReminderEnabled?: boolean; // Saklar aktif/non-aktif pengingat jam mengajar guru otomatis
  waTeacherReminderMinutesBefore?: number; // Menit sebelum JP dimulai (0 = saat JP mulai, 5 = 5 menit sebelum, dsb)
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
  additionalDuty: 'WAKIL_KEPALA_SEKOLAH' | 'HUMAS' | 'BK' | 'WALI_KELAS' | 'ADMIN' | 'TU' | 'PERPUSTAKAAN' | 'TIDAK_ADA' | string;
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
  type: 'HADIR' | 'TERLAMBAT' | 'ALPA' | 'IZIN' | 'SAKIT' | 'PULANG' | 'JADWAL_GURU';
  recipientRole?: 'PARENT' | 'TEACHER';
  teacherId?: string;
  teacherName?: string;
  slotId?: string;
  periodNumber?: number;
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

export type LessonPeriodType = 'KBM' | 'ISTIRAHAT' | 'UPACARA' | 'LITERASI' | 'IBADAH' | 'LAINNYA';

export interface LessonPeriod {
  id: string;
  periodNumber: number; // 1, 2, 3... (0 untuk kegiatan non-JP seperti Upacara)
  label: string; // "JP 1", "JP 2", "Istirahat 1", "Upacara Bendera"
  startTime: string; // "07:00"
  endTime: string; // "07:40"
  type: LessonPeriodType;
  day?: string; // Optional if this period timing is specific to e.g. "Jumat", "Senin", or "SEMUA"
  daySpecific?: string; // Backward compatibility alias
  notes?: string;
}

export interface ClassScheduleSlot {
  id: string;
  classId: string;
  className: string;
  day: string; // "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
  periodNumber: number; // 1, 2, 3...
  periodId?: string; // Link to LessonPeriod
  subject: string; // e.g. "Matematika", "Bahasa Indonesia"
  teacherId: string; // e.g. "tch-001"
  teacherName: string; // e.g. "Siti Rahmawati, S.Pd."
  teacherNip?: string;
  room?: string; // e.g. "Ruang 7-A", "Lab Komputer"
  color?: string; // visual accent color tag
  notes?: string;
}

export interface ScheduleConflict {
  teacherId: string;
  teacherName: string;
  day: string;
  periodNumber: number;
  conflictingSlots: {
    slotId: string;
    classId: string;
    className: string;
    subject: string;
  }[];
}

// ---------------- ASISTEN GURU: BUAT SOAL & MODUL AJAR ----------------

export type EducationLevel = 'SD' | 'SMP' | 'SMA' | 'SMK';

export type ExamDifficulty = 'CAMPURAN' | 'MUDAH_LOTS' | 'SEDANG_MOTS' | 'SULIT_HOTS';

export interface QuestionGeneratorConfig {
  jenjang: EducationLevel;
  kelas: string; // e.g. "Kelas 4", "Kelas 7", "Kelas 10"
  mataPelajaran: string;
  topik: string;
  tingkatKesulitan: ExamDifficulty;
  tipeUjian: string; // e.g. "Penilaian Harian", "Asesmen Sumatif Tengah Semester", "Asesmen Sumatif Akhir Semester"
  jumlahPG: number; // Jumlah PG Teks Biasa
  jumlahPGBergambar: number; // Jumlah PG Bergambar / Stimulus Visual
  jumlahEssay: number; // Jumlah Essay Teks Biasa
  jumlahEssayBergambar: number; // Jumlah Essay Bergambar / Stimulus Visual
  jumlahBergambar?: number; // Total bergambar (backward compatibility)
  alokasiWaktu?: string;
  semester?: 'Ganjil' | 'Genap';
  tahunAjaran?: string;
  namaGuru?: string;
  namaSekolah?: string;
  petunjukKhusus?: string;
}

export interface GeneratedQuestionItem {
  id: string;
  no: number;
  tipe: 'PG' | 'ESSAY' | 'BERGAMBAR' | 'PG_BERGAMBAR' | 'ESSAY_BERGAMBAR';
  pertanyaan: string;
  stimulus?: string;
  gambarDeskripsi?: string; // Deskripsi gambar/diagram/tabel visual
  gambarSvg?: string; // Optional direct SVG diagram or visual representation
  pilihan?: { [key: string]: string }; // e.g. { A: '...', B: '...', C: '...', D: '...', E?: '...' }
  kunciJawaban: string;
  pembahasan: string;
  levelKognitif: string; // "C1", "C2", "C3", "C4", "C5", "C6" / "HOTS"
  indikatorSoal: string;
  rubrikPenskoran?: string;
  bobotSkor: number;
}

export interface KisiKisiItem {
  no: number;
  capaianPembelajaran: string;
  materi: string;
  indikatorSoal: string;
  levelKognitif: string;
  bentukSoal: string;
  nomorSoal: string;
  bobotSkor: number;
}

export interface GeneratedExamPackage {
  id: string;
  judul: string;
  config: QuestionGeneratorConfig;
  tanggalDibuat: string;
  kisiKisi: KisiKisiItem[];
  soalList: GeneratedQuestionItem[];
  petunjukUmum: string[];
}

export interface ModulAjarConfig {
  jenjang: EducationLevel;
  kelas: string;
  fase: string; // "Fase A", "Fase B", "Fase C", "Fase D", "Fase E", "Fase F"
  mataPelajaran: string;
  alokasiWaktu: string; // e.g. "2 x 45 Menit (1 Pertemuan)"
  topikMateri: string;
  modelPembelajaran: string; // "Problem Based Learning (PBL)", "Project Based Learning (PjBL)", "Discovery Learning", "Inquiry", dll.
  metodePembelajaran: string[];
  profilPancasila: string[];
  namaGuru?: string;
  namaSekolah?: string;
  tahunPenyusunan?: string;
}

export interface GeneratedModulAjar {
  id: string;
  judul: string;
  config: ModulAjarConfig;
  tanggalDibuat: string;
  informasiUmum: {
    penyusun: string;
    instansi: string;
    tahunPenyusunan: string;
    jenjangSekolah: string;
    mataPelajaran: string;
    faseKelas: string;
    alokasiWaktu: string;
    kompetensiAwal: string[];
    profilPelajarPancasila: string[];
    saranaPrasarana: string[];
    targetPesertaDidik: string;
    modelPembelajaran: string;
  };
  komponenInti: {
    tujuanPembelajaran: string[];
    pemahamanBermakna: string[];
    pertanyaanPemantik: string[];
    kegiatanPembelajaran: {
      pendahuluan: { alokasiMenit: number; langkah: string[] };
      inti: { alokasiMenit: number; langkah: string[] };
      penutup: { alokasiMenit: number; langkah: string[] };
    };
    asesmen: {
      diagnostik: string[];
      formatif: string[];
      sumatif: string[];
    };
    pengayaanDanRemedial: {
      pengayaan: string;
      remedial: string;
    };
    refleksi: {
      guru: string[];
      siswa: string[];
    };
  };
  lampiran: {
    lkpd: string;
    bahanBacaan: string;
    glosarium: { istilah: string; arti: string }[];
    daftarPustaka: string[];
    rubrikPenilaian: string;
  };
}




