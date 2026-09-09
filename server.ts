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
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
      // High-quality fallback generator when Gemini API key is not configured
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

    const prompt = `Anda adalah Pakar Asesmen Pendidikan Nasional & Pembuat Soal Ujian Kurikulum Merdeka Terstandar Indonesia.
Buatlah paket instrumen ujian lengkap yang terdiri dari:
1. Naskah Soal Ujian dengan rincian:
   - ${totalPG} Soal Pilihan Ganda (Teks Biasa)
   - ${totalPGBergambar} Soal Pilihan Ganda Bergambar / Stimulus Visual (Grafik, Bagan, Diagram, Ilustrasi)
   - ${totalEssay} Soal Essay/Uraian (Teks Analisis)
   - ${totalEssayBergambar} Soal Essay/Uraian Bergambar / Kasus Visual
2. Kunci Jawaban Lengkap & Pembahasan Solutif serta Rubrik Penskoran
3. Kisi-kisi Penulisan Soal lengkap berstandar Kurikulum Merdeka (Capaian Pembelajaran, Materi, Indikator Soal, Level Kognitif C1-C6/HOTS, Bentuk Soal, No Soal, Bobot)

DATA SPESIFIKASI SOAL:
- Jenjang: ${jenjang}
- Kelas: ${kelas}
- Mata Pelajaran: ${mataPelajaran}
- Topik / Materi Pembelajaran: ${topik}
- Tingkat Kesulitan / Kognitif: ${tingkatKesulitan}
- Jenis Ujian: ${tipeUjian}
- Alokasi Waktu: ${alokasiWaktu}
- Catatan / Petunjuk Khusus: ${petunjukKhusus || "Sesuai CP & standar asesmen Kurikulum Merdeka terkini"}

KETENTUAN WAJIB TIAP KATEGORI SOAL:
- Soal Pilihan Ganda Teks Biasa (${totalPG} butir): Opsi 4 pilihan (A, B, C, D) untuk SD/SMP atau 5 pilihan (A, B, C, D, E) untuk SMA/SMK. Kunci jawaban & pembahasan rinci.
- Soal Pilihan Ganda Bergambar (${totalPGBergambar} butir): Berupa soal PG dengan stimulus visual. WAJIB sertakan "gambarDeskripsi" yang mendeskripsikan secara sangat rinci diagram, grafik, peta, tabel data, atau ilustrasi ilmiah yang menjadi acuan stimulus soal, beserta opsi pilihan ganda dan kunci jawaban.
- Soal Essay / Uraian Teks Biasa (${totalEssay} butir): Pertanyaan pemecahan masalah/analisis mendalam tanpa gambar, dilengkapi kunci jawaban, rubrik penilaian, dan bobot skor (misal 10 poin).
- Soal Essay / Uraian Bergambar (${totalEssayBergambar} butir): Pertanyaan analisis mendalam berbasis stimulus visual. WAJIB sertakan "gambarDeskripsi" lengkap (bagan/diagram/kasus visual), kunci jawaban analisis bertahap, rubrik penskoran terperinci, dan bobot skor.
- Kisi-kisi Soal: Mencakup semua butir soal (${totalSemua} butir) urut nomor 1 s.d. ${totalSemua} dengan level kognitif (C1/C2/C3/C4/C5/C6 atau HOTS/MOTS/LOTS).

KEMBALIKAN HANYA FORMAT JSON MURNI SESUAI STRUKTUR BERIKUT:
{
  "judul": "${tipeUjian.toUpperCase()} ${mataPelajaran.toUpperCase()}",
  "petunjukUmum": [
    "Berdoalah sebelum mengerjakan soal.",
    "Periksa dan bacalah soal-soal dengan teliti sebelum menjawab.",
    "Tuliskan identitas nama dan kelas pada lembar jawaban yang tersedia.",
    "Dahulukan menjawab soal yang dianggap mudah.",
    "Periksa kembali jawaban sebelum diserahkan kepada pengawas."
  ],
  "kisiKisi": [
    {
      "no": 1,
      "capaianPembelajaran": "...",
      "materi": "...",
      "indikatorSoal": "Peserta didik dapat menganalisis...",
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
      "stimulus": "Perhatikan teks bacaan berikut...",
      "pilihan": {
        "A": "...",
        "B": "...",
        "C": "...",
        "D": "..."
      },
      "kunciJawaban": "A",
      "pembahasan": "Penjelasan detail mengapa pilihan A benar...",
      "levelKognitif": "C3",
      "indikatorSoal": "...",
      "bobotSkor": 1
    },
    {
      "id": "q-pg-img-1",
      "no": 2,
      "tipe": "PG",
      "pertanyaan": "Berdasarkan diagram alur pada gambar di atas, fungsi utama komponen X adalah...",
      "stimulus": "Diberikan diagram ilustrasi...",
      "gambarDeskripsi": "[Diagram Alur]: Menampilkan siklus pertukaran gas...",
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
      "id": "q-essay-1",
      "no": 3,
      "tipe": "ESSAY",
      "pertanyaan": "Jelaskan proses terjadinya...",
      "stimulus": "",
      "kunciJawaban": "Langkah 1: ... Langkah 2: ...",
      "pembahasan": "Siswa mampu menguraikan dengan 3 poin kunci...",
      "rubrikPenskoran": "Skor 10 jika menjawab 3 faktor lengkap, Skor 6 jika 2 faktor, Skor 3 jika 1 faktor.",
      "levelKognitif": "C5 (HOTS)",
      "indikatorSoal": "...",
      "bobotSkor": 10
    },
    {
      "id": "q-essay-img-1",
      "no": 4,
      "tipe": "ESSAY",
      "pertanyaan": "Berdasarkan grafik pengamatan pada gambar di atas, analisislah anomali data pada titik T2 dan simpulkan penyebabnya!",
      "stimulus": "Cermati grafik eksperimen di bawah ini:",
      "gambarDeskripsi": "[Grafik Hasil Percobaan]: Menunjukkan perbandingan laju reaksi antara perlakuan kontrol dan perlakuan uji suhu tinggi...",
      "kunciJawaban": "Analisis: Pada titik T2 terjadi penurunan laju...",
      "pembahasan": "Peserta didik menguraikan hubungan antara variabel suhu dan laju reaksi...",
      "rubrikPenskoran": "Skor 10: Analisis anomali tepat dan alasan ilmiah akurat. Skor 5: Hanya menyebutkan penurunan tanpa analisis.",
      "levelKognitif": "C5 (HOTS)",
      "indikatorSoal": "...",
      "bobotSkor": 10
    }
  ]
}`;

    let data: any = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
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
    // Return fallback so the teacher never faces a broken UI
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
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
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

