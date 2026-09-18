import { wsUrl } from '@services/api/urls.ts';
import { createPeer, type SignalIn } from '@/webrtc/peer.ts';

export function attachWebrtc(opts: {
    signalPath: string;
    video: HTMLVideoElement;
    onTrack: (stream: MediaStream | null) => void;
    onLog: (line: string) => void;
    onError: (code: string) => void;
}) {
    const ws = new WebSocket(wsUrl(opts.signalPath));
    const peer = createPeer({
        send: (msg) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (msg.type === 'OFFER') opts.onLog('→ OFFER');
            ws.send(JSON.stringify(msg));
        },
        onTrack: (stream) => {
            opts.onLog('ontrack');
            opts.video.srcObject = stream;
            void opts.video.play().catch(() => {
                /* autoplay: el click en el video lo desbloquea */
            });
            opts.onTrack(stream);
        },
        onState: (s) => opts.onLog(s),
    });

    ws.onmessage = async (ev) => {
        const msg = JSON.parse(String(ev.data)) as SignalIn;
        opts.onLog(`← ${msg.type}${msg.type === 'ERROR' ? ` ${msg.code}` : ''}`);
        if (msg.type === 'ERROR') {
            opts.onError(msg.code);
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
        peer.close();
        ws.close();
        opts.video.srcObject = null;
        opts.onTrack(null);
    };
}
