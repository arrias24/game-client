import { wsUrl } from '../api/urls.ts';
import type { ControlEvent } from '@/types';

export function connectControl(
    onEvent: (ev: ControlEvent) => void,
    onStatus: (open: boolean) => void,
) {
    const ws = new WebSocket(wsUrl('/ws/control'));
    ws.onopen = () => onStatus(true);
    ws.onclose = () => onStatus(false);
    ws.onerror = () => onStatus(false);
    ws.onmessage = (e) => {
        try {
            onEvent(JSON.parse(String(e.data)) as ControlEvent);
        } catch {
            /* ignore */
        }
    };
    return () => ws.close();
}
