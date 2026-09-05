import { GeneratedExamPackage, GeneratedModulAjar, SchoolProfile } from '../types';

/**
 * Downloads an HTML-formatted document as a Microsoft Word (.doc) file
 * that can be opened natively by MS Word, LibreOffice, WPS, and Google Docs.
 */
export function downloadAsWordFile(htmlContent: string, fileName: string) {
  const header = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${fileName}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4 portrait;
      margin: 2cm 2cm 2cm 2cm;
      mso-header-margin: 36pt;
      mso-footer-margin: 36pt;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.4;
      color: #000000;
      background-color: #ffffff;
    }
    h1, h2, h3, h4, h5 {
      font-family: 'Times New Roman', Times, serif;
      font-weight: bold;
      color: #000000;
      margin-top: 12pt;
      margin-bottom: 6pt;
    }
    h1 { font-size: 16pt; text-align: center; }
    h2 { font-size: 14pt; }
    h3 { font-size: 13pt; }
    p { margin-top: 0; margin-bottom: 6pt; text-align: justify; }
    
    .kop-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 3px double #000;
      margin-bottom: 14pt;
      padding-bottom: 8pt;
    }
    .kop-table td {
      border: none;
      padding: 2pt 4pt;
    }
    .kop-title {
      text-align: center;
      line-height: 1.2;
    }
    .kop-instansi { font-size: 12pt; text-transform: uppercase; font-weight: normal; }
    .kop-sekolah { font-size: 16pt; text-transform: uppercase; font-weight: bold; }
    .kop-alamat { font-size: 9.5pt; font-style: italic; color: #333; }

    .identity-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12pt;
      font-size: 11pt;
    }
    .identity-table td {
      padding: 2pt 4pt;
      vertical-align: top;
      border: none;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8pt 0 14pt 0;
      font-size: 10.5pt;
    }
    .data-table th, .data-table td {
      border: 1px solid #000;
      padding: 5pt 6pt;
      vertical-align: top;
    }
    .data-table th {
      background-color: #f2f2f2;
      font-weight: bold;
      text-align: center;
    }

    .section-title {
      font-size: 12pt;
      font-weight: bold;
      background-color: #f0f0f0;
      padding: 4pt 6pt;
      border-left: 4px solid #000;
      margin-top: 14pt;
      margin-bottom: 8pt;
    }

    .question-box {
      margin-bottom: 12pt;
      page-break-inside: avoid;
    }
    .question-stimulus {
      font-style: italic;
      background-color: #fafafa;
      border-left: 2px solid #666;
      padding: 4pt 8pt;
      margin-bottom: 4pt;
    }
    .image-box {
      border: 1px dashed #444;
      padding: 8pt;
      background-color: #fcfcfc;
      margin: 6pt 0;
      text-align: center;
      page-break-inside: avoid;
    }
    .image-tag {
      font-size: 10pt;
      font-weight: bold;
      color: #222;
      margin-bottom: 4pt;
    }
    .image-desc {
      font-size: 10pt;
      color: #444;
    }

    .options-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4pt;
      margin-left: 12pt;
    }
    .options-table td {
      border: none;
      padding: 2pt 4pt;
      vertical-align: top;
    }

    .page-break {
      page-break-before: always;
      mso-break-type: page-break;
    }

    .sig-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 24pt;
      page-break-inside: avoid;
    }
    .sig-table td {
      border: none;
      text-align: center;
      vertical-align: top;
      width: 50%;
      padding: 0 10pt;
    }
  </style>
</head>
<body>
`;

  const footer = `
</body>
</html>`;

  const completeHtml = header + htmlContent + footer;
  const blob = new Blob(['\ufeff' + completeHtml], {
    type: 'application/msword;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.doc') ? fileName : `${fileName}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper to generate official Indonesian school letterhead (KOP Surat) with
 * Logo Kabupaten / Pemda on the top-left and Logo Sekolah on the top-right.
 */
function generateOfficialKopHtml(schoolProfile: SchoolProfile): string {
  const regencyLogoHtml = schoolProfile.regencyLogo
    ? `<td width="80" align="center" style="vertical-align:middle; text-align:center; padding: 2pt 4pt;">
        <img src="${schoolProfile.regencyLogo}" width="70" height="70" alt="Logo Pemkab" style="object-fit:contain; max-width:70px; max-height:70px;" />
       </td>`
    : `<td width="80" align="center" style="vertical-align:middle; text-align:center; padding: 2pt 4pt;">
        <div style="width:65px; height:65px; border:1px dashed #bbb; font-size:7.5pt; color:#666; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1;">Logo Pemda / Kab</div>
       </td>`;

  const schoolLogoHtml = schoolProfile.schoolLogo
    ? `<td width="80" align="center" style="vertical-align:middle; text-align:center; padding: 2pt 4pt;">
        <img src="${schoolProfile.schoolLogo}" width="70" height="70" alt="Logo Sekolah" style="object-fit:contain; max-width:70px; max-height:70px;" />
       </td>`
    : `<td width="80" align="center" style="vertical-align:middle; text-align:center; padding: 2pt 4pt;">
        <div style="width:65px; height:65px; border:1px dashed #bbb; font-size:7.5pt; color:#666; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1;">Logo Sekolah</div>
       </td>`;

  const provinceStr = (schoolProfile.province || 'DKI JAKARTA').toUpperCase();
  const regencyStr = (schoolProfile.regency || 'KOTA / KABUPATEN').toUpperCase();

  return `
    <!-- KOP RESMI SEKOLAH (LOGO KABUPATEN KIRI & LOGO SEKOLAH KANAN) -->
    <table class="kop-table" style="width:100%; border-collapse:collapse; border-bottom:3px double #000; margin-bottom:14pt; padding-bottom:8pt;">
      <tr>
        ${regencyLogoHtml}
        <td class="kop-title" style="text-align:center; vertical-align:middle; padding: 2pt 8pt;">
          <div style="font-size:11pt; text-transform:uppercase; font-weight:normal; letter-spacing:0.5px;">PEMERINTAH ${provinceStr}</div>
          <div style="font-size:11.5pt; text-transform:uppercase; font-weight:bold; letter-spacing:0.5px;">DINAS PENDIDIKAN ${regencyStr}</div>
          <div style="font-size:15pt; text-transform:uppercase; font-weight:bold; margin:2pt 0; letter-spacing:0.5px; color:#000;">${schoolProfile.name || 'SEKOLAH MENENGAH PERTAMA'}</div>
          <div style="font-size:9pt; font-style:italic; color:#222; line-height:1.3;">
            ${schoolProfile.address || 'Alamat Lengkap Sekolah'}${schoolProfile.district ? `, ${schoolProfile.district}` : ''}${schoolProfile.regency ? `, ${schoolProfile.regency}` : ''}
          </div>
          <div style="font-size:8.5pt; color:#333; margin-top:2pt;">
            NPSN: ${schoolProfile.npsn || '-'} | Telp: ${schoolProfile.phone || '-'} | Email: ${schoolProfile.email || '-'}
          </div>
        </td>
        ${schoolLogoHtml}
      </tr>
    </table>
  `;
}

/**
 * Builds HTML for Exam Package (Naskah Soal, Kisi-kisi, & Kunci Jawaban)
 */
