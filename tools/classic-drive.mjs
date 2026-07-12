// E2E for the classic (NHL 09) scheme: arrows skate, D = wrist shot /
// poke, Space = slap shot / body check, S = pass / switch, F9 pulls the
// goalie. Uses real key events + __game.advance() sim fast-forward.
// The game sim is live (AI opponents, faceoff coin-flips, stoppages), so
// every assertion retries rather than racing a single attempt.
import { chromium } from 'playwright-core'
import { homedir } from 'os'

const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
  headless: true,
  args: ['--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/?webgl=1&menu=0&controls=classic', {
  waitUntil: 'domcontentloaded',
})
await page.waitForSelector('#loading.hidden', { timeout: 60000 })
await page.waitForTimeout(500)

const state = () =>
  page.evaluate(() => ({
    player: window.__game.player(),
    puck: window.__game.puck(),
    possession: window.__game.hasPossession(),
    match: window.__game.match(),
  }))
const advance = (s) => page.evaluate((sec) => window.__game.advance(sec), s)
const waitForPlay = async () => {
  for (let i = 0; i < 12; i++) {
    const m = await page.evaluate(() => window.__game.match())
    if (m.phase === 'play') return true
    await advance(0.5)
  }
  return false
}
// skate toward a world point using arrow keys for `sec` sim-seconds
const skateToward = async (tx, tz, sec) => {
  const me = (await state()).player
  const keyX = tx > me.x + 0.3 ? 'ArrowRight' : tx < me.x - 0.3 ? 'ArrowLeft' : null
  const keyZ = tz > me.z + 0.3 ? 'ArrowDown' : tz < me.z - 0.3 ? 'ArrowUp' : null
  if (keyX) await page.keyboard.down(keyX)
  if (keyZ) await page.keyboard.down(keyZ)
  await advance(sec)
  if (keyX) await page.keyboard.up(keyX)
  if (keyZ) await page.keyboard.up(keyZ)
}

// 1. arrows move the player (retry around stoppage teleports)
let moved = false
for (let i = 0; i < 5 && !moved; i++) {
  if (!(await waitForPlay())) break
  // 1.5 s window: enough to brake out of an inherited leftward glide and
  // still gain ground to the right
  const before = (await state()).player
  await page.keyboard.down('ArrowRight')
  await advance(1.5)
  await page.keyboard.up('ArrowRight')
  const after = (await state()).player
  moved = after.x - before.x > 2.5
}
console.log('MOVED (arrows):', moved ? 'PASS' : 'FAIL')

// 2. chase the puck until we possess it — poke check (D) when in reach,
// exactly how a real defender strips a CPU carrier
let possession = false
for (let i = 0; i < 40 && !possession; i++) {
  await waitForPlay()
  const s = await state()
  const reach = Math.hypot(s.puck.x - s.player.x, s.puck.z - s.player.z)
  if (reach < 1.6) await page.keyboard.press('KeyD')
  await skateToward(s.puck.x, s.puck.z, 0.5)
  possession = (await state()).possession
}
console.log('POSSESSION:', possession ? 'PASS' : 'FAIL')

// 3. D = wrist shot (auto-aim): puck leaves the stick at speed
if (possession) {
  const before = await page.evaluate(() => window.__game.puck())
  await page.keyboard.press('KeyD')
  await advance(0.35)
  const after = await page.evaluate(() => ({
    puck: window.__game.puck(),
    poss: window.__game.hasPossession(),
  }))
  const dist = Math.hypot(after.puck.x - before.x, after.puck.z - before.z)
  console.log('WRIST SHOT (D):', dist > 2 && !after.poss ? 'PASS' : `FAIL (${dist.toFixed(1)})`)
} else {
  console.log('WRIST SHOT (D): SKIP')
}

// 4. score with classic keys: regain puck, drive in, snap or slap
let scored = false
for (let i = 0; i < 100 && !scored; i++) {
  await waitForPlay()
  const st = await state()
  if (st.possession && st.player.x > 17) {
    if (i % 2 === 0) {
      await page.keyboard.press('KeyD')
    } else {
      await page.keyboard.down('Space')
      await advance(0.7)
      await page.keyboard.up('Space')
    }
    await advance(1.0)
  } else if (st.possession) {
    await skateToward(26, st.player.z * 0.5, 0.7)
  } else {
    const reach = Math.hypot(st.puck.x - st.player.x, st.puck.z - st.player.z)
    if (reach < 1.6) await page.keyboard.press('KeyD') // poke it loose
    await skateToward(st.puck.x, st.puck.z, 0.7)
  }
  const m = await page.evaluate(() => window.__game.match())
  if (m.score[0] > 0) scored = true
  if (scored) await advance(3)
}
console.log('GOAL (classic):', scored ? 'PASS' : 'FAIL')

// 5. S without the puck = manual switch (shoot first if we carry it)
let switched = false
for (let i = 0; i < 6 && !switched; i++) {
  if ((await state()).possession) {
    await page.keyboard.press('KeyD')
    await advance(0.5)
    continue
  }
  const before = await page.evaluate(() => window.__game.player())
  await page.keyboard.press('KeyS')
  await advance(0.1)
  const after = await page.evaluate(() => window.__game.player())
  switched = Math.hypot(after.x - before.x, after.z - before.z) > 0.5
}
console.log('SWITCH (S):', switched ? 'PASS' : 'FAIL')

// 6. F9 pulls the goalie: it leaves the crease area
const gBefore = await page.evaluate(() => window.__game.goalie(0))
await page.keyboard.press('F9')
await advance(4)
const gAfter = await page.evaluate(() => window.__game.goalie(0))
const pulled = Math.hypot(gAfter.x - gBefore.x, gAfter.z - gBefore.z) > 4
console.log('PULL GOALIE (F9):', pulled ? 'PASS' : 'FAIL')

await browser.close()
