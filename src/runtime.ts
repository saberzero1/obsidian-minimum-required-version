import { getMinVersion } from "./registry.js";
import type { ApiNode, ApiSymbol } from "./generated.js";
import { getObsidianRuntime } from "./obsidian-runtime.js";
import { compareVersions } from "./version.js";

function normalizeSymbols(symbols: (string | ApiNode)[]): string[] {
  return symbols.map((symbol) =>
    typeof symbol === "string" ? symbol : symbol.$key,
  );
}

export function requireApis(symbols: ApiSymbol[]): string;
export function requireApis(symbols: string[]): string;
export function requireApis(symbols: ApiNode[]): string;
export function requireApis(symbols: (string | ApiNode)[]): string {
  const keys = normalizeSymbols(symbols);
  let highestVersion: string | undefined;

  for (const symbol of keys) {
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
  symbols: ApiSymbol[],
  execute: () => T,
  fallback?: () => T,
): T | undefined;
export function ifApisAvailable<T>(
  symbols: string[],
  execute: () => T,
  fallback?: () => T,
): T | undefined;
export function ifApisAvailable<T>(
  symbols: ApiNode[],
  execute: () => T,
  fallback?: () => T,
): T | undefined;
export function ifApisAvailable<T>(
  symbols: (string | ApiNode)[],
  execute: () => T,
  fallback?: () => T,
): T | undefined {
  const keys = normalizeSymbols(symbols);
  const minVersion = requireApis(keys);
  const obsidian = getObsidianRuntime();

  if (obsidian.requireApiVersion(minVersion)) {
    return execute();
  }

  return fallback ? fallback() : undefined;
}
