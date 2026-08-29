import React, { useState, useMemo, useEffect } from 'react';
import { 
  SchoolClass, 
  Student, 
  Teacher, 
  SchoolProfile, 
  LearningJournal, 
  StudentGradeAssessment, 
  StudentGradeItem, 
  UserSession 
} from '../types';
import { 
  GraduationCap, 
  Calendar, 
  User, 
  Layers, 
  BookOpen, 
  FileText, 
  Save, 
  Download, 
  Trash2, 
  Sparkles, 
  RotateCcw, 
  CheckCircle2, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Edit3,
  Award,
  Calculator,
  SlidersHorizontal,
  ChevronDown,
  Zap
} from 'lucide-react';
import { getStudentGradeAssessments, saveStudentGradeAssessments } from '../lib/storage';
import { exportStudentGradesPdf, exportStudentGradesExcel } from '../lib/exportUtils';

interface StudentGradesSectionProps {
  classes: SchoolClass[];
  students: Student[];
  teachers: Teacher[];
  schoolProfile: SchoolProfile;
  journals: LearningJournal[];
  activeLoggedInTeacherName: string;
  onShowSuccessToast: (msg: string) => void;
  userSession?: UserSession | null;
}

export const StudentGradesSection: React.FC<StudentGradesSectionProps> = ({
  classes,
  students,
  teachers,
  schoolProfile,
  journals,
  activeLoggedInTeacherName,
  onShowSuccessToast,
  userSession
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) =>
      a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  // Form states
  const [gradeDate, setGradeDate] = useState<string>(todayStr);
  const [gradeClassId, setGradeClassId] = useState<string>(sortedClasses[0]?.id || '');
  const [gradeTeacherName, setGradeTeacherName] = useState<string>(activeLoggedInTeacherName || teachers[0]?.name || '');
  const [gradeSubject, setGradeSubject] = useState<string>(schoolProfile.subjects?.[0] || 'Matematika');
  const [gradeCustomSubject, setGradeCustomSubject] = useState<string>('');
  const [gradeMaterial, setGradeMaterial] = useState<string>('');
  const [gradeSemester, setGradeSemester] = useState<string>('1 (Ganjil)');
  // Category selection for grade input table: HARIAN | TUGAS | ULANGAN | ALL
  const [inputGradeCategory, setInputGradeCategory] = useState<'HARIAN' | 'TUGAS' | 'ULANGAN' | 'ALL'>('HARIAN');
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);

  // Quick fill per column state
  const [quickFillCategory, setQuickFillCategory] = useState<'HARIAN' | 'TUGAS' | 'ULANGAN' | null>(null);
  const [quickFillValue, setQuickFillValue] = useState<string>('80');

  // Search in student list
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // History search & filter
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyClassFilter, setHistoryClassFilter] = useState('ALL');

  // Student scores map: studentId -> { dailyScore, assignmentScore, examScore, notes }
  const [studentScores, setStudentScores] = useState<{
    [studentId: string]: {
      dailyScore: number | null;
      assignmentScore: number | null;
      examScore: number | null;
      notes: string;
    };
  }>({});

  // Saved Assessments from localStorage
  const [savedAssessments, setSavedAssessments] = useState<StudentGradeAssessment[]>(() => {
    return getStudentGradeAssessments();
  });

  // Keep teacher name synced with active teacher or login
  useEffect(() => {
    if (activeLoggedInTeacherName) {
      setGradeTeacherName(activeLoggedInTeacherName);
    }
  }, [activeLoggedInTeacherName]);

  // Available subjects from profile + teacher
  const availableSubjectsList = useMemo(() => {
    const defaultList = schoolProfile.subjects || [
      "Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS", 
      "Pendidikan Agama", "PJOK", "Seni Budaya", "Informatika", "PPKn"
    ];
    const list = [...defaultList];
    const matchedTeacher = teachers.find(
      t => (gradeTeacherName && t.name.toLowerCase() === gradeTeacherName.toLowerCase()) ||
           (userSession?.teacherId && t.id === userSession.teacherId)
    );
    if (matchedTeacher) {
      if (matchedTeacher.subject1 && !list.includes(matchedTeacher.subject1)) {
        list.unshift(matchedTeacher.subject1);
      }
      if (matchedTeacher.subject2 && !list.includes(matchedTeacher.subject2)) {
        list.push(matchedTeacher.subject2);
      }
    }
    return Array.from(new Set(list));
  }, [schoolProfile.subjects, teachers, gradeTeacherName, userSession]);

  // Current active subject string
  const currentActiveSubject = useMemo(() => {
    return (gradeSubject === 'LAINNYA' ? gradeCustomSubject : gradeSubject).trim();
  }, [gradeSubject, gradeCustomSubject]);

  // Students in selected class
  const classStudents = useMemo(() => {
    return students
      .filter(s => s.classId === gradeClassId)
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [students, gradeClassId]);

  // Filtered students by search query
  const displayedStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return classStudents;
    const q = studentSearchQuery.toLowerCase();
    return classStudents.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.nisn.includes(q) ||
      (s.nis && s.nis.includes(q))
    );
  }, [classStudents, studentSearchQuery]);

  // Recent KBM journals for selected class to quickly auto-populate
  const recentClassJournals = useMemo(() => {
    return journals
      .filter(j => j.classId === gradeClassId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [journals, gradeClassId]);

  // Score calculation helper
  const calculateStudentFinalScore = (
    daily: number | null, 
    assignment: number | null, 
    exam: number | null
  ): number | null => {
    const validScores: number[] = [];
    if (daily !== null && daily !== undefined && !isNaN(daily)) validScores.push(daily);
    if (assignment !== null && assignment !== undefined && !isNaN(assignment)) validScores.push(assignment);
    if (exam !== null && exam !== undefined && !isNaN(exam)) validScores.push(exam);

    if (validScores.length === 0) return null;
    const sum = validScores.reduce((a, b) => a + b, 0);
    return Number((sum / validScores.length).toFixed(1));
  };

  const getGradePredicate = (score: number | null) => {
    if (score === null || score === undefined) return { label: '-', color: 'text-slate-400', bg: 'bg-slate-100' };
    if (score >= 85) return { label: 'A (Sangat Baik)', color: 'text-emerald-800', bg: 'bg-emerald-100 border-emerald-200' };
    if (score >= 75) return { label: 'B (Baik)', color: 'text-indigo-800', bg: 'bg-indigo-100 border-indigo-200' };
    if (score >= 60) return { label: 'C (Cukup)', color: 'text-amber-800', bg: 'bg-amber-100 border-amber-200' };
    return { label: 'D (Perlu Bimbingan)', color: 'text-rose-800', bg: 'bg-rose-100 border-rose-200' };
  };

  // Class statistics for live feedback
  const classStats = useMemo(() => {
    let assessedCount = 0;
    let totalScoresSum = 0;
    let maxScore = -1;
    let minScore = 101;

    classStudents.forEach(std => {
      const score = studentScores[std.id];
      let targetVal: number | null = null;
      if (inputGradeCategory === 'HARIAN') {
        targetVal = score?.dailyScore ?? null;
      } else if (inputGradeCategory === 'TUGAS') {
        targetVal = score?.assignmentScore ?? null;
      } else if (inputGradeCategory === 'ULANGAN') {
        targetVal = score?.examScore ?? null;
      } else {
        targetVal = score ? calculateStudentFinalScore(score.dailyScore, score.assignmentScore, score.examScore) : null;
      }

      if (targetVal !== null && targetVal !== undefined && !isNaN(targetVal)) {
        assessedCount++;
        totalScoresSum += targetVal;
        if (targetVal > maxScore) maxScore = targetVal;
        if (targetVal < minScore) minScore = targetVal;
      }
    });

    const classAverage = assessedCount > 0 ? Number((totalScoresSum / assessedCount).toFixed(1)) : null;

    return {
      total: classStudents.length,
      assessedCount,
      classAverage,
      maxScore: maxScore >= 0 ? maxScore : null,
      minScore: minScore <= 100 ? minScore : null
    };
  }, [classStudents, studentScores, inputGradeCategory]);

  // Update a single score field
  const handleScoreChange = (
    studentId: string, 
    field: 'dailyScore' | 'assignmentScore' | 'examScore' | 'notes', 
    value: string
  ) => {
    setStudentScores(prev => {
      const current = prev[studentId] || { dailyScore: null, assignmentScore: null, examScore: null, notes: '' };
      if (field === 'notes') {
        return {
          ...prev,
          [studentId]: {
            ...current,
            notes: value
          }
        };
      } else {
        const numVal = value === '' ? null : Math.max(0, Math.min(100, Number(value)));
        return {
          ...prev,
          [studentId]: {
            ...current,
            [field]: isNaN(numVal as number) ? null : numVal
          }
        };
      }
    });
  };

  // Quick fill all students for a specific category
  const handleApplyCategoryQuickFill = (category: 'HARIAN' | 'TUGAS' | 'ULANGAN', customVal?: number) => {
    const val = customVal !== undefined ? customVal : (quickFillValue === '' ? null : Number(quickFillValue));
    if (val === null || isNaN(val) || val < 0 || val > 100) {
      alert('Masukkan nilai yang valid antara 0 - 100.');
      return;
    }

    const newMap = { ...studentScores };
    classStudents.forEach(std => {
      const current = newMap[std.id] || { dailyScore: null, assignmentScore: null, examScore: null, notes: '' };
      if (category === 'HARIAN') {
        newMap[std.id] = { ...current, dailyScore: val };
      } else if (category === 'TUGAS') {
        newMap[std.id] = { ...current, assignmentScore: val };
      } else if (category === 'ULANGAN') {
        newMap[std.id] = { ...current, examScore: val };
      }
    });

    setStudentScores(newMap);
    setQuickFillCategory(null);
    const label = category === 'HARIAN' ? 'Nilai Harian' : category === 'TUGAS' ? 'Nilai Tugas' : 'Nilai Ulangan';
    onShowSuccessToast(`${label} massal (${val}) berhasil diterapkan ke ${classStudents.length} siswa! Nilai tetap dapat disesuaikan per siswa.`);
  };

  // Reset form scores
  const handleResetForm = () => {
    if (window.confirm('Kosongkan semua nilai yang sedang diinput pada form ini?')) {
      setStudentScores({});
      setEditingAssessmentId(null);
      setGradeMaterial('');
    }
  };

  // Save grade assessment
  const handleSaveGrades = (e: React.FormEvent) => {
    e.preventDefault();

    if (!gradeClassId) {
      alert('Pilih kelas terlebih dahulu!');
      return;
    }

    const selectedClassObj = classes.find(c => c.id === gradeClassId);
    const resolvedSubject = gradeSubject === 'LAINNYA' ? (gradeCustomSubject || 'Mata Pelajaran') : gradeSubject;

    if (!gradeMaterial.trim()) {
      alert('Harap isi Materi Pelajaran yang dinilai.');
      return;
    }

    const gradeItems: StudentGradeItem[] = classStudents.map(std => {
      const scoreObj = studentScores[std.id] || { dailyScore: null, assignmentScore: null, examScore: null, notes: '' };
      const finalScore = calculateStudentFinalScore(scoreObj.dailyScore, scoreObj.assignmentScore, scoreObj.examScore);
      const predicateObj = getGradePredicate(finalScore);

      return {
        studentId: std.id,
        studentName: std.name,
        nisn: std.nisn,
        nis: std.nis,
        dailyScore: scoreObj.dailyScore,
        assignmentScore: scoreObj.assignmentScore,
        examScore: scoreObj.examScore,
        finalScore: finalScore,
        predicate: predicateObj.label,
        notes: scoreObj.notes
      };
    });

    const assessmentId = editingAssessmentId || `grade-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newAssessment: StudentGradeAssessment = {
      id: assessmentId,
      date: gradeDate,
      teacherName: gradeTeacherName || activeLoggedInTeacherName || 'Guru Pengajar',
      classId: gradeClassId,
      className: selectedClassObj ? selectedClassObj.name : 'Kelas',
      subject: resolvedSubject,
      material: gradeMaterial.trim(),
      semester: gradeSemester,
      grades: gradeItems,
      createdAt: editingAssessmentId ? (savedAssessments.find(a => a.id === editingAssessmentId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const existingIdx = savedAssessments.findIndex(a => a.id === assessmentId);
    let updatedList: StudentGradeAssessment[];
    if (existingIdx >= 0) {
      updatedList = [...savedAssessments];
      updatedList[existingIdx] = newAssessment;
    } else {
      updatedList = [newAssessment, ...savedAssessments];
    }

    setSavedAssessments(updatedList);
    saveStudentGradeAssessments(updatedList);
    setEditingAssessmentId(null);
    onShowSuccessToast(`Daftar Nilai Siswa Kelas ${newAssessment.className} (${newAssessment.subject}) berhasil disimpan!`);
  };

  // Load an existing assessment into form for editing/updating
  const handleLoadAssessment = (assessment: StudentGradeAssessment) => {
    setEditingAssessmentId(assessment.id);
    setGradeDate(assessment.date);
    setGradeClassId(assessment.classId);
    setGradeTeacherName(assessment.teacherName);
    setGradeMaterial(assessment.material);
    setGradeSemester(assessment.semester || '1 (Ganjil)');

    if (availableSubjectsList.includes(assessment.subject)) {
      setGradeSubject(assessment.subject);
      setGradeCustomSubject('');
    } else {
      setGradeSubject('LAINNYA');
      setGradeCustomSubject(assessment.subject);
    }

    const scoresMap: { [id: string]: { dailyScore: number | null; assignmentScore: number | null; examScore: number | null; notes: string } } = {};
    assessment.grades.forEach(item => {
      scoresMap[item.studentId] = {
        dailyScore: item.dailyScore !== undefined ? item.dailyScore : null,
        assignmentScore: item.assignmentScore !== undefined ? item.assignmentScore : null,
        examScore: item.examScore !== undefined ? item.examScore : null,
        notes: item.notes || ''
      };
    });
    setStudentScores(scoresMap);
    onShowSuccessToast(`Data Nilai ${assessment.className} - ${assessment.subject} dimuat ke formulir!`);
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  // Delete an assessment
  const handleDeleteAssessment = (assessmentId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data rekap penilaian ini?')) {
      const updated = savedAssessments.filter(a => a.id !== assessmentId);
      setSavedAssessments(updated);
      saveStudentGradeAssessments(updated);
      if (editingAssessmentId === assessmentId) {
        setEditingAssessmentId(null);
      }
      onShowSuccessToast('Data penilaian berhasil dihapus.');
    }
  };

  // Filtered saved assessments history
  const filteredHistory = useMemo(() => {
    return savedAssessments.filter(a => {
      const matchClass = historyClassFilter === 'ALL' || a.classId === historyClassFilter;
      const matchSearch = historySearchQuery.trim() === '' || 
        a.subject.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        a.material.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        a.teacherName.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        a.className.toLowerCase().includes(historySearchQuery.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [savedAssessments, historyClassFilter, historySearchQuery]);

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Form Card: Input Nilai Siswa */}
      <form onSubmit={handleSaveGrades} className="space-y-6">
        
        {/* Card 1: Pengaturan Penilaian & Kelas */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  Form Input Nilai Siswa
                  {editingAssessmentId && (
                    <span className="text-[10.5px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full">
                      Mode Edit / Perbarui
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Input nilai harian, tugas, dan ulangan siswa per kelas yang terintegrasi dengan data Jurnal Kegiatan Belajar Mengajar.
                </p>
              </div>
            </div>

            {/* Quick Actions Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleResetForm}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Kosongkan nilai input form"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Form</span>
              </button>
            </div>
          </div>

          {/* Form Context Inputs: Tanggal, Nama Guru, Pilih Kelas, Mata Pelajaran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Tanggal */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Tanggal Penilaian
              </label>
              <input
                type="date"
                required
                value={gradeDate}
                onChange={(e) => setGradeDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {/* Nama Guru (Akun Login / Pengajar) */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                Nama Guru (Akun Login)
              </label>
              <div className="w-full bg-slate-100/90 border border-slate-200/80 text-slate-800 text-xs font-bold rounded-xl p-3 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">{gradeTeacherName || activeLoggedInTeacherName || 'Guru Pengajar'}</span>
              </div>
            </div>

            {/* Pilih Kelas */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Pilih Kelas
              </label>
              <select
                value={gradeClassId}
                onChange={(e) => {
                  setGradeClassId(e.target.value);
                  setStudentScores({});
                }}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-black rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {sortedClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name} ({c.grade})
                  </option>
                ))}
              </select>
            </div>

            {/* Pilih Mata Pelajaran */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                Mata Pelajaran
              </label>
              <select
                value={gradeSubject}
                onChange={(e) => setGradeSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {availableSubjectsList.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
                <option value="LAINNYA">+ Ketik Mata Pelajaran Lain</option>
              </select>

              {gradeSubject === 'LAINNYA' && (
                <input
                  type="text"
                  required
                  value={gradeCustomSubject}
                  onChange={(e) => setGradeCustomSubject(e.target.value)}
                  placeholder="Tulis Mata Pelajaran..."
                  className="mt-2 w-full bg-white border border-indigo-300 text-slate-900 text-xs font-bold rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>

          </div>

          {/* Materi Pelajaran & Quick Sync with KBM Journal */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                Materi Pelajaran / Pokok Bahasan Penilaian
              </label>

              {/* Suggestions from KBM Journals */}
              {recentClassJournals.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-500">Ambil dari Jurnal KBM:</span>
                  {recentClassJournals.slice(0, 2).map((j, idx) => (
                    <button
                      key={j.id || idx}
                      type="button"
                      onClick={() => {
                        setGradeMaterial(j.material);
                        setGradeSubject(j.subject);
                      }}
                      className="text-[10.5px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer truncate max-w-[200px]"
                      title={`Klik untuk menggunakan materi: ${j.material}`}
                    >
                      {j.subject}: {j.material}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              type="text"
              required
              value={gradeMaterial}
              onChange={(e) => setGradeMaterial(e.target.value)}
              placeholder="Contoh: Bab 3 - Persamaan Linier Dua Variabel / Teks Deskriptif"
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

        </div>

        {/* Card 2: Live Statistics & Search Header for Student Table */}
        <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Left: Summary Numbers */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold">Total Siswa</div>
                  <div className="text-sm font-black text-white">{classStudents.length} Siswa</div>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>

              <div>
                <div className="text-[11px] text-slate-400 font-semibold">Sudah Dinilai</div>
                <div className="text-sm font-black text-emerald-400">
                  {classStats.assessedCount} / {classStudents.length}
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>

              <div>
                <div className="text-[11px] text-slate-400 font-semibold">Rata-Rata Kelas</div>
                <div className="text-sm font-black text-amber-300">
                  {classStats.classAverage !== null ? classStats.classAverage : '-'}
                </div>
              </div>

              {classStats.maxScore !== null && (
                <>
                  <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-semibold">Tertinggi / Terendah</div>
                    <div className="text-xs font-extrabold text-slate-200">
                      <span className="text-emerald-400 font-black">{classStats.maxScore}</span> / <span className="text-rose-400 font-black">{classStats.minScore}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right: Search Filter */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                placeholder="Cari nama siswa / NISN..."
                className="w-full bg-slate-800/90 border border-slate-700 text-white text-xs font-semibold pl-10 pr-3 py-2 rounded-xl focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-500"
              />
            </div>

          </div>
        </div>

        {/* Card 3: TABEL NILAI SISWA (Pilihan Nilai Harian, Nilai Tugas, Nilai Ulangan) */}
        <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm">
          
          {/* Header Card & Tombol Pilihan Kategori */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 border-b border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Tabel Nilai Siswa Kelas {classes.find(c => c.id === gradeClassId)?.name || ''}
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Mata Pelajaran: <strong className="text-indigo-700">{currentActiveSubject}</strong> | Materi: <strong className="text-slate-800">{gradeMaterial || '(Belum diisi)'}</strong>
              </p>
            </div>

            {/* Tombol Pilihan Kategori: Nilai Harian | Nilai Tugas | Nilai Ulangan | Semua Nilai */}
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex-wrap self-start xl:self-auto">
              <button
                type="button"
                onClick={() => setInputGradeCategory('HARIAN')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  inputGradeCategory === 'HARIAN'
                    ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-500/20'
                    : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                }`}
              >
                <span>Nilai Harian</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                  inputGradeCategory === 'HARIAN' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  NH
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInputGradeCategory('TUGAS')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  inputGradeCategory === 'TUGAS'
                    ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-600/20'
                    : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50'
                }`}
              >
                <span>Nilai Tugas</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                  inputGradeCategory === 'TUGAS' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  NT
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInputGradeCategory('ULANGAN')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  inputGradeCategory === 'ULANGAN'
                    ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/20'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <span>Nilai Ulangan</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                  inputGradeCategory === 'ULANGAN' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  NU
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInputGradeCategory('ALL')}
                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  inputGradeCategory === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Semua (Lengkap)</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                {/* 1. HEADER: NILAI HARIAN (NH) */}
                {inputGradeCategory === 'HARIAN' && (
                  <tr className="bg-slate-100/90 text-slate-700 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-4 text-center w-12">No</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Nama Siswa</th>

                    {/* Kolom Input Nilai Harian */}
                    <th className="py-2.5 px-3 text-center bg-amber-500 text-white font-black border-x border-amber-600 min-w-[160px] shadow-xs relative">
                      <div className="text-[11px] font-black uppercase tracking-wide">Input Nilai Harian</div>
                      <div className="mt-1.5 flex items-center justify-center font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickFillCategory(quickFillCategory === 'HARIAN' ? null : 'HARIAN');
                            setQuickFillValue('80');
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg border border-amber-400/80 shadow-xs flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
                          title="Isi nilai harian cepat ke seluruh siswa di kelas"
                        >
                          <Zap className="w-3 h-3 text-amber-200 fill-amber-200" />
                          <span>Isi Nilai Cepat</span>
                        </button>
                      </div>

                      {/* Popover Quick Fill Harian */}
                      {quickFillCategory === 'HARIAN' && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-amber-500/50 z-50 animate-fadeIn text-left font-sans">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 fill-amber-400" /> Isi Cepat Nilai Harian
                            </span>
                            <button 
                              type="button" 
                              onClick={() => setQuickFillCategory(null)}
                              className="text-slate-400 hover:text-white text-xs font-bold px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                          <p className="text-[10.5px] text-slate-300 mt-2 font-medium leading-relaxed">
                            Terapkan ke seluruh <strong>{classStudents.length} siswa</strong>. Setiap siswa tetap dapat diubah nilainya kemudian.
                          </p>
                          <div className="flex items-center gap-1.5 mt-2.5">
                            {[75, 80, 85, 90].map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleApplyCategoryQuickFill('HARIAN', preset)}
                                className="flex-1 py-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 rounded-lg text-xs font-black border border-slate-700 transition-colors cursor-pointer"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-2.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={quickFillValue}
                              onChange={(e) => setQuickFillValue(e.target.value)}
                              placeholder="0-100"
                              className="w-20 bg-slate-800 border border-slate-700 text-white font-black text-xs rounded-lg py-1.5 px-2 text-center focus:ring-2 focus:ring-amber-400"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyCategoryQuickFill('HARIAN')}
                              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                              Terapkan Semua
                            </button>
                          </div>
                        </div>
                      )}
                    </th>

                    <th className="py-3.5 px-4 text-center w-36 bg-slate-100 font-black text-slate-800">
                      Predikat
                    </th>
                    <th className="py-3.5 px-4 min-w-[180px]">Catatan / Evaluasi</th>
                  </tr>
                )}

                {/* 2. HEADER: NILAI TUGAS (NT) */}
                {inputGradeCategory === 'TUGAS' && (
                  <tr className="bg-slate-100/90 text-slate-700 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-4 text-center w-12">No</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Nama Siswa</th>

                    {/* Kolom Input Nilai Tugas */}
                    <th className="py-2.5 px-3 text-center bg-indigo-600 text-white font-black border-x border-indigo-700 min-w-[160px] shadow-xs relative">
                      <div className="text-[11px] font-black uppercase tracking-wide">Input Nilai Tugas</div>
                      <div className="mt-1.5 flex items-center justify-center font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickFillCategory(quickFillCategory === 'TUGAS' ? null : 'TUGAS');
                            setQuickFillValue('80');
                          }}
                          className="bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg border border-indigo-400/80 shadow-xs flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
                          title="Isi nilai tugas cepat ke seluruh siswa di kelas"
                        >
                          <Zap className="w-3 h-3 text-indigo-200 fill-indigo-200" />
                          <span>Isi Nilai Cepat</span>
                        </button>
                      </div>

                      {/* Popover Quick Fill Tugas */}
                      {quickFillCategory === 'TUGAS' && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-indigo-500/50 z-50 animate-fadeIn text-left font-sans">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-xs font-black text-indigo-300 flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 fill-indigo-400" /> Isi Cepat Nilai Tugas
                            </span>
                            <button 
                              type="button" 
                              onClick={() => setQuickFillCategory(null)}
                              className="text-slate-400 hover:text-white text-xs font-bold px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                          <p className="text-[10.5px] text-slate-300 mt-2 font-medium leading-relaxed">
                            Terapkan ke seluruh <strong>{classStudents.length} siswa</strong>. Setiap siswa tetap dapat diubah nilainya kemudian.
                          </p>
                          <div className="flex items-center gap-1.5 mt-2.5">
                            {[75, 80, 85, 90].map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleApplyCategoryQuickFill('TUGAS', preset)}
                                className="flex-1 py-1 bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-300 rounded-lg text-xs font-black border border-slate-700 transition-colors cursor-pointer"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-2.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={quickFillValue}
                              onChange={(e) => setQuickFillValue(e.target.value)}
                              placeholder="0-100"
                              className="w-20 bg-slate-800 border border-slate-700 text-white font-black text-xs rounded-lg py-1.5 px-2 text-center focus:ring-2 focus:ring-indigo-400"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyCategoryQuickFill('TUGAS')}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                              Terapkan Semua
                            </button>
                          </div>
                        </div>
                      )}
                    </th>

                    <th className="py-3.5 px-4 text-center w-36 bg-slate-100 font-black text-slate-800">
                      Predikat
                    </th>
                    <th className="py-3.5 px-4 min-w-[180px]">Catatan / Evaluasi</th>
                  </tr>
                )}

                {/* 3. HEADER: NILAI ULANGAN (NU) */}
                {inputGradeCategory === 'ULANGAN' && (
                  <tr className="bg-slate-100/90 text-slate-700 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-4 text-center w-12">No</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Nama Siswa</th>

                    {/* Kolom Input Nilai Ulangan */}
                    <th className="py-2.5 px-3 text-center bg-emerald-600 text-white font-black border-x border-emerald-700 min-w-[160px] shadow-xs relative">
                      <div className="text-[11px] font-black uppercase tracking-wide">Input Nilai Ulangan</div>
                      <div className="mt-1.5 flex items-center justify-center font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickFillCategory(quickFillCategory === 'ULANGAN' ? null : 'ULANGAN');
                            setQuickFillValue('80');
                          }}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg border border-emerald-400/80 shadow-xs flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
                          title="Isi nilai ulangan cepat ke seluruh siswa di kelas"
                        >
                          <Zap className="w-3 h-3 text-emerald-200 fill-emerald-200" />
                          <span>Isi Nilai Cepat</span>
                        </button>
                      </div>

                      {/* Popover Quick Fill Ulangan */}
                      {quickFillCategory === 'ULANGAN' && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/50 z-50 animate-fadeIn text-left font-sans">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-xs font-black text-emerald-300 flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 fill-emerald-400" /> Isi Cepat Nilai Ulangan
                            </span>
                            <button 
                              type="button" 
                              onClick={() => setQuickFillCategory(null)}
                              className="text-slate-400 hover:text-white text-xs font-bold px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                          <p className="text-[10.5px] text-slate-300 mt-2 font-medium leading-relaxed">
                            Terapkan ke seluruh <strong>{classStudents.length} siswa</strong>. Setiap siswa tetap dapat diubah nilainya kemudian.
                          </p>
                          <div className="flex items-center gap-1.5 mt-2.5">
                            {[75, 80, 85, 90].map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleApplyCategoryQuickFill('ULANGAN', preset)}
                                className="flex-1 py-1 bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-300 rounded-lg text-xs font-black border border-slate-700 transition-colors cursor-pointer"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-2.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={quickFillValue}
                              onChange={(e) => setQuickFillValue(e.target.value)}
                              placeholder="0-100"
                              className="w-20 bg-slate-800 border border-slate-700 text-white font-black text-xs rounded-lg py-1.5 px-2 text-center focus:ring-2 focus:ring-emerald-400"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyCategoryQuickFill('ULANGAN')}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                              Terapkan Semua
                            </button>
                          </div>
                        </div>
                      )}
                    </th>

                    <th className="py-3.5 px-4 text-center w-36 bg-slate-100 font-black text-slate-800">
                      Predikat
                    </th>
                    <th className="py-3.5 px-4 min-w-[180px]">Catatan / Evaluasi</th>
                  </tr>
                )}

                {/* 4. HEADER: SEMUA NILAI (LENGKAP) */}
                {inputGradeCategory === 'ALL' && (
                  <tr className="bg-slate-100/90 text-slate-700 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-4 text-center w-12">No</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Nama Siswa</th>
                    <th className="py-2.5 px-3 text-center w-36 bg-amber-50/70 text-amber-950 border-x border-amber-200/60 relative">
                      <div className="text-[11px] font-black uppercase">Nilai Harian</div>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickFillCategory(quickFillCategory === 'HARIAN' ? null : 'HARIAN');
                          setQuickFillValue('80');
                        }}
                        className="mt-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-[9.5px] px-2 py-0.5 rounded-md flex items-center justify-center gap-1 mx-auto shadow-2xs cursor-pointer"
                      >
                        <Zap className="w-2.5 h-2.5 fill-white" />
                        <span>Isi Cepat</span>
                      </button>

                      {quickFillCategory === 'HARIAN' && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-amber-500/50 z-50 animate-fadeIn text-left font-sans">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                            <span className="text-[11px] font-black text-amber-400">Isi Nilai Harian</span>
                            <button type="button" onClick={() => setQuickFillCategory(null)} className="text-slate-400 hover:text-white text-xs font-bold px-1">✕</button>
                          </div>
                          <div className="flex items-center gap-1 mt-2">
                            {[75, 80, 85, 90].map(preset => (
                              <button key={preset} type="button" onClick={() => handleApplyCategoryQuickFill('HARIAN', preset)} className="flex-1 py-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 rounded text-[11px] font-black">{preset}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="py-2.5 px-3 text-center w-36 bg-indigo-50/70 text-indigo-950 border-r border-indigo-200/60 relative">
                      <div className="text-[11px] font-black uppercase">Nilai Tugas</div>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickFillCategory(quickFillCategory === 'TUGAS' ? null : 'TUGAS');
                          setQuickFillValue('80');
                        }}
                        className="mt-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9.5px] px-2 py-0.5 rounded-md flex items-center justify-center gap-1 mx-auto shadow-2xs cursor-pointer"
                      >
                        <Zap className="w-2.5 h-2.5 fill-white" />
                        <span>Isi Cepat</span>
                      </button>

                      {quickFillCategory === 'TUGAS' && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-indigo-500/50 z-50 animate-fadeIn text-left font-sans">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                            <span className="text-[11px] font-black text-indigo-300">Isi Nilai Tugas</span>
                            <button type="button" onClick={() => setQuickFillCategory(null)} className="text-slate-400 hover:text-white text-xs font-bold px-1">✕</button>
                          </div>
                          <div className="flex items-center gap-1 mt-2">
                            {[75, 80, 85, 90].map(preset => (
                              <button key={preset} type="button" onClick={() => handleApplyCategoryQuickFill('TUGAS', preset)} className="flex-1 py-1 bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-300 rounded text-[11px] font-black">{preset}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="py-2.5 px-3 text-center w-36 bg-emerald-50/70 text-emerald-950 border-r border-emerald-200/60 relative">
                      <div className="text-[11px] font-black uppercase">Nilai Ulangan</div>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickFillCategory(quickFillCategory === 'ULANGAN' ? null : 'ULANGAN');
                          setQuickFillValue('80');
                        }}
                        className="mt-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9.5px] px-2 py-0.5 rounded-md flex items-center justify-center gap-1 mx-auto shadow-2xs cursor-pointer"
                      >
                        <Zap className="w-2.5 h-2.5 fill-white" />
                        <span>Isi Cepat</span>
                      </button>

                      {quickFillCategory === 'ULANGAN' && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-emerald-500/50 z-50 animate-fadeIn text-left font-sans">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                            <span className="text-[11px] font-black text-emerald-300">Isi Nilai Ulangan</span>
                            <button type="button" onClick={() => setQuickFillCategory(null)} className="text-slate-400 hover:text-white text-xs font-bold px-1">✕</button>
                          </div>
                          <div className="flex items-center gap-1 mt-2">
                            {[75, 80, 85, 90].map(preset => (
                              <button key={preset} type="button" onClick={() => handleApplyCategoryQuickFill('ULANGAN', preset)} className="flex-1 py-1 bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-300 rounded text-[11px] font-black">{preset}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="py-3.5 px-4 text-center w-28">Rata-Rata</th>
                    <th className="py-3.5 px-4 text-center w-36">Predikat</th>
                    <th className="py-3.5 px-4 min-w-[180px]">Catatan / Evaluasi</th>
                  </tr>
                )}
              </thead>

              <tbody className="divide-y divide-slate-200/70 text-xs font-mono">
                {displayedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-sans font-bold">
                      {classStudents.length === 0 
                        ? 'Belum ada data siswa di kelas ini.' 
                        : 'Tidak ada siswa yang cocok dengan pencarian.'}
                    </td>
                  </tr>
                ) : (
                  displayedStudents.map((std, idx) => {
                    const score = studentScores[std.id] || { dailyScore: null, assignmentScore: null, examScore: null, notes: '' };

                    // 1. DATA UNTUK MODE HARIAN
                    const predDaily = getGradePredicate(score.dailyScore);

                    // 2. DATA UNTUK MODE TUGAS
                    const predTugas = getGradePredicate(score.assignmentScore);

                    // 3. DATA UNTUK MODE ULANGAN
                    const predUlangan = getGradePredicate(score.examScore);

                    // 4. DATA UNTUK MODE ALL
                    const finalAvgAll = calculateStudentFinalScore(score.dailyScore, score.assignmentScore, score.examScore);
                    const predAll = getGradePredicate(finalAvgAll);

                    return (
                      <tr 
                        key={std.id}
                        className="hover:bg-slate-50/90 transition-colors"
                      >
                        {/* No */}
                        <td className="py-3 px-4 text-center font-sans font-extrabold text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Nama Siswa */}
                        <td className="py-3 px-4 font-sans">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-200 overflow-hidden shrink-0 border border-slate-300">
                              <img 
                                src={std.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} 
                                alt={std.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900">{std.name}</div>
                              <div className="text-[11px] text-slate-500 font-semibold">NISN: {std.nisn}</div>
                            </div>
                          </div>
                        </td>

                        {/* TAMPILAN MODE HARIAN */}
                        {inputGradeCategory === 'HARIAN' && (
                          <>
                            {/* Input Nilai Harian */}
                            <td className="py-3 px-3 text-center bg-amber-50/70 border-x border-amber-300 font-sans">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={score.dailyScore !== null && score.dailyScore !== undefined ? score.dailyScore : ''}
                                onChange={(e) => handleScoreChange(std.id, 'dailyScore', e.target.value)}
                                placeholder="0"
                                className="w-20 text-center font-black text-xs text-amber-950 bg-white border-2 border-amber-400 rounded-xl py-2 px-1 focus:ring-2 focus:ring-amber-500 shadow-xs"
                              />
                            </td>

                            {/* Predikat NH */}
                            <td className="py-3 px-3 text-center font-sans">
                              <span className={`inline-block font-black text-[11px] px-2.5 py-1 rounded-xl border ${predDaily.bg} ${predDaily.color}`}>
                                {predDaily.label}
                              </span>
                            </td>
                          </>
                        )}

                        {/* TAMPILAN MODE TUGAS */}
                        {inputGradeCategory === 'TUGAS' && (
                          <>
                            {/* Input Nilai Tugas */}
                            <td className="py-3 px-3 text-center bg-indigo-50/70 border-x border-indigo-300 font-sans">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={score.assignmentScore !== null && score.assignmentScore !== undefined ? score.assignmentScore : ''}
                                onChange={(e) => handleScoreChange(std.id, 'assignmentScore', e.target.value)}
                                placeholder="0"
                                className="w-20 text-center font-black text-xs text-indigo-950 bg-white border-2 border-indigo-400 rounded-xl py-2 px-1 focus:ring-2 focus:ring-indigo-500 shadow-xs"
                              />
                            </td>

                            {/* Predikat NT */}
                            <td className="py-3 px-3 text-center font-sans">
                              <span className={`inline-block font-black text-[11px] px-2.5 py-1 rounded-xl border ${predTugas.bg} ${predTugas.color}`}>
                                {predTugas.label}
                              </span>
                            </td>
                          </>
                        )}

                        {/* TAMPILAN MODE ULANGAN */}
                        {inputGradeCategory === 'ULANGAN' && (
                          <>
                            {/* Input Nilai Ulangan */}
                            <td className="py-3 px-3 text-center bg-emerald-50/70 border-x border-emerald-300 font-sans">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={score.examScore !== null && score.examScore !== undefined ? score.examScore : ''}
                                onChange={(e) => handleScoreChange(std.id, 'examScore', e.target.value)}
                                placeholder="0"
                                className="w-20 text-center font-black text-xs text-emerald-950 bg-white border-2 border-emerald-400 rounded-xl py-2 px-1 focus:ring-2 focus:ring-emerald-500 shadow-xs"
                              />
                            </td>

                            {/* Predikat NU */}
                            <td className="py-3 px-3 text-center font-sans">
                              <span className={`inline-block font-black text-[11px] px-2.5 py-1 rounded-xl border ${predUlangan.bg} ${predUlangan.color}`}>
                                {predUlangan.label}
                              </span>
                            </td>
                          </>
                        )}

                        {/* TAMPILAN MODE SEMUA NILAI (LENGKAP) */}
                        {inputGradeCategory === 'ALL' && (
                          <>
                            {/* Nilai Harian */}
                            <td className="py-3 px-3 text-center bg-amber-50/30 border-x border-amber-100 font-sans">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={score.dailyScore !== null && score.dailyScore !== undefined ? score.dailyScore : ''}
                                onChange={(e) => handleScoreChange(std.id, 'dailyScore', e.target.value)}
                                placeholder="0"
                                className="w-20 text-center font-black text-xs text-amber-950 bg-white border border-amber-300 rounded-xl py-2 px-1 focus:ring-2 focus:ring-amber-500 shadow-xs"
                              />
                            </td>

                            {/* Nilai Tugas */}
                            <td className="py-3 px-3 text-center bg-indigo-50/30 border-r border-indigo-100 font-sans">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={score.assignmentScore !== null && score.assignmentScore !== undefined ? score.assignmentScore : ''}
                                onChange={(e) => handleScoreChange(std.id, 'assignmentScore', e.target.value)}
                                placeholder="0"
                                className="w-20 text-center font-black text-xs text-indigo-950 bg-white border border-indigo-300 rounded-xl py-2 px-1 focus:ring-2 focus:ring-indigo-500 shadow-xs"
                              />
                            </td>

                            {/* Nilai Ulangan */}
                            <td className="py-3 px-3 text-center bg-emerald-50/30 border-r border-emerald-100 font-sans">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={score.examScore !== null && score.examScore !== undefined ? score.examScore : ''}
                                onChange={(e) => handleScoreChange(std.id, 'examScore', e.target.value)}
                                placeholder="0"
                                className="w-20 text-center font-black text-xs text-emerald-950 bg-white border border-emerald-300 rounded-xl py-2 px-1 focus:ring-2 focus:ring-emerald-500 shadow-xs"
                              />
                            </td>

                            {/* Rata-Rata */}
                            <td className="py-3 px-4 text-center font-mono">
                              <span className={`inline-block font-black px-2.5 py-1 rounded-xl text-xs ${
                                finalAvgAll !== null 
                                  ? 'bg-slate-900 text-white shadow-xs' 
                                  : 'bg-slate-100 text-slate-400 font-normal'
                              }`}>
                                {finalAvgAll !== null ? finalAvgAll : '-'}
                              </span>
                            </td>

                            {/* Predikat */}
                            <td className="py-3 px-4 text-center font-sans">
                              <span className={`inline-block font-black text-[11px] px-2.5 py-1 rounded-xl border ${predAll.bg} ${predAll.color}`}>
                                {predAll.label}
                              </span>
                            </td>
                          </>
                        )}

                        {/* Catatan / Evaluasi */}
                        <td className="py-3 px-4 font-sans">
                          <input
                            type="text"
                            value={score.notes || ''}
                            onChange={(e) => handleScoreChange(std.id, 'notes', e.target.value)}
                            placeholder="Catatan guru..."
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl py-1.5 px-3 focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Form Submit & Export Footer Bar */}
          <div className="p-5 bg-slate-50 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-600 font-semibold">
              Terisi: <strong className="text-slate-900">{classStats.assessedCount}</strong> dari {classStudents.length} siswa kelas {classes.find(c => c.id === gradeClassId)?.name}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
              >
                <Save className="w-4 h-4 text-indigo-200 shrink-0" />
                <span>{editingAssessmentId ? 'Perbarui Nilai Siswa' : 'Simpan Nilai Siswa'}</span>
              </button>
            </div>
          </div>

        </div>

      </form>

      {/* Card 4: RIWAYAT REKAP PENILAIAN TERSIMPAN (History & Export) */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Riwayat Daftar Nilai Tersimpan ({savedAssessments.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Daftar rekapan penilaian siswa yang tersimpan dapat diedit kembali atau diunduh dalam format PDF dan Excel.
              </p>
            </div>
          </div>

          {/* History Search and Class Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-xs font-extrabold text-slate-700 shrink-0">Filter Kelas:</span>
              <select
                value={historyClassFilter}
                onChange={(e) => setHistoryClassFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">Semua Kelas</option>
                {sortedClasses.map(c => (
                  <option key={c.id} value={c.id}>Kelas {c.name}</option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Cari materi / mapel..."
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold pl-8 pr-3 py-2 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* History List Cards */}
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Award className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">Belum Ada Rekap Nilai Tersimpan</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Silakan isi formulir di atas dan klik tombol "Simpan Nilai Siswa" untuk menyimpan penilaian.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredHistory.map(item => {
              const totalItems = item.grades.length;
              const assessedItems = item.grades.filter(g => g.finalScore !== null && g.finalScore !== undefined);
              const avg = assessedItems.length > 0
                ? Number((assessedItems.reduce((acc, curr) => acc + (curr.finalScore || 0), 0) / assessedItems.length).toFixed(1))
                : null;

              return (
                <div 
                  key={item.id}
                  className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-indigo-600 text-white font-black text-[11px] px-2.5 py-0.5 rounded-lg">
                          Kelas {item.className}
                        </span>
                        <span className="bg-slate-200 text-slate-800 font-bold text-[11px] px-2.5 py-0.5 rounded-lg">
                          {item.subject}
                        </span>
                        <span className="text-slate-500 font-semibold text-[11px]">
                          {item.date}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mt-2 line-clamp-1">
                        {item.material}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Guru: <strong className="text-slate-800">{item.teacherName}</strong>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10.5px] font-bold text-slate-400">Rata-Rata</div>
                      <div className="text-base font-black text-indigo-700">{avg !== null ? avg : '-'}</div>
                      <div className="text-[10px] text-slate-500 font-semibold">{assessedItems.length}/{totalItems} Siswa</div>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => handleLoadAssessment(item)}
                      className="bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Edit data nilai ini di form"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Muat / Edit</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportStudentGradesPdf(item, schoolProfile)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                        title="Download Dokumen PDF Daftar Nilai Siswa"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-200" />
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => exportStudentGradesExcel(item, schoolProfile)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                        title="Download Dokumen Excel Daftar Nilai Siswa"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Excel</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteAssessment(item.id)}
                        className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition-colors cursor-pointer"
                        title="Hapus rekapan nilai ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
};
