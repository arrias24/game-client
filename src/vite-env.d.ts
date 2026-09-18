/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATION_URL?: string;
  readonly VITE_ICE_SERVERS?: string;
  readonly VITE_GAME_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
