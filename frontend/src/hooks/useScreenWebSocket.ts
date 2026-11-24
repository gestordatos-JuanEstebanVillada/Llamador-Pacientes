import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../lib/api";
import type { CurrentCall, PatientCallEvent, ScreenWsMessage } from "../types";

const PING_INTERVAL_MS = 5_000;
const PONG_TIMEOUT_MS = 3_000;
const FAST_RECONNECT_MS = 1_500;
const CATCHUP_RECENT_MS = 3 * 60 * 1000;

function wsUrl(salaId: number, token: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const params = new URLSearchParams({ token });
  return `${proto}://${window.location.host}/ws/salas/${salaId}?${params.toString()}`;
}

function currentCallToEvent(call: CurrentCall): PatientCallEvent {
  return {
    type: "patient_call",
    call_id: call.call_id,
    paciente_nombre: call.paciente_nombre,
    consultorio_numero: call.consultorio_numero,
    sala_nombre: call.sala_nombre,
    sede_nombre: call.sede_nombre,
    fecha_llamada: call.fecha_llamada,
    fecha_expiracion: call.fecha_expiracion,
    play_audio: true,
  };
}

interface SalaWsOptions {
  salaId: number;
  token: string;
  enabled: boolean;
  sessionStartedAtMs: number;
  onRegisterIncomingCall: (event: PatientCallEvent, fromHistorySync: boolean) => void;
  onIdle: () => void;
}

