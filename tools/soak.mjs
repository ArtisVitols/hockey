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

// Formation discipline counters (structures per icehockeysystems.com).
// "Sustained offense" = same team possessing in the o-zone ≥ 2.5 s — D need
// transit time after a breakout, so only established zones are graded.
const disc = { dPointSamples: 0, dPointGood: 0, wCoverSamples: 0, wCoverGood: 0, dDeep: 0, dTotal: 0 }
const BLUE = 8.83
const CIRCLE_TOP = 15.3
const zoneTime = [0, 0]
let lastPoss = null

for (let chunk = 0; chunk < simMinutes * 2; chunk++) {
  // sample formations in short advances instead of one 30 s jump
  for (let s = 0; s < 60; s++) {
    await page.evaluate(() => window.__game.advance(0.5))
    const f = await page.evaluate(() => window.__game.formation())
    const m0 = await page.evaluate(() => window.__game.match())
    if (m0.phase !== 'play') {
      zoneTime[0] = zoneTime[1] = 0
      continue
    }
    if (f.possession !== null) lastPoss = f.possession
    for (const t of [0, 1]) {
      const a = f.attackDir[t]
      const puckAx = f.puck.x * a
      const team = f.teams[t]
      // effective possession survives pass flights (owner briefly null)
      const inZonePossession = lastPoss === t && puckAx > BLUE
      zoneTime[t] = inZonePossession ? zoneTime[t] + 0.5 : 0

      if (inZonePossession) {
        // hard invariant: attacking D never below the circle tops
        for (const p of team.filter((p) => p.role.startsWith('D'))) {
          disc.dTotal++
          if (p.x * a > CIRCLE_TOP) disc.dDeep++
        }
      }
      if (zoneTime[t] >= 2.5) {
        // established offense: both D manning the points
        for (const p of team.filter((p) => p.role.startsWith('D'))) {
          disc.dPointSamples++
          const ax = p.x * a
          if (ax > BLUE - 4.5 && ax < BLUE + 2.5) disc.dPointGood++
        }
      }
      if (f.possession !== null && f.possession !== t && puckAx < -BLUE) {
        // defense: wingers higher (closer to our blue line) than both D
        const wingers = team.filter((p) => p.role === 'LW' || p.role === 'RW')
        const dmen = team.filter((p) => p.role.startsWith('D'))
        for (const w of wingers) {
          disc.wCoverSamples++
          if (dmen.every((d) => w.x * a > d.x * a)) disc.wCoverGood++
        }
      }
    }
  }
  const m = await page.evaluate(() => window.__game.match())
  const spread = await page.evaluate(() => window.__game.spread())
  console.log(
    `t+${(chunk + 1) * 30}s sim: phase=${m.phase} period=${m.period} clock=${m.clock.toFixed(0)} score=${m.score[0]}-${m.score[1]} spread=${spread.toFixed(1)}`,
  )
}

const pct = (g, s) => (s > 0 ? `${((100 * g) / s).toFixed(0)}% (${g}/${s})` : 'n/a')
console.log('D-AT-POINTS (established offense):', pct(disc.dPointGood, disc.dPointSamples))
console.log('D-CAUGHT-DEEP (should be ~0%):', pct(disc.dDeep, disc.dTotal))
console.log('WINGERS-COVER-POINTS (defense):', pct(disc.wCoverGood, disc.wCoverSamples))

const final = await page.evaluate(() => window.__game.match())
console.log('FINAL:', JSON.stringify(final))
console.log('ERRORS:', errors === 0 ? 'PASS (none)' : `FAIL (${errors})`)
console.log('SCORING:', final.score[0] + final.score[1] > 0 ? 'PASS (goals happened)' : 'WARN (0-0)')
await browser.close()
