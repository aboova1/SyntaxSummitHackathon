const element = (selector) => document.querySelector(selector);
const elements = (selector) => [...document.querySelectorAll(selector)];

const source = element("#source");
const lineNumbers = element("#line-numbers");
const sourceStatus = element("#source-status");
const cursorStatus = element("#cursor-status");
const studyShell = element(".study-shell");
const evidence = element("#evidence");
const emptyState = element("#empty-state");
const plan = element("#plan");
const sql = element("#sql");
const diagnostics = element("#diagnostics");
const checkCount = element("#check-count");
const saveState = element("#save-state");
const studyFile = element("#study-file");
const toast = element("#toast");
const appShell = element(".app-shell");

const DRAFT_KEY = "seamscript.draft.v1";
const HISTORY_KEY = "seamscript.history.v1";
const THEME_KEY = "seamscript.theme";
let exampleSource = "";
let toastTimer;
let draftTimer;

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
  typeof value === "number"
    ? (value * 100).toFixed(digits) + "%"
    : "Not available";

const studyName = (text = source.value) =>
  text.match(/^study:\s*(.+)$/m)?.[1]?.trim() || "Untitled study";

const fileName = (text = source.value) => {
  const slug = studyName(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return (slug || "untitled-study") + ".seam";
};

const showToast = (message) => {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2600);
};

const readStorage = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    showToast("The browser could not save this item.");
    return false;
  }
};

const updateCursor = () => {
  const before = source.value.slice(0, source.selectionStart).split("\n");
  cursorStatus.textContent =
    "Line " + before.length + ", column " + (before.at(-1).length + 1);
};

const updateLines = () => {
  lineNumbers.textContent = Array.from(
    { length: source.value.split("\n").length },
    (_, index) => index + 1,
  ).join("\n");
  studyFile.textContent = fileName();
  updateCursor();
};

const markChanged = () => {
  saveState.textContent = "Unsaved changes";
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (
      writeStorage(DRAFT_KEY, { source: source.value, savedAt: Date.now() })
    ) {
      saveState.textContent = "Draft saved in this browser";
    }
  }, 700);
};

source.addEventListener("input", () => {
  updateLines();
  markChanged();
});
source.addEventListener("click", updateCursor);
source.addEventListener("keyup", updateCursor);
source.addEventListener("scroll", () => {
  lineNumbers.scrollTop = source.scrollTop;
});
source.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const start = source.selectionStart;
  source.setRangeText("  ", start, source.selectionEnd, "end");
  updateLines();
  markChanged();
});

const selectTab = (name) => {
  elements(".tab").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  elements(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === "panel-" + name);
  });
};

const tabs = elements(".tab");
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    selectTab(next.dataset.tab);
    next.focus();
  });
});

const showView = (name) => {
  elements("[data-page]").forEach((page) => {
    page.hidden = page.dataset.page !== name;
  });
  elements("[data-view]").forEach((item) => {
    const active = item.dataset.view === name;
    item.classList.toggle("nav-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  appShell.classList.remove("menu-open");
  element("#menu-button").setAttribute("aria-expanded", "false");
  element("#main-content").scrollTop = 0;
  if (name === "history") renderHistory();
  history.replaceState(null, "", name === "studio" ? "/" : "#" + name);
};

elements("[data-view]").forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.view));
});
element("#menu-button").addEventListener("click", () => {
  const open = appShell.classList.toggle("menu-open");
  element("#menu-button").setAttribute("aria-expanded", String(open));
});
element("#mobile-overlay").addEventListener("click", () => {
  appShell.classList.remove("menu-open");
  element("#menu-button").setAttribute("aria-expanded", "false");
});

const setTheme = (theme) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  element("#theme-toggle").setAttribute(
    "aria-label",
    theme === "dark" ? "Use light theme" : "Use dark theme",
  );
  localStorage.setItem(THEME_KEY, theme);
};
const initialTheme =
  localStorage.getItem(THEME_KEY) ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light");
setTheme(initialTheme);
element("#theme-toggle").addEventListener("click", () => {
  setTheme(
    document.documentElement.classList.contains("dark") ? "light" : "dark",
  );
});

const showDiagnostics = (items = []) => {
  checkCount.textContent = String(items.length);
  diagnostics.className = "";
  diagnostics.innerHTML =
    items.length === 0
      ? '<div class="checks-pass">All compiler and resource checks passed.</div>'
      : items
          .map(
            (item) =>
              '<article class="diagnostic ' +
              escapeHtml(item.severity) +
              '"><strong>' +
              escapeHtml(item.code) +
              " · " +
              escapeHtml(item.stage) +
              "</strong><p>" +
              escapeHtml(item.message) +
              "</p>" +
              (item.hint
                ? "<small>" + escapeHtml(item.hint) + "</small>"
                : "") +
              "</article>",
          )
          .join("");
};

