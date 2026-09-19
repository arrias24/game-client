import { wsUrl } from '@services/api/urls.ts';
import { attachGamepad } from '@/webrtc/gamepad.ts';
import { attachKeyboard } from '@/webrtc/keyboard.ts';
import { attachPointer, type MouseHud } from '@/webrtc/pointer.ts';
import { type InputNeeds, normalizeNeeds } from '@/webrtc/input.ts';
import { createPeer, type SignalIn } from '@/webrtc/peer.ts';
import { readRtcStats, type RtcStatsSnapshot } from '@/webrtc/stats.ts';

export function attachWebrtc(opts: {
    signalPath: string;
    video: HTMLVideoElement;
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
            video.tabIndex = 0;
            video.focus();
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
    let prevStats: { at: number; video: number; audio: number } | null = null;
    const statsTimer = window.setInterval(() => {
        void readRtcStats(peer.pc, prevStats).then(({ snap, next }) => {
            prevStats = next;
            opts.onStats?.(snap);
        });
    }, 1000);

    peer.input.onopen = () => {
        opts.onLog(
            `dc input open pads=${needs.gamepad} keyboard=${needs.keyboard} mouse=${needs.mouse}`,
        );
        const stop: Array<() => void> = [];
        if (needs.gamepad > 0) {
            stop.push(
                attachGamepad({
                    channel: peer.input,
                    maxPads: needs.gamepad,
                    onPads: (ids) => {
                        opts.onLog(
                            ids.length
                                ? `gamepad ${ids.join(' · ')}`
                                : 'gamepad desconectado',
                        );
                        opts.onPads?.(ids);
                    },
                    onPadEvent: (line) => opts.onLog(line),
                }),
            );
        }
        if (needs.keyboard) {
            stop.push(
                attachKeyboard({
                    channel: peer.input,
                    onKeys: opts.onKeys,
                    onLog: opts.onLog,
                }),
            );
        } else {
            opts.onLog('teclado desactivado por needs.keyboard=false');
        }
        if (needs.mouse) {
            stop.push(
                attachPointer({
                    channel: peer.input,
                    video: opts.video,
                    onMouse: opts.onMouse,
                    onLock: opts.onPointerLock,
                    onLog: opts.onLog,
                }),
            );
        } else {
            opts.onLog('mouse desactivado por needs.mouse=false');
        }
        detachInput = () => {
            while (stop.length) stop.pop()?.();
        };
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
        detachInput?.();
        detachInput = null;
        opts.onPads?.([]);
        opts.onKeys?.([]);
        opts.onMouse?.(null);
        opts.onPointerLock?.(false);
        peer.close();
        ws.close();
        opts.video.srcObject = null;
        opts.onTrack(null);
    };
}
