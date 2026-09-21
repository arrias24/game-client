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

function iceServers(): RTCIceServer[] {
    const raw = import.meta.env.VITE_ICE_SERVERS ?? '';
    return raw
        .split(',')
        .map((urls) => urls.trim())
        .filter(Boolean)
        .map((urls) => ({ urls }));
}

function tuneReceiver(receiver: RTCRtpReceiver) {
    const ext = receiver as RTCRtpReceiver & { playoutDelayHint?: number };
    try {
        if ('jitterBufferTarget' in receiver) {
            receiver.jitterBufferTarget = 0;
        }
    } catch {
        /* Safari / Firefox viejo */
    }
    try {
        ext.playoutDelayHint = 0;
    } catch {
        /* no soportado */
    }
    const track = receiver.track;
    if (track?.kind === 'video') {
        try {
            track.contentHint = 'motion';
        } catch {
            /* no soportado */
        }
    }
}

export function createPeer(opts: {
    onTrack: (stream: MediaStream) => void;
    send: (msg: SignalOut) => void;
    onState?: (s: string) => void;
}) {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const input = pc.createDataChannel('input', {
        ordered: false,
        maxRetransmits: 0,
    });
    const remote = new MediaStream();
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    for (const receiver of pc.getReceivers()) tuneReceiver(receiver);

    pc.onconnectionstatechange = () => opts.onState?.(`pc ${pc.connectionState}`);
    pc.oniceconnectionstatechange = () => opts.onState?.(`ice ${pc.iceConnectionState}`);

    pc.ontrack = (ev) => {
        tuneReceiver(ev.receiver);
        if (!remote.getTracks().some((t) => t.id === ev.track.id)) {
            remote.addTrack(ev.track);
        }
        opts.onTrack(remote);
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
