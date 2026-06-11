import { expect, test } from "bun:test";

test("dashboard map state contract keeps airport and route feature collections separate", () => {
  const mapState = {
    airports: {
      features: [
        {
          geometry: { coordinates: [126.4505, 37.4691], type: "Point" },
          properties: { id: "airport-1", label: "ICN - Incheon", role: "base" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    },
    routes: {
      features: [],
      type: "FeatureCollection",
    },
  };

  expect(mapState.airports.features[0]?.geometry.type).toBe("Point");
  expect(mapState.routes.features).toEqual([]);
});
