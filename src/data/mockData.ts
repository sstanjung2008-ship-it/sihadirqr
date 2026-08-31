import { SchoolProfile, SchoolClass, Student, AttendanceRecord, LeaveRequest, WhatsAppLog, Teacher, LessonPeriod, ClassScheduleSlot } from '../types';

export const INITIAL_SCHOOL_PROFILE: SchoolProfile = {
  name: "SMP NEGERI 1 CERDAS BERSAMA",
  npsn: "20239102",
  schoolLogo: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=150&auto=format&fit=crop&q=80",
  regencyLogo: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=150&auto=format&fit=crop&q=80",
  address: "Jl. Pendidikan No. 45, Kompleks Pendidikan Utama",
  district: "Kec. Kebayoran Baru",
  regency: "Kota Jakarta Selatan",
  province: "DKI Jakarta",
  phone: "(021) 7890-1234",
  email: "info@smpn1cerdas.sch.id",
  principalName: "Drs. H. Ahmad Wijaya, M.Pd.",
  principalNip: "19720415 199803 1 004",
  startTime: "07:00",
  endTime: "15:00",
  autoAlpaTime: "08:30",
  lateToleranceMinutes: 15,
  educationLevel: "SMP / MTs",
  gradeLevels: ["Kelas 7", "Kelas 8", "Kelas 9"],
  waTemplateArrival: "Yth. Bpk/Ibu [ParentName], memberitahukan bahwa siswa [StudentName] ([ClassName]) telah Tiba di Sekolah pada [Time] WITA dalam keadaan TEPAT WAKTU.",
  waTemplateLate: "PEMBERITAHUAN TERLAMBAT: Yth. Bpk/Ibu [ParentName], siswa [StudentName] ([ClassName]) Tiba di Sekolah pukul [Time] WITA (Terlambat). Mohon perhatiannya.",
  waTemplateAbsent: "PERHATIAN: Yth. Bpk/Ibu [ParentName], siswa [StudentName] ([ClassName]) Belum Absen hingga pukul 08:30 WITA hari ini tanpa keterangan. Mohon konfirmasi.",
  waTemplateDeparture: "PEMBERITAHUAN PULANG: Yth. Bpk/Ibu [ParentName], memberitahukan bahwa siswa [StudentName] ([ClassName]) telah Pulang dari Sekolah pada pukul [Time] WITA. Terima kasih.",
  waParentNotificationEnabled: true,
  waTemplateTeacherReminder: "PENGINGAT MENGAJAR: Yth. Bpk/Ibu [TeacherName], mengingatkan bahwa jadwal mengajar mata pelajaran [Subject] di Kelas [ClassName] ([Room]) akan dimulai pada pukul [Time] WITA ([PeriodLabel]). Selamat menjalankan KBM!",
  waTeacherReminderEnabled: true,
  waTeacherReminderMinutesBefore: 0,
  waApiKey: "",
  waGatewayProvider: "Fonnte",
  waGatewayEnabled: true,
  activeDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  holidays: [
    {
      id: "hol-01",
      name: "Tahun Baru Masehi",
      date: "2026-01-01",
      type: "NASIONAL",
      description: "Libur Nasional Tahun Baru 2026"
    },
    {
      id: "hol-02",
      name: "Isra Mi'raj Nabi Muhammad SAW",
      date: "2026-01-16",
      type: "NASIONAL",
      description: "Libur Nasional Keagamaan"
    },
    {
      id: "hol-03",
      name: "Tahun Baru Imlek 2577 Kongzili",
      date: "2026-02-17",
      type: "NASIONAL",
      description: "Libur Nasional Tahun Baru Imlek"
    },
    {
      id: "hol-04",
      name: "Hari Suci Nyepi (Tahun Baru Saka 1948)",
      date: "2026-03-20",
      type: "NASIONAL",
      description: "Libur Nasional Keagamaan"
    },
    {
      id: "hol-05",
      name: "Hari Raya Idul Fitri 1447 H",
      date: "2026-03-21",
      endDate: "2026-03-23",
      type: "NASIONAL",
      description: "Libur Nasional & Cuti Bersama Idul Fitri"
    },
    {
      id: "hol-06",
      name: "Hari Buruh Internasional",
      date: "2026-05-01",
      type: "NASIONAL",
      description: "Libur Nasional Hari Buruh"
    },
    {
      id: "hol-07",
      name: "Kenaikan Yesus Kristus",
      date: "2026-05-14",
      type: "NASIONAL",
      description: "Libur Nasional Keagamaan"
    },
    {
      id: "hol-08",
      name: "Hari Lahir Pancasila",
      date: "2026-06-01",
      type: "NASIONAL",
      description: "Hari Lahir Pancasila"
    },
    {
      id: "hol-09",
      name: "Hari Kemerdekaan Republik Indonesia ke-81",
      date: "2026-08-17",
      type: "NASIONAL",
      description: "HUT Kemerdekaan RI"
    },
    {
      id: "hol-10",
      name: "Hari Raya Natal",
      date: "2026-12-25",
      type: "NASIONAL",
      description: "Libur Nasional Hari Raya Natal"
    }
  ],
  cardOrientation: "PORTRAIT",
  academicYear: "2025/2026",
  semester: "GANJIL",
  subjects: ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS", "Pendidikan Agama", "PJOK", "Seni Budaya", "Informatika", "PPKn"]
};

