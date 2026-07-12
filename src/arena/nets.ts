import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  DoubleSide,
} from 'three'
import { GOAL } from '../config'

// Both goals: red frame (posts + crossbar + back frame) with netting quads.
export function buildNets(): Group {
  const group = new Group()
  for (const side of [-1, 1]) {
    const goal = buildGoal()
    goal.position.set(side * GOAL.lineX, 0, 0)
    // opening faces center ice
    goal.rotation.y = side > 0 ? Math.PI : 0
    group.add(goal)
  }
  return group
}

// Local frame: goal mouth at x=0 opening toward +x, net extends toward -x.
function buildGoal(): Group {
  const g = new Group()
  const red = new MeshStandardMaterial({ color: 0xc8102e, roughness: 0.4, metalness: 0.2 })
  const hw = GOAL.width / 2
  const r = GOAL.postRadius

  const post = new CylinderGeometry(r, r, GOAL.height, 12)
  for (const s of [-1, 1]) {
    const p = new Mesh(post, red)
    p.position.set(0, GOAL.height / 2, s * hw)
    p.castShadow = true
    g.add(p)
  }

  const crossbar = new Mesh(new CylinderGeometry(r, r, GOAL.width + r * 2, 12), red)
  crossbar.rotation.x = Math.PI / 2
  crossbar.position.set(0, GOAL.height, 0)
  crossbar.castShadow = true
  g.add(crossbar)

  // simplified back frame: two diagonal tubes down to the back bottom bar
  const backLen = Math.hypot(GOAL.depth, GOAL.height)
  const diag = new CylinderGeometry(r * 0.8, r * 0.8, backLen, 10)
  for (const s of [-1, 1]) {
    const d = new Mesh(diag, red)
    d.position.set(-GOAL.depth / 2, GOAL.height / 2, s * hw)
    d.rotation.z = Math.atan2(GOAL.depth, GOAL.height)
    g.add(d)
  }
  const backBar = new Mesh(new CylinderGeometry(r * 0.8, r * 0.8, GOAL.width, 10), red)
  backBar.rotation.x = Math.PI / 2
  backBar.position.set(-GOAL.depth, 0.04, 0)
  g.add(backBar)

  // netting
  const netTex = makeNetTexture()
  const netMat = new MeshStandardMaterial({
    map: netTex,
    alphaMap: netTex,
    alphaTest: 0.35,
    transparent: false,
    side: DoubleSide,
    roughness: 0.9,
    color: 0xf0f0f0,
  })
  // back panel (sloped from crossbar down to back bar)
  const back = new Mesh(new PlaneGeometry(backLen, GOAL.width), netMat)
  back.rotation.y = Math.PI / 2
  back.rotation.x = -Math.atan2(GOAL.depth, GOAL.height) + Math.PI / 2
  back.position.set(-GOAL.depth / 2, GOAL.height / 2, 0)
  g.add(back)
  // side panels
  for (const s of [-1, 1]) {
    const sideNet = new Mesh(new PlaneGeometry(GOAL.depth, GOAL.height), netMat)
    sideNet.position.set(-GOAL.depth / 2, GOAL.height / 2, s * hw)
    g.add(sideNet)
  }
  return g
}

function makeNetTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(255,255,255,1)'
  ctx.lineWidth = 2
  const step = 10
  // diamond mesh pattern
  for (let i = -size; i < size * 2; i += step) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + size, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(i + size, 0)
    ctx.lineTo(i, size)
    ctx.stroke()
  }
  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(1.5, 1.5)
  return tex
}
