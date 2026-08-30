import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { error, type Diagnostic } from "../compiler/diagnostic.js";
import { connectionsSchema, type ConnectionProfiles } from "./schema.js";

export interface ConnectionsLoadResult {
  readonly profiles?: ConnectionProfiles;
  readonly diagnostics: readonly Diagnostic[];
}

export const parseConnections = (source: string): ConnectionsLoadResult => {
  let input: unknown;
  try {
    input = parseYaml(source);
  } catch (cause) {
    return {
      diagnostics: [
        error("resolve", "S320", "The connections file is not valid YAML.", {
          hint:
            cause instanceof Error
              ? cause.message
              : "Check the file structure.",
        }),
      ],
    };
  }
  const result = connectionsSchema.safeParse(input);
  if (result.success) return { profiles: result.data, diagnostics: [] };
  return {
    diagnostics: [
      error(
        "resolve",
        "S321",
        "The connections file does not match its contract.",
        {
          hint: JSON.stringify(z.treeifyError(result.error)),
        },
      ),
    ],
  };
};

export const loadConnections = async (
  path: string,
): Promise<ConnectionsLoadResult> => {
  try {
    return parseConnections(await readFile(path, "utf8"));
  } catch (cause) {
    return {
      diagnostics: [
        error("resolve", "S322", `Cannot read connections file '${path}'.`, {
          hint: cause instanceof Error ? cause.message : "Check the file path.",
        }),
      ],
    };
  }
};

export const getConnection = (
  profiles: ConnectionProfiles,
  name: string,
): ConnectionProfiles["connections"][string] => {
  const profile = profiles.connections[name];
  if (!profile) throw new Error(`Connection profile '${name}' does not exist.`);
  return profile;
};
