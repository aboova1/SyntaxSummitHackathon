const source = document.querySelector("#source");
const lineNumbers = document.querySelector("#line-numbers");
const sourceStatus = document.querySelector("#source-status");
const studio = document.querySelector(".studio");
const evidence = document.querySelector("#evidence");
const emptyState = document.querySelector("#empty-state");
const plan = document.querySelector("#plan");
const sql = document.querySelector("#sql");
const diagnostics = document.querySelector("#diagnostics");
const checkCount = document.querySelector("#check-count");

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
const percent = (value, digits = 1) =>
  value === undefined ? "—" : `${(value * 100).toFixed(digits)}%`;

const updateLines = () => {
  lineNumbers.textContent = Array.from(
    { length: source.value.split("\n").length },
    (_, index) => index + 1,
  ).join("\n");
};
source.addEventListener("input", updateLines);
source.addEventListener("scroll", () => {
  lineNumbers.scrollTop = source.scrollTop;
});
source.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const start = source.selectionStart;
  source.setRangeText("  ", start, source.selectionEnd, "end");
  updateLines();
});

const selectTab = (name) => {
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document
    .querySelectorAll(".panel")
    .forEach((panel) =>
      panel.classList.toggle("active", panel.id === `panel-${name}`),
    );
};
document
  .querySelectorAll(".tab")
  .forEach((tab) =>
    tab.addEventListener("click", () => selectTab(tab.dataset.tab)),
  );

const showDiagnostics = (items = []) => {
  checkCount.textContent = String(items.length);
  diagnostics.innerHTML =
    items.length === 0
      ? '<div class="checks-pass">All compiler and resource checks passed.</div>'
      : items
          .map(
            (item) =>
              `<article class="diagnostic ${escapeHtml(item.severity)}"><strong>${escapeHtml(item.code)} · ${escapeHtml(item.stage)}</strong><p>${escapeHtml(item.message)}</p>${item.hint ? `<small>${escapeHtml(item.hint)}</small>` : ""}</article>`,
          )
          .join("");
};

const showPlan = (value) => {
  plan.innerHTML =
    value?.nodes
      ?.map(
        (node, index) =>
          `<article class="plan-step"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(node.kind)}</strong><p>${escapeHtml(node.description)}</p></div></article>`,
      )
      .join("") ?? "<p>Compile the study to build its plan.</p>";
};

const metric = (label, value, note, featured = false) =>
  `<article class="metric ${featured ? "featured" : ""}"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value">${escapeHtml(value)}</strong><span class="metric-note">${escapeHtml(note)}</span></article>`;

const zoneMap = (cells) => {
  if (!cells?.length) return "";
  const byPosition = new Map(
    cells.map((cell) => [`${cell.column}:${cell.row}`, cell]),
  );
  const maximum = Math.max(...cells.map((cell) => cell.rate), 0.01);
  const squares = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const cell = byPosition.get(`${column}:${row}`);
      const opacity = cell ? 0.12 + (0.78 * cell.rate) / maximum : 0.03;
      squares.push(
        `<div class="zone-cell" style="--heat:${opacity}" title="${cell ? `${percent(cell.rate)} from ${cell.attempts.toFixed(0)} pitches` : "No pitches"}">${cell && cell.attempts >= 5 ? percent(cell.rate, 0) : ""}</div>`,
      );
    }
  }
  return `<section class="zone-section"><div><h3>Primary target zone map</h3><p>Event rate by target pitch location.</p></div><div class="zone-map" aria-label="Primary target zone map">${squares.join("")}</div></section>`;
};

