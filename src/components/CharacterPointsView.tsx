import React, { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { Student, SchoolClass, CharacterTrait, StudentCharacterLog, Teacher, SchoolProfile, CharacterPredicateSettings, UserSession, AttendanceRecord, LearningJournal } from '../types';
import { 
  isManualCharacterLog, 
  isKbmCharacterLog, 
  deduplicateCharacterLogs, 
  calculateStudentCharacterSummary, 
  calculateBatchStudentCharacterSummaries, 
  getLocalDateString, 
  isRealPhotoProof, 
  getPermanentManualCharacterLogs,
  savePermanentManualCharacterLogs,
  saveStudentCharacterLogs,
  getStudentCharacterLogs,
  restoreAllManualCharacterLogs,
  refreshCloudData
} from '../lib/storage';
import { getWitaDateTime, setAutoAssessmentBatchDone } from '../lib/autoCharacterScheduler';
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
  Filter,
  ShieldCheck,
  Download,
  FileText,
  Zap,
  AlertTriangle,
  RefreshCw,
  Calendar,
  UserX,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Flame,
  VolumeX,
  Layers,
  GraduationCap
} from 'lucide-react';

interface CharacterPointsViewProps {
  students: Student[];
  classes: SchoolClass[];
  traits: CharacterTrait[];
  logs: StudentCharacterLog[];
  teachers: Teacher[];
  attendanceRecords?: AttendanceRecord[];
  learningJournals?: LearningJournal[];
  onAddLog: (log: StudentCharacterLog) => void;
  onApplyMultipleLogs?: (logs: StudentCharacterLog[]) => void;
  onUpdateLog?: (log: StudentCharacterLog) => void;
  onDeleteLog: (logId: string) => void;
  onDeleteMultipleLogs?: (logIds: string[]) => void;
  currentUserRole?: string;
  schoolProfile?: SchoolProfile;
  onUpdateSchoolProfile?: (profile: SchoolProfile) => void;
  predicateSettings?: CharacterPredicateSettings;
  userSession?: UserSession | null;
}

