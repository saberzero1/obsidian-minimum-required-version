import fs from "node:fs";
import path from "node:path";

export function findManifestJson(startDir: string): string | undefined {
  const root = path.parse(startDir).root;
  let current = startDir;

  while (true) {
    const candidate = path.join(current, "manifest.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    if (current === root) {
      return undefined;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

export function readMinAppVersion(manifestPath: string): string | undefined {
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const data = JSON.parse(raw) as { minAppVersion?: string };
    if (typeof data.minAppVersion === "string") {
      return data.minAppVersion;
    }
  } catch {
    return undefined;
  }

  return undefined;
}
