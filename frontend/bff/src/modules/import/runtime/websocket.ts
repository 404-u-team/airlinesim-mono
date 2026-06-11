import { getImportJobStatus, getLatestImportJobStatus, subscribeToImportJobs, type ImportJobStatus } from "./jobs";

type ImportSocket = {
  data: { jobId: null | string };
  send: (data: string) => unknown;
};

const sockets = new Set<ImportSocket>();
const lastSentAt = new Map<ImportSocket, number>();
const pendingJobs = new Map<ImportSocket, ImportJobStatus>();
const sendTimers = new Map<ImportSocket, ReturnType<typeof setTimeout>>();
const MAX_WEBSOCKET_LOGS = 50;
const WEBSOCKET_SEND_INTERVAL_MS = 500;

subscribeToImportJobs((job) => {
  for (const socket of sockets) {
    if (!socket.data.jobId || socket.data.jobId === job.id) {
      queueJob(socket, job);
    }
  }
});

export function closeImportSocket(socket: ImportSocket): void {
  sockets.delete(socket);
  clearScheduledSend(socket);
  lastSentAt.delete(socket);
}

export function openImportSocket(socket: ImportSocket): void {
  sockets.add(socket);
  sendSelectedJob(socket);
}

export function receiveImportSocketMessage(socket: ImportSocket, message: Buffer | string): void {
  try {
    const payload = JSON.parse(String(message)) as { jobId?: unknown; type?: unknown };
    if (payload.type === "subscribe") {
      socket.data.jobId = typeof payload.jobId === "string" ? payload.jobId : null;
      sendSelectedJob(socket);
    }
  } catch {
    socket.send(JSON.stringify({ error: "Invalid import WebSocket message", type: "error" }));
  }
}

function sendSelectedJob(socket: ImportSocket): void {
  clearScheduledSend(socket);
  const job = socket.data.jobId ? getImportJobStatus(socket.data.jobId) : getLatestImportJobStatus();
  if (job) {
    sendJob(socket, job);
  }
}

function sendJob(socket: ImportSocket, job: ImportJobStatus): void {
  lastSentAt.set(socket, Date.now());
  socket.send(JSON.stringify({
    job: { ...job, logs: job.logs.slice(-MAX_WEBSOCKET_LOGS) },
    type: "import-job-status",
  }));
}

function clearScheduledSend(socket: ImportSocket): void {
  const timer = sendTimers.get(socket);
  if (timer) {
    clearTimeout(timer);
  }
  pendingJobs.delete(socket);
  sendTimers.delete(socket);
}

function flushJob(socket: ImportSocket): void {
  sendTimers.delete(socket);
  const job = pendingJobs.get(socket);
  pendingJobs.delete(socket);
  if (job && sockets.has(socket) && (!socket.data.jobId || socket.data.jobId === job.id)) {
    sendJob(socket, job);
  }
}

function queueJob(socket: ImportSocket, job: ImportJobStatus): void {
  pendingJobs.set(socket, job);
  if (sendTimers.has(socket)) {
    return;
  }

  const elapsed = Date.now() - (lastSentAt.get(socket) ?? 0);
  if (elapsed >= WEBSOCKET_SEND_INTERVAL_MS) {
    flushJob(socket);
    return;
  }

  sendTimers.set(socket, setTimeout(() => flushJob(socket), WEBSOCKET_SEND_INTERVAL_MS - elapsed));
}
