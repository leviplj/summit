import { spawn, type ChildProcess } from "child_process";
import { createConnection } from "net";
import type { DevServerStatus } from "~~/shared/types";

interface LogLine {
  stream: "stdout" | "stderr";
  text: string;
  ts: number;
}

interface DevServerInstance {
  sessionId: string;
  process: ChildProcess;
  port: number;
  status: DevServerStatus["status"];
  error?: string;
  logs: LogLine[];
  startupTimer?: ReturnType<typeof setTimeout>;
}

const MAX_LOG_LINES = 500;

class DevServerManager {
  private instances = new Map<string, DevServerInstance>();

  constructor() {
    const cleanup = () => this.stopAll();
    process.on("exit", cleanup);
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  }

  async start(
    sessionId: string,
    worktreePath: string,
    command: string,
    basePort: number,
  ): Promise<DevServerStatus> {
    if (this.instances.has(sessionId)) {
      await this.stop(sessionId);
    }

    const port = this.assignPort(basePort);

    console.log(`[dev-server] Starting for session ${sessionId}: port=${port}, cmd="${command}"`);

    const child = spawn(command, {
      cwd: worktreePath,
      shell: true,
      env: {
        ...process.env,
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const instance: DevServerInstance = {
      sessionId,
      process: child,
      port,
      status: "starting",
      logs: [],
    };

    this.instances.set(sessionId, instance);

    child.stdout?.on("data", (data: Buffer) => {
      this.appendLog(instance, "stdout", data.toString());
    });

    child.stderr?.on("data", (data: Buffer) => {
      this.appendLog(instance, "stderr", data.toString());
    });

    child.on("exit", (code) => {
      if (instance.startupTimer) clearTimeout(instance.startupTimer);
      if (instance.status === "starting" || instance.status === "running") {
        instance.status = code === 0 ? "stopped" : "error";
        if (code !== 0) instance.error = `Process exited with code ${code}`;
      }
    });

    child.on("error", (err) => {
      if (instance.startupTimer) clearTimeout(instance.startupTimer);
      instance.status = "error";
      instance.error = err.message;
    });

    this.pollForStartup(instance);

    return this.getStatus(sessionId);
  }

  async stop(sessionId: string): Promise<DevServerStatus> {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      return { sessionId, status: "stopped", port: null };
    }

    if (instance.startupTimer) clearTimeout(instance.startupTimer);

    const child = instance.process;
    if (!child.killed && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const forceKill = setTimeout(() => {
          if (!child.killed && child.exitCode === null) {
            child.kill("SIGKILL");
          }
          resolve();
        }, 5000);

        child.on("exit", () => {
          clearTimeout(forceKill);
          resolve();
        });
      });
    }

    instance.status = "stopped";
    this.instances.delete(sessionId);

    return { sessionId, status: "stopped", port: null };
  }

  getStatus(sessionId: string): DevServerStatus {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      return { sessionId, status: "stopped", port: null };
    }
    return {
      sessionId,
      status: instance.status,
      port: instance.port,
      ...(instance.error ? { error: instance.error } : {}),
    };
  }

  getPort(sessionId: string): number | null {
    return this.instances.get(sessionId)?.port ?? null;
  }

  getPortByPrefix(prefix: string): number | null {
    // Exact match first
    const exact = this.instances.get(prefix);
    if (exact) return exact.port;
    // Prefix match (e.g. first 8 chars of UUID)
    for (const [id, instance] of this.instances) {
      if (id.startsWith(prefix)) return instance.port;
    }
    return null;
  }

  getLogs(sessionId: string): LogLine[] {
    return this.instances.get(sessionId)?.logs ?? [];
  }

  private assignPort(basePort: number): number {
    const usedPorts = new Set<number>();
    for (const instance of this.instances.values()) {
      usedPorts.add(instance.port);
    }
    let port = basePort;
    while (usedPorts.has(port)) port++;
    return port;
  }

  private appendLog(instance: DevServerInstance, stream: "stdout" | "stderr", text: string) {
    const lines = text.split("\n");
    for (const line of lines) {
      if (!line) continue;
      instance.logs.push({ stream, text: line, ts: Date.now() });
      // Detect actual port from output while still starting
      if (instance.status === "starting") {
        this.detectPort(instance, line);
      }
    }
    if (instance.logs.length > MAX_LOG_LINES) {
      instance.logs = instance.logs.slice(-MAX_LOG_LINES);
    }
  }

  private detectPort(instance: DevServerInstance, line: string) {
    // Match common dev server port patterns:
    //   http://localhost:3002
    //   http://127.0.0.1:3002
    //   http://0.0.0.0:3002
    //   Listening on :3002
    //   Port 3002
    const patterns = [
      /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/,
      /[Ll]istening on[:\s]+(\d+)/,
      /[Pp]ort[:\s]+(\d+)/,
    ];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const detected = parseInt(match[1], 10);
        if (detected !== instance.port && detected > 0 && detected < 65536) {
          console.log(`[dev-server] Session ${instance.sessionId} detected actual port ${detected} (expected ${instance.port})`);
          instance.port = detected;
        }
        break;
      }
    }
  }

  private pollForStartup(instance: DevServerInstance) {
    const startTime = Date.now();
    const timeout = 30_000;
    const interval = 500;

    const tryConnect = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const socket = createConnection({ port, host: "127.0.0.1" });
        socket.setTimeout(400);
        socket.on("connect", () => { socket.destroy(); resolve(true); });
        socket.on("error", () => { socket.destroy(); resolve(false); });
        socket.on("timeout", () => { socket.destroy(); resolve(false); });
      });
    };

    const check = async () => {
      if (instance.status !== "starting") return;
      if (Date.now() - startTime > timeout) {
        instance.status = "error";
        instance.error = "Server failed to start within 30 seconds";
        return;
      }

      // Check the current port (may have been updated by detectPort)
      if (await tryConnect(instance.port)) {
        instance.status = "running";
        console.log(`[dev-server] Session ${instance.sessionId} running on port ${instance.port}`);
        return;
      }

      instance.startupTimer = setTimeout(check, interval);
    };

    instance.startupTimer = setTimeout(check, 1000);
  }

  private stopAll() {
    for (const instance of this.instances.values()) {
      try {
        if (instance.process && !instance.process.killed) {
          instance.process.kill("SIGKILL");
        }
      } catch {}
    }
    this.instances.clear();
  }
}

export const devServerManager = new DevServerManager();
