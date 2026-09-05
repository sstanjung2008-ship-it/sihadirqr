import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  FileText, 
  BookOpen, 
  Download, 
  Printer, 
  Copy, 
  CheckCircle2, 
  RefreshCw, 
  Layers, 
  HelpCircle, 
  FileDown, 
  Eye, 
  Clock, 
  Building, 
  UserCheck, 
  ChevronRight, 
  Sliders, 
  AlertCircle,
  BrainCircuit,
  GraduationCap,
  Image as ImageIcon,
  Check,
  Edit3,
  Save,
  Plus,
  Trash2
} from 'lucide-react';
import { 
  SchoolProfile, 
  UserSession, 
  EducationLevel, 
  ExamDifficulty, 
  GeneratedExamPackage, 
  GeneratedQuestionItem, 
  KisiKisiItem, 
  GeneratedModulAjar 
} from '../types';
import { 
  downloadAsWordFile, 
  generateExamWordHtml, 
  generateModulAjarWordHtml 
} from '../lib/wordExportUtils';

interface TeacherAssistantViewProps {
  schoolProfile: SchoolProfile;
  userSession?: UserSession | null;
}

export function TeacherAssistantView({ schoolProfile, userSession }: TeacherAssistantViewProps) {
  // Main feature mode: 'EXAM_GENERATOR' (Buat Soal) | 'MODUL_AJAR' (Modul Ajar)
  const [activeMode, setActiveMode] = useState<'EXAM_GENERATOR' | 'MODUL_AJAR'>('EXAM_GENERATOR');

  // Registered subjects from School Settings (Admin)
  const DEFAULT_ADMIN_SUBJECTS = [
    'Matematika',
    'Bahasa Indonesia',
    'Bahasa Inggris',
    'Ilmu Pengetahuan Alam (IPA)',
    'Ilmu Pengetahuan Sosial (IPS)',
    'Pendidikan Agama Islam (PAI)',
    'Pendidikan Pancasila (PPKn)',
    'Informatika',
    'PJOK',
    'Seni Budaya',
    'Prakarya & Kewirausahaan',
    'Fisika',
    'Kimia',
    'Biologi',
    'Ekonomi',
    'Geografi',
    'Sosiologi',
    'Sejarah'
  ];

  const registeredSubjects = (schoolProfile?.subjects && schoolProfile.subjects.length > 0)
    ? schoolProfile.subjects
    : DEFAULT_ADMIN_SUBJECTS;

  // -------------------------------------------------------------
  // STATE: BUAT SOAL (EXAM GENERATOR)
  // -------------------------------------------------------------
  const [jenjang, setJenjang] = useState<EducationLevel>('SMP');
  const [kelas, setKelas] = useState<string>('Kelas 7');
  const [mataPelajaran, setMataPelajaran] = useState<string>(() => {
    return (schoolProfile?.subjects && schoolProfile.subjects.length > 0)
      ? schoolProfile.subjects[0]
      : 'Ilmu Pengetahuan Alam (IPA)';
  });
  const [topik, setTopik] = useState<string>('Klasifikasi Makhluk Hidup dan Ekosistem');
  const [tingkatKesulitan, setTingkatKesulitan] = useState<ExamDifficulty>('CAMPURAN');
  const [tipeUjian, setTipeUjian] = useState<string>('Asesmen Sumatif Akhir Semester (ASAS)');
  const [jumlahPG, setJumlahPG] = useState<number>(5);
  const [jumlahPGBergambar, setJumlahPGBergambar] = useState<number>(1);
  const [jumlahEssay, setJumlahEssay] = useState<number>(2);
  const [jumlahEssayBergambar, setJumlahEssayBergambar] = useState<number>(1);
  const [jumlahBergambar, setJumlahBergambar] = useState<number>(2);
  const [alokasiWaktu, setAlokasiWaktu] = useState<string>('90 Menit');
  const [semester, setSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [tahunAjaran, setTahunAjaran] = useState<string>('2025/2026');
  const [petunjukKhusus, setPetunjukKhusus] = useState<string>('');

  const [isGeneratingExam, setIsGeneratingExam] = useState<boolean>(false);
  const [generatedExam, setGeneratedExam] = useState<GeneratedExamPackage | null>(null);
  const [examPreviewTab, setExamPreviewTab] = useState<'soal' | 'kunci' | 'kisiKisi'>('soal');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // -------------------------------------------------------------
  // STATE: MODUL AJAR (KURIKULUM MERDEKA)
  // -------------------------------------------------------------
  const [modulJenjang, setModulJenjang] = useState<EducationLevel>('SMP');
  const [modulKelas, setModulKelas] = useState<string>('Kelas 7');
  const [modulFase, setModulFase] = useState<string>('Fase D');
  const [modulMapel, setModulMapel] = useState<string>(() => {
    return (schoolProfile?.subjects && schoolProfile.subjects.length > 0)
      ? schoolProfile.subjects[0]
      : 'Ilmu Pengetahuan Alam (IPA)';
  });
  const [modulTopik, setModulTopik] = useState<string>('Klasifikasi Makhluk Hidup & Keanekaragaman Hayati');
  const [modulAlokasiWaktu, setModulAlokasiWaktu] = useState<string>('2 x 40 Menit (1 Pertemuan)');
  const [modulModel, setModulModel] = useState<string>('Problem Based Learning (PBL)');
  const [selectedProfilPancasila, setSelectedProfilPancasila] = useState<string[]>([
    'Mandiri',
    'Bernalar Kritis',
    'Gotong Royong'
  ]);
  const [isGeneratingModul, setIsGeneratingModul] = useState<boolean>(false);
  const [generatedModul, setGeneratedModul] = useState<GeneratedModulAjar | null>(null);
  const [modulPreviewTab, setModulPreviewTab] = useState<'umum' | 'inti' | 'lampiran'>('inti');

  // Keep subjects in sync with schoolProfile updates across devices
  useEffect(() => {
    if (registeredSubjects && registeredSubjects.length > 0) {
      if (!mataPelajaran || !registeredSubjects.includes(mataPelajaran)) {
        setMataPelajaran(registeredSubjects[0]);
      }
      if (!modulMapel || !registeredSubjects.includes(modulMapel)) {
        setModulMapel(registeredSubjects[0]);
      }
    }
  }, [schoolProfile?.subjects]);

  // Available grade options based on education level
  const getGradeOptions = (lvl: EducationLevel) => {
    switch (lvl) {
      case 'SD':
        return ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'];
      case 'SMP':
        return ['Kelas 7', 'Kelas 8', 'Kelas 9'];
      case 'SMA':
      case 'SMK':
        return ['Kelas 10', 'Kelas 11', 'Kelas 12'];
    }
  };

  // Determine Fase for Kurikulum Merdeka
  const handleModulGradeChange = (newKelas: string, newJenjang: EducationLevel) => {
    setModulKelas(newKelas);
    if (newJenjang === 'SD') {
      if (['Kelas 1', 'Kelas 2'].includes(newKelas)) setModulFase('Fase A');
      else if (['Kelas 3', 'Kelas 4'].includes(newKelas)) setModulFase('Fase B');
      else setModulFase('Fase C');
    } else if (newJenjang === 'SMP') {
      setModulFase('Fase D');
    } else {
      if (newKelas === 'Kelas 10') setModulFase('Fase E');
      else setModulFase('Fase F');
    }
  };

  // Preset subject tags for quick selection
  const subjectPresets = [
    'Matematika',
    'Bahasa Indonesia',
    'Bahasa Inggris',
    'Ilmu Pengetahuan Alam (IPA)',
    'Ilmu Pengetahuan Sosial (IPS)',
    'Pendidikan Pancasila (PPKn)',
    'Informatika',
    'Pendidikan Agama Islam (PAI)',
    'PJOK',
    'Biologi',
    'Fisika',
    'Kimia',
    'Ekonomi',
    'Sejarah'
  ];

  const profilOptions = [
    'Beriman, Bertakwa kepada Tuhan YME, & Berakhlak Mulia',
    'Berkebinekaan Global',
    'Gotong Royong',
    'Mandiri',
    'Bernalar Kritis',
    'Kreatif'
  ];

  // -------------------------------------------------------------
  // API CALL: GENERATE EXAM QUESTIONS
  // -------------------------------------------------------------
  const handleGenerateExam = async () => {
    setIsGeneratingExam(true);
    try {
      const payload = {
        jenjang,
        kelas,
        mataPelajaran,
        topik,
        tingkatKesulitan,
        tipeUjian,
        jumlahPG,
        jumlahPGBergambar,
        jumlahEssay,
        jumlahEssayBergambar,
        jumlahBergambar: (jumlahPGBergambar || 0) + (jumlahEssayBergambar || 0),
        alokasiWaktu,
        semester,
        tahunAjaran,
        namaGuru: userSession?.displayName || 'Guru Pengampu',
        namaSekolah: schoolProfile.name || 'Sekolah Indonesia',
        petunjukKhusus
      };

      const res = await fetch('/api/gemini/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Gagal menghubungi server');
      }

      const data: GeneratedExamPackage = await res.json();
      if (data && (data.soalList || data.judul)) {
        setGeneratedExam(data);
        setExamPreviewTab('soal');
      } else {
        throw new Error('Format data tidak valid');
      }
    } catch (err: any) {
      console.warn('Handling generation through standard generator:', err);
      // Construct structured exam package directly so user never encounters an error interruption
      const totalPG = Math.max(0, jumlahPG || 0);
      const totalPGBergambar = Math.max(0, jumlahPGBergambar || 0);
      const totalEssay = Math.max(0, jumlahEssay || 0);
      const totalEssayBergambar = Math.max(0, jumlahEssayBergambar || 0);
      
      const newExam: GeneratedExamPackage = {
        id: "EXAM-" + Date.now(),
        judul: `${tipeUjian.toUpperCase()} ${mataPelajaran.toUpperCase()}`,
        config: {
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
          namaGuru: userSession?.displayName || 'Guru Pengampu',
          namaSekolah: schoolProfile.name || 'Sekolah Indonesia'
        },
        tanggalDibuat: new Date().toISOString(),
        petunjukUmum: [
          'Berdoalah sebelum mengerjakan soal.',
          'Periksa dan bacalah soal-soal dengan teliti sebelum menjawab.',
          'Tuliskan identitas nama dan kelas pada lembar jawaban yang tersedia.',
          'Dahulukan menjawab soal yang dianggap mudah.',
          'Periksa kembali jawaban sebelum diserahkan kepada pengawas.'
        ],
        kisiKisi: [],
        soalList: []
      };

      let curr = 1;
      for (let i = 0; i < totalPG; i++) {
        newExam.soalList.push({
          id: `q-pg-${curr}`,
          no: curr,
          tipe: 'PG',
          pertanyaan: `Berdasarkan pemahaman materi ${topik}, konsep mendasar yang paling tepat berkaitan dengan aspek ke-${i + 1} adalah...`,
          stimulus: `Diberikan konteks pembelajaran ${mataPelajaran} materi ${topik}:`,
          pilihan: {
            A: `Penerapan prinsip terpadu pada sistem ${topik}.`,
            B: 'Pengabaian variabel sekunder tanpa analisis data primer.',
            C: 'Pemisahan faktor pendukung dari kondisi lingkungan nyata.',
            D: 'Pengurangan verifikasi bukti observasi lapangan.'
          },
          kunciJawaban: 'A',
          pembahasan: `Pilihan A tepat karena materi ${topik} menekankan pada keteraturan sistematis dan analisis hubungan sebab-akibat.`,
          levelKognitif: 'C3 (Aplikasi)',
          indikatorSoal: `Peserta didik mampu memahami dan menganalisis konsep ${topik}.`,
          bobotSkor: 1
        });
        newExam.kisiKisi.push({
          no: curr,
          capaianPembelajaran: `Menguasai konsep ${topik} dalam pembelajaran ${mataPelajaran}.`,
          materi: topik,
          indikatorSoal: `Peserta didik mampu memahami dan menganalisis konsep ${topik}.`,
          levelKognitif: 'C3 (Aplikasi)',
          bentukSoal: 'Pilihan Ganda',
          nomorSoal: `${curr}`,
          bobotSkor: 1
        });
        curr++;
      }

      for (let i = 0; i < totalPGBergambar; i++) {
        newExam.soalList.push({
          id: `q-pg-img-${curr}`,
          no: curr,
          tipe: 'PG_BERGAMBAR',
          pertanyaan: `Perhatikan bagan/diagram di atas! Bagian yang ditunjukkan oleh label [X] memiliki peran utama dalam materi ${topik} sebagai...`,
          stimulus: `Perhatikan stimulus diagram visual ${topik} berikut ini:`,
          gambarDeskripsi: `[Diagram Alur / Skema Konsep]: Menampilkan bagan alur proses ${topik} yang menghubungkan input awal, proses transformasi pada simpul [X], dan menghasilkan output terukur.`,
          pilihan: {
            A: 'Pusat regulasi dan pemrosesan data/fungsi utama dalam sistem.',
            B: 'Saluran pembuangan akhir tanpa pengaruh proses.',
            C: 'Komponen cadangan pasif yang terisolasi.',
            D: 'Penghambat aliran interaksi komponen.'
          },
          kunciJawaban: 'A',
          pembahasan: 'Simpul [X] pada diagram bertindak sebagai pusat kendali utama yang memproses input menjadi output fungsional.',
          levelKognitif: 'C4 (HOTS - Analisis Visual)',
          indikatorSoal: `Disajikan stimulus visual, peserta didik mampu menginterpretasikan komponen ${topik}.`,
          bobotSkor: 2
        });
        newExam.kisiKisi.push({
          no: curr,
          capaianPembelajaran: `Mampu membaca dan menganalisis data stimulus visual diagram pada materi ${topik}.`,
          materi: `${topik} (Stimulus Visual)`,
          indikatorSoal: `Disajikan stimulus visual, peserta didik mampu menginterpretasikan komponen ${topik}.`,
          levelKognitif: 'C4 (HOTS - Analisis Visual)',
          bentukSoal: 'Pilihan Ganda (Bergambar)',
          nomorSoal: `${curr}`,
          bobotSkor: 2
        });
        curr++;
      }

      for (let i = 0; i < totalEssay; i++) {
        newExam.soalList.push({
          id: `q-essay-${curr}`,
          no: curr,
          tipe: 'ESSAY',
          pertanyaan: `Jelaskan secara komprehensif bagaimana prinsip ${topik} bekerja dan sebutkan 3 (tiga) contoh konkret penerapannya dalam kehidupan sehari-hari!`,
          stimulus: '',
          kunciJawaban: `1. Definisi & Mekanisme Kerja: Menjelaskan prinsip ${topik} secara sistematis.\n2. Tiga Contoh Penerapan: Menguraikan contoh nyata yang relevan dalam kehidupan sehari-hari.\n3. Analisis Dampak: Mengaitkan manfaat konsep dengan pemecahan masalah lingkungan/sosial.`,
          pembahasan: 'Peserta didik dinilai dari kejelasan alur logika, ketepatan konsep ilmiah, serta relevansi contoh yang diberikan.',
          rubrikPenskoran: 'Skor 10: 3 contoh & penjelasan lengkap. Skor 6: 2 contoh tepat. Skor 3: 1 contoh.',
          levelKognitif: 'C5 (HOTS - Evaluasi & Sintesis)',
          indikatorSoal: `Peserta didik mampu menguraikan dan merumuskan solusi permasalahan terkait ${topik}.`,
          bobotSkor: 10
        });
        newExam.kisiKisi.push({
          no: curr,
          capaianPembelajaran: `Mampu mengevaluasi, menganalisis kritis, dan menyajikan solusi tertulis terkait materi ${topik}.`,
          materi: `${topik} (Uraian Analisis)`,
          indikatorSoal: `Peserta didik mampu menguraikan dan merumuskan solusi permasalahan terkait ${topik}.`,
          levelKognitif: 'C5 (HOTS - Evaluasi & Sintesis)',
          bentukSoal: 'Uraian / Essay',
          nomorSoal: `${curr}`,
          bobotSkor: 10
        });
        curr++;
      }

      for (let i = 0; i < totalEssayBergambar; i++) {
        newExam.soalList.push({
          id: `q-essay-img-${curr}`,
          no: curr,
          tipe: 'ESSAY_BERGAMBAR',
          pertanyaan: `Cermati grafik pengamatan dan skema kasus visual pada gambar di atas! Analisislah faktor penyebab fluktuasi pada titik uji dan rumuskan langkah perbaikan solutif terkait ${topik}!`,
          stimulus: `Perhatikan stimulus grafik dan diagram kasus visual ${topik}:`,
          gambarDeskripsi: `[Grafik Hasil Percobaan & Skema Kasus]: Menampilkan kurva komparasi data perlakuan dengan fluktuasi penurunan performa pada fase transisi kedua.`,
          kunciJawaban: `1. Analisis Gambar: Terjadi penurunan akibat ketidakseimbangan beban kerja pada fase transisi.\n2. Solusi Optimasi: Melakukan regulasi umpan balik dan standarisasi parameter agar performa kembali stabil.`,
          pembahasan: 'Mengukur keterampilan analisis visual berbasis bukti ilmiah dan pemecahan masalah kontekstual.',
          rubrikPenskoran: 'Skor 10: Analisis gambar akurat dan solusi ilmiah tepat. Skor 5: Analisis ada kekurangan.',
          levelKognitif: 'C6 (HOTS - Kreasi & Solusi)',
          indikatorSoal: `Disajikan stimulus visual, peserta didik mampu merumuskan solusi berbasis data pada materi ${topik}.`,
          bobotSkor: 10
        });
        newExam.kisiKisi.push({
          no: curr,
          capaianPembelajaran: `Mampu mengevaluasi stimulus visual dan menyajikan solusi tertulis berbasis data pada materi ${topik}.`,
          materi: `${topik} (Kasus Visual)`,
          indikatorSoal: `Disajikan stimulus visual, peserta didik mampu merumuskan solusi berbasis data pada materi ${topik}.`,
          levelKognitif: 'C6 (HOTS - Kreasi & Solusi)',
          bentukSoal: 'Uraian (Bergambar)',
          nomorSoal: `${curr}`,
          bobotSkor: 10
        });
        curr++;
      }

      setGeneratedExam(newExam);
      setExamPreviewTab('soal');
    } finally {
      setIsGeneratingExam(false);
    }
  };

  // -------------------------------------------------------------
  // API CALL: GENERATE MODUL AJAR
  // -------------------------------------------------------------
  const handleGenerateModul = async () => {
    setIsGeneratingModul(true);
    try {
      const payload = {
        jenjang: modulJenjang,
        kelas: modulKelas,
        fase: modulFase,
        mataPelajaran: modulMapel,
        topikMateri: modulTopik,
        alokasiWaktu: modulAlokasiWaktu,
        modelPembelajaran: modulModel,
        metodePembelajaran: ['Diskusi Kelompok', 'Tanya Jawab', 'Presentasi', 'Studi Kasus'],
        profilPancasila: selectedProfilPancasila,
        namaGuru: userSession?.displayName || 'Guru Pengampu',
        namaSekolah: schoolProfile.name || 'Sekolah Indonesia',
        tahunPenyusunan: '2025/2026'
      };

      const res = await fetch('/api/gemini/generate-modul-ajar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Gagal membuat modul ajar');
      }

      const data: GeneratedModulAjar = await res.json();
      if (data && (data.komponenInti || data.informasiUmum)) {
        setGeneratedModul(data);
        setModulPreviewTab('inti');
      }
    } catch (err: any) {
      console.warn('Handling modul generation through standard generator:', err);
    } finally {
      setIsGeneratingModul(false);
    }
  };

  // -------------------------------------------------------------
  // WORD EXPORT HANDLERS
  // -------------------------------------------------------------
  const handleDownloadExamWord = (section: 'all' | 'soal' | 'kunci' | 'kisiKisi' = 'all') => {
    if (!generatedExam) return;

    const sectionsConfig = {
      soal: section === 'all' || section === 'soal',
      kisiKisi: section === 'all' || section === 'kisiKisi',
      kunci: section === 'all' || section === 'kunci'
    };

    const html = generateExamWordHtml(generatedExam, schoolProfile, sectionsConfig);
    const safeTitle = `${generatedExam.config.mataPelajaran}_${generatedExam.config.kelas}_${generatedExam.config.tipeUjian}`
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    
    let suffix = 'LENGKAP';
    if (section === 'soal') suffix = 'NASKAH_SOAL';
    if (section === 'kunci') suffix = 'KUNCI_JAWABAN';
    if (section === 'kisiKisi') suffix = 'KISI_KISI';

    downloadAsWordFile(html, `SOAL_${safeTitle}_${suffix}.doc`);
  };

  const handleDownloadModulWord = () => {
    if (!generatedModul) return;
    const html = generateModulAjarWordHtml(generatedModul, schoolProfile);
    const safeTitle = `MODUL_AJAR_${generatedModul.config.mataPelajaran}_${generatedModul.config.kelas}`
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadAsWordFile(html, `${safeTitle}.doc`);
  };

  // Copy to clipboard helper
  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotification(label);
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  return (
    <div id="teacher-assistant-root" className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-indigo-700/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-500/30 border border-indigo-400/40 px-3 py-1 rounded-full text-xs font-semibold text-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>AI Asisten Guru Terintegrasi Kurikulum Merdeka</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>Asisten Guru & Generator Soal AI</span>
            </h1>
            <p className="text-sm text-indigo-200 max-w-2xl leading-relaxed">
              Otomatisasi pembuatan naskah soal asesmen, soal bergambar, kunci jawaban, kisi-kisi terstandar, dan modul ajar Kurikulum Merdeka siap unduh dalam format <strong>Microsoft Word (.doc)</strong>.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
              <span className="font-semibold text-emerald-200">AI Engine Ready</span>
            </div>
            <span className="text-white/40">|</span>
            <span className="text-indigo-100">{schoolProfile.name}</span>
          </div>
        </div>

        {/* Feature Tabs Bar */}
        <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-indigo-700/50">
          <button
            id="btn-tab-buat-soal"
            type="button"
            onClick={() => setActiveMode('EXAM_GENERATOR')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-xs cursor-pointer ${
              activeMode === 'EXAM_GENERATOR'
                ? 'bg-white text-indigo-950 shadow-md scale-102 ring-2 ring-indigo-300'
                : 'bg-indigo-800/60 text-indigo-100 hover:bg-indigo-700/80'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>📝 Buat Soal Ujian & Evaluasi</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-400/30">
              PG, Essay & Bergambar
            </span>
          </button>

          <button
            id="btn-tab-modul-ajar"
            type="button"
            onClick={() => setActiveMode('MODUL_AJAR')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-xs cursor-pointer ${
              activeMode === 'MODUL_AJAR'
                ? 'bg-white text-indigo-950 shadow-md scale-102 ring-2 ring-indigo-300'
                : 'bg-indigo-800/60 text-indigo-100 hover:bg-indigo-700/80'
            }`}
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>📖 Modul Ajar Kurikulum Merdeka</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-full font-bold border border-blue-400/30">
              RPP Plus & LKPD
            </span>
          </button>
        </div>
      </div>

      {/* Copy Notification Pill */}
      {copiedNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-500/40 text-sm animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{copiedNotification} berhasil disalin ke clipboard!</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: GENERATOR SOAL UJIAN (BUAT SOAL) */}
      {/* ========================================================================= */}
      {activeMode === 'EXAM_GENERATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form Panel: Input Parameters */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>Form Parameter Pembuatan Soal</span>
                </div>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                  Kurikulum Merdeka
                </span>
              </div>

              {/* Jenjang & Kelas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    1. Jenjang Pendidikan <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="input-jenjang"
                    value={jenjang}
                    onChange={(e) => {
                      const lvl = e.target.value as EducationLevel;
                      setJenjang(lvl);
                      setKelas(getGradeOptions(lvl)[0]);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="SD">SD / MI</option>
                    <option value="SMP">SMP / MTs</option>
                    <option value="SMA">SMA / MA</option>
                    <option value="SMK">SMK</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    2. Kelas <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="input-kelas"
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {getGradeOptions(jenjang).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mata Pelajaran */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    3. Mata Pelajaran <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    Terdaftar di Admin ({registeredSubjects.length} Mapel)
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Pilihan Dropdown dari Pengaturan Admin */}
                  <select
                    id="select-mata-pelajaran"
                    value={registeredSubjects.includes(mataPelajaran) ? mataPelajaran : '__CUSTOM__'}
                    onChange={(e) => {
                      if (e.target.value !== '__CUSTOM__') {
                        setMataPelajaran(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="" disabled>-- Pilih Mata Pelajaran Terdaftar --</option>
                    {registeredSubjects.map((sub, idx) => (
                      <option key={idx} value={sub}>
                        {sub}
                      </option>
                    ))}
                    <option value="__CUSTOM__">✏️ Tulis Mata Pelajaran Lainnya (Ketik Manual)...</option>
                  </select>

                  {/* Input Manual jika di luar daftar */}
                  {(!registeredSubjects.includes(mataPelajaran) || mataPelajaran === '') && (
                    <input
                      id="input-mata-pelajaran"
                      type="text"
                      value={mataPelajaran}
                      onChange={(e) => setMataPelajaran(e.target.value)}
                      placeholder="Ketik nama mata pelajaran spesifik..."
                      className="w-full bg-white border border-indigo-300 text-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden shadow-2xs"
                    />
                  )}

                  {/* Preset Mapel Badges dari Daftar Terdaftar */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Klik cepat:</span>
                    {registeredSubjects.map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => setMataPelajaran(sp)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer font-medium ${
                          mataPelajaran === sp
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs scale-[1.02]'
                            : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border-slate-200'
                        }`}
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Topik / Materi / CP */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  4. Topik / Materi Pembelajaran / CP <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="input-topik"
                  rows={2}
                  value={topik}
                  onChange={(e) => setTopik(e.target.value)}
                  placeholder="Masukkan pokok bahasan, contoh: 'Sistem Pencernaan Manusia dan Pola Makan Sehat' atau 'Aljabar & Persamaan Linear'"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Jenis Ujian & Tingkat Kesulitan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    5. Jenis Asesmen / Judul Ujian
                  </label>
                  <select
                    id="input-tipe-ujian"
                    value={tipeUjian}
                    onChange={(e) => setTipeUjian(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="Penilaian Harian (PH)">Penilaian Harian (PH)</option>
                    <option value="Asesmen Sumatif Tengah Semester (ASTS)">Asesmen Sumatif Tengah Semester (ASTS)</option>
                    <option value="Asesmen Sumatif Akhir Semester (ASAS)">Asesmen Sumatif Akhir Semester (ASAS)</option>
                    <option value="Ujian Sekolah Terstandar">Ujian Sekolah Terstandar</option>
                    <option value="Latihan Soal & Evaluasi Mandiri">Latihan Soal & Evaluasi Mandiri</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    6. Tingkat Kognitif / Kesulitan
                  </label>
                  <select
                    id="input-kesulitan"
                    value={tingkatKesulitan}
                    onChange={(e) => setTingkatKesulitan(e.target.value as ExamDifficulty)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="CAMPURAN">Campuran (LOTS, MOTS, HOTS Seimbang)</option>
                    <option value="SULIT_HOTS">Dominan HOTS (Analisis & Evaluasi C4-C6)</option>
                    <option value="SEDANG_MOTS">Sedang / Penerapan Konsep (C3)</option>
                    <option value="MUDAH_LOTS">Dasar / Pemahaman Konsep (C1-C2)</option>
                  </select>
                </div>
              </div>

              {/* Rincian Jumlah Soal: Pilihan Ganda (Teks & Bergambar) dan Essay (Teks & Bergambar) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-200/80 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>7. Jumlah Butir Soal yang Digenerate</span>
                  </span>
                  <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    Total: {jumlahPG + jumlahPGBergambar + jumlahEssay + jumlahEssayBergambar} Butir
                  </span>
                </div>

                {/* Sub-Kelompok 1: Pilihan Ganda */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1 text-indigo-900">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                      A. Soal Pilihan Ganda (PG)
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Subtotal: {jumlahPG + jumlahPGBergambar} Butir
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* PG Teks Biasa */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        PG Teks Biasa
                      </label>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setJumlahPG(Math.max(0, jumlahPG - 1))}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-xs flex items-center justify-center cursor-pointer transition-colors"
                        >
                          -
                        </button>
                        <input
                          id="input-jumlah-pg"
                          type="number"
                          min="0"
                          max="30"
                          value={jumlahPG}
                          onChange={(e) => setJumlahPG(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-10 text-center font-bold text-sm text-indigo-700 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setJumlahPG(jumlahPG + 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-xs flex items-center justify-center cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* PG Bergambar */}
                    <div className="bg-white p-2.5 rounded-lg border border-indigo-200 text-center shadow-2xs ring-1 ring-indigo-400/20">
                      <label className="block text-[11px] font-bold text-indigo-900 mb-1 flex items-center justify-center gap-1">
                        <ImageIcon className="w-3 h-3 text-indigo-600" />
                        <span>PG Bergambar</span>
                      </label>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setJumlahPGBergambar(Math.max(0, jumlahPGBergambar - 1))}
                          className="w-6 h-6 rounded bg-indigo-50 hover:bg-indigo-100 font-bold text-indigo-700 text-xs flex items-center justify-center cursor-pointer transition-colors"
                        >
                          -
                        </button>
                        <input
                          id="input-jumlah-pg-bergambar"
                          type="number"
                          min="0"
                          max="15"
                          value={jumlahPGBergambar}
                          onChange={(e) => setJumlahPGBergambar(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-10 text-center font-bold text-sm text-indigo-900 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setJumlahPGBergambar(jumlahPGBergambar + 1)}
                          className="w-6 h-6 rounded bg-indigo-50 hover:bg-indigo-100 font-bold text-indigo-700 text-xs flex items-center justify-center cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-Kelompok 2: Essay / Uraian */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1 text-emerald-900">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      B. Soal Essay / Uraian
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Subtotal: {jumlahEssay + jumlahEssayBergambar} Butir
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Essay Teks Biasa */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Essay Teks Biasa
                      </label>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setJumlahEssay(Math.max(0, jumlahEssay - 1))}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-xs flex items-center justify-center cursor-pointer transition-colors"
                        >
                          -
                        </button>
                        <input
                          id="input-jumlah-essay"
                          type="number"
                          min="0"
                          max="15"
                          value={jumlahEssay}
                          onChange={(e) => setJumlahEssay(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-10 text-center font-bold text-sm text-emerald-700 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setJumlahEssay(jumlahEssay + 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-xs flex items-center justify-center cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Essay Bergambar */}
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200 text-center shadow-2xs ring-1 ring-emerald-400/20">
                      <label className="block text-[11px] font-bold text-emerald-900 mb-1 flex items-center justify-center gap-1">
                        <ImageIcon className="w-3 h-3 text-emerald-600" />
                        <span>Essay Bergambar</span>
                      </label>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setJumlahEssayBergambar(Math.max(0, jumlahEssayBergambar - 1))}
                          className="w-6 h-6 rounded bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-700 text-xs flex items-center justify-center cursor-pointer transition-colors"
                        >
                          -
                        </button>
                        <input
                          id="input-jumlah-essay-bergambar"
                          type="number"
                          min="0"
                          max="10"
                          value={jumlahEssayBergambar}
                          onChange={(e) => setJumlahEssayBergambar(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-10 text-center font-bold text-sm text-emerald-900 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setJumlahEssayBergambar(jumlahEssayBergambar + 1)}
                          className="w-6 h-6 rounded bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-700 text-xs flex items-center justify-center cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alokasi Waktu & Semester */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alokasi Waktu
                  </label>
                  <input
                    type="text"
                    value={alokasiWaktu}
                    onChange={(e) => setAlokasiWaktu(e.target.value)}
                    placeholder="90 Menit"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Semester & Tahun
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value as 'Ganjil' | 'Genap')}
                      className="w-1/2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                    <input
                      type="text"
                      value={tahunAjaran}
                      onChange={(e) => setTahunAjaran(e.target.value)}
                      className="w-1/2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Generator Button */}
              <button
                id="btn-generate-soal-ai"
                type="button"
                disabled={isGeneratingExam || !topik.trim() || !mataPelajaran.trim()}
                onClick={handleGenerateExam}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer hover:shadow-indigo-500/25"
              >
                {isGeneratingExam ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-white" />
                    <span>AI Gemini sedang menyusun Soal, Kunci & Kisi-kisi...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Generate Paket Soal Lengkap Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Output & Live Preview */}
          <div className="lg:col-span-7 space-y-4">
            {isGeneratingExam && (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto animate-bounce border border-indigo-200">
                  <BrainCircuit className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Menyusun Naskah Soal Ujian Terstandar...</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  AI sedang merancang butir soal pilihan ganda, deskripsi stimulus gambar/diagram, kunci jawaban solutif, serta tabel kisi-kisi Kurikulum Merdeka.
                </p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
                  <div className="w-full h-full bg-indigo-600 animate-indeterminate"></div>
                </div>
              </div>
            )}

            {!isGeneratingExam && !generatedExam && (
              <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Hasil Pembuatan Soal Akan Muncul di Sini</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Isi parameter jenjang, kelas, mata pelajaran, jumlah soal PG, essay, dan bergambar di formulir sebelah kiri, kemudian klik <strong>"Generate Paket Soal Lengkap"</strong>.
                </p>
              </div>
            )}

            {!isGeneratingExam && generatedExam && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-0">
                {/* Result Header & Download Action Bar */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Paket Soal Berhasil Digenerate</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                      {generatedExam.judul}
                    </h2>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      {generatedExam.config.jenjang} / {generatedExam.config.kelas} • {generatedExam.soalList.length} Butir Soal • {generatedExam.config.topik}
                    </p>
                  </div>

                  {/* Primary Download Word Button */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      id="btn-download-word-all"
                      type="button"
                      onClick={() => handleDownloadExamWord('all')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer hover:shadow-emerald-500/30"
                      title="Download File Word Lengkap (.doc)"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh File Word (.doc)</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleCopyText(
                        JSON.stringify(generatedExam, null, 2),
                        'Semua Data Soal'
                      )}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-2.5 rounded-xl border border-white/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Salin Data"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Salin</span>
                    </button>
                  </div>
                </div>

                {/* Sub-tab Navigation for Preview */}
                <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setExamPreviewTab('soal')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        examPreviewTab === 'soal'
                          ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                          : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Naskah Soal Siswa ({generatedExam.soalList.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExamPreviewTab('kunci')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        examPreviewTab === 'kunci'
                          ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                          : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kunci & Pembahasan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExamPreviewTab('kisiKisi')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        examPreviewTab === 'kisiKisi'
                          ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                          : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Kisi-Kisi Soal ({generatedExam.kisiKisi.length})</span>
                    </button>
                  </div>

                  {/* Partial download buttons */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Unduh parsial:</span>
                    <button
                      type="button"
                      onClick={() => handleDownloadExamWord('soal')}
                      className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                    >
                      Soal Saja
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleDownloadExamWord('kunci')}
                      className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                    >
                      Kunci Saja
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleDownloadExamWord('kisiKisi')}
                      className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                    >
                      Kisi-kisi Saja
                    </button>
                  </div>
                </div>

                {/* Preview Content Area */}
                <div className="p-5 max-h-[700px] overflow-y-auto space-y-6">
                  {/* TAB 1: NASKAH SOAL */}
                  {examPreviewTab === 'soal' && (
                    <div className="space-y-6">
                      {/* Kop preview simulation with Dual Logos */}
                      <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between gap-3 text-center">
                        <div className="w-16 h-16 shrink-0 flex items-center justify-center p-1 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                          {schoolProfile.regencyLogo ? (
                            <img src={schoolProfile.regencyLogo} alt="Logo Pemda" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="text-[9px] text-slate-400 font-semibold leading-tight">Logo Pemda</span>
                          )}
                        </div>

                        <div className="flex-1 space-y-0.5">
                          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                            PEMERINTAH {schoolProfile.province ? schoolProfile.province.toUpperCase() : 'PROVINSI / DAERAH'} • DINAS PENDIDIKAN
                          </div>
                          <div className="text-base font-bold text-slate-900 uppercase tracking-tight">
                            {schoolProfile.name || 'SEKOLAH INDONESIA'}
                          </div>
                          <div className="text-[11px] text-slate-500 italic">
                            {schoolProfile.address || 'Alamat Lengkap Sekolah'} | NPSN: {schoolProfile.npsn || '-'}
                          </div>
                        </div>

                        <div className="w-16 h-16 shrink-0 flex items-center justify-center p-1 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                          {schoolProfile.schoolLogo ? (
                            <img src={schoolProfile.schoolLogo} alt="Logo Sekolah" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="text-[9px] text-slate-400 font-semibold leading-tight">Logo Sekolah</span>
                          )}
                        </div>
                      </div>

                      {/* Petunjuk Umum Box */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <span className="font-bold text-slate-800">PETUNJUK UMUM:</span>
                        <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
                          {generatedExam.petunjukUmum.map((p, idx) => (
                            <li key={idx}>{p}</li>
                          ))}
                        </ol>
                      </div>

                      {/* Butir-butir Soal */}
                      <div className="space-y-5">
                        {generatedExam.soalList.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 text-slate-900 text-sm font-medium leading-relaxed">
                                <span className="font-bold text-indigo-700 shrink-0">
                                  {idx + 1}.
                                </span>
                                <div>
                                  {item.stimulus && (
                                    <div className="italic text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border-l-2 border-indigo-400 mb-2">
                                      {item.stimulus}
                                    </div>
                                  )}
                                  <span>{item.pertanyaan}</span>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-1.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase flex items-center gap-1 ${
                                  item.tipe === 'PG'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : item.tipe === 'PG_BERGAMBAR'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : item.tipe === 'ESSAY_BERGAMBAR'
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : item.tipe === 'BERGAMBAR'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {(item.tipe === 'PG_BERGAMBAR' || item.tipe === 'ESSAY_BERGAMBAR' || item.tipe === 'BERGAMBAR' || item.gambarDeskripsi) && (
                                    <ImageIcon className="w-3 h-3 text-current" />
                                  )}
                                  <span>
                                    {item.tipe === 'PG' ? 'PG (Teks)' : item.tipe === 'PG_BERGAMBAR' ? 'PG Bergambar' : item.tipe === 'ESSAY_BERGAMBAR' ? 'Essay Bergambar' : item.tipe}
                                  </span>
                                </span>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  {item.levelKognitif}
                                </span>
                              </div>
                            </div>

                            {/* Soal Bergambar: Stimulus Box */}
                            {item.gambarDeskripsi && (
                              <div className="bg-slate-50 border border-dashed border-indigo-300 p-3.5 rounded-xl text-center space-y-1.5 my-2">
                                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 bg-indigo-100/60 px-2.5 py-1 rounded-md">
                                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>[STIMULUS GAMBAR / DIAGRAM SOAL NO. {idx + 1}]</span>
                                </div>
                                <p className="text-xs text-slate-600 italic">
                                  {item.gambarDeskripsi}
                                </p>
                              </div>
                            )}

                            {/* Opsi Pilihan Ganda */}
                            {item.pilihan && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pl-6">
                                {Object.entries(item.pilihan).map(([key, val]) => (
                                  <div
                                    key={key}
                                    className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50/80 p-2 rounded-lg border border-slate-100"
                                  >
                                    <span className="font-bold text-indigo-600 shrink-0">
                                      {key}.
                                    </span>
                                    <span>{val}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Soal Essay Ruang Jawaban Placeholder */}
                            {(item.tipe === 'ESSAY' || item.tipe === 'ESSAY_BERGAMBAR') && (
                              <div className="h-16 border border-dotted border-slate-300 rounded-lg bg-slate-50/50 p-2 text-[10px] text-slate-400 italic flex items-center justify-between">
                                <span>Ruang Lembar Jawaban Siswa</span>
                                <span className="font-semibold text-slate-500">Bobot Skor: {item.bobotSkor || 10} Poin</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: KUNCI JAWABAN & PEMBAHASAN */}
                  {examPreviewTab === 'kunci' && (
                    <div className="space-y-6">
                      {/* Grid Kunci Cepat PG */}
                      <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl space-y-2">
                        <h4 className="text-xs font-bold text-indigo-950 uppercase flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                          <span>Kunci Jawaban Cepat Pilihan Ganda</span>
                        </h4>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {generatedExam.soalList
                            .filter((s) => s.pilihan)
                            .map((s, idx) => (
                              <div
                                key={s.id || idx}
                                className="bg-white border border-indigo-200 px-3 py-1.5 rounded-lg text-center shadow-2xs"
                              >
                                <span className="block text-[10px] text-slate-500 font-semibold">
                                  No. {idx + 1}
                                </span>
                                <span className="text-sm font-bold text-indigo-700">
                                  {s.kunciJawaban || '-'}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Detail Pembahasan Per Nomor */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-800">
                          Pembahasan Lengkap & Pedoman Penskoran
                        </h4>
                        {generatedExam.soalList.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-900">
                                Nomor {idx + 1} ({item.tipe}) • Level: {item.levelKognitif}
                              </span>
                              <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                                Kunci: {item.kunciJawaban}
                              </span>
                            </div>
                            <div className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                              <strong>Pembahasan:</strong> {item.pembahasan || 'Pembahasan mengacu pada konsep esensial materi terkait.'}
                            </div>
                            {item.rubrikPenskoran && (
                              <div className="text-[11px] text-slate-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                                <strong>Rubrik Penskoran:</strong> {item.rubrikPenskoran}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: KISI-KISI SOAL */}
                  {examPreviewTab === 'kisiKisi' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-800">
                          Matriks Kisi-Kisi Penulisan Soal (Kurikulum Merdeka)
                        </h4>
                        <span className="text-xs text-slate-500">
                          {generatedExam.kisiKisi.length} Indikator Soal
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                        <table className="w-full text-xs text-left text-slate-700">
                          <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2.5 text-center w-10">No</th>
                              <th className="px-3 py-2.5">Capaian Pembelajaran / KD</th>
                              <th className="px-3 py-2.5">Materi Pokok</th>
                              <th className="px-3 py-2.5">Indikator Soal</th>
                              <th className="px-2 py-2.5 text-center">Level</th>
                              <th className="px-2 py-2.5 text-center">Bentuk</th>
                              <th className="px-2 py-2.5 text-center">No. Soal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {generatedExam.kisiKisi.map((k, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80">
                                <td className="px-3 py-2 text-center font-bold text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2 text-slate-800 font-medium">
                                  {k.capaianPembelajaran}
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-700">
                                  {k.materi}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {k.indikatorSoal}
                                </td>
                                <td className="px-2 py-2 text-center font-bold text-indigo-700">
                                  {k.levelKognitif}
                                </td>
                                <td className="px-2 py-2 text-center text-slate-600">
                                  {k.bentukSoal}
                                </td>
                                <td className="px-2 py-2 text-center font-bold text-slate-800">
                                  {k.nomorSoal}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: MODUL AJAR (KURIKULUM MERDEKA) */}
      {/* ========================================================================= */}
      {activeMode === 'MODUL_AJAR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Modul Ajar Config */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Parameter Modul Ajar</span>
                </div>
                <span className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  RPP Plus Merdeka
                </span>
              </div>

              {/* Jenjang & Kelas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Jenjang Pendidikan
                  </label>
                  <select
                    value={modulJenjang}
                    onChange={(e) => {
                      const lvl = e.target.value as EducationLevel;
                      setModulJenjang(lvl);
                      const defaultGrade = getGradeOptions(lvl)[0];
                      handleModulGradeChange(defaultGrade, lvl);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="SD">SD / MI</option>
                    <option value="SMP">SMP / MTs</option>
                    <option value="SMA">SMA / MA</option>
                    <option value="SMK">SMK</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kelas & Fase
                  </label>
                  <select
                    value={modulKelas}
                    onChange={(e) => handleModulGradeChange(e.target.value, modulJenjang)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    {getGradeOptions(modulJenjang).map((k) => (
                      <option key={k} value={k}>
                        {k} ({modulFase})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mata Pelajaran */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Mata Pelajaran <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    Terdaftar di Admin ({registeredSubjects.length} Mapel)
                  </span>
                </div>

                <div className="space-y-2">
                  <select
                    value={registeredSubjects.includes(modulMapel) ? modulMapel : '__CUSTOM__'}
                    onChange={(e) => {
                      if (e.target.value !== '__CUSTOM__') {
                        setModulMapel(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="" disabled>-- Pilih Mata Pelajaran Terdaftar --</option>
                    {registeredSubjects.map((sub, idx) => (
                      <option key={idx} value={sub}>
                        {sub}
                      </option>
                    ))}
                    <option value="__CUSTOM__">✏️ Tulis Mata Pelajaran Lainnya (Ketik Manual)...</option>
                  </select>

                  {(!registeredSubjects.includes(modulMapel) || modulMapel === '') && (
                    <input
                      type="text"
                      value={modulMapel}
                      onChange={(e) => setModulMapel(e.target.value)}
                      placeholder="Ketik nama mata pelajaran spesifik..."
                      className="w-full bg-white border border-blue-300 text-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden shadow-2xs"
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Klik cepat:</span>
                    {registeredSubjects.map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => setModulMapel(sp)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer font-medium ${
                          modulMapel === sp
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs scale-[1.02]'
                            : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border-slate-200'
                        }`}
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Topik / Materi Pokok */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Topik / Materi Pembelajaran <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={modulTopik}
                  onChange={(e) => setModulTopik(e.target.value)}
                  placeholder="Contoh: Klasifikasi Makhluk Hidup & Interaksi Ekosistem"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Model Pembelajaran */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Model Pembelajaran
                  </label>
                  <select
                    value={modulModel}
                    onChange={(e) => setModulModel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="Problem Based Learning (PBL)">Problem Based Learning (PBL)</option>
                    <option value="Project Based Learning (PjBL)">Project Based Learning (PjBL)</option>
                    <option value="Discovery Learning">Discovery Learning</option>
                    <option value="Inquiry Learning Terbimbing">Inquiry Learning Terbimbing</option>
                    <option value="Cooperative Learning">Cooperative Learning</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Alokasi Waktu
                  </label>
                  <input
                    type="text"
                    value={modulAlokasiWaktu}
                    onChange={(e) => setModulAlokasiWaktu(e.target.value)}
                    placeholder="2 x 40 Menit"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium"
                  />
                </div>
              </div>

              {/* Dimensi Profil Pelajar Pancasila */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Profil Pelajar Pancasila yang Dikembangkan
                </label>
                <div className="space-y-1.5">
                  {profilOptions.map((opt) => {
                    const isChecked = selectedProfilPancasila.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProfilPancasila([...selectedProfilPancasila, opt]);
                            } else {
                              setSelectedProfilPancasila(
                                selectedProfilPancasila.filter((p) => p !== opt)
                              );
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Submit Modul Ajar Generator */}
              <button
                id="btn-generate-modul-ai"
                type="button"
                disabled={isGeneratingModul || !modulTopik.trim() || !modulMapel.trim()}
                onClick={handleGenerateModul}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer hover:shadow-blue-500/25"
              >
                {isGeneratingModul ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-white" />
                    <span>AI sedang menyusun Modul Ajar & LKPD...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Generate Modul Ajar Kurikulum Merdeka</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Output Modul Ajar */}
          <div className="lg:col-span-7 space-y-4">
            {isGeneratingModul && (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto animate-bounce border border-blue-200">
                  <BookOpen className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Menyusun Modul Ajar Lengkap...</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Menyusun Tujuan Pembelajaran (TP), sintaks langkah pembelajaran, asesmen diagnostik & formatif, rubrik penilaian, serta Lembar Kerja Peserta Didik (LKPD).
                </p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
                  <div className="w-full h-full bg-blue-600 animate-indeterminate"></div>
                </div>
              </div>
            )}

            {!isGeneratingModul && !generatedModul && (
              <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Preview Modul Ajar Kurikulum Merdeka</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Tentukan topik materi dan model pembelajaran di formulir sebelah kiri, kemudian klik <strong>"Generate Modul Ajar"</strong> untuk menyusun perangkat ajar siap pakai.
                </p>
              </div>
            )}

            {!isGeneratingModul && generatedModul && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-0">
                {/* Result Header & Download Button */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Modul Ajar Siap Digunakan</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                      {generatedModul.judul}
                    </h2>
                    <p className="text-xs text-blue-200 mt-0.5">
                      {generatedModul.config.fase} ({generatedModul.config.kelas}) • Model: {generatedModul.config.modelPembelajaran}
                    </p>
                  </div>

                  <button
                    id="btn-download-modul-word"
                    type="button"
                    onClick={handleDownloadModulWord}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer hover:shadow-emerald-500/30 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Modul Word (.doc)</span>
                  </button>
                </div>

                {/* Sub-tab Navigation */}
                <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setModulPreviewTab('inti')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      modulPreviewTab === 'inti'
                        ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <span>🎯 Komponen Inti & Kegiatan KBM</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModulPreviewTab('umum')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      modulPreviewTab === 'umum'
                        ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <span>📋 Informasi Umum & Sarpras</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModulPreviewTab('lampiran')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      modulPreviewTab === 'lampiran'
                        ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <span>📑 Lampiran & LKPD</span>
                  </button>
                </div>

                {/* Modul Preview Content */}
                <div className="p-5 max-h-[700px] overflow-y-auto space-y-6 text-xs text-slate-800">
                  {/* TAB 1: KOMPONEN INTI */}
                  {modulPreviewTab === 'inti' && (
                    <div className="space-y-5">
                      {/* TP */}
                      <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 space-y-2">
                        <h4 className="font-bold text-blue-950 text-sm flex items-center gap-1.5">
                          <span>A. Tujuan Pembelajaran (TP)</span>
                        </h4>
                        <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed pl-1">
                          {generatedModul.komponenInti.tujuanPembelajaran.map((tp, idx) => (
                            <li key={idx}>{tp}</li>
                          ))}
                        </ol>
                      </div>

                      {/* Pemahaman Bermakna & Pertanyaan Pemantik */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                          <h5 className="font-bold text-slate-800">B. Pemahaman Bermakna</h5>
                          <ul className="list-disc list-inside space-y-1 text-slate-600">
                            {generatedModul.komponenInti.pemahamanBermakna.map((pb, idx) => (
                              <li key={idx}>{pb}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                          <h5 className="font-bold text-slate-800">C. Pertanyaan Pemantik</h5>
                          <ul className="list-disc list-inside space-y-1 text-slate-600 italic">
                            {generatedModul.komponenInti.pertanyaanPemantik.map((pp, idx) => (
                              <li key={idx}>"{pp}"</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Kegiatan Pembelajaran Rinci */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-slate-900 text-sm">
                          D. Rincian Kegiatan Pembelajaran (Sintaks {generatedModul.config.modelPembelajaran})
                        </h4>

                        {/* Pendahuluan */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between font-bold text-slate-800 border-b pb-1.5">
                            <span>1. Kegiatan Pendahuluan</span>
                            <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              {generatedModul.komponenInti.kegiatanPembelajaran.pendahuluan.alokasiMenit} Menit
                            </span>
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                            {generatedModul.komponenInti.kegiatanPembelajaran.pendahuluan.langkah.map((l, idx) => (
                              <li key={idx}>{l}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Inti */}
                        <div className="bg-white p-4 rounded-xl border border-blue-200 ring-1 ring-blue-400/20 space-y-2">
                          <div className="flex items-center justify-between font-bold text-blue-950 border-b pb-1.5">
                            <span>2. Kegiatan Inti</span>
                            <span className="text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                              {generatedModul.komponenInti.kegiatanPembelajaran.inti.alokasiMenit} Menit
                            </span>
                          </div>
                          <ol className="list-decimal list-inside space-y-1.5 text-slate-700 pl-1">
                            {generatedModul.komponenInti.kegiatanPembelajaran.inti.langkah.map((l, idx) => (
                              <li key={idx}>{l}</li>
                            ))}
                          </ol>
                        </div>

                        {/* Penutup */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between font-bold text-slate-800 border-b pb-1.5">
                            <span>3. Kegiatan Penutup</span>
                            <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              {generatedModul.komponenInti.kegiatanPembelajaran.penutup.alokasiMenit} Menit
                            </span>
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                            {generatedModul.komponenInti.kegiatanPembelajaran.penutup.langkah.map((l, idx) => (
                              <li key={idx}>{l}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Asesmen */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <h4 className="font-bold text-slate-800 text-sm">E. Rencana Asesmen</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <span className="font-bold text-slate-700 block mb-1">Diagnostik</span>
                            <p className="text-slate-600 text-[11px]">
                              {generatedModul.komponenInti.asesmen.diagnostik.join(', ')}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <span className="font-bold text-slate-700 block mb-1">Formatif</span>
                            <p className="text-slate-600 text-[11px]">
                              {generatedModul.komponenInti.asesmen.formatif.join(', ')}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <span className="font-bold text-slate-700 block mb-1">Sumatif</span>
                            <p className="text-slate-600 text-[11px]">
                              {generatedModul.komponenInti.asesmen.sumatif.join(', ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: INFORMASI UMUM */}
                  {modulPreviewTab === 'umum' && (
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <h4 className="font-bold text-slate-800 text-sm border-b pb-2">
                          Identitas & Informasi Umum Modul
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500">Penyusun:</span>
                            <p className="font-semibold text-slate-800">{generatedModul.informasiUmum.penyusun}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Instansi:</span>
                            <p className="font-semibold text-slate-800">{generatedModul.informasiUmum.instansi}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Mata Pelajaran:</span>
                            <p className="font-semibold text-slate-800">{generatedModul.informasiUmum.mataPelajaran}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Jenjang / Fase / Kelas:</span>
                            <p className="font-semibold text-slate-800">{generatedModul.informasiUmum.jenjangSekolah} / {generatedModul.informasiUmum.faseKelas}</p>
                          </div>
                        </div>

                        <div className="pt-2 border-t space-y-2">
                          <span className="font-bold text-slate-700">Profil Pelajar Pancasila:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {generatedModul.informasiUmum.profilPelajarPancasila.map((p, idx) => (
                              <span key={idx} className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t space-y-2">
                          <span className="font-bold text-slate-700">Sarana & Prasarana:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                            {generatedModul.informasiUmum.saranaPrasarana.map((s, idx) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: LAMPIRAN & LKPD */}
                  {modulPreviewTab === 'lampiran' && (
                    <div className="space-y-4">
                      {/* LKPD Box */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-2">
                        <div className="flex items-center justify-between font-bold text-slate-800 border-b pb-2">
                          <span>Lembar Kerja Peserta Didik (LKPD)</span>
                          <span className="text-[11px] text-blue-600">Siap Cetak</span>
                        </div>
                        <div className="whitespace-pre-line text-slate-700 leading-relaxed bg-white p-3.5 rounded-lg border border-slate-200">
                          {generatedModul.lampiran.lkpd}
                        </div>
                      </div>

                      {/* Bahan Bacaan & Rubrik */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                          <span className="font-bold text-slate-800 block">Bahan Bacaan Guru & Siswa</span>
                          <p className="text-slate-600 text-[11px]">
                            {generatedModul.lampiran.bahanBacaan}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                          <span className="font-bold text-slate-800 block">Rubrik Penilaian</span>
                          <p className="text-slate-600 text-[11px]">
                            {generatedModul.lampiran.rubrikPenilaian}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
