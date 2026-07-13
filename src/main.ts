import {
  Scene,
  Mesh,
  CylinderGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  RingGeometry,
  PointLight,
  Vector3,
} from 'three'
import { createRenderer, backendName } from './render/renderer'
import { createOrbitCamera } from './render/camera'
import { FollowCamera } from './render/followCamera'
import { setupLighting } from './render/lighting'
import { createPostProcessing } from './render/postfx'
import { buildRink } from './arena/rink'
import { buildNets } from './arena/nets'
import { World } from './physics/world'
import { Engine } from './core/engine'
import { KeyboardMouseInput } from './input/keyboardMouse'
import { ClassicKeyboardInput } from './input/classicKeyboard'
import { PlayerSwitcher } from './input/switching'
import { autoShotTarget, pickOpenMate, leadPoint } from './ai/targeting'
import type { ControlScheme } from './ui/menus'
import { PlayerVisual } from './players/playerVisual'
import { TEAMS, SKATER_ROLES, lineupPosition } from './game/teams'
import { Match } from './game/match'
import { TeamBrain } from './ai/teamBrain'
import { GoalieBrain } from './ai/goalieBrain'
import { DIFFICULTIES } from './ai/skaterBrain'
import { buildCrowd } from './arena/crowd'
import { Sound } from './audio/sound'
import { GamepadInput } from './input/gamepad'
import { Menu, type GameMode } from './ui/menus'
import { emptyIntent } from './input/intent'
import { PUCK, GOAL } from './config'
import { wantsWebGLFallback } from './core/quality'
import { loadPlayerModel } from './core/assets'
import type { SkaterBody } from './physics/skaterBody'

