import { RuleTester } from "@typescript-eslint/rule-tester";
import { fileURLToPath } from "node:url";
import * as vitest from "vitest";
import rule from "../src/rules/require-min-version.js";

RuleTester.afterAll = vitest.afterAll;
RuleTester.describe = vitest.describe;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;

const manifest10 = fileURLToPath(
  new URL("./fixtures/manifest-1.0.0.json", import.meta.url),
);

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
});

ruleTester.run("require-min-version", rule, {
  valid: [
    {
      code: `
        import { App } from 'obsidian';

        const app: App = {} as App;
        app.vault;
      `,
      options: [{ manifestPath: manifest10 }],
    },
    {
      code: `
        const vault = { append() {} };
        vault.append();
      `,
      options: [{ manifestPath: manifest10 }],
    },
    {
      code: `
        import { Workspace, requireApiVersion } from 'obsidian';

        const workspace: Workspace = {} as Workspace;
        if (requireApiVersion('1.5.1')) {
          workspace.on('layout-change', () => {});
        }
      `,
      options: [{ manifestPath: manifest10 }],
    },
  ],
  invalid: [
    {
      code: `
        import { Workspace } from 'obsidian';

        const workspace: Workspace = {} as Workspace;
        workspace.on('layout-change', () => {});
      `,
      options: [{ manifestPath: manifest10 }],
      errors: [
        {
          messageId: "apiTooNew",
          data: {
            symbol: "Workspace.prototype.on",
            version: "1.5.1",
            minAppVersion: "1.0.0",
          },
        },
      ],
    },
    {
      code: `
        import { App, Workspace } from 'obsidian';

        const app: App = {} as App;
        const workspace: Workspace = {} as Workspace;
        app.vault;
        workspace.on('layout-change', () => {});
      `,
      options: [{ manifestPath: manifest10 }],
      errors: [
        {
          messageId: "apiTooNew",
          data: {
            symbol: "Workspace.prototype.on",
            version: "1.5.1",
            minAppVersion: "1.0.0",
          },
        },
      ],
    },
  ],
});
