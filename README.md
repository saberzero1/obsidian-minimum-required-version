# obsidian-minimum-required-version

`obsidian-minimum-required-version` provides a programmatic way to map Obsidian API symbols to their minimum version requirements.

## Problem statement

The Obsidian API evolves across versions, frequently introducing new functions, classes, and properties. Developers need to know which version introduced a specific symbol to ensure compatibility with their plugin's `minAppVersion`. While the official `obsidian.d.ts` contains `@since` JSDoc tags, there's no built-in programmatic way to query this information at runtime or during build processes. This library bridges that gap by providing a typed registry and utility suite.

## How it works

This library extracts `@since` JSDoc annotations from the official `obsidian.d.ts` source and compiles them into a structured, typed registry. It tracks over 589 symbols across more than 60 versions of the Obsidian API. The registry is automatically updated to stay in sync with the latest API releases.

## Installation

```bash
npm install obsidian-minimum-required-version
```

## Quick Start

The library supports three main usage patterns depending on your needs for developer experience, runtime safety, or backward compatibility.

### Pattern A: Direct version access via namespace

This pattern provides the best developer experience with full TypeScript autocompletion. The `obsidianApi` object mirrors the Obsidian API structure but provides metadata about each symbol.

```typescript
import { obsidianApi } from "obsidian-minimum-required-version";

// Access the minimum version string directly
const minVersion = obsidianApi.Vault.append.$since; // '1.7.2'

// Access metadata for overloaded methods
const eventVersion = obsidianApi.Workspace.on["files-menu"].$since; // '1.4.10'
```

### Pattern B: Runtime conditional execution

Use the `ifApisAvailable` helper to safely execute code only when the required APIs are present in the current Obsidian environment.

```typescript
import {
  obsidianApi,
  ifApisAvailable,
} from "obsidian-minimum-required-version";

ifApisAvailable(
  [obsidianApi.Vault.append],
  () => {
    // This block runs only if Vault.append is available (Obsidian >= 1.7.2)
    app.vault.append(file, content);
  },
  () => {
    // Fallback for older versions
    const existing = await app.vault.read(file);
    await app.vault.modify(file, existing + content);
  },
);
```

### Pattern C: String-based lookup

For cases where you only have the symbol name as a string, use the `getMinVersion` function. This is useful for dynamic lookups or backward compatibility with older registry formats.

```typescript
import { getMinVersion } from "obsidian-minimum-required-version";

const version = getMinVersion("Vault.prototype.append"); // '1.7.2'
```

## API Reference: Namespace Object

### obsidianApi

The `obsidianApi` object is a flat namespace where instance and static members are accessible directly on their respective classes. This simplifies access compared to the internal registry format.

Each node in the namespace is an `ApiNode` containing:

- `$since`: The version string literal (e.g., `'1.7.2'`).
- `$kind`: The type of symbol (e.g., `'method'`, `'property'`, `'class'`).
- `$key`: The full registry key string (e.g., `'Vault.prototype.append'`).

Overloaded methods are represented as objects where sub-properties act as discriminants for each overload.

## API Reference: Lookup Functions

### getMinVersion(symbol)

Accepts an `ApiSymbol` string, a raw string, or an `ApiNode`. Returns the minimum version string or `undefined` if not found.

```typescript
function getMinVersion(
  symbol: ApiSymbol | string | ApiNode,
): string | undefined;
```

### getMinVersionForOverload(symbol, discriminant)

Returns the minimum version for a specific overload of a symbol.

```typescript
function getMinVersionForOverload(
  symbol: string,
  discriminant: string,
): string | undefined;
```

### isAvailable(symbol)

Performs a runtime check against the current Obsidian version to determine if the symbol is available.

```typescript
function isAvailable(symbol: ApiSymbol | string | ApiNode): boolean;
```

### getAllSymbols()

Returns an array of all known API symbols in the registry.

### getSymbolsForVersion(version)

Returns a list of symbols introduced in a specific Obsidian version.

