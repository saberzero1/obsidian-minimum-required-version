import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import type { Type } from "typescript";
import {
  compareVersions,
  getMinVersion,
} from "obsidian-minimum-required-version";
import path from "node:path";
import { findManifestJson, readMinAppVersion } from "../utils.js";

type Options = [
  {
    manifestPath?: string;
  },
];

type MessageIds = "apiTooNew";

const createRule = ESLintUtils.RuleCreator(
  () => "https://github.com/saberzero1/obsidian-minimum-required-version",
);

function normalizeTypeName(typeName: string): string {
  if (typeName.startsWith('import("obsidian").')) {
    return typeName.replace(/^import\("obsidian"\)\./, "");
  }

  return typeName.replace(/^typeof\s+/, "");
}

function extractTypeNameFromTypeNode(
  node: TSESTree.TypeNode,
): string | undefined {
  if (node.type === "TSUnionType") {
    for (const type of node.types) {
      const candidate = extractTypeNameFromTypeNode(type);
      if (candidate) {
        return candidate;
      }
    }
    return undefined;
  }

  if (node.type !== "TSTypeReference") {
    return undefined;
  }

  if (node.typeName.type === "Identifier") {
    return node.typeName.name;
  }

  if (node.typeName.type === "TSQualifiedName") {
    return node.typeName.right.name;
  }

  return undefined;
}

function extractTypeNameFromAnnotation(
  annotation: TSESTree.TSTypeAnnotation | undefined,
): string | undefined {
  if (!annotation) {
    return undefined;
  }

  return extractTypeNameFromTypeNode(annotation.typeAnnotation);
}

