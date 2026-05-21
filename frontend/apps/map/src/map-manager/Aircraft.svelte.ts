export class AircraftManager {
    public get planes(): GeoJSON.FeatureCollection {
        return this.planesGeoJSON;
    }

    private readonly planesGeoJSON: GeoJSON.FeatureCollection = {
        features: [],
        type: "FeatureCollection",
    };
}
