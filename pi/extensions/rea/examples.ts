import { spawn } from "node:child_process";

/**
 * One valid call per REA tool, from REA's full-profile catalog. The compact schemas the model sees
 * drop these examples, though they are the cheapest way to show the shape of union inputs.
 */
export const loadExamples = (command: string) =>
  new Promise<Map<string, string>>((resolve) => {
    const examples = new Map<string, string>();
    const child = spawn(command, ["--mcp"], {
      env: { ...process.env, REA_MCP_INPUT_SCHEMA_PROFILE: "full", REA_MCP_OUTPUT_SCHEMA_PROFILE: "off" },
      stdio: ["pipe", "pipe", "ignore"],
    });
    const send = (message: object) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
    let buffer = "";
    child.stdout.on("data", (data) => {
      buffer += data;
      for (let i = buffer.indexOf("\n"); i >= 0; i = buffer.indexOf("\n")) {
        const message = JSON.parse(buffer.slice(0, i));
        buffer = buffer.slice(i + 1);
        if (message.id === 1) {
          send({ method: "notifications/initialized" });
          send({ id: 2, method: "tools/list", params: {} });
        }
        if (message.id === 2) {
          for (const tool of message.result?.tools ?? []) {
            const example = tool.inputSchema?.examples?.[0];
            if (example) examples.set(tool.name, JSON.stringify(example));
          }
          child.kill();
        }
      }
    });
    child.on("error", () => resolve(examples));
    child.on("exit", () => resolve(examples));
    send({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "rea-pi", version: "0" } } });
  });
