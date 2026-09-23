import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
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
import { StudentFormModal } from './StudentFormModal';
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

  // Check if any demo sample students exist in current dataset
  const demoStudentIds = useMemo(() => {
    const demoNisns = new Set([
      '0081234561', '0081234562', '0081234563', '0081234564',
      '0081234565', '0081234566', '0081234567', '0081234568',
      '0081234569', '0081234570', '0081234571', '0081234572'
    ]);
    const demoIds = new Set([
      'std-001', 'std-002', 'std-003', 'std-004',
      'std-005', 'std-006', 'std-007', 'std-008',
      'std-009', 'std-010', 'std-011', 'std-012'
    ]);
    return students
      .filter(s => demoNisns.has(s.nisn) || demoIds.has(s.id))
      .map(s => s.id);
  }, [students]);

  const handleCleanDemoStudents = () => {
    if (demoStudentIds.length === 0) {
      alert('Tidak ada data siswa contoh demo yang ditemukan.');
      return;
    }

    if (window.confirm(`Hapus permanen ${demoStudentIds.length} data siswa contoh bawaan demo? Data siswa asli Anda (beserta foto yang diupload) akan tetap aman.`)) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('sihadir_demo_data_cleared', 'true');
      }
      if (onBatchDeleteStudents) {
        onBatchDeleteStudents(demoStudentIds);
      } else {
        demoStudentIds.forEach(id => onDeleteStudent(id));
      }
      alert(`Berhasil menghapus permanen ${demoStudentIds.length} siswa demo! Total siswa sekarang pas dengan data asli Anda.`);
    }
  };

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // High-Performance Search & Filter Pipeline
  // 1. Deferred search value to ensure input field typing is instant and 60fps
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // 2. Pre-sort all students once by name. Executes only when `students` array reference changes!
  const baseSortedStudents = useMemo(() => {
    return [...students].sort((a, b) =>
      a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
    );
  }, [students]);

  // 3. Pre-calculate active class lookup once per class filter change
  const activeClassTarget = useMemo(() => {
    if (selectedClass === 'ALL') return null;
    const target = selectedClass.trim().toLowerCase();
    const matchedClass = classes.find(
      c => c.name.toLowerCase() === target || c.id.toLowerCase() === target
    );
    return {
      target,
      matchedId: matchedClass?.id?.toLowerCase() || '',
      matchedName: matchedClass?.name?.toLowerCase() || ''
    };
  }, [selectedClass, classes]);

  // 4. Ultra-fast student filter (preserving sorted order with zero localeCompare on keystroke)
  const filteredStudents = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    if (!query && !activeClassTarget) {
      return baseSortedStudents;
    }

    return baseSortedStudents.filter(s => {
      // Fast class filter check
      if (activeClassTarget) {
        const sClassId = (s.classId || '').toLowerCase();
        const sClassName = (s.className || '').toLowerCase();
        const matchesClass =
          sClassName === activeClassTarget.target ||
          sClassId === activeClassTarget.target ||
          (activeClassTarget.matchedId && sClassId === activeClassTarget.matchedId) ||
          (activeClassTarget.matchedName && sClassName === activeClassTarget.matchedName);
        if (!matchesClass) return false;
      }

      // Fast search filter check
      if (query) {
        const nameMatch = s.name ? s.name.toLowerCase().includes(query) : false;
        const nisnMatch = s.nisn ? s.nisn.includes(query) : false;
        const nisMatch = s.nis ? s.nis.includes(query) : false;
        if (!nameMatch && !nisnMatch && !nisMatch) return false;
      }

      return true;
    });
  }, [baseSortedStudents, deferredSearchQuery, activeClassTarget]);

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
    setIsFormOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setIsFormOpen(true);
  };

  const handleSaveStudent = (student: Student) => {
    if (editingStudent) {
      onUpdateStudent(student);
    } else {
      onAddStudent(student);
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

            {/* Tombol Bersihkan 12 Siswa Demo (Hanya muncul jika siswa demo terdeteksi) */}
            {demoStudentIds.length > 0 && (
              <button
                type="button"
                onClick={handleCleanDemoStudents}
                className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/20 shrink-0 animate-pulse hover:animate-none"
                title="Hapus permanen 12 siswa contoh demo bawaan sistem (foto dan data asli Anda tetap aman 100%)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan {demoStudentIds.length} Siswa Demo</span>
              </button>
            )}
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
                  src={student.photoUrl || (student.gender === 'P'
                    ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                    : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80')}
                  alt={student.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = student.gender === 'P'
                      ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                      : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80';
                  }}
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-100 group-hover:ring-indigo-300 shadow-sm bg-slate-100"
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
      <StudentFormModal
        isOpen={isFormOpen}
        editingStudent={editingStudent}
        classes={sortedClasses}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveStudent}
      />

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
