import type {
    CustomLayerInterface,
    CustomRenderMethodInput,
    Map as MapLibreMap,
} from "maplibre-gl";

import * as THREE from "three";

export type AirplaneModel = {
    altitude: number;
    group: THREE.Group;
    id: string;
    lat: number;
    lng: number;
};

type ModelMatrixTransform = MapLibreMap["transform"] & {
    getMatrixForModel: (
        coordinates: [number, number],
        altitude: number,
    ) => number[];
};

export class ThreeLayer implements CustomLayerInterface {
    public id = "3d-models-layer";
    public renderingMode = "3d" as const;
    public type = "custom" as const;

    private readonly airplanes = new Map<string, AirplaneModel>();
    private readonly camera: THREE.Camera;
    private readonly map: MapLibreMap;
    private renderer: null | THREE.WebGLRenderer = null;

    private readonly scene: THREE.Scene;

    constructor(map: MapLibreMap) {
        this.map = map;
        this.scene = new THREE.Scene();

        this.camera = new THREE.Camera();

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(0, 100, 100).normalize();
        this.scene.add(directionalLight);
    }

    public addAirplane(airplane: AirplaneModel): void {
        this.airplanes.set(airplane.id, airplane);
        this.scene.add(airplane.group);

        airplane.group.matrixAutoUpdate = false;

        this.map.triggerRepaint();
    }

    public onAdd(map: MapLibreMap, gl: WebGLRenderingContext): void {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: map.getCanvas(),
            context: gl,
        });
        this.renderer.autoClear = false;
    }


    public onRemove(): void {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }

    public removeAirplane(id: string): void {
        const airplane = this.airplanes.get(id);
        if (airplane) {
            this.scene.remove(airplane.group);
            this.airplanes.delete(id);
            this.map.triggerRepaint();
        }
    }

    public render(
        _gl: WebGLRenderingContext,
        args: CustomRenderMethodInput,
    ): void {
        if (!this.renderer) {
            return;
        }

        if (this.map.getZoom() < 6) {
            return;
        }

        const mapProjectionMatrix = new THREE.Matrix4().fromArray(
            args.defaultProjectionData.mainMatrix,
        );
        this.camera.projectionMatrix.copy(mapProjectionMatrix);

        this.airplanes.forEach((airplane) => {
            const modelMatrixArray = (this.map.transform as ModelMatrixTransform).getMatrixForModel(
                [airplane.lng, airplane.lat],
                airplane.altitude,
            );

            airplane.group.matrix.fromArray(modelMatrixArray);
        });

        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
    }
}
