/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare module 'map/*' {
  type RemoteSvelteInstance = {
    update?: (props: Record<string, unknown>) => void;
    destroy?: () => Promise<void>;
  };

  type CreateRemoteSvelteComponent = (
    target: HTMLElement,
    props?: Record<string, unknown>,
  ) => RemoteSvelteInstance;

  const component: unknown;
  export default component;
  export const createMap: CreateRemoteSvelteComponent;
}
