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

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';
let currentSyncStatus: CloudSyncStatus = 'syncing';
let isFirestoreInitialized = false;

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

// Push local data update to Firestore
async function syncToCloud(key: string, data: any) {
  try {
    setCloudSyncStatus('syncing');
    const docRef = doc(db, 'sihadir_app_data', key);
    await setDoc(docRef, { 
      data: JSON.stringify(data), 
      updatedAt: Date.now() 
    });
    setCloudSyncStatus('connected');
  } catch (err) {
    console.warn('[Firestore Sync] Cloud save error, using offline local storage:', err);
    setCloudSyncStatus('offline');
  }
}

// Initialize Realtime Sync from Firestore
export function initFirestoreRealtimeSync() {
  if (isFirestoreInitialized || typeof window === 'undefined') return;
  isFirestoreInitialized = true;

  const SYNC_KEYS: Array<{ key: string; getDefault: () => any }> = [
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
  ];

  SYNC_KEYS.forEach(({ key, getDefault }) => {
    try {
      const docRef = doc(db, 'sihadir_app_data', key);
      onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const payload = docSnap.data();
          if (payload && payload.data) {
            const currentLocal = localStorage.getItem(key);
            if (currentLocal !== payload.data) {
              localStorage.setItem(key, payload.data);
              notifyStorageUpdated();
            }
          }
          setCloudSyncStatus('connected');
        } else {
          // Document does not exist in cloud yet, seed with current local data or default
          const currentLocal = localStorage.getItem(key);
          const initialValue = currentLocal ? JSON.parse(currentLocal) : getDefault();
          syncToCloud(key, initialValue);
        }
      }, (err) => {
        console.warn(`[Firestore Listen] Error on key ${key}:`, err);
        setCloudSyncStatus('offline');
      });
    } catch (e) {
      console.warn(`[Firestore Init] Exception on key ${key}:`, e);
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
  try {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
  } catch (err) {
    console.error('Error saving school profile to localStorage:', err);
  }
  notifyStorageUpdated();
  syncToCloud(KEYS.PROFILE, profile);
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
  }
  return [...parsed].sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }));
}

export function saveSchoolClasses(classes: SchoolClass[]): void {
  localStorage.setItem(KEYS.CLASSES, JSON.stringify(classes));
  notifyStorageUpdated();
  syncToCloud(KEYS.CLASSES, classes);
}

export function getStudents(): Student[] {
  const data = localStorage.getItem(KEYS.STUDENTS);
  if (!data) {
    localStorage.setItem(KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
    return INITIAL_STUDENTS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_STUDENTS;
  }
}

export function saveStudents(students: Student[]): void {
  localStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
  notifyStorageUpdated();
  syncToCloud(KEYS.STUDENTS, students);
}

export function getAttendanceRecords(): AttendanceRecord[] {
  const data = localStorage.getItem(KEYS.ATTENDANCE);
  if (!data) {
    const initial = generateInitialAttendanceHistory(INITIAL_STUDENTS);
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(data);
  } catch {
    const initial = generateInitialAttendanceHistory(INITIAL_STUDENTS);
    return initial;
  }
}

export function saveAttendanceRecords(records: AttendanceRecord[]): void {
  localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(records));
  notifyStorageUpdated();
  syncToCloud(KEYS.ATTENDANCE, records);
}

export function getLeaveRequests(): LeaveRequest[] {
  const data = localStorage.getItem(KEYS.LEAVES);
  if (!data) {
    localStorage.setItem(KEYS.LEAVES, JSON.stringify(INITIAL_LEAVE_REQUESTS));
    return INITIAL_LEAVE_REQUESTS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_LEAVE_REQUESTS;
  }
}

export function saveLeaveRequests(requests: LeaveRequest[]): void {
  localStorage.setItem(KEYS.LEAVES, JSON.stringify(requests));
  notifyStorageUpdated();
  syncToCloud(KEYS.LEAVES, requests);
}

