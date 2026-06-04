/* eslint-disable max-lines */
import { addFleetOverlay } from "./openapi-fleet";

type JsonSchema = {
  $ref?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  type?: string;
};

type SwaggerDocument = {
  definitions?: Record<string, JsonSchema>;
  host?: string;
  info?: {
    description?: string;
    title?: string;
    version?: string;
  };
  paths?: Record<string, Record<string, SwaggerOperation>>;
  schemes?: string[];
  swagger: string;
};

type SwaggerOperation = {
  description?: string;
  parameters?: SwaggerParameter[];
  produces?: string[];
  responses?: Record<string, { schema?: JsonSchema }>;
};

type SwaggerParameter = {
  description?: string;
  enum?: string[];
  in: "query";
  name: string;
  required: boolean;
  type: "boolean" | "number" | "string";
};

const cachedListPaths = new Set([
  "/aircraft-types",
  "/airports",
  "/countries",
  "/regions",
  "/region-links",
]);
const docsJsonPath = new URL("../../../docs/swagger.json", import.meta.url);
const docsYamlPath = new URL("../../../docs/swagger.yaml", import.meta.url);
const outputPath = new URL("../../../docs/bff-openapi.json", import.meta.url);

async function fileExists(path: URL): Promise<boolean> {
  return Bun.file(path).exists();
}

async function generate(): Promise<void> {
  const swagger = await loadSwagger();
  const bffSwagger = addBffOverlay(structuredClone(swagger));

  await Bun.write(outputPath, `${JSON.stringify(bffSwagger, null, 2)}\n`);
  console.warn(`Generated ${outputPath.pathname}`);
}

function addBffOverlay(swagger: SwaggerDocument): SwaggerDocument {
  swagger.host = "localhost:4200";
  swagger.schemes = ["http"];
  swagger.info = {
    ...swagger.info,
    description:
      "Backend-for-frontend API. Based on backend OpenAPI and extended with BFF cache/filter query parameters.",
    title: "AirlineSim BFF API",
  };

  for (const path of cachedListPaths) {
    const operation = swagger.paths?.[path]?.get;

    if (!operation) {
      continue;
    }

    operation.description = `${operation.description ?? ""}\n\nBFF caches this list in memory, retries backend 500 responses up to 4 attempts, and supports exact field filters plus q search across text fields.`.trim();
    operation.parameters = mergeQueryParameters(operation.parameters, getFilterParameters(swagger, operation));
  }

  addDemandOverlay(swagger);
  addFleetOverlay(swagger);
  addFinanceOverlay(swagger);
  addGameOverlay(swagger);
  addEventsFacilitiesAdminOverlay(swagger);

  return swagger;
}

function addEventsFacilitiesAdminOverlay(swagger: SwaggerDocument): void {
  swagger.paths ??= {};
  const getPaths = [
    ["/events/feed", "Returns persistent immutable events for the current airline."],
    ["/events/feed/{id}", "Returns one event owned by the current airline."],
    ["/notifications", "Returns active or resolved notifications after deterministic risk reconciliation."],
    ["/notifications/summary", "Returns active and unread notification counts for Shell."],
    ["/facilities/base-overview", "Returns the starting base constraints, slots, costs and aircraft compatibility read model."],
    ["/facilities/airports/{id}/constraints", "Returns constraint diagnostics for an airport and optional aircraft/type/route."],
    ["/admin/session", "Returns the current user admin capability probe."],
    ["/admin/audit", "Returns the retained BFF admin audit trail. Requires world.manage."],
    ["/admin/world/readiness", "Returns blockers and warnings for the minimum playable world."],
    ["/admin/import/world-data/status", "Returns the latest protected import job status."],
    ["/admin/import/world-data/jobs/{id}", "Returns one protected import job status."],
  ] as const;
  for (const [path, description] of getPaths) {
    swagger.paths[path] = {
      get: {
        description,
        produces: ["application/json"],
        responses: { "200": {}, "401": {}, "403": {}, "404": {}, "500": {} },
      },
    };
  }
  swagger.paths["/notifications/{id}"] = {
    patch: {
      description: "Marks a notification read or unread without changing risk resolution.",
      produces: ["application/json"],
      responses: { "200": {}, "401": {}, "404": {}, "500": {} },
    },
  };
  swagger.paths["/notifications/read-all"] = {
    post: {
      description: "Marks all active notifications for the current airline as read.",
      produces: ["application/json"],
      responses: { "200": {}, "401": {}, "500": {} },
    },
  };
  swagger.paths["/admin/import/world-data"] = {
    post: {
      description: "Starts one protected dry-run or import job. Requires world.manage.",
      produces: ["application/json"],
      responses: { "202": {}, "401": {}, "403": {}, "500": {} },
    },
  };
  addAdminWorldOverlay(swagger);
}

