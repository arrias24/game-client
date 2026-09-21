import { wsUrl } from '@services/api/urls.ts';
import { type InputNeeds, normalizeNeeds } from '@/webrtc/input.ts';
import { type MouseHud } from '@/webrtc/pointer.ts';
import { startInput } from '@/webrtc/pump.ts';
import { createPeer, type SignalIn } from '@/webrtc/peer.ts';
import { readRtcStats, type RtcStatsSnapshot } from '@/webrtc/stats.ts';

export function attachWebrtc(opts: {
    signalPath: string;
    video: HTMLVideoElement;
    audio: HTMLAudioElement;
    needs?: InputNeeds | null;
    onTrack: (stream: MediaStream | null) => void;
    onLog: (line: string) => void;
    onError: (code: string) => void;
    onPads?: (ids: string[]) => void;
    onKeys?: (held: string[]) => void;
    onMouse?: (state: MouseHud | null) => void;
    onPointerLock?: (locked: boolean) => void;
    onStats?: (stats: RtcStatsSnapshot) => void;
}) {
    const needs = normalizeNeeds(opts.needs);
    const ws = new WebSocket(wsUrl(opts.signalPath));
    let detachInput: (() => void) | null = null;
    const peer = createPeer({
        send: (msg) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (msg.type === 'OFFER') opts.onLog('→ OFFER');
            ws.send(JSON.stringify(msg));
        },
        onTrack: (stream) => {
            const picture = new MediaStream(stream.getVideoTracks());
            const sound = new MediaStream(stream.getAudioTracks());
            const videoTrack = picture.getVideoTracks()[0];
            const audioTrack = sound.getAudioTracks()[0];
            opts.onLog(
                `ontrack video=${videoTrack?.readyState ?? 'none'} audio=${audioTrack?.readyState ?? 'none'} av_sync=split`,
            );
            const video = opts.video;
            const audio = opts.audio;
            video.playsInline = true;
            video.autoplay = true;
            video.setAttribute('playsinline', 'true');
            video.setAttribute('webkit-playsinline', 'true');
            video.tabIndex = 0;
            video.focus();
            video.srcObject = picture;
            audio.autoplay = true;
            audio.setAttribute('playsinline', 'true');
            audio.srcObject = sound;
            audio.muted = video.muted;
            const play = () => {
                void video.play().then(
                    () => {
                        opts.onLog(
                            `video play ${video.videoWidth}x${video.videoHeight} muted=${video.muted}`,
                        );
                    },
                    () => {
                        opts.onLog('autoplay blocked — click the video');
                    },
                );
                void audio.play().then(
                    () => opts.onLog(`audio play muted=${audio.muted}`),
                    () => opts.onLog('audio play blocked'),
                );
            };
            video.onloadedmetadata = play;
            video.onplaying = () => {
                opts.onLog(`video playing ${video.videoWidth}x${video.videoHeight}`);
            };
            if (videoTrack) {
                videoTrack.onunmute = () => opts.onLog('track unmute');
                videoTrack.onmute = () => opts.onLog('track mute');
            }
            play();
            opts.onTrack(stream);
        },
        onState: (s) => opts.onLog(s),
    });

    peer.input.binaryType = 'arraybuffer';
    const mirrorMute = () => {
        opts.audio.muted = opts.video.muted;
        if (!opts.video.muted) void opts.audio.play().catch(() => undefined);
    };
    opts.video.addEventListener('volumechange', mirrorMute);
    let prevStats: { at: number; video: number; audio: number } | null = null;
    const statsTimer = window.setInterval(() => {
        void readRtcStats(peer.pc, prevStats).then(({ snap, next }) => {
            prevStats = next;
            opts.onStats?.(snap);
        });
    }, 1000);

    peer.input.onopen = () => {
        opts.onLog(
            `dc input open unreliable pads=${needs.gamepad} keyboard=${needs.keyboard} mouse=${needs.mouse}`,
        );
        detachInput = startInput({
            channel: peer.input,
            video: opts.video,
            needs,
            onPads: (ids) => {
                opts.onLog(
                    ids.length ? `gamepad ${ids.join(' · ')}` : 'gamepad desconectado',
                );
                opts.onPads?.(ids);
            },
            onKeys: opts.onKeys,
            onMouse: opts.onMouse,
            onLock: opts.onPointerLock,
            onLog: opts.onLog,
        });
    };

    ws.onmessage = async (ev) => {
        const msg = JSON.parse(String(ev.data)) as SignalIn;
        opts.onLog(`← ${msg.type}${msg.type === 'ERROR' ? ` ${msg.code}` : ''}`);
        if (msg.type === 'ERROR') {
            opts.onError(msg.code);
            detachInput?.();
            detachInput = null;
            peer.close();
            ws.close();
            return;
        }
        await peer.onSignal(msg);
    };

    ws.onopen = () => {
        void peer.offer();
    };

    ws.onerror = () => opts.onLog('ws webrtc error');

    return () => {
        window.clearInterval(statsTimer);
        opts.video.removeEventListener('volumechange', mirrorMute);
        detachInput?.();
        detachInput = null;
        opts.onPads?.([]);
        opts.onKeys?.([]);
        opts.onMouse?.(null);
        opts.onPointerLock?.(false);
        peer.close();
        ws.close();
        opts.video.srcObject = null;
        opts.audio.pause();
        opts.audio.srcObject = null;
        opts.onTrack(null);
    };
}
