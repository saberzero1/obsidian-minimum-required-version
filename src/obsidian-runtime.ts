export type ObsidianRuntime = {
  requireApiVersion: (version: string) => boolean;
  apiVersion: string;
};

let cached: ObsidianRuntime | undefined;

export function getObsidianRuntime(): ObsidianRuntime {
  if (cached) {
    return cached;
  }

  // Obsidian provides its API via the 'obsidian' module at runtime inside Electron.
  // We use a dynamic approach to avoid:
  // 1. Failing at import time for consumers who only use the registry (obsidian is optional)
  // 2. Bundlers (esbuild/rollup) trying to resolve 'obsidian' at build time
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = (globalThis as Record<string, unknown>)["require"];
    if (typeof mod === "function") {
      cached = (mod as (id: string) => unknown)("obsidian") as ObsidianRuntime;
      return cached;
    }
    throw new Error("require not available");
  } catch {
    throw new Error(
      "The obsidian package is required for runtime availability checks. " +
        "Ensure your plugin runs inside Obsidian or that obsidian is installed as a dependency.",
    );
  }
}