export const INITIAL_CLASSES: SchoolClass[] = [
  { id: "c7a", grade: "Kelas 7", name: "7-A", homeroomTeacher: "Siti Rahmawati, S.Pd.", totalStudents: 4 },
  { id: "c7b", grade: "Kelas 7", name: "7-B", homeroomTeacher: "Budi Santoso, M.Pd.", totalStudents: 3 },
  { id: "c8a", grade: "Kelas 8", name: "8-A", homeroomTeacher: "Dewi Lestari, S.Si.", totalStudents: 3 },
  { id: "c8b", grade: "Kelas 8", name: "8-B", homeroomTeacher: "Agus Pratama, S.Kom.", totalStudents: 2 },
  { id: "c9a", grade: "Kelas 9", name: "9-A", homeroomTeacher: "Nurul Hidayah, S.Ag.", totalStudents: 2 },
  { id: "c9b", grade: "Kelas 9", name: "9-B", homeroomTeacher: "Eko Prasetyo, M.T.", totalStudents: 2 },
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: "std-001",
    nisn: "0081234561",
    nis: "23240101",
    name: "Aditya Pratama",
    gender: "L",
    classId: "c7a",
    className: "7-A",
    parentName: "Bambang Pratama",
    parentPhone: "6281234567890",
    parentEmail: "bambang@gmail.com",
    photoUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234561",
    birthPlaceDate: "Jakarta, 14 Maret 2011",
    address: "Jl. Melati No. 12, Kebayoran Baru"
  },
  {
    id: "std-002",
    nisn: "0081234562",
    nis: "23240102",
    name: "Anisa Rahmawati",
    gender: "P",
    classId: "c7a",
    className: "7-A",
    parentName: "Hendra Rahmawan",
    parentPhone: "6281298765432",
    parentEmail: "hendra@gmail.com",
    photoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234562",
    birthPlaceDate: "Bandung, 22 April 2011",
    address: "Jl. Mawar No. 45, Kebayoran Baru"
  },
  {
    id: "std-003",
    nisn: "0081234563",
    nis: "23240103",
    name: "Bayu Kurniawan",
    gender: "L",
    classId: "c7a",
    className: "7-A",
    parentName: "Surya Kurniawan",
    parentPhone: "6281311223344",
    parentEmail: "surya@gmail.com",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234563",
    birthPlaceDate: "Bogor, 05 Juni 2011",
    address: "Jl. Anggrek No. 8, Jakarta Selatan"
  },
  {
    id: "std-004",
    nisn: "0081234564",
    nis: "23240104",
    name: "Citra Dewi",
    gender: "P",
    classId: "c7a",
    className: "7-A",
    parentName: "Agung Dewanto",
    parentPhone: "6281566778899",
    parentEmail: "agung@gmail.com",
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234564",
    birthPlaceDate: "Depok, 18 Agustus 2011",
    address: "Jl. Flamboyan No. 23, Jakarta"
  },
  {
    id: "std-005",
    nisn: "0081234565",
    nis: "23240105",
    name: "Dimas Anggara",
    gender: "L",
    classId: "c7b",
    className: "7-B",
    parentName: "Rudi Anggara",
    parentPhone: "6281788990011",
    parentEmail: "rudi@gmail.com",
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234565",
    birthPlaceDate: "Tangerang, 30 September 2011",
    address: "Jl. Kamboja No. 17, Jakarta"
  },
  {
    id: "std-006",
    nisn: "0081234566",
    nis: "23240106",
    name: "Eka Putri Lestari",
    gender: "P",
    classId: "c7b",
    className: "7-B",
    parentName: "Hadi Lestari",
    parentPhone: "6281900112233",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234566",
    birthPlaceDate: "Jakarta, 10 Oktober 2011",
    address: "Jl. Dahlia No. 3, Jakarta Selatan"
  },
  {
    id: "std-007",
    nisn: "0081234567",
    nis: "23240107",
    name: "Faris Hidayat",
    gender: "L",
    classId: "c8a",
    className: "8-A",
    parentName: "Lukman Hidayat",
    parentPhone: "6282122334455",
    photoUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234567",
    birthPlaceDate: "Bekasi, 02 Januari 2010",
    address: "Jl. Kenanga No. 5, Kebayoran Baru"
  },
  {
    id: "std-008",
    nisn: "0081234568",
    nis: "23240108",
    name: "Gita Gutawa",
    gender: "P",
    classId: "c8a",
    className: "8-A",
    parentName: "Erwin Gutawa",
    parentPhone: "6282233445566",
    photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234568",
    birthPlaceDate: "Jakarta, 11 November 2010",
    address: "Jl. Cempaka No. 88, Jakarta"
  },
  {
    id: "std-009",
    nisn: "0081234569",
    nis: "23240109",
    name: "Hafiz Syahputra",
    gender: "L",
    classId: "c8b",
    className: "8-B",
    parentName: "Irfan Syahputra",
    parentPhone: "6282344556677",
    photoUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234569",
    birthPlaceDate: "Medan, 07 Februari 2010",
    address: "Jl. Cendana No. 29, Jakarta"
  },
  {
    id: "std-010",
    nisn: "0081234570",
    nis: "23240110",
    name: "Intan Permata",
    gender: "P",
    classId: "c9a",
    className: "9-A",
    parentName: "Ferry Permana",
    parentPhone: "6282455667788",
    photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234570",
    birthPlaceDate: "Surabaya, 25 Mei 2009",
    address: "Jl. Teratai No. 14, Jakarta"
  },
  {
    id: "std-011",
    nisn: "0081234571",
    nis: "23240111",
    name: "Joko Susilo",
    gender: "L",
    classId: "c9a",
    className: "9-A",
    parentName: "Darno Susilo",
    parentPhone: "6282566778899",
    photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234571",
    birthPlaceDate: "Yogyakarta, 19 Juli 2009",
    address: "Jl. Veteran No. 7, Jakarta"
  },
  {
    id: "std-012",
    nisn: "0081234572",
    nis: "23240112",
    name: "Keisha Maharani",
    gender: "P",
    classId: "c9b",
    className: "9-B",
    parentName: "Dedi Maharani",
    parentPhone: "6282677889900",
    photoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    qrCode: "STUDENT-0081234572",
    birthPlaceDate: "Semarang, 03 Desember 2009",
    address: "Jl. Gelora No. 19, Jakarta"
  }
];

