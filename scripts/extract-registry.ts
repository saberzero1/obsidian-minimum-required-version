import * as ts from "typescript";

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

type MethodInfo = {
  since: string;
  overloads: { discriminant: string; since: string }[];
};

const repoRoot = ts.sys.getCurrentDirectory();
const obsidianDtsPath = `${repoRoot}/node_modules/obsidian/obsidian.d.ts`;
const obsidianPackageJsonPath = `${repoRoot}/node_modules/obsidian/package.json`;
const registryOutputPath = `${repoRoot}/packages/core/src/registry.json`;

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
  console.log(
    `Extracted ${Object.keys(sortedSymbols).length} symbols across ${versionSet.size} versions from obsidian@${packageJson.version}`,
  );
}

void main();
