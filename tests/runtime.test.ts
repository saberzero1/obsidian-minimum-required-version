import { describe, expect, it, vi } from "vitest";

vi.mock("../src/obsidian-runtime.js", () => ({
  getObsidianRuntime: () => ({
    requireApiVersion: (version: string) => {
      const current = [1, 5, 0];
      const requested = version.split(".").map(Number);
      for (let i = 0; i < 3; i += 1) {
        if (current[i] > requested[i]) {
          return true;
        }
        if (current[i] < requested[i]) {
          return false;
        }
      }
      return true;
    },
    apiVersion: "1.5.0",
  }),
}));

const { ifApisAvailable, requireApis } = await import("../src/runtime.js");
const { obsidianApi } = await import("../src/generated.js");

describe("requireApis", () => {
  it("returns highest version across symbols", () => {
    expect(requireApis(["App.prototype.vault", "Workspace.prototype.on"])).toBe(
      "1.5.1",
    );
  });

  it("throws for unknown symbol", () => {
    expect(() => requireApis(["NonExistent"])).toThrow("Unknown API symbol");
  });

  it("works with single symbol", () => {
    expect(requireApis(["App"])).toBe("0.9.7");
  });
});

describe("ifApisAvailable", () => {
  it("calls execute when all APIs available", () => {
    const execute = vi.fn(() => "ok");
    const fallback = vi.fn(() => "fallback");

    const result = ifApisAvailable(["App"], execute, fallback);

    expect(result).toBe("ok");
    expect(execute).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("calls fallback when API not available", () => {
    const execute = vi.fn(() => "ok");
    const fallback = vi.fn(() => "fallback");

    const result = ifApisAvailable(
      ["Workspace.prototype.on"],
      execute,
      fallback,
    );

    expect(result).toBe("fallback");
    expect(execute).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("returns undefined when no fallback and API not available", () => {
    const execute = vi.fn(() => "ok");

    const result = ifApisAvailable(["Workspace.prototype.on"], execute);

    expect(result).toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns execute result", () => {
    const execute = vi.fn(() => 42);

    const result = ifApisAvailable(["App"], execute);

    expect(result).toBe(42);
  });
});

describe("requireApis with ApiNode", () => {
  it("accepts ApiNode array", () => {
    expect(requireApis([obsidianApi.App])).toBe("0.9.7");
  });

  it("returns highest version from mixed ApiNode array", () => {
    const result = requireApis([obsidianApi.App, obsidianApi.Workspace.on]);
    expect(result).toBe("1.5.1");
  });
});

describe("ifApisAvailable with ApiNode", () => {
  it("calls execute when ApiNode APIs are available", () => {
    const execute = vi.fn(() => "ok");
    const result = ifApisAvailable([obsidianApi.App], execute);
    expect(result).toBe("ok");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("calls fallback when ApiNode API is not available", () => {
    const execute = vi.fn(() => "ok");
    const fallback = vi.fn(() => "fallback");
    const result = ifApisAvailable(
      [obsidianApi.Workspace.on],
      execute,
      fallback,
    );
    expect(result).toBe("fallback");
    expect(execute).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
