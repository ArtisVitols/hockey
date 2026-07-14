# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser-based 3D ice hockey game (5v5, IIHF rink) built on Three.js's WebGPU renderer with automatic WebGL2 fallback. No game engine, no physics library — custom fixed-timestep sim, custom AI, procedurally built players and arena, WebAudio-synthesized sound. Deployed to GitHub Pages at https://artisvitols.github.io/hockey/ by a GitHub Actions workflow on every push to `main`.

## Environment quirks (read first)

- **Node is not on PATH.** Prefix every shell session with:
  `export PATH="$HOME/.local/opt/node-v22.17.0-linux-x64/bin:$PATH"`
- **TypeScript is pinned to 5.9.** TS 7's native compiler OOMs on this 8 GB machine against `@types/three` (7+ GB RSS, exit 137). Do not upgrade it.
- Headless Chromium (playwright-core, binary at `~/.cache/ms-playwright/chromium-1228`) renders via swiftshader at ~2 fps, so **never verify gameplay with wall-clock waits** — use the `window.__game.advance(seconds)` sim fast-forward hook. Headless WebGPU initializes but screenshots come out blank; pass `?webgl=1` for visual checks (the TSL node materials compile identically on both backends).

## Commands

```bash
npm run dev        # Vite dev server on :5173
npm run build      # tsc --noEmit && vite build → dist/
npm test           # vitest run (pure-logic tests: rules, faceoffs, targeting)
npx vitest run src/game/rules.test.ts   # single test file
npm run typecheck
```

Headless verification (dev server must be running):

```bash
node tools/screenshot.mjs "http://localhost:5173/?webgl=1&frames=10&menu=0" out.png [w] [h]
node tools/drive.mjs          # e2e mouse scheme: skate → possess → score → faceoff reset
node tools/classic-drive.mjs  # e2e classic scheme: arrows, wrist shot, switch, pull goalie
node tools/soak.mjs 5         # AI-vs-AI for N sim-minutes; checks errors/clumping/scoring
node tools/passrate.mjs       # AI-vs-AI pass completion % (+ intercepted/missed breakdown)
node tools/pausecam.mjs       # pause menu, camera views, vertical-cam input remap
```

The e2e tools race a live AI sim (faceoff coin-flips, stoppages), so individual assertions occasionally fail on unlucky runs; rerun before treating a failure as real.

Debug/test URL params: `?webgl=1` force WebGL2 · `?menu=0` skip menu into 1P · `?ai=1` AI-vs-AI demo · `?controls=classic` classic scheme · `?camview=broadcast|close|vertical` follow-camera view · `?cam=x,y,z` orbit camera at position · `?frames=N` stop render loop after N frames (screenshots) · `?period=seconds` · `?difficulty=easy|medium|hard`.

## Architecture

**Sim/render split (load-bearing rule):** `src/physics/`, `src/game/`, and `src/ai/` never import from `src/render/` or touch scene objects beyond `three` math types. The sim owns state; `src/players/` and `src/render/` consume it. This keeps rules/AI unit-testable in Node and makes the fixed-timestep split work.

**Loop structure** (`src/core/engine.ts`, wired in `src/main.ts`): the render loop runs at display rate; `Engine.advance` steps the sim at a fixed 120 Hz with an accumulator and returns an interpolation alpha. Every dynamic body keeps `prevPos`/`pos`; visuals lerp between them. `main.ts` builds one `stepSim(dt)` (brains → world → match) and one `updateP1(dt)` (input → triggers → world actions) shared by the render loop **and** the `window.__game.advance()` test hook — if you add per-frame game logic, put it in one of those two functions or headless tests won't exercise it.

**AI** (`src/ai/`): a tactical layer (`positioning.ts`, pure/unit-tested) classifies each team into offense/breakout/advance/defense/forecheck/neutral and maps role→system position (attack triangle with D at the points, d-zone coverage with wingers on the points + net-front D, 1-2-2 forecheck with pinching D, boards breakout). `teamBrain.ts` consumes it with a **sticky state** (loose-puck flickers during pass flights must not yo-yo the formation; possession gains and defense switch instantly), a role-aware chaser policy (D only pressure low in their own zone), and rate-limited poke attempts (a per-skater timer — anything keyed to the 0.8 s world cooldown alone fires every expiry at 120 Hz and shreds all possession). Carrier decisions in `skaterBrain.ts` are role/zone-aware (slot shots gated so cycles develop, D point shots need a lane, breakout outlet passes). Pass physics matter to AI quality: pass speed scales with distance and pickup tolerates ≤19 m/s relative speed — with a fixed 16 m/s pass vs a 14 m/s pickup gate, every pass was uncatchable and the game degenerated into scrambles. Passes are targeted: `world.passTo(passer, receiver)` solves the intercept iteratively (flight time ↔ receiver lead), sets `world.passTarget` so the receiver runs a route (`teamBrain.ts`) and gets a catch assist (wider pickup range/speed gate + priority in `possession.ts`); human passes snap to the teammate in a ~35° aim cone (`coneReceiver` in `main.ts`), falling back to an untargeted dump `world.pass()` toward empty ice. `tools/soak.mjs` measures formation discipline statistically (D-at-points during established zones, D-caught-deep, winger point coverage) via the `__game.formation()` hook; `tools/passrate.mjs` measures pass completion via `__game.passStats()` (healthy is ~80%+ with interceptions, not misses, as the dominant failure).

