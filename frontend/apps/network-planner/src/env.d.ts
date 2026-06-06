interface ImportMetaEnv {
  readonly DEV?: boolean;
  readonly MODE?: string;
  readonly VITE_BFF_URL?: string;
  readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "map/Map" {
  export type RemoteSvelteInstance = {
    destroy?: () => Promise<void>;
    update?: (props: Record<string, unknown>) => void;
  };

  export function createMap(
    target: HTMLElement,
    props: Record<string, unknown>,
  ): RemoteSvelteInstance;
}
