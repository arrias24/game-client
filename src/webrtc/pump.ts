/** Tick 250 Hz: el más nuevo gana. Un solo datagrama en vuelo. */

import { attachGamepad, type PadSample } from './gamepad.ts';
import { attachKeyboard } from './keyboard.ts';
import { attachPointer } from './pointer.ts';
import { attachFrameClock } from './frame.ts';
import type { InputNeeds } from './input.ts';
import type { MouseHud } from './pointer.ts';
import { HISTORY, encodeDatagram, sendDatagram, type Snapshot } from './snapshot.ts';

const TICK_MS = 4;

type WireSnapshot = Snapshot & { tx: boolean };

function foldMouse(into: Snapshot, dropped: Snapshot) {
    const a = dropped.mouse;
    const b = into.mouse;
    if (!a || !b || a.abs || b.abs) return;
    b.x += a.x;
    b.y += a.y;
    b.wheel += a.wheel;
}

export function startInput(opts: {
    channel: RTCDataChannel;
    video: HTMLVideoElement;
    needs: InputNeeds;
    onPads?: (ids: string[]) => void;
    onKeys?: (held: string[]) => void;
    onMouse?: (state: MouseHud | null) => void;
    onLock?: (locked: boolean) => void;
    onLog?: (line: string) => void;
}) {
    const { channel, needs } = opts;
    let seq = 0;
    let stopped = false;
    const history: WireSnapshot[] = [];
    const frames = attachFrameClock(opts.video);
    const runtime = { pulse: () => undefined as void };

    const keyboard = needs.keyboard
        ? attachKeyboard({
            onKeys: opts.onKeys,
            onChange: () => runtime.pulse(),
            onLog: opts.onLog,
        })
        : null;
    const pointer = needs.mouse
        ? attachPointer({
            video: opts.video,
            lookMode: Boolean(needs.relativeMouse),
            onMouse: opts.onMouse,
            onLock: opts.onLock,
            onChange: () => runtime.pulse(),
            onLog: opts.onLog,
        })
        : null;
    const gamepad = needs.gamepad > 0
        ? attachGamepad({
            maxPads: needs.gamepad,
            onPads: opts.onPads,
        })
        : null;

    if (!needs.keyboard) opts.onLog?.('teclado desactivado por needs.keyboard=false');
    if (!needs.mouse) opts.onLog?.('mouse desactivado por needs.mouse=false');
    if (needs.gamepad === 0) opts.onLog?.('gamepad desactivado por needs.gamepad=0');
    opts.onLog?.(
        `input udp tick=250Hz latest-wins history=${HISTORY} pads=${needs.gamepad} keyboard=${needs.keyboard} mouse=${needs.mouse} relativeMouse=${Boolean(needs.relativeMouse)}`,
    );

    const sample = (): Snapshot => {
        seq = (seq + 1) & 0xffff;
        const mouse = pointer?.takeDelta();
        const keys = (keyboard?.codes() ?? []).slice().sort((a, b) => a - b);
        const pads: PadSample[] = gamepad?.sample() ?? [];
        return {
            seq,
            frameId: frames.current(),
            mouse: needs.mouse && mouse
                ? {
                    abs: mouse.abs,
                    x: mouse.x,
                    y: mouse.y,
                    buttons: mouse.buttons,
                    wheel: mouse.wheel,
                }
                : undefined,
            keys: needs.keyboard ? keys : undefined,
            pads: needs.gamepad > 0 ? pads : undefined,
        };
    };

    const flush = (): boolean => {
        if (!sendDatagram(channel, encodeDatagram(history))) {
            pointer?.restoreLastDelta();
            if (history.length > 0) history.pop();
            return false;
        }
        for (const snap of history) snap.tx = true;
        return true;
    };

    const push = (snap: Snapshot) => {
        const item: WireSnapshot = { ...snap, tx: false };
        if (history.length >= HISTORY) {
            const dropped = history.shift();
            if (dropped && !dropped.tx) foldMouse(item, dropped);
        }
        history.push(item);
    };

    const tick = () => {
        if (stopped || channel.readyState !== 'open') return;
        push(sample());
        flush();
    };

    runtime.pulse = () => tick();

    const rest = (): Snapshot => {
        seq = (seq + 1) & 0xffff;
        return {
            seq,
            frameId: frames.current(),
            mouse: needs.mouse ? { abs: true, x: 0, y: 0, buttons: 0, wheel: 0 } : undefined,
            keys: needs.keyboard ? [] : undefined,
            pads: needs.gamepad > 0 ? [] : undefined,
        };
    };

    const onLow = () => {
        if (stopped || channel.readyState !== 'open' || history.length === 0) return;
        flush();
    };

    tick();
    const timer = window.setInterval(tick, TICK_MS);
    channel.addEventListener('bufferedamountlow', onLow);

    return () => {
        stopped = true;
        window.clearInterval(timer);
        channel.removeEventListener('bufferedamountlow', onLow);
        if (channel.readyState === 'open') {
            sendDatagram(channel, encodeDatagram([rest()]));
        }
        frames.stop();
        keyboard?.stop();
        pointer?.stop();
        gamepad?.stop();
    };
}
