import { getImportJobStatus, getLatestImportJobStatus, subscribeToImportJobs, type ImportJobStatus } from "./jobs";

type ImportSocket = {
  data: { jobId: null | string };
  send: (data: string) => unknown;
};

const sockets = new Set<ImportSocket>();

subscribeToImportJobs((job) => {
  for (const socket of sockets) {
    if (!socket.data.jobId || socket.data.jobId === job.id) {
      sendJob(socket, job);
    }
  }
});

export function closeImportSocket(socket: ImportSocket): void {
  sockets.delete(socket);
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
  const job = socket.data.jobId ? getImportJobStatus(socket.data.jobId) : getLatestImportJobStatus();
  if (job) {
    sendJob(socket, job);
  }
}

function sendJob(socket: ImportSocket, job: ImportJobStatus): void {
  socket.send(JSON.stringify({ job, type: "import-job-status" }));
}
