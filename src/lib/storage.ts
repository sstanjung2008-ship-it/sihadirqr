import { SchoolProfile, SchoolClass, Student, AttendanceRecord, LeaveRequest, WhatsAppLog, Teacher, LearningJournal, CharacterTrait, StudentCharacterLog, CharacterPredicateSettings, UserSession, StudentGradeAssessment } from '../types';
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
  INITIAL_LEARNING_JOURNALS
} from '../data/mockData';
import { db, doc, setDoc, onSnapshot } from './firebase';

const KEYS = {
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
  SESSION: 'sihadir_user_session_v2',
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
  window.dispatchEvent(new CustomEvent('sihadir_cloud_status_changed', { detail: { status } }));
};

const notifyStorageUpdated = () => {
  setTimeout(() => {
    window.dispatchEvent(new Event('sihadir_storage_updated'));
  }, 0);
};

// Debounced and deduped push to Firestore to strictly respect Free Tier limits
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
      const docRef = doc(db, 'sihadir_app_data', key);
      const timestamp = explicitTimestamp || Number(localStorage.getItem(key + '_updatedAt')) || Date.now();
      await setDoc(docRef, { 
        data: dataStr, 
        updatedAt: timestamp 
      });
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
  };
  return JSON.stringify(backupObject, null, 2);
}

