import { useEffect, useRef } from 'react';
import { Controls, GameView, ProgressBar, StatusBadge } from '@components';
import { useStation } from '@hooks';
import { StatusGameStation } from '@/types';

export const HomeScreen = () => {
    const {
        status,
        progress,
        connected,
        loading,
        error,
        logs,
        hasTrack,
        padId,
        videoRef,
        prepare,
        launch,
        stop,
    } = useStation();
    const logRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        const el = logRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [logs]);

    return (
        <div className="station-page">
            <div className="station-body">
                <div className="station-main">
                    <header className="station-header">
                        <h1>Airtek Cloud Game</h1>
                        <StatusBadge status={status} connected={connected} progress={progress} />
                    </header>

                    {error && <div className="station-toast" role="alert">{error}</div>}

                    <section className="station-stage" aria-label="Video">
                        <GameView
                            videoRef={videoRef}
                            hasTrack={hasTrack}
                            padId={padId}
                            banner={connected && status === StatusGameStation.PREPARING
                                ? <ProgressBar progress={progress} />
                                : null}
                            actions={(
                                <Controls
                                    status={status}
                                    connected={connected}
                                    loading={loading}
                                    onPrepare={() => void prepare()}
                                    onLaunch={() => void launch()}
                                    onStop={() => void stop()}
                                />
                            )}
                        />
                    </section>
                </div>

                <aside className="station-aside" aria-label="Registro">
                    <span className="station-aside__label">Logs</span>
                    <pre ref={logRef} className="station-log">
                        {logs.join('\n') || 'esperando estación…'}
                    </pre>
                </aside>
            </div>
        </div>
    );
};
