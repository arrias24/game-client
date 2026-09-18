import { StatusGameStation } from '@/types';

interface Props {
    status: StatusGameStation;
    connected: boolean;
    loading: boolean;
    onPrepare: () => void;
    onLaunch: () => void;
    onStop: () => void;
}

export const Controls = ({ status, connected, loading, onPrepare, onLaunch, onStop }: Props) => {
    const online = connected && !loading;
    const canPrepare = online && status === StatusGameStation.IDLE;
    const canLaunch = online && status === StatusGameStation.READY;
    const canStop = online && (
        status === StatusGameStation.PREPARING
        || status === StatusGameStation.READY
        || status === StatusGameStation.PLAYING
        || status === StatusGameStation.FAILED
    );

    return (
        <div className="controls">
            <button type="button" onClick={onPrepare} disabled={!canPrepare}>Preparar</button>
            <button type="button" onClick={onLaunch} disabled={!canLaunch}>Jugar</button>
            <button type="button" onClick={onStop} disabled={!canStop}>Detener</button>
        </div>
    );
};
