<script lang="ts">
    import { onDestroy, onMount } from "svelte";

    import { mapManager } from "../map-manager/index.svelte";
    import "maplibre-gl/dist/maplibre-gl.css";

    import ControlButton from "./Controls/ControlButton.svelte";
    import ControlDropdown from "./Controls/ControlDropdown.svelte";

    let mapContainer: HTMLElement;

    const {
        controls = false,
        rotation = false,
        theme = "light",
    }: {
        controls?: boolean;
        rotation?: boolean;
        theme?: "dark" | "light";
    } = $props();

    const styleOptions = mapManager.AvailableStyles.map((style) => ({
        label: style.name,
        value: style.name,
    }));

    onMount((): void => {
        mapManager.init(mapContainer, rotation);
    });

    $effect(() => {
        mapManager.handleThemeChange(theme);
    });

    onDestroy((): void => {
        mapManager.destroy();
    });
</script>

<div
    class="relative w-full h-screen bg-background transition-colors duration-300"
    class:dark={mapManager.SelectedStyle.theme === "dark"}
>
    <div bind:this={mapContainer} class="map-container"></div>

    {#if controls}
        <div class="absolute bottom-8 right-8 flex flex-col gap-4 z-10">
            <div
                class="flex flex-col bg-surface/90 rounded-lg shadow-md overflow-hidden"
            >
                <ControlButton click={() => mapManager.zoomIn()}>+</ControlButton>
                <ControlButton click={() => mapManager.zoomOut()}>−</ControlButton>
            </div>

            <div
                class="flex flex-col bg-surface/90 rounded-lg shadow-md overflow-hidden"
            >
                <ControlDropdown
                    options={styleOptions}
                    change={(styleName) => mapManager.changeStyle(styleName)}
                />
                <ControlButton
                    click={() =>
                        mapManager.setGlobeProjection(!mapManager.Globe)}
                    >2D/3D</ControlButton
                >
            </div>
        </div>
    {/if}
</div>

<style>
    .map-container {
        width: 100%;
        height: 100%;
    }
</style>
