/** 8 bytes LE. Solo gamepad (type=3). No keyCode, no JSON. */

export const PAD_TYPE = 3;
export const ACTION_DOWN = 1;
export const ACTION_UP = 2;
export const ACTION_AXIS = 4;

const AXIS_MAX = 32767;

function packet(type: number, action: number, code: number, extra: number): ArrayBuffer {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint8(0, type);
    view.setUint8(1, action);
    view.setUint16(2, code, true);
    view.setInt32(4, extra, true);
    return buf;
}

export function encodePadButton(action: 1 | 2, button: number): ArrayBuffer | null {
    if (button < 0 || button > 16) return null;
    return packet(PAD_TYPE, action, button, 0);
}

export function encodePadAxis(axis: number, extra: number): ArrayBuffer | null {
    if (axis < 0 || axis > 5) return null;
    const clamped = Math.max(-AXIS_MAX, Math.min(AXIS_MAX, extra | 0));
    return packet(PAD_TYPE, ACTION_AXIS, axis, clamped);
}

export function sendBuf(channel: RTCDataChannel | null, buf: ArrayBuffer | null) {
    if (!buf || !channel || channel.readyState !== 'open') return false;
    channel.send(buf);
    return true;
}