const examplesTable = (rows) => {
  if (!rows?.length) return "";
  return `<section class="examples"><h3>Example target pitches</h3><div class="table-wrap"><table><thead><tr><th>Game</th><th>Pitcher</th><th>Count</th><th>Result</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.game_id)}</td><td>${escapeHtml(row.pitcher_id)}</td><td>${escapeHtml(`${row.balls}-${row.strikes}`)}</td><td>${escapeHtml(row.description)}</td></tr>`).join("")}</tbody></table></div></section>`;
};

const showEvidence = (result) => {
  emptyState.hidden = true;
  evidence.hidden = false;
  const primary = result.primary;
  const baseline = result.baseline;
  const targetPitch = result.target.sourcePitch
    ? ` on ${result.target.sourcePitch}`
    : "";
  const maximum = Math.max(
    primary.simulatedChance ?? primary.modelChance ?? primary.observedRate,
    baseline?.simulatedChance ??
      baseline?.modelChance ??
      baseline?.observedRate ??
      0,
    0.01,
  );
  const primaryValue =
    primary.simulatedChance ?? primary.modelChance ?? primary.observedRate;
  const baselineValue = baseline
    ? (baseline.simulatedChance ??
      baseline.modelChance ??
      baseline.observedRate)
    : undefined;
  const difference =
    result.difference?.simulated ??
    result.difference?.model ??
    result.difference?.observed;
  evidence.innerHTML = `
    <div class="result-kicker"><span>${escapeHtml(result.evidence)}</span><code>plan ${escapeHtml(result.audit.planFingerprint.slice(0, 12))}</code></div>
    <h2 class="result-title">${escapeHtml(result.study)}</h2>
    <p class="target-line">Target: ${escapeHtml(result.target.outcome + targetPitch)} · ${escapeHtml(result.target.horizon)}</p>
    <div class="metric-grid">
      ${metric("Observed", percent(primary.observedRate), `95% Wilson range ${percent(primary.observedInterval.low)}–${percent(primary.observedInterval.high)}`)}
      ${metric("Model", percent(primary.modelChance), "Point estimate; uncertainty unavailable")}
      ${metric("Simulation", percent(primary.simulatedChance), `Monte Carlo error ±${percent(primary.monteCarloHalfWidth)}`, true)}
    </div>
    ${
      baseline
        ? `<section class="comparison"><h3>Primary versus baseline</h3>
      <div class="bar-row"><span>Primary</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (primaryValue / maximum) * 100)}%"></div></div><strong>${percent(primaryValue)}</strong></div>
      <div class="bar-row baseline"><span>Baseline</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (baselineValue / maximum) * 100)}%"></div></div><strong>${percent(baselineValue)}</strong></div>
      <div class="difference"><small>Estimated difference</small><strong>${difference >= 0 ? "+" : ""}${percent(difference)}</strong></div>
    </section>`
        : ""
    }
    ${zoneMap(result.views?.zoneMap?.primary)}
    ${examplesTable(result.examples)}
    <div class="notice">This result uses synthetic data. Simulation error excludes model and data uncertainty.</div>
    <section class="audit"><h3>Review record</h3><div class="audit-grid">
      <div><span>Matched records</span><code>${primary.matchedCount}${baseline ? ` + ${baseline.matchedCount}` : ""}</code></div>
      <div><span>Trials</span><code>${result.audit.trials?.toLocaleString() ?? "not used"}</code></div>
      <div><span>Model</span><code>${escapeHtml(result.audit.model ? `${result.audit.model.name} ${result.audit.model.version}` : "not used")}</code></div>
      <div><span>Data snapshot</span><code>${escapeHtml(result.audit.dataSnapshot.slice(0, 12))}</code></div>
    </div></section>`;
};

const runAction = async (action) => {
  studio.classList.add("loading");
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.disabled = true;
  });
  sourceStatus.textContent =
    action === "run"
      ? "Running checked plan…"
      : `${action[0].toUpperCase() + action.slice(1)}ing…`;
  try {
    const response = await fetch("/api/study", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: source.value, action }),
    });
    const value = await response.json();
    showDiagnostics(value.diagnostics);
    showPlan(value.plan);
    sql.textContent = value.sql
      ? `${value.sql.text}\n\nParameters: ${JSON.stringify(value.sql.parameters, null, 2)}`
      : "No SQL was generated.";
    if (value.result) showEvidence(value.result);
    const failed = (value.diagnostics ?? []).some(
      (item) => item.severity === "error",
    );
    sourceStatus.textContent = failed
      ? `${value.diagnostics.length} check issue${value.diagnostics.length === 1 ? "" : "s"}`
      : `${action === "run" ? "Run" : action} complete · all checks passed`;
    sourceStatus.className = failed ? "bad" : "good";
    selectTab(
      failed
        ? "diagnostics"
        : action === "run"
          ? "evidence"
          : action === "compile"
            ? "plan"
            : "diagnostics",
    );
  } catch (error) {
    sourceStatus.textContent = "The application could not reach the compiler.";
    sourceStatus.className = "bad";
    showDiagnostics([
      {
        code: "APP",
        stage: "runtime",
        severity: "error",
        message: error.message,
      },
    ]);
    selectTab("diagnostics");
  } finally {
    studio.classList.remove("loading");
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.disabled = false;
    });
  }
};
document
  .querySelectorAll("[data-action]")
  .forEach((button) =>
    button.addEventListener("click", () => runAction(button.dataset.action)),
  );

fetch("/api/example")
  .then((response) => response.json())
  .then((value) => {
    source.value = value.source;
    updateLines();
    sourceStatus.textContent = "Example loaded · ready";
    sourceStatus.className = "good";
  })
  .catch(() => {
    sourceStatus.textContent = "The example did not load.";
    sourceStatus.className = "bad";
  });