// Generate recent 14 days attendance records
export function generateInitialAttendanceHistory(students: Student[]): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    
    // Skip weekends (Sunday=0, Saturday=6)
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dateStr = d.toISOString().split('T')[0];

    students.forEach((student, idx) => {
      // Create interesting distribution
      let status: AttendanceRecord['status'] = 'HADIR';
      let time = "06:45:12";
      
      const rand = (i * 7 + idx * 13) % 100;
      
      if (rand > 85) {
        status = 'TERLAMBAT';
        time = "07:22:10";
      } else if (rand > 78 && rand <= 85) {
        status = 'IZIN';
        time = "07:00:00";
      } else if (rand > 72 && rand <= 78) {
        status = 'SAKIT';
        time = "07:00:00";
      } else if (rand > 68 && rand <= 72) {
        status = 'ALPA';
        time = "-";
      } else {
        status = 'HADIR';
        time = `06:${30 + (idx % 25)}:${10 + (idx % 45)}`;
      }

      const isPresent = status === 'HADIR' || status === 'TERLAMBAT';
      const hasReturned = isPresent && ((i * 3 + idx) % 5 !== 0); // most present students returned
      const returnTimeStr = hasReturned ? `15:${10 + (idx % 35)}:${12 + (idx % 40)}` : undefined;
      const returnStatusVal = hasReturned ? 'PULANG' : undefined;

      records.push({
        id: `att-${dateStr}-${student.id}`,
        studentId: student.id,
        studentName: student.name,
        nisn: student.nisn,
        className: student.className,
        date: dateStr,
        time: status === 'ALPA' ? '-' : time,
        status,
        method: status === 'IZIN' || status === 'SAKIT' ? 'IZIN_APPROVED' : 'QR_SCAN',
        scannedBy: "Pos Satpam Utama",
        notes: status === 'TERLAMBAT' ? 'Macet lalu lintas' : (status === 'SAKIT' ? 'Demam & flu' : undefined),
        parentNotified: true,
        waLogId: `wa-${dateStr}-${student.id}`,
        returnTime: returnTimeStr,
        returnStatus: returnStatusVal,
        returnScannedBy: hasReturned ? "Pos Satpam Utama (Pulang)" : undefined
      });
    });
  }

  return records;
}

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: "leave-001",
    studentId: "std-002",
    studentName: "Anisa Rahmawati",
    className: "7-A",
    parentName: "Hendra Rahmawan",
    parentPhone: "6281298765432",
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    type: "SAKIT",
    reason: "Anisa mengalami demam tinggi dan pusing sejak semalam. Mohon izin tidak dapat mengikuti pelajaran.",
    photoProofUrl: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop&q=80",
    status: "PENDING",
    createdAt: new Date().toISOString(),
    chatHistory: [
      {
        id: "msg-1",
        senderRole: "PARENT",
        senderName: "Hendra Rahmawan (Orang Tua Anisa)",
        message: "Selamat pagi Bpk/Ibu Wali Kelas. Saya melampirkan surat keterangan dokter untuk Anisa Rahmawati yang sedang sakit demam.",
        timestamp: "06:30",
        attachmentUrl: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop&q=80"
      }
    ]
  },
  {
    id: "leave-002",
    studentId: "std-005",
    studentName: "Dimas Anggara",
    className: "7-B",
    parentName: "Rudi Anggara",
    parentPhone: "6281788990011",
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    type: "IZIN",
    reason: "Menghadiri acara pernikahan kakak kandung di Bandung.",
    photoProofUrl: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=500&auto=format&fit=crop&q=80",
    status: "APPROVED",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    adminNotes: "Izin disetujui oleh Wali Kelas 7-B. Semoga acara berjalan lancar.",
    chatHistory: [
      {
        id: "msg-20",
        senderRole: "PARENT",
        senderName: "Rudi Anggara",
        message: "Mohon izin untuk Dimas Anggara menghadiri acara keluarga di luar kota.",
        timestamp: "Kemarin, 19:20"
      },
      {
        id: "msg-21",
        senderRole: "ADMIN",
        senderName: "Budi Santoso, M.Pd. (Wali Kelas)",
        message: "Baik Bpk. Rudi, permohonan izin telah kami setujui di sistem. Terima kasih atas informasinya.",
        timestamp: "Kemarin, 20:05"
      }
    ]
  }
];

