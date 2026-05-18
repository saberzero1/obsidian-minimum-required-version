import ts from "typescript";

type SymbolKind =
  | "class"
  | "interface"
  | "type"
  | "function"
  | "variable"
  | "method"
  | "property";

type SymbolEntry = {
  since: string;
  kind: SymbolKind;
  overloads?: { discriminant: string; since: string }[];
};

type Registry = {
  generatedFrom: string;
  generatedAt: string;
  symbols: Record<string, SymbolEntry>;
};

type ApiNode = {
  $since: string;
  $kind: SymbolKind;
  $key: string;
  members: Map<string, ApiNode>;
  overloads: Map<string, { $since: string; $key: string }>;
  isStatic?: boolean;
};

type MethodInfo = {
  since: string;
  overloads: { discriminant: string; since: string }[];
};

const repoRoot = ts.sys.getCurrentDirectory();
const obsidianDtsPath = `${repoRoot}/node_modules/obsidian/obsidian.d.ts`;
const obsidianPackageJsonPath = `${repoRoot}/node_modules/obsidian/package.json`;
const registryOutputPath = `${repoRoot}/src/registry.json`;
const generatedOutputPath = `${repoRoot}/src/generated.ts`;

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map((part) => Number(part));
  const bParts = b.split(".").map((part) => Number(part));
  const maxLength = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLength; i += 1) {
    const left = aParts[i] ?? 0;
    const right = bParts[i] ?? 0;
    if (left > right) {
      return 1;
    }
    if (left < right) {
      return -1;
    }
  }
  return 0;
}

function getSinceTag(node: ts.Node): string | undefined {
  const tags = ts.getJSDocTags(node);
  const sinceTag = tags.find((tag) => tag.tagName.getText() === "since");
  if (!sinceTag || sinceTag.comment == null) {
    return undefined;
  }

  if (typeof sinceTag.comment === "string") {
    return sinceTag.comment.trim();
  }

  return sinceTag.comment
    .map((part) => part.text)
    .join("")
    .trim();
}

function isExported(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  return (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );
}

