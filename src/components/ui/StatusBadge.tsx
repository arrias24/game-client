import { StatusGameStation } from '@types';

interface BadgeTheme {
    bg: string;
    text: string;
    border: string;
    dot: string;
}

export const StatusBadge = ({ status }: { status: StatusGameStation }) => {
    const getTheme = (): BadgeTheme => {
        switch (status) {
            case StatusGameStation.IDLE:
                return { bg: 'rgba(34, 197, 94, 0.1)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.25)', dot: '#22c55e' };
            case StatusGameStation.PREPARING:
                return { bg: 'rgba(245, 158, 11, 0.1)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.25)', dot: '#f59e0b' };
            case StatusGameStation.READY:
                return { bg: 'rgba(59, 130, 246, 0.1)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.25)', dot: '#3b82f6' };
            case StatusGameStation.PLAYING:
                return { bg: 'rgba(168, 85, 247, 0.1)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.25)', dot: '#a855f7' };
            case StatusGameStation.FAILED:
                return { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171', border: 'rgba(239, 68, 68, 0.25)', dot: '#ef4444' };
            default:
                return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)', dot: '#64748b' };
        }
    };

    const theme = getTheme();

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
            textTransform: 'uppercase'
        }}>
            <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: theme.dot,
                boxShadow: `0 0 6px ${theme.dot}`
            }} />
            {status}
        </span>
    );
};