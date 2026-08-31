import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const openNavigation = async (
  page: import("@playwright/test").Page,
  projectName: string,
) => {
  if (projectName === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
};

test("runs a direct next-pitch study in Studio", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Next pitch decision" }),
  ).toBeVisible();
  await expect(page.getByLabel("SeamScript source")).toHaveValue(/situation:/);
  await expect(page.getByLabel("SeamScript source")).toHaveValue(
    /outcomes for: slider/,
  );

  await page.getByRole("button", { name: "Run study" }).click();
  await expect(page.getByText("Outcome forecast for Slider")).toBeVisible();
  await expect(page.locator("#evidence .outcome-row")).toHaveCount(6);
  await expect(page.getByText("40,000 trials")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("seed");
});

test("shows the new language formula and resources", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await openNavigation(page, testInfo.project.name);
  await page.getByRole("button", { name: "Language guide" }).click();
  await expect(page.getByText("outcomes for: slider")).toBeVisible();
  await expect(page.getByText("best pitch for: swing and miss")).toBeVisible();
  await expect(
    page.getByText(
      "The situation states facts. The question states the requested result.",
    ),
  ).toBeVisible();

  await openNavigation(page, testInfo.project.name);
  await page.getByRole("button", { name: "Resources" }).click();
  await expect(page.locator("#resource-content")).toContainText(
    "approved demo event",
  );
});

test("predicts all outcomes for one live pitch call", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/#playground");
  await expect(
    page.getByRole("heading", { name: "Make the next pitch decision" }),
  ).toBeVisible();
  await page.getByLabel("Pitcher").selectOption("P100");
  await page.getByLabel("Batter", { exact: true }).selectOption("B100");
  await page.getByLabel("Count").selectOption("1-2");
  await page.getByLabel("Previous pitch").selectOption("four-seam fastball");
  await page.getByLabel("Next pitch", { exact: true }).selectOption("slider");
  await page.getByLabel("Target location").selectOption("low and away");
  await expect(page.getByLabel("Generated SeamScript")).toContainText(
    "situation:",
  );
  await expect(page.getByLabel("Generated SeamScript")).toContainText(
    "outcomes for: slider",
  );

  await page.getByRole("button", { name: "Run decision" }).click();
  const result = page.locator("#decision-result");
  await expect(result.getByText("Outcome forecast")).toBeVisible();
  const output = page.locator("#decision-output");
  await output.getByRole("tab", { name: "Source" }).click();
  await expect(page.getByLabel("Generated SeamScript")).toBeVisible();
  await expect(result).toBeHidden();
  await output.getByRole("tab", { name: "Decision" }).click();
  await expect(result).toBeVisible();
  await expect(result.locator(".outcome-row")).toHaveCount(6);
  await expect(result).toContainText("40,000 automatic trials");
  await expect(page.locator("body")).not.toContainText("seed");
  const barWidths = await result
    .locator(".outcome-track i")
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().width),
    );
  expect(new Set(barWidths.map(Math.round)).size).toBeGreaterThan(2);
  expect(browserErrors).toEqual([]);

  const sizes = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
  await page.screenshot({
    path: `output/playwright/decision-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("recommends three calls for one goal", async ({ page }) => {
  await page.goto("/#playground");
  await page.locator(".task-switch label").nth(1).click();
  await page.getByLabel("Desired result").selectOption("swing and miss");
  await expect(page.getByLabel("Generated SeamScript")).toContainText(
    "best pitch for: swing and miss",
  );
  await page.getByRole("button", { name: "Run decision" }).click();
  const result = page.locator("#decision-result");
  await expect(result.getByText("Recommended call")).toBeVisible();
  await expect(result.locator(".recommend-list article")).toHaveCount(3);
  await expect(result).toContainText("Arsenal only");
});

test("runs the playground from a local file", async ({ page }, testInfo) => {
  const offlinePath = pathToFileURL(
    `${process.cwd()}/web/offline.html`,
  ).toString();
  await page.goto(offlinePath);
  await expect(
    page.getByRole("heading", { name: "Make the next pitch decision offline" }),
  ).toBeVisible();
  await expect(page.locator(".rail-nav .nav-item")).toHaveText([
    "Playground",
    "Offline demo",
    "Studio",
    "Language guide",
    "Resources",
    "History",
  ]);
  expect(
    await page
      .locator(".workspace-brand img.workspace-mark")
      .evaluate((image) => image.complete && image.naturalWidth > 0),
  ).toBe(true);
  await expect(page.getByText("No network calls")).toBeVisible();
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.locator("#offline-result .outcome-row")).toHaveCount(6);
  await expect(page.locator("#offline-result")).toContainText("40,000 trials");

  await page.locator(".task-switch label").nth(1).click();
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(
    page.locator("#offline-result .recommend-list article"),
  ).toHaveCount(3);
  await page.screenshot({
    path: `output/playwright/offline-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("shows the server command when the live page opens as a file", async ({
  page,
}) => {
  const liveFile =
    pathToFileURL(`${process.cwd()}/web/index.html`).toString() + "#playground";
  await page.goto(liveFile);
  const notice = page.locator("#server-required");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("npm run app");
  await expect(
    page.getByRole("link", { name: "Use the offline demo" }),
  ).toBeVisible();
});

test("keeps the selected theme after reload", async ({ page }, testInfo) => {
  await page.goto("/");
  await openNavigation(page, testInfo.project.name);
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
