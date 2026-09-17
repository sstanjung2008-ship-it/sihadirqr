// Suara AI & Notifikasi Peran (Guru & Orang Tua)
// Memadukan Nada Lonceng Harmonis (Web Audio API) + Suara AI Bahasa Indonesia Alami (Web Speech API)

export interface KbmReminderInfo {
  teacherName: string;
  subject: string;
  className: string;
  room?: string;
  periodNumber: number;
  jpCount?: number;
  startTime: string;
  endTime?: string;
  slotId?: string;
}

export interface ParentNotificationParams {
  studentName: string;
  className: string;
  time: string;
  parentName?: string;
  schoolName?: string;
}

export type ParentAttendanceType = 'ARRIVAL' | 'LATE' | 'ABSENT' | 'DEPARTURE';

const STORAGE_KEY_TEACHER_VOICE_ENABLED = 'sihadir_kbm_voice_reminder_enabled';
const STORAGE_KEY_PARENT_VOICE_ENABLED = 'sihadir_parent_voice_enabled';

// ==========================================
// DEFAULT TEMPLATES - GURU & ORANG TUA
// ==========================================

export const DEFAULT_TEACHER_SPEECH_TEMPLATE = 
  "Pemberitahuan kepada [TeacherName]. Anda memiliki jadwal mengajar mata pelajaran [Subject] di [ClassName] [PeriodLabel]. Selamat menjalankan tugas di [SchoolName], terima kasih.";

export const DEFAULT_TEACHER_TEXT_TEMPLATE = 
  "PENGINGAT MENGAJAR: Yth. Bpk/Ibu [TeacherName], mengingatkan bahwa jadwal mengajar mata pelajaran [Subject] di Kelas [ClassName] ([Room]) akan dimulai pada pukul [Time] WITA ([PeriodLabel]). Selamat menjalankan KBM!";

// Default Pesan Teks Notifikasi Orang Tua
export const DEFAULT_PARENT_ARRIVAL_MESSAGE = 
  "Yth. Bpk/Ibu [ParentName], memberitahukan bahwa putra/putri Anda, [StudentName] ([ClassName]), telah Tiba di Sekolah pada pukul [Time] WITA dalam keadaan TEPAT WAKTU di [SchoolName].";

export const DEFAULT_PARENT_LATE_MESSAGE = 
  "PEMBERITAHUAN TERLAMBAT: Yth. Bpk/Ibu [ParentName], putra/putri Anda, [StudentName] ([ClassName]), Tiba di Sekolah pada pukul [Time] WITA (Terlambat). Mohon bimbingan dan perhatiannya.";

export const DEFAULT_PARENT_DEPARTURE_MESSAGE = 
  "PEMBERITAHUAN PULANG: Yth. Bpk/Ibu [ParentName], memberitahukan bahwa putra/putri Anda, [StudentName] ([ClassName]), telah Selesai KBM dan Pulang dari Sekolah pada pukul [Time] WITA. Terima kasih.";

export const DEFAULT_PARENT_ABSENT_MESSAGE = 
  "PERHATIAN: Yth. Bpk/Ibu [ParentName], putra/putri Anda, [StudentName] ([ClassName]), Belum Melakukan Presensi di Sekolah hingga pukul [Time] WITA tanpa keterangan. Mohon segera konfirmasi ke pihak sekolah.";

// Default Kalimat Suara AI Diucapkan (Natural Indonesian Speech)
export const DEFAULT_PARENT_VOICE_ARRIVAL = 
  "Pemberitahuan kepada Bapak atau Ibu [ParentName]. Putra atau putri Anda, [StudentName], dari kelas [ClassName], telah hadir di sekolah tepat waktu pada pukul [Time]. Terima kasih.";

export const DEFAULT_PARENT_VOICE_LATE = 
  "Pemberitahuan kepada Bapak atau Ibu [ParentName]. Putra atau putri Anda, [StudentName], dari kelas [ClassName], tiba di sekolah pada pukul [Time], dengan status terlambat.";

export const DEFAULT_PARENT_VOICE_DEPARTURE = 
  "Pemberitahuan kepada Bapak atau Ibu [ParentName]. Siswa [StudentName], kelas [ClassName], telah selesai mengikuti kegiatan belajar dan telah pulang dari sekolah pada pukul [Time].";