const showPlan = (value) => {
  plan.className = "";
  plan.innerHTML =
    value?.nodes
      ?.map(
        (node, index) =>
          '<article class="plan-step"><span>' +
          String(index + 1).padStart(2, "0") +
          "</span><div><strong>" +
          escapeHtml(node.kind) +
          "</strong><p>" +
          escapeHtml(node.description) +
          "</p></div></article>",
      )
      .join("") ||
    '<div class="panel-empty">Compile the study to build its plan.</div>';
};

const widthClass = (value, maximum) =>
  "w-" + Math.min(20, Math.max(1, Math.ceil((value / maximum) * 20)));

const zoneMap = (cells) => {
  if (!cells?.length) return "";
  const byPosition = new Map(
    cells.map((cell) => [cell.column + ":" + cell.row, cell]),
  );
  const maximum = Math.max(...cells.map((cell) => cell.rate), 0.01);
  const squares = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const cell = byPosition.get(column + ":" + row);
      const heat = cell
        ? Math.max(1, Math.ceil((cell.rate / maximum) * 10))
        : 0;
      const label = cell
        ? percent(cell.rate) + " from " + cell.attempts.toFixed(0) + " pitches"
        : "No pitches";
      squares.push(
        '<div class="zone-cell ' +
          (heat ? "heat-" + heat : "") +
          '" title="' +
          escapeHtml(label) +
          '">' +
          (cell && cell.attempts >= 5 ? percent(cell.rate, 0) : "") +
          "</div>",
      );
    }
  }
  return (
    '<section class="result-section zone-layout"><div><h3>Primary target zone</h3>' +
    "<p>Event chance by target pitch location.</p></div>" +
    '<div class="zone-map" aria-label="Primary target zone map">' +
    squares.join("") +
    "</div></section>"
  );
};