export function useSalaWebSocket({
  salaId,
  token,
  enabled,
  sessionStartedAtMs,
  onRegisterIncomingCall,
  onIdle,
}: SalaWsOptions) {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "reconnecting">("idle");
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const activeWsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const wsEffectSessionRef = useRef(0);
  const mountedRef = useRef(true);
  const reconnectTimerRef = useRef<number | undefined>(undefined);
  const heartbeatIntervalRef = useRef<number | undefined>(undefined);
  const pongWatchdogRef = useRef<number | undefined>(undefined);
  const connectRef = useRef<() => void>(() => {});
  const sessionStartedAtRef = useRef(sessionStartedAtMs);
  sessionStartedAtRef.current = sessionStartedAtMs;

  const onRegisterRef = useRef(onRegisterIncomingCall);
  const onIdleRef = useRef(onIdle);
  onRegisterRef.current = onRegisterIncomingCall;
  onIdleRef.current = onIdle;

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current !== undefined) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
    if (pongWatchdogRef.current !== undefined) {
      window.clearTimeout(pongWatchdogRef.current);
      pongWatchdogRef.current = undefined;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== undefined) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = undefined;
    }
  }, []);

  const closeActiveSocket = useCallback(() => {
    const ws = activeWsRef.current;
    if (!ws) return;
    ws.onmessage = null;
    ws.onopen = null;
    ws.onclose = null;
    ws.onerror = null;
    if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    activeWsRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearHeartbeat();
      clearReconnectTimer();
      closeActiveSocket();
    };
  }, [clearHeartbeat, clearReconnectTimer, closeActiveSocket]);

  useEffect(() => {
    const onOnline = () => {
      setBrowserOnline(true);
      clearReconnectTimer();
      retryRef.current = 0;
      clearHeartbeat();
      closeActiveSocket();
      connectRef.current();
    };
    const onOffline = () => setBrowserOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [clearHeartbeat, clearReconnectTimer, closeActiveSocket]);

  useEffect(() => {
    if (!enabled || !salaId || !token) return;

    let cancelled = false;
    const sessionId = ++wsEffectSessionRef.current;

    const recoverPendingCalls = async () => {
      try {
        const pending = await api.getPendingCallsForSala(salaId, token);
        if (!mountedRef.current || cancelled || sessionId !== wsEffectSessionRef.current) return;

        const sessionCutoff = sessionStartedAtRef.current - 5_000;
        const recentCutoff = Date.now() - CATCHUP_RECENT_MS;

        const sorted = [...pending].sort(
          (a, b) => Date.parse(a.fecha_llamada) - Date.parse(b.fecha_llamada),
        );

        for (const call of sorted) {
          const t = Date.parse(call.fecha_llamada);
          const inSession = Number.isFinite(t) ? t >= sessionCutoff : true;
          const inRecent = Number.isFinite(t) ? t >= recentCutoff : true;
          if (!inSession && !inRecent) continue;
          onRegisterRef.current(currentCallToEvent(call), false);
        }
      } catch {
        /* Sin API: el WS seguirá intentando */
      }
    };

    const scheduleReconnect = (delayMs: number, connect: () => void) => {
      clearReconnectTimer();
      reconnectTimerRef.current = window.setTimeout(connect, delayMs);
    };

    const startHeartbeat = (ws: WebSocket) => {
      clearHeartbeat();
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (cancelled || sessionId !== wsEffectSessionRef.current) return;
        if (ws.readyState !== WebSocket.OPEN) return;

        ws.send("ping");

        if (pongWatchdogRef.current !== undefined) {
          window.clearTimeout(pongWatchdogRef.current);
        }
        pongWatchdogRef.current = window.setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          setStatus("reconnecting");
          scheduleReconnect(FAST_RECONNECT_MS, connect);
        }, PONG_TIMEOUT_MS);
      }, PING_INTERVAL_MS);
    };

    const connect = () => {
      if (cancelled) return;
      setStatus(retryRef.current === 0 ? "connecting" : "reconnecting");

      closeActiveSocket();

      const ws = new WebSocket(wsUrl(salaId, token));
      activeWsRef.current = ws;

      ws.onopen = () => {
        if (cancelled || sessionId !== wsEffectSessionRef.current) return;
        retryRef.current = 0;
        setStatus("connected");
        startHeartbeat(ws);
        void recoverPendingCalls();
      };

      ws.onmessage = (ev) => {
        if (cancelled || sessionId !== wsEffectSessionRef.current) return;
        try {
          const raw = ev.data;
          if (typeof raw === "string" && raw.trim().toLowerCase() === "pong") {
            if (pongWatchdogRef.current !== undefined) {
              window.clearTimeout(pongWatchdogRef.current);
              pongWatchdogRef.current = undefined;
            }
            return;
          }

          const msg = JSON.parse(raw) as ScreenWsMessage;
          if (msg.type === "pong") {
            if (pongWatchdogRef.current !== undefined) {
              window.clearTimeout(pongWatchdogRef.current);
              pongWatchdogRef.current = undefined;
            }
            return;
          }
          if (msg.type === "patient_call") {
            const fromHistorySync = msg.play_audio === false;
            onRegisterRef.current(msg, fromHistorySync);
          } else if (msg.type === "idle") {
            onIdleRef.current();
          } else if (msg.type === "ping") {
            ws.send("ping");
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        if (activeWsRef.current === ws) activeWsRef.current = null;
        clearHeartbeat();
        setStatus("reconnecting");
        const delay =
          typeof navigator !== "undefined" && !navigator.onLine
            ? FAST_RECONNECT_MS
            : Math.min(30_000, 1000 * 2 ** retryRef.current);
        retryRef.current += 1;
        scheduleReconnect(delay, connect);
      };

      ws.onerror = () => ws.close();
    };

    connectRef.current = connect;
    connect();

    return () => {
      cancelled = true;
      clearHeartbeat();
      clearReconnectTimer();
      closeActiveSocket();
    };
  }, [enabled, salaId, token, clearHeartbeat, clearReconnectTimer, closeActiveSocket]);

  return { status, browserOnline };
}

export function useCallExpiry(call: CurrentCall | null, onExpire: () => void): void {
  useEffect(() => {
    if (!call) return;
    const expiresAt = new Date(call.fecha_expiracion).getTime();
    const tick = () => {
      if (Date.now() >= expiresAt) onExpire();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [call, onExpire]);
}