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
    let raw = (msg.candidate ?? '').trim();
    if (raw.startsWith('a=')) raw = raw.slice(2).trim();
    if (raw && !raw.startsWith('candidate:')) raw = `candidate:${raw}`;
    const init: RTCIceCandidateInit = { candidate: raw };
    if (msg.sdpMid) init.sdpMid = msg.sdpMid;
    if (msg.sdpMLineIndex != null && msg.sdpMLineIndex >= 0) init.sdpMLineIndex = msg.sdpMLineIndex;
    return init;
}

function iceServers(): RTCIceServer[] {
    const raw = import.meta.env.VITE_ICE_SERVERS ?? '';
    return raw
        .split(',')
        .map((urls) => urls.trim())
        .filter(Boolean)
        .map((urls) => ({ urls }));
}

/** Colchón corto: suaviza microcortes sin el retraso de 60 ms. */
const PLAYOUT_S = 0.035;
const JITTER_MS = 35;

function tuneReceiver(receiver: RTCRtpReceiver, log?: (line: string) => void) {
    const ext = receiver as RTCRtpReceiver & { playoutDelayHint?: number; jitterBufferTarget?: number };
    const track = receiver.track;
    if (track?.kind === 'video') {
        try {
            if ('jitterBufferTarget' in receiver) {
                ext.jitterBufferTarget = JITTER_MS;
            }
        } catch (err) {
            log?.(`jitter ${err instanceof Error ? err.message : err}`);
        }
        try {
            ext.playoutDelayHint = PLAYOUT_S;
        } catch (err) {
            log?.(`playout ${err instanceof Error ? err.message : err}`);
        }
    } else {
        try {
            if ('jitterBufferTarget' in receiver) {
                ext.jitterBufferTarget = 0;
            }
        } catch {
            /* no soportado */
        }
        try {
            ext.playoutDelayHint = 0;
        } catch {
            /* no soportado */
        }
    }
    if (receiver.track?.kind === 'video') {
        try {
            receiver.track.contentHint = 'motion';
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
    input.binaryType = 'arraybuffer';
    input.bufferedAmountLowThreshold = 0;
    const remote = new MediaStream();
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    for (const receiver of pc.getReceivers()) tuneReceiver(receiver);

    const tuneAll = () => {
        for (const receiver of pc.getReceivers()) tuneReceiver(receiver, opts.onState);
    };
    pc.onconnectionstatechange = () => {
        opts.onState?.(`pc ${pc.connectionState}`);
        if (pc.connectionState === 'connected') tuneAll();
    };
    pc.oniceconnectionstatechange = () => opts.onState?.(`ice ${pc.iceConnectionState}`);

    pc.ontrack = (ev) => {
        tuneReceiver(ev.receiver, opts.onState);
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
            } catch (err) {
                opts.onState?.(`ICE candidate rejected ${err instanceof Error ? err.message : err}`);
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
