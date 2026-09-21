// Web Audio API Ringtone & Chime Generator for SiHadirQR Scanner Feedback

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (err) {
    console.warn('[Audio Engine] Failed to get AudioContext:', err);
    return null;
  }
}

/**
 * Memutar nada lonceng / chime individual dengan overtones harmonis alami
 */
function playChimeNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number = 0.35,
  volume: number = 0.3,
  type: OscillatorType = 'sine'
) {
  try {
    // Primary Tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // Envelope (Attack -> Exponential Decay)
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);

    // Harmonic Overtone (Bell-like sparkle)
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, startTime);

    overtoneGain.gain.setValueAtTime(0.001, startTime);
    overtoneGain.gain.linearRampToValueAtTime(volume * 0.25, startTime + 0.015);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.6);

    overtone.connect(overtoneGain);
    overtoneGain.connect(ctx.destination);

    overtone.start(startTime);
    overtone.stop(startTime + duration * 0.6);
  } catch (e) {
    console.warn('[Audio Engine] Note error:', e);
  }
}

/**
 * Main sound player for scan results:
 * - 'SUCCESS': Nada dering ceria naik 3 nada (Tepat Waktu)
 * - 'LATE': Nada dering peringatan 3 nada turun (Terlambat)
 * - 'PULANG': Nada dering kepulangan harmonis (Pulang)
 * - 'ERROR': Nada dering penolakan / QR tidak terdaftar
 */
export function playScanSound(type: 'SUCCESS' | 'LATE' | 'PULANG' | 'ERROR') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    if (type === 'SUCCESS') {
      // 🔔 NADA DERING MASUK TEPAT WAKTU (Melodi Harmonis Ceria: C5 -> E5 -> G5 -> C6)
      playChimeNote(ctx, 523.25, t + 0.00, 0.25, 0.28, 'sine'); // C5
      playChimeNote(ctx, 659.25, t + 0.09, 0.25, 0.30, 'sine'); // E5
      playChimeNote(ctx, 783.99, t + 0.18, 0.30, 0.32, 'sine'); // G5
      playChimeNote(ctx, 1046.50, t + 0.27, 0.50, 0.35, 'sine'); // C6 (panjang & jernih)
    } else if (type === 'LATE') {
      // ⚠️ NADA DERING MASUK TERLAMBAT (Melodi Peringatan Tegas & Jelas: A5 -> F5 -> D5)
      playChimeNote(ctx, 880.00, t + 0.00, 0.22, 0.35, 'triangle'); // A5
      playChimeNote(ctx, 698.46, t + 0.14, 0.22, 0.35, 'triangle'); // F5
      playChimeNote(ctx, 587.33, t + 0.28, 0.45, 0.40, 'triangle'); // D5
    } else if (type === 'PULANG') {
      // 🏠 NADA DERING SCAN PULANG (Melodi Hangat & Bersahabat: G4 -> C5 -> E5 -> G5)
      playChimeNote(ctx, 392.00, t + 0.00, 0.25, 0.25, 'sine'); // G4
      playChimeNote(ctx, 523.25, t + 0.09, 0.25, 0.28, 'sine'); // C5
      playChimeNote(ctx, 659.25, t + 0.18, 0.30, 0.30, 'sine'); // E5
      playChimeNote(ctx, 783.99, t + 0.27, 0.50, 0.32, 'sine'); // G5
    } else {
      // ❌ NADA DERING ERROR / REJECTED (Double Buzz Nada Rendah)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(220, t);
      osc2.frequency.setValueAtTime(233, t); // Dissonant minor second for clear alert

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.32);
      osc2.stop(t + 0.32);
    }
  } catch (err) {
    console.warn('[Audio Engine] Play scan sound error:', err);
  }
}
