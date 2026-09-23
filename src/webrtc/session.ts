import { wsUrl } from '@services/api/urls.ts';
import { type InputNeeds, normalizeNeeds } from '@/webrtc/input.ts';
import { type MouseHud } from '@/webrtc/pointer.ts';
import { startInput } from '@/webrtc/pump.ts';
import { createPeer, type SignalIn } from '@/webrtc/peer.ts';
import { readRtcStats, type RtcStatsSnapshot } from '@/webrtc/stats.ts';

function bindStream(
    video: HTMLVideoElement,
    audio: HTMLAudioElement,
    picture: MediaStream,
    sound: MediaStream,
    onLog: (line: string) => void,
) {
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.tabIndex = 0;
    video.focus();
    if (video.srcObject !== picture) {
        video.srcObject = picture;
    }
    audio.autoplay = true;
    audio.setAttribute('playsinline', 'true');
    if (audio.srcObject !== sound) {
        audio.srcObject = sound;
    }
    video.muted = false;
    audio.muted = false;
    const play = () => {
        void video.play().then(
            () => onLog(`video play ${video.videoWidth}x${video.videoHeight} muted=${video.muted}`),
            (err) => onLog(`video play ${err instanceof Error ? err.message : err}`),
        );
        void audio.play().then(
            () => onLog(`audio play muted=${audio.muted}`),
            (err) => onLog(`audio play ${err instanceof Error ? err.message : err}`),
        );
    };
    video.onloadedmetadata = play;
    video.onplaying = () => {
        onLog(`video playing ${video.videoWidth}x${video.videoHeight}`);
    };
    const videoTrack = picture.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.onunmute = () => onLog('track unmute');
        videoTrack.onmute = () => onLog('track mute');
    }
    play();
}

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
    const picture = new MediaStream();
    const sound = new MediaStream();
    let avBound = false;
    const peer = createPeer({
        send: (msg) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (msg.type === 'OFFER') opts.onLog('→ OFFER');
            ws.send(JSON.stringify(msg));
        },
        onTrack: (stream) => {
            for (const track of stream.getVideoTracks()) {
                if (!picture.getTracks().some((t) => t.id === track.id)) {
                    picture.addTrack(track);
                }
            }
            for (const track of stream.getAudioTracks()) {
                if (!sound.getTracks().some((t) => t.id === track.id)) {
                    sound.addTrack(track);
                }
            }
            const videoTrack = picture.getVideoTracks()[0];
            const audioTrack = sound.getAudioTracks()[0];
            opts.onLog(
                `ontrack video=${videoTrack?.readyState ?? 'none'} audio=${audioTrack?.readyState ?? 'none'} av_sync=split`,
            );
            if (!avBound && (videoTrack || audioTrack)) {
                avBound = true;
                bindStream(opts.video, opts.audio, picture, sound, opts.onLog);
            } else if (audioTrack && sound.getAudioTracks().length === 1) {
                if (opts.audio.srcObject !== sound) {
                    opts.audio.srcObject = sound;
                }
                void opts.audio.play().catch(() => undefined);
            }
            opts.onTrack(new MediaStream([...picture.getTracks(), ...sound.getTracks()]));
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

    let signalChain = Promise.resolve();
    ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data)) as SignalIn;
        opts.onLog(`← ${msg.type}${msg.type === 'ERROR' ? ` ${msg.code}` : ''}`);
        signalChain = signalChain.then(async () => {
            if (msg.type === 'ERROR') {
                opts.onError(msg.code);
                detachInput?.();
                detachInput = null;
                peer.close();
                ws.close();
                return;
            }
            await peer.onSignal(msg);
        });
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
