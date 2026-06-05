import { airlineSimEventBus } from "@airlinesim/event-bus";
/* eslint-disable max-lines */
import { Map as MapLibreMap, type Map as MapLibreMapType } from "maplibre-gl";
import { SvelteSet } from "svelte/reactivity";

import { ThreeLayer } from "./3D/ThreeLayer";
import { MAP__STYLES, type MapStyle, type MapTheme } from "./styles";

const DEFAULT_STYLE = MAP__STYLES[0];
const DEFAULT_ZOOM = 2;

export type MapAirportFeature = {
    geometry: {
        coordinates: [number, number];
        type: "Point";
    };
    id?: string;
    properties: {
        id?: string;
        label?: string;
        role?: "base" | "opportunity" | "route_destination";
    };
    type: "Feature";
};

export type MapManagerSnapshot = {
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
    private interactable = $state(true);
    private interactableWasTrue = $state(true);

    private isGlobe = $state(true);

    private isInRotation = $state(false);

    private readonly listeners = new SvelteSet<MapManagerListener>();

    private map: MapLibreMapType | null = null;

    private mapState: MapState | null = null;

    private pendingCameraState: CameraState | null = null;

    private style = $state<MapStyle>(DEFAULT_STYLE);

    private threeLayer: null | ThreeLayer = null;

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

        this.threeLayer = null;

        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        this.emit();
    }

    public getSnapshot(): MapManagerSnapshot {
        return {
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
        this.isInRotation = rotation;
        this.zoom = this.map.getZoom();
        this.emit();

        this.map.on("style.load", () => {
            this.restoreCameraState();
            this.setGlobeProjection(this.isGlobe, true);
            this.setRotation(this.isInRotation);
            this.initThreeLayer();
            this.applyGameLayers();
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
        this.mapState = mapState;
        this.applyGameLayers();
        this.fitGameBounds();
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
        const flightData = this.mapState?.flights ?? { features: [], type: "FeatureCollection" as const };
        const routeData = this.mapState?.routes ?? { features: [], type: "FeatureCollection" as const };

        this.upsertGeoJsonSource("airlinesim-routes", routeData);
        this.upsertGeoJsonSource("airlinesim-flights", flightData);
        this.upsertGeoJsonSource("airlinesim-airports", airportData);
        this.ensureRouteLayer();
        this.ensureFlightLayer();
        this.ensureAirportLayers();
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
        this.threeLayer = null;
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
                paint: {
                    "circle-color": [
                        "match",
                        ["get", "status"],
                        "in_flight",
                        "#16a34a",
                        "boarding",
                        "#f59e0b",
                        "#38bdf8",
                    ],
                    "circle-radius": 6,
                    "circle-stroke-color": "#ffffff",
                    "circle-stroke-width": 2,
                },
                source: "airlinesim-flights",
                type: "circle",
            });
        }

        this.map.off("click", "airlinesim-flight-points", this.handleFlightClick);
        this.map.on("click", "airlinesim-flight-points", this.handleFlightClick);
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

        const { bounds, center, zoom } = this.mapState.viewport;

        if (bounds) {
            this.map.fitBounds(bounds, { duration: 500, padding: 48 });
            return;
        }

        if (center) {
            this.map.easeTo({ center, duration: 500, zoom: zoom ?? 5 });
        }
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

    private initThreeLayer(): void {
        if (!this.map) {
            return;
        }

        if (this.map.getLayer("3d-models-layer")) {
            return;
        }

        this.threeLayer = new ThreeLayer(this.map, this.style.theme);
        this.map.addLayer(this.threeLayer);
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

    private upsertGeoJsonSource(id: string, data: Record<string, unknown>): void {
        if (!this.map) {
            return;
        }

        const source = this.map.getSource(id) as undefined | { setData?: (nextData: Record<string, unknown>) => void };

        if (source?.setData) {
            source.setData(data);
            return;
        }

        this.map.addSource(id, {
            data: data as unknown as GeoJSON.GeoJSON,
            type: "geojson",
        });
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

export const mapManager = new MapManager();