export const INITIAL_WA_LOGS: WhatsAppLog[] = [
  {
    id: "wa-101",
    studentId: "std-001",
    studentName: "Aditya Pratama",
    className: "7-A",
    phone: "6281234567890",
    message: "Yth. Bpk/Ibu Bambang Pratama, memberitahukan bahwa siswa Aditya Pratama (7-A) telah Tiba di Sekolah pada 06:42 WITA dalam keadaan TEPAT WAKTU.",
    status: "TERKIRIM",
    timestamp: new Date().toISOString(),
    type: "HADIR"
  }
];

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: "tch-001",
    nip: "19850312 201001 2 015",
    name: "Siti Rahmawati, S.Pd.",
    birthPlace: "Bandung",
    birthDate: "1985-03-12",
    subject1: "Matematika",
    subject2: "Informatika",
    additionalDuty: "WALI_KELAS",
    homeroomClassId: "c7a",
    homeroomClassName: "7-A",
    phone: "081234567891",
    email: "siti.rahmawati@smpn1cerdas.sch.id",
    gender: "P",
    status: "AKTIF"
  },
  {
    id: "tch-002",
    nip: "19790820 200501 1 008",
    name: "Budi Santoso, M.Pd.",
    birthPlace: "Surakarta",
    birthDate: "1979-08-20",
    subject1: "Bahasa Indonesia",
    subject2: "Seni Budaya",
    additionalDuty: "WAKIL_KEPALA_SEKOLAH",
    homeroomClassId: "c7b",
    homeroomClassName: "7-B",
    phone: "081398765432",
    email: "budi.santoso@smpn1cerdas.sch.id",
    gender: "L",
    status: "AKTIF"
  },
  {
    id: "tch-003",
    nip: "19881105 201402 2 009",
    name: "Dewi Lestari, S.Si.",
    birthPlace: "Yogyakarta",
    birthDate: "1988-11-05",
    subject1: "IPA",
    subject2: "Matematika",
    additionalDuty: "WALI_KELAS",
    homeroomClassId: "c8a",
    homeroomClassName: "8-A",
    phone: "081567890123",
    email: "dewi.lestari@smpn1cerdas.sch.id",
    gender: "P",
    status: "AKTIF"
  },
  {
    id: "tch-004",
    nip: "19910403 201903 1 011",
    name: "Agus Pratama, S.Kom.",
    birthPlace: "Semarang",
    birthDate: "1991-04-03",
    subject1: "Informatika",
    subject2: "Bahasa Inggris",
    additionalDuty: "WALI_KELAS",
    homeroomClassId: "c8b",
    homeroomClassName: "8-B",
    phone: "081789012345",
    email: "agus.pratama@smpn1cerdas.sch.id",
    gender: "L",
    status: "AKTIF"
  },
  {
    id: "tch-005",
    nip: "19830218 200902 2 004",
    name: "Nurul Hidayah, S.Ag.",
    birthPlace: "Malang",
    birthDate: "1983-02-18",
    subject1: "Pendidikan Agama",
    subject2: "PPKn",
    additionalDuty: "WALI_KELAS",
    homeroomClassId: "c9a",
    homeroomClassName: "9-A",
    phone: "081890123456",
    email: "nurul.hidayah@smpn1cerdas.sch.id",
    gender: "P",
    status: "AKTIF"
  },
  {
    id: "tch-006",
    nip: "19820514 200801 2 006",
    name: "Dra. Hj. Rina Wijaya",
    birthPlace: "Jakarta",
    birthDate: "1982-05-14",
    subject1: "Bahasa Inggris",
    subject2: "Informatika",
    additionalDuty: "HUMAS",
    phone: "081299887766",
    email: "humas@smpn1cerdas.sch.id",
    gender: "P",
    status: "AKTIF"
  },
  {
    id: "tch-007",
    nip: "19900210 201801 1 003",
    name: "Ahmad Fauzi, S.Psi.",
    birthPlace: "Surabaya",
    birthDate: "1990-02-10",
    subject1: "Bimbingan Konseling (BK)",
    additionalDuty: "BK",
    phone: "081377665544",
    email: "bk@smpn1cerdas.sch.id",
    gender: "L",
    status: "AKTIF"
  }
];

export const INITIAL_CHARACTER_TRAITS: any[] = [
  { id: "trait-001", name: "Datang Tepat Waktu & Disiplin", type: "POSITIF", points: 10, category: "Kedisiplinan" },
  { id: "trait-002", name: "Aktif Bertanya & Berdiskusi dalam KBM", type: "POSITIF", points: 10, category: "Keaktifan" },
  { id: "trait-003", name: "Menolong Teman & Bekerjasama", type: "POSITIF", points: 5, category: "Sosial" },
  { id: "trait-004", name: "Menjaga Kebersihan Lingkungan Sekolah", type: "POSITIF", points: 5, category: "Kebersihan" },
  { id: "trait-005", name: "Jujur & Mengembalikan Barang Teman", type: "POSITIF", points: 15, category: "Integritas" },
  { id: "trait-006", name: "Meraih Prestasi / Juara Lomba", type: "POSITIF", points: 20, category: "Prestasi" },
  { id: "trait-007", name: "Terlambat Masuk Jam Pelajaran", type: "NEGATIF", points: 5, category: "Kedisiplinan" },
  { id: "trait-008", name: "Membuang Sampah Sembarangan", type: "NEGATIF", points: 5, category: "Kebersihan" },
  { id: "trait-009", name: "Bermain HP / Tidur Saat KBM", type: "NEGATIF", points: 10, category: "Pelanggaran" },
  { id: "trait-010", name: "Tidak Mengerjakan Tugas / PR", type: "NEGATIF", points: 10, category: "Tanggung Jawab" },
  { id: "trait-011", name: "Membolos Jam Pelajaran", type: "NEGATIF", points: 15, category: "Pelanggaran Berat" },
  { id: "trait-012", name: "Merusak Fasilitas / Coreti Meja", type: "NEGATIF", points: 15, category: "Ketertiban" }
];

