import { getAircraftImageUrl } from "./storage";

type AircraftImageSource = {
  characteristics?: string;
  icao_code?: string;
};

// Resolves the image URL for an aircraft type at serve time. Prefers the BFF
// SQLite overlay keyed by ICAO code (populated by admin overrides and the
// standalone aircraft-image refresh), then falls back to an image baked into
// `characteristics.visual.imageUrl` (set during a fresh import). The overlay
// must win so admin-set/refreshed images actually take effect. Used across
// fleet/operations/facilities/routes.
export function resolveAircraftImageUrl(
  type: AircraftImageSource | null | undefined,
): string | undefined {
  if (!type) {
    return undefined;
  }

  return getAircraftImageUrl(type.icao_code) ?? imageUrlFromCharacteristics(type.characteristics);
}

function imageUrlFromCharacteristics(characteristics: string | undefined): string | undefined {
  if (!characteristics) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(characteristics) as { visual?: { imageUrl?: unknown } };
    const imageUrl = parsed.visual?.imageUrl;

    return typeof imageUrl === "string" && imageUrl ? imageUrl : undefined;
  } catch {
    return undefined;
  }
}
