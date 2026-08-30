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
  const resources = page.locator("#resource-content");
  await expect(resources.getByText("approved demo event")).toBeVisible();
  await expect(resources.getByText("adaptive simulation")).toBeVisible();
});

test("runs an automatic simulation in the playground", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: "Playground" }).click();
  await expect(
    page.getByRole("heading", { name: "Build a study without code" }),
  ).toBeVisible();
  await page.getByLabel("Pitcher").selectOption("P100");
  await page.getByLabel("Batter", { exact: true }).selectOption("B100");
  await expect(page.getByLabel("Previous pitch").locator("option")).toHaveText([
    "Four-Seam Fastball",
    "Sinker",
    "Curveball",
    "Changeup",
  ]);
  const matchup = page.locator("#matchup-visual");
  await expect(matchup.getByText("Alex Morgan")).toBeVisible();
  await expect(matchup.getByText("Taylor Kim")).toBeVisible();
  await expect(
    matchup.locator(".player-metrics").first().getByText("Slider"),
  ).toBeVisible();
  await expect(
    matchup.locator(".player-metrics").last().getByText("Contact"),
  ).toBeVisible();
  await expect(page.getByLabel("Generated SeamScript")).toContainText(
    "evidence: simulation",
  );
  await expect(page.getByLabel("Generated SeamScript")).toContainText(
    "pitchers: P100",
  );
  await expect(page.getByLabel("Generated SeamScript")).toContainText(
    "batters: B100",
  );

  await page.getByRole("button", { name: "Run playground" }).click();
  const result = page.locator("#playground-result");
  await expect(result.getByText("simulated chance")).toBeVisible({
    timeout: 20_000,
  });
  await expect(result.getByText("40,000 simulation trials")).toBeVisible();
  await expect(result.locator(".playground-chance strong")).toHaveText(
    /\d+\.\d%/,
  );
  await expect(page.locator("body")).not.toContainText("seed");
  await page.screenshot({
    path: `output/playwright/playground-${testInfo.project.name}.png`,
    fullPage: true,
  });
  const sizes = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
  expect(browserErrors).toEqual([]);

  await result.getByRole("button", { name: "Review full evidence" }).click();
  await expect(page.getByLabel("SeamScript source")).toHaveValue(
    /Alex Morgan versus Taylor Kim: four-seam fastball before slider for swing and miss/,
  );
  await expect(
    page.getByRole("heading", {
      name: "Alex Morgan versus Taylor Kim: four-seam fastball before slider for swing and miss",
    }),
  ).toBeVisible();
});

test("runs changed playground choices with an approved model", async ({
  page,
}) => {
  await page.goto("/#playground");
  await page.getByLabel("Pitcher").selectOption("P400");
  await page.getByLabel("Batter", { exact: true }).selectOption("B105");
  await page.getByLabel("Target event").selectOption("contact");
  await page.getByLabel("Previous pitch").selectOption("curveball");
  await page.getByLabel("Count group").selectOption("0-0, 1-1, 2-2");
  await page.getByLabel("Batter side").selectOption("right");
  await page.getByLabel("Lookback").selectOption("1");
  await page.getByLabel("Evidence").selectOption("model");
  const generated = page.getByLabel("Generated SeamScript");
  await expect(generated).toContainText("event: contact");
  await expect(generated).toContainText("pitchers: P400");
  await expect(generated).toContainText("batters: B105");
  await expect(generated).toContainText("after: curveball");
  await expect(generated).toContainText("counts: 0-0, 1-1, 2-2");
  await expect(generated).toContainText("batter sides: right");
  await expect(generated).toContainText("lookback: 1 pitch");
  await expect(generated).toContainText("evidence: model");

  await page.getByRole("button", { name: "Run playground" }).click();
  const result = page.locator("#playground-result");
  await expect(result.getByText("model chance")).toBeVisible();
  await expect(result.getByText("matched records")).toBeVisible();
  await expect(
    result.getByText(
      "Casey Brooks versus Avery Johnson: curveball before slider for contact",
    ),
  ).toBeVisible();
});

test("saves completed work in local history", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByLabel("SeamScript source")).toHaveValue(/target:/);
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
  await expect(editor).toHaveValue(/Fastball before slider/);
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
  await expect(editor).toHaveValue(/event: swing and miss/);
  await editor.fill(
    (await editor.inputValue()).replace(
      "event: swing and miss",
      "result: swing and miss",
    ),
  );
  await page.getByRole("button", { name: "Check" }).click();

  await expect(page.getByText("S202 · semantic")).toBeVisible();
  await expect(page.getByText("Use 'event'.")).toBeVisible();
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
