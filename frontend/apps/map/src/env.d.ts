/// <reference types="@rsbuild/core/types" />
/// <reference types="svelte" />
interface ImportMetaEnv {
  readonly DEV?: boolean;
  readonly MODE?: string;
  readonly VITE_BFF_URL?: string;
  readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
