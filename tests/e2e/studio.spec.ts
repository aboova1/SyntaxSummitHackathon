import { expect, test } from "@playwright/test";

test("runs a checked study and hides protected controls", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Pitch sequence study" }),
  ).toBeVisible();
  await expect(page.getByLabel("SeamScript source")).toHaveValue(/target:/);

  await page.getByRole("button", { name: "Run study" }).click();
  await expect(
    page.getByRole("heading", { name: "Fastball before slider" }),
  ).toBeVisible();
  await expect(page.locator(".lead-metric strong")).toHaveText(/\d+\.\d%/);
  await expect(page.getByText("40,000")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Primary target zone" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Example target pitches" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("seed");
  await page.screenshot({
    path: `output/playwright/studio-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(browserErrors).toEqual([]);
});

test("opens the guide and trusted resource catalog", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: "Language guide" }).click();
  await expect(
    page.getByRole("heading", { name: "One form. One meaning." }),
  ).toBeVisible();
  await expect(page.getByText("The target is never a fact.")).toBeVisible();

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: "Resources" }).click();
  await expect(
    page.getByRole("heading", { name: "Data and methods" }),
  ).toBeVisible();
  await expect(page.getByText("approved demo outcome")).toBeVisible();
  await expect(page.getByText("adaptive simulation")).toBeVisible();
});

test("saves completed work in local history", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Run study" }).click();
  await expect(page.getByText("Study complete.")).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Saved work" })).toBeVisible();
  const history = page.locator("#history-content");
  await expect(history.getByText("Fastball before slider")).toBeVisible();
  await expect(history.getByText("simulated chance")).toBeVisible();
  await history.getByRole("button", { name: "Open" }).click();
  await expect(page.getByLabel("SeamScript source")).toHaveValue(
    /Fastball before slider/,
  );
});

test("keeps a saved draft after reload", async ({ page }) => {
  await page.goto("/");
  const editor = page.getByLabel("SeamScript source");
  await editor.fill(
    (await editor.inputValue()).replace(
      "Fastball before slider",
      "Saved bullpen study",
    ),
  );
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.reload();
  await expect(editor).toHaveValue(/Saved bullpen study/);
  await expect(page.getByText("saved-bullpen-study.seam")).toBeVisible();
});

test("keeps the selected theme after reload", async ({ page }, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
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

test("uses the mobile navigation drawer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile navigation check.");
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Language guide" }).click();
  await expect(
    page.getByRole("heading", { name: "One form. One meaning." }),
  ).toBeVisible();
  const sizes = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
});
