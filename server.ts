import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Helper function to safely extract and parse JSON from AI response
function extractJsonFromText(rawText: string | undefined): any {
  if (!rawText) return null;
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Lazy init Gemini AI
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
        aiClient = new GoogleGenAI({ apiKey });
      } catch (e) {
        console.error("Failed to initialize GoogleGenAI:", e);
        return null;
      }
    }
  }
  return aiClient;
}

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Robots.txt endpoint
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /api/\nAllow: /");
});

// Gemini AI analysis endpoint for attendance performance
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { attendanceSummary, studentRiskList, schoolName } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        analysis: "Fitur Analisis AI Gemini membutuhkan GEMINI_API_KEY yang valid. Berdasarkan data rekap, disarankan evaluasi terhadap siswa yang memiliki tingkat keterlambatan > 20% dan koordinasi rutin dengan wali kelas.",
        recommendations: [
          "Lakukan pemanggilan wali murid bagi siswa dengan alpa > 3 kali",
          "Berikan penghargaan (reward) presensi tepat waktu setiap bulan",
          "Aktifkan notifikasi otomatis WhatsApp agar orang tua langsung mengetahui saat anak belum masuk sekolah"
        ]
      });
    }

    const prompt = `Anda adalah Asisten Pakar Manajemen Pendidikan Sekolah untuk ${schoolName || "Sekolah Indonesia"}.
Analisis data rekapitulasi kehadiran siswa minggu/bulan ini:
- Ringkasan Kehadiran: ${JSON.stringify(attendanceSummary)}
- Daftar Siswa Berisiko (Sering Terlambat / Alpa): ${JSON.stringify(studentRiskList)}

Tolong berikan:
1. Ringkasan analisis kinerja presensi siswa dalam Bahasa Indonesia yang profesional dan solutif.
2. 3 - 5 rekomendasi konkret langkah penanganan untuk Kepala Sekolah & Wali Kelas.

Kembalikan jawaban dalam format JSON:
{
  "analysis": "Penjelasan ringkas...",
  "recommendations": ["Rekomendasi 1", "Rekomendasi 2", ...]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    const data = JSON.parse(text);
    return res.json(data);
  } catch (err: any) {
    console.error("Error calling Gemini API:", err);
    return res.status(500).json({
      error: "Gagal memproses analisis AI",
      details: err.message
    });
  }
});

// ----------------------------------------------------
// ASISTEN GURU: GENERATE SOAL, KUNCI & KISI-KISI
// ----------------------------------------------------
app.post("/api/gemini/generate-questions", async (req, res) => {
  try {
    const {
      jenjang = "SMP",
      kelas = "Kelas 7",
      mataPelajaran = "Ilmu Pengetahuan Alam (IPA)",
      topik = "Klasifikasi Makhluk Hidup dan Ekosistem",
      tingkatKesulitan = "CAMPURAN",
      tipeUjian = "Asesmen Sumatif Akhir Semester",
      jumlahPG = 5,
      jumlahPGBergambar = 1,
      jumlahEssay = 2,
      jumlahEssayBergambar = 1,
      jumlahBergambar = 0, // legacy fallback
      alokasiWaktu = "90 Menit",
      semester = "Ganjil",
      tahunAjaran = "2025/2026",
      namaGuru = "Guru Pengampu",
      namaSekolah = "Sekolah Indonesia",
      petunjukKhusus = ""
    } = req.body;

    const totalPG = Math.max(0, parseInt(jumlahPG, 10) || 0);
    const totalPGBergambar = Math.max(0, parseInt(jumlahPGBergambar !== undefined ? jumlahPGBergambar : jumlahBergambar, 10) || 0);
    const totalEssay = Math.max(0, parseInt(jumlahEssay, 10) || 0);
    const totalEssayBergambar = Math.max(0, parseInt(jumlahEssayBergambar, 10) || 0);
    const totalSemua = totalPG + totalPGBergambar + totalEssay + totalEssayBergambar;

    const ai = getGeminiClient();

    if (!ai) {
      const fallbackResult = generateFallbackExam({
        jenjang,
        kelas,
        mataPelajaran,
        topik,
        tingkatKesulitan,
        tipeUjian,
        jumlahPG: totalPG,
        jumlahPGBergambar: totalPGBergambar,
        jumlahEssay: totalEssay,
        jumlahEssayBergambar: totalEssayBergambar,
        alokasiWaktu,
        semester,
        tahunAjaran,
        namaGuru,
        namaSekolah,
        petunjukKhusus
      });
      return res.json(fallbackResult);
    }

    const prompt = `Anda adalah Pakar Penilaian dan Asesmen Pendidikan Nasional Kurikulum Merdeka Indonesia.
Buatlah paket naskah soal ujian yang SANGAT KREATIF, BERVARIASI, KONTEKSTUAL, dan MEMILIKI PERBEDAAN JELAS ANTAR BUTIR SOAL.

SPESIFIKASI INSTRUMEN:
- Mata Pelajaran: ${mataPelajaran}
- Jenjang / Kelas: ${jenjang} / ${kelas}
- Topik / Materi Pembelajaran: ${topik}
- Tingkat Kesulitan: ${tingkatKesulitan}
- Jenis Ujian: ${tipeUjian}
- Alokasi Waktu: ${alokasiWaktu}
- Catatan / Petunjuk Khusus: ${petunjukKhusus || "Konteks dunia nyata, beragam stimulus cerita, fenomena alam/sosial, studi kasus autentik, numerasi/literasi"}

JUMLAH BUTIR SOAL YANG WAJIB DIBUAT (TOTAL = ${totalSemua} BUTIR):
1. ${totalPG} butir Soal Pilihan Ganda Teks Biasa (tipe: "PG")
2. ${totalPGBergambar} butir Soal Pilihan Ganda Bergambar / Stimulus Visual (tipe: "PG_BERGAMBAR")
3. ${totalEssay} butir Soal Essay / Uraian Teks Analisis (tipe: "ESSAY")
4. ${totalEssayBergambar} butir Soal Essay / Uraian Bergambar / Kasus Visual (tipe: "ESSAY_BERGAMBAR")

PRINSIP KREATIF & DIVERSIFIKASI SOAL (SANGAT PENTING):
- DILARANG membuat soal yang mirip atau berulang kalimatnya. Tiap butir soal HARUS mengangkat skenario kasus, tokoh, fenomena alam, data observasi, eksperimen laboratorium, atau kutipan bacaan yang berbeda-beda!
- Gunakan variasi level kognitif seimbang (C1 Mengetahui, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta / HOTS).
- Untuk soal bergambar (PG_BERGAMBAR dan ESSAY_BERGAMBAR):
  * Sediakan field "gambarDeskripsi" yang sangat detail, spesifik, dan memaparkan grafik, diagram alur, skema alat, rantai makanan, atau infografis data.
  * Opsi: Sediakan juga field "gambarSvg" berupa string XML SVG yang valid dan rapi (viewBox 0 0 450 220) bila relevan.
- Opsi pilihan ganda: A, B, C, D (untuk SD/SMP) atau A, B, C, D, E (untuk SMA/SMK). Pengecoh (distractor) harus masuk akal dan ilmiah.
- Buat Kisi-kisi lengkap untuk seluruh butir 1 s.d. ${totalSemua}.

