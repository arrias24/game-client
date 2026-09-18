const BASE = import.meta.env.VITE_STATION_URL || 'http://localhost:8090';

export function restUrl(path: string) {
    return `${BASE}${path}`;
}

export function wsUrl(path: string) {
    if (BASE.startsWith('http')) {
        return BASE.replace(/^http/, 'ws') + path;
    }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}${BASE}${path}`;
}
