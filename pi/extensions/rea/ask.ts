import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Type, type Usage } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

const MAX_CHUNKS = Number(process.env.REA_PI_ASK_MAX_CHUNKS ?? 16);
// Small chunks keep a local model accurate; RLM-style reading trades more calls for focus.
const CHUNK_CHARS = Number(process.env.REA_PI_ASK_CHUNK_CHARS ?? 60000);
const SYSTEM =
  "You read one part of a reverse-engineering result. Answer the question only from this data, briefly, " +
  "citing exact addresses, names, paths and evidence IDs. Reply NONE if this part has nothing relevant.";

/** The sub-model: REA_PI_ASK_MODEL ("provider/id") or the session model. */
const subModel = (ctx: ExtensionContext) => {
  const [provider, ...id] = (process.env.REA_PI_ASK_MODEL ?? "").split("/");
  const model = id.length ? ctx.modelRegistry.find(provider, id.join("/")) : ctx.model;
  if (!model) throw new Error("No model for rea_ask: select one or set REA_PI_ASK_MODEL.");
  return model;
};

/** Recursive-LM style reading: sub-model calls see the data, the main context gets only the answer. */
export const registerAsk = (pi: ExtensionAPI) =>
  pi.registerTool(
    defineTool({
      name: "rea_ask",
      label: "REA ask",
      description:
        "Ask a question about a large file (saved REA Evidence in .rea/, decompiled code, logs) without reading it. " +
        "A fresh model call reads the data in chunks and returns only the answer. " +
        'Narrow the data first with select, a jq filter for JSON files, e.g. ".normalized_result.graph.nodes[:200]".',
      parameters: Type.Object({
        path: Type.String({ description: "Absolute file path, or an evidence ID saved in .rea/" }),
        question: Type.String(),
        select: Type.Optional(Type.String({ description: "jq filter applied to a JSON file" })),
      }),
      async execute(_id, { path: target, question, select }, signal, _onUpdate, ctx) {
        const path = target.startsWith("ev_") ? join(ctx.cwd, ".rea", `${target}.json`) : target;
        const data = select
          ? execFileSync("jq", ["-c", select, path], { maxBuffer: 2 ** 31 - 1 }).toString()
          : readFileSync(path, "utf8");
        const model = subModel(ctx);
        const size = Math.min(CHUNK_CHARS, model.contextWindow * 2);
        const chunks = Array.from({ length: Math.ceil(data.length / size) }, (_, i) => data.slice(i * size, (i + 1) * size));
        if (chunks.length > MAX_CHUNKS)
          throw new Error(`${chunks.length} chunks exceed ${MAX_CHUNKS}; narrow the data with select.`);

        const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
        const ask = async (prompt: string) => {
          const reply = await ctx.modelRegistry.complete(
            model,
            { systemPrompt: SYSTEM, messages: [{ role: "user", content: prompt, timestamp: Date.now() }] },
            { signal },
          );
          usage.input += reply.usage.input;
          usage.output += reply.usage.output;
          usage.totalTokens += reply.usage.totalTokens;
          usage.cost.total += reply.usage.cost.total;
          return reply.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
        };

        const answers: string[] = [];
        for (const [i, chunk] of chunks.entries()) {
          const answer = await ask(`${question}\n\n<data part="${i + 1}/${chunks.length}">\n${chunk}\n</data>`);
          if (answer && answer !== "NONE") answers.push(answer);
        }
        const text =
          answers.length > 1
            ? await ask(`${question}\n\nCombine these partial answers into one:\n\n${answers.join("\n---\n")}`)
            : (answers[0] ?? "NONE: the data has nothing relevant.");
        return { content: [{ type: "text", text }], details: undefined, usage };
      },
    }),
  );
