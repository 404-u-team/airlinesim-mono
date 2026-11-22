export type JsonSchema = {
  $ref?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: string;
  "x-nullable"?: boolean;
};

export type SwaggerDocument = {
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

export type SwaggerOperation = {
  description?: string;
  parameters?: SwaggerParameter[];
  produces?: string[];
  responses?: Record<string, { schema?: JsonSchema }>;
};

export type SwaggerParameter = SwaggerBodyParameter | SwaggerQueryParameter;

type SwaggerBodyParameter = {
  in: "body";
  name: string;
  required: boolean;
  schema: JsonSchema;
};

export type SwaggerQueryParameter = {
  description?: string;
  enum?: string[];
  in: "query";
  name: string;
  required: boolean;
  type: "boolean" | "number" | "string";
};
