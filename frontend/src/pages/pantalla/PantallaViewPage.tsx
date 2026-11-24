import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { History } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

import { BrandLogo } from "../../components/BrandLogo";
import { loadPantallaConfig, type PantallaStoredConfig } from "../../constants/storage";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { useCallExpiry, useSalaWebSocket } from "../../hooks/useScreenWebSocket";
import {
  INCOMING_CALL_DEDUP_MS,
  buildCanonicalCallKey,
  markIncomingCallAccepted,
  shouldIgnoreIncomingCall,
} from "../../lib/incomingCallDedup";
import {
  cancelPatientSpeech,
  playDingDongAsync,
  sleep,
  speakPatientCallAsync,
} from "../../lib/screenAudio";
import type { CurrentCall, PatientCallEvent } from "../../types";
import institutionalVideoUrl from "../../../video/Videos pantallas unificado - Julio.mp4";

const QUEUE_ITEM_DISPLAY_MS = 5_000;

function eventToCall(ev: PatientCallEvent): CurrentCall {
  return {
    call_id: ev.call_id,
    paciente_nombre: ev.paciente_nombre,
    consultorio_numero: ev.consultorio_numero,
    sala_nombre: ev.sala_nombre,
    sede_nombre: ev.sede_nombre,
    fecha_llamada: ev.fecha_llamada,
    fecha_expiracion: ev.fecha_expiracion,
    ttl_seconds: 120,
  };
}

type HistoryEntry = {
  paciente_nombre: string;
  consultorio_numero: string;
  call_id: number | null;
  canonicalKey: string;
  registeredAtMs: number;
};

const WAITING_HISTORY_MAX = 3;
const BOGOTA_TZ = "America/Bogota";

function WaitingClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p className={`font-light tabular-nums text-slate-700 ${className}`}>
      {now.toLocaleTimeString("es-CO", {
        timeZone: BOGOTA_TZ,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}
    </p>
  );
}

function WaitingInstitutionalVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => {
      /* autoplay bloqueado hasta interacción en setup */
    });
  }, []);

  return (
    <div className="relative mx-auto aspect-video w-full max-w-[min(92vw,52vh)] shrink-0 overflow-hidden rounded-2xl bg-slate-900 shadow-lg lg:max-w-none">
      <video
        ref={videoRef}
        src={institutionalVideoUrl}
        autoPlay
        loop
        muted
        playsInline
        className="h-full w-full object-cover"
        aria-label="Video institucional Fundación La Liga"
      />
    </div>
  );
}