export function downloadDatabaseBackupFile(): void {
  const jsonStr = exportAllDatabaseToJson();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
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

// Intelligent entity mergers to ensure no data is lost across multiple devices
export function mergeStudentLists(local: Student[], cloud: Student[]): Student[] {
  const map = new Map<string, Student>();
  // 1. Index cloud items
  cloud.forEach(s => {
    const key = (s.nisn && s.nisn.trim()) || (s.nis && s.nis.trim()) || s.id;
    if (key) map.set(key, s);
  });
  // 2. Merge local items (local takes priority if updated or new)
  local.forEach(s => {
    const key = (s.nisn && s.nisn.trim()) || (s.nis && s.nis.trim()) || s.id;
    if (key) {
      if (map.has(key)) {
        map.set(key, { ...map.get(key)!, ...s });
      } else {
        map.set(key, s);
      }
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
  cloud.forEach(t => map.set(t.nip || t.id, t));
  local.forEach(t => map.set(t.nip || t.id, t));
  return Array.from(map.values());
}

export function mergeAttendanceLists(local: AttendanceRecord[], cloud: AttendanceRecord[]): AttendanceRecord[] {
  const map = new Map<string, AttendanceRecord>();
  cloud.forEach(a => map.set(`${a.studentId}_${a.date}`, a));
  local.forEach(a => map.set(`${a.studentId}_${a.date}`, a));
  return Array.from(map.values()).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
}

export function mergeGenericListsById<T extends { id: string }>(local: T[], cloud: T[]): T[] {
  const map = new Map<string, T>();
  cloud.forEach(item => map.set(item.id, item));
  local.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
}

// Comprehensive multi-device smart synchronization
export async function smartSyncAndMergeAllWithCloud(): Promise<{ success: boolean; studentCount: number; message: string }> {
  try {
    setCloudSyncStatus('syncing');
    const { getDoc } = await import('./firebase');

    // 1. Sync Students
    const studentDocRef = doc(db, 'sihadir_app_data', KEYS.STUDENTS);
    const studentSnap = await getDoc(studentDocRef);
    let currentLocalStudents = getStudents();
    let cloudStudents: Student[] = [];

    if (studentSnap.exists() && studentSnap.data()?.data) {
      try {
        cloudStudents = JSON.parse(studentSnap.data().data);
      } catch (e) {
        console.warn('Error parsing cloud students:', e);
      }
    }

    const mergedStudents = mergeStudentLists(currentLocalStudents, cloudStudents);
    localStorage.setItem(KEYS.STUDENTS, JSON.stringify(mergedStudents));
    await setDoc(studentDocRef, {
      data: JSON.stringify(mergedStudents),
      updatedAt: Date.now(),
    });

    // 2. Sync Classes
    const classDocRef = doc(db, 'sihadir_app_data', KEYS.CLASSES);
    const classSnap = await getDoc(classDocRef);
    let currentLocalClasses = getSchoolClasses();
    let cloudClasses: SchoolClass[] = [];
    if (classSnap.exists() && classSnap.data()?.data) {
      try {
        cloudClasses = JSON.parse(classSnap.data().data);
      } catch {}
    }
    const mergedClasses = mergeClassLists(currentLocalClasses, cloudClasses);
    localStorage.setItem(KEYS.CLASSES, JSON.stringify(mergedClasses));
    await setDoc(classDocRef, {
      data: JSON.stringify(mergedClasses),
      updatedAt: Date.now(),
    });

    // 3. Sync Teachers
    const teacherDocRef = doc(db, 'sihadir_app_data', KEYS.TEACHERS);
    const teacherSnap = await getDoc(teacherDocRef);
    let currentLocalTeachers = getTeachers();
    let cloudTeachers: Teacher[] = [];
    if (teacherSnap.exists() && teacherSnap.data()?.data) {
      try {
        cloudTeachers = JSON.parse(teacherSnap.data().data);
      } catch {}
    }
    const mergedTeachers = mergeTeacherLists(currentLocalTeachers, cloudTeachers);
    localStorage.setItem(KEYS.TEACHERS, JSON.stringify(mergedTeachers));
    await setDoc(teacherDocRef, {
      data: JSON.stringify(mergedTeachers),
      updatedAt: Date.now(),
    });

    // 4. Sync Attendance Records
    const attDocRef = doc(db, 'sihadir_app_data', KEYS.ATTENDANCE);
    const attSnap = await getDoc(attDocRef);
    let currentLocalAtt = getAttendanceRecords();
    let cloudAtt: AttendanceRecord[] = [];
    if (attSnap.exists() && attSnap.data()?.data) {
      try {
        cloudAtt = JSON.parse(attSnap.data().data);
      } catch {}
    }
    const mergedAtt = mergeAttendanceLists(currentLocalAtt, cloudAtt);
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(mergedAtt));
    await setDoc(attDocRef, {
      data: JSON.stringify(mergedAtt),
      updatedAt: Date.now(),
    });

    // 5. Sync Leave Requests, Journals, Traits, Logs, Grades
    const syncGeneric = async <T extends { id: string }>(
      key: string,
      getLocal: () => T[]
    ) => {
      const dRef = doc(db, 'sihadir_app_data', key);
      const snap = await getDoc(dRef);
      let localItems = getLocal();
      let cItems: T[] = [];
      if (snap.exists() && snap.data()?.data) {
        try {
          cItems = JSON.parse(snap.data().data);
        } catch {}
      }
      const merged = mergeGenericListsById(localItems, cItems);
      localStorage.setItem(key, JSON.stringify(merged));
      await setDoc(dRef, { data: JSON.stringify(merged), updatedAt: Date.now() });
    };

    await syncGeneric(KEYS.LEAVES, getLeaveRequests);
    await syncGeneric(KEYS.LEARNING_JOURNALS, getLearningJournals);
    await syncGeneric(KEYS.CHARACTER_TRAITS, getCharacterTraits);
    await syncGeneric(KEYS.CHARACTER_LOGS, getStudentCharacterLogs);
    await syncGeneric(KEYS.GRADES, getStudentGradeAssessments);

    notifyStorageUpdated();
    setCloudSyncStatus('connected');

    return {
      success: true,
      studentCount: mergedStudents.length,
      message: `Berhasil menyinkronkan! Total ${mergedStudents.length} siswa sekarang tersinkron di Cloud dan semua perangkat.`
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

// Upload all local data to Cloud database
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
    ];

    for (const key of ALL_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const docRef = doc(db, 'sihadir_app_data', key);
        await setDoc(docRef, {
          data: raw,
          updatedAt: Date.now(),
        });
      }
    }
    setCloudSyncStatus('connected');
    return { success: true };
  } catch (err: any) {
    console.error('[Force Upload Cloud Error]', err);
    setCloudSyncStatus('offline');
    return { success: false, error: err?.message || 'Gagal mengunggah ke Cloud' };
  }
}

// Download latest data from Cloud database
export async function forceDownloadAllFromCloud(): Promise<{ success: boolean; error?: string }> {
  try {
    setCloudSyncStatus('syncing');
    const { getDoc } = await import('./firebase');
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
    ];

    let updatedCount = 0;
    for (const key of ALL_KEYS) {
      const docRef = doc(db, 'sihadir_app_data', key);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const payload = snap.data();
        if (payload && payload.data) {
          localStorage.setItem(key, payload.data);
          updatedCount++;
        }
      }
    }
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
  ];

  SYNC_KEYS.forEach(({ key }) => {
    try {
      const docRef = doc(db, 'sihadir_app_data', key);
      onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const payload = docSnap.data();
          if (payload && payload.data !== undefined) {
            const cloudUpdatedAt = Number(payload.updatedAt) || 0;
            const localUpdatedAt = Number(localStorage.getItem(key + '_updatedAt') || '0');
            const currentLocalStr = localStorage.getItem(key);
            const finalDataToSave = typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data);

            // CRITICAL TIMESTAMP CHECK:
            // If local changes were made more recently than cloud snapshot (e.g. user deleted students, or edited records locally,
            // while Firestore write failed or quota was exceeded), NEVER overwrite local data with stale cloud data!
            if (currentLocalStr !== null && localUpdatedAt > 0) {
              if (cloudUpdatedAt > 0 && cloudUpdatedAt < localUpdatedAt) {
                console.log(`[Firestore Sync] Data lokal untuk ${key} lebih baru (${localUpdatedAt} > ${cloudUpdatedAt}). Mengabaikan snapshot lama dari Cloud.`);
                return;
              }
              if (cloudUpdatedAt === 0) {
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
    return {
      ...INITIAL_SCHOOL_PROFILE,
      ...parsed,
      holidays: parsed.holidays && Array.isArray(parsed.holidays) ? parsed.holidays : (INITIAL_SCHOOL_PROFILE.holidays || [])
    };
  } catch {
    return INITIAL_SCHOOL_PROFILE;
  }
}

export function saveSchoolProfile(profile: SchoolProfile): void {
  const now = Date.now();
  const dataStr = JSON.stringify(profile);
  try {
    localStorage.setItem(KEYS.PROFILE, dataStr);
    localStorage.setItem(KEYS.PROFILE + '_updatedAt', String(now));
    lastSavedStringCache[KEYS.PROFILE] = dataStr;
  } catch (err) {
    console.error('Error saving school profile to localStorage:', err);
  }
  notifyStorageUpdated();
  syncToCloud(KEYS.PROFILE, profile, false, now);
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
  lastSavedStringCache[KEYS.CLASSES] = dataStr;
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
  lastSavedStringCache[KEYS.STUDENTS] = dataStr;
  notifyStorageUpdated();
  syncToCloud(KEYS.STUDENTS, students, instant || students.length === 0, now);
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
  lastSavedStringCache[KEYS.ATTENDANCE] = dataStr;
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
  lastSavedStringCache[KEYS.LEAVES] = dataStr;
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
  lastSavedStringCache[KEYS.WA_LOGS] = dataStr;
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

export function saveTeachers(teachers: Teacher[]): void {
  const now = Date.now();
  const dataStr = JSON.stringify(teachers);
  localStorage.setItem(KEYS.TEACHERS, dataStr);
  localStorage.setItem(KEYS.TEACHERS + '_updatedAt', String(now));
  lastSavedStringCache[KEYS.TEACHERS] = dataStr;
  notifyStorageUpdated();
  syncToCloud(KEYS.TEACHERS, teachers, false, now);
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
  lastSavedStringCache[KEYS.LEARNING_JOURNALS] = dataStr;
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
  lastSavedStringCache[KEYS.CHARACTER_TRAITS] = dataStr;
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
  lastSavedStringCache[KEYS.CHARACTER_LOGS] = dataStr;
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
  lastSavedStringCache[KEYS.CHARACTER_PREDICATES] = dataStr;
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
  lastSavedStringCache[KEYS.GRADES] = dataStr;
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
  notifyStorageUpdated();
}

