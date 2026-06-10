import { airlineSimEventBus } from "@airlinesim/event-bus";
/* eslint-disable max-lines */
import { Map as MapLibreMap, type Map as MapLibreMapType } from "maplibre-gl";
import { SvelteSet } from "svelte/reactivity";

import { MAP__STYLES, type MapStyle, type MapTheme } from "./styles";

const DEFAULT_STYLE = MAP__STYLES[0];
const DEFAULT_ZOOM = 2;
const DEBUG_LOG_PREFIX = "[dashboard-map]";

export type MapAirportFeature = {
    geometry: {
        coordinates: [number, number];
        type: "Point";
    };
    id?: string;
    properties: {
        id?: string;
        label?: string;
        role?: "base" | "hub" | "opportunity" | "route_destination";
    };
    type: "Feature";
};

export type MapFeatureCounts = {
    airports: number;
    flights: number;
    routes: number;
};

export type MapManagerSnapshot = {
    data: MapFeatureCounts;
    isGlobe: boolean;
    isReady: boolean;
    isRotating: boolean;
    selectedStyleName: string;
    selectedTheme: MapTheme;
    styles: readonly MapStyle[];
    zoom: number;
};

export type MapState = {
    airports?: {
        features: MapAirportFeature[];
        type: "FeatureCollection";
    };
    flights?: {
        features: Array<Record<string, unknown>>;
        type: "FeatureCollection";
    };
    routes?: {
        features: Array<Record<string, unknown>>;
        type: "FeatureCollection";
    };
    viewport?: {
        bounds?: [[number, number], [number, number]];
        center?: [number, number];
        zoom?: number;
    };
};

type CameraState = {
    bearing: number;
    center: [number, number];
    pitch: number;
    zoom: number;
};

type MapManagerListener = (snapshot: MapManagerSnapshot) => void;

export class MapManager {
    public get AvailableStyles(): readonly MapStyle[] {
        return MAP__STYLES;
    }
    public get Globe(): boolean {
        return this.isGlobe;
    }
    public get InRotation(): boolean {
        return this.isInRotation;
    }
    public get mapInstance(): MapLibreMapType | null {
        return this.map;
    }
    public get SelectedStyle(): MapStyle {
        return this.style;
    }
    private animationId: null | number = null;
    private flightTickerId: null | ReturnType<typeof setInterval> = null;
    private interactable = $state(true);
    private interactableWasTrue = $state(true);

    private isGlobe = $state(true);

    private isInRotation = $state(false);

    // Last viewport applied, so polled map-state updates do not re-center the camera
    // (only a genuinely changed viewport, e.g. selecting another airport, refits).
    private lastViewportKey: null | string = null;

    private readonly listeners = new SvelteSet<MapManagerListener>();

    private map: MapLibreMapType | null = null;

    private mapState: MapState | null = null;

    private pendingCameraState: CameraState | null = null;

    private refreshFrameId: null | number = null;

    // The flight currently shown in the dashboard's flight card, highlighted on the map
    // and used to re-center the camera when selection changes.
    private selectedFlightId: null | string = null;

    private style = $state<MapStyle>(DEFAULT_STYLE);

    private zoom = $state(DEFAULT_ZOOM);

    public changeStyle(name: string): void {
        const style = MAP__STYLES.find((mapStyle) => mapStyle.name === name);

        if (!style || style.name === this.style.name) {
            return;
        }

        this.style = style;
        this.applyStyle(style);
        this.emit();
    }

    public destroy(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        this.stopFlightTicker();

        if (this.refreshFrameId !== null) {
            cancelAnimationFrame(this.refreshFrameId);
            this.refreshFrameId = null;
        }

        if (this.map) {
            const canvas = this.map.getCanvas();
            canvas.removeEventListener("webglcontextlost", this.handleWebGlContextLost);
            canvas.removeEventListener("webglcontextrestored", this.handleWebGlContextRestored);
            this.map.remove();
            this.map = null;
        }

        this.emit();
    }

