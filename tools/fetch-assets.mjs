// One-shot asset fetch: downloads the Xbot rigged mannequin from the
// three.js repository into public/assets/models/. Run once; the file is
// committed to the repo afterwards.
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const url = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb'
const out = join(root, 'public/assets/models/xbot.glb')

const res = await fetch(url)
if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
const buf = Buffer.from(await res.arrayBuffer())
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, buf)
console.log(`wrote ${out} (${(buf.length / 1e6).toFixed(2)} MB)`)
