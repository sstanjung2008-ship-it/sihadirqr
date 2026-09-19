import { SchoolProfile, SchoolClass, Student, AttendanceRecord, LeaveRequest, WhatsAppLog, Teacher, LearningJournal, CharacterTrait, StudentCharacterLog, CharacterPredicateSettings, UserSession, StudentGradeAssessment, LessonPeriod, ClassScheduleSlot, DirectChatMessage } from '../types';
import { 
  INITIAL_SCHOOL_PROFILE, 
  INITIAL_CLASSES, 
  INITIAL_STUDENTS, 
  generateInitialAttendanceHistory, 
  INITIAL_LEAVE_REQUESTS, 
  INITIAL_WA_LOGS,
  INITIAL_TEACHERS,
  INITIAL_CHARACTER_TRAITS,
  INITIAL_STUDENT_CHARACTER_LOGS,
  INITIAL_LEARNING_JOURNALS,
  INITIAL_LESSON_PERIODS,
  INITIAL_CLASS_SCHEDULES
} from '../data/mockData';
import { db, doc, setDoc, getDoc, onSnapshot } from './firebase';

export const KEYS = {
  PROFILE: 'sihadir_school_profile_v2',
  CLASSES: 'sihadir_school_classes_v2',
  STUDENTS: 'sihadir_school_students_v2',
  ATTENDANCE: 'sihadir_attendance_records_v2',
  LEAVES: 'sihadir_leave_requests_v2',
  WA_LOGS: 'sihadir_wa_logs_v2',
  TEACHERS: 'sihadir_teachers_v2',
  LEARNING_JOURNALS: 'sihadir_learning_journals_v2',
  CHARACTER_TRAITS: 'sihadir_character_traits_v2',
  CHARACTER_LOGS: 'sihadir_character_logs_v2',
  CHARACTER_PREDICATES: 'sihadir_character_predicates_v2',
  GRADES: 'sihadir_student_grades_v2',
  PERIODS: 'sihadir_lesson_periods_v2',
  SCHEDULES: 'sihadir_class_schedules_v2',
  SESSION: 'sihadir_user_session_v2',
  DIRECT_CHATS: 'sihadir_parent_direct_chats_v2',
};

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'quota_exceeded';
let currentSyncStatus: CloudSyncStatus = 'syncing';
let isFirestoreInitialized = false;
const debounceTimers: Record<string, any> = {};
const lastSavedStringCache: Record<string, string> = {};

export function getCloudSyncStatus(): CloudSyncStatus {
  return currentSyncStatus;
}

const setCloudSyncStatus = (status: CloudSyncStatus) => {
  currentSyncStatus = status;
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('sihadir_cloud_status_changed', { detail: { status } }));
    }, 0);
  }
};

const notifyStorageUpdated = () => {
  setTimeout(() => {
    window.dispatchEvent(new Event('sihadir_storage_updated'));
  }, 0);
};

// Helper to prevent any promise from hanging indefinitely
function withTimeout<T>(promise: Promise<T>, ms: number = 6000, fallbackVal: T): Promise<T> {
  let timeoutHandle: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(fallbackVal), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timeoutHandle);
      return res;
    }).catch((err) => {
      clearTimeout(timeoutHandle);
      console.warn('[Cloud Storage Timeout/Error]:', err);
      return fallbackVal;
    }),
    timeoutPromise
  ]);
}

// Max chunk size per Firestore document: 450 KB (well below the 1MB Firestore threshold)
const FIRESTORE_MAX_CHUNK_SIZE = 450 * 1024;

export async function writeCloudDocument(key: string, dataStr: string, timestamp: number): Promise<void> {
  const totalLength = dataStr.length;
  if (totalLength <= FIRESTORE_MAX_CHUNK_SIZE) {
    // Normal single document
    const docRef = doc(db, 'sihadir_app_data', key);
    await withTimeout(
      setDoc(docRef, {
        data: dataStr,
        updatedAt: timestamp,
        isChunked: false,
        totalChunks: 1,
      }),
      6000,
      undefined
    );
  } else {
    // Multi-chunk document sharding
    const numChunks = Math.ceil(totalLength / FIRESTORE_MAX_CHUNK_SIZE);
    const chunks: string[] = [];
    for (let i = 0; i < numChunks; i++) {
      chunks.push(dataStr.slice(i * FIRESTORE_MAX_CHUNK_SIZE, (i + 1) * FIRESTORE_MAX_CHUNK_SIZE));
    }

    // Write chunks 1 to numChunks - 1 first in parallel with timeout
    const chunkPromises = [];
    for (let i = 1; i < numChunks; i++) {
      const chunkDocRef = doc(db, 'sihadir_app_data', `${key}_chunk_${i}`);
      chunkPromises.push(
        withTimeout(
          setDoc(chunkDocRef, {
            data: chunks[i],
            updatedAt: timestamp,
            chunkIndex: i,
            parentKey: key,
          }),
          6000,
          undefined
        )
      );
    }
    await Promise.all(chunkPromises);

    // Finally write the root document (chunk 0) which acts as the commit pointer
    const rootDocRef = doc(db, 'sihadir_app_data', key);
    await withTimeout(
      setDoc(rootDocRef, {
        data: chunks[0],
        updatedAt: timestamp,
        isChunked: true,
        totalChunks: numChunks,
      }),
      6000,
      undefined
    );
  }
}

export async function readCloudDocument(key: string): Promise<{ data: string; updatedAt: number } | null> {
  try {
    const rootDocRef = doc(db, 'sihadir_app_data', key);
    const snap = await withTimeout(getDoc(rootDocRef), 6000, null);
    if (!snap || !snap.exists()) return null;

    const payload = snap.data();
    if (!payload) return null;

    const updatedAt = Number(payload.updatedAt) || 0;
    const isChunked = !!payload.isChunked && Number(payload.totalChunks) > 1;

    if (!isChunked) {
      const dataStr = typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data || '');
      return { data: dataStr, updatedAt };
    }

    // Assemble chunked documents
    const totalChunks = Number(payload.totalChunks);
    const chunkPromises: Promise<string>[] = [];

    for (let i = 1; i < totalChunks; i++) {
      const chunkDocRef = doc(db, 'sihadir_app_data', `${key}_chunk_${i}`);
      chunkPromises.push(
        withTimeout(
          getDoc(chunkDocRef).then((cSnap) => {
            if (cSnap && cSnap.exists() && cSnap.data()?.data) {
              return String(cSnap.data().data);
            }
            return '';
          }),
          6000,
          ''
        )
      );
    }

    const otherChunks = await Promise.all(chunkPromises);
    const fullDataStr = (payload.data || '') + otherChunks.join('');
    return { data: fullDataStr, updatedAt };
  } catch (err) {
    console.error(`[Firestore Sync] Error reading cloud document for ${key}:`, err);
    return null;
  }
}

// Debounced and deduped push to Firestore with Auto-Chunking support
export function syncToCloud(key: string, data: any, instant: boolean = false, explicitTimestamp?: number) {
  if (typeof window === 'undefined') return;

  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Skip if data is identical to what is already stored in cloud
  if (lastSavedStringCache[key] === dataStr) {
    return;
  }

  // Clear previous debounce for this key
  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key]);
  }

  const doWrite = async () => {
    try {
      setCloudSyncStatus('syncing');
      const timestamp = explicitTimestamp || Number(localStorage.getItem(key + '_updatedAt')) || Date.now();
      await writeCloudDocument(key, dataStr, timestamp);
      lastSavedStringCache[key] = dataStr;
      setCloudSyncStatus('connected');
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota limit exceeded')) {
        console.warn('[Firestore Sync] Kuota gratis Firestore harian tercapai. Beralih ke penyimpanan lokal & fitur backup instan.');
        setCloudSyncStatus('quota_exceeded');
      } else {
        console.warn('[Firestore Sync] Error, menggunakan penyimpanan offline lokal:', errMsg);
        setCloudSyncStatus('offline');
      }
    }
  };

  // If instant or empty array (e.g. user cleared/deleted all students), push immediately
  if (instant || dataStr === '[]') {
    doWrite();
  } else {
    // Debounce by 1500ms to batch rapid interactions into 1 single Firestore write
    debounceTimers[key] = setTimeout(doWrite, 1500);
  }
}

// Complete Zero-Cloud Backup & Instant Restore (P2P Transfer)
export function exportAllDatabaseToJson(): string {
  const backupObject: Record<string, any> = {
    _app: 'SiHadirQR',
    _version: '2.0',
    _timestamp: Date.now(),
    _exportDate: new Date().toISOString(),
    profile: getSchoolProfile(),
    classes: getSchoolClasses(),
    students: getStudents(),
    attendance: getAttendanceRecords(),
    leaves: getLeaveRequests(),
    waLogs: getWaLogs(),
    teachers: getTeachers(),
    learningJournals: getLearningJournals(),
    characterTraits: getCharacterTraits(),
    characterLogs: getStudentCharacterLogs(),
    characterPredicates: getCharacterPredicateSettings(),
    grades: getStudentGradeAssessments(),
    periods: getLessonPeriods(),
    schedules: getClassSchedules(),
    directChats: getDirectChats(),
  };
  return JSON.stringify(backupObject, null, 2);
}

/**
 * Safely formats a Date or timestamp or date string into local YYYY-MM-DD (avoiding UTC offset bugs)
 */