    public getSnapshot(): MapManagerSnapshot {
        return {
            data: this.getFeatureCounts(),
            isGlobe: this.isGlobe,
            isReady: this.map !== null,
            isRotating: this.isInRotation,
            selectedStyleName: this.style.name,
            selectedTheme: this.style.theme,
            styles: MAP__STYLES,
            zoom: this.zoom,
        };
    }

    public handleThemeChange(theme: MapTheme): void {
        if (this.style.theme === theme) {
            return;
        }

        const style = MAP__STYLES.find((mapStyle) => mapStyle.theme === theme);

        if (style) {
            this.style = style;
            this.applyStyle(style);
            this.emit();
        }
    }

    public init(container: HTMLElement, rotation: boolean): void {
        if (this.map) {
            this.destroy();
        }

        this.map = new MapLibreMap({
            center: [0, 0],
            container,
            interactive: this.interactable,
            style: this.style.url,
            zoom: this.zoom,
        });
        const canvas = this.map.getCanvas();
        canvas.addEventListener("webglcontextlost", this.handleWebGlContextLost);
        canvas.addEventListener("webglcontextrestored", this.handleWebGlContextRestored);
        debugLog("map:init", { rotation, style: this.style.name });
        this.isInRotation = rotation;
        this.zoom = this.map.getZoom();
        this.emit();

        this.map.on("style.load", () => {
            this.restoreCameraState();
            this.setGlobeProjection(this.isGlobe, true);
            this.setRotation(this.isInRotation);
            // Game layers (base/routes/flights) are the primary content. The optional
            // three.js model layer is intentionally disabled: it spawned a second WebGL
            // context that was being lost and tore down the whole map canvas.
            this.applyGameLayers();
            this.fitGameBounds();
            this.scheduleGameLayerRefresh(true);
            void this.map?.once("idle", () => {
                this.applyGameLayers();
                this.fitGameBounds();
                this.emit();
                debugLog("style:idle-reapplied", {
                    counts: this.getFeatureCounts(),
                    hasGameLayers: this.hasGameLayers(),
                });
            });
            debugLog("style:loaded", { counts: this.getFeatureCounts(), style: this.style.name });
        });

        this.map.on("zoom", () => {
            if (!this.map) {
                return;
            }

            this.zoom = this.map.getZoom();
            this.emit();
        });
    }

    public setGlobeProjection(isGlobe: boolean, isSystemAction = false): void {
        if (!isSystemAction) {
            this.setRotation(false);
        }

        this.isGlobe = isGlobe;
        this.map?.setProjection({ type: isGlobe ? "globe" : "mercator" });
        this.emit();
    }

    public setMapState(mapState: MapState | null): void {
        // The shell passes map state as a Vue reactive proxy. MapLibre serializes
        // GeoJSON sources to a Web Worker via structured clone, which throws on a
        // proxy and silently drops the layers, so deep-clone to plain objects first.
        this.mapState = toPlainMapState(mapState);
        debugLog("state:received", {
            counts: this.getFeatureCounts(),
            hasGameLayers: this.hasGameLayers(),
            hasViewport: Boolean(this.mapState?.viewport),
            styleLoaded: this.map?.isStyleLoaded() ?? false,
        });
        this.applyGameLayers();
        this.fitGameBounds();
        this.scheduleGameLayerRefresh(true);
        this.emit();
    }

    // Highlights the flight shown in the dashboard's flight card and re-centers the
    // camera on its current (interpolated) position. Pass null to clear.
    public setSelectedFlight(flightId: null | string): void {
        if (flightId === this.selectedFlightId) {
            return;
        }

        if (this.map?.getSource("airlinesim-flights") && this.selectedFlightId !== null) {
            this.map.setFeatureState({ id: this.selectedFlightId, source: "airlinesim-flights" }, { selected: false });
        }

        this.selectedFlightId = flightId;

        if (flightId === null) {
            return;
        }

        this.applySelectedFlightState();

        const interpolated = this.interpolatedFlights(Date.now()).features as Array<{
            geometry?: { coordinates?: [number, number] };
            id?: string;
        }>;
        const coordinates = interpolated.find((item) => item.id === flightId)?.geometry?.coordinates;

        if (coordinates && this.map) {
            this.map.flyTo({ center: coordinates, duration: 800, zoom: Math.max(this.map.getZoom(), 4) });
        }
    }

    public setRotation(rotationStatus: boolean): void {
        const wasInRotation = this.isInRotation;
        this.isInRotation = rotationStatus;

        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.isInRotation) {
            if (!wasInRotation) {
                this.interactableWasTrue = this.interactable;
            }
            this.interactable = false;
            this.setMapInteractivity(false);
            this.spinGlobe();
            this.emit();
            return;
        }

        this.interactable = this.interactableWasTrue;
        this.setMapInteractivity(this.interactable);
        this.emit();
    }

    public subscribe(listener: MapManagerListener): () => void {
        this.listeners.add(listener);
        listener(this.getSnapshot());

        return (): void => {
            this.listeners.delete(listener);
        };
    }

    public zoomIn(): void {
        this.zoomBy(1);
    }

    public zoomOut(): void {
        this.zoomBy(-1);
    }

    private applyGameLayers(): void {
        if (!this.map?.isStyleLoaded()) {
            return;
        }

        const airportData = this.mapState?.airports ?? { features: [], type: "FeatureCollection" as const };
        const routeData = this.mapState?.routes ?? { features: [], type: "FeatureCollection" as const };

        // Densify each 2-point route into a great-circle polyline. MapLibre's globe
        // projection does NOT geodesic-densify a 2-point line — it subdivides in Mercator
        // space and wraps onto the sphere, so a straight route line lands off the
        // great-circle flight dots. Pre-densifying keeps the line and the dots on the
        // same arc.
        this.upsertGeoJsonSource("airlinesim-routes", densifyRoutes(routeData));
        // Always publish client-interpolated positions, so a freshly polled map-state
        // (which carries a server-computed position) never yanks the dot before the next
        // tick — display is consistent and the aircraft never jumps back.
        this.upsertGeoJsonSource("airlinesim-flights", this.interpolatedFlights(Date.now()));
        this.applySelectedFlightState();
        this.upsertGeoJsonSource("airlinesim-airports", airportData);
        this.ensureRouteLayer();
        this.ensurePlaneIcon();
        this.ensureFlightLayer();
        this.ensureAirportLayers();
        // Flights must render above route lines and airport points (the highest layer),
        // so re-assert top-of-stack every refresh — addLayer only orders on first add.
        this.map.moveLayer("airlinesim-flight-points");
        this.ensureFlightTicker();
        debugLog("layers:applied", {
            counts: this.getFeatureCounts(),
            hasAirportLayer: Boolean(this.map.getLayer("airlinesim-airport-points")),
            hasFlightLayer: Boolean(this.map.getLayer("airlinesim-flight-points")),
            hasRouteLayer: Boolean(this.map.getLayer("airlinesim-route-lines")),
        });
    }

    // Re-asserts the highlighted feature-state for the selected flight after the source
    // is (re)created — feature-state is keyed by source+id and a fresh `addSource` (e.g.
    // after a style swap) drops it.
    private applySelectedFlightState(): void {
        if (!this.map?.getSource("airlinesim-flights") || this.selectedFlightId === null) {
            return;
        }

        this.map.setFeatureState({ id: this.selectedFlightId, source: "airlinesim-flights" }, { selected: true });
    }

    private applyStyle(style: MapStyle): void {
        if (!this.map) {
            return;
        }

        this.pendingCameraState = {
            bearing: this.map.getBearing(),
            center: [this.map.getCenter().lng, this.map.getCenter().lat],
            pitch: this.map.getPitch(),
            zoom: this.map.getZoom(),
        };
        this.map.setStyle(style.url);
    }

    private emit(): void {
        const snapshot = this.getSnapshot();
        this.listeners.forEach((listener) => listener(snapshot));
    }

    private ensureAirportLayers(): void {
        if (!this.map) {
            return;
        }

        if (!this.map.getLayer("airlinesim-airport-points")) {
            this.map.addLayer({
                id: "airlinesim-airport-points",
                paint: {
                    "circle-color": [
                        "match",
                        ["get", "role"],
                        "base",
                        "#2563eb",
                        "hub",
                        "#2563eb",
                        "route_destination",
                        "#10b981",
                        "opportunity",
                        "#f59e0b",
                        "#64748b",
                    ],
                    "circle-radius": [
                        "match",
                        ["get", "role"],
                        "base",
                        8,
                        "hub",
                        8,
                        "route_destination",
                        7,
                        5,
                    ],
                    "circle-stroke-color": "#ffffff",
                    "circle-stroke-width": 2,
                },
                source: "airlinesim-airports",
                type: "circle",
            });
        }

        if (!this.map.getLayer("airlinesim-airport-labels")) {
            this.map.addLayer({
                id: "airlinesim-airport-labels",
                layout: {
                    "text-field": ["coalesce", ["get", "iata_code"], ["get", "icao_code"], ["get", "label"]],
                    "text-offset": [0, 1.2],
                    "text-size": 11,
                },
                paint: {
                    "text-color": this.style.theme === "dark" ? "#f8fafc" : "#0f172a",
                    "text-halo-color": this.style.theme === "dark" ? "#020617" : "#ffffff",
                    "text-halo-width": 1,
                },
                source: "airlinesim-airports",
                type: "symbol",
            });
        }

        this.map.off("click", "airlinesim-airport-points", this.handleAirportClick);
        this.map.on("click", "airlinesim-airport-points", this.handleAirportClick);
    }

    private ensureFlightLayer(): void {
        if (!this.map) {
            return;
        }

        if (!this.map.getLayer("airlinesim-flight-points")) {
            this.map.addLayer({
                id: "airlinesim-flight-points",
                layout: {
                    // Billboard the plane to a geo coordinate; MapLibre re-projects it every
                    // frame, so it stays glued to its position as the globe spins. "map"
                    // alignment lets "icon-rotate" express a real compass heading.
                    "icon-allow-overlap": true,
                    "icon-image": "airlinesim-plane",
                    "icon-rotate": ["coalesce", ["get", "bearing"], 0],
                    "icon-rotation-alignment": "map",
                    "icon-size": 1.1,
                },
                paint: {
                    // SDF icon → recolour per status, mirroring the old dot colours. The
                    // flight selected in the dashboard's flight card overrides this with a
                    // distinct highlight colour via feature-state.
                    "icon-color": [
                        "case",
                        ["boolean", ["feature-state", "selected"], false],
                        "#e11d48",
                        [
                            "match",
                            ["get", "status"],
                            "in_flight",
                            "#16a34a",
                            "boarding",
                            "#f59e0b",
                            "#38bdf8",
                        ],
                    ],
                    "icon-halo-color": "#ffffff",
                    "icon-halo-width": 1.5,
                },
                source: "airlinesim-flights",
                type: "symbol",
            });
        }

        this.map.off("click", "airlinesim-flight-points", this.handleFlightClick);
        this.map.on("click", "airlinesim-flight-points", this.handleFlightClick);
    }

    // Registers the plane glyph used by the flight symbol layer. Built as an SDF so the
    // layer can tint it per flight status via "icon-color". Re-added on demand because a
    // style swap drops all registered images.
    private ensurePlaneIcon(): void {
        if (!this.map || this.map.hasImage("airlinesim-plane")) {
            return;
        }

        const icon = createPlaneIcon();

        if (icon) {
            this.map.addImage("airlinesim-plane", icon, { pixelRatio: 2, sdf: true });
        }
    }

    // Drives live aircraft movement entirely on the client: every second the flight
    // positions are re-interpolated from the embedded origin/destination + airborne
    // window and pushed to the source. No refetch, no remount, no camera change.
    private ensureFlightTicker(): void {
        if (this.flightTickerId !== null) {
            return;
        }

        this.flightTickerId = setInterval(() => this.tickFlightPositions(), 1000);
    }

    private ensureRouteLayer(): void {
        if (!this.map) {
            return;
        }

        if (!this.map.getLayer("airlinesim-route-lines")) {
            this.map.addLayer({
                id: "airlinesim-route-lines",
                layout: {
                    "line-cap": "round",
                    "line-join": "round",
                },
                paint: {
                    "line-color": "#2563eb",
                    "line-opacity": 0.75,
                    "line-width": 3,
                },
                source: "airlinesim-routes",
                type: "line",
            });
        }

        this.map.off("click", "airlinesim-route-lines", this.handleRouteClick);
        this.map.on("click", "airlinesim-route-lines", this.handleRouteClick);
    }

    private fitGameBounds(): void {
        if (!this.map || !this.mapState?.viewport) {
            return;
        }

        // Skip when the viewport is unchanged (real-time polls/ticks), so the camera is
        // not yanked back every refresh while the player is panning the map.
        const viewportKey = JSON.stringify(this.mapState.viewport);
        if (viewportKey === this.lastViewportKey) {
            return;
        }
        this.lastViewportKey = viewportKey;

        const { bounds, center, zoom } = this.mapState.viewport;

        if (bounds) {
            this.map.fitBounds(bounds, { duration: 500, padding: 48 });
            return;
        }

        if (center) {
            // easeTo "around a point" is unsupported under globe projection and logs a
            // warning, so jump directly to the requested center/zoom instead.
            this.map.jumpTo({ center, zoom: zoom ?? 5 });
        }
    }

    private getFeatureCounts(): MapFeatureCounts {
        return {
            airports: this.mapState?.airports?.features.length ?? 0,
            flights: this.mapState?.flights?.features.length ?? 0,
            routes: this.mapState?.routes?.features.length ?? 0,
        };
    }

    private readonly handleAirportClick = (event: { features?: Array<{ properties?: { id?: string } }> }): void => {
        const airportId = event.features?.[0]?.properties?.id;

        if (airportId) {
            airlineSimEventBus.emit("map:airport-selected", {
                airportId,
                source: "map",
            });
        }
    };

    private readonly handleFlightClick = (event: { features?: Array<{ properties?: { id?: string } }> }): void => {
        const flightId = event.features?.[0]?.properties?.id;

        if (flightId) {
            airlineSimEventBus.emit("flight:selected", {
                flightId,
                source: "map",
            });
        }
    };

    private readonly handleRouteClick = (event: { features?: Array<{ properties?: { id?: string } }> }): void => {
        const routeId = event.features?.[0]?.properties?.id;

        if (routeId) {
            airlineSimEventBus.emit("map:route-selected", {
                routeId,
                source: "map",
            });
        }
    };

    private readonly handleWebGlContextLost = (event: Event): void => {
        event.preventDefault();
        debugWarn("webgl:context-lost", { counts: this.getFeatureCounts() });
    };

    private readonly handleWebGlContextRestored = (): void => {
        debugWarn("webgl:context-restored", { counts: this.getFeatureCounts() });
        this.map?.resize();
        this.setGlobeProjection(this.isGlobe, true);
        this.applyGameLayers();
        this.fitGameBounds();
        this.scheduleGameLayerRefresh(true);
    };

    private hasGameLayers(): boolean {
        return Boolean(
            this.map?.getSource("airlinesim-routes") &&
            this.map.getSource("airlinesim-flights") &&
            this.map.getSource("airlinesim-airports") &&
            this.map.getLayer("airlinesim-route-lines") &&
            this.map.getLayer("airlinesim-flight-points") &&
            this.map.getLayer("airlinesim-airport-points"),
        );
    }

    private interpolatedFlights(now: number): Record<string, unknown> {
        const features = (this.mapState?.flights?.features ?? []).map((feature) => {
            const properties = (feature as { properties?: Record<string, unknown> }).properties ?? {};
            const origin = properties.origin as [number, number] | undefined;
            const destination = properties.destination as [number, number] | undefined;
            const takeoff = Date.parse(typeof properties.takeoff_at === "string" ? properties.takeoff_at : "");
            const landing = Date.parse(typeof properties.landing_at === "string" ? properties.landing_at : "");

            if (!origin || !destination || !Number.isFinite(takeoff) || !Number.isFinite(landing) || landing <= takeoff) {
                return feature;
            }

            const progress = Math.max(0, Math.min(1, (now - takeoff) / (landing - takeoff)));
            const coordinates = greatCirclePoint(origin, destination, progress);
            // Heading toward a point just ahead on the arc, so the plane icon noses along
            // its great-circle track (which rotates continuously, unlike a fixed bearing).
            const ahead = greatCirclePoint(origin, destination, Math.min(1, progress + 0.001));

            return {
                ...feature,
                geometry: {
                    // Great-circle (not linear lng/lat) so the dot rides the same arc the
                    // route line is rendered along under the globe projection.
                    coordinates,
                    type: "Point",
                },
                properties: {
                    ...properties,
                    bearing: bearingBetween(coordinates, ahead),
                },
            };
        });

        return { features, type: "FeatureCollection" };
    }

    private restoreCameraState(): void {
        if (!this.map || !this.pendingCameraState) {
            return;
        }

        const cameraState = this.pendingCameraState;
        this.pendingCameraState = null;

        this.zoom = cameraState.zoom;
        this.map.jumpTo(cameraState);
        this.emit();
    }

    private scheduleGameLayerRefresh(shouldFitBounds: boolean): void {
        if (this.refreshFrameId !== null) {
            return;
        }

        this.refreshFrameId = requestAnimationFrame(() => {
            this.refreshFrameId = null;
            this.map?.resize();
            this.applyGameLayers();
            if (shouldFitBounds) {
                this.fitGameBounds();
            }
            this.emit();
        });
    }

    private setMapInteractivity(enabled: boolean): void {
        if (!this.map) {
            return;
        }

        const action = enabled ? "enable" : "disable";

        this.map.dragPan[action]();
        this.map.scrollZoom[action]();
        this.map.boxZoom[action]();
        this.map.dragRotate[action]();
        this.map.keyboard[action]();
        this.map.doubleClickZoom[action]();
        this.map.touchZoomRotate[action]();
    }

    private spinGlobe(): void {
        if (!this.isInRotation || !this.map) {
            return;
        }

        const currentCenter = this.map.getCenter();
        currentCenter.lng += 0.1;

        this.map.jumpTo({ center: currentCenter });

        this.animationId = requestAnimationFrame(() => this.spinGlobe());
    }

    private stopFlightTicker(): void {
        if (this.flightTickerId !== null) {
            clearInterval(this.flightTickerId);
            this.flightTickerId = null;
        }
    }

    private tickFlightPositions(): void {
        if (!this.map?.isStyleLoaded() || !this.mapState?.flights?.features.length) {
            return;
        }

        const source = this.map.getSource("airlinesim-flights") as undefined | { setData?: (data: Record<string, unknown>) => void };
        source?.setData?.(this.interpolatedFlights(Date.now()));
    }

    private upsertGeoJsonSource(id: string, data: Record<string, unknown>): void {
        if (!this.map) {
            return;
        }

        const source = this.map.getSource(id) as undefined | { setData?: (nextData: Record<string, unknown>) => void };

        if (source?.setData) {
            source.setData(data);
            debugLog("source:updated", { features: featureCount(data), id });
            return;
        }

        this.map.addSource(id, {
            data: data as unknown as GeoJSON.GeoJSON,
            type: "geojson",
        });
        debugLog("source:added", { features: featureCount(data), id });
    }

    private zoomBy(delta: number): void {
        this.setRotation(false);

        const currentZoom = this.map?.getZoom() ?? this.zoom;
        const nextZoom = currentZoom + delta;

        this.zoom = nextZoom;
        this.map?.zoomTo(nextZoom, { duration: 300 });
        this.emit();
    }
}

