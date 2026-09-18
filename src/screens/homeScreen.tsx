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
        videoRef,
        prepare,
        launch,
        stop,
    } = useStation();

    return (
        <div className="station-page">
            <div className="station-card">
                <header className="station-header">
                    <h1>Airtek Cloud Game</h1>
                    <StatusBadge status={status} connected={connected} progress={progress} />
                </header>

                {error && <div className="station-toast" role="alert">{error}</div>}

                <GameView videoRef={videoRef} hasTrack={hasTrack} />

                {connected && status === StatusGameStation.PREPARING && (
                    <ProgressBar progress={progress} />
                )}

                <Controls
                    status={status}
                    connected={connected}
                    loading={loading}
                    onPrepare={() => void prepare()}
                    onLaunch={() => void launch()}
                    onStop={() => void stop()}
                />

                <pre className="station-log">{logs.join('\n') || 'esperando estación…'}</pre>
            </div>
        </div>
    );
};
