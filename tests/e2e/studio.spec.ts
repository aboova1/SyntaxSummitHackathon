import { expect, test } from "@playwright/test";

test("runs a checked study and hides protected controls", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Describe the question. Get checked evidence.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("SeamScript source")).toHaveValue(/target:/);

  await page.getByRole("button", { name: "Run study" }).click();
  await expect(
    page.getByRole("heading", { name: "Fastball before slider" }),
  ).toBeVisible();
  await expect(page.locator(".metric.featured .metric-value")).toHaveText(
    /\d+\.\d%/,
  );
  await expect(page.getByText("40,000")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Primary target zone map" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Example target pitches" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("seed");
  await page.screenshot({
    path: `output/playwright/studio-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("shows a useful compiler error", async ({ page }) => {
  await page.goto("/");
  const editor = page.getByLabel("SeamScript source");
  await expect(editor).toHaveValue(/outcome: swing and miss/);
  await editor.fill(
    (await editor.inputValue()).replace(
      "outcome: swing and miss",
      "result: swing and miss",
    ),
  );
  await page.getByRole("button", { name: "Check" }).click();

  await expect(page.getByText("S202 · semantic")).toBeVisible();
  await expect(page.getByText("Use 'outcome'.")).toBeVisible();
});

test("keeps the mobile page within its viewport", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile layout check.");
  await page.goto("/");
  await page.getByRole("button", { name: "Run study" }).click();
  await expect(
    page.getByRole("heading", { name: "Fastball before slider" }),
  ).toBeVisible();
  const sizes = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
});