function WaitingHistoryPanel({ history }: { history: HistoryEntry[] }) {
  const visible = history.slice(0, WAITING_HISTORY_MAX);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-gray-100 bg-white px-4 py-3 pb-7 shadow-xl sm:px-6 sm:py-[2vh] lg:h-full lg:flex-none lg:pb-[2vh]">
      <div className="shrink-0">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 shrink-0 text-rose-600 sm:h-6 sm:w-6" aria-hidden />
          <h2 className="text-[clamp(0.95rem,1.5vw,1.25rem)] font-semibold text-slate-800">Últimos Llamados</h2>
        </div>

        {visible.length === 0 ? (
          <p className="mt-4 text-center text-[clamp(0.75rem,1.2vw,0.95rem)] text-slate-500 sm:mt-6">
            Sin llamados recientes en esta sesión.
          </p>
        ) : (
          <div className="mt-2 flex shrink-0 items-center justify-between border-b border-gray-100 pb-1.5 text-[clamp(0.6rem,1vw,0.85rem)] font-bold uppercase tracking-widest text-slate-400 sm:mt-3 sm:pb-2">
            <span>Paciente</span>
            <span>Consultorio</span>
          </div>
        )}
      </div>

      {visible.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col justify-evenly divide-y divide-gray-100">
          {visible.map((item, idx) => (
            <div
              key={item.canonicalKey || `${item.paciente_nombre}-${item.consultorio_numero}-${idx}`}
              className="flex items-center justify-between gap-3 py-1 sm:gap-4 sm:py-1.5"
            >
              <p className="min-w-0 flex-1 truncate text-[clamp(1rem,2.1vw,1.85rem)] font-bold capitalize text-slate-800">
                {item.paciente_nombre}
              </p>
              <p className="shrink-0 text-[clamp(1.35rem,2.9vw,2.6rem)] font-black tabular-nums text-rose-600">
                {item.consultorio_numero}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PantallaViewInner({ cfg, token }: { cfg: PantallaStoredConfig; token: string }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"waiting" | "calling">("waiting");
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [clearingQueue, setClearingQueue] = useState(false);

  const sessionOpenedAtRef = useRef(Date.now());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<PatientCallEvent[]>([]);
  const processingRef = useRef(false);
  const processorRunIdRef = useRef(0);
  const processorChainRef = useRef<Promise<void> | null>(null);
  const seenIdsRef = useRef<Set<string | number>>(new Set());
  const recentCallsMapRef = useRef<Map<string, number>>(new Map());
  const audioStartedForCallIdRef = useRef<number | null>(null);
  const displayingCallIdRef = useRef<number | null>(null);
  const historyDisplayTimerRef = useRef<number | null>(null);

  const applyCurrentCall = useCallback((ev: PatientCallEvent) => {
    displayingCallIdRef.current = ev.call_id;
    flushSync(() => {
      setCurrentCall(eventToCall(ev));
      setMode("calling");
    });
  }, []);

  const syncQueueSize = () => setQueueSize(queueRef.current.length);

  const appendHistoryOnce = useCallback(
    (ev: PatientCallEvent, canonicalKey: string, registeredAtMs: number) => {
      setHistory((prev) => {
        const windowStart = registeredAtMs - INCOMING_CALL_DEDUP_MS;
        const dup = prev.some(
          (item) =>
            item.canonicalKey === canonicalKey ||
            (ev.call_id > 0 && item.call_id === ev.call_id) ||
            (item.registeredAtMs >= windowStart &&
              item.canonicalKey === canonicalKey),
        );
        const head = prev[0];
        if (
          head &&
          (head.canonicalKey === canonicalKey ||
            (ev.call_id > 0 && head.call_id === ev.call_id))
        ) {
          return prev;
        }
        if (dup) return prev;
        return [
          {
            paciente_nombre: ev.paciente_nombre,
            consultorio_numero: ev.consultorio_numero,
            call_id: ev.call_id > 0 ? ev.call_id : null,
            canonicalKey,
            registeredAtMs,
          },
          ...prev,
        ].slice(0, WAITING_HISTORY_MAX);
      });
    },
    [],
  );

  const returnToWaiting = useCallback(() => {
    displayingCallIdRef.current = null;
    setMode("waiting");
    setCurrentCall(null);
  }, []);

  const getAudioContext = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  };

  const scheduleHistoryOnlyDisplay = useCallback(
    (callId: number) => {
      if (historyDisplayTimerRef.current !== null) {
        window.clearTimeout(historyDisplayTimerRef.current);
      }
      historyDisplayTimerRef.current = window.setTimeout(() => {
        historyDisplayTimerRef.current = null;
        if (processingRef.current || queueRef.current.length > 0) return;
        setCurrentCall((prev) => (prev?.call_id === callId ? null : prev));
        setMode((prev) => (prev === "calling" ? "waiting" : prev));
      }, QUEUE_ITEM_DISPLAY_MS);
    },
    [],
  );

  const runQueueProcessor = useCallback(() => {
    if (processorChainRef.current) return processorChainRef.current;

    const runId = ++processorRunIdRef.current;
    processingRef.current = true;

    const chain = (async () => {
      try {
        while (queueRef.current.length > 0) {
          if (runId !== processorRunIdRef.current) break;
          const ev = queueRef.current.shift();
          syncQueueSize();
          if (!ev) continue;

          if (displayingCallIdRef.current !== ev.call_id) {
            applyCurrentCall(ev);
          }

          if (ev.play_audio !== false && audioStartedForCallIdRef.current !== ev.call_id) {
            audioStartedForCallIdRef.current = ev.call_id;
            cancelPatientSpeech();
            const ctx = getAudioContext();
            await playDingDongAsync(ctx);
            if (runId !== processorRunIdRef.current) break;
            await speakPatientCallAsync(ev.paciente_nombre, ev.consultorio_numero);
          }

          if (runId !== processorRunIdRef.current) break;

          await sleep(QUEUE_ITEM_DISPLAY_MS);
          if (runId !== processorRunIdRef.current) break;

          if (queueRef.current.length > 0) {
            const next = queueRef.current[0];
            if (next) applyCurrentCall(next);
          }
        }
      } finally {
        processingRef.current = false;
        processorChainRef.current = null;
        syncQueueSize();
        if (runId === processorRunIdRef.current && queueRef.current.length === 0) {
          returnToWaiting();
        }
      }
    })();

    processorChainRef.current = chain;
    return chain;
  }, [applyCurrentCall, returnToWaiting]);

  const enqueueCall = useCallback(
    (ev: PatientCallEvent) => {
      queueRef.current.push(ev);
      syncQueueSize();
      if (!processingRef.current) {
        void runQueueProcessor();
      }
    },
    [runQueueProcessor],
  );

  const registerIncomingCall = useCallback(
    (raw: PatientCallEvent, fromHistorySync: boolean) => {
      const canonicalKey = buildCanonicalCallKey(
        cfg.salaId,
        raw.consultorio_numero,
        raw.paciente_nombre,
      );
      const now = Date.now();
      if (
        shouldIgnoreIncomingCall(seenIdsRef.current, recentCallsMapRef.current, {
          callId: raw.call_id,
          canonicalKey,
          now,
        })
      ) {
        return;
      }

      markIncomingCallAccepted(seenIdsRef.current, recentCallsMapRef.current, {
        callId: raw.call_id,
        canonicalKey,
        now,
      });

      appendHistoryOnce(raw, canonicalKey, now);

      const historyOnly = fromHistorySync || raw.play_audio === false;
      if (!historyOnly) {
        enqueueCall({ ...raw, play_audio: true });
      }
    },
    [appendHistoryOnce, cfg.salaId, enqueueCall],
  );

  const onIdle = useCallback(() => {
    processorRunIdRef.current += 1;
    cancelPatientSpeech();
    processingRef.current = false;
    processorChainRef.current = null;
    queueRef.current = [];
    seenIdsRef.current.clear();
    recentCallsMapRef.current.clear();
    audioStartedForCallIdRef.current = null;
    syncQueueSize();
    returnToWaiting();
  }, [returnToWaiting]);

  const resetLocalQueue = useCallback(() => {
    processorRunIdRef.current += 1;
    cancelPatientSpeech();
    processingRef.current = false;
    processorChainRef.current = null;
    queueRef.current = [];
    seenIdsRef.current.clear();
    recentCallsMapRef.current.clear();
    audioStartedForCallIdRef.current = null;
    displayingCallIdRef.current = null;
    syncQueueSize();
    if (historyDisplayTimerRef.current !== null) {
      window.clearTimeout(historyDisplayTimerRef.current);
      historyDisplayTimerRef.current = null;
    }
    returnToWaiting();
  }, [returnToWaiting]);

  const handleClearQueue = useCallback(async () => {
    if (clearingQueue) return;
    setClearingQueue(true);
    resetLocalQueue();
    try {
      await api.clearPantallaQueue(cfg.salaId, token);
    } catch {
      /* UI ya reiniciada localmente */
    } finally {
      setClearingQueue(false);
    }
  }, [cfg.salaId, token, clearingQueue, resetLocalQueue]);

  const onExpire = useCallback(() => {
    processorRunIdRef.current += 1;
    cancelPatientSpeech();
    processingRef.current = false;
    processorChainRef.current = null;
    queueRef.current = [];
    seenIdsRef.current.clear();
    recentCallsMapRef.current.clear();
    audioStartedForCallIdRef.current = null;
    syncQueueSize();
    if (historyDisplayTimerRef.current !== null) {
      window.clearTimeout(historyDisplayTimerRef.current);
      historyDisplayTimerRef.current = null;
    }
    returnToWaiting();
  }, [returnToWaiting]);

  useCallExpiry(currentCall, onExpire);
  useEffect(
    () => () => {
      processorRunIdRef.current += 1;
      if (historyDisplayTimerRef.current !== null) {
        window.clearTimeout(historyDisplayTimerRef.current);
      }
    },
    [],
  );

  const { status, browserOnline } = useSalaWebSocket({
    salaId: cfg.salaId,
    token,
    enabled: true,
    sessionStartedAtMs: sessionOpenedAtRef.current,
    onRegisterIncomingCall: registerIncomingCall,
    onIdle,
  });

  const showCalling = mode === "calling" && currentCall;
  const connectionLost =
    !browserOnline || status === "connecting" || status === "reconnecting";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="fixed top-4 left-6 z-50">
        <BrandLogo className="h-10 sm:h-12 lg:h-14 w-auto" />
      </div>

      <div className="fixed top-4 right-4 sm:right-6 z-50 flex max-w-[min(92vw,520px)] flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:gap-4 text-xs sm:text-sm text-slate-500">
        {connectionLost && (
          <span
            className="flex items-center gap-1.5 whitespace-nowrap text-amber-700"
            role="status"
            aria-live="polite"
          >
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
            Sin internet · Reconectando…
          </span>
        )}
        <button
          type="button"
          onClick={() => navigate("/pantalla/setup")}
          className="shrink-0 underline transition-colors hover:text-rose-600"
        >
          Cambiar sala
        </button>
        <button
          type="button"
          onClick={logout}
          className="shrink-0 transition-colors hover:text-slate-800"
        >
          Cerrar sesión
        </button>
      </div>

      <button
        type="button"
        onClick={() => void handleClearQueue()}
        disabled={clearingQueue}
        title="Limpiar cola de llamadas"
        aria-label="Limpiar cola de llamadas"
        className="fixed bottom-2.5 right-2.5 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-500 opacity-40 shadow-md backdrop-blur transition-opacity hover:border-rose-300 hover:text-rose-600 hover:opacity-100 disabled:opacity-30"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path d="M11 1.5v1h2v-1a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1Zm-5 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1h3.5a1 1 0 1 1 0 2h-.653l-1.064 12.5A2.5 2.5 0 0 1 16.88 22H7.12a2.5 2.5 0 0 1-2.493-2.25L3.153 8.5H2.5a1 1 0 1 1 0-2H6V5.5Zm2 0v1h8v-1H8Zm1.347 3.5-.95 11.4h8.206l-.95-11.4H9.347Z" />
        </svg>
      </button>

      {queueSize > 0 && showCalling && (
        <div className="fixed top-14 left-0 right-0 z-40 border-b border-rose-100 bg-rose-50 text-center py-1 text-xs text-rose-700">
          {queueSize} llamada(s) en cola
        </div>
      )}

      {!showCalling ? (
        <div className="flex h-screen w-full flex-col justify-between overflow-hidden bg-slate-50 px-[3.5vw] pt-12 pb-4 sm:pt-14 sm:pb-6 lg:justify-center lg:gap-[5vh]">
          <header className="w-full shrink-0 text-center">
            <p className="text-[clamp(0.85rem,1.4vw,1.4rem)] font-bold uppercase tracking-widest text-rose-600">
              EN ESPERA
            </p>
            <p className="mt-0.5 text-[clamp(0.9rem,1.4vw,1.35rem)] font-medium text-slate-600">
              {cfg.sedeNombre} · {cfg.salaNombre}
            </p>
            <WaitingClock className="mt-0.5 text-[clamp(2.2rem,5.5vw,6.5rem)] font-bold leading-none text-slate-800" />
          </header>

          <div className="mt-[2vh] flex min-h-0 w-full flex-1 flex-col justify-center gap-[2vh] lg:mx-auto lg:grid lg:w-full lg:max-w-[min(92vw,148vh)] lg:flex-none lg:grid-cols-2 lg:items-stretch lg:gap-[3vw]">
            <WaitingInstitutionalVideo />
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col lg:contents">
              <WaitingHistoryPanel history={history} />
            </div>
          </div>
        </div>
      ) : (
        currentCall && (
          <div className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-slate-50 px-[4vw] pt-16 pb-8 text-center sm:px-[5vw] sm:pt-20 sm:pb-10">
            <p className="mb-[1.5vh] text-[clamp(0.95rem,1.8vw,1.75rem)] font-semibold uppercase tracking-widest text-rose-600">
              Paciente llamado
            </p>
            <h2 className="line-clamp-3 w-full max-w-[92vw] break-words text-[clamp(2rem,6vw,6rem)] font-black leading-[1.08] text-slate-900">
              {currentCall.paciente_nombre}
            </h2>
            <p className="mt-[3vh] text-[clamp(1.75rem,4.2vw,3.8rem)] font-medium text-slate-600">
              Consultorio{" "}
              <span className="font-black text-rose-600">{currentCall.consultorio_numero}</span>
            </p>
          </div>
        )
      )}
    </div>
  );
}

export default function PantallaViewPage() {
  const { token, rol, isAuthenticated } = useAuth();
  const cfg = loadPantallaConfig();

  if (!isAuthenticated || !token) return <Navigate to="/login" replace />;
  if (rol !== "PANTALLA" && rol !== "ADMIN") return <Navigate to="/login" replace />;
  if (!cfg) return <Navigate to="/pantalla/setup" replace />;

  return <PantallaViewInner cfg={cfg} token={token} />;
}
