import { chromium } from 'playwright-core'
import { homedir } from 'os'

const url = process.argv[2] ?? 'http://localhost:5173/'
const out = process.argv[3] ?? 'shot.png'

const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
  ],
})
const width = parseInt(process.argv[4] ?? '960', 10)
const height = parseInt(process.argv[5] ?? '540', 10)
const page = await browser.newPage({ viewport: { width, height } })
const logs = []
let stopped = false
page.on('console', (m) => {
  logs.push(`[${m.type()}] ${m.text()}`)
  if (m.text().includes('render loop stopped')) stopped = true
})
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(url, { waitUntil: 'domcontentloaded' })
// wait up to 90s for the game to report its loop has stopped
for (let i = 0; i < 90 && !stopped; i++) await page.waitForTimeout(1000)
console.log('STOPPED:', stopped)
const badge = await page.textContent('#backend-badge').catch(() => '?')
const loadingHidden = await page.$eval('#loading', (el) => el.classList.contains('hidden')).catch(() => '?')
console.log('BADGE:', JSON.stringify(badge), 'loadingHidden:', loadingHidden)
console.log(logs.slice(0, 40).join('\n'))
try {
  await page.screenshot({ path: out, timeout: 20000 })
  console.log('SCREENSHOT OK:', out)
} catch (e) {
  console.log('SCREENSHOT FAILED:', e.message.split('\n')[0])
}
await browser.close()