**Input contract** (`src/input/intent.ts`): humans and AI both drive skaters through the same mutable `PlayerIntent` object registered in `world.intents`. Control switching (`src/input/switching.ts`) re-points which body holds the human's intent object; the human-controlled skater must be passed as `excluded` to its team's `TeamBrain.update` each step or the AI will fight the player. Two P1 schemes exist (`keyboardMouse.ts`, `classicKeyboard.ts`); the classic scheme has no cursor, so aim points are resolved at fire time in `main.ts` via `src/ai/targeting.ts` (auto shot corner, most-open-teammate pass). Keyboard/stick movement is **screen-space**: the follow camera (`followCamera.ts`) has three modes (broadcast/close/vertical — selectable in the Esc pause menu, persisted to localStorage), and under the rotated `vertical` view `main.ts` rotates move intents by `follow.viewYaw(match.defendsOf(0))` after each input update (the gamepad rotates internally via its `viewYaw` field). Mouse aim needs no remap — it raycasts through the camera.

**Game flow** (`src/game/match.ts`): a phase FSM — `faceoff_setup → faceoff → play → goal/stoppage → …` — owns clock, score, periods (sides swap each period via `defendsOf`/`attackDirOf`; always derive directions from these, never from `TEAMS[i].defends` directly). `src/game/rules.ts` watches puck line-crossings during `play` for offside/icing using `world.lastTouchTeam/lastTouchX` attribution. The world fires `onGoal`; the match validates phase and drives everything else through its `onEvent` callback (HUD banners, horn, goal lights).

**Physics** (`src/physics/`): skaters are kinematic carve-model controllers (`skaterBody.ts` — turn rate falls with speed), the puck is 2.5D (`puck.ts` — y-axis for lifted shots), and all collision geometry is analytic: rounded-rect boards SDF (`geometry.ts`), goal-post circles, goalie blocker circles (`world.blockers`). Possession is a stick-point leash (`possession.ts`) with random tie-breaks so faceoffs are fair — pickup order must never depend on `world.skaters` insertion order (team 0 is inserted first). Action mechanics (wrist shot, poke, body check + stun, deke) live on `World` with per-skater cooldowns on `SkaterBody`.

**Rink dimensions** (`src/config.ts`): everything — ice texture painting, faceoff lineups, rules lines, goalie positioning, crowd placement — derives from `RINK`/`GOAL` constants (currently IIHF 61×30 m). Never hardcode coordinates like the goal-line x in gameplay code or tests; reference the config (tests learned this the hard way when the rink changed size).

**Rendering** (`src/render/`, `src/arena/`): all materials are TSL node materials from `three/webgpu` so one codebase compiles to WGSL and GLSL — don't import WebGL-only `examples/jsm` classes (use `three/addons/tsl/...` equivalents). The signature glossy ice (`iceMaterial.ts`) layers a canvas-painted marking texture (`icePainter.ts`), scratch-modulated roughness, clearcoat, and a real-time planar `reflector()` blended by fresnel — the reflection *replaces* diffuse at grazing angles (energy-conserving mix); a purely additive blend disappears against white ice. Arena textures (ice markings, boards, net mesh, scratch maps, environment) are all generated on canvases at startup — the only binary asset is the player model GLB.

**Players** (`src/players/`): the primary body is the Xbot rigged mannequin (`public/assets/models/xbot.glb`, the repo's only binary asset, fetched once by `tools/fetch-assets.mjs`), cloned per player and dressed with gear meshes attached to bones via world-pose `bone.attach()` (`glbPlayer.ts`); `proceduralPlayer.ts` remains the automatic fallback when the GLB fails to load. Animations are code-authored in `hockeyClips.ts` as **world-space deltas** composed through each rig's captured rest pose (`rigMap.ts`) — this is what makes hand-authored clips work on the Mixamo skeleton (non-identity rest rotations, T-pose baseline for the arms) *and* the procedural one from the same source. Two skinned-mesh gotchas that cost time: `Box3.setFromObject` lies about skinned size (measure bone world positions instead), and the mixamorig arms need baseline arms-down quaternions or every pose inherits the T-pose. The stick is not bone-attached — `playerVisual.solveStick()` orients it between the two hands toward the ice each frame. `AnimController` blends idle/glide/skate/sprint by speed, with one-shot actions and a fall+get-up state; debug URL params `?noanim=1` (freeze rest pose) and `?rigdebug=1` (log bone positions).

**Test hook**: `main.ts` exposes `window.__game` (player/puck/goalie positions, possession, match state, `advance`, `shoot`, `spread`). The headless tools depend on it — keep it working when refactoring `main.ts`.

## Deployment

Push to `main` → `.github/workflows/deploy.yml` builds and publishes to GitHub Pages. Vite uses `base: './'` (relative asset paths) — required for the `/hockey/` subpath. Verify the live site after deploy with `tools/screenshot.mjs` against the production URL.
