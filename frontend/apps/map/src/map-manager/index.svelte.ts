import { Map as MapLibreMap, type Map as MapLibreMapType } from "maplibre-gl";

import { ThreeLayer } from "./3D/ThreeLayer";
import { MAP__STYLES, type MapStyle, type MapTheme } from "./styles";

const DEFAULT_STYLE = MAP__STYLES[0];

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

    private map: MapLibreMapType | null = null;

    private style = $state<MapStyle>(DEFAULT_STYLE);

    private threeLayer: null | ThreeLayer = null;

    private zoom = $state(2);

    public changeStyle(name: string): void {
        const style = MAP__STYLES.find((mapStyle) => mapStyle.name === name);

        if (style) {
            this.style = style;
            this.map?.setStyle(style.url);
        }
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
    }

    public handleThemeChange(theme: MapTheme): void {
        const style = MAP__STYLES.find((mapStyle) => mapStyle.theme === theme);

        if (style) {
            this.style = style;
            this.map?.setStyle(style.url);
        }
    }

    public init(container: HTMLElement, rotation: boolean): void {
        this.map = new MapLibreMap({
            center: [0, 0],
            container,
            interactive: this.interactable,
            style: this.style.url,
            zoom: this.zoom,
        });
        this.isInRotation = rotation;

        this.map.on("style.load", () => {
            this.setGlobeProjection(this.isGlobe, true);
            this.setRotation(this.isInRotation);
            this.initThreeLayer();
        });
    }

    public setGlobeProjection(isGlobe: boolean, isSystemAction = false): void {
        if (!isSystemAction) {
            this.protectInUninteractableMode();
        }

        this.isGlobe = isGlobe;
        this.map?.setProjection({ type: isGlobe ? "globe" : "mercator" });
    }

    public setRotation(rotationStatus: boolean): void {
        this.isInRotation = rotationStatus;

        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.isInRotation) {
            this.interactableWasTrue = this.interactable;
            this.interactable = false;
            this.spinGlobe();
            return;
        }

        this.interactable = this.interactableWasTrue;
    }

    public zoomIn(): void {
        this.protectInUninteractableMode();
        this.zoom += 1;
        this.map?.zoomTo(this.zoom, { duration: 300 });
    }

    public zoomOut(): void {
        this.protectInUninteractableMode();
        this.zoom -= 1;
        this.map?.zoomTo(this.zoom, { duration: 300 });
    }

    private initThreeLayer(): void {
        if (!this.map) {
            return;
        }

        this.threeLayer = new ThreeLayer(this.map);
        this.map.addLayer(this.threeLayer);
    }

    private protectInUninteractableMode(): void {
        if (!this.interactable) {
            throw new Error("Map is not interactable");
        }
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
}

export const mapManager = new MapManager();
