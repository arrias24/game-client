import type { RefObject } from 'react';
import { PadHud } from './PadHud.tsx';

export const GameView = ({
    videoRef,
    hasTrack,
    padId,
}: {
    videoRef: RefObject<HTMLVideoElement | null>;
    hasTrack: boolean;
    padId: string | null;
}) => {
    const unmute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = false;
        void video.play().catch(() => {
            /* el browser puede pedir otro gesto */
        });
    };

    return (
        <div className="game-view">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                width={1280}
                height={720}
                onClick={unmute}
            />
            {!hasTrack && (
                <div className="game-view__placeholder">pantalla de juego</div>
            )}
            {hasTrack && !padId && (
                <p className="game-view__hint">conectá un gamepad y apretá un botón</p>
            )}
            {hasTrack && padId && <PadHud id={padId} />}
        </div>
    );
};