function debugLog(message: string, details: Record<string, unknown>): void {
    if (isDebugLoggingEnabled()) {
        console.warn(DEBUG_LOG_PREFIX, message, details);
    }
}

function debugWarn(message: string, details: Record<string, unknown>): void {
    if (isDebugLoggingEnabled()) {
        console.warn(DEBUG_LOG_PREFIX, message, details);
    }
}

function featureCount(data: Record<string, unknown>): number {
    const {features} = data;

    return Array.isArray(features) ? features.length : 0;
}

// Point a fraction `t` along the great circle between two [lng, lat] coordinates.
// Mirrors how MapLibre densifies a 2-point line into a geodesic on the globe.
function greatCirclePoint(start: [number, number], end: [number, number], t: number): [number, number] {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;
    const lat1 = start[1] * toRad;
    const lon1 = start[0] * toRad;
    const lat2 = end[1] * toRad;
    const lon2 = end[0] * toRad;
    const delta = 2 * Math.asin(Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
    ));

    if (delta === 0) {
        return start;
    }

    const a = Math.sin((1 - t) * delta) / Math.sin(delta);
    const b = Math.sin(t * delta) / Math.sin(delta);
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);

    return [Math.atan2(y, x) * toDeg, Math.atan2(z, Math.sqrt(x * x + y * y)) * toDeg];
}

// Initial bearing (degrees, 0 = north) from one [lng, lat] toward another.
function bearingBetween(from: [number, number], to: [number, number]): number {
    const toRad = Math.PI / 180;
    const lat1 = from[1] * toRad;
    const lat2 = to[1] * toRad;
    const dLon = (to[0] - from[0]) * toRad;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Rasterises an upward-pointing plane silhouette to an SDF-able image. Drawn pointing
// north so "icon-rotate" maps directly to compass bearing. Returns null outside the DOM.
function createPlaneIcon(): ImageData | null {
    if (typeof document === "undefined") {
        return null;
    }

    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        return null;
    }

    const c = size / 2;
    ctx.fillStyle = "#ffffff";
    ctx.translate(c, c);
    ctx.beginPath();
    // Top-down airliner pointing up: nose, swept wings, fuselage, tailplane.
    ctx.moveTo(0, -20);
    ctx.lineTo(3, -8);
    ctx.lineTo(20, 4);
    ctx.lineTo(20, 9);
    ctx.lineTo(3, 4);
    ctx.lineTo(3, 14);
    ctx.lineTo(9, 19);
    ctx.lineTo(9, 22);
    ctx.lineTo(0, 19);
    ctx.lineTo(-9, 22);
    ctx.lineTo(-9, 19);
    ctx.lineTo(-3, 14);
    ctx.lineTo(-3, 4);
    ctx.lineTo(-20, 9);
    ctx.lineTo(-20, 4);
    ctx.lineTo(-3, -8);
    ctx.closePath();
    ctx.fill();

    return ctx.getImageData(0, 0, size, size);
}

// Expands each 2-point route LineString into a great-circle polyline so the rendered
// line tracks the same arc as the great-circle flight dots under globe projection.
function densifyRoutes(routeData: Record<string, unknown>): Record<string, unknown> {
    const features = (Array.isArray(routeData.features) ? routeData.features : []).map((feature) => {
        const geometry = (feature as { geometry?: { coordinates?: unknown; type?: string } }).geometry;
        const coordinates = geometry?.coordinates;

        if (!geometry || geometry.type !== "LineString" || !Array.isArray(coordinates) || coordinates.length < 2) {
            return feature;
        }

        const start = coordinates[0] as [number, number];
        const end = coordinates[coordinates.length - 1] as [number, number];

        return {
            ...(feature as Record<string, unknown>),
            geometry: { coordinates: greatCircleLine(start, end), type: "LineString" },
        };
    });

    return { features, type: "FeatureCollection" };
}

// Sampled great-circle path with longitudes unwrapped past ±180 so a leg crossing the
// antimeridian draws as one continuous arc instead of a horizontal streak.
function greatCircleLine(start: [number, number], end: [number, number]): Array<[number, number]> {
    const steps = 64;
    const points: Array<[number, number]> = [];
    let previousLng: null | number = null;

    for (let index = 0; index <= steps; index += 1) {
        const [rawLng, lat] = greatCirclePoint(start, end, index / steps);
        let lng = rawLng;

        if (previousLng !== null) {
            while (lng - previousLng > 180) {
                lng -= 360;
            }
            while (lng - previousLng < -180) {
                lng += 360;
            }
        }

        previousLng = lng;
        points.push([lng, lat]);
    }

    return points;
}

function isDebugLoggingEnabled(): boolean {
    return import.meta.env.DEV || import.meta.env.MODE !== "production";
}

function toPlainMapState(mapState: MapState | null): MapState | null {
    if (!mapState) {
        return null;
    }

    try {
        return JSON.parse(JSON.stringify(mapState)) as MapState;
    } catch {
        return mapState;
    }
}

export const mapManager = new MapManager();
