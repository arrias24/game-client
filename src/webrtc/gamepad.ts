/** Standard Gamepad mapping (Xbox). El pump lee el estado; acá no se envía. */

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

export type PadSample = {
    slot: number;
    buttons: number;
    axes: number[];
};

const INNER_DEADZONE = 0.04;
const TRIGGER_GATE = 0.02;
const AXIS_MAX = 32767;

function clamp1(v: number): number {
    return Math.max(-1, Math.min(1, v));
}

function buttonDown(button: GamepadButton | undefined): boolean {
    if (!button) return false;
    return button.pressed || button.value > 0.5;
}

function axisInt(v: number): number {
    return Math.round(clamp1(v) * AXIS_MAX);
}

function triggerInt(v: number): number {
    const n = Math.max(0, Math.min(1, v));
    if (n < TRIGGER_GATE) return 0;
    return Math.round(n * AXIS_MAX);
}

function stickPair(x: number, y: number): [number, number] {
    const mag = Math.hypot(x, y);
    if (mag < INNER_DEADZONE) return [0, 0];
    const scaled = (mag - INNER_DEADZONE) / (1 - INNER_DEADZONE);
    const s = scaled / mag;
    return [clamp1(x * s), clamp1(y * s)];
}

function listPads(maxPads: number): Gamepad[] {
    const raw = [...navigator.getGamepads()].filter((pad): pad is Gamepad => pad != null);
    const standard = raw.filter((pad) => pad.mapping === 'standard');
    const pool = (standard.length ? standard : raw).sort((a, b) => a.index - b.index);
    const seen = new Set<string>();
    const unique: Gamepad[] = [];
    for (const pad of pool) {
        const key = pad.id || `idx-${pad.index}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(pad);
        if (unique.length >= maxPads) break;
    }
    return unique;
}

export function attachGamepad(opts: {
    maxPads: 0 | 1 | 2 | 3 | 4;
    onPads?: (ids: string[]) => void;
}) {
    const maxPads = opts.maxPads;
    if (maxPads === 0) {
        return {
            sample: (): PadSample[] => [],
            stop: () => undefined,
        };
    }
    const ids: (string | null)[] = Array.from({ length: maxPads }, () => null);

    const emitPads = () => {
        opts.onPads?.(ids.filter((id): id is string => Boolean(id)));
    };

    const sample = (): PadSample[] => {
        const connected = listPads(maxPads);
        let roster = false;
        const out: PadSample[] = [];
        for (let slot = 0; slot < maxPads; slot++) {
            const pad = connected[slot];
            if (!pad) {
                if (ids[slot]) {
                    ids[slot] = null;
                    roster = true;
                }
                continue;
            }
            if (ids[slot] !== pad.id) {
                ids[slot] = pad.id;
                roster = true;
            }
            let buttons = 0;
            const n = Math.min(PAD_BUTTON_LABELS.length, pad.buttons.length);
            for (let i = 0; i < n; i++) {
                if (buttonDown(pad.buttons[i])) buttons |= 1 << i;
            }
            const [lx, ly] = stickPair(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
            const [rx, ry] = stickPair(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
            out.push({
                slot,
                buttons,
                axes: [
                    axisInt(lx),
                    axisInt(ly),
                    axisInt(rx),
                    axisInt(ry),
                    triggerInt(pad.buttons[6]?.value ?? 0),
                    triggerInt(pad.buttons[7]?.value ?? 0),
                ],
            });
        }
        if (roster) emitPads();
        return out;
    };

    const onConnected = () => {
        void navigator.getGamepads();
        sample();
    };

    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('gamepaddisconnected', onConnected);
    sample();

    return {
        sample,
        stop: () => {
            window.removeEventListener('gamepadconnected', onConnected);
            window.removeEventListener('gamepaddisconnected', onConnected);
            ids.fill(null);
            emitPads();
        },
    };
}
