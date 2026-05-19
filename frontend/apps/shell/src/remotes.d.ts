declare module "eventsNews/App" {
  import type { Component } from "vue";

  const component: Component;
  export default component;
}

declare module "financeStock/App" {
  import type { Component } from "vue";

  const component: Component;
  export default component;
}

declare module "fleetOps/App" {
  import type { Component } from "vue";

  const component: Component;
  export default component;
}

declare module "hrFacilities/App" {
  import type { Component } from "vue";

  const component: Component;
  export default component;
}

declare module "map/Map" {
  export type MapStyle = {
    name: string;
    theme: "dark" | "light";
    url: string;
  };

  export type MapManagerSnapshot = {
    isGlobe: boolean;
    isReady: boolean;
    isRotating: boolean;
    selectedStyleName: string;
    selectedTheme: "dark" | "light";
    styles: readonly MapStyle[];
    zoom: number;
  };

  export type RemoteSvelteInstance = {
    destroy?: () => Promise<void>;
    update?: (props: Record<string, unknown>) => void;
  };

  export function createMap(
    target: HTMLElement,
    props: Record<string, unknown>,
  ): RemoteSvelteInstance;

  export const mapManager: {
    changeStyle: (name: string) => void;
    getSnapshot: () => MapManagerSnapshot;
    setGlobeProjection: (isGlobe: boolean) => void;
    setRotation: (rotationStatus: boolean) => void;
    subscribe: (listener: (snapshot: MapManagerSnapshot) => void) => () => void;
    zoomIn: () => void;
    zoomOut: () => void;
  };
}

declare module "networkPlanner/App" {
  import type { Component } from "vue";

  const component: Component;
  export default component;
}
