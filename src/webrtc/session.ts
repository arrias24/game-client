import { wsUrl } from '@services/api/urls.ts';
import { attachGamepad } from '@/webrtc/gamepad.ts';
import { createPeer, type SignalIn } from '@/webrtc/peer.ts';

export function attachWebrtc(opts: {
    signalPath: string;
    video: HTMLVideoElement;
    onTrack: (stream: MediaStream | null) => void;
    onLog: (line: string) => void;
    onError: (code: string) => void;
    onPad?: (id: string | null) => void;
}) {
    const ws = new WebSocket(wsUrl(opts.signalPath));
    let detachPad: (() => void) | null = null;
    const peer = createPeer({
        send: (msg) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (msg.type === 'OFFER') opts.onLog('→ OFFER');
            ws.send(JSON.stringify(msg));
        },
        onTrack: (stream) => {
            const videoTrack = stream.getVideoTracks()[0];
            const audioTrack = stream.getAudioTracks()[0];
            opts.onLog(
                `ontrack video=${videoTrack?.readyState ?? 'none'} audio=${audioTrack?.readyState ?? 'none'}`,
            );
            const video = opts.video;
            video.playsInline = true;
            video.autoplay = true;
            video.setAttribute('playsinline', 'true');
            video.setAttribute('webkit-playsinline', 'true');
            video.srcObject = stream;
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
    peer.input.onopen = () => {
        opts.onLog('dc input open');
        detachPad = attachGamepad({
            channel: peer.input,
            onPad: (id) => {
                opts.onLog(id ? `gamepad ${id}` : 'gamepad desconectado');
                opts.onPad?.(id);
            },
            onPadEvent: (line) => opts.onLog(line),
        });
    };

    ws.onmessage = async (ev) => {
        const msg = JSON.parse(String(ev.data)) as SignalIn;
        opts.onLog(`← ${msg.type}${msg.type === 'ERROR' ? ` ${msg.code}` : ''}`);
        if (msg.type === 'ERROR') {
            opts.onError(msg.code);
            detachPad?.();
            detachPad = null;
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
        detachPad?.();
        detachPad = null;
        opts.onPad?.(null);
        peer.close();
        ws.close();
        opts.video.srcObject = null;
        opts.onTrack(null);
    };
}
