import { restUrl } from './urls.ts';
import type { Health, LaunchResponse, PrepareResponse, StationErrorBody } from '@/types';

const SESSION_GAME = {
    gameId: 'test-pattern',
};

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
    return crypto.randomUUID();
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
            gameId: SESSION_GAME.gameId,
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
        body: JSON.stringify({ sessionId, gameId: SESSION_GAME.gameId }),
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