export const CharacterPointsView: React.FC<CharacterPointsViewProps> = ({
  students,
  classes,
  traits,
  logs,
  teachers,
  attendanceRecords = [],
  learningJournals = [],
  onAddLog,
  onApplyMultipleLogs,
  onUpdateLog,
  onDeleteLog,
  onDeleteMultipleLogs,
  currentUserRole,
  schoolProfile,
  onUpdateSchoolProfile,
  predicateSettings = { minA: 30, minB: 10, minC: 0, minD: -20, minE: -50 },
  userSession,
}) => {
  const isAutoAssessmentEnabled = schoolProfile?.autoCharacterAssessmentEnabled !== false;
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Status Sinkronisasi On-Demand ke Cloud Firestore
  const [isRefreshingCloud, setIsRefreshingCloud] = useState<boolean>(false);
  const [cloudSyncFeedback, setCloudSyncFeedback] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';
  });

  const handleManualCloudRefresh = async () => {
    setIsRefreshingCloud(true);
    setCloudSyncFeedback(null);
    try {
      const res = await refreshCloudData(true);
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';
      setLastRefreshedAt(timeStr);
      setCloudSyncFeedback(`Data Nilai Karakter & Presensi Berhasil Disinkronkan (${timeStr}) • Data terbaru tersinkron dengan Cloud.`);
      setTimeout(() => setCloudSyncFeedback(null), 6000);
    } catch {
      setCloudSyncFeedback('Gagal menyinkronkan data karakter dengan Cloud. Periksa koneksi internet.');
      setTimeout(() => setCloudSyncFeedback(null), 5000);
    } finally {
      setIsRefreshingCloud(false);
    }
  };

  // Handler untuk memulihkan seluruh catatan nilai karakter manual guru dari brankas lokal & Cloud
  const [isRestoringManual, setIsRestoringManual] = useState<boolean>(false);
  const handleRestoreManualLogs = async () => {
    setIsRestoringManual(true);
    setCloudSyncFeedback(null);
    try {
      // 1. Pulihkan dari seluruh brankas & cadangan lokal
      restoreAllManualCharacterLogs();
      // 2. Baca snapshot terbaru dari Cloud Firestore
      await refreshCloudData(true);
      const manualCount = getPermanentManualCharacterLogs().length;
      setCloudSyncFeedback(`Berhasil memulihkan ${manualCount} catatan nilai karakter guru dari brankas lokal & Cloud! Seluruh nilai kini tampil di tabel.`);
      setTimeout(() => setCloudSyncFeedback(null), 7000);
    } catch {
      setCloudSyncFeedback('Gagal memulihkan catatan karakter guru. Coba kembali beberapa saat lagi.');
      setTimeout(() => setCloudSyncFeedback(null), 5000);
    } finally {
      setIsRestoringManual(false);
    }
  };

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
  const [inputIncidentDate, setInputIncidentDate] = useState<string>(() => getLocalDateString());
  const [inputStudentId, setInputStudentId] = useState<string>('');
  const [inputClassId, setInputClassId] = useState<string>('');
  const [inputTraitType, setInputTraitType] = useState<'POSITIF' | 'NEGATIF'>('POSITIF');
  const [inputTraitId, setInputTraitId] = useState<string>('');
  const [inputTraitSearch, setInputTraitSearch] = useState<string>('');
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
      console.warn("Camera access note:", err?.message || err);
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
    const maxDim = 360;
    let w = video.videoWidth || 640;
    let h = video.videoHeight || 480;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
      setInputPhotoUrl(dataUrl);
      setPhotoPreview(dataUrl);
    }
    handleCloseCamModal();
  };

  // Modal Detail Nilai State
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [highlightedLogId, setHighlightedLogId] = useState<string | null>(null);
  const [previewPhotoModalUrl, setPreviewPhotoModalUrl] = useState<string | null>(null);
  const [deleteConfirmLog, setDeleteConfirmLog] = useState<StudentCharacterLog | null>(null);
  const [isExportingDetail, setIsExportingDetail] = useState<boolean>(false);

  // Listen to deep linking notification event
  useEffect(() => {
    const handleOpenCharacterDetail = (e: any) => {
      const { studentId, studentName, characterLogId } = e.detail || {};
      let matchedStudent: Student | undefined;

      if (studentId) {
        matchedStudent = students.find(s => s.id === studentId || s.nisn === studentId);
      }
      if (!matchedStudent && studentName) {
        const cleanName = studentName.trim().toLowerCase();
        matchedStudent = students.find(s => s.name.toLowerCase() === cleanName || s.name.toLowerCase().includes(cleanName));
      }
      if (!matchedStudent && characterLogId) {
        const targetLog = logs.find(l => l.id === characterLogId);
        if (targetLog) {
          matchedStudent = students.find(s => s.id === targetLog.studentId || s.nisn === targetLog.nisn || s.name.toLowerCase() === targetLog.studentName.toLowerCase());
        }
      }

      if (matchedStudent) {
        setDetailStudent(matchedStudent);
        if (characterLogId) {
          setHighlightedLogId(characterLogId);
        }
        // Smoothly scroll to highlighted element if present
        setTimeout(() => {
          if (characterLogId) {
            const el = document.getElementById(`char-log-${characterLogId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 200);
      }
    };

    window.addEventListener('sihadir_open_character_detail', handleOpenCharacterDetail);
    return () => window.removeEventListener('sihadir_open_character_detail', handleOpenCharacterDetail);
  }, [students, logs]);

  // Handle Export Detail Nilai Karakter Siswa to PDF
  const handleExportDetailPdf = async () => {
    if (!detailStudent || !schoolProfile) return;
    setIsExportingDetail(true);
    try {
      const { exportStudentCharacterDetailPdf } = await import('../lib/exportUtils');
      await exportStudentCharacterDetailPdf(
        schoolProfile,
        detailStudent,
        logs,
        classes,
        predicateSettings,
        initialEvaluatorName,
        teachers,
        attendanceRecords
      );
    } catch (error) {
      console.error('Error exporting student character detail PDF:', error);
      alert('Gagal mengekspor PDF detail nilai karakter siswa. Pastikan format logo dan data valid.');
    } finally {
      setIsExportingDetail(false);
    }
  };

  // Modal Tindak Lanjut State
  const [followUpLog, setFollowUpLog] = useState<StudentCharacterLog | null>(null);
  const [followUpNotes, setFollowUpNotes] = useState<string>('');
  const [followUpPhotoUrl, setFollowUpPhotoUrl] = useState<string>('');
  const [followUpPhotoPreview, setFollowUpPhotoPreview] = useState<string | null>(null);
  const [followUpBy, setFollowUpBy] = useState<string>('');

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'id', { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  // Filter Nilai Karakter Siswa (Lebih besar dari / Kurang dari)
  const [scoreFilterOp, setScoreFilterOp] = useState<'ALL' | 'GTE' | 'LTE'>('ALL');
  const [scoreFilterVal, setScoreFilterVal] = useState<number>(0);

  // Gabungkan logs dari props dengan brankas manual permanen agar 100% catatan perilaku spesifik yang diinput guru dari tombol +isi nilai selalu terambil dan tampil
  const allLogs = useMemo(() => {
    const permanentManuals = getPermanentManualCharacterLogs();
    if (!permanentManuals || permanentManuals.length === 0) return logs || [];
    return deduplicateCharacterLogs([...permanentManuals, ...(logs || [])]);
  }, [logs]);

  // Pre-calculate/memoize character summary map for fast lookup and filtering using optimized batch index
  const studentScoresMap = useMemo(() => {
    return calculateBatchStudentCharacterSummaries(students, allLogs, attendanceRecords);
  }, [students, allLogs, attendanceRecords]);

  // Filter students based on Class, Search, and Score Filter (sorted Ascending by student name)
  const filteredStudents = useMemo(() => {
    const q = deferredSearchQuery.toLowerCase().trim();
    return students
      .filter(student => {
        const matchesClass = selectedClassId === 'ALL' || student.classId === selectedClassId;
        const matchesSearch = !q ||
          (student.name || '').toLowerCase().includes(q) ||
          String(student.nisn || '').includes(q) ||
          (student.className || '').toLowerCase().includes(q);
        if (!matchesClass || !matchesSearch) return false;

        if (scoreFilterOp !== 'ALL') {
          const score = studentScoresMap.get(student.id)?.netScore ?? 0;
          if (scoreFilterOp === 'GTE' && !(score >= scoreFilterVal)) return false;
          if (scoreFilterOp === 'LTE' && !(score <= scoreFilterVal)) return false;
        }

        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id', { numeric: true, sensitivity: 'base' }));
  }, [students, selectedClassId, deferredSearchQuery, scoreFilterOp, scoreFilterVal, studentScoresMap]);

  // Pagination State for fast, lag-free DOM rendering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassId, searchQuery, scoreFilterOp, scoreFilterVal, itemsPerPage]);

  const totalPages = itemsPerPage === -1 ? 1 : (Math.ceil(filteredStudents.length / itemsPerPage) || 1);
  const startIndex = itemsPerPage === -1 ? 0 : (currentPage - 1) * itemsPerPage;
  const displayedStudents = useMemo(() => {
    if (itemsPerPage === -1) return filteredStudents;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, startIndex, itemsPerPage]);

  const visiblePages = useMemo(() => {
    const maxVisible = 5;
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

  // Calculate character score summary for a student (using memoized cache with robust multi-field lookup)
  const getStudentScoreSummary = useCallback((studentId: string) => {
    if (!studentId) {
      return {
        positivePoints: 0,
        negativePoints: 0,
        netScore: 0,
        totalEntries: 0,
        logs: [],
        onTimeDays: 0,
        onTimeBonusPoints: 0,
        onTimeDates: [],
        lateDays: 0,
        latePenaltyPoints: 0,
        lateDates: [],
        alpaDays: 0,
        alpaPenaltyPoints: 0,
        alpaDates: [],
        unscannedInDays: 0,
        unscannedInPenaltyPoints: 0,
        unscannedInDates: [],
        unreturnedDays: 0,
        unreturnedPenaltyPoints: 0,
        unreturnedDates: []
      };
    }
    const cleanId = studentId.trim();
    const cached = studentScoresMap.get(cleanId) || 
                   studentScoresMap.get(studentId) || 
                   studentScoresMap.get(cleanId.toLowerCase());
    if (cached) return cached;

    const student = students.find(s => 
      s.id === studentId || 
      s.id?.trim() === cleanId || 
      s.id?.trim().toLowerCase() === cleanId.toLowerCase() || 
      (s.nisn && s.nisn !== '-' && s.nisn.trim() === cleanId)
    );
    if (!student) {
      return {
        positivePoints: 0,
        negativePoints: 0,
        netScore: 0,
        totalEntries: 0,
        logs: [],
        onTimeDays: 0,
        onTimeBonusPoints: 0,
        onTimeDates: [],
        lateDays: 0,
        latePenaltyPoints: 0,
        lateDates: [],
        alpaDays: 0,
        alpaPenaltyPoints: 0,
        alpaDates: [],
        unscannedInDays: 0,
        unscannedInPenaltyPoints: 0,
        unscannedInDates: [],
        unreturnedDays: 0,
        unreturnedPenaltyPoints: 0,
        unreturnedDates: []
      };
    }
    const computed = calculateStudentCharacterSummary(student, allLogs, attendanceRecords);
    if (student.id) {
      studentScoresMap.set(student.id, computed);
      studentScoresMap.set(student.id.trim(), computed);
      studentScoresMap.set(student.id.trim().toLowerCase(), computed);
    }
    return computed;
  }, [studentScoresMap, students, allLogs, attendanceRecords]);

  // Memoized character score summary for currently viewed detail student (prevents redundant recomputations)
  const detailStudentScore = useMemo(() => {
    if (!detailStudent) return null;
    return getStudentScoreSummary(detailStudent.id);
  }, [detailStudent, getStudentScoreSummary]);

  // Memoized character logs for currently viewed detail student (sorted newest first)
  const studentDetailLogs = useMemo(() => {
    if (!detailStudentScore?.logs) return [] as StudentCharacterLog[];
    return [...detailStudentScore.logs].sort((a, b) => {
      const timeA = (a.timestamp || a.date || '').trim();
      const timeB = (b.timestamp || b.date || '').trim();
      return timeB.localeCompare(timeA);
    });
  }, [detailStudentScore]);

  // Handle Photo File Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 360;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
            setInputPhotoUrl(dataUrl);
            setPhotoPreview(dataUrl);
          } else {
            setInputPhotoUrl(result);
            setPhotoPreview(result);
          }
        };
        img.onerror = () => {
          setInputPhotoUrl(result);
          setPhotoPreview(result);
        };
        img.src = result;
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
    
    setInputIncidentDate(getLocalDateString());
    setInputTraitType('POSITIF');
    setInputTraitSearch('');
    const firstPosTrait = traits.find(t => t.type === 'POSITIF');
    setInputTraitId(firstPosTrait?.id || traits[0]?.id || '');
    setInputPhotoUrl('');
    setPhotoPreview(null);
    setInputNotes('');
    setShowAddModal(true);
  };

  // Open Modal for specific preset trait (Upacara / IMTAQ)
  const handleOpenAddModalForSpecificTrait = (traitKeyword: string, student?: Student) => {
    const targetStudent = student || (selectedClassId !== 'ALL' ? filteredStudents[0] : students[0]);
    if (targetStudent) {
      setInputClassId(targetStudent.classId);
      setInputStudentId(targetStudent.id);
    }
    setInputIncidentDate(getLocalDateString());
    setInputTraitType('POSITIF');
    setInputTraitSearch('');
    const matched = traits.find(t => t.type === 'POSITIF' && t.name.toLowerCase().includes(traitKeyword.toLowerCase()));
    if (matched) {
      setInputTraitId(matched.id);
    } else {
      const firstPosTrait = traits.find(t => t.type === 'POSITIF');
      setInputTraitId(firstPosTrait?.id || traits[0]?.id || '');
    }
    setInputPhotoUrl('');
    setPhotoPreview(null);
    setInputNotes(traitKeyword.toLowerCase().includes('upacara') 
      ? 'Menjadi Petugas Upacara Bendera hari Senin (Disiplin & Kepemimpinan)'
      : 'Menjadi Petugas Kegiatan IMTAQ / Sholat Dhuha hari Jumat');
    setShowAddModal(true);
  };

  // Handle changing character type filter (POSITIF / NEGATIF) in modal
  const handleTraitTypeChange = (type: 'POSITIF' | 'NEGATIF') => {
    setInputTraitType(type);
    setInputTraitSearch('');
    const matchingTraits = traits.filter(t => t.type === type);
    if (matchingTraits.length > 0) {
      setInputTraitId(matchingTraits[0].id);
    } else {
      setInputTraitId('');
    }
  };

  // Filtered traits for Modal selection based on type and search query
  const filteredModalTraits = useMemo(() => {
    return traits.filter(t => {
      if (t.type !== inputTraitType) return false;
      if (!inputTraitSearch.trim()) return true;
      const q = inputTraitSearch.toLowerCase().trim();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        String(t.points).includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    });
  }, [traits, inputTraitType, inputTraitSearch]);

  // Submit New Character Point Log
  const handleSubmitLog = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedStudent = students.find(s => s.id === inputStudentId) || (detailStudent?.id === inputStudentId ? detailStudent : undefined) || detailStudent;
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
    const timePart = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const selectedDate = inputIncidentDate && /^\d{4}-\d{2}-\d{2}$/.test(inputIncidentDate) 
      ? inputIncidentDate 
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const formattedTimestamp = `${selectedDate} ${timePart}`;

    const newLog: StudentCharacterLog = {
      id: 'log-manual-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
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
      date: selectedDate,
      photoProofUrl: inputPhotoUrl && inputPhotoUrl.trim() !== '' ? inputPhotoUrl.trim() : undefined,
      notes: inputNotes.trim(),
      isManual: true
    };

    // 1. Simpan langsung ke brankas manual permanen (anti-hilang)
    savePermanentManualCharacterLogs([newLog]);

    // 2. Simpan juga ke storage dan sinkronkan ke cloud
    const currentLogs = getStudentCharacterLogs();
    const updated = deduplicateCharacterLogs([newLog, ...currentLogs]);
    saveStudentCharacterLogs(updated, true);

    // 3. Panggil callback props
    onAddLog(newLog);
    setHighlightedLogId(newLog.id);
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

      const scoreFilterDescription = scoreFilterOp === 'ALL'
        ? 'Semua Nilai'
        : scoreFilterOp === 'GTE'
        ? `Lebih Besar (≥) ${scoreFilterVal}`
        : `Kurang Dari (≤) ${scoreFilterVal}`;

      const { exportCharacterPointsPdf } = await import('../lib/exportUtils');
      await exportCharacterPointsPdf(
        schoolProfile,
        filteredStudents, // Data siswa yang telah difilter sesuai parameter kelas & nilai karakter yang sedang aktif
        classes,
        traits,
        allLogs,
        selectedClassFilter,
        undefined,
        predicateSettings,
        teachers,
        undefined,
        {
          scoreFilterLabel: scoreFilterDescription,
          attendanceRecords,
          studentScoresMap,
          searchQuery: searchQuery.trim() || undefined
        }
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
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full text-xs font-bold border border-amber-400/30">
              <Award className="w-4 h-4 text-amber-400" /> Laporan Penilaian Karakter
            </div>
            <div className="inline-flex items-center gap-1.5 bg-sky-400/20 text-sky-200 border border-sky-400/30 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Cloud Tersinkron</span>
              <span className="text-sky-300 font-mono text-[10px]">• {lastRefreshedAt}</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Nilai Karakter Siswa
          </h1>
          <p className="text-sm text-indigo-200/90 mt-1 max-w-2xl">
            Pencatatan dan rekap nilai karakter positif serta negatif siswa beserta penilai dan bukti foto kegiatan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {currentUserRole === 'ADMIN' && (
            <button
              type="button"
              onClick={handleManualCloudRefresh}
              disabled={isRefreshingCloud}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-extrabold rounded-2xl shadow-sm transition-all transform active:scale-95 cursor-pointer shrink-0 text-xs disabled:opacity-60 backdrop-blur-xs"
              title="Segarkan data nilai karakter & presensi siswa terbaru dari Cloud Firestore"
            >
              <RefreshCw className={`w-4 h-4 text-sky-300 ${isRefreshingCloud ? 'animate-spin' : ''}`} />
              <span>{isRefreshingCloud ? 'Menyinkronkan...' : 'Segarkan Cloud'}</span>
              <span className="text-[10px] font-mono text-indigo-200 hidden sm:inline">
                ({lastRefreshedAt})
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRestoreManualLogs}
            disabled={isRestoringManual}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-extrabold rounded-2xl shadow-sm transition-all transform active:scale-95 cursor-pointer shrink-0 text-xs disabled:opacity-60 backdrop-blur-xs"
            title="Pulihkan dan cari kembali seluruh catatan nilai karakter yang pernah diinput manual oleh guru dari seluruh brankas lokal & Cloud"
          >
            <ShieldCheck className={`w-4 h-4 text-amber-400 ${isRestoringManual ? 'animate-bounce' : ''}`} />
            <span>{isRestoringManual ? 'Memulihkan...' : 'Pulihkan Nilai Guru'}</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-500 text-white font-extrabold rounded-2xl shadow-lg transition-all transform active:scale-95 cursor-pointer shrink-0 text-xs"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Mencetak...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Cloud Sync Feedback Banner */}
      {cloudSyncFeedback && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{cloudSyncFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setCloudSyncFeedback(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            {/* Class Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-44"
              >
                <option value="ALL">Semua Kelas ({students.length} Siswa)</option>
                {sortedClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Score / Nilai Karakter Filter (Lebih Besar Dari / Kurang Dari) */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 w-full sm:w-auto">
                <div className="pl-3 pr-1 text-indigo-600 flex items-center shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
                <select
                  value={scoreFilterOp}
                  onChange={(e) => setScoreFilterOp(e.target.value as 'ALL' | 'GTE' | 'LTE')}
                  className="py-2 pl-1 pr-2 bg-transparent text-xs sm:text-sm font-bold text-slate-700 focus:outline-none cursor-pointer"
                  title="Pilih operator perbandingan nilai karakter"
                >
                  <option value="ALL">Semua Nilai</option>
                  <option value="GTE">Lebih besar dari (≥)</option>
                  <option value="LTE">Kurang dari (≤)</option>
                </select>

                {scoreFilterOp !== 'ALL' && (
                  <select
                    value={scoreFilterVal}
                    onChange={(e) => setScoreFilterVal(Number(e.target.value))}
                    className="py-2 px-2.5 bg-indigo-50 border-l border-indigo-200 text-xs sm:text-sm font-black text-indigo-800 focus:outline-none cursor-pointer"
                    title="Pilih batas nilai karakter"
                  >
                    <option value={50}>Nilai 50</option>
                    <option value={25}>Nilai 25</option>
                    <option value={0}>Nilai 0</option>
                    <option value={-25}>Nilai -25</option>
                    <option value={-50}>Nilai -50</option>
                    <option value={-100}>Nilai -100</option>
                  </select>
                )}
              </div>

              {scoreFilterOp !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setScoreFilterOp('ALL')}
                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                  title="Hapus filter nilai"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama atau NISN siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium shrink-0 self-end lg:self-center">
            Menampilkan <span className="font-bold text-slate-800">{filteredStudents.length}</span> dari <span className="font-bold text-slate-700">{students.length}</span> siswa
          </div>
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
                <th className="p-4 text-center">Tepat Waktu (+1 / 3x)</th>
                <th className="p-4 text-center">Terlambat (-1)</th>
                <th className="p-4 text-center">Alpa (-5)</th>
                <th className="p-4 text-center">Belum Scan / Pulang (-2)</th>
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
                  <td colSpan={11} className="p-10 text-center text-slate-400">
                    Tidak ada data siswa ditemukan.
                  </td>
                </tr>
              ) : (
                displayedStudents.map((student) => {
                  const score = getStudentScoreSummary(student.id);
                  const pred = getPredicate(score.netScore);

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Nama Siswa (Dapat diklik untuk membuka jendela Detail Nilai Karakter) */}
                      <td className="p-4 pl-6">
                        <button
                          type="button"
                          onClick={() => setDetailStudent(student)}
                          className="flex items-center space-x-3 text-left group cursor-pointer focus:outline-none"
                          title={`Klik untuk melihat Detail Nilai Karakter ${student.name}`}
                        >
                          <img
                            src={student.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100'}
                            alt={student.name}
                            loading="lazy"
                            decoding="async"
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 group-hover:ring-2 group-hover:ring-indigo-500 group-hover:scale-105 transition-all shadow-2xs"
                          />
                          <div>
                            <p className="font-bold text-slate-800 text-sm leading-tight group-hover:text-indigo-600 group-hover:underline transition-colors flex items-center gap-1.5">
                              <span>{student.name}</span>
                              <Eye className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium group-hover:text-indigo-500/80 transition-colors">
                              {student.className} • NISN: {student.nisn}
                            </p>
                          </div>
                        </button>
                      </td>

                      {/* Hadir Tepat Waktu */}
                      <td className="p-4 text-center">
                        <span className="inline-flex flex-col items-center justify-center px-3 py-1 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                          <span className="font-black text-xs">{score.onTimeDays || 0}x Hadir</span>
                          <span className="text-[10px] font-extrabold text-emerald-600">+{score.onTimeBonusPoints || 0} Poin</span>
                        </span>
                      </td>

                      {/* Hadir Terlambat */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex flex-col items-center justify-center px-3 py-1 rounded-2xl border shadow-2xs ${
                          (score.lateDays || 0) > 0
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          <span className="font-black text-xs">{score.lateDays || 0}x Terlambat</span>
                          <span className={`text-[10px] font-extrabold ${
                            (score.lateDays || 0) > 0 ? 'text-rose-600' : 'text-slate-400'
                          }`}>
                            {(score.lateDays || 0) > 0 ? `-${score.latePenaltyPoints} Poin` : '0 Poin'}
                          </span>
                        </span>
                      </td>

                      {/* Siswa Alpa */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex flex-col items-center justify-center px-3 py-1 rounded-2xl border shadow-2xs ${
                          (score.alpaDays || 0) > 0
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          <span className="font-black text-xs">{score.alpaDays || 0}x Alpa</span>
                          <span className={`text-[10px] font-extrabold ${
                            (score.alpaDays || 0) > 0 ? 'text-red-600' : 'text-slate-400'
                          }`}>
                            {(score.alpaDays || 0) > 0 ? `-${score.alpaPenaltyPoints} Poin` : '0 Poin'}
                          </span>
                        </span>
                      </td>

                      {/* Belum Scan Masuk & Pulang */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex flex-col items-center justify-center px-2.5 py-1 rounded-2xl border shadow-2xs ${
                          (score.unscannedInDays || 0) > 0 || (score.unreturnedDays || 0) > 0
                            ? 'bg-orange-50 text-orange-900 border-orange-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          <span className="font-black text-xs">
                            {(score.unscannedInDays || 0) + (score.unreturnedDays || 0)}x Presensi
                          </span>
                          <span className={`text-[10px] font-extrabold ${
                            (score.unscannedInDays || 0) > 0 || (score.unreturnedDays || 0) > 0 ? 'text-orange-700' : 'text-slate-400'
                          }`}>
                            {(score.unscannedInDays || 0) > 0 || (score.unreturnedDays || 0) > 0 
                              ? `-${(score.unscannedInPenaltyPoints || 0) + (score.unreturnedPenaltyPoints || 0)} Poin` 
                              : '0 Poin'}
                          </span>
                        </span>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
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

              {/* Select Character Trait from Master Catalog (Filtered by inputTraitType & Search) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    2. Pilih Input Karakter Siswa ({inputTraitType === 'POSITIF' ? 'Positif' : 'Negatif'}) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {filteredModalTraits.length} Karakter Tersedia
                  </span>
                </div>

                {/* Search Input for Character Name / Category / Points */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inputTraitSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputTraitSearch(val);
                      const q = val.toLowerCase().trim();
                      const matches = traits.filter(t => {
                        if (t.type !== inputTraitType) return false;
                        if (!q) return true;
                        return (
                          t.name.toLowerCase().includes(q) || 
                          (t.category && t.category.toLowerCase().includes(q)) || 
                          String(t.points).includes(q)
                        );
                      });
                      if (matches.length > 0 && !matches.some(m => m.id === inputTraitId)) {
                        setInputTraitId(matches[0].id);
                      }
                    }}
                    placeholder={`Cari nama karakter ${inputTraitType === 'POSITIF' ? 'positif' : 'negatif'} (contoh: Disiplin, Jujur, Terlambat)...`}
                    className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 shadow-2xs"
                  />
                  {inputTraitSearch && (
                    <button
                      type="button"
                      onClick={() => setInputTraitSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 rounded-full hover:bg-slate-200 cursor-pointer"
                      title="Hapus pencarian"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  required
                  value={inputTraitId}
                  onChange={(e) => setInputTraitId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {filteredModalTraits.length === 0 ? (
                    <option value="">-- Tidak ada karakter yang cocok dengan "{inputTraitSearch}" --</option>
                  ) : (
                    filteredModalTraits.map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.type === 'POSITIF' ? `+${t.points}` : `-${t.points}`} Poin] {t.name} ({t.category || 'Umum'})
                      </option>
                    ))
                  )}
                </select>

                {/* Quick Selection Badges if few results or search query */}
                {inputTraitSearch && filteredModalTraits.length > 0 && filteredModalTraits.length <= 8 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {filteredModalTraits.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setInputTraitId(t.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                          inputTraitId === t.id
                            ? t.type === 'POSITIF'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-red-600 text-white border-red-600 shadow-2xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {t.name} ({t.type === 'POSITIF' ? `+${t.points}` : `-${t.points}`})
                      </button>
                    ))}
                  </div>
                )}
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

              {/* Tanggal Kejadian */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                  <span>3. Tanggal Kejadian <span className="text-rose-500">*</span></span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={inputIncidentDate}
                    onChange={(e) => setInputIncidentDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Evaluator Name (Nama Penilai) */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  4. Nama Penilai (Guru) <span className="text-rose-500">*</span>
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
                  <span>5. Bukti Foto Kegiatan <span className="text-slate-400 font-normal lowercase">(opsional)</span></span>
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
      {detailStudent && detailStudentScore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 max-h-[94vh] sm:max-h-[88vh] flex flex-col">
            {/* Modal Header: Bersih & Ringkas (Hanya identitas siswa dan aksi, tanpa kotak ringkasan poin ganda di atas) */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b border-white/10">
              <div className="flex items-center space-x-3 min-w-0">
                <img
                  src={detailStudent.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100'}
                  alt={detailStudent.name}
                  loading="lazy"
                  decoding="async"
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-white/20 shrink-0 shadow-sm"
                />
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                    {detailStudent.name}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-indigo-200/90 font-medium truncate mt-0.5">
                    Kelas {detailStudent.className} • NISN: {detailStudent.nisn}
                  </p>
                </div>
              </div>

              {/* Action Buttons Header */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleExportDetailPdf}
                  disabled={isExportingDetail}
                  className="px-2.5 sm:px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  title={`Cetak / Ekspor PDF Resmi Detail Nilai Karakter (${detailStudent.name})`}
                >
                  <Download className={`w-3.5 h-3.5 ${isExportingDetail ? 'animate-bounce' : ''}`} />
                  <span className="hidden sm:inline">{isExportingDetail ? 'Menyusun...' : 'Ekspor PDF'}</span>
                  <span className="sm:hidden">PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenAddModalForStudent(detailStudent)}
                  className="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title={`Isi Nilai Karakter Siswa (${detailStudent.name})`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Isi Nilai</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDetailStudent(null);
                    setHighlightedLogId(null);
                  }}
                  className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                  title="Tutup Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Kontainer Detail Nilai Karakter (Scroll lancar & responsif pada layar HP maupun Desktop) */}
            <div 
              className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2.5 min-h-0 bg-slate-50/60 touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="flex items-center justify-between pb-0.5">
                <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                  Rincian Penilaian & Riwayat Karakter
                </h4>
                <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  {detailStudentScore.totalEntries} catatan
                </span>
              </div>

              {/* Kotak Ringkasan Akumulasi Poin di Bawah Bagian Rincian Penilaian & Riwayat Karakter */}
              <div className="grid grid-cols-3 gap-2 p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                {/* 1. Total Poin Positif */}
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-50/80 border border-emerald-100 text-center">
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Poin Positif
                  </span>
                  <span className="font-black text-sm sm:text-lg text-emerald-600 mt-0.5">
                    +{detailStudentScore.positivePoints}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium hidden sm:inline">Input guru & presensi</span>
                </div>

                {/* 2. Total Poin Negatif */}
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-rose-50/80 border border-rose-100 text-center">
                  <span className="text-[10px] sm:text-xs font-bold text-rose-800 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    Poin Negatif
                  </span>
                  <span className="font-black text-sm sm:text-lg text-rose-600 mt-0.5">
                    -{detailStudentScore.negativePoints}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium hidden sm:inline">Pelanggaran & alpa</span>
                </div>

                {/* 3. Skor Akhir Siswa & Predikat */}
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-indigo-50/80 border border-indigo-100 text-center">
                  <span className="text-[10px] sm:text-xs font-bold text-indigo-900 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    Skor Akhir
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap justify-center">
                    <span className={`font-black text-sm sm:text-lg ${
                      detailStudentScore.netScore >= 0 ? 'text-indigo-700' : 'text-rose-600'
                    }`}>
                      {detailStudentScore.netScore > 0 ? `+${detailStudentScore.netScore}` : detailStudentScore.netScore}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${getPredicate(detailStudentScore.netScore).color}`}>
                      {getPredicate(detailStudentScore.netScore).label.split(' ')[0]}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium hidden sm:inline">Skor Karakter Bersih</span>
                </div>
              </div>

              <div className="space-y-4">
                {/* ========================================================================= */}
                {/* KELOMPOK SESI 2: REKAPITULASI PRESENSI OTOMATIS */}
                {/* ========================================================================= */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 sm:p-2 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-xl shadow-xs shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-black text-slate-800 text-xs sm:text-sm">
                          Rekapitulasi Presensi Otomatis
                        </h5>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Akumulasi presensi kehadiran masuk, kepulangan, keterlambatan, & alpa siswa
                        </p>
                      </div>
                    </div>
                  </div>

                  {(detailStudentScore.onTimeDays > 0 || 
                    detailStudentScore.lateDays > 0 || 
                    detailStudentScore.alpaDays > 0 || 
                    detailStudentScore.unscannedInDays > 0 || 
                    detailStudentScore.unreturnedDays > 0) ? (

                      <div className="space-y-2">
                        {/* 1. Card Akumulasi Hadir Tepat Waktu */}
                        {detailStudentScore.onTimeDays > 0 && (
                          <div className="p-3 rounded-2xl border border-emerald-200 bg-white hover:border-emerald-300 shadow-2xs space-y-1.5 transition-all">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 sm:p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                                      Hadir Tepat Waktu
                                    </p>
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[9px] sm:text-[10px]">
                                      Presensi Otomatis
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    {detailStudentScore.onTimeDays}x tepat waktu • Bonus +1 tiap 3x
                                  </p>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 bg-emerald-600 text-white font-black text-xs rounded-xl shadow-2xs shrink-0">
                                +{detailStudentScore.onTimeBonusPoints} Poin
                              </span>
                            </div>

                            {detailStudentScore.onTimeDates && detailStudentScore.onTimeDates.length > 0 && (
                              <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1 flex-wrap text-[10px]">
                                <span className="text-slate-400 font-medium">Tanggal:</span>
                                {detailStudentScore.onTimeDates.slice(0, 6).map((dateStr, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[9px] sm:text-[10px] font-semibold">
                                    {dateStr}
                                  </span>
                                ))}
                                {detailStudentScore.onTimeDates.length > 6 && (
                                  <span className="text-slate-400 font-bold text-[9px] sm:text-[10px]">
                                    +{detailStudentScore.onTimeDates.length - 6} lainnya
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. Card Akumulasi Hadir Terlambat */}
                        {detailStudentScore.lateDays > 0 && (
                          <div className="p-3 rounded-2xl border border-rose-200 bg-white hover:border-rose-300 shadow-2xs space-y-1.5 transition-all">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 sm:p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                                      Hadir Terlambat
                                    </p>
                                    <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-[9px] sm:text-[10px]">
                                      Presensi Otomatis
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    {detailStudentScore.lateDays}x terlambat • -1 poin/hari
                                  </p>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 bg-rose-600 text-white font-black text-xs rounded-xl shadow-2xs shrink-0">
                                -{detailStudentScore.latePenaltyPoints} Poin
                              </span>
                            </div>

                            {detailStudentScore.lateDates && detailStudentScore.lateDates.length > 0 && (
                              <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1 flex-wrap text-[10px]">
                                <span className="text-slate-400 font-medium">Tanggal:</span>
                                {detailStudentScore.lateDates.slice(0, 6).map((dateStr, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[9px] sm:text-[10px] font-semibold">
                                    {dateStr}
                                  </span>
                                ))}
                                {detailStudentScore.lateDates.length > 6 && (
                                  <span className="text-slate-400 font-bold text-[9px] sm:text-[10px]">
                                    +{detailStudentScore.lateDates.length - 6} lainnya
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. Card Akumulasi Siswa Alpa */}
                        {detailStudentScore.alpaDays > 0 && (
                          <div className="p-3 rounded-2xl border border-red-200 bg-white hover:border-red-300 shadow-2xs space-y-1.5 transition-all">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 sm:p-2 bg-red-100 text-red-700 rounded-xl shrink-0">
                                  <UserX className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                                      Alpa (Tanpa Keterangan)
                                    </p>
                                    <span className="px-1.5 py-0.2 rounded bg-red-50 text-red-700 border border-red-200 font-extrabold text-[9px] sm:text-[10px]">
                                      Presensi Otomatis
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    {detailStudentScore.alpaDays}x alpa • -5 poin/hari
                                  </p>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 bg-red-600 text-white font-black text-xs rounded-xl shadow-2xs shrink-0">
                                -{detailStudentScore.alpaPenaltyPoints} Poin
                              </span>
                            </div>

                            {detailStudentScore.alpaDates && detailStudentScore.alpaDates.length > 0 && (
                              <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1 flex-wrap text-[10px]">
                                <span className="text-slate-400 font-medium">Tanggal:</span>
                                {detailStudentScore.alpaDates.slice(0, 6).map((dateStr, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[9px] sm:text-[10px] font-semibold">
                                    {dateStr}
                                  </span>
                                ))}
                                {detailStudentScore.alpaDates.length > 6 && (
                                  <span className="text-slate-400 font-bold text-[9px] sm:text-[10px]">
                                    +{detailStudentScore.alpaDates.length - 6} lainnya
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. Card Akumulasi Belum Scan Presensi Masuk */}
                        {detailStudentScore.unscannedInDays > 0 && (
                          <div className="p-3 rounded-2xl border border-orange-200 bg-white hover:border-orange-300 shadow-2xs space-y-1.5 transition-all">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 sm:p-2 bg-orange-100 text-orange-700 rounded-xl shrink-0">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                                      Belum Scan Presensi Masuk
                                    </p>
                                    <span className="px-1.5 py-0.2 rounded bg-orange-50 text-orange-700 border border-orange-200 font-extrabold text-[9px] sm:text-[10px]">
                                      Presensi Otomatis
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    {detailStudentScore.unscannedInDays}x belum scan masuk • -2 poin/kejadian
                                  </p>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 bg-orange-600 text-white font-black text-xs rounded-xl shadow-2xs shrink-0">
                                -{detailStudentScore.unscannedInPenaltyPoints} Poin
                              </span>
                            </div>

                            {detailStudentScore.unscannedInDates && detailStudentScore.unscannedInDates.length > 0 && (
                              <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1 flex-wrap text-[10px]">
                                <span className="text-slate-400 font-medium">Tanggal:</span>
                                {detailStudentScore.unscannedInDates.slice(0, 6).map((dateStr, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[9px] sm:text-[10px] font-semibold">
                                    {dateStr}
                                  </span>
                                ))}
                                {detailStudentScore.unscannedInDates.length > 6 && (
                                  <span className="text-slate-400 font-bold text-[9px] sm:text-[10px]">
                                    +{detailStudentScore.unscannedInDates.length - 6} lainnya
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 5. Card Akumulasi Belum Scan Pulang */}
                        {detailStudentScore.unreturnedDays > 0 && (
                          <div className="p-3 rounded-2xl border border-amber-200 bg-white hover:border-amber-300 shadow-2xs space-y-1.5 transition-all">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 sm:p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                                      Belum Scan Pulang
                                    </p>
                                    <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-extrabold text-[9px] sm:text-[10px]">
                                      Presensi Otomatis
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    {detailStudentScore.unreturnedDays}x belum scan pulang • -2 poin/kejadian
                                  </p>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 bg-amber-600 text-white font-black text-xs rounded-xl shadow-2xs shrink-0">
                                -{detailStudentScore.unreturnedPenaltyPoints} Poin
                              </span>
                            </div>

                            {detailStudentScore.unreturnedDates && detailStudentScore.unreturnedDates.length > 0 && (
                              <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1 flex-wrap text-[10px]">
                                <span className="text-slate-400 font-medium">Tanggal:</span>
                                {detailStudentScore.unreturnedDates.slice(0, 6).map((dateStr, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[9px] sm:text-[10px] font-semibold">
                                    {dateStr}
                                  </span>
                                ))}
                                {detailStudentScore.unreturnedDates.length > 6 && (
                                  <span className="text-slate-400 font-bold text-[9px] sm:text-[10px]">
                                    +{detailStudentScore.unreturnedDates.length - 6} lainnya
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3.5 bg-white border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                        Belum ada akumulasi bonus atau penalti presensi otomatis untuk siswa ini.
                      </div>
                    )}
                  </div>

                  {/* ========================================================================= */}
                  {/* KELOMPOK SESI: CATATAN PERILAKU KHUSUS SISWA (INPUT GURU) */}
                  {/* ========================================================================= */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 sm:p-2 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-xl shadow-xs shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="font-black text-slate-800 text-xs sm:text-sm">
                            Catatan Perilaku Khusus Siswa (Input Guru)
                          </h5>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Catatan evaluasi karakter dan sikap khusus siswa yang diinput langsung oleh guru
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        {studentDetailLogs.length} catatan
                      </span>
                    </div>

                    {studentDetailLogs.length > 0 ? (
                      <div className="space-y-2">
                        {studentDetailLogs.map((log, idx) => {
                          const isHighlighted = log.id === highlightedLogId;
                          return (
                            <div
                              key={`${log.id}_gen_${idx}`}
                              id={`char-log-${log.id}`}
                              className={`p-3 rounded-2xl border transition-all space-y-2 ${
                                isHighlighted
                                  ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-500 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <div className="shrink-0 mt-0.5">
                                    {log.traitType === 'POSITIF' ? (
                                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                      </div>
                                    ) : (
                                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                                        <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                        {log.traitName}
                                      </span>
                                      <span className={`px-2 py-0.2 rounded-md text-[9px] sm:text-[10px] font-black ${
                                        log.traitType === 'POSITIF' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {log.traitType === 'POSITIF' ? `+${log.points}` : `-${log.points}`} Poin
                                      </span>
                                      {isManualCharacterLog(log) && (
                                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                          Input Guru
                                        </span>
                                      )}
                                      {isHighlighted && (
                                        <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                                          Terpilih
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                      <span>Oleh: <strong className="text-slate-700">{log.evaluatorName || 'Guru'}</strong></span>
                                      <span>•</span>
                                      <span>{log.timestamp || log.date}</span>
                                    </p>
                                  </div>
                                </div>

                                {/* Action Buttons: Foto Bukti, Tindak Lanjut, Hapus */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {log.photoProofUrl && isRealPhotoProof(log.photoProofUrl) && (
                                    <button
                                      onClick={() => setPreviewPhotoModalUrl(log.photoProofUrl || null)}
                                      className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-500 transition-all cursor-pointer shrink-0"
                                      title="Lihat Foto Bukti"
                                    >
                                      <img
                                        src={log.photoProofUrl}
                                        alt="Bukti"
                                        loading="lazy"
                                        className="w-7 h-7 sm:w-8 sm:h-8 object-cover group-hover:scale-105 transition-transform"
                                      />
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleOpenFollowUpModal(log)}
                                    className="px-2 sm:px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                                    title="Tindak Lanjut"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span className="hidden sm:inline">{log.followUpNotes ? 'Edit' : 'Tindak Lanjut'}</span>
                                  </button>

                                  {currentUserRole === 'ADMIN' && (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmLog(log)}
                                      className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                      title="Hapus Catatan (Admin)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Deskripsi & Catatan Spesifik Perilaku */}
                              {log.notes && (
                                <div className="text-[11px] sm:text-xs text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 leading-snug font-normal line-clamp-2 hover:line-clamp-none transition-all">
                                  "{log.notes}"
                                </div>
                              )}

                              {/* Catatan Tindak Lanjut jika ada */}
                              {(log.followUpNotes || log.followUpPhotoUrl) && (
                                <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 space-y-1">
                                  <div className="flex items-center justify-between font-bold text-[10px] text-amber-800">
                                    <span className="flex items-center gap-1">
                                      <ShieldCheck className="w-3 h-3 text-amber-600" />
                                      Tindak Lanjut: {log.followUpBy || 'Guru'}
                                    </span>
                                    {log.followUpDate && <span className="font-mono text-[10px]">{log.followUpDate}</span>}
                                  </div>
                                  {log.followUpNotes && (
                                    <p className="text-[11px] text-slate-700 leading-snug line-clamp-2 hover:line-clamp-none">{log.followUpNotes}</p>
                                  )}
                                  {log.followUpPhotoUrl && isRealPhotoProof(log.followUpPhotoUrl) && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewPhotoModalUrl(log.followUpPhotoUrl || null)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-amber-900 rounded text-[10px] font-bold border border-amber-300 cursor-pointer shadow-2xs mt-1"
                                    >
                                      <FileImage className="w-3 h-3 text-amber-700" /> Lihat Bukti Foto
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3.5 bg-white border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                        Belum ada catatan perilaku khusus yang diinput langsung oleh guru.
                      </div>
                    )}
                  </div>
                </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleExportDetailPdf}
                disabled={isExportingDetail}
                className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-4 h-4 ${isExportingDetail ? 'animate-bounce' : ''}`} />
                <span>{isExportingDetail ? 'Sedang Menyusun PDF...' : 'Cetak / Ekspor PDF (Kop Resmi)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailStudent(null)}
                className="w-full sm:w-auto px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Input / Edit Tindak Lanjut Penilaian Karakter */}
      {followUpLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
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
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full text-[10px] font-black border border-rose-200 mb-2">
                <span>🔒 Hak Akses: Khusus Administrator</span>
              </div>
              <h3 className="font-extrabold text-slate-900 text-lg">Konfirmasi Hapus Nilai Karakter</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Operasi ini hanya diizinkan untuk akun terotentikasi dengan peran <strong>Admin</strong>. Apakah Anda yakin ingin menghapus catatan penilaian karakter <strong className="text-slate-900">{deleteConfirmLog.traitName}</strong> ({deleteConfirmLog.traitType === 'POSITIF' ? `+${deleteConfirmLog.points}` : `-${deleteConfirmLog.points}`} poin) untuk <strong className="text-slate-900">{deleteConfirmLog.studentName}</strong>?
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
                  if (currentUserRole !== 'ADMIN') {
                    alert('Akses Ditolak: Hanya pengguna terauthentikasi dengan peran Admin yang berwenang menghapus catatan nilai karakter.');
                    setDeleteConfirmLog(null);
                    return;
                  }
                  onDeleteLog(deleteConfirmLog.id);
                  setDeleteConfirmLog(null);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/30 transition-all cursor-pointer"
              >
                Ya, Hapus Catatan (Admin)
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
