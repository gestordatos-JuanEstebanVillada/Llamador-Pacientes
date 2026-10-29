import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../lib/api";
import type { CurrentCall, PatientCallEvent, ScreenWsMessage } from "../types";

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
  onPatientCall: (event: PatientCallEvent, fromHistorySync: boolean) => void;
  onIdle: () => void;
}

export function useSalaWebSocket({ salaId, token, enabled, onPatientCall, onIdle }: SalaWsOptions) {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "reconnecting">("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const wsEffectSessionRef = useRef(0);
  const mountedRef = useRef(true);
  const callbacksRef = useRef({ onPatientCall, onIdle });
  callbacksRef.current = { onPatientCall, onIdle };

  /** Recupera llamadas ACTIVA perdidas durante un corte de red (FIFO, con audio). */
  const recoverPendingCalls = useCallback(async () => {
    try {
      const pending = await api.getPendingCallsForSala(salaId, token);
      if (!mountedRef.current) return;
      if (pending.length === 0) {
        return;
      }
      for (const call of pending) {
        callbacksRef.current.onPatientCall(currentCallToEvent(call), false);
      }
    } catch {
      /* Sin API: el WS seguirá intentando */
    }
  }, [salaId, token]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!enabled || !salaId || !token) return;

    let cancelled = false;
    let reconnectTimer: number | undefined;
    const sessionId = ++wsEffectSessionRef.current;

    const connect = async () => {
      if (cancelled) return;
      setStatus(retryRef.current === 0 ? "connecting" : "reconnecting");

      const ws = new WebSocket(wsUrl(salaId, token));
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("connected");
        void recoverPendingCalls();
      };

      ws.onmessage = (ev) => {
        if (cancelled || sessionId !== wsEffectSessionRef.current) return;
        try {
          const msg = JSON.parse(ev.data) as ScreenWsMessage;
          if (msg.type === "patient_call") {
            callbacksRef.current.onPatientCall(msg, false);
          } else if (msg.type === "idle") {
            callbacksRef.current.onIdle();
          } else if (msg.type === "ping") {
            ws.send("ping");
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus("reconnecting");
        const delay = Math.min(30000, 1000 * 2 ** retryRef.current);
        retryRef.current += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, salaId, token, recoverPendingCalls]);

  return { status };
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
