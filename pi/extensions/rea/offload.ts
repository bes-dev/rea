import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { digest } from "./digest.ts";

const BUDGET = Number(process.env.REA_PI_DIGEST_CHARS ?? 3000);

const isRea = (name: string) => name.startsWith("mcp__rea__") || name === "rea_view";

const parse = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/** Keeps REA results out of the context: full results go to `.rea/`, the model gets a digest. */
export const registerOffload = (pi: ExtensionAPI) => {
  pi.on("tool_call", (event) => {
    if (!event.toolName.startsWith("mcp__rea__") || "detail" in event.input) return;
    const schema = pi.getAllTools().find((t) => t.name === event.toolName)?.parameters as
      | { properties?: { detail?: { enum?: string[] } } }
      | undefined;
    if (schema?.properties?.detail?.enum?.includes("summary")) (event.input as Record<string, unknown>).detail = "summary";
  });

  pi.on("tool_result", (event, ctx) => {
    if (!isRea(event.toolName) || event.parentToolCallId) return;
    const text = event.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
    if (text.length <= BUDGET) return;
    if (event.isError) return { content: [{ type: "text", text: text.slice(0, BUDGET) }] };

    // MCP tools carry the whole CallToolResult; REA's Evidence record is its structuredContent.
    const raw = (event.structuredContent ?? parse(text)) as { structuredContent?: unknown } | undefined;
    const value = raw?.structuredContent ?? raw;
    const evidence = value as {
      evidence_id?: string;
      normalized_result?: { parent_evidence_id?: string };
      limitations?: unknown[];
    };
    const dir = join(ctx.cwd, ".rea");
    const path = join(dir, `${evidence?.evidence_id ?? event.toolCallId}.${value === undefined ? "txt" : "json"}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, value === undefined ? text : JSON.stringify(value));

    // A summary is itself a view; further views page the complete parent record REA retains.
    const parent = evidence?.normalized_result?.parent_evidence_id;
    const source = parent
      ? `{"kind":"retained-evidence","evidence_id":"${parent}"}`
      : `{"kind":"evidence-file","path":"${path}"}`;
    const head = [
      `${event.toolName.replace("mcp__rea__", "")} → ${evidence?.evidence_id ?? "result"}`,
      `Saved to ${path} (${Math.round(text.length / 1024)} KB). Never read it whole: slice with jq/rg,`,
      `rea_view {"source":${source},"view":{"kind":"summary"}}, or rea_ask with the evidence ID.`,
    ];
    if (Array.isArray(evidence?.limitations)) head.push(`limitations: ${evidence.limitations.length} (in file)`);
    const body =
      value === undefined
        ? `${text.slice(0, BUDGET - 500)}\n…\n${text.slice(-400)}`
        : digest(evidence.normalized_result ?? value, BUDGET);
    return { content: [{ type: "text", text: `${head.join("\n")}\n${body}` }] };
  });
};
