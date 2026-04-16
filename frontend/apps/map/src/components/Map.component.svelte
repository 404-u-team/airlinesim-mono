<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { mapManager } from "../map-manager/index.svelte";
    import "maplibre-gl/dist/maplibre-gl.css";
    import ControlButton from "./Controls/ControlButton.svelte";
    import ControlDropdown from "./Controls/ControlDropdown.svelte";

    let mapContainer: HTMLElement;

    const { controls = false } = $props();

    onMount(() => {
        mapManager.init(mapContainer);
    });

    onDestroy(() => {
        mapManager.destroy();
    });
</script>

<div
    class="relative-wrapper"
    class:dark={mapManager.SelectedStyle.theme === "dark"}
>
    <div bind:this={mapContainer} class="map-container"></div>

    {#if controls}
        <div class="custom-controls">
            <div class="control-group">
                <ControlButton click={() => mapManager.zoomIn()}
                    >+</ControlButton
                >
                <ControlButton click={() => mapManager.zoomOut()}
                    >−</ControlButton
                >
            </div>

            <div class="control-group">
                <ControlDropdown
                    options={mapManager.AvailableStyles.map(
                        (style) => style.name,
                    )}
                    values={mapManager.AvailableStyles.map(
                        (style) => style.name,
                    )}
                    change={(e: any) => mapManager.changeStyle(e.target.value)}
                />
                <ControlButton
                    click={() =>
                        mapManager.setGlobeProjection(!mapManager.Globe)}
                    >2D/3D</ControlButton
                >
            </div>

            <div class="control-group"></div>
        </div>
    {/if}
</div>

<style>
    .relative-wrapper {
        position: relative;
        width: 100%;
        height: 100vh;
        background: #f4f4f5; /* Light theme background equivalent */
        transition: background-color 0.3s ease;
    }

    .relative-wrapper.dark {
        background: #18181b; /* Dark theme background equivalent */
    }

    .map-container {
        width: 100%;
        height: 100%;
    }

    .custom-controls {
        position: absolute;
        bottom: 30px;
        right: 30px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        z-index: 10;
    }

    .control-group {
        display: flex;
        flex-direction: column;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    }

    button {
        padding: 10px 15px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-weight: bold;
        border-bottom: 1px solid #eee;
    }

    button:last-child {
        border-bottom: none;
    }

    button:hover {
        background: #f0f0f0;
    }
</style>
