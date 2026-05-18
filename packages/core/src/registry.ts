import registryData from "./registry.json";
import type { Registry } from "./types.js";
import { compareVersions } from "./version.js";
import { getObsidianRuntime } from "./obsidian-runtime.js";

const registry: Registry = Object.freeze(registryData) as Registry;

export function getMinVersion(symbol: string): string | undefined {
  const delimiterIndex = symbol.indexOf(":");
  if (delimiterIndex !== -1) {
    const baseSymbol = symbol.slice(0, delimiterIndex);
    const discriminant = symbol.slice(delimiterIndex + 1);
    return getMinVersionForOverload(baseSymbol, discriminant);
  }

  return registry.symbols[symbol]?.since;
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

export function isAvailable(symbol: string): boolean {
  const minVersion = getMinVersion(symbol);
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
