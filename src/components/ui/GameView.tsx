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

export const GameView = ({
    videoRef,
    hasTrack,
    padId,
    banner,
    actions,
}: {
    videoRef: RefObject<HTMLVideoElement | null>;
    hasTrack: boolean;
    padId: string | null;
    banner?: ReactNode;
    actions?: ReactNode;
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<number>(0);
    const [controlsOn, setControlsOn] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

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

    const unmute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = false;
        void video.play().catch(() => {
            /* el browser puede pedir otro gesto */
        });
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

    return (
        <div
            ref={containerRef}
            className={`game-view${controlsOn ? ' is-controls' : ' is-idle'}${hasTrack ? ' has-track' : ''}`}
            onMouseMove={() => showControls()}
            onPointerDown={() => showControls()}
            onMouseLeave={() => {
                if (hasTrack) setControlsOn(false);
            }}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                width={1280}
                height={720}
                onClick={unmute}
                onDoubleClick={toggleFullscreen}
            />
            {!hasTrack && (
                <div className="game-view__placeholder">pantalla de juego</div>
            )}
            {hasTrack && !padId && (
                <p className="game-view__hint">conectá un gamepad y apretá un botón</p>
            )}
            {hasTrack && padId && <PadHud id={padId} />}

            {banner && <div className="game-view__banner">{banner}</div>}

            <div
                className="game-view__bar"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => showControls(true)}
                onMouseLeave={() => showControls()}
            >
                <div className="game-view__actions">{actions}</div>
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
