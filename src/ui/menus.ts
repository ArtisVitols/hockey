export type GameMode = '1p' | '2p' | 'demo'
export type ControlScheme = 'mouse' | 'classic'

export interface MenuResult {
  mode: GameMode
  difficulty: 'easy' | 'medium' | 'hard'
  periodSeconds: number
  controls: ControlScheme
}

const key = (label: string, wide = false) => `<kbd class="key${wide ? ' wide' : ''}">${label}</kbd>`
const row = (keys: string, desc: string) =>
  `<div class="ctl-row"><span class="keys">${keys}</span><span class="desc">${desc}</span></div>`
const OR = `<span class="or">or</span>`

function controlsSections(): string {
  const wasd = `
    <span class="key-cluster">
      <span class="krow">${key('W')}</span>
      <span class="krow">${key('A')}${key('S')}${key('D')}</span>
      <span class="kcap">SKATE</span>
    </span>`
  const arrows = `
    <span class="key-cluster">
      <span class="krow">${key('↑')}</span>
      <span class="krow">${key('←')}${key('↓')}${key('→')}</span>
      <span class="kcap">SKATE</span>
    </span>`

  const mouse = `
    <div class="ctl-section show" data-section="mouse">
      ${wasd}
      <div class="ctl-rows">
        <div class="ctl-head">Aiming &amp; shooting</div>
        ${row('🖱 move', 'Aim — the white ring on the ice is your target')}
        ${row('🖱 left <small>hold</small>', 'Slap shot — charge bar fills, release to fire')}
        ${row('🖱 left <small>tap</small>', 'Wrist shot — quick low snap')}
        ${row(`🖱 right ${OR} ${key('E')}`, 'Pass — snaps to the teammate you point at')}
        <div class="ctl-head">Actions</div>
        ${row(key('F'), 'Poke check — knock the puck off a carrier')}
        ${row(key('Space', true), 'Body check — flatten a nearby opponent')}
        ${row(key('Q'), 'Deke — quick sidestep with the puck')}
        ${row(key('Shift', true), 'Sprint')}
        <div class="ctl-head">Game</div>
        ${row(key('F9'), 'Pull your goalie (empty net) / send back')}
        ${row(key('Esc'), 'Pause')}
      </div>
    </div>`

  const classic = `
    <div class="ctl-section" data-section="classic">
      ${arrows}
      <div class="ctl-rows">
        <div class="ctl-head">With the puck</div>
        ${row(key('S'), 'Pass — auto-targets your most open teammate')}
        ${row(key('D'), 'Wrist shot — auto-aims at the far corner')}
        ${row(`${key('Space', true)} ${OR} ${key('W')}`, 'Slap shot — hold to charge, release to fire')}
        ${row(key('A'), 'Deke — hold ↑ or ↓ to pick the side')}
        <div class="ctl-head">Without the puck</div>
        ${row(key('S'), 'Switch to the teammate nearest the puck')}
        ${row(key('D'), 'Poke check')}
        ${row(`${key('Space', true)} ${OR} ${key('W')}`, 'Body check')}
        <div class="ctl-head">Always</div>
        ${row(`${key('E')} ${OR} ${key('Shift', true)}`, 'Sprint')}
        ${row(key('F9'), 'Pull your goalie / send back')}
        ${row(key('Esc'), 'Pause')}
      </div>
    </div>`

  const pad = `
    <div class="ctl-section" data-section="pad">
      <svg class="gamepad-svg" width="360" height="170" viewBox="0 0 360 170">
        <path d="M60 30 h240 q40 0 45 45 q5 45 -15 60 q-20 15 -40 -10 l-15 -18 h-190 l-15 18 q-20 25 -40 10 q-20 -15 -15 -60 q5 -45 45 -45 z"
              fill="#1a2130" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
        <circle cx="110" cy="65" r="20" fill="#0d1119" stroke="#7fa8ff" stroke-width="2.5"/>
        <circle cx="110" cy="65" r="9" fill="#2a3242"/>
        <circle cx="215" cy="100" r="18" fill="#0d1119" stroke="#ffd166" stroke-width="2.5"/>
        <circle cx="215" cy="100" r="8" fill="#2a3242"/>
        <g fill="#0d1119" stroke="rgba(255,255,255,0.35)" stroke-width="1.5">
          <circle cx="272" cy="82" r="9"/>
          <circle cx="292" cy="62" r="9"/>
          <circle cx="312" cy="82" r="9"/>
          <circle cx="292" cy="102" r="9"/>
        </g>
        <text x="272" y="86" fill="#ff8a96" font-size="10" text-anchor="middle" font-weight="bold">X</text>
        <text x="292" y="106" fill="#7fdb8a" font-size="10" text-anchor="middle" font-weight="bold">A</text>
        <rect x="70" y="12" width="52" height="12" rx="6" fill="#0d1119" stroke="#ff8a96" stroke-width="2"/>
        <rect x="238" y="12" width="52" height="12" rx="6" fill="#0d1119" stroke="#7fdb8a" stroke-width="2"/>
        <g fill="#0d1119" stroke="rgba(255,255,255,0.35)" stroke-width="1.5">
          <rect x="140" y="92" width="16" height="42" rx="4" transform="rotate(0)"/>
        </g>
        <path d="M140 106 h-10 M156 106 h10 M148 92 v-6 M148 134 v6" stroke="rgba(255,255,255,0.2)"/>
        <text x="110" y="42" fill="#7fa8ff" font-size="10" text-anchor="middle">LEFT STICK · SKATE</text>
        <text x="215" y="140" fill="#ffd166" font-size="10" text-anchor="middle">RIGHT STICK · AIM</text>
        <text x="96" y="9" fill="#ff8a96" font-size="10" text-anchor="middle">LB · PASS</text>
        <text x="264" y="9" fill="#7fdb8a" font-size="10" text-anchor="middle">RT · SHOOT</text>
      </svg>
      <div class="ctl-rows">
        ${row('Left stick', 'Skate')}
        ${row('Right stick', 'Aim (relative to your skater)')}
        ${row(`RT ${OR} A`, 'Shoot — hold to charge, release to fire')}
        ${row(`LB ${OR} X`, 'Pass')}
        ${row(`L3 ${OR} LT`, 'Sprint')}
        ${row('', '<small>Player 2 in 2-player mode. Any standard controller — plug in and press a button.</small>')}
      </div>
    </div>`

  return mouse + classic + pad
}

