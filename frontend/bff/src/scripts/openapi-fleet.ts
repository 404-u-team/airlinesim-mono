type JsonSchema = {
  $ref?: string;
  type?: string;
};

type SwaggerDocument = {
  definitions?: Record<string, JsonSchema>;
  paths?: Record<string, Record<string, SwaggerOperation>>;
};

type SwaggerOperation = {
  description?: string;
  parameters?: SwaggerParameter[];
  produces?: string[];
  responses?: Record<string, { schema?: JsonSchema }>;
};

type SwaggerParameter = {
  description?: string;
  in: "query";
  name: string;
  required: boolean;
  type: "boolean" | "number" | "string";
};

export function addFleetOverlay(swagger: SwaggerDocument): void {
  swagger.definitions ??= {};
  swagger.paths ??= {};
  swagger.definitions["bff.FleetAircraftDetailResponse"] = objectSchema();
  swagger.definitions["bff.FleetAircraftResponse"] = objectSchema();
  swagger.definitions["bff.FleetMarketResponse"] = objectSchema();
  swagger.definitions["bff.FleetPurchasePreviewResponse"] = objectSchema();
  swagger.definitions["bff.FleetPurchaseResponse"] = objectSchema();
  swagger.paths["/fleet/aircraft"] = getFleetAircraftPath();
  swagger.paths["/fleet/aircraft/{id}"] = getFleetAircraftDetailPath();
  swagger.paths["/fleet/aircraft/{id}/tail-number"] = getFleetTailNumberPath();
  swagger.paths["/fleet/market"] = getFleetMarketPath();
  swagger.paths["/fleet/purchase-preview"] = getFleetPreviewPath();
}

function getFleetAircraftDetailPath(): Record<string, SwaggerOperation> {
  return {
    get: {
      description: "Returns an enriched owned aircraft detail card for Fleet & Ops.",
      produces: ["application/json"],
      responses: getFleetResponses("#/definitions/bff.FleetAircraftDetailResponse"),
    },
  };
}

function getFleetAircraftPath(): Record<string, SwaggerOperation> {
  return {
    get: {
      description: "Returns the enriched owned fleet list with product-facing empty state.",
      produces: ["application/json"],
      responses: getFleetResponses("#/definitions/bff.FleetAircraftResponse"),
    },
    post: {
      description:
        "Repeats purchase-preview checks, calls backend POST /aircraft once, clears relevant BFF caches and returns the enriched purchased aircraft plus next action.",
      produces: ["application/json"],
      responses: getFleetResponses("#/definitions/bff.FleetPurchaseResponse"),
    },
  };
}

function getFleetMarketPath(): Record<string, SwaggerOperation> {
  return {
    get: {
      description:
        "Returns the Fleet & Ops aircraft market read model enriched with budget, base compatibility, recommendation score, warnings and owned aircraft summary.",
      parameters: [
        queryParameter("base_airport_id", "Override aircraft base airport id for compatibility checks."),
        queryParameter("q", "Search aircraft model and codes."),
        queryParameter("min_range", "Minimum aircraft range in kilometers."),
        queryParameter("min_capacity", "Minimum planned seat capacity."),
        queryParameter("max_price", "Maximum purchase price."),
        queryParameter("sort", "Sort order: recommended, price, capacity or range."),
      ],
      produces: ["application/json"],
      responses: getFleetResponses("#/definitions/bff.FleetMarketResponse"),
    },
  };
}

function getFleetPreviewPath(): Record<string, SwaggerOperation> {
  return {
    get: {
      description:
        "Returns read-only purchase consequences: canPurchase, blocking reasons, warnings, balance impact, reserve estimate and tail-number validation.",
      parameters: [
        queryParameter("aircraft_type_id", "Aircraft type id to preview.", true),
        queryParameter("base_airport_id", "Base airport id to validate.", true),
        queryParameter("tail_number", "Requested aircraft tail number.", true),
      ],
      produces: ["application/json"],
      responses: getFleetResponses("#/definitions/bff.FleetPurchasePreviewResponse"),
    },
  };
}

function getFleetResponses(ref: string): Record<string, { schema?: JsonSchema }> {
  return {
    "200": { schema: { $ref: ref } },
    "400": {},
    "401": {},
    "404": {},
    "409": {},
    "500": {},
  };
}

function getFleetTailNumberPath(): Record<string, SwaggerOperation> {
  return {
    patch: {
      description:
        "Validates and normalizes a tail number, forwards PATCH /aircraft/{id} once and returns the updated enriched aircraft card.",
      produces: ["application/json"],
      responses: getFleetResponses("#/definitions/bff.FleetAircraftDetailResponse"),
    },
  };
}

function objectSchema(): JsonSchema {
  return {
    type: "object",
  };
}

function queryParameter(name: string, description: string, required = false): SwaggerParameter {
  return {
    description,
    in: "query",
    name,
    required,
    type: "string",
  };
}