export default createRule<Options, MessageIds>({
  name: "require-min-version",
  meta: {
    type: "problem",
    docs: {
      description:
        "Warn when Obsidian APIs used in code exceed minAppVersion in manifest.json",
    },
    schema: [
      {
        type: "object",
        properties: {
          manifestPath: {
            type: "string",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      apiTooNew:
        "'{{symbol}}' requires Obsidian >=={{version}}, but minAppVersion is {{minAppVersion}}. Update minAppVersion in manifest.json or guard with requireApiVersion(\"{{version}}\").",
    },
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const filename = context.getFilename();
    const startDir =
      filename && filename !== "<input>" && filename !== "<text>"
        ? path.dirname(filename)
        : process.cwd();
    const manifestPath = options?.manifestPath ?? findManifestJson(startDir);
    const minAppVersion = manifestPath
      ? readMinAppVersion(manifestPath)
      : undefined;
    if (!minAppVersion) {
      return {};
    }

    const obsidianImports = new Map<string, string>();
    const annotatedTypes = new Map<string, string>();
    const parserServices = ESLintUtils.getParserServices(context, true);
    const checker = parserServices.program?.getTypeChecker();

    const obsidianTypeNames = new Set<string>();

    const recordObsidianTypeName = (typeName: string) => {
      const normalized = normalizeTypeName(typeName);
      obsidianTypeNames.add(normalized);
    };

    const addAnnotatedType = (name: string, typeName: string | undefined) => {
      if (!typeName) {
        return;
      }

      const imported = obsidianImports.get(typeName);
      if (imported) {
        annotatedTypes.set(name, imported);
      }
    };

    const getObsidianTypeFromType = (type: Type): string | undefined => {
      if (!checker) {
        return undefined;
      }

      const symbol = type.getSymbol();
      if (symbol) {
        const symbolName = normalizeTypeName(symbol.getName());
        if (obsidianTypeNames.has(symbolName)) {
          return symbolName;
        }
      }

      const typeString = normalizeTypeName(checker.typeToString(type));
      const parts = typeString
        .split("|")
        .flatMap((part) => part.split("&"))
        .map((part) => part.trim())
        .filter(Boolean);

      for (const part of parts) {
        const base = normalizeTypeName(part).split("<")[0]?.trim() ?? "";
        if (obsidianTypeNames.has(base)) {
          return base;
        }
      }

      return undefined;
    };

    const getObsidianTypeFromExpression = (
      expression: TSESTree.Expression,
    ): string | undefined => {
      if (!checker || !parserServices.program) {
        return undefined;
      }

      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(expression);
      const type = checker.getTypeAtLocation(tsNode);

      if (type.isUnion()) {
        for (const subType of type.types) {
          const name = getObsidianTypeFromType(subType);
          if (name) {
            return name;
          }
        }
        return undefined;
      }

      return getObsidianTypeFromType(type);
    };

    const isRequireApiVersionCall = (
      node: TSESTree.CallExpression,
    ): boolean => {
      if (node.callee.type !== "Identifier") {
        return false;
      }

      const imported = obsidianImports.get(node.callee.name);
      return imported === "requireApiVersion";
    };

    const guardRanges: Array<[number, number]> = [];

    const getGuardRange = (
      node: TSESTree.IfStatement,
    ): [number, number] | undefined => {
      if (!node.consequent.range) {
        return undefined;
      }

      const test = node.test;
      const call =
        test.type === "CallExpression"
          ? test
          : test.type === "ChainExpression" &&
              test.expression.type === "CallExpression"
            ? test.expression
            : undefined;

      if (!call || !isRequireApiVersionCall(call)) {
        return undefined;
      }

      const firstArg = call.arguments[0];
      if (!firstArg || firstArg.type !== "Literal") {
        return undefined;
      }

      return node.consequent.range;
    };

    const isGuardedByRequireApiVersion = (node: TSESTree.Node): boolean => {
      if (!node.range) {
        return false;
      }

      return guardRanges.some(
        ([start, end]) => node.range![0] >= start && node.range![1] <= end,
      );
    };

    const reportIfTooNew = (node: TSESTree.Node, symbol: string) => {
      if (isGuardedByRequireApiVersion(node)) {
        return;
      }

      const requiredVersion = getMinVersion(symbol);
      if (!requiredVersion) {
        return;
      }

      if (compareVersions(requiredVersion, minAppVersion) === 1) {
        context.report({
          node,
          messageId: "apiTooNew",
          data: {
            symbol,
            version: requiredVersion,
            minAppVersion,
          },
        });
      }
    };

    const reportMemberExpression = (node: TSESTree.MemberExpression) => {
      if (node.computed || node.property.type !== "Identifier") {
        return;
      }

      let typeName: string | undefined;

      if (node.object.type === "Identifier") {
        typeName = annotatedTypes.get(node.object.name);
      }

      if (!typeName) {
        typeName = getObsidianTypeFromExpression(
          node.object as TSESTree.Expression,
        );
      }

      if (!typeName) {
        return;
      }

      reportIfTooNew(node, `${typeName}.prototype.${node.property.name}`);
    };

    return {
      IfStatement(node) {
        const range = getGuardRange(node);
        if (range) {
          guardRanges.push(range);
        }
      },
      "IfStatement:exit"(node) {
        const range = getGuardRange(node);
        if (range) {
          guardRanges.pop();
        }
      },
      ImportDeclaration(node) {
        if (node.source.value !== "obsidian") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") {
            continue;
          }

          if (specifier.imported.type !== "Identifier") {
            continue;
          }

          obsidianImports.set(specifier.local.name, specifier.imported.name);
          recordObsidianTypeName(specifier.imported.name);
          recordObsidianTypeName(specifier.local.name);
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier") {
          return;
        }

        const typeName = extractTypeNameFromAnnotation(node.id.typeAnnotation);
        addAnnotatedType(node.id.name, typeName);
      },
      FunctionDeclaration(node) {
        for (const param of node.params) {
          if (param.type === "Identifier") {
            const typeName = extractTypeNameFromAnnotation(
              param.typeAnnotation,
            );
            addAnnotatedType(param.name, typeName);
          }
        }
      },
      ArrowFunctionExpression(node) {
        for (const param of node.params) {
          if (param.type === "Identifier") {
            const typeName = extractTypeNameFromAnnotation(
              param.typeAnnotation,
            );
            addAnnotatedType(param.name, typeName);
          }
        }
      },
      FunctionExpression(node) {
        for (const param of node.params) {
          if (param.type === "Identifier") {
            const typeName = extractTypeNameFromAnnotation(
              param.typeAnnotation,
            );
            addAnnotatedType(param.name, typeName);
          }
        }
      },
      NewExpression(node) {
        if (node.callee.type !== "Identifier") {
          return;
        }

        const imported = obsidianImports.get(node.callee.name);
        if (!imported) {
          return;
        }

        reportIfTooNew(node, imported);
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier") {
          const imported = obsidianImports.get(node.callee.name);
          if (imported) {
            reportIfTooNew(node, imported);
          }
          return;
        }

        if (node.callee.type === "MemberExpression") {
          reportMemberExpression(node.callee);
        }
      },
      MemberExpression(node) {
        if (
          node.parent &&
          node.parent.type === "CallExpression" &&
          node.parent.callee === node
        ) {
          return;
        }

        reportMemberExpression(node);
      },
    };
  },
});
