export interface OverloadEntry {
  discriminant: string;
  since: string;
}

export interface SymbolEntry {
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

export interface Registry {
  generatedFrom: string;
  generatedAt: string;
  symbols: Record<string, SymbolEntry>;
}
