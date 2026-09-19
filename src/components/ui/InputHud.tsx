export type MouseHud = {
    x: number;
    y: number;
    buttons: number;
    locked: boolean;
};

export const InputHud = ({
    keyboard,
    keys,
    mouse,
}: {
    keyboard: boolean;
    keys: string[];
    mouse: MouseHud | null;
}) => {
    if (!keyboard && !mouse) return null;
    return (
        <div className="input-hud" aria-live="polite">
            {keyboard && (
                <span className="input-hud__keys">
                    {keys.length ? keys.join(' · ') : 'teclado listo'}
                </span>
            )}
            {mouse && (
                <span className="input-hud__mouse">
                    {mouse.locked ? 'rel' : 'abs'} {mouse.x},{mouse.y}
                    {mouse.buttons ? ` · click` : ''}
                </span>
            )}
        </div>
    );
};