export const DEFAULT_PARENT_VOICE_ABSENT = 
  "Peringatan kehadiran sekolah. Kepada Bapak atau Ibu [ParentName], siswa [StudentName] dari kelas [ClassName] tercatat belum melakukan absensi di sekolah hingga pukul [Time]. Mohon konfirmasi.";

export const DEFAULT_SPEECH_TEXT = "Pemberitahuan, Anda memiliki jadwal mengajar saat ini. Selamat menjalankan tugas, terima kasih.";

// ==========================================
// STRING INTERPOLATION & GENERATORS
// ==========================================

/**
 * Buat kalimat suara AI alami untuk jadwal KBM Guru
 */
export function generateKbmSpeechText(info?: KbmReminderInfo, customTemplate?: string, schoolName?: string): string {
  if (!info) {
    return DEFAULT_SPEECH_TEXT;
  }

  const rawName = info.teacherName?.trim() || 'Guru Pengampu';
  const hasGreeting = /^(bapak|ibu|bpk|dr|dra|drs|ustadz|ustadzah)\b/i.test(rawName);
  const teacherGreeting = hasGreeting ? rawName : `Bapak atau Ibu ${rawName}`;

  const classText = info.className.toLowerCase().startsWith('kelas') 
    ? info.className 
    : `Kelas ${info.className}`;

  const jpNumber = info.jpCount && info.jpCount > 0 ? info.jpCount : 1;
  const jpText = `sebanyak ${jpNumber} Jam Pelajaran`;
  const subjectText = info.subject?.trim() || 'Mata Pelajaran';
  const roomText = info.room?.trim() || 'Ruang Kelas';
  const timeText = info.startTime || '07:30';
  const periodText = `Jam Ke-${info.periodNumber || 1}`;

  if (customTemplate && customTemplate.trim()) {
    return customTemplate
      .replace(/\[TeacherName\]/g, teacherGreeting)
      .replace(/\[Subject\]/g, subjectText)
      .replace(/\[ClassName\]/g, classText)
      .replace(/\[Room\]/g, roomText)
      .replace(/\[Time\]/g, timeText)
      .replace(/\[PeriodLabel\]/g, jpText)
      .replace(/\[Period\]/g, periodText)
      .replace(/\[SchoolName\]/g, schoolName || 'Sekolah');
  }

  return `Pemberitahuan kepada ${teacherGreeting}. Anda memiliki jadwal mengajar mata pelajaran ${subjectText} di ${classText} ${jpText}. Selamat menjalankan tugas di ${schoolName || 'sekolah'}, terima kasih.`;
}

/**
 * Buat kalimat suara AI atau pesan teks untuk notifikasi kehadiran Orang Tua
 */
export function generateParentNotificationContent(
  type: ParentAttendanceType,
  params: ParentNotificationParams,
  options?: { isVoice?: boolean; customTemplate?: string }
): string {
  const { studentName, className, time, parentName = 'Wali Murid', schoolName = 'Sekolah' } = params;

  const cleanClass = className.toLowerCase().startsWith('kelas') ? className : `Kelas ${className}`;
  const cleanParent = parentName?.trim() || 'Orang Tua / Wali Murid';

  let template = options?.customTemplate;

  if (!template || !template.trim()) {
    if (options?.isVoice) {
      switch (type) {
        case 'ARRIVAL': template = DEFAULT_PARENT_VOICE_ARRIVAL; break;
        case 'LATE': template = DEFAULT_PARENT_VOICE_LATE; break;
        case 'DEPARTURE': template = DEFAULT_PARENT_VOICE_DEPARTURE; break;
        case 'ABSENT': template = DEFAULT_PARENT_VOICE_ABSENT; break;
      }
    } else {
      switch (type) {
        case 'ARRIVAL': template = DEFAULT_PARENT_ARRIVAL_MESSAGE; break;
        case 'LATE': template = DEFAULT_PARENT_LATE_MESSAGE; break;
        case 'DEPARTURE': template = DEFAULT_PARENT_DEPARTURE_MESSAGE; break;
        case 'ABSENT': template = DEFAULT_PARENT_ABSENT_MESSAGE; break;
      }
    }
  }

  return (template || '')
    .replace(/\[StudentName\]/g, studentName)
    .replace(/\[ClassName\]/g, cleanClass)
    .replace(/\[Time\]/g, time)
    .replace(/\[ParentName\]/g, cleanParent)
    .replace(/\[SchoolName\]/g, schoolName);
}

