/// <reference types="@rsbuild/core/types" />
/// <reference types="svelte" />
interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
