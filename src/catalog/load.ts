import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { error, type Diagnostic } from "../compiler/diagnostic.js";
import { catalogSchema, type SeamCatalog } from "./schema.js";

export interface CatalogLoadResult {
  readonly catalog?: SeamCatalog;
  readonly diagnostics: readonly Diagnostic[];
}

export const parseCatalog = (source: string): CatalogLoadResult => {
  let input: unknown;
  try {
    input = parseYaml(source);
  } catch (cause) {
    return {
      diagnostics: [
        error("resolve", "S300", "The resource catalog is not valid YAML.", {
          hint:
            cause instanceof Error
              ? cause.message
              : "Check the catalog structure.",
        }),
      ],
    };
  }

  const result = catalogSchema.safeParse(input);
  if (result.success) return { catalog: result.data, diagnostics: [] };
  const tree = z.treeifyError(result.error);
  return {
    diagnostics: [
      error(
        "resolve",
        "S301",
        "The resource catalog does not match its contract.",
        {
          hint: JSON.stringify(tree),
        },
      ),
    ],
  };
};

export const loadCatalog = async (path: string): Promise<CatalogLoadResult> => {
  try {
    return parseCatalog(await readFile(path, "utf8"));
  } catch (cause) {
    return {
      diagnostics: [
        error("resolve", "S302", `Cannot read catalog '${path}'.`, {
          hint: cause instanceof Error ? cause.message : "Check the file path.",
        }),
      ],
    };
  }
};
