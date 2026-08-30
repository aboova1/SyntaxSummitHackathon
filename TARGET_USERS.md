# Target users

## 1. Pregame game-plan coordinator

This user prepares pitcher plans for an opponent or series.

The user asks which sequences work in specific counts and batter groups.

SeamScript returns matched rates, simulated chances, uncertainty, and video-ready examples.

This user is the best first target.

The work allows human review before a coach or player receives the result.

Team data can add intended locations, scouting tags, and pitcher availability.

Public Statcast can support the hackathon demonstration.

### Main decision

Which two or three sequence plans should enter the next game plan?

### Success measure

The user creates a trusted answer in minutes, without a new analyst request.

## 2. Catching coordinator or catcher scout

This user reviews the quality of pitch-selection decisions.

The system must separate the pitch call from pitch execution and pitch framing.

Public Statcast shows the delivered pitch. It does not identify who called it.

Pitchers can also call pitches with PitchCom.

Therefore, a catcher-quality claim needs the team's call-source and intended-location data.

Without those fields, SeamScript only reviews the observed sequence.

### Main decision

Where does a catcher choose strong or weak sequences for each pitcher and count?

### Success measure

The review finds repeatable decisions after it controls for pitcher, batter, count, and execution.

## 3. In-game pitching coach or manager

This user needs a short answer during a mound visit or inning break.

MLB mound visits last 30 seconds.

The product must use preloaded data and an approved model version.

It must return three ranked options in less than one second.

Each option must show chance, uncertainty, and one short reason.

The result must say `recommended option`, not `optimal pitch`.

This user should follow the pregame release.

The decision has high time pressure and strong hidden context.

### Main decision

Which pitch sequence best fits this batter, count, pitcher condition, and game state?

### Success measure

The coach gets a useful answer before the visit ends.

## Product order

1. Build the pregame workflow.
2. Add catcher review when private call data exists.
3. Add the in-game view after speed and reliability tests pass.

The first release should support decisions. It should not replace the coach.

## Current evidence

- MLB describes data and game-plan staff as links between research and coaches.
- MLB reports that catchers and coaches prepare pitcher-specific plans before games.
- MLB permits pitchers and catchers to call pitches with PitchCom.
- MLB limits a mound visit to 30 seconds.
- A 2026 MLB report describes coaches testing pitch calls from the dugout.

## Sources

- [Rockies data and game-plan coordinator](https://www.mlb.com/news/rockies-add-data-and-game-plan-coordinator)
- [Catcher game preparation](https://www.mlb.com/news/featured/catching-up-with-tim-cossins)
- [Pitchers and PitchCom](https://www.mlb.com/news/mlb-pitchers-pitchcom-transmitters-2023-update)
- [MLB mound-visit rule](https://www.mlb.com/glossary/rules/mound-visit)
- [2026 coach pitch-calling test](https://www.mlb.com/news/rockies-call-pitches-from-dugout-2026-spring-training)
