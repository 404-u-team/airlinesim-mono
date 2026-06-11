export type ImportLogInput = {
  details?: Record<string, unknown>;
  entityType?: string;
  level: "error" | "info" | "warning";
  message: string;
  operation: string;
  sourceKey?: string;
  stage: string;
};

export type ImportLogEntry = ImportLogInput & {
  timestamp: string;
};

export type ImportLogger = (entry: ImportLogInput) => void;

export function errorDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { error: String(error) };
  }

  const details: Record<string, unknown> = {
    error: error.message,
    name: error.name,
  };
  copyErrorField(error, details, "code");
  copyErrorField(error, details, "details");
  copyErrorField(error, details, "retryable");
  copyErrorField(error, details, "status");
  if (error.cause) {
    details.cause = causeMessage(error.cause);
  }

  return details;
}

function copyErrorField(error: Error, details: Record<string, unknown>, key: string): void {
  const value = (error as unknown as Record<string, unknown>)[key];
  if (value !== undefined) {
    details[key] = value;
  }
}

function causeMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return typeof cause === "string" ? cause : "Non-error cause";
}
