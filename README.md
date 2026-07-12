# Hockey Night

A 3D ice hockey game that runs in the browser. Three.js (WebGPU with WebGL2 fallback), TypeScript, Vite — no game engine, custom physics and AI.

**Play:** https://artisvitols.github.io/hockey/

## Features

- Glossy NHL-broadcast-style ice with real-time planar reflections
- Full 5v5 with faceoffs, offside, icing, periods, overtime
- Skinned, animated players; goalies with butterfly saves
- Team AI (roles, forecheck, passing) with three difficulties
- 1 player (WASD + mouse), local 2 player (gamepad), or AI demo mode
- Synthesized audio: goal horn, whistle, board hits, crowd

## Controls

Two schemes, selectable in the menu:

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
npm test           # rules unit tests (vitest)
npm run build      # production build to dist/
```

Headless verification (needs playwright-core chromium):

```bash
node tools/screenshot.mjs "http://localhost:5173/?webgl=1&frames=10" out.png
node tools/drive.mjs      # e2e: skate → possess → score → faceoff reset
node tools/soak.mjs 5     # AI-vs-AI soak for N sim-minutes
```

URL params: `?webgl=1` force WebGL2 · `?menu=0` skip menu · `?ai=1` AI demo · `?cam=x,y,z` debug orbit camera · `?difficulty=easy|medium|hard` · `?period=seconds`
