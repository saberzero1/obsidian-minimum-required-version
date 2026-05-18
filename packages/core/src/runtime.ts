import { getMinVersion } from "./registry.js";
import { getObsidianRuntime } from "./obsidian-runtime.js";
import { compareVersions } from "./version.js";

export function requireApis(symbols: string[]): string {
  let highestVersion: string | undefined;

  for (const symbol of symbols) {
    const minVersion = getMinVersion(symbol);
    if (!minVersion) {
      throw new Error(`Unknown API symbol: ${symbol}`);
    }

    if (!highestVersion || compareVersions(minVersion, highestVersion) > 0) {
      highestVersion = minVersion;
    }
  }

  return highestVersion ?? "0.0.0";
}

export function ifApisAvailable<T>(
  symbols: string[],
  execute: () => T,
  fallback?: () => T,
): T | undefined {
  const minVersion = requireApis(symbols);
  const obsidian = getObsidianRuntime();

  if (obsidian.requireApiVersion(minVersion)) {
    return execute();
  }

  return fallback ? fallback() : undefined;
}
