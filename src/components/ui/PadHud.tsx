import { useEffect, useState } from 'react';
import { PAD_BUTTON_LABELS } from '@/webrtc/gamepad.ts';

function readPad(): Gamepad | null {
    const pads = navigator.getGamepads();
    for (const pad of pads) {
        if (pad) return pad;
    }
    return null;
}

function isDown(button: GamepadButton | undefined): boolean {
    if (!button) return false;
    return button.pressed || button.value > 0.5;
}

const EMPTY = PAD_BUTTON_LABELS.map(() => false);

export const PadHud = ({ id }: { id: string }) => {
    const [down, setDown] = useState<boolean[]>(EMPTY);

    useEffect(() => {
        let raf = 0;
        let last = '';
        const tick = () => {
            raf = requestAnimationFrame(tick);
            const pad = readPad();
            const next = PAD_BUTTON_LABELS.map((_, i) => isDown(pad?.buttons[i]));
            const key = next.map(Number).join('');
            if (key !== last) {
                last = key;
                setDown(next);
            }
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [id]);

    const held = PAD_BUTTON_LABELS.filter((_, i) => down[i]);
    const shortId = id.replace(/\s*\(.*$/, '').trim() || id;

    return (
        <div className="pad-hud" aria-live="polite">
            <div className="pad-hud__top">
                <span className="pad-hud__name">{shortId}</span>
                <span className="pad-hud__held">
                    {held.length ? held.join(' · ') : 'apretá un botón'}
                </span>
            </div>
            <div className="pad-hud__keys">
                {PAD_BUTTON_LABELS.map((label, i) => (
                    <span
                        key={label}
                        className={down[i] ? 'pad-key is-on' : 'pad-key'}
                    >
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
};
