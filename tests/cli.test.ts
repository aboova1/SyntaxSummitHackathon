import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(new URL("..", import.meta.url).pathname);
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");
const cli = resolve(root, "src/cli.ts");
const study = resolve(root, "examples/demo.seam");
const catalog = resolve(root, "examples/demo.catalog.yml");
const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

const run = (...arguments_: string[]) =>
  spawnSync(process.execPath, [tsx, cli, ...arguments_], {
    cwd: root,
    encoding: "utf8",
  });

describe("command line", () => {
  it("returns public JSON without the protected seed", () => {
    const result = run("run", study, "--catalog", catalog, "--json");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"status": "complete"');
    expect(result.stdout).not.toContain("seed");
  });

  it("writes the repeatability seed only to a private audit file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "seamscript-audit-"));
    temporary.push(directory);
    const audit = join(directory, "audit.json");
    const result = run(
      "run",
      study,
      "--catalog",
      catalog,
      "--audit-file",
      audit,
    );

    expect(result.status).toBe(0);
    expect(await readFile(audit, "utf8")).toContain("primary");
    expect((await stat(audit)).mode & 0o777).toBe(0o600);
    expect(result.stdout).not.toContain("seed");
  });

  it("returns a failing status for invalid source", () => {
    const result = run("check", resolve(root, "README.md"));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[");
  });
});
