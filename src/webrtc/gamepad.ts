import {
    ACTION_DOWN,
    ACTION_UP,
    encodePadAxis,
    encodePadButton,
    sendBuf,
} from './input.ts';

/** Standard Gamepad mapping (Xbox layout). */
export const PAD_BUTTON_LABELS = [
    'A',
    'B',
    'X',
    'Y',
    'LB',
    'RB',
    'LT',
    'RT',
    'View',
    'Menu',
    'LS',
    'RS',
    '↑',
    '↓',
    '←',
    '→',
    'Guide',
] as const;

const DEADZONE = 0.12;
const AXIS_EPS = 256;
const AXIS_MAX = 32767;
const POLL_MS = 4;

function buttonDown(button: GamepadButton | undefined): boolean {
    if (!button) return false;
    return button.pressed || button.value > 0.5;
}

function axisInt(v: number, unipolar = false): number {
    if (unipolar) {
        const n = Math.max(0, Math.min(1, v));
        return Math.round(n * AXIS_MAX);
    }
    if (Math.abs(v) < DEADZONE) return 0;
    return Math.round(Math.max(-1, Math.min(1, v)) * AXIS_MAX);
}

type Slot = {
    prevBtn: boolean[];
    prevAxis: number[];
};

function emptySlot(): Slot {
    return { prevBtn: [], prevAxis: [] };
}

export function attachGamepad(opts: {
    channel: RTCDataChannel;
    maxPads: 0 | 1 | 2 | 3 | 4;
    onPads?: (ids: string[]) => void;
}) {
    const maxPads = opts.maxPads;
    if (maxPads === 0) {
        return () => undefined;
    }
    let timer = 0;
    const slots: Slot[] = Array.from({ length: maxPads }, emptySlot);
    const ids: (string | null)[] = Array.from({ length: maxPads }, () => null);

    const emitPads = () => {
        opts.onPads?.(ids.filter((id): id is string => Boolean(id)));
    };

    const flushSlot = (slot: number) => {
        const prev = slots[slot];
        for (let i = 0; i < 17; i++) {
            if (prev.prevBtn[i]) sendBuf(opts.channel, encodePadButton(ACTION_UP, i, slot), true);
            prev.prevBtn[i] = false;
        }
        for (let i = 0; i < 6; i++) {
            if (prev.prevAxis[i]) sendBuf(opts.channel, encodePadAxis(i, 0, slot), true);
            prev.prevAxis[i] = 0;
        }
    };

    const poll = () => {
        if (opts.channel.readyState !== 'open') return;
        const connected = [...navigator.getGamepads()]
            .filter((pad): pad is Gamepad => pad != null)
            .sort((a, b) => a.index - b.index)
            .slice(0, maxPads);
        let changed = false;
        for (let slot = 0; slot < maxPads; slot++) {
            const pad = connected[slot];
            if (!pad) {
                if (ids[slot]) {
                    ids[slot] = null;
                    flushSlot(slot);
                    changed = true;
                }
                continue;
            }
            if (ids[slot] !== pad.id) {
                ids[slot] = pad.id;
                changed = true;
            }
            const prev = slots[slot];
            const n = Math.min(PAD_BUTTON_LABELS.length, pad.buttons.length);
            for (let i = 0; i < n; i++) {
                const down = buttonDown(pad.buttons[i]);
                if (down !== Boolean(prev.prevBtn[i])) {
                    sendBuf(
                        opts.channel,
                        encodePadButton(down ? ACTION_DOWN : ACTION_UP, i, slot),
                        true,
                    );
                    prev.prevBtn[i] = down;
                }
            }
            const stick = [
                axisInt(pad.axes[0] ?? 0),
                axisInt(pad.axes[1] ?? 0),
                axisInt(pad.axes[2] ?? 0),
                axisInt(pad.axes[3] ?? 0),
                axisInt(pad.buttons[6]?.value ?? 0, true),
                axisInt(pad.buttons[7]?.value ?? 0, true),
            ];
            for (let i = 0; i < 6; i++) {
                const cur = stick[i];
                const old = prev.prevAxis[i] ?? 0;
                if (Math.abs(cur - old) >= AXIS_EPS || (cur === 0 && old !== 0)) {
                    sendBuf(opts.channel, encodePadAxis(i, cur, slot));
                    prev.prevAxis[i] = cur;
                }
            }
        }
        if (changed) emitPads();
    };

    const onConnected = () => {
        void navigator.getGamepads();
    };
    const onDisconnected = () => {
        void navigator.getGamepads();
    };

    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('gamepaddisconnected', onDisconnected);
    poll();
    timer = window.setInterval(poll, POLL_MS);

    return () => {
        window.clearInterval(timer);
        window.removeEventListener('gamepadconnected', onConnected);
        window.removeEventListener('gamepaddisconnected', onDisconnected);
        for (let slot = 0; slot < maxPads; slot++) flushSlot(slot);
        ids.fill(null);
        emitPads();
    };
}