function addAdminWorldOverlay(swagger: SwaggerDocument): void {
  swagger.paths ??= {};
  for (const collection of ["airports", "countries", "region-links", "regions"]) {
    swagger.paths[`/admin/world/${collection}`] = {
      get: {
        description: `Lists protected admin world resource ${collection}. Requires world.manage.`,
        produces: ["application/json"],
        responses: { "200": {}, "401": {}, "403": {}, "500": {} },
      },
      post: {
        description: `Creates protected admin world resource ${collection}. Requires world.manage.`,
        produces: ["application/json"],
        responses: { "200": {}, "201": {}, "400": {}, "401": {}, "403": {}, "409": {}, "500": {} },
      },
    };
    swagger.paths[`/admin/world/${collection}/{id}`] = {
      delete: {
        description: `Deletes protected admin world resource ${collection}. Requires world.manage.`,
        produces: ["application/json"],
        responses: { "200": {}, "204": {}, "401": {}, "403": {}, "409": {}, "500": {} },
      },
      patch: {
        description: `Updates protected admin world resource ${collection}. Requires world.manage.`,
        produces: ["application/json"],
        responses: { "200": {}, "400": {}, "401": {}, "403": {}, "409": {}, "500": {} },
      },
    };
  }
}

function addFinanceOverlay(swagger: SwaggerDocument): void {
  swagger.paths ??= {};
  const financeGetPaths = [
    ["/finance/overview", "Returns available cash, operational result, fleet value, recent transactions and risks."],
    ["/finance/ledger", "Returns the current airline income and expense ledger."],
    ["/finance/routes", "Returns profitability aggregated by route."],
    ["/finance/flights/{id}", "Returns financial result and ledger transactions for a flight."],
  ] as const;

  for (const [path, description] of financeGetPaths) {
    swagger.paths[path] = {
      get: {
        description,
        produces: ["application/json"],
        responses: { "200": {}, "401": {}, "404": {}, "500": {} },
      },
    };
  }
  swagger.paths["/finance/recalculate"] = {
    post: {
      description: "Idempotently reconciles completed flights into the BFF finance ledger.",
      produces: ["application/json"],
      responses: { "200": {}, "401": {}, "500": {} },
    },
  };
}

function addDemandOverlay(swagger: SwaggerDocument): void {
  swagger.definitions ??= {};
  swagger.paths ??= {};
  swagger.definitions["bff.AirportPairDemand"] = {
    properties: {
      cached: { type: "boolean" },
      destination_airport_id: { type: "string" },
      destination_daily_passengers: { type: "number" },
      distance_km: { type: "number" },
      origin_airport_id: { type: "string" },
      origin_daily_passengers: { type: "number" },
      region_link_id: { type: "string" },
    },
    type: "object",
  };
  swagger.definitions["bff.AirportPairDemandResponse"] = {
    properties: {
      demand: { $ref: "#/definitions/bff.AirportPairDemand" },
    },
    type: "object",
  };
  swagger.paths["/demand/airport-pair"] = {
    get: {
      description:
        "Lazily calculates base daily passenger demand for an airport pair using airport, region and region-link data. If the linked regions do not have cached base demand, BFF writes the generated values back to the backend region-link endpoint.",
      parameters: [
        {
          description: "Origin backend airport id.",
          in: "query",
          name: "origin_airport_id",
          required: true,
          type: "string",
        },
        {
          description: "Destination backend airport id.",
          in: "query",
          name: "destination_airport_id",
          required: true,
          type: "string",
        },
      ],
      produces: ["application/json"],
      responses: {
        "200": {
          schema: { $ref: "#/definitions/bff.AirportPairDemandResponse" },
        },
        "400": {},
        "401": {},
        "404": {},
        "500": {},
      },
    },
  };
}