export const INITIAL_STUDENT_CHARACTER_LOGS: any[] = [
  {
    id: "log-001",
    studentId: "std-001",
    studentName: "Aditya Pratama",
    nisn: "0081234561",
    classId: "c7a",
    className: "7-A",
    traitId: "trait-001",
    traitName: "Datang Tepat Waktu & Disiplin",
    traitType: "POSITIF",
    points: 10,
    evaluatorName: "Siti Rahmawati, S.Pd.",
    timestamp: "2026-08-04 07:10:00",
    date: "2026-08-04",
    photoProofUrl: "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=400&auto=format&fit=crop&q=80",
    notes: "Memimpin doa pagi di kelas 7-A"
  },
  {
    id: "log-002",
    studentId: "std-001",
    studentName: "Aditya Pratama",
    nisn: "0081234561",
    classId: "c7a",
    className: "7-A",
    traitId: "trait-006",
    traitName: "Meraih Prestasi / Juara Lomba",
    traitType: "POSITIF",
    points: 20,
    evaluatorName: "Budi Santoso, M.Pd.",
    timestamp: "2026-08-03 10:15:00",
    date: "2026-08-03",
    photoProofUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&auto=format&fit=crop&q=80",
    notes: "Juara 1 Olimpiade Matematika Tingkat Kecamatan"
  },
  {
    id: "log-003",
    studentId: "std-002",
    studentName: "Anisa Rahmawati",
    nisn: "0081234562",
    classId: "c7a",
    className: "7-A",
    traitId: "trait-002",
    traitName: "Aktif Bertanya & Berdiskusi dalam KBM",
    traitType: "POSITIF",
    points: 10,
    evaluatorName: "Siti Rahmawati, S.Pd.",
    timestamp: "2026-08-04 09:30:00",
    date: "2026-08-04",
    photoProofUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&auto=format&fit=crop&q=80",
    notes: "Sangat aktif mempresentasikan materi IPA"
  },
  {
    id: "log-004",
    studentId: "std-002",
    studentName: "Anisa Rahmawati",
    nisn: "0081234562",
    classId: "c7a",
    className: "7-A",
    traitId: "trait-005",
    traitName: "Jujur & Mengembalikan Barang Teman",
    traitType: "POSITIF",
    points: 15,
    evaluatorName: "Dewi Lestari, S.Si.",
    timestamp: "2026-08-01 11:20:00",
    date: "2026-08-01",
    notes: "Mengembalikan dompet berisi uang milik petugas perpustakaan"
  },
  {
    id: "log-005",
    studentId: "std-003",
    studentName: "Bayu Kurniawan",
    nisn: "0081234563",
    classId: "c7a",
    className: "7-A",
    traitId: "trait-009",
    traitName: "Bermain HP / Tidur Saat KBM",
    traitType: "NEGATIF",
    points: 10,
    evaluatorName: "Agus Pratama, S.Kom.",
    timestamp: "2026-08-02 08:05:00",
    date: "2026-08-02",
    photoProofUrl: "https://images.unsplash.com/photo-1588072432836-e10032774350?w=400&auto=format&fit=crop&q=80",
    notes: "Bermain game online di HP saat penjelasan materi"
  },
  {
    id: "log-006",
    studentId: "std-003",
    studentName: "Bayu Kurniawan",
    nisn: "0081234563",
    classId: "c7a",
    className: "7-A",
    traitId: "trait-011",
    traitName: "Membolos Jam Pelajaran",
    traitType: "NEGATIF",
    points: 15,
    evaluatorName: "Ahmad Fauzi, S.Psi.",
    timestamp: "2026-08-04 11:00:00",
    date: "2026-08-04",
    notes: "Pergi ke kantin di luar jam istirahat tanpa izin"
  },
  {
    id: "log-007",
    studentId: "std-005",
    studentName: "Dimas Anggara",
    nisn: "0081234565",
    classId: "c7b",
    className: "7-B",
    traitId: "trait-010",
    traitName: "Tidak Mengerjakan Tugas / PR",
    traitType: "NEGATIF",
    points: 10,
    evaluatorName: "Budi Santoso, M.Pd.",
    timestamp: "2026-08-03 08:30:00",
    date: "2026-08-03",
    notes: "Belum membuat tugas resume Bab 2 Bahasa Indonesia"
  },
  {
    id: "log-008",
    studentId: "std-006",
    studentName: "Eka Putri Lestari",
    nisn: "0081234566",
    classId: "c7b",
    className: "7-B",
    traitId: "trait-001",
    traitName: "Datang Tepat Waktu & Disiplin",
    traitType: "POSITIF",
    points: 10,
    evaluatorName: "Siti Rahmawati, S.Pd.",
    timestamp: "2026-08-04 06:40:00",
    date: "2026-08-04",
    notes: "Hadir pertama di sekolah jam 06:30 WITA"
  }
];

