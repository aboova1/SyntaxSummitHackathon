import { mkdir, rename } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createSeamServer } from "../src/web-server.js";

const projectRoot = resolve(process.cwd());
const outputDirectory = resolve(
  projectRoot,
  "output/playwright/demo-recording",
);
const outputPath = resolve(
  projectRoot,
  "output/playwright/seamscript-demo.webm",
);
await mkdir(outputDirectory, { recursive: true });

const server = createSeamServer({ projectRoot });
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const port = (server.address() as AddressInfo).port;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDirectory, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const video = page.video();

try {
  await page.goto(`http://127.0.0.1:${port}`);
  const editor = page.getByLabel("SeamScript source");
  await editor.waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    (
      document.querySelector("#source") as HTMLTextAreaElement | null
    )?.value.includes("outcome: swing and miss"),
  );
  await page.waitForTimeout(2_500);

  const original = await editor.inputValue();
  await editor.fill(
    original.replace("outcome: swing and miss", "result: swing and miss"),
  );
  await page.getByRole("button", { name: "Check" }).click();
  await page.getByText("S202 · semantic").waitFor();
  await page.waitForTimeout(3_500);

  await editor.fill(original);
  await page.getByRole("button", { name: "Compile" }).click();
  await page.locator(".plan-step").first().waitFor();
  await page.waitForTimeout(3_500);

  await page.getByRole("tab", { name: "SQL" }).click();
  await page.waitForTimeout(3_500);

  await page.getByRole("button", { name: "Run study" }).click();
  await page.getByRole("heading", { name: "Fastball before slider" }).waitFor();
  await page.waitForTimeout(5_000);
  await page.locator(".zone-section").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3_500);
  await page.locator(".meaning").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3_500);
} finally {
  await page.close();
  await context.close();
  await browser.close();
  await new Promise<void>((done) => server.close(() => done()));
}

if (!video) throw new Error("Playwright did not create a video.");
await rename(await video.path(), outputPath);
process.stdout.write(`${outputPath}\n`);
