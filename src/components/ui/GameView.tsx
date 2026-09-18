import type { RefObject } from 'react';

export const GameView = ({
    videoRef,
    hasTrack,
}: {
    videoRef: RefObject<HTMLVideoElement | null>;
    hasTrack: boolean;
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
                onClick={unmute}
            />
            {!hasTrack && (
                <div className="game-view__placeholder">pantalla de juego (S1)</div>
            )}
        </div>
    );
};
