# obsidian-minimum-required-version

A comprehensive registry and utility suite for tracking the minimum Obsidian API version required for specific symbols.

## Problem Statement

The Obsidian API evolves over time, introducing new functions, classes, and properties in different versions. However, the `obsidian.d.ts` type definitions do not provide a programmatic way to check which version introduced a specific symbol. Developers often have to manually check the API changelog or risk their plugins crashing on older Obsidian installations when using newer features.

## How it Works

This project automatically extracts `@since` JSDoc annotations from the official `obsidian.d.ts` file into a static registry. This registry maps over 589 API symbols to their respective minimum required versions, covering 60 different Obsidian releases up to version 1.12.3.

## Packages

| Package                                           | Description                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `obsidian-minimum-required-version`               | Core registry and runtime utilities for version checking.                     |
| `eslint-plugin-obsidian-minimum-required-version` | ESLint rules to catch usage of APIs newer than your plugin's `minAppVersion`. |

## Installation

Install the core package:

```bash
npm install obsidian-minimum-required-version
```

Install the ESLint plugin:

```bash
npm install -D eslint-plugin-obsidian-minimum-required-version
```

## Core Package API Reference

### getMinVersion(symbol)

Returns the minimum version string for a given symbol. Returns `undefined` if the symbol is not in the registry.

```typescript
import { getMinVersion } from "obsidian-minimum-required-version";

const version = getMinVersion("Vault.prototype.append");
// '1.7.2'
```

### getMinVersionForOverload(symbol, discriminant)

Returns the minimum version for a specific overload of a symbol.

```typescript
import { getMinVersionForOverload } from "obsidian-minimum-required-version";

const version = getMinVersionForOverload(
  "Workspace.prototype.on",
  "files-menu",
);
// '1.4.10'
```

### isAvailable(symbol)

Checks if a symbol is available in the current Obsidian runtime environment.

```typescript
import { isAvailable } from "obsidian-minimum-required-version";

if (isAvailable("Vault.prototype.append")) {
  // Safe to use vault.append()
}
```

### getAllSymbols()

Returns an array of all symbols present in the registry.

### getSymbolsForVersion(version)

Returns all symbols that were introduced in a specific version.

### getSymbolsRequiringAtLeast(version)

Returns all symbols that require at least the specified version.

### getRegistry()

Returns the full raw registry object, including metadata about when and from which version it was generated.

### compareVersions(a, b)

A utility function to compare two version strings. Returns `1` if `a > b`, `-1` if `a < b`, and `0` if they are equal.

## Runtime Helpers

### requireApis(symbols)

Calculates the highest minimum version required among a list of symbols. Throws an error if any symbol is unknown.

```typescript
import { requireApis } from "obsidian-minimum-required-version";

const minVersion = requireApis([
  "Vault.prototype.append",
  "App.prototype.isDarkMode",
]);
// Returns the highest version required
```

### ifApisAvailable(symbols, execute, fallback?)

Executes a callback if all specified symbols are available in the current environment. Optionally executes a fallback if they are not.

```typescript
import { ifApisAvailable } from "obsidian-minimum-required-version";

ifApisAvailable(
  ["Vault.prototype.append"],
  () => this.app.vault.append(file, content),
  () => this.app.vault.modify(file, existingContent + content),
);
```

## Symbol Naming Convention

Symbols in the registry follow a specific naming convention to distinguish between different types of API members.

| Symbol Type           | Format                             | Example                             |
| --------------------- | ---------------------------------- | ----------------------------------- |
| Class                 | `ClassName`                        | `App`                               |
| Interface             | `InterfaceName`                    | `Command`                           |
| Type alias            | `TypeName`                         | `ViewStateResult`                   |
| Module-level function | `functionName`                     | `addIcon`                           |
| Module-level variable | `variableName`                     | `apiVersion`                        |
| Static method         | `ClassName.methodName`             | `Keymap.isModEvent`                 |
| Instance method       | `ClassName.prototype.methodName`   | `Vault.prototype.append`            |
| Instance property     | `ClassName.prototype.propertyName` | `App.prototype.fileManager`         |
| Overload (granular)   | `SymbolName:discriminant`          | `Workspace.prototype.on:files-menu` |

## ESLint Plugin

The ESLint plugin helps you ensure that your code doesn't use APIs that are newer than the `minAppVersion` specified in your `manifest.json`.

### Installation

```bash
npm install -D eslint-plugin-obsidian-minimum-required-version
```

### Setup

Add the plugin to your `eslint.config.js` (Flat Config):

```javascript
import obsidianVersionPlugin from "eslint-plugin-obsidian-minimum-required-version";

export default [
  obsidianVersionPlugin.configs.recommended,
  // or for type-checked projects:
  // obsidianVersionPlugin.configs.recommendedTypeChecked,
];
```

### Detection

The plugin detects usage of symbols that require a higher version than your manifest's `minAppVersion`.

```typescript
// If manifest.json has "minAppVersion": "1.5.0"
this.app.vault.append(file, content);
// ESLint Error: 'Vault.prototype.append' requires Obsidian 1.7.2, but minAppVersion is 1.5.0
```

### Rule Options

The `require-min-version` rule accepts an optional `manifestPath` if your `manifest.json` is not in the project root.

```javascript
{
  rules: {
    'obsidian-minimum-required-version/require-min-version': [
      'error',
      { manifestPath: './plugin/manifest.json' }
    ]
  }
}
```

### Configs

- `recommended`: Basic checks based on property names and global variables.
- `recommendedTypeChecked`: More accurate checks using TypeScript type information to resolve symbols.

## Registry Updates

The registry is kept in sync with the official Obsidian API through an automated GitHub Action. This action runs weekly, checking for new releases of the `obsidian` npm package, extracting new `@since` tags, and submitting a pull request if updates are found.

## Contributing

To contribute to the project, you can run the following commands:

Regenerate the registry from the current `obsidian` package:

```bash
pnpm extract-registry
```

Run tests:

```bash
pnpm test
```

Build all packages:

```bash
pnpm build
```

Type-check all packages:

```bash
pnpm typecheck
```

## License

Unlicense
