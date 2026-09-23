import React, { useState, useEffect, useRef } from 'react';
import { Student, SchoolClass } from '../types';
import { 
  X, 
  Upload, 
  Camera, 
  RotateCcw, 
  Check, 
  Image as ImageIcon, 
  Link2, 
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  Cloud, 
  RefreshCw 
} from 'lucide-react';
import { convertGoogleDriveUrl, isGoogleDriveUrl } from '../lib/exportUtils';

interface StudentFormModalProps {
  isOpen: boolean;
  editingStudent: Student | null;
  classes: SchoolClass[];
  onClose: () => void;
  onSave: (student: Student) => void;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  editingStudent,
  classes,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Omit<Student, 'id'>>({
    nisn: '',
    nis: '',
    name: '',
    gender: 'L',
    classId: classes[0]?.id || 'c7a',
    className: classes[0]?.name || '7-A',
    parentName: '',
    parentPhone: '6281234567890',
    parentEmail: '',
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
    qrCode: '',
    birthPlaceDate: 'Jakarta, 12 Mei 2011',
    address: 'Jl. Pendidikan No. 10'
  });

  const [photoInputMode, setPhotoInputMode] = useState<'UPLOAD' | 'DRIVE'>('UPLOAD');
  const [drivePhotoUrlInput, setDrivePhotoUrlInput] = useState<string>('');
  const [drivePhotoFeedback, setDrivePhotoFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [capturedCameraPhoto, setCapturedCameraPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');

  // Sync form data when modal opens or editingStudent changes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setIsCameraModalOpen(false);
      return;
    }

    if (editingStudent) {
      setFormData({
        nisn: editingStudent.nisn || '',
        nis: editingStudent.nis || '',
        name: editingStudent.name || '',
        gender: editingStudent.gender || 'L',
        classId: editingStudent.classId || (classes[0]?.id || 'c7a'),
        className: editingStudent.className || (classes[0]?.name || '7-A'),
        parentName: editingStudent.parentName || '',
        parentPhone: editingStudent.parentPhone || '',
        parentEmail: editingStudent.parentEmail || '',
        photoUrl: editingStudent.photoUrl || '',
        qrCode: editingStudent.qrCode || '',
        birthPlaceDate: editingStudent.birthPlaceDate || '',
        address: editingStudent.address || ''
      });

      if (editingStudent.photoUrl && !editingStudent.photoUrl.startsWith('data:')) {
        setDrivePhotoUrlInput(editingStudent.photoUrl);
        setPhotoInputMode(isGoogleDriveUrl(editingStudent.photoUrl) ? 'DRIVE' : 'UPLOAD');
      } else {
        setDrivePhotoUrlInput('');
        setPhotoInputMode('UPLOAD');
      }
    } else {
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
    }
    setDrivePhotoFeedback(null);
  }, [isOpen, editingStudent, classes]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

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

    // Standard 3:4 student portrait dimensions (160x213) - crystal clear, ~5KB Base64
    const targetWidth = 160;
    const targetHeight = 213;
    const targetAspect = targetWidth / targetHeight;

    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;
    const videoAspect = videoWidth / videoHeight;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = videoWidth;
    let sourceHeight = videoHeight;

