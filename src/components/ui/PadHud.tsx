import { useEffect, useState } from 'react';
import { PAD_BUTTON_LABELS } from '@/webrtc/gamepad.ts';

function isDown(button: GamepadButton | undefined): boolean {
    if (!button) return false;
    return button.pressed || button.value > 0.5;
}

const EMPTY = PAD_BUTTON_LABELS.map(() => false);

function shortName(id: string) {
    return id.replace(/\s*\(.*$/, '').trim() || id;
}

export const PadHud = ({ ids }: { ids: string[] }) => {
    const [down, setDown] = useState<boolean[]>(EMPTY);

    useEffect(() => {
        let raf = 0;
        let last = '';
        const tick = () => {
            raf = requestAnimationFrame(tick);
            const pads = navigator.getGamepads();
            const next = PAD_BUTTON_LABELS.map((_, i) =>
                pads.some((pad) => isDown(pad?.buttons[i])),
            );
            const key = next.map(Number).join('');
            if (key !== last) {
                last = key;
                setDown(next);
            }
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [ids]);

    const held = PAD_BUTTON_LABELS.filter((_, i) => down[i]);
    const names = ids.map(shortName).join(' · ');

    return (
        <div className="pad-hud" aria-live="polite">
            <div className="pad-hud__top">
                <span className="pad-hud__name">{names}</span>
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
