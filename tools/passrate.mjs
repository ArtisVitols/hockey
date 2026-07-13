// Measures targeted-pass completion in an AI-vs-AI game.
import { chromium } from 'playwright-core'
import { homedir } from 'os'
const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
  headless: true, args: ['--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 320, height: 200 } })
await page.goto('http://localhost:5173/?webgl=1&ai=1', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#loading.hidden', { timeout: 60000 })
await page.evaluate(() => window.__game.advance(240))
const s = await page.evaluate(() => window.__game.passStats())
const pct = s.attempts ? ((100 * s.completed) / s.attempts).toFixed(0) : 'n/a'
console.log(`PASS COMPLETION: ${pct}% (${s.completed}/${s.attempts}) over 4 sim-minutes`)
console.log(`  intercepted: ${s.intercepted} · missed (nobody got it): ${s.missed}`)
await browser.close()
