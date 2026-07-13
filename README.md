# Hockey Night

A 3D ice hockey game that runs in the browser. Three.js (WebGPU with WebGL2 fallback), TypeScript, Vite — no game engine, custom physics and AI.

**Play:** https://artisvitols.github.io/hockey/

## Features

- Glossy NHL-broadcast-style ice with real-time planar reflections
- Regulation international (IIHF) rink — 61×30 m, rulebook ice markings, regulation goals and sticks
- Full 5v5 with faceoffs, offside, icing, periods, overtime
- Wrist shots, charged slap shots, poke checks, body checks with knockdowns, dekes, pull-goalie
- Rigged human player models (Mixamo-skeleton mannequins in team gear) with authored skating strides, hockey stops, falls + get-ups; goalies with butterfly saves
- Team AI (roles, forecheck, poke-checking defense, passing) with three difficulties
- 1 player, local 2 player (gamepad), or AI demo mode; two keyboard control schemes
- Synthesized audio: goal horn, whistle, board hits, crowd
- In-menu **Controls Guide** with keyboard schematics and a gamepad diagram

## Controls

Two schemes, selectable in the menu (the **CONTROLS GUIDE** button in the main menu shows all of this in-game):

**Mouse aim** (default)

| Action | Input |
|---|---|
| Skate | WASD |
| Aim | Mouse |
| Slap shot | Hold + release left mouse (charge = power/lift) |
| Wrist shot | Tap left mouse |
| Pass | E or right mouse |
| Poke check | F |
| Body check | Space |
| Deke | Q |
| Sprint | Shift |

**Classic (NHL 09)** — context-sensitive action cluster

| Action | With puck | Without puck |
|---|---|---|
| Skate | Arrow keys | Arrow keys |
| S | Pass (auto-target) | Switch player |
| D | Wrist shot (auto-aim) | Poke check |
| Space / W | Slap shot (hold to charge) | Body check |
| A | Deke | — |
| E / Shift | Sprint | Sprint |

Both schemes: **F9** pull goalie (F10 for P2 in 2-player), **Esc** pause.

Player 2 (gamepad): left stick skate, right stick aim, RT/A shoot, LB/X pass, L3/LT sprint.

## Development

```bash
npm install
npm run dev        # dev server at localhost:5173
npm test           # unit tests: rules, faceoffs, targeting (vitest)
npm run typecheck
npm run build      # production build to dist/
```

Headless verification (needs playwright-core chromium; dev server running):

```bash
node tools/screenshot.mjs "http://localhost:5173/?webgl=1&frames=10" out.png
node tools/drive.mjs          # e2e mouse scheme: skate → possess → score → faceoff reset
node tools/classic-drive.mjs  # e2e classic scheme: arrows, wrist shot, switch, pull goalie
node tools/soak.mjs 5         # AI-vs-AI soak for N sim-minutes
```

The e2e tools play against the live AI, so individual assertions can fail on unlucky runs — rerun before treating a failure as real.

URL params: `?webgl=1` force WebGL2 · `?menu=0` skip menu · `?ai=1` AI demo · `?controls=classic` classic scheme · `?cam=x,y,z` debug orbit camera · `?frames=N` stop after N frames · `?difficulty=easy|medium|hard` · `?period=seconds`

Deployment: every push to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
