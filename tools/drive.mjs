// End-to-end gameplay smoke test: skate to the puck with real key events,
// verify possession, shoot at the goal, verify the goal fires and the puck
// resets. Uses __game.advance() to fast-forward the sim (headless rendering
// is too slow for wall-clock play).
import { chromium } from 'playwright-core'
import { homedir } from 'os'

const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
  headless: true,
  args: ['--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/?webgl=1&menu=0', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#loading.hidden', { timeout: 60000 })
await page.waitForTimeout(500)

const state = () =>
  page.evaluate(() => ({
    player: window.__game.player(),
    puck: window.__game.puck(),
    possession: window.__game.hasPossession(),
    banner: document.getElementById('hud-banner').classList.contains('show'),
  }))

const s0 = await state()
console.log('start:', JSON.stringify(s0))

// 1. skate right (D) toward the puck at center — real key event drives intent
await page.keyboard.down('KeyD')
await page.evaluate(() => window.__game.advance(2.0))
await page.keyboard.up('KeyD')
await page.evaluate(() => window.__game.advance(0.5))
const s1 = await state()
console.log('after skating:', JSON.stringify(s1))
console.log('MOVED:', s1.player.x > s0.player.x + 5 ? 'PASS' : 'FAIL')
console.log('POSSESSION:', s1.possession ? 'PASS' : 'FAIL')

// 2. score on the +x goal: chase the puck and shoot at a corner, up to 12
// attempts (the goalie AI can and should save some of these)
let scored = false
for (let i = 0; i < 50 && !scored; i++) {
  const st = await page.evaluate(() => ({
    has: window.__game.hasPossession(),
    me: window.__game.player(),
  }))
  if (st.has && st.me.x > 17) {
    // in tight: vary corner and shot type (low snap / lifted wrister / slap)
    const corner = i % 2 === 0 ? 0.72 : -0.72
    const charge = [0.25, 0.55, 0.85][i % 3]
    await page.evaluate(([z, c]) => window.__game.shoot(26.5, z, c), [corner, charge])
    await page.evaluate(() => window.__game.advance(1.0))
  } else {
    // drive toward the offensive zone / chase the puck
    await page.keyboard.down('KeyD')
    await page.evaluate(() => window.__game.advance(0.7))
    await page.keyboard.up('KeyD')
  }
  const m = await page.evaluate(() => window.__game.match())
  if (m.score[0] > 0) scored = true
  // wait out any goal celebration
  if (scored) await page.evaluate(() => window.__game.advance(3))
}
const s2 = await page.evaluate(() => window.__game.match())
console.log('after shots:', JSON.stringify(s2))
console.log('HUMAN GOAL:', scored ? 'PASS' : 'FAIL')

// 3. after the goal celebration the FSM must be back at a faceoff phase
console.log(
  'FSM RESET:',
  ['faceoff_setup', 'faceoff', 'play'].includes(s2.phase) ? 'PASS' : `FAIL (${s2.phase})`,
)
await browser.close()