FORMAT OUTPUT: WAJIB JSON MURNI TANPA TEKS LAIN DENGAN SKEMA:
{
  "judul": "${tipeUjian.toUpperCase()} ${mataPelajaran.toUpperCase()}",
  "petunjukUmum": [
    "Berdoalah sebelum memulai mengerjakan naskah soal ujian.",
    "Periksa dan bacalah lembar soal dengan teliti sebelum menjawab.",
    "Tuliskan identitas nama lengkap dan kelas pada lembar jawaban yang tersedia.",
    "Dahulukan menjawab butir soal yang dianggap lebih mudah.",
    "Periksa kembali seluruh lembar jawaban sebelum diserahkan kepada pengawas."
  ],
  "kisiKisi": [
    {
      "no": 1,
      "capaianPembelajaran": "...",
      "materi": "${topik}",
      "indikatorSoal": "Disajikan ..., peserta didik dapat ...",
      "levelKognitif": "C4 (HOTS)",
      "bentukSoal": "Pilihan Ganda",
      "nomorSoal": "1",
      "bobotSkor": 1
    }
  ],
  "soalList": [
    {
      "id": "q-1",
      "no": 1,
      "tipe": "PG",
      "pertanyaan": "...",
      "stimulus": "Konteks / Narasi studi kasus awal...",
      "pilihan": {
        "A": "...",
        "B": "...",
        "C": "...",
        "D": "..."
      },
      "kunciJawaban": "A",
      "pembahasan": "Penjelasan detail dan logis mengapa kunci jawaban tersebut benar...",
      "levelKognitif": "C3",
      "indikatorSoal": "...",
      "bobotSkor": 1
    },
    {
      "id": "q-2",
      "no": 2,
      "tipe": "PG_BERGAMBAR",
      "pertanyaan": "Berdasarkan grafik/diagram stimulus visual di atas, ...",
      "stimulus": "Perhatikan grafik hasil pengamatan berikut:",
      "gambarDeskripsi": "[Diagram / Grafik Terperinci]: Menampilkan perbandingan...",
      "pilihan": {
        "A": "...",
        "B": "...",
        "C": "...",
        "D": "..."
      },
      "kunciJawaban": "B",
      "pembahasan": "...",
      "levelKognitif": "C4 (HOTS)",
      "indikatorSoal": "...",
      "bobotSkor": 2
    },
    {
      "id": "q-3",
      "no": 3,
      "tipe": "ESSAY",
      "pertanyaan": "Jelaskan dan analisislah mengapa...",
      "stimulus": "Diberikan permasalahan kontekstual: ...",
      "kunciJawaban": "Poin 1: ... Poin 2: ... Poin 3: ...",
      "pembahasan": "Rubrik penilaian mengacu pada ketepatan argumentasi...",
      "rubrikPenskoran": "Skor 10 jika memuat 3 faktor lengkap, Skor 6 jika 2 faktor, Skor 3 jika 1 faktor.",
      "levelKognitif": "C5 (HOTS)",
      "indikatorSoal": "...",
      "bobotSkor": 10
    },
    {
      "id": "q-4",
      "no": 4,
      "tipe": "ESSAY_BERGAMBAR",
      "pertanyaan": "Cermati skema diagram kasus pada gambar di atas! Analisislah titik kritis pada fase X dan usulkan langkah solusi ilmiah!",
      "stimulus": "Perhatikan skema alur kasus visual berikut:",
      "gambarDeskripsi": "[Bagan Alur Kasus]: Menunjukkan siklus...",
      "kunciJawaban": "Analisis: ... Solusi: ...",
      "pembahasan": "...",
      "rubrikPenskoran": "Skor 10: Analisis mendalam dan solusi terstruktur...",
      "levelKognitif": "C6 (HOTS)",
      "indikatorSoal": "...",
      "bobotSkor": 10
    }
  ]
}`;

    let data: any = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.85,
        }
      });

      const parsed = extractJsonFromText(response.text);
      if (parsed && (parsed.soalList || parsed.kisiKisi)) {
        data = parsed;
      }
    } catch (aiErr) {
      console.warn("AI generation note (using structured standard generator):", aiErr);
    }

    if (!data) {
      data = generateFallbackExam({
        jenjang,
        kelas,
        mataPelajaran,
        topik,
        tingkatKesulitan,
        tipeUjian,
        jumlahPG: totalPG,
        jumlahPGBergambar: totalPGBergambar,
        jumlahEssay: totalEssay,
        jumlahEssayBergambar: totalEssayBergambar,
        alokasiWaktu,
        semester,
        tahunAjaran,
        namaGuru,
        namaSekolah,
        petunjukKhusus
      });
    }

    // Attach server config metadata
    data.config = {
      jenjang,
      kelas,
      mataPelajaran,
      topik,
      tingkatKesulitan,
      tipeUjian,
      jumlahPG: totalPG,
      jumlahPGBergambar: totalPGBergambar,
      jumlahEssay: totalEssay,
      jumlahEssayBergambar: totalEssayBergambar,
      jumlahBergambar: totalPGBergambar + totalEssayBergambar,
      alokasiWaktu,
      semester,
      tahunAjaran,
      namaGuru,
      namaSekolah
    };
    data.tanggalDibuat = new Date().toISOString();
    data.id = data.id || ("EXAM-" + Date.now());

    return res.json(data);
  } catch (err: any) {
    console.error("Error in generate-questions handler:", err);
    const fallback = generateFallbackExam(req.body || {});
    return res.json(fallback);
  }
});

// ----------------------------------------------------
// ASISTEN GURU: GENERATE MODUL AJAR (KURIKULUM MERDEKA)
// ----------------------------------------------------
app.post("/api/gemini/generate-modul-ajar", async (req, res) => {
  try {
    const {
      jenjang = "SMP",
      kelas = "Kelas 7",
      fase = "Fase D",
      mataPelajaran = "Ilmu Pengetahuan Alam (IPA)",
      topikMateri = "Klasifikasi Makhluk Hidup",
      alokasiWaktu = "2 x 40 Menit (1 Pertemuan)",
      modelPembelajaran = "Problem Based Learning (PBL)",
      metodePembelajaran = ["Diskusi Kelompok", "Tanya Jawab", "Presentasi", "Observasi"],
      profilPancasila = ["Mandiri", "Bernalar Kritis", "Gotong Royong"],
      namaGuru = "Guru Pengampu",
      namaSekolah = "Sekolah Indonesia",
      tahunPenyusunan = "2025/2026"
    } = req.body;

    const ai = getGeminiClient();

    if (!ai) {
      const fallbackModul = generateFallbackModulAjar({
        jenjang,
        kelas,
        fase,
        mataPelajaran,
        topikMateri,
        alokasiWaktu,
        modelPembelajaran,
        metodePembelajaran,
        profilPancasila,
        namaGuru,
        namaSekolah,
        tahunPenyusunan
      });
      return res.json(fallbackModul);
    }

    const prompt = `Anda adalah Pakar Pengembang Kurikulum Merdeka & Widyaprada Kemendikbudristek Indonesia.
Susunlah sebuah Modul Ajar (RPP Plus) Kurikulum Merdeka yang lengkap, mendalam, aplikatif, dan sesuai standar resmi pemerintah.

DATA PERENCANAAN:
- Jenjang: ${jenjang}
- Fase & Kelas: ${fase} (${kelas})
- Mata Pelajaran: ${mataPelajaran}
- Topik / Materi Pembelajaran: ${topikMateri}
- Alokasi Waktu: ${alokasiWaktu}
- Model Pembelajaran: ${modelPembelajaran}
- Metode: ${Array.isArray(metodePembelajaran) ? metodePembelajaran.join(", ") : metodePembelajaran}
- Dimensi Profil Pelajar Pancasila: ${Array.isArray(profilPancasila) ? profilPancasila.join(", ") : profilPancasila}
- Nama Penyusun: ${namaGuru}
- Institusi: ${namaSekolah}
- Tahun Penyusunan: ${tahunPenyusunan}

