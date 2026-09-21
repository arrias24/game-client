/** Fotograma de vídeo que el usuario está viendo (para etiquetar el input). */

type FrameMeta = { presentedFrames?: number };

type VideoWithFrameCb = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: VideoFrameRequestCallback) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
};

export function attachFrameClock(video: HTMLVideoElement) {
    const node = video as VideoWithFrameCb;
    let frameId = 0;
    let handle = 0;

    const loop: VideoFrameRequestCallback = (_now, meta) => {
        const presented = (meta as FrameMeta).presentedFrames;
        frameId = typeof presented === 'number' ? presented : frameId + 1;
        handle = node.requestVideoFrameCallback?.(loop) ?? 0;
    };

    if (node.requestVideoFrameCallback) {
        handle = node.requestVideoFrameCallback(loop);
    }

    return {
        current: () => frameId,
        stop: () => {
            if (handle && node.cancelVideoFrameCallback) {
                node.cancelVideoFrameCallback(handle);
            }
            handle = 0;
        },
    };
}
