import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const VIEW = "mcp__rea__inspect_analysis_view";

/** Short-description wrapper for `inspect_analysis_view`, whose own description is ~15 KB. */
export const registerView = (pi: ExtensionAPI) =>
  pi.registerTool(
    defineTool({
      name: "rea_view",
      label: "REA view",
      description:
        "Page or project REA Evidence without repeating analysis. source: " +
        '{"kind":"retained-evidence","evidence_id":"ev_…"} (e.g. parent_evidence_id of a summary) or ' +
        '{"kind":"evidence-file","path":"/abs/.rea/ev_….json"}. view: start with {"kind":"summary"}, then ' +
        '{"kind":"page","collection":"<name from summary>","offset":0,"limit":20}. ' +
        'Errors list accepted views. For the full view reference of one operation pass guide:"<keyword>", e.g. guide:"javascript".',
      parameters: Type.Object({
        source: Type.Optional(Type.Record(Type.String(), Type.Any())),
        view: Type.Optional(Type.Record(Type.String(), Type.Any())),
        guide: Type.Optional(Type.String()),
      }),
      async execute(_id, params, signal, onUpdate, ctx) {
        if (params.guide !== undefined) {
          const full = pi.getAllTools().find((t) => t.name === VIEW)?.description ?? "REA is not connected yet.";
          const keyword = params.guide.toLowerCase();
          const text = full.split(/(?<=\.)\s+/).filter((s) => s.toLowerCase().includes(keyword)).join(" ");
          const kinds = [...new Set(full.match(/[a-z]+(?:-[a-z]+)+/g))].join(", ");
          return { content: [{ type: "text", text: text || `No match for "${params.guide}". Terms: ${kinds}` }], details: undefined };
        }
        const { result } = await ctx.executeTool(VIEW, { source: params.source, view: params.view }, { signal, onUpdate });
        return result;
      },
    }),
  );