const HELP: Record<ControlScheme, string> = {
  mouse:
    'WASD skate · mouse aim · hold LMB slap shot, tap LMB wrist shot · E / RMB pass to teammate you point at · F poke · Space body check · Q deke · Shift sprint · F9 pull goalie · Esc pause',
  classic:
    'Arrows skate · with puck: S pass, D wrist shot, hold Space/W slap shot, A deke · without: S switch, D poke, Space/W body check · E/Shift sprint · F9 pull goalie · Esc pause',
}

// DOM main menu over the live (attract-mode) arena.
export class Menu {
  onStart: ((r: MenuResult) => void) | null = null
  private root: HTMLDivElement
  private difficulty: MenuResult['difficulty'] = 'medium'
  private periodSeconds = 180
  private controls: ControlScheme = 'mouse'

  constructor() {
    this.root = document.createElement('div')
    this.root.id = 'menu'
    this.root.innerHTML = `
      <div class="menu-card">
        <h1>HOCKEY NIGHT</h1>
        <div class="menu-row" data-group="difficulty">
          <span>Difficulty</span>
          <button data-v="easy">Easy</button>
          <button data-v="medium" class="sel">Medium</button>
          <button data-v="hard">Hard</button>
        </div>
        <div class="menu-row" data-group="period">
          <span>Period</span>
          <button data-v="60">1 min</button>
          <button data-v="180" class="sel">3 min</button>
          <button data-v="300">5 min</button>
        </div>
        <div class="menu-row" data-group="controls">
          <span>Controls</span>
          <button data-v="mouse" class="sel">Mouse aim</button>
          <button data-v="classic">Classic (NHL 09)</button>
        </div>
        <div class="menu-start">
          <button class="big" data-mode="1p">1 PLAYER</button>
          <button class="big" data-mode="2p">2 PLAYERS <small>(P2: gamepad)</small></button>
          <button class="big ghost" data-mode="demo">WATCH AI DEMO</button>
        </div>
        <p class="menu-help">${HELP.mouse}</p>
        <button class="link" data-action="show-controls">CONTROLS GUIDE</button>
      </div>
      <div class="menu-card controls-card" hidden>
        <h1>CONTROLS</h1>
        <div class="ctl-tabs" data-group="ctl-tab">
          <button data-v="mouse" class="sel">Mouse aim</button>
          <button data-v="classic">Classic (NHL 09)</button>
          <button data-v="pad">Gamepad (P2)</button>
        </div>
        ${controlsSections()}
        <div class="menu-start">
          <button class="big ghost" data-action="back">BACK</button>
        </div>
      </div>`
    document.body.appendChild(this.root)

    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button')
      if (!btn) return

      // controls guide navigation
      const action = btn.getAttribute('data-action')
      if (action === 'show-controls' || action === 'back') {
        const main = this.root.querySelector<HTMLElement>('.menu-card:not(.controls-card)')!
        const guide = this.root.querySelector<HTMLElement>('.controls-card')!
        main.hidden = action === 'show-controls'
        guide.hidden = action === 'back'
        return
      }

      const group = btn.parentElement?.getAttribute('data-group')
      if (group === 'ctl-tab') {
        for (const b of btn.parentElement!.querySelectorAll('button')) b.classList.remove('sel')
        btn.classList.add('sel')
        const v = btn.getAttribute('data-v')!
        for (const s of this.root.querySelectorAll<HTMLElement>('.ctl-section')) {
          s.classList.toggle('show', s.getAttribute('data-section') === v)
        }
        return
      }
      if (group) {
        for (const b of btn.parentElement!.querySelectorAll('button')) b.classList.remove('sel')
        btn.classList.add('sel')
        const v = btn.getAttribute('data-v')!
        if (group === 'difficulty') this.difficulty = v as MenuResult['difficulty']
        else if (group === 'controls') {
          this.controls = v as ControlScheme
          this.root.querySelector('.menu-help')!.textContent = HELP[this.controls]
        } else this.periodSeconds = parseInt(v, 10)
        return
      }
      const mode = btn.getAttribute('data-mode') as GameMode | null
      if (mode) {
        this.hide()
        this.onStart?.({
          mode,
          difficulty: this.difficulty,
          periodSeconds: this.periodSeconds,
          controls: this.controls,
        })
      }
    })
  }

  show(): void {
    this.root.classList.remove('hidden')
  }

  hide(): void {
    this.root.classList.add('hidden')
  }
}
