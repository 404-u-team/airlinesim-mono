import maplibregl from 'maplibre-gl';
import { MAP__STYLES } from './styles';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ThreeLayer, type AirplaneModel } from './3D/ThreeLayer';

export class MapManager {
    private map: maplibregl.Map | null = null;
    private isGlobe = $state(true);
    private style = $state(MAP__STYLES[0]);
    private isInRotation = $state(false);
    private zoom = $state(2);
    private interactable = $state(true);
    private interactableWasTrue = $state(true);
    private animationId: number | null = null;

    private threeLayer: ThreeLayer | null = null;
    private gltfLoader = new GLTFLoader();

    public init(container: HTMLElement, rotation: boolean) {
        this.map = new maplibregl.Map({
            container,
            style: this.style.url,
            center: [0, 0],
            zoom: this.zoom,
            interactive: this.interactable,
        });
        this.isInRotation = rotation;

        this.map.on('style.load', () => {
            this.setGlobeProjection(this.isGlobe, true);
            this.setRotation(this.isInRotation);

            this.initThreeLayer();
        });
    }

    private async initThreeLayer() {
        if (!this.map) return;

        // if (!this.map.hasImage('plane-2d')) {
        //     const img = new Image();

        //     img.width = 64;
        //     img.height = 64;

        //     img.onload = () => {
        //         if (this.map && !this.map.hasImage('plane-2d')) {
        //             this.map.addImage('plane-2d', img);
        //         }
        //     };

        //     img.onerror = (err) => console.error('Не удалось загрузить иконку самолета:', err);

        //     img.src = '/plane-2d/airplane-black.svg';
        // }
        // if (!this.map.getSource('airplanes-2d-source')) {
        //     this.map.addSource('airplanes-2d-source', {
        //         type: 'geojson',
        //         data: this.planesGeoJSON
        //     });
        // }

        // if (!this.map.getLayer('airplanes-2d-layer')) {
        //     this.map.addLayer({
        //         id: 'airplanes-2d-layer',
        //         type: 'symbol',
        //         source: 'airplanes-2d-source',
        //         maxzoom: 6,
        //         layout: {
        //             'icon-image': 'plane-2d',
        //             'icon-size': 0.5,
        //             'icon-allow-overlap': true,
        //             'icon-ignore-placement': true
        //         }
        //     });
        // }

        this.threeLayer = new ThreeLayer(this.map);
        this.map.addLayer(this.threeLayer);
    }

    get mapInstance() {
        return this.map;
    }

    get Globe() {
        return this.isGlobe;
    }

    get InRotation() {
        return this.isInRotation;
    }

    get AvailableStyles() {
        return MAP__STYLES;
    }

    get SelectedStyle() {
        return this.style;
    }

    public destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }

    public zoomIn() {
        this.protectInUninteractableMode();
        this.zoom += 1;
        this.map?.zoomTo(this.zoom, { duration: 300 });
    }

    public zoomOut() {
        this.protectInUninteractableMode();
        this.zoom -= 1;
        this.map?.zoomTo(this.zoom, { duration: 300 });
    }

    public setRotation(rotationStatus: boolean) {
        this.isInRotation = rotationStatus;

        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.isInRotation) {
            this.interactableWasTrue = this.interactable;
            this.interactable = false;
            this.spinGlobe();
        } else {
            this.interactable = this.interactableWasTrue;
        }
    }

    public setGlobeProjection(isGlobe: boolean, isSystemAction = false) {
        if (!isSystemAction) {
            this.protectInUninteractableMode();
        }

        this.isGlobe = isGlobe;
        this.map?.setProjection({ type: isGlobe ? 'globe' : 'mercator' });
    }

    public changeStyle(name: string) {
        const style = MAP__STYLES.find((style) => style.name === name);
        if (style) {
            this.style = style;
            this.map?.setStyle(style.url);
        }
    }

    public handleThemeChange(theme: "light" | "dark") {
        const style = MAP__STYLES.find((style) => style.theme === theme);
        if (style) {
            this.style = style;
            this.map?.setStyle(style.url);
        }
    }

    // public spawnAirplane(lng: number, lat: number) {
    //     if (!this.threeLayer || !this.map) return;

    //     const planeId = `flight-${Date.now()}`;

    //     this.planesGeoJSON.features.push({
    //         type: 'Feature',
    //         geometry: {
    //             type: 'Point',
    //             coordinates: [lng, lat]
    //         },
    //         properties: { id: planeId }
    //     });

    //     const source = this.map.getSource('airplanes-2d-source') as maplibregl.GeoJSONSource;
    //     if (source) {
    //         source.setData(this.planesGeoJSON);
    //     }

    //     this.gltfLoader.load('/plane-3d/Airplane.glb', (gltf) => {
    //         const model = gltf.scene;
    //         model.scale.set(5000, 5000, 5000);

    //         const group = new THREE.Group();
    //         group.add(model);

    //         const airplane: AirplaneModel = {
    //             id: planeId,
    //             lng,
    //             lat,
    //             altitude: 0,
    //             group
    //         };

    //         this.threeLayer!.addAirplane(airplane);

    //         this.map!.flyTo({ center: [lng, lat] as [number, number], zoom: 6, duration: 2000 });
    //     }, undefined, (err) => console.error(err));
    // }

    private spinGlobe = () => {
        if (!this.isInRotation || !this.map) return;

        const currentCenter = this.map.getCenter();
        currentCenter.lng += 0.1;

        this.map.jumpTo({ center: currentCenter });

        this.animationId = requestAnimationFrame(this.spinGlobe);
    }

    private protectInUninteractableMode() {
        if (!this.interactable) {
            throw new Error("Map is not interactable");
        }
    }
}

export const mapManager = new MapManager();