import { BackendHttpError } from "../../backend-http";
import { jsonResponse } from "../../http";

export function handleFleetError(error: unknown): Response {
  if (error instanceof BackendHttpError) {
    return jsonResponse(error.toNormalizedJson(), { status: error.status });
  }

  return jsonResponse(
    {
      error: {
        code: "FLEET_BACKEND_UNAVAILABLE",
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      },
    },
    { status: 503 },
  );
}
