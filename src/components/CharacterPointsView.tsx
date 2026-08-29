import React, { useState, useMemo, useEffect } from 'react';
import { Student, SchoolClass, CharacterTrait, StudentCharacterLog, Teacher, SchoolProfile, CharacterPredicateSettings, UserSession } from '../types';
import { exportCharacterPointsPdf } from '../lib/exportUtils';
import { 
  Plus, 
  Search, 
  Award, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Trash2, 
  Upload, 
  Camera, 
  UserCheck, 
  Clock, 
  FileImage, 
  X, 
  Sparkles,
  Filter,
  ShieldCheck,
  Download,
  FileText
} from 'lucide-react';

interface CharacterPointsViewProps {
  students: Student[];
  classes: SchoolClass[];
  traits: CharacterTrait[];
  logs: StudentCharacterLog[];
  teachers: Teacher[];
  onAddLog: (log: StudentCharacterLog) => void;
  onUpdateLog?: (log: StudentCharacterLog) => void;
  onDeleteLog: (logId: string) => void;
  currentUserRole?: string;
  schoolProfile?: SchoolProfile;
  predicateSettings?: CharacterPredicateSettings;
  userSession?: UserSession | null;
}

export const CharacterPointsView: React.FC<CharacterPointsViewProps> = ({
  students,
  classes,
  traits,
  logs,
  teachers,
  onAddLog,
  onUpdateLog,
  onDeleteLog,
  currentUserRole,
  schoolProfile,
  predicateSettings = { minA: 30, minB: 10, minC: 0, minD: -20, minE: -50 },
  userSession,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Auto detect initial evaluator name from logged in user session
  const initialEvaluatorName = useMemo(() => {
    if (userSession?.displayName) {
      if (userSession.teacherId) {
        const matched = teachers.find(t => t.id === userSession.teacherId);
        if (matched) return matched.name;
      }
      const matched = teachers.find(
        t => t.name.toLowerCase() === userSession.displayName.toLowerCase() ||
             (t.nip && userSession.username && t.nip.trim() === userSession.username.trim()) ||
             (t.nip && userSession.nipOrNisn && t.nip.trim() === userSession.nipOrNisn.trim())
      );
      if (matched) return matched.name;

      if (userSession.role === 'TEACHER' || userSession.displayName) {
        return userSession.displayName;
      }
    }
    return teachers[0]?.name || 'Guru Piket / Wali Kelas';
  }, [userSession, teachers]);

  // Modal Input Nilai Karakter State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [inputStudentId, setInputStudentId] = useState<string>('');
  const [inputClassId, setInputClassId] = useState<string>('');
  const [inputTraitType, setInputTraitType] = useState<'POSITIF' | 'NEGATIF'>('POSITIF');
  const [inputTraitId, setInputTraitId] = useState<string>('');
  const [inputEvaluatorName, setInputEvaluatorName] = useState<string>(initialEvaluatorName);
  const [inputPhotoUrl, setInputPhotoUrl] = useState<string>('');
  const [inputNotes, setInputNotes] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Sync evaluatorName if initialEvaluatorName updates
  useEffect(() => {
    if (initialEvaluatorName) {
      setInputEvaluatorName(initialEvaluatorName);
    }
  }, [initialEvaluatorName]);

  // Camera capture modal state & refs
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startCameraStream = async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
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
        setCameraError("Kamera tidak dapat diakses. Pastikan Anda telah memberikan izin akses kamera pada browser.");
      }
    }
  };

  const handleOpenCamModal = () => {
    setIsCameraModalOpen(true);
    setTimeout(() => {
      startCameraStream();
    }, 100);
  };

  const handleCloseCamModal = () => {
    stopCamera();
    setIsCameraModalOpen(false);
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setInputPhotoUrl(dataUrl);
      setPhotoPreview(dataUrl);
    }
    handleCloseCamModal();
  };

  // Modal Detail Nilai State
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [previewPhotoModalUrl, setPreviewPhotoModalUrl] = useState<string | null>(null);
  const [deleteConfirmLog, setDeleteConfirmLog] = useState<StudentCharacterLog | null>(null);

  // Modal Tindak Lanjut State
  const [followUpLog, setFollowUpLog] = useState<StudentCharacterLog | null>(null);
  const [followUpNotes, setFollowUpNotes] = useState<string>('');
  const [followUpPhotoUrl, setFollowUpPhotoUrl] = useState<string>('');
  const [followUpPhotoPreview, setFollowUpPhotoPreview] = useState<string | null>(null);
  const [followUpBy, setFollowUpBy] = useState<string>('');

  const sortedClasses = [...classes].sort((a, b) =>
    a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
  );

  // Filter students based on Class and Search (sorted Ascending by student name)
  const filteredStudents = useMemo(() => {
    return students
      .filter(student => {
        const matchesClass = selectedClassId === 'ALL' || student.classId === selectedClassId;
        const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          student.nisn.includes(searchQuery) ||
          student.className.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesClass && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }));
  }, [students, selectedClassId, searchQuery]);

  // Calculate character score summary for a student
  const getStudentScoreSummary = (studentId: string) => {
    const studentLogs = logs.filter(l => l.studentId === studentId);
    
    let positivePoints = 0;
    let negativePoints = 0;

    studentLogs.forEach(l => {
      if (l.traitType === 'POSITIF') {
        positivePoints += Math.abs(l.points);
      } else {
        negativePoints += Math.abs(l.points);
      }
    });

    const netScore = positivePoints - negativePoints;

    return {
      positivePoints,
      negativePoints,
      netScore,
      totalEntries: studentLogs.length,
      logs: studentLogs
    };
  };

  // Handle Photo File Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setInputPhotoUrl(result);
        setPhotoPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Open Modal for specific student
  const handleOpenAddModalForStudent = (student?: Student) => {
    const targetStudent = student || students[0];
    if (targetStudent) {
      setInputClassId(targetStudent.classId);
      setInputStudentId(targetStudent.id);
    }
    
    setInputTraitType('POSITIF');
    const firstPosTrait = traits.find(t => t.type === 'POSITIF');
    setInputTraitId(firstPosTrait?.id || traits[0]?.id || '');
    setInputPhotoUrl('');
    setPhotoPreview(null);
    setInputNotes('');
    setShowAddModal(true);
  };

  // Handle changing character type filter (POSITIF / NEGATIF) in modal
  const handleTraitTypeChange = (type: 'POSITIF' | 'NEGATIF') => {
    setInputTraitType(type);
    const matchingTraits = traits.filter(t => t.type === type);
    if (matchingTraits.length > 0) {
      setInputTraitId(matchingTraits[0].id);
    } else {
      setInputTraitId('');
    }
  };

  // Submit New Character Point Log
  const handleSubmitLog = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedStudent = students.find(s => s.id === inputStudentId);
    const selectedTrait = traits.find(t => t.id === inputTraitId);

    if (!selectedStudent) {
      alert('Pilih siswa terlebih dahulu!');
      return;
    }
    if (!selectedTrait) {
      alert('Pilih data karakter dari catalog terlebih dahulu!');
      return;
    }

    const now = new Date();
    const formattedTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const newLog: StudentCharacterLog = {
      id: 'log-' + Date.now(),
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      nisn: selectedStudent.nisn,
      classId: selectedStudent.classId,
      className: selectedStudent.className,
      traitId: selectedTrait.id,
      traitName: selectedTrait.name,
      traitType: selectedTrait.type,
      points: Math.abs(selectedTrait.points),
      evaluatorName: inputEvaluatorName.trim() || 'Guru Piket',
      timestamp: formattedTimestamp,
      date: formattedDate,
      photoProofUrl: inputPhotoUrl || 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=400&auto=format&fit=crop&q=80',
      notes: inputNotes.trim()
    };

    onAddLog(newLog);
    setShowAddModal(false);
  };

  // Follow Up Handlers
  const handleOpenFollowUpModal = (log: StudentCharacterLog) => {
    setFollowUpLog(log);
    setFollowUpNotes(log.followUpNotes || '');
    setFollowUpPhotoUrl(log.followUpPhotoUrl || '');
    setFollowUpPhotoPreview(log.followUpPhotoUrl || null);
    setFollowUpBy(log.followUpBy || initialEvaluatorName || 'Guru BK / Wali Kelas');
  };

  const handleSaveFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpLog) return;

    const nowStr = new Date().toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const updated: StudentCharacterLog = {
      ...followUpLog,
      followUpNotes: followUpNotes.trim(),
      followUpPhotoUrl: followUpPhotoUrl || undefined,
      followUpDate: nowStr,
      followUpBy: followUpBy.trim() || 'Guru / Petugas'
    };

    if (onUpdateLog) {
      onUpdateLog(updated);
    }

    setFollowUpLog(null);
  };

  const handleFollowUpPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setFollowUpPhotoUrl(result);
        setFollowUpPhotoPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectSampleFollowUpPhoto = (url: string) => {
    setFollowUpPhotoUrl(url);
    setFollowUpPhotoPreview(url);
  };

  // Export PDF Handler
  const handleDownloadPdf = async () => {
    if (!schoolProfile) {
      alert('Data profil sekolah belum dimuat.');
      return;
    }
    try {
      setIsExporting(true);
      const selectedClassFilter = selectedClassId === 'ALL'
        ? 'ALL'
        : (classes.find(c => c.id === selectedClassId)?.name || 'ALL');

      await exportCharacterPointsPdf(
        schoolProfile,
        students,
        classes,
        traits,
        logs,
        selectedClassFilter,
        undefined,
        predicateSettings
      );
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Gagal mengunduh Laporan PDF Nilai Karakter.');
    } finally {
      setIsExporting(false);
    }
  };

  const getPredicate = (netScore: number) => {
    const minA = predicateSettings.minA ?? 30;
    const minB = predicateSettings.minB ?? 10;
    const minC = predicateSettings.minC ?? 0;
    const minD = predicateSettings.minD ?? -20;
    const minE = predicateSettings.minE ?? -50;

    if (netScore >= minA) return { label: 'Sangat Baik (A)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (netScore >= minB) return { label: 'Baik (B)', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (netScore >= minC) return { label: 'Cukup (C)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (netScore >= minD) return { label: 'Perlu Pembinaan (D)', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    if (netScore >= minE) return { label: 'Tidak Naik Kelas (E)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    return { label: 'Pindah Sekolah (F)', color: 'bg-purple-100 text-purple-800 border-purple-300' };
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full text-xs font-bold border border-amber-400/30 mb-2">
            <Award className="w-4 h-4 text-amber-400" /> Laporan Penilaian Karakter
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Nilai Karakter Siswa
          </h1>
          <p className="text-sm text-indigo-200/90 mt-1 max-w-2xl">
            Pencatatan dan rekap nilai karakter positif serta negatif siswa beserta penilai dan bukti foto kegiatan.
          </p>
        </div>

        <button
          onClick={handleDownloadPdf}
          disabled={isExporting}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-500 text-white font-extrabold rounded-2xl shadow-lg transition-all transform active:scale-95 cursor-pointer shrink-0"
        >
          <Download className="w-5 h-5" />
          <span>{isExporting ? 'Mencetak PDF...' : 'Download PDF'}</span>
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Class Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
            >
              <option value="ALL">Semua Kelas ({students.length} Siswa)</option>
              {sortedClasses.map(c => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau NISN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Menampilkan <span className="font-bold text-slate-800">{filteredStudents.length}</span> siswa
        </div>
      </div>

      {/* Main Table: Nilai Karakter Siswa */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            Tabel Rekapitulasi Nilai Karakter Siswa
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider">
                <th className="p-4 pl-6">Nama Siswa</th>
                <th className="p-4 text-center">Karakter Positif</th>
                <th className="p-4 text-center">Karakter Negatif</th>
                <th className="p-4 text-center">Jumlah Nilai</th>
                <th className="p-4 text-center">Predikat</th>
                <th className="p-4 text-center">Detail Nilai</th>
                <th className="p-4 text-right pr-6">Aksi Guru</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    Tidak ada data siswa ditemukan.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const score = getStudentScoreSummary(student.id);
                  const pred = getPredicate(score.netScore);

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Nama Siswa */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center space-x-3">
                          <img
                            src={student.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100'}
                            alt={student.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <p className="font-bold text-slate-800 text-sm leading-tight">
                              {student.name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium">
                              {student.className} • NISN: {student.nisn}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Karakter Positif */}
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-blue-50 text-blue-700 font-extrabold text-sm border border-blue-200">
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          +{score.positivePoints}
                        </span>
                      </td>

                      {/* Karakter Negatif */}
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-red-50 text-red-700 font-extrabold text-sm border border-red-200">
                          <XCircle className="w-4 h-4 text-red-600" />
                          -{score.negativePoints}
                        </span>
                      </td>

                      {/* Jumlah Nilai (Positif - Negatif) */}
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`px-4 py-1.5 rounded-2xl font-black text-base shadow-2xs ${
                            score.netScore > 0
                              ? 'bg-blue-600 text-white'
                              : score.netScore < 0
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {score.netScore > 0 ? `+${score.netScore}` : score.netScore}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 font-semibold">
                            (Positif - Negatif)
                          </span>
                        </div>
                      </td>

                      {/* Predikat */}
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold border inline-block whitespace-nowrap ${pred.color}`}>
                          {pred.label}
                        </span>
                      </td>

                      {/* Detail Nilai Button */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setDetailStudent(student)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-indigo-600" />
                          Detail Nilai ({score.totalEntries})
                        </button>
                      </td>

                      {/* Aksi Guru (Input Nilai Langsung) */}
                      <td className="p-4 text-right pr-6">
                        <button
                          onClick={() => handleOpenAddModalForStudent(student)}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          + Isi Nilai
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Form Guru Mengisi Nilai Karakter */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg">Input Nilai Karakter Siswa</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <form onSubmit={handleSubmitLog} className="p-6 space-y-5 overflow-y-auto">
              {/* Auto-filled Student Display Card (No Student Dropdown) */}
              {(() => {
                const currentStudent = students.find(s => s.id === inputStudentId) || students[0];
                return (
                  <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/60 border border-indigo-200/90 rounded-2xl p-4 shadow-2xs">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 mb-1.5 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" /> Nama Siswa (Terisi Otomatis)
                    </p>
                    <div className="flex items-center space-x-3.5">
                      <img
                        src={currentStudent?.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100'}
                        alt={currentStudent?.name || 'Siswa'}
                        className="w-11 h-11 rounded-full object-cover border-2 border-indigo-200 shrink-0"
                      />
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base leading-tight">
                          {currentStudent?.className} - {currentStudent?.name}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          NISN: <span className="font-semibold text-slate-700">{currentStudent?.nisn}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Pilih Jenis Karakter: Positif / Negatif */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                  1. Pilih Jenis Karakter <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleTraitTypeChange('POSITIF')}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer ${
                      inputTraitType === 'POSITIF'
                        ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className={`w-5 h-5 ${inputTraitType === 'POSITIF' ? 'text-blue-600' : 'text-slate-400'}`} />
                    Karakter Positif (+)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTraitTypeChange('NEGATIF')}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer ${
                      inputTraitType === 'NEGATIF'
                        ? 'border-red-500 bg-red-50 text-red-800 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <XCircle className={`w-5 h-5 ${inputTraitType === 'NEGATIF' ? 'text-red-600' : 'text-slate-400'}`} />
                    Karakter Negatif (-)
                  </button>
                </div>
              </div>

              {/* Select Character Trait from Master Catalog (Filtered by inputTraitType) */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  2. Pilih Input Karakter Siswa ({inputTraitType === 'POSITIF' ? 'Positif' : 'Negatif'}) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={inputTraitId}
                  onChange={(e) => setInputTraitId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {traits.filter(t => t.type === inputTraitType).length === 0 ? (
                    <option value="">-- Tidak ada data karakter {inputTraitType.toLowerCase()} --</option>
                  ) : (
                    traits.filter(t => t.type === inputTraitType).map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.type === 'POSITIF' ? `+${t.points}` : `-${t.points}`} Poin] {t.name} ({t.category || 'Umum'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Selected Trait Info Badge */}
              {inputTraitId && (
                (() => {
                  const trait = traits.find(t => t.id === inputTraitId);
                  if (!trait) return null;
                  return (
                    <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                      trait.type === 'POSITIF' 
                        ? 'bg-blue-50 border-blue-200 text-blue-900' 
                        : 'bg-red-50 border-red-200 text-red-900'
                    }`}>
                      <div className="flex items-center gap-2">
                        {trait.type === 'POSITIF' ? <CheckCircle2 className="w-5 h-5 text-blue-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                        <div>
                          <p className="font-bold text-sm">{trait.name}</p>
                          <p className="text-xs opacity-80">Jenis: Karakter {trait.type}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                        trait.type === 'POSITIF' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
                      }`}>
                        {trait.type === 'POSITIF' ? `+${trait.points} Poin` : `-${trait.points} Poin`}
                      </span>
                    </div>
                  );
                })()
              )}

              {/* Evaluator Name (Nama Penilai) */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  3. Nama Penilai (Guru) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Nama Guru Penilai..."
                    value={inputEvaluatorName}
                    onChange={(e) => setInputEvaluatorName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Upload Bukti Foto */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                  <span>4. Bukti Foto Kegiatan <span className="text-rose-500">*</span></span>
                </label>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Tombol Ambil Foto Kamera */}
                    <button
                      type="button"
                      onClick={handleOpenCamModal}
                      className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-3.5 text-center bg-emerald-50/60 hover:bg-emerald-50 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[96px] group shadow-xs hover:shadow-md"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform">
                        <Camera className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-emerald-900">Ambil Foto (Kamera)</p>
                      <p className="text-[10px] text-emerald-700 font-medium">Buka Kamera & Tangkap Foto</p>
                    </button>

                    {/* Tombol Pilih dari Galeri / File */}
                    <div className="relative border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-3.5 text-center bg-slate-50 hover:bg-indigo-50/30 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[96px] group shadow-xs hover:shadow-md">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        title="Upload dari Galeri / File"
                      />
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">Upload dari Galeri / File</p>
                      <p className="text-[10px] text-slate-500 font-medium">Format JPG, PNG, WEBP</p>
                    </div>
                  </div>

                  {photoPreview && (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 group bg-slate-900 shadow-md">
                      <img src={photoPreview} alt="Preview Bukti Foto" className="w-full h-44 object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-2.5 left-2.5 bg-emerald-600/95 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-md">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Foto Terpilih
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview(null);
                          setInputPhotoUrl('');
                        }}
                        className="absolute top-2.5 right-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus Foto
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes / Catatan */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  5. Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan lebih lanjut mengenai perilaku siswa..."
                  value={inputNotes}
                  onChange={(e) => setInputNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  Simpan Nilai Karakter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Detail Nilai Karakter Siswa */}
      {detailStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <img
                  src={detailStudent.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100'}
                  alt={detailStudent.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/20 shrink-0"
                />
                <div>
                  <h3 className="font-extrabold text-lg text-white">
                    Detail Nilai Karakter: {detailStudent.name}
                  </h3>
                  <p className="text-xs text-indigo-200 font-medium">
                    Kelas {detailStudent.className} • NISN: {detailStudent.nisn}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDetailStudent(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Score Overview Bar */}
            {(() => {
              const score = getStudentScoreSummary(detailStudent.id);
              const pred = getPredicate(score.netScore);
              return (
                <div className="bg-slate-50 p-4 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center shrink-0">
                  <div className="bg-white p-2.5 rounded-2xl border border-blue-200">
                    <p className="text-[11px] font-bold text-blue-700">Total Positif</p>
                    <p className="text-lg font-black text-blue-800">+{score.positivePoints}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-2xl border border-red-200">
                    <p className="text-[11px] font-bold text-red-700">Total Negatif</p>
                    <p className="text-lg font-black text-red-800">-{score.negativePoints}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-2xl border border-indigo-200">
                    <p className="text-[11px] font-bold text-indigo-700">Jumlah Nilai</p>
                    <p className={`text-lg font-black ${
                      score.netScore >= 0 ? 'text-indigo-800' : 'text-red-700'
                    }`}>
                      {score.netScore > 0 ? `+${score.netScore}` : score.netScore}
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-2xl border border-amber-200 flex flex-col items-center justify-center">
                    <p className="text-[11px] font-bold text-amber-800">Predikat</p>
                    <span className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-extrabold border ${pred.color}`}>
                      {pred.label}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Log Entries Table */}
            <div className="p-5 overflow-y-auto space-y-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Riwayat Catatan Penilaian Karakter
              </h4>

              {getStudentScoreSummary(detailStudent.id).logs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl">
                  Belum ada catatan nilai karakter untuk siswa ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {getStudentScoreSummary(detailStudent.id).logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-0.5">
                            {log.traitType === 'POSITIF' ? (
                              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                                <XCircle className="w-5 h-5" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-800 text-sm">
                                {log.traitName}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                log.traitType === 'POSITIF' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {log.traitType === 'POSITIF' ? `+${log.points} Poin` : `-${log.points} Poin`}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                                Penilai: {log.evaluatorName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                Waktu: {log.timestamp}
                              </span>
                            </div>

                            {log.notes && (
                              <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">
                                "{log.notes}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons: Tindak Lanjut, Photo Proof & Delete */}
                        <div className="flex items-center gap-2 shrink-0 justify-end">
                          <button
                            onClick={() => handleOpenFollowUpModal(log)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                            title="Tindak Lanjut"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {log.followUpNotes ? 'Edit Tindak Lanjut' : 'Tindak Lanjut'}
                          </button>

                          {log.photoProofUrl && (
                            <button
                              onClick={() => setPreviewPhotoModalUrl(log.photoProofUrl || null)}
                              className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-500 transition-all cursor-pointer shrink-0"
                            >
                              <img
                                src={log.photoProofUrl}
                                alt="Bukti Foto"
                                className="w-10 h-10 object-cover group-hover:scale-105 transition-transform"
                              />
                              <span className="absolute inset-0 bg-slate-900/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold">
                                Lihat
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmLog(log)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                            title="Hapus Log Catatan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Display Follow-Up details if exists */}
                      {(log.followUpNotes || log.followUpPhotoUrl) && (
                        <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 space-y-1.5">
                          <div className="flex items-center justify-between font-extrabold text-[11px] text-amber-900 border-b border-amber-200/60 pb-1">
                            <span className="flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                              Catatan Tindak Lanjut: {log.followUpBy || 'Guru / Petugas'}
                            </span>
                            {log.followUpDate && (
                              <span className="text-[10px] text-amber-700 font-medium">{log.followUpDate}</span>
                            )}
                          </div>
                          {log.followUpNotes && (
                            <p className="font-medium text-slate-800 text-xs leading-relaxed">{log.followUpNotes}</p>
                          )}
                          {log.followUpPhotoUrl && (
                            <div className="pt-1 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewPhotoModalUrl(log.followUpPhotoUrl || null)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 rounded-lg text-[11px] font-bold border border-amber-300 transition-colors cursor-pointer shadow-2xs"
                              >
                                <FileImage className="w-3.5 h-3.5 text-amber-700" /> Bukti Foto Tindak Lanjut
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center shrink-0">
              <button
                onClick={() => setDetailStudent(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Input / Edit Tindak Lanjut Penilaian Karakter */}
      {followUpLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Aksi Tindak Lanjut Penilaian Karakter
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {followUpLog.studentName} • {followUpLog.traitName} ({followUpLog.traitType === 'POSITIF' ? `+${followUpLog.points}` : `-${followUpLog.points}`} Poin)
                </p>
              </div>
              <button
                onClick={() => setFollowUpLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFollowUp} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                  Petugas / Guru Penindak Lanjut
                </label>
                <input
                  type="text"
                  required
                  value={followUpBy}
                  onChange={(e) => setFollowUpBy(e.target.value)}
                  placeholder="Nama Guru BK / Wali Kelas / Guru..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                  Catatan Tindak Lanjut <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Tuliskan tindakan yang telah diambil, pembinaan, atau konseling yang dilakukan..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                  Upload Bukti Foto Tindak Lanjut
                </label>
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-3 text-center bg-slate-50 transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFollowUpPhotoUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-6 h-6 mx-auto text-indigo-500 mb-1" />
                    <p className="text-xs font-bold text-slate-700">Pilih foto bukti tindak lanjut</p>
                    <p className="text-[10px] text-slate-400">JPG, PNG, WEBP</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 mb-1">Sampel Foto Contoh:</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectSampleFollowUpPhoto('https://images.unsplash.com/photo-1577896851231-70ef18881754?w=400&auto=format&fit=crop&q=80')}
                        className="p-1 border rounded-xl overflow-hidden hover:opacity-80 cursor-pointer text-center"
                      >
                        <img src="https://images.unsplash.com/photo-1577896851231-70ef18881754?w=100" className="w-full h-10 object-cover rounded-lg" alt="Sample 1" />
                        <span className="text-[9px] text-slate-600 font-bold block mt-0.5">Konseling</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectSampleFollowUpPhoto('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&auto=format&fit=crop&q=80')}
                        className="p-1 border rounded-xl overflow-hidden hover:opacity-80 cursor-pointer text-center"
                      >
                        <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=100" className="w-full h-10 object-cover rounded-lg" alt="Sample 2" />
                        <span className="text-[9px] text-slate-600 font-bold block mt-0.5">Pembinaan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectSampleFollowUpPhoto('https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&auto=format&fit=crop&q=80')}
                        className="p-1 border rounded-xl overflow-hidden hover:opacity-80 cursor-pointer text-center"
                      >
                        <img src="https://images.unsplash.com/photo-1509062522246-3755977927d7?w=100" className="w-full h-10 object-cover rounded-lg" alt="Sample 3" />
                        <span className="text-[9px] text-slate-600 font-bold block mt-0.5">Dokumentasi</span>
                      </button>
                    </div>
                  </div>

                  {followUpPhotoPreview && (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                      <img src={followUpPhotoPreview} alt="Bukti Tindak Lanjut" className="w-full h-32 object-cover" />
                      <button
                        type="button"
                        onClick={() => { setFollowUpPhotoUrl(''); setFollowUpPhotoPreview(null); }}
                        className="absolute top-2 right-2 bg-rose-600 text-white p-1 rounded-full cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFollowUpLog(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer"
                >
                  Simpan Tindak Lanjut
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Lightbox Image Enlarge */}
      {previewPhotoModalUrl && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-60 flex items-center justify-center p-4"
          onClick={() => setPreviewPhotoModalUrl(null)}
        >
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-3xl p-2 overflow-hidden shadow-2xl border border-slate-800">
            <button
              onClick={() => setPreviewPhotoModalUrl(null)}
              className="absolute top-4 right-4 z-10 bg-slate-800/80 hover:bg-slate-800 text-white p-2 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewPhotoModalUrl}
              alt="Bukti Foto Karakter"
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
            />
            <p className="text-center text-xs text-slate-300 py-2 font-medium">Bukti Foto Kegiatan Karakter Siswa</p>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Log Catatan Karakter */}
      {deleteConfirmLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shrink-0">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Konfirmasi Hapus Log</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Apakah Anda yakin ingin menghapus catatan penilaian karakter <strong className="text-slate-900">{deleteConfirmLog.traitName}</strong> ({deleteConfirmLog.traitType === 'POSITIF' ? `+${deleteConfirmLog.points}` : `-${deleteConfirmLog.points}`} poin) untuk <strong className="text-slate-900">{deleteConfirmLog.studentName}</strong>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmLog(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteLog(deleteConfirmLog.id);
                  setDeleteConfirmLog(null);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/30 transition-all cursor-pointer"
              >
                Ya, Hapus Catatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Live Camera Capture */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-800 text-white flex flex-col">
            <div className="p-4 bg-slate-800 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Ambil Foto Bukti Karakter</h3>
              </div>
              <button
                onClick={handleCloseCamModal}
                className="p-1.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex flex-col items-center justify-center bg-black min-h-[300px] relative">
              {cameraError ? (
                <div className="text-center p-6 space-y-3">
                  <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
                  <p className="text-xs text-rose-300 max-w-xs">{cameraError}</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Pilih File dari Perangkat
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        handlePhotoUpload(e);
                        handleCloseCamModal();
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-h-[360px] object-contain rounded-2xl bg-slate-950"
                  />
                  <div className="mt-4 flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={handleTakeSnapshot}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-full shadow-lg shadow-emerald-600/40 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Camera className="w-5 h-5" />
                      Tangkap Foto
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
