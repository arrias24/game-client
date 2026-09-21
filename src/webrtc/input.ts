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
        return { gamepad: 1, keyboard: false, mouse: false };
    }
    let gamepad: GamepadSlots = 1;
    if (raw.gamepad === undefined || raw.gamepad === null) {
        gamepad = 1;
    } else if (typeof raw.gamepad === 'boolean') {
        gamepad = raw.gamepad ? 1 : 0;
    } else if (typeof raw.gamepad === 'number' && Number.isFinite(raw.gamepad)) {
        const n = Math.trunc(raw.gamepad);
        if (n >= 0 && n <= 4) gamepad = n as GamepadSlots;
        else gamepad = 1;
    }
    return {
        gamepad,
        keyboard: Boolean(raw.keyboard),
        mouse: Boolean(raw.mouse),
    };
}
