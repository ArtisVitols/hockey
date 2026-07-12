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
```

The e2e tools race a live AI sim (faceoff coin-flips, stoppages), so individual assertions occasionally fail on unlucky runs; rerun before treating a failure as real.

Debug/test URL params: `?webgl=1` force WebGL2 · `?menu=0` skip menu into 1P · `?ai=1` AI-vs-AI demo · `?controls=classic` classic scheme · `?cam=x,y,z` orbit camera at position · `?frames=N` stop render loop after N frames (screenshots) · `?period=seconds` · `?difficulty=easy|medium|hard`.

## Architecture

**Sim/render split (load-bearing rule):** `src/physics/`, `src/game/`, and `src/ai/` never import from `src/render/` or touch scene objects beyond `three` math types. The sim owns state; `src/players/` and `src/render/` consume it. This keeps rules/AI unit-testable in Node and makes the fixed-timestep split work.

**Loop structure** (`src/core/engine.ts`, wired in `src/main.ts`): the render loop runs at display rate; `Engine.advance` steps the sim at a fixed 120 Hz with an accumulator and returns an interpolation alpha. Every dynamic body keeps `prevPos`/`pos`; visuals lerp between them. `main.ts` builds one `stepSim(dt)` (brains → world → match) and one `updateP1(dt)` (input → triggers → world actions) shared by the render loop **and** the `window.__game.advance()` test hook — if you add per-frame game logic, put it in one of those two functions or headless tests won't exercise it.

**Input contract** (`src/input/intent.ts`): humans and AI both drive skaters through the same mutable `PlayerIntent` object registered in `world.intents`. Control switching (`src/input/switching.ts`) re-points which body holds the human's intent object; the human-controlled skater must be passed as `excluded` to its team's `TeamBrain.update` each step or the AI will fight the player. Two P1 schemes exist (`keyboardMouse.ts`, `classicKeyboard.ts`); the classic scheme has no cursor, so aim points are resolved at fire time in `main.ts` via `src/ai/targeting.ts` (auto shot corner, most-open-teammate pass).

**Game flow** (`src/game/match.ts`): a phase FSM — `faceoff_setup → faceoff → play → goal/stoppage → …` — owns clock, score, periods (sides swap each period via `defendsOf`/`attackDirOf`; always derive directions from these, never from `TEAMS[i].defends` directly). `src/game/rules.ts` watches puck line-crossings during `play` for offside/icing using `world.lastTouchTeam/lastTouchX` attribution. The world fires `onGoal`; the match validates phase and drives everything else through its `onEvent` callback (HUD banners, horn, goal lights).

**Physics** (`src/physics/`): skaters are kinematic carve-model controllers (`skaterBody.ts` — turn rate falls with speed), the puck is 2.5D (`puck.ts` — y-axis for lifted shots), and all collision geometry is analytic: rounded-rect boards SDF (`geometry.ts`), goal-post circles, goalie blocker circles (`world.blockers`). Possession is a stick-point leash (`possession.ts`) with random tie-breaks so faceoffs are fair — pickup order must never depend on `world.skaters` insertion order (team 0 is inserted first). Action mechanics (wrist shot, poke, body check + stun, deke) live on `World` with per-skater cooldowns on `SkaterBody`.

**Rink dimensions** (`src/config.ts`): everything — ice texture painting, faceoff lineups, rules lines, goalie positioning, crowd placement — derives from `RINK`/`GOAL` constants (currently IIHF 61×30 m). Never hardcode coordinates like the goal-line x in gameplay code or tests; reference the config (tests learned this the hard way when the rink changed size).

**Rendering** (`src/render/`, `src/arena/`): all materials are TSL node materials from `three/webgpu` so one codebase compiles to WGSL and GLSL — don't import WebGL-only `examples/jsm` classes (use `three/addons/tsl/...` equivalents). The signature glossy ice (`iceMaterial.ts`) layers a canvas-painted marking texture (`icePainter.ts`), scratch-modulated roughness, clearcoat, and a real-time planar `reflector()` blended by fresnel — the reflection *replaces* diffuse at grazing angles (energy-conserving mix); a purely additive blend disappears against white ice. Arena textures (ice markings, boards, net mesh, scratch maps, environment) are all generated on canvases at startup — there are no binary art assets in the repo.

**Players** (`src/players/`): rigid-skinned procedural meshes (`proceduralPlayer.ts`, ~17 bones, parts assigned to single bones) with code-authored `AnimationClip`s (`animController.ts` — locomotion layer crossfaded by speed with `timeScale` synced to ground velocity, one-shot action layer). `PlayerVisual` is the interface seam: a rigged GLB pipeline can replace the procedural builder without touching the rest of the game.

**Test hook**: `main.ts` exposes `window.__game` (player/puck/goalie positions, possession, match state, `advance`, `shoot`, `spread`). The headless tools depend on it — keep it working when refactoring `main.ts`.

## Deployment

Push to `main` → `.github/workflows/deploy.yml` builds and publishes to GitHub Pages. Vite uses `base: './'` (relative asset paths) — required for the `/hockey/` subpath. Verify the live site after deploy with `tools/screenshot.mjs` against the production URL.
