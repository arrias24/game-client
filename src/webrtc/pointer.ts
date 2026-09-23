export type MouseHud = {
    x: number;
    y: number;
    buttons: number;
    locked: boolean;
};

export type MouseSample = {
    abs: boolean;
    x: number;
    y: number;
    buttons: number;
    wheel: number;
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
    video: HTMLVideoElement;
    onMouse?: (state: MouseHud | null) => void;
    onLock?: (locked: boolean) => void;
    onChange?: () => void;
    onLog?: (line: string) => void;
}) {
    const held = new Set<number>();
    let locked = false;
    let lastHud = 0;
    let lastPt = { x: 0, y: 0 };
    let dx = 0;
    let dy = 0;
    let wheel = 0;
    const root: HTMLElement = opts.video.closest('.game-view') ?? opts.video;

    const buttonMask = () => {
        let mask = 0;
        for (const button of held) mask |= 1 << button;
        return mask;
    };

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

    const onLockChange = () => {
        locked =
            document.pointerLockElement === opts.video
            || document.pointerLockElement === root;
        opts.onLock?.(locked);
        if (!locked) {
            held.clear();
            dx = 0;
            dy = 0;
        }
        emitHud(true);
        opts.onChange?.();
    };

    const onDown = (ev: PointerEvent | MouseEvent) => {
        if (isChrome(ev.target) || ev.button > 4) return;
        opts.video.focus();
        held.add(ev.button);
        const pt = mapVideoCoords(opts.video, ev.clientX, ev.clientY);
        if (pt) lastPt = pt;
        emitHud(true);
        opts.onChange?.();
        ev.preventDefault();
    };

    const onUp = (ev: PointerEvent | MouseEvent) => {
        if (ev.button > 4) return;
        if (!held.has(ev.button)) return;
        held.delete(ev.button);
        emitHud(true);
        opts.onChange?.();
        ev.preventDefault();
    };

    const onMove = (ev: Event) => {
        const pe = ev as PointerEvent;
        if (locked) {
            dx += pe.movementX;
            dy += pe.movementY;
            lastPt = { x: lastPt.x + (pe.movementX || 0), y: lastPt.y + (pe.movementY || 0) };
            emitHud();
            opts.onChange?.();
            return;
        }
        if (isChrome(pe.target)) return;
        const pt = mapVideoCoords(opts.video, pe.clientX, pe.clientY);
        if (!pt) return;
        lastPt = pt;
        emitHud();
        opts.onChange?.();
    };

    const onWheel = (ev: WheelEvent) => {
        if (isChrome(ev.target)) return;
        const ticks = ev.deltaY === 0 ? 0 : ev.deltaY < 0 ? 1 : -1;
        if (!ticks) return;
        wheel += ticks;
        opts.onChange?.();
        ev.preventDefault();
    };

    const onContext = (ev: Event) => {
        if (!isChrome(ev.target)) ev.preventDefault();
    };

    const onDblClick = (ev: Event) => {
        if (isChrome(ev.target)) return;
        ev.preventDefault();
        ev.stopPropagation();
    };

    const moveEvent =
        typeof window !== 'undefined' && 'onpointerrawupdate' in window
            ? 'pointerrawupdate'
            : 'pointermove';

    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    root.addEventListener(moveEvent, onMove, { passive: true });
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('contextmenu', onContext);
    root.addEventListener('dblclick', onDblClick, true);
    document.addEventListener('pointerlockchange', onLockChange);
    opts.onLog?.('mouse listo — mové el puntero sobre el video');
    opts.onMouse?.({ x: 0, y: 0, buttons: 0, locked: false });

    return {
        peek: (): MouseSample => {
            if (locked) {
                return {
                    abs: false,
                    x: Math.round(dx),
                    y: Math.round(dy),
                    buttons: buttonMask(),
                    wheel: wheel | 0,
                    locked,
                };
            }
            return {
                abs: true,
                x: lastPt.x,
                y: lastPt.y,
                buttons: buttonMask(),
                wheel: wheel | 0,
                locked,
            };
        },
        consumeMotion: () => {
            if (locked) {
                const ix = Math.max(-32767, Math.min(32767, Math.round(dx)));
                const iy = Math.max(-32767, Math.min(32767, Math.round(dy)));
                dx -= ix;
                dy -= iy;
            }
            const w = Math.max(-8, Math.min(8, wheel | 0));
            wheel -= w;
        },
        stop: () => {
            root.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointerup', onUp);
            root.removeEventListener(moveEvent, onMove);
            root.removeEventListener('wheel', onWheel);
            root.removeEventListener('contextmenu', onContext);
            root.removeEventListener('dblclick', onDblClick, true);
            document.removeEventListener('pointerlockchange', onLockChange);
            if (document.pointerLockElement === opts.video || document.pointerLockElement === root) {
                document.exitPointerLock();
            }
            held.clear();
            dx = 0;
            dy = 0;
            wheel = 0;
            opts.onLock?.(false);
            opts.onMouse?.(null);
        },
    };
}