// OpenAPI overlay is intentionally declarative; splitting the literal schema lowers readability.
// eslint-disable-next-line max-lines-per-function
function addGameOverlay(swagger: SwaggerDocument): void {
  swagger.definitions ??= {};
  swagger.paths ??= {};
  swagger.definitions["bff.DashboardSummary"] = {
    properties: {
      airline: { type: "object" },
      alerts: {
        items: { type: "object" },
        type: "array",
      },
      base: { type: "object" },
      fleet: { type: "object" },
      flights: { type: "object" },
      navigation_progress: {
        items: { type: "object" },
        type: "array",
      },
      next_action: { type: "object" },
      routes: { type: "object" },
      updated_at: { type: "string" },
    },
    type: "object",
  };
  swagger.definitions["bff.MapState"] = {
    properties: {
      airports: { type: "object" },
      capabilities: { type: "object" },
      routes: { type: "object" },
      scope: { type: "string" },
      selected: { type: "object" },
      viewport: { type: "object" },
      warnings: {
        items: { type: "string" },
        type: "array",
      },
    },
    type: "object",
  };
  swagger.paths["/game/dashboard-summary"] = {
    get: {
      description:
        "Returns the shell Dashboard read model: airline status, base, fleet, route/flight empty capabilities, alerts, navigation progress and next best action.",
      produces: ["application/json"],
      responses: {
        "200": { schema: { $ref: "#/definitions/bff.DashboardSummary" } },
        "401": {},
        "500": {},
      },
    },
  };
  swagger.paths["/game/map-state"] = {
    get: {
      description:
        "Returns GeoJSON-oriented map state for the shell Dashboard and map remote. The map remote visualizes this payload and does not call backend directly.",
      parameters: [
        {
          description: "Map scenario scope.",
          enum: ["dashboard", "network", "operations"],
          in: "query",
          name: "scope",
          required: false,
          type: "string",
        },
        {
          description: "Selected airport id for detail card enrichment.",
          in: "query",
          name: "selected_airport_id",
          required: false,
          type: "string",
        },
        {
          description: "Selected route id for future route detail enrichment.",
          in: "query",
          name: "selected_route_id",
          required: false,
          type: "string",
        },
        {
          description: "Whether route opportunities should be included.",
          enum: ["true", "false"],
          in: "query",
          name: "include_opportunities",
          required: false,
          type: "string",
        },
      ],
      produces: ["application/json"],
      responses: {
        "200": { schema: { $ref: "#/definitions/bff.MapState" } },
        "401": {},
        "500": {},
      },
    },
  };
}

function getFilterParameters(
  swagger: SwaggerDocument,
  operation: SwaggerOperation,
): SwaggerParameter[] {
  const itemSchema = getListItemSchema(swagger, operation);
  const properties = itemSchema?.properties ?? {};
  const fieldFilters = Object.entries(properties)
    .map(([name, schema]) => toQueryParameter(name, schema))
    .filter((parameter): parameter is SwaggerParameter => Boolean(parameter));

  return [
    {
      description: "Search query applied to all string fields.",
      in: "query",
      name: "q",
      required: false,
      type: "string",
    },
    {
      description: "Force BFF to refresh its in-memory cache from backend.",
      enum: ["true", "false"],
      in: "query",
      name: "refresh",
      required: false,
      type: "string",
    },
    ...fieldFilters,
  ];
}

function getListItemSchema(
  swagger: SwaggerDocument,
  operation: SwaggerOperation,
): JsonSchema | undefined {
  const responseSchema = operation.responses?.["200"]?.schema;
  const listSchema = resolveSchema(swagger, responseSchema);
  const collection = Object.values(listSchema?.properties ?? {}).find((property) => property.type === "array");

  return resolveSchema(swagger, collection?.items);
}

async function loadSwagger(): Promise<SwaggerDocument> {
  if (await fileExists(docsYamlPath)) {
    return Bun.YAML.parse(await Bun.file(docsYamlPath).text()) as SwaggerDocument;
  }

  if (await fileExists(docsJsonPath)) {
    return (await Bun.file(docsJsonPath).json()) as SwaggerDocument;
  }

  throw new Error("No swagger.json or swagger.yaml found in frontend/docs.");
}

function mergeQueryParameters(
  existingParameters: SwaggerParameter[] | undefined,
  bffParameters: SwaggerParameter[],
): SwaggerParameter[] {
  const byName = new Map((existingParameters ?? []).map((parameter) => [parameter.name, parameter]));

  for (const parameter of bffParameters) {
    byName.set(parameter.name, parameter);
  }

  return Array.from(byName.values());
}

function resolveSchema(swagger: SwaggerDocument, schema: JsonSchema | undefined): JsonSchema | undefined {
  const refName = schema?.$ref?.replace("#/definitions/", "");

  return refName ? swagger.definitions?.[refName] : schema;
}

function toQueryParameter(name: string, schema: JsonSchema): SwaggerParameter | null {
  if (schema.type !== "boolean" && schema.type !== "number" && schema.type !== "string") {
    return null;
  }

  return {
    description: `Exact BFF filter by ${name}.`,
    in: "query",
    name,
    required: false,
    type: schema.type,
  };
}

await generate();
