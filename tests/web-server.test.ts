import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createSeamServer } from "../src/web-server.js";

const projectRoot = new URL("..", import.meta.url).pathname;
const servers: ReturnType<typeof createSeamServer>[] = [];

const start = async (): Promise<string> => {
  const server = createSeamServer({ projectRoot });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
};

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

describe("browser server", () => {
  it("serves the studio with a strict content policy", async () => {
    const origin = await start();
    const response = await fetch(origin);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'self'",
    );
    expect(await response.text()).toContain("SeamScript Studio");
  });

  it("serves the baseball mark", async () => {
    const origin = await start();
    const response = await fetch(`${origin}/baseball.svg`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(await response.text()).toContain("<circle");
  });

  it("runs edited source only against the trusted demonstration catalog", async () => {
    const origin = await start();
    const example = (await (await fetch(`${origin}/api/example`)).json()) as {
      source: string;
    };
    const response = await fetch(`${origin}/api/study`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "run", source: example.source }),
    });
    const body = (await response.json()) as Record<string, unknown>;
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(serialized).toContain("pitch decision");
    expect(serialized).toContain("swing and miss");
    expect(serialized).toContain('"trials":40000');
    expect(serialized).not.toContain("protectedAudit");
    expect(serialized).not.toContain("seed");
  });

  it("lists safe resource facts without protected controls", async () => {
    const origin = await start();
    const response = await fetch(`${origin}/api/meta`);
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(serialized).toContain("approved demo event");
    expect(serialized).toContain("matched comparison");
    expect(serialized).not.toContain("seed");
    expect(serialized).not.toContain("object");
    expect(serialized).not.toContain("connection");
  });

  it("serves synthetic player profiles for the playground", async () => {
    const origin = await start();
    const response = await fetch(`${origin}/api/playground-data`);
    const body = (await response.json()) as {
      pitchers: readonly unknown[];
      batters: readonly unknown[];
      previousPitches: readonly string[];
    };

    expect(response.status).toBe(200);
    expect(body.pitchers).toHaveLength(4);
    expect(body.batters).toHaveLength(6);
    expect(body.previousPitches).toEqual([
      "four-seam fastball",
      "sinker",
      "curveball",
      "changeup",
    ]);
    expect(JSON.stringify(body)).not.toContain("seed");
  });

  it("rejects an unknown action", async () => {
    const origin = await start();
    const response = await fetch(`${origin}/api/study`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", source: "study: no" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON as a client error", async () => {
    const origin = await start();
    const response = await fetch(`${origin}/api/study`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{broken",
    });

    expect(response.status).toBe(400);
  });
});
