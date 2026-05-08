// Synthetic cc peer for eval scenarios.
//
// Spawns the cc-server as a child process under an ISOLATED CLAUDE_CONFIG_DIR
// (no global state pollution) and drives it via stdio MCP JSON-RPC.
//
// Every JSON-RPC line in/out is mirrored to <logDir>/<peerName>-traffic.jsonl
// (one record per line). Server stderr (which carries CC_DEBUG/CC_TRACE_SQL
// trace lines when those env vars are on) is mirrored to <peerName>.stderr.
// Both files are fully durable on disk while the peer runs — scenarios can
// `Read` them mid-run for assertion debugging without racing the buffer.
//
// Timing notes: latency is captured with performance.now() at the wrap layer,
// not by the cc-server itself. We measure round-trip wall time, not service
// time. CC_DEBUG=1 traces from the server give a service-time breakdown.

import * as fs from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";

export type PeerOptions = {
  name: string;                    // short label (e.g. "alice"); used for log files
  sessionId: string;               // CLAUDE_CODE_SESSION_ID for this peer
  cwd: string;                     // peer's working directory (drives git context, scope)
  logDir: string;                  // run's log dir; we write under it
  claudeDir: string;               // shared CLAUDE_CONFIG_DIR (so peers see each other)
  ccDebug?: boolean;               // CC_DEBUG=1 in child env
  ccTraceSql?: boolean;            // CC_TRACE_SQL=1 in child env
  effort?: "low" | "medium" | "high"; // CLAUDE_EFFORT in child env
  pluginRoot: string;              // path to plugins/cc/ (for server.ts)
};

type PendingResolver = (msg: Record<string, unknown>) => void;

export class Peer {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private stdoutTextDecoder = new TextDecoder();
  private stdoutBuffer = "";
  private nextId = 1;
  private pending = new Map<number, PendingResolver>();
  private trafficStream: fs.WriteStream | null = null;
  private stderrStream: fs.WriteStream | null = null;
  private bootMs = 0;
  private bootedAt = 0;

  constructor(public readonly opts: PeerOptions) {}

  get pid(): number {
    return this.proc?.pid ?? -1;
  }

  // Spawn cc-server. Resolves once we've received the response to initialize().
  // Returns the boot time in ms (spawn → initialize ack).
  async start(): Promise<number> {
    if (this.proc) throw new Error("peer already started");

    const trafficPath = path.join(this.opts.logDir, `${this.opts.name}-traffic.jsonl`);
    const stderrPath = path.join(this.opts.logDir, `${this.opts.name}.stderr`);
    this.trafficStream = fs.createWriteStream(trafficPath, { flags: "a" });
    this.stderrStream = fs.createWriteStream(stderrPath, { flags: "a" });

    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_CONFIG_DIR: this.opts.claudeDir,
      CLAUDE_CODE_SESSION_ID: this.opts.sessionId,
      CC_STATIC_MODE: "false",
    };
    if (this.opts.ccDebug) env.CC_DEBUG = "1";
    if (this.opts.ccTraceSql) env.CC_TRACE_SQL = "1";
    if (this.opts.effort) env.CLAUDE_EFFORT = this.opts.effort;
    delete env.CC_STATE_DIR; // let server resolve from CLAUDE_CONFIG_DIR

    const t0 = performance.now();
    this.proc = Bun.spawn({
      cmd: ["bun", path.join(this.opts.pluginRoot, "server.ts")],
      cwd: this.opts.cwd,
      env,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    // Pipe stderr → stderrStream (no parsing needed; trace lines + boot logs).
    void (async () => {
      const reader = this.proc!.stderr.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (this.stderrStream) this.stderrStream.write(value);
      }
    })();

    // Pipe stdout → JSON-RPC parser.
    void this.consumeStdout();

    // Send initialize and wait.
    const initResp = await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: this.opts.name, version: "0" },
    });
    this.bootMs = performance.now() - t0;
    this.bootedAt = Date.now();
    if (!initResp.result) {
      throw new Error(`peer ${this.opts.name} init failed: ${JSON.stringify(initResp)}`);
    }
    return this.bootMs;
  }

  // Call a cc tool action. Returns the parsed text content (the cc tool always
  // returns a single text content block) AND round-trip ms.
  async callAction(
    action: string,
    args: Record<string, unknown> = {},
  ): Promise<{ text: string; parsed: unknown; ms: number }> {
    const t0 = performance.now();
    const resp = await this.sendRequest("tools/call", {
      name: "cc",
      arguments: { action, ...args },
    });
    const ms = performance.now() - t0;
    const result = resp.result as
      | { content?: Array<{ type: string; text: string }> }
      | undefined;
    const block = result?.content?.[0];
    if (!block || block.type !== "text") {
      throw new Error(`peer ${this.opts.name}.${action}: no text response`);
    }
    let parsed: unknown = block.text;
    try {
      parsed = JSON.parse(block.text);
    } catch {
      // text was a rendered string (check action), keep as string
    }
    return { text: block.text, parsed, ms };
  }

  // Graceful shutdown. Sends EOF on stdin so the server exits its read loop.
  async stop(): Promise<void> {
    if (!this.proc) return;
    try {
      // Bun.spawn proc.stdin is a FileSink: .end() closes (sends EOF).
      this.proc.stdin.end?.();
    } catch {
      // already closed
    }
    // give it a moment to drain stderr + flush
    await Bun.sleep(50);
    try {
      this.proc.kill("SIGTERM");
    } catch {
      // already dead
    }
    await this.proc.exited;
    this.trafficStream?.end();
    this.stderrStream?.end();
    this.proc = null;
  }

  // Hard kill (simulates crash for peer-leave scenario).
  hardKill(): void {
    if (!this.proc) return;
    try {
      this.proc.kill("SIGKILL");
    } catch {}
    this.trafficStream?.end();
    this.stderrStream?.end();
    this.proc = null;
  }

  // ---- internals ----

  private async sendRequest(
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    const msg = { jsonrpc: "2.0", id, method, params };
    const line = JSON.stringify(msg) + "\n";

    this.trafficStream?.write(`${performance.now().toFixed(3)} OUT ${line}`);

    // Bun.spawn proc.stdin is a FileSink. .write returns immediately;
    // .flush() pushes the buffered bytes to the child.
    const sink = this.proc!.stdin as { write: (data: string | Uint8Array) => number; flush?: () => void };
    sink.write(line);
    sink.flush?.();

    return new Promise<Record<string, unknown>>((resolve) => {
      this.pending.set(id, resolve);
    });
  }

  private async consumeStdout(): Promise<void> {
    const reader = this.proc!.stdout.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      this.stdoutBuffer += this.stdoutTextDecoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = this.stdoutBuffer.indexOf("\n")) >= 0) {
        const line = this.stdoutBuffer.slice(0, nl);
        this.stdoutBuffer = this.stdoutBuffer.slice(nl + 1);
        if (!line) continue;
        this.trafficStream?.write(`${performance.now().toFixed(3)} IN  ${line}\n`);
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue; // garbage line, ignore
        }
        const id = parsed.id as number | undefined;
        if (typeof id === "number") {
          const resolver = this.pending.get(id);
          if (resolver) {
            this.pending.delete(id);
            resolver(parsed);
          }
        }
        // notifications (no id) are silently captured in the traffic file
      }
    }
  }
}
