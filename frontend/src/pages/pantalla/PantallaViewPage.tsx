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
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl shadow-xl">
      <video
        ref={videoRef}
        src={institutionalVideoUrl}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        aria-label="Video institucional Fundación La Liga"
      />
    </div>
  );
}

function WaitingHistoryPanel({ history }: { history: HistoryEntry[] }) {
  const visible = history.slice(0, WAITING_HISTORY_MAX);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
      <div className="flex shrink-0 items-center gap-2">
        <History className="h-6 w-6 shrink-0 text-rose-600" aria-hidden />
        <h2 className="text-xl font-semibold text-slate-800">Últimos Llamados</h2>
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">Sin llamados recientes en esta sesión.</p>
      ) : (
        <>
          <div className="mb-2 mt-6 flex shrink-0 items-center justify-between border-b border-gray-100 px-4 pb-2 text-xs font-bold uppercase tracking-widest text-slate-400 md:text-sm">
            <span>Paciente</span>
            <span>Consultorio</span>
          </div>
          <div className="mt-2 flex flex-1 flex-col justify-evenly px-2">
            {visible.map((item, idx) => (
              <div
                key={`${item.paciente_nombre}-${item.consultorio_numero}-${idx}`}
                className="flex items-center justify-between gap-6 border-b border-gray-50 py-4 last:border-0"
              >
                <p className="min-w-0 flex-1 truncate text-3xl font-bold capitalize text-slate-800">
                  {item.paciente_nombre}
                </p>
                <p className="shrink-0 text-5xl font-black tabular-nums text-rose-600">
                  {item.consultorio_numero}
                </p>
              </div>
            ))}
          </div>
        </>
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
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [clearingQueue, setClearingQueue] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<PatientCallEvent[]>([]);
  const processingRef = useRef(false);
  const processorRunIdRef = useRef(0);
  const processorChainRef = useRef<Promise<void> | null>(null);
  const seenCallIdsRef = useRef<Set<number>>(new Set());
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

  const addToHistory = useCallback((pacienteNombre: string, consultorioNumero: string) => {
    setHistory((prev) =>
      [{ paciente_nombre: pacienteNombre, consultorio_numero: consultorioNumero }, ...prev].slice(
        0,
        WAITING_HISTORY_MAX,
      ),
    );
  }, []);

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

          addToHistory(ev.paciente_nombre, ev.consultorio_numero);

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
  }, [addToHistory, applyCurrentCall, returnToWaiting]);

  const enqueueCall = useCallback(
    (ev: PatientCallEvent) => {
      if (seenCallIdsRef.current.has(ev.call_id)) return;
      seenCallIdsRef.current.add(ev.call_id);
      queueRef.current.push(ev);
      syncQueueSize();
      void runQueueProcessor();
    },
    [runQueueProcessor],
  );

  const onPatientCall = useCallback(
    (ev: PatientCallEvent, fromHistorySync: boolean) => {
      if (fromHistorySync) {
        seenCallIdsRef.current.add(ev.call_id);
        addToHistory(ev.paciente_nombre, ev.consultorio_numero);
        return;
      }

      const normalized = { ...ev, play_audio: ev.play_audio !== false };
      enqueueCall(normalized);
    },
    [addToHistory, enqueueCall],
  );

  const onIdle = useCallback(() => {
    processorRunIdRef.current += 1;
    cancelPatientSpeech();
    processingRef.current = false;
    processorChainRef.current = null;
    queueRef.current = [];
    seenCallIdsRef.current.clear();
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
    seenCallIdsRef.current.clear();
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
    seenCallIdsRef.current.clear();
    audioStartedForCallIdRef.current = null;
    syncQueueSize();
    if (historyDisplayTimerRef.current !== null) {
      window.clearTimeout(historyDisplayTimerRef.current);
      historyDisplayTimerRef.current = null;
    }
    returnToWaiting();
  }, [returnToWaiting]);

  useCallExpiry(currentCall, onExpire);
  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  useEffect(
    () => () => {
      processorRunIdRef.current += 1;
      if (historyDisplayTimerRef.current !== null) {
        window.clearTimeout(historyDisplayTimerRef.current);
      }
    },
    [],
  );

  const { status } = useSalaWebSocket({
    salaId: cfg.salaId,
    token,
    enabled: true,
    onPatientCall,
    onIdle,
  });

  const showCalling = mode === "calling" && currentCall;
  const connectionLost =
    !browserOnline || status === "connecting" || status === "reconnecting";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      <div className="absolute top-4 left-4 z-10">
        <BrandLogo className="h-14 md:h-16 w-auto" />
      </div>

      <button
        type="button"
        onClick={() => void handleClearQueue()}
        disabled={clearingQueue}
        title="Limpiar cola de llamadas"
        aria-label="Limpiar cola de llamadas"
        className="fixed bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-500 shadow-md backdrop-blur hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
          <path d="M11 1.5v1h2v-1a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1Zm-5 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1h3.5a1 1 0 1 1 0 2h-.653l-1.064 12.5A2.5 2.5 0 0 1 16.88 22H7.12a2.5 2.5 0 0 1-2.493-2.25L3.153 8.5H2.5a1 1 0 1 1 0-2H6V5.5Zm2 0v1h8v-1H8Zm1.347 3.5-.95 11.4h8.206l-.95-11.4H9.347Z" />
        </svg>
      </button>

      <div className="flex justify-end items-center px-4 py-2 text-xs text-gray-500 gap-3">
        <span className="hidden sm:inline">
          {cfg.sedeNombre} · {cfg.salaNombre}
        </span>
        <button type="button" onClick={() => navigate("/pantalla/setup")} className="hover:text-rose-600 underline">
          Cambiar sala
        </button>
        <button type="button" onClick={logout} className="hover:text-gray-800">
          Cerrar sesión
        </button>
      </div>

      {connectionLost && (
        <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium">
          {!browserOnline
            ? "Sin conexión… Reconectando"
            : status === "connecting"
              ? "Conectando…"
              : "Sin conexión… Reconectando"}
        </div>
      )}

      {queueSize > 0 && showCalling && (
        <div className="bg-rose-50 text-center py-1 text-xs text-rose-700 border-b border-rose-100">
          {queueSize} llamada(s) en cola
        </div>
      )}

      {!showCalling ? (
        <div className="absolute inset-0 flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-slate-50">
          <header className="flex flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-rose-600">EN ESPERA</p>
            <p className="mt-2 text-xl text-gray-700 md:text-2xl">
              {cfg.sedeNombre} · {cfg.salaNombre}
            </p>
            <WaitingClock className="mt-4 text-8xl md:text-9xl" />
          </header>

          <div className="mt-12 grid w-full max-w-[90%] grid-cols-2 items-stretch gap-12 2xl:max-w-[1600px]">
            <div className="flex h-full min-h-0 flex-col">
              <WaitingInstitutionalVideo />
            </div>
            <WaitingHistoryPanel history={history} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 pt-16 text-center">
          <p className="text-rose-600 uppercase tracking-widest text-xl mb-6 font-semibold">Paciente llamado</p>
          <h2 className="text-6xl md:text-8xl font-black text-slate-900 break-words max-w-5xl leading-tight">
            {currentCall.paciente_nombre}
          </h2>
          <p className="mt-10 text-4xl md:text-5xl text-gray-600">
            Consultorio{" "}
            <span className="font-bold text-rose-600">{currentCall.consultorio_numero}</span>
          </p>
        </div>
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
