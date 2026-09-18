const STATION_URL = import.meta.env.VITE_STATION_URL || 'http://localhost:8090';

export const stationApi = {
    getHealth: async () => {
        const res = await fetch(`${STATION_URL}/health`);
        return res.json();
    },
    prepare: async (sessionId: string) => {
        const res = await fetch(`${STATION_URL}/prepare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                gameId: 'test-pattern',
                version: '1.0.0',
                source: {
                    type: 'local',
                    path: '/library/test-pattern/1.0.0',
                    checksum: 'sha256:00',
                },
            }),
        });
        if (res.status === 409) throw new Error('Estación ocupada');
        return res.json();
    },
    launch: async (sessionId: string) => {
        const res = await fetch(`${STATION_URL}/launch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                gameId: 'test-pattern',
            }),
        });
        if (res.status === 409) throw new Error('Estación ocupada');
        if (res.status === 424) throw new Error('El juego no ha sido preparado');
        return res.json();
    },
    stop: async (sessionId: string) => {
        await fetch(`${STATION_URL}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
        });
    },
};