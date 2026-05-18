import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import registry from "../src/registry.json";
import type { Registry } from "../src/types.js";
import { obsidianApi } from "../src/generated.js";

const typedRegistry = registry as unknown as Registry;

describe("extraction snapshot", () => {
  it("contains expected symbol and version counts", () => {
    const symbols = Object.keys(typedRegistry.symbols);
    const versions = new Set<string>();

    for (const entry of Object.values(typedRegistry.symbols)) {
      versions.add(entry.since);
      entry.overloads?.forEach((overload) => versions.add(overload.since));
    }

    expect(symbols.length).toBeGreaterThanOrEqual(500);
    expect(versions.size).toBeGreaterThanOrEqual(50);
  });

  it("includes spot-checks for known symbols and overloads", () => {
    const app = typedRegistry.symbols.App;
    expect(app).toBeDefined();
    expect(app?.since).toBe("0.9.7");
    expect(app?.kind).toBe("class");

    const workspaceOn = typedRegistry.symbols["Workspace.prototype.on"];
    expect(workspaceOn).toBeDefined();
    expect(workspaceOn?.since).toBe("1.5.1");
    expect(workspaceOn?.overloads?.length).toBeGreaterThan(0);

    const overloads = workspaceOn?.overloads ?? [];
    const filesMenu = overloads.find(
      (overload) => overload.discriminant === "files-menu",
    );
    const cssChange = overloads.find(
      (overload) => overload.discriminant === "css-change",
    );

    expect(filesMenu?.since).toBe("1.4.10");
    expect(cssChange?.since).toBe("0.9.7");
  });
});

describe("generated.ts", () => {
  it("file exists", () => {
    expect(existsSync("src/generated.ts")).toBe(true);
  });

  it("exports obsidianApi with known classes", () => {
    expect(obsidianApi.App).toBeDefined();
    expect(obsidianApi.Vault).toBeDefined();
    expect(obsidianApi.Workspace).toBeDefined();
  });

  it("obsidianApi values match registry data", () => {
    expect(obsidianApi.App.$since).toBe(typedRegistry.symbols["App"]?.since);
    expect(obsidianApi.Workspace.on.$since).toBe(
      typedRegistry.symbols["Workspace.prototype.on"]?.since,
    );
  });
});
