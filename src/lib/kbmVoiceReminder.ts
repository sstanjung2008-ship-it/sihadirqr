// Suara AI Pengingat Jadwal KBM Guru
// Memadukan Nada Lonceng Harmonis (Web Audio API) + Suara AI Perempuan (Web Speech API)

export interface KbmReminderInfo {
  teacherName: string;
  subject: string;
  className: string;
  room?: string;
  periodNumber: number;
  startTime: string;
  endTime?: string;
  slotId?: string;
}

const STORAGE_KEY_VOICE_ENABLED = 'sihadir_kbm_voice_reminder_enabled';
const DEFAULT_SPEECH_TEXT = "Anda Memiliki Jam Mengajar Saat ini, Selamat Menjalankan Tugas. Terima Kasih ";

/**
 * Cek apakah nada pengingat suara diaktifkan
 */
export function isKbmVoiceReminderEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(STORAGE_KEY_VOICE_ENABLED);
  return stored !== null ? stored === 'true' : true;
}

/**
 * Set status aktif/nonaktif pengingat suara
 */
export function setKbmVoiceReminderEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_VOICE_ENABLED, enabled ? 'true' : 'false');
}

/**
 * Mainkan nada lonceng pembuka yang merdu & elegan sebelum suara AI berbicara
 */
export function playKbmChime(): Promise<void> {
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

      // Nada Lonceng Arpeggio 3-Akord (C5 -> E5 -> G5)
      const notes = [
        { freq: 523.25, time: 0.0, duration: 0.45 }, // C5
        { freq: 659.25, time: 0.15, duration: 0.5 }, // E5
        { freq: 783.99, time: 0.3, duration: 0.8 },  // G5
        { freq: 1046.50, time: 0.45, duration: 1.1 } // C6 (penutup merdu)
      ];

      notes.forEach(({ freq, time, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);

        // Attack & Decay Envelope
        gain.gain.setValueAtTime(0.001, now + time);
        gain.gain.linearRampToValueAtTime(0.22, now + time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + time);
        osc.stop(now + time + duration);
      });

      setTimeout(() => {
        resolve();
      }, 750);
    } catch (e) {
      console.warn('Audio chime error:', e);
      resolve();
    }
  });
}

/**
 * Cari suara perempuan bahasa Indonesia terbaik di peramban
 */
export function getIndonesianFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Cari suara bahasa Indonesia (id-ID) dengan identitas perempuan
  const femaleKeywords = ['female', 'wanita', 'perempuan', 'gadis', 'siti', 'wavenet', 'natural', 'google bahasa indonesia'];
  
  const idVoices = voices.filter(v => 
    v.lang.toLowerCase().startsWith('id') || 
    v.lang.toLowerCase().includes('indonesia')
  );

  if (idVoices.length > 0) {
    // Prioritas 1: Suara ID yang memiliki nama perempuan atau natural
    const femaleIdVoice = idVoices.find(v => 
      femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
    );
    if (femaleIdVoice) return femaleIdVoice;

    // Prioritas 2: Suara ID apapun
    return idVoices[0];
  }

  // 2. Fallback: cari suara perempuan umum
  const anyFemaleVoice = voices.find(v => 
    femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
  );
  if (anyFemaleVoice) return anyFemaleVoice;

  return voices[0] || null;
}

/**
 * Ucapkan teks pengingat menggunakan Suara AI Perempuan
 */
export function speakKbmVoice(text: string = DEFAULT_SPEECH_TEXT): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      // Pastikan antrean ucapan sebelumnya dibersihkan
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      
      // Pengaturan karakter suara perempuan: pitch sedikit lebih tinggi, tempo natural dan artikulatif
      utterance.pitch = 1.18;
      utterance.rate = 0.93;
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

      // Timeout pelindung jika speech synthesizer hang di browser tertentu
      setTimeout(() => {
        resolve();
      }, 8000);
    } catch (err) {
      console.warn('Speak error:', err);
      resolve();
    }
  });
}

/**
 * Mainkan Pengingat Lengkap: Lonceng Harmonis + Suara AI Perempuan
 */
export async function playTeacherKbmVoiceReminder(
  info?: KbmReminderInfo,
  customText?: string
): Promise<void> {
  if (!isKbmVoiceReminderEnabled()) {
    return;
  }

  // Teks sesuai permintaan user:
  // "Anda Memiliki Jam Mengajar Saat ini, Selamat Menjalankan Tugas. Terima Kasih "
  const speechText = customText || DEFAULT_SPEECH_TEXT;

  try {
    // 1. Putar Lonceng Harmonis terlebih dahulu
    await playKbmChime();

    // 2. Ucapkan Suara AI Perempuan
    await speakKbmVoice(speechText);
  } catch (err) {
    console.error('Failed to play KBM voice reminder:', err);
  }
}

/**
 * Fungsi uji coba suara nada pengingat untuk tombol "Tes Suara" di antarmuka
 */
export async function testKbmVoiceReminder(): Promise<void> {
  // Buka AudioContext & SpeechSynthesis via event user
  await playTeacherKbmVoiceReminder(
    undefined,
    "Anda Memiliki Jam Mengajar Saat ini, Selamat Menjalankan Tugas. Terima Kasih "
  );
}
