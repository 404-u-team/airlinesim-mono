import type { BffConfig } from "../../config";
import type { ImportLogger } from "../import/runtime/logger";
import type { ImportProgressReporter } from "../import/runtime/progress";

import { getBackendAdminToken } from "../../auth";
import { backendRequest } from "../import/backend/api";
import { fetchAircraftVisualImage } from "./fetch";
import { type AircraftImageMap, readAircraftImages, writeAircraftImages } from "./storage";

export type AircraftImagesResult = {
  errors: string[];
  found: number;
  missing: number;
  processed: number;
  skipped: number;
};

export type RefreshAircraftImagesOptions = {
  // Re-fetch images even for types that already have one cached.
  refresh?: boolean;
};

type BackendAircraftType = {
  characteristics?: string;
  icao_code?: string;
  id?: string;
  model_name?: string;
};

// Standalone aircraft-image refresh. Reads every aircraft type from the backend
// (via the service admin token) and resolves a photo for each, persisting the
// result into the BFF SQLite overlay store. Runs independently of the world-data
// import; images are attached at serve time, so existing types light up at once.
export async function refreshAircraftImages(
  config: BffConfig,
  options: RefreshAircraftImagesOptions = {},
  reportProgress?: ImportProgressReporter,
  log?: ImportLogger,
): Promise<AircraftImagesResult> {
  reportProgress?.({ message: "Loading aircraft types from backend", percent: 4, stage: "preparing" });

  const token = await getBackendAdminToken(config);
  const response = await backendRequest<{ items?: BackendAircraftType[] }>(config, "/aircraft-types", {
    entityType: "aircraft-type",
    log,
    token,
  });
  const types = (response.items ?? []).filter((type) => Boolean(type.icao_code));

  const images: AircraftImageMap = { ...readAircraftImages() };
  const result: AircraftImagesResult = { errors: [], found: 0, missing: 0, processed: 0, skipped: 0 };

  for (let index = 0; index < types.length; index++) {
    const type = types[index];
    if (!type) {
      continue;
    }
    const icaoCode = (type.icao_code ?? "").toUpperCase();
    const modelName = type.model_name ?? icaoCode;

    reportProgress?.({
      current: index + 1,
      message: `Resolving image for ${modelName} (${icaoCode})`,
      percent: 8 + Math.round((index / Math.max(1, types.length)) * 88),
      stage: "importing",
      total: types.length,
    });

    // eslint-disable-next-line no-await-in-loop
    await refreshTypeImage(type, images, options, result, log);
  }

  writeAircraftImages(images);
  reportProgress?.({
    counts: { found: result.found, missing: result.missing, processed: result.processed, skipped: result.skipped },
    message: "Aircraft image refresh completed",
    percent: 100,
    stage: "finalizing",
  });

  return result;
}

function logImageFound(icaoCode: string, modelName: string, imageUrl: string, source?: string, log?: ImportLogger): void {
  log?.({
    details: { imageUrl, source },
    entityType: "aircraft-type",
    level: "info",
    message: `Image found for ${modelName}`,
    operation: "aircraft-image.found",
    sourceKey: icaoCode,
    stage: "importing",
  });
}

function logImageMissing(icaoCode: string, modelName: string, log?: ImportLogger): void {
  log?.({
    entityType: "aircraft-type",
    level: "warning",
    message: `No image found for ${modelName}`,
    operation: "aircraft-image.missing",
    sourceKey: icaoCode,
    stage: "importing",
  });
}

async function refreshTypeImage(
  type: BackendAircraftType,
  images: AircraftImageMap,
  options: RefreshAircraftImagesOptions,
  result: AircraftImagesResult,
  log?: ImportLogger,
): Promise<void> {
  const icaoCode = (type.icao_code ?? "").toUpperCase();
  const modelName = type.model_name ?? icaoCode;

  result.processed++;

  if (!options.refresh && images[icaoCode]?.imageUrl) {
    result.skipped++;
    return;
  }

  try {
    const image = await fetchAircraftVisualImage({
      characteristics: type.characteristics,
      icaoCode,
      modelName,
    });

    if (image?.imageUrl) {
      // eslint-disable-next-line require-atomic-updates
      images[icaoCode] = image;
      writeAircraftImages(images);
      result.found++;
      logImageFound(icaoCode, modelName, image.imageUrl, image.source, log);
    } else {
      result.missing++;
      logImageMissing(icaoCode, modelName, log);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image fetch failed";
    result.errors.push(`${icaoCode}: ${message}`);
    log?.({
      entityType: "aircraft-type",
      level: "error",
      message: `Image fetch failed for ${modelName}: ${message}`,
      operation: "aircraft-image.error",
      sourceKey: icaoCode,
      stage: "importing",
    });
  }
}
