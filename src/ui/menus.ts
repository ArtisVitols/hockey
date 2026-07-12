export type GameMode = '1p' | '2p' | 'demo'

export interface MenuResult {
  mode: GameMode
  difficulty: 'easy' | 'medium' | 'hard'
  periodSeconds: number
}

// DOM main menu over the live (attract-mode) arena.
export class Menu {
  onStart: ((r: MenuResult) => void) | null = null
  private root: HTMLDivElement
  private difficulty: MenuResult['difficulty'] = 'medium'
  private periodSeconds = 180

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
        <div class="menu-start">
          <button class="big" data-mode="1p">1 PLAYER</button>
          <button class="big" data-mode="2p">2 PLAYERS <small>(P2: gamepad)</small></button>
          <button class="big ghost" data-mode="demo">WATCH AI DEMO</button>
        </div>
        <p class="menu-help">WASD skate · mouse aim · hold LMB shoot · E / RMB pass · Shift sprint · Esc pause</p>
      </div>`
    document.body.appendChild(this.root)

    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button')
      if (!btn) return
      const group = btn.parentElement?.getAttribute('data-group')
      if (group) {
        for (const b of btn.parentElement!.querySelectorAll('button')) b.classList.remove('sel')
        btn.classList.add('sel')
        const v = btn.getAttribute('data-v')!
        if (group === 'difficulty') this.difficulty = v as MenuResult['difficulty']
        else this.periodSeconds = parseInt(v, 10)
        return
      }
      const mode = btn.getAttribute('data-mode') as GameMode | null
      if (mode) {
        this.hide()
        this.onStart?.({ mode, difficulty: this.difficulty, periodSeconds: this.periodSeconds })
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
