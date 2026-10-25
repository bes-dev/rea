import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAsk } from "./ask.ts";
import { loadExamples } from "./examples.ts";
import { registerOffload } from "./offload.ts";
import { PROFILES, resolveProfile, selectTools } from "./profiles.ts";
import { registerView } from "./view.ts";

const PREFIX = "mcp__rea__";
const ENTRY = "rea-profiles";
const LIST = Object.entries(PROFILES).map(([name, p]) => `- ${name}: ${p.description}`).join("\n");

export default function (pi: ExtensionAPI) {
  const command = process.env.REA_COMMAND ?? "rea";
  let profiles = (process.env.REA_PI_PROFILES ?? "triage").split(",").flatMap((name) => resolveProfile(name) ?? []);
  let examples = new Map<string, unknown[]>();

  // Every REA tool is registered but deferred; profiles decide which ones are declared.
  pi.registerMcpServer("rea", {
    command,
    args: ["--mcp"],
    // Providers are configured by environment (GHIDRA_INSTALL_DIR, JAVA_HOME, REA_IDA_MCP_CONFIG, …).
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
      REA_MCP_OUTPUT_SCHEMA_PROFILE: "off",
    },
    exposure: "deferred",
    timeout: 1800,
    description: "REA reverse engineering of binaries, apps, archives, websites and devices; load tool sets with rea_profile",
  });

  /** Declares the profiles' tools; `replace` also withdraws other REA tools. Profiles replace `tool_search`. */
  const apply = (replace: boolean) => {
    const rea = pi.getAllTools().flatMap((t) => (t.name.startsWith(PREFIX) ? [t.name.slice(PREFIX.length)] : []));
    const selected = selectTools(profiles, rea).map((name) => PREFIX + name);
    const active = pi.getActiveTools();
    const kept = active.filter((name) => name !== "tool_search" && !(replace && name.startsWith(PREFIX)));
    const next = [...new Set([...kept, ...selected])];
    // An unchanged tool set must not touch the transcript, or the prompt cache is lost.
    if (next.length !== active.length || next.some((name) => !active.includes(name))) pi.setActiveTools(next);
    return selected;
  };

  /** Loads the known profiles among `names`; a local model's near-miss must not leave it with no tools. */
  const select = (names: string[]) => {
    const known = [...new Set(names.flatMap((name) => resolveProfile(name) ?? []))];
    const unknown = names.filter((name) => !resolveProfile(name));
    if (!known.length) throw new Error(`Unknown REA profiles: ${unknown.join(", ")}. Known:\n${LIST}`);
    profiles = known;
    pi.appendEntry(ENTRY, { profiles });
    return { tools: apply(true), unknown };
  };

  pi.on("session_start", (_event, ctx) => {
    const saved = ctx.sessionManager
      .getEntries()
      .filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === ENTRY)
      .pop() as { data?: { profiles: string[] } } | undefined;
    if (saved?.data) profiles = saved.data.profiles;
    void loadExamples(command).then((loaded) => (examples = loaded));
  });
  // REA connects in the background, so its tools may appear after the first run starts.
  pi.on("turn_start", () => void apply(false));

  pi.registerTool(
    defineTool({
      name: "rea_profile",
      label: "REA profile",
      description: `Load the REA tool sets for the current task, replacing the previous selection. Combine profiles when needed.\n${LIST}`,
      parameters: Type.Object({ profiles: Type.Array(Type.String()) }),
      // Appends valid calls to the declared REA tools, since compact schemas lose union shapes:
      // one per tool, and every view example to rea_view, whose views are the hardest to guess.
      prepareLoadout: (loadout) => ({
        descriptions: Object.fromEntries(
          loadout.declared.flatMap((tool) => {
            if (tool.name === "rea_view") {
              const views = (examples.get("inspect_analysis_view") ?? []) as { view?: unknown }[];
              const list = views.map((e) => JSON.stringify(e.view)).join("\n");
              return list ? [[tool.name, `${tool.description}\nValid views:\n${list}`]] : [];
            }
            const example = JSON.stringify(examples.get(tool.name.slice(PREFIX.length))?.[0]);
            return tool.name.startsWith(PREFIX) && example && example.length <= 1000
              ? [[tool.name, `${tool.description}\nExample arguments: ${example}`]]
              : [];
          }),
        ),
      }),
      async execute(_id, params) {
        const { tools, unknown } = select(params.profiles);
        const ignored = unknown.length ? ` Not profiles, ignored: ${unknown.join(", ")}.` : "";
        const text = `Profiles ${profiles.join(", ")}.${ignored} Call these tools directly from your next step:\n${tools.join("\n")}`;
        return { content: [{ type: "text", text }], details: undefined };
      },
    }),
  );

  pi.registerCommand("rea", {
    description: "Show or set REA tool profiles, e.g. /rea native js",
    getArgumentCompletions: (prefix) => {
      const words = prefix.split(/\s+/);
      const last = words.pop() ?? "";
      return Object.entries(PROFILES)
        .filter(([name]) => name.startsWith(last))
        .map(([name, p]) => ({ value: [...words, name].join(" "), label: name, description: p.description }));
    },
    handler: async (args, ctx) => {
      if (args.trim()) select(args.trim().split(/[\s,]+/));
      ctx.ui.notify(`REA profiles: ${profiles.join(", ")}\n${LIST}`, "info");
    },
  });

  registerOffload(pi);
  registerView(pi);
  registerAsk(pi);
}
