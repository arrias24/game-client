export const StatusGameStation = {
    IDLE: 'IDLE',
    PREPARING: 'PREPARING',
    READY: 'READY',
    PLAYING: 'PLAYING',
    FAILED: 'FAILED',
} as const;

export type StatusGameStation = (typeof StatusGameStation)[keyof typeof StatusGameStation];
