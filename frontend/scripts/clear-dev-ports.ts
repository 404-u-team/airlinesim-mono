import { getFrontendDevPorts } from "../dev-ports";

const ports = parsePorts(Bun.argv.slice(2));

if (ports.length === 0) {
  console.error("No valid ports provided.");
  process.exit(1);
}

const killedProcesses = new Set<number>();

for (const port of ports) {
  const processIds = await getProcessIdsByPort(port);

  if (processIds.length === 0) {
    console.log(`Port ${port}: free`);
    continue;
  }

  for (const processId of processIds) {
    if (killedProcesses.has(processId)) {
      console.log(`Port ${port}: process ${processId} already stopped`);
      continue;
    }

    const result = await tryKillProcess(processId);

    if (result.ok) {
      killedProcesses.add(processId);
      console.log(`Port ${port}: stopped process ${processId}`);
    } else {
      console.warn(`Port ${port}: cannot stop process ${processId}: ${result.reason}`);
    }
  }
}

function parsePorts(args: string[]): number[] {
  const rawPorts = args.length > 0 ? args : getFrontendDevPorts().map(String);
  const ports = rawPorts
    .flatMap((arg) => arg.split(","))
    .map((arg) => Number.parseInt(arg.trim(), 10))
    .filter((port) => Number.isInteger(port) && port > 0 && port <= 65_535);

  return [...new Set(ports)];
}

async function getProcessIdsByPort(port: number): Promise<number[]> {
  if (process.platform === "win32") {
    const command = `$ErrorActionPreference = "SilentlyContinue"; Get-NetTCPConnection -LocalPort ${port} | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique; exit 0`;
    const [powershellOutput, netstatOutput] = await Promise.all([
      runCommand("powershell", ["-NoProfile", "-Command", command]),
      runCommand("netstat", ["-ano"]),
    ]);

    return [
      ...new Set([
        ...parseProcessIds(powershellOutput),
        ...parseNetstatProcessIds(netstatOutput, port),
      ]),
    ];
  }

  const output = await runCommand("sh", ["-c", `lsof -ti tcp:${port} || true`]);

  return parseProcessIds(output);
}

async function tryKillProcess(processId: number): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    if (process.platform === "win32") {
      await runCommand("taskkill", ["/PID", String(processId), "/F"]);

      return { ok: true };
    }

    await runCommand("kill", ["-TERM", String(processId)]);

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown error",
    };
  }
}

function parseNetstatProcessIds(output: string, port: number): number[] {
  return [
    ...new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        .filter((columns) => columns[0] === "TCP" || columns[0] === "UDP")
        .filter((columns) => getEndpointPort(columns[1] ?? "") === port)
        .map((columns) => Number.parseInt(columns.at(-1) ?? "", 10))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
}

function parseProcessIds(output: string): number[] {
  return [
    ...new Set(
      output
        .split(/\s+/)
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
}

function getEndpointPort(endpoint: string): number | undefined {
  const separatorIndex = endpoint.lastIndexOf(":");

  if (separatorIndex === -1) {
    return undefined;
  }

  const port = Number.parseInt(endpoint.slice(separatorIndex + 1), 10);

  return Number.isInteger(port) ? port : undefined;
}

async function runCommand(command: string, args: string[]): Promise<string> {
  const process = Bun.spawn([command, ...args], {
    stderr: "pipe",
    stdout: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`${command} failed with code ${exitCode}: ${stderr.trim()}`);
  }

  return stdout;
}