const examplesTable = (rows) => {
  if (!rows?.length) return "";
  return (
    '<section class="result-section"><div class="section-title"><h3>Example target pitches</h3><p>' +
    rows.length +
    ' matched records</p></div><div class="table-wrap"><table><thead><tr><th>Game</th><th>Pitcher</th><th>Count</th><th>Result</th></tr></thead><tbody>' +
    rows
      .map(
        (row) =>
          "<tr><td>" +
          escapeHtml(row.game_id) +
          "</td><td>" +
          escapeHtml(row.pitcher_id) +
          "</td><td>" +
          escapeHtml(row.balls + "-" + row.strikes) +
          "</td><td>" +
          escapeHtml(row.description) +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table></div></section>"
  );
};

const showEvidence = (result) => {
  emptyState.hidden = true;
  evidence.hidden = false;
  const primary = result.primary;
  const baseline = result.baseline;
  const selectedValue =
    primary.simulatedChance ?? primary.modelChance ?? primary.observedRate;
  const baselineValue = baseline
    ? (baseline.simulatedChance ??
      baseline.modelChance ??
      baseline.observedRate)
    : undefined;
  const maximum = Math.max(selectedValue, baselineValue ?? 0, 0.01);
  const difference =
    result.difference?.simulated ??
    result.difference?.model ??
    result.difference?.observed;
  const targetPitch = result.target.sourcePitch
    ? " on " + result.target.sourcePitch
    : "";
  const leadLabel =
    result.evidence === "simulated chance"
      ? "Simulated chance"
      : result.evidence === "model chance"
        ? "Model chance"
        : "Observed rate";
  const leadNote =
    result.evidence === "simulated chance"
      ? "Random simulation error ±" + percent(primary.monteCarloHalfWidth)
      : result.evidence === "model chance"
        ? "This model does not provide an uncertainty range."
        : "95% range " +
          percent(primary.observedInterval.low) +
          "–" +
          percent(primary.observedInterval.high);
  const comparison = baseline
    ? '<section class="result-section"><div class="section-title"><h3>Primary against baseline</h3><p>Same target and matched facts</p></div>' +
      '<div class="bar-row"><span>Primary</span><div class="bar-track"><div class="bar-fill ' +
      widthClass(selectedValue, maximum) +
      '"></div></div><strong>' +
      percent(selectedValue) +
      '</strong></div><div class="bar-row baseline"><span>Baseline</span><div class="bar-track"><div class="bar-fill ' +
      widthClass(baselineValue, maximum) +
      '"></div></div><strong>' +
      percent(baselineValue) +
      '</strong></div><div class="difference"><small>Estimated difference</small><strong>' +
      (difference >= 0 ? "+" : "") +
      percent(difference) +
      "</strong></div></section>"
    : "";

  evidence.innerHTML =
    '<div class="result-kicker"><span class="dot-label"><span class="status-dot positive"></span>Run complete</span><code>plan ' +
    escapeHtml(result.audit.planFingerprint.slice(0, 12)) +
    '</code></div><h2 class="result-title">' +
    escapeHtml(result.study) +
    '</h2><p class="target-line">Target: ' +
    escapeHtml(result.target.outcome + targetPitch) +
    " · " +
    escapeHtml(result.target.horizon) +
    '</p><div class="lead-metric"><div><span>' +
    leadLabel +
    "</span><strong>" +
    percent(selectedValue) +
    "</strong></div><small>" +
    escapeHtml(leadNote) +
    '</small></div><div class="metric-row"><div class="metric"><span class="metric-label">Observed rate</span><strong class="metric-value">' +
    percent(primary.observedRate) +
    '</strong><span class="metric-note">95% range ' +
    percent(primary.observedInterval.low) +
    "–" +
    percent(primary.observedInterval.high) +
    '</span></div><div class="metric"><span class="metric-label">Model chance</span><strong class="metric-value">' +
    percent(primary.modelChance) +
    '</strong><span class="metric-note">Approved point estimate</span></div></div>' +
    comparison +
    zoneMap(result.views?.zoneMap?.primary) +
    examplesTable(result.examples) +
    '<div class="notice">This result uses synthetic data. Its simulation range covers simulation error only.</div>' +
    '<section class="result-section"><div class="section-title"><h3>Review record</h3><p>Inputs used for this run</p></div><div class="audit-grid">' +
    "<div><span>Matched records</span><code>" +
    primary.matchedCount +
    (baseline ? " + " + baseline.matchedCount : "") +
    "</code></div><div><span>Trials</span><code>" +
    (result.audit.trials?.toLocaleString() ?? "Not used") +
    "</code></div><div><span>Model</span><code>" +
    escapeHtml(
      result.audit.model
        ? result.audit.model.name + " " + result.audit.model.version
        : "Not used",
    ) +
    "</code></div><div><span>Data snapshot</span><code>" +
    escapeHtml(result.audit.dataSnapshot.slice(0, 12)) +
    "</code></div></div></section>";
};

const saveRun = (result) => {
  const runs = readStorage(HISTORY_KEY, []);
  runs.unshift({
    id: Date.now() + "-" + result.audit.planFingerprint.slice(0, 8),
    study: result.study,
    source: source.value,
    chance:
      result.primary.simulatedChance ??
      result.primary.modelChance ??
      result.primary.observedRate,
    evidence: result.evidence,
    time: Date.now(),
  });
  writeStorage(HISTORY_KEY, runs.slice(0, 12));
};

const runAction = async (action) => {
  studyShell.classList.add("loading");
  elements("[data-action]").forEach((button) => {
    button.disabled = true;
  });
  sourceStatus.textContent =
    action === "run"
      ? "Running checked plan…"
      : action === "check"
        ? "Checking…"
        : "Compiling…";
  sourceStatus.className = "";
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
      ? value.sql.text +
        "\n\nParameters: " +
        JSON.stringify(value.sql.parameters, null, 2)
      : "No SQL was generated.";
    if (value.result) {
      showEvidence(value.result);
      saveRun(value.result);
    }
    const failed = (value.diagnostics ?? []).some(
      (item) => item.severity === "error",
    );
    const label =
      action === "run" ? "Run" : action === "check" ? "Check" : "Compile";
    sourceStatus.textContent = failed
      ? value.diagnostics.length +
        " check issue" +
        (value.diagnostics.length === 1 ? "" : "s")
      : label + " complete · all checks passed";
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
    if (!failed)
      showToast(action === "run" ? "Study complete." : "All checks passed.");
  } catch (error) {
    sourceStatus.textContent = "The studio could not reach the compiler.";
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
    studyShell.classList.remove("loading");
    elements("[data-action]").forEach((button) => {
      button.disabled = false;
    });
  }
};

elements("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runAction(button.dataset.action));
});

const resetOutput = () => {
  evidence.hidden = true;
  evidence.innerHTML = "";
  emptyState.hidden = false;
  plan.className = "panel-empty";
  plan.textContent = "Compile the study to build its plan.";
  sql.textContent = "Compile the study to inspect its SQL.";
  diagnostics.className = "panel-empty";
  diagnostics.textContent = "Check the study to inspect its rules.";
  checkCount.textContent = "0";
  selectTab("evidence");
};

element("#save-study").addEventListener("click", () => {
  clearTimeout(draftTimer);
  if (writeStorage(DRAFT_KEY, { source: source.value, savedAt: Date.now() })) {
    saveState.textContent = "Draft saved in this browser";
    showToast("Draft saved.");
  }
});
element("#new-study").addEventListener("click", () => {
  source.value = exampleSource.replace(
    /^study:.+$/m,
    "study: Untitled pitch study",
  );
  updateLines();
  resetOutput();
  markChanged();
  source.focus();
  showToast("New study ready.");
});

