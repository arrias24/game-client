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

function isOnVideo(video: HTMLVideoElement, target: EventTarget | null): boolean {
    return target === video || (target instanceof Node && video.contains(target));
}

const POINTER_LOCK: PointerLockOptions = { unadjustedMovement: true };

function requestPointerLockOn(target: Element) {
    if (target.requestPointerLock) {
        return target.requestPointerLock(POINTER_LOCK);
    }
    const legacy = target as Element & {
        mozRequestPointerLock?: () => void;
        webkitRequestPointerLock?: () => void;
    };
    legacy.mozRequestPointerLock?.();
    legacy.webkitRequestPointerLock?.();
    return Promise.resolve();
}

export function attachPointer(opts: {
    video: HTMLVideoElement;
    /** Juegos con look SDL (Xonotic): pedir pointer lock al apretar en el video. */
    captureLook?: boolean;
    onMouse?: (state: MouseHud | null) => void;
    onLock?: (locked: boolean) => void;
    onChange?: () => void;
    onLog?: (line: string) => void;
}) {
    const held = new Set<number>();
    let locked = false;
    let lastHud = 0;
    let lastPt = { x: 0, y: 0 };
    /** Última posición ya enviada en modo look relativo sin pointer lock. */
    let sentPt = { x: 0, y: 0 };
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
        const lookRel = opts.captureLook && !locked;
        opts.onMouse?.({
            x: locked ? dx : lookRel ? lastPt.x - sentPt.x : lastPt.x,
            y: locked ? dy : lookRel ? lastPt.y - sentPt.y : lastPt.y,
            buttons: held.size,
            locked,
        });
    };

    const requestLock = () => {
        if (locked || document.pointerLockElement) return;
        const target = opts.video;
        const done = () => opts.onLog?.('pointer lock activo — mové el mouse');
        const fail = (err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            opts.onLog?.(`pointer lock falló: ${msg} (click de nuevo en el video)`);
        };
        void requestPointerLockOn(target).then(done).catch(fail);
    };

    const onLockedMove = (ev: Event) => {
        const pe = ev as PointerEvent;
        dx += pe.movementX || 0;
        dy += pe.movementY || 0;
        lastPt = {
            x: lastPt.x + (pe.movementX || 0),
            y: lastPt.y + (pe.movementY || 0),
        };
        emitHud();
        opts.onChange?.();
    };

    const bindLockedMove = (on: boolean) => {
        if (on) {
            document.addEventListener('pointermove', onLockedMove, { capture: true, passive: true });
            document.addEventListener('mousemove', onLockedMove, { capture: true, passive: true });
        } else {
            document.removeEventListener('pointermove', onLockedMove, { capture: true });
            document.removeEventListener('mousemove', onLockedMove, { capture: true });
        }
    };

    const onLockChange = () => {
        const nowLocked =
            document.pointerLockElement === opts.video
            || document.pointerLockElement === root;
        if (nowLocked !== locked) {
            locked = nowLocked;
            bindLockedMove(locked);
            opts.onLog?.(locked ? 'pointer lock ON' : 'pointer lock OFF');
        }
        opts.onLock?.(locked);
        if (!locked) {
            held.clear();
            dx = 0;
            dy = 0;
            sentPt = { ...lastPt };
        } else {
            sentPt = { ...lastPt };
        }
        emitHud(true);
        opts.onChange?.();
    };

    const onDown = (ev: PointerEvent | MouseEvent) => {
        if (isChrome(ev.target) || ev.button > 4) return;
        opts.video.focus();
        held.add(ev.button);
        const pt = mapVideoCoords(opts.video, ev.clientX, ev.clientY);
        if (pt) {
            lastPt = pt;
            if (opts.captureLook && !locked) {
                sentPt = { ...pt };
            }
        }
        if (
            opts.captureLook
            && ev.button === 0
            && isOnVideo(opts.video, ev.target)
        ) {
            requestLock();
        }
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
        if (locked) return;
        const pe = ev as PointerEvent;
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
    document.addEventListener('mozpointerlockchange', onLockChange);
    document.addEventListener('webkitpointerlockchange', onLockChange);
    opts.onLog?.(
        opts.captureLook
            ? 'mouse listo — click en el video para capturar el puntero (cámara)'
            : 'mouse listo — mové el puntero sobre el video',
    );
    opts.onMouse?.({ x: 0, y: 0, buttons: 0, locked: false });

    return {
        peek: (): MouseSample => {
            if (opts.captureLook) {
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
                    abs: false,
                    x: lastPt.x - sentPt.x,
                    y: lastPt.y - sentPt.y,
                    buttons: buttonMask(),
                    wheel: wheel | 0,
                    locked,
                };
            }
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
            if (opts.captureLook) {
                if (locked) {
                    const ix = Math.max(-32767, Math.min(32767, Math.round(dx)));
                    const iy = Math.max(-32767, Math.min(32767, Math.round(dy)));
                    dx -= ix;
                    dy -= iy;
                } else {
                    sentPt = { ...lastPt };
                }
            } else if (locked) {
                const ix = Math.max(-32767, Math.min(32767, Math.round(dx)));
                const iy = Math.max(-32767, Math.min(32767, Math.round(dy)));
                dx -= ix;
                dy -= iy;
            }
            const w = Math.max(-8, Math.min(8, wheel | 0));
            wheel -= w;
        },
        requestLock,
        stop: () => {
            bindLockedMove(false);
            root.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointerup', onUp);
            root.removeEventListener(moveEvent, onMove);
            root.removeEventListener('wheel', onWheel);
            root.removeEventListener('contextmenu', onContext);
            root.removeEventListener('dblclick', onDblClick, true);
            document.removeEventListener('pointerlockchange', onLockChange);
            document.removeEventListener('mozpointerlockchange', onLockChange);
            document.removeEventListener('webkitpointerlockchange', onLockChange);
            if (document.pointerLockElement === opts.video || document.pointerLockElement === root) {
                document.exitPointerLock();
            }
            held.clear();
            dx = 0;
            dy = 0;
            wheel = 0;
            sentPt = { x: 0, y: 0 };
            opts.onLock?.(false);
            opts.onMouse?.(null);
        },
    };
}