// ==========================================
// STATUS STORAGE CONTROLS
// ==========================================

export function isKbmVoiceReminderEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(STORAGE_KEY_TEACHER_VOICE_ENABLED);
  return stored !== null ? stored === 'true' : true;
}

export function setKbmVoiceReminderEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_TEACHER_VOICE_ENABLED, enabled ? 'true' : 'false');
}

export function isParentVoiceEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(STORAGE_KEY_PARENT_VOICE_ENABLED);
  return stored !== null ? stored === 'true' : true;
}

export function setParentVoiceEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_PARENT_VOICE_ENABLED, enabled ? 'true' : 'false');
}

// ==========================================
// WEB AUDIO API - HARMONIC CHIMES
// ==========================================

export function playAudioChime(type: 'TEACHER' | 'SUCCESS' | 'WARNING' | 'ALERT' | 'DEPARTURE' | 'BK_NOTIFICATION' = 'TEACHER'): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        resolve();
        return;
      }

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      let notes: { freq: number; time: number; duration: number }[] = [];

      switch (type) {
        case 'BK_NOTIFICATION':
          // Nada Khusus BK: Nada Melodik 3-Akord Ceria & Bersih (E5 -> G#5 -> B5 -> E6)
          notes = [
            { freq: 659.25, time: 0.0, duration: 0.25 },
            { freq: 830.61, time: 0.12, duration: 0.28 },
            { freq: 987.77, time: 0.24, duration: 0.35 },
            { freq: 1318.51, time: 0.38, duration: 0.75 }
          ];
          break;
        case 'TEACHER':
          // Nada Arpeggio 4-Akord Elegan (C5 -> E5 -> G5 -> C6)
          notes = [
            { freq: 523.25, time: 0.0, duration: 0.45 },
            { freq: 659.25, time: 0.15, duration: 0.5 },
            { freq: 783.99, time: 0.3, duration: 0.8 },
            { freq: 1046.50, time: 0.45, duration: 1.1 }
          ];
          break;
        case 'SUCCESS':
          // Nada Ceria Positif Datang Tepat Waktu (F5 -> A5 -> C6)
          notes = [
            { freq: 698.46, time: 0.0, duration: 0.35 },
            { freq: 880.00, time: 0.14, duration: 0.4 },
            { freq: 1046.50, time: 0.28, duration: 0.85 }
          ];
          break;
        case 'WARNING':
          // Nada Peringatan Terlambat (A5 -> F5)
          notes = [
            { freq: 880.00, time: 0.0, duration: 0.3 },
            { freq: 698.46, time: 0.18, duration: 0.6 }
          ];
          break;
        case 'DEPARTURE':
          // Nada Melodi Pulang Harmonis (G5 -> E5 -> C5)
          notes = [
            { freq: 783.99, time: 0.0, duration: 0.35 },
            { freq: 659.25, time: 0.15, duration: 0.45 },
            { freq: 523.25, time: 0.3, duration: 0.9 }
          ];
          break;
        case 'ALERT':
          // Nada Perhatian Alpa / Belum Absen
          notes = [
            { freq: 440.00, time: 0.0, duration: 0.25 },
            { freq: 554.37, time: 0.15, duration: 0.25 },
            { freq: 440.00, time: 0.3, duration: 0.6 }
          ];
          break;
      }

      notes.forEach(({ freq, time, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);

        gain.gain.setValueAtTime(0.001, now + time);
        gain.gain.linearRampToValueAtTime(0.2, now + time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + time);
        osc.stop(now + time + duration);
      });

      const maxTime = Math.max(...notes.map(n => n.time + n.duration), 0.7);
      setTimeout(() => {
        resolve();
      }, (maxTime * 1000) + 100);
    } catch (e) {
      console.warn('Audio chime error:', e);
      resolve();
    }
  });
}

// Backward compatibility helper
export function playKbmChime(): Promise<void> {
  return playAudioChime('TEACHER');
}

// Chime Nada Suara Notifikasi Penilaian Karakter untuk Guru BK
export function playBkNotificationChime(): Promise<void> {
  return playAudioChime('BK_NOTIFICATION');
}

