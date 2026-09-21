/** Datagrama UDP de input: etiqueta + historial de fotografías. */

export const MAGIC = 0xa7;
export const VERSION = 3;
export const HISTORY = 2;
export const FLAG_MOUSE = 1 << 0;
export const FLAG_MOUSE_ABS = 1 << 1;
export const FLAG_KEYBOARD = 1 << 2;
export const FLAG_PADS = 1 << 3;
export const MAX_KEYS = 24;
export const MAX_PADS = 4;

const AXIS_MAX = 32767;

export type PadSnapshot = {
    slot: number;
    buttons: number;
    axes: number[];
};

export type MouseSnapshot = {
    abs: boolean;
    x: number;
    y: number;
    buttons: number;
    wheel: number;
};

export type Snapshot = {
    seq: number;
    frameId: number;
    mouse?: MouseSnapshot;
    keys?: number[];
    pads?: PadSnapshot[];
};

function clamp16(v: number): number {
    const n = v | 0;
    return Math.max(-AXIS_MAX, Math.min(AXIS_MAX, n));
}

function clampWheel(v: number): number {
    const n = v | 0;
    return Math.max(-8, Math.min(8, n));
}

export function encodeDatagram(snaps: Snapshot[]): ArrayBuffer {
    const items = snaps.slice(-HISTORY);
    let size = 4;
    for (const snap of items) {
        const keys = (snap.keys ?? []).filter((c) => c > 0).slice(0, MAX_KEYS);
        const pads = (snap.pads ?? []).filter((p) => p.slot >= 0 && p.slot <= 3).slice(0, MAX_PADS);
        size += 14 + keys.length * 2 + 1 + pads.length * 17;
    }
    const buf = new ArrayBuffer(size);
    const view = new DataView(buf);
    view.setUint8(0, MAGIC);
    view.setUint8(1, VERSION);
    view.setUint8(2, items.length);
    view.setUint8(3, 0);
    let off = 4;
    for (const snap of items) {
        off = writeSnapshot(view, off, snap);
    }
    return buf;
}

function writeSnapshot(view: DataView, off: number, snap: Snapshot): number {
    const keys = (snap.keys ?? []).filter((c) => c > 0).slice(0, MAX_KEYS);
    const pads = (snap.pads ?? []).filter((p) => p.slot >= 0 && p.slot <= 3).slice(0, MAX_PADS);
    let flags = 0;
    if (snap.mouse) flags |= FLAG_MOUSE;
    if (snap.mouse?.abs) flags |= FLAG_MOUSE_ABS;
    if (snap.keys) flags |= FLAG_KEYBOARD;
    if (snap.pads) flags |= FLAG_PADS;
    view.setUint16(off, snap.seq & 0xffff, true);
    view.setUint32(off + 2, snap.frameId >>> 0, true);
    view.setUint8(off + 6, flags);
    view.setUint8(off + 7, (snap.mouse?.buttons ?? 0) & 0x1f);
    view.setInt16(off + 8, clamp16(snap.mouse?.x ?? 0), true);
    view.setInt16(off + 10, clamp16(snap.mouse?.y ?? 0), true);
    view.setInt8(off + 12, clampWheel(snap.mouse?.wheel ?? 0));
    off += 13;
    view.setUint8(off, keys.length);
    off += 1;
    for (const code of keys) {
        view.setUint16(off, code & 0xffff, true);
        off += 2;
    }
    view.setUint8(off, pads.length);
    off += 1;
    for (const pad of pads) {
        view.setUint8(off, pad.slot & 0x03);
        off += 1;
        view.setUint32(off, pad.buttons >>> 0, true);
        off += 4;
        for (let i = 0; i < 6; i++) {
            view.setInt16(off, clamp16(pad.axes[i] ?? 0), true);
            off += 2;
        }
    }
    return off;
}

export function sendDatagram(channel: RTCDataChannel | null, buf: ArrayBuffer): boolean {
    if (!channel || channel.readyState !== 'open') return false;
    if (channel.bufferedAmount > 0) return false;
    try {
        channel.send(buf);
        return true;
    } catch {
        return false;
    }
}
