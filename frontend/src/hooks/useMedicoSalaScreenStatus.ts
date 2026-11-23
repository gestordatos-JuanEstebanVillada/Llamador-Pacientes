import { useEffect, useRef, useState } from "react";

import type { MedicoWsMessage, ScreenStatusEvent } from "../types";

const RECONNECT_MS = 3_000;

function medicoWsUrl(salaId: number, token: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const params = new URLSearchParams({ token });
  return `${proto}://${window.location.host}/ws/medicos/salas/${salaId}?${params.toString()}`;
}

function parseScreenStatus(raw: unknown): ScreenStatusEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as MedicoWsMessage;
  if (msg.type !== "screen_status") return null;
  return msg;
}

interface Options {
  salaId: number;
  token: string;
  enabled: boolean;
}

export function useMedicoSalaScreenStatus({ salaId, token, enabled }: Options) {
  const [screenOnline, setScreenOnline] = useState(false);
  const [activeScreens, setActiveScreens] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const retryRef = useRef(0);

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

  useEffect(() => {
    if (!enabled || !salaId || !token) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    const applyStatus = (event: ScreenStatusEvent) => {
      setScreenOnline(event.online);
      setActiveScreens(event.active_screens);
    };

    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(medicoWsUrl(salaId, token));

      ws.onopen = () => {
        if (cancelled) return;
        retryRef.current = 0;
        setWsConnected(true);
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const raw = ev.data;
          if (typeof raw === "string" && raw.trim().toLowerCase() === "pong") return;
          const msg = JSON.parse(raw) as MedicoWsMessage;
          if (msg.type === "pong") return;
          if (msg.type === "ping") {
            ws?.send("ping");
            return;
          }
          const status = parseScreenStatus(msg);
          if (status) applyStatus(status);
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setWsConnected(false);
        const delay =
          typeof navigator !== "undefined" && !navigator.onLine
            ? RECONNECT_MS
            : Math.min(30_000, RECONNECT_MS * 2 ** retryRef.current);
        retryRef.current += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      ws?.close();
      ws = null;
    };
  }, [enabled, salaId, token]);

  const canCall = browserOnline && screenOnline;

  return { screenOnline, activeScreens, browserOnline, wsConnected, canCall };
}

export const MEDICO_NO_INTERNET_MSG =
  "No se puede llamar al paciente porque no hay conexión a internet.";