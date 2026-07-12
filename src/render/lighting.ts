import {
  BoxGeometry,
  CanvasTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SRGBColorSpace,
} from 'three'
import { RINK } from '../config'

// Broadcast-style rig: procedural arena environment map for IBL (light banks
// reflect in the ice), one shadow-casting key light, emissive fixture meshes.
export function setupLighting(scene: Scene): void {
  const env = makeArenaEnvironment()
  scene.environment = env
  scene.environmentIntensity = 0.85
  scene.background = env
  scene.backgroundIntensity = 0.5
  scene.backgroundBlurriness = 0.04

  const key = new DirectionalLight(0xffffff, 1.9)
  key.position.set(10, 26, 8)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -RINK.halfLength - 2
  key.shadow.camera.right = RINK.halfLength + 2
  key.shadow.camera.top = RINK.halfWidth + 2
  key.shadow.camera.bottom = -RINK.halfWidth - 2
  key.shadow.camera.near = 4
  key.shadow.camera.far = 60
  key.shadow.bias = -0.0004
  scene.add(key)

  scene.add(new HemisphereLight(0xdfe8f5, 0x2a3038, 0.4))

  scene.add(buildLightFixtures())
}

// Emissive light-bank meshes above the rink — their glow is what the planar
// reflection shows streaking across the ice. NHL ceilings are dense with
// light banks, so build a full truss grid plus a center-hung jumbotron.
function buildLightFixtures(): Group {
  const group = new Group()
  const bankGeo = new BoxGeometry(3.6, 0.22, 1.5)
  const bankMat = new MeshStandardMaterial({
    color: 0x0d0f13,
    emissive: 0xf4f8ff,
    emissiveIntensity: 6,
    roughness: 0.6,
  })
  const trussGeo = new BoxGeometry(64, 0.35, 0.35)
  const trussMat = new MeshStandardMaterial({ color: 0x22262c, roughness: 0.7, metalness: 0.5 })

  for (const z of [-8.5, -3, 3, 8.5]) {
    const truss = new Mesh(trussGeo, trussMat)
    truss.position.set(0, 15.8, z)
    group.add(truss)
    for (const x of [-25, -17.5, -10, 10, 17.5, 25]) {
      const fixture = new Mesh(bankGeo, bankMat)
      fixture.position.set(x, 15.5, z)
      group.add(fixture)
    }
  }

  // center-hung jumbotron: dark cube with four glowing screen faces
  const jumbotron = new Group()
  const body = new Mesh(
    new BoxGeometry(7, 4.5, 7),
    new MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.3 }),
  )
  jumbotron.add(body)
  const screenMat = new MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x99bbee,
    emissiveIntensity: 2.2,
    roughness: 0.4,
  })
  const screenGeo = new BoxGeometry(6.2, 3.2, 0.15)
  for (let i = 0; i < 4; i++) {
    const screen = new Mesh(screenGeo, screenMat)
    screen.rotation.y = (i * Math.PI) / 2
    screen.position.set(Math.sin((i * Math.PI) / 2) * 3.55, 0, Math.cos((i * Math.PI) / 2) * 3.55)
    jumbotron.add(screen)
  }
  jumbotron.position.set(0, 13, 0)
  group.add(jumbotron)

  return group
}

// Procedural equirect arena: dark dome, ring of bright light banks high up,
// faint stands glow near the horizon.
function makeArenaEnvironment(): CanvasTexture {
  const w = 2048
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  // vertical gradient: zenith (v=0) very dark → horizon glow → floor bounce
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#07090e')
  grad.addColorStop(0.38, '#0b0f16')
  grad.addColorStop(0.5, '#232b38')
  grad.addColorStop(0.56, '#2c3442')
  grad.addColorStop(0.75, '#3d4653')
  grad.addColorStop(1, '#4d5866')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // stands: banded seat blocks just below the horizon
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w
    const y = h * (0.52 + Math.random() * 0.12)
    ctx.fillStyle = `rgba(${30 + Math.random() * 40}, ${34 + Math.random() * 30}, ${50 + Math.random() * 40}, 0.5)`
    ctx.fillRect(x, y, 30 + Math.random() * 80, 8 + Math.random() * 18)
  }

  // ring of bright light banks (zenith region of the equirect)
  const banks = 14
  for (let i = 0; i < banks; i++) {
    const cx = ((i + 0.5) / banks) * w
    const cy = h * 0.24
    const bw = w * 0.028
    const bh = h * 0.05
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, bw * 2.2)
    glow.addColorStop(0, 'rgba(255,255,255,0.95)')
    glow.addColorStop(0.4, 'rgba(220,232,255,0.35)')
    glow.addColorStop(1, 'rgba(200,220,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(cx - bw * 2.5, cy - bw * 2.5, bw * 5, bw * 5)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh)
  }

  // scattered tiny camera-flash sparkles in the stands
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.3})`
    const x = Math.random() * w
    const y = h * (0.5 + Math.random() * 0.14)
    ctx.fillRect(x, y, 2, 2)
  }

  const tex = new CanvasTexture(canvas)
  tex.mapping = EquirectangularReflectionMapping
  tex.colorSpace = SRGBColorSpace
  return tex
}
