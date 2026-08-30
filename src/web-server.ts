import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { compileProject } from "./compiler/project.js";
import { hasErrors } from "./compiler/diagnostic.js";
import { parseCatalog } from "./catalog/load.js";
import { executePlan } from "./runtime/execute.js";
import { toPublicResult } from "./runtime/public-result.js";
import { loadPlaygroundData } from "./playground-data.js";

const BODY_LIMIT = 256 * 1024;

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const sendJson = (
  response: ServerResponse,
  status: number,
  value: unknown,
): void => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
};

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > BODY_LIMIT) throw new Error("The request is too large.");
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
};

export interface WebServerOptions {
  readonly projectRoot: string;
}

export const createSeamServer = ({ projectRoot }: WebServerOptions) => {
  const webRoot = resolve(projectRoot, "web");
  const studyPath = resolve(projectRoot, "examples/demo.seam");
  const catalogPath = resolve(projectRoot, "examples/demo.catalog.yml");
  const dataPath = resolve(projectRoot, "data/sample-pitches.csv");

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, { status: "ready" });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/example") {
        sendJson(response, 200, { source: await readFile(studyPath, "utf8") });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/meta") {
        const loaded = parseCatalog(await readFile(catalogPath, "utf8"));
        if (!loaded.catalog) {
          sendJson(response, 500, { diagnostics: loaded.diagnostics });
          return;
        }
        const catalog = loaded.catalog;
        sendJson(response, 200, {
          language: { name: "SeamScript", version: "0.2" },
          catalog: { name: catalog.catalog, version: catalog.version },
          data: Object.entries(catalog.data).map(([name, item]) => ({
            name,
            connector: item.connector,
            contract: item.contract,
            access: item.access,
          })),
          models: Object.entries(catalog.models).map(([name, item]) => ({
            name,
            connector: item.serving.connector,
            version: item.registry.version ?? item.registry.alias ?? "managed",
            status: item.require?.status ?? "available",
            calibration: item.require?.calibration ?? "not required",
          })),
          algorithms: Object.entries(catalog.algorithms).map(
            ([name, item]) => ({
              name,
              connector: item.connector,
              operation: item.operation,
              release: item.release,
            }),
          ),
          policy: {
            minimumGroupSize: catalog.policy.minimum_group_size,
            initialTrials: catalog.policy.initial_trials,
            maximumTrials: catalog.policy.maximum_trials,
            maximumHalfWidth: catalog.policy.maximum_half_width,
          },
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/playground-data") {
        sendJson(response, 200, await loadPlaygroundData(dataPath));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/study") {
        let body: { source?: unknown; action?: unknown };
        try {
          body = JSON.parse(await readBody(request)) as {
            source?: unknown;
            action?: unknown;
          };
        } catch {
          sendJson(response, 400, {
            error: "The request body must be valid JSON.",
          });
          return;
        }
        if (typeof body.source !== "string") {
          sendJson(response, 400, { error: "The source must be text." });
          return;
        }
        if (!["check", "compile", "run"].includes(String(body.action))) {
          sendJson(response, 400, {
            error: "The action must be check, compile, or run.",
          });
          return;
        }

        const catalog = await readFile(catalogPath, "utf8");
        const compiled = compileProject(body.source, catalog);
        const base = {
          diagnostics: compiled.diagnostics,
          document: compiled.frontEnd.document,
          tokens: compiled.frontEnd.tokens,
          plan: compiled.plan,
          sql: compiled.sql,
        };
        if (
          body.action !== "run" ||
          hasErrors(compiled.diagnostics) ||
          !compiled.plan
        ) {
          sendJson(response, hasErrors(compiled.diagnostics) ? 422 : 200, base);
          return;
        }

        const executed = await executePlan(compiled.plan, {
          catalogDirectory: resolve(projectRoot, "examples"),
        });
        sendJson(response, executed.result ? 200 : 422, {
          ...base,
          diagnostics: [...compiled.diagnostics, ...executed.diagnostics],
          result: executed.result ? toPublicResult(executed.result) : undefined,
        });
        return;
      }

      const files: Readonly<Record<string, string>> = {
        "/": "index.html",
        "/index.html": "index.html",
        "/app.js": "app.js",
        "/styles.css": "styles.css",
      };
      const file = files[url.pathname];
      if (request.method !== "GET" || !file) {
        sendJson(response, 404, { error: "Not found." });
        return;
      }
      const filePath = resolve(webRoot, file);
      const content = await readFile(filePath);
      response.writeHead(200, {
        "content-type":
          contentTypes[extname(filePath)] ?? "application/octet-stream",
        "cache-control": "no-cache",
        "x-content-type-options": "nosniff",
        "content-security-policy":
          "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; style-src 'self'; script-src 'self'; connect-src 'self'",
      });
      response.end(content);
    } catch (cause) {
      sendJson(response, 500, {
        error: cause instanceof Error ? cause.message : "The server failed.",
      });
    }
  });
};
