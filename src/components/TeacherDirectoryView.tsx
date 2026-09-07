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
  FileSpreadsheet
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
  const [subjectFilter, setSubjectFilter] = useState('');
  const [dutyFilter, setDutyFilter] = useState('');
  const [viewMode, setViewMode] = useState<'CARD' | 'TABLE'>('CARD');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Memoized default subjects list from School Profile (synced across devices)
  const availableSubjects = useMemo(() => {
    const list = schoolProfile.subjects && schoolProfile.subjects.length > 0 
      ? schoolProfile.subjects 
      : ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PJOK', 'Seni Budaya', 'Informatika', 'PPKn'];
    return Array.from(new Set(list.map(s => String(s).trim()).filter(Boolean)));
  }, [schoolProfile.subjects]);

  // Form State
  const emptyForm = {
    nip: '',
    name: '',
    birthPlace: '',
    birthDate: '',
    gender: 'L' as 'L' | 'P',
    subject1: availableSubjects[0] || 'Matematika',
    subject2: '',
    additionalDuty: 'TIDAK_ADA' as 'WAKIL_KEPALA_SEKOLAH' | 'WALI_KELAS' | 'TIDAK_ADA',
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

  const handleOpenAddModal = () => {
    setEditingTeacher(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    const homeroomInfo = getTeacherHomeroomInfo(teacher);

    setFormData({
      nip: teacher.nip || '',
      name: teacher.name || '',
      birthPlace: teacher.birthPlace || '',
      birthDate: teacher.birthDate || '',
      gender: teacher.gender || 'L',
      subject1: teacher.subject1 || availableSubjects[0] || 'Matematika',
      subject2: teacher.subject2 || '',
      additionalDuty: homeroomInfo.isHomeroom ? 'WALI_KELAS' : (teacher.additionalDuty || 'TIDAK_ADA'),
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
      alert('Nama guru wajib diisi.');
      return;
    }
    if (!formData.nip.trim()) {
      alert('NIP wajib diisi.');
      return;
    }
    if (!formData.phone.trim()) {
      alert('No. Handphone / WhatsApp wajib diisi.');
      return;
    }

    // Determine homeroom class name if WALI_KELAS selected
    let targetClassId = formData.homeroomClassId;
    let targetClassName = formData.homeroomClassName;

    if (formData.additionalDuty === 'WALI_KELAS') {
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

    const payload = {
      ...formData,
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
    const matchesSearch = 
      teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.nip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (teacher.subject1 && teacher.subject1.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (teacher.subject2 && teacher.subject2.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSubject = !subjectFilter || teacher.subject1 === subjectFilter || teacher.subject2 === subjectFilter;
    
    const homeroomInfo = getTeacherHomeroomInfo(teacher);

    let matchesDuty = true;
    if (dutyFilter === 'WAKIL_KEPALA_SEKOLAH') matchesDuty = teacher.additionalDuty === 'WAKIL_KEPALA_SEKOLAH';
    if (dutyFilter === 'HUMAS') matchesDuty = teacher.additionalDuty === 'HUMAS';
    if (dutyFilter === 'BK') matchesDuty = teacher.additionalDuty === 'BK';
    if (dutyFilter === 'WALI_KELAS') matchesDuty = homeroomInfo.isHomeroom || teacher.additionalDuty === 'WALI_KELAS';
    if (dutyFilter === 'GURU_MAPEL') matchesDuty = !homeroomInfo.isHomeroom && (teacher.additionalDuty === 'TIDAK_ADA' || !teacher.additionalDuty);

    return matchesSearch && matchesSubject && matchesDuty;
  });

  const totalWakil = teachers.filter(t => t.additionalDuty === 'WAKIL_KEPALA_SEKOLAH').length;
  const totalHumas = teachers.filter(t => t.additionalDuty === 'HUMAS').length;
  const totalBK = teachers.filter(t => t.additionalDuty === 'BK').length;
  const totalWali = teachers.filter(t => getTeacherHomeroomInfo(t).isHomeroom || t.additionalDuty === 'WALI_KELAS').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-extrabold border border-indigo-500/30">
            <UserCheck className="w-3.5 h-3.5" />
            Manajemen Tenaga Pendidik & Guru
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Database Guru Sekolah</h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
            Kelola data bapak/ibu guru, NIP, tempat tanggal lahir, mata pelajaran yang diampu, serta tugas tambahan seperti Wakil Kepala Sekolah dan Wali Kelas.
          </p>
        </div>

        <div className="flex flex-col gap-2 relative z-10 shrink-0 w-full sm:w-64">
          <button
            type="button"
            onClick={downloadTeacherImportTemplate}
            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-start gap-2.5 shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>Download Format Impor Data Guru</span>
          </button>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-start gap-2.5 shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-amber-200 shrink-0" />
            <span>Impor Data Guru</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-start gap-2.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Tambah Guru Baru</span>
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Guru</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{teachers.length}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Wakil Kepala Sekolah</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{totalWakil}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Wali Kelas</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{totalWali}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Guru Mata Pelajaran</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{teachers.length - totalWakil - totalWali}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Bar & Filter Controls */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan nama guru, NIP, atau mata pelajaran..."
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
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">Semua Mapel</option>
              {availableSubjects.map((sub, idx) => (
                <option key={idx} value={sub}>{sub}</option>
              ))}
            </select>

            {/* Filter Tugas Tambahan */}
            <select
              value={dutyFilter}
              onChange={(e) => setDutyFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">Semua Tugas</option>
              <option value="WAKIL_KEPALA_SEKOLAH">Wakasek</option>
              <option value="HUMAS">Humas</option>
              <option value="BK">BK</option>
              <option value="WALI_KELAS">Wali Kelas</option>
              <option value="GURU_MAPEL">Guru Mapel</option>
            </select>

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
          </div>
        </div>
      </div>

      {/* Teachers Directory Content */}
      {filteredTeachers.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Tidak ada data guru ditemukan</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tidak ditemukan bapak/ibu guru yang sesuai dengan kata kunci pencarian atau filter yang Anda pilih.
          </p>
          {(searchTerm || subjectFilter || dutyFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
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
            const homeroomInfo = getTeacherHomeroomInfo(teacher);

            return (
              <div
                key={teacher.id}
                className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all space-y-4 relative flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Header Badge & Action */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {homeroomInfo.isHomeroom ? (
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
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-xl">
                          Tanpa Tugas Tambahan
                        </span>
                      )}
                    </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditModal(teacher)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Data Guru"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(teacher.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Guru"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Profile Avatar & Info */}
                <div className="flex items-start gap-3 pt-1">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0 uppercase">
                    {teacher.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-slate-900 text-sm leading-snug truncate group-hover:text-indigo-600 transition-colors">
                      {teacher.name}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500 font-semibold mt-0.5">
                      NIP: {teacher.nip || '-'}
                    </p>
                  </div>
                </div>

                {/* Meta details */}
                <div className="bg-slate-50/80 rounded-2xl p-3 space-y-2 border border-slate-100 text-xs">
                  <div className="flex items-center text-slate-600 gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">TTL: <strong className="text-slate-800">{teacher.birthPlace || '-'}, {teacher.birthDate || '-'}</strong></span>
                  </div>

                  <div className="flex items-center text-slate-600 gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <div className="flex flex-wrap gap-1 min-w-0">
                      <span className="bg-white border border-slate-200 text-slate-800 font-extrabold px-2 py-0.5 rounded-lg text-[10px]">
                        {teacher.subject1}
                      </span>
                      {teacher.subject2 && (
                        <span className="bg-white border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-lg text-[10px]">
                          {teacher.subject2}
                        </span>
                      )}
                    </div>
                  </div>

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
                <span className="text-slate-400 font-medium">Jenis Kelamin: <strong className="text-slate-700">{teacher.gender === 'P' ? 'Perempuan' : 'Laki-laki'}</strong></span>
                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[10px]">
                  <CheckCircle2 className="w-3 h-3" />
                  Aktif
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
                  <th className="py-3.5 px-4">Nama Guru & NIP</th>
                  <th className="py-3.5 px-4">Tempat, Tgl Lahir</th>
                  <th className="py-3.5 px-4">Mata Pelajaran</th>
                  <th className="py-3.5 px-4">Tugas Tambahan</th>
                  <th className="py-3.5 px-4">Kontak</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTeachers.map((teacher, index) => {
                  const homeroomInfo = getTeacherHomeroomInfo(teacher);

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400">{index + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900">{teacher.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">NIP: {teacher.nip || '-'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {teacher.birthPlace || '-'}, {teacher.birthDate || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          <span className="bg-indigo-50 text-indigo-800 font-extrabold px-2 py-0.5 rounded-md text-[10px]">
                            {teacher.subject1}
                          </span>
                          {teacher.subject2 && (
                            <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md text-[10px]">
                              {teacher.subject2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {homeroomInfo.isHomeroom ? (
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
                        ) : (
                          <span className="text-slate-400 font-medium">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        <div>{teacher.phone || '-'}</div>
                        <div className="text-[10px] text-slate-400">{teacher.email || ''}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(teacher)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(teacher.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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

      {/* MODAL TAMBAH / EDIT GURU */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingTeacher ? 'Edit Data Guru' : 'Tambah Data Guru Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Isi lengkap data tenaga pendidik di bawah ini.
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

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Guru */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Nama Lengkap Guru & Gelar <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Drs. Ahmad Hidayat, M.Pd."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* NIP */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    NIP (Nomor Induk Pegawai) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nip}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    placeholder="19850312 201001 2 015"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                {/* No. Handphone / WhatsApp (Username Login Guru) */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    No. Handphone / WhatsApp (Username Login) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Contoh: 081234567890"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    *Wajib diisi sebagai Username login guru.
                  </p>
                </div>

                {/* Mata Pelajaran 1 */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Mata Pelajaran 1 (Utama) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.subject1}
                    onChange={(e) => setFormData({ ...formData, subject1: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {formData.subject1 && !availableSubjects.includes(formData.subject1) && (
                      <option value={formData.subject1}>{formData.subject1}</option>
                    )}
                    {availableSubjects.map((sub, idx) => (
                      <option key={idx} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                {/* Mata Pelajaran 2 */}
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
              </div>

              {/* Tugas Tambahan */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <label className="block text-xs font-extrabold text-slate-800">
                  Tugas Tambahan Sekolah
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
                    <span>Tidak Ada</span>
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
                    <span>Wali Kelas</span>
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

              {/* Email Resmi Guru */}
              <div className="pt-1">
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Email Resmi Guru (Opsional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="guru@sekolah.sch.id"
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
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  {editingTeacher ? 'Simpan Perubahan' : 'Tambah Guru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT TEACHERS MODAL */}
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
            <h3 className="text-base font-extrabold text-slate-900">Hapus Data Guru?</h3>
            <p className="text-xs text-slate-500">
              Apakah Anda yakin ingin menghapus data guru ini dari database? Tindakan ini tidak dapat dibatalkan.
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
