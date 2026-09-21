import { useCallback, useEffect, useRef, useState } from 'react';
import {
    connectControl,
    getHealth,
    launch as launchStation,
    newSessionId,
    prepare as prepareStation,
    stationErrorMessage,
    stop as stopStation,
    GAME_ID,
} from '@services';
import { attachWebrtc } from '@/webrtc/session.ts';
import { StatusGameStation } from '@/types';
import type { RtcStatsSnapshot } from '@/webrtc/stats.ts';
import { normalizeNeeds, type InputNeeds } from '@/webrtc/input.ts';
import type { MouseHud } from '@/webrtc/pointer.ts';

const MAX_LOGS = 120;

export const useStation = () => {
    const [status, setStatus] = useState<StatusGameStation>(StatusGameStation.IDLE);
    const [progress, setProgress] = useState(0);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [hasTrack, setHasTrack] = useState(false);
    const [needs, setNeeds] = useState<InputNeeds>(() => normalizeNeeds(null));
    const [padIds, setPadIds] = useState<string[]>([]);
    const [heldKeys, setHeldKeys] = useState<string[]>([]);
    const [mouseHud, setMouseHud] = useState<MouseHud | null>(null);
    const [pointerLocked, setPointerLocked] = useState(false);
    const [rtcStats, setRtcStats] = useState<RtcStatsSnapshot | null>(null);
    const [sessionId, setSessionId] = useState(newSessionId);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const peerCleanupRef = useRef<(() => void) | null>(null);

    const appendLog = useCallback((line: string) => {
        const stamp = new Date().toLocaleTimeString();
        setLogs((prev) => [...prev.slice(-(MAX_LOGS - 1)), `${stamp}  ${line}`]);
    }, []);

    const closePeer = useCallback(() => {
        peerCleanupRef.current?.();
        peerCleanupRef.current = null;
        const video = videoRef.current;
        if (video) video.srcObject = null;
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.srcObject = null;
        }
        setHasTrack(false);
        setPadIds([]);
        setHeldKeys([]);
        setMouseHud(null);
        setPointerLocked(false);
        setRtcStats(null);
    }, []);

    useEffect(() => {
        void getHealth()
            .then((data) => {
                if (data.state) setStatus(data.state);
                if (data.needs) {
                    const n = normalizeNeeds(data.needs);
                    setNeeds(n);
                    appendLog(
                        `health ${data.state} pads=${n.gamepad} keyboard=${n.keyboard} mouse=${n.mouse}`,
                    );
                } else {
                    appendLog(`health ${data.state}`);
                }
            })
            .catch(() => {
                setStatus(StatusGameStation.FAILED);
                setError('Estación offline');
                appendLog('health failed');
            });

        const disconnect = connectControl(
            (ev) => {
                if (ev.type === 'STATE') {
                    if (ev.state) setStatus(ev.state);
                    if (typeof ev.progress === 'number') setProgress(ev.progress);
                    setError(null);
                    appendLog(`STATE ${ev.state ?? ''} ${ev.progress ?? ''}${ev.cacheHit ? ' cacheHit' : ''}`.trim());
                    return;
                }
                if (ev.type === 'ERROR') {
                    setStatus(StatusGameStation.FAILED);
                    setError(ev.message || 'Error en la estación');
                    appendLog(`ERROR ${ev.code ?? ev.message ?? ''}`);
                }
            },
            (open) => {
                setConnected(open);
                appendLog(open ? 'ws control open' : 'ws control closed');
            },
        );

        return () => {
            closePeer();
            disconnect();
        };
    }, [appendLog, closePeer]);

    useEffect(() => {
        if (status !== StatusGameStation.PLAYING) return;
        const timer = window.setTimeout(() => {
            const video = videoRef.current;
            if (!hasTrack) {
                setError('sin video — ¿display en la estación? / ¿HTTPS?');
                return;
            }
            if (video && video.videoWidth === 0) {
                setError('video sin frames — click en la pantalla');
            }
        }, 4000);
        return () => window.clearTimeout(timer);
    }, [status, hasTrack]);

    const prepare = async () => {
        setLoading(true);
        setError(null);
        try {
            await prepareStation(sessionId);
            appendLog(`prepare 202 game=${GAME_ID}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al preparar';
            setError(message);
            appendLog(`prepare error ${message}`);
        } finally {
            setLoading(false);
        }
    };

    const launch = async () => {
        setLoading(true);
        setError(null);
        try {
            const launched = await launchStation(sessionId);
            const inputNeeds = launched.needs ? normalizeNeeds(launched.needs) : needs;
            if (launched.needs) setNeeds(inputNeeds);
            appendLog(
                `launch 200 game=${GAME_ID} pads=${inputNeeds.gamepad} keyboard=${inputNeeds.keyboard} mouse=${inputNeeds.mouse}`,
            );
            const video = videoRef.current;
            const audio = audioRef.current;
            if (!video) throw new Error('No hay elemento de video');
            if (!audio) throw new Error('No hay elemento de audio');
            closePeer();
            video.muted = false;
            video.playsInline = true;
            video.tabIndex = 0;
            (document.activeElement as HTMLElement | null)?.blur();
            video.focus();
            audio.muted = false;
            void video.play().catch(() => {
                video.muted = true;
                void video.play().catch(() => {
                    /* gesto de Jugar: desbloquea autoplay en Safari/HTTP */
                });
            });
            void audio.play().catch(() => {
                audio.muted = true;
            });
            peerCleanupRef.current = attachWebrtc({
                signalPath: launched.wsUrl || '/ws/webrtc',
                video,
                audio,
                needs: inputNeeds,
                onTrack: (stream) => setHasTrack(Boolean(stream)),
                onLog: appendLog,
                onError: (code) => setError(stationErrorMessage(code)),
                onPads: setPadIds,
                onKeys: setHeldKeys,
                onMouse: setMouseHud,
                onPointerLock: setPointerLocked,
                onStats: setRtcStats,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al lanzar';
            setError(message);
            appendLog(`launch error ${message}`);
            closePeer();
        } finally {
            setLoading(false);
        }
    };

    const stop = async () => {
        setLoading(true);
        setError(null);
        closePeer();
        try {
            await stopStation(sessionId);
            appendLog('stop 204');
            setSessionId(newSessionId());
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al detener';
            setError(message);
            appendLog(`stop error ${message}`);
        } finally {
            setLoading(false);
        }
    };

    return {
        status,
        progress,
        connected,
        loading,
        error,
        logs,
        hasTrack,
        needs,
        padIds,
        heldKeys,
        mouseHud,
        pointerLocked,
        rtcStats,
        videoRef,
        audioRef,
        prepare,
        launch,
        stop,
    };
};
