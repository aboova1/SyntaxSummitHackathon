(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const percent = (value, digits = 1) => (value * 100).toFixed(digits) + "%";
  const title = (value) =>
    value.replace(/\b\w/g, (character) => character.toUpperCase());

  const pitchers = [
    {
      id: "P100",
      name: "Alex Morgan",
      team: "CHC",
      hand: "RHP",
      whiff: 0.22,
      sliderWhiff: 0.287,
      velocity: 85.0,
      spin: 2480,
      arsenal: [
        "four-seam fastball",
        "sinker",
        "slider",
        "sweeper",
        "curveball",
        "changeup",
      ],
    },
    {
      id: "P200",
      name: "Jordan Lee",
      team: "MIL",
      hand: "LHP",
      whiff: 0.238,
      sliderWhiff: 0.309,
      velocity: 86.2,
      spin: 2535,
      arsenal: [
        "four-seam fastball",
        "sinker",
        "slider",
        "curveball",
        "changeup",
      ],
    },
    {
      id: "P300",
      name: "Sam Rivera",
      team: "STL",
      hand: "RHP",
      whiff: 0.256,
      sliderWhiff: 0.324,
      velocity: 87.1,
      spin: 2610,
      arsenal: [
        "four-seam fastball",
        "cutter",
        "slider",
        "sweeper",
        "curveball",
      ],
    },
    {
      id: "P400",
      name: "Casey Brooks",
      team: "CIN",
      hand: "LHP",
      whiff: 0.274,
      sliderWhiff: 0.321,
      velocity: 84.7,
      spin: 2482,
      arsenal: [
        "four-seam fastball",
        "sinker",
        "slider",
        "sweeper",
        "changeup",
      ],
    },
  ];
  const batters = [
    {
      id: "B100",
      name: "Taylor Kim",
      side: "Switch hitter",
      woba: 0.322,
      contact: 0.746,
      chase: 0.25,
      pitchWhiff: 0.224,
    },
    {
      id: "B101",
      name: "Cameron Ellis",
      side: "Bats left",
      woba: 0.33,
      contact: 0.73,
      chase: 0.265,
      pitchWhiff: 0.236,
    },
    {
      id: "B102",
      name: "Riley Chen",
      side: "Bats right",
      woba: 0.338,
      contact: 0.81,
      chase: 0.28,
      pitchWhiff: 0.248,
    },
    {
      id: "B103",
      name: "Drew Parker",
      side: "Bats left",
      woba: 0.346,
      contact: 0.794,
      chase: 0.295,
      pitchWhiff: 0.26,
    },
    {
      id: "B104",
      name: "Morgan Diaz",
      side: "Bats right",
      woba: 0.29,
      contact: 0.778,
      chase: 0.31,
      pitchWhiff: 0.272,
    },
    {
      id: "B105",
      name: "Avery Johnson",
      side: "Switch hitter",
      woba: 0.298,
      contact: 0.762,
      chase: 0.25,
      pitchWhiff: 0.2,
    },
  ];
  const outcomes = [
    "ball",
    "called strike",
    "swing and miss",
    "foul",
    "out in play",
    "hit",
  ];
  const locations = [
    "high and inside",
    "high and away",
    "middle",
    "low and inside",
    "low and away",
  ];
  const base = {
    "four-seam fastball": [0.3, 0.2, 0.11, 0.17, 0.13, 0.09],
    sinker: [0.3, 0.17, 0.1, 0.16, 0.18, 0.09],
    cutter: [0.31, 0.16, 0.16, 0.16, 0.13, 0.08],
    slider: [0.35, 0.12, 0.22, 0.13, 0.11, 0.07],
    sweeper: [0.37, 0.1, 0.25, 0.11, 0.1, 0.07],
    curveball: [0.34, 0.15, 0.2, 0.12, 0.12, 0.07],
    changeup: [0.36, 0.1, 0.23, 0.12, 0.12, 0.07],
  };

  const controls = {
    pitcher: $("#offline-pitcher"),
    batter: $("#offline-batter"),
    nextPitch: $("#offline-next-pitch"),
    targetLocation: $("#offline-target-location"),
    goal: $("#offline-goal"),
    count: $("#offline-count"),
    previous: $("#offline-previous"),
    previousLocation: $("#offline-previous-location"),
    previousResult: $("#offline-previous-result"),
    outs: $("#offline-outs"),
    runners: $("#offline-runners"),
    score: $("#offline-score"),
  };

  const setOutputTab = (name) => {
    const output = $("#offline-output");
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
    $("#offline-status").innerHTML =
      `<span class="status-dot ${state}" aria-hidden="true"></span>${label}`;
  };

  controls.pitcher.innerHTML = pitchers
    .map(
      (player) =>
        `<option value="${player.id}">${player.name} · ${player.team}</option>`,
    )
    .join("");
  controls.batter.innerHTML = batters
    .map((player) => `<option value="${player.id}">${player.name}</option>`)
    .join("");

  const task = () =>
    document.querySelector('input[name="offline-task"]:checked').value;
  const player = (list, id) => list.find((item) => item.id === id);
  const situation = () => ({
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
  });

  const family = (pitch) =>
    ["four-seam fastball", "sinker", "cutter"].includes(pitch)
      ? "hard"
      : ["slider", "sweeper", "curveball"].includes(pitch)
        ? "breaking"
        : "soft";
  const softmax = (scores) => {
    const maximum = Math.max(...scores);
    const values = scores.map((score) => Math.exp(score - maximum));
    const total = values.reduce((sum, value) => sum + value, 0);
    return values.map((value) => value / total);
  };
  const generator = (parts) => {
    let state = 2166136261;
    for (const character of parts.join("|")) {
      state ^= character.charCodeAt(0);
      state = Math.imul(state, 16777619);
    }
    state >>>= 0;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  };

  const distribution = (pitcher, batter, state, pitch, location) => {
    const scores = (base[pitch] || base.slider).map((value) => Math.log(value));
    const whiffSkill = pitcher.whiff - 0.25;
    const batterWhiff = batter.pitchWhiff - 0.24;
    const contact = batter.contact - 0.77;
    const chase = batter.chase - 0.28;
    scores[2] += 2.4 * whiffSkill + 1.7 * batterWhiff - 1.4 * contact;
    scores[3] += 0.8 * contact;
    scores[4] += 0.7 * contact;
    scores[5] += 0.9 * contact - 0.7 * whiffSkill;
    if (location.includes("low")) {
      scores[0] += 0.18;
      scores[2] += 0.2 + 0.8 * chase;
      scores[5] -= 0.16;
    }
    if (location.includes("away")) {
      scores[2] += 0.12 + 0.6 * chase;
      scores[5] -= 0.12;
    }
    if (location.includes("high")) {
      scores[1] += 0.1;
      scores[2] += family(pitch) === "hard" ? 0.2 : -0.05;
    }
    if (location.includes("inside")) {
      scores[3] += 0.08;
      scores[4] += 0.07;
    }
    if (location === "middle") {
      scores[0] -= 0.24;
      scores[1] += 0.25;
      scores[5] += 0.34;
    }
    if (Number(state.count.split("-")[1]) === 2) {
      scores[0] += 0.12;
      scores[2] += 0.17;
      scores[5] -= 0.08;
    }
    if (state.count.startsWith("3-")) {
      scores[0] -= 0.18;
      scores[1] += 0.18;
      scores[5] += 0.08;
    }
    if (
      state.previousPitch !== "none" &&
      family(state.previousPitch) !== family(pitch)
    ) {
      scores[2] += 0.17;
      scores[5] -= 0.06;
    }
    if (state.previousResult === "swing and miss") scores[0] += 0.07;
    if (state.runners !== "empty") scores[1] += 0.04;
    if (state.score === "tied") scores[1] += 0.03;
    return softmax(scores);
  };

  const chanceFor = (items, goal) => {
    const chance = (name) =>
      items.find((item) => item.outcome === name)?.chance || 0;
    if (goal === "any strike")
      return (
        chance("called strike") + chance("swing and miss") + chance("foul")
      );
    return chance(goal);
  };

  const runCall = (pitch, location, goal) => {
    const state = situation();
    const pitcher = player(pitchers, state.pitcher);
    const batter = player(batters, state.batter);
    const chances = distribution(pitcher, batter, state, pitch, location);
    const random = generator([
      state.pitcher,
      state.batter,
      state.count,
      state.previousPitch,
      state.previousLocation,
      state.previousResult,
      String(state.outs),
      state.runners,
      state.score,
      pitch,
      location,
    ]);
    const counts = outcomes.map(() => 0);
    for (let trial = 0; trial < 40000; trial += 1) {
      const value = random();
      let total = 0;
      let selected = chances.length - 1;
      for (let index = 0; index < chances.length; index += 1) {
        total += chances[index];
        if (value <= total) {
          selected = index;
          break;
        }
      }
      counts[selected] += 1;
    }
    const result = outcomes.map((outcome, index) => ({
      outcome,
      chance: counts[index] / 40000,
    }));
    return {
      pitch,
      location,
      outcomes: result,
      goalChance: goal ? chanceFor(result, goal) : undefined,
    };
  };

  const bestCalls = (goal) => {
    const pitcher = player(pitchers, controls.pitcher.value);
    return pitcher.arsenal
      .map(
        (pitch) =>
          locations
            .map((location) => runCall(pitch, location, goal))
            .sort((a, b) => b.goalChance - a.goalChance)[0],
      )
      .sort((a, b) => b.goalChance - a.goalChance)
      .slice(0, 3);
  };

  const buildSource = () => {
    const pitcher = player(pitchers, controls.pitcher.value);
    const batter = player(batters, controls.batter.value);
    const state = situation();
    const question =
      task() === "predict"
        ? `  outcomes for: ${controls.nextPitch.value}\n  target location: ${controls.targetLocation.value}`
        : `  best pitch for: ${controls.goal.value}`;
    return `study: Next pitch for ${pitcher.name} against ${batter.name}\n\nsource: synthetic demo pitches\n\nsituation:\n  pitcher: ${pitcher.name}\n  batter: ${batter.name}\n  count: ${state.count}\n  previous pitch: ${state.previousPitch}\n  previous location: ${state.previousLocation}\n  previous result: ${state.previousResult}\n  outs: ${state.outs}\n  runners: ${state.runners}\n  score: ${state.score}\n\nquestion:\n${question}\n\nusing:\n  model: approved pitch outcome\n  simulation: automatic\n\ninclude:\n  - outcome chances\n  - uncertainty\n`;
  };

  const renderMatchup = () => {
    const pitcher = player(pitchers, controls.pitcher.value);
    const batter = player(batters, controls.batter.value);
    $("#offline-matchup").innerHTML =
      `<article class="matchup-card pitcher-card"><div class="player-head"><div><span>Pitcher · ${pitcher.team}</span><strong>${pitcher.name}</strong><small>${pitcher.hand} · ${pitcher.id}</small></div></div><div class="player-metrics"><div><span>Slider mph</span><strong>${pitcher.velocity.toFixed(1)}</strong></div><div><span>Spin rpm</span><strong>${pitcher.spin.toLocaleString()}</strong></div><div><span>Whiff</span><strong>${percent(pitcher.sliderWhiff)}</strong></div></div><div class="profile-foot"><span>Arsenal: ${pitcher.arsenal.map(title).join(", ")}</span></div></article><div class="matchup-versus" aria-hidden="true">vs</div><article class="matchup-card batter-card"><div class="player-head"><div><span>Batter</span><strong>${batter.name}</strong><small>${batter.side} · ${batter.id}</small></div></div><div class="player-metrics"><div><span>wOBA</span><strong>${batter.woba.toFixed(3).replace(/^0/, "")}</strong></div><div><span>Contact</span><strong>${percent(batter.contact)}</strong></div><div><span>Chase</span><strong>${percent(batter.chase)}</strong></div></div><div class="profile-foot"><span>Pitch-type whiff: ${percent(batter.pitchWhiff)}</span></div></article>`;
  };

  const emptyResult = () => {
    $("#offline-result").innerHTML =
      `<div class="playground-empty"><span class="empty-mark"><svg viewBox="0 0 24 24"><path d="M5 19 19 5M7 5h12v12M5 12v7h7"></path></svg></span><div><strong>Ready for a direct pitch decision</strong><p>Run the local simulation after you select the known facts.</p></div></div>`;
  };

  const outcomeBars = (items) =>
    `<div class="outcome-list">${items.map((item) => `<div class="outcome-row"><span>${title(item.outcome)}</span><div class="outcome-track"><i class="w-${Math.max(1, Math.min(20, Math.ceil(item.chance * 20)))}"></i></div><strong>${percent(item.chance)}</strong></div>`).join("")}</div>`;

  const decisionContext = () => {
    const state = situation();
    const pitcher = player(pitchers, state.pitcher);
    const batter = player(batters, state.batter);
    const previous =
      state.previousPitch === "none"
        ? "No previous pitch"
        : `${title(state.previousPitch)} · ${title(state.previousResult)}`;
    return `<div class="decision-context"><span>${pitcher.name} vs ${batter.name}</span><span>Count: ${state.count}</span><span>Outs: ${state.outs}</span><span>Runners: ${title(state.runners)}</span><span>Score: ${title(state.score)}</span><span>Previous: ${previous}</span></div>`;
  };

  const renderResult = () => {
    const result = $("#offline-result");
    setOutputTab("result");
    setStatus("Running", "warning");
    result.innerHTML =
      '<div class="playground-loading">Running 40,000 local trials…</div>';
    window.setTimeout(() => {
      if (task() === "predict") {
        const call = runCall(
          controls.nextPitch.value,
          controls.targetLocation.value,
        );
        const leading = [...call.outcomes].sort(
          (a, b) => b.chance - a.chance,
        )[0];
        const half =
          1.96 * Math.sqrt((leading.chance * (1 - leading.chance)) / 40000);
        result.innerHTML = `${decisionContext()}<div class="decision-head"><div><span>Outcome forecast</span><h2>${title(call.pitch)} · ${title(call.location)}</h2><p>All outcomes are separate and total 100%.</p></div><div class="decision-lead"><span>Most likely · ${title(leading.outcome)}</span><strong>${percent(leading.chance)}</strong><small>95% simulation range ${percent(Math.max(0, leading.chance - half))}–${percent(Math.min(1, leading.chance + half))}</small></div></div>${outcomeBars(call.outcomes)}<div class="decision-note"><strong>40,000 trials</strong><span>The range covers simulation error only. The local model is illustrative.</span></div>`;
      } else {
        const calls = bestCalls(controls.goal.value);
        const best = calls[0];
        const half =
          1.96 * Math.sqrt((best.goalChance * (1 - best.goalChance)) / 40000);
        result.innerHTML = `${decisionContext()}<div class="decision-head"><div><span>Recommended call</span><h2>${title(best.pitch)} · ${title(best.location)}</h2><p>Goal: ${title(controls.goal.value)}</p></div><div class="decision-lead"><span>Estimated goal chance</span><strong>${percent(best.goalChance)}</strong><small>95% simulation range ${percent(best.goalChance - half)}–${percent(best.goalChance + half)}</small></div></div><div class="recommend-list">${calls.map((call, index) => `<article><span>0${index + 1}</span><div><strong>${title(call.pitch)}</strong><small>${title(call.location)}</small></div><b>${percent(call.goalChance)}</b></article>`).join("")}</div><h3 class="result-subhead">Outcome chances for the top call</h3>${outcomeBars(best.outcomes)}<div class="decision-note"><strong>Arsenal only</strong><span>The model tested each available pitch and target location.</span></div>`;
      }
      setStatus("Complete");
    }, 120);
  };

  const update = () => {
    const predict = task() === "predict";
    $("#offline-predict-fields").hidden = !predict;
    $("#offline-recommend-fields").hidden = predict;
    const hasPrevious = controls.previous.value !== "none";
    controls.previousLocation.disabled = !hasPrevious;
    controls.previousResult.disabled = !hasPrevious;
    renderMatchup();
    $("#offline-source").textContent = buildSource();
    emptyResult();
    setStatus("Ready offline");
  };

  $("#offline-form").addEventListener("change", update);
  $("#offline-form").addEventListener("submit", (event) => {
    event.preventDefault();
    renderResult();
  });
  $("#offline-reset").addEventListener("click", () => {
    $("#offline-form").reset();
    update();
  });
  $("#offline-output").addEventListener("click", (event) => {
    const button = event.target.closest("[data-output-tab]");
    if (button) setOutputTab(button.dataset.outputTab);
  });

  const themeKey = "seamscript.theme";
  const setTheme = (value) => {
    document.documentElement.classList.toggle("dark", value === "dark");
    $("#offline-theme").setAttribute(
      "aria-label",
      value === "dark" ? "Use light theme" : "Use dark theme",
    );
    localStorage.setItem(themeKey, value);
  };
  setTheme(
    localStorage.getItem(themeKey) ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  $("#offline-theme").addEventListener("click", () =>
    setTheme(
      document.documentElement.classList.contains("dark") ? "light" : "dark",
    ),
  );
  $("#menu-button").addEventListener("click", () => {
    const open = $(".app-shell").classList.toggle("menu-open");
    $("#menu-button").setAttribute("aria-expanded", String(open));
  });
  $("#mobile-overlay").addEventListener("click", () =>
    $(".app-shell").classList.remove("menu-open"),
  );
  update();
})();