export function getLocalDateString(dateInput: Date | number | string = new Date()): string {
  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      d = new Date(dateInput);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = new Date();
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function downloadDatabaseBackupFile(): void {
  const jsonStr = exportAllDatabaseToJson();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = getLocalDateString();
  const studentsCount = getStudents().length;
  a.href = url;
  a.download = `SiHadirQR_Backup_${studentsCount}_Siswa_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importAllDatabaseFromJson(jsonString: string): { success: boolean; studentCount: number; message: string } {
  try {
    const data = JSON.parse(jsonString);
    if (!data || (!data.students && !data.classes)) {
      return { success: false, studentCount: 0, message: 'Format file cadangan tidak valid.' };
    }

    const now = Date.now();
    const setKey = (k: string, val: any) => {
      if (val !== undefined) {
        const str = JSON.stringify(val);
        localStorage.setItem(k, str);
        localStorage.setItem(k + '_updatedAt', String(now));
        lastSavedStringCache[k] = str;
      }
    };

    if (data.profile) setKey(KEYS.PROFILE, data.profile);
    if (data.classes) setKey(KEYS.CLASSES, data.classes);
    if (data.students) setKey(KEYS.STUDENTS, data.students);
    if (data.attendance) setKey(KEYS.ATTENDANCE, data.attendance);
    if (data.leaves) setKey(KEYS.LEAVES, data.leaves);
    if (data.waLogs) setKey(KEYS.WA_LOGS, data.waLogs);
    if (data.teachers) setKey(KEYS.TEACHERS, data.teachers);
    if (data.learningJournals) setKey(KEYS.LEARNING_JOURNALS, data.learningJournals);
    if (data.characterTraits) setKey(KEYS.CHARACTER_TRAITS, data.characterTraits);
    if (data.characterLogs) setKey(KEYS.CHARACTER_LOGS, data.characterLogs);
    if (data.characterPredicates) setKey(KEYS.CHARACTER_PREDICATES, data.characterPredicates);
    if (data.grades) setKey(KEYS.GRADES, data.grades);
    if (data.periods) setKey(KEYS.PERIODS, data.periods);
    if (data.schedules) setKey(KEYS.SCHEDULES, data.schedules);
    if (data.directChats) setKey(KEYS.DIRECT_CHATS, data.directChats);

    const totalStudents = (data.students && Array.isArray(data.students)) ? data.students.length : getStudents().length;

    notifyStorageUpdated();

    // Trigger background cloud sync if available
    forceUploadAllToCloud().catch(() => {});

    return {
      success: true,
      studentCount: totalStudents,
      message: `Berhasil memulihkan ${totalStudents} data siswa dan seluruh data sekolah!`,
    };
  } catch (err: any) {
    return {
      success: false,
      studentCount: 0,
      message: `Gagal memulihkan cadangan: ${err?.message || 'File rusak atau tidak valid'}`,
    };
  }
}

// High-efficiency Image Compressor for Student Photos & Cross-Device Cloud Sync
export function compressBase64Image(
  dataUrl: string,
  maxWidth = 200,
  maxHeight = 267,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:') || dataUrl.length < 15000) {
      return resolve(dataUrl);
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve(dataUrl);
    }

    // Safety timeout to prevent hanging on corrupted or slow base64 images
    const safetyTimer = setTimeout(() => {
      resolve(dataUrl);
    }, 1000);

    try {
      const img = new Image();
      img.onload = () => {
        clearTimeout(safetyTimer);
        try {
          let w = img.width;
          let h = img.height;
          if (w <= 0 || h <= 0) return resolve(dataUrl);

          if (w > maxWidth || h > maxHeight) {
            const ratio = Math.min(maxWidth / w, maxHeight / h);
            w = Math.max(1, Math.round(w * ratio));
            h = Math.max(1, Math.round(h * ratio));
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(dataUrl);

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => {
        clearTimeout(safetyTimer);
        resolve(dataUrl);
      };
      img.src = dataUrl;
    } catch {
      clearTimeout(safetyTimer);
      resolve(dataUrl);
    }
  });
}

// Background sanitizer to auto-compress any oversized student photos (>18KB)
export async function sanitizeAndCompressStudentPhotos(students: Student[]): Promise<Student[]> {
  let hasChanges = false;
  const updated = await Promise.all(
    students.map(async (std) => {
      if (std.photoUrl && std.photoUrl.startsWith('data:') && std.photoUrl.length > 18000) {
        try {
          const compressed = await compressBase64Image(std.photoUrl, 200, 267, 0.65);
          if (compressed.length < std.photoUrl.length) {
            hasChanges = true;
            return { ...std, photoUrl: compressed };
          }
        } catch (e) {
          console.warn('[Photo Compress Error]:', e);
        }
      }
      return std;
    })
  );
  return hasChanges ? updated : students;
}

// Intelligent entity mergers to ensure no data is lost across multiple devices
export function mergeStudentLists(local: Student[], cloud: Student[]): Student[] {
  const map = new Map<string, Student>();
  
  // 1. Index cloud items
  cloud.forEach(s => {
    const key = (s.nisn && s.nisn.trim()) || (s.nis && s.nis.trim()) || s.id;
    if (key) map.set(key, { ...s });
  });

  // 2. Merge local items
  local.forEach(localItem => {
    const key = (localItem.nisn && localItem.nisn.trim()) || (localItem.nis && localItem.nis.trim()) || localItem.id;
    if (!key) return;

    if (map.has(key)) {
      const cloudItem = map.get(key)!;
      
      // Determine best photo:
      // A photo is considered real/custom if it is not empty and not a generic unsplash placeholder
      const isCloudRealPhoto = !!cloudItem.photoUrl && !cloudItem.photoUrl.includes('unsplash.com');
      const isLocalRealPhoto = !!localItem.photoUrl && !localItem.photoUrl.includes('unsplash.com');
      
      let bestPhoto = cloudItem.photoUrl || localItem.photoUrl;
      if (isCloudRealPhoto && !isLocalRealPhoto) {
        bestPhoto = cloudItem.photoUrl;
      } else if (!isCloudRealPhoto && isLocalRealPhoto) {
        bestPhoto = localItem.photoUrl;
      } else if (isCloudRealPhoto && isLocalRealPhoto) {
        bestPhoto = cloudItem.photoUrl || localItem.photoUrl;
      }

      // Preserve custom password across devices:
      // A custom password (defined, non-empty, and !== '123456') must never be wiped out by default/undefined values
      const isCloudCustomPass = !!cloudItem.password && cloudItem.password !== '123456';
      const isLocalCustomPass = !!localItem.password && localItem.password !== '123456';
      
      let bestPassword = cloudItem.password || localItem.password;
      if (isCloudCustomPass) {
        bestPassword = cloudItem.password;
      } else if (isLocalCustomPass) {
        bestPassword = localItem.password;
      }

      // Merge other properties gracefully
      const merged: Student = {
        ...localItem,
        ...cloudItem,
        name: cloudItem.name || localItem.name,
        className: cloudItem.className || localItem.className,
        classId: cloudItem.classId || localItem.classId,
        parentName: cloudItem.parentName || localItem.parentName,
        parentPhone: cloudItem.parentPhone || localItem.parentPhone,
        address: cloudItem.address || localItem.address,
        birthPlaceDate: cloudItem.birthPlaceDate || localItem.birthPlaceDate,
        qrCode: cloudItem.qrCode || localItem.qrCode || `STUDENT-${localItem.nisn}`,
        photoUrl: bestPhoto,
        password: bestPassword,
      };

      map.set(key, merged);
    } else {
      map.set(key, { ...localItem });
    }
  });

  return Array.from(map.values());
}

export function mergeClassLists(local: SchoolClass[], cloud: SchoolClass[]): SchoolClass[] {
  const map = new Map<string, SchoolClass>();
  cloud.forEach(c => map.set(c.id || c.name.toLowerCase().trim(), c));
  local.forEach(c => map.set(c.id || c.name.toLowerCase().trim(), c));
  return Array.from(map.values());
}

export function mergeTeacherLists(local: Teacher[], cloud: Teacher[]): Teacher[] {
  const map = new Map<string, Teacher>();
  
  // 1. Index cloud teachers
  cloud.forEach(t => {
    const key = (t.nip && t.nip.trim()) || t.id;
    if (key) map.set(key, { ...t });
  });

  // 2. Merge local teachers preserving custom passwords & photos across devices
  local.forEach(localItem => {
    const key = (localItem.nip && localItem.nip.trim()) || localItem.id;
    if (!key) return;

    if (map.has(key)) {
      const cloudItem = map.get(key)!;

      // Preserve custom password:
      // If either cloud or local has a custom password, prioritize it so it never reverts to default on device sync
      const isCloudCustomPass = !!cloudItem.password && cloudItem.password !== '123456';
      const isLocalCustomPass = !!localItem.password && localItem.password !== '123456';

      let bestPassword = cloudItem.password || localItem.password;
      if (isCloudCustomPass) {
        bestPassword = cloudItem.password;
      } else if (isLocalCustomPass) {
        bestPassword = localItem.password;
      }

      // Determine best photo
      const isCloudRealPhoto = !!cloudItem.photoUrl && !cloudItem.photoUrl.includes('unsplash.com');
      const isLocalRealPhoto = !!localItem.photoUrl && !localItem.photoUrl.includes('unsplash.com');
      let bestPhoto = cloudItem.photoUrl || localItem.photoUrl;
      if (isCloudRealPhoto && !isLocalRealPhoto) {
        bestPhoto = cloudItem.photoUrl;
      } else if (!isCloudRealPhoto && isLocalRealPhoto) {
        bestPhoto = localItem.photoUrl;
      }

      const merged: Teacher = {
        ...localItem,
        ...cloudItem,
        name: cloudItem.name || localItem.name,
        nip: cloudItem.nip || localItem.nip,
        phone: cloudItem.phone || localItem.phone,
        email: cloudItem.email || localItem.email,
        subject1: cloudItem.subject1 || localItem.subject1,
        subject2: cloudItem.subject2 !== undefined ? cloudItem.subject2 : localItem.subject2,
        additionalDuty: cloudItem.additionalDuty || localItem.additionalDuty,
        homeroomClassId: cloudItem.homeroomClassId !== undefined ? cloudItem.homeroomClassId : localItem.homeroomClassId,
        homeroomClassName: cloudItem.homeroomClassName !== undefined ? cloudItem.homeroomClassName : localItem.homeroomClassName,
        photoUrl: bestPhoto,
        password: bestPassword,
      };

      map.set(key, merged);
    } else {
      map.set(key, { ...localItem });
    }
  });

  return Array.from(map.values());
}

/**
 * Synchronizes Homeroom Teacher (Wali Kelas) data between School Classes and Teachers.
 * Ensures that teacher duties and homeroom class assignments match the real data from Kelola Kelas.
 */
export function reconcileTeachersAndClasses(
  teachers: Teacher[],
  classes: SchoolClass[]
): { updatedTeachers: Teacher[]; updatedClasses: SchoolClass[]; teachersChanged: boolean; classesChanged: boolean } {
  let teachersChanged = false;
  let classesChanged = false;

  const classesCopy: SchoolClass[] = classes.map(c => ({ ...c }));
  
  // Index classes by id and by homeroomTeacher name
  const classByIdMap = new Map<string, SchoolClass>();
  const classByTeacherNameMap = new Map<string, SchoolClass>();

  classesCopy.forEach(c => {
    classByIdMap.set(c.id, c);
    if (c.homeroomTeacher && c.homeroomTeacher.trim() && c.homeroomTeacher !== 'Belum Ditentukan') {
      classByTeacherNameMap.set(c.homeroomTeacher.trim().toLowerCase(), c);
    }
  });

  const updatedTeachers: Teacher[] = teachers.map(teacher => {
    const teacherNameKey = (teacher.name || '').trim().toLowerCase();
    const assignedClass = classByTeacherNameMap.get(teacherNameKey);

    if (assignedClass) {
      // Teacher is assigned as homeroom teacher in assignedClass
      const newClassId = assignedClass.id;
      const newClassName = assignedClass.name;
      const newDuty = (teacher.additionalDuty && teacher.additionalDuty !== 'TIDAK_ADA' && teacher.additionalDuty !== 'WALI_KELAS')
        ? teacher.additionalDuty
        : 'WALI_KELAS';

      if (
        teacher.homeroomClassId !== newClassId ||
        teacher.homeroomClassName !== newClassName ||
        (teacher.additionalDuty !== 'WALI_KELAS' && teacher.additionalDuty !== 'WAKIL_KEPALA_SEKOLAH')
      ) {
        teachersChanged = true;
        return {
          ...teacher,
          additionalDuty: newDuty,
          homeroomClassId: newClassId,
          homeroomClassName: newClassName,
        };
      }
      return teacher;
    } else {
      // Teacher is not named in class.homeroomTeacher
      // Check if teacher has a valid homeroomClassId pointing to a class that has 'Belum Ditentukan'
      if (teacher.homeroomClassId && classByIdMap.has(teacher.homeroomClassId)) {
        const targetClass = classByIdMap.get(teacher.homeroomClassId)!;
        if (!targetClass.homeroomTeacher || targetClass.homeroomTeacher === 'Belum Ditentukan') {
          targetClass.homeroomTeacher = teacher.name;
          classesChanged = true;
          classByTeacherNameMap.set(teacherNameKey, targetClass);
          return teacher;
        }
      }

      // If teacher was marked as WALI_KELAS or still has homeroomClassId but no class assigned, clean up
      if (teacher.additionalDuty === 'WALI_KELAS' || teacher.homeroomClassId || teacher.homeroomClassName) {
        teachersChanged = true;
        return {
          ...teacher,
          additionalDuty: teacher.additionalDuty === 'WALI_KELAS' ? 'TIDAK_ADA' : teacher.additionalDuty,
          homeroomClassId: undefined,
          homeroomClassName: undefined,
        };
      }
      return teacher;
    }
  });

  return {
    updatedTeachers,
    updatedClasses: classesCopy,
    teachersChanged,
    classesChanged
  };
}

export function mergeAttendanceLists(local: AttendanceRecord[], cloud: AttendanceRecord[]): AttendanceRecord[] {
  const map = new Map<string, AttendanceRecord>();

  const mergeSingleRecord = (existing: AttendanceRecord, incoming: AttendanceRecord): AttendanceRecord => {
    // If incoming is QR_SCAN / TERLAMBAT / HADIR / SAKIT / IZIN and existing is auto-alpa, incoming wins
    const isExistingReal = existing.status !== 'ALPA' || existing.method === 'QR_SCAN' || (existing.time && existing.time !== '-');
    const isIncomingReal = incoming.status !== 'ALPA' || incoming.method === 'QR_SCAN' || (incoming.time && incoming.time !== '-');

    let base: AttendanceRecord;
    if (isIncomingReal && !isExistingReal) {
      base = { ...incoming };
    } else if (!isIncomingReal && isExistingReal) {
      base = { ...existing };
    } else {
      // Both are real or both are alpa -> prefer incoming, but preserve important details
      base = { ...existing, ...incoming };
    }

    // Always preserve returnTime if either has it
    if (!base.returnTime && (existing.returnTime || incoming.returnTime)) {
      base.returnTime = existing.returnTime || incoming.returnTime;
      base.returnStatus = existing.returnStatus || incoming.returnStatus;
      base.returnScannedBy = existing.returnScannedBy || incoming.returnScannedBy;
    }
    // Always preserve entry time if base has '-' or missing but one had it
    if ((!base.time || base.time === '-') && (existing.time && existing.time !== '-')) {
      base.time = existing.time;
    } else if ((!base.time || base.time === '-') && (incoming.time && incoming.time !== '-')) {
      base.time = incoming.time;
    }

    return base;
  };

  cloud.forEach(a => map.set(`${a.studentId}_${a.date}`, a));
  local.forEach(a => {
    const key = `${a.studentId}_${a.date}`;
    if (map.has(key)) {
      map.set(key, mergeSingleRecord(map.get(key)!, a));
    } else {
      map.set(key, a);
    }
  });

  return Array.from(map.values()).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
}

export function mergeGenericListsById<T extends { id: string }>(local: T[], cloud: T[]): T[] {
  const map = new Map<string, T>();
  cloud.forEach(item => map.set(item.id, item));
  local.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
}

// Merge SchoolProfile ensuring all subjects from both devices are preserved (union)
export function mergeSchoolProfile(local: SchoolProfile, cloud: SchoolProfile): SchoolProfile {
  const subjectsSet = new Set<string>();

  // Collect subjects from cloud
  if (cloud.subjects && Array.isArray(cloud.subjects)) {
    cloud.subjects.forEach(s => {
      if (s && typeof s === 'string' && s.trim()) {
        subjectsSet.add(s.trim());
      }
    });
  }

  // Collect subjects from local
  if (local.subjects && Array.isArray(local.subjects)) {
    local.subjects.forEach(s => {
      if (s && typeof s === 'string' && s.trim()) {
        subjectsSet.add(s.trim());
      }
    });
  }

  // Default fallback if no subjects exist
  if (subjectsSet.size === 0) {
    (INITIAL_SCHOOL_PROFILE.subjects || ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PJOK', 'Seni Budaya', 'Informatika', 'PPKn']).forEach(s => subjectsSet.add(s));
  }

  const mergedSubjects = Array.from(subjectsSet);

  return {
    ...INITIAL_SCHOOL_PROFILE,
    ...local,
    ...cloud,
    adminPassword: cloud.adminPassword || local.adminPassword || INITIAL_SCHOOL_PROFILE.adminPassword || 'admin123',
    scannerPassword: cloud.scannerPassword || local.scannerPassword || INITIAL_SCHOOL_PROFILE.scannerPassword || '123456',
    subjects: mergedSubjects,
    holidays: (cloud.holidays && Array.isArray(cloud.holidays) && cloud.holidays.length > 0) ? cloud.holidays : (local.holidays || []),
    activeDays: (cloud.activeDays && Array.isArray(cloud.activeDays) && cloud.activeDays.length > 0) ? cloud.activeDays : (local.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']),
    startTime: cloud.startTime || local.startTime || INITIAL_SCHOOL_PROFILE.startTime,
    endTime: cloud.endTime || local.endTime || INITIAL_SCHOOL_PROFILE.endTime,
    dailyEndTimes: {
      ...(INITIAL_SCHOOL_PROFILE.dailyEndTimes || {}),
      ...(local.dailyEndTimes || {}),
      ...(cloud.dailyEndTimes || {})
    },
    autoAlpaTime: cloud.autoAlpaTime || local.autoAlpaTime || INITIAL_SCHOOL_PROFILE.autoAlpaTime,
    autoAlpaEnabled: typeof cloud.autoAlpaEnabled === 'boolean'
      ? cloud.autoAlpaEnabled
      : (typeof local.autoAlpaEnabled === 'boolean' ? local.autoAlpaEnabled : (INITIAL_SCHOOL_PROFILE.autoAlpaEnabled !== false)),
    autoCharacterAssessmentEnabled: typeof cloud.autoCharacterAssessmentEnabled === 'boolean'
      ? cloud.autoCharacterAssessmentEnabled
      : (typeof local.autoCharacterAssessmentEnabled === 'boolean' ? local.autoCharacterAssessmentEnabled : (INITIAL_SCHOOL_PROFILE.autoCharacterAssessmentEnabled !== false)),
    autoCharacterPoints: {
      ...(INITIAL_SCHOOL_PROFILE.autoCharacterPoints || {
        latePoints: 2,
        alpaPoints: 5,
        disruptivePoints: 1,
        absentKbmPoints: 2,
        veryActiveKbmPoints: 1,
        onTimePoints: 1,
        onTimeRequiredDays: 3,
      }),
      ...(local.autoCharacterPoints || {}),
      ...(cloud.autoCharacterPoints || {}),
    },
    lateToleranceMinutes: typeof cloud.lateToleranceMinutes === 'number' ? cloud.lateToleranceMinutes : (typeof local.lateToleranceMinutes === 'number' ? local.lateToleranceMinutes : (INITIAL_SCHOOL_PROFILE.lateToleranceMinutes ?? 15)),
  };
}

// Comprehensive multi-device smart synchronization (Concurrent & High-Speed)
export async function smartSyncAndMergeAllWithCloud(): Promise<{ success: boolean; studentCount: number; message: string }> {
  try {
    setCloudSyncStatus('syncing');

    // 1. Fetch all cloud documents simultaneously with timeout protection (under 3s)
    const [
      profileCloud,
      studentCloud,
      classCloud,
      teacherCloud,
      attCloud,
      leavesCloud,
      waLogsCloud,
      journalsCloud,
      traitsCloud,
      logsCloud,
      predicatesCloud,
      gradesCloud,
      periodsCloud,
      schedulesCloud,
    ] = await Promise.all([
      readCloudDocument(KEYS.PROFILE),
      readCloudDocument(KEYS.STUDENTS),
      readCloudDocument(KEYS.CLASSES),
      readCloudDocument(KEYS.TEACHERS),
      readCloudDocument(KEYS.ATTENDANCE),
      readCloudDocument(KEYS.LEAVES),
      readCloudDocument(KEYS.WA_LOGS),
      readCloudDocument(KEYS.LEARNING_JOURNALS),
      readCloudDocument(KEYS.CHARACTER_TRAITS),
      readCloudDocument(KEYS.CHARACTER_LOGS),
      readCloudDocument(KEYS.CHARACTER_PREDICATES),
      readCloudDocument(KEYS.GRADES),
      readCloudDocument(KEYS.PERIODS),
      readCloudDocument(KEYS.SCHEDULES),
    ]);

    const now = Date.now();

    // 2. In-Memory Merging - Step A: Profile
    const currentLocalProfile = getSchoolProfile();
    let mergedProfile = currentLocalProfile;
    if (profileCloud && profileCloud.data) {
      try {
        const cloudProfileData = typeof profileCloud.data === 'string' ? JSON.parse(profileCloud.data) : profileCloud.data;
        mergedProfile = mergeSchoolProfile(currentLocalProfile, cloudProfileData);
      } catch (e) {
        console.warn('[Sync] Profile parse error:', e);
      }
    }
    const profileStr = JSON.stringify(mergedProfile);
    localStorage.setItem(KEYS.PROFILE, profileStr);
    localStorage.setItem(KEYS.PROFILE + '_updatedAt', String(now));

    // Step B: Students & Photo Sanitization
    let cloudStudents: Student[] = [];
    if (studentCloud && studentCloud.data) {
      try {
        cloudStudents = JSON.parse(studentCloud.data);
      } catch (e) {
        console.warn('[Sync] Student parse error:', e);
      }
    }
    const currentLocalStudents = getStudents();
    const mergedStudents = mergeStudentLists(currentLocalStudents, cloudStudents);
    const optimizedStudents = await sanitizeAndCompressStudentPhotos(mergedStudents);
    const studentsJsonStr = JSON.stringify(optimizedStudents);
    localStorage.setItem(KEYS.STUDENTS, studentsJsonStr);
    localStorage.setItem(KEYS.STUDENTS + '_updatedAt', String(now));

    // Step C: Classes & Teachers
    let cloudClasses: SchoolClass[] = [];
    if (classCloud && classCloud.data) {
      try {
        cloudClasses = JSON.parse(classCloud.data);
      } catch {}
    }
    const currentLocalClasses = getSchoolClasses();
    const mergedClasses = mergeClassLists(currentLocalClasses, cloudClasses);

    let cloudTeachers: Teacher[] = [];
    if (teacherCloud && teacherCloud.data) {
      try {
        cloudTeachers = JSON.parse(teacherCloud.data);
      } catch {}
    }
    const currentLocalTeachers = getTeachers();
    const mergedTeachers = mergeTeacherLists(currentLocalTeachers, cloudTeachers);

    const reconciled = reconcileTeachersAndClasses(mergedTeachers, mergedClasses);
    const finalClasses = reconciled.updatedClasses;
    const finalTeachers = reconciled.updatedTeachers;

    const classesJsonStr = JSON.stringify(finalClasses);
    const teachersJsonStr = JSON.stringify(finalTeachers);
    localStorage.setItem(KEYS.CLASSES, classesJsonStr);
    localStorage.setItem(KEYS.CLASSES + '_updatedAt', String(now));
    localStorage.setItem(KEYS.TEACHERS, teachersJsonStr);
    localStorage.setItem(KEYS.TEACHERS + '_updatedAt', String(now));

    // Step D: Attendance Records
    let cloudAtt: AttendanceRecord[] = [];
    if (attCloud && attCloud.data) {
      try {
        cloudAtt = JSON.parse(attCloud.data);
      } catch {}
    }
    const currentLocalAtt = getAttendanceRecords();
    const mergedAtt = mergeAttendanceLists(currentLocalAtt, cloudAtt);
    const attJsonStr = JSON.stringify(mergedAtt);
    localStorage.setItem(KEYS.ATTENDANCE, attJsonStr);
    localStorage.setItem(KEYS.ATTENDANCE + '_updatedAt', String(now));

    // Step E: Generic Entity Merging
    const mergeAndStoreGeneric = (key: string, cloudDoc: any, getLocal: () => any[]) => {
      let cloudItems: any[] = [];
      if (cloudDoc && cloudDoc.data) {
        try {
          cloudItems = JSON.parse(cloudDoc.data);
        } catch {}
      }
      const localItems = getLocal();
      const merged = mergeGenericListsById(localItems, cloudItems);
      const jsonStr = JSON.stringify(merged);
      localStorage.setItem(key, jsonStr);
      localStorage.setItem(key + '_updatedAt', String(now));
      return jsonStr;
    };

    const leavesJsonStr = mergeAndStoreGeneric(KEYS.LEAVES, leavesCloud, getLeaveRequests);
    const waLogsJsonStr = mergeAndStoreGeneric(KEYS.WA_LOGS, waLogsCloud, getWaLogs);
    const journalsJsonStr = mergeAndStoreGeneric(KEYS.LEARNING_JOURNALS, journalsCloud, getLearningJournals);
    const traitsJsonStr = mergeAndStoreGeneric(KEYS.CHARACTER_TRAITS, traitsCloud, getCharacterTraits);
    const logsJsonStr = mergeAndStoreGeneric(KEYS.CHARACTER_LOGS, logsCloud, getStudentCharacterLogs);
    const gradesJsonStr = mergeAndStoreGeneric(KEYS.GRADES, gradesCloud, getStudentGradeAssessments);
    const periodsJsonStr = mergeAndStoreGeneric(KEYS.PERIODS, periodsCloud, getLessonPeriods);
    const schedulesJsonStr = mergeAndStoreGeneric(KEYS.SCHEDULES, schedulesCloud, getClassSchedules);

    let cloudPredicates = null;
    if (predicatesCloud && predicatesCloud.data) {
      try {
        cloudPredicates = typeof predicatesCloud.data === 'string' ? JSON.parse(predicatesCloud.data) : predicatesCloud.data;
      } catch {}
    }
    const localPredicates = getCharacterPredicateSettings();
    const mergedPredicates = { ...INITIAL_CHARACTER_PREDICATES, ...localPredicates, ...(cloudPredicates || {}) };
    const predicatesJsonStr = JSON.stringify(mergedPredicates);
    localStorage.setItem(KEYS.CHARACTER_PREDICATES, predicatesJsonStr);
    localStorage.setItem(KEYS.CHARACTER_PREDICATES + '_updatedAt', String(now));

    // Update local cache & notify UI instantly
    lastSavedStringCache[KEYS.PROFILE] = profileStr;
    lastSavedStringCache[KEYS.STUDENTS] = studentsJsonStr;
    lastSavedStringCache[KEYS.CLASSES] = classesJsonStr;
    lastSavedStringCache[KEYS.TEACHERS] = teachersJsonStr;
    lastSavedStringCache[KEYS.ATTENDANCE] = attJsonStr;
    lastSavedStringCache[KEYS.LEAVES] = leavesJsonStr;
    lastSavedStringCache[KEYS.WA_LOGS] = waLogsJsonStr;
    lastSavedStringCache[KEYS.LEARNING_JOURNALS] = journalsJsonStr;
    lastSavedStringCache[KEYS.CHARACTER_TRAITS] = traitsJsonStr;
    lastSavedStringCache[KEYS.CHARACTER_LOGS] = logsJsonStr;
    lastSavedStringCache[KEYS.CHARACTER_PREDICATES] = predicatesJsonStr;
    lastSavedStringCache[KEYS.GRADES] = gradesJsonStr;
    lastSavedStringCache[KEYS.PERIODS] = periodsJsonStr;
    lastSavedStringCache[KEYS.SCHEDULES] = schedulesJsonStr;

    notifyStorageUpdated();

    // 3. Concurrently Push All Merged Data Back to Cloud
    await Promise.allSettled([
      writeCloudDocument(KEYS.PROFILE, profileStr, now),
      writeCloudDocument(KEYS.STUDENTS, studentsJsonStr, now),
      writeCloudDocument(KEYS.CLASSES, classesJsonStr, now),
      writeCloudDocument(KEYS.TEACHERS, teachersJsonStr, now),
      writeCloudDocument(KEYS.ATTENDANCE, attJsonStr, now),
      writeCloudDocument(KEYS.LEAVES, leavesJsonStr, now),
      writeCloudDocument(KEYS.WA_LOGS, waLogsJsonStr, now),
      writeCloudDocument(KEYS.LEARNING_JOURNALS, journalsJsonStr, now),
      writeCloudDocument(KEYS.CHARACTER_TRAITS, traitsJsonStr, now),
      writeCloudDocument(KEYS.CHARACTER_LOGS, logsJsonStr, now),
      writeCloudDocument(KEYS.CHARACTER_PREDICATES, predicatesJsonStr, now),
      writeCloudDocument(KEYS.GRADES, gradesJsonStr, now),
      writeCloudDocument(KEYS.PERIODS, periodsJsonStr, now),
      writeCloudDocument(KEYS.SCHEDULES, schedulesJsonStr, now),
    ]);

    setCloudSyncStatus('connected');

    return {
      success: true,
      studentCount: optimizedStudents.length,
      message: `Berhasil menyinkronkan! Total ${optimizedStudents.length} siswa dan seluruh data sekolah sekarang tersinkron di Cloud dan semua perangkat.`
    };
  } catch (err: any) {
    console.error('[Smart Sync Error]:', err);
    setCloudSyncStatus('offline');
    return {
      success: false,
      studentCount: getStudents().length,
      message: `Gagal sinkronisasi: ${err?.message || 'Periksa koneksi internet.'}`
    };
  }
}

// Upload all local data to Cloud database (Parallelized)
export async function forceUploadAllToCloud(): Promise<{ success: boolean; error?: string }> {
  try {
    setCloudSyncStatus('syncing');
    const ALL_KEYS = [
      KEYS.PROFILE,
      KEYS.CLASSES,
      KEYS.STUDENTS,
      KEYS.ATTENDANCE,
      KEYS.LEAVES,
      KEYS.WA_LOGS,
      KEYS.TEACHERS,
      KEYS.LEARNING_JOURNALS,
      KEYS.CHARACTER_TRAITS,
      KEYS.CHARACTER_LOGS,
      KEYS.CHARACTER_PREDICATES,
      KEYS.GRADES,
      KEYS.PERIODS,
      KEYS.SCHEDULES,
    ];

    const now = Date.now();
    const writePromises = ALL_KEYS.map((key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        lastSavedStringCache[key] = raw;
        return writeCloudDocument(key, raw, now);
      }
      return Promise.resolve();
    });

    await Promise.allSettled(writePromises);
    setCloudSyncStatus('connected');
    return { success: true };
  } catch (err: any) {
    console.error('[Force Upload Cloud Error]', err);
    setCloudSyncStatus('offline');
    return { success: false, error: err?.message || 'Gagal mengunggah ke Cloud' };
  }
}

// Download latest data from Cloud database (Parallelized)
export async function forceDownloadAllFromCloud(): Promise<{ success: boolean; error?: string }> {
  try {
    setCloudSyncStatus('syncing');
    const ALL_KEYS = [
      KEYS.PROFILE,
      KEYS.CLASSES,
      KEYS.STUDENTS,
      KEYS.ATTENDANCE,
      KEYS.LEAVES,
      KEYS.WA_LOGS,
      KEYS.TEACHERS,
      KEYS.LEARNING_JOURNALS,
      KEYS.CHARACTER_TRAITS,
      KEYS.CHARACTER_LOGS,
      KEYS.CHARACTER_PREDICATES,
      KEYS.GRADES,
      KEYS.PERIODS,
      KEYS.SCHEDULES,
    ];

    const results = await Promise.all(ALL_KEYS.map((key) => readCloudDocument(key)));
    let updatedCount = 0;

    results.forEach((cloudDoc, idx) => {
      const key = ALL_KEYS[idx];
      if (cloudDoc && cloudDoc.data) {
        if (key === KEYS.PROFILE) {
          try {
            const cloudP = JSON.parse(cloudDoc.data);
            const localP = getSchoolProfile();
            const mergedP = mergeSchoolProfile(localP, cloudP);
            const mergedStr = JSON.stringify(mergedP);
            localStorage.setItem(key, mergedStr);
            localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = mergedStr;
          } catch {
            localStorage.setItem(key, cloudDoc.data);
            localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = cloudDoc.data;
          }
        } else if (key === KEYS.TEACHERS) {
          try {
            const cloudTeachers = JSON.parse(cloudDoc.data);
            if (Array.isArray(cloudTeachers)) {
              const localTeachers = getTeachers();
              const mergedTeachers = mergeTeacherLists(localTeachers, cloudTeachers);
              const mergedStr = JSON.stringify(mergedTeachers);
              localStorage.setItem(key, mergedStr);
              localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = mergedStr;
            } else {
              localStorage.setItem(key, cloudDoc.data);
              localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = cloudDoc.data;
            }
          } catch {
            localStorage.setItem(key, cloudDoc.data);
            localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = cloudDoc.data;
          }
        } else if (key === KEYS.STUDENTS) {
          try {
            const cloudStudents = JSON.parse(cloudDoc.data);
            if (Array.isArray(cloudStudents)) {
              const localStudents = getStudents();
              const mergedStudents = mergeStudentLists(localStudents, cloudStudents);
              const mergedStr = JSON.stringify(mergedStudents);
              localStorage.setItem(key, mergedStr);
              localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = mergedStr;
            } else {
              localStorage.setItem(key, cloudDoc.data);
              localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
              lastSavedStringCache[key] = cloudDoc.data;
            }
          } catch {
            localStorage.setItem(key, cloudDoc.data);
            localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
            lastSavedStringCache[key] = cloudDoc.data;
          }
        } else {
          localStorage.setItem(key, cloudDoc.data);
          localStorage.setItem(key + '_updatedAt', String(cloudDoc.updatedAt || Date.now()));
          lastSavedStringCache[key] = cloudDoc.data;
        }
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      notifyStorageUpdated();
    }
    setCloudSyncStatus('connected');
    return { success: true };
  } catch (err: any) {
    console.error('[Force Download Cloud Error]', err);
    setCloudSyncStatus('offline');
    return { success: false, error: err?.message || 'Gagal mengunduh dari Cloud' };
  }
}

// Initialize Realtime Sync from Firestore
export function initFirestoreRealtimeSync() {
  if (isFirestoreInitialized || typeof window === 'undefined') return;
  isFirestoreInitialized = true;

  const SYNC_KEYS: Array<{ 
    key: string; 
    getDefault: () => any;
  }> = [
    { key: KEYS.PROFILE, getDefault: () => INITIAL_SCHOOL_PROFILE },
    { key: KEYS.CLASSES, getDefault: () => INITIAL_CLASSES },
    { key: KEYS.STUDENTS, getDefault: () => INITIAL_STUDENTS },
    { key: KEYS.ATTENDANCE, getDefault: () => generateInitialAttendanceHistory(INITIAL_STUDENTS) },
    { key: KEYS.LEAVES, getDefault: () => INITIAL_LEAVE_REQUESTS },
    { key: KEYS.WA_LOGS, getDefault: () => INITIAL_WA_LOGS },
    { key: KEYS.TEACHERS, getDefault: () => INITIAL_TEACHERS },
    { key: KEYS.LEARNING_JOURNALS, getDefault: () => INITIAL_LEARNING_JOURNALS },
    { key: KEYS.CHARACTER_TRAITS, getDefault: () => INITIAL_CHARACTER_TRAITS },
    { key: KEYS.CHARACTER_LOGS, getDefault: () => INITIAL_STUDENT_CHARACTER_LOGS },
    { key: KEYS.CHARACTER_PREDICATES, getDefault: () => INITIAL_CHARACTER_PREDICATES },
    { key: KEYS.GRADES, getDefault: () => [] },
    { key: KEYS.PERIODS, getDefault: () => INITIAL_LESSON_PERIODS },
    { key: KEYS.SCHEDULES, getDefault: () => INITIAL_CLASS_SCHEDULES },
    { key: KEYS.DIRECT_CHATS, getDefault: () => ({}) },
  ];

  SYNC_KEYS.forEach(({ key }) => {
    try {
      const docRef = doc(db, 'sihadir_app_data', key);
      onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          const payload = docSnap.data();
          if (payload && payload.data !== undefined) {
            const cloudUpdatedAt = Number(payload.updatedAt) || 0;
            const localUpdatedAt = Number(localStorage.getItem(key + '_updatedAt') || '0');
            const currentLocalStr = localStorage.getItem(key);
            
            let finalDataToSave = '';
            if (payload.isChunked && Number(payload.totalChunks) > 1) {
              const totalChunks = Number(payload.totalChunks);
              const chunkPromises: Promise<string>[] = [];
              for (let i = 1; i < totalChunks; i++) {
                const chunkDocRef = doc(db, 'sihadir_app_data', `${key}_chunk_${i}`);
                chunkPromises.push(
                  getDoc(chunkDocRef).then((cSnap) => {
                    if (cSnap.exists() && cSnap.data()?.data) {
                      return String(cSnap.data().data);
                    }
                    return '';
                  }).catch(() => '')
                );
              }
              const otherChunks = await Promise.all(chunkPromises);
              finalDataToSave = (payload.data || '') + otherChunks.join('');
            } else {
              finalDataToSave = typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data);
            }

            // SPECIAL PROFILE MERGING:
            // For school profile, always merge subjects so new subjects added on other devices are immediately visible!
            if (key === KEYS.PROFILE) {
              try {
                const cloudProfile = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                const localProfile = getSchoolProfile();
                const mergedProfile = mergeSchoolProfile(localProfile, cloudProfile);
                finalDataToSave = JSON.stringify(mergedProfile);
                lastSavedStringCache[key] = finalDataToSave;
                localStorage.setItem(key, finalDataToSave);
                localStorage.setItem(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                notifyStorageUpdated();
                setCloudSyncStatus('connected');
                return;
              } catch (e) {
                console.warn('[Firestore Sync] Error merging school profile:', e);
              }
            }

            // SPECIAL TEACHERS SYNC:
            // Ensure teachers, custom passwords, and assignments sync across all devices without losing changes
            if (key === KEYS.TEACHERS) {
              try {
                const cloudTeachers = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                if (Array.isArray(cloudTeachers)) {
                  const currentLocalTeachers = getTeachers();
                  const mergedTeachers = localUpdatedAt <= 1 ? cloudTeachers : mergeTeacherLists(currentLocalTeachers, cloudTeachers);
                  const mergedStr = JSON.stringify(mergedTeachers);
                  if (currentLocalStr !== mergedStr) {
                    lastSavedStringCache[key] = mergedStr;
                    localStorage.setItem(key, mergedStr);
                    localStorage.setItem(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                    notifyStorageUpdated();
                  }
                  setCloudSyncStatus('connected');
                  return;
                }
              } catch (e) {
                console.warn('[Firestore Sync] Error updating teacher data:', e);
              }
            }

            // SPECIAL STUDENTS SYNC:
            // Ensure students, profile photos, and custom passwords sync seamlessly across devices
            if (key === KEYS.STUDENTS) {
              try {
                const cloudStudents = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                if (Array.isArray(cloudStudents)) {
                  const currentLocalStudents = getStudents();
                  const mergedStudents = localUpdatedAt <= 1 ? cloudStudents : mergeStudentLists(currentLocalStudents, cloudStudents);
                  const mergedStr = JSON.stringify(mergedStudents);
                  if (currentLocalStr !== mergedStr) {
                    lastSavedStringCache[key] = mergedStr;
                    localStorage.setItem(key, mergedStr);
                    localStorage.setItem(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                    notifyStorageUpdated();
                  }
                  setCloudSyncStatus('connected');
                  return;
                }
              } catch (e) {
                console.warn('[Firestore Sync] Error updating student data:', e);
              }
            }

            // SPECIAL ATTENDANCE SYNC:
            // Ensure real-time attendance scans from scanner devices merge smoothly onto all other devices
            if (key === KEYS.ATTENDANCE) {
              try {
                const cloudAtt = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                if (Array.isArray(cloudAtt)) {
                  const currentLocalAtt = getAttendanceRecords();
                  const mergedAtt = localUpdatedAt <= 1 ? cloudAtt : mergeAttendanceLists(currentLocalAtt, cloudAtt);
                  const mergedStr = JSON.stringify(mergedAtt);
                  if (currentLocalStr !== mergedStr) {
                    lastSavedStringCache[key] = mergedStr;
                    localStorage.setItem(key, mergedStr);
                    localStorage.setItem(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                    notifyStorageUpdated();
                  }
                  setCloudSyncStatus('connected');
                  return;
                }
              } catch (e) {
                console.warn('[Firestore Sync] Error updating attendance data:', e);
              }
            }

            // SPECIAL SCHOOL PROFILE SYNC:
            // Ensure school settings, jam masuk/pulang, hari libur, toleransi terlambat, mapel sync instantly across all devices
            if (key === KEYS.PROFILE) {
              try {
                const cloudProfile = typeof finalDataToSave === 'string' ? JSON.parse(finalDataToSave) : finalDataToSave;
                if (cloudProfile && typeof cloudProfile === 'object') {
                  const currentLocalProfile = getSchoolProfile();
                  const mergedProfile = (localUpdatedAt <= 1 || cloudUpdatedAt >= localUpdatedAt)
                    ? { ...INITIAL_SCHOOL_PROFILE, ...currentLocalProfile, ...cloudProfile }
                    : mergeSchoolProfile(currentLocalProfile, cloudProfile);
                  const mergedStr = JSON.stringify(mergedProfile);
                  if (currentLocalStr !== mergedStr) {
                    lastSavedStringCache[key] = mergedStr;
                    localStorage.setItem(key, mergedStr);
                    localStorage.setItem(key + '_updatedAt', String(Math.max(cloudUpdatedAt, localUpdatedAt, Date.now())));
                    notifyStorageUpdated();
                  }
                  setCloudSyncStatus('connected');
                  return;
                }
              } catch (e) {
                console.warn('[Firestore Sync] Error updating school profile data:', e);
              }
            }

            // CRITICAL TIMESTAMP CHECK:
            if (currentLocalStr !== null && localUpdatedAt > 0) {
              if (cloudUpdatedAt > 0 && cloudUpdatedAt < localUpdatedAt) {
                console.log(`[Firestore Sync] Data lokal untuk ${key} lebih baru (${localUpdatedAt} > ${cloudUpdatedAt}). Mengabaikan snapshot lama dari Cloud.`);
                return;
              }
              if (cloudUpdatedAt === 0 && localUpdatedAt > 1) {
                return;
              }
            }

            // Cache cloud string so syncToCloud doesn't redundantly re-upload it
            lastSavedStringCache[key] = finalDataToSave;

            if (currentLocalStr !== finalDataToSave) {
              localStorage.setItem(key, finalDataToSave);
              localStorage.setItem(key + '_updatedAt', String(cloudUpdatedAt || Date.now()));
              notifyStorageUpdated();
            }
          }
          setCloudSyncStatus('connected');
        }
      }, (err) => {
        const errMsg = err?.message || String(err);
        if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota limit exceeded')) {
          setCloudSyncStatus('quota_exceeded');
        } else {
          setCloudSyncStatus('offline');
        }
      });
    } catch (e) {
      setCloudSyncStatus('offline');
    }
  });

  // Startup repair check: if any student photo was previously saved uncompressed (>18KB),
  // automatically compress it in the background and push clean data to Firestore.
  try {
    const existingStudents = getStudents();
    const hasOversized = existingStudents.some(s => s.photoUrl?.startsWith('data:') && s.photoUrl.length > 18000);
    if (hasOversized) {
      sanitizeAndCompressStudentPhotos(existingStudents).then(optimized => {
        if (optimized !== existingStudents) {
          saveStudents(optimized, true);
        }
      }).catch(() => {});
    }
  } catch {}
}

export const INITIAL_CHARACTER_PREDICATES: CharacterPredicateSettings = {
  minA: 30,
  minB: 10,
  minC: 0,
  minD: -20,
  minE: -50,
};

// Storage Helpers
export function getSchoolProfile(): SchoolProfile {
  const data = localStorage.getItem(KEYS.PROFILE);
  if (!data) {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(INITIAL_SCHOOL_PROFILE));
    localStorage.setItem(KEYS.PROFILE + '_updatedAt', '1');
    return INITIAL_SCHOOL_PROFILE;
  }
  try {
    const parsed = JSON.parse(data);
    const rawSubjects = (parsed.subjects && Array.isArray(parsed.subjects) && parsed.subjects.length > 0)
      ? parsed.subjects
      : (INITIAL_SCHOOL_PROFILE.subjects || ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PJOK', 'Seni Budaya', 'Informatika', 'PPKn']);
    
    // Clean, trim, and deduplicate
    const cleanSubjects = Array.from(new Set(rawSubjects.map((s: any) => String(s).trim()).filter(Boolean)));

    return {
      ...INITIAL_SCHOOL_PROFILE,
      ...parsed,
      adminPassword: parsed.adminPassword || INITIAL_SCHOOL_PROFILE.adminPassword || 'admin123',
      scannerPassword: parsed.scannerPassword || INITIAL_SCHOOL_PROFILE.scannerPassword || '123456',
      startTime: parsed.startTime || INITIAL_SCHOOL_PROFILE.startTime || '07:00',
      endTime: parsed.endTime || INITIAL_SCHOOL_PROFILE.endTime || '15:00',
      dailyEndTimes: parsed.dailyEndTimes && typeof parsed.dailyEndTimes === 'object'
        ? { ...(INITIAL_SCHOOL_PROFILE.dailyEndTimes || {}), ...parsed.dailyEndTimes }
        : (INITIAL_SCHOOL_PROFILE.dailyEndTimes || {
            'Senin': parsed.endTime || '15:00',
            'Selasa': parsed.endTime || '15:00',
            'Rabu': parsed.endTime || '15:00',
            'Kamis': parsed.endTime || '15:00',
            'Jumat': '11:30',
            'Sabtu': '13:00',
            'Minggu': parsed.endTime || '15:00',
          }),
      autoAlpaTime: parsed.autoAlpaTime || INITIAL_SCHOOL_PROFILE.autoAlpaTime || '08:30',
      autoAlpaEnabled: typeof parsed.autoAlpaEnabled === 'boolean'
        ? parsed.autoAlpaEnabled
        : (INITIAL_SCHOOL_PROFILE.autoAlpaEnabled !== false),
      autoCharacterAssessmentEnabled: typeof parsed.autoCharacterAssessmentEnabled === 'boolean'
        ? parsed.autoCharacterAssessmentEnabled
        : (INITIAL_SCHOOL_PROFILE.autoCharacterAssessmentEnabled !== false),
      autoCharacterPoints: parsed.autoCharacterPoints && typeof parsed.autoCharacterPoints === 'object'
        ? {
            latePoints: Number(parsed.autoCharacterPoints.latePoints) || 2,
            alpaPoints: Number(parsed.autoCharacterPoints.alpaPoints) || 5,
            disruptivePoints: Number(parsed.autoCharacterPoints.disruptivePoints) || 1,
            absentKbmPoints: Number(parsed.autoCharacterPoints.absentKbmPoints) || 2,
            veryActiveKbmPoints: Number(parsed.autoCharacterPoints.veryActiveKbmPoints) || 1,
            onTimePoints: Number(parsed.autoCharacterPoints.onTimePoints) || 1,
            onTimeRequiredDays: Number(parsed.autoCharacterPoints.onTimeRequiredDays) || 3,
          }
        : (INITIAL_SCHOOL_PROFILE.autoCharacterPoints || {
            latePoints: 2,
            alpaPoints: 5,
            disruptivePoints: 1,
            absentKbmPoints: 2,
            veryActiveKbmPoints: 1,
            onTimePoints: 1,
            onTimeRequiredDays: 3,
          }),
      lateToleranceMinutes: typeof parsed.lateToleranceMinutes === 'number' ? parsed.lateToleranceMinutes : (INITIAL_SCHOOL_PROFILE.lateToleranceMinutes ?? 15),
      activeDays: parsed.activeDays && Array.isArray(parsed.activeDays) && parsed.activeDays.length > 0 ? parsed.activeDays : (INITIAL_SCHOOL_PROFILE.activeDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']),
      holidays: parsed.holidays && Array.isArray(parsed.holidays) ? parsed.holidays : (INITIAL_SCHOOL_PROFILE.holidays || []),
      subjects: cleanSubjects.length > 0 ? cleanSubjects : ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PJOK', 'Seni Budaya', 'Informatika', 'PPKn']
    };
  } catch {
    return INITIAL_SCHOOL_PROFILE;
  }
}

/**
 * Mendapatkan jam pulang sekolah untuk hari tertentu (misal: 'Senin', 'Jumat', dll).
 * Jika tidak ada pengaturan spesifik untuk hari tersebut, akan menggunakan endTime global atau fallback '15:00'.
 */
export function getSchoolCheckoutTimeForDay(profile: SchoolProfile, dayName?: string): string {
  if (!dayName) {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    dayName = dayNames[new Date().getDay()];
  }
  if (profile.dailyEndTimes && profile.dailyEndTimes[dayName]) {
    return profile.dailyEndTimes[dayName];
  }
  return profile.endTime || '15:00';
}

export function saveSchoolProfile(profile: SchoolProfile): void {
  const now = Date.now();
  const dataStr = JSON.stringify(profile);
  try {
    localStorage.setItem(KEYS.PROFILE, dataStr);
    localStorage.setItem(KEYS.PROFILE + '_updatedAt', String(now));
  } catch (err) {
    console.error('Error saving school profile to localStorage:', err);
  }
  notifyStorageUpdated();
  syncToCloud(KEYS.PROFILE, profile, true, now);
}

export function getSchoolClasses(): SchoolClass[] {
  const data = localStorage.getItem(KEYS.CLASSES);
  let parsed: SchoolClass[] = INITIAL_CLASSES;
  if (data) {
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = INITIAL_CLASSES;
    }
  } else {
    localStorage.setItem(KEYS.CLASSES, JSON.stringify(INITIAL_CLASSES));
    localStorage.setItem(KEYS.CLASSES + '_updatedAt', '1');
  }
  return [...parsed].sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }));
}

export function saveSchoolClasses(classes: SchoolClass[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(classes);
  localStorage.setItem(KEYS.CLASSES, dataStr);
  localStorage.setItem(KEYS.CLASSES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.CLASSES, classes, false, now);
}

export function getStudents(): Student[] {
  const data = localStorage.getItem(KEYS.STUDENTS);
  if (data === null) {
    localStorage.setItem(KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem(KEYS.STUDENTS + '_updatedAt', '1');
    return INITIAL_STUDENTS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStudents(students: Student[], instant: boolean = false): void {
  const now = Date.now();
  const dataStr = JSON.stringify(students);
  localStorage.setItem(KEYS.STUDENTS, dataStr);
  localStorage.setItem(KEYS.STUDENTS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.STUDENTS, students, instant || students.length === 0, now);

  // Background auto-optimization: if any student has an oversized photo (>18KB Base64),
  // automatically compress it and update Firestore so cross-device sync never hits 1MB document limit.
  const hasOversizedPhoto = students.some(s => s.photoUrl?.startsWith('data:') && s.photoUrl.length > 18000);
  if (hasOversizedPhoto) {
    sanitizeAndCompressStudentPhotos(students).then(optimizedStudents => {
      if (optimizedStudents !== students) {
        const optNow = Date.now();
        const optStr = JSON.stringify(optimizedStudents);
        localStorage.setItem(KEYS.STUDENTS, optStr);
        localStorage.setItem(KEYS.STUDENTS + '_updatedAt', String(optNow));
        notifyStorageUpdated();
        syncToCloud(KEYS.STUDENTS, optimizedStudents, true, optNow);
      }
    }).catch(() => {});
  }
}

export function deleteAllStudents(): void {
  saveStudents([], true);
}

export function getAttendanceRecords(): AttendanceRecord[] {
  const data = localStorage.getItem(KEYS.ATTENDANCE);
  if (data === null) {
    const initial = generateInitialAttendanceHistory(INITIAL_STUDENTS);
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(initial));
    localStorage.setItem(KEYS.ATTENDANCE + '_updatedAt', '1');
    return initial;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAttendanceRecords(records: AttendanceRecord[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(records);
  localStorage.setItem(KEYS.ATTENDANCE, dataStr);
  localStorage.setItem(KEYS.ATTENDANCE + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.ATTENDANCE, records, records.length === 0, now);
}

export function getLeaveRequests(): LeaveRequest[] {
  const data = localStorage.getItem(KEYS.LEAVES);
  if (data === null) {
    localStorage.setItem(KEYS.LEAVES, JSON.stringify(INITIAL_LEAVE_REQUESTS));
    localStorage.setItem(KEYS.LEAVES + '_updatedAt', '1');
    return INITIAL_LEAVE_REQUESTS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLeaveRequests(requests: LeaveRequest[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(requests);
  localStorage.setItem(KEYS.LEAVES, dataStr);
  localStorage.setItem(KEYS.LEAVES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.LEAVES, requests, requests.length === 0, now);
}

export function getWaLogs(): WhatsAppLog[] {
  const data = localStorage.getItem(KEYS.WA_LOGS);
  if (data === null) {
    localStorage.setItem(KEYS.WA_LOGS, JSON.stringify(INITIAL_WA_LOGS));
    localStorage.setItem(KEYS.WA_LOGS + '_updatedAt', '1');
    return INITIAL_WA_LOGS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWaLogs(logs: WhatsAppLog[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(logs);
  localStorage.setItem(KEYS.WA_LOGS, dataStr);
  localStorage.setItem(KEYS.WA_LOGS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.WA_LOGS, logs, false, now);
}

export function getTeachers(): Teacher[] {
  const data = localStorage.getItem(KEYS.TEACHERS);
  if (data === null) {
    localStorage.setItem(KEYS.TEACHERS, JSON.stringify(INITIAL_TEACHERS));
    localStorage.setItem(KEYS.TEACHERS + '_updatedAt', '1');
    return INITIAL_TEACHERS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTeachers(teachers: Teacher[], instant: boolean = true): void {
  const now = Date.now();
  const dataStr = JSON.stringify(teachers);
  localStorage.setItem(KEYS.TEACHERS, dataStr);
  localStorage.setItem(KEYS.TEACHERS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.TEACHERS, teachers, instant, now);
}

export function updateTeacherPassword(teacherIdOrNip: string, newPassword: string): boolean {
  const teachers = getTeachers();
  let found = false;
  const cleanKey = teacherIdOrNip.trim();
  const updated = teachers.map(t => {
    if (t.id === cleanKey || t.nip?.trim() === cleanKey || t.phone?.trim() === cleanKey) {
      found = true;
      return { ...t, password: newPassword.trim() };
    }
    return t;
  });
  if (found) {
    saveTeachers(updated, true);
  }
  return found;
}

export function updateStudentPassword(studentIdOrNisn: string, newPassword: string): boolean {
  const students = getStudents();
  let found = false;
  const cleanKey = studentIdOrNisn.trim();
  const updated = students.map(s => {
    if (s.id === cleanKey || s.nisn?.trim() === cleanKey || s.nis?.trim() === cleanKey) {
      found = true;
      return { ...s, password: newPassword.trim() };
    }
    return s;
  });
  if (found) {
    saveStudents(updated, true);
  }
  return found;
}

export function resetAllTeachersPassword(): void {
  const teachers = getTeachers();
  const updated = teachers.map(t => ({ ...t, password: '123456' }));
  saveTeachers(updated, true);
}

export function resetAllStudentsPassword(): void {
  const students = getStudents();
  const updated = students.map(s => ({ ...s, password: '123456' }));
  saveStudents(updated, true);
}

export function getLearningJournals(): LearningJournal[] {
  const data = localStorage.getItem(KEYS.LEARNING_JOURNALS);
  if (data === null) {
    localStorage.setItem(KEYS.LEARNING_JOURNALS, JSON.stringify(INITIAL_LEARNING_JOURNALS));
    localStorage.setItem(KEYS.LEARNING_JOURNALS + '_updatedAt', '1');
    return INITIAL_LEARNING_JOURNALS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLearningJournals(journals: LearningJournal[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(journals);
  localStorage.setItem(KEYS.LEARNING_JOURNALS, dataStr);
  localStorage.setItem(KEYS.LEARNING_JOURNALS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.LEARNING_JOURNALS, journals, false, now);
}

export function getCharacterTraits(): CharacterTrait[] {
  const data = localStorage.getItem(KEYS.CHARACTER_TRAITS);
  if (data === null) {
    localStorage.setItem(KEYS.CHARACTER_TRAITS, JSON.stringify(INITIAL_CHARACTER_TRAITS));
    localStorage.setItem(KEYS.CHARACTER_TRAITS + '_updatedAt', '1');
    return INITIAL_CHARACTER_TRAITS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCharacterTraits(traits: CharacterTrait[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(traits);
  localStorage.setItem(KEYS.CHARACTER_TRAITS, dataStr);
  localStorage.setItem(KEYS.CHARACTER_TRAITS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_TRAITS, traits, false, now);
}

export function getStudentCharacterLogs(): StudentCharacterLog[] {
  const data = localStorage.getItem(KEYS.CHARACTER_LOGS);
  if (data === null) {
    localStorage.setItem(KEYS.CHARACTER_LOGS, JSON.stringify(INITIAL_STUDENT_CHARACTER_LOGS));
    localStorage.setItem(KEYS.CHARACTER_LOGS + '_updatedAt', '1');
    return INITIAL_STUDENT_CHARACTER_LOGS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStudentCharacterLogs(logs: StudentCharacterLog[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(logs);
  localStorage.setItem(KEYS.CHARACTER_LOGS, dataStr);
  localStorage.setItem(KEYS.CHARACTER_LOGS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_LOGS, logs, false, now);
}

export function getCharacterPredicateSettings(): CharacterPredicateSettings {
  const data = localStorage.getItem(KEYS.CHARACTER_PREDICATES);
  if (data === null) {
    localStorage.setItem(KEYS.CHARACTER_PREDICATES, JSON.stringify(INITIAL_CHARACTER_PREDICATES));
    localStorage.setItem(KEYS.CHARACTER_PREDICATES + '_updatedAt', '1');
    return INITIAL_CHARACTER_PREDICATES;
  }
  try {
    const parsed = JSON.parse(data);
    return {
      minA: typeof parsed.minA === 'number' ? parsed.minA : 30,
      minB: typeof parsed.minB === 'number' ? parsed.minB : 10,
      minC: typeof parsed.minC === 'number' ? parsed.minC : 0,
      minD: typeof parsed.minD === 'number' ? parsed.minD : -20,
      minE: typeof parsed.minE === 'number' ? parsed.minE : -50,
    };
  } catch {
    return INITIAL_CHARACTER_PREDICATES;
  }
}

export function saveCharacterPredicateSettings(settings: CharacterPredicateSettings): void {
  const now = Date.now();
  const dataStr = JSON.stringify(settings);
  localStorage.setItem(KEYS.CHARACTER_PREDICATES, dataStr);
  localStorage.setItem(KEYS.CHARACTER_PREDICATES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_PREDICATES, settings, false, now);
}

export function getStudentGradeAssessments(): StudentGradeAssessment[] {
  const data = localStorage.getItem(KEYS.GRADES);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveStudentGradeAssessments(assessments: StudentGradeAssessment[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(assessments);
  localStorage.setItem(KEYS.GRADES, dataStr);
  localStorage.setItem(KEYS.GRADES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.GRADES, assessments, false, now);
}

export function getUserSession(): UserSession | null {
  const data = localStorage.getItem(KEYS.SESSION);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveUserSession(session: UserSession | null): void {
  if (!session) {
    localStorage.removeItem(KEYS.SESSION);
  } else {
    localStorage.setItem(KEYS.SESSION, JSON.stringify(session));
  }
  notifyStorageUpdated();
}

// Lesson Periods (JP) Storage
export function getLessonPeriods(): LessonPeriod[] {
  const data = localStorage.getItem(KEYS.PERIODS);
  if (data === null) {
    localStorage.setItem(KEYS.PERIODS, JSON.stringify(INITIAL_LESSON_PERIODS));
    localStorage.setItem(KEYS.PERIODS + '_updatedAt', '1');
    return INITIAL_LESSON_PERIODS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_LESSON_PERIODS;
  } catch {
    return INITIAL_LESSON_PERIODS;
  }
}

export function saveLessonPeriods(periods: LessonPeriod[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(periods);
  localStorage.setItem(KEYS.PERIODS, dataStr);
  localStorage.setItem(KEYS.PERIODS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.PERIODS, periods, true, now);
}

// Class Schedules Storage
export function getClassSchedules(): ClassScheduleSlot[] {
  const data = localStorage.getItem(KEYS.SCHEDULES);
  if (data === null) {
    localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(INITIAL_CLASS_SCHEDULES));
    localStorage.setItem(KEYS.SCHEDULES + '_updatedAt', '1');
    return INITIAL_CLASS_SCHEDULES;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return INITIAL_CLASS_SCHEDULES;
  }
}

export function saveClassSchedules(schedules: ClassScheduleSlot[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(schedules);
  localStorage.setItem(KEYS.SCHEDULES, dataStr);
  localStorage.setItem(KEYS.SCHEDULES + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.SCHEDULES, schedules, true, now);
}

export function saveSingleClassScheduleSlot(slot: ClassScheduleSlot): void {
  const current = getClassSchedules();
  const existingIdx = current.findIndex(s => s.id === slot.id);
  let updated: ClassScheduleSlot[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = slot;
  } else {
    // If there's an existing slot for same classId, day, and periodNumber, replace it
    const sameSlotIdx = current.findIndex(s => s.classId === slot.classId && s.day === slot.day && s.periodNumber === slot.periodNumber);
    if (sameSlotIdx >= 0) {
      updated = [...current];
      updated[sameSlotIdx] = slot;
    } else {
      updated = [...current, slot];
    }
  }
  saveClassSchedules(updated);
}

export function deleteClassScheduleSlot(slotId: string): void {
  const current = getClassSchedules();
  const updated = current.filter(s => s.id !== slotId);
  saveClassSchedules(updated);
}

export function clearClassSchedules(classId?: string): void {
  const current = getClassSchedules();
  const updated = classId ? current.filter(s => s.classId !== classId) : [];
  saveClassSchedules(updated);
}

export function copyClassSchedule(sourceClassId: string, targetClassId: string, targetClassName: string, overwrite: boolean = true): void {
  const current = getClassSchedules();
  const sourceSlots = current.filter(s => s.classId === sourceClassId);
  
  let updated: ClassScheduleSlot[];
  if (overwrite) {
    updated = current.filter(s => s.classId !== targetClassId);
  } else {
    updated = [...current];
  }

  const newSlots: ClassScheduleSlot[] = sourceSlots.map((s, idx) => ({
    ...s,
    id: `sch-${targetClassId}-${s.day.toLowerCase().slice(0, 3)}-${s.periodNumber}-${Date.now()}-${idx}`,
    classId: targetClassId,
    className: targetClassName,
  }));

  if (!overwrite) {
    // Filter out conflicts if not overwriting
    newSlots.forEach(ns => {
      const exists = updated.some(u => u.classId === targetClassId && u.day === ns.day && u.periodNumber === ns.periodNumber);
      if (!exists) {
        updated.push(ns);
      }
    });
  } else {
    updated.push(...newSlots);
  }

  saveClassSchedules(updated);
}

// Direct Chat Storage (Parent & Selected Teacher Private Consultation)
export function getDirectChats(): Record<string, DirectChatMessage[]> {
  const data = localStorage.getItem(KEYS.DIRECT_CHATS);
  if (!data) return {};
  try {
    const parsed = JSON.parse(data);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDirectChats(chats: Record<string, DirectChatMessage[]>): void {
  const now = Date.now();
  const dataStr = JSON.stringify(chats);
  localStorage.setItem(KEYS.DIRECT_CHATS, dataStr);
  localStorage.setItem(KEYS.DIRECT_CHATS + '_updatedAt', String(now));
  notifyStorageUpdated();
  syncToCloud(KEYS.DIRECT_CHATS, chats, true, now);
}

export function resetToDefaultData(): void {
  localStorage.clear();
  const now = Date.now();
  localStorage.setItem(KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
  localStorage.setItem(KEYS.STUDENTS + '_updatedAt', String(now));
  getSchoolProfile();
  getSchoolClasses();
  getAttendanceRecords();
  getLeaveRequests();
  getWaLogs();
  getTeachers();
  getCharacterTraits();
  getStudentCharacterLogs();
  getCharacterPredicateSettings();
  getLessonPeriods();
  getClassSchedules();
  notifyStorageUpdated();
}

