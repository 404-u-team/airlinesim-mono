import type {
    CustomLayerInterface,
    CustomRenderMethodInput,
    Map as MapLibreMap,
} from "maplibre-gl";

import * as THREE from "three";

import type { MapTheme } from "../styles";

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

const MODEL_LAYER_ID = "3d-models-layer";
const SHADOW_NAME = "aircraft-ground-shadow";

export class ThreeLayer implements CustomLayerInterface {
    public id = MODEL_LAYER_ID;
    public renderingMode = "3d" as const;
    public type = "custom" as const;

    private readonly airplanes = new Map<string, AirplaneModel>();
    private readonly camera: THREE.Camera;
    private readonly map: MapLibreMap;
    private renderer: null | THREE.WebGLRenderer = null;

    private readonly scene: THREE.Scene;
    private readonly shadowTexture: THREE.CanvasTexture;
    private theme: MapTheme;

    constructor(map: MapLibreMap, theme: MapTheme) {
        this.map = map;
        this.theme = theme;
        this.scene = new THREE.Scene();
        this.shadowTexture = this.createShadowTexture();

        this.camera = new THREE.Camera();

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(0, 100, 100).normalize();
        this.scene.add(directionalLight);
    }

    public addAirplane(airplane: AirplaneModel): void {
        this.airplanes.set(airplane.id, airplane);
        this.ensureModelShadow(airplane.group);
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

        this.shadowTexture.dispose();
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

        const mapProjectionMatrix = new THREE.Matrix4().fromArray(
            args.defaultProjectionData.mainMatrix,
        );
        this.camera.projectionMatrix.copy(mapProjectionMatrix);
        const modelScale = this.getZoomAdaptiveScale(this.map.getZoom());

        this.airplanes.forEach((airplane) => {
            const modelMatrixArray = (this.map.transform as ModelMatrixTransform).getMatrixForModel(
                [airplane.lng, airplane.lat],
                airplane.altitude,
            );

            airplane.group.matrix.fromArray(modelMatrixArray);
            airplane.group.matrix.multiply(
                new THREE.Matrix4().makeScale(modelScale, modelScale, modelScale),
            );
        });

        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
    }

    public setTheme(theme: MapTheme): void {
        this.theme = theme;
        this.airplanes.forEach((airplane) => {
            const shadow = airplane.group.getObjectByName(SHADOW_NAME);

            if (shadow) {
                shadow.visible = this.theme === "light";
            }
        });
        this.map.triggerRepaint();
    }

    private createShadowTexture(): THREE.CanvasTexture {
        const canvas = document.createElement("canvas");
        canvas.height = 128;
        canvas.width = 128;

        const context = canvas.getContext("2d");

        if (context) {
            const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 58);
            gradient.addColorStop(0, "rgba(15, 23, 42, 0.32)");
            gradient.addColorStop(0.55, "rgba(15, 23, 42, 0.16)");
            gradient.addColorStop(1, "rgba(15, 23, 42, 0)");

            context.fillStyle = gradient;
            context.fillRect(0, 0, 128, 128);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        return texture;
    }

    private ensureModelShadow(group: THREE.Group): void {
        if (group.getObjectByName(SHADOW_NAME)) {
            return;
        }

        const shadow = new THREE.Sprite(
            new THREE.SpriteMaterial({
                color: 0x0f172a,
                depthWrite: false,
                map: this.shadowTexture,
                opacity: 0.38,
                transparent: true,
            }),
        );
        shadow.name = SHADOW_NAME;
        shadow.renderOrder = -1;
        shadow.scale.set(34, 12, 1);
        shadow.visible = this.theme === "light";

        group.add(shadow);
    }

    private getZoomAdaptiveScale(zoom: number): number {
        const screenCompensation = 2 ** (8 - zoom);

        return THREE.MathUtils.clamp(screenCompensation, 0.18, 18);
    }
}