export function generateExamWordHtml(
  exam: GeneratedExamPackage,
  schoolProfile: SchoolProfile,
  includeSections: { soal: boolean; kisiKisi: boolean; kunci: boolean } = { soal: true, kisiKisi: true, kunci: true }
): string {
  const { config, soalList, kisiKisi, petunjukUmum } = exam;

  // Filter questions by type
  const pgList = soalList.filter(s => s.tipe === 'PG' || s.tipe === 'PG_BERGAMBAR');
  const bergambarList = soalList.filter(s => s.tipe === 'BERGAMBAR');
  const essayList = soalList.filter(s => s.tipe === 'ESSAY' || s.tipe === 'ESSAY_BERGAMBAR');

  let html = '';

  // 1. NASKAH SOAL SECTION
  if (includeSections.soal) {
    html += `
      ${generateOfficialKopHtml(schoolProfile)}

      <h1>${exam.judul.toUpperCase()}</h1>
      <p style="text-align:center; font-weight:bold; margin-top:-6pt; margin-bottom:12pt;">
        TAHUN AJARAN ${config.tahunAjaran || '2025/2026'} - SEMESTER ${config.semester ? config.semester.toUpperCase() : 'GANJIL'}
      </p>

      <!-- LEMBAR IDENTITAS SOAL -->
      <table class="identity-table" style="border-top:1px solid #000; border-bottom:1px solid #000; padding: 4pt 0;">
        <tr>
          <td width="20%"><strong>Mata Pelajaran</strong></td>
          <td width="30%">: ${config.mataPelajaran}</td>
          <td width="20%"><strong>Hari, Tanggal</strong></td>
          <td width="30%">: .......................................</td>
        </tr>
        <tr>
          <td><strong>Jenjang / Kelas</strong></td>
          <td>: ${config.jenjang} / ${config.kelas}</td>
          <td><strong>Waktu</strong></td>
          <td>: ${config.alokasiWaktu || '90 Menit'}</td>
        </tr>
        <tr>
          <td><strong>Topik / Materi</strong></td>
          <td>: ${config.topik}</td>
          <td><strong>Nama Guru</strong></td>
          <td>: ${config.namaGuru || schoolProfile.principalName || 'Guru Pengampu'}</td>
        </tr>
      </table>

      <!-- PETUNJUK UMUM -->
      <div style="background-color:#f9f9f9; border:1px solid #ddd; padding:6pt 10pt; margin-bottom:14pt; font-size:10.5pt;">
        <strong>PETUNJUK UMUM:</strong>
        <ol style="margin:2pt 0 2pt 16pt; padding:0;">
          ${(petunjukUmum && petunjukUmum.length > 0 ? petunjukUmum : [
            'Tulislah nama, nomor peserta, dan kelas Anda pada lembar jawaban yang tersedia.',
            'Periksa dan bacalah setiap butir soal dengan teliti sebelum Anda menjawabnya.',
            'Laporkan kepada pengawas ujian apabila terdapat lembar soal yang kurang jelas, rusak, atau tidak lengkap.',
            'Dahulukan menjawab soal-soal yang Anda anggap mudah.',
            'Periksalah kembali seluruh pekerjaan Anda sebelum diserahkan kepada pengawas.'
          ]).map(p => `<li>${p}</li>`).join('')}
        </ol>
      </div>
    `;

    // A. SOAL PILIHAN GANDA
    if (pgList.length > 0) {
      html += `
        <div class="section-title">A. SOAL PILIHAN GANDA</div>
        <p><em>Petunjuk: Pilihlah salah satu jawaban yang paling tepat dengan memberikan tanda silang (X) atau menghitamkan bulatan pada huruf A, B, C, D, atau E di lembar jawaban!</em></p>
      `;

      pgList.forEach((item, idx) => {
        const qNum = idx + 1;
        html += `
          <div class="question-box">
            <p><strong>${qNum}.</strong> ${item.stimulus ? `<span class="question-stimulus">${item.stimulus}</span><br/>` : ''}${item.pertanyaan}</p>
            ${item.gambarDeskripsi ? `
              <div class="image-box">
                <div class="image-tag">🖼️ [STIMULUS GAMBAR / DIAGRAM SOAL NO. ${qNum}]</div>
                <div class="image-desc">${item.gambarDeskripsi}</div>
              </div>
            ` : ''}
            ${item.pilihan ? `
              <table class="options-table">
                ${Object.entries(item.pilihan).map(([key, val]) => `
                  <tr>
                    <td width="24" valign="top"><strong>${key}.</strong></td>
                    <td valign="top">${val}</td>
                  </tr>
                `).join('')}
              </table>
            ` : ''}
          </div>
        `;
      });
    }

    // B. SOAL BERGAMBAR (LEGACY / KHUSUS STIMULUS VISUAL JIKA ADA)
    if (bergambarList.length > 0) {
      html += `
        <div class="section-title">B. SOAL BERBASIS GAMBAR / DIAGRAM / STIMULUS VISUAL</div>
        <p><em>Petunjuk: Cermati gambar, grafik, diagram, atau ilustrasi di bawah ini secara seksama untuk menjawab pertanyaan berikut!</em></p>
      `;

      bergambarList.forEach((item, idx) => {
        const qNum = pgList.length + idx + 1;
        html += `
          <div class="question-box">
            <p><strong>${qNum}.</strong> ${item.stimulus ? `<span class="question-stimulus">${item.stimulus}</span><br/>` : ''}${item.pertanyaan}</p>
            <div class="image-box">
              <div class="image-tag">📊 [DIAGRAM / GAMBAR STIMULUS SOAL NO. ${qNum}]</div>
              <div class="image-desc">${item.gambarDeskripsi || 'Gambar ilustrasi pendukung materi'}</div>
            </div>
            ${item.pilihan ? `
              <table class="options-table">
                ${Object.entries(item.pilihan).map(([key, val]) => `
                  <tr>
                    <td width="24" valign="top"><strong>${key}.</strong></td>
                    <td valign="top">${val}</td>
                  </tr>
                `).join('')}
              </table>
            ` : `
              <div style="height:40pt; border-bottom:1px dashed #ccc; margin-top:8pt;"></div>
            `}
          </div>
        `;
      });
    }

    // C. SOAL ESSAY / URAIAN
    if (essayList.length > 0) {
      const sectionLetter = pgList.length > 0 && bergambarList.length > 0 ? 'C' : (pgList.length > 0 ? 'B' : 'A');
      html += `
        <div class="section-title">${sectionLetter}. SOAL ESSAY / URAIAN</div>
        <p><em>Petunjuk: Jawablah pertanyaan-pertanyaan di bawah ini secara jelas, terstruktur, dan lengkap pada lembar jawaban yang disediakan!</em></p>
      `;

      essayList.forEach((item, idx) => {
        const qNum = pgList.length + bergambarList.length + idx + 1;
        html += `
          <div class="question-box">
            <p><strong>${qNum}.</strong> ${item.stimulus ? `<span class="question-stimulus">${item.stimulus}</span><br/>` : ''}${item.pertanyaan} <em>(Bobot Skor: ${item.bobotSkor || 10})</em></p>
            ${item.gambarDeskripsi ? `
              <div class="image-box">
                <div class="image-tag">🖼️ [ILUSTRASI / BAGAN KASUS SOAL NO. ${qNum}]</div>
                <div class="image-desc">${item.gambarDeskripsi}</div>
              </div>
            ` : ''}
            <div style="height:60pt; border: 1px dotted #ccc; background-color: #fafafa; margin-top:6pt; padding:4pt; font-size:9pt; color:#999;">
              [Ruang Jawaban Siswa Nomor ${qNum}]
            </div>
          </div>
        `;
      });
    }
  }

  // 2. KISI-KISI SECTION (PAGE BREAK)
  if (includeSections.kisiKisi && kisiKisi && kisiKisi.length > 0) {
    if (includeSections.soal) {
      html += `<div class="page-break"></div>`;
    }

    html += `
      <h2 style="text-align:center;">KISI-KISI PENULISAN SOAL ASESMEN</h2>
      <p style="text-align:center; font-weight:bold; margin-top:-4pt; margin-bottom:14pt;">
        Mata Pelajaran: ${config.mataPelajaran} | Jenjang/Kelas: ${config.jenjang} / ${config.kelas} | Topik: ${config.topik}
      </p>

      <table class="data-table">
        <thead>
          <tr>
            <th width="5%">No</th>
            <th width="28%">Capaian Pembelajaran / KD</th>
            <th width="20%">Materi Pokok</th>
            <th width="27%">Indikator Soal</th>
            <th width="8%">Level Kognitif</th>
            <th width="7%">Bentuk Soal</th>
            <th width="5%">No. Soal</th>
          </tr>
        </thead>
        <tbody>
          ${kisiKisi.map((k, idx) => `
            <tr>
              <td align="center">${idx + 1}</td>
              <td>${k.capaianPembelajaran}</td>
              <td>${k.materi}</td>
              <td>${k.indikatorSoal}</td>
              <td align="center"><strong>${k.levelKognitif}</strong></td>
              <td align="center">${k.bentukSoal}</td>
              <td align="center">${k.nomorSoal}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // 3. KUNCI JAWABAN & PEMBAHASAN SECTION (PAGE BREAK)
  if (includeSections.kunci) {
    if (includeSections.soal || includeSections.kisiKisi) {
      html += `<div class="page-break"></div>`;
    }

    html += `
      <h2 style="text-align:center;">KUNCI JAWABAN, PEMBAHASAN & PEDOMAN PENSKORAN</h2>
      <p style="text-align:center; font-weight:bold; margin-top:-4pt; margin-bottom:14pt;">
        ${exam.judul} - ${config.mataPelajaran} (${config.jenjang} / ${config.kelas})
      </p>
    `;

    // KUNCI TABEL CEPAT PILIHAN GANDA
    if (pgList.length > 0) {
      html += `
        <div class="section-title">1. KUNCI JAWABAN PILIHAN GANDA</div>
        <table class="data-table" style="width: auto; margin-bottom: 12pt;">
          <thead>
            <tr>
              ${pgList.map((_, idx) => `<th width="35">${idx + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${pgList.map(item => `<td align="center" style="font-weight:bold; font-size:12pt; color:#0b57d0;">${item.kunciJawaban || '-'}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      `;
    }

    // PEMBAHASAN LENGKAP TIAP BUTIR SOAL
    html += `
      <div class="section-title">2. PEMBAHASAN LENGKAP & RUBRIK PENSKORAN</div>
    `;

    soalList.forEach((item, idx) => {
      html += `
        <div style="margin-bottom:10pt; padding:6pt 8pt; background-color:#f8fafc; border-left:3px solid #0284c7; page-break-inside:avoid;">
          <p style="margin-bottom:2pt;"><strong>No. ${idx + 1} (${item.tipe})</strong> - <em>Level: ${item.levelKognitif || 'C3'} | Bobot: ${item.bobotSkor || 1} Poin</em></p>
          <p style="margin-bottom:2pt;"><strong>Kunci Jawaban:</strong> <span style="font-weight:bold; color:#0369a1;">${item.kunciJawaban}</span></p>
          <p style="margin-bottom:2pt;"><strong>Pembahasan / Solusi:</strong> ${item.pembahasan || 'Sesuai dengan konsep dasar pembelajaran materi terkait.'}</p>
          ${item.rubrikPenskoran ? `
            <p style="margin-bottom:0; font-size:10pt; color:#475569;"><strong>Pedoman Skor:</strong> ${item.rubrikPenskoran}</p>
          ` : ''}
        </div>
      `;
    });

    // TANDA TANGAN
    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    html += `
      <table class="sig-table">
        <tr>
          <td>
            Mengetahui,<br/>
            Kepala Sekolah ${schoolProfile.name || ''}
            <br/><br/><br/><br/>
            <strong><u>${schoolProfile.principalName || '...........................................'}</u></strong><br/>
            NIP. ${schoolProfile.principalNip || '...........................................'}
          </td>
          <td>
            ${schoolProfile.address?.split(',')[0] || 'Kota Sekolah'}, ${todayStr}<br/>
            Guru Mata Pelajaran
            <br/><br/><br/><br/>
            <strong><u>${config.namaGuru || '...........................................'}</u></strong><br/>
            NIP. ...........................................
          </td>
        </tr>
      </table>
    `;
  }

  return html;
}

/**
 * Builds HTML for Kurikulum Merdeka Modul Ajar
 */
export function generateModulAjarWordHtml(
  modul: GeneratedModulAjar,
  schoolProfile: SchoolProfile
): string {
  const { config, informasiUmum, komponenInti, lampiran } = modul;

  let html = `
    ${generateOfficialKopHtml(schoolProfile)}

    <h1>MODUL AJAR KURIKULUM MERDEKA</h1>
    <h2 style="text-align:center; margin-top:-6pt; margin-bottom:14pt;">${config.mataPelajaran.toUpperCase()} - ${config.fase} (${config.kelas})</h2>

    <!-- I. INFORMASI UMUM -->
    <div class="section-title">I. INFORMASI UMUM</div>
    <table class="identity-table" style="border: 1px solid #000;">
      <tr style="background-color:#f9f9f9;">
        <td width="30%"><strong>A. Identitas Modul</strong></td>
        <td width="70%"></td>
      </tr>
      <tr>
        <td>1. Nama Penyusun</td>
        <td>: ${informasiUmum.penyusun || config.namaGuru || 'Guru Pengampu'}</td>
      </tr>
      <tr>
        <td>2. Nama Institusi</td>
        <td>: ${informasiUmum.instansi || schoolProfile.name || 'Nama Sekolah'}</td>
      </tr>
      <tr>
        <td>3. Tahun Penyusunan</td>
        <td>: ${informasiUmum.tahunPenyusunan || '2025/2026'}</td>
      </tr>
      <tr>
        <td>4. Jenjang / Fase / Kelas</td>
        <td>: ${informasiUmum.jenjangSekolah} / ${informasiUmum.faseKelas}</td>
      </tr>
      <tr>
        <td>5. Mata Pelajaran</td>
        <td>: ${informasiUmum.mataPelajaran}</td>
      </tr>
      <tr>
        <td>6. Alokasi Waktu</td>
        <td>: ${informasiUmum.alokasiWaktu}</td>
      </tr>

      <tr style="background-color:#f9f9f9;">
        <td><strong>B. Kompetensi Awal</strong></td>
        <td>
          <ul style="margin:2pt 0 2pt 14pt; padding:0;">
            ${(informasiUmum.kompetensiAwal || []).map(k => `<li>${k}</li>`).join('')}
          </ul>
        </td>
      </tr>

      <tr>
        <td><strong>C. Profil Pelajar Pancasila</strong></td>
        <td>
          <ul style="margin:2pt 0 2pt 14pt; padding:0;">
            ${(informasiUmum.profilPelajarPancasila || []).map(p => `<li><strong>${p}</strong></li>`).join('')}
          </ul>
        </td>
      </tr>

      <tr style="background-color:#f9f9f9;">
        <td><strong>D. Sarana dan Prasarana</strong></td>
        <td>
          <ul style="margin:2pt 0 2pt 14pt; padding:0;">
            ${(informasiUmum.saranaPrasarana || []).map(s => `<li>${s}</li>`).join('')}
          </ul>
        </td>
      </tr>

      <tr>
        <td><strong>E. Target Peserta Didik</strong></td>
        <td>: ${informasiUmum.targetPesertaDidik || 'Peserta didik reguler / tipikal umum'}</td>
      </tr>

      <tr style="background-color:#f9f9f9;">
        <td><strong>F. Model Pembelajaran</strong></td>
        <td>: <strong>${informasiUmum.modelPembelajaran || config.modelPembelajaran}</strong></td>
      </tr>
    </table>

    <!-- II. KOMPONEN INTI -->
    <div class="section-title">II. KOMPONEN INTI</div>

    <p><strong>A. Tujuan Pembelajaran (TP)</strong></p>
    <ol style="margin:2pt 0 8pt 16pt; padding:0;">
      ${(komponenInti.tujuanPembelajaran || []).map(tp => `<li>${tp}</li>`).join('')}
    </ol>

    <p><strong>B. Pemahaman Bermakna</strong></p>
    <ul style="margin:2pt 0 8pt 16pt; padding:0;">
      ${(komponenInti.pemahamanBermakna || []).map(pb => `<li>${pb}</li>`).join('')}
    </ul>

    <p><strong>C. Pertanyaan Pemantik</strong></p>
    <ul style="margin:2pt 0 8pt 16pt; padding:0;">
      ${(komponenInti.pertanyaanPemantik || []).map(pp => `<li><em>"${pp}"</em></li>`).join('')}
    </ul>

    <p><strong>D. Kegiatan Pembelajaran</strong></p>
    <table class="data-table">
      <thead>
        <tr>
          <th width="20%">Tahapan Kegiatan</th>
          <th width="65%">Deskripsi Langkah Pembelajaran</th>
          <th width="15%">Alokasi Waktu</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>1. Pendahuluan</strong></td>
          <td>
            <ul style="margin:0 0 0 12pt; padding:0;">
              ${(komponenInti.kegiatanPembelajaran?.pendahuluan?.langkah || []).map(l => `<li>${l}</li>`).join('')}
            </ul>
          </td>
          <td align="center"><strong>${komponenInti.kegiatanPembelajaran?.pendahuluan?.alokasiMenit || 10} Menit</strong></td>
        </tr>
        <tr>
          <td><strong>2. Kegiatan Inti</strong><br/><small><em>(Sintaks Model ${config.modelPembelajaran})</em></small></td>
          <td>
            <ol style="margin:0 0 0 12pt; padding:0;">
              ${(komponenInti.kegiatanPembelajaran?.inti?.langkah || []).map(l => `<li>${l}</li>`).join('')}
            </ol>
          </td>
          <td align="center"><strong>${komponenInti.kegiatanPembelajaran?.inti?.alokasiMenit || 70} Menit</strong></td>
        </tr>
        <tr>
          <td><strong>3. Penutup</strong></td>
          <td>
            <ul style="margin:0 0 0 12pt; padding:0;">
              ${(komponenInti.kegiatanPembelajaran?.penutup?.langkah || []).map(l => `<li>${l}</li>`).join('')}
            </ul>
          </td>
          <td align="center"><strong>${komponenInti.kegiatanPembelajaran?.penutup?.alokasiMenit || 10} Menit</strong></td>
        </tr>
      </tbody>
    </table>

    <p><strong>E. Asesmen Pembelajaran</strong></p>
    <table class="data-table">
      <thead>
        <tr>
          <th width="30%">Jenis Asesmen</th>
          <th width="40%">Bentuk Asesmen / Instrumen</th>
          <th width="30%">Keterangan</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>1. Asesmen Diagnostik (Awal)</strong></td>
          <td>${(komponenInti.asesmen?.diagnostik || ['Pertanyaan lisan apersepsi awal']).join(', ')}</td>
          <td>Non-kognitif & Kognitif sederhana</td>
        </tr>
        <tr>
          <td><strong>2. Asesmen Formatif (Proses)</strong></td>
          <td>${(komponenInti.asesmen?.formatif || ['Observasi keaktifan diskusi & LKPD']).join(', ')}</td>
          <td>Penilaian sikap & performa kerja kelompok</td>
        </tr>
        <tr>
          <td><strong>3. Asesmen Sumatif (Akhir)</strong></td>
          <td>${(komponenInti.asesmen?.sumatif || ['Tes tertulis pilihan ganda & essay']).join(', ')}</td>
          <td>Mengukur pencapaian kompetensi</td>
        </tr>
      </tbody>
    </table>

    <p><strong>F. Pengayaan dan Remedial</strong></p>
    <div style="border:1px solid #ddd; padding:6pt 8pt; margin-bottom:8pt; background-color:#fafafa;">
      <p style="margin-bottom:3pt;"><strong>• Pengayaan:</strong> ${komponenInti.pengayaanDanRemedial?.pengayaan || 'Diberikan kepada peserta didik yang telah mencapai tujuan pembelajaran berupa penugasan pendalaman materi atau studi kasus terapan.'}</p>
      <p style="margin-bottom:0;"><strong>• Remedial:</strong> ${komponenInti.pengayaanDanRemedial?.remedial || 'Diberikan kepada peserta didik yang belum tuntas melalui bimbingan perorangan atau pemanfaatan tutor sebaya pada indikator yang belum dikuasai.'}</p>
    </div>

    <!-- III. LAMPIRAN (PAGE BREAK) -->
    <div class="page-break"></div>
    <div class="section-title">III. LAMPIRAN</div>

    <p><strong>A. Lembar Kerja Peserta Didik (LKPD)</strong></p>
    <div style="border: 1px solid #000; padding: 8pt 10pt; margin-bottom: 12pt; background-color: #fff;">
      <p style="text-align:center; font-weight:bold; margin-bottom:4pt;">LEMBAR KERJA PESERTA DIDIK (LKPD)</p>
      <p style="text-align:center; font-size:10pt; margin-bottom:8pt;">Topik: ${config.topikMateri}</p>
      <div style="font-size:10.5pt; white-space:pre-line;">
        ${lampiran.lkpd || 'Petunjuk Kerja:\n1. Bentuklah kelompok yang beranggotakan 4-5 siswa.\n2. Bacalah instruksi kerja dan diskusikan bersama kelompok.\n3. Tuliskan hasil analisis pada lembar laporan.'}
      </div>
    </div>

    <p><strong>B. Bahan Bacaan Guru & Peserta Didik</strong></p>
    <div style="border: 1px solid #ddd; padding: 6pt 8pt; margin-bottom: 10pt; background-color: #fafafa; font-size: 10.5pt;">
      ${lampiran.bahanBacaan || 'Ringkasan materi inti esensial untuk mendukung ketercapaian tujuan pembelajaran peserta didik.'}
    </div>

    <p><strong>C. Rubrik Penilaian & Pedoman Penskoran</strong></p>
    <div style="border: 1px solid #ddd; padding: 6pt 8pt; margin-bottom: 10pt; background-color: #fafafa; font-size: 10.5pt;">
      ${lampiran.rubrikPenilaian || 'Kriteria Penilaian: Sangat Baik (4), Baik (3), Cukup (2), Perlu Bimbingan (1).'}
    </div>

    <p><strong>D. Glosarium</strong></p>
    <ul style="margin:2pt 0 8pt 16pt; padding:0; font-size:10.5pt;">
      ${(lampiran.glosarium || []).map(g => `<li><strong>${g.istilah}:</strong> ${g.arti}</li>`).join('')}
    </ul>

    <p><strong>E. Daftar Pustaka</strong></p>
    <ul style="margin:2pt 0 8pt 16pt; padding:0; font-size:10pt;">
      ${(lampiran.daftarPustaka || [
        'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi. Buku Panduan Guru & Buku Siswa Kurikulum Merdeka.',
        'Pusat Kurikulum dan Perbukuan, Kemendikbudristek.'
      ]).map(dp => `<li>${dp}</li>`).join('')}
    </ul>

    <!-- PENGESAHAN TANDA TANGAN -->
    <table class="sig-table">
      <tr>
        <td>
          Mengetahui,<br/>
          Kepala Sekolah ${schoolProfile.name || ''}
          <br/><br/><br/><br/>
          <strong><u>${schoolProfile.principalName || '...........................................'}</u></strong><br/>
          NIP. ${schoolProfile.principalNip || '...........................................'}
        </td>
        <td>
          ${schoolProfile.address?.split(',')[0] || 'Kota Sekolah'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
          Guru Mata Pelajaran
          <br/><br/><br/><br/>
          <strong><u>${config.namaGuru || '...........................................'}</u></strong><br/>
          NIP. ...........................................
        </td>
      </tr>
    </table>
  `;

  return html;
}
