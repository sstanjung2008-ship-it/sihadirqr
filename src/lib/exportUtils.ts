import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { SchoolProfile, Student, AttendanceRecord, LearningJournal, SchoolClass, CharacterTrait, StudentCharacterLog, CharacterPredicateSettings, StudentGradeAssessment } from '../types';

/**
 * Convert any Google Drive sharing link (or standard URL) into a direct image embed URL.
 * Handles:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/uc?export=view&id=FILE_ID
 * - https://lh3.googleusercontent.com/d/FILE_ID
 */
export function convertGoogleDriveUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  // If it's already a direct data URL or lh3 direct Google image
  if (trimmed.startsWith('data:image/') || trimmed.includes('lh3.googleusercontent.com/d/')) {
    return trimmed;
  }

  // Regex patterns to extract Google Drive File ID
  const driveFileRegex = /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]{25,})/;
  const match = trimmed.match(driveFileRegex);

  if (match && match[1]) {
    const fileId = match[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // Fallback: If user passed an ID-only string (alphanumeric with length 28-44)
  const idOnlyMatch = trimmed.match(/^([a-zA-Z0-9_-]{28,45})$/);
  if (idOnlyMatch && idOnlyMatch[1] && !trimmed.includes('/') && !trimmed.includes('.')) {
    return `https://lh3.googleusercontent.com/d/${idOnlyMatch[1]}`;
  }

  return trimmed;
}

export function isGoogleDriveUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  return rawUrl.includes('drive.google.com') || rawUrl.includes('docs.google.com') || rawUrl.includes('lh3.googleusercontent.com/d/');
}

// Helper to convert Image URL to Base64 Data URL for jsPDF
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  const processedUrl = convertGoogleDriveUrl(url);
  if (processedUrl.startsWith('data:image/')) return processedUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 120;
        canvas.height = img.naturalHeight || img.height || 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = processedUrl;
  });
}

// Helper to generate QR code as Base64 Data URL
async function generateQrDataUrl(text: string): Promise<string> {
  if (!text) return '';
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 300 });
  } catch (e) {
    console.warn('Failed to generate QR Data URL:', e);
    return '';
  }
}

// Single Student ID Card PDF Export
export async function exportSingleStudentCardPdf(
  student: Student,
  schoolProfile: SchoolProfile,
  orientation: 'PORTRAIT' | 'LANDSCAPE' = 'PORTRAIT'
) {
  const isLandscape = orientation === 'LANDSCAPE';
  const width = isLandscape ? 85.6 : 54;
  const height = isLandscape ? 54 : 85.6;

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [width, height]
  });

  const schoolLogo = await loadImageAsDataUrl(schoolProfile.schoolLogo);
  const regencyLogo = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const studentPhoto = await loadImageAsDataUrl(student.photoUrl);
  const qrDataUrl = await generateQrDataUrl(student.qrCode);

  // Draw Header Banner (Indigo)
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, width, 12, 'F');

  // Gold accent line
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 12, width, 1.2, 'F');

  // Logos in header
  if (schoolLogo) {
    try { doc.addImage(schoolLogo, 'PNG', 2, 1.5, 9, 9); } catch {}
  }
  if (regencyLogo) {
    try { doc.addImage(regencyLogo, 'PNG', width - 11, 1.5, 9, 9); } catch {}
  }

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.75);
  doc.text(schoolProfile.name.toUpperCase(), width / 2, 5, { align: 'center' });

  doc.setFontSize(5.5);
  doc.setTextColor(253, 224, 71);
  doc.text('KARTU TANDA PELAJAR', width / 2, 8.5, { align: 'center' });

  // Body background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 13.2, width, height - 13.2, 'F');

  if (isLandscape) {
    // Landscape Layout (85.6mm x 54mm)
    if (studentPhoto) {
      try { doc.addImage(studentPhoto, 'JPEG', 3, 15.5, 19, 25); } catch {}
    }
    doc.setDrawColor(224, 231, 255);
    doc.rect(3, 15.5, 19, 25);

    // Bio Text
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(student.name.toUpperCase(), 36)[0], 24, 18.5);

    doc.setFontSize(5.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    doc.text(`NISN   : ${student.nisn}`, 24, 22.5);
    doc.text(`NIS      : ${student.nis}`, 24, 26.5);
    doc.text(`TTL      : ${student.birthPlaceDate || '-'}`, 24, 30.5);

    const addrLines = doc.splitTextToSize(`Alamat : ${student.address || '-'}`, 36);
    doc.text(addrLines.slice(0, 2), 24, 34.5);

    // QR Code (Enlarged 125%: 20.5mm -> 25.6mm)
    if (qrDataUrl) {
      try { doc.addImage(qrDataUrl, 'PNG', 57, 14, 25.6, 25.6); } catch {}
    }
    doc.setDrawColor(203, 213, 225);
    doc.rect(57, 14, 25.6, 25.6);

  } else {
    // Portrait Layout (54mm x 85.6mm)
    if (studentPhoto) {
      try { doc.addImage(studentPhoto, 'JPEG', (width - 20) / 2, 15, 20, 25); } catch {}
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(student.name.toUpperCase(), 48)[0], width / 2, 44, { align: 'center' });

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`NISN: ${student.nisn} | NIS: ${student.nis}`, width / 2, 48, { align: 'center' });
    doc.text(`TTL: ${student.birthPlaceDate || '-'}`, width / 2, 52, { align: 'center' });

    const addrLines = doc.splitTextToSize(`Alamat: ${student.address || '-'}`, 46);
    doc.text(addrLines.slice(0, 2), width / 2, 56, { align: 'center' });

    if (qrDataUrl) {
      try { doc.addImage(qrDataUrl, 'PNG', (width - 22.5) / 2, 59.5, 22.5, 22.5); } catch {}
    }
  }

  doc.setFontSize(4.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`ID: ${student.qrCode} | ${schoolProfile.name}`, width / 2, height - 2, { align: 'center' });

  doc.save(`KTS_${student.name.replace(/\s+/g, '_')}_${student.nisn}.pdf`);
}

// Batch Student ID Cards PDF Export
export async function exportBatchStudentCardsPdf(
  students: Student[],
  schoolProfile: SchoolProfile,
  orientation: 'PORTRAIT' | 'LANDSCAPE' = 'LANDSCAPE'
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const isLandscape = orientation === 'LANDSCAPE';

  const cardW = isLandscape ? 85.6 : 54;
  const cardH = isLandscape ? 54 : 85.6;

  const cols = isLandscape ? 2 : 3;
  const rows = isLandscape ? 5 : 3;
  const startX = 12;
  const startY = 12;
  const gapX = 8;
  const gapY = isLandscape ? 3 : 8;

  const schoolLogo = await loadImageAsDataUrl(schoolProfile.schoolLogo);
  const regencyLogo = await loadImageAsDataUrl(schoolProfile.regencyLogo);

  for (let i = 0; i < students.length; i++) {
    const std = students[i];
    const itemOnPage = i % (cols * rows);

    if (i > 0 && itemOnPage === 0) {
      doc.addPage();
    }

    const col = itemOnPage % cols;
    const row = Math.floor(itemOnPage / cols);

    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // Card background
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

    // Header Banner
    doc.setFillColor(30, 27, 75);
    doc.roundedRect(x, y, cardW, 10, 2, 2, 'F');
    doc.rect(x, y + 8, cardW, 2, 'F');

    // Gold line
    doc.setFillColor(245, 158, 11);
    doc.rect(x, y + 10, cardW, 1, 'F');

    // Header logos
    if (schoolLogo) {
      try { doc.addImage(schoolLogo, 'PNG', x + 1.5, y + 1, 8, 8); } catch {}
    }
    if (regencyLogo) {
      try { doc.addImage(regencyLogo, 'PNG', x + cardW - 9.5, y + 1, 8, 8); } catch {}
    }

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.125);
    doc.text(schoolProfile.name.toUpperCase(), x + cardW / 2, y + 4.5, { align: 'center' });

    doc.setFontSize(5);
    doc.setTextColor(253, 224, 71);
    doc.text('KARTU TANDA PELAJAR', x + cardW / 2, y + 7.5, { align: 'center' });

    const stdPhoto = await loadImageAsDataUrl(std.photoUrl);
    const qrDataUrl = await generateQrDataUrl(std.qrCode);

    if (isLandscape) {
      if (stdPhoto) {
        try { doc.addImage(stdPhoto, 'JPEG', x + 2.5, y + 13, 18, 23); } catch {}
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(doc.splitTextToSize(std.name.toUpperCase(), 38)[0], x + 22.5, y + 16);

      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`NISN   : ${std.nisn}`, x + 22.5, y + 20);
      doc.text(`NIS      : ${std.nis}`, x + 22.5, y + 23.5);
      doc.text(`TTL      : ${std.birthPlaceDate || '-'}`, x + 22.5, y + 27);

      const addrLines = doc.splitTextToSize(`Alamat : ${std.address || '-'}`, 39);
      doc.text(addrLines.slice(0, 2), x + 22.5, y + 30.5);

      if (qrDataUrl) {
        try { doc.addImage(qrDataUrl, 'PNG', x + cardW - 26.25, y + 12.5, 23.75, 23.75); } catch {}
      }
    } else {
      if (stdPhoto) {
        try { doc.addImage(stdPhoto, 'JPEG', x + (cardW - 20) / 2, y + 13, 20, 25); } catch {}
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(doc.splitTextToSize(std.name.toUpperCase(), 48)[0], x + cardW / 2, y + 41, { align: 'center' });

      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`NISN: ${std.nisn} | NIS: ${std.nis}`, x + cardW / 2, y + 45, { align: 'center' });
      doc.text(`TTL: ${std.birthPlaceDate || '-'}`, x + cardW / 2, y + 49, { align: 'center' });

      const addrLines = doc.splitTextToSize(`Alamat: ${std.address || '-'}`, 48);
      doc.text(addrLines.slice(0, 2), x + cardW / 2, y + 53, { align: 'center' });

      if (qrDataUrl) {
        try { doc.addImage(qrDataUrl, 'PNG', x + (cardW - 21.25) / 2, y + 59.5, 21.25, 21.25); } catch {}
      }
    }

    doc.setFontSize(4.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`ID: ${std.qrCode}`, x + cardW / 2, y + cardH - 1.5, { align: 'center' });
  }

  doc.save(`Kolektif_KTS_Siswa_${students.length}_Siswa.pdf`);
}

// Batch QR Code Stickers PDF Export
export async function exportBatchQrStickersPdf(
  students: Student[],
  schoolProfile: SchoolProfile
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const cols = 4;
  const rows = 6;
  const itemW = 42;
  const itemH = 42;
  const startX = 12;
  const startY = 12;
  const gapX = 5;
  const gapY = 5;

  for (let i = 0; i < students.length; i++) {
    const std = students[i];
    const itemOnPage = i % (cols * rows);

    if (i > 0 && itemOnPage === 0) {
      doc.addPage();
    }

    const col = itemOnPage % cols;
    const row = Math.floor(itemOnPage / cols);

    const x = startX + col * (itemW + gapX);
    const y = startY + row * (itemH + gapY);

    doc.setDrawColor(16, 185, 129);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, itemW, itemH, 2, 2, 'FD');

    doc.setFillColor(236, 253, 245);
    doc.rect(x, y, itemW, 6, 'F');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text(schoolProfile.name.toUpperCase(), x + itemW / 2, y + 4, { align: 'center' });

    const qrDataUrl = await generateQrDataUrl(std.qrCode);
    if (qrDataUrl) {
      try { doc.addImage(qrDataUrl, 'PNG', x + (itemW - 24) / 2, y + 8, 24, 24); } catch {}
    }

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(6.5);
    doc.text(std.name.toUpperCase(), x + itemW / 2, y + 35, { align: 'center' });

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`NISN: ${std.nisn} | KLS: ${std.className}`, x + itemW / 2, y + 39, { align: 'center' });
  }

  doc.save(`Kolektif_Stiker_QR_${students.length}_Siswa.pdf`);
}

