import { chromium } from 'playwright-core'
import { homedir } from 'os'
const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
  headless: true,
  args: ['--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/?webgl=1&menu=0&controls=classic', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#loading.hidden', { timeout: 60000 })
await page.waitForTimeout(400)
// listen for keydown at page level
await page.evaluate(() => {
  window.__keys = []
  window.addEventListener('keydown', (e) => window.__keys.push(e.code))
})
await page.keyboard.down('ArrowRight')
await page.waitForTimeout(150)
const m0 = await page.evaluate(() => window.__game.match())
const p0 = await page.evaluate(() => window.__game.player())
await page.evaluate(() => window.__game.advance(2))
const p1 = await page.evaluate(() => window.__game.player())
const m1 = await page.evaluate(() => window.__game.match())
await page.keyboard.up('ArrowRight')
const keys = await page.evaluate(() => window.__keys)
console.log('keys seen:', JSON.stringify(keys))
console.log('phase:', m0.phase, '->', m1.phase)
console.log('player:', JSON.stringify(p0), '->', JSON.stringify(p1))
await browser.close()