async function start() {
  const container = document.getElementById('app')!
  const badge = document.getElementById('backend-badge')!
  const loading = document.getElementById('loading')!
  const banner = document.getElementById('hud-banner')!
  const chargeFill = document.getElementById('charge-fill')!

  const [renderer, playerModel] = await Promise.all([
    createRenderer(container, wantsWebGLFallback()),
    loadPlayerModel(),
  ])
  const scene = new Scene()

  const params = new URLSearchParams(window.location.search)
  const useOrbit = params.get('cam') !== null

  const follow = new FollowCamera()
  const orbit = useOrbit ? createOrbitCamera(renderer.domElement) : null
  const camera = orbit ? orbit.camera : follow.camera

  setupLighting(scene)
  scene.add(buildRink().group)
  scene.add(buildNets())
  scene.add(buildCrowd())

  // ---- teams: bodies + visuals; human controls team 0
  const world = new World()
  const teamSkaters: [SkaterBody[], SkaterBody[]] = [[], []]
  const goalies: SkaterBody[] = []
  const visuals = new Map<SkaterBody, PlayerVisual>()

  for (const ti of [0, 1] as const) {
    const def = TEAMS[ti]
    for (const role of SKATER_ROLES) {
      const p = lineupPosition(role, def.defends)
      const body = world.addSkater(p.x, p.z)
      body.heading = def.defends === -1 ? 0 : Math.PI
      world.intents.set(body, emptyIntent())
      world.teamOf.set(body, ti)
      teamSkaters[ti].push(body)
      const visual = new PlayerVisual(def.colors, false, playerModel)
      visuals.set(body, visual)
      scene.add(visual.group)
    }
    // goalie: physics body outside the switch pool
    const gp = lineupPosition('G', def.defends)
    const goalie = world.addSkater(gp.x, gp.z)
    goalie.heading = def.defends === -1 ? 0 : Math.PI
    world.intents.set(goalie, emptyIntent())
    world.teamOf.set(goalie, ti)
    goalies.push(goalie)
    const goalieVisual = new PlayerVisual(def.colors, true, playerModel)
    visuals.set(goalie, goalieVisual)
    scene.add(goalieVisual.group)
  }

  // P1 input: both schemes instantiated, one active at a time
  const input = new KeyboardMouseInput(camera)
  const classic = new ClassicKeyboardInput()
  let scheme: ControlScheme = params.get('controls') === 'classic' ? 'classic' : 'mouse'
  const activeInput = () => (scheme === 'classic' ? classic : input)
  const switcher = new PlayerSwitcher(teamSkaters[0])
  let controlled = switcher.current
  world.intents.set(controlled, activeInput().intent)

  // controlled-player indicator ring
  const controlRing = new Mesh(
    new RingGeometry(0.5, 0.62, 32),
    new MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.7 }),
  )
  controlRing.rotation.x = -Math.PI / 2
  controlRing.position.y = 0.012
  scene.add(controlRing)

  const puckMesh = new Mesh(
    new CylinderGeometry(PUCK.radius, PUCK.radius, PUCK.height, 24),
    new MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.35, metalness: 0.1 }),
  )
  puckMesh.castShadow = true
  puckMesh.scale.setScalar(2.2)
  scene.add(puckMesh)

  const aimRing = new Mesh(
    new RingGeometry(0.28, 0.36, 32),
    new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }),
  )
  aimRing.rotation.x = -Math.PI / 2
  aimRing.position.y = 0.01
  scene.add(aimRing)

  const goalLights = new Map<1 | -1, PointLight>()
  for (const side of [1, -1] as const) {
    const light = new PointLight(0xff2222, 0, 12)
    light.position.set(side * (GOAL.lineX + 1.5), 1.5, 0)
    scene.add(light)
    goalLights.set(side, light)
  }

  // ---- match flow: Match installs its own world.onGoal handler
  const periodParam = params.get('period')
  const match = new Match(world, teamSkaters, [goalies[0]!, goalies[1]!], {
    periodSeconds: periodParam ? parseInt(periodParam, 10) : 180,
  })

  // ---- AI: CPU team brain, human-team support brain, both goalies
  const difficulty = DIFFICULTIES[params.get('difficulty') ?? 'medium'] ?? DIFFICULTIES['medium']!
  const cpuBrain = new TeamBrain(1, teamSkaters[1], world, () => match.attackDirOf(1), difficulty, 7)
  const mateBrain = new TeamBrain(0, teamSkaters[0], world, () => match.attackDirOf(0), difficulty, 13)
  const goalieBrains = [
    new GoalieBrain(goalies[0]!, world, () => match.defendsOf(0)),
    new GoalieBrain(goalies[1]!, world, () => match.defendsOf(1)),
  ]
  for (const g of goalies) world.blockers.add(g)
  cpuBrain.onShot = (s) => visuals.get(s)?.anim.playShot()
  mateBrain.onShot = (s) => visuals.get(s)?.anim.playShot()

  const showBanner = (text: string, seconds: number) => {
    banner.textContent = text
    banner.classList.add('show')
    window.setTimeout(() => banner.classList.remove('show'), seconds * 1000)
  }

  match.onEvent = (e) => {
    switch (e.type) {
      case 'goal': {
        showBanner('GOAL!', 2.2)
        const side = match.defendsOf(e.scoringTeam === 0 ? 1 : 0)
        goalLights.get(side)!.intensity = 60
        window.setTimeout(() => {
          for (const l of goalLights.values()) l.intensity = 0
        }, 2200)
        sound.goalHorn()
        break
      }
      case 'offside':
        showBanner('OFFSIDE', 1.6)
        sound.whistle()
        break
      case 'icing':
        showBanner('ICING', 1.6)
        sound.whistle()
        break
      case 'period_end':
        showBanner(match.period >= 3 ? 'FINAL' : `END OF PERIOD ${match.period}`, 3)
        sound.whistle()
        break
      case 'period_start':
        showBanner(match.isOvertime() ? 'OVERTIME' : `PERIOD ${match.period}`, 2)
        break
      case 'puck_drop':
        sound.crowdSwell(0.18, 1.5)
        break
      case 'game_over': {
        const [a, b] = match.score
        const winner = a === b ? 'TIE' : a > b ? 'GLACIER WINS!' : 'NORTHBANK WINS!'
        showBanner(winner, 6)
        sound.goalHorn()
        window.setTimeout(() => menu.show(), 5000)
        mode = 'demo'
        window.setTimeout(() => match.restart(), 6500)
        break
      }
    }
  }

  // scoreboard elements
  const sbA = document.getElementById('sb-a')!
  const sbB = document.getElementById('sb-b')!
  const sbClock = document.getElementById('sb-clock')!
  const sbPeriod = document.getElementById('sb-period')!

  const post = createPostProcessing(renderer, scene, camera)

  let prevShootHeld = false

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // ---- game mode: menu-driven; `?ai=1` forces demo (soak tests),
  // `?menu=0` skips the menu straight into 1P (drive tests)
  let mode: GameMode = 'demo'
  const menu = new Menu()
  if (params.get('ai') !== null) {
    menu.hide()
  } else if (params.get('menu') === '0') {
    mode = '1p'
    menu.hide()
  }

  // ---- audio (starts on first user gesture)
  const sound = new Sound()
  const resumeAudio = () => sound.resume()
  window.addEventListener('pointerdown', resumeAudio)
  window.addEventListener('keydown', resumeAudio)
  world.puck.onBoardHit = (speed, x) => sound.boardHit(speed, x / 30)

  // ---- player 2 (gamepad)
  const pad = new GamepadInput()
  const switcher2 = new PlayerSwitcher(teamSkaters[1])
  let controlled2 = switcher2.current
  let prevPadShoot = false

  menu.onStart = (r) => {
    mode = r.mode
    scheme = r.controls
    classic.clearQueued()
    world.intents.set(controlled, activeInput().intent)
    const d = DIFFICULTIES[r.difficulty]!
    cpuBrain.diff = d
    mateBrain.diff = d
    match.restart(r.periodSeconds)
    sound.resume()
  }

  // pause (Escape) + pull goalie (F9 = your net, F10 = P2's net in 2P)
  let paused = false
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      paused = !paused
      banner.textContent = paused ? 'PAUSED' : ''
      banner.classList.toggle('show', paused)
    }
    const pull = e.code === 'F9' ? 0 : e.code === 'F10' && mode === '2p' ? 1 : -1
    if (pull >= 0 && mode !== 'demo') {
      e.preventDefault()
      const brain = goalieBrains[pull]!
      brain.enabled = !brain.enabled
      const goalie = goalies[pull]!
      if (brain.enabled) world.blockers.add(goalie)
      else world.blockers.delete(goalie)
      showBanner(brain.enabled ? 'GOALIE RETURNS' : 'GOALIE PULLED', 1.6)
    }
  })

  const engine = new Engine()

  // ---- P1 aim resolution: mouse scheme aims at the cursor, classic scheme
  // auto-aims (far goal corner for shots, most-open teammate for passes)
  const shotAim = () => {
    if (scheme === 'classic') return autoShotTarget(controlled, match.attackDirOf(0))
    const i = input.intent
    return { x: i.aimX, z: i.aimZ }
  }
  const passAim = () => {
    if (scheme === 'classic') {
      const best =
        pickOpenMate(controlled, teamSkaters[0], teamSkaters[1], match.attackDirOf(0), 0) ??
        pickOpenMate(controlled, teamSkaters[0], [], match.attackDirOf(0), 0)
      return best ? leadPoint(best) : autoShotTarget(controlled, match.attackDirOf(0))
    }
    const i = input.intent
    return { x: i.aimX, z: i.aimZ }
  }

  // Pick the teammate a human pass should go to. Classic auto-selects the
  // most open mate; mouse snaps to the teammate best matching the cursor
  // direction (within a generous cone) so passes land on sticks.
  const passReceiver = (): SkaterBody | null => {
    if (scheme === 'classic') {
      return (
        pickOpenMate(controlled, teamSkaters[0], teamSkaters[1], match.attackDirOf(0), 0) ??
        pickOpenMate(controlled, teamSkaters[0], [], match.attackDirOf(0), 0)
      )
    }
    const i = input.intent
    return coneReceiver(controlled, teamSkaters[0], i.aimX, i.aimZ)
  }

  // teammate best matching the aim direction, within a ~35° cone
  const coneReceiver = (
    from: SkaterBody,
    mates: SkaterBody[],
    aimX: number,
    aimZ: number,
  ): SkaterBody | null => {
    const dirX = aimX - from.pos.x
    const dirZ = aimZ - from.pos.z
    const dirLen = Math.hypot(dirX, dirZ)
    if (dirLen < 0.5) return null
    let best: SkaterBody | null = null
    let bestScore = -Infinity
    for (const m of mates) {
      if (m === from) continue
      const mx = m.pos.x - from.pos.x
      const mz = m.pos.z - from.pos.z
      const mLen = Math.hypot(mx, mz)
      if (mLen < 1.5) continue
      const cos = (mx * dirX + mz * dirZ) / (mLen * dirLen)
      if (cos < 0.82) continue
      // prefer alignment, slightly prefer mates near the aim point
      const aimDist = Math.hypot(m.pos.x - aimX, m.pos.z - aimZ)
      const score = cos * 10 - aimDist * 0.15
      if (score > bestScore) {
        bestScore = score
        best = m
      }
    }
    return best
  }

  const swapControlled = (next: SkaterBody) => {
    if (next === controlled) return
    world.intents.set(controlled, emptyIntent())
    world.intents.set(next, activeInput().intent)
    controlled = next
  }

  // P1 input + action triggers — called from the render loop AND the
  // headless advance() hook so key-driven actions work in both
  const updateP1 = (dt: number) => {
    if (mode === 'demo') return
    classic.hasPuck = world.possession.owner === controlled
    const active = activeInput()
    active.update(dt)

    swapControlled(switcher.update(world, dt))
    if (scheme === 'classic' && classic.switchRequested) {
      swapControlled(switcher.requestSwitch(world))
    }

    const i = active.intent
    const anim = () => visuals.get(controlled)?.anim

    if (prevShootHeld && !i.shootHeld) {
      const charge = active.consumeCharge()
      const t = shotAim()
      // a quick LMB tap in the mouse scheme is a wrist shot
      if (scheme === 'mouse' && input.wasTap) world.wristShot(controlled, t.x, t.z)
      else world.shoot(controlled, t.x, t.z, charge)
      anim()?.playShot()
    }
    prevShootHeld = i.shootHeld

    if (i.passPressed) {
      const receiver = passReceiver()
      if (receiver) world.passTo(controlled, receiver)
      else {
        // no teammate that way: dump the puck to the cursor point
        const t = passAim()
        world.pass(controlled, t.x, t.z)
      }
      anim()?.playShot()
    }
    if (i.wristShotPressed) {
      const t = shotAim()
      world.wristShot(controlled, t.x, t.z)
      anim()?.playShot()
    }
    if (i.pokePressed) {
      const ready = controlled.pokeCooldown <= 0
      world.pokeCheck(controlled)
      if (ready) anim()?.playPoke()
    }
    if (i.checkPressed) {
      const ready = controlled.checkCooldown <= 0
      const victim = world.bodyCheck(controlled)
      if (ready) anim()?.playCheck()
      if (victim) visuals.get(victim)?.anim.playStumble()
    }
    if (i.dekeDir !== 0) world.deke(controlled, i.dekeDir)
  }

  // one sim step — shared by the render loop and the headless test hook
  const stepSim = (stepDt: number) => {
    const playing = match.phase === 'play'
    cpuBrain.update(stepDt, playing, mode === '2p' ? controlled2 : null)
    mateBrain.update(stepDt, playing, mode === 'demo' ? null : controlled)
    for (const gb of goalieBrains) gb.update(stepDt, playing)
    world.step(stepDt)
    match.step(stepDt)
  }

  let frames = 0
  let fpsTime = 0
  let lastTime = performance.now()
  const backend = backendName(renderer)

  const framesParam = params.get('frames')
  const stopAfter = framesParam ? parseInt(framesParam, 10) : Infinity
  let frameCount = 0

  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const dt = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now

    if (!paused) updateP1(dt)

    // player 2 (gamepad) drives team 1 in 2P mode
    if (mode === '2p') {
      const next2 = switcher2.update(world)
      if (next2 !== controlled2) {
        world.intents.set(controlled2, emptyIntent())
        world.intents.set(next2, pad.intent)
        controlled2 = next2
      }
      pad.update(dt, controlled2)
      if (prevPadShoot && !pad.intent.shootHeld) {
        world.shoot(controlled2, pad.intent.aimX, pad.intent.aimZ, pad.consumeCharge())
        visuals.get(controlled2)?.anim.playShot()
      }
      prevPadShoot = pad.intent.shootHeld
      if (pad.intent.passPressed) {
        const rec2 = coneReceiver(controlled2, teamSkaters[1], pad.intent.aimX, pad.intent.aimZ)
        if (rec2) world.passTo(controlled2, rec2)
        else world.pass(controlled2, pad.intent.aimX, pad.intent.aimZ)
        visuals.get(controlled2)?.anim.playShot()
      }
    }

    const alpha = paused ? 1 : engine.advance(dt, stepSim)

    // goalie butterfly saves
    goalieBrains.forEach((gb, i) => {
      if (gb.saveTriggered) visuals.get(goalies[i]!)?.anim.playButterfly()
    })

    // scoreboard
    const m = Math.floor(match.clock / 60)
    const s = Math.floor(match.clock % 60)
    sbClock.textContent = `${m}:${s.toString().padStart(2, '0')}`
    sbA.textContent = `GLA ${match.score[0]}`
    sbB.textContent = `${match.score[1]} NOR`
    sbPeriod.textContent = match.isOvertime() ? 'OT' : `P${match.period}`

    for (const [body, visual] of visuals) {
      visual.sync(body, alpha, dt, world.puck.pos)
    }
    const tmp = puckMesh.position
    tmp.copy(world.puck.prevPos).lerp(world.puck.pos, alpha)
    controlRing.position.set(controlled.pos.x, 0.012, controlled.pos.z)
    aimRing.visible = scheme === 'mouse' && mode !== 'demo'
    aimRing.position.set(input.intent.aimX, 0.01, input.intent.aimZ)
    chargeFill.style.width = `${Math.round(activeInput().shootCharge * 100)}%`

    if (orbit) orbit.controls.update()
    else follow.update(dt, visuals.get(controlled)!.group.position, puckMesh.position)

    post.render()

    frames++
    fpsTime += dt
    if (fpsTime >= 1) {
      badge.textContent = `${backend} · ${Math.round(frames / fpsTime)} fps`
      frames = 0
      fpsTime = 0
    }

    if (++frameCount >= stopAfter) {
      renderer.setAnimationLoop(null)
      badge.textContent = `${backend} · stopped @ ${frameCount}`
      console.log(`[game] render loop stopped after ${frameCount} frames`)
    }
  })

  loading.classList.add('hidden')

  // headless test hook
  interface GameTestApi {
    player(): { x: number; z: number }
    puck(): { x: number; z: number }
    hasPossession(): boolean
    shoot(x: number, z: number, charge: number): void
    advance(seconds: number): void
    match(): { phase: string; period: number; clock: number; score: [number, number] }
    goalie(team: 0 | 1): { x: number; z: number }
    spread(): number
    formation(): unknown
    puckDebug(): { nearest: number; speed: number; y: number; owned: boolean }
    passStats(): { attempts: number; completed: number; intercepted: number; missed: number }
  }
  ;(window as unknown as { __game: GameTestApi }).__game = {
    player: () => ({ x: controlled.pos.x, z: controlled.pos.z }),
    puck: () => ({ x: world.puck.pos.x, z: world.puck.pos.z }),
    hasPossession: () => world.possession.owner === controlled,
    shoot: (x, z, charge) => world.shoot(controlled, x, z, charge),
    advance: (seconds: number) => {
      const stepDt = Engine.STEP
      const steps = Math.round(seconds / stepDt)
      for (let i = 0; i < steps; i++) {
        updateP1(stepDt)
        stepSim(stepDt)
      }
    },
    match: () => ({
      phase: match.phase,
      period: match.period,
      clock: match.clock,
      score: [match.score[0], match.score[1]],
    }),
    goalie: (team: 0 | 1) => ({ x: goalies[team]!.pos.x, z: goalies[team]!.pos.z }),
    passStats: () => ({ ...world.passStats }),
    // pickup diagnostics: nearest skater distance, puck speed/height
    puckDebug: () => {
      let best = Infinity
      for (const s of world.skaters) {
        const d = Math.hypot(s.pos.x - world.puck.pos.x, s.pos.z - world.puck.pos.z)
        if (d < best) best = d
      }
      return {
        nearest: best,
        speed: Math.hypot(world.puck.vel.x, world.puck.vel.z),
        y: world.puck.pos.y,
        owned: world.possession.owner !== null,
      }
    },
    // formation snapshot for tactical soak metrics
    formation: () => {
      const owner = world.possession.owner
      const ownerTeam = owner ? (world.teamOf.get(owner) ?? null) : null
      return {
        possession: ownerTeam,
        puck: { x: world.puck.pos.x, z: world.puck.pos.z },
        attackDir: [match.attackDirOf(0), match.attackDirOf(1)],
        teams: ([0, 1] as const).map((t) =>
          teamSkaters[t].map((s, i) => ({
            role: SKATER_ROLES[i]!,
            x: s.pos.x,
            z: s.pos.z,
          })),
        ),
      }
    },
    // mean pairwise skater distance — clump detector for AI soak tests
    spread: () => {
      let sum = 0
      let n = 0
      for (let i = 0; i < world.skaters.length; i++) {
        for (let j = i + 1; j < world.skaters.length; j++) {
          const a = world.skaters[i]!
          const b = world.skaters[j]!
          sum += Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z)
          n++
        }
      }
      return n ? sum / n : 0
    },
  }
}

start().catch((err) => {
  const loading = document.getElementById('loading')
  if (loading) loading.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`
  console.error(err)
})
