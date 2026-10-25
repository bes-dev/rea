/** Task profiles: which REA tools are declared to the model. Entries are exact names or `*` globs. */
/** Always declared. `inspect_analysis_view` is reached through the short `rea_view` wrapper instead. */
export const CORE = ["list_unknowns", "record_unknown"];

export const PROFILES: Record<string, { description: string; tools: string[] }> = {
  triage: {
    description: "Unknown target: identify format, layout, signatures, language runtime",
    tools: [
      "inspect_artifact", "extract_artifact", "inspect_desktop_application", "inspect_binary_layout",
      "inspect_byte_entropy", "inspect_signature", "inspect_with_objdump", "list_architectures",
      "inspect_go_binary", "inspect_rust_binary", "inspect_dart_aot", "identify_flutter_build",
      "inspect_python_pyc", "inspect_wasm_artifact", "inspect_il2cpp_metadata", "inspect_model_artifact",
    ],
  },
  native: {
    description: "Native binaries (ELF/PE/Mach-O) via Hopper/Ghidra/IDA/Kuna: functions, pseudocode, strings, xrefs",
    tools: [
      "open_binary", "close_binary", "binary_overview", "list_procedures", "search_procedures",
      "procedure_pseudo_code", "procedure_callers", "procedure_callees", "procedure_info", "analyze_function",
      "list_strings", "search_strings", "xrefs", "find_xrefs_to_name", "inspect_address_context",
      "get_call_graph", "trace_call_path", "read_bytes", "inspect_native_exports", "inspect_native_api",
      "inspect_pe_imports", "inspect_macho",
    ],
  },
  "native-deep": {
    description: "More native detail: assembly, instructions, data types, segments, bulk decompilation, renaming",
    tools: [
      "procedure_*", "inspect_native_*", "resolve_*", "batch_decompile", "decompile_all", "search_bytes",
      "list_segments", "list_names", "build_call_path", "binary_session", "read_function_instructions",
      "address_to_file_offset", "set_address_name", "set_comment",
    ],
  },
  hopper: {
    description: "Interactive Hopper document: cursor, navigation, names, comments, bookmarks",
    tools: [
      "list_documents", "current_document", "current_address", "current_procedure", "goto_address",
      "next_address", "prev_address", "address_name", "comment", "inline_comment", "set_*",
      "*bookmark*", "get_navigation_context", "annotate_native_function",
    ],
  },
  apple: {
    description: "macOS/iOS apps: Mach-O, ObjC/Swift metadata, nibs, plists, dylibs",
    tools: [
      "project_apple_application_graph", "inspect_macho", "get_objc_*", "analyze_swift_types",
      "demangle_swift", "decode_interface_builder", "inspect_asset_catalog", "inspect_plist",
      "inspect_keyed_archive", "trace_dylib_resolution", "inspect_apple_ips",
    ],
  },
  js: {
    description: "JavaScript/Electron apps and ASAR archives: modules, IPC, routes, features",
    tools: [
      "analyze_javascript_application", "recover_javascript_sources", "trace_javascript_semantics",
      "trace_application_feature", "trace_feature", "compare_application_versions",
      "compare_javascript_export_shapes", "compare_source_to_bundle", "inspect_electron_fuses",
      "inspect_artifact", "extract_artifact",
    ],
  },
  web: {
    description: "Websites: bundles, pages, network captures, browser scenarios",
    tools: [
      "analyze_web_bundle", "inspect_web_*", "observe_web_*", "trace_web_*", "export_web_scripts",
      "capture_browser_scenario", "capture_web_screenshot", "list_browser_targets",
      "discover_webmcp_tools", "compare_web_*",
    ],
  },
  android: {
    description: "Android APKs, HarmonyOS apps and devices: classes, resources, signatures, adb",
    tools: [
      "*android*", "inspect_apk_signature", "inspect_apktool_client", "*jeb*", "*adb*",
      "project_harmony_application_graph",
    ],
  },
  managed: {
    description: ".NET/managed assemblies and their native boundaries",
    tools: ["*managed*"],
  },
  dynamic: {
    description: "Runtime observation: Frida, GDB, Rizin, process and UI scenarios (executes targets)",
    tools: [
      "*frida*", "*gdb*", "*rizin*", "*cutter*", "observe_native_*", "capture_process_scenario",
      "compare_process_captures", "capture_native_ui_scenario", "trace_native_ui_action",
      "observe_javascript_runtime", "list_javascript_runtime_targets", "reconcile_javascript_runtime",
      "capture_electron_scenario", "list_electron_targets", "inspect_electron_page",
      "correlate_static_and_runtime", "trace_native_values",
    ],
  },
  firmware: {
    description: "Firmware, kernels, ELF notes, devicetrees, packet and signal captures",
    tools: [
      "extract_firmware", "inspect_firmware_regions", "inspect_devicetree", "inspect_kernel_module",
      "inspect_elf_notes", "inspect_gpu_code_objects", "inspect_packet_*", "inspect_pcap_*",
      "decode_signal_recording", "inspect_signal_decoders", "inspect_recorded_crash", "inspect_evm_interface",
    ],
  },
  formats: {
    description: "Standalone data formats: PE resources/certificates, SQLite, plists, BEAM",
    tools: [
      "inspect_pe_*", "inspect_sqlite_database", "inspect_plist", "inspect_keyed_archive", "inspect_erlang_beam",
    ],
  },
  compare: {
    description: "Diffing versions: artifacts, bundles, functions, changed behavior",
    tools: [
      "compare_artifacts", "compare_bundles", "compare_functions", "match_native_functions",
      "find_changed_behavior", "compare_wasm_interfaces", "compare_managed_members",
    ],
  },
  reconstruct: {
    description: "Reimplementation bookkeeping: evidence bundles, obligation ledgers, coverage",
    tools: [
      "*evidence_bundle", "build_reconstruction_obligation_ledger", "evaluate_reconstruction_coverage",
      "verify_reconstruction", "verify_unknown_resolution", "export_environment_bundle",
      "import_managed_reconstruction", "open_bundle_resources", "update_unknown",
    ],
  },
  settings: {
    description: "REA runtime limits and deadlines, when an error names an adjustable setting",
    tools: ["*analysis_settings"],
  },
};

const matches = (pattern: string, name: string) =>
  new RegExp(`^${pattern.replaceAll("*", ".*")}$`).test(name);

/** REA tool names (without the `mcp__rea__` prefix) selected by the given profiles plus the core. */
export const selectTools = (profiles: string[], available: string[]) => {
  const patterns = [...CORE, ...profiles.flatMap((p) => PROFILES[p].tools)];
  return available.filter((name) => patterns.some((p) => matches(p, name)));
};
