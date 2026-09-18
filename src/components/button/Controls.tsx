import { StatusGameStation } from '@types';

interface Props {
    status: StatusGameStation;
    loading: boolean;
    onPrepare: () => void;
    onLaunch: () => void;
    onStop: () => void;
}

export const Controls = ({ status, loading, onPrepare, onLaunch, onStop }: Props) => {

    const canPrepare = status === StatusGameStation.IDLE && !loading;
    const canLaunch = status === StatusGameStation.READY && !loading;
    const canStop = (status === StatusGameStation.PLAYING || status === StatusGameStation.FAILED || status === StatusGameStation.PREPARING) && !loading;

    return (
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={onPrepare} disabled={!canPrepare}>Preparar</button>
            <button onClick={onLaunch} disabled={!canLaunch}>Jugar</button>
            <button onClick={onStop} disabled={!canStop}>Detener</button>
        </div>
    );
};