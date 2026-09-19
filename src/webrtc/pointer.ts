import {
    ACTION_DOWN,
    ACTION_UP,
    encodePointerButton,
    encodePointerMove,
    encodePointerWheel,
    sendBuf,
} from './input.ts';

export type MouseHud = {
    x: number;
    y: number;
    buttons: number;
    locked: boolean;
};

export function mapVideoCoords(
    video: HTMLVideoElement,
    clientX: number,
    clientY: number,
): { x: number; y: number } | null {
    const rect = video.getBoundingClientRect();
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    if (!rect.width || !rect.height) return null;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const contentW = vw * scale;
    const contentH = vh * scale;
    const padX = (rect.width - contentW) / 2;
    const padY = (rect.height - contentH) / 2;
    const x = (clientX - rect.left - padX) / scale;
    const y = (clientY - rect.top - padY) / scale;
    return {
        x: Math.max(0, Math.min(vw - 1, Math.round(x))),
        y: Math.max(0, Math.min(vh - 1, Math.round(y))),
    };
}

function isChrome(target: EventTarget | null): boolean {
    return (
        target instanceof Element
        && Boolean(target.closest('.game-view__bar, .game-view__unmute, .game-view__fs'))
    );
}

export function attachPointer(opts: {
    channel: RTCDataChannel;
    video: HTMLVideoElement;
    onMouse?: (state: MouseHud | null) => void;
    onLock?: (locked: boolean) => void;
    onLog?: (line: string) => void;
}) {
    const held = new Set<number>();
    let locked = false;
    let lastHud = 0;
    let lastPt = { x: 0, y: 0 };
    const root: HTMLElement = opts.video.closest('.game-view') ?? opts.video;

    const emitHud = (force = false) => {
        const now = performance.now();
        if (!force && now - lastHud < 50) return;
        lastHud = now;
        opts.onMouse?.({
            x: lastPt.x,
            y: lastPt.y,
            buttons: held.size,
            locked,
        });
    };

    const sendButton = (action: 1 | 2, button: number) => {
        const sent = sendBuf(opts.channel, encodePointerButton(action, button));
        opts.onLog?.(
            sent
                ? `mouse ${action === ACTION_DOWN ? 'down' : 'up'} b${button}`
                : `mouse b${button} (dc cerrado)`,
        );
    };

    const flushButtons = () => {
        for (const button of held) {
            sendBuf(opts.channel, encodePointerButton(ACTION_UP, button));
        }
        held.clear();
        emitHud(true);
    };

    const onLockChange = () => {
        locked =
            document.pointerLockElement === opts.video
            || document.pointerLockElement === root;
        opts.onLock?.(locked);
        if (!locked) flushButtons();
        else emitHud(true);
    };

    const onDown = (ev: PointerEvent | MouseEvent) => {
        if (isChrome(ev.target) || ev.button > 4) return;
        opts.video.focus();
        held.add(ev.button);
        sendButton(ACTION_DOWN, ev.button);
        const pt = mapVideoCoords(opts.video, ev.clientX, ev.clientY);
        if (pt) lastPt = pt;
        emitHud(true);
        ev.preventDefault();
    };

    const onUp = (ev: PointerEvent | MouseEvent) => {
        if (ev.button > 4) return;
        if (!held.has(ev.button)) return;
        held.delete(ev.button);
        sendButton(ACTION_UP, ev.button);
        emitHud(true);
        ev.preventDefault();
    };

    const onMove = (ev: PointerEvent | MouseEvent) => {
        if (opts.channel.readyState !== 'open') return;
        if (locked) {
            const dx = ev.movementX | 0;
            const dy = ev.movementY | 0;
            if (dx || dy) {
                lastPt = { x: lastPt.x + dx, y: lastPt.y + dy };
                sendBuf(opts.channel, encodePointerMove(dx, dy, false));
                emitHud();
            }
            return;
        }
        if (isChrome(ev.target)) return;
        const pt = mapVideoCoords(opts.video, ev.clientX, ev.clientY);
        if (!pt) return;
        lastPt = pt;
        sendBuf(opts.channel, encodePointerMove(pt.x, pt.y, true));
        emitHud();
    };

    const onWheel = (ev: WheelEvent) => {
        if (isChrome(ev.target)) return;
        const ticks = ev.deltaY === 0 ? 0 : ev.deltaY < 0 ? 1 : -1;
        if (!ticks) return;
        sendBuf(opts.channel, encodePointerWheel(ticks));
        ev.preventDefault();
    };

    const onContext = (ev: Event) => {
        if (!isChrome(ev.target)) ev.preventDefault();
    };

    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('contextmenu', onContext);
    document.addEventListener('pointerlockchange', onLockChange);
    opts.onLog?.('mouse listo — mové el puntero sobre el video');
    opts.onMouse?.({ x: 0, y: 0, buttons: 0, locked: false });

    return () => {
        root.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('wheel', onWheel);
        root.removeEventListener('contextmenu', onContext);
        document.removeEventListener('pointerlockchange', onLockChange);
        if (document.pointerLockElement === opts.video || document.pointerLockElement === root) {
            document.exitPointerLock();
        }
        flushButtons();
        opts.onLock?.(false);
        opts.onMouse?.(null);
    };
}