// Helper Fallback Generator for Exam Questions
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

  // 1. Pilihan Ganda (Teks Biasa)
  const samplePGPrompts = [
    {
      q: `Konsep utama yang mendasari materi ${topik} dalam pembelajaran ${mapel} berkaitan erat dengan...`,
      opts: {
        A: `Penerapan prinsip keteraturan dan hubungan logis antar elemen dalam ${topik}.`,
        B: "Penghapusan seluruh variabel perantara tanpa verifikasi data primer.",
        C: "Penggunaan asumsi tunggal tanpa mempertimbangkan konteks lingkungan.",
        D: "Pemisahan seluruh komponen sehingga tidak saling memengaruhi."
      },
      kunci: "A",
      pembahasan: `Pilihan A tepat karena materi ${topik} menekankan pada keteraturan sistematis dan analisis hubungan sebab-akibat.`,
      level: "C2 (Pemahaman)"
    },
    {
      q: `Seorang siswa melakukan analisis terhadap fenomena yang terjadi pada ${topik}. Hasil pengamatan menunjukkan adanya perubahan signifikan ketika diberikan perlakuan khusus. Kesimpulan yang paling valid adalah...`,
      opts: {
        A: "Perubahan tersebut tidak memiliki hubungan sebab-akibat dengan variabel yang diuji.",
        B: "Variabel perlakuan berpengaruh secara langsung terhadap dinamika sistem materi yang diamati.",
        C: "Hasil pengamatan harus diabaikan karena tidak sesuai hipotesis awal.",
        D: "Semua parameter pengamatan selalu bernilai konstan dalam setiap kondisi."
      },
      kunci: "B",
      pembahasan: "Pilihan B benar karena kesimpulan ilmiah didasarkan pada hubungan langsung antara variabel perlakuan dan respon sistem.",
      level: "C4 (HOTS - Analisis)"
    },
    {
      q: `Dalam kehidupan sehari-hari, penerapan prinsip ${topik} dapat dimanfaatkan untuk...`,
      opts: {
        A: "Meningkatkan efisiensi kerja dan memecahkan permasalahan secara sistematis.",
        B: "Menghindari seluruh proses pengukuran dan evaluasi berkala.",
        C: "Membatasi perkembangan kreativitas dan pemikiran kritis.",
        D: "Mengurangi interaksi antar anggota tim dalam pemecahan masalah."
      },
      kunci: "A",
      pembahasan: "Penerapan konsep materi bertujuan memberikan solusi aplikatif yang efektif bagi kehidupan nyata.",
      level: "C3 (Aplikasi)"
    },
    {
      q: `Perhatikan beberapa pernyataan berikut:\n(1) Mengidentifikasi karakteristik utama komponen.\n(2) Melakukan klasifikasi berdasarkan kriteria tertentu.\n(3) Menghitung korelasi matematis antar faktor.\n(4) Membuat kesimpulan evaluatif.\nLangkah kerja yang tepat dalam menganalisis ${topik} secara berurutan adalah...`,
      opts: {
        A: "(1) - (2) - (3) - (4)",
        B: "(2) - (1) - (4) - (3)",
        C: "(4) - (3) - (2) - (1)",
        D: "(3) - (1) - (4) - (2)"
      },
      kunci: "A",
      pembahasan: "Urutan metode ilmiah yang sistematis dimulai dari identifikasi, klasifikasi, komparasi/analisis, dan diakhiri kesimpulan evaluatif.",
      level: "C4 (HOTS - Sintesis)"
    },
    {
      q: `Apabila salah satu faktor pendukung dalam sistem ${topik} mengalami penurunan drastis, dampak langsung yang paling mungkin terjadi pada keseimbangan sistem adalah...`,
      opts: {
        A: "Sistem akan mengalami disrupsi fungsional dan membutuhkan penyesuaian adaptif.",
        B: "Sistem akan langsung berhenti total tanpa kemungkinan pemulihan.",
        C: "Tidak ada pengaruh apapun karena setiap komponen bersifat terisolasi.",
        D: "Kinerja sistem otomatis berlipat ganda secara spontan."
      },
      kunci: "A",
      pembahasan: "Dalam sistem terpadu, penurunan satu faktor memicu adaptasi atau regulasi kompensasi untuk memulihkan ekuilibrium.",
      level: "C4 (HOTS - Evaluasi)"
    }
  ];

  for (let i = 0; i < jumlahPG; i++) {
    const template = samplePGPrompts[i % samplePGPrompts.length];
    const qItem = {
      id: `q-pg-${currentNum}`,
      no: currentNum,
      tipe: "PG",
      pertanyaan: template.q,
      stimulus: `Diberikan konteks pembelajaran ${mapel} pada materi ${topik}:`,
      pilihan: template.opts,
      kunciJawaban: template.kunci,
      pembahasan: template.pembahasan,
      levelKognitif: template.level,
      indikatorSoal: `Peserta didik dapat memahami dan menganalisis konsep ${topik} pada aspek indikator ke-${i + 1}.`,
      bobotSkor: 1
    };
    soalList.push(qItem);
    kisiKisi.push({
      no: currentNum,
      capaianPembelajaran: `Menguasai dan mengaplikasikan konsep ${topik} dalam pembelajaran ${mapel}.`,
      materi: topik,
      indikatorSoal: qItem.indikatorSoal,
      levelKognitif: qItem.levelKognitif,
      bentukSoal: "Pilihan Ganda",
      nomorSoal: `${currentNum}`,
      bobotSkor: 1
    });
    currentNum++;
  }

  // 2. Pilihan Ganda Bergambar / Stimulus Visual
  const samplePGBergambarPrompts = [
    {
      q: `Perhatikan diagram alur pada gambar di atas! Bagian yang ditunjukkan oleh label [X] memiliki peran krusial dalam mekanisme ${topik}, yaitu sebagai...`,
      desc: `[Diagram Struktur / Skema Alur]: Menunjukkan bagan alur proses ${topik} yang menghubungkan input awal, proses transformasi pada simpul [X], dan menghasilkan output optimal [Y].`,
      opts: {
        A: "Pusat regulasi dan konversi data/energi utama dalam siklus proses.",
        B: "Pintu pembuangan akhir yang tidak memengaruhi proses sebelumnya.",
        C: "Komponen pasif tanpa fungsi interaksi antar sistem.",
        D: "Media penyimpan cadangan yang hanya aktif saat kondisi darurat."
      },
      kunci: "A",
      pembahasan: "Simpul [X] pada diagram bertindak sebagai pusat kendali/reaksi utama yang memproses input menjadi output fungsional.",
      level: "C4 (HOTS - Interpretasi Gambar)"
    },
    {
      q: `Cermati grafik tren hubungan data pada gambar di atas! Kesimpulan yang paling tepat mengenai korelasi antar variabel pada grafik terkait ${topik} adalah...`,
      desc: `[Grafik Garis / Batang Komparasi Data]: Menampilkan sumbu X (Waktu/Variabel Bebas) dan sumbu Y (Kinerja/Respon). Garis kurva menunjukkan kenaikan eksponensial di awal yang kemudian mencapai fase stabil (plato).`,
      opts: {
        A: "Hubungan berbanding lurus hingga mencapai titik saturasi optimal.",
        B: "Kedua variabel saling bertolak belakang secara berkesinambungan.",
        C: "Variabel Y tidak dipengaruhi oleh perubahan variabel X.",
        D: "Kurva menunjukkan fluktuasi acak tanpa pola teratur."
      },
      kunci: "A",
      pembahasan: "Grafik memperlihatkan peningkatan proporsional yang berangsur stabil saat mendekati kapasitas maksimum.",
      level: "C4 (HOTS - Analisis Data Visual)"
    }
  ];

  for (let i = 0; i < jumlahPGBergambar; i++) {
    const template = samplePGBergambarPrompts[i % samplePGBergambarPrompts.length];
    const qItem = {
      id: `q-pg-img-${currentNum}`,
      no: currentNum,
      tipe: "PG",
      pertanyaan: template.q,
      stimulus: `Perhatikan stimulus infografis / gambar diagram ${topik} berikut ini:`,
      gambarDeskripsi: template.desc,
      pilihan: template.opts,
      kunciJawaban: template.kunci,
      pembahasan: template.pembahasan,
      levelKognitif: template.level,
      indikatorSoal: `Disajikan gambar/diagram stimulus, peserta didik mampu menginterpretasikan dan menganalisis peran komponen ${topik}.`,
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

  // 3. Soal Essay / Uraian (Teks Biasa)
  const sampleEssayPrompts = [
    {
      q: `Jelaskan secara komprehensif bagaimana prinsip ${topik} bekerja dan sebutkan minimal 3 (tiga) contoh konkret penerapannya dalam kehidupan nyata peserta didik di lingkungan sekitar!`,
      kunci: `Kunci Jawaban & Poin Utama:\n1. Definisi & Konsep Dasar: Menjelaskan mekanisme kerja ${topik} secara logis dan runtut.\n2. Hubungan Sebab-Akibat: Mengaitkan antar komponen dengan tepat.\n3. Tiga Contoh Nyata: Memberikan 3 contoh relevan di lingkungan sekolah, rumah, atau masyarakat.`,
      pembahasan: "Siswa dinilai berdasarkan kejelasan alur logika, ketepatan terminologi ilmiah, serta relevansi contoh nyata yang dipaparkan.",
      rubrik: "Skor 10: Menjawab 3 poin lengkap & argumen mendalam. Skor 7: Menjawab 2 poin tepat. Skor 4: Hanya 1 poin benar. Skor 1: Menjawab kurang relevan.",
      level: "C5 (HOTS - Evaluasi & Sintesis)"
    },
    {
      q: `Dalam sebuah eksperimen/kasus studi mengenai ${topik}, ditemukan kendala di mana hasil yang diperoleh tidak sesuai dengan target standar yang diharapkan. Analisislah kemungkinan faktor penyebab kegagalan tersebut dan usulkan 2 (dua) langkah perbaikan (solusi) yang efektif!`,
      kunci: `Kunci Jawaban:\n1. Identifikasi Faktor Penyebab: Ketidaktelitian pengukuran, variabel kontrol tidak terjaga, atau pengaruh lingkungan luar.\n2. Solusi 1: Kalibrasi instrumen dan standarisasi prosedur operasional.\n3. Solusi 2: Evaluasi berkala dan pengujian berulang (replikasi data).`,
      pembahasan: "Mengukur kemampuan pemecahan masalah kritis (problem-solving) dan pemikiran reflektif peserta didik.",
      rubrik: "Skor 10: Mengidentifikasi minimal 2 penyebab dan 2 solusi konkret yang logis. Skor 5: Hanya menyebutkan penyebab atau solusi saja.",
      level: "C6 (HOTS - Kreasi & Problem Solving)"
    }
  ];

  for (let i = 0; i < jumlahEssay; i++) {
    const template = sampleEssayPrompts[i % sampleEssayPrompts.length];
    const qItem = {
      id: `q-essay-${currentNum}`,
      no: currentNum,
      tipe: "ESSAY",
      pertanyaan: template.q,
      stimulus: "",
      kunciJawaban: template.kunci,
      pembahasan: template.pembahasan,
      rubrikPenskoran: template.rubrik,
      levelKognitif: template.level,
      indikatorSoal: `Peserta didik mampu menguraikan, menganalisis, dan merumuskan solusi permasalahan terkait ${topik} secara tertulis.`,
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

  // 4. Soal Essay Bergambar / Kasus Visual
  const sampleEssayBergambarPrompts = [
    {
      q: `Perhatikan skema siklus dan data eksperimen pada gambar di atas! Analisislah mengapa terjadi fluktuasi pada tahap transisi ke-3 dan rumuskan solusi untuk mengoptimalkan efisiensi sistem materi ${topik}!`,
      desc: `[Diagram Siklus Terpadu & Grafik Parameter]: Menampilkan hubungan antara 3 komponen utama dalam sistem ${topik} beserta grafik fluktuasi performa di mana terdapat penurunan efisiensi pada fase transisi.`,
      kunci: `Kunci Jawaban:\n1. Analisis Gambar: Fluktuasi terjadi akibat ketidakseimbangan beban kerja pada komponen kedua.\n2. Solusi Optimasi: Melakukan regulasi umpan balik negatif dan stabilisasi input materi agar efisiensi kembali optimal.`,
      pembahasan: "Peserta didik mengintegrasikan analisis visual data dengan pemahaman konsep konseptual untuk merumuskan rekomendasi pemecahan masalah.",
      rubrik: "Skor 10: Analisis visual akurat dan solusi yang diajukan berbasis prinsip ilmiah. Skor 6: Solusi benar tetapi analisis gambar kurang detail.",
      level: "C6 (HOTS - Kreasi & Desain Solusi)"
    }
  ];

  for (let i = 0; i < jumlahEssayBergambar; i++) {
    const template = sampleEssayBergambarPrompts[i % sampleEssayBergambarPrompts.length];
    const qItem = {
      id: `q-essay-img-${currentNum}`,
      no: currentNum,
      tipe: "ESSAY",
      pertanyaan: template.q,
      stimulus: `Perhatikan stimulus infografis/diagram kasus visual berikut:`,
      gambarDeskripsi: template.desc,
      kunciJawaban: template.kunci,
      pembahasan: template.pembahasan,
      rubrikPenskoran: template.rubrik,
      levelKognitif: template.level,
      indikatorSoal: `Disajikan bagan/grafik kasus visual, peserta didik mampu mengevaluasi dan merumuskan solusi komprehensif terkait ${topik}.`,
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
      "Berdoalah sebelum memulai mengerjakan soal ujian.",
      "Tuliskan nama lengkap, kelas, dan nomor peserta pada lembar jawaban.",
      "Bacalah setiap butir soal dengan cermat dan teliti sebelum menentukan jawaban.",
      "Dahulukan menjawab butir soal yang Anda anggap lebih mudah.",
      "Periksa kembali kelengkapan lembar jawaban Anda sebelum diserahkan kepada guru/pengawas."
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
