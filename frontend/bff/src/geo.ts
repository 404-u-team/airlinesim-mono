export type GeoPoint = { latitude: number; longitude: number };

/**
 * Parses an airport coordinate from a PostGIS geometry value. Accepts both WKT
 * (`POINT (lon lat)`, used by demo/seed data) and EWKB hex (returned by the live
 * backend). Returns null when no usable geometry is present.
 */
export function parseGeoPoint(geog?: string, geom?: string): GeoPoint | null {
  const raw = geog ?? geom ?? "";

  return parseWktPoint(raw) ?? parseWkbHexPoint(raw);
}

function parseWkbHexPoint(hex: string): GeoPoint | null {
  // PostGIS returns geometry as EWKB hex (e.g. "0101000020E6100000..."), not WKT.
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length < 42) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const geometryType = view.getUint32(1, littleEndian);
  const hasSrid = (geometryType & 0x20000000) !== 0;

  if ((geometryType & 0xff) !== 1) {
    return null;
  }

  const offset = hasSrid ? 9 : 5;
  if (bytes.length < offset + 16) {
    return null;
  }

  const longitude = view.getFloat64(offset, littleEndian);
  const latitude = view.getFloat64(offset + 8, littleEndian);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  return { latitude, longitude };
}

function parseWktPoint(raw: string): GeoPoint | null {
  const match = /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i.exec(raw);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    latitude: Number(match[2]),
    longitude: Number(match[1]),
  };
}
