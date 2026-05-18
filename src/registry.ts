import registryData from "./registry.json";
import type { ApiNode, ApiSymbol } from "./generated.js";
import type { Registry } from "./types.js";
import { compareVersions } from "./version.js";
import { getObsidianRuntime } from "./obsidian-runtime.js";

const registry: Registry = Object.freeze(registryData) as Registry;

function normalizeSymbol(symbol: string | ApiNode): string {
  if (typeof symbol === "string") {
    return symbol;
  }
  return symbol.$key;
}

export function sinceOf(node: ApiNode): string {
  return node.$since;
}

export function keyOf(node: ApiNode): string {
  return node.$key;
}

export function getMinVersion(symbol: ApiSymbol): string;
export function getMinVersion(symbol: string): string | undefined;
export function getMinVersion(symbol: ApiNode): string | undefined;
export function getMinVersion(symbol: string | ApiNode): string | undefined {
  const key = normalizeSymbol(symbol);
  const delimiterIndex = key.indexOf(":");
  if (delimiterIndex !== -1) {
    const baseSymbol = key.slice(0, delimiterIndex);
    const discriminant = key.slice(delimiterIndex + 1);
    return getMinVersionForOverload(baseSymbol, discriminant);
  }

  return registry.symbols[key]?.since;
}

export function getMinVersionForOverload(
  symbol: string,
  discriminant: string,
): string | undefined {
  const entry = registry.symbols[symbol];
  if (!entry?.overloads) {
    return undefined;
  }

  return entry.overloads.find(
    (overload) => overload.discriminant === discriminant,
  )?.since;
}

export function isAvailable(symbol: ApiSymbol): boolean;
export function isAvailable(symbol: string): boolean;
export function isAvailable(symbol: ApiNode): boolean;
export function isAvailable(symbol: string | ApiNode): boolean {
  const key = normalizeSymbol(symbol);
  const minVersion = getMinVersion(key);
  if (!minVersion) {
    return true;
  }

  const obsidian = getObsidianRuntime();
  return obsidian.requireApiVersion(minVersion);
}

export function getAllSymbols(): string[] {
  return Object.keys(registry.symbols);
}

export function getSymbolsForVersion(version: string): string[] {
  return Object.entries(registry.symbols)
    .filter(([, entry]) => entry.since === version)
    .map(([symbol]) => symbol);
}

export function getSymbolsRequiringAtLeast(version: string): string[] {
  return Object.entries(registry.symbols)
    .filter(([, entry]) => compareVersions(entry.since, version) >= 0)
    .map(([symbol]) => symbol);
}

export function getRegistry(): Registry {
  return registry;
}