// PDF Export for Attendance Recap Report
export async function exportAttendancePdf(
  schoolProfile: SchoolProfile,
  records: AttendanceRecord[],
  students: Student[],
  filterTitle: string,
  startDateStr: string,
  endDateStr: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Load Logos asynchronously
  const regencyLogoData = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const schoolLogoData = await loadImageAsDataUrl(schoolProfile.schoolLogo);

  // Logo Kabupaten - Pojok Kiri Atas (Top Left)
  if (regencyLogoData) {
    try {
      doc.addImage(regencyLogoData, 'PNG', 15, 9, 18, 18);
    } catch (e) {
      console.warn('Failed to add regency logo to PDF:', e);
    }
  }

  // Logo Sekolah - Pojok Kanan Atas (Top Right)
  if (schoolLogoData) {
    try {
      doc.addImage(schoolLogoData, 'PNG', 177, 9, 18, 18);
    } catch (e) {
      console.warn('Failed to add school logo to PDF:', e);
    }
  }

  // Header Kop Surat (Center aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(schoolProfile.regency ? schoolProfile.regency.toUpperCase() : 'PEMERINTAH KABUPATEN', 105, 12, { align: 'center' });

  doc.setFontSize(13);
  doc.text(schoolProfile.name.toUpperCase(), 105, 17, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(schoolProfile.address, 105, 22, { align: 'center' });
  doc.text(`Telp: ${schoolProfile.phone} | Email: ${schoolProfile.email}`, 105, 26, { align: 'center' });
  
  // Line separator Kop Surat
  doc.setLineWidth(0.8);
  doc.line(15, 29, 195, 29);
  doc.setLineWidth(0.2);
  doc.line(15, 30, 195, 30);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('LAPORAN REKAPITULASI PRESENSI SISWA', 105, 38, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Filter: ${filterTitle} | Periode: ${startDateStr} s/d ${endDateStr}`, 105, 43, { align: 'center' });

  // Calculate per-student summary statistics
  const tableData = students.map((std, idx) => {
    const stdRecords = records.filter(r => r.studentId === std.id);
    const hadir = stdRecords.filter(r => r.status === 'HADIR').length;
    const terlambat = stdRecords.filter(r => r.status === 'TERLAMBAT').length;
    const pulang = stdRecords.filter(r => r.returnTime || r.returnStatus === 'PULANG' || r.returnStatus === 'PULANG_TEPAT' || r.returnStatus === 'PULANG_CEPAT').length;
    const izin = stdRecords.filter(r => r.status === 'IZIN').length;
    const sakit = stdRecords.filter(r => r.status === 'SAKIT').length;
    const alpa = stdRecords.filter(r => r.status === 'ALPA').length;
    
    const totalDays = stdRecords.length || 1;
    const presentCount = hadir + terlambat;
    const pct = Math.round((presentCount / totalDays) * 100);

    return [
      (idx + 1).toString(),
      std.nisn,
      std.name,
      std.className,
      hadir.toString(),
      terlambat.toString(),
      pulang.toString(),
      izin.toString(),
      sakit.toString(),
      alpa.toString(),
      `${pct}%`
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [['No', 'NISN', 'Nama Siswa', 'Kelas', 'Hadir', 'Terlambat', 'Pulang', 'Izin', 'Sakit', 'Alpa', '% Hadir']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 40 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'center' },
      9: { halign: 'center' },
      10: { halign: 'center', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;

  // Signatures
  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (finalY + 40 < 280) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${schoolProfile.district}, ${todayFormatted}`, 140, finalY);
    doc.text('Kepala Sekolah,', 140, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolProfile.principalName, 140, finalY + 25);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${schoolProfile.principalNip}`, 140, finalY + 30);
  }

  doc.save(`Rekap_Presensi_${filterTitle.replace(/\s+/g, '_')}_${startDateStr}.pdf`);
}

// PDF Export for Detailed Monthly Attendance Matrix (Rincian Presensi Harian Siswa Selama 1 Bulan)
export async function exportMonthlyAttendanceMatrixPdf(
  schoolProfile: SchoolProfile,
  records: AttendanceRecord[],
  students: Student[],
  className: string,
  year: number,
  month: number, // 1 to 12
  homeroomTeacher?: { name: string; nip?: string } | null
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const INDONESIAN_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthName = INDONESIAN_MONTHS[month - 1] || 'Bulan';
  const totalDays = new Date(year, month, 0).getDate();

  // Load Logos asynchronously
  const regencyLogoData = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const schoolLogoData = await loadImageAsDataUrl(schoolProfile.schoolLogo);

  // Logo Kabupaten - Pojok Kiri Atas
  if (regencyLogoData) {
    try {
      doc.addImage(regencyLogoData, 'PNG', 14, 8, 16, 16);
    } catch (e) {
      console.warn('Failed to add regency logo to PDF:', e);
    }
  }

  // Logo Sekolah - Pojok Kanan Atas
  if (schoolLogoData) {
    try {
      doc.addImage(schoolLogoData, 'PNG', 267, 8, 16, 16);
    } catch (e) {
      console.warn('Failed to add school logo to PDF:', e);
    }
  }

  // Header Kop Surat (Center aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(schoolProfile.regency ? schoolProfile.regency.toUpperCase() : 'PEMERINTAH KABUPATEN', 148.5, 11, { align: 'center' });

  doc.setFontSize(13);
  doc.text(schoolProfile.name.toUpperCase(), 148.5, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(schoolProfile.address, 148.5, 21, { align: 'center' });
  doc.text(`NPSN: ${schoolProfile.npsn || '-'} • Telp: ${schoolProfile.phone || '-'} • Email: ${schoolProfile.email || '-'}`, 148.5, 25, { align: 'center' });

  // Line separator Kop Surat
  doc.setLineWidth(0.8);
  doc.line(14, 28, 283, 28);
  doc.setLineWidth(0.2);
  doc.line(14, 29, 283, 29);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LAPORAN RINCIAN PRESENSI BULANAN SISWA', 148.5, 35, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const homeroomStr = homeroomTeacher?.name ? ` • Wali Kelas: ${homeroomTeacher.name}` : '';
  doc.text(`Kelas: ${className} • Bulan: ${monthName} ${year}${homeroomStr}`, 148.5, 40, { align: 'center' });

  // Prepare Days Columns
  const dayCols: string[] = [];
  for (let d = 1; d <= totalDays; d++) {
    dayCols.push(d.toString());
  }

  // Table Headers
  const tableHead = [
    ['No', 'NISN', 'Nama Lengkap Siswa', ...dayCols, 'H', 'T', 'I', 'S', 'A', '%']
  ];

  // Map each student's daily attendance records
  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }));

  const tableBody = sortedStudents.map((std, idx) => {
    const stdRecords = records.filter(r => r.studentId === std.id || (std.nisn && r.nisn === std.nisn));

    let hadirCount = 0;
    let terlambatCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let alpaCount = 0;

    const dayCells: string[] = [];

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay(); // 0 is Sunday
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[dayOfWeek];
      const activeDays = schoolProfile.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const isNonActiveDay = !activeDays.includes(dayName);
      const isHoliday = (schoolProfile.holidays || []).some(h => {
        if (h.endDate) return dateStr >= h.date && dateStr <= h.endDate;
        return h.date === dateStr;
      });

      const dayRecord = stdRecords.find(r => r.date === dateStr);

      if (dayRecord) {
        if (dayRecord.status === 'HADIR') {
          dayCells.push('H');
          hadirCount++;
        } else if (dayRecord.status === 'TERLAMBAT') {
          dayCells.push('T');
          terlambatCount++;
        } else if (dayRecord.status === 'IZIN') {
          dayCells.push('I');
          izinCount++;
        } else if (dayRecord.status === 'SAKIT') {
          dayCells.push('S');
          sakitCount++;
        } else if (dayRecord.status === 'ALPA') {
          dayCells.push('A');
          alpaCount++;
        } else {
          dayCells.push('H');
          hadirCount++;
        }
      } else {
        if (dayOfWeek === 0 || isHoliday || isNonActiveDay) {
          dayCells.push('L'); // Libur Minggu / Libur Nasional / Hari Non-Aktif
        } else {
          dayCells.push('-');
        }
      }
    }

    const totalDaysRecorded = hadirCount + terlambatCount + izinCount + sakitCount + alpaCount;
    const pct = totalDaysRecorded > 0 ? Math.round(((hadirCount + terlambatCount) / totalDaysRecorded) * 100) : 0;

    return [
      (idx + 1).toString(),
      std.nisn || std.nis || '-',
      std.name,
      ...dayCells,
      hadirCount.toString(),
      terlambatCount.toString(),
      izinCount.toString(),
      sakitCount.toString(),
      alpaCount.toString(),
      `${pct}%`
    ];
  });

  // Calculate dynamic column widths for landscape fit
  const colStyles: { [key: number]: any } = {
    0: { halign: 'center', cellWidth: 7 }, // No
    1: { cellWidth: 20 },                  // NISN
    2: { cellWidth: 42 },                  // Nama Siswa
  };

  // Day columns (3 to 3 + totalDays - 1)
  const dayColWidth = totalDays === 31 ? 4.5 : totalDays === 30 ? 4.6 : 4.8;
  for (let i = 0; i < totalDays; i++) {
    colStyles[3 + i] = { halign: 'center', cellWidth: dayColWidth, fontSize: 6 };
  }

  // Summary columns
  const summaryStartCol = 3 + totalDays;
  colStyles[summaryStartCol] = { halign: 'center', cellWidth: 6.5, fontStyle: 'bold' };     // H
  colStyles[summaryStartCol + 1] = { halign: 'center', cellWidth: 6.5, fontStyle: 'bold' }; // T
  colStyles[summaryStartCol + 2] = { halign: 'center', cellWidth: 6.5, fontStyle: 'bold' }; // I
  colStyles[summaryStartCol + 3] = { halign: 'center', cellWidth: 6.5, fontStyle: 'bold' }; // S
  colStyles[summaryStartCol + 4] = { halign: 'center', cellWidth: 6.5, fontStyle: 'bold' }; // A
  colStyles[summaryStartCol + 5] = { halign: 'center', cellWidth: 9, fontStyle: 'bold' };   // %

  autoTable(doc, {
    startY: 44,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: 255,
      fontSize: 6.5,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.1
    },
    bodyStyles: {
      fontSize: 6.5,
      valign: 'middle',
      lineWidth: 0.1
    },
    columnStyles: colStyles,
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index >= 3 && data.column.index < 3 + totalDays) {
        const val = data.cell.raw;
        if (val === 'H') {
          data.cell.styles.textColor = [16, 149, 106]; // Emerald
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'T') {
          data.cell.styles.textColor = [217, 119, 6]; // Amber
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'I') {
          data.cell.styles.textColor = [37, 99, 235]; // Blue
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'S') {
          data.cell.styles.textColor = [147, 51, 234]; // Purple
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'A') {
          data.cell.styles.textColor = [225, 29, 72]; // Rose/Red
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'L') {
          data.cell.styles.textColor = [156, 163, 175]; // Gray
          data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // Legend / Keterangan Kode
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('Keterangan:  H = Hadir Tepat  |  T = Terlambat  |  I = Izin  |  S = Sakit  |  A = Alpa (Tanpa Keterangan)  |  L = Hari Libur / Minggu', 14, finalY);

  // Signatures Section (check page break)
  let sigY = finalY + 6;
  if (sigY + 30 > 200) {
    doc.addPage();
    sigY = 20;
  }

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  // Left Signature: Kepala Sekolah
  doc.text('Mengetahui,', 30, sigY);
  doc.text('Kepala Sekolah', 30, sigY + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolProfile.principalName || 'Kepala Sekolah', 30, sigY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${schoolProfile.principalNip || '-'}`, 30, sigY + 26);

  // Right Signature: Wali Kelas
  doc.text(`${schoolProfile.district || 'Kabupaten'}, ${todayFormatted}`, 210, sigY);
  doc.text(`Wali Kelas ${className}`, 210, sigY + 4);
  doc.setFont('helvetica', 'bold');
  doc.text(homeroomTeacher?.name || 'Wali Kelas', 210, sigY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${homeroomTeacher?.nip || '-'}`, 210, sigY + 26);

  doc.save(`Rincian_Presensi_Bulanan_${className.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`);
}

// Excel Export for Detailed Monthly Attendance Matrix
export function exportMonthlyAttendanceMatrixExcel(
  schoolProfile: SchoolProfile,
  records: AttendanceRecord[],
  students: Student[],
  className: string,
  year: number,
  month: number,
  homeroomTeacher?: { name: string; nip?: string } | null
) {
  const INDONESIAN_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthName = INDONESIAN_MONTHS[month - 1] || 'Bulan';
  const totalDays = new Date(year, month, 0).getDate();

  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }));

  const dataForExcel = sortedStudents.map((std, idx) => {
    const stdRecords = records.filter(r => r.studentId === std.id || (std.nisn && r.nisn === std.nisn));

    let hadirCount = 0;
    let terlambatCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let alpaCount = 0;

    const rowObj: any = {
      No: idx + 1,
      NISN: std.nisn || '-',
      NIS: std.nis || '-',
      'Nama Siswa': std.name,
      Kelas: className,
    };

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[dayOfWeek];
      const activeDays = schoolProfile.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const isNonActiveDay = !activeDays.includes(dayName);
      const isHoliday = (schoolProfile.holidays || []).some(h => {
        if (h.endDate) return dateStr >= h.date && dateStr <= h.endDate;
        return h.date === dateStr;
      });

      const dayRecord = stdRecords.find(r => r.date === dateStr);

      if (dayRecord) {
        if (dayRecord.status === 'HADIR') {
          rowObj[`Tgl ${d}`] = 'H';
          hadirCount++;
        } else if (dayRecord.status === 'TERLAMBAT') {
          rowObj[`Tgl ${d}`] = 'T';
          terlambatCount++;
        } else if (dayRecord.status === 'IZIN') {
          rowObj[`Tgl ${d}`] = 'I';
          izinCount++;
        } else if (dayRecord.status === 'SAKIT') {
          rowObj[`Tgl ${d}`] = 'S';
          sakitCount++;
        } else if (dayRecord.status === 'ALPA') {
          rowObj[`Tgl ${d}`] = 'A';
          alpaCount++;
        } else {
          rowObj[`Tgl ${d}`] = 'H';
          hadirCount++;
        }
      } else {
        rowObj[`Tgl ${d}`] = (dayOfWeek === 0 || isHoliday || isNonActiveDay) ? 'L' : '-';
      }
    }

    const totalDaysRecorded = hadirCount + terlambatCount + izinCount + sakitCount + alpaCount;
    const pct = totalDaysRecorded > 0 ? Math.round(((hadirCount + terlambatCount) / totalDaysRecorded) * 100) : 0;

    rowObj['Total Hadir'] = hadirCount;
    rowObj['Total Terlambat'] = terlambatCount;
    rowObj['Total Izin'] = izinCount;
    rowObj['Total Sakit'] = sakitCount;
    rowObj['Total Alpa'] = alpaCount;
    rowObj['% Kehadiran'] = `${pct}%`;

    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Presensi ${monthName} ${year}`);

  saveExcelWorkbook(workbook, `Rincian_Presensi_Bulanan_${className.replace(/\s+/g, '_')}_${monthName}_${year}.xlsx`);
}

// Excel Export for Attendance Recap
export function exportAttendanceExcel(
  schoolProfile: SchoolProfile,
  records: AttendanceRecord[],
  students: Student[],
  filterTitle: string,
  startDateStr: string,
  endDateStr: string
) {
  const dataForExcel = students.map((std, idx) => {
    const stdRecords = records.filter(r => r.studentId === std.id);
    const hadir = stdRecords.filter(r => r.status === 'HADIR').length;
    const terlambat = stdRecords.filter(r => r.status === 'TERLAMBAT').length;
    const pulang = stdRecords.filter(r => r.returnTime || r.returnStatus === 'PULANG' || r.returnStatus === 'PULANG_TEPAT' || r.returnStatus === 'PULANG_CEPAT').length;
    const izin = stdRecords.filter(r => r.status === 'IZIN').length;
    const sakit = stdRecords.filter(r => r.status === 'SAKIT').length;
    const alpa = stdRecords.filter(r => r.status === 'ALPA').length;
    
    const totalDays = stdRecords.length || 1;
    const presentCount = hadir + terlambat;
    const pct = Math.round((presentCount / totalDays) * 100);

    return {
      No: idx + 1,
      NISN: std.nisn,
      NIS: std.nis,
      'Nama Siswa': std.name,
      Kelas: std.className,
      'Hadir Tepat Waktu': hadir,
      Terlambat: terlambat,
      'Sudah Scan Pulang': pulang,
      Izin: izin,
      Sakit: sakit,
      Alpa: alpa,
      'Persentase Kehadiran (%)': pct
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Presensi');

  saveExcelWorkbook(workbook, `Rekap_Presensi_${filterTitle.replace(/\s+/g, '_')}_${startDateStr}.xlsx`);
}

// Download Template Excel for Batch Importing New Students
export function downloadStudentImportTemplate() {
  const sampleData = [
    {
      'NISN': '0081234567',
      'NIS': '2024001',
      'Nama Lengkap': 'Ahmad Risky Pratama',
      'Kelas': 'X IPA 1',
      'Jenis Kelamin (L/P)': 'L',
      'Tempat, Tgl Lahir': 'Mataram, 15 Januari 2008',
      'Alamat': 'Jl. Pendidikan No. 12, Mataram',
      'No HP Ortu': '081234567890',
      'Nama Orang Tua / Wali': 'Bpk. Hendra'
    },
    {
      'NISN': '0087654321',
      'NIS': '2024002',
      'Nama Lengkap': 'Siti Nurhaliza',
      'Kelas': 'X IPA 1',
      'Jenis Kelamin (L/P)': 'P',
      'Tempat, Tgl Lahir': 'Praya, 20 Agustus 2008',
      'Alamat': 'Jl. Mawar No. 45, Praya',
      'No HP Ortu': '081987654321',
      'Nama Orang Tua / Wali': 'Ibu Aminah'
    },
    {
      'NISN': '0089876543',
      'NIS': '2024003',
      'Nama Lengkap': 'Budi Santoso',
      'Kelas': 'X IPS 1',
      'Jenis Kelamin (L/P)': 'L',
      'Tempat, Tgl Lahir': 'Selo, 10 Maret 2008',
      'Alamat': 'Jl. Merdeka No. 88, Selo',
      'No HP Ortu': '085234567890',
      'Nama Orang Tua / Wali': 'Bpk. Agus'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  
  worksheet['!cols'] = [
    { wch: 15 }, // NISN
    { wch: 12 }, // NIS
    { wch: 28 }, // Nama Lengkap
    { wch: 14 }, // Kelas
    { wch: 20 }, // Jenis Kelamin
    { wch: 28 }, // Tempat, Tgl Lahir
    { wch: 32 }, // Alamat
    { wch: 18 }, // No HP Ortu
    { wch: 24 }, // Nama Ortu
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');

  saveExcelWorkbook(workbook, 'Format_Import_Data_Siswa_SiHadirQR.xlsx');
}

// Download Template Excel for Batch Importing Teachers
export function downloadTeacherImportTemplate() {
  const sampleData = [
    {
      'NIP': '198501152010011001',
      'Nama Guru': 'Drs. Ahmad Dahlan, M.Pd.',
      'Jenis Kelamin (L/P)': 'L',
      'Mata Pelajaran Utama': 'Matematika',
      'Mata Pelajaran Kedua': 'Informatika',
      'Tugas Tambahan': 'Wakil Kepala Sekolah',
      'Wali Kelas': '-',
      'No HP / WA': '081234567890',
      'Email': 'ahmad.dahlan@sekolah.sch.id'
    },
    {
      'NIP': '199003202015022002',
      'Nama Guru': 'Siti Rahmah, S.Pd.',
      'Jenis Kelamin (L/P)': 'P',
      'Mata Pelajaran Utama': 'Bahasa Indonesia',
      'Mata Pelajaran Kedua': '-',
      'Tugas Tambahan': 'Wali Kelas',
      'Wali Kelas': '7A',
      'No HP / WA': '081987654321',
      'Email': 'siti.rahmah@sekolah.sch.id'
    },
    {
      'NIP': '199207102018011003',
      'Nama Guru': 'Budi Santoso, S.T.',
      'Jenis Kelamin (L/P)': 'L',
      'Mata Pelajaran Utama': 'Informatika',
      'Mata Pelajaran Kedua': '-',
      'Tugas Tambahan': 'Guru Mapel',
      'Wali Kelas': '-',
      'No HP / WA': '085234567890',
      'Email': 'budi.santoso@sekolah.sch.id'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  worksheet['!cols'] = [
    { wch: 22 }, // NIP
    { wch: 30 }, // Nama Guru
    { wch: 20 }, // Jenis Kelamin
    { wch: 24 }, // Mapel Utama
    { wch: 24 }, // Mapel Kedua
    { wch: 24 }, // Tugas Tambahan
    { wch: 16 }, // Wali Kelas
    { wch: 18 }, // No HP
    { wch: 28 }, // Email
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Guru');

  saveExcelWorkbook(workbook, 'Format_Import_Data_Guru_SiHadirQR.xlsx');
}

// Generate WhatsApp Deep Link
export function createWhatsAppUrl(phone: string, message: string): string {
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Send automatic WhatsApp message using Gateway API (Fonnte / Wablas / Lainnya)
 */
export async function sendWhatsAppGatewayMessage(
  phone: string,
  message: string,
  apiKey?: string,
  provider: string = 'Fonnte'
): Promise<{ success: boolean; response?: any; error?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'API Key WhatsApp Gateway belum dikonfigurasi' };
  }

  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }

  try {
    // Fonnte API Endpoint
    const formData = new FormData();
    formData.append('target', cleanPhone);
    formData.append('message', message);
    formData.append('countryCode', '62');

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': apiKey.trim(),
      },
      body: formData,
    });

    const data = await res.json();
    if (data.status === true || data.status === 'true' || data.detail === 'success' || data.id) {
      return { success: true, response: data };
    } else {
      return { 
        success: false, 
        error: data.reason || data.message || data.detail || 'Gagal mengirim via Fonnte Gateway' 
      };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal terhubung ke Server WhatsApp Gateway' };
  }
}

// Export Learning Journal (Jurnal KBM) PDF
export async function exportLearningJournalPdf(
  schoolProfile: SchoolProfile,
  journals: LearningJournal[],
  filterTitle: string,
  classNameFilter: string = 'Semua Kelas',
  teacherInfo?: { name: string; nip?: string } | null,
  homeroomTeacherInfo?: { name: string; nip?: string } | null
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Load Logos asynchronously
  const regencyLogoData = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const schoolLogoData = await loadImageAsDataUrl(schoolProfile.schoolLogo);

  // Logo Kabupaten - Sebelah Kiri Atas (Top Left)
  if (regencyLogoData) {
    try {
      doc.addImage(regencyLogoData, 'PNG', 14, 8, 18, 18);
    } catch (e) {
      console.warn('Failed to add regency logo to PDF:', e);
    }
  }

  // Logo Sekolah - Sebelah Kanan Atas (Top Right)
  if (schoolLogoData) {
    try {
      doc.addImage(schoolLogoData, 'PNG', 265, 8, 18, 18);
    } catch (e) {
      console.warn('Failed to add school logo to PDF:', e);
    }
  }

  // Header / Kop Surat (Center)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(schoolProfile.regency ? schoolProfile.regency.toUpperCase() : 'PEMERINTAH KABUPATEN', 148, 11, { align: 'center' });

  doc.setFontSize(13);
  doc.text(schoolProfile.name.toUpperCase(), 148, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(schoolProfile.address, 148, 21, { align: 'center' });
  doc.text(`NPSN: ${schoolProfile.npsn} • Telp: ${schoolProfile.phone || '-'} • Email: ${schoolProfile.email || '-'}`, 148, 25, { align: 'center' });

  // Double Line Separator
  doc.setLineWidth(0.8);
  doc.line(14, 28, 283, 28);
  doc.setLineWidth(0.2);
  doc.line(14, 29, 283, 29);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('REKAP JURNAL KEGIATAN BELAJAR MENGAJAR (KBM)', 148, 36, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Periode: ${filterTitle}   |   Kelas: ${classNameFilter}   |   Total Kegiatan: ${journals.length} Jurnal`, 148, 41, { align: 'center' });

  // Sort journals chronologically
  const sortedJournals = [...journals].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const tableData = sortedJournals.map((j, idx) => {
    let dayName = '-';
    let formattedDate = j.date;

    if (j.date) {
      const parts = j.date.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(dObj.getTime())) {
          dayName = INDONESIAN_DAYS[dObj.getDay()];
        }
      }
    }

    const periodsStr = j.periods && j.periods.length > 0
      ? `Jam ke-${j.periods.join(', ')}`
      : '-';

    return [
      (idx + 1).toString(),
      formattedDate,
      dayName,
      j.className || '-',
      j.subject || '-',
      j.teacherName || '-',
      j.material || '-',
      j.notesOrTask || '-'
    ];
  });

  autoTable(doc, {
    startY: 46,
    head: [['No', 'Tanggal', 'Hari', 'Kelas', 'Mata Pelajaran', 'Nama Guru', 'Materi', 'Catatan / Tugas']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', '-', '-', '-', 'Tidak ada data jurnal KBM']],
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8.5, halign: 'center', fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, valign: 'top' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 16 },
      4: { cellWidth: 35 },
      5: { cellWidth: 42 },
      6: { cellWidth: 65 },
      7: { cellWidth: 'auto' },
    },
  });

  let sigY = (doc as any).lastAutoTable.finalY + 12;

  // If autoTable ends too close to the bottom of page, add a new page
  if (sigY + 38 > 200) {
    doc.addPage();
    sigY = 25;
  }

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  doc.setFontSize(9);

  // Signatures Section: Guru Mata Pelajaran / Pengajar (Left) and Kepala Sekolah (Right)
  const teacherNameDisplay = teacherInfo?.name || (journals.length > 0 && journals.every(j => j.teacherName === journals[0].teacherName) ? journals[0].teacherName : null);
  const teacherNipDisplay = teacherInfo?.nip ? `NIP. ${teacherInfo.nip}` : '';

  // 2 Column Layout: Guru Pengajar (Left), Kepala Sekolah (Right)
  doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui,', 30, sigY);
  doc.text('Guru Mata Pelajaran / Pengajar,', 30, sigY + 5);

  doc.setFont('helvetica', 'bold');
  if (teacherNameDisplay) {
    doc.text(teacherNameDisplay, 30, sigY + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(teacherNipDisplay || 'NIP. .....................................', 30, sigY + 28);
  } else {
    doc.text('( ..................................................... )', 30, sigY + 23);
    doc.setFont('helvetica', 'normal');
    doc.text('NIP. .....................................', 30, sigY + 28);
  }

  // Kepala Sekolah Signature (Right Side)
  doc.setFont('helvetica', 'normal');
  doc.text(`${schoolProfile.district || 'Sekolah'}, ${todayFormatted}`, 220, sigY);
  doc.text('Kepala Sekolah,', 220, sigY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text(schoolProfile.principalName, 220, sigY + 23);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${schoolProfile.principalNip}`, 220, sigY + 28);

  const sanitizedTitle = filterTitle.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Rekap_Jurnal_KBM_${sanitizedTitle}.pdf`);
}

// Export Specialized Teacher Journal PDF (Rekap Jurnal Guru)
export async function exportTeacherJournalPdf(
  schoolProfile: SchoolProfile,
  journals: LearningJournal[],
  filterTitle: string,
  classNameFilter: string = 'Semua Kelas',
  teacherInfo?: { name: string; nip?: string } | null,
  homeroomTeacherInfo?: { name: string; nip?: string } | null
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Load Logos asynchronously
  const regencyLogoData = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const schoolLogoData = await loadImageAsDataUrl(schoolProfile.schoolLogo);

  // Logo Kabupaten - Sebelah Kiri Atas
  if (regencyLogoData) {
    try {
      doc.addImage(regencyLogoData, 'PNG', 14, 8, 18, 18);
    } catch (e) {
      console.warn('Failed to add regency logo to PDF:', e);
    }
  }

  // Logo Sekolah - Sebelah Kanan Atas
  if (schoolLogoData) {
    try {
      doc.addImage(schoolLogoData, 'PNG', 265, 8, 18, 18);
    } catch (e) {
      console.warn('Failed to add school logo to PDF:', e);
    }
  }

  // Header / Kop Surat (Center)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(schoolProfile.regency ? schoolProfile.regency.toUpperCase() : 'PEMERINTAH KABUPATEN', 148, 11, { align: 'center' });

  doc.setFontSize(13);
  doc.text(schoolProfile.name.toUpperCase(), 148, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(schoolProfile.address, 148, 21, { align: 'center' });
  doc.text(`NPSN: ${schoolProfile.npsn} • Telp: ${schoolProfile.phone || '-'} • Email: ${schoolProfile.email || '-'}`, 148, 25, { align: 'center' });

  // Double Line Separator
  doc.setLineWidth(0.8);
  doc.line(14, 28, 283, 28);
  doc.setLineWidth(0.2);
  doc.line(14, 29, 283, 29);

  // Title: REKAP JURNAL GURU
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('REKAP JURNAL GURU', 148, 36, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const teacherNameHeader = teacherInfo?.name || (journals.length > 0 && journals.every(j => j.teacherName === journals[0].teacherName) ? journals[0].teacherName : 'Semua Guru');
  doc.text(`Guru Pengajar: ${teacherNameHeader}   |   Kelas: ${classNameFilter}   |   Total: ${journals.length} Jurnal KBM`, 148, 41, { align: 'center' });

  // Sort journals chronologically
  const sortedJournals = [...journals].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const tableData = sortedJournals.map((j, idx) => {
    let dayName = '-';
    let formattedDate = j.date;

    if (j.date) {
      const parts = j.date.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(dObj.getTime())) {
          dayName = INDONESIAN_DAYS[dObj.getDay()];
        }
      }
    }

    const sangatAktif = j.studentAttendances?.filter(a => a.status === 'Sangat aktif').length || 0;
    const cukupAktif = j.studentAttendances?.filter(a => a.status === 'Cukup aktif').length || 0;
    const kurangAktif = j.studentAttendances?.filter(a => a.status === 'Kurang aktif').length || 0;
    const menggangguOrAbsen = j.studentAttendances?.filter(a => a.status === 'Mengganggu' || a.status === 'Tidak hadir di kelas').length || 0;
    const totalStudents = j.studentAttendances?.length || 0;

    let rekapText = `SA: ${sangatAktif}, CA: ${cukupAktif}`;
    if (kurangAktif > 0) rekapText += `, KA: ${kurangAktif}`;
    if (menggangguOrAbsen > 0) rekapText += `, M/A: ${menggangguOrAbsen}`;
    rekapText += ` (${totalStudents} Siswa)`;

    return [
      (idx + 1).toString(),
      formattedDate,
      dayName,
      j.className || '-',
      j.subject || '-',
      j.material || '-',
      j.materialLimit || '-',
      j.notesOrTask || '-',
      rekapText
    ];
  });

  autoTable(doc, {
    startY: 46,
    head: [['No', 'Tanggal', 'Hari', 'Kelas', 'Mata Pelajaran', 'Materi', 'Batasan Materi', 'Catatan / Tugas', 'Rekap Keaktifan']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', '-', '-', '-', '-', 'Tidak ada data jurnal KBM']],
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, halign: 'center', fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, valign: 'top' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center', cellWidth: 14 },
      4: { cellWidth: 28 },
      5: { cellWidth: 42 },
      6: { cellWidth: 42 },
      7: { cellWidth: 42 },
      8: { cellWidth: 'auto' },
    },
  });

  let sigY = (doc as any).lastAutoTable.finalY + 12;

  // If autoTable ends too close to the bottom of page, add a new page
  if (sigY + 38 > 200) {
    doc.addPage();
    sigY = 25;
  }

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  doc.setFontSize(9);

  // Signatures Section: Guru Mata Pelajaran / Pengajar (Left) and Kepala Sekolah (Right)
  const teacherNameDisplay = teacherInfo?.name || (journals.length > 0 && journals.every(j => j.teacherName === journals[0].teacherName) ? journals[0].teacherName : null);
  const teacherNipDisplay = teacherInfo?.nip ? `NIP. ${teacherInfo.nip}` : '';

  // Guru Pengajar Signature (Left Side)
  doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui,', 30, sigY);
  doc.text('Guru Mata Pelajaran / Pengajar,', 30, sigY + 5);

  doc.setFont('helvetica', 'bold');
  if (teacherNameDisplay) {
    doc.text(teacherNameDisplay, 30, sigY + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(teacherNipDisplay || 'NIP. .....................................', 30, sigY + 28);
  } else {
    doc.text('( ..................................................... )', 30, sigY + 23);
    doc.setFont('helvetica', 'normal');
    doc.text('NIP. .....................................', 30, sigY + 28);
  }

  // Kepala Sekolah Signature (Right Side)
  doc.setFont('helvetica', 'normal');
  doc.text(`${schoolProfile.district || 'Sekolah'}, ${todayFormatted}`, 220, sigY);
  doc.text('Kepala Sekolah,', 220, sigY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text(schoolProfile.principalName, 220, sigY + 23);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${schoolProfile.principalNip}`, 220, sigY + 28);

  const sanitizedTitle = (teacherNameDisplay || filterTitle).replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Rekap_Jurnal_Guru_${sanitizedTitle}.pdf`);
}

// Export Rekap Keaktifan Siswa Per Kelas PDF
export async function exportClassParticipationPdf(
  schoolProfile: SchoolProfile,
  schoolClass: SchoolClass,
  students: Student[],
  journals: LearningJournal[]
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Load Logos asynchronously
  const regencyLogoData = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const schoolLogoData = await loadImageAsDataUrl(schoolProfile.schoolLogo);

  if (regencyLogoData) {
    try { doc.addImage(regencyLogoData, 'PNG', 14, 8, 18, 18); } catch (e) {}
  }
  if (schoolLogoData) {
    try { doc.addImage(schoolLogoData, 'PNG', 265, 8, 18, 18); } catch (e) {}
  }

  // Header Kop Surat
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(schoolProfile.regency ? schoolProfile.regency.toUpperCase() : 'PEMERINTAH KABUPATEN', 148, 11, { align: 'center' });
  doc.setFontSize(13);
  doc.text(schoolProfile.name.toUpperCase(), 148, 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(schoolProfile.address, 148, 21, { align: 'center' });
  doc.text(`NPSN: ${schoolProfile.npsn} • Telp: ${schoolProfile.phone || '-'} • Email: ${schoolProfile.email || '-'}`, 148, 25, { align: 'center' });

  doc.setLineWidth(0.8);
  doc.line(14, 28, 283, 28);
  doc.setLineWidth(0.2);
  doc.line(14, 29, 283, 29);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`REKAPITULASI DATA KEAKTIFAN SISWA - KELAS ${schoolClass.name.toUpperCase()}`, 148, 36, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Wali Kelas: ${schoolClass.homeroomTeacher || 'Belum Ditentukan'}   |   Jumlah Siswa: ${students.length} Siswa   |   Total Pertemuan KBM Terdata: ${journals.length} Jurnal`, 148, 41, { align: 'center' });

  // Calculate student participation stats
  const tableData = students.map((std, idx) => {
    let sangatAktif = 0;
    let cukupAktif = 0;
    let kurangAktif = 0;
    let mengganggu = 0;
    let tidakHadir = 0;
    let totalPertemuan = 0;
    let lastNotes = '-';

    journals.forEach((j) => {
      const match = j.studentAttendances?.find(a => a.studentId === std.id || a.nisn === std.nisn || a.studentName === std.name);
      if (match) {
        totalPertemuan++;
        if (match.status === 'Sangat aktif') sangatAktif++;
        else if (match.status === 'Cukup aktif') cukupAktif++;
        else if (match.status === 'Kurang aktif') kurangAktif++;
        else if (match.status === 'Mengganggu') mengganggu++;
        else if (match.status === 'Tidak hadir di kelas') tidakHadir++;

        if (match.notes && match.notes.trim() !== '') {
          lastNotes = match.notes;
        }
      }
    });

    let predikat = 'Sangat Aktif';
    if (totalPertemuan === 0) {
      predikat = 'Belum Ada Data';
    } else if (mengganggu > 0 || kurangAktif > 2) {
      predikat = 'Perlu Perhatian';
    } else if (sangatAktif >= cukupAktif && sangatAktif >= kurangAktif) {
      predikat = 'Sangat Aktif';
    } else if (cukupAktif >= kurangAktif) {
      predikat = 'Cukup Aktif';
    } else {
      predikat = 'Kurang Aktif';
    }

    return [
      (idx + 1).toString(),
      std.nisn || '-',
      std.name,
      totalPertemuan.toString(),
      sangatAktif.toString(),
      cukupAktif.toString(),
      kurangAktif.toString(),
      (mengganggu + tidakHadir).toString(),
      predikat,
      lastNotes
    ];
  });

  autoTable(doc, {
    startY: 46,
    head: [['No', 'NISN', 'Nama Siswa', 'Pertemuan', 'Sangat Aktif', 'Cukup Aktif', 'Kurang Aktif', 'Mengganggu /Absen', 'Predikat Keaktifan', 'Catatan Guru Terakhir']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', '-', '-', '-', '-', '-', 'Tidak ada data siswa']],
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, halign: 'center', fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, valign: 'middle' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 22 },
      2: { cellWidth: 45 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 22 },
      8: { halign: 'center', cellWidth: 28 },
      9: { cellWidth: 'auto' },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 12;

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (finalY + 35 < 200) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${schoolProfile.district || 'Sekolah'}, ${todayFormatted}`, 210, finalY);
    doc.text('Wali Kelas,', 210, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolClass.homeroomTeacher || '.......................', 210, finalY + 23);

    doc.setFont('helvetica', 'normal');
    doc.text('Mengetahui, Kepala Sekolah', 20, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolProfile.principalName, 20, finalY + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${schoolProfile.principalNip}`, 20, finalY + 28);
  }

  const sanitizedClassName = schoolClass.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Rekap_Keaktifan_Siswa_Kelas_${sanitizedClassName}.pdf`);
}

// Export Student Character Scores (Nilai Karakter) PDF with Kop Surat & Signature
export async function exportCharacterPointsPdf(
  schoolProfile: SchoolProfile,
  students: Student[],
  classes: SchoolClass[],
  traits: CharacterTrait[],
  logs: StudentCharacterLog[],
  selectedClassFilter: string = 'ALL',
  homeroomTeacherName?: string,
  predicateSettings: CharacterPredicateSettings = { minA: 30, minB: 10, minC: 0, minD: -20, minE: -50 }
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Load Logos
  const regencyLogoData = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const schoolLogoData = await loadImageAsDataUrl(schoolProfile.schoolLogo);

  // Logo Kabupaten - Sebelah Kiri Atas (Top Left)
  if (regencyLogoData) {
    try {
      doc.addImage(regencyLogoData, 'PNG', 14, 8, 18, 18);
    } catch (e) {
      console.warn('Failed to add regency logo to PDF:', e);
    }
  }

  // Logo Sekolah - Sebelah Kanan Atas (Top Right)
  if (schoolLogoData) {
    try {
      doc.addImage(schoolLogoData, 'PNG', 178, 8, 18, 18);
    } catch (e) {
      console.warn('Failed to add school logo to PDF:', e);
    }
  }

  // Header / Kop Surat (Center)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    schoolProfile.regency ? `PEMERINTAH KABUPATEN ${schoolProfile.regency.toUpperCase()}` : 'PEMERINTAH KABUPATEN',
    105, 11, { align: 'center' }
  );

  doc.setFontSize(13);
  doc.text(schoolProfile.name.toUpperCase(), 105, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(schoolProfile.address || 'Alamat Sekolah', 105, 21, { align: 'center' });
  doc.text(`NPSN: ${schoolProfile.npsn || '-'} • Telp: ${schoolProfile.phone || '-'} • Email: ${schoolProfile.email || '-'}`, 105, 25, { align: 'center' });

  // Double Line Separator
  doc.setLineWidth(0.8);
  doc.line(14, 28, 196, 28);
  doc.setLineWidth(0.2);
  doc.line(14, 29, 196, 29);

  // Filter students based on class selection
  const filteredStudents = selectedClassFilter === 'ALL'
    ? students
    : students.filter(s => s.className === selectedClassFilter);

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('LAPORAN PENILAIAN KARAKTER SISWA', 105, 36, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Kelas: ${selectedClassFilter === 'ALL' ? 'Semua Kelas' : selectedClassFilter}   |   Jumlah Siswa: ${filteredStudents.length} Siswa   |   Tanggal: ${todayFormatted}`,
    105, 41, { align: 'center' }
  );

  // Table Data
  const tableData = filteredStudents.map((std, idx) => {
    const studentLogs = logs.filter(l => l.studentId === std.id);
    const posLogs = studentLogs.filter(l => l.traitType === 'POSITIF');
    const negLogs = studentLogs.filter(l => l.traitType === 'NEGATIF');

    const posPoints = posLogs.reduce((sum, item) => sum + (item.points || 0), 0);
    const negPoints = negLogs.reduce((sum, item) => sum + (item.points || 0), 0);
    const netPoints = posPoints - negPoints;

    const minA = predicateSettings.minA ?? 30;
    const minB = predicateSettings.minB ?? 10;
    const minC = predicateSettings.minC ?? 0;
    const minD = predicateSettings.minD ?? -20;
    const minE = predicateSettings.minE ?? -50;

    let predikat = 'Baik (B)';
    if (netPoints >= minA) predikat = 'Sangat Baik (A)';
    else if (netPoints >= minB) predikat = 'Baik (B)';
    else if (netPoints >= minC) predikat = 'Cukup (C)';
    else if (netPoints >= minD) predikat = 'Perlu Pembinaan (D)';
    else if (netPoints >= minE) predikat = 'Tidak Naik Kelas (E)';
    else predikat = 'Pindah Sekolah (F)';

    return [
      (idx + 1).toString(),
      std.nisn || std.nis || '-',
      std.name,
      std.className,
      `+${posPoints}`,
      `-${negPoints}`,
      `${netPoints >= 0 ? '+' : ''}${netPoints}`,
      predikat
    ];
  });

  autoTable(doc, {
    startY: 46,
    head: [['No', 'NISN', 'Nama Siswa', 'Kelas', 'Poin (+)', 'Poin (-)', 'Total Poin', 'Predikat Karakter']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', '-', '-', '-', 'Tidak ada data siswa']],
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8.5, halign: 'center', fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, valign: 'middle' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 24 },
      2: { cellWidth: 46 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 22 },
      7: { halign: 'center', cellWidth: 'auto' },
    },
  });

  let finalY = (doc as any).lastAutoTable.finalY + 12;

  // If too close to page bottom, add new page
  if (finalY + 42 > 280) {
    doc.addPage();
    finalY = 20;
  }

  // Find Wali Kelas
  let targetHomeroomTeacher = homeroomTeacherName || '';
  if (!targetHomeroomTeacher && selectedClassFilter !== 'ALL') {
    const foundClass = classes.find(c => c.name === selectedClassFilter);
    if (foundClass?.homeroomTeacher) {
      targetHomeroomTeacher = foundClass.homeroomTeacher;
    }
  }

  if (!targetHomeroomTeacher) {
    targetHomeroomTeacher = '....................................';
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  // Left Column: Kepala Sekolah
  doc.text('Mengetahui,', 20, finalY);
  doc.text(`Kepala ${schoolProfile.name}`, 20, finalY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolProfile.principalName || 'Kepala Sekolah', 20, finalY + 25);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${schoolProfile.principalNip || '-'}` , 20, finalY + 30);

  // Right Column: Wali Kelas
  const locationName = schoolProfile.district || schoolProfile.regency || 'Sekolah';
  doc.text(`${locationName}, ${todayFormatted}`, 135, finalY);
  doc.text(`Wali Kelas ${selectedClassFilter !== 'ALL' ? selectedClassFilter : ''}`, 135, finalY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(targetHomeroomTeacher, 135, finalY + 25);
  doc.setFont('helvetica', 'normal');
  doc.text('NIP. ....................................', 135, finalY + 30);

  const sanitizedClassName = selectedClassFilter.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Laporan_Nilai_Karakter_Siswa_${sanitizedClassName}.pdf`);
}

// Export Keaktifan Excel
export function exportKeaktifanExcel(
  schoolProfile: SchoolProfile,
  students: Student[],
  journals: LearningJournal[],
  filterTitle: string,
  startDateStr: string,
  endDateStr: string
) {
  const dataForExcel = students.map((std, idx) => {
    let sangatAktif = 0;
    let cukupAktif = 0;
    let kurangAktif = 0;
    let mengganggu = 0;
    let tidakHadir = 0;
    let totalPertemuan = 0;
    let lastNotes = '-';

    journals.forEach((j) => {
      const match = j.studentAttendances?.find(a => a.studentId === std.id || a.nisn === std.nisn || a.studentName === std.name);
      if (match) {
        totalPertemuan++;
        if (match.status === 'Sangat aktif') sangatAktif++;
        else if (match.status === 'Cukup aktif') cukupAktif++;
        else if (match.status === 'Kurang aktif') kurangAktif++;
        else if (match.status === 'Mengganggu') mengganggu++;
        else if (match.status === 'Tidak hadir di kelas') tidakHadir++;

        if (match.notes && match.notes.trim() !== '') {
          lastNotes = match.notes;
        }
      }
    });

    let predikat = 'Sangat Aktif';
    if (totalPertemuan === 0) {
      predikat = 'Belum Ada Data';
    } else if (mengganggu > 0 || kurangAktif > 2) {
      predikat = 'Perlu Perhatian';
    } else if (sangatAktif >= cukupAktif && sangatAktif >= kurangAktif) {
      predikat = 'Sangat Aktif';
    } else if (cukupAktif >= kurangAktif) {
      predikat = 'Cukup Aktif';
    } else {
      predikat = 'Kurang Aktif';
    }

    return {
      'No': idx + 1,
      'NISN': std.nisn || '-',
      'NIS': std.nis || '-',
      'Nama Siswa': std.name,
      'Kelas': std.className,
      'Total Pertemuan KBM': totalPertemuan,
      'Sangat Aktif': sangatAktif,
      'Cukup Aktif': cukupAktif,
      'Kurang Aktif': kurangAktif,
      'Mengganggu / Absen': mengganggu + tidakHadir,
      'Predikat Keaktifan': predikat,
      'Catatan Terakhir': lastNotes
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Keaktifan');

  XLSX.writeFile(workbook, `Rekap_Keaktifan_Siswa_${filterTitle.replace(/\s+/g, '_')}_${startDateStr}.xlsx`);
}

// Export Character Points Excel
export function exportCharacterPointsExcel(
  schoolProfile: SchoolProfile,
  students: Student[],
  logs: StudentCharacterLog[],
  filterTitle: string,
  predicateSettings: CharacterPredicateSettings = { minA: 30, minB: 10, minC: 0, minD: -20, minE: -50 }
) {
  const dataForExcel = students.map((std, idx) => {
    const studentLogs = logs.filter(l => l.studentId === std.id);
    const posLogs = studentLogs.filter(l => l.traitType === 'POSITIF');
    const negLogs = studentLogs.filter(l => l.traitType === 'NEGATIF');

    const posPoints = posLogs.reduce((sum, item) => sum + (item.points || 0), 0);
    const negPoints = negLogs.reduce((sum, item) => sum + (item.points || 0), 0);
    const netPoints = posPoints - negPoints;

    const minA = predicateSettings.minA ?? 30;
    const minB = predicateSettings.minB ?? 10;
    const minC = predicateSettings.minC ?? 0;
    const minD = predicateSettings.minD ?? -20;
    const minE = predicateSettings.minE ?? -50;

    let predikat = 'Baik (B)';
    if (netPoints >= minA) predikat = 'Sangat Baik (A)';
    else if (netPoints >= minB) predikat = 'Baik (B)';
    else if (netPoints >= minC) predikat = 'Cukup (C)';
    else if (netPoints >= minD) predikat = 'Perlu Pembinaan (D)';
    else if (netPoints >= minE) predikat = 'Tidak Naik Kelas (E)';
    else predikat = 'Pindah Sekolah (F)';

    return {
      'No': idx + 1,
      'NISN': std.nisn || '-',
      'NIS': std.nis || '-',
      'Nama Siswa': std.name,
      'Kelas': std.className,
      'Poin Positif (+)': posPoints,
      'Poin Negatif (-)': negPoints,
      'Total Poin Net': netPoints,
      'Predikat Karakter': predikat
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Nilai Karakter');

  XLSX.writeFile(workbook, `Rekap_Nilai_Karakter_Siswa_${filterTitle.replace(/\s+/g, '_')}.xlsx`);
}

// Export Keaktifan PDF for filter/selected class
export async function exportKeaktifanPdf(
  schoolProfile: SchoolProfile,
  students: Student[],
  journals: LearningJournal[],
  filterTitle: string,
  startDateStr: string,
  endDateStr: string,
  selectedClassFilter: string = 'ALL'
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const regencyLogoData = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const schoolLogoData = await loadImageAsDataUrl(schoolProfile.schoolLogo);

  if (regencyLogoData) {
    try { doc.addImage(regencyLogoData, 'PNG', 14, 8, 18, 18); } catch (e) {}
  }
  if (schoolLogoData) {
    try { doc.addImage(schoolLogoData, 'PNG', 265, 8, 18, 18); } catch (e) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(schoolProfile.regency ? schoolProfile.regency.toUpperCase() : 'PEMERINTAH KABUPATEN', 148, 11, { align: 'center' });
  doc.setFontSize(13);
  doc.text(schoolProfile.name.toUpperCase(), 148, 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(schoolProfile.address || 'Alamat Sekolah', 148, 21, { align: 'center' });
  doc.text(`NPSN: ${schoolProfile.npsn || '-'} • Telp: ${schoolProfile.phone || '-'} • Email: ${schoolProfile.email || '-'}`, 148, 25, { align: 'center' });

  doc.setLineWidth(0.8);
  doc.line(14, 28, 283, 28);
  doc.setLineWidth(0.2);
  doc.line(14, 29, 283, 29);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`REKAPITULASI DATA KEAKTIFAN SISWA (${selectedClassFilter === 'ALL' ? 'SEMUA KELAS' : `KELAS ${selectedClassFilter}`})`, 148, 36, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Periode: ${startDateStr} s/d ${endDateStr}   |   Jumlah Siswa: ${students.length} Siswa   |   Total Jurnal: ${journals.length}`, 148, 41, { align: 'center' });

  const tableData = students.map((std, idx) => {
    let sangatAktif = 0;
    let cukupAktif = 0;
    let kurangAktif = 0;
    let mengganggu = 0;
    let tidakHadir = 0;
    let totalPertemuan = 0;
    let lastNotes = '-';

    journals.forEach((j) => {
      const match = j.studentAttendances?.find(a => a.studentId === std.id || a.nisn === std.nisn || a.studentName === std.name);
      if (match) {
        totalPertemuan++;
        if (match.status === 'Sangat aktif') sangatAktif++;
        else if (match.status === 'Cukup aktif') cukupAktif++;
        else if (match.status === 'Kurang aktif') kurangAktif++;
        else if (match.status === 'Mengganggu') mengganggu++;
        else if (match.status === 'Tidak hadir di kelas') tidakHadir++;

        if (match.notes && match.notes.trim() !== '') {
          lastNotes = match.notes;
        }
      }
    });

    let predikat = 'Sangat Aktif';
    if (totalPertemuan === 0) {
      predikat = 'Belum Ada Data';
    } else if (mengganggu > 0 || kurangAktif > 2) {
      predikat = 'Perlu Perhatian';
    } else if (sangatAktif >= cukupAktif && sangatAktif >= kurangAktif) {
      predikat = 'Sangat Aktif';
    } else if (cukupAktif >= kurangAktif) {
      predikat = 'Cukup Aktif';
    } else {
      predikat = 'Kurang Aktif';
    }

    return [
      (idx + 1).toString(),
      std.nisn || '-',
      std.name,
      std.className,
      totalPertemuan.toString(),
      sangatAktif.toString(),
      cukupAktif.toString(),
      kurangAktif.toString(),
      (mengganggu + tidakHadir).toString(),
      predikat,
      lastNotes
    ];
  });

  autoTable(doc, {
    startY: 46,
    head: [['No', 'NISN', 'Nama Siswa', 'Kelas', 'Pertemuan', 'Sangat Aktif', 'Cukup Aktif', 'Kurang Aktif', 'Mengganggu /Absen', 'Predikat Keaktifan', 'Catatan Guru Terakhir']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', 'Tidak ada data siswa']],
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, halign: 'center', fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, valign: 'middle' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 20 },
      2: { cellWidth: 42 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 16 },
      7: { halign: 'center', cellWidth: 16 },
      8: { halign: 'center', cellWidth: 22 },
      9: { halign: 'center', cellWidth: 26 },
      10: { cellWidth: 'auto' },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 12;
  const todayFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  if (finalY + 35 < 200) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${schoolProfile.district || 'Sekolah'}, ${todayFormatted}`, 210, finalY);
    doc.text('Wali Kelas / Guru,', 210, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text('.......................', 210, finalY + 23);

    doc.setFont('helvetica', 'normal');
    doc.text('Mengetahui, Kepala Sekolah', 20, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolProfile.principalName || 'Kepala Sekolah', 20, finalY + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${schoolProfile.principalNip || '-'}`, 20, finalY + 28);
  }

  const sanitizedClassName = selectedClassFilter.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Rekap_Keaktifan_Siswa_${sanitizedClassName}.pdf`);
}

// Export Student Grades to PDF
export async function exportStudentGradesPdf(
  assessment: StudentGradeAssessment,
  schoolProfile: SchoolProfile
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;

  // Header background & line
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.75);
  doc.line(14, 38, pageWidth - 14, 38);

  // Logos if available
  const schoolLogoData = await loadImageAsDataUrl(schoolProfile.schoolLogo);
  if (schoolLogoData) {
    try {
      doc.addImage(schoolLogoData, 'PNG', 16, 6, 24, 24);
    } catch {
      // ignore
    }
  }

  // Header texts
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(schoolProfile.name || 'SMP NEGERI', pageWidth / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(79, 70, 229);
  doc.text('DAFTAR NILAI SISWA (HARIAN, TUGAS & ULANGAN)', pageWidth / 2, 21, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${schoolProfile.address || ''}, ${schoolProfile.district || ''}, ${schoolProfile.regency || ''}`, pageWidth / 2, 27, { align: 'center' });
  doc.text(`NPSN: ${schoolProfile.npsn || '-'} | Kontak: ${schoolProfile.phone || '-'} | Email: ${schoolProfile.email || '-'}`, pageWidth / 2, 32, { align: 'center' });

  // Assessment Info Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 42, pageWidth - 28, 18, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 42, pageWidth - 28, 18, 2, 2, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);

  doc.text(`Kelas: ${assessment.className}`, 20, 48);
  doc.text(`Mata Pelajaran: ${assessment.subject}`, 20, 55);

  doc.text(`Guru Pengajar: ${assessment.teacherName}`, 110, 48);
  doc.text(`Materi: ${assessment.material}`, 110, 55);

  const formattedDate = new Date(assessment.date).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  doc.text(`Tanggal Penilaian: ${formattedDate}`, 210, 48);
  doc.text(`Semester: ${assessment.semester || '1 (Ganjil)'}`, 210, 55);

  // Table
  const tableBody = assessment.grades.map((item, idx) => {
    const harian = item.dailyScore !== null && item.dailyScore !== undefined ? item.dailyScore.toString() : '-';
    const tugas = item.assignmentScore !== null && item.assignmentScore !== undefined ? item.assignmentScore.toString() : '-';
    const ulangan = item.examScore !== null && item.examScore !== undefined ? item.examScore.toString() : '-';
    const rata = item.finalScore !== null && item.finalScore !== undefined ? item.finalScore.toFixed(1) : '-';
    const predikat = item.predicate || (item.finalScore !== null && item.finalScore !== undefined ? (item.finalScore >= 85 ? 'A (Sangat Baik)' : item.finalScore >= 75 ? 'B (Baik)' : item.finalScore >= 60 ? 'C (Cukup)' : 'D (Kurang)') : '-');
    const catatan = item.notes || '-';

    return [
      (idx + 1).toString(),
      item.nisn || '-',
      item.studentName,
      harian,
      tugas,
      ulangan,
      rata,
      predikat,
      catatan
    ];
  });

  autoTable(doc, {
    startY: 64,
    head: [['No', 'NISN', 'Nama Siswa', 'Nilai Harian', 'Nilai Tugas', 'Nilai Ulangan', 'Rata-Rata', 'Predikat', 'Catatan / Evaluasi']],
    body: tableBody.length > 0 ? tableBody : [['-', '-', 'Tidak ada data siswa', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontSize: 8.5,
      halign: 'center',
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 8,
      valign: 'middle',
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 26 },
      2: { cellWidth: 55 },
      3: { halign: 'center', cellWidth: 24 },
      4: { halign: 'center', cellWidth: 24 },
      5: { halign: 'center', cellWidth: 24 },
      6: { halign: 'center', cellWidth: 24 },
      7: { halign: 'center', cellWidth: 32 },
      8: { cellWidth: 'auto' },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const todayFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  if (finalY + 35 < pageHeight) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    doc.text(`${schoolProfile.district || 'Sekolah'}, ${todayFormatted}`, 215, finalY);
    doc.text('Guru Mata Pelajaran,', 215, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(assessment.teacherName || 'Guru Pengajar', 215, finalY + 23);

    doc.setFont('helvetica', 'normal');
    doc.text('Mengetahui, Kepala Sekolah', 20, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolProfile.principalName || 'Kepala Sekolah', 20, finalY + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${schoolProfile.principalNip || '-'}`, 20, finalY + 28);
  }

  const sanitizedSubject = assessment.subject.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedClass = assessment.className.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Daftar_Nilai_${sanitizedClass}_${sanitizedSubject}_${assessment.date}.pdf`);
}

// Export Student Grades to Excel (XLSX)
export function exportStudentGradesExcel(
  assessment: StudentGradeAssessment,
  schoolProfile: SchoolProfile
) {
  const data = assessment.grades.map((item, idx) => ({
    'No': idx + 1,
    'NISN': item.nisn || '',
    'Nama Siswa': item.studentName,
    'Kelas': assessment.className,
    'Mata Pelajaran': assessment.subject,
    'Materi': assessment.material,
    'Tanggal': assessment.date,
    'Guru Pengajar': assessment.teacherName,
    'Nilai Harian': item.dailyScore !== null && item.dailyScore !== undefined ? item.dailyScore : '',
    'Nilai Tugas': item.assignmentScore !== null && item.assignmentScore !== undefined ? item.assignmentScore : '',
    'Nilai Ulangan': item.examScore !== null && item.examScore !== undefined ? item.examScore : '',
    'Rata-Rata': item.finalScore !== null && item.finalScore !== undefined ? Number(item.finalScore.toFixed(1)) : '',
    'Predikat': item.predicate || '',
    'Catatan Evaluasi': item.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Nilai');

  const sanitizedSubject = assessment.subject.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedClass = assessment.className.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(workbook, `Daftar_Nilai_${sanitizedClass}_${sanitizedSubject}_${assessment.date}.xlsx`);
}

// Export Cumulative/Filtered Recap of Student Grades to PDF
export async function exportRecapStudentGradesPdf(
  schoolProfile: SchoolProfile,
  filteredAssessments: StudentGradeAssessment[],
  filteredStudents: Student[],
  filterTitle: string,
  startDate: string,
  endDate: string,
  selectedClass: string,
  selectedSubject?: string,
  mode: 'DETAILED' | 'SUMMARY' = 'DETAILED',
  gradeType: 'ALL' | 'HARIAN' | 'TUGAS' | 'ULANGAN' = 'ALL'
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;

  // Header background & line
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.75);
  doc.line(14, 38, pageWidth - 14, 38);

  // Logos if available
  const schoolLogoData = await loadImageAsDataUrl(schoolProfile.schoolLogo);
  if (schoolLogoData) {
    try {
      doc.addImage(schoolLogoData, 'PNG', 16, 6, 24, 24);
    } catch {
      // ignore
    }
  }

  // Header texts
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(schoolProfile.name || 'SMP NEGERI', pageWidth / 2, 14, { align: 'center' });

  const gradeTypeTitle = 
    gradeType === 'HARIAN' ? 'REKAPITULASI RINCIAN NILAI HARIAN SISWA (NH)' :
    gradeType === 'TUGAS' ? 'REKAPITULASI RINCIAN NILAI TUGAS SISWA (NT)' :
    gradeType === 'ULANGAN' ? 'REKAPITULASI RINCIAN NILAI ULANGAN SISWA (NU)' :
    'REKAPITULASI NILAI SISWA (HARIAN, TUGAS & ULANGAN)';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(79, 70, 229);
  doc.text(gradeTypeTitle, pageWidth / 2, 21, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${schoolProfile.address || ''}, ${schoolProfile.district || ''}, ${schoolProfile.regency || ''}`, pageWidth / 2, 27, { align: 'center' });
  doc.text(`NPSN: ${schoolProfile.npsn || '-'} | Kontak: ${schoolProfile.phone || '-'} | Email: ${schoolProfile.email || '-'}`, pageWidth / 2, 32, { align: 'center' });

  // Filter Info Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 42, pageWidth - 28, 16, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 42, pageWidth - 28, 16, 2, 2, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);

  doc.text(`Kelas: ${selectedClass === 'ALL' ? 'Semua Kelas' : `Kelas ${selectedClass}`}`, 20, 48);
  doc.text(`Mata Pelajaran: ${selectedSubject || '-'}`, 20, 54);

  const formattedStart = new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const formattedEnd = new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  doc.text(`Periode: ${formattedStart} s/d ${formattedEnd}`, 120, 48);
  doc.text(`Total Penilaian: ${filteredAssessments.length} Kegiatan Penilaian`, 120, 54);

  const filterCategoryText = 
    gradeType === 'HARIAN' ? 'Khusus Nilai Harian (NH)' :
    gradeType === 'TUGAS' ? 'Khusus Nilai Tugas (NT)' :
    gradeType === 'ULANGAN' ? 'Khusus Nilai Ulangan (NU)' :
    'Gabungan (NH, NT, NU)';

  doc.text(`Kategori: ${filterCategoryText}`, 215, 48);
  doc.text(`Format: ${mode === 'SUMMARY' ? 'Rekapitulasi Rata-Rata Siswa' : 'Rincian Lengkap per Penilaian'}`, 215, 54);

  if (mode === 'SUMMARY') {
    // Group per student and calculate averages
    const tableBody = filteredStudents.map((std, idx) => {
      let totalHarian = 0;
      let countHarian = 0;
      let totalTugas = 0;
      let countTugas = 0;
      let totalUlangan = 0;
      let countUlangan = 0;
      let totalEvaluasi = 0;

      filteredAssessments.forEach(ass => {
        const item = ass.grades?.find(g => g.studentId === std.id || g.nisn === std.nisn || g.studentName.toLowerCase() === std.name.toLowerCase());
        if (item) {
          totalEvaluasi++;
          if (item.dailyScore !== null && item.dailyScore !== undefined) {
            totalHarian += item.dailyScore;
            countHarian++;
          }
          if (item.assignmentScore !== null && item.assignmentScore !== undefined) {
            totalTugas += item.assignmentScore;
            countTugas++;
          }
          if (item.examScore !== null && item.examScore !== undefined) {
            totalUlangan += item.examScore;
            countUlangan++;
          }
        }
      });

      const avgHarian = countHarian > 0 ? (totalHarian / countHarian).toFixed(1) : '-';
      const avgTugas = countTugas > 0 ? (totalTugas / countTugas).toFixed(1) : '-';
      const avgUlangan = countUlangan > 0 ? (totalUlangan / countUlangan).toFixed(1) : '-';

      const validCounts = (countHarian > 0 ? 1 : 0) + (countTugas > 0 ? 1 : 0) + (countUlangan > 0 ? 1 : 0);
      let avgFinal = '-';
      let predikat = '-';
      let status = '-';

      if (validCounts > 0) {
        const hVal = countHarian > 0 ? (totalHarian / countHarian) : 0;
        const tVal = countTugas > 0 ? (totalTugas / countTugas) : 0;
        const uVal = countUlangan > 0 ? (totalUlangan / countUlangan) : 0;
        const finalNum = (hVal + tVal + uVal) / validCounts;
        avgFinal = finalNum.toFixed(1);
        predikat = finalNum >= 85 ? 'A (Sangat Baik)' : finalNum >= 75 ? 'B (Baik)' : finalNum >= 60 ? 'C (Cukup)' : 'D (Kurang)';
        status = finalNum >= 75 ? 'TUNTAS' : 'REMEDIAL';
      }

      return [
        (idx + 1).toString(),
        std.nisn || '-',
        std.name,
        std.className,
        totalEvaluasi.toString(),
        avgHarian,
        avgTugas,
        avgUlangan,
        avgFinal,
        predikat,
        status
      ];
    });

    autoTable(doc, {
      startY: 62,
      head: [['No', 'NISN', 'Nama Siswa', 'Kelas', 'Jml Penilaian', 'Rata NH', 'Rata NT', 'Rata NU', 'Nilai Akhir', 'Predikat', 'Status']],
      body: tableBody.length > 0 ? tableBody : [['-', '-', 'Tidak ada data', '-', '-', '-', '-', '-', '-', '-', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontSize: 8,
        halign: 'center',
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7.5,
        valign: 'middle',
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 26 },
        2: { cellWidth: 50 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 22 },
        5: { halign: 'center', cellWidth: 22 },
        6: { halign: 'center', cellWidth: 22 },
        7: { halign: 'center', cellWidth: 22 },
        8: { halign: 'center', cellWidth: 22 },
        9: { halign: 'center', cellWidth: 28 },
        10: { halign: 'center', cellWidth: 25 },
      },
    });
  } else {
    // DETAILED MODE: Matriks NH1, NH2..., NT1, NT2..., NU1, NU2... per Siswa
    const chronoAssessments = [...filteredAssessments].sort((a, b) => 
      a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '')
    );

    const harianCols = chronoAssessments.filter(ass => 
      ass.grades && ass.grades.some(g => g.dailyScore !== null && g.dailyScore !== undefined)
    );
    const tugasCols = chronoAssessments.filter(ass => 
      ass.grades && ass.grades.some(g => g.assignmentScore !== null && g.assignmentScore !== undefined)
    );
    const ulanganCols = chronoAssessments.filter(ass => 
      ass.grades && ass.grades.some(g => g.examScore !== null && g.examScore !== undefined)
    );

    let head: string[][] = [];
    let body: string[][] = [];

    if (gradeType === 'HARIAN') {
      const nhHeaders = harianCols.length > 0 ? harianCols.map((_, i) => `NH${i + 1}`) : ['NH1'];
      head = [['No', 'NISN', 'Nama Siswa', 'Kelas', ...nhHeaders, 'Rata NH', 'Predikat', 'Status']];
      
      body = filteredStudents.map((std, idx) => {
        const scores = harianCols.map(ass => {
          const item = ass.grades?.find(g => g.studentId === std.id || g.nisn === std.nisn || g.studentName.toLowerCase() === std.name.toLowerCase());
          return item?.dailyScore ?? null;
        });

        const validScores = scores.filter((s): s is number => s !== null);
        const avg = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '-';
        const numAvg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null;
        const pred = numAvg !== null ? (numAvg >= 85 ? 'A' : numAvg >= 75 ? 'B' : numAvg >= 60 ? 'C' : 'D') : '-';
        const stat = numAvg !== null ? (numAvg >= 75 ? 'TUNTAS' : 'REMEDIAL') : '-';

        const rowScores = harianCols.length > 0 ? scores.map(s => s !== null ? s.toString() : '-') : ['-'];

        return [
          (idx + 1).toString(),
          std.nisn || '-',
          std.name,
          std.className,
          ...rowScores,
          avg,
          pred,
          stat
        ];
      });
    } else if (gradeType === 'TUGAS') {
      const ntHeaders = tugasCols.length > 0 ? tugasCols.map((_, i) => `NT${i + 1}`) : ['NT1'];
      head = [['No', 'NISN', 'Nama Siswa', 'Kelas', ...ntHeaders, 'Rata NT', 'Predikat', 'Status']];
      
      body = filteredStudents.map((std, idx) => {
        const scores = tugasCols.map(ass => {
          const item = ass.grades?.find(g => g.studentId === std.id || g.nisn === std.nisn || g.studentName.toLowerCase() === std.name.toLowerCase());
          return item?.assignmentScore ?? null;
        });

        const validScores = scores.filter((s): s is number => s !== null);
        const avg = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '-';
        const numAvg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null;
        const pred = numAvg !== null ? (numAvg >= 85 ? 'A' : numAvg >= 75 ? 'B' : numAvg >= 60 ? 'C' : 'D') : '-';
        const stat = numAvg !== null ? (numAvg >= 75 ? 'TUNTAS' : 'REMEDIAL') : '-';

        const rowScores = tugasCols.length > 0 ? scores.map(s => s !== null ? s.toString() : '-') : ['-'];

        return [
          (idx + 1).toString(),
          std.nisn || '-',
          std.name,
          std.className,
          ...rowScores,
          avg,
          pred,
          stat
        ];
      });
    } else if (gradeType === 'ULANGAN') {
      const nuHeaders = ulanganCols.length > 0 ? ulanganCols.map((_, i) => `NU${i + 1}`) : ['NU1'];
      head = [['No', 'NISN', 'Nama Siswa', 'Kelas', ...nuHeaders, 'Rata NU', 'Predikat', 'Status']];
      
      body = filteredStudents.map((std, idx) => {
        const scores = ulanganCols.map(ass => {
          const item = ass.grades?.find(g => g.studentId === std.id || g.nisn === std.nisn || g.studentName.toLowerCase() === std.name.toLowerCase());
          return item?.examScore ?? null;
        });

        const validScores = scores.filter((s): s is number => s !== null);
        const avg = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '-';
        const numAvg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null;
        const pred = numAvg !== null ? (numAvg >= 85 ? 'A' : numAvg >= 75 ? 'B' : numAvg >= 60 ? 'C' : 'D') : '-';
        const stat = numAvg !== null ? (numAvg >= 75 ? 'TUNTAS' : 'REMEDIAL') : '-';

        const rowScores = ulanganCols.length > 0 ? scores.map(s => s !== null ? s.toString() : '-') : ['-'];

        return [
          (idx + 1).toString(),
          std.nisn || '-',
          std.name,
          std.className,
          ...rowScores,
          avg,
          pred,
          stat
        ];
      });
    } else {
      // ALL (Gabungan NH1..n, NT1..n, NU1..n)
      const nhHeaders = harianCols.length > 0 ? harianCols.map((_, i) => `NH${i + 1}`) : ['NH1'];
      const ntHeaders = tugasCols.length > 0 ? tugasCols.map((_, i) => `NT${i + 1}`) : ['NT1'];
      const nuHeaders = ulanganCols.length > 0 ? ulanganCols.map((_, i) => `NU${i + 1}`) : ['NU1'];

      head = [[
        'No', 'NISN', 'Nama Siswa', 'Kelas', 
        ...nhHeaders, 'Rata NH', 
        ...ntHeaders, 'Rata NT', 
        ...nuHeaders, 'Rata NU', 
        'Nilai Akhir', 'Predikat', 'Status'
      ]];

      body = filteredStudents.map((std, idx) => {
        const nh = harianCols.map(ass => ass.grades?.find(g => g.studentId === std.id || g.nisn === std.nisn || g.studentName.toLowerCase() === std.name.toLowerCase())?.dailyScore ?? null);
        const nt = tugasCols.map(ass => ass.grades?.find(g => g.studentId === std.id || g.nisn === std.nisn || g.studentName.toLowerCase() === std.name.toLowerCase())?.assignmentScore ?? null);
        const nu = ulanganCols.map(ass => ass.grades?.find(g => g.studentId === std.id || g.nisn === std.nisn || g.studentName.toLowerCase() === std.name.toLowerCase())?.examScore ?? null);

        const validNh = nh.filter((s): s is number => s !== null);
        const validNt = nt.filter((s): s is number => s !== null);
        const validNu = nu.filter((s): s is number => s !== null);

        const avgNh = validNh.length > 0 ? (validNh.reduce((a, b) => a + b, 0) / validNh.length).toFixed(1) : '-';
        const avgNt = validNt.length > 0 ? (validNt.reduce((a, b) => a + b, 0) / validNt.length).toFixed(1) : '-';
        const avgNu = validNu.length > 0 ? (validNu.reduce((a, b) => a + b, 0) / validNu.length).toFixed(1) : '-';

        const avgs = [
          validNh.length > 0 ? validNh.reduce((a, b) => a + b, 0) / validNh.length : null,
          validNt.length > 0 ? validNt.reduce((a, b) => a + b, 0) / validNt.length : null,
          validNu.length > 0 ? validNu.reduce((a, b) => a + b, 0) / validNu.length : null,
        ].filter((v): v is number => v !== null);

        const finalScore = avgs.length > 0 ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : '-';
        const numFinal = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
        const pred = numFinal !== null ? (numFinal >= 85 ? 'A' : numFinal >= 75 ? 'B' : numFinal >= 60 ? 'C' : 'D') : '-';
        const stat = numFinal !== null ? (numFinal >= 75 ? 'TUNTAS' : 'REMEDIAL') : '-';

        const rowNh = harianCols.length > 0 ? nh.map(s => s !== null ? s.toString() : '-') : ['-'];
        const rowNt = tugasCols.length > 0 ? nt.map(s => s !== null ? s.toString() : '-') : ['-'];
        const rowNu = ulanganCols.length > 0 ? nu.map(s => s !== null ? s.toString() : '-') : ['-'];

        return [
          (idx + 1).toString(),
          std.nisn || '-',
          std.name,
          std.className,
          ...rowNh,
          avgNh,
          ...rowNt,
          avgNt,
          ...rowNu,
          avgNu,
          finalScore,
          pred,
          stat
        ];
      });
    }

    autoTable(doc, {
      startY: 62,
      head: head,
      body: body.length > 0 ? body : [['-', '-', 'Tidak ada data siswa', '-', '-', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontSize: 7,
        halign: 'center',
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 6.8,
        valign: 'middle',
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 7 },
        1: { halign: 'center', cellWidth: 20 },
        2: { cellWidth: 40 },
        3: { halign: 'center', cellWidth: 14 },
      },
    });

    // Add Legend note if space permits
    const tableEnd = (doc as any).lastAutoTable.finalY || 100;
    if (tableEnd + 15 < pageHeight - 35) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      const legendText = [
        harianCols.length > 0 ? `NH: ${harianCols.map((c, i) => `NH${i+1} (${c.date.substring(5)}: ${c.material})`).join(', ')}` : '',
        tugasCols.length > 0 ? `NT: ${tugasCols.map((c, i) => `NT${i+1} (${c.date.substring(5)}: ${c.material})`).join(', ')}` : '',
        ulanganCols.length > 0 ? `NU: ${ulanganCols.map((c, i) => `NU${i+1} (${c.date.substring(5)}: ${c.material})`).join(', ')}` : ''
      ].filter(Boolean).join(' | ');

      if (legendText) {
        doc.text(`Keterangan Kolom Penilaian: ${legendText.substring(0, 180)}${legendText.length > 180 ? '...' : ''}`, 20, tableEnd + 6);
      }
    }
  }

  const finalY = (doc as any).lastAutoTable.finalY + 12;
  const todayFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  if (finalY + 35 < pageHeight) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    doc.text(`${schoolProfile.district || 'Sekolah'}, ${todayFormatted}`, 215, finalY);
    doc.text('Koordinator Kurikulum / Guru,', 215, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text('Guru Mata Pelajaran', 215, finalY + 23);

    doc.setFont('helvetica', 'normal');
    doc.text('Mengetahui, Kepala Sekolah', 20, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolProfile.principalName || 'Kepala Sekolah', 20, finalY + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${schoolProfile.principalNip || '-'}`, 20, finalY + 28);
  }

  const sanitizedClass = selectedClass.replace(/[^a-zA-Z0-9]/g, '_');
  const typeSuffix = gradeType !== 'ALL' ? `_${gradeType}` : '';
  doc.save(`Rekap_Nilai_Siswa_${sanitizedClass}${typeSuffix}_${startDate}_sd_${endDate}.pdf`);
}

// Export Cumulative/Filtered Recap of Student Grades to Excel (XLSX)
export function exportRecapStudentGradesExcel(
  schoolProfile: SchoolProfile,
  filteredAssessments: StudentGradeAssessment[],
  filteredStudents: Student[],
  filterTitle: string,
  startDate: string,
  endDate: string,
  selectedClass: string,
  selectedSubject?: string,
  gradeType: 'ALL' | 'HARIAN' | 'TUGAS' | 'ULANGAN' = 'ALL'
) {
  const chronoAssessments = [...filteredAssessments].sort((a, b) => 
    a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '')
  );

  const harianCols = chronoAssessments.filter(ass => 
    ass.grades && ass.grades.some(g => g.dailyScore !== null && g.dailyScore !== undefined)
  );
  const tugasCols = chronoAssessments.filter(ass => 
    ass.grades && ass.grades.some(g => g.assignmentScore !== null && g.assignmentScore !== undefined)
  );
  const ulanganCols = chronoAssessments.filter(ass => 
    ass.grades && ass.grades.some(g => g.examScore !== null && g.examScore !== undefined)
  );

  // Sheet 1: Buku Nilai Matriks Siswa
  const matrixRows = filteredStudents.map((std, idx) => {
    const rowObj: any = {
      'No': idx + 1,
      'NISN': std.nisn || '',
      'Nama Siswa': std.name,
      'Kelas': std.className,
    };

    const nh = harianCols.map(ass => ass.grades?.find(g => g.studentId === std.id || g.nisn === std.nisn || g.studentName.toLowerCase() === std.name.toLowerCase())?.dailyScore ?? null);
    const nt = tugasCols.map(ass => ass.grades?.find(g => g.studentId === std.id || g.nisn === std.nisn || g.studentName.toLowerCase() === std.name.toLowerCase())?.assignmentScore ?? null);
    const nu = ulanganCols.map(ass => ass.grades?.find(g => g.studentId === std.id || g.nisn === std.nisn || g.studentName.toLowerCase() === std.name.toLowerCase())?.examScore ?? null);

    // If HARIAN or ALL
    if (gradeType === 'ALL' || gradeType === 'HARIAN') {
      if (harianCols.length === 0) {
        rowObj['NH1'] = '';
      } else {
        harianCols.forEach((_, i) => {
          rowObj[`NH${i + 1}`] = nh[i] !== null ? nh[i] : '';
        });
      }
      const validNh = nh.filter((s): s is number => s !== null);
      rowObj['Rata-rata NH'] = validNh.length > 0 ? Number((validNh.reduce((a, b) => a + b, 0) / validNh.length).toFixed(1)) : '';
    }

    // If TUGAS or ALL
    if (gradeType === 'ALL' || gradeType === 'TUGAS') {
      if (tugasCols.length === 0) {
        rowObj['NT1'] = '';
      } else {
        tugasCols.forEach((_, i) => {
          rowObj[`NT${i + 1}`] = nt[i] !== null ? nt[i] : '';
        });
      }
      const validNt = nt.filter((s): s is number => s !== null);
      rowObj['Rata-rata NT'] = validNt.length > 0 ? Number((validNt.reduce((a, b) => a + b, 0) / validNt.length).toFixed(1)) : '';
    }

    // If ULANGAN or ALL
    if (gradeType === 'ALL' || gradeType === 'ULANGAN') {
      if (ulanganCols.length === 0) {
        rowObj['NU1'] = '';
      } else {
        ulanganCols.forEach((_, i) => {
          rowObj[`NU${i + 1}`] = nu[i] !== null ? nu[i] : '';
        });
      }
      const validNu = nu.filter((s): s is number => s !== null);
      rowObj['Rata-rata NU'] = validNu.length > 0 ? Number((validNu.reduce((a, b) => a + b, 0) / validNu.length).toFixed(1)) : '';
    }

    // Calculate final
    const validNh = nh.filter((s): s is number => s !== null);
    const validNt = nt.filter((s): s is number => s !== null);
    const validNu = nu.filter((s): s is number => s !== null);

    const avgs = [
      validNh.length > 0 ? validNh.reduce((a, b) => a + b, 0) / validNh.length : null,
      validNt.length > 0 ? validNt.reduce((a, b) => a + b, 0) / validNt.length : null,
      validNu.length > 0 ? validNu.reduce((a, b) => a + b, 0) / validNu.length : null,
    ].filter((v): v is number => v !== null);

    let displayScore: number | null = null;
    if (gradeType === 'HARIAN') displayScore = validNh.length > 0 ? validNh.reduce((a, b) => a + b, 0) / validNh.length : null;
    else if (gradeType === 'TUGAS') displayScore = validNt.length > 0 ? validNt.reduce((a, b) => a + b, 0) / validNt.length : null;
    else if (gradeType === 'ULANGAN') displayScore = validNu.length > 0 ? validNu.reduce((a, b) => a + b, 0) / validNu.length : null;
    else displayScore = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;

    if (gradeType === 'ALL') {
      rowObj['Nilai Akhir (Gabungan)'] = displayScore !== null ? Number(displayScore.toFixed(1)) : '';
    }

    rowObj['Predikat'] = displayScore !== null ? (displayScore >= 85 ? 'A (Sangat Baik)' : displayScore >= 75 ? 'B (Baik)' : displayScore >= 60 ? 'C (Cukup)' : 'D (Kurang)') : '';
    rowObj['Status'] = displayScore !== null ? (displayScore >= 75 ? 'TUNTAS' : 'REMEDIAL') : '';

    return rowObj;
  });

  // Sheet 2: Daftar Kegiatan & Materi Penilaian
  const activityRows = chronoAssessments.map((ass, idx) => ({
    'No': idx + 1,
    'Tanggal': ass.date,
    'Kelas': ass.className,
    'Mata Pelajaran': ass.subject,
    'Materi Pembelajaran': ass.material,
    'Guru Pengajar': ass.teacherName,
    'Siswa Ternilai': ass.grades?.filter(g => g.dailyScore !== null || g.assignmentScore !== null || g.examScore !== null).length || 0,
    'Tipe Nilai': [
      ass.grades?.some(g => g.dailyScore !== null) ? 'Harian' : '',
      ass.grades?.some(g => g.assignmentScore !== null) ? 'Tugas' : '',
      ass.grades?.some(g => g.examScore !== null) ? 'Ulangan' : ''
    ].filter(Boolean).join(', ')
  }));

  const workbook = XLSX.utils.book_new();

  const matrixSheetTitle = 
    gradeType === 'HARIAN' ? 'Rincian Nilai Harian' :
    gradeType === 'TUGAS' ? 'Rincian Nilai Tugas' :
    gradeType === 'ULANGAN' ? 'Rincian Nilai Ulangan' :
    'Matriks Nilai Siswa';

  // Sheet 1: Matriks Nilai
  const wsMatrix = XLSX.utils.json_to_sheet(matrixRows.length > 0 ? matrixRows : [{ 'Keterangan': 'Tidak ada data siswa' }]);
  XLSX.utils.book_append_sheet(workbook, wsMatrix, matrixSheetTitle);

  // Sheet 2: Daftar Kegiatan Pembelajaran
  const wsActivities = XLSX.utils.json_to_sheet(activityRows.length > 0 ? activityRows : [{ 'Keterangan': 'Tidak ada data kegiatan penilaian' }]);
  XLSX.utils.book_append_sheet(workbook, wsActivities, 'Daftar Sesi Penilaian');

  const sanitizedClass = selectedClass.replace(/[^a-zA-Z0-9]/g, '_');
  const typeSuffix = gradeType !== 'ALL' ? `_${gradeType}` : '';
  saveExcelWorkbook(workbook, `Rekap_Nilai_Siswa_${sanitizedClass}${typeSuffix}_${startDate}_sd_${endDate}.xlsx`);
}

// Export Complete Student Identity Report with Photos in Landscape Table Format (PDF)
export async function exportStudentFullIdentityPdf(
  schoolProfile: SchoolProfile,
  students: Student[],
  className: string,
  homeroomTeacher?: { name: string; nip?: string } | null
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Pre-load school logos
  const regencyLogoData = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const schoolLogoData = await loadImageAsDataUrl(schoolProfile.schoolLogo);

  // Pre-load all student photos and QR codes in parallel
  const studentPhotos: { [id: string]: string | null } = {};
  const studentQrs: { [id: string]: string } = {};

  await Promise.all(
    students.map(async (std) => {
      const [photo, qr] = await Promise.all([
        loadImageAsDataUrl(std.photoUrl),
        generateQrDataUrl(std.qrCode)
      ]);
      studentPhotos[std.id] = photo;
      studentQrs[std.id] = qr;
    })
  );

  // Helper to draw Kop on first and subsequent pages if needed
  const drawKop = () => {
    // Regency Logo (Top Left)
    if (regencyLogoData) {
      try { doc.addImage(regencyLogoData, 'PNG', 14, 8, 17, 17); } catch {}
    }

    // School Logo (Top Right)
    if (schoolLogoData) {
      try { doc.addImage(schoolLogoData, 'PNG', 266, 8, 17, 17); } catch {}
    }

    // Kop Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(schoolProfile.regency ? schoolProfile.regency.toUpperCase() : 'PEMERINTAH KABUPATEN', 148.5, 11, { align: 'center' });

    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(schoolProfile.name.toUpperCase(), 148.5, 16, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(schoolProfile.address, 148.5, 20.5, { align: 'center' });
    doc.text(`Telp: ${schoolProfile.phone || '-'} | Email: ${schoolProfile.email || '-'} | Website: ${schoolProfile.website || '-'}`, 148.5, 24.5, { align: 'center' });

    // Double Line Separator
    doc.setLineWidth(0.75);
    doc.setDrawColor(30, 41, 59);
    doc.line(14, 27, 283, 27);
    doc.setLineWidth(0.25);
    doc.line(14, 28, 283, 28);
  };

  drawKop();

  // Document Title & Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 27, 75);
  doc.text('DAFTAR IDENTITAS LENGKAP PESERTA DIDIK (BUKU INDUK)', 148.5, 34, { align: 'center' });

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Kelas: ${className}   |   Tahun Ajaran: ${schoolProfile.academicYear || '2025/2026'}   |   Total: ${students.length} Siswa   |   Tanggal Cetak: ${todayFormatted}`, 148.5, 39, { align: 'center' });

  // Prepare table data
  const tableData = students.map((std, idx) => {
    const genderLabel = std.gender === 'L' ? 'Laki-laki (L)' : std.gender === 'P' ? 'Perempuan (P)' : '-';
    return [
      (idx + 1).toString(),
      '', // Photo Placeholder for didDrawCell
      `NISN: ${std.nisn || '-'}\nNIS: ${std.nis || '-'}`,
      `${std.name.toUpperCase()}\nJK: ${genderLabel}`,
      `Kelas: ${std.className}\nTTL: ${std.birthPlaceDate || '-'}`,
      `Wali: ${std.parentName || '-'}\nHP/WA: ${std.parentPhone || '-'}\nEmail: ${std.parentEmail || '-'}`,
      `${std.address || '-'}`,
      '' // QR Code Placeholder for didDrawCell
    ];
  });

  autoTable(doc, {
    startY: 43,
    head: [[
      'No',
      'Pas Foto',
      'NISN / NIS',
      'Nama Siswa & JK',
      'Kelas & TTL',
      'Data Orang Tua / Kontak',
      'Alamat Lengkap',
      'QR Presensi'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 27, 75],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      valign: 'middle',
      minCellHeight: 22,
      cellPadding: 1.5
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 18 }, // Foto
      2: { fontStyle: 'bold', cellWidth: 24 },
      3: { fontStyle: 'bold', cellWidth: 42 },
      4: { cellWidth: 40 },
      5: { cellWidth: 46 },
      6: { cellWidth: 55 },
      7: { halign: 'center', cellWidth: 22 }  // QR
    },
    didDrawCell: (data) => {
      // Draw Student Photo in Column 1 (Pas Foto)
      if (data.column.index === 1 && data.section === 'body') {
        const student = students[data.row.index];
        if (student) {
          const photoUrl = studentPhotos[student.id];
          const cellX = data.cell.x;
          const cellY = data.cell.y;
          const cellW = data.cell.width;
          const cellH = data.cell.height;

          const photoW = 14;
          const photoH = 18;
          const photoX = cellX + (cellW - photoW) / 2;
          const photoY = cellY + (cellH - photoH) / 2;

          if (photoUrl) {
            try {
              doc.setDrawColor(203, 213, 225);
              doc.setLineWidth(0.3);
              doc.rect(photoX - 0.5, photoY - 0.5, photoW + 1, photoH + 1, 'S');
              doc.addImage(photoUrl, 'JPEG', photoX, photoY, photoW, photoH);
            } catch {
              drawPlaceholderPhoto(doc, photoX, photoY, photoW, photoH, student.name);
            }
          } else {
            drawPlaceholderPhoto(doc, photoX, photoY, photoW, photoH, student.name);
          }
        }
      }

      // Draw QR Code in Column 7
      if (data.column.index === 7 && data.section === 'body') {
        const student = students[data.row.index];
        if (student) {
          const qrUrl = studentQrs[student.id];
          const cellX = data.cell.x;
          const cellY = data.cell.y;
          const cellW = data.cell.width;
          const cellH = data.cell.height;

          const qrSize = 17;
          const qrX = cellX + (cellW - qrSize) / 2;
          const qrY = cellY + (cellH - qrSize) / 2;

          if (qrUrl) {
            try {
              doc.addImage(qrUrl, 'PNG', qrX, qrY, qrSize, qrSize);
            } catch {}
          }
        }
      }
    }
  });

  function drawPlaceholderPhoto(d: jsPDF, x: number, y: number, w: number, h: number, name: string) {
    d.setFillColor(241, 245, 249);
    d.setDrawColor(203, 213, 225);
    d.rect(x, y, w, h, 'FD');
    d.setFontSize(6);
    d.setTextColor(148, 163, 184);
    const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    d.text(initials, x + w / 2, y + h / 2 + 1, { align: 'center' });
  }

  const finalY = (doc as any).lastAutoTable?.finalY || 160;

  // Add Signatures
  const pageHeight = 210;
  if (finalY + 35 > pageHeight) {
    doc.addPage();
    drawKop();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
  }

  const sigY = (finalY + 35 > pageHeight ? 40 : finalY + 10);

  // Left Signature: Wali Kelas
  if (homeroomTeacher?.name) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text('Mengetahui,', 40, sigY);
    doc.text(`Wali Kelas ${className}`, 40, sigY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.text(homeroomTeacher.name, 40, sigY + 22);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${homeroomTeacher.nip || '-'}`, 40, sigY + 26);
  }

  // Right Signature: Kepala Sekolah
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`${schoolProfile.district || 'Kota'}, ${todayFormatted}`, 220, sigY);
  doc.text('Kepala Sekolah,', 220, sigY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.text(schoolProfile.principalName, 220, sigY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${schoolProfile.principalNip || '-'}`, 220, sigY + 26);

  const sanitizedClass = className.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Identitas_Lengkap_Siswa_${sanitizedClass}_${Date.now()}.pdf`);
}

// Single Student Detailed Biodata / Buku Induk Sheet (A4 Portrait PDF)
export async function exportSingleStudentBiodataPdf(
  student: Student,
  schoolProfile: SchoolProfile
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const regencyLogo = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const schoolLogo = await loadImageAsDataUrl(schoolProfile.schoolLogo);
  const studentPhoto = await loadImageAsDataUrl(student.photoUrl);
  const qrDataUrl = await generateQrDataUrl(student.qrCode);

  // Kop Surat
  if (regencyLogo) {
    try { doc.addImage(regencyLogo, 'PNG', 15, 9, 18, 18); } catch {}
  }
  if (schoolLogo) {
    try { doc.addImage(schoolLogo, 'PNG', 177, 9, 18, 18); } catch {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(schoolProfile.regency ? schoolProfile.regency.toUpperCase() : 'PEMERINTAH KABUPATEN', 105, 12, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(schoolProfile.name.toUpperCase(), 105, 17, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(schoolProfile.address, 105, 22, { align: 'center' });
  doc.text(`Telp: ${schoolProfile.phone || '-'} | Email: ${schoolProfile.email || '-'}`, 105, 26, { align: 'center' });

  doc.setLineWidth(0.8);
  doc.setDrawColor(30, 41, 59);
  doc.line(15, 29, 195, 29);
  doc.setLineWidth(0.2);
  doc.line(15, 30, 195, 30);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 27, 75);
  doc.text('LEMBAR BUKU INDUK / BIODATA PESERTA DIDIK', 105, 38, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tahun Ajaran: ${schoolProfile.academicYear || '2025/2026'} | Terdaftar di Kelas: ${student.className}`, 105, 43, { align: 'center' });

  // Photo Box (Top Left Card Box)
  const photoW = 28;
  const photoH = 36;
  const photoX = 18;
  const photoY = 50;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(photoX, photoY, photoW, photoH, 'FD');

  if (studentPhoto) {
    try {
      doc.addImage(studentPhoto, 'JPEG', photoX, photoY, photoW, photoH);
    } catch {}
  } else {
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Pas Foto\n3 x 4', photoX + photoW / 2, photoY + photoH / 2 - 2, { align: 'center' });
  }

  // QR Code Box (Top Right Card Box)
  const qrSize = 32;
  const qrX = 160;
  const qrY = 52;

  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch {}
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`ID: ${student.qrCode}`, qrX + qrSize / 2, qrY + qrSize + 3.5, { align: 'center' });
  }

  // Summary Badge in Header Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(50, 50, 104, 36, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(student.name.toUpperCase(), 54, 57);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`NISN              :  ${student.nisn || '-'}`, 54, 63);
  doc.text(`NIS                 :  ${student.nis || '-'}`, 54, 68);
  doc.text(`Kelas              :  ${student.className}`, 54, 73);
  doc.text(`Jenis Kelamin :  ${student.gender === 'L' ? 'Laki-laki (L)' : student.gender === 'P' ? 'Perempuan (P)' : '-'}`, 54, 78);
  doc.text(`TTL                :  ${student.birthPlaceDate || '-'}`, 54, 83);

  // Section A: DATA PRIBADI PESERTA DIDIK
  let curY = 94;
  doc.setFillColor(30, 27, 75);
  doc.rect(15, curY, 180, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('A. DATA PRIBADI PESERTA DIDIK', 18, curY + 4.2);

  curY += 10;
  const personalDetails = [
    ['1.', 'Nama Lengkap Siswa', `: ${student.name}`],
    ['2.', 'Nomor Induk Siswa Nasional (NISN)', `: ${student.nisn || '-'}`],
    ['3.', 'Nomor Induk Sekolah (NIS)', `: ${student.nis || '-'}`],
    ['4.', 'Jenis Kelamin', `: ${student.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}`],
    ['5.', 'Tempat, Tanggal Lahir', `: ${student.birthPlaceDate || '-'}`],
    ['6.', 'Tingkat / Rombongan Belajar (Kelas)', `: Kelas ${student.className}`],
    ['7.', 'Alamat Domisili Siswa', `: ${student.address || '-'}`],
    ['8.', 'Kode QR Presensi Siswa', `: ${student.qrCode || '-'}`]
  ];

  doc.setFontSize(8.5);
  personalDetails.forEach(([num, label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(num, 18, curY);
    doc.text(label, 24, curY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);

    const splitVal = doc.splitTextToSize(val, 95);
    doc.text(splitVal, 88, curY);
    curY += Math.max(splitVal.length * 4.5, 6);
  });

  // Section B: DATA ORANG TUA / WALI
  curY += 2;
  doc.setFillColor(30, 27, 75);
  doc.rect(15, curY, 180, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('B. DATA ORANG TUA / WALI MURID', 18, curY + 4.2);

  curY += 10;
  const parentDetails = [
    ['1.', 'Nama Orang Tua / Wali', `: ${student.parentName || '-'}`],
    ['2.', 'Nomor Telepon / WhatsApp', `: ${student.parentPhone || '-'}`],
    ['3.', 'Alamat Email Orang Tua', `: ${student.parentEmail || '-'}`],
    ['4.', 'Alamat Rumah Orang Tua / Wali', `: ${student.address || '-'}`],
    ['5.', 'Keterangan Notifikasi WA Presensi', ': Aktif / Terhubung Otomatis']
  ];

  parentDetails.forEach(([num, label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(num, 18, curY);
    doc.text(label, 24, curY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);

    const splitVal = doc.splitTextToSize(val, 95);
    doc.text(splitVal, 88, curY);
    curY += Math.max(splitVal.length * 4.5, 6);
  });

  // Signatures
  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const sigY = 230;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  // Left: Orang Tua / Wali
  doc.text('Mengetahui,', 25, sigY);
  doc.text('Orang Tua / Wali Siswa,', 25, sigY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.text(student.parentName || '( ......................................... )', 25, sigY + 24);

  // Right: Kepala Sekolah
  doc.setFont('helvetica', 'normal');
  doc.text(`${schoolProfile.district || 'Kota'}, ${todayFormatted}`, 135, sigY);
  doc.text('Kepala Sekolah,', 135, sigY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolProfile.principalName, 135, sigY + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${schoolProfile.principalNip || '-'}`, 135, sigY + 28);

  const sanitizedName = student.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Biodata_Lengkap_${sanitizedName}_${student.nisn || student.id}.pdf`);
}

// Batch Student Detailed Biodata Sheets (1 Page per Student in 1 PDF document)
export async function exportBatchStudentBiodataSheetsPdf(
  students: Student[],
  schoolProfile: SchoolProfile
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const regencyLogo = await loadImageAsDataUrl(schoolProfile.regencyLogo);
  const schoolLogo = await loadImageAsDataUrl(schoolProfile.schoolLogo);

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    if (i > 0) {
      doc.addPage();
    }

    const studentPhoto = await loadImageAsDataUrl(student.photoUrl);
    const qrDataUrl = await generateQrDataUrl(student.qrCode);

    // Kop Surat
    if (regencyLogo) {
      try { doc.addImage(regencyLogo, 'PNG', 15, 9, 18, 18); } catch {}
    }
    if (schoolLogo) {
      try { doc.addImage(schoolLogo, 'PNG', 177, 9, 18, 18); } catch {}
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(schoolProfile.regency ? schoolProfile.regency.toUpperCase() : 'PEMERINTAH KABUPATEN', 105, 12, { align: 'center' });

    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(schoolProfile.name.toUpperCase(), 105, 17, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(schoolProfile.address, 105, 22, { align: 'center' });
    doc.text(`Telp: ${schoolProfile.phone || '-'} | Email: ${schoolProfile.email || '-'}`, 105, 26, { align: 'center' });

    doc.setLineWidth(0.8);
    doc.setDrawColor(30, 41, 59);
    doc.line(15, 29, 195, 29);
    doc.setLineWidth(0.2);
    doc.line(15, 30, 195, 30);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 27, 75);
    doc.text('LEMBAR BUKU INDUK / BIODATA PESERTA DIDIK', 105, 38, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Tahun Ajaran: ${schoolProfile.academicYear || '2025/2026'} | Terdaftar di Kelas: ${student.className}`, 105, 43, { align: 'center' });

    // Photo Box
    const photoW = 28;
    const photoH = 36;
    const photoX = 18;
    const photoY = 50;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(photoX, photoY, photoW, photoH, 'FD');

    if (studentPhoto) {
      try {
        doc.addImage(studentPhoto, 'JPEG', photoX, photoY, photoW, photoH);
      } catch {}
    } else {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Pas Foto\n3 x 4', photoX + photoW / 2, photoY + photoH / 2 - 2, { align: 'center' });
    }

    // QR Code Box
    const qrSize = 32;
    const qrX = 160;
    const qrY = 52;

    if (qrDataUrl) {
      try {
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      } catch {}
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(`ID: ${student.qrCode}`, qrX + qrSize / 2, qrY + qrSize + 3.5, { align: 'center' });
    }

    // Header Summary Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(50, 50, 104, 36, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(student.name.toUpperCase(), 54, 57);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`NISN              :  ${student.nisn || '-'}`, 54, 63);
    doc.text(`NIS                 :  ${student.nis || '-'}`, 54, 68);
    doc.text(`Kelas              :  ${student.className}`, 54, 73);
    doc.text(`Jenis Kelamin :  ${student.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}`, 54, 78);
    doc.text(`TTL                :  ${student.birthPlaceDate || '-'}`, 54, 83);

    // Section A: DATA PRIBADI PESERTA DIDIK
    let curY = 94;
    doc.setFillColor(30, 27, 75);
    doc.rect(15, curY, 180, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('A. DATA PRIBADI PESERTA DIDIK', 18, curY + 4.2);

    curY += 10;
    const personalDetails = [
      ['1.', 'Nama Lengkap Siswa', `: ${student.name}`],
      ['2.', 'Nomor Induk Siswa Nasional (NISN)', `: ${student.nisn || '-'}`],
      ['3.', 'Nomor Induk Sekolah (NIS)', `: ${student.nis || '-'}`],
      ['4.', 'Jenis Kelamin', `: ${student.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}`],
      ['5.', 'Tempat, Tanggal Lahir', `: ${student.birthPlaceDate || '-'}`],
      ['6.', 'Tingkat / Rombongan Belajar (Kelas)', `: Kelas ${student.className}`],
      ['7.', 'Alamat Domisili Siswa', `: ${student.address || '-'}`],
      ['8.', 'Kode QR Presensi Siswa', `: ${student.qrCode || '-'}`]
    ];

    doc.setFontSize(8.5);
    personalDetails.forEach(([num, label, val]) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(num, 18, curY);
      doc.text(label, 24, curY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);

      const splitVal = doc.splitTextToSize(val, 95);
      doc.text(splitVal, 88, curY);
      curY += Math.max(splitVal.length * 4.5, 6);
    });

    // Section B: DATA ORANG TUA / WALI
    curY += 2;
    doc.setFillColor(30, 27, 75);
    doc.rect(15, curY, 180, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('B. DATA ORANG TUA / WALI MURID', 18, curY + 4.2);

    curY += 10;
    const parentDetails = [
      ['1.', 'Nama Orang Tua / Wali', `: ${student.parentName || '-'}`],
      ['2.', 'Nomor Telepon / WhatsApp', `: ${student.parentPhone || '-'}`],
      ['3.', 'Alamat Email Orang Tua', `: ${student.parentEmail || '-'}`],
      ['4.', 'Alamat Rumah Orang Tua / Wali', `: ${student.address || '-'}`],
      ['5.', 'Keterangan Notifikasi WA Presensi', ': Aktif / Terhubung Otomatis']
    ];

    parentDetails.forEach(([num, label, val]) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(num, 18, curY);
      doc.text(label, 24, curY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);

      const splitVal = doc.splitTextToSize(val, 95);
      doc.text(splitVal, 88, curY);
      curY += Math.max(splitVal.length * 4.5, 6);
    });

    // Signatures
    const todayFormatted = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const sigY = 230;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    // Left: Orang Tua / Wali
    doc.text('Mengetahui,', 25, sigY);
    doc.text('Orang Tua / Wali Siswa,', 25, sigY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(student.parentName || '( ......................................... )', 25, sigY + 24);

    // Right: Kepala Sekolah
    doc.setFont('helvetica', 'normal');
    doc.text(`${schoolProfile.district || 'Kota'}, ${todayFormatted}`, 135, sigY);
    doc.text('Kepala Sekolah,', 135, sigY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolProfile.principalName, 135, sigY + 24);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${schoolProfile.principalNip || '-'}`, 135, sigY + 28);
  }

  doc.save(`Kolektif_Lembar_Biodata_${students.length}_Siswa.pdf`);
}

// Universal Safe Helper to download XLSX workbooks in web, mobile, and sandboxed iframe environments
export function saveExcelWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  const safeFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  try {
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 500);
  } catch (err) {
    console.warn('Direct Blob download failed, attempting XLSX.writeFile fallback:', err);
    try {
      XLSX.writeFile(workbook, safeFileName);
    } catch (writeErr) {
      console.error('All XLSX download methods failed:', writeErr);
      throw new Error('Gagal mengunduh berkas Excel. Pastikan browser mengizinkan unduhan berkas.');
    }
  }
}

// Export Complete Student Identity with Photos to Excel (XLSX)
export function exportStudentFullIdentityExcel(
  schoolProfile: SchoolProfile,
  students: Student[],
  className: string = 'Semua_Kelas'
) {
  if (!students || students.length === 0) {
    throw new Error('Tidak ada data siswa untuk diekspor ke Excel.');
  }

  // Sort students alphabetically by name
  const sortedStudents = [...students].sort((a, b) => 
    a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
  );

  // Sheet 1: Master Data Siswa Lengkap
  const rows = sortedStudents.map((std, idx) => ({
    'No': idx + 1,
    'Nama Lengkap Siswa': std.name || '',
    'NISN': std.nisn || '',
    'NIS': std.nis || '',
    'Jenis Kelamin': std.gender === 'L' ? 'Laki-laki' : std.gender === 'P' ? 'Perempuan' : (std.gender || '-'),
    'Kelas': std.className || '',
    'Tempat, Tanggal Lahir': std.birthPlaceDate || '',
    'Alamat Lengkap': std.address || '',
    'Nama Orang Tua / Wali': std.parentName || '',
    'No. WhatsApp / HP Orang Tua': std.parentPhone || '',
    'Email Orang Tua': std.parentEmail || '',
    'Status Pas Foto': std.photoUrl ? 'Sudah Ada Foto' : 'Belum Ada Foto',
    'URL / Data Pas Foto': std.photoUrl ? (std.photoUrl.startsWith('data:') ? '[Foto Base64 Tersimpan]' : std.photoUrl) : '',
    'Kode QR Presensi': std.qrCode || `STUDENT-${std.nisn || std.id}`,
  }));

  const workbook = XLSX.utils.book_new();
  const wsMaster = XLSX.utils.json_to_sheet(rows);

  // Auto column widths for Sheet 1
  wsMaster['!cols'] = [
    { wch: 6 },  // No
    { wch: 32 }, // Nama Lengkap
    { wch: 16 }, // NISN
    { wch: 14 }, // NIS
    { wch: 16 }, // JK
    { wch: 12 }, // Kelas
    { wch: 30 }, // TTL
    { wch: 42 }, // Alamat
    { wch: 28 }, // Ortu
    { wch: 20 }, // No HP
    { wch: 28 }, // Email
    { wch: 18 }, // Status Foto
    { wch: 35 }, // URL Foto
    { wch: 24 }  // Kode QR
  ];

  // Sanitized sheet name (max 31 characters, no invalid chars : \ / ? * [ ])
  const rawSheetName = `Data Siswa ${className}`.replace(/[:\\/?*\[\]]/g, '_');
  const safeSheetName = rawSheetName.substring(0, 31);
  XLSX.utils.book_append_sheet(workbook, wsMaster, safeSheetName);

  // Sheet 2: Profil Sekolah & Statistik
  const lCount = sortedStudents.filter(s => s.gender === 'L').length;
  const pCount = sortedStudents.filter(s => s.gender === 'P').length;
  const photoCount = sortedStudents.filter(s => !!s.photoUrl).length;

  const schoolSummaryRows = [
    { 'Kategori': 'Nama Satuan Pendidikan', 'Keterangan': schoolProfile.name || '-' },
    { 'Kategori': 'NPSN', 'Keterangan': schoolProfile.npsn || '-' },
    { 'Kategori': 'Alamat Sekolah', 'Keterangan': schoolProfile.address || '-' },
    { 'Kategori': 'Kecamatan / Kabupaten', 'Keterangan': `${schoolProfile.district || ''}, ${schoolProfile.regency || ''}` },
    { 'Kategori': 'Kepala Sekolah', 'Keterangan': schoolProfile.principalName || '-' },
    { 'Kategori': 'NIP Kepala Sekolah', 'Keterangan': schoolProfile.principalNip || '-' },
    { 'Kategori': 'Target Rombel / Kelas', 'Keterangan': className === 'Semua_Kelas' ? 'Semua Kelas' : className },
    { 'Kategori': 'Total Peserta Didik', 'Keterangan': `${sortedStudents.length} Siswa` },
    { 'Kategori': 'Siswa Laki-laki (L)', 'Keterangan': `${lCount} Siswa` },
    { 'Kategori': 'Siswa Perempuan (P)', 'Keterangan': `${pCount} Siswa` },
    { 'Kategori': 'Siswa dengan Pas Foto', 'Keterangan': `${photoCount} dari ${sortedStudents.length} Siswa (${Math.round((photoCount / (sortedStudents.length || 1)) * 100)}%)` },
    { 'Kategori': 'Waktu Ekspor Berkas', 'Keterangan': new Date().toLocaleString('id-ID') }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(schoolSummaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Info Sekolah & Statistik');

  const sanitizedClass = className.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Data_Identitas_Lengkap_Siswa_${sanitizedClass}_${Date.now()}.xlsx`;
  saveExcelWorkbook(workbook, fileName);
}






