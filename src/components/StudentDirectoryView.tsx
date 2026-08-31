import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Student, SchoolClass, SchoolProfile, Teacher } from '../types';
import { 
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  QrCode, 
  GraduationCap, 
  X, 
  Phone, 
  MapPin, 
  Check, 
  Printer, 
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Upload,
  RotateCcw,
  Camera,
  Image as ImageIcon,
  FileSpreadsheet,
  Download,
  RefreshCw,
  AlertTriangle,
  FileText,
  Loader2,
  Sparkles,
  BookOpen,
  Layers,
  CheckCircle2,
  FileCheck,
  Link2,
  Globe,
  Cloud,
  ExternalLink,
  Copy
} from 'lucide-react';
import { StudentIdCardModal } from './StudentIdCardModal';
import { BatchPrintModal } from './BatchPrintModal';
import { ImportStudentsModal } from './ImportStudentsModal';
import { 
  downloadStudentImportTemplate,
  exportStudentFullIdentityPdf,
  exportSingleStudentBiodataPdf,
  exportBatchStudentBiodataSheetsPdf,
  exportStudentFullIdentityExcel,
  convertGoogleDriveUrl,
  isGoogleDriveUrl
} from '../lib/exportUtils';
import { resetToDefaultData, getSchoolProfile } from '../lib/storage';
import { QRCodeSVG } from 'qrcode.react';

interface StudentDirectoryViewProps {
  students: Student[];
  classes: SchoolClass[];
  schoolProfile?: SchoolProfile;
  teachers?: Teacher[];
  onAddStudent: (student: Student) => void;
  onBatchAddStudents?: (students: Student[], newClasses?: SchoolClass[]) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onBatchDeleteStudents?: (ids: string[]) => void;
}

export const StudentDirectoryView: React.FC<StudentDirectoryViewProps> = ({
  students,
  classes,
  schoolProfile: propSchoolProfile,
  teachers = [],
  onAddStudent,
  onBatchAddStudents,
  onUpdateStudent,
  onDeleteStudent,
  onBatchDeleteStudents,
}) => {
  const schoolProfile = propSchoolProfile || getSchoolProfile();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) =>
      a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);
  const [qrCodeStudentModal, setQrCodeStudentModal] = useState<Student | null>(null);
  const [batchPrintMode, setBatchPrintMode] = useState<'CARDS' | 'QR' | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Bulk Delete Modal State
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteTargetClass, setBulkDeleteTargetClass] = useState<string>('ALL');
  const [bulkDeleteConfirmInput, setBulkDeleteConfirmInput] = useState<string>('');

  // Export Identity & Photos Modal State
  const [isExportIdentityModalOpen, setIsExportIdentityModalOpen] = useState(false);
  const [exportIdentityTargetClass, setExportIdentityTargetClass] = useState<string>('ALL');
  const [exportIdentityFormat, setExportIdentityFormat] = useState<'TABLE_PDF' | 'BIODATA_PDF' | 'EXCEL'>('TABLE_PDF');
  const [isExportingIdentity, setIsExportingIdentity] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  const targetStudentsForExport = useMemo(() => {
    if (exportIdentityTargetClass === 'ALL') {
      return students;
    }
    return students.filter(s => s.className === exportIdentityTargetClass);
  }, [students, exportIdentityTargetClass]);

  const handleExportIdentityReport = async () => {
    if (targetStudentsForExport.length === 0) return;
    setIsExportingIdentity(true);
    setExportSuccessMessage(null);

    try {
      // Find homeroom teacher if specific class selected
      let homeroomTeacherObj: { name: string; nip?: string } | null = null;
      if (exportIdentityTargetClass !== 'ALL') {
        const cls = classes.find(c => c.name === exportIdentityTargetClass);
        if (cls) {
          const t = teachers.find(teach => teach.name.toLowerCase() === cls.homeroomTeacher.toLowerCase());
          homeroomTeacherObj = {
            name: cls.homeroomTeacher,
            nip: t?.nip || ''
          };
        }
      }

      if (exportIdentityFormat === 'TABLE_PDF') {
        await exportStudentFullIdentityPdf(
          schoolProfile,
          targetStudentsForExport,
          exportIdentityTargetClass === 'ALL' ? 'Semua Kelas' : exportIdentityTargetClass,
          homeroomTeacherObj
        );
      } else if (exportIdentityFormat === 'BIODATA_PDF') {
        await exportBatchStudentBiodataSheetsPdf(
          targetStudentsForExport,
          schoolProfile
        );
      } else if (exportIdentityFormat === 'EXCEL') {
        exportStudentFullIdentityExcel(
          schoolProfile,
          targetStudentsForExport,
          exportIdentityTargetClass === 'ALL' ? 'Semua_Kelas' : exportIdentityTargetClass
        );
      }

      setExportSuccessMessage(`Berhasil mengunduh ${targetStudentsForExport.length} data identitas siswa (${exportIdentityFormat === 'EXCEL' ? 'Excel .xlsx' : 'Dokumen PDF'})!`);
      setTimeout(() => {
        setIsExportIdentityModalOpen(false);
        setExportSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      console.error('Export identity error:', err);
      alert(`Terjadi kendala saat menyiapkan berkas identitas siswa: ${err?.message || 'Silakan coba lagi.'}`);
    } finally {
      setIsExportingIdentity(false);
    }
  };

  const handleQuickExportExcel = () => {
    const listToExport = selectedClass === 'ALL'
      ? students
      : students.filter(s => s.className === selectedClass);

    if (listToExport.length === 0) {
      alert('Tidak ada data siswa yang tersedia untuk diunduh.');
      return;
    }

    try {
      exportStudentFullIdentityExcel(
        schoolProfile,
        listToExport,
        selectedClass === 'ALL' ? 'Semua_Kelas' : selectedClass
      );
    } catch (err: any) {
      console.error('Quick export excel error:', err);
      alert(err?.message || 'Gagal mengekspor data siswa ke Excel.');
    }
  };

  const handleExportSingleStudentBiodata = async (student: Student) => {
    try {
      await exportSingleStudentBiodataPdf(student, schoolProfile);
    } catch (err) {
      console.error('Error exporting single student biodata:', err);
      alert('Gagal mengunduh biodata siswa. Silakan coba lagi.');
    }
  };

  const handleOpenBulkDeleteModal = () => {
    setBulkDeleteTargetClass(selectedClass !== 'ALL' ? selectedClass : (sortedClasses[0]?.name || 'ALL'));
    setBulkDeleteConfirmInput('');
    setIsBulkDeleteModalOpen(true);
  };

  const targetStudentsForBulkDelete = useMemo(() => {
    if (bulkDeleteTargetClass === 'ALL') {
      return students;
    }
    return students.filter(s => s.className === bulkDeleteTargetClass);
  }, [students, bulkDeleteTargetClass]);

  const handleConfirmBulkDelete = () => {
    if (targetStudentsForBulkDelete.length === 0) return;

    const idsToDelete = targetStudentsForBulkDelete.map(s => s.id);
    if (onBatchDeleteStudents) {
      onBatchDeleteStudents(idsToDelete);
    } else {
      idsToDelete.forEach(id => onDeleteStudent(id));
    }

    if (selectedClass === bulkDeleteTargetClass) {
      setSelectedClass('ALL');
    }

    setIsBulkDeleteModalOpen(false);
    setBulkDeleteConfirmInput('');
  };

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Photo Input Mode & Google Drive URL state
  const [photoInputMode, setPhotoInputMode] = useState<'UPLOAD' | 'DRIVE'>('UPLOAD');
  const [drivePhotoUrlInput, setDrivePhotoUrlInput] = useState<string>('');
  const [drivePhotoFeedback, setDrivePhotoFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Camera modal & stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [capturedCameraPhoto, setCapturedCameraPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');

  const [formData, setFormData] = useState<Omit<Student, 'id'>>({
    nisn: '',
    nis: '',
    name: '',
    gender: 'L',
    classId: classes[0]?.id || 'c7a',
    className: classes[0]?.name || '7-A',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
    qrCode: '',
    birthPlaceDate: 'Jakarta, 01 Januari 2011',
    address: 'Jl. Utama No. 1'
  });

  const filteredStudents = useMemo(() => {
    return students
      .filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              s.nisn.includes(searchQuery) ||
                              s.nis.includes(searchQuery);
        const matchesClass = selectedClass === 'ALL' || s.className === selectedClass;
        return matchesSearch && matchesClass;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }));
  }, [students, searchQuery, selectedClass]);

  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE) || 1;

  const visiblePages = useMemo(() => {
    const maxVisible = 10;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = startPage + maxVisible - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleOpenAdd = () => {
    setEditingStudent(null);
    const randomNisn = '008' + Math.floor(1000000 + Math.random() * 9000000);
    setFormData({
      nisn: randomNisn,
      nis: '2324' + Math.floor(1000 + Math.random() * 9000),
      name: '',
      gender: 'L',
      classId: classes[0]?.id || 'c7a',
      className: classes[0]?.name || '7-A',
      parentName: '',
      parentPhone: '6281234567890',
      parentEmail: '',
      photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
      qrCode: `STUDENT-${randomNisn}`,
      birthPlaceDate: 'Jakarta, 12 Mei 2011',
      address: 'Jl. Pendidikan No. 10'
    });
    setPhotoInputMode('UPLOAD');
    setDrivePhotoUrlInput('');
    setDrivePhotoFeedback(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      nisn: student.nisn,
      nis: student.nis,
      name: student.name,
      gender: student.gender,
      classId: student.classId,
      className: student.className,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      parentEmail: student.parentEmail || '',
      photoUrl: student.photoUrl,
      qrCode: student.qrCode,
      birthPlaceDate: student.birthPlaceDate,
      address: student.address
    });

    if (student.photoUrl && !student.photoUrl.startsWith('data:')) {
      setDrivePhotoUrlInput(student.photoUrl);
      if (isGoogleDriveUrl(student.photoUrl)) {
        setPhotoInputMode('DRIVE');
      } else {
        setPhotoInputMode('UPLOAD');
      }
    } else {
      setDrivePhotoUrlInput('');
      setPhotoInputMode('UPLOAD');
    }
    setDrivePhotoFeedback(null);
    setIsFormOpen(true);
  };

  const handleApplyDrivePhoto = (customUrl?: string) => {
    const urlToUse = (customUrl !== undefined ? customUrl : drivePhotoUrlInput).trim();
    if (!urlToUse) {
      setDrivePhotoFeedback({ type: 'error', message: 'Tautan Google Drive atau URL foto masih kosong.' });
      return;
    }

    const converted = convertGoogleDriveUrl(urlToUse);
    const isDrive = isGoogleDriveUrl(urlToUse);

    setFormData(prev => ({ ...prev, photoUrl: converted }));
    setDrivePhotoFeedback({
      type: 'success',
      message: isDrive
        ? 'Tautan Google Drive berhasil dikonversi dan foto profil siap digunakan!'
        : 'Tautan foto web berhasil diterapkan!'
    });

    setTimeout(() => {
      setDrivePhotoFeedback(null);
    }, 4000);
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setDrivePhotoUrlInput(text);
          handleApplyDrivePhoto(text);
        }
      }
    } catch (err) {
      console.warn('Gagal membaca clipboard:', err);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file foto terlalu besar. Maksimal 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setFormData(prev => ({ ...prev, photoUrl: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Camera Handler Functions
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCameraStream = async (mode: 'user' | 'environment') => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 640 }
        }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        mediaStreamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr: any) {
        setCameraError("Kamera tidak dapat diakses. Pastikan Anda telah memberikan izin kamera pada browser Anda.");
      }
    }
  };

  const handleOpenCamModal = () => {
    setCapturedCameraPhoto(null);
    setCameraError(null);
    setIsCameraModalOpen(true);
    setTimeout(() => {
      startCameraStream(cameraFacingMode);
    }, 100);
  };

  const handleSwitchCameraMode = () => {
    const newMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(newMode);
    startCameraStream(newMode);
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 400;
    const height = video.videoHeight || 400;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (cameraFacingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedCameraPhoto(dataUrl);
      stopCamera();
    }
  };

  const handleApplyCameraPhoto = () => {
    if (capturedCameraPhoto) {
      setFormData(prev => ({ ...prev, photoUrl: capturedCameraPhoto }));
    }
    handleCloseCamModal();
  };

  const handleRetakePhoto = () => {
    setCapturedCameraPhoto(null);
    startCameraStream(cameraFacingMode);
  };

  const handleCloseCamModal = () => {
    stopCamera();
    setIsCameraModalOpen(false);
    setCapturedCameraPhoto(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClassObj = classes.find(c => c.id === formData.classId);
    const finalClassName = selectedClassObj ? selectedClassObj.name : formData.className;

    if (editingStudent) {
      onUpdateStudent({
        ...editingStudent,
        ...formData,
        className: finalClassName,
      });
    } else {
      const newStudent: Student = {
        id: `std-${Date.now()}`,
        ...formData,
        className: finalClassName,
        qrCode: formData.qrCode || `STUDENT-${formData.nisn}`
      };
      onAddStudent(newStudent);
    }
    setIsFormOpen(false);
  };

  const handleBatchImportStudents = (newStudents: Student[], newClasses?: SchoolClass[]) => {
    if (onBatchAddStudents) {
      onBatchAddStudents(newStudents, newClasses);
    } else {
      newStudents.forEach(std => {
        onAddStudent(std);
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Database & Manajemen Siswa
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Total {students.length} Siswa Terdaftar | Kelola Profil, QR Code, dan Kartu Tanda Pelajar (KTS) Digital
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Tombol Format Contoh Excel */}
          <button
            onClick={downloadStudentImportTemplate}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-3 py-2.5 rounded-2xl shadow-xs flex items-center gap-1.5 text-xs transition-all cursor-pointer"
            title="Download Format Contoh File Excel untuk Import Data Siswa"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Format Contoh Excel
          </button>

          {/* Tombol Import Excel Siswa */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3.5 py-2.5 rounded-2xl shadow-md flex items-center gap-2 text-xs transition-all cursor-pointer"
            title="Import Banyak Data Siswa Sekaligus Menggunakan File Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import Excel Siswa
          </button>

          {/* Tombol Download Data Identitas & Foto Siswa */}
          <button
            onClick={() => {
              setExportIdentityTargetClass(selectedClass !== 'ALL' ? selectedClass : 'ALL');
              setExportSuccessMessage(null);
              setIsExportIdentityModalOpen(true);
            }}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-3.5 py-2.5 rounded-2xl shadow-md flex items-center gap-2 text-xs transition-all cursor-pointer hover:shadow-lg hover:shadow-violet-600/20 active:scale-95"
            title="Download Data Identitas Lengkap Siswa beserta Pas Foto (Buku Induk PDF / Excel)"
          >
            <FileText className="w-4 h-4" />
            Download Data Identitas & Foto
          </button>

          {/* Tombol Download Kartu Pelajar (1 Halaman / Batch) */}
          <button
            onClick={() => setBatchPrintMode('CARDS')}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold px-3.5 py-2.5 rounded-2xl shadow-sm flex items-center gap-2 text-xs transition-all cursor-pointer"
            title="Download / Cetak Kolektif Kartu Tanda Pelajar (1 Halaman A4)"
          >
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            Download Kartu Pelajar
          </button>

          {/* Tombol Download Kartu QR Code (1 Halaman / Batch) */}
          <button
            onClick={() => setBatchPrintMode('QR')}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-3.5 py-2.5 rounded-2xl shadow-sm flex items-center gap-2 text-xs transition-all cursor-pointer"
            title="Download / Cetak Kolektif Stiker QR Code Presensi (1 Halaman A4)"
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            Download Kartu QR Code
          </button>

          {/* Tombol Tambah Siswa Baru */}
          <button
            onClick={handleOpenAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-2xl shadow-md flex items-center gap-2 text-xs transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Tambah Siswa Baru
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari Nama Siswa, NISN, atau NIS..."
              className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold">Kelas:</span>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">Semua Kelas ({students.length})</option>
              {sortedClasses.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            {/* Tombol Unduh Excel Cepat */}
            <button
              type="button"
              onClick={handleQuickExportExcel}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
              title="Unduh Data Identitas Siswa (Kelas Terpilih) langsung ke format Excel .xlsx"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            {/* Tombol Hapus Massal berdasarkan Kelas */}
            <button
              type="button"
              onClick={handleOpenBulkDeleteModal}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
              title="Hapus data siswa secara massal berdasarkan kelas"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Hapus Massal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Student Cards Grid */}
      {students.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800">Database Siswa Saat Ini Kosong</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Seluruh data siswa telah berhasil dihapus. Anda dapat mengimpor data baru via file Excel / CSV, menambah siswa secara manual, atau memuat ulang data sampel jika diperlukan.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import Data Excel / CSV
            </button>
            <button
              onClick={handleOpenAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-xs transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Tambah Siswa Manual
            </button>
            <button
              onClick={() => {
                if (window.confirm('Muat ulang 154 data siswa contoh bawaan aplikasi?')) {
                  resetToDefaultData();
                  window.location.reload();
                }
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Muat Ulang Sampel Demo
            </button>
          </div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center text-slate-400 font-semibold text-xs">
          Tidak ada data siswa yang ditemukan untuk kata kunci "{searchQuery}" atau filter kelas yang dipilih.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedStudents.map((student) => (
            <div
              key={student.id}
              className="bg-white border border-slate-200/80 hover:border-indigo-300 rounded-3xl p-5 shadow-sm transition-all duration-200 flex flex-col justify-between space-y-4 group"
            >
              <div className="flex items-start gap-3.5">
                <img
                  src={student.photoUrl}
                  alt={student.name}
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-100 group-hover:ring-indigo-300 shadow-sm"
                />
                <div className="min-w-0 flex-1">
                  <span className="bg-indigo-50 text-indigo-700 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-indigo-100">
                    Kelas {student.className}
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900 truncate mt-1.5">{student.name}</h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    NISN: {student.nisn} | NIS: {student.nis}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    Wali: {student.parentName} ({student.parentPhone})
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5 pt-3 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Kartu Pelajar Button */}
                  <button
                    onClick={() => setSelectedStudentForCard(student)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl py-2 px-1 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                    Kartu Pelajar
                  </button>

                  {/* QR Code Sticker Button */}
                  <button
                    onClick={() => setQrCodeStudentModal(student)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl py-2 px-1 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                    QR Code
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {/* Biodata Lengkap & Foto PDF Button */}
                  <button
                    onClick={() => handleExportSingleStudentBiodata(student)}
                    title="Download Lembar Biodata & Foto Lengkap Siswa (Format Buku Induk PDF)"
                    className="col-span-2 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl py-1.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-violet-600" />
                    Biodata & Foto (PDF)
                  </button>

                  {/* Edit / Delete Buttons */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleOpenEdit(student)}
                      title="Edit Data"
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setStudentToDelete(student)}
                      title="Hapus Data Siswa"
                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {filteredStudents.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm text-xs font-semibold text-slate-600">
          <div>
            Menampilkan <span className="font-bold text-slate-900">{startIndex + 1}</span> - <span className="font-bold text-slate-900">{Math.min(startIndex + ITEMS_PER_PAGE, filteredStudents.length)}</span> dari <span className="font-bold text-indigo-600">{filteredStudents.length}</span> Siswa
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-all font-bold"
            >
              <ChevronLeft className="w-4 h-4" />
              Sebelumnya
            </button>

            <div className="flex items-center gap-1 px-1 flex-wrap justify-center">
              {visiblePages.map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-all font-bold"
            >
              Selanjutnya
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-100 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nama Lengkap Siswa</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-semibold"
                    placeholder="Aditya Pratama"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Jenis Kelamin</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'L' | 'P' })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">NISN (10 Digit)</label>
                  <input
                    type="text"
                    required
                    value={formData.nisn}
                    onChange={(e) => setFormData({ ...formData, nisn: e.target.value, qrCode: `STUDENT-${e.target.value}` })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">NIS Sekolah</label>
                  <input
                    type="text"
                    required
                    value={formData.nis}
                    onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kelas</label>
                  <select
                    value={formData.classId}
                    onChange={(e) => {
                      const cObj = classes.find(c => c.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        classId: e.target.value,
                        className: cObj ? cObj.name : formData.className
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    {sortedClasses.map(c => (
                      <option key={c.id} value={c.id}>Kelas {c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tempat & Tgl Lahir</label>
                  <input
                    type="text"
                    value={formData.birthPlaceDate}
                    onChange={(e) => setFormData({ ...formData, birthPlaceDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Jakarta, 12 Mei 2011"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nama Orang Tua / Wali</label>
                  <input
                    type="text"
                    required
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">No. WhatsApp Orang Tua</label>
                  <input
                    type="text"
                    required
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-indigo-500"
                    placeholder="6281234567890"
                  />
                </div>
              </div>

              {/* Bagian Foto Profil Siswa dengan Input Google Drive */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-slate-800 font-extrabold text-xs flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    <span>Foto Profil Siswa</span>
                    {formData.photoUrl && isGoogleDriveUrl(formData.photoUrl) && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-300">
                        Google Drive
                      </span>
                    )}
                  </label>

                  {/* Switcher Tab Pilihan Input Foto */}
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPhotoInputMode('UPLOAD')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        photoInputMode === 'UPLOAD'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload / Kamera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoInputMode('DRIVE')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        photoInputMode === 'DRIVE'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Cloud className="w-3 h-3" />
                      <span>Link Google Drive</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  {/* Foto Thumbnail & Status Preview */}
                  <div className="relative group shrink-0">
                    <img
                      src={formData.photoUrl || (formData.gender === 'P'
                        ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                        : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80')}
                      alt="Preview Siswa"
                      className="w-18 h-24 rounded-xl object-cover ring-2 ring-indigo-300 shadow-md bg-slate-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = formData.gender === 'P'
                          ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                          : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                      {formData.photoUrl?.startsWith('data:') ? 'Base64' : (isGoogleDriveUrl(formData.photoUrl || '') ? 'G-Drive' : 'Web/Avatar')}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    {photoInputMode === 'UPLOAD' ? (
                      /* METODE 1: UPLOAD FILE & KAMERA */
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all">
                            <Upload className="w-3.5 h-3.5" />
                            Pilih File Foto
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="hidden"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={handleOpenCamModal}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            Ambil Kamera
                          </button>

                          {formData.photoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                const defaultUrl = formData.gender === 'P'
                                  ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                                  : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80';
                                setFormData({ ...formData, photoUrl: defaultUrl });
                                setDrivePhotoUrlInput('');
                              }}
                              className="text-slate-500 hover:text-rose-600 font-semibold text-[11px] px-2 py-1.5 rounded-lg hover:bg-slate-200/60 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Reset ke foto avatar standar"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reset
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          Unggah file pas foto (JPG, PNG) dari galeri HP atau komputer, atau ambil langsung via kamera perangkat.
                        </p>
                      </div>
                    ) : (
                      /* METODE 2: LINK GOOGLE DRIVE / URL WEB */
                      <div className="space-y-2">
                        <div className="flex gap-1.5">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                              <Link2 className="w-4 h-4 text-indigo-500" />
                            </div>
                            <input
                              type="url"
                              value={drivePhotoUrlInput}
                              onChange={(e) => {
                                setDrivePhotoUrlInput(e.target.value);
                                if (e.target.value.includes('drive.google.com') || e.target.value.includes('http')) {
                                  // Auto-apply on link paste
                                  const autoConverted = convertGoogleDriveUrl(e.target.value);
                                  setFormData(prev => ({ ...prev, photoUrl: autoConverted }));
                                }
                              }}
                              placeholder="https://drive.google.com/file/d/1a2b3c.../view?usp=sharing"
                              className="w-full pl-8 pr-2 py-2 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApplyDrivePhoto()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0"
                            title="Terapkan tautan foto ke profil siswa"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Terapkan</span>
                          </button>

                          <button
                            type="button"
                            onClick={handlePasteFromClipboard}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2.5 py-2 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                            title="Tempel link dari clipboard"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-600" />
                            <span>Paste</span>
                          </button>
                        </div>

                        {/* Pesan Feedback */}
                        {drivePhotoFeedback && (
                          <div className={`text-[11px] font-bold p-2 rounded-xl flex items-center gap-1.5 animate-fadeIn ${
                            drivePhotoFeedback.type === 'success'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {drivePhotoFeedback.type === 'success' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            )}
                            <span>{drivePhotoFeedback.message}</span>
                          </div>
                        )}

                        {/* Panduan Google Drive */}
                        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2 text-[10.5px] text-amber-900 leading-snug">
                          <span className="font-bold">💡 Tips Link Google Drive:</span> Pastikan opsi berbagi file di Google Drive disetel ke <span className="font-bold underline">"Siapa saja yang memiliki link" (Anyone with the link)</span> agar foto dapat ditampilkan pada kartu pelajar dan saat unduh PDF/Excel.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Alamat Rumah</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Simpan Data
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* QR Code Sticker Modal */}
      {qrCodeStudentModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800">Stiker QR Code Presensi</h3>
            <p className="text-xs text-indigo-700 font-bold">{qrCodeStudentModal.name} ({qrCodeStudentModal.className})</p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-md mx-auto border border-slate-100">
              <QRCodeSVG value={qrCodeStudentModal.qrCode} size={180} level="H" />
            </div>

            <p className="text-[11px] text-slate-600 font-mono bg-slate-50 py-1.5 px-3 rounded-xl border border-slate-200 font-semibold">
              {qrCodeStudentModal.qrCode}
            </p>

            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setQrCodeStudentModal(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Stiker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student ID Card Modal */}
      {selectedStudentForCard && (
        <StudentIdCardModal
          student={selectedStudentForCard}
          onClose={() => setSelectedStudentForCard(null)}
        />
      )}

      {/* Batch Print Modal (1 Halaman / All) */}
      {batchPrintMode && (
        <BatchPrintModal
          initialMode={batchPrintMode}
          students={paginatedStudents}
          allFilteredStudents={filteredStudents}
          allStudents={students}
          classes={sortedClasses}
          initialClass={selectedClass}
          onClose={() => setBatchPrintMode(null)}
        />
      )}

      {/* Import Students Excel Modal */}
      {isImportModalOpen && (
        <ImportStudentsModal
          existingStudents={students}
          classes={classes}
          onImportStudents={handleBatchImportStudents}
          onClose={() => setIsImportModalOpen(false)}
        />
      )}

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Hapus Data Siswa</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
              Apakah Anda yakin ingin menghapus data siswa <strong className="text-slate-900 font-bold">{studentToDelete.name}</strong> (NISN: {studentToDelete.nisn}) dari database sekolah?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeleteStudent(studentToDelete.id);
                  setStudentToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Ya, Hapus Siswa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA MODAL */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-0 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-sm text-white">Ambil Foto Profil Siswa</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseCamModal}
                className="text-slate-400 hover:text-white p-1 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 bg-slate-900/5">
              {capturedCameraPhoto ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-md bg-black flex items-center justify-center">
                    <img
                      src={capturedCameraPhoto}
                      alt="Hasil Foto Kamera"
                      className="w-full max-h-[320px] object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleRetakePhoto}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Foto Ulang
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyCameraPhoto}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Gunakan Foto Ini
                    </button>
                  </div>
                </div>
              ) : cameraError ? (
                <div className="p-6 text-center space-y-3 bg-rose-50 rounded-2xl border border-rose-200">
                  <p className="text-xs font-semibold text-rose-800">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCameraStream(cameraFacingMode)}
                    className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-colors cursor-pointer"
                  >
                    Coba Akses Kamera Lagi
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-black shadow-inner border border-slate-800 flex items-center justify-center min-h-[260px]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full max-h-[320px] object-cover ${cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />
                    <div className="absolute top-2 right-2">
                      <button
                        type="button"
                        onClick={handleSwitchCameraMode}
                        className="p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 backdrop-blur-xs border border-white/20 transition-all cursor-pointer shadow-md"
                        title="Tukar Kamera Depan / Belakang"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Tukar Kamera
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleCloseCamModal}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleTakeSnapshot}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all transform active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      Ambil Foto
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Download Data Identitas Lengkap & Pas Foto Siswa */}
      {isExportIdentityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 shadow-sm shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    Download Data Identitas Lengkap Siswa & Foto
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ekspor Buku Induk Peserta Didik dengan Pas Foto Berwarna & QR Code
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isExportingIdentity}
                onClick={() => setIsExportIdentityModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scope / Filter Kelas */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Rombongan Belajar / Kelas:
                </label>
                <select
                  disabled={isExportingIdentity}
                  value={exportIdentityTargetClass}
                  onChange={(e) => setExportIdentityTargetClass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 font-bold focus:ring-2 focus:ring-violet-500 cursor-pointer"
                >
                  <option value="ALL">🏫 Semua Kelas (Total {students.length} Siswa)</option>
                  {sortedClasses.map(c => {
                    const countInClass = students.filter(s => s.className === c.name).length;
                    return (
                      <option key={c.id} value={c.name}>
                        Kelas {c.name} ({countInClass} Siswa)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Format Pilihan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Pilih Format Berkas Unduhan:
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  
                  {/* Format 1: Buku Induk Table PDF */}
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                      exportIdentityFormat === 'TABLE_PDF'
                        ? 'border-violet-600 bg-violet-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportFormat"
                      checked={exportIdentityFormat === 'TABLE_PDF'}
                      onChange={() => setExportIdentityFormat('TABLE_PDF')}
                      className="mt-1 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800 text-xs">
                          Buku Induk Lengkap (PDF A4 Landscape + Pas Foto 3x4)
                        </span>
                        <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Rekomendasi
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Tabel rekapitulasi resmi A4 landscape dengan Pas Foto Berwarna 3x4, Kop Sekolah, NISN, NIS, TTL, Kontak Orang Tua, Alamat Lengkap, Kode QR, serta Tanda Tangan Kepala Sekolah & Wali Kelas.
                      </p>
                    </div>
                  </label>

                  {/* Format 2: Lembar Biodata 1 Page per Student PDF */}
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                      exportIdentityFormat === 'BIODATA_PDF'
                        ? 'border-violet-600 bg-violet-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportFormat"
                      checked={exportIdentityFormat === 'BIODATA_PDF'}
                      onChange={() => setExportIdentityFormat('BIODATA_PDF')}
                      className="mt-1 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800 text-xs">
                          Kolektif Lembar Biodata Siswa (PDF 1 Halaman / Siswa)
                        </span>
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Buku Induk Fisik
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Formulir biodata lengkap individual per lembar A4 dengan bingkai foto besar, rincian data diri, data orang tua/wali, QR Presensi, serta lembar pengesahan tanda tangan orang tua & kepala sekolah.
                      </p>
                    </div>
                  </label>

                  {/* Format 3: Excel XLSX */}
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                      exportIdentityFormat === 'EXCEL'
                        ? 'border-violet-600 bg-violet-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportFormat"
                      checked={exportIdentityFormat === 'EXCEL'}
                      onChange={() => setExportIdentityFormat('EXCEL')}
                      className="mt-1 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800 text-xs">
                          Data Identitas Lengkap (Spreadsheet Excel .xlsx)
                        </span>
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Dapodik / EMIS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        File spreadsheet Excel dengan seluruh data atribut siswa, nomor induk, tanggal lahir, kontak orang tua/wali, alamat, tautan berkas foto profil, dan kode QR presensi.
                      </p>
                    </div>
                  </label>

                </div>
              </div>

              {/* Info Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
                  <span>Siap mengekspor <strong className="text-slate-900 font-extrabold">{targetStudentsForExport.length} data siswa</strong></span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {schoolProfile.name}
                </span>
              </div>

              {exportSuccessMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-3 flex items-center gap-2 text-xs font-bold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{exportSuccessMessage}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isExportingIdentity}
                onClick={() => setIsExportIdentityModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={isExportingIdentity || targetStudentsForExport.length === 0}
                onClick={handleExportIdentityReport}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md shadow-violet-600/20 transition-all cursor-pointer active:scale-95"
              >
                {isExportingIdentity ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses Foto & Dokumen...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Sekarang ({targetStudentsForExport.length} Siswa)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BULK DELETE STUDENTS MODAL */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Hapus Massal Data Siswa</h3>
                  <p className="text-xs text-slate-500">Hapus data siswa secara kolektif per kelas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Kelas yang Akan Dihapus Siswanya:
                </label>
                <select
                  value={bulkDeleteTargetClass}
                  onChange={(e) => setBulkDeleteTargetClass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 font-bold focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  <option value="ALL">⚠️ Semua Kelas (Total {students.length} Siswa)</option>
                  {sortedClasses.map(c => {
                    const countInClass = students.filter(s => s.className === c.name).length;
                    return (
                      <option key={c.id} value={c.name}>
                        Kelas {c.name} ({countInClass} Siswa)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-start gap-2 text-rose-800 font-extrabold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>PERHATIAN: PENGHAPUSAN PERMANEN</span>
                </div>
                <p className="text-slate-600 leading-relaxed font-medium">
                  Tindakan ini akan menghapus secara permanen <strong className="text-slate-900 font-extrabold">{targetStudentsForBulkDelete.length} data siswa</strong> {bulkDeleteTargetClass === 'ALL' ? 'di seluruh kelas' : `di Kelas ${bulkDeleteTargetClass}`} beserta seluruh riwayat presensi yang terkait.
                </p>
              </div>

              {targetStudentsForBulkDelete.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Ketik kata <strong className="text-rose-600">HAPUS</strong> untuk mengonfirmasi:
                  </label>
                  <input
                    type="text"
                    value={bulkDeleteConfirmInput}
                    onChange={(e) => setBulkDeleteConfirmInput(e.target.value)}
                    placeholder="HAPUS"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 font-mono font-bold focus:ring-2 focus:ring-rose-500 uppercase"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  targetStudentsForBulkDelete.length === 0 ||
                  bulkDeleteConfirmInput.trim().toUpperCase() !== 'HAPUS'
                }
                onClick={handleConfirmBulkDelete}
                className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Hapus {targetStudentsForBulkDelete.length} Siswa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
