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

export function attachGamepad(opts: {
    channel: RTCDataChannel;
    onPad?: (id: string | null) => void;
    onPadEvent?: (line: string) => void;
}) {
    let raf = 0;
    let index: number | null = null;
    const prevBtn: boolean[] = [];
    const prevAxis: number[] = [];

    const pick = () => {
        const pads = navigator.getGamepads();
        for (const pad of pads) {
            if (pad) return pad;
        }
        return null;
    };

    const flushNeutral = () => {
        for (let i = 0; i < 17; i++) {
            if (prevBtn[i]) sendBuf(opts.channel, encodePadButton(ACTION_UP, i));
            prevBtn[i] = false;
        }
        for (let i = 0; i < 6; i++) {
            if (prevAxis[i]) sendBuf(opts.channel, encodePadAxis(i, 0));
            prevAxis[i] = 0;
        }
    };

    const poll = () => {
        raf = requestAnimationFrame(poll);
        if (opts.channel.readyState !== 'open') return;
        const pads = navigator.getGamepads();
        const pad = (index != null ? pads[index] : null) ?? pick();
        if (!pad) {
            if (index != null) {
                index = null;
                opts.onPad?.(null);
                flushNeutral();
            }
            return;
        }
        if (index !== pad.index) {
            index = pad.index;
            opts.onPad?.(pad.id);
        }
        const n = Math.min(PAD_BUTTON_LABELS.length, pad.buttons.length);
        for (let i = 0; i < n; i++) {
            const down = buttonDown(pad.buttons[i]);
            if (down !== Boolean(prevBtn[i])) {
                const sent = sendBuf(
                    opts.channel,
                    encodePadButton(down ? ACTION_DOWN : ACTION_UP, i),
                );
                prevBtn[i] = down;
                const label = PAD_BUTTON_LABELS[i];
                opts.onPadEvent?.(
                    sent
                        ? `pad ${label} ${down ? 'down' : 'up'}`
                        : `pad ${label} ${down ? 'down' : 'up'} (dc cerrado)`,
                );
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
            const old = prevAxis[i] ?? 0;
            if (Math.abs(cur - old) >= AXIS_EPS || (cur === 0 && old !== 0)) {
                sendBuf(opts.channel, encodePadAxis(i, cur));
                prevAxis[i] = cur;
            }
        }
    };

    const onConnected = (ev: GamepadEvent) => {
        void navigator.getGamepads();
        index = ev.gamepad.index;
        opts.onPad?.(ev.gamepad.id);
    };
    const onDisconnected = (ev: GamepadEvent) => {
        if (index === ev.gamepad.index) {
            index = null;
            opts.onPad?.(null);
            flushNeutral();
        }
    };

    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('gamepaddisconnected', onDisconnected);
    raf = requestAnimationFrame(poll);

    return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('gamepadconnected', onConnected);
        window.removeEventListener('gamepaddisconnected', onDisconnected);
        flushNeutral();
    };
}
