// AI-vs-AI soak: fast-forward N sim-minutes, verify play flows (score
// changes or at least faceoffs cycle), players spread out (no all-chase
// clump), and no page errors.
import { chromium } from 'playwright-core'
import { homedir } from 'os'

const simMinutes = parseFloat(process.argv[2] ?? '3')

const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
  headless: true,
  args: ['--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
let errors = 0
page.on('pageerror', (e) => {
  errors++
  console.log('[pageerror]', e.message)
})
await page.goto('http://localhost:5173/?webgl=1&ai=1', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#loading.hidden', { timeout: 60000 })
await page.waitForTimeout(500)

for (let chunk = 0; chunk < simMinutes * 2; chunk++) {
  await page.evaluate(() => window.__game.advance(30))
  const m = await page.evaluate(() => window.__game.match())
  const spread = await page.evaluate(() => {
    // clump metric: mean pairwise distance between all skaters
    const api = window.__game
    return api.spread ? api.spread() : -1
  })
  console.log(
    `t+${(chunk + 1) * 30}s sim: phase=${m.phase} period=${m.period} clock=${m.clock.toFixed(0)} score=${m.score[0]}-${m.score[1]} spread=${spread.toFixed?.(1) ?? spread}`,
  )
}

const final = await page.evaluate(() => window.__game.match())
console.log('FINAL:', JSON.stringify(final))
console.log('ERRORS:', errors === 0 ? 'PASS (none)' : `FAIL (${errors})`)
console.log('SCORING:', final.score[0] + final.score[1] > 0 ? 'PASS (goals happened)' : 'WARN (0-0)')
await browser.close()