KEMBALIKAN HANYA FORMAT JSON MURNI SESUAI STRUKTUR BERIKUT:
{
  "judul": "MODUL AJAR KURIKULUM MERDEKA: ${mataPelajaran.toUpperCase()}",
  "informasiUmum": {
    "penyusun": "${namaGuru}",
    "instansi": "${namaSekolah}",
    "tahunPenyusunan": "${tahunPenyusunan}",
    "jenjangSekolah": "${jenjang}",
    "mataPelajaran": "${mataPelajaran}",
    "faseKelas": "${fase} / ${kelas}",
    "alokasiWaktu": "${alokasiWaktu}",
    "kompetensiAwal": [
      "Peserta didik telah memahami konsep dasar...",
      "Peserta didik dapat mengenali..."
    ],
    "profilPelajarPancasila": ${JSON.stringify(profilPancasila)},
    "saranaPrasarana": [
      "LCD Proyektor / Smart TV",
      "Laptop / Komputer",
      "Lembar Kerja Peserta Didik (LKPD)",
      "Bahan Ajar / Buku Paket Siswa",
      "Jaringan Internet"
    ],
    "targetPesertaDidik": "Peserta didik reguler / tipikal (umum, tidak ada kesulitan dalam mencerna materi ajar)",
    "modelPembelajaran": "${modelPembelajaran}"
  },
  "komponenInti": {
    "tujuanPembelajaran": [
      "Peserta didik mampu mengidentifikasi...",
      "Peserta didik mampu menganalisis...",
      "Peserta didik mampu menyajikan hasil karya..."
    ],
    "pemahamanBermakna": [
      "Pemahaman konsep ini membantu peserta didik untuk...",
      "Penerapan dalam kehidupan sehari-hari terlihat pada..."
    ],
    "pertanyaanPemantik": [
      "Mengapa kita perlu mempelajari...",
      "Apa yang akan terjadi apabila..."
    ],
    "kegiatanPembelajaran": {
      "pendahuluan": {
        "alokasiMenit": 10,
        "langkah": [
          "Guru membuka pembelajaran dengan salam hangat, doa bersama, dan mengecek kehadiran presensi siswa.",
          "Guru memberikan apersepsi dengan mengaitkan materi sebelumnya dengan topik hari ini.",
          "Guru menyampaikan tujuan pembelajaran, alur kegiatan, dan kriteria penilaian.",
          "Guru memberikan pertanyaan pemantik untuk membangkitkan rasa ingin tahu siswa."
        ]
      },
      "inti": {
        "alokasiMenit": 70,
        "langkah": [
          "Fase 1 (Orientasi Masalah): Guru menyajikan fenomena kontekstual / video kasus terkait materi...",
          "Fase 2 (Mengorganisasikan Siswa): Siswa dibagi dalam kelompok heterogen (4-5 orang) dan menerima LKPD.",
          "Fase 3 (Membimbing Penyelidikan): Guru memfasilitasi diskusi kelompok, eksplorasi sumber bacaan, dan pengumpulan data.",
          "Fase 4 (Mengembangkan & Menyajikan Hasil): Setiap kelompok menyusun laporan hasil diskusi dan mempresentasikannya di depan kelas.",
          "Fase 5 (Menganalisis & Mengevaluasi): Guru bersama siswa memberikan tanggapan, klarifikasi konsep, dan penguatan materi."
        ]
      },
      "penutup": {
        "alokasiMenit": 10,
        "langkah": [
          "Guru bersama peserta didik menyimpulkan poin-poin utama pembelajaran hari ini.",
          "Peserta didik melakukan refleksi singkat terhadap proses belajar yang telah dilalui.",
          "Guru memberikan asesmen sumatif / kuis singkat untuk mengukur pemahaman.",
          "Guru menyampaikan rencana tindak lanjut untuk pertemuan berikutnya dan menutup dengan doa serta salam."
        ]
      }
    },
    "asesmen": {
      "diagnostik": [
        "Tes diagnostik non-kognitif (kesiapan belajar & gaya belajar siswa)",
        "Pertanyaan pemantik kognitif awal sebelum KBM dimulai"
      ],
      "formatif": [
        "Observasi sikap dan keaktifan selama diskusi kelompok",
        "Penilaian lembar kerja peserta didik (LKPD)",
        "Rubrik penilaian performa presentasi kelas"
      ],
      "sumatif": [
        "Tes tertulis berupa soal pilihan ganda, soal stimulus bergambar, dan uraian/essay di akhir capaian materi"
      ]
    },
    "pengayaanDanRemedial": {
      "pengayaan": "Peserta didik dengan capaian tinggi diberikan tugas eksplorasi materi tingkat lanjut berupa studi kasus terapan atau pembuatan infografis/makalah ilmiah singkat.",
      "remedial": "Peserta didik yang belum mencapai ketuntasan tujuan pembelajaran diberikan bimbingan ulang secara individual atau melalui tutor sebaya pada indikator yang belum dipahami."
    },
    "refleksi": {
      "guru": [
        "Apakah seluruh peserta didik aktif dalam proses diskusi kelompok?",
        "Bagian mana dari sintaks pembelajaran yang memerlukan alokasi waktu tambahan?",
        "Apakah media dan LKPD yang digunakan efektif membantu pemahaman siswa?"
      ],
      "siswa": [
        "Apa materi yang paling menarik dan mudah dipahami hari ini?",
        "Apa kesulitan yang masih kamu rasakan selama mengerjakan LKPD?",
        "Bagaimana perasaanmu setelah bekerja sama dalam kelompok?"
      ]
    }
  },
  "lampiran": {
    "lkpd": "LEMBAR KERJA PESERTA DIDIK (LKPD)\\nTopik: ${topikMateri}\\nPetunjuk Kerja:\\n1. Bentuklah kelompok yang terdiri dari 4-5 orang siswa.\\n2. Amati kasus atau data yang diberikan dalam modul.\\n3. Diskusikan dan jawab pertanyaan analisis secara terstruktur.\\n4. Presentasikan kesimpulan kelompok di depan kelas.",
    "bahanBacaan": "Bahan Bacaan Ringkas: Memuat rangkuman materi esensial ${topikMateri}, konsep-konsep kunci, diagram alur, dan studi kasus faktual untuk memperkuat literasi peserta didik.",
    "glosarium": [
      { "istilah": "Kurikulum Merdeka", "arti": "Kurikulum dengan pembelajaran intrakurikuler yang beragam di mana konten akan lebih optimal." },
      { "istilah": "Asesmen Formatif", "arti": "Penilaian yang dilakukan selama proses pembelajaran berlangsung untuk memberikan umpan balik perbaikan." },
      { "istilah": "Profil Pelajar Pancasila", "arti": "Perwujudan pelajar Indonesia sebagai pelajar sepanjang hayat yang memiliki kompetensi global dan berperilaku sesuai nilai Pancasila." }
    ],
    "daftarPustaka": [
      "Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi. (2024). Buku Panduan Guru dan Siswa ${mataPelajaran} ${kelas}. Jakarta: Pusat Kurikulum dan Perbukuan.",
      "Badan Standar, Kurikulum, dan Asesmen Pendidikan Kemendikbudristek. (2024). Panduan Pembelajaran dan Asesmen Kurikulum Merdeka."
    ],
    "rubrikPenilaian": "Pedoman Penskoran LKPD: Skor 4 (Sangat Baik: Jawaban lengkap, argumen logis, kerja sama tim solid), Skor 3 (Baik: Jawaban tepat dengan penjelasan cukup), Skor 2 (Cukup: Jawaban ada kekurangan konsep), Skor 1 (Perlu Bimbingan)."
  }
}`;

    let data: any = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
        }
      });

      const parsed = extractJsonFromText(response.text);
      if (parsed && (parsed.informasiUmum || parsed.komponenInti)) {
        data = parsed;
      }
    } catch (aiErr) {
      console.warn("AI Modul generation note (using structured standard generator):", aiErr);
    }

    if (!data) {
      data = generateFallbackModulAjar({
        jenjang,
        kelas,
        fase,
        mataPelajaran,
        topikMateri,
        alokasiWaktu,
        modelPembelajaran,
        metodePembelajaran,
        profilPancasila,
        namaGuru,
        namaSekolah,
        tahunPenyusunan
      });
    }

    data.config = {
      jenjang,
      kelas,
      fase,
      mataPelajaran,
      topikMateri,
      alokasiWaktu,
      modelPembelajaran,
      metodePembelajaran,
      profilPancasila,
      namaGuru,
      namaSekolah,
      tahunPenyusunan
    };
    data.tanggalDibuat = new Date().toISOString();
    data.id = data.id || ("MODUL-" + Date.now());

    return res.json(data);
  } catch (err: any) {
    console.error("Error in generate-modul-ajar handler:", err);
    const fallback = generateFallbackModulAjar(req.body || {});
    return res.json(fallback);
  }
});

// Helper Fallback Generator for Exam Questions with High Diversity & Creativity
function generateFallbackExam(config: any) {
  const jenjang = config.jenjang || "SMP";
  const kelas = config.kelas || "Kelas 7";
  const mapel = config.mataPelajaran || "Ilmu Pengetahuan Alam (IPA)";
  const topik = config.topik || "Materi Pembelajaran Utama";
  const tipeUjian = config.tipeUjian || "Asesmen Sumatif Akhir Semester";
  const jumlahPG = config.jumlahPG !== undefined ? config.jumlahPG : 5;
  const jumlahPGBergambar = config.jumlahPGBergambar !== undefined ? config.jumlahPGBergambar : (config.jumlahBergambar || 0);
  const jumlahEssay = config.jumlahEssay !== undefined ? config.jumlahEssay : 2;
  const jumlahEssayBergambar = config.jumlahEssayBergambar !== undefined ? config.jumlahEssayBergambar : 0;

  const soalList: any[] = [];
  const kisiKisi: any[] = [];
  let currentNum = 1;

  // Varied student/teacher context names and locations
  const names = ["Rian", "Siti", "Ahmad", "Dewi", "Budi", "Lestari", "Kadek", "Fajar", "Nadia", "Farhan", "Putri", "Zaki"];
  const locations = ["laboratorium sekolah", "lingkungan sekitar rumah", "taman sekolah", "sentra industri kreatif", "ekosistem sungai lokal", "kebun percobaan"];

  // 1. Dynamic Pilihan Ganda (Teks Biasa)
  const dynamicPGTemplates = [
    (idx: number) => {
      const name = names[idx % names.length];
      const loc = locations[idx % locations.length];
      return {
        q: `${name} melakukan kegiatan observasi dan investigasi terstruktur mengenai "${topik}" di ${loc}. Dari serangkaian pengujian, diperoleh data bahwa variabel X mengalami kenaikan secara linear sementara variabel Y melambat. Analisis kesimpulan ilmiah yang paling tepat dan valid adalah...`,
        stimulus: `Studi Kasus Investigasi Autentik Materi ${topik}:`,
        opts: {
          A: `Terjadi regulasi timbal balik yang proporsional dalam dinamika komponen ${topik} untuk mempertahankan kestabilan sistem.`,
          B: `Variabel pengujian tidak memiliki relasi fungsional sama sekali dengan karakteristik pokok ${topik}.`,
          C: `Hasil pengamatan harus dieliminasi karena menyimpang dari asumsi teoritis awal tanpa uji ulang.`,
          D: `Semua parameter pengujian selalu konstan dan tidak dipengaruhi oleh perubahan lingkungan luar.`
        },
        kunci: "A",
        pembahasan: `Pilihan A tepat karena fenomena dalam ${topik} menunjukkan hubungan sebab-akibat yang saling mengompensasi demi tercapainya ekuilibrium sistem.`,
        level: "C4 (HOTS - Analisis Data Observasi)",
        indikator: `Disajikan narasi investigasi kontekstual, peserta didik mampu menganalisis korelasi antarvariabel pada materi ${topik}.`
      };
    },
    (idx: number) => {
      return {
        q: `Dalam penerapan konsep "${topik}" pada kehidupan masyarakat modern, tantangan utama yang sering dihadapi adalah ketidakseimbangan antara efisiensi proses dan daya dukung lingkungan. Upaya paling solutif dan berkelanjutan yang dapat diterapkan adalah...`,
        stimulus: `Konteks Isu Faktual & Keberlanjutan Pembelajaran ${mapel}:`,
        opts: {
          A: `Mengintegrasikan prinsip inovasi ramah lingkungan dan optimasi pemanfaatan sumber daya secara terukur pada ${topik}.`,
          B: `Mengeksploitasi seluruh komponen tanpa mempertimbangkan dampak jangka panjang bagi ekosistem.`,
          C: `Menghentikan seluruh aktivitas implementasi agar tidak menimbulkan risiko perubahan kondisi awal.`,
          D: `Mengabaikan evaluasi berkala dan menyerahkan seluruh kendali pada mekanisme alami tanpa monitoring.`
        },
        kunci: "A",
        pembahasan: `Pilihan A benar karena prinsip pembelajaran modern menekankan keberlanjutan (sustainability) dan efisiensi berbasis solusi ilmiah.`,
        level: "C5 (HOTS - Evaluasi Kebijakan Solutif)",
        indikator: `Peserta didik mampu mengevaluasi alternatif solusi berkelanjutan terkait implementasi ${topik}.`
      };
    },
    (idx: number) => {
      return {
        q: `Perhatikan beberapa tahapan kerja sistematis berikut ini:\n(1) Mengidentifikasi karakteristik dan parameter kunci materi ${topik}.\n(2) Menyusun klasifikasi dan pengelompokan data berdasarkan kriteria valid.\n(3) Menganalisis korelasi fungsional antar komponen pengamatan.\n(4) Merumuskan simpulan evaluatif dan rekomendasi tindak lanjut.\nUrutan prosedur analisis saintifik yang paling runtut dan logis adalah...`,
        stimulus: `Prosedur Metodologi Ilmiah Materi ${topik}:`,
        opts: {
          A: "(1) → (2) → (3) → (4)",
          B: "(2) → (1) → (4) → (3)",
          C: "(3) → (1) → (2) → (4)",
          D: "(4) → (3) → (2) → (1)"
        },
        kunci: "A",
        pembahasan: `Urutan metode saintifik Kurikulum Merdeka yang tepat dimulai dari identifikasi awal (1), klasifikasi terstruktur (2), analisis relasi data (3), hingga penarikan simpulan evaluatif (4).`,
        level: "C3 (Aplikasi Prosedural)",
        indikator: `Peserta didik mampu menentukan urutan langkah kerja ilmiah dalam menganalisis fenomena ${topik}.`
      };
    },
    (idx: number) => {
      const name = names[(idx + 3) % names.length];
      return {
        q: `${name} menemukan sebuah anomali ketika membandingkan dua kelompok data perlakuan pada materi ${topik}. Kelompok A menunjukkan respon cepat, sedangkan Kelompok B menunjukkan respon lambat namun berdaya tahan tinggi. Faktor dominan yang mendasari perbedaan karakteristik tersebut adalah...`,
        stimulus: `Diberikan Komparasi Karakteristik Sistem ${topik}:`,
        opts: {
          A: `Perbedaan komposisi internal dan laju kinetika adaptasi pada masing-masing kelompok perlakuan.`,
          B: `Ketidaksengajaan dalam penulisan label tanpa memengaruhi substansi materi.`,
          C: `Hilangnya sifat dasar materi secara permanen akibat perubahan suhu sesaat.`,
          D: `Tidak adanya pengaruh faktor penentu dalam pembentukan karakteristik kelompok.`
        },
        kunci: "A",
        pembahasan: `Respon dinamik yang berbeda pada perlakuan materi ${topik} dipengaruhi oleh struktur komposisi dan mekanisme adaptasi internal.`,
        level: "C4 (HOTS - Diferensiasi Karakteristik)",
        indikator: `Peserta didik mampu membedakan faktor penyebab variasi respon pada sistem ${topik}.`
      };
    },
    (idx: number) => {
      return {
        q: `Karakteristik esensial yang membedakan konsep ${topik} dengan konsep pendukung lainnya dalam disiplin ${mapel} terletak pada kemampuannya untuk...`,
        stimulus: `Konsep Esensial Pembelajaran ${mapel}:`,
        opts: {
          A: `Menjelaskan hubungan keteraturan gejala secara komprehensif dan dapat diuji kebenarannya secara empiris.`,
          B: `Mengabaikan hukum-hukum keteraturan alam yang telah terbukti secara ilmiah.`,
          C: `Mengganti fakta eksperimen dengan opini subjektif tanpa dasar teori.`,
          D: `Membatasi ruang eksplorasi peserta didik pada satu sudut pandang sempit.`
        },
        kunci: "A",
        pembahasan: `Pilihan A tepat karena esensi materi ${topik} berlandaskan pada prinsip keteraturan saintifik yang dapat dibuktikan secara empiris.`,
        level: "C2 (Pemahaman Konsep Kunci)",
        indikator: `Peserta didik mampu menjelaskan karakteristik esensial dari materi ${topik}.`
      };
    },
    (idx: number) => {
      const name = names[(idx + 5) % names.length];
      return {
        q: `Jika dalam suatu sistem terpadu materi ${topik}, terjadi penurunan kapasitas input hingga 40%, tindakan penyesuaian adaptif (mitigasi) yang paling tepat dilakukan ${name} untuk menjaga stabilitas luaran (output) adalah...`,
        stimulus: `Simulasi Kasus Problem-Solving ${topik}:`,
        opts: {
          A: `Meningkatkan efisiensi konversi internal dan mereduksi kehilangan energi/sumber daya pada setiap simpul.`,
          B: `Meningkatkan beban kerja komponen lain di luar ambang batas toleransi maksimum.`,
          C: `Membiarkan sistem beroperasi tanpa penyesuaian hingga terjadi penurunan fungsi permanen.`,
          D: `Menghapus fungsi monitoring data agar indikator penurunan tidak tercatat.`
        },
        kunci: "A",
        pembahasan: `Pilihan A merupakan langkah problem solving ideal: optimalisasi efisiensi konversi internal dapat mengimbangi penurunan laju input bahan.`,
        level: "C6 (HOTS - Problem Solving & Mitigasi)",
        indikator: `Peserta didik mampu merumuskan langkah mitigasi adaptif saat terjadi penurunan parameter input ${topik}.`
      };
    }
  ];

  for (let i = 0; i < jumlahPG; i++) {
    const generator = dynamicPGTemplates[i % dynamicPGTemplates.length];
    const itemData = generator(i);
    const qItem = {
      id: `q-pg-${currentNum}`,
      no: currentNum,
      tipe: "PG",
      pertanyaan: itemData.q,
      stimulus: itemData.stimulus,
      pilihan: itemData.opts,
      kunciJawaban: itemData.kunci,
      pembahasan: itemData.pembahasan,
      levelKognitif: itemData.level,
      indikatorSoal: itemData.indikator,
      bobotSkor: 1
    };
    soalList.push(qItem);
    kisiKisi.push({
      no: currentNum,
      capaianPembelajaran: `Menguasai, menganalisis, dan mengevaluasi konsep ${topik} dalam pembelajaran ${mapel}.`,
      materi: topik,
      indikatorSoal: qItem.indikatorSoal,
      levelKognitif: qItem.levelKognitif,
      bentukSoal: "Pilihan Ganda",
      nomorSoal: `${currentNum}`,
      bobotSkor: 1
    });
    currentNum++;
  }

  // 2. Dynamic Pilihan Ganda Bergambar / Stimulus Visual
  const dynamicPGBergambarTemplates = [
    (idx: number) => {
      return {
        q: `Perhatikan bagan alur proses pada diagram di atas! Bagian yang ditunjukkan oleh label [X] memegang peranan kunci dalam siklus materi ${topik}, yaitu sebagai...`,
        desc: `[Diagram Alur Terstruktur & Siklus Transformasi]: Menampilkan bagan relasi antar subsistem materi ${topik}. Input awal masuk ke simpul regulator [X], bertransformasi melalui fase katalisis [Y], dan menghasilkan produk akhir optimal [Z].`,
        opts: {
          A: "Pusat regulasi dan pemrosesan utama yang menentukan efisiensi konversi siklus.",
          B: "Saluran pembuangan residu akhir yang tidak berinteraksi dengan proses.",
          C: "Komponen isolator pasif tanpa fungsi pertukaran data atau energi.",
          D: "Penghambat laju reaksi yang menghentikan seluruh aktivitas sistem."
        },
        kunci: "A",
        pembahasan: "Simpul [X] bertindak sebagai pusat kendali/reaksi utama yang memproses input menjadi luaran fungsional terarah.",
        level: "C4 (HOTS - Interpretasi Diagram)",
        indikator: `Disajikan diagram stimulus visual, peserta didik mampu menginterpretasikan fungsi komponen kunci [X] pada ${topik}.`
      };
    },
    (idx: number) => {
      return {
        q: `Cermati grafik perbandingan respon data pada gambar di atas! Kesimpulan yang paling tepat mengenai dinamika hubungan antar variabel pada grafik terkait ${topik} adalah...`,
        desc: `[Grafik Garis Komparasi Eksperimental]: Sumbu horizontal (X) memuat variabel waktu/perlakuan, sumbu vertikal (Y) memuat laju performa ${topik}. Kurva perlakuan A menunjukkan peningkatan linier stabil, sedangkan kurva B mencapai titik jenuh (plato).`,
        opts: {
          A: "Perlakuan A memiliki efisiensi stabil berkesinambungan, sedangkan perlakuan B mengalami kejenuhan kapasitas optimal.",
          B: "Kedua perlakuan tidak menunjukkan adanya interaksi teratur dengan variabel waktu.",
          C: "Perlakuan B lebih unggul di segala rentang waktu dibandingkan perlakuan A.",
          D: "Grafik membuktikan bahwa variabel waktu tidak memengaruhi respon sistem sama sekali."
        },
        kunci: "A",
        pembahasan: "Kurva perlakuan A linier sedangkan B mendatar (saturasi), membuktikan adanya batas daya tampung pada perlakuan B.",
        level: "C4 (HOTS - Analisis Grafik Numerik)",
        indikator: `Disajikan grafik kurva eksperimen, peserta didik mampu menyimpulkan perbedaan karakteristik respon data pada materi ${topik}.`
      };
    },
    (idx: number) => {
      return {
        q: `Berdasarkan skema anatomi/struktur penampang pada gambar di atas, keterkaitan antara struktur lapisan luar dan fungsi perlindungan pada materi ${topik} dapat dianalisis sebagai...`,
        desc: `[Skema Struktur Penampang Bertingkat]: Menampilkan ilustrasi cross-section lapisan materi ${topik} dengan label Lapisan Pelindung Eksternal, Membran Semi-permeabel, dan Inti Aktif.`,
        opts: {
          A: "Lapisan eksternal tersusun rapat untuk meminimalkan interferensi lingkungan luar terhadap stabilitas inti.",
          B: "Lapisan luar bersifat terbuka bebas tanpa selektivitas zat perantara.",
          C: "Struktur penampang tidak memiliki pembagian fungsi fungsional antar lapisan.",
          D: "Inti aktif bekerja mandiri tanpa memerlukan sokongan dari lapisan luar."
        },
        kunci: "A",
        pembahasan: "Struktur luar yang padat berfungsi sebagai barrier protektif bagi integritas komponen inti dalam sistem.",
        level: "C4 (HOTS - Analisis Struktur Visual)",
        indikator: `Disajikan gambar penampang struktur, peserta didik mampu menganalisis hubungan struktur dan fungsi pada ${topik}.`
      };
    }
  ];

  for (let i = 0; i < jumlahPGBergambar; i++) {
    const generator = dynamicPGBergambarTemplates[i % dynamicPGBergambarTemplates.length];
    const itemData = generator(i);
    const qItem = {
      id: `q-pg-img-${currentNum}`,
      no: currentNum,
      tipe: "PG_BERGAMBAR",
      pertanyaan: itemData.q,
      stimulus: `Perhatikan stimulus infografis / diagram visual materi ${topik} berikut:`,
      gambarDeskripsi: itemData.desc,
      pilihan: itemData.opts,
      kunciJawaban: itemData.kunci,
      pembahasan: itemData.pembahasan,
      levelKognitif: itemData.level,
      indikatorSoal: itemData.indikator,
      bobotSkor: 2
    };
    soalList.push(qItem);
    kisiKisi.push({
      no: currentNum,
      capaianPembelajaran: `Mampu membaca, menginterpretasikan, dan merefleksikan data stimulus visual diagram pada materi ${topik}.`,
      materi: `${topik} (Stimulus Visual)`,
      indikatorSoal: qItem.indikatorSoal,
      levelKognitif: qItem.levelKognitif,
      bentukSoal: "Pilihan Ganda (Bergambar)",
      nomorSoal: `${currentNum}`,
      bobotSkor: 2
    });
    currentNum++;
  }

  // 3. Dynamic Soal Essay / Uraian (Teks Biasa)
  const dynamicEssayTemplates = [
    (idx: number) => {
      return {
        q: `Jelaskan secara komprehensif mekanisme kerja konsep "${topik}" dan analisislah minimal 3 (tiga) implikasi nyata penerapannya dalam memecahkan permasalahan kontekstual di lingkungan sekitar peserta didik!`,
        kunci: `Kunci Jawaban & Indikator Penilaian:\n1. Definisi & Mekanisme Fundamental: Menguraikan prinsip kerja ${topik} secara runtut dan tepat secara ilmiah.\n2. Analisis Implikasi Kontekstual: Mengaitkan 3 contoh nyata (misal: di lingkungan sekolah, rumah, dan masyarakat).\n3. Kesimpulan Reflektif: Memberikan simpulan mengenai signifikansi konsep bagi perbaikan kualitas hidup.`,
        pembahasan: "Penilaian ditekankan pada kedalaman argumentasi, koherensi logika berpikir ilmiah, dan keakuratan terminologi konsep.",
        rubrik: "Skor 10: Uraian mekanisme lengkap & 3 contoh implikasi nyata sangat logis. Skor 7: Mekanisme benar & 2 contoh implikasi. Skor 4: Hanya menyebutkan definisi umum. Skor 1: Jawaban tidak relevan.",
        level: "C5 (HOTS - Evaluasi & Sintesis Ilmiah)",
        indikator: `Peserta didik mampu menguraikan mekanisme konseptual dan merumuskan 3 implikasi nyata terkait materi ${topik}.`
      };
    },
    (idx: number) => {
      const name = names[(idx + 2) % names.length];
      return {
        q: `Dalam sebuah eksperimen mandiri mengenai "${topik}", ${name} mendapati bahwa hasil pengukuran berulang menunjukkan tingkat deviasi (kesalahan acak) yang tinggi. Rancanglah rencana perbaikan metodologi yang mencakup: (a) identifikasi sumber ketidakpastian, (b) 2 langkah standardisasi instrumen, dan (c) prosedur verifikasi keabsahan data!`,
        kunci: `Kunci Jawaban Solutif:\n(a) Sumber Ketidakpastian: Fluktuasi suhu lingkungan, ketidaktelitian paralaks pembacaan, dan toleransi alat ukur.\n(b) Langkah Standardisasi: Kalibrasi ulang alat ukur dengan standar baku dan penyusunan SOP pengukuran berkala.\n(c) Prosedur Verifikasi: Melakukan replikasi minimal 3 kali pengulangan (triplo) dan menghitung rerata serta standar deviasi.`,
        pembahasan: "Mengukur keterampilan merancang eksperimen (experimental design) dan pemikiran reflektif berbasis bukti.",
        rubrik: "Skor 10: Menjawab poin a, b, dan c secara runtut dan ilmiah. Skor 6: Menjawab 2 poin tepat. Skor 3: Hanya menjawab 1 poin secara parsial.",
        level: "C6 (HOTS - Perancangan Eksperimen & Solusi)",
        indikator: `Peserta didik mampu merancang perbaikan metodologi penelitian ilmiah pada topik ${topik}.`
      };
    }
  ];

  for (let i = 0; i < jumlahEssay; i++) {
    const generator = dynamicEssayTemplates[i % dynamicEssayTemplates.length];
    const itemData = generator(i);
    const qItem = {
      id: `q-essay-${currentNum}`,
      no: currentNum,
      tipe: "ESSAY",
      pertanyaan: itemData.q,
      stimulus: "",
      kunciJawaban: itemData.kunci,
      pembahasan: itemData.pembahasan,
      rubrikPenskoran: itemData.rubrik,
      levelKognitif: itemData.level,
      indikatorSoal: itemData.indikator,
      bobotSkor: 10
    };
    soalList.push(qItem);
    kisiKisi.push({
      no: currentNum,
      capaianPembelajaran: `Mampu mengevaluasi, menganalisis kritis, dan menyajikan solusi tertulis terkait materi ${topik}.`,
      materi: `${topik} (Uraian Analisis)`,
      indikatorSoal: qItem.indikatorSoal,
      levelKognitif: qItem.levelKognitif,
      bentukSoal: "Uraian / Essay",
      nomorSoal: `${currentNum}`,
      bobotSkor: 10
    });
    currentNum++;
  }

  // 4. Dynamic Soal Essay Bergambar / Kasus Visual
  const dynamicEssayBergambarTemplates = [
    (idx: number) => {
      return {
        q: `Cermati bagan siklus terpadu dan grafik data pengamatan pada gambar di atas! Analisislah penyebab terjadinya penurunan laju efisiensi pada fase transisi ke-2, serta rumuskan model rekomendasi perbaikan berbasis sains/teknologi untuk mengoptimalkan kinerja sistem ${topik}!`,
        desc: `[Diagram Siklus Terpadu & Grafik Parameter Uji]: Menampilkan skema relasi interaktif 3 komponen utama materi ${topik} yang disertai grafik fluktuasi laju kerja. Terlihat penurunan tajam efisiensi pada fase transisi kedua sebelum kembali stabil di akhir siklus.`,
        kunci: `Kunci Jawaban Terstruktur:\n1. Analisis Visual Gambar: Penurunan laju efisiensi pada fase transisi ke-2 dipicu oleh keterbatasan laju transfer massa/energi antar subsistem.\n2. Rekomendasi Solutif Ilmiah: Memasang mekanisme buffer adaptif atau pengatur umpan balik (feedback loop) otomatis agar transisi berjalan mulus tanpa kehilangan energi.`,
        pembahasan: "Menguji kompetensi tingkat tinggi dalam memadukan interpretasi visual grafik dengan perumusan desain solusi rekayasa.",
        rubrik: "Skor 10: Analisis visual mendalam dan rekomendasi solusi ilmiah sangat aplikatif. Skor 6: Solusi baik namun analisis visual kurang spesifik. Skor 3: Hanya menjelaskan gambar tanpa solusi.",
        level: "C6 (HOTS - Kreasi & Desain Model Rekomendasi)",
        indikator: `Disajikan stimulus diagram kasus visual, peserta didik mampu mengevaluasi anomali dan merancang rekomendasi model perbaikan pada materi ${topik}.`
      };
    }
  ];

  for (let i = 0; i < jumlahEssayBergambar; i++) {
    const generator = dynamicEssayBergambarTemplates[i % dynamicEssayBergambarTemplates.length];
    const itemData = generator(i);
    const qItem = {
      id: `q-essay-img-${currentNum}`,
      no: currentNum,
      tipe: "ESSAY_BERGAMBAR",
      pertanyaan: itemData.q,
      stimulus: `Perhatikan stimulus studi kasus visual diagram ${topik} berikut:`,
      gambarDeskripsi: itemData.desc,
      kunciJawaban: itemData.kunci,
      pembahasan: itemData.pembahasan,
      rubrikPenskoran: itemData.rubrik,
      levelKognitif: itemData.level,
      indikatorSoal: itemData.indikator,
      bobotSkor: 10
    };
    soalList.push(qItem);
    kisiKisi.push({
      no: currentNum,
      capaianPembelajaran: `Mampu mengevaluasi stimulus kasus visual dan menyajikan solusi tertulis berbasis data pada materi ${topik}.`,
      materi: `${topik} (Kasus Visual)`,
      indikatorSoal: qItem.indikatorSoal,
      levelKognitif: qItem.levelKognitif,
      bentukSoal: "Uraian (Bergambar)",
      nomorSoal: `${currentNum}`,
      bobotSkor: 10
    });
    currentNum++;
  }

  return {
    id: "EXAM-" + Date.now(),
    judul: `${tipeUjian.toUpperCase()} ${mapel.toUpperCase()}`,
    config: {
      jenjang,
      kelas,
      mataPelajaran: mapel,
      topik,
      tingkatKesulitan: config.tingkatKesulitan || "CAMPURAN",
      tipeUjian,
      jumlahPG,
      jumlahPGBergambar,
      jumlahEssay,
      jumlahEssayBergambar,
      jumlahBergambar: jumlahPGBergambar + jumlahEssayBergambar,
      alokasiWaktu: config.alokasiWaktu || "90 Menit",
      semester: config.semester || "Ganjil",
      tahunAjaran: config.tahunAjaran || "2025/2026",
      namaGuru: config.namaGuru || "Guru Pengampu",
      namaSekolah: config.namaSekolah || "Sekolah Indonesia"
    },
    tanggalDibuat: new Date().toISOString(),
    petunjukUmum: [
      "Berdoalah sebelum memulai mengerjakan naskah soal ujian.",
      "Tuliskan nama lengkap, kelas, dan nomor peserta pada lembar jawaban yang tersedia.",
      "Bacalah setiap butir soal dengan cermat dan teliti sebelum menentukan jawaban.",
      "Dahulukan menjawab butir soal yang Anda anggap lebih mudah.",
      "Periksa kembali kelengkapan seluruh lembar jawaban Anda sebelum diserahkan kepada guru/pengawas."
    ],
    kisiKisi,
    soalList
  };
}

// Helper Fallback Generator for Modul Ajar
function generateFallbackModulAjar(config: any) {
  const jenjang = config.jenjang || "SMP";
  const kelas = config.kelas || "Kelas 7";
  const fase = config.fase || "Fase D";
  const mapel = config.mataPelajaran || "Ilmu Pengetahuan Alam (IPA)";
  const topik = config.topikMateri || "Klasifikasi Makhluk Hidup";
  const alokasiWaktu = config.alokasiWaktu || "2 x 40 Menit (1 Pertemuan)";
  const model = config.modelPembelajaran || "Problem Based Learning (PBL)";
  const guru = config.namaGuru || "Guru Pengampu";
  const sekolah = config.namaSekolah || "Sekolah Indonesia";
  const tahun = config.tahunPenyusunan || "2025/2026";
  const profil = config.profilPancasila || ["Mandiri", "Bernalar Kritis", "Gotong Royong"];

  return {
    id: "MODUL-" + Date.now(),
    judul: `MODUL AJAR KURIKULUM MERDEKA: ${mapel.toUpperCase()}`,
    config: {
      jenjang,
      kelas,
      fase,
      mataPelajaran: mapel,
      topikMateri: topik,
      alokasiWaktu,
      modelPembelajaran: model,
      metodePembelajaran: config.metodePembelajaran || ["Diskusi", "Tanya Jawab", "Presentasi", "Eksplorasi"],
      profilPancasila: profil,
      namaGuru: guru,
      namaSekolah: sekolah,
      tahunPenyusunan: tahun
    },
    tanggalDibuat: new Date().toISOString(),
    informasiUmum: {
      penyusun: guru,
      instansi: sekolah,
      tahunPenyusunan: tahun,
      jenjangSekolah: jenjang,
      mataPelajaran: mapel,
      faseKelas: `${fase} / ${kelas}`,
      alokasiWaktu,
      kompetensiAwal: [
        `Peserta didik telah mengenali konsep dasar lingkungan dan fenomena ilmiah terkait ${topik}.`,
        "Peserta didik memiliki keterampilan dasar dalam melakukan pengamatan sederhana dan kerja kelompok."
      ],
      profilPelajarPancasila: profil,
      saranaPrasarana: [
        "LCD Proyektor / Layar Digital & Laptop",
        "Lembar Kerja Peserta Didik (LKPD)",
        `Buku Paket Siswa & Bahan Bacaan Materi ${topik}`,
        "Alat Tulis & Papan Tulis Interaktif",
        "Akses Internet untuk Eksplorasi Digital"
      ],
      targetPesertaDidik: "Peserta didik reguler / tipikal (umum, tidak ada hambatan kognitif khusus)",
      modelPembelajaran: model
    },
    komponenInti: {
      tujuanPembelajaran: [
        `Peserta didik mampu mengidentifikasi karakteristik dan prinsip esensial dalam materi ${topik} secara tepat.`,
        `Peserta didik mampu menganalisis hubungan antar komponen dalam ${topik} melalui diskusi kelompok terbimbing.`,
        `Peserta didik mampu menyajikan gagasan solutif atau karya presentasi mengenai aplikasi ${topik} dalam kehidupan sehari-hari.`
      ],
      pemahamanBermakna: [
        `Mempelajari ${topik} menumbuhkan kesadaran peserta didik tentang pentingnya keteraturan dan pemecahan masalah berbasis bukti ilmiah.`,
        `Konsep ${topik} dapat diaplikasikan secara langsung untuk meningkatkan kualitas hidup dan menjaga harmoni lingkungan.`
      ],
      pertanyaanPemantik: [
        `Bagaimana fenomena ${topik} dapat memengaruhi aktivitas kehidupan kita sehari-hari?`,
        `Apa yang akan terjadi jika salah satu elemen penting dalam sistem ${topik} mengalami gangguan atau perubahan?`
      ],
      kegiatanPembelajaran: {
        pendahuluan: {
          alokasiMenit: 10,
          langkah: [
            "Guru membuka kelas dengan salam, doa bersama, dan presensi kehadiran menggunakan QR SiHadir.",
            "Guru melakukan apersepsi dengan menayangkan gambar/video kontekstual yang berkaitan dengan materi hari ini.",
            "Guru menyampaikan capaian pembelajaran, alur aktivitas, dan teknik penilaian yang akan dilakukan.",
            "Guru memberikan pertanyaan pemantik untuk memicu keaktifan dan rasa ingin tahu peserta didik."
          ]
        },
        inti: {
          alokasiMenit: 70,
          langkah: [
            `Tahap 1 (Orientasi Masalah): Guru memaparkan studi kasus nyata terkait ${topik} kepada seluruh siswa.`,
            "Tahap 2 (Organisasi Belajar): Peserta didik dibagi ke dalam kelompok kecil (4-5 siswa) dan menerima LKPD.",
            "Tahap 3 (Penyelidikan Mandiri & Kelompok): Guru membimbing siswa mengumpulkan informasi, berdiskusi, dan menguji data hipotesis.",
            "Tahap 4 (Pengembangan & Penyajian Karya): Setiap kelompok menyusun resume hasil analisis dan mempresentasikannya di depan kelas.",
            "Tahap 5 (Evaluasi & Refleksi): Guru bersama peserta didik mengevaluasi proses pemecahan masalah dan meluruskan miskonsepsi."
          ]
        },
        penutup: {
          alokasiMenit: 10,
          langkah: [
            "Guru bersama peserta didik membuat rangkuman dan kesimpulan atas materi pembelajaran hari ini.",
            "Peserta didik melakukan refleksi diri mengenai hal yang telah dipahami dan hal yang masih perlu diperdalam.",
            "Guru memberikan penguatan materi, tugas tindak lanjut (asesmen sumatif/proyek mandiri), dan mengakhiri sesi dengan doa."
          ]
        }
      },
      asesmen: {
        diagnostik: [
          "Pertanyaan pemantik lisan untuk mengukur kesiapan belajar awal",
          "Kuesioner gaya belajar dan minat peserta didik"
        ],
        formatif: [
          "Observasi rubrik keaktifan diskusi dan kolaborasi kelompok",
          "Penilaian proses penyelesaian Lembar Kerja Peserta Didik (LKPD)",
          "Penilaian keterampilan presentasi dan komunikasi lisan"
        ],
        sumatif: [
          `Tes tertulis akhir materi ${topik} berupa soal pilihan ganda, soal stimulus bergambar, dan soal uraian analitis.`
        ]
      },
      pengayaanDanRemedial: {
        pengayaan: "Diberikan kepada peserta didik dengan performa di atas rata-rata berupa penugasan proyek kreatif, analisis studi kasus mutakhir, atau pembuatan infografis digital.",
        remedial: "Diberikan kepada peserta didik yang belum mencapai kriteria ketuntasan tujuan pembelajaran berupa bimbingan perorangan terfokus atau pendampingan tutor sebaya."
      },
      refleksi: {
        guru: [
          "Apakah tujuan pembelajaran hari ini tercapai secara optimal oleh mayoritas peserta didik?",
          "Bagian mana dari kegiatan pembelajaran yang paling disukai dan paling efektif?",
          "Apa tantangan utama yang dihadapi dan bagaimana perbaikan untuk pertemuan selanjutnya?"
        ],
        siswa: [
          "Bagian pembelajaran materi mana yang paling mudah dan paling menantang bagimu?",
          "Bagaimana kontribusimu dalam kerja sama kelompok hari ini?",
          "Apa langkah yang akan kamu lakukan untuk meningkatkan pemahamanmu terhadap materi ini?"
        ]
      }
    },
    lampiran: {
      lkpd: `LEMBAR KERJA PESERTA DIDIK (LKPD)\nTopik: ${topik}\nMata Pelajaran: ${mapel} (${kelas})\n\nA. Petunjuk Pengerjaan:\n1. Tuliskan nama anggota kelompok pada kolom yang tersedia.\n2. Cermati instruksi kasus dan data pada lembar aktivitas.\n3. Lakukan diskusi aktif dan tuangkan hasil analisis secara sistematis.\n4. Siapkan 1 perwakilan kelompok untuk memaparkan hasil kerja.\n\nB. Pertanyaan Aktivitas Kelompok:\n1. Jelaskan prinsip kerja utama dari ${topik} berdasarkan pengamatan!\n2. Identifikasi 3 faktor kunci yang memengaruhi keberhasilan sistem tersebut!\n3. Buatlah kesimpulan bersama kelompok Anda!`,
      bahanBacaan: `Bahan Bacaan Inti Materi: Berisi ringkasan esensial ${topik}, glosarium istilah ilmiah penting, analogi sederhana, serta bagan alur konsep untuk mendukung literasi membaca peserta didik.`,
      glosarium: [
        { istilah: "Kurikulum Merdeka", arti: "Kerangka kurikulum fleksibel yang berfokus pada materi esensial dan pengembangan karakter profil pelajar Pancasila." },
        { istilah: "Diferensiasi Pembelajaran", arti: "Penyesuaian proses, konten, dan produk pembelajaran sesuai kesiapan, minat, dan profil belajar siswa." },
        { istilah: "Asesmen Autentik", arti: "Pengukuran kinerja siswa dalam situasi nyata yang bermakna dan aplikatif." }
      ],
      daftarPustaka: [
        `Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi. (2024). Buku Panduan Guru ${mapel} ${kelas}. Jakarta: Kemendikbudristek.`,
        "Pusat Asesmen dan Pembelajaran. (2024). Panduan Pembelajaran dan Asesmen Kurikulum Merdeka."
      ],
      rubrikPenilaian: "Rubrik Penilaian LKPD & Sikap: Skor 4 (Sangat Baik: Kontribusi tinggi, argumen ilmiah sangat kuat), Skor 3 (Baik: Aktif berdiskusi dan analisis tepat), Skor 2 (Cukup: Kurang aktif namun tugas selesai), Skor 1 (Perlu Bimbingan)."
    }
  };
}


// Simulated WhatsApp Webhook / Notification Trigger API
app.post("/api/whatsapp/send", (req, res) => {
  const { phone, message, studentName, status } = req.body;
  console.log(`[WhatsApp API Simulated] To: ${phone} | Student: ${studentName} | Status: ${status} | Msg: ${message}`);
  
  return res.json({
    success: true,
    messageId: "WA_" + Date.now(),
    phone,
    timestamp: new Date().toISOString(),
    status: "TERKIRIM"
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SiHadir QR Server] Listening on http://0.0.0.0:${PORT}`);
  });

  const handleShutdown = (signal: string) => {
    console.log(`[SiHadir QR Server] Received ${signal}, closing server gracefully...`);
    server.close(() => {
      console.log("[SiHadir QR Server] Closed remaining connections.");
      process.exit(0);
    });
    // Force close after 5 seconds if connections linger
    setTimeout(() => {
      console.error("[SiHadir QR Server] Force shutdown timeout reached.");
      process.exit(0);
    }, 5000);
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

startServer();