    if (videoAspect > targetAspect) {
      sourceWidth = Math.round(videoHeight * targetAspect);
      sourceX = Math.round((videoWidth - sourceWidth) / 2);
    } else {
      sourceHeight = Math.round(videoWidth / targetAspect);
      sourceY = Math.round((videoHeight - sourceHeight) / 2);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      if (cameraFacingMode === 'user') {
        ctx.translate(targetWidth, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(
        video,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, targetWidth, targetHeight
      );

      const dataUrl = canvas.toDataURL('image/jpeg', 0.62);
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
        const maxW = 160;
        const maxH = 213;
        let width = img.width;
        let height = img.height;

        const ratio = Math.min(maxW / width, maxH / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          // Compressed 0.62 JPEG ensures ~5KB size, ultra-fast syncing and zero UI freeze
          const dataUrl = canvas.toDataURL('image/jpeg', 0.62);
          setFormData(prev => ({ ...prev, photoUrl: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClassObj = classes.find(c => c.id === formData.classId);
    const finalClassName = selectedClassObj ? selectedClassObj.name : formData.className;

    if (editingStudent) {
      onSave({
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
      onSave(newStudent);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white border border-slate-100 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-800">
              {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
            </h3>
            <button 
              type="button"
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-xl transition-colors"
            >
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
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-semibold"
                  placeholder="Aditya Pratama"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Jenis Kelamin</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as 'L' | 'P' }))}
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
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    nisn: e.target.value, 
                    qrCode: `STUDENT-${e.target.value}` 
                  }))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">NIS Sekolah</label>
                <input
                  type="text"
                  required
                  value={formData.nis}
                  onChange={(e) => setFormData(prev => ({ ...prev, nis: e.target.value }))}
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
                    setFormData(prev => ({ 
                      ...prev, 
                      classId: e.target.value,
                      className: cObj ? cObj.name : prev.className
                    }));
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>Kelas {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tempat & Tgl Lahir</label>
                <input
                  type="text"
                  value={formData.birthPlaceDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, birthPlaceDate: e.target.value }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, parentName: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">No. WhatsApp Orang Tua</label>
                <input
                  type="text"
                  required
                  value={formData.parentPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, parentPhone: e.target.value }))}
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
                    {formData.photoUrl?.startsWith('data:') ? 'Lokal' : (isGoogleDriveUrl(formData.photoUrl || '') ? 'G-Drive' : 'Web/Avatar')}
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  {photoInputMode === 'UPLOAD' ? (
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
                              setFormData(prev => ({ ...prev, photoUrl: defaultUrl }));
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
                        Unggah pas foto (JPG, PNG) atau ambil langsung via kamera. Foto otomatis dioptimalkan agar ringan dan instan.
                      </p>
                    </div>
                  ) : (
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
                              const val = e.target.value;
                              setDrivePhotoUrlInput(val);
                              if (val.includes('drive.google.com') || val.includes('http')) {
                                const autoConverted = convertGoogleDriveUrl(val);
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

                      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2 text-[10.5px] text-amber-900 leading-snug">
                        <span className="font-bold">💡 Tips Link Google Drive:</span> Pastikan opsi berbagi file disetel ke <span className="font-bold underline">"Siapa saja yang memiliki link"</span>.
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
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl shadow-md shadow-indigo-600/20 cursor-pointer transition-all active:scale-95"
              >
                Simpan Data
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CAMERA MODAL */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-0 animate-in fade-in zoom-in-95 duration-150">
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
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md bg-slate-900 flex flex-col items-center justify-center p-4">
                    <div className="w-36 h-48 rounded-xl overflow-hidden shadow-lg border-2 border-white/80 bg-slate-100 ring-4 ring-emerald-500/20">
                      <img
                        src={capturedCameraPhoto}
                        alt="Hasil Pas Foto Siswa"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-2.5 text-center text-xs font-semibold flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Pas foto 3:4 terpotong presisi & dioptimalkan (~5 KB) • Siap sinkron instan!</span>
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
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
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
                  <div className="relative rounded-2xl overflow-hidden bg-black shadow-inner border border-slate-800 flex items-center justify-center min-h-[300px]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full max-h-[340px] object-cover ${cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />

                    {/* Viewfinder 3:4 Pas Foto Guide Frame */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-[180px] h-[240px] border-2 border-dashed border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between p-2">
                        <span className="text-[10px] font-bold text-white bg-black/70 px-2 py-0.5 rounded-full border border-white/20">
                          Bingkai Pas Foto (3:4)
                        </span>
                        <span className="text-[9px] font-medium text-emerald-200 bg-black/70 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          Posisikan Wajah Siswa di Sini
                        </span>
                      </div>
                    </div>

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
    </>
  );
};