export function getWaLogs(): WhatsAppLog[] {
  const data = localStorage.getItem(KEYS.WA_LOGS);
  if (!data) {
    localStorage.setItem(KEYS.WA_LOGS, JSON.stringify(INITIAL_WA_LOGS));
    return INITIAL_WA_LOGS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_WA_LOGS;
  }
}

export function saveWaLogs(logs: WhatsAppLog[]): void {
  localStorage.setItem(KEYS.WA_LOGS, JSON.stringify(logs));
  notifyStorageUpdated();
  syncToCloud(KEYS.WA_LOGS, logs);
}

export function getTeachers(): Teacher[] {
  const data = localStorage.getItem(KEYS.TEACHERS);
  if (!data) {
    localStorage.setItem(KEYS.TEACHERS, JSON.stringify(INITIAL_TEACHERS));
    return INITIAL_TEACHERS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_TEACHERS;
  }
}

export function saveTeachers(teachers: Teacher[]): void {
  localStorage.setItem(KEYS.TEACHERS, JSON.stringify(teachers));
  notifyStorageUpdated();
  syncToCloud(KEYS.TEACHERS, teachers);
}

export function getLearningJournals(): LearningJournal[] {
  const data = localStorage.getItem(KEYS.LEARNING_JOURNALS);
  if (!data) {
    localStorage.setItem(KEYS.LEARNING_JOURNALS, JSON.stringify(INITIAL_LEARNING_JOURNALS));
    return INITIAL_LEARNING_JOURNALS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_LEARNING_JOURNALS;
  }
}

export function saveLearningJournals(journals: LearningJournal[]): void {
  localStorage.setItem(KEYS.LEARNING_JOURNALS, JSON.stringify(journals));
  notifyStorageUpdated();
  syncToCloud(KEYS.LEARNING_JOURNALS, journals);
}

export function getCharacterTraits(): CharacterTrait[] {
  const data = localStorage.getItem(KEYS.CHARACTER_TRAITS);
  if (!data) {
    localStorage.setItem(KEYS.CHARACTER_TRAITS, JSON.stringify(INITIAL_CHARACTER_TRAITS));
    return INITIAL_CHARACTER_TRAITS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_CHARACTER_TRAITS;
  }
}

export function saveCharacterTraits(traits: CharacterTrait[]): void {
  localStorage.setItem(KEYS.CHARACTER_TRAITS, JSON.stringify(traits));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_TRAITS, traits);
}

export function getStudentCharacterLogs(): StudentCharacterLog[] {
  const data = localStorage.getItem(KEYS.CHARACTER_LOGS);
  if (!data) {
    localStorage.setItem(KEYS.CHARACTER_LOGS, JSON.stringify(INITIAL_STUDENT_CHARACTER_LOGS));
    return INITIAL_STUDENT_CHARACTER_LOGS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_STUDENT_CHARACTER_LOGS;
  }
}

export function saveStudentCharacterLogs(logs: StudentCharacterLog[]): void {
  localStorage.setItem(KEYS.CHARACTER_LOGS, JSON.stringify(logs));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_LOGS, logs);
}

export function getCharacterPredicateSettings(): CharacterPredicateSettings {
  const data = localStorage.getItem(KEYS.CHARACTER_PREDICATES);
  if (!data) {
    localStorage.setItem(KEYS.CHARACTER_PREDICATES, JSON.stringify(INITIAL_CHARACTER_PREDICATES));
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
  localStorage.setItem(KEYS.CHARACTER_PREDICATES, JSON.stringify(settings));
  notifyStorageUpdated();
  syncToCloud(KEYS.CHARACTER_PREDICATES, settings);
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
  localStorage.setItem(KEYS.GRADES, JSON.stringify(assessments));
  notifyStorageUpdated();
  syncToCloud(KEYS.GRADES, assessments);
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
  getSchoolProfile();
  getSchoolClasses();
  getStudents();
  getAttendanceRecords();
  getLeaveRequests();
  getWaLogs();
  getTeachers();
  getCharacterTraits();
  getStudentCharacterLogs();
  getCharacterPredicateSettings();
  notifyStorageUpdated();
}

