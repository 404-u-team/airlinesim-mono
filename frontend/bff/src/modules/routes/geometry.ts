import type { Airport } from "../fleet/types";
import type { RouteAirport } from "./types";

import { parseGeoPoint } from "../../geo";

export function buildDistanceKm(origin: Airport, destination: Airport): number {
  const originPoint = pointFromAirport(origin);
  const destinationPoint = pointFromAirport(destination);

  if (!originPoint || !destinationPoint) {
    return 1500;
  }

  return distanceKm(originPoint.latitude, originPoint.longitude, destinationPoint.latitude, destinationPoint.longitude);
}

export function pointFromAirport(airport: Airport): null | { latitude: number; longitude: number } {
  return parseGeoPoint(airport.geog, airport.geom);
}

export function toRouteAirport(airport: Airport): RouteAirport {
  return {
    ...airport,
    coordinates: pointFromAirport(airport),
    label: `${airport.iata_code ?? airport.icao_code ?? "----"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}`,
  };
}

function distanceKm(leftLat: number, leftLng: number, rightLat: number, rightLng: number): number {
  const radius = 6371;
  const dLat = toRadians(rightLat - leftLat);
  const dLng = toRadians(rightLng - leftLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(leftLat)) * Math.cos(toRadians(rightLat)) * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
