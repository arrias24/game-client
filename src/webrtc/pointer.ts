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

type LockDoc = Document & {
    mozPointerLockElement?: Element | null;
    webkitPointerLockElement?: Element | null;
};

function pointerLockElement(): Element | null {
    const doc = document as LockDoc;
    return document.pointerLockElement ?? doc.mozPointerLockElement ?? doc.webkitPointerLockElement ?? null;
}

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
    const lockTarget: Element = root;

    const isLocked = () => {
        const el = pointerLockElement();
        if (!el) return false;
        return (
            el === opts.video
            || el === root
            || el === lockTarget
            || root.contains(el)
        );
    };

    const syncLockedState = () => {
        const nowLocked = isLocked();
        if (nowLocked !== locked) {
            locked = nowLocked;
            opts.onLog?.(locked ? 'pointer lock ON' : 'pointer lock OFF');
            opts.onLock?.(locked);
            if (!locked) {
                dx = 0;
                dy = 0;
                sentPt = { ...lastPt };
            } else {
                sentPt = { ...lastPt };
            }
            emitHud(true);
            opts.onChange?.();
        }
        return locked;
    };

    const buttonMask = () => {
        let mask = 0;
        for (const button of held) mask |= 1 << button;
        return mask;
    };

    const emitHud = (force = false) => {
        const now = performance.now();
        if (!force && now - lastHud < 50) return;
        lastHud = now;
        const lookRel = opts.captureLook && !isLocked();
        opts.onMouse?.({
            x: isLocked() ? dx : lookRel ? lastPt.x - sentPt.x : lastPt.x,
            y: isLocked() ? dy : lookRel ? lastPt.y - sentPt.y : lastPt.y,
            buttons: held.size,
            locked: isLocked(),
        });
    };

    const requestLock = () => {
        if (locked || pointerLockElement()) return;
        const target = lockTarget;
        const done = () => {
            syncLockedState();
            opts.onLog?.('pointer lock activo — mové el mouse');
        };
        const fail = (err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            opts.onLog?.(`pointer lock falló: ${msg} (click de nuevo en el video)`);
        };
        void requestPointerLockOn(target).then(done).catch(fail);
    };

    const onCapturedMove = (ev: Event) => {
        const pe = ev as PointerEvent;
        const nowLocked = syncLockedState();
        if (!opts.captureLook && !nowLocked) return;
        const mx = pe.movementX || 0;
        const my = pe.movementY || 0;
        if (nowLocked && (mx || my)) {
            dx += mx;
            dy += my;
            lastPt = { x: lastPt.x + mx, y: lastPt.y + my };
            emitHud();
            opts.onChange?.();
            return;
        }
        if (!nowLocked && opts.captureLook && !isChrome(pe.target)) {
            if (mx || my) {
                dx += mx;
                dy += my;
                lastPt = { x: lastPt.x + mx, y: lastPt.y + my };
            } else {
                const pt = mapVideoCoords(opts.video, pe.clientX, pe.clientY);
                if (!pt) return;
                lastPt = pt;
            }
            emitHud();
            opts.onChange?.();
        }
    };

    const bindCapturedMove = (on: boolean) => {
        if (on) {
            document.addEventListener('pointermove', onCapturedMove, { capture: true, passive: true });
            document.addEventListener('mousemove', onCapturedMove, { capture: true, passive: true });
        } else {
            document.removeEventListener('pointermove', onCapturedMove, { capture: true });
            document.removeEventListener('mousemove', onCapturedMove, { capture: true });
        }
    };

    const onLockChange = () => {
        syncLockedState();
    };

    const onDown = (ev: PointerEvent | MouseEvent) => {
        if (isChrome(ev.target) || ev.button > 4) return;
        opts.video.focus();
        root.focus();
        held.add(ev.button);
        if ('pointerId' in ev && root.setPointerCapture) {
            try {
                root.setPointerCapture(ev.pointerId);
            } catch {
                /* ignore */
            }
        }
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

    const onUpCapture = (ev: PointerEvent | MouseEvent) => {
        if ('pointerId' in ev && root.releasePointerCapture) {
            try {
                if (root.hasPointerCapture(ev.pointerId)) {
                    root.releasePointerCapture(ev.pointerId);
                }
            } catch {
                /* ignore */
            }
        }
        onUp(ev);
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
        if (isLocked()) return;
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

    if (opts.captureLook) {
        bindCapturedMove(true);
    }

    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUpCapture);
    root.addEventListener(moveEvent, onMove, { passive: true });
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('contextmenu', onContext);
    root.addEventListener('dblclick', onDblClick, true);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mozpointerlockchange', onLockChange);
    document.addEventListener('webkitpointerlockchange', onLockChange);
    onLockChange();
    opts.onLog?.(
        opts.captureLook
            ? 'mouse listo — click en el video para capturar el puntero (cámara)'
            : 'mouse listo — mové el puntero sobre el video',
    );
    opts.onMouse?.({ x: 0, y: 0, buttons: 0, locked: false });

    return {
        peek: (): MouseSample => {
            const nowLocked = isLocked();
            if (opts.captureLook) {
                if (nowLocked || dx !== 0 || dy !== 0) {
                    return {
                        abs: false,
                        x: Math.round(dx),
                        y: Math.round(dy),
                        buttons: buttonMask(),
                        wheel: wheel | 0,
                        locked: nowLocked,
                    };
                }
                return {
                    abs: false,
                    x: lastPt.x - sentPt.x,
                    y: lastPt.y - sentPt.y,
                    buttons: buttonMask(),
                    wheel: wheel | 0,
                    locked: nowLocked,
                };
            }
            if (nowLocked) {
                return {
                    abs: false,
                    x: Math.round(dx),
                    y: Math.round(dy),
                    buttons: buttonMask(),
                    wheel: wheel | 0,
                    locked: nowLocked,
                };
            }
            return {
                abs: true,
                x: lastPt.x,
                y: lastPt.y,
                buttons: buttonMask(),
                wheel: wheel | 0,
                locked: nowLocked,
            };
        },
        consumeMotion: () => {
            const nowLocked = isLocked();
            if (opts.captureLook) {
                if (nowLocked || dx !== 0 || dy !== 0) {
                    const ix = Math.max(-32767, Math.min(32767, Math.round(dx)));
                    const iy = Math.max(-32767, Math.min(32767, Math.round(dy)));
                    dx -= ix;
                    dy -= iy;
                } else {
                    sentPt = { ...lastPt };
                }
            } else if (nowLocked) {
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
            bindCapturedMove(false);
            root.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointerup', onUpCapture);
            root.removeEventListener(moveEvent, onMove);
            root.removeEventListener('wheel', onWheel);
            root.removeEventListener('contextmenu', onContext);
            root.removeEventListener('dblclick', onDblClick, true);
            document.removeEventListener('pointerlockchange', onLockChange);
            document.removeEventListener('mozpointerlockchange', onLockChange);
            document.removeEventListener('webkitpointerlockchange', onLockChange);
            const lockEl = pointerLockElement();
            if (lockEl === opts.video || lockEl === root || lockEl === lockTarget) {
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