const renderHistory = () => {
  const runs = readStorage(HISTORY_KEY, []);
  const content = element("#history-content");
  if (!runs.length) {
    content.innerHTML =
      '<div class="history-empty">Run a study to add it to this browser.</div>';
    return;
  }
  content.innerHTML = runs
    .map(
      (run) =>
        '<article class="history-row"><div><strong>' +
        escapeHtml(run.study) +
        "</strong><span>" +
        new Date(run.time).toLocaleString() +
        "</span></div><span>" +
        escapeHtml(run.evidence) +
        "</span><span>" +
        percent(run.chance) +
        '</span><button class="button" data-open-run="' +
        escapeHtml(run.id) +
        '">Open</button></article>',
    )
    .join("");
  elements("[data-open-run]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = runs.find((run) => run.id === button.dataset.openRun);
      if (!selected) return;
      source.value = selected.source;
      updateLines();
      resetOutput();
      saveState.textContent = "Saved run loaded";
      showView("studio");
      showToast("Saved study loaded.");
    });
  });
};

let clearPending = false;
element("#clear-history").addEventListener("click", (event) => {
  if (!clearPending) {
    clearPending = true;
    event.currentTarget.textContent = "Confirm clear";
    setTimeout(() => {
      clearPending = false;
      event.currentTarget.textContent = "Clear history";
    }, 4000);
    return;
  }
  localStorage.removeItem(HISTORY_KEY);
  clearPending = false;
  event.currentTarget.textContent = "Clear history";
  renderHistory();
  showToast("Run history cleared.");
});

const resourceRow = (item, values) =>
  '<div class="resource-row"><strong>' +
  escapeHtml(item.name) +
  "</strong>" +
  values.map((value) => "<span>" + escapeHtml(value) + "</span>").join("") +
  "</div>";

const loadResources = async () => {
  const content = element("#resource-content");
  try {
    const response = await fetch("/api/meta");
    const meta = await response.json();
    content.innerHTML =
      '<section class="resource-group"><div class="resource-group-head"><h2>Data</h2><span>' +
      meta.data.length +
      " source</span></div>" +
      meta.data
        .map((item) =>
          resourceRow(item, [item.connector, item.contract, item.access]),
        )
        .join("") +
      '</section><section class="resource-group"><div class="resource-group-head"><h2>Models</h2><span>' +
      meta.models.length +
      " approved model</span></div>" +
      meta.models
        .map((item) =>
          resourceRow(item, [
            item.connector,
            "Version " + item.version,
            item.status + " · calibration " + item.calibration,
          ]),
        )
        .join("") +
      '</section><section class="resource-group"><div class="resource-group-head"><h2>Algorithms</h2><span>' +
      meta.algorithms.length +
      " methods</span></div>" +
      meta.algorithms
        .map((item) =>
          resourceRow(item, [
            item.connector,
            item.operation,
            "Release " + item.release,
          ]),
        )
        .join("") +
      '</section><section class="resource-group"><div class="resource-group-head"><h2>Run policy</h2><span>Automatic safeguards</span></div><div class="policy-line">' +
      "<span><small>Minimum group</small><strong>" +
      meta.policy.minimumGroupSize.toLocaleString() +
      "</strong></span><span><small>Initial trials</small><strong>" +
      meta.policy.initialTrials.toLocaleString() +
      "</strong></span><span><small>Maximum trials</small><strong>" +
      meta.policy.maximumTrials.toLocaleString() +
      "</strong></span><span><small>Maximum random error</small><strong>±" +
      percent(meta.policy.maximumHalfWidth) +
      "</strong></span></div></section>";
  } catch {
    content.innerHTML =
      '<div class="loading-row">The resource catalog is not available.</div>';
  }
};

document.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key === "Enter") {
    event.preventDefault();
    runAction("run");
  }
  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    element("#save-study").click();
  }
});

const loadExample = async () => {
  try {
    const response = await fetch("/api/example");
    const value = await response.json();
    exampleSource = value.source;
    const draft = readStorage(DRAFT_KEY, null);
    source.value = draft?.source || exampleSource;
    updateLines();
    sourceStatus.textContent = draft
      ? "Saved draft loaded · ready"
      : "Example loaded · ready";
    sourceStatus.className = "good";
    saveState.textContent = draft
      ? "Draft saved in this browser"
      : "Example study";
  } catch {
    sourceStatus.textContent = "The example did not load.";
    sourceStatus.className = "bad";
  }
};

loadExample();
loadResources();
renderHistory();
const initialView = location.hash.slice(1);
if (["guide", "resources", "history"].includes(initialView))
  showView(initialView);