### getSymbolsRequiringAtLeast(version)

Returns all symbols that require a version equal to or greater than the specified version.

### getRegistry()

Returns the raw registry object containing all symbol metadata.

### compareVersions(a, b)

A utility to compare two version strings. Returns `1` if `a > b`, `-1` if `a < b`, and `0` if they are equal.

### sinceOf(node)

Extracts the `$since` version from an `ApiNode`.

### keyOf(node)

Extracts the `$key` registry string from an `ApiNode`.

## API Reference: Runtime Helpers

### requireApis(symbols)

Accepts an array of `ApiSymbol` strings, raw strings, or `ApiNode` objects. Returns the highest minimum version required among all provided symbols. Throws if a symbol is unknown.

```typescript
function requireApis(symbols: (ApiSymbol | string | ApiNode)[]): string;
```

### ifApisAvailable(symbols, execute, fallback?)

Checks if all provided symbols are available in the current environment. If they are, it calls `execute`. Otherwise, it calls the optional `fallback`.

```typescript
function ifApisAvailable<T>(
  symbols: (ApiSymbol | string | ApiNode)[],
  execute: () => T,
  fallback?: () => T,
): T | undefined;
```

## Types

### ApiSymbol

A string literal union of all known symbols in the registry (e.g., `'Vault.prototype.append' | 'App.prototype.isDarkMode' | ...`).

### ApiNode

The structure used in the `obsidianApi` namespace.

```typescript
interface ApiNode {
  readonly $key: string;
  readonly $since: string;
  readonly $kind: string;
}
```

### Registry

The full registry structure.

```typescript
interface Registry {
  generatedFrom: string;
  generatedAt: string;
  symbols: Record<string, SymbolEntry>;
}
```

### SymbolEntry

Metadata for a single symbol.

```typescript
interface SymbolEntry {
  since: string;
  kind:
    | "class"
    | "interface"
    | "type"
    | "function"
    | "variable"
    | "method"
    | "property";
  overloads?: OverloadEntry[];
}
```

### OverloadEntry

Metadata for a specific method overload.

```typescript
interface OverloadEntry {
  discriminant: string;
  since: string;
}
```

## Symbol Naming Convention

The library uses a consistent naming convention for registry keys. Note that while the `obsidianApi` namespace uses flat access, the underlying registry keys use the full format.

| Symbol Type       | Format                             | Example                             |
| ----------------- | ---------------------------------- | ----------------------------------- |
| Class             | `ClassName`                        | `App`                               |
| Interface         | `InterfaceName`                    | `Command`                           |
| Type alias        | `TypeName`                         | `ViewStateResult`                   |
| Global function   | `functionName`                     | `addIcon`                           |
| Global variable   | `variableName`                     | `apiVersion`                        |
| Static method     | `ClassName.methodName`             | `Keymap.isModEvent`                 |
| Instance method   | `ClassName.prototype.methodName`   | `Vault.prototype.append`            |
| Instance property | `ClassName.prototype.propertyName` | `App.prototype.fileManager`         |
| Overload          | `SymbolName:discriminant`          | `Workspace.prototype.on:files-menu` |

## ESLint

For ESLint-based version checking, use the `obsidianmd/no-unsupported-api` rule from [`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin). It reads `@since` tags from the same `obsidian.d.ts` source and integrates with the TypeScript type checker for comprehensive detection. This ensures that your code remains compatible with your target Obsidian version during development.

## Registry Updates

The registry is maintained via an automated weekly GitHub Action. This process fetches the latest `obsidian.d.ts`, parses new `@since` annotations, and updates the registry and types to ensure they reflect the current state of the Obsidian API.

## Contributing

Contributions are welcome. To set up the project locally, use the following commands:

```bash
# Regenerate the registry and types from obsidian.d.ts
pnpm extract-registry

# Run the test suite
pnpm test

# Build the project
pnpm build

# Run type checking
pnpm typecheck
```

## License

Unlicense
