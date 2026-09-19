import {
    ACTION_DOWN,
    ACTION_UP,
    encodePointerButton,
    encodePointerMove,
    encodePointerWheel,
    sendBuf,
} from './input.ts';

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

export function attachPointer(opts: {
    channel: RTCDataChannel;
    video: HTMLVideoElement;
    onLock?: (locked: boolean) => void;
    onLog?: (line: string) => void;
}) {
    const held = new Set<number>();
    let locked = false;

    const sendButton = (action: 1 | 2, button: number) => {
        sendBuf(opts.channel, encodePointerButton(action, button));
    };

    const flushButtons = () => {
        for (const button of held) {
            sendBuf(opts.channel, encodePointerButton(ACTION_UP, button));
        }
        held.clear();
    };

    const onLockChange = () => {
        locked = document.pointerLockElement === opts.video;
        opts.onLock?.(locked);
        if (!locked) flushButtons();
    };

    const onMouseDown = (ev: MouseEvent) => {
        if (ev.button > 4) return;
        opts.video.focus();
        held.add(ev.button);
        sendButton(ACTION_DOWN, ev.button);
        ev.preventDefault();
    };

    const onMouseUp = (ev: MouseEvent) => {
        if (ev.button > 4) return;
        if (!held.has(ev.button)) return;
        held.delete(ev.button);
        sendButton(ACTION_UP, ev.button);
        ev.preventDefault();
    };

    const onMouseMove = (ev: MouseEvent) => {
        if (opts.channel.readyState !== 'open') return;
        if (locked) {
            const dx = ev.movementX | 0;
            const dy = ev.movementY | 0;
            if (dx || dy) sendBuf(opts.channel, encodePointerMove(dx, dy, false));
            return;
        }
        const pt = mapVideoCoords(opts.video, ev.clientX, ev.clientY);
        if (pt) sendBuf(opts.channel, encodePointerMove(pt.x, pt.y, true));
    };

    const onWheel = (ev: WheelEvent) => {
        const ticks = ev.deltaY === 0 ? 0 : ev.deltaY < 0 ? 1 : -1;
        if (!ticks) return;
        sendBuf(opts.channel, encodePointerWheel(ticks));
        ev.preventDefault();
    };

    const onContext = (ev: Event) => ev.preventDefault();

    opts.video.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    opts.video.addEventListener('mousemove', onMouseMove);
    opts.video.addEventListener('wheel', onWheel, { passive: false });
    opts.video.addEventListener('contextmenu', onContext);
    document.addEventListener('pointerlockchange', onLockChange);

    return () => {
        opts.video.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        opts.video.removeEventListener('mousemove', onMouseMove);
        opts.video.removeEventListener('wheel', onWheel);
        opts.video.removeEventListener('contextmenu', onContext);
        document.removeEventListener('pointerlockchange', onLockChange);
        if (document.pointerLockElement === opts.video) {
            document.exitPointerLock();
        }
        flushButtons();
        opts.onLock?.(false);
    };
}