// ==========================================
// SPEECH SYNTHESIS - SUARA AI INDONESIA
// ==========================================

export function getIndonesianFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const femaleKeywords = ['female', 'wanita', 'perempuan', 'gadis', 'siti', 'wavenet', 'natural', 'google bahasa indonesia', 'indonesia'];
  
  const idVoices = voices.filter(v => 
    v.lang.toLowerCase().startsWith('id') || 
    v.lang.toLowerCase().includes('indonesia')
  );

  if (idVoices.length > 0) {
    const femaleIdVoice = idVoices.find(v => 
      femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
    );
    if (femaleIdVoice) return femaleIdVoice;
    return idVoices[0];
  }

  const anyFemaleVoice = voices.find(v => 
    femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
  );
  if (anyFemaleVoice) return anyFemaleVoice;

  return voices[0] || null;
}

export function speakKbmVoice(
  text: string = DEFAULT_SPEECH_TEXT,
  options?: { pitch?: number; rate?: number }
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.pitch = options?.pitch ?? 1.18;
      utterance.rate = options?.rate ?? 0.93;
      utterance.volume = 1.0;

      const voice = getIndonesianFemaleVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        resolve();
      };

      window.speechSynthesis.speak(utterance);

      // Safety timeout
      setTimeout(() => {
        resolve();
      }, 10000);
    } catch (err) {
      console.warn('Speak error:', err);
      resolve();
    }
  });
}

// ==========================================
// PLAYERS & SIMULATORS (GURU & ORANG TUA)
// ==========================================

export async function playTeacherKbmVoiceReminder(
  info?: KbmReminderInfo,
  customText?: string
): Promise<void> {
  if (!isKbmVoiceReminderEnabled()) {
    return;
  }

  const speechText = customText || generateKbmSpeechText(info);

  try {
    await playAudioChime('TEACHER');
    await speakKbmVoice(speechText);
  } catch (err) {
    console.error('Failed to play KBM voice reminder:', err);
  }
}

export async function playParentVoiceNotification(
  type: ParentAttendanceType,
  params: ParentNotificationParams,
  customVoiceText?: string
): Promise<void> {
  if (!isParentVoiceEnabled()) {
    return;
  }

  const speechText = customVoiceText || generateParentNotificationContent(type, params, { isVoice: true });
  const chimeTypeMap: Record<ParentAttendanceType, 'SUCCESS' | 'WARNING' | 'ALERT' | 'DEPARTURE'> = {
    ARRIVAL: 'SUCCESS',
    LATE: 'WARNING',
    ABSENT: 'ALERT',
    DEPARTURE: 'DEPARTURE'
  };

  try {
    await playAudioChime(chimeTypeMap[type]);
    await speakKbmVoice(speechText);
  } catch (err) {
    console.error('Failed to play parent voice notification:', err);
  }
}

export async function testKbmVoiceReminder(customTemplate?: string, teacherInfo?: KbmReminderInfo): Promise<void> {
  const sampleInfo: KbmReminderInfo = teacherInfo || {
    teacherName: "Ahmad Fauzi, S.Pd",
    subject: "Matematika",
    className: "7A",
    room: "R.01",
    periodNumber: 1,
    jpCount: 2,
    startTime: "07:30",
    endTime: "09:00"
  };

  const text = generateKbmSpeechText(sampleInfo, customTemplate);
  await playTeacherKbmVoiceReminder(sampleInfo, text);
}

export async function testParentVoiceNotification(
  type: ParentAttendanceType,
  sampleStudent?: { name: string; className: string; parentName?: string; time?: string },
  customTemplate?: string
): Promise<void> {
  const defaultTime = type === 'ABSENT' ? '08:30' : (type === 'DEPARTURE' ? '15:00' : '07:10');
  const params: ParentNotificationParams = {
    studentName: sampleStudent?.name || "Muhammad Rizky Pratama",
    className: sampleStudent?.className || "7A",
    time: sampleStudent?.time || defaultTime,
    parentName: sampleStudent?.parentName || "Bpk. Hendra Pratama",
    schoolName: "SMP Negeri 1 Cerdas Bersama"
  };

  const text = generateParentNotificationContent(type, params, {
    isVoice: true,
    customTemplate
  });

  await playParentVoiceNotification(type, params, text);
}
