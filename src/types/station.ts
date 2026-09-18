import type { StatusGameStation } from './statusGameStation.ts';

export type Health = {
    status: string;
    stationId: string;
    state: StatusGameStation;
    gameId: string | null;
    sessionId: string | null;
    cache: unknown[];
};

export type ControlEvent = {
    type: 'STATE' | 'ERROR';
    state?: StatusGameStation;
    progress?: number;
    message?: string;
    cacheHit?: boolean;
    code?: string;
};

export type StationErrorBody = { error: { code: string; message: string } };

export type LaunchResponse = { state: string; wsUrl: string };

export type PrepareResponse = { sessionId: string; state: string };
