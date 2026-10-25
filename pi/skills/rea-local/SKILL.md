---
name: rea-local
description: Reverse engineer apps, binaries, archives, websites or devices with REA while keeping context small. Use for any question about how a program, app, file format or site works internally.
---

# REA with a small context

1. **Pick tools.** Call `rea_profile` with the profiles that fit the target; start with `triage` when the type is unknown. Switch profiles as the task moves (e.g. `triage` → `js`, or `native` + `apple`). REA tools are named `mcp__rea__<tool>`, and `rea_profile` lists the ones it loaded.
2. **Summary first.** REA tools default to `detail: "summary"`. Ask for `"complete"` only when a later tool needs the complete record.
3. **Results live in files.** Large results are saved to `.rea/<evidence_id>.json`, and you get a digest. Never `read` such a file whole. Instead:
   - `rea_view` with `{"kind":"summary"}`, then pages of `{"kind":"page","collection":…,"offset":0,"limit":20}`;
   - `bash` with `jq` or `rg` for structure, exact keys, counts and matches (e.g. `jq 'paths(scalars)|join(".")' | sort -u | head`, `rg -o '.{80}sync.{80}'`);
   - `rea_ask` with the evidence ID for questions about meaning across a big slice; it reads the slice in separate model calls and returns only the answer.
4. **Pass references, not records.** Later REA tools accept `{"kind":"retained-evidence","evidence_id":"ev_…"}`. Never paste Evidence JSON into a call.
5. **Keep a ledger.** Record open questions with `record_unknown` and check `list_unknowns` after a context compaction.
6. **Answer with evidence.** Cite addresses, paths and evidence IDs. Separate what was observed from what you infer.

On an error, follow its `remediation`. If it names an adjustable limit, load the `settings` profile.