function getMemberName(
  name: ts.PropertyName | ts.BindingName | undefined,
): string | undefined {
  if (!name) {
    return undefined;
  }
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isStringLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function getDiscriminant(method: ts.MethodDeclaration): string | undefined {
  const firstParameter = method.parameters[0];
  const paramType = firstParameter?.type;
  if (!paramType || !ts.isLiteralTypeNode(paramType)) {
    return undefined;
  }

  if (ts.isStringLiteral(paramType.literal)) {
    return paramType.literal.text;
  }

  return undefined;
}

function quoteString(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${escaped}'`;
}

function isValidIdentifier(name: string): boolean {
  return /^[$A-Z_][0-9A-Z_$]*$/i.test(name);
}

function formatPropertyName(name: string): string {
  return isValidIdentifier(name) ? name : quoteString(name);
}

function createNode(
  entry: SymbolEntry,
  key: string,
  isStatic?: boolean,
): ApiNode {
  return {
    $since: entry.since,
    $kind: entry.kind,
    $key: key,
    members: new Map(),
    overloads: new Map(),
    isStatic,
  };
}

function serializeNode(node: ApiNode, indentLevel: number): string {
  const indent = "  ".repeat(indentLevel);
  const innerIndent = "  ".repeat(indentLevel + 1);
  const lines: string[] = [];
  lines.push("{");
  lines.push(`${innerIndent}$since: ${quoteString(node.$since)},`);
  lines.push(`${innerIndent}$kind: ${quoteString(node.$kind)},`);
  lines.push(`${innerIndent}$key: ${quoteString(node.$key)},`);

  if (node.overloads.size > 0) {
    const overloadEntries = Array.from(node.overloads.entries()).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    for (const [discriminant, overload] of overloadEntries) {
      const prop = formatPropertyName(discriminant);
      lines.push(
        `${innerIndent}${prop}: { $since: ${quoteString(overload.$since)}, $key: ${quoteString(overload.$key)} },`,
      );
    }
  }

  if (node.members.size > 0) {
    const memberEntries = Array.from(node.members.entries()).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    for (const [memberName, member] of memberEntries) {
      const prop = formatPropertyName(memberName);
      lines.push(
        `${innerIndent}${prop}: ${serializeNode(member, indentLevel + 1)},`,
      );
    }
  }

  lines.push(`${indent}}`);
  return lines.join("\n");
}

function buildGeneratedSource(
  sortedSymbols: Record<string, SymbolEntry>,
): string {
  const apiSymbols: string[] = [];
  const apiNodes = new Map<string, ApiNode>();

  for (const [symbol, entry] of Object.entries(sortedSymbols)) {
    apiSymbols.push(symbol);
    if (entry.overloads) {
      for (const overload of entry.overloads) {
        apiSymbols.push(`${symbol}:${overload.discriminant}`);
      }
    }
  }

  apiSymbols.sort((left, right) => left.localeCompare(right));

  for (const [symbol, entry] of Object.entries(sortedSymbols)) {
    if (!symbol.includes(".")) {
      apiNodes.set(symbol, createNode(entry, symbol));
    }
  }

  for (const [symbol, entry] of Object.entries(sortedSymbols)) {
    const prototypeIndex = symbol.indexOf(".prototype.");
    if (prototypeIndex !== -1) {
      const className = symbol.slice(0, prototypeIndex);
      const memberName = symbol.slice(prototypeIndex + ".prototype.".length);
      const parentEntry = sortedSymbols[className];
      const parent =
        apiNodes.get(className) ?? createNode(parentEntry ?? entry, className);
      if (!apiNodes.has(className)) {
        apiNodes.set(className, parent);
      }
      const member = createNode(entry, symbol, false);
      if (entry.overloads) {
        for (const overload of entry.overloads) {
          member.overloads.set(overload.discriminant, {
            $since: overload.since,
            $key: `${symbol}:${overload.discriminant}`,
          });
        }
      }
      const existing = parent.members.get(memberName);
      if (!existing || (member.isStatic && !existing.isStatic)) {
        parent.members.set(memberName, member);
      }
      continue;
    }

    const dotIndex = symbol.indexOf(".");
    if (dotIndex !== -1) {
      const className = symbol.slice(0, dotIndex);
      const memberName = symbol.slice(dotIndex + 1);
      const parentEntry = sortedSymbols[className];
      const parent =
        apiNodes.get(className) ?? createNode(parentEntry ?? entry, className);
      if (!apiNodes.has(className)) {
        apiNodes.set(className, parent);
      }
      const member = createNode(entry, symbol, true);
      if (entry.overloads) {
        for (const overload of entry.overloads) {
          member.overloads.set(overload.discriminant, {
            $since: overload.since,
            $key: `${symbol}:${overload.discriminant}`,
          });
        }
      }
      const existing = parent.members.get(memberName);
      if (!existing || (member.isStatic && !existing.isStatic)) {
        parent.members.set(memberName, member);
      }
    }
  }

  const topLevelEntries = Array.from(apiNodes.entries()).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  const obsidianApiLines: string[] = [];
  obsidianApiLines.push("export const obsidianApi = {");
  for (const [name, node] of topLevelEntries) {
    obsidianApiLines.push(
      `  ${formatPropertyName(name)}: ${serializeNode(node, 1)},`,
    );
  }
  obsidianApiLines.push("} as const;");

  const apiSymbolLines: string[] = [];
  apiSymbolLines.push("export type ApiSymbol =");
  for (const symbol of apiSymbols) {
    apiSymbolLines.push(`  | ${quoteString(symbol)}`);
  }
  apiSymbolLines.push("  ;");

  return [
    "// Auto-generated by scripts/extract-registry.ts — do not edit manually.",
    "",
    "export type ApiNode = { readonly $key: string; readonly $since: string };",
    "",
    ...apiSymbolLines,
    "",
    ...obsidianApiLines,
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const packageJsonText = ts.sys.readFile(obsidianPackageJsonPath);
  if (!packageJsonText) {
    throw new Error("Failed to read obsidian package.json");
  }
  const packageJson = JSON.parse(packageJsonText) as { version: string };
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  };
  const host = ts.createCompilerHost(compilerOptions);
  host.getSourceFile = (fileName, languageVersion) => {
    const sourceText = ts.sys.readFile(fileName);
    if (sourceText == null) {
      return undefined;
    }
    return ts.createSourceFile(fileName, sourceText, languageVersion, true);
  };

  const program = ts.createProgram([obsidianDtsPath], compilerOptions, host);
  const sourceFile = program.getSourceFile(obsidianDtsPath);
  if (!sourceFile) {
    throw new Error("Failed to load obsidian.d.ts");
  }

  const symbols = new Map<string, SymbolEntry>();
  const methodEntries = new Map<string, MethodInfo>();

  function recordSymbol(name: string, entry: SymbolEntry): void {
    if (symbols.has(name)) {
      return;
    }
    symbols.set(name, entry);
  }

  function recordMethod(
    name: string,
    since: string,
    overload?: { discriminant: string; since: string },
  ): void {
    const existing = methodEntries.get(name);
    const overloads = existing?.overloads ?? [];
    const nextSince = existing
      ? compareVersions(existing.since, since) >= 0
        ? existing.since
        : since
      : since;
    if (overload) {
      overloads.push(overload);
    }
    methodEntries.set(name, { since: nextSince, overloads });
  }

  function handleClassMembers(
    className: string,
    members: ts.NodeArray<ts.ClassElement>,
  ): void {
    for (const member of members) {
      if (ts.isConstructorDeclaration(member)) {
        continue;
      }

      const since = getSinceTag(member);
      if (!since) {
        continue;
      }

      const memberName = getMemberName(member.name);
      if (!memberName) {
        continue;
      }

      const isStatic =
        (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) !== 0;
      const qualifiedName = isStatic
        ? `${className}.${memberName}`
        : `${className}.prototype.${memberName}`;

      if (ts.isMethodDeclaration(member)) {
        const discriminant = getDiscriminant(member);
        if (discriminant) {
          recordMethod(qualifiedName, since, { discriminant, since });
          continue;
        }

        recordMethod(qualifiedName, since);
        continue;
      }

      if (ts.isPropertyDeclaration(member)) {
        recordSymbol(qualifiedName, { since, kind: "property" });
      }
    }
  }

  function visit(node: ts.Node): void {
    if (
      ts.isModuleDeclaration(node) &&
      (node.flags & ts.NodeFlags.GlobalAugmentation) !== 0
    ) {
      return;
    }

    if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) {
      const since = getSinceTag(node);
      if (since) {
        recordSymbol(node.name.text, { since, kind: "function" });
      }
    }

    if (ts.isVariableStatement(node) && isExported(node)) {
      const statementSince = getSinceTag(node);
      for (const declaration of node.declarationList.declarations) {
        const name = getMemberName(declaration.name);
        if (!name) {
          continue;
        }
        const since = statementSince ?? getSinceTag(declaration);
        if (since) {
          recordSymbol(name, { since, kind: "variable" });
        }
      }
    }

    if (ts.isClassDeclaration(node) && node.name && isExported(node)) {
      const since = getSinceTag(node);
      if (since) {
        recordSymbol(node.name.text, { since, kind: "class" });
      }
      handleClassMembers(node.name.text, node.members);
    }

    if (ts.isInterfaceDeclaration(node) && node.name && isExported(node)) {
      const since = getSinceTag(node);
      if (since) {
        recordSymbol(node.name.text, { since, kind: "interface" });
      }
    }

    if (ts.isTypeAliasDeclaration(node) && node.name && isExported(node)) {
      const since = getSinceTag(node);
      if (since) {
        recordSymbol(node.name.text, { since, kind: "type" });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  for (const [name, info] of methodEntries) {
    const overloads = info.overloads.sort((left, right) =>
      left.discriminant.localeCompare(right.discriminant),
    );
    const entry: SymbolEntry = overloads.length
      ? { since: info.since, kind: "method", overloads }
      : { since: info.since, kind: "method" };
    recordSymbol(name, entry);
  }

  const sortedSymbols = Object.fromEntries(
    Array.from(symbols.entries()).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );

  const versionSet = new Set<string>();
  for (const entry of Object.values(sortedSymbols)) {
    versionSet.add(entry.since);
    entry.overloads?.forEach((overload) => versionSet.add(overload.since));
  }

  const registry: Registry = {
    generatedFrom: `obsidian@${packageJson.version}`,
    generatedAt: new Date().toISOString(),
    symbols: sortedSymbols,
  };

  ts.sys.writeFile(
    registryOutputPath,
    `${JSON.stringify(registry, null, 2)}\n`,
  );
  ts.sys.writeFile(generatedOutputPath, buildGeneratedSource(sortedSymbols));
  console.log(
    `Extracted ${Object.keys(sortedSymbols).length} symbols across ${versionSet.size} versions from obsidian@${packageJson.version}`,
  );
}

void main();
