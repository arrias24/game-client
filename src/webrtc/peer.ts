export type IceMsg = {
    type: 'ICE';
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
};

export type SignalIn =
    | { type: 'ANSWER'; sdp: string }
    | IceMsg
    | { type: 'ERROR'; code: string };

export type SignalOut = { type: 'OFFER'; sdp: string } | IceMsg;

function iceFromStation(msg: IceMsg): RTCIceCandidateInit {
    const raw = msg.candidate ?? '';
    const candidate = raw.startsWith('candidate:') ? raw.slice('candidate:'.length) : raw;
    return { candidate, sdpMid: msg.sdpMid, sdpMLineIndex: msg.sdpMLineIndex };
}

export function createPeer(opts: {
    onTrack: (stream: MediaStream) => void;
    send: (msg: SignalOut) => void;
    onState?: (s: string) => void;
}) {
    const pc = new RTCPeerConnection({ iceServers: [] });
    const input = pc.createDataChannel('input', { ordered: true });
    pc.addTransceiver('video', { direction: 'recvonly' });

    pc.onconnectionstatechange = () => opts.onState?.(`pc ${pc.connectionState}`);
    pc.oniceconnectionstatechange = () => opts.onState?.(`ice ${pc.iceConnectionState}`);

    pc.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        opts.onTrack(stream);
    };

    pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        opts.send({
            type: 'ICE',
            candidate: ev.candidate.candidate,
            sdpMid: ev.candidate.sdpMid,
            sdpMLineIndex: ev.candidate.sdpMLineIndex,
        });
    };

    async function offer() {
        const desc = await pc.createOffer();
        await pc.setLocalDescription(desc);
        const sdp = pc.localDescription?.sdp;
        if (!sdp) throw new Error('no local sdp');
        opts.send({ type: 'OFFER', sdp });
    }

    async function onSignal(msg: SignalIn) {
        if (msg.type === 'ANSWER') {
            await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
            return;
        }
        if (msg.type === 'ICE' && msg.candidate) {
            try {
                await pc.addIceCandidate(iceFromStation(msg));
            } catch {
                opts.onState?.('ICE candidate rejected');
            }
        }
    }

    function close() {
        try {
            input.close();
        } catch {
            /* already closed */
        }
        pc.close();
    }

    return { pc, input, offer, onSignal, close };
}
