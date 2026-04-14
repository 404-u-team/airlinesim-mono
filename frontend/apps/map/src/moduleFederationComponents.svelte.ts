import { mount, unmount, type Component } from 'svelte';
import MapComponent from './components/Map.component.svelte';

function mountSvelte(SvelteComponent: Component, targetElement: HTMLElement, initialProps = {}) {
    let propsState = $state({ ...initialProps });

    const mountedComponent = mount(SvelteComponent, {
        target: targetElement,
        props: propsState
    });

    return {
        update: (newProps: any) => {
            Object.assign(propsState, newProps);
        },
        destroy: () => unmount(mountedComponent)
    };
}


export function createMap(targetElement: HTMLElement, props = {}) {
    return mountSvelte(MapComponent, targetElement, props);
}
