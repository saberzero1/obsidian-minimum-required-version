import { describe, expect, it } from "vitest";

import {
  getAllSymbols,
  getMinVersion,
  getMinVersionForOverload,
  getRegistry,
  getSymbolsForVersion,
  getSymbolsRequiringAtLeast,
  sinceOf,
  keyOf,
} from "../src/registry.js";
import { compareVersions } from "../src/version.js";
import { obsidianApi } from "../src/generated.js";

describe("getMinVersion", () => {
  it("returns version for known symbol", () => {
    expect(getMinVersion("App")).toBe("0.9.7");
  });

  it("returns undefined for unknown symbol", () => {
    expect(getMinVersion("NonExistent")).toBeUndefined();
  });

  it("returns highest version for overloaded method without discriminant", () => {
    expect(getMinVersion("Workspace.prototype.on")).toBe("1.5.1");
  });

  it("returns specific overload version with colon syntax", () => {
    expect(getMinVersion("Workspace.prototype.on:files-menu")).toBe("1.4.10");
  });
});

describe("getMinVersionForOverload", () => {
  it("returns version for valid overload", () => {
    expect(
      getMinVersionForOverload("Workspace.prototype.on", "css-change"),
    ).toBe("0.9.7");
  });

  it("returns undefined for non-existent discriminant", () => {
    expect(
      getMinVersionForOverload("Workspace.prototype.on", "nonexistent"),
    ).toBeUndefined();
  });

  it("returns undefined for symbol without overloads", () => {
    expect(getMinVersionForOverload("App", "anything")).toBeUndefined();
  });
});

describe("getAllSymbols", () => {
  it("returns array of all symbol keys", () => {
    const symbols = getAllSymbols();
    expect(Array.isArray(symbols)).toBe(true);
  });

  it("has length >= 500", () => {
    expect(getAllSymbols().length).toBeGreaterThanOrEqual(500);
  });
});

describe("getSymbolsForVersion", () => {
  it("returns symbols for specific version", () => {
    const symbols = getSymbolsForVersion("0.9.7");
    expect(symbols).toContain("App");
  });

  it("returns empty array for nonexistent version", () => {
    expect(getSymbolsForVersion("99.99.99")).toEqual([]);
  });
});

describe("getSymbolsRequiringAtLeast", () => {
  it("returns symbols at or above version", () => {
    const symbols = getSymbolsRequiringAtLeast("1.5.0");
    const registry = getRegistry();
    expect(symbols.length).toBeGreaterThan(0);
    for (const symbol of symbols) {
      const since = registry.symbols[symbol]?.since;
      expect(since).toBeDefined();
      if (since) {
        expect(compareVersions(since, "1.5.0")).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("returns empty for version higher than any", () => {
    expect(getSymbolsRequiringAtLeast("99.99.99")).toEqual([]);
  });
});

describe("getRegistry", () => {
  it("returns frozen registry object", () => {
    expect(Object.isFrozen(getRegistry())).toBe(true);
  });

  it("has generatedFrom matching obsidian@X.Y.Z pattern", () => {
    const registry = getRegistry();
    expect(registry.generatedFrom).toMatch(/^obsidian@\d+\.\d+\.\d+$/);
  });
});

describe("getMinVersion with ApiNode", () => {
  it("accepts an ApiNode for a class", () => {
    expect(getMinVersion(obsidianApi.App)).toBe("0.9.7");
  });

  it("accepts an ApiNode for an instance member", () => {
    expect(getMinVersion(obsidianApi.App.vault)).toBe(
      getMinVersion("App.prototype.vault"),
    );
  });

  it("accepts an ApiNode for an overloaded method", () => {
    expect(getMinVersion(obsidianApi.Workspace.on)).toBe("1.5.1");
  });
});

describe("sinceOf", () => {
  it("extracts $since from a class ApiNode", () => {
    expect(sinceOf(obsidianApi.App)).toBe("0.9.7");
  });

  it("extracts $since from a member ApiNode", () => {
    expect(sinceOf(obsidianApi.Workspace.on["files-menu"])).toBe("1.4.10");
  });
});

describe("keyOf", () => {
  it("extracts $key from a class ApiNode", () => {
    expect(keyOf(obsidianApi.App)).toBe("App");
  });

  it("maps flat namespace to registry key for instance members", () => {
    expect(keyOf(obsidianApi.App.vault)).toBe("App.prototype.vault");
  });

  it("maps flat namespace to registry key for overload discriminants", () => {
    expect(keyOf(obsidianApi.Workspace.on["files-menu"])).toBe(
      "Workspace.prototype.on:files-menu",
    );
  });
});

describe("obsidianApi namespace", () => {
  it("has $since, $kind, $key on class nodes", () => {
    expect(obsidianApi.App.$since).toBeDefined();
    expect(obsidianApi.App.$kind).toBe("class");
    expect(obsidianApi.App.$key).toBe("App");
  });

  it("has flat member access without prototype nesting", () => {
    expect(obsidianApi.Vault.append).toBeDefined();
    expect(obsidianApi.Vault.append.$key).toBe("Vault.prototype.append");
  });

  it("has overload discriminants as nested properties", () => {
    expect(obsidianApi.Workspace.on["files-menu"]).toBeDefined();
    expect(obsidianApi.Workspace.on["files-menu"].$since).toBeDefined();
    expect(obsidianApi.Workspace.on["files-menu"].$key).toBe(
      "Workspace.prototype.on:files-menu",
    );
  });
});
