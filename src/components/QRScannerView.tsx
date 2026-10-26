import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Student, SchoolProfile, AttendanceRecord, SchoolClass, UserRole } from '../types';
import { playScanSound } from '../lib/audioBeep';
import { 
  getSchoolCheckoutTimeForDay,
  getScanQueueStatus,
  flushAttendanceScanQueue,
  getAttendanceRecords,
  getLocalDateString,
  calculateAttendanceStatus,
  getLateCutoffTime,
  ScanQueueStatus
} from '../lib/storage';
import { 
  ScanLine, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Camera, 
  Volume2, 
  User, 
  Clock, 
  RotateCw,
  Sparkles,
  Smartphone,
  Sun,
  Home,
  LogOut,
  LogIn,
  SwitchCamera,
  Calendar,
  Filter,
  XCircle,
  FlipHorizontal,
  Zap,
  Info,
  Lock
} from 'lucide-react';

interface QRScannerViewProps {
  students: Student[];
  classes?: SchoolClass[];
  schoolProfile: SchoolProfile;
  attendanceRecords: AttendanceRecord[];
  onAddAttendance: (record: AttendanceRecord) => void;
  userRole?: UserRole;
  currentRole?: UserRole;
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const QRScannerView: React.FC<QRScannerViewProps> = ({
  students,
  classes = [],
  schoolProfile,
  attendanceRecords,
  onAddAttendance,
  userRole,
  currentRole,
}) => {
  const effectiveRole = userRole || currentRole || 'ADMIN';
  const isAdmin = effectiveRole === 'ADMIN';

  // Scan Batching Queue Worker Status (25 Siswa / Jeda 20 Detik) - Terpantau untuk Admin
  const [queueStatus, setQueueStatus] = useState<ScanQueueStatus>(() => getScanQueueStatus());

  useEffect(() => {
    const handleQueueChange = (e: any) => {
      if (e && e.detail) {
        setQueueStatus(e.detail);
      } else {
        setQueueStatus(getScanQueueStatus());
      }
    };
    window.addEventListener('sihadir_scan_queue_changed', handleQueueChange);
    return () => {
      window.removeEventListener('sihadir_scan_queue_changed', handleQueueChange);
    };
  }, []);

  const handleManualFlush = async () => {
    await flushAttendanceScanQueue(true);
  };
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  // Real-time tick setiap 1 detik agar batas jam pulang dan penguncian tombol berganti presisi seketika
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todayName = DAY_NAMES[currentTime.getDay()];
  const todayEndTimeStr = getSchoolCheckoutTimeForDay(schoolProfile, todayName);
  const autoAlpaTimeStr = schoolProfile.autoAlpaTime || '08:30';
  const startTimeStr = schoolProfile.startTime || '07:00';

  /**
   * Logika Jam Pulang Sekolah Harian:
   * - Parse jam pulang hari ini (todayEndTimeStr, misal Senin-Kamis 15:00, Jumat 11:30, Sabtu 13:00)
   * - Waktu reset mode masuk kembali pada 01:00 WITA dini hari
   */
  const [eH, eM] = todayEndTimeStr.split(':').map(Number);
  const endMinutes = (isNaN(eH) ? 15 : eH) * 60 + (isNaN(eM) ? 0 : eM);
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const resetMasukMinutes = 1 * 60; // 01:00 WITA

  // Apakah waktu saat ini masih SEBELUM jam pulang sekolah hari ini (01:00 s.d sebelum jam pulang)?
  const isBeforeEndTime = currentMinutes >= resetMasukMinutes && currentMinutes < endMinutes;

  // Apakah waktu saat ini SUDAH MEMASUKI jam pulang sekolah (jam pulang s.d 00:59)?
  const isMasukClosedNow = currentMinutes >= endMinutes || currentMinutes < resetMasukMinutes;

  const getAutoScanMode = useCallback((checkTime: Date = new Date()): 'MASUK' | 'PULANG' => {
    const mins = checkTime.getHours() * 60 + checkTime.getMinutes();
    const day = DAY_NAMES[checkTime.getDay()];
    const depTime = getSchoolCheckoutTimeForDay(schoolProfile, day);
    const [h, m] = depTime.split(':').map(Number);
    const endMins = (isNaN(h) ? 15 : h) * 60 + (isNaN(m) ? 0 : m);
    const resetMins = 60; // 01:00 WITA

    if (mins >= endMins || mins < resetMins) {
      return 'PULANG';
    }
    return 'MASUK';
  }, [schoolProfile]);

  const checkIsMasukScanClosed = useCallback((checkTime: Date = new Date()) => {
    const mins = checkTime.getHours() * 60 + checkTime.getMinutes();
    const day = DAY_NAMES[checkTime.getDay()];
    const depTime = getSchoolCheckoutTimeForDay(schoolProfile, day);
    const [h, m] = depTime.split(':').map(Number);
    const endMins = (isNaN(h) ? 15 : h) * 60 + (isNaN(m) ? 0 : m);
    return mins >= endMins || mins < 60;
  }, [schoolProfile]);

  const [scanMode, setScanMode] = useState<'MASUK' | 'PULANG'>(() => (isBeforeEndTime ? 'MASUK' : 'PULANG'));
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [simClassFilter, setSimClassFilter] = useState<string>('ALL');
  const [simSearchQuery, setSimSearchQuery] = useState<string>('');

  // Auto switch timer yang memantau waktu secara realtime dan mengunci/membuka tombol
  useEffect(() => {
    // 1. Kritis: Bila sebelum jam pulang hari ini, paksa mode MASUK dan batalkan manual override
    if (isBeforeEndTime) {
      if (scanMode !== 'MASUK') {
        setScanMode('MASUK');
      }
      setIsManualOverride(false);
    } else if (isMasukClosedNow) {
      // 2. Bila telah memasuki jam pulang sekolah, otomatis aktifkan mode PULANG
      if (scanMode !== 'PULANG') {
        setScanMode('PULANG');
      }
      setIsManualOverride(false);
    }
  }, [isBeforeEndTime, isMasukClosedNow, scanMode]);

  const classList = useMemo(() => {
    if (classes && classes.length > 0) {
      return classes.map(c => c.name);
    }
    return Array.from(new Set(students.map(s => s.className))).sort();
  }, [classes, students]);

  // High-performance O(1) index map for instantaneous student lookup during rapid scanning
  const studentLookupMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(s => {
      if (!s) return;
      if (s.qrCode) map.set(s.qrCode.trim().toLowerCase(), s);
      if (s.nisn) map.set(s.nisn.trim().toLowerCase(), s);
      if (s.nis) map.set(s.nis.trim().toLowerCase(), s);
      if (s.id) map.set(s.id.trim().toLowerCase(), s);
      
      const cleanQr = (s.qrCode || '').trim().replace(/^(STUDENT|SISWA|STD|QR|ID)[-_:\s]*/i, '').toLowerCase();
      if (cleanQr) map.set(cleanQr, s);
      const cleanNisn = (s.nisn || '').trim().replace(/^(STUDENT|SISWA|STD|QR|ID)[-_:\s]*/i, '').toLowerCase();
      if (cleanNisn) map.set(cleanNisn, s);
    });
    return map;
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchClass = simClassFilter === 'ALL' || s.className === simClassFilter;
      const q = simSearchQuery.trim().toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.nisn.includes(q) || (s.nis && s.nis.includes(q));
      return matchClass && matchSearch;
    });
  }, [students, simClassFilter, simSearchQuery]);

  const now = currentTime;
  const activeDays = schoolProfile.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const isTodayActiveDay = activeDays.includes(todayName);

  const todayDateStr = getLocalDateString(now);
  const holidays = schoolProfile.holidays || [];
  const todayHoliday = holidays.find(h => {
    if (h.endDate) {
      return todayDateStr >= h.date && todayDateStr <= h.endDate;
    }
    return h.date === todayDateStr;
  });

  const isAutoAlpaActive = schoolProfile.autoAlpaEnabled !== false && isTodayActiveDay && !todayHoliday;

  const [lastScannedResult, setLastScannedResult] = useState<{
    student: Student;
    record: AttendanceRecord;
    mode: 'MASUK' | 'PULANG';
    isRejected?: boolean;
    isDuplicate?: boolean;
    rejectionReason?: string;
  } | null>(null);
  const [scanNotification, setScanNotification] = useState<{
    type: 'SUCCESS' | 'REJECTED' | 'DUPLICATE';
    badgeText?: string;
    title?: string;
    studentName: string;
    className: string;
    time: string;
    mode: 'MASUK' | 'PULANG';
    timestamp: number;
    reason?: string;
  } | null>(null);
  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
      (window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
  }, []);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(() => isMobileDevice ? 'environment' : 'user');
  const [isMirrorMode, setIsMirrorMode] = useState<boolean>(!isMobileDevice);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScanDebounceRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });
  const qrRegionId = "html5qr-code-full-region";

  // Check available cameras and configure default
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          // Filter out secondary front cameras on mobile
          const filtered = devices.filter(d => {
            const labelLower = (d.label || '').toLowerCase();
            if (isMobileDevice && labelLower.includes('camera 2') && (labelLower.includes('front') || labelLower.includes('depan'))) {
              return false;
            }
            return true;
          });

          // Prioritize back camera for mobile phones, webcam for laptops/desktops
          const defaultCam = isMobileDevice
            ? (filtered.find(d => {
                const labelLower = (d.label || '').toLowerCase();
                return (
                  labelLower.includes('camera 0') ||
                  labelLower.includes('back') ||
                  labelLower.includes('rear') ||
                  labelLower.includes('belakang') ||
                  labelLower.includes('environment')
                );
              }) || filtered.find(d => {
                const labelLower = (d.label || '').toLowerCase();
                return !labelLower.includes('front') && !labelLower.includes('depan') && !labelLower.includes('user');
              }) || filtered[0])
            : (filtered.find(d => {
                const labelLower = (d.label || '').toLowerCase();
                return (
                  labelLower.includes('webcam') ||
                  labelLower.includes('integrated') ||
                  labelLower.includes('front') ||
                  labelLower.includes('user') ||
                  labelLower.includes('camera')
                );
              }) || filtered[0]);

          const formattedCameras = filtered.map(d => {
            const labelLower = (d.label || '').toLowerCase();
            let displayLabel = d.label || `Kamera ${d.id}`;
            if (labelLower.includes('camera 0') || labelLower.includes('back') || labelLower.includes('rear') || labelLower.includes('environment') || labelLower.includes('belakang')) {
              displayLabel = isMobileDevice ? `📷 Kamera Belakang` : `📷 Kamera Laptop / Webcam`;
            } else if (labelLower.includes('front') || labelLower.includes('depan') || labelLower.includes('user') || labelLower.includes('camera 1') || labelLower.includes('camera 2')) {
              displayLabel = isMobileDevice ? `🤳 Kamera Depan` : `📷 Webcam Laptop`;
            } else if (labelLower.includes('integrated') || labelLower.includes('webcam')) {
              displayLabel = `📷 Webcam Laptop (${d.label})`;
            }
            return {
              id: d.id,
              label: displayLabel
            };
          });

          setCameras(formattedCameras);
          if (defaultCam) {
            setActiveCameraId(defaultCam.id);
          }
        }
      })
      .catch((err) => {
        console.warn("Camera device detection info:", err);
      });

    return () => {
      stopCamera();
    };
  }, [isMobileDevice]);

  // Auto-dismiss notification (2s for SUCCESS, 4s for REJECTED / DUPLICATE)
  useEffect(() => {
    if (scanNotification) {
      const timer = setTimeout(() => {
        setScanNotification(null);
      }, scanNotification.type === 'SUCCESS' ? 2000 : 4000);
      return () => clearTimeout(timer);
    }
  }, [scanNotification]);

  const handleRequestPermissionAndStart = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Explicitly trigger user-gesture permission request
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isMobileDevice ? { facingMode: 'environment' } : true
        });
        stream.getTracks().forEach(t => t.stop());
      }
    } catch (e: any) {
      console.warn("Direct getUserMedia test error:", e?.message || e);
    }
    await startCamera(activeCameraId, isMobileDevice ? 'environment' : 'user');
  };

  const startCamera = async (cameraId?: string, overrideFacingMode?: 'environment' | 'user') => {
    setCameraError(null);

    try {
      // 1. Safely stop and clear any existing scanner instance
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch (e) {
          console.warn("Cleanup previous scanner instance:", e);
        }
        html5QrCodeRef.current = null;
      }

      // Ensure DOM element is present
      const qrElement = document.getElementById(qrRegionId);
      if (!qrElement) {
        throw new Error("Elemen scanner tidak ditemukan di halaman");
      }

      const html5QrCode = new Html5Qrcode(qrRegionId);
      html5QrCodeRef.current = html5QrCode;

      // On mobile phones, default to 'environment' (rear camera).
      // On laptops / PCs, default to 'user' (front webcam) or explicit cameraId.
      const targetFacing = overrideFacingMode || (isMobileDevice ? (facingMode || 'environment') : 'user');

      // Mirror mode on laptop webcam or front selfie camera
      const isFront = targetFacing === 'user' || !isMobileDevice;
      setIsMirrorMode(isFront);

      // Preferred camera config:
      // If on mobile: { facingMode: targetFacing }
      // If on laptop/PC: prefer deviceId if known, else { facingMode: 'user' }
      let cameraConfig: any = isMobileDevice ? { facingMode: targetFacing } : { facingMode: 'user' };

      if (cameraId && cameraId !== 'environment' && cameraId !== 'user') {
        cameraConfig = { deviceId: cameraId };
      } else if (!isMobileDevice && activeCameraId) {
        cameraConfig = { deviceId: activeCameraId };
      }

      const qrConfig = {
        fps: 14, // Optimized frame rate (14 FPS) for instant detection while preserving CPU & battery
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.max(220, Math.floor(minEdge * 0.75));
          return { width: boxSize, height: boxSize };
        },
        aspectRatio: 1.0,
      };

      try {
        await html5QrCode.start(
          cameraConfig,
          qrConfig,
          (decodedText) => handleQrCodeDecoded(decodedText),
          () => {}
        );
        setIsScanning(true);
        setFacingMode(targetFacing);
        return;
      } catch (firstErr: any) {
        // If permission was denied by user or browser, stop immediately and don't retry constraints (avoid cascading permission popups & errors)
        const isPermDenied = firstErr?.name === 'NotAllowedError' || 
          String(firstErr?.message || firstErr).toLowerCase().includes('permission denied');

        if (isPermDenied) {
          console.warn("Camera permission was not granted by user or browser:", firstErr?.message || firstErr);
          setCameraError(
            isMobileDevice
              ? "Izin akses kamera belum diberikan atau ditolak oleh browser HP. Silakan izinkan kamera di pengaturan browser atau gunakan simulasi presensi di bawah."
              : "Izin akses kamera belum diizinkan oleh browser Laptop. Silakan klik ikon 🔒 Gembok di samping alamat web (URL) browser Anda, ubah izin Kamera menjadi 'Izinkan' (Allow), lalu klik tombol 'Buka Kamera Laptop'."
          );
          setIsScanning(false);
          return;
        }

        console.warn("Primary camera start failed, attempting fallback...", firstErr);

        // Fallback strategies tailored for laptop vs mobile
        const fallbackConfigs = isMobileDevice
          ? [{ facingMode: 'environment' }, { facingMode: 'user' }]
          : [
              { facingMode: 'user' },
              ...(cameras[0]?.id ? [{ deviceId: cameras[0].id }] : []),
              { facingMode: 'environment' }
            ];

        for (const cfg of fallbackConfigs) {
          try {
            await html5QrCode.start(
              cfg,
              qrConfig,
              (decodedText) => handleQrCodeDecoded(decodedText),
              () => {}
            );
            setIsScanning(true);
            const resolvedFacing = (cfg as any).facingMode || (isMobileDevice ? 'environment' : 'user');
            setFacingMode(resolvedFacing);
            setIsMirrorMode(resolvedFacing === 'user' || !isMobileDevice);
            return;
          } catch (fallbackErr: any) {
            const isFPermDenied = fallbackErr?.name === 'NotAllowedError' || 
              String(fallbackErr?.message || fallbackErr).toLowerCase().includes('permission denied');
            if (isFPermDenied) {
              setCameraError(
                isMobileDevice
                  ? "Izin akses kamera belum diberikan di browser HP Anda."
                  : "Izin akses kamera belum diizinkan di browser Laptop Anda. Klik ikon 🔒 Gembok di samping alamat web browser untuk mengizinkan."
              );
              setIsScanning(false);
              return;
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("Camera start ended with warning:", err?.message || err);
      let errMsg = isMobileDevice
        ? "Gagal membuka kamera HP. Pastikan izin kamera telah diberikan di browser."
        : "Gagal membuka kamera Laptop. Pastikan izin kamera telah diizinkan di browser Anda.";
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission') || String(err).includes('Permission denied')) {
        errMsg = isMobileDevice
          ? "Izin akses kamera belum diberikan atau ditolak oleh browser HP. Silakan izinkan kamera di pengaturan browser atau gunakan simulasi presensi di bawah."
          : "Izin akses kamera belum diizinkan oleh browser Laptop. Silakan klik ikon 🔒 Gembok di samping alamat web (URL) browser Anda, ubah izin Kamera menjadi 'Izinkan' (Allow), lalu klik tombol 'Buka Kamera Laptop'.";
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        errMsg = isMobileDevice
          ? "Tidak ada perangkat kamera yang terdeteksi di HP ini."
          : "Tidak ada webcam yang terdeteksi di laptop ini.";
      } else if (err?.name === 'NotReadableError') {
        errMsg = "Kamera/Webcam sedang digunakan oleh aplikasi lain (seperti Zoom/Meet). Tutup aplikasi lain lalu coba lagi.";
      }
      setCameraError(errMsg);
      setIsScanning(false);
    }
  };

  const handleFlipCamera = async () => {
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCam = cameras[nextIndex];
      setActiveCameraId(nextCam.id);
      const isNextCamFront = nextCam.label.toLowerCase().includes('depan') || 
        nextCam.label.toLowerCase().includes('front') || 
        nextCam.label.toLowerCase().includes('user');
      setIsMirrorMode(isNextCamFront);
      await startCamera(nextCam.id, isNextCamFront ? 'user' : 'environment');
    } else {
      const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextFacing);
      setActiveCameraId('');
      setIsMirrorMode(nextFacing === 'user');
      await startCamera('', nextFacing);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
  };

  const handleQrCodeDecoded = (decodedText: string) => {
    const nowMs = Date.now();
    // Debounce identical rapid camera scans within 2 seconds
    if (
      lastScanDebounceRef.current.code === decodedText &&
      nowMs - lastScanDebounceRef.current.timestamp < 2000
    ) {
      return;
    }
    lastScanDebounceRef.current = { code: decodedText, timestamp: nowMs };

    const cleanDecoded = (decodedText || '').trim();
    const normalizedDecoded = cleanDecoded.toLowerCase();
    // Strip common prefixes like STUDENT-, STD-, SISWA-, QR-, ID-
    const strippedCode = cleanDecoded.replace(/^(STUDENT|SISWA|STD|QR|ID)[-_:\s]*/i, '').trim();
    const normalizedStripped = strippedCode.toLowerCase();

    // Smart instant student lookup via pre-indexed Map (O(1) - <0.1ms)
    let matched = studentLookupMap.get(normalizedDecoded) ||
      (normalizedStripped ? studentLookupMap.get(normalizedStripped) : undefined) ||
      studentLookupMap.get(`student-${normalizedDecoded}`) ||
      studentLookupMap.get(`std-${normalizedDecoded}`);

    // Fallback search if not matched in direct map
    if (!matched) {
      matched = students.find(s => {
        if (!s) return false;
        const sQrLower = (s.qrCode || '').trim().toLowerCase();
        const sNisnLower = (s.nisn || '').trim().toLowerCase();
        const sNisLower = (s.nis || '').trim().toLowerCase();
        const sIdLower = (s.id || '').trim().toLowerCase();

        if (sQrLower === normalizedDecoded || sNisnLower === normalizedDecoded || sNisLower === normalizedDecoded || sIdLower === normalizedDecoded) return true;
        if (normalizedStripped && (sNisnLower === normalizedStripped || sNisLower === normalizedStripped || sIdLower === normalizedStripped)) return true;
        return false;
      });
    }

    if (matched) {
      processAttendanceForStudent(matched);
    } else {
      playScanSound('ERROR');
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setScanNotification({
        type: 'REJECTED',
        badgeText: '❌ QR CODE TIDAK DITEMUKAN',
        title: 'Data Siswa Belum Terdaftar di Sistem',
        studentName: 'QR Tidak Dikenali',
        className: '-',
        time: timeStr,
        mode: scanMode,
        reason: `QR Code [${cleanDecoded}] tidak ditemukan dalam data siswa. Pastikan siswa telah terdaftar di menu Data Siswa atau periksa sinkronisasi Cloud.`,
        timestamp: Date.now()
      });
    }
  };

  const processAttendanceForStudent = (student: Student) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = getLocalDateString(now);

    const freshRecords = getAttendanceRecords();
    const existingRecord = freshRecords.find(r => (
      (r.studentId === student.id) ||
      (r.nisn && student.nisn && r.nisn === student.nisn)
    ) && r.date === dateStr) || attendanceRecords.find(r => (
      (r.studentId === student.id) ||
      (r.nisn && student.nisn && r.nisn === student.nisn)
    ) && r.date === dateStr);

    if (scanMode === 'PULANG') {
      // MODE SCAN PULANG
      // 1. Validasi mutlak: Jika waktu saat ini masih sebelum jam pulang sekolah hari ini, tolak presensi pulang
      const dayNowName = DAY_NAMES[now.getDay()];
      const dayEndTimeStr = getSchoolCheckoutTimeForDay(schoolProfile, dayNowName);
      const [endH, endM] = dayEndTimeStr.split(':').map(Number);
      const endMins = (endH || 15) * 60 + (endM || 0);
      const currMins = now.getHours() * 60 + now.getMinutes();
      const resetMins = 60; // 01:00 WITA
      const isBeforeCheckoutTime = currMins >= resetMins && currMins < endMins;

      if (isBeforeCheckoutTime) {
        playScanSound('ERROR');
        const rejectionReason = `Scan Pulang DITOLAK! Waktu saat ini (${timeStr.slice(0, 5)} WITA) belum memasuki jam kepulangan sekolah (${dayEndTimeStr} WITA). Tombol & mode scan pulang dinonaktifkan hingga jam pulang tiba.`;
        setScanNotification({
          type: 'REJECTED',
          badgeText: '🔒 SCAN PULANG TERKUNCI',
          title: 'Belum Memasuki Jam Pulang Sekolah',
          studentName: student.name,
          className: student.className,
          time: timeStr.slice(0, 5),
          mode: 'PULANG',
          reason: rejectionReason,
          timestamp: Date.now()
        });
        setLastScannedResult({
          student,
          record: existingRecord || {
            id: `att-rejected-${Date.now()}`,
            studentId: student.id,
            studentName: student.name,
            nisn: student.nisn,
            className: student.className,
            date: dateStr,
            time: '-',
            status: 'HADIR',
            method: 'QR_SCAN',
            scannedBy: 'Pos Scanner Utama',
            parentNotified: false
          },
          mode: 'PULANG',
          isRejected: true,
          rejectionReason: rejectionReason
        });
        return;
      }

      // 2. Check if student has ALREADY scanned for PULANG today
      if (existingRecord && existingRecord.returnTime && existingRecord.returnTime !== '-') {
        playScanSound('ERROR');

        const recordedTime = existingRecord.returnTime;
        const timeParts = recordedTime.replace(/\./g, ':').split(':');
        const formattedTime = timeParts.length >= 2 ? `${timeParts[0]}:${timeParts[1]}` : recordedTime;
        const rejectionReason = `DITOLAK: Siswa ${student.name} sudah presensi Pulang hari ini pukul ${formattedTime} WITA. Scan QR hanya berlaku 1 kali per hari!`;

        setScanNotification({
          type: 'DUPLICATE',
          badgeText: 'ℹ️ SUDAH SCAN PULANG HARI INI',
          title: 'Presensi Pulang Siswa Sudah Pernah Tercatat',
          studentName: student.name,
          className: student.className,
          time: formattedTime,
          mode: 'PULANG',
          reason: rejectionReason,
          timestamp: Date.now()
        });

        setLastScannedResult({
          student,
          record: existingRecord,
          mode: 'PULANG',
          isRejected: true,
          isDuplicate: true,
          rejectionReason
        });

        return;
      }

      playScanSound('PULANG');

      const returnStatus = 'PULANG';

      const record: AttendanceRecord = {
        id: existingRecord ? existingRecord.id : `att-${Date.now()}-${student.id}`,
        studentId: student.id,
        studentName: student.name,
        nisn: student.nisn,
        className: student.className,
        date: dateStr,
        time: (existingRecord && existingRecord.time && existingRecord.time !== '-') ? existingRecord.time : '-',
        status: (existingRecord && existingRecord.status && existingRecord.status !== 'ALPA') ? existingRecord.status : 'HADIR',
        method: (existingRecord && existingRecord.method) ? existingRecord.method : 'QR_SCAN',
        scannedBy: (existingRecord && existingRecord.scannedBy && !existingRecord.scannedBy.includes('Sistem Otomatis')) ? existingRecord.scannedBy : 'Pos Scanner Utama',
        parentNotified: false,
        returnTime: timeStr,
        returnStatus,
        returnScannedBy: 'Pos Scanner Utama (Pulang)',
      };

      onAddAttendance(record);

      setLastScannedResult({
        student,
        record,
        mode: 'PULANG',
        isRejected: false
      });

      setScanNotification({
        type: 'SUCCESS',
        badgeText: '✅ QR CODE PULANG BERHASIL!',
        title: `Presensi Kepulangan Berhasil Dicatat (Jam Pulang: ${dayEndTimeStr} WITA)`,
        studentName: student.name,
        className: student.className,
        time: timeStr,
        mode: 'PULANG',
        reason: `Siswa ${student.name} tercatat presensi pulang tepat waktu sesuai jadwal kepulangan hari ${dayNowName} (${dayEndTimeStr} WITA).`,
        timestamp: Date.now()
      });
    } else {
      // MODE SCAN MASUK
      // Check if Mode Scan Masuk is CLOSED (past todayEndTimeStr)
      if (checkIsMasukScanClosed(now)) {
        playScanSound('ERROR');

        const rejectionReason = `Scan Masuk DITOLAK! Mode Scan Masuk telah DITUTUP karena telah memasuki jam pulang sekolah (${todayEndTimeStr} WITA). Silakan gunakan Mode Scan Pulang.`;

        setScanNotification({
          type: 'REJECTED',
          badgeText: '🔒 SCAN MASUK DITUTUP',
          title: 'Waktu Masuk Berakhir (Sudah Jam Pulang)',
          studentName: student.name,
          className: student.className,
          time: timeStr,
          mode: 'MASUK',
          reason: rejectionReason,
          timestamp: Date.now()
        });

        setLastScannedResult({
          student,
          record: existingRecord || {
            id: `att-rejected-${Date.now()}`,
            studentId: student.id,
            studentName: student.name,
            nisn: student.nisn,
            className: student.className,
            date: dateStr,
            time: timeStr,
            status: 'ALPA',
            method: 'QR_SCAN',
            scannedBy: 'Pos Scanner Utama',
            parentNotified: false
          },
          mode: 'MASUK',
          isRejected: true,
          rejectionReason: `Mode Scan Masuk TUTUP (Lewat Jam Pulang ${todayEndTimeStr} WITA)`
        });

        return;
      }

      // Check if student has ALREADY scanned/recorded for MASUK today (HADIR/TERLAMBAT/IZIN/SAKIT)
      const isAlreadyRecordedForMasuk = existingRecord && (
        existingRecord.status === 'HADIR' ||
        existingRecord.status === 'TERLAMBAT' ||
        existingRecord.status === 'IZIN' ||
        existingRecord.status === 'SAKIT' ||
        (existingRecord.method === 'QR_SCAN' && existingRecord.status !== 'ALPA')
      );

      if (isAlreadyRecordedForMasuk) {
        playScanSound('ERROR');

        const recordedTime = (existingRecord?.time && existingRecord.time !== '-') ? existingRecord.time : timeStr;
        const timeParts = recordedTime.replace(/\./g, ':').split(':');
        const formattedTime = timeParts.length >= 2 ? `${timeParts[0]}:${timeParts[1]}` : recordedTime;
        const rejectionReason = `DITOLAK: Siswa ${student.name} sudah presensi Masuk hari ini pukul ${formattedTime} WITA. Scan QR hanya berlaku 1 kali per hari!`;

        setScanNotification({
          type: 'DUPLICATE',
          badgeText: 'ℹ️ SUDAH SCAN MASUK HARI INI',
          title: 'Presensi Masuk Siswa Sudah Pernah Tercatat',
          studentName: student.name,
          className: student.className,
          time: formattedTime,
          mode: 'MASUK',
          reason: rejectionReason,
          timestamp: Date.now()
        });

        setLastScannedResult({
          student,
          record: existingRecord!,
          mode: 'MASUK',
          isRejected: true,
          isDuplicate: true,
          rejectionReason
        });

        return;
      }

      // Menentukan status kehadiran masuk dengan calculateAttendanceStatus:
      // Jam Masuk 07:00 WITA dengan Toleransi 35 menit (cutoff: 07:35 WITA)
      // Sebelum / tepat 07:35:00 WITA => HADIR (Tepat Waktu)
      // Lewat dari 07:35:00 WITA => TERLAMBAT
      const status: AttendanceRecord['status'] = calculateAttendanceStatus(now, schoolProfile);
      const isLate = status === 'TERLAMBAT';

      playScanSound(isLate ? 'LATE' : 'SUCCESS');

      const record: AttendanceRecord = {
        id: existingRecord ? existingRecord.id : `att-${Date.now()}-${student.id}`,
        studentId: student.id,
        studentName: student.name,
        nisn: student.nisn,
        className: student.className,
        date: dateStr,
        time: timeStr,
        status,
        method: 'QR_SCAN',
        scannedBy: 'Pos Scanner Utama',
        parentNotified: false,
        returnTime: existingRecord?.returnTime,
        returnStatus: existingRecord?.returnStatus,
        returnScannedBy: existingRecord?.returnScannedBy,
      };

      onAddAttendance(record);

      setLastScannedResult({
        student,
        record,
        mode: 'MASUK',
        isRejected: false
      });

      setScanNotification({
        type: 'SUCCESS',
        badgeText: isLate ? '⚠️ SCAN MASUK (TERLAMBAT)' : '✅ SCAN MASUK BERHASIL!',
        title: isLate ? 'Presensi Masuk Terlambat Dicatat' : 'Presensi Masuk Tepat Waktu Dicatat',
        studentName: student.name,
        className: student.className,
        time: timeStr,
        mode: 'MASUK',
        timestamp: Date.now()
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Title Banner */}
      <div className="bg-indigo-700 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-indigo-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-10">
          <ScanLine className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-indigo-100 text-xs font-semibold mb-2 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Scanner Presensi Real-Time
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Pos Scan QR Code Siswa</h1>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1">Presensi cepat, aman, dan offline-ready dengan sistem antrean batching otomatis.</p>
          </div>

          {/* Cloud Batch Worker Status Card - HANYA DITAMPILKAN UNTUK ROLE ADMIN */}
          {isAdmin && (
            <div className="bg-indigo-950/70 backdrop-blur-md border border-indigo-400/30 rounded-2xl p-3.5 text-xs max-w-sm w-full shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Cloud Sync Worker</span>
                </div>
                {queueStatus.isFlushing ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    Kirim ke Cloud...
                  </span>
                ) : queueStatus.pendingCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Antrean: {queueStatus.pendingCount} / {queueStatus.maxBatch}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-200 bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Tersinkron Cloud
                  </span>
                )}
              </div>

              <p className="text-indigo-200 text-[11px] leading-relaxed">
                {queueStatus.pendingCount > 0 ? (
                  <span>
                    Disimpan instan di lokal & dikirim ke Cloud saat mencapai <strong className="text-white font-bold">{queueStatus.maxBatch} siswa</strong> atau dalam <strong className="text-amber-300 font-bold">{queueStatus.secondsRemaining} detik</strong>.
                  </span>
                ) : (
                  <span>
                    Real-time Cloud Sync aktif: data presensi tersimpan lokal instan (0ms) & otomatis tersinkron ke Firestore Cloud Blaze.
                  </span>
                )}
              </p>

              {queueStatus.pendingCount > 0 && (
                <div className="mt-2.5 pt-2 border-t border-indigo-500/30 flex items-center justify-between gap-3">
                  <div className="flex-1 bg-indigo-900/80 rounded-full h-2 overflow-hidden border border-indigo-400/30">
                    <div 
                      className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (queueStatus.pendingCount / queueStatus.maxBatch) * 100)}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleManualFlush}
                    disabled={queueStatus.isFlushing}
                    className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                    title="Kirim antrean sekarang ke Firestore tanpa menunggu"
                  >
                    <RotateCw className={`w-3 h-3 ${queueStatus.isFlushing ? 'animate-spin' : ''}`} />
                    Kirim Sekarang
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mode Selection Tabs (Scan Masuk vs Scan Pulang) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-2 shadow-xs flex flex-col sm:flex-row items-center gap-2">
        <button
          type="button"
          disabled={isMasukClosedNow}
          onClick={() => {
            if (isMasukClosedNow) {
              setScanMode('PULANG');
              setIsManualOverride(false);
              setScanNotification({
                type: 'REJECTED',
                badgeText: '🔒 SCAN MASUK DITUTUP',
                title: 'Mode Scan Masuk Tidak Dapat Digunakan',
                studentName: '-',
                className: '-',
                time: currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                mode: 'MASUK',
                reason: `Mode Scan Masuk telah ditutup karena sudah melewati jam pulang sekolah (${todayEndTimeStr} WITA). Sistem otomatis beralih ke Mode Scan Pulang.`,
                timestamp: Date.now()
              });
              return;
            }
            setScanMode('MASUK');
            setIsManualOverride(true);
          }}
          className={`flex-1 w-full py-3 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
            scanMode === 'MASUK'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : isMasukClosedNow
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60 cursor-pointer'
          }`}
          title={isMasukClosedNow ? `Mode Scan Masuk ditutup karena sudah lewat jam pulang (${todayEndTimeStr} WITA)` : 'Mode Scan Masuk (Pagi)'}
        >
          <Sun className={`w-4 h-4 ${isMasukClosedNow ? 'text-slate-400' : 'text-amber-200'}`} />
          <span>☀️ MODE SCAN MASUK (TIBA SEKOLAH / PAGI)</span>
          {isMasukClosedNow ? (
            <span className="bg-rose-100 text-rose-700 border border-rose-200 text-[10px] px-2 py-0.5 rounded-full font-black ml-1">
              🔒 TUTUP ({todayEndTimeStr} WITA)
            </span>
          ) : (
            scanMode === 'MASUK' && (
              <span className="bg-amber-600 text-amber-100 border border-amber-400 text-[10px] px-2 py-0.5 rounded-full font-black ml-1">
                ✅ AKTIF
              </span>
            )
          )}
        </button>

        <button
          type="button"
          disabled={isBeforeEndTime}
          onClick={() => {
            if (isBeforeEndTime) {
              setScanNotification({
                type: 'REJECTED',
                badgeText: '🔒 SCAN PULANG TERKUNCI',
                title: 'Mode Scan Pulang Belum Dibuka',
                studentName: '-',
                className: '-',
                time: currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                mode: 'PULANG',
                reason: `Mode Scan Pulang dinonaktifkan sebelum jam pulang sekolah! Jam kepulangan hari ini (${todayName}) adalah pukul ${todayEndTimeStr} WITA. Tombol otomatis aktif saat jam pulang tiba.`,
                timestamp: Date.now()
              });
              return;
            }
            setScanMode('PULANG');
            setIsManualOverride(true);
          }}
          className={`flex-1 w-full py-3 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
            isBeforeEndTime
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
              : scanMode === 'PULANG'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 ring-2 ring-emerald-400/50 cursor-pointer'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60 cursor-pointer'
          }`}
          title={isBeforeEndTime ? `Mode Scan Pulang terkunci sebelum jam kepulangan hari ini (${todayEndTimeStr} WITA)` : 'Mode Scan Pulang (Sore)'}
        >
          {isBeforeEndTime ? (
            <Lock className="w-4 h-4 text-slate-400" />
          ) : (
            <Home className={`w-4 h-4 ${scanMode === 'PULANG' ? 'text-emerald-100' : 'text-emerald-600'}`} />
          )}
          <span>🏠 MODE SCAN PULANG (SAAT PULANG / SORE)</span>
          {isBeforeEndTime ? (
            <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-2 py-0.5 rounded-full font-black ml-1">
              🔒 TERKUNCI (Buka {todayEndTimeStr} WITA)
            </span>
          ) : (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              scanMode === 'PULANG'
                ? 'bg-emerald-800 text-emerald-100 border border-emerald-500'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {scanMode === 'PULANG' ? `✅ AKTIF (Mulai ${todayEndTimeStr} WITA)` : `Mulai ${todayEndTimeStr} WITA`}
            </span>
          )}
        </button>
      </div>

      {/* Info Bar Waktu Real-Time & Jam Pulang Sekolah */}
      <div className="bg-slate-50 border border-slate-200/80 text-slate-700 px-4 py-2.5 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            Waktu Sekarang (WITA): <strong className="text-slate-900 font-mono">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong> ({todayName}, {isTodayActiveDay ? 'Hari Aktif Belajar' : 'Hari Libur / Non-Aktif'}).
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-500 font-medium">Jam Pulang Hari Ini:</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-extrabold font-mono">
            {todayEndTimeStr} WITA
          </span>
          {isBeforeEndTime ? (
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-700" />
              Scan Pulang Terkunci
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              Scan Pulang Dibuka
            </span>
          )}
        </div>
      </div>

      {scanMode === 'MASUK' && isMasukClosedNow && (
        <div className="bg-rose-50 border-2 border-rose-200 text-rose-950 p-4 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black text-rose-900 text-sm block">
                🔒 MODE SCAN MASUK DITUTUP (TELAH MEMASUKI JAM PULANG)
              </span>
              <p className="text-rose-800 text-xs mt-0.5 leading-relaxed">
                Waktu belajar sekolah telah memasuki jam pulang (<strong>{todayEndTimeStr} WITA</strong>). Presensi scan masuk ditutup dan tidak dapat digunakan. Silakan beralih ke Mode Scan Pulang untuk mencatat kepulangan siswa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScanMode('PULANG')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs shrink-0 shadow-xs cursor-pointer transition-colors"
          >
            Beralih ke Scan Pulang ➔
          </button>
        </div>
      )}

      {todayHoliday && (
        <div className="bg-rose-50 border border-rose-200 text-rose-950 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-xs animate-fadeIn">
          <Calendar className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="flex-1">
            <span className="font-extrabold text-rose-900">
              Hari Ini Libur: {todayHoliday.name} ({todayHoliday.type === 'NASIONAL' ? 'Libur Nasional 🇮🇩' : todayHoliday.type === 'CUTI_BERSAMA' ? 'Cuti Bersama 🌴' : 'Libur Khusus Sekolah 🏫'})
            </span>{' '}
            <span className="text-rose-800 font-medium">
              — Sistem otomatis Alpa dinonaktifkan hari ini. Scanner tetap dapat digunakan jika terdapat kegiatan khusus sekolah.
            </span>
          </div>
        </div>
      )}

      {!isTodayActiveDay && !todayHoliday && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-xs animate-fadeIn">
          <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1">
            <span className="font-extrabold text-amber-900">Info Hari Non-Aktif Belajar ({todayName}):</span>{' '}
            <span>
              Hari ini dikonfigurasi sebagai hari libur/non-aktif belajar. Aturan keterlambatan & penetapan status Alpa otomatis ({schoolProfile.autoAlpaTime || '08:30'} WITA) dimatikan.
            </span>
          </div>
        </div>
      )}

      {/* Prominent Scan Success / Rejected / Duplicate (Biru Tua) Banner Notification */}
      {scanNotification && (
        <div className={`border-2 rounded-3xl p-4 sm:p-5 shadow-xl flex items-start sm:items-center justify-between gap-4 animate-bounce-short ${
          scanNotification.type === 'DUPLICATE'
            ? 'bg-blue-950 text-white border-blue-500 ring-1 ring-blue-400/30 shadow-blue-950/40'
            : scanNotification.type === 'REJECTED'
              ? 'bg-rose-600 text-white border-rose-400 shadow-rose-950/20'
              : 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-950/20'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ring-4 ${
              scanNotification.type === 'DUPLICATE'
                ? 'bg-blue-900/90 text-blue-200 ring-blue-500/25 border border-blue-400/30'
                : 'bg-white/20 text-white ring-white/10'
            }`}>
              {scanNotification.type === 'DUPLICATE' ? (
                <Info className="w-7 h-7 text-blue-200" />
              ) : scanNotification.type === 'REJECTED' ? (
                <XCircle className="w-7 h-7 text-white" />
              ) : (
                <CheckCircle2 className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs ${
                  scanNotification.type === 'DUPLICATE'
                    ? 'bg-blue-100 text-blue-950'
                    : scanNotification.type === 'REJECTED'
                      ? 'bg-white text-rose-900'
                      : 'bg-white text-emerald-900'
                }`}>
                  {scanNotification.badgeText || (
                    scanNotification.type === 'DUPLICATE'
                      ? 'ℹ️ SUDAH PERNAH SCAN'
                      : scanNotification.type === 'REJECTED'
                        ? '❌ SCAN DITOLAK'
                        : '✅ QR CODE BERHASIL DI-SCAN!'
                  )}
                </span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                  scanNotification.type === 'DUPLICATE'
                    ? 'bg-blue-900 text-blue-200 border border-blue-700/80'
                    : scanNotification.type === 'REJECTED'
                      ? 'bg-rose-800/80 text-rose-100'
                      : 'bg-emerald-800/60 text-emerald-100'
                }`}>
                  {scanNotification.time} WITA
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black mt-1 text-white tracking-tight">
                {scanNotification.title || (
                  scanNotification.type === 'DUPLICATE'
                    ? 'Presensi Siswa Sudah Pernah Tercatat'
                    : scanNotification.type === 'REJECTED'
                      ? 'Scan QR Ditolak'
                      : 'Data Presensi Siswa Berhasil Terdeteksi & Dicatat!'
                )}
              </h3>
              <div className={`text-xs sm:text-sm font-medium mt-1 ${
                scanNotification.type === 'DUPLICATE'
                  ? 'text-blue-100'
                  : scanNotification.type === 'REJECTED'
                    ? 'text-rose-100 font-semibold'
                    : 'text-emerald-100'
              }`}>
                {scanNotification.type === 'DUPLICATE' ? (
                  <p className="bg-blue-900/70 border border-blue-700/80 px-3 py-1.5 rounded-xl text-white font-bold leading-relaxed shadow-2xs">
                    {scanNotification.reason}
                  </p>
                ) : scanNotification.type === 'REJECTED' ? (
                  <span>{scanNotification.reason}</span>
                ) : (
                  <span>
                    Siswa: <strong className="text-white underline font-bold">{scanNotification.studentName}</strong> ({scanNotification.className}) • Presensi: <strong className="text-white uppercase font-bold bg-emerald-800/80 px-1.5 py-0.5 rounded">{scanNotification.mode}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setScanNotification(null)}
            className={`p-2 rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0 ${
              scanNotification.type === 'DUPLICATE'
                ? 'text-blue-200 hover:text-white bg-blue-900/80 hover:bg-blue-800 border border-blue-700/60'
                : 'text-white/80 hover:text-white bg-white/10 hover:bg-white/20'
            }`}
            title="Tutup Notifikasi"
          >
            ✕ Tutup
          </button>
        </div>
      )}

      {/* Main Grid: Scanner Left, Result Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Scanner & Quick Manual Search (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Camera View Box */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm flex flex-col items-center">
            
            {/* Header of Camera Box */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  Video Stream Camera
                </span>
                {isScanning && (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    LIVE
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Flip Camera Button */}
                {isScanning && (
                  <button
                    type="button"
                    onClick={handleFlipCamera}
                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-slate-200 transition-colors cursor-pointer"
                    title="Ganti Kamera Depan / Belakang"
                  >
                    <SwitchCamera className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden sm:inline">Ganti Kamera</span>
                  </button>
                )}

                {cameras.length > 1 && isScanning && (
                  <select
                    value={activeCameraId}
                    onChange={(e) => {
                      const newCamId = e.target.value;
                      setActiveCameraId(newCamId);
                      const camObj = cameras.find(c => c.id === newCamId);
                      const isFront = camObj && (
                        camObj.label.toLowerCase().includes('depan') ||
                        camObj.label.toLowerCase().includes('front') ||
                        camObj.label.toLowerCase().includes('user') ||
                        camObj.label.toLowerCase().includes('selfie')
                      );
                      const nextFacing = isFront ? 'user' : 'environment';
                      setFacingMode(nextFacing);
                      setIsMirrorMode(Boolean(isFront));
                      startCamera(newCamId, nextFacing);
                    }}
                    className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1 text-xs font-semibold"
                  >
                    {cameras.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                )}

                {isScanning && (
                  <button
                    type="button"
                    onClick={() => stopCamera()}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer border border-rose-200"
                  >
                    Matikan Kamera
                  </button>
                )}
              </div>
            </div>

            {/* CSS styles to apply mirror transform to video element */}
            <style>{`
              #${qrRegionId} video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                border-radius: 1rem !important;
                transition: transform 0.25s ease-in-out !important;
              }
              .qr-mirror-active #${qrRegionId} video {
                transform: scaleX(-1) !important;
                -webkit-transform: scaleX(-1) !important;
              }
            `}</style>

            {/* QR Scanner Container */}
            <div className={`w-full relative min-h-[280px] sm:min-h-[340px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center ${
              isMirrorMode ? 'qr-mirror-active' : ''
            }`}>
              
              <div id={qrRegionId} className="w-full h-full text-slate-300"></div>

              {/* Floating Mirror Indicator Badge (Automatic for Front Camera) */}
              {isScanning && isMirrorMode && (
                <div className="absolute top-3 left-3 z-10 bg-purple-950/80 backdrop-blur-md text-purple-200 text-[11px] font-bold px-3 py-1 rounded-full border border-purple-400/40 flex items-center gap-1.5 shadow-md pointer-events-none animate-fadeIn">
                  <FlipHorizontal className="w-3.5 h-3.5 text-purple-300" />
                  <span>Kamera Depan (Cermin Otomatis)</span>
                </div>
              )}

              {!isScanning && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3 ring-1 ring-indigo-500/30">
                    <ScanLine className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-white font-bold text-base">Kamera Sedang Nonaktif</h3>
                  <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
                    {isMobileDevice 
                      ? 'Klik tombol "Aktifkan Kamera Sekarang" di bawah ini atau gunakan daftar simulasi siswa di bawah.'
                      : 'Klik tombol "Aktifkan Kamera Laptop / Webcam" di bawah ini atau gunakan daftar simulasi siswa di bawah.'}
                  </p>
                  <button
                    onClick={() => handleRequestPermissionAndStart()}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    {isMobileDevice ? 'Aktifkan Kamera Sekarang' : 'Aktifkan Kamera Laptop / Webcam'}
                  </button>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center bg-slate-900/95 z-10 overflow-y-auto">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2.5 ring-2 ring-amber-500/30">
                    <Camera className="w-6 h-6" />
                  </div>
                  <h4 className="text-white font-bold text-sm">
                    {isMobileDevice ? 'Gagal Mengakses Kamera HP' : 'Kamera Laptop Belum Diizinkan'}
                  </h4>
                  <p className="text-slate-200 text-xs font-medium max-w-sm mt-1 leading-relaxed">{cameraError}</p>

                  {/* Actions to recover */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 mt-4 w-full max-w-sm">
                    <button
                      onClick={() => handleRequestPermissionAndStart()}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      {isMobileDevice ? 'Coba Buka Kamera Belakang' : '📷 Buka Kamera Laptop / Webcam'}
                    </button>
                    {isMobileDevice && (
                      <button
                        onClick={() => startCamera(undefined, 'user')}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <SwitchCamera className="w-4 h-4" />
                        Coba Kamera Depan
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCameraError(null)}
                    className="mt-2.5 w-full max-w-sm bg-white/10 hover:bg-white/20 text-slate-300 font-semibold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    Tutup Pesan & Gunakan Simulasi Klik di Bawah
                  </button>

                  <div className="mt-3.5 bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 text-[11px] text-slate-300 max-w-sm text-left">
                    <p className="font-bold text-amber-400 mb-1 flex items-center gap-1">
                      💡 {isMobileDevice ? 'Tips Izin Kamera HP:' : 'Panduan Izin Kamera Laptop (Chrome / Edge / Firefox):'}
                    </p>
                    {isMobileDevice ? (
                      <p className="leading-snug text-slate-300">
                        Jika muncul dialog browser, pilih <strong>"Izinkan" (Allow)</strong>. Jika terblokir, klik ikon gembok/pengaturan di samping alamat web di atas untuk mengaktifkan izin Kamera.
                      </p>
                    ) : (
                      <div className="space-y-1.5 text-slate-300 leading-snug">
                        <p>1. Lihat bagian atas browser Anda, klik <strong>ikon 🔒 Gembok</strong> atau <strong>Setelan Situs</strong> di sebelah kiri alamat website (URL).</p>
                        <p>2. Pada opsi <strong>Kamera (Camera)</strong>, ubah status dari <em>Blokir</em> menjadi <strong>"Izinkan" (Allow)</strong>.</p>
                        <p>3. Muat ulang halaman (tekan <strong>F5 / Refresh</strong>), lalu klik tombol <strong>"Buka Kamera Laptop"</strong> di atas.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sound Notification Status & Quick Test Bar */}
            <div className="w-full mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Nada Dering Scan: <strong className="text-emerald-700">Aktif</strong></span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-medium mr-1 hidden sm:inline">Uji Suara:</span>
                <button
                  type="button"
                  onClick={() => playScanSound('SUCCESS')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Putar Nada Dering Masuk Tepat Waktu"
                >
                  🔔 Tepat Waktu
                </button>
                <button
                  type="button"
                  onClick={() => playScanSound('LATE')}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Putar Nada Dering Masuk Terlambat"
                >
                  ⚠️ Terlambat
                </button>
                <button
                  type="button"
                  onClick={() => playScanSound('PULANG')}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Putar Nada Dering Pulang"
                >
                  🏠 Pulang
                </button>
              </div>
            </div>
          </div>

          {/* Quick Click Simulation for Demo */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  Simulasi Klik Cepat Siswa (Uji Coba Absensi)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Klik nama untuk langsung simulasi scan</p>
              </div>

              {/* Filter Kelas & Cari Nama (Pilihan Kelas di atas, Cari Nama di bawah pada mode mobile) */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                {/* 1. Filter Pilihan Kelas */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <select
                    value={simClassFilter}
                    onChange={(e) => setSimClassFilter(e.target.value)}
                    className="w-full sm:w-auto bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">Semua Kelas ({students.length})</option>
                    {classList.map((c) => (
                      <option key={c} value={c}>
                        Kelas {c} ({students.filter(s => s.className === c).length})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Cari Nama Siswa (Berada di bawah pilihan kelas pada mode mobile) */}
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={simSearchQuery}
                    onChange={(e) => setSimSearchQuery(e.target.value)}
                    placeholder="Cari nama siswa..."
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 shadow-2xs"
                  />
                  {simSearchQuery && (
                    <button
                      onClick={() => setSimSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {filteredStudents.slice(0, 36).map((std) => (
                <button
                  key={std.id}
                  onClick={() => processAttendanceForStudent(std)}
                  className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 rounded-2xl text-left transition-all group cursor-pointer"
                >
                  <img
                    src={std.photoUrl || (std.gender === 'P'
                      ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                      : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80')}
                    alt={std.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = std.gender === 'P'
                        ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                        : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80';
                    }}
                    className="w-8 h-8 rounded-xl object-cover border border-slate-200 group-hover:border-indigo-400 shrink-0 bg-slate-100"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-900">
                      {std.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">{std.className} | {std.nisn.slice(-4)}</p>
                  </div>
                </button>
              ))}

              {filteredStudents.length > 36 && (
                <div className="col-span-full text-center py-2 text-slate-400 text-[11px] font-medium bg-slate-100/70 rounded-xl">
                  Menampilkan 36 dari {filteredStudents.length} siswa. Ketik nama di kolom cari untuk menemukan siswa lain.
                </div>
              )}

              {filteredStudents.length === 0 && (
                <div className="col-span-full text-center py-6 text-slate-400 text-xs font-medium">
                  Tidak ada data siswa yang sesuai dengan pencarian atau filter kelas.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Panel: Last Scan Result Card (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {lastScannedResult ? (
            <div className={`rounded-3xl p-5 border shadow-md transition-all duration-300 bg-white ${
              lastScannedResult.isDuplicate
                ? 'border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/20'
                : lastScannedResult.isRejected
                  ? 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/20'
                  : lastScannedResult.record.status === 'HADIR' 
                    ? 'border-emerald-200 ring-2 ring-emerald-500/10' 
                    : 'border-amber-200 ring-2 ring-amber-500/10'
            }`}>

              {/* Scan Alert Banner inside card */}
              {lastScannedResult.isDuplicate ? (
                <div className="bg-blue-950 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-2xl mb-4 flex items-center justify-between shadow-xs border border-blue-700">
                  <span className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-300 shrink-0" />
                    ℹ️ SCAN QR CODE DITOLAK!
                  </span>
                  <span className="text-[10px] bg-blue-800 text-blue-100 px-2 py-0.5 rounded-md font-mono uppercase font-black border border-blue-600">
                    DUPLIKAT SCAN (BIRU TUA)
                  </span>
                </div>
              ) : lastScannedResult.isRejected ? (
                <div className="bg-rose-600 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-2xl mb-4 flex items-center justify-between shadow-xs border border-rose-500">
                  <span className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-200 shrink-0" />
                    ⛔ SCAN QR CODE DITOLAK!
                  </span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-mono uppercase">
                    TERTOLAK
                  </span>
                </div>
              ) : (
                <div className="bg-emerald-600 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-2xl mb-4 flex items-center justify-between shadow-xs border border-emerald-500">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                    DATA QR CODE BERHASIL DI-SCAN!
                  </span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-mono">
                    TERCATAT
                  </span>
                </div>
              )}
              
              {/* Header Badge */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  {lastScannedResult.isDuplicate ? (
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                      <Info className="w-5 h-5" />
                    </div>
                  ) : lastScannedResult.isRejected ? (
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                      <XCircle className="w-5 h-5" />
                    </div>
                  ) : lastScannedResult.mode === 'PULANG' ? (
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <Home className="w-5 h-5" />
                    </div>
                  ) : lastScannedResult.record.status === 'HADIR' ? (
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400">
                      Hasil Scan Presensi {lastScannedResult.mode === 'PULANG' ? 'Pulang' : 'Masuk'}
                    </h3>
                    <span className={`text-xs font-bold ${
                      lastScannedResult.isDuplicate
                        ? 'text-blue-950 font-black'
                        : lastScannedResult.isRejected
                          ? 'text-rose-700'
                          : lastScannedResult.mode === 'PULANG'
                            ? 'text-emerald-700'
                            : lastScannedResult.record.status === 'HADIR' ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {lastScannedResult.isDuplicate
                        ? `ℹ️ DITOLAK (SUDAH PERNAH SCAN)`
                        : lastScannedResult.isRejected
                          ? `⛔ SCAN DITOLAK`
                          : lastScannedResult.mode === 'PULANG' 
                            ? (lastScannedResult.record.returnStatus === 'PULANG_CEPAT' 
                                ? '🏠 PULANG LEBIH AWAL' 
                                : '🏠 PULANG TEPAT WAKTU') 
                            : lastScannedResult.record.status === 'HADIR' ? '✓ TEPAT WAKTU' : '⚠️ TERLAMBAT'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1 justify-end">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    {lastScannedResult.mode === 'PULANG' ? (lastScannedResult.record.returnTime || lastScannedResult.record.time) : lastScannedResult.record.time}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">WITA</span>
                </div>
              </div>

              {/* Student Profile Card */}
              <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 mb-4">
                <img
                  src={lastScannedResult.student.photoUrl || (lastScannedResult.student.gender === 'P'
                    ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                    : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80')}
                  alt={lastScannedResult.student.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = lastScannedResult.student.gender === 'P'
                      ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
                      : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80';
                  }}
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-200 shadow-sm bg-slate-100"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-extrabold text-slate-900 truncate">{lastScannedResult.student.name}</h4>
                  <p className="text-xs text-indigo-700 font-bold mt-0.5">
                    Kelas: {lastScannedResult.student.className}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    NISN: {lastScannedResult.student.nisn} | NIS: {lastScannedResult.student.nis}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Wali: {lastScannedResult.student.parentName}
                  </p>
                </div>
              </div>

              {/* Attendance Verification Confirmation Card / Rejection Box */}
              {lastScannedResult.isDuplicate ? (
                <div className="bg-blue-50/90 p-4 rounded-2xl border border-blue-300 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-blue-950 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-blue-700" />
                      Keterangan Penolakan Scan:
                    </span>
                    <span className="text-[10px] bg-blue-200 text-blue-950 px-2.5 py-0.5 rounded-full font-black">
                      ALREADY SCANNED
                    </span>
                  </div>
                  <p className="text-blue-950 bg-white p-3 rounded-xl border border-blue-200 leading-relaxed font-bold shadow-2xs">
                    {lastScannedResult.rejectionReason}
                  </p>
                  <p className="text-[11px] text-blue-700 font-semibold">
                    Sistem menerapkan Aturan 1-Kali Scan Per Sesi (1x Sesi Masuk & 1x Sesi Pulang) untuk mencegah entri presensi ganda.
                  </p>
                </div>
              ) : lastScannedResult.isRejected ? (
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-rose-900 font-bold">
                    <span className="flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      Keterangan Penolakan Scan:
                    </span>
                    <span className="text-[10px] bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full font-black">
                      REJECTED
                    </span>
                  </div>
                  <p className="text-rose-800 bg-white p-3 rounded-xl border border-rose-200/80 leading-relaxed font-semibold">
                    {lastScannedResult.rejectionReason}
                  </p>
                  <p className="text-[11px] text-rose-600 font-medium">
                    Sistem menerapkan Aturan 1-Kali Scan Per Sesi (1x Sesi Masuk & 1x Sesi Pulang) untuk mencegah entri presensi ganda.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Presensi Berhasil Dicatat
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                      Tersimpan
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-emerald-100 space-y-2 shadow-2xs text-xs">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="text-slate-500 font-medium">Sesi Presensi:</span>
                      <span className="font-bold text-slate-900">
                        {lastScannedResult.mode === 'MASUK' ? 'Sesi Masuk Sekolah' : 'Sesi Pulang Sekolah'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="text-slate-500 font-medium">Waktu Tercatat:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {lastScannedResult.mode === 'MASUK' ? lastScannedResult.record.time : lastScannedResult.record.returnTime} WITA
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="text-slate-500 font-medium">Status Kehadiran:</span>
                      <span className="font-bold text-emerald-700">
                        {lastScannedResult.mode === 'MASUK' 
                          ? lastScannedResult.record.status 
                          : (lastScannedResult.record.returnStatus === 'PULANG_CEPAT' 
                              ? `PULANG LEBIH AWAL (Sebelum ${todayEndTimeStr} WITA)` 
                              : `PULANG TEPAT WAKTU (Jadwal ${todayEndTimeStr} WITA)`)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center space-y-3 flex flex-col items-center justify-center min-h-[300px] shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100">
                <User className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-slate-800 font-bold text-sm">Belum Ada Siswa Ditingkat Scan</h3>
              <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
                Hasil pindaian QR Code terbaru akan otomatis muncul di panel ini lengkap dengan foto profil, waktu presensi, dan status kehadiran.
              </p>
            </div>
          )}

          {/* Quick Tips & Jam Operasional Presensi */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-3xl text-xs text-slate-600 space-y-3 shadow-sm">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Aturan & Jam Operasional Presensi
            </h4>
            <div className="space-y-2.5 text-[11px] leading-relaxed">
              <div className="flex items-start gap-1.5 text-slate-700 font-medium">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <span>Hari Aktif Belajar: <strong className="text-slate-900">{activeDays.join(', ')}</strong></span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700 font-medium">
                <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Jam Masuk: <strong className="text-slate-900">{schoolProfile.startTime} WITA</strong> (Toleransi {schoolProfile.lateToleranceMinutes || 35} Menit • Batas Tepat Waktu: ≤ {getLateCutoffTime(schoolProfile)} WITA)
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700 font-medium">
                <Home className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Waktu Mulai Scan Pulang Hari Ini ({todayName}): <strong className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold">{todayEndTimeStr} WITA</strong>
                </span>
              </div>

              {/* Jadwal Jam Pulang Harian */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5 text-[10.5px]">
                <div className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Jadwal Jam Pulang Sekolah Sesuai Hari:</span>
                  <span className="text-emerald-700 font-extrabold text-[10px]">Hari Ini: {todayEndTimeStr} WITA</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center font-medium text-slate-600 pt-0.5">
                  {(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const).map(d => {
                    const isToday = d === todayName;
                    const dTime = getSchoolCheckoutTimeForDay(schoolProfile, d);
                    const isActive = activeDays.includes(d);
                    return (
                      <div
                        key={d}
                        className={`p-1 rounded-lg border text-[10px] ${
                          isToday
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-black ring-1 ring-emerald-400'
                            : isActive
                              ? 'bg-white border-slate-200 text-slate-700'
                              : 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                        }`}
                      >
                        <div className="font-semibold text-[9.5px]">{d}</div>
                        <div className="font-mono">{dTime}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-1.5 text-slate-700 font-medium">
                <Clock className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${schoolProfile.autoAlpaEnabled !== false ? 'text-rose-500' : 'text-slate-400'}`} />
                <span>
                  Batas Otomatis Alpa:{' '}
                  {schoolProfile.autoAlpaEnabled !== false ? (
                    <strong className="text-slate-900">{schoolProfile.autoAlpaTime || '08:30'} WITA (Aktif)</strong>
                  ) : (
                    <span className="text-slate-500 font-bold italic">Dinonaktifkan (Tidak Dibatasi)</span>
                  )}
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-700 font-medium bg-amber-50 p-2 rounded-xl border border-amber-200/70 text-[10.5px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-amber-900 font-semibold">
                  <strong>Aturan 1-Kali Scan Per Sesi:</strong> QR Code hanya dapat di-scan 1x untuk Sesi Scan Masuk dan 1x untuk Sesi Scan Pulang. Scan ulang dalam sesi yang sama akan ditolak.
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