export const INITIAL_LEARNING_JOURNALS: any[] = [
  {
    id: "lj-001",
    date: new Date().toISOString().split('T')[0],
    teacherName: "Siti Rahmawati, S.Pd.",
    classId: "c7a",
    className: "7-A",
    subject: "Matematika",
    periods: [1, 2],
    material: "Aljabar dan Persamaan Linear Direct",
    materialLimit: "Sub-Bab 2.1 s.d 2.3 (Buku Paket Hal. 45-58)",
    notesOrTask: "Kerjakan Soal Latihan Mandiri 2.3 Nomor 1-5 Halaman 60, dikumpulkan minggu depan.",
    studentAttendances: [
      { studentId: "std-001", studentName: "Aditya Pratama", nisn: "0081234561", status: "Sangat aktif", notes: "Menjawab soal di papan tulis dengan tepat" },
      { studentId: "std-002", studentName: "Anisa Rahmawati", nisn: "0081234562", status: "Sangat aktif", notes: "Memimpin diskusi kelompok" },
      { studentId: "std-003", studentName: "Bayu Kurniawan", nisn: "0081234563", status: "Mengganggu", notes: "Bermain HP dan berisik saat guru menerangkan" },
      { studentId: "std-004", studentName: "Citra Dewi", nisn: "0081234564", status: "Cukup aktif" }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "lj-002",
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    teacherName: "Budi Santoso, M.Pd.",
    classId: "c7a",
    className: "7-A",
    subject: "Bahasa Indonesia",
    periods: [3, 4],
    material: "Teks Laporan Hasil Observasi",
    materialLimit: "Struktur dan Kaidah Kebahasaan LHO (KD 3.4)",
    notesOrTask: "Membuat draft laporan observasi lingkungan sekolah secara berkelompok.",
    studentAttendances: [
      { studentId: "std-001", studentName: "Aditya Pratama", nisn: "0081234561", status: "Sangat aktif" },
      { studentId: "std-002", studentName: "Anisa Rahmawati", nisn: "0081234562", status: "Sangat aktif" },
      { studentId: "std-003", studentName: "Bayu Kurniawan", nisn: "0081234563", status: "Tidak hadir di kelas", notes: "Meninggalkan kelas tanpa izin" },
      { studentId: "std-004", studentName: "Citra Dewi", nisn: "0081234564", status: "Sangat aktif" }
    ],
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: "lj-003",
    date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    teacherName: "Agus Pratama, S.Kom.",
    classId: "c7b",
    className: "7-B",
    subject: "Informatika",
    periods: [1, 2],
    material: "Pengenalan Algoritma Pemrograman",
    materialLimit: "Flowchart & Pseudocode Dasar (Modul 1-2)",
    notesOrTask: "Latihan membuat algoritma perebusan mie instan dan flowchart percabangan.",
    studentAttendances: [
      { studentId: "std-005", studentName: "Dimas Anggara", nisn: "0081234565", status: "Mengganggu", notes: "Mengganggu teman samping saat kuis" },
      { studentId: "std-006", studentName: "Eka Putri Lestari", nisn: "0081234566", status: "Sangat aktif", notes: "Menyelesaikan tantangan coding paling cepat" }
    ],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];

export const INITIAL_LESSON_PERIODS: LessonPeriod[] = [
  { id: 'lp-01', periodNumber: 1, label: 'JP 1', startTime: '07:00', endTime: '07:40', type: 'KBM' },
  { id: 'lp-02', periodNumber: 2, label: 'JP 2', startTime: '07:40', endTime: '08:20', type: 'KBM' },
  { id: 'lp-03', periodNumber: 3, label: 'JP 3', startTime: '08:20', endTime: '09:00', type: 'KBM' },
  { id: 'lp-04', periodNumber: 4, label: 'JP 4', startTime: '09:00', endTime: '09:40', type: 'KBM' },
  { id: 'lp-05', periodNumber: 0, label: 'Istirahat 1', startTime: '09:40', endTime: '10:10', type: 'ISTIRAHAT', notes: 'Snack & Istirahat Pagi' },
  { id: 'lp-06', periodNumber: 5, label: 'JP 5', startTime: '10:10', endTime: '10:50', type: 'KBM' },
  { id: 'lp-07', periodNumber: 6, label: 'JP 6', startTime: '10:50', endTime: '11:30', type: 'KBM' },
  { id: 'lp-08', periodNumber: 7, label: 'JP 7', startTime: '11:30', endTime: '12:10', type: 'KBM' },
  { id: 'lp-09', periodNumber: 0, label: 'Istirahat 2 / Sholat Dzuhur', startTime: '12:10', endTime: '12:50', type: 'IBADAH', notes: 'Sholat Dzuhur Berjamaah & Makan Siang' },
  { id: 'lp-10', periodNumber: 8, label: 'JP 8', startTime: '12:50', endTime: '13:30', type: 'KBM' },
  { id: 'lp-11', periodNumber: 9, label: 'JP 9', startTime: '13:30', endTime: '14:10', type: 'KBM' },
];

export const INITIAL_CLASS_SCHEDULES: ClassScheduleSlot[] = [
  // Kelas 7-A
  { id: 'sch-7a-sen-1', classId: 'c7a', className: '7-A', day: 'Senin', periodNumber: 1, subject: 'Matematika', teacherId: 'tch-001', teacherName: 'Siti Rahmawati, S.Pd.', teacherNip: '19850312 201001 2 015', room: 'Ruang 7-A', color: 'indigo' },
  { id: 'sch-7a-sen-2', classId: 'c7a', className: '7-A', day: 'Senin', periodNumber: 2, subject: 'Matematika', teacherId: 'tch-001', teacherName: 'Siti Rahmawati, S.Pd.', teacherNip: '19850312 201001 2 015', room: 'Ruang 7-A', color: 'indigo' },
  { id: 'sch-7a-sen-3', classId: 'c7a', className: '7-A', day: 'Senin', periodNumber: 3, subject: 'Bahasa Indonesia', teacherId: 'tch-002', teacherName: 'Budi Santoso, M.Pd.', teacherNip: '19790820 200501 1 008', room: 'Ruang 7-A', color: 'blue' },
  { id: 'sch-7a-sen-4', classId: 'c7a', className: '7-A', day: 'Senin', periodNumber: 4, subject: 'Bahasa Indonesia', teacherId: 'tch-002', teacherName: 'Budi Santoso, M.Pd.', teacherNip: '19790820 200501 1 008', room: 'Ruang 7-A', color: 'blue' },
  { id: 'sch-7a-sen-5', classId: 'c7a', className: '7-A', day: 'Senin', periodNumber: 5, subject: 'IPA', teacherId: 'tch-003', teacherName: 'Dewi Lestari, S.Si.', teacherNip: '19881105 201402 2 009', room: 'Lab IPA', color: 'emerald' },
  { id: 'sch-7a-sen-6', classId: 'c7a', className: '7-A', day: 'Senin', periodNumber: 6, subject: 'IPA', teacherId: 'tch-003', teacherName: 'Dewi Lestari, S.Si.', teacherNip: '19881105 201402 2 009', room: 'Lab IPA', color: 'emerald' },
  { id: 'sch-7a-sen-7', classId: 'c7a', className: '7-A', day: 'Senin', periodNumber: 7, subject: 'PPKn', teacherId: 'tch-005', teacherName: 'Nurul Hidayah, S.Ag.', teacherNip: '19820614 200902 2 007', room: 'Ruang 7-A', color: 'rose' },

  { id: 'sch-7a-sel-1', classId: 'c7a', className: '7-A', day: 'Selasa', periodNumber: 1, subject: 'Bahasa Inggris', teacherId: 'tch-007', teacherName: 'Rina Marlina, M.Pd.', teacherNip: '19860719 201101 2 012', room: 'Ruang 7-A', color: 'amber' },
  { id: 'sch-7a-sel-2', classId: 'c7a', className: '7-A', day: 'Selasa', periodNumber: 2, subject: 'Bahasa Inggris', teacherId: 'tch-007', teacherName: 'Rina Marlina, M.Pd.', teacherNip: '19860719 201101 2 012', room: 'Ruang 7-A', color: 'amber' },
  { id: 'sch-7a-sel-3', classId: 'c7a', className: '7-A', day: 'Selasa', periodNumber: 3, subject: 'Informatika', teacherId: 'tch-004', teacherName: 'Agus Pratama, S.Kom.', teacherNip: '19910403 201903 1 011', room: 'Lab Komputer', color: 'cyan' },
  { id: 'sch-7a-sel-4', classId: 'c7a', className: '7-A', day: 'Selasa', periodNumber: 4, subject: 'Informatika', teacherId: 'tch-004', teacherName: 'Agus Pratama, S.Kom.', teacherNip: '19910403 201903 1 011', room: 'Lab Komputer', color: 'cyan' },
  { id: 'sch-7a-sel-5', classId: 'c7a', className: '7-A', day: 'Selasa', periodNumber: 5, subject: 'Pendidikan Agama', teacherId: 'tch-005', teacherName: 'Nurul Hidayah, S.Ag.', teacherNip: '19820614 200902 2 007', room: 'Ruang 7-A', color: 'emerald' },
  { id: 'sch-7a-sel-6', classId: 'c7a', className: '7-A', day: 'Selasa', periodNumber: 6, subject: 'Pendidikan Agama', teacherId: 'tch-005', teacherName: 'Nurul Hidayah, S.Ag.', teacherNip: '19820614 200902 2 007', room: 'Ruang 7-A', color: 'emerald' },

  { id: 'sch-7a-rab-1', classId: 'c7a', className: '7-A', day: 'Rabu', periodNumber: 1, subject: 'PJOK', teacherId: 'tch-006', teacherName: 'Eko Prasetyo, M.T.', teacherNip: '19800512 200801 1 014', room: 'Lapangan Olahraga', color: 'orange' },
  { id: 'sch-7a-rab-2', classId: 'c7a', className: '7-A', day: 'Rabu', periodNumber: 2, subject: 'PJOK', teacherId: 'tch-006', teacherName: 'Eko Prasetyo, M.T.', teacherNip: '19800512 200801 1 014', room: 'Lapangan Olahraga', color: 'orange' },
  { id: 'sch-7a-rab-3', classId: 'c7a', className: '7-A', day: 'Rabu', periodNumber: 3, subject: 'PJOK', teacherId: 'tch-006', teacherName: 'Eko Prasetyo, M.T.', teacherNip: '19800512 200801 1 014', room: 'Lapangan Olahraga', color: 'orange' },
  { id: 'sch-7a-rab-4', classId: 'c7a', className: '7-A', day: 'Rabu', periodNumber: 4, subject: 'IPS', teacherId: 'tch-008', teacherName: 'Dra. Endang Sulastri', teacherNip: '19750910 200003 2 004', room: 'Ruang 7-A', color: 'violet' },
  { id: 'sch-7a-rab-5', classId: 'c7a', className: '7-A', day: 'Rabu', periodNumber: 5, subject: 'IPS', teacherId: 'tch-008', teacherName: 'Dra. Endang Sulastri', teacherNip: '19750910 200003 2 004', room: 'Ruang 7-A', color: 'violet' },
  { id: 'sch-7a-rab-6', classId: 'c7a', className: '7-A', day: 'Rabu', periodNumber: 6, subject: 'Seni Budaya', teacherId: 'tch-002', teacherName: 'Budi Santoso, M.Pd.', teacherNip: '19790820 200501 1 008', room: 'Ruang Seni', color: 'purple' },

  { id: 'sch-7a-kam-1', classId: 'c7a', className: '7-A', day: 'Kamis', periodNumber: 1, subject: 'Matematika', teacherId: 'tch-001', teacherName: 'Siti Rahmawati, S.Pd.', teacherNip: '19850312 201001 2 015', room: 'Ruang 7-A', color: 'indigo' },
  { id: 'sch-7a-kam-2', classId: 'c7a', className: '7-A', day: 'Kamis', periodNumber: 2, subject: 'Matematika', teacherId: 'tch-001', teacherName: 'Siti Rahmawati, S.Pd.', teacherNip: '19850312 201001 2 015', room: 'Ruang 7-A', color: 'indigo' },
  { id: 'sch-7a-kam-3', classId: 'c7a', className: '7-A', day: 'Kamis', periodNumber: 3, subject: 'IPA', teacherId: 'tch-003', teacherName: 'Dewi Lestari, S.Si.', teacherNip: '19881105 201402 2 009', room: 'Lab IPA', color: 'emerald' },
  { id: 'sch-7a-kam-4', classId: 'c7a', className: '7-A', day: 'Kamis', periodNumber: 4, subject: 'IPA', teacherId: 'tch-003', teacherName: 'Dewi Lestari, S.Si.', teacherNip: '19881105 201402 2 009', room: 'Lab IPA', color: 'emerald' },
  { id: 'sch-7a-kam-5', classId: 'c7a', className: '7-A', day: 'Kamis', periodNumber: 5, subject: 'Bahasa Indonesia', teacherId: 'tch-002', teacherName: 'Budi Santoso, M.Pd.', teacherNip: '19790820 200501 1 008', room: 'Ruang 7-A', color: 'blue' },

  { id: 'sch-7a-jum-1', classId: 'c7a', className: '7-A', day: 'Jumat', periodNumber: 1, subject: 'Pendidikan Agama', teacherId: 'tch-005', teacherName: 'Nurul Hidayah, S.Ag.', teacherNip: '19820614 200902 2 007', room: 'Ruang 7-A', color: 'emerald' },
  { id: 'sch-7a-jum-2', classId: 'c7a', className: '7-A', day: 'Jumat', periodNumber: 2, subject: 'PPKn', teacherId: 'tch-005', teacherName: 'Nurul Hidayah, S.Ag.', teacherNip: '19820614 200902 2 007', room: 'Ruang 7-A', color: 'rose' },
  { id: 'sch-7a-jum-3', classId: 'c7a', className: '7-A', day: 'Jumat', periodNumber: 3, subject: 'Bahasa Inggris', teacherId: 'tch-007', teacherName: 'Rina Marlina, M.Pd.', teacherNip: '19860719 201101 2 012', room: 'Ruang 7-A', color: 'amber' },
  { id: 'sch-7a-jum-4', classId: 'c7a', className: '7-A', day: 'Jumat', periodNumber: 4, subject: 'Bahasa Inggris', teacherId: 'tch-007', teacherName: 'Rina Marlina, M.Pd.', teacherNip: '19860719 201101 2 012', room: 'Ruang 7-A', color: 'amber' },

  { id: 'sch-7a-sab-1', classId: 'c7a', className: '7-A', day: 'Sabtu', periodNumber: 1, subject: 'Seni Budaya', teacherId: 'tch-002', teacherName: 'Budi Santoso, M.Pd.', teacherNip: '19790820 200501 1 008', room: 'Ruang Seni', color: 'purple' },
  { id: 'sch-7a-sab-2', classId: 'c7a', className: '7-A', day: 'Sabtu', periodNumber: 2, subject: 'Informatika', teacherId: 'tch-004', teacherName: 'Agus Pratama, S.Kom.', teacherNip: '19910403 201903 1 011', room: 'Lab Komputer', color: 'cyan' },
  { id: 'sch-7a-sab-3', classId: 'c7a', className: '7-A', day: 'Sabtu', periodNumber: 3, subject: 'Bimbingan Konseling', teacherId: 'tch-005', teacherName: 'Nurul Hidayah, S.Ag.', teacherNip: '19820614 200902 2 007', room: 'Ruang 7-A', color: 'teal' },

  // Kelas 7-B
  { id: 'sch-7b-sen-1', classId: 'c7b', className: '7-B', day: 'Senin', periodNumber: 1, subject: 'Informatika', teacherId: 'tch-004', teacherName: 'Agus Pratama, S.Kom.', teacherNip: '19910403 201903 1 011', room: 'Lab Komputer', color: 'cyan' },
  { id: 'sch-7b-sen-2', classId: 'c7b', className: '7-B', day: 'Senin', periodNumber: 2, subject: 'Informatika', teacherId: 'tch-004', teacherName: 'Agus Pratama, S.Kom.', teacherNip: '19910403 201903 1 011', room: 'Lab Komputer', color: 'cyan' },
  { id: 'sch-7b-sen-3', classId: 'c7b', className: '7-B', day: 'Senin', periodNumber: 3, subject: 'Matematika', teacherId: 'tch-001', teacherName: 'Siti Rahmawati, S.Pd.', teacherNip: '19850312 201001 2 015', room: 'Ruang 7-B', color: 'indigo' },
  { id: 'sch-7b-sen-4', classId: 'c7b', className: '7-B', day: 'Senin', periodNumber: 4, subject: 'Matematika', teacherId: 'tch-001', teacherName: 'Siti Rahmawati, S.Pd.', teacherNip: '19850312 201001 2 015', room: 'Ruang 7-B', color: 'indigo' },
  { id: 'sch-7b-sen-5', classId: 'c7b', className: '7-B', day: 'Senin', periodNumber: 5, subject: 'Bahasa Indonesia', teacherId: 'tch-002', teacherName: 'Budi Santoso, M.Pd.', teacherNip: '19790820 200501 1 008', room: 'Ruang 7-B', color: 'blue' },
  { id: 'sch-7b-sen-6', classId: 'c7b', className: '7-B', day: 'Senin', periodNumber: 6, subject: 'Bahasa Indonesia', teacherId: 'tch-002', teacherName: 'Budi Santoso, M.Pd.', teacherNip: '19790820 200501 1 008', room: 'Ruang 7-B', color: 'blue' },

  // Kelas 8-A
  { id: 'sch-8a-sen-1', classId: 'c8a', className: '8-A', day: 'Senin', periodNumber: 1, subject: 'IPA', teacherId: 'tch-003', teacherName: 'Dewi Lestari, S.Si.', teacherNip: '19881105 201402 2 009', room: 'Lab IPA', color: 'emerald' },
  { id: 'sch-8a-sen-2', classId: 'c8a', className: '8-A', day: 'Senin', periodNumber: 2, subject: 'IPA', teacherId: 'tch-003', teacherName: 'Dewi Lestari, S.Si.', teacherNip: '19881105 201402 2 009', room: 'Lab IPA', color: 'emerald' },
  { id: 'sch-8a-sen-3', classId: 'c8a', className: '8-A', day: 'Senin', periodNumber: 3, subject: 'PJOK', teacherId: 'tch-006', teacherName: 'Eko Prasetyo, M.T.', teacherNip: '19800512 200801 1 014', room: 'Lapangan Olahraga', color: 'orange' },
  { id: 'sch-8a-sen-4', classId: 'c8a', className: '8-A', day: 'Senin', periodNumber: 4, subject: 'PJOK', teacherId: 'tch-006', teacherName: 'Eko Prasetyo, M.T.', teacherNip: '19800512 200801 1 014', room: 'Lapangan Olahraga', color: 'orange' },
  
  // Kelas 9-A
  { id: 'sch-9a-sen-1', classId: 'c9a', className: '9-A', day: 'Senin', periodNumber: 1, subject: 'Bahasa Indonesia', teacherId: 'tch-002', teacherName: 'Budi Santoso, M.Pd.', teacherNip: '19790820 200501 1 008', room: 'Ruang 9-A', color: 'blue' },
  { id: 'sch-9a-sen-2', classId: 'c9a', className: '9-A', day: 'Senin', periodNumber: 2, subject: 'Bahasa Indonesia', teacherId: 'tch-002', teacherName: 'Budi Santoso, M.Pd.', teacherNip: '19790820 200501 1 008', room: 'Ruang 9-A', color: 'blue' },
  { id: 'sch-9a-sen-3', classId: 'c9a', className: '9-A', day: 'Senin', periodNumber: 3, subject: 'Matematika', teacherId: 'tch-003', teacherName: 'Dewi Lestari, S.Si.', teacherNip: '19881105 201402 2 009', room: 'Ruang 9-A', color: 'indigo' },
];


