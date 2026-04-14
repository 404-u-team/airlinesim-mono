<script lang="ts">
    import { MapLibre } from "svelte-maplibre-gl";
</script>

<MapLibre
    style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
    class="map-container"
/>

<style>
    .map-container {
        height: 400px;
        width: 100%;
    }
</style>
