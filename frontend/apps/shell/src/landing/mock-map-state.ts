import type { MapAirportFeature } from "../dashboard/types";

// Мок-состояние карты для публичного лендинга: глобус из MFE map получает
// данные только через props, поэтому без авторизации показываем
// демонстрационную сеть из реальных координат крупных аэропортов.
export type LandingMapState = {
  airports: { features: MapAirportFeature[]; type: "FeatureCollection" };
  flights: { features: Array<Record<string, unknown>>; type: "FeatureCollection" };
  routes: { features: Array<Record<string, unknown>>; type: "FeatureCollection" };
  viewport: { center: [number, number]; zoom: number };
};

type MockAirport = {
  coordinates: [number, number];
  iata: string;
  label: string;
  role: "base" | "opportunity";
};

const MOCK_AIRPORTS: MockAirport[] = [
  { coordinates: [126.4407, 37.4602], iata: "ICN", label: "Seoul Incheon", role: "base" },
  { coordinates: [139.7811, 35.5494], iata: "HND", label: "Tokyo Haneda", role: "opportunity" },
  { coordinates: [103.9893, 1.3644], iata: "SIN", label: "Singapore Changi", role: "opportunity" },
  { coordinates: [55.3644, 25.2528], iata: "DXB", label: "Dubai Intl", role: "opportunity" },
  { coordinates: [-0.4543, 51.47], iata: "LHR", label: "London Heathrow", role: "base" },
  { coordinates: [37.4146, 55.9726], iata: "SVO", label: "Moscow Sheremetyevo", role: "opportunity" },
  { coordinates: [-73.7781, 40.6413], iata: "JFK", label: "New York JFK", role: "opportunity" },
  { coordinates: [-118.4085, 33.9416], iata: "LAX", label: "Los Angeles Intl", role: "base" },
  { coordinates: [151.1772, -33.9461], iata: "SYD", label: "Sydney", role: "opportunity" },
];

// Маршруты из хаба ICN и пара межконтинентальных дуг.
const MOCK_ROUTE_PAIRS: Array<[string, string]> = [
  ["ICN", "HND"],
  ["ICN", "SIN"],
  ["ICN", "DXB"],
  ["ICN", "LAX"],
  ["ICN", "SYD"],
  ["DXB", "LHR"],
  ["LHR", "JFK"],
  ["JFK", "LAX"],
  ["SIN", "SYD"],
  ["SVO", "ICN"],
];

// Рейсы в воздухе: [откуда, куда, текущий прогресс 0..1].
const MOCK_FLIGHTS: Array<[string, string, number]> = [
  ["ICN", "DXB", 0.35],
  ["LHR", "JFK", 0.6],
  ["ICN", "SYD", 0.2],
  ["SIN", "ICN", 0.75],
];

const MOCK_FLIGHT_DURATION_MS = 8 * 60 * 60 * 1000;

export function buildLandingMapState(): LandingMapState {
  const byIata = new Map(MOCK_AIRPORTS.map((airport) => [airport.iata, airport]));
  const now = Date.now();

  return {
    airports: {
      features: MOCK_AIRPORTS.map((airport) => ({
        geometry: { coordinates: airport.coordinates, type: "Point" },
        id: airport.iata,
        properties: { id: airport.iata, label: `${airport.label} (${airport.iata})`, role: airport.role },
        type: "Feature",
      })),
      type: "FeatureCollection",
    },
    flights: {
      features: MOCK_FLIGHTS.flatMap(([fromIata, toIata, progress]) => {
        const from = byIata.get(fromIata);
        const to = byIata.get(toIata);

        if (!from || !to) {
          return [];
        }

        // Время взлета/посадки подбирается так, чтобы рейс был на нужном
        // прогрессе прямо сейчас и продолжал лететь, пока открыт лендинг.
        const takeoffAt = now - progress * MOCK_FLIGHT_DURATION_MS;

        return [
          {
            geometry: { coordinates: from.coordinates, type: "Point" },
            id: `${fromIata}-${toIata}`,
            properties: {
              destination: to.coordinates,
              id: `${fromIata}-${toIata}`,
              landing_at: new Date(takeoffAt + MOCK_FLIGHT_DURATION_MS).toISOString(),
              origin: from.coordinates,
              status: "in_flight",
              takeoff_at: new Date(takeoffAt).toISOString(),
            },
            type: "Feature",
          },
        ];
      }),
      type: "FeatureCollection",
    },
    routes: {
      features: MOCK_ROUTE_PAIRS.flatMap(([fromIata, toIata]) => {
        const from = byIata.get(fromIata);
        const to = byIata.get(toIata);

        if (!from || !to) {
          return [];
        }

        return [
          {
            geometry: { coordinates: [from.coordinates, to.coordinates], type: "LineString" },
            id: `${fromIata}-${toIata}`,
            properties: { id: `${fromIata}-${toIata}` },
            type: "Feature",
          },
        ];
      }),
      type: "FeatureCollection",
    },
    viewport: { center: [126.44, 30], zoom: 1.4 },
  };
}
