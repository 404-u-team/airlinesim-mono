// src/map-manager/ThreeLayer.ts
import maplibregl from 'maplibre-gl';
import * as THREE from 'three';

export interface AirplaneModel {
    id: string;
    lng: number;
    lat: number;
    altitude: number;
    group: THREE.Group;
}

export class ThreeLayer implements maplibregl.CustomLayerInterface {
    public id = '3d-models-layer';
    public type = 'custom' as const;
    public renderingMode = '3d' as const;

    private map: maplibregl.Map;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private renderer: THREE.WebGLRenderer | null = null;

    private airplanes: Map<string, AirplaneModel> = new Map();

    constructor(map: maplibregl.Map) {
        this.map = map;
        this.scene = new THREE.Scene();

        this.camera = new THREE.Camera();

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(0, 100, 100).normalize();
        this.scene.add(directionalLight);
    }

    public addAirplane(airplane: AirplaneModel) {
        this.airplanes.set(airplane.id, airplane);
        this.scene.add(airplane.group);

        airplane.group.matrixAutoUpdate = false;

        this.map.triggerRepaint();
    }

    public removeAirplane(id: string) {
        const airplane = this.airplanes.get(id);
        if (airplane) {
            this.scene.remove(airplane.group);
            this.airplanes.delete(id);
            this.map.triggerRepaint();
        }
    }


    public onAdd(map: maplibregl.Map, gl: WebGLRenderingContext) {
        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true,
        });
        this.renderer.autoClear = false;
    }

    public onRemove() {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }

    public render(gl: WebGLRenderingContext, args: maplibregl.CustomRenderMethodInput) {
        if (!this.renderer || !this.map) return;

        if (this.map.getZoom() < 6) {
            return;
        }

        const mapProjectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
        this.camera.projectionMatrix.copy(mapProjectionMatrix);

        this.airplanes.forEach((airplane) => {
            const modelMatrixArray = (this.map.transform as any).getMatrixForModel(
                [airplane.lng, airplane.lat],
                airplane.altitude
            );

            airplane.group.matrix.fromArray(modelMatrixArray);
        });

        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
    }
}