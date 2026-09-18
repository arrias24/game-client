import { useState, useEffect, useRef, useCallback } from 'react';
import { stationApi } from '@services/stationApi';
import { StatusGameStation } from '@types/statusGameStation';

const STATION_URL = import.meta.env.VITE_STATION_URL || 'http://localhost:8090';
const WS_CONTROL_URL = STATION_URL.replace(/^http/, 'ws') + '/ws/control';

export const useStation = () => {
    const [status, setStatus] = useState<StatusGameStation>(StatusGameStation.IDLE);
    const [progress, setProgress] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
    const wsRef = useRef<WebSocket | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const data = await stationApi.getHealth();
            if (data.state) setStatus(data.state as StatusGameStation);
        } catch {
            setStatus(StatusGameStation.FAILED);
            setError('Estación offline');
        }
    }, []);

    useEffect(() => {
        fetchStatus();

        const ws = new WebSocket(WS_CONTROL_URL);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'STATE') {
                    if (data.state) setStatus(data.state as StatusGameStation);
                    if (typeof data.progress === 'number') setProgress(data.progress);
                    setError(null);
                } else if (data.type === 'ERROR') {
                    setStatus(StatusGameStation.FAILED);
                    setError(data.message || 'Error en la estación');
                }
            } catch (err) {
                console.error('Error parseando evento WS:', err);
            }
        };

        ws.onerror = () => setError('Error de conexión con la estación');

        return () => ws.close();
    }, [fetchStatus]);

    const prepare = async () => {
        setLoading(true);
        setError(null);
        try {
            await stationApi.prepare(sessionId);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const launch = async () => {
        setLoading(true);
        setError(null);
        try {
            await stationApi.launch(sessionId);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const stop = async () => {
        setLoading(true);
        try {
            await stationApi.stop(sessionId);
            setSessionId(crypto.randomUUID());
        } catch (err: any) {
            console.error('Error deteniendo sesión:', err);
        } finally {
            setLoading(false);
        }
    };

    return {
        status,
        progress,
        loading,
        error,
        prepare,
        launch,
        stop,
        refresh: fetchStatus,
    };
};