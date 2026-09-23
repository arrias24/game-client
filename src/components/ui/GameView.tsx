import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type MouseEvent,
    type ReactNode,
    type RefObject,
} from 'react';
import { PadHud } from './PadHud.tsx';
import { InputHud, type MouseHud } from './InputHud.tsx';
import { RtcStatsOverlay } from './RtcStats.tsx';
import type { RtcStatsSnapshot } from '@/webrtc/stats.ts';
import type { InputNeeds } from '@/webrtc/input.ts';

const HIDE_DELAY_MS = 2400;

type FsDoc = Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
};

type FsEl = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
};

type FsVideo = HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitExitFullscreen?: () => void;
    webkitDisplayingFullscreen?: boolean;
};

function activeFullscreenEl(): Element | null {
    const doc = document as FsDoc;
    return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function enterFullscreen(container: HTMLElement, video: HTMLVideoElement | null) {
    const node = container as FsEl;
    try {
        if (node.requestFullscreen) {
            await node.requestFullscreen();
            return;
        }
        if (node.webkitRequestFullscreen) {
            await node.webkitRequestFullscreen();
            return;
        }
    } catch {
        /* el embed puede bloquear Fullscreen API */
    }
    try {
        if (video?.requestFullscreen) {
            await video.requestFullscreen();
            return;
        }
    } catch {
        /* fallback iOS / webkit */
    }
    (video as FsVideo | null)?.webkitEnterFullscreen?.();
}

async function exitFullscreen(video: HTMLVideoElement | null) {
    const doc = document as FsDoc;
    try {
        if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
            return;
        }
        if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
            await doc.webkitExitFullscreen();
            return;
        }
    } catch {
        /* ignore */
    }
    const v = video as FsVideo | null;
    if (v?.webkitDisplayingFullscreen) v.webkitExitFullscreen?.();
}

function inputHint(needs: InputNeeds, padIds: string[], pointerLocked: boolean): string | null {
    const parts: string[] = [];
    if (needs.gamepad > 0 && padIds.length === 0) {
        parts.push(
            needs.gamepad === 1
                ? 'conectá un gamepad y apretá un botón'
                : `conectá hasta ${needs.gamepad} gamepads`,
        );
    }
    if (needs.keyboard) parts.push('teclado activo');
    if (needs.mouse && !pointerLocked) parts.push('click en el video para la cámara');
    return parts.length ? parts.join(' · ') : null;
}

export const GameView = ({
    videoRef,
    audioRef,
    hasTrack,
    needs,
    padIds,
    heldKeys,
    mouseHud,
    pointerLocked,
    banner,
    actions,
    stats,
}: {
    videoRef: RefObject<HTMLVideoElement | null>;
    audioRef: RefObject<HTMLAudioElement | null>;
    hasTrack: boolean;
    needs: InputNeeds;
    padIds: string[];
    heldKeys: string[];
    mouseHud: MouseHud | null;
    pointerLocked: boolean;
    banner?: ReactNode;
    actions?: ReactNode;
    stats?: RtcStatsSnapshot | null;
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<number>(0);
    const [controlsOn, setControlsOn] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [muted, setMuted] = useState(false);

    const showControls = useCallback((sticky = false) => {
        setControlsOn(true);
        window.clearTimeout(hideTimer.current);
        if (sticky || !hasTrack) return;
        hideTimer.current = window.setTimeout(() => setControlsOn(false), HIDE_DELAY_MS);
    }, [hasTrack]);

    useEffect(() => {
        showControls(!hasTrack);
        return () => window.clearTimeout(hideTimer.current);
    }, [hasTrack, showControls]);

    useEffect(() => {
        const sync = () => {
            const container = containerRef.current;
            const video = videoRef.current as FsVideo | null;
            setIsFullscreen(
                activeFullscreenEl() === container
                || Boolean(video?.webkitDisplayingFullscreen),
            );
        };
        document.addEventListener('fullscreenchange', sync);
        document.addEventListener('webkitfullscreenchange', sync);
        const video = videoRef.current;
        video?.addEventListener('webkitbeginfullscreen', sync);
        video?.addEventListener('webkitendfullscreen', sync);
        return () => {
            document.removeEventListener('fullscreenchange', sync);
            document.removeEventListener('webkitfullscreenchange', sync);
            video?.removeEventListener('webkitbeginfullscreen', sync);
            video?.removeEventListener('webkitendfullscreen', sync);
        };
    }, [videoRef]);

    useEffect(() => {
        const video = videoRef.current;
        const audio = audioRef.current;
        if (!hasTrack || !video) return;
        video.muted = false;
        if (audio) audio.muted = false;
        setMuted(false);
        void video.play().catch(() => undefined);
        if (audio) void audio.play().catch(() => undefined);
    }, [hasTrack, videoRef, audioRef]);

    const unmute = () => {
        const video = videoRef.current;
        const audio = audioRef.current;
        if (!video) return;
        video.muted = false;
        if (audio) audio.muted = false;
        setMuted(false);
        void video.play().catch(() => {
            video.muted = true;
            if (audio) audio.muted = true;
            setMuted(true);
        });
        if (audio) {
            void audio.play().catch(() => {
                audio.muted = true;
                setMuted(true);
            });
        }
    };

    const toggleFullscreen = (event: MouseEvent) => {
        event.stopPropagation();
        const container = containerRef.current;
        if (!container) return;
        if (isFullscreen) {
            void exitFullscreen(videoRef.current);
            return;
        }
        void enterFullscreen(container, videoRef.current);
    };

    const togglePointerLock = (event: MouseEvent) => {
        event.stopPropagation();
        const container = containerRef.current;
        const video = videoRef.current;
        if (!container && !video) return;
        if (pointerLocked) {
            document.exitPointerLock();
            return;
        }
        const target = container ?? video!;
        void target.requestPointerLock({ unadjustedMovement: true });
    };

    const capturePointer = (event: MouseEvent) => {
        event.stopPropagation();
        const container = containerRef.current;
        const video = videoRef.current;
        if ((!container && !video) || pointerLocked) return;
        const target = container ?? video!;
        void target.requestPointerLock({ unadjustedMovement: true });
    };

    const hint = hasTrack ? inputHint(needs, padIds, pointerLocked) : null;
    const classes = [
        'game-view',
        controlsOn ? 'is-controls' : 'is-idle',
        hasTrack ? 'has-track' : '',
        needs.mouse ? 'has-mouse' : '',
        pointerLocked ? 'is-locked' : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            ref={containerRef}
            className={classes}
            tabIndex={0}
            onMouseMove={() => showControls()}
            onPointerDown={() => showControls()}
            onMouseLeave={() => {
                if (hasTrack) setControlsOn(false);
            }}
            onDoubleClick={(event) => {
                if (!needs.mouse) return;
                event.preventDefault();
                event.stopPropagation();
            }}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                controls={false}
                width={1280}
                height={720}
                onClick={needs.mouse ? capturePointer : unmute}
                onDoubleClick={needs.mouse ? undefined : toggleFullscreen}
            />
            <audio ref={audioRef} autoPlay />
            {!hasTrack && (
                <div className="game-view__placeholder">pantalla de juego</div>
            )}
            {hasTrack && <RtcStatsOverlay stats={stats ?? null} />}
            {hint && <p className="game-view__hint">{hint}</p>}
            {hasTrack && (needs.keyboard || needs.mouse) && (
                <InputHud keyboard={needs.keyboard} keys={heldKeys} mouse={mouseHud} />
            )}
            {hasTrack && padIds.length > 0 && <PadHud ids={padIds} />}

            {banner && <div className="game-view__banner">{banner}</div>}

            <div
                className="game-view__bar"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => showControls(true)}
                onMouseLeave={() => showControls()}
            >
                <div className="game-view__actions">{actions}</div>
                {needs.mouse && hasTrack && (
                    <button
                        type="button"
                        className={`game-view__fs${pointerLocked ? ' is-on' : ''}`}
                        onClick={togglePointerLock}
                        aria-label={pointerLocked ? 'Liberar puntero' : 'Capturar puntero'}
                        title={pointerLocked ? 'Liberar puntero' : 'Capturar puntero'}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path
                                fill="currentColor"
                                d="M5.5 3.2v16.3l4.2-4.1 2.5 6 2.2-.9-2.5-6h6.4L5.5 3.2z"
                            />
                        </svg>
                    </button>
                )}
                <button
                    type="button"
                    className="game-view__fs"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                    title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                >
                    {isFullscreen ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path
                                fill="currentColor"
                                d="M7 14H5v5h5v-2H7v-3zm12 0h-2v3h-3v2h5v-5zM7 7h3V5H5v5h2V7zm7-2v2h3v3h2V5h-5z"
                            />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path
                                fill="currentColor"
                                d="M7 14H5v5h5v-2H7v-3zm12 0h-2v3h-3v2h5v-5zM7 10H5V5h5v2H7v3zm12-5h-5v2h3v3h2V5z"
                            />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
};
