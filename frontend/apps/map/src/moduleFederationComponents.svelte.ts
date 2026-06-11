import { type Component, mount, unmount } from "svelte";

import MapComponent from "./components/Map.component.svelte";
import { mapManager, type MapState } from "./map-manager/index.svelte";
export type { MapAirportFeature, MapManagerSnapshot, MapState } from "./map-manager/index.svelte";

const DEBUG_LOG_PREFIX = "[dashboard-map]";

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

function applyMapStateProp(props: RemoteComponentProps): void {
    // Push map state straight to the singleton manager. This does not depend on
    // Svelte prop reactivity propagating across the Module Federation boundary,
    // which proved unreliable and left the dashboard map empty.
    if ("mapState" in props) {
        const mapState = (props.mapState as MapState | null | undefined) ?? null;
        debugMapState("remote:map-state-prop", mapState);
        mapManager.setMapState(mapState);
    }

    if ("selectedFlightId" in props) {
        mapManager.setSelectedFlight((props.selectedFlightId as null | string | undefined) ?? null);
    }
}

function debugMapState(message: string, mapState: MapState | null): void {
    if (isDebugLoggingEnabled()) {
        console.warn(DEBUG_LOG_PREFIX, message, {
            airports: mapState?.airports?.features.length ?? 0,
            flights: mapState?.flights?.features.length ?? 0,
            hasMapState: Boolean(mapState),
            routes: mapState?.routes?.features.length ?? 0,
        });
    }
}

export { mapManager };

function isDebugLoggingEnabled(): boolean {
    return import.meta.env.DEV || import.meta.env.MODE !== "production";
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
    applyMapStateProp(initialProps);

    return {
        destroy: async (): Promise<void> => {
            await unmount(mountedComponent);
        },
        update: (newProps: RemoteComponentProps): void => {
            Object.assign(propsState, newProps);
            applyMapStateProp(newProps);
        },
    };
}
