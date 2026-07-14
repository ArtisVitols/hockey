// Verifies the pause menu (Esc) and camera views: vertical-cam input remap,
// clock freeze while paused, camera switch + persistence.
import { chromium } from 'playwright-core'
import { homedir } from 'os'
const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
  headless: true, args: ['--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
await page.goto('http://localhost:5173/?webgl=1&menu=0&camview=vertical', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#loading.hidden', { timeout: 60000 })
await page.evaluate(() => window.__game.advance(4)) // through faceoff into play

// under the vertical cam, W (screen-up) must map to the attack direction
// (±x), not rink -z; assert on the post-rotation intent — position deltas
// race the auto-switcher (controlled identity can change mid-hold)
await page.keyboard.down('KeyW')
await page.evaluate(() => window.__game.advance(0.1))
const mv = await page.evaluate(() => window.__game.p1move())
await page.keyboard.up('KeyW')
await page.evaluate(() => window.__game.advance(0.1))
console.log(`W move intent under vertical cam: x=${mv.x.toFixed(2)} z=${mv.z.toFixed(2)}`)
const upIce = Math.abs(mv.x) > 0.9 && Math.abs(mv.z) < 0.1
console.log(upIce ? 'VERTICAL MOVE REMAP: PASS' : 'VERTICAL MOVE REMAP: FAIL')

// pause menu: Esc opens it and freezes the clock, camera click works, Esc resumes
await page.keyboard.press('Escape')
const menuVisible = await page.evaluate(() => !document.getElementById('pause-menu').classList.contains('hidden'))
const c1 = await page.evaluate(() => window.__game.match().clock)
await page.evaluate(() => window.__game.advance(2))
const c2 = await page.evaluate(() => window.__game.match().clock)
console.log(`PAUSE MENU: visible=${menuVisible} clockFrozen=${c1 === c2}`)
if (process.argv[2]) {
  // raw CDP capture — page.screenshot waits for frame stability that the
  // ~2 fps swiftshader render loop never reaches. The 0.3 s fade-in also
  // never advances under the starved animation clock, so force it off,
  // then give the compositor a few frames to paint the overlay.
  await page.addStyleTag({ content: '#pause-menu { transition: none; }' })
  await page.waitForTimeout(3000)
  const cdp = await page.context().newCDPSession(page)
  const shot = await cdp.send('Page.captureScreenshot')
  const { writeFileSync } = await import('fs')
  writeFileSync(process.argv[2], Buffer.from(shot.data, 'base64'))
}
await page.click('#pause-menu button[data-v="broadcast"]')
await page.click('#pause-menu button[data-action="resume"]')
const resumed = await page.evaluate(() => document.getElementById('pause-menu').classList.contains('hidden'))
const saved = await page.evaluate(() => localStorage.getItem('hockey.camera'))
console.log(`RESUME: hidden=${resumed} savedCamera=${saved}`)
await browser.close()
