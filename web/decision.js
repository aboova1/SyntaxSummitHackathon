(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const title = (value) =>
    String(value).replace(/\b\w/g, (character) => character.toUpperCase());
  const percent = (value, digits = 1) =>
    typeof value === "number"
      ? (value * 100).toFixed(digits) + "%"
      : "Not available";
  const controls = {
    pitcher: $("#decision-pitcher"),
    batter: $("#decision-batter"),
    nextPitch: $("#decision-next-pitch"),
    targetLocation: $("#decision-target-location"),
    goal: $("#decision-goal"),
    count: $("#decision-count"),
    previous: $("#decision-previous"),
    previousLocation: $("#decision-previous-location"),
    previousResult: $("#decision-previous-result"),
    outs: $("#decision-outs"),
    runners: $("#decision-runners"),
    score: $("#decision-score"),
  };
  let data;
  let lastResult;

  const setOutputTab = (name) => {
    const output = $("#decision-output");
    output.querySelectorAll("[data-output-tab]").forEach((button) => {
      const active = button.dataset.outputTab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    output.querySelectorAll("[data-output-panel]").forEach((panel) => {
      const active = panel.dataset.outputPanel === name;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
  };

  const setStatus = (label, state = "positive") => {
    $("#decision-status").innerHTML =
      `<span class="status-dot ${state}" aria-hidden="true"></span>${label}`;
  };

  const task = () =>
    document.querySelector('input[name="decision-task"]:checked').value;
  const selected = (items, id) => items.find((item) => item.id === id);

  const request = () => ({
    study: `Next pitch for ${selected(data.pitchers, controls.pitcher.value).name} against ${selected(data.batters, controls.batter.value).name}`,
    situation: {
      pitcher: controls.pitcher.value,
      batter: controls.batter.value,
      count: controls.count.value,
      previousPitch: controls.previous.value,
      previousLocation:
        controls.previous.value === "none"
          ? "none"
          : controls.previousLocation.value,
      previousResult:
        controls.previous.value === "none"
          ? "none"
          : controls.previousResult.value,
      outs: Number(controls.outs.value),
      runners: controls.runners.value,
      score: controls.score.value,
    },
    question:
      task() === "predict"
        ? {
            kind: "predict",
            pitch: controls.nextPitch.value,
            location: controls.targetLocation.value,
          }
        : { kind: "recommend", goal: controls.goal.value },
  });

  const sourceText = () => {
    if (!data) return "Start the local service to build this study.";
    const value = request();
    const pitcher = selected(data.pitchers, value.situation.pitcher);
    const batter = selected(data.batters, value.situation.batter);
    const question =
      value.question.kind === "predict"
        ? `  outcomes for: ${value.question.pitch}\n  target location: ${value.question.location}`
        : `  best pitch for: ${value.question.goal}`;
    return `study: ${value.study}\n\nsource: synthetic demo pitches\n\nsituation:\n  pitcher: ${pitcher.name}\n  batter: ${batter.name}\n  count: ${value.situation.count}\n  previous pitch: ${value.situation.previousPitch}\n  previous location: ${value.situation.previousLocation}\n  previous result: ${value.situation.previousResult}\n  outs: ${value.situation.outs}\n  runners: ${value.situation.runners}\n  score: ${value.situation.score}\n\nquestion:\n${question}\n\nusing:\n  model: approved pitch outcome\n  simulation: automatic\n\ninclude:\n  - outcome chances\n  - uncertainty\n`;
  };

  const renderMatchup = () => {
    if (!data) return;
    const pitcher = selected(data.pitchers, controls.pitcher.value);
    const batter = selected(data.batters, controls.batter.value);
    $("#decision-matchup").innerHTML =
      `<article class="matchup-card pitcher-card"><div class="player-head"><div><span>Pitcher · ${pitcher.team}</span><strong>${pitcher.name}</strong><small>${pitcher.hand === "left" ? "LHP" : "RHP"} · ${pitcher.id}</small></div></div><div class="player-metrics"><div><span>Slider mph</span><strong>${pitcher.sliderVelocity.toFixed(1)}</strong></div><div><span>Spin rpm</span><strong>${pitcher.sliderSpin.toLocaleString()}</strong></div><div><span>Whiff</span><strong>${percent(pitcher.sliderWhiffRate)}</strong></div></div><div class="profile-foot"><span>${pitcher.pitches.toLocaleString()} tracked pitches</span><span>${pitcher.pitchMix.length} pitches in arsenal</span></div></article><div class="matchup-versus" aria-hidden="true">vs</div><article class="matchup-card batter-card"><div class="player-head"><div><span>Batter</span><strong>${batter.name}</strong><small>${batter.side === "switch" ? "Switch hitter" : "Bats " + batter.side} · ${batter.id}</small></div></div><div class="player-metrics"><div><span>wOBA</span><strong>${batter.woba.toFixed(3).replace(/^0/, "")}</strong></div><div><span>Contact</span><strong>${percent(batter.contactRate)}</strong></div><div><span>Chase</span><strong>${percent(batter.chaseRate)}</strong></div></div><div class="profile-foot"><span>${batter.pitches.toLocaleString()} tracked pitches</span><span>Pitch-type whiff ${percent(batter.pitchTypeWhiffRate)}</span></div></article>`;
  };

  const emptyResult = () => {
    $("#decision-result").innerHTML =
      `<div class="playground-empty"><span class="empty-mark"><svg viewBox="0 0 24 24"><path d="M5 19 19 5M7 5h12v12M5 12v7h7"></path></svg></span><div><strong>Ready for a direct pitch decision</strong><p>Run the checked simulation after you enter the known facts.</p></div></div>`;
  };

  const outcomeBars = (items) =>
    `<div class="outcome-list">${items.map((item) => `<div class="outcome-row"><span>${title(item.outcome)}</span><div class="outcome-track"><i class="w-${Math.max(1, Math.min(20, Math.ceil(item.chance * 20)))}"></i></div><strong>${percent(item.chance)}</strong></div>`).join("")}</div>`;

  const decisionContext = () => {
    const value = request();
    const pitcher = selected(data.pitchers, value.situation.pitcher);
    const batter = selected(data.batters, value.situation.batter);
    const previous =
      value.situation.previousPitch === "none"
        ? "No previous pitch"
        : `${title(value.situation.previousPitch)} · ${title(value.situation.previousResult)}`;
    return `<div class="decision-context"><span>${pitcher.name} vs ${batter.name}</span><span>Count: ${value.situation.count}</span><span>Outs: ${value.situation.outs}</span><span>Runners: ${title(value.situation.runners)}</span><span>Score: ${title(value.situation.score)}</span><span>Previous: ${previous}</span></div>`;
  };

  const renderResult = (result) => {
    const container = $("#decision-result");
    const selectedCall = result.selected;
    if (result.question.kind === "predict") {
      const leading = [...selectedCall.outcomes].sort(
        (a, b) => b.chance - a.chance,
      )[0];
      container.innerHTML = `${decisionContext()}<div class="decision-head"><div><span>Outcome forecast</span><h2>${title(selectedCall.pitch)} · ${title(selectedCall.location)}</h2><p>All outcomes are separate and total 100%.</p></div><div class="decision-lead"><span>Most likely · ${title(leading.outcome)}</span><strong>${percent(leading.chance)}</strong><small>40,000 automatic trials</small></div></div>${outcomeBars(selectedCall.outcomes)}<div class="decision-note"><strong>Simulation error only</strong><span>The demonstration model does not give model uncertainty.</span></div>`;
      return;
    }
    container.innerHTML = `${decisionContext()}<div class="decision-head"><div><span>Recommended call</span><h2>${title(selectedCall.pitch)} · ${title(selectedCall.location)}</h2><p>Goal: ${title(result.question.goal)}</p></div><div class="decision-lead"><span>Estimated goal chance</span><strong>${percent(selectedCall.goalChance)}</strong><small>95% simulation range ${percent(selectedCall.simulationRange.low)}–${percent(selectedCall.simulationRange.high)}</small></div></div><div class="recommend-list">${result.recommendations.map((call, index) => `<article><span>0${index + 1}</span><div><strong>${title(call.pitch)}</strong><small>${title(call.location)}</small></div><b>${percent(call.goalChance)}</b></article>`).join("")}</div><h3 class="result-subhead">Outcome chances for the top call</h3>${outcomeBars(selectedCall.outcomes)}<div class="decision-note"><strong>Arsenal only</strong><span>The runtime tested each available pitch and target location.</span></div>`;
  };

  const update = () => {
    const predict = task() === "predict";
    $("#decision-predict-fields").hidden = !predict;
    $("#decision-recommend-fields").hidden = predict;
    const hasPrevious = controls.previous.value !== "none";
    controls.previousLocation.disabled = !hasPrevious;
    controls.previousResult.disabled = !hasPrevious;
    renderMatchup();
    $("#decision-source").textContent = sourceText();
    lastResult = undefined;
    emptyResult();
    setStatus("Ready");
  };

  const setAvailable = (available) => {
    $("#server-required").hidden = available;
    $("#decision-run").disabled = !available;
  };

  const load = async () => {
    try {
      const response = await fetch("/api/playground-data");
      if (!response.ok) throw new Error("The service is not ready.");
      data = await response.json();
      controls.pitcher.innerHTML = data.pitchers
        .map(
          (item) =>
            `<option value="${item.id}">${item.name} · ${item.team}</option>`,
        )
        .join("");
      controls.batter.innerHTML = data.batters
        .map((item) => `<option value="${item.id}">${item.name}</option>`)
        .join("");
      const pitchNames = [
        ...new Set(
          data.pitchers.flatMap((item) =>
            item.pitchMix.map((pitch) => pitch.pitch),
          ),
        ),
      ];
      controls.nextPitch.innerHTML = pitchNames
        .map(
          (pitch) =>
            `<option value="${pitch}"${pitch === "slider" ? " selected" : ""}>${title(pitch)}</option>`,
        )
        .join("");
      controls.pitcher.disabled = false;
      controls.batter.disabled = false;
      setAvailable(true);
      update();
    } catch {
      setAvailable(false);
      $("#decision-matchup").innerHTML =
        "<span>Run <code>npm run app</code>, then reload this page.</span>";
      $("#decision-source").textContent =
        "Start the local service to build this study.";
    }
  };

  $("#decision-form").addEventListener("change", update);
  $("#decision-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    setOutputTab("result");
    setStatus("Running", "warning");
    $("#decision-run").disabled = true;
    $("#decision-result").innerHTML =
      '<div class="playground-loading">Running the checked decision…</div>';
    try {
      const response = await fetch("/api/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request()),
      });
      const value = await response.json();
      if (!response.ok || !value.result)
        throw new Error(value.error || "The decision did not run.");
      lastResult = value.result;
      renderResult(value.result);
      setStatus("Complete");
    } catch (error) {
      setAvailable(false);
      setStatus("Service needed", "warning");
      $("#decision-result").innerHTML =
        `<div class="playground-error"><strong>Start the local service.</strong><p>Run <code>npm run app</code> in the project folder. Then reload this page.</p></div>`;
    } finally {
      if (!$("#server-required").hidden) return;
      $("#decision-run").disabled = false;
    }
  });
  $("#decision-reset").addEventListener("click", () => {
    $("#decision-form").reset();
    update();
  });
  $("#decision-open").addEventListener("click", () => {
    const editor = $("#source");
    editor.value = sourceText();
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('[data-view="studio"]').click();
    if (lastResult)
      $("#source-status").textContent = "Decision loaded · ready to run";
  });
  $("#decision-output").addEventListener("click", (event) => {
    const button = event.target.closest("[data-output-tab]");
    if (button) setOutputTab(button.dataset.outputTab);
  });
  load();
})();
