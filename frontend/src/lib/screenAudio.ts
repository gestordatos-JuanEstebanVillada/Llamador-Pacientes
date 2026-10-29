/** Duración aproximada del timbre generado con Web Audio API (ms). */
const WEB_AUDIO_CHIME_MS = 980;

/** Pausa entre la primera y la segunda mención TTS (ms). */
export const TTS_REPEAT_PAUSE_MS = 1000;

/** Espera tras cancel() antes de hablar (evita doble locución en Chrome). */
const POST_CANCEL_DELAY_MS = 80;

/** Invalida locuciones en curso al incrementar (nueva llamada / cancel). */
let activeSpeechGeneration = 0;

/** Resuelve la promesa activa de `speakPatientCallAsync` si cancel() no dispara onend. */
let pendingSpeechAbort: (() => void) | null = null;

function abortPendingSpeech(): void {
  pendingSpeechAbort?.();
  pendingSpeechAbort = null;
}

const MAX_TTS_PASSES = 2;

/** Velocidad TTS (ligeramente por debajo del estándar para mayor claridad). */
const TTS_SPEECH_RATE = 0.88;

const PREFERRED_SPANISH_VOICE_LANGS = ["es-co", "es-us", "es-mx", "es-419"] as const;

const DEFAULT_TTS_LANG = "es-CO";

/**
 * Evita deletreo por MAYÚSCULAS y mejora pronunciación de patrones problemáticos en nombres.
 */
export function normalizeForTTS(text: string): string {
  let s = text.toLowerCase();
  s = s.replace(/th/g, "t");
  s = s.replace(/ph/g, "f");
  s = s.replace(/[^a-záéíóúüñ\s]/gi, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function pickSpanishVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const spanish = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
  if (spanish.length === 0) return null;

  for (const prefix of PREFERRED_SPANISH_VOICE_LANGS) {
    const match = spanish.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (match) return match;
  }

  return spanish[0] ?? null;
}

export function buildPatientCallSpeechPhrase(paciente: string, consultorio: string): string {
  const textoLimpio = normalizeForTTS(paciente);
  return `Paciente ${textoLimpio}, pasar al consultorio ${consultorio}.`;
}

/** @deprecated Usar buildPatientCallSpeechPhrase; conservado por compatibilidad. */
export function buildPatientCallSpeechText(paciente: string, consultorio: string): string {
  return buildPatientCallSpeechPhrase(paciente, consultorio);
}

export function cancelPatientSpeech(): void {
  activeSpeechGeneration += 1;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
  }
  abortPendingSpeech();
}

export function playDingDong(ctx: AudioContext): void {
  const t0 = ctx.currentTime;
  const playTone = (freq: number, start: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  };
  playTone(660, t0, 0.35);
  playTone(880, t0 + 0.45, 0.45);
}

export function playDingDongAsync(ctx: AudioContext): Promise<void> {
  return new Promise((resolve) => {
    void ctx.resume();

    const finishWebAudioChime = () => {
      playDingDong(ctx);
      window.setTimeout(resolve, WEB_AUDIO_CHIME_MS);
    };

    const ding = new Audio("/ding-dong.mp3");
    ding.onended = () => resolve();
    ding.onerror = finishWebAudioChime;

    ding.play().then(() => {}).catch(finishWebAudioChime);
  });
}

export function speakPatientCall(
  paciente: string,
  consultorio: string,
  onEnd?: () => void,
): void {
  void speakPatientCallAsync(paciente, consultorio).then(() => onEnd?.());
}

/**
 * Ding-Dong (externo) + exactamente 2 locuciones con 1 s entre ellas.
 * Una sola generación activa; contador de pasos estricto (máx. 2).
 */
export function speakPatientCallAsync(paciente: string, consultorio: string): Promise<void> {
  if (!("speechSynthesis" in window)) {
    return Promise.resolve();
  }

  abortPendingSpeech();

  const generation = ++activeSpeechGeneration;
  const synth = window.speechSynthesis;
  synth.cancel();
  synth.resume();

  const textoLimpio = normalizeForTTS(paciente);
  const text = `Paciente ${textoLimpio}, pasar al consultorio ${consultorio}.`;
  const voice = pickSpanishVoice(synth);
  const utteranceLang = voice?.lang ?? DEFAULT_TTS_LANG;

  return new Promise((resolve) => {
    let passesCompleted = 0;
    let pauseTimer: number | null = null;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (pendingSpeechAbort === finish) pendingSpeechAbort = null;
      if (pauseTimer !== null) window.clearTimeout(pauseTimer);
      resolve();
    };

    pendingSpeechAbort = finish;

    const runPass = () => {
      if (finished || generation !== activeSpeechGeneration) return finish();
      if (passesCompleted >= MAX_TTS_PASSES) return finish();

      let utteranceEnded = false;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = utteranceLang;
      if (voice) utter.voice = voice;
      utter.rate = TTS_SPEECH_RATE;

      const onUtteranceDone = () => {
        if (utteranceEnded) return;
        utteranceEnded = true;
        if (generation !== activeSpeechGeneration) return finish();

        passesCompleted += 1;
        if (passesCompleted >= MAX_TTS_PASSES) return finish();

        pauseTimer = window.setTimeout(() => {
          pauseTimer = null;
          if (generation !== activeSpeechGeneration) return finish();
          runPass();
        }, TTS_REPEAT_PAUSE_MS);
      };

      utter.onend = onUtteranceDone;
      utter.onerror = onUtteranceDone;
      synth.resume();
      synth.speak(utter);
    };

    pauseTimer = window.setTimeout(() => {
      pauseTimer = null;
      if (generation !== activeSpeechGeneration) return finish();
      runPass();
    }, POST_CANCEL_DELAY_MS);
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
