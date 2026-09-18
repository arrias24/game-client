export type RtcStatsSnapshot = {
    videoKbps: number | null;
    audioKbps: number | null;
    rttMs: number | null;
    fps: number | null;
    lost: number | null;
};

function inbound(
    stats: RTCStatsReport,
    kind: 'video' | 'audio',
): RTCInboundRtpStreamStats | undefined {
    for (const item of stats.values()) {
        if (item.type === 'inbound-rtp' && item.kind === kind) {
            return item as RTCInboundRtpStreamStats;
        }
    }
    return undefined;
}

export async function readRtcStats(
    pc: RTCPeerConnection,
    prev: { at: number; video: number; audio: number } | null,
): Promise<{ snap: RtcStatsSnapshot; next: { at: number; video: number; audio: number } }> {
    const report = await pc.getStats();
    const now = performance.now();
    const video = inbound(report, 'video');
    const audio = inbound(report, 'audio');
    let rttMs: number | null = null;
    for (const item of report.values()) {
        if (item.type === 'candidate-pair' && (item as RTCIceCandidatePairStats).state === 'succeeded') {
            const rtt = (item as RTCIceCandidatePairStats).currentRoundTripTime;
            if (typeof rtt === 'number') rttMs = Math.round(rtt * 1000);
        }
    }
    const videoBytes = video?.bytesReceived ?? 0;
    const audioBytes = audio?.bytesReceived ?? 0;
    const dt = prev ? Math.max((now - prev.at) / 1000, 0.001) : 0;
    const videoKbps = prev ? Math.round(((videoBytes - prev.video) * 8) / dt / 1000) : null;
    const audioKbps = prev ? Math.round(((audioBytes - prev.audio) * 8) / dt / 1000) : null;
    const fps = typeof video?.framesPerSecond === 'number' ? Math.round(video.framesPerSecond) : null;
    const lost = (video?.packetsLost ?? 0) + (audio?.packetsLost ?? 0);
    return {
        snap: {
            videoKbps,
            audioKbps,
            rttMs,
            fps,
            lost: prev ? lost : null,
        },
        next: { at: now, video: videoBytes, audio: audioBytes },
    };
}
