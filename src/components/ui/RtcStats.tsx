import type { RtcStatsSnapshot } from '@/webrtc/stats.ts';

function fmt(value: number | null, suffix: string) {
    if (value === null || Number.isNaN(value)) return '—';
    return `${value}${suffix}`;
}

export const RtcStatsOverlay = ({ stats }: { stats: RtcStatsSnapshot | null }) => {
    if (!stats) return null;
    return (
        <div className="rtc-stats" aria-label="WebRTC stats">
            <span>V {fmt(stats.videoKbps, ' kb/s')}</span>
            <span>A {fmt(stats.audioKbps, ' kb/s')}</span>
            <span>{fmt(stats.fps, ' fps')}</span>
            <span>RTT {fmt(stats.rttMs, ' ms')}</span>
            <span>lost {fmt(stats.lost, '')}</span>
        </div>
    );
};
