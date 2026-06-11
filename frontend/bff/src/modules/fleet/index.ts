import type { BffConfig } from "../../config";

import { getUserAuthorization, requireValidUserToken } from "../../auth";
import { jsonResponse } from "../../http";
import {
  getAircraftDetail,
  getOwnedFleet,
  handlePurchaseAircraft,
  handleUpdateTailNumber,
} from "./aircraft";
import { handleFleetError } from "./errors";
import { getFleetMarket } from "./market";
import { buildPurchasePreview } from "./preview";
import { loadFleetSnapshot } from "./snapshot";

export async function handleFleetRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/fleet/")) {
    return null;
  }

  if (!getUserAuthorization(request)) {
    return jsonResponse(
      {
        error: {
          code: "AUTH_REQUIRED",
          message: "Authentication required.",
          retryable: false,
        },
      },
      { status: 401 },
    );
  }

  const authError = await requireValidUserToken(request, config);
  if (authError) {
    return authError;
  }

  try {
    return await routeFleetRequest(request, url, config);
  } catch (error) {
    return handleFleetError(error);
  }
}

async function getPurchasePreviewResponse(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<Response> {
  const snapshot = await loadFleetSnapshot(request, config);
  const aircraftTypeId = url.searchParams.get("aircraft_type_id") ?? "";
  const baseAirportId = url.searchParams.get("base_airport_id") ?? snapshot.airline.starting_airport_id ?? "";
  const tailNumber = url.searchParams.get("tail_number") ?? "";

  return jsonResponse(buildPurchasePreview(snapshot, aircraftTypeId, baseAirportId, tailNumber));
}

async function routeAircraftDetail(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  const detailMatch = /^\/fleet\/aircraft\/([^/]+)$/.exec(url.pathname);

  if (detailMatch?.[1] && request.method === "GET") {
    return jsonResponse(await getAircraftDetail(request, config, detailMatch[1]));
  }

  const tailMatch = /^\/fleet\/aircraft\/([^/]+)\/tail-number$/.exec(url.pathname);
  if (tailMatch?.[1] && request.method === "PATCH") {
    return handleUpdateTailNumber(request, config, tailMatch[1]);
  }

  return null;
}

async function routeFleetRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (url.pathname === "/fleet/aircraft" && request.method === "GET") {
    return jsonResponse(await getOwnedFleet(request, config));
  }

  if (url.pathname === "/fleet/aircraft" && request.method === "POST") {
    return handlePurchaseAircraft(request, config);
  }

  if (url.pathname === "/fleet/market" && request.method === "GET") {
    return jsonResponse(await getFleetMarket(request, url, config));
  }

  if (url.pathname === "/fleet/purchase-preview" && request.method === "GET") {
    return getPurchasePreviewResponse(request, url, config);
  }

  return routeAircraftDetail(request, url, config);
}
