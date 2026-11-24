/** Eco WS + catch-up + reconexión en producción (inmune a zona horaria). */
export const INCOMING_CALL_DEDUP_MS = 8_000;

export function buildCanonicalCallKey(
  salaId: number,
  consultorio: string,
  paciente: string,
): string {
  return `${String(salaId).trim()}|${String(consultorio).trim().toUpperCase()}|${String(paciente).trim().toUpperCase()}`;
}

export function shouldIgnoreIncomingCall(
  seenIdsRef: Set<string | number>,
  recentCallsMap: Map<string, number>,
  params: {
    callId?: number;
    canonicalKey: string;
    now?: number;
  },
): boolean {
  const now = params.now ?? Date.now();
  const id = params.callId;
  if (id != null && id > 0) {
    const idKey = String(id);
    if (seenIdsRef.has(id) || seenIdsRef.has(idKey)) return true;
  }
  const last = recentCallsMap.get(params.canonicalKey);
  if (last != null && now - last < INCOMING_CALL_DEDUP_MS) return true;
  return false;
}

export function markIncomingCallAccepted(
  seenIdsRef: Set<string | number>,
  recentCallsMap: Map<string, number>,
  params: {
    callId?: number;
    canonicalKey: string;
    now?: number;
  },
): void {
  const now = params.now ?? Date.now();
  const id = params.callId;
  if (id != null && id > 0) {
    seenIdsRef.add(id);
    seenIdsRef.add(String(id));
  }
  recentCallsMap.set(params.canonicalKey, now);
  for (const [key, ts] of recentCallsMap.entries()) {
    if (now - ts > INCOMING_CALL_DEDUP_MS) recentCallsMap.delete(key);
  }
}