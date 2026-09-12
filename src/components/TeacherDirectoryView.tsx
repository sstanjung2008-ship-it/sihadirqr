import React, { useState, useMemo } from 'react';
import { Teacher, SchoolClass, SchoolProfile } from '../types';
import { downloadTeacherImportTemplate } from '../lib/exportUtils';
import { ImportTeachersModal } from './ImportTeachersModal';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Award, 
  BookOpen, 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  CheckCircle2, 
  X, 
  Building2, 
  ShieldCheck, 
  UserCheck, 
  Filter, 
  XCircle, 
  Download, 
  Megaphone, 
  HeartHandshake, 
  Upload, 
  FileSpreadsheet, 
  Shield, 
  FileText, 
  Library,
  Briefcase,
  Layers,
  GraduationCap
} from 'lucide-react';

interface TeacherDirectoryViewProps {
  teachers: Teacher[];
  classes: SchoolClass[];
  schoolProfile: SchoolProfile;
  onAddTeacher: (teacher: Omit<Teacher, 'id'>) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  onImportTeachers?: (newTeachers: Teacher[]) => void;
}

const TU_POSITIONS = [
  'Tata Usaha / Administrasi Umum',
  'Kepala Tata Usaha (KTU)',
  'Administrasi Kepegawaian',
  'Administrasi Kesiswaan',
  'Administrasi Keuangan / Bendahara',
  'Operator Dapodik & IT',
  'Persuratan & Pengarsipan / Arsiparis',
  'Sarana & Prasarana',
  'Layanan Perpustakaan',
  'Laboran / Teknisi Laboratorium',
  'Petugas Keamanan / Satpam',
  'Petugas Kebersihan / Pramubakti',
  'Lainnya (Ketik Manual)'
];

export const TeacherDirectoryView: React.FC<TeacherDirectoryViewProps> = ({
  teachers,
  classes,
  schoolProfile,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onImportTeachers,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'GURU' | 'TU'>('ALL');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [dutyFilter, setDutyFilter] = useState('');
  const [viewMode, setViewMode] = useState<'CARD' | 'TABLE'>('CARD');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<'GURU' | 'TU'>('GURU');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [customTuPosition, setCustomTuPosition] = useState('');

  // Memoized default subjects list from School Profile (synced across devices)
  const availableSubjects = useMemo(() => {
    const list = schoolProfile.subjects && schoolProfile.subjects.length > 0 
      ? schoolProfile.subjects 
      : ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PJOK', 'Seni Budaya', 'Informatika', 'PPKn'];
    return Array.from(new Set(list.map(s => String(s).trim()).filter(Boolean)));
  }, [schoolProfile.subjects]);

  // Check if any demo sample teachers exist in current dataset
  const demoTeacherIds = useMemo(() => {
    const demoNips = new Set([
      '19850312 201001 2 015',
      '19790820 200501 1 008',
      '19881105 201402 2 009',
      '19910403 201903 1 011',
      '19830218 200902 2 004',
      '19820514 200801 2 006',
      '19900210 201801 1 003',
      '19870615 201101 1 005'
    ]);
    const demoIds = new Set([
      'tch-001', 'tch-002', 'tch-003', 'tch-004',
      'tch-005', 'tch-006', 'tch-007', 'tch-008'
    ]);
    return teachers
      .filter(t => demoNips.has(t.nip) || demoIds.has(t.id))
      .map(t => t.id);
  }, [teachers]);

  const handleCleanDemoTeachers = () => {
    if (demoTeacherIds.length === 0) {
      alert('Tidak ada data guru contoh demo yang ditemukan.');
      return;
    }

    if (window.confirm(`Hapus permanen ${demoTeacherIds.length} data guru contoh bawaan demo? Data guru & TU asli sekolah Anda akan tetap aman 100%.`)) {
      demoTeacherIds.forEach(id => onDeleteTeacher(id));
      alert(`Berhasil menghapus permanen ${demoTeacherIds.length} guru demo!`);
    }
  };

  // Form State
  const emptyForm = {
    nip: '',
    name: '',
    birthPlace: '',
    birthDate: '',
    gender: 'L' as 'L' | 'P',
    subject1: '',
    subject2: '',
    additionalDuty: 'TIDAK_ADA' as 'WAKIL_KEPALA_SEKOLAH' | 'HUMAS' | 'BK' | 'ADMIN' | 'TU' | 'PERPUSTAKAAN' | 'WALI_KELAS' | 'TIDAK_ADA',
    homeroomClassId: '',
    homeroomClassName: '',
    phone: '',
    email: '',
    status: 'AKTIF' as 'AKTIF' | 'NON_AKTIF',
  };

  const [formData, setFormData] = useState(emptyForm);

  // Helper to determine accurate homeroom class info directly from classes data (Kelola Kelas)
  const getTeacherHomeroomInfo = (teacher: Teacher) => {
    // 1. Check if this teacher is assigned as homeroom teacher in any class in classes (Kelola Kelas)
    const matchedClass = classes.find(c => 
      (c.homeroomTeacher && c.homeroomTeacher !== 'Belum Ditentukan' && (
        c.homeroomTeacher === teacher.name ||
        c.homeroomTeacher.toLowerCase().trim() === teacher.name.toLowerCase().trim() ||
        (teacher.nip && c.homeroomTeacher.includes(teacher.nip))
      )) ||
      (teacher.homeroomClassId && c.id === teacher.homeroomClassId)
    );

    if (matchedClass) {
      return {
        isHomeroom: true,
        classId: matchedClass.id,
        className: matchedClass.name,
        grade: matchedClass.grade,
        fullLabel: `${matchedClass.grade} - ${matchedClass.name}`
      };
    }

    // 2. Fallback to teacher's saved homeroom details if marked as WALI_KELAS
    if (teacher.additionalDuty === 'WALI_KELAS') {
      const fallbackClass = classes.find(c => 
        c.id === teacher.homeroomClassId || 
        c.name === teacher.homeroomClassName ||
        c.name.toLowerCase() === (teacher.homeroomClassName || '').toLowerCase()
      );
      if (fallbackClass) {
        return {
          isHomeroom: true,
          classId: fallbackClass.id,
          className: fallbackClass.name,
          grade: fallbackClass.grade,
          fullLabel: `${fallbackClass.grade} - ${fallbackClass.name}`
        };
      }
      return {
        isHomeroom: true,
        classId: teacher.homeroomClassId || '',
        className: teacher.homeroomClassName || 'Belum Ditentukan',
        grade: '',
        fullLabel: teacher.homeroomClassName || 'Belum Ditentukan'
      };
    }

    return {
      isHomeroom: false,
      classId: '',
      className: '',
      grade: '',
      fullLabel: ''
    };
  };

  const handleOpenAddGuruModal = () => {
    setEditingTeacher(null);
    setModalRole('GURU');
    setFormData({
      ...emptyForm,
      additionalDuty: 'TIDAK_ADA',
      subject1: availableSubjects[0] || '',
    });
    setCustomTuPosition('');
    setIsModalOpen(true);
  };

  const handleOpenAddTuModal = () => {
    setEditingTeacher(null);
    setModalRole('TU');
    setFormData({
      ...emptyForm,
      additionalDuty: 'TU',
      subject1: 'Tata Usaha / Administrasi Umum',
    });
    setCustomTuPosition('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    const isTu = teacher.additionalDuty === 'TU';
    setModalRole(isTu ? 'TU' : 'GURU');
    
    const homeroomInfo = getTeacherHomeroomInfo(teacher);
    const isKnownTuPosition = TU_POSITIONS.includes(teacher.subject1 || '');
    if (isTu && !isKnownTuPosition && teacher.subject1) {
      setCustomTuPosition(teacher.subject1);
    } else {
      setCustomTuPosition('');
    }

    setFormData({
      nip: teacher.nip || '',
      name: teacher.name || '',
      birthPlace: teacher.birthPlace || '',
      birthDate: teacher.birthDate || '',
      gender: teacher.gender || 'L',
      subject1: teacher.subject1 || (isTu ? 'Tata Usaha / Administrasi Umum' : ''),
      subject2: teacher.subject2 || '',
      additionalDuty: isTu ? 'TU' : (homeroomInfo.isHomeroom ? 'WALI_KELAS' : (teacher.additionalDuty || 'TIDAK_ADA')),
      homeroomClassId: homeroomInfo.classId || teacher.homeroomClassId || (classes[0]?.id || ''),
      homeroomClassName: homeroomInfo.className || teacher.homeroomClassName || (classes[0]?.name || ''),
      phone: teacher.phone || '',
      email: teacher.email || '',
      status: teacher.status || 'AKTIF',
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert(`Nama ${modalRole === 'TU' ? 'pegawai TU' : 'guru'} wajib diisi.`);
      return;
    }
    if (!formData.nip.trim()) {
      alert(`NIP / NIK ${modalRole === 'TU' ? 'pegawai TU' : 'guru'} wajib diisi.`);
      return;
    }
    if (!formData.phone.trim()) {
      alert('No. Handphone / WhatsApp wajib diisi.');
      return;
    }

    // Determine homeroom class name if WALI_KELAS selected
    let targetClassId = formData.homeroomClassId;
    let targetClassName = formData.homeroomClassName;

    if (modalRole === 'GURU' && formData.additionalDuty === 'WALI_KELAS') {
      if (targetClassId) {
        const foundClass = classes.find(c => c.id === targetClassId);
        if (foundClass) {
          targetClassName = foundClass.name;
        }
      } else if (targetClassName) {
        const foundClass = classes.find(c => c.name === targetClassName || c.name.toLowerCase() === targetClassName.toLowerCase());
        if (foundClass) {
          targetClassId = foundClass.id;
          targetClassName = foundClass.name;
        }
      } else if (classes.length > 0) {
        targetClassId = classes[0].id;
        targetClassName = classes[0].name;
      }
    } else {
      targetClassId = '';
      targetClassName = '';
    }

    // Finalize subject / position based on role
    let finalSubject1 = formData.subject1;
    let finalDuty = modalRole === 'TU' ? 'TU' : formData.additionalDuty;

    if (modalRole === 'TU') {
      if (formData.subject1 === 'Lainnya (Ketik Manual)' && customTuPosition.trim()) {
        finalSubject1 = customTuPosition.trim();
      } else if (!finalSubject1) {
        finalSubject1 = 'Tata Usaha / Administrasi Umum';
      }
    }

    const payload = {
      ...formData,
      subject1: finalSubject1,
      subject2: modalRole === 'TU' ? '' : formData.subject2,
      additionalDuty: finalDuty,
      homeroomClassId: targetClassId,
      homeroomClassName: targetClassName,
    };

    if (editingTeacher) {
      onUpdateTeacher({
        ...editingTeacher,
        ...payload,
      });
    } else {
      onAddTeacher(payload);
    }

    setIsModalOpen(false);
  };

  // Filtering
  const filteredTeachers = teachers.filter((teacher) => {
    const isTu = teacher.additionalDuty === 'TU';

    // 1. Category Filter
    if (categoryFilter === 'GURU' && isTu) return false;
    if (categoryFilter === 'TU' && !isTu) return false;

    // 2. Search Term
    const matchesSearch = 
      teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.nip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (teacher.phone && teacher.phone.includes(searchTerm)) ||
      (teacher.subject1 && teacher.subject1.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (teacher.subject2 && teacher.subject2.toLowerCase().includes(searchTerm.toLowerCase()));

    // 3. Subject Filter
    const matchesSubject = !subjectFilter || teacher.subject1 === subjectFilter || teacher.subject2 === subjectFilter;
    
    // 4. Duty Filter
    const homeroomInfo = getTeacherHomeroomInfo(teacher);

    let matchesDuty = true;
    if (dutyFilter === 'WAKIL_KEPALA_SEKOLAH') matchesDuty = teacher.additionalDuty === 'WAKIL_KEPALA_SEKOLAH';
    if (dutyFilter === 'HUMAS') matchesDuty = teacher.additionalDuty === 'HUMAS';
    if (dutyFilter === 'BK') matchesDuty = teacher.additionalDuty === 'BK';
    if (dutyFilter === 'ADMIN') matchesDuty = teacher.additionalDuty === 'ADMIN';
    if (dutyFilter === 'TU') matchesDuty = teacher.additionalDuty === 'TU';
    if (dutyFilter === 'PERPUSTAKAAN') matchesDuty = teacher.additionalDuty === 'PERPUSTAKAAN';
    if (dutyFilter === 'WALI_KELAS') matchesDuty = homeroomInfo.isHomeroom || teacher.additionalDuty === 'WALI_KELAS';
    if (dutyFilter === 'GURU_MAPEL') matchesDuty = !isTu && !homeroomInfo.isHomeroom && (teacher.additionalDuty === 'TIDAK_ADA' || !teacher.additionalDuty);

    return matchesSearch && matchesSubject && matchesDuty;
  });

  const totalTeachers = teachers.filter(t => t.additionalDuty !== 'TU').length;
  const totalTU = teachers.filter(t => t.additionalDuty === 'TU').length;
  const totalWakil = teachers.filter(t => t.additionalDuty === 'WAKIL_KEPALA_SEKOLAH').length;
  const totalHumas = teachers.filter(t => t.additionalDuty === 'HUMAS').length;
  const totalBK = teachers.filter(t => t.additionalDuty === 'BK').length;
  const totalAdmin = teachers.filter(t => t.additionalDuty === 'ADMIN').length;
  const totalPerpus = teachers.filter(t => t.additionalDuty === 'PERPUSTAKAAN').length;
  const totalWali = teachers.filter(t => getTeacherHomeroomInfo(t).isHomeroom || t.additionalDuty === 'WALI_KELAS').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-extrabold border border-indigo-500/30">
            <UserCheck className="w-3.5 h-3.5" />
            Manajemen Guru & Staf Tata Usaha (TU)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Database Guru & TU</h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
            Kelola data bapak/ibu guru dan staf Tata Usaha (TU), NIP/NIK/NUPTK, bidang kerja administrasi, mata pelajaran, serta tugas tambahan sekolah.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-2 relative z-10 shrink-0 w-full md:w-64">
          <button
            type="button"
            onClick={downloadTeacherImportTemplate}
            className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center justify-start gap-2.5 border border-slate-700 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Download Format Impor Data</span>
          </button>
          
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-start gap-2.5 shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-amber-200 shrink-0" />
            <span>Impor Data Guru & TU</span>
          </button>

          {/* Tombol Tambah TU */}
          <button
            type="button"
            onClick={handleOpenAddTuModal}
            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-start gap-2.5 shadow-lg shadow-teal-600/30 transition-all cursor-pointer border border-teal-400/30"
          >
            <Briefcase className="w-4 h-4 text-teal-200 shrink-0" />
            <span>+ Tambah Pegawai TU</span>
          </button>

          {/* Tombol Tambah Guru Baru */}
          <button
            type="button"
            onClick={handleOpenAddGuruModal}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-start gap-2.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>+ Tambah Guru Baru</span>
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Keseluruhan */}
        <div 
          onClick={() => setCategoryFilter('ALL')}
          className={`bg-white border rounded-2xl p-4 shadow-xs transition-all cursor-pointer ${
            categoryFilter === 'ALL' ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Guru & TU</p>
              <p className="text-2xl font-black text-slate-800 mt-0.5">{teachers.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Guru Pendidik */}
        <div 
          onClick={() => setCategoryFilter('GURU')}
          className={`bg-white border rounded-2xl p-4 shadow-xs transition-all cursor-pointer ${
            categoryFilter === 'GURU' ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Guru Pendidik</p>
              <p className="text-2xl font-black text-indigo-600 mt-0.5">{totalTeachers}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Pegawai TU */}
        <div 
          onClick={() => setCategoryFilter('TU')}
          className={`bg-white border rounded-2xl p-4 shadow-xs transition-all cursor-pointer ${
            categoryFilter === 'TU' ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20' : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold text-teal-600 uppercase tracking-wider">Pegawai TU</p>
              <p className="text-2xl font-black text-teal-700 mt-0.5">{totalTU}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Wali Kelas */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Wali Kelas</p>
              <p className="text-2xl font-black text-emerald-600 mt-0.5">{totalWali}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Wakasek & Tim */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Wakasek & Tim</p>
              <p className="text-2xl font-black text-amber-600 mt-0.5">{totalWakil + totalHumas + totalBK}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
        {/* Category Pill Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                categoryFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({teachers.length})
            </button>
            <button
              onClick={() => setCategoryFilter('GURU')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'GURU' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Guru Pendidik ({totalTeachers})
            </button>
            <button
              onClick={() => setCategoryFilter('TU')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'TU' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-teal-700'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Pegawai TU ({totalTU})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setViewMode('CARD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'CARD' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kartu
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'TABLE' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel
              </button>
            </div>

            {/* Tombol Bersihkan Guru Demo */}
            {demoTeacherIds.length > 0 && (
              <button
                type="button"
                onClick={handleCleanDemoTeachers}
                className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
                title="Hapus permanen data contoh demo bawaan sistem"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bersihkan {demoTeacherIds.length} Demo</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Secondary Filter Dropdowns */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan nama, NIP/NIK, mapel, posisi TU, atau nomor HP..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Mapel */}
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[160px]"
            >
              <option value="">Semua Mapel</option>
              {availableSubjects.map((sub, idx) => (
                <option key={idx} value={sub}>{sub}</option>
              ))}
            </select>

            {/* Filter Tugas / Jabatan */}
            <select
              value={dutyFilter}
              onChange={(e) => setDutyFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">Semua Jabatan/Tugas</option>
              <option value="TU">Pegawai TU</option>
              <option value="WAKIL_KEPALA_SEKOLAH">Wakasek</option>
              <option value="HUMAS">Humas</option>
              <option value="BK">BK</option>
              <option value="ADMIN">Admin</option>
              <option value="PERPUSTAKAAN">Perpustakaan</option>
              <option value="WALI_KELAS">Wali Kelas</option>
              <option value="GURU_MAPEL">Guru Mapel</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Display */}
      {filteredTeachers.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Tidak ada data ditemukan</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tidak ditemukan data guru atau pegawai TU yang sesuai dengan kata kunci pencarian atau filter yang Anda pilih.
          </p>
          {(searchTerm || subjectFilter || dutyFilter || categoryFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('ALL');
                setSubjectFilter('');
                setDutyFilter('');
              }}
              className="text-xs text-indigo-600 font-extrabold hover:underline pt-2 cursor-pointer"
            >
              Reset semua filter
            </button>
          )}
        </div>
      ) : viewMode === 'CARD' ? (
        /* CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeachers.map((teacher) => {
            const isTu = teacher.additionalDuty === 'TU';
            const homeroomInfo = getTeacherHomeroomInfo(teacher);

            return (
              <div
                key={teacher.id}
                className={`bg-white border rounded-3xl p-5 shadow-xs hover:shadow-md transition-all space-y-4 relative flex flex-col justify-between group ${
                  isTu ? 'border-teal-200/80 hover:border-teal-400' : 'border-slate-200/80 hover:border-indigo-300'
                }`}
              >
                <div className="space-y-3">
                  {/* Header Badge & Action */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {isTu ? (
                        <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                          <Briefcase className="w-3 h-3 text-teal-600" />
                          Pegawai TU {teacher.subject1 ? `• ${teacher.subject1}` : ''}
                        </span>
                      ) : homeroomInfo.isHomeroom ? (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                          <Building2 className="w-3 h-3 text-indigo-600" />
                          Wali Kelas {homeroomInfo.className || homeroomInfo.fullLabel}
                        </span>
                      ) : teacher.additionalDuty === 'WAKIL_KEPALA_SEKOLAH' ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                          <ShieldCheck className="w-3 h-3 text-amber-600" />
                          Wakasek
                        </span>
                      ) : teacher.additionalDuty === 'HUMAS' ? (
                        <span className="inline-flex items-center gap-1 bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                          <Megaphone className="w-3 h-3 text-cyan-600" />
                          Humas
                        </span>
                      ) : teacher.additionalDuty === 'BK' ? (
                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                          <HeartHandshake className="w-3 h-3 text-purple-600" />
                          BK
                        </span>
                      ) : teacher.additionalDuty === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                          <Shield className="w-3 h-3 text-blue-600" />
                          Admin
                        </span>
                      ) : teacher.additionalDuty === 'PERPUSTAKAAN' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-xl shadow-2xs">
                          <Library className="w-3 h-3 text-emerald-600" />
                          Perpustakaan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-xl">
                          Guru Mata Pelajaran
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(teacher)}
                        className={`p-1.5 text-slate-400 rounded-lg transition-colors cursor-pointer ${
                          isTu ? 'hover:text-teal-600 hover:bg-teal-50' : 'hover:text-indigo-600 hover:bg-indigo-50'
                        }`}
                        title={isTu ? 'Edit Data Pegawai TU' : 'Edit Data Guru'}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(teacher.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Data"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Profile Avatar & Info */}
                  <div className="flex items-start gap-3 pt-1">
                    <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0 uppercase ${
                      isTu 
                        ? 'bg-gradient-to-br from-teal-500 to-teal-700' 
                        : 'bg-gradient-to-br from-indigo-500 to-indigo-700'
                    }`}>
                      {teacher.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className={`font-extrabold text-slate-900 text-sm leading-snug truncate transition-colors ${
                        isTu ? 'group-hover:text-teal-600' : 'group-hover:text-indigo-600'
                      }`}>
                        {teacher.name}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500 font-semibold mt-0.5">
                        {isTu ? 'NIP/NIK' : 'NIP'}: {teacher.nip || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Meta details */}
                  <div className="bg-slate-50/80 rounded-2xl p-3 space-y-2 border border-slate-100 text-xs">
                    <div className="flex items-center text-slate-600 gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">TTL: <strong className="text-slate-800">{teacher.birthPlace || '-'}, {teacher.birthDate || '-'}</strong></span>
                    </div>

                    {isTu ? (
                      <div className="flex items-center text-slate-600 gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <div className="flex flex-wrap gap-1 min-w-0">
                          <span className="bg-white border border-teal-200 text-teal-800 font-extrabold px-2 py-0.5 rounded-lg text-[10px]">
                            {teacher.subject1 || 'Tata Usaha / Administrasi'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center text-slate-600 gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <div className="flex flex-wrap gap-1 min-w-0">
                          {teacher.subject1 ? (
                            <span className="bg-white border border-slate-200 text-slate-800 font-extrabold px-2 py-0.5 rounded-lg text-[10px]">
                              {teacher.subject1}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Tidak ada mapel</span>
                          )}
                          {teacher.subject2 && (
                            <span className="bg-white border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-lg text-[10px]">
                              {teacher.subject2}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {(teacher.phone || teacher.email) && (
                      <div className="pt-1.5 border-t border-slate-200/60 flex flex-col gap-1 text-[11px] text-slate-500 font-medium">
                        {teacher.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{teacher.phone}</span>
                          </div>
                        )}
                        {teacher.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{teacher.email}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">
                    Jenis Kelamin: <strong className="text-slate-700">{teacher.gender === 'P' ? 'Perempuan' : 'Laki-laki'}</strong>
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    isTu ? 'text-teal-700 bg-teal-50' : 'text-emerald-700 bg-emerald-50'
                  }`}>
                    <CheckCircle2 className="w-3 h-3" />
                    {isTu ? 'Pegawai Aktif' : 'Guru Aktif'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">No</th>
                  <th className="py-3.5 px-4">Nama & NIP/NIK</th>
                  <th className="py-3.5 px-4">Kategori / Jabatan</th>
                  <th className="py-3.5 px-4">Mata Pelajaran / Bidang TU</th>
                  <th className="py-3.5 px-4">Tempat, Tgl Lahir</th>
                  <th className="py-3.5 px-4">Kontak Login</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTeachers.map((teacher, index) => {
                  const isTu = teacher.additionalDuty === 'TU';
                  const homeroomInfo = getTeacherHomeroomInfo(teacher);

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400">{index + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          {teacher.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {isTu ? 'NIK/NIP' : 'NIP'}: {teacher.nip || '-'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isTu ? (
                          <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 font-black px-2.5 py-1 rounded-lg text-[10px] border border-teal-200">
                            <Briefcase className="w-3 h-3 text-teal-600" />
                            Pegawai TU
                          </span>
                        ) : homeroomInfo.isHomeroom ? (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 font-black px-2.5 py-1 rounded-lg text-[10px] border border-indigo-200">
                            <Building2 className="w-3 h-3 text-indigo-600" />
                            Wali Kelas {homeroomInfo.className || homeroomInfo.fullLabel}
                          </span>
                        ) : teacher.additionalDuty === 'WAKIL_KEPALA_SEKOLAH' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-black px-2.5 py-1 rounded-lg text-[10px] border border-amber-200">
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            Wakasek
                          </span>
                        ) : teacher.additionalDuty === 'HUMAS' ? (
                          <span className="inline-flex items-center gap-1 bg-cyan-50 text-cyan-800 font-black px-2.5 py-1 rounded-lg text-[10px] border border-cyan-200">
                            <Megaphone className="w-3 h-3 text-cyan-600" />
                            Humas
                          </span>
                        ) : teacher.additionalDuty === 'BK' ? (
                          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 font-black px-2.5 py-1 rounded-lg text-[10px] border border-purple-200">
                            <HeartHandshake className="w-3 h-3 text-purple-600" />
                            BK
                          </span>
                        ) : teacher.additionalDuty === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 font-black px-2.5 py-1 rounded-lg text-[10px] border border-blue-200">
                            <Shield className="w-3 h-3 text-blue-600" />
                            Admin
                          </span>
                        ) : teacher.additionalDuty === 'PERPUSTAKAAN' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 font-black px-2.5 py-1 rounded-lg text-[10px] border border-emerald-200">
                            <Library className="w-3 h-3 text-emerald-600" />
                            Perpustakaan
                          </span>
                        ) : (
                          <span className="text-slate-500 font-semibold text-[11px]">Guru Mapel</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {isTu ? (
                          <span className="bg-teal-50 text-teal-800 font-extrabold px-2 py-0.5 rounded-md text-[10px] border border-teal-100">
                            {teacher.subject1 || 'Tata Usaha Umum'}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {teacher.subject1 ? (
                              <span className="bg-indigo-50 text-indigo-800 font-extrabold px-2 py-0.5 rounded-md text-[10px]">
                                {teacher.subject1}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
                            {teacher.subject2 && (
                              <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                {teacher.subject2}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {teacher.birthPlace || '-'}, {teacher.birthDate || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        <div className="font-mono font-bold text-slate-800">{teacher.phone || '-'}</div>
                        <div className="text-[10px] text-slate-400">{teacher.email || ''}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(teacher)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(teacher.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Data"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT (GURU & TU) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                  modalRole === 'TU' ? 'bg-teal-50 text-teal-600' : 'bg-indigo-50 text-indigo-600'
                }`}>
                  {modalRole === 'TU' ? <Briefcase className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingTeacher 
                      ? (modalRole === 'TU' ? 'Edit Data Pegawai TU' : 'Edit Data Guru')
                      : (modalRole === 'TU' ? 'Tambah Data Pegawai TU (Tata Usaha)' : 'Tambah Data Guru Baru')
                    }
                  </h3>
                  <p className="text-xs text-slate-500">
                    {modalRole === 'TU' 
                      ? 'Input data lengkap staf administrasi & tata usaha sekolah.'
                      : 'Isi lengkap data tenaga pendidik dan penugasan mengajar.'
                    }
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Switcher in Modal (if adding new) */}
            {!editingTeacher && (
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setModalRole('GURU');
                    setFormData(prev => ({
                      ...prev,
                      additionalDuty: 'TIDAK_ADA',
                      subject1: availableSubjects[0] || '',
                    }));
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    modalRole === 'GURU'
                      ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Data Tenaga Guru Pendidik</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalRole('TU');
                    setFormData(prev => ({
                      ...prev,
                      additionalDuty: 'TU',
                      subject1: 'Tata Usaha / Administrasi Umum',
                    }));
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    modalRole === 'TU'
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'text-slate-600 hover:text-teal-700'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Data Pegawai TU (Tata Usaha)</span>
                </button>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Guru / TU */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    {modalRole === 'TU' ? 'Nama Lengkap Pegawai TU & Gelar' : 'Nama Lengkap Guru & Gelar'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={modalRole === 'TU' ? 'Contoh: Siti Aminah, S.Kom' : 'Contoh: Drs. Ahmad Hidayat, M.Pd.'}
                    className={`w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-3 ${
                      modalRole === 'TU' ? 'focus:ring-2 focus:ring-teal-500' : 'focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />
                </div>

                {/* NIP / NIK */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    {modalRole === 'TU' ? 'NIP / NIK / NUPTK Pegawai TU' : 'NIP (Nomor Induk Pegawai)'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nip}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    placeholder={modalRole === 'TU' ? 'Contoh: 19920415 202001 2 005 / NIK' : '19850312 201001 2 015'}
                    className={`w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono font-semibold rounded-xl p-3 ${
                      modalRole === 'TU' ? 'focus:ring-2 focus:ring-teal-500' : 'focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />
                </div>

                {/* Jenis Kelamin */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'L' | 'P' })}
                    className={`w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-3 cursor-pointer ${
                      modalRole === 'TU' ? 'focus:ring-2 focus:ring-teal-500' : 'focus:ring-2 focus:ring-indigo-500'
                    }`}
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                {/* No. Handphone / WhatsApp (Username Login) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    No. Handphone / WhatsApp (Username Login) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Contoh: 081234567890"
                    className={`w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono font-semibold rounded-xl p-3 ${
                      modalRole === 'TU' ? 'focus:ring-2 focus:ring-teal-500' : 'focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    *Wajib diisi sebagai Username untuk login absensi dan sistem presensi sekolah.
                  </p>
                </div>

                {/* TU Specific Input: Posisi / Bidang Kerja TU */}
                {modalRole === 'TU' ? (
                  <div className="sm:col-span-2 bg-teal-50/60 border border-teal-200 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-extrabold text-teal-950">
                      Bidang / Posisi Tata Usaha (TU) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={TU_POSITIONS.includes(formData.subject1) ? formData.subject1 : (formData.subject1 ? 'Lainnya (Ketik Manual)' : 'Tata Usaha / Administrasi Umum')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Lainnya (Ketik Manual)') {
                          setFormData({ ...formData, subject1: 'Lainnya (Ketik Manual)' });
                        } else {
                          setFormData({ ...formData, subject1: val });
                          setCustomTuPosition('');
                        }
                      }}
                      className="w-full bg-white border border-teal-300 text-slate-900 text-xs font-bold rounded-xl p-3 focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
                    >
                      {TU_POSITIONS.map((pos, idx) => (
                        <option key={idx} value={pos}>{pos}</option>
                      ))}
                    </select>

                    {(formData.subject1 === 'Lainnya (Ketik Manual)' || (!TU_POSITIONS.includes(formData.subject1) && formData.subject1)) && (
                      <div className="pt-2">
                        <label className="block text-[11px] font-bold text-teal-900 mb-1">
                          Ketik Nama Posisi / Jabatan TU Khusus:
                        </label>
                        <input
                          type="text"
                          required
                          value={customTuPosition || formData.subject1}
                          onChange={(e) => {
                            setCustomTuPosition(e.target.value);
                            setFormData({ ...formData, subject1: e.target.value });
                          }}
                          placeholder="Misal: Staf Verifikator Absensi"
                          className="w-full bg-white border border-teal-300 text-slate-900 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Guru Specific Inputs: Mapel 1 & Mapel 2 */
                  <>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">
                        Mata Pelajaran 1 (Utama)
                      </label>
                      <select
                        value={formData.subject1}
                        onChange={(e) => setFormData({ ...formData, subject1: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Pilih Mata Pelajaran --</option>
                        {formData.subject1 && !availableSubjects.includes(formData.subject1) && (
                          <option value={formData.subject1}>{formData.subject1}</option>
                        )}
                        {availableSubjects.map((sub, idx) => (
                          <option key={idx} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">
                        Mata Pelajaran 2 (Opsional)
                      </label>
                      <select
                        value={formData.subject2}
                        onChange={(e) => setFormData({ ...formData, subject2: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Tidak Ada --</option>
                        {formData.subject2 && !availableSubjects.includes(formData.subject2) && (
                          <option value={formData.subject2}>{formData.subject2}</option>
                        )}
                        {availableSubjects.map((sub, idx) => (
                          <option key={idx} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Tugas Tambahan Khusus Guru */}
              {modalRole === 'GURU' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <label className="block text-xs font-extrabold text-slate-800">
                    Tugas Tambahan Guru Sekolah
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <label className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      formData.additionalDuty === 'TIDAK_ADA' 
                        ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-1 ring-indigo-600' 
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="additionalDuty"
                        checked={formData.additionalDuty === 'TIDAK_ADA'}
                        onChange={() => setFormData({ ...formData, additionalDuty: 'TIDAK_ADA', homeroomClassId: '', homeroomClassName: '' })}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>Guru Mapel</span>
                    </label>

                    <label className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      formData.additionalDuty === 'WAKIL_KEPALA_SEKOLAH' 
                        ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-1 ring-indigo-600' 
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="additionalDuty"
                        checked={formData.additionalDuty === 'WAKIL_KEPALA_SEKOLAH'}
                        onChange={() => setFormData({ ...formData, additionalDuty: 'WAKIL_KEPALA_SEKOLAH', homeroomClassId: '', homeroomClassName: '' })}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>Wakasek</span>
                    </label>

                    <label className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      formData.additionalDuty === 'HUMAS' 
                        ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-1 ring-indigo-600' 
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="additionalDuty"
                        checked={formData.additionalDuty === 'HUMAS'}
                        onChange={() => setFormData({ ...formData, additionalDuty: 'HUMAS', homeroomClassId: '', homeroomClassName: '' })}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>Humas</span>
                    </label>

                    <label className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      formData.additionalDuty === 'BK' 
                        ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-1 ring-indigo-600' 
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="additionalDuty"
                        checked={formData.additionalDuty === 'BK'}
                        onChange={() => setFormData({ ...formData, additionalDuty: 'BK', homeroomClassId: '', homeroomClassName: '' })}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>BK</span>
                    </label>

                    <label className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      formData.additionalDuty === 'ADMIN' 
                        ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-1 ring-indigo-600' 
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="additionalDuty"
                        checked={formData.additionalDuty === 'ADMIN'}
                        onChange={() => setFormData({ ...formData, additionalDuty: 'ADMIN', homeroomClassId: '', homeroomClassName: '' })}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-blue-600" />
                        Admin
                      </span>
                    </label>

                    <label className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      formData.additionalDuty === 'PERPUSTAKAAN' 
                        ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-1 ring-indigo-600' 
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="additionalDuty"
                        checked={formData.additionalDuty === 'PERPUSTAKAAN'}
                        onChange={() => setFormData({ ...formData, additionalDuty: 'PERPUSTAKAAN', homeroomClassId: '', homeroomClassName: '' })}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <Library className="w-3.5 h-3.5 text-emerald-600" />
                        Perpustakaan
                      </span>
                    </label>

                    <label className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all col-span-2 sm:col-span-3 ${
                      formData.additionalDuty === 'WALI_KELAS' 
                        ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs ring-1 ring-indigo-600' 
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="additionalDuty"
                        checked={formData.additionalDuty === 'WALI_KELAS'}
                        onChange={() => setFormData({ 
                          ...formData, 
                          additionalDuty: 'WALI_KELAS',
                          homeroomClassId: formData.homeroomClassId || (classes[0]?.id || ''),
                          homeroomClassName: formData.homeroomClassName || (classes[0]?.name || '')
                        })}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        Wali Kelas
                      </span>
                    </label>
                  </div>

                  {formData.additionalDuty === 'WALI_KELAS' && (
                    <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-2 mt-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-extrabold text-indigo-950">
                          Pilih Kelas Binaan (Data Kelola Kelas)
                        </label>
                        <span className="text-[10px] text-indigo-700 font-black bg-white px-2 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
                          Tersinkronisasi
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-700 font-medium">
                        Pilih rombongan belajar dari data kelola kelas yang akan diampu oleh guru ini:
                      </p>
                      <select
                        value={formData.homeroomClassId || (classes.find(c => c.name === formData.homeroomClassName)?.id || '')}
                        onChange={(e) => {
                          const selectedClass = classes.find(c => c.id === e.target.value);
                          if (selectedClass) {
                            setFormData({
                              ...formData,
                              homeroomClassId: selectedClass.id,
                              homeroomClassName: selectedClass.name
                            });
                          }
                        }}
                        className="w-full bg-white border border-indigo-300 text-slate-900 text-xs font-bold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
                      >
                        <option value="">-- Pilih Kelas --</option>
                        {classes.map(c => {
                          const currentWali = c.homeroomTeacher && c.homeroomTeacher !== 'Belum Ditentukan' && c.homeroomTeacher !== formData.name
                            ? ` (Wali saat ini: ${c.homeroomTeacher})`
                            : '';
                          return (
                            <option key={c.id} value={c.id}>
                              Kelas {c.name} ({c.grade}){currentWali}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Tempat & Tanggal Lahir */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Tempat Lahir (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formData.birthPlace}
                    onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                    placeholder="Contoh: Jakarta"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Tanggal Lahir (Opsional)
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Email Resmi */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Email Resmi (Opsional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={modalRole === 'TU' ? 'tu@sekolah.sch.id' : 'guru@sekolah.sch.id'}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-extrabold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer ${
                    modalRole === 'TU'
                      ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/30'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                  }`}
                >
                  {editingTeacher 
                    ? 'Simpan Perubahan' 
                    : (modalRole === 'TU' ? 'Tambah Pegawai TU' : 'Tambah Guru Baru')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT TEACHERS / TU MODAL */}
      {isImportModalOpen && (
        <ImportTeachersModal
          existingTeachers={teachers}
          classes={classes}
          onImportTeachers={(newTeachers) => {
            if (onImportTeachers) {
              onImportTeachers(newTeachers);
            } else {
              newTeachers.forEach(t => onAddTeacher(t));
            }
          }}
          onClose={() => setIsImportModalOpen(false)}
        />
      )}

      {/* CONFIRMATION DELETE MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">Hapus Data Guru / Pegawai TU?</h3>
            <p className="text-xs text-slate-500">
              Apakah Anda yakin ingin menghapus data ini dari database? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-extrabold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeleteTeacher(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-5 py-2 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
              >
                Ya, Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
