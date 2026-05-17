import { type Component, mount, unmount } from "svelte";

import MapComponent from "./components/Map.component.svelte";
import { mapManager } from "./map-manager/index.svelte";

export type RemoteComponentInstance = {
    destroy: () => Promise<void>;
    update: (newProps: RemoteComponentProps) => void;
};

export type RemoteComponentProps = Record<string, unknown>;

export function createMap(
    targetElement: HTMLElement,
    props: RemoteComponentProps = {},
): RemoteComponentInstance {
    return mountSvelte(MapComponent, targetElement, props);
}

function mountSvelte(
    SvelteComponent: Component<RemoteComponentProps>,
    targetElement: HTMLElement,
    initialProps: RemoteComponentProps = {},
): RemoteComponentInstance {
    const propsState = $state({ ...initialProps });

    const mountedComponent = mount(SvelteComponent, {
        props: propsState,
        target: targetElement,
    });

    return {
        destroy: async (): Promise<void> => {
            await unmount(mountedComponent);
        },
        update: (newProps: RemoteComponentProps): void => {
            Object.assign(propsState, newProps);
        },
    };
}

export { mapManager };
