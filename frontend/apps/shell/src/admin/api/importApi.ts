import { createApiClient, getBackendBaseUrl } from "@airlinesim/game-sdk";

import { authState } from "../../auth";

export type ImportIssue = {
  entityType: string;
  message: string;
  sourceKey: string;
};

export type ImportJob = {
  error?: string;
  finishedAt?: string;
  id: string;
  logs: ImportLogEntry[];
  mode: "dry-run" | "import";
  progress: {
    counts?: Record<string, number>;
    current?: number;
    entityType?: string;
    message: string;
    percent: number;
    stage: "building" | "finalizing" | "importing" | "preparing" | "reconciling" | "validating";
    total?: number;
  };
  report?: {
    counts: Record<string, number>;
    errors: number;
    firstErrors: ImportIssue[];
    firstWarnings: ImportIssue[];
    quality: Record<string, number>;
    warnings: number;
  };
  startedAt: string;
  status: "failed" | "queued" | "running" | "succeeded";
};

export type ImportJobSocket = {
  close: () => void;
  subscribe: (jobId: string) => void;
};

export type ImportLogEntry = {
  details?: Record<string, unknown>;
  entityType?: string;
  level: "error" | "info" | "warning";
  message: string;
  operation: string;
  sourceKey?: string;
  stage: string;
  timestamp: string;
};

export type LatestImportJob = Pick<ImportJob, "finishedAt" | "id" | "mode" | "startedAt" | "status">;

const apiClient = createApiClient({ getToken: () => authState.accessToken.value });

export function connectImportJobSocket(
  onJob: (job: ImportJob) => void,
  onConnectionChange: (connected: boolean) => void,
): ImportJobSocket {
  let closed = false;
  let jobId: null | string = null;
  let socket: null | WebSocket = null;
  let reconnectTimer: null | ReturnType<typeof setTimeout> = null;

  const connect = (): void => {
    const nextSocket = new WebSocket(buildImportSocketUrl());
    socket = nextSocket;
    nextSocket.addEventListener("close", () => {
      onConnectionChange(false);
      if (!closed) {
        reconnectTimer = setTimeout(connect, 2_000);
      }
    });
    nextSocket.addEventListener("error", () => onConnectionChange(false));
    nextSocket.addEventListener("open", () => {
      onConnectionChange(true);
      if (jobId) {
        sendSubscription(nextSocket, jobId);
      }
    });
    nextSocket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as { job?: ImportJob; type?: string };
        if (payload.type === "import-job-status" && payload.job) {
          onJob(payload.job);
        }
      } catch {
        onConnectionChange(false);
      }
    });
  };
  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
    },
    subscribe(nextJobId) {
      jobId = nextJobId;
      if (socket?.readyState === WebSocket.OPEN) {
        sendSubscription(socket, jobId);
      }
    },
  };
}

export async function getImportJob(jobId: string): Promise<ImportJob> {
  return (await apiClient.get<{ job: ImportJob }>(`/admin/import/world-data/jobs/${encodeURIComponent(jobId)}`)).job;
}

export async function getLatestImportJob(): Promise<LatestImportJob | null> {
  try {
    return (await apiClient.get<{ job: LatestImportJob }>("/admin/import/world-data/status")).job;
  } catch {
    return null;
  }
}

export async function startImportJob(mode: "dry-run" | "import", refreshRaw: boolean): Promise<string> {
  const response = await apiClient.post<{ jobId: string }>("/admin/import/world-data", {
    mode,
    refreshRaw,
    source: "admin-ui",
  });

  return response.jobId;
}

function buildImportSocketUrl(): string {
  const base = new URL(getBackendBaseUrl(), window.location.origin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/admin/import/world-data/ws`;
  base.search = "";
  const token = authState.accessToken.value;
  if (token) {
    base.searchParams.set("token", token);
  }

  return base.toString();
}

function sendSubscription(socket: WebSocket, jobId: string): void {
  socket.send(JSON.stringify({ jobId, type: "subscribe" }));
}
