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
  await page.goto(`http://127.0.0.1:${port}/#playground`);
  await page
    .getByRole("heading", { name: "Make the next pitch decision" })
    .waitFor();
  await page.getByLabel("Pitcher").selectOption("P100");
  await page.getByLabel("Batter", { exact: true }).selectOption("B100");
  await page.getByLabel("Next pitch", { exact: true }).selectOption("slider");
  await page.getByLabel("Target location").selectOption("low and away");
  await page.waitForTimeout(2_000);

  await page.getByRole("button", { name: "Run decision" }).click();
  await page.getByText("Outcome forecast").waitFor();
  await page.waitForTimeout(4_000);

  await page.getByRole("tab", { name: "Source" }).click();
  await page.getByLabel("Generated SeamScript").waitFor();
  await page.waitForTimeout(4_000);

  await page.getByRole("tab", { name: "Decision" }).click();
  await page.locator(".task-switch label").nth(1).click();
  await page.getByLabel("Desired result").selectOption("swing and miss");
  await page.getByRole("button", { name: "Run decision" }).click();
  await page.getByText("Recommended call").waitFor();
  await page.waitForTimeout(4_000);

  await page.getByRole("tab", { name: "Source" }).click();
  await page.getByRole("button", { name: "Open in Studio" }).click();
  await page.getByLabel("SeamScript source").waitFor();
  await page.waitForTimeout(3_000);
  await page.getByRole("button", { name: "Check" }).click();
  await page.getByText("Check complete · all checks passed").waitFor();
  await page.waitForTimeout(3_000);
  await page.getByRole("button", { name: "Run study" }).click();
  await page.getByText("Best call for Swing And Miss").waitFor();
  await page.waitForTimeout(5_000);
} finally {
  await page.close();
  await context.close();
  await browser.close();
  await new Promise<void>((done) => server.close(() => done()));
}

if (!video) throw new Error("Playwright did not create a video.");
await rename(await video.path(), outputPath);
process.stdout.write(`${outputPath}\n`);
