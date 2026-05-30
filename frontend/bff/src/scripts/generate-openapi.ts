import { parse } from "yaml";

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

  return swagger;
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
    return parse(await Bun.file(docsYamlPath).text()) as SwaggerDocument;
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
