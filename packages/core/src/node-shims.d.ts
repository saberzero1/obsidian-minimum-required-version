declare module "node:module" {
  export function createRequire(metaUrl: string): (id: string) => unknown;
}

declare const __filename: string | undefined;

declare const process: {
  cwd(): string;
};
