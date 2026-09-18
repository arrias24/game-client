import type { StatusGameStation } from '@/types';
import { StatusGameStation as Station } from '@/types';

interface BadgeTheme {
    bg: string;
    text: string;
    border: string;
    dot: string;
}

const LABELS: Record<StatusGameStation, string> = {
    [Station.IDLE]: 'Libre',
    [Station.PREPARING]: 'Preparando',
    [Station.READY]: 'Listo',
    [Station.PLAYING]: 'En partida',
    [Station.FAILED]: 'Error',
};

export const StatusBadge = ({
    status,
    connected,
    progress,
}: {
    status: StatusGameStation;
    connected: boolean;
    progress?: number;
}) => {
    const getTheme = (): BadgeTheme => {
        if (!connected) {
            return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)', dot: '#64748b' };
        }
        switch (status) {
            case Station.IDLE:
                return { bg: 'rgba(34, 197, 94, 0.1)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.25)', dot: '#22c55e' };
            case Station.PREPARING:
                return { bg: 'rgba(245, 158, 11, 0.1)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.25)', dot: '#f59e0b' };
            case Station.READY:
                return { bg: 'rgba(59, 130, 246, 0.1)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.25)', dot: '#3b82f6' };
            case Station.PLAYING:
                return { bg: 'rgba(168, 85, 247, 0.1)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.25)', dot: '#a855f7' };
            case Station.FAILED:
                return { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171', border: 'rgba(239, 68, 68, 0.25)', dot: '#ef4444' };
            default:
                return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)', dot: '#64748b' };
        }
    };

    const theme = getTheme();
    const label = !connected
        ? 'Offline'
        : status === Station.PREPARING && typeof progress === 'number'
            ? `Preparando ${progress}%`
            : LABELS[status];

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            backgroundColor: theme.bg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            fontWeight: 600,
            fontSize: '11px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
        }}>
            <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: theme.dot,
                boxShadow: `0 0 6px ${theme.dot}`,
            }} />
            {label}
        </span>
    );
};
