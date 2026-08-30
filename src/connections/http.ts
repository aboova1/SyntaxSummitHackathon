import { createHash, randomUUID } from "node:crypto";
import type { ConnectionProfile } from "./schema.js";

export type FetchFunction = typeof fetch;

export interface JsonRequest {
  readonly method?: "GET" | "POST";
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly idempotencyKey?: string;
}

class RemoteRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

const wait = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const bodyHash = (body: unknown): string =>
  createHash("sha256")
    .update(JSON.stringify(body ?? null))
    .digest("hex");

export const requestJson = async <T>(
  profile: ConnectionProfile,
  path: string,
  request: JsonRequest = {},
  fetchFunction: FetchFunction = fetch,
): Promise<T> => {
  const method = request.method ?? "GET";
  const token = profile.token_env ? process.env[profile.token_env] : undefined;
  if (profile.token_env && !token) {
    throw new Error(
      `Required credential environment variable '${profile.token_env}' is not set.`,
    );
  }
  const idempotencyKey =
    request.idempotencyKey ??
    `${randomUUID()}-${bodyHash(request.body).slice(0, 12)}`;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= profile.retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), profile.timeout_ms);
    try {
      const response = await fetchFunction(new URL(path, profile.base_url), {
        method,
        headers: {
          accept: "application/json",
          ...(request.body === undefined
            ? {}
            : { "content-type": "application/json" }),
          "idempotency-key": idempotencyKey,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...request.headers,
        },
        ...(request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const transient =
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500;
        const failure = new RemoteRequestError(
          `Remote service returned HTTP ${response.status}.`,
          transient,
        );
        if (!transient || attempt === profile.retries) throw failure;
        lastError = failure;
      } else {
        return (await response.json()) as T;
      }
    } catch (cause) {
      const failure =
        cause instanceof Error ? cause : new Error("Remote request failed.");
      lastError = failure;
      if (
        attempt === profile.retries ||
        (failure instanceof RemoteRequestError && !failure.retryable)
      ) {
        throw failure;
      }
    } finally {
      clearTimeout(timeout);
    }
    await wait(50 * 2 ** attempt);
  }
  throw lastError ?? new Error("Remote request failed.");
};
