import { restUrl } from './urls.ts';
import type { Health, LaunchResponse, PrepareResponse, StationErrorBody } from '@/types';

export const GAME_ID = import.meta.env.VITE_GAME_ID || 'test-pattern';

const ERROR_UI: Record<string, string> = {
    STATION_BUSY: 'El Spark está en partida. Probá en un minuto.',
    GAME_NOT_READY: 'Hay que esperar a que termine de preparar.',
    PREPARE_IN_PROGRESS: 'La estación ya está ocupada.',
    PEER_BUSY: 'Ya hay un peer en esta estación.',
    NOT_PLAYING: 'La estación no está en partida.',
};

export function stationErrorMessage(code: string) {
    return ERROR_UI[code] ?? code;
}

export class StationRequestError extends Error {
    readonly code: string;

    constructor(code: string) {
        super(stationErrorMessage(code));
        this.name = 'StationRequestError';
        this.code = code;
    }
}

async function readError(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as StationErrorBody;
        return body.error?.code ?? `HTTP ${res.status}`;
    } catch {
        return `HTTP ${res.status}`;
    }
}

export function newSessionId() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') {
        return c.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (c && typeof c.getRandomValues === 'function') {
        c.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function getHealth(): Promise<Health> {
    const res = await fetch(restUrl('/health'));
    if (!res.ok) throw new StationRequestError(await readError(res));
    return res.json() as Promise<Health>;
}

export async function prepare(sessionId: string): Promise<PrepareResponse> {
    const res = await fetch(restUrl('/prepare'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId,
            gameId: GAME_ID,
            version: '1.0.0',
            source: {
                type: 'local',
                path: '/library/test-pattern/1.0.0',
                checksum: 'sha256:00',
            },
        }),
    });
    if (res.status !== 202) throw new StationRequestError(await readError(res));
    return res.json() as Promise<PrepareResponse>;
}

export async function launch(sessionId: string): Promise<LaunchResponse> {
    const res = await fetch(restUrl('/launch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, gameId: GAME_ID }),
    });
    if (!res.ok) throw new StationRequestError(await readError(res));
    return res.json() as Promise<LaunchResponse>;
}

export async function stop(sessionId: string) {
    const res = await fetch(restUrl('/stop'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
    });
    if (!res.ok && res.status !== 204) throw new StationRequestError(await readError(res));
}

export const stationApi = {
    getHealth,
    prepare,
    launch,
    stop,
    newSessionId,
};
