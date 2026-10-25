# REA for Pi with local models

A [Pi](https://github.com/earendil-works/pi) package that runs REA within the
context budget of a local model (LM Studio, Ollama, llama.cpp, vLLM).

## Why

Measured with REA 6.8.0:

| | Size |
|---|---|
| Full MCP catalog: 229 tools, input schemas + descriptions | ~257 KB (~65K tokens) |
| `inspect_analysis_view` description alone | ~15 KB |
| `analyze_javascript_application`, 4-file app, default `complete` | 577 KB (Evidence twice: text + structured) |
| Same call with `detail: "summary"` | 24 KB |

## What it does

- **Profiles.** REA connects with `deferred` exposure: every tool is
  registered, and only the selected profiles are declared to the model, ~3–11K
  tokens per profile. The model switches with the `rea_profile` tool; you
  switch with `/rea native js`. The selection is saved in the session.
  `tool_search` is turned off because the profiles cover every tool and its
  results are large (3–23 KB). Profiles: `triage`, `native`, `native-deep`,
  `hopper`, `apple`, `js`, `web`, `android`, `managed`, `dynamic`, `firmware`,
  `formats`, `compare`, `reconstruct`, `settings`. They cover every REA tool and live in
  [`extensions/rea/profiles.ts`](extensions/rea/profiles.ts).
- **Summary first.** Calls to tools that accept `detail` default to
  `"summary"` unless the model asks for `"complete"`.
- **Offloading.** A REA result larger than 3,000 characters is saved to
  `.rea/<evidence_id>.json` in the working directory. The model gets the
  path and a structural digest: keys, counts, the first items, short strings.
  Codemode scripts still receive complete results.
- **Examples restored.** Compact schemas drop REA's input examples, though they
  are the cheapest way to show union-shaped inputs. At session start the
  extension reads them once from a second `rea --mcp` started with the full
  profile (~0.2 s), and appends one valid call to each declared REA tool.
- **`rea_view`.** A wrapper for `inspect_analysis_view` with a short
  description. `guide: "<keyword>"` returns the matching parts of the full
  reference on demand.
- **`rea_ask`** reads large data recursively, in the style of Recursive
  Language Models. A separate model call reads a file, or a `jq` selection of
  it, in chunks of 60,000 characters and returns only the answer. Several
  partial answers are combined in one more call. SHA-256 digests are shortened
  to 12 hex digits first, which saves 20–25% of an Evidence file's characters.
  `path` also accepts an evidence ID saved in `.rea/`.
- **`rea-local` skill.** A short workflow guide that replaces the 35 KB
  bundled skill.

## Install

```bash
npm i -g rea-agents          # or set REA_COMMAND to another launcher
pi install /path/to/rea/pi   # or: pi -e /path/to/rea/pi
```

Do not also register REA in `~/.pi/agent/mcp.json` (for example through
`rea setup --client pi`): an `mcp.json` entry named `rea` takes precedence
over this package's registration and is not deferred.

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `REA_PI_PROFILES` | `triage` | Profiles for a new session, comma-separated |
| `REA_COMMAND` | `rea` | REA launcher (it runs `<command> --mcp`) |
| `REA_PI_DIGEST_CHARS` | `3000` | Results larger than this are offloaded |
| `REA_PI_ASK_MODEL` | session model | `provider/id` of the model that `rea_ask` uses |
| `REA_PI_ASK_CHUNK_CHARS` | `60000` | Characters per `rea_ask` sub-call |
| `REA_PI_ASK_MAX_CHUNKS` | `16` | Upper bound on sub-calls per `rea_ask` |

`rea_ask` needs `jq` for `select`.

Give `rea_ask` a fast model without reasoning, such as
`REA_PI_ASK_MODEL=lmstudio/qwen3.8-27b-mlx`. A reasoning model writes long
thinking for every chunk, which makes sub-calls several times slower.
Parallel sub-calls did not help on LM Studio: three requests took 89 s in
sequence and 102 s in parallel, so chunks are read one at a time.
