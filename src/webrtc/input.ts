/** 8 bytes LE. type 1=key, 2=pointer, 3=pad. */

export const KEY_TYPE = 1;
export const POINTER_TYPE = 2;
export const PAD_TYPE = 3;
export const ACTION_DOWN = 1;
export const ACTION_UP = 2;
export const ACTION_MOVE = 3;
export const ACTION_AXIS = 4;
export const POINTER_REL = 0;
export const POINTER_ABS = 1;
export const MAX_PADS = 4;

const AXIS_MAX = 32767;

export type GamepadSlots = 0 | 1 | 2 | 3 | 4;

export type InputNeeds = {
    gamepad: GamepadSlots;
    keyboard: boolean;
    mouse: boolean;
};

export function normalizeNeeds(
    raw?: {
        gamepad?: number | boolean;
        keyboard?: boolean;
        mouse?: boolean;
    } | null,
): InputNeeds {
    if (!raw) {
        return { gamepad: 0, keyboard: false, mouse: false };
    }
    let gamepad: GamepadSlots = 0;
    if (typeof raw.gamepad === 'boolean') {
        gamepad = raw.gamepad ? 1 : 0;
    } else if (typeof raw.gamepad === 'number' && Number.isFinite(raw.gamepad)) {
        const n = Math.trunc(raw.gamepad);
        if (n >= 1 && n <= 4) gamepad = n as GamepadSlots;
        else gamepad = 0;
    }
    return {
        gamepad,
        keyboard: Boolean(raw.keyboard),
        mouse: Boolean(raw.mouse),
    };
}

function packet(type: number, action: number, code: number, extra: number): ArrayBuffer {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint8(0, type);
    view.setUint8(1, action);
    view.setUint16(2, code, true);
    view.setInt32(4, extra, true);
    return buf;
}

export function packXY(x: number, y: number): number {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    const clamp = (v: number) => Math.max(-AXIS_MAX, Math.min(AXIS_MAX, v | 0));
    view.setInt16(0, clamp(x), true);
    view.setInt16(2, clamp(y), true);
    return view.getInt32(0, true);
}

export function encodePadButton(
    action: 1 | 2,
    button: number,
    pad = 0,
): ArrayBuffer | null {
    if (button < 0 || button > 16 || pad < 0 || pad > 3) return null;
    return packet(PAD_TYPE, action, (pad << 8) | button, 0);
}

export function encodePadAxis(axis: number, extra: number, pad = 0): ArrayBuffer | null {
    if (axis < 0 || axis > 5 || pad < 0 || pad > 3) return null;
    const clamped = Math.max(-AXIS_MAX, Math.min(AXIS_MAX, extra | 0));
    return packet(PAD_TYPE, ACTION_AXIS, (pad << 8) | axis, clamped);
}

export function encodeKey(action: 1 | 2, linuxCode: number): ArrayBuffer | null {
    if (linuxCode <= 0 || linuxCode > 0xffff) return null;
    return packet(KEY_TYPE, action, linuxCode, 0);
}

export function encodePointerButton(action: 1 | 2, button: number): ArrayBuffer | null {
    if (button < 0 || button > 4) return null;
    return packet(POINTER_TYPE, action, button, 0);
}

export function encodePointerMove(x: number, y: number, absolute: boolean): ArrayBuffer {
    return packet(
        POINTER_TYPE,
        ACTION_MOVE,
        absolute ? POINTER_ABS : POINTER_REL,
        packXY(x, y),
    );
}

export function encodePointerWheel(ticks: number): ArrayBuffer {
    return packet(POINTER_TYPE, ACTION_AXIS, 0, ticks | 0);
}

export function sendBuf(channel: RTCDataChannel | null, buf: ArrayBuffer | null) {
    if (!buf || !channel || channel.readyState !== 'open') return false;
    channel.send(buf);
    return true;
}
