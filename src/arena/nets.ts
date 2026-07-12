import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  TubeGeometry,
  Vector3,
} from 'three'
import { GOAL } from '../config'

const HW = GOAL.width / 2 // mouth half width
const H = GOAL.height
const D = GOAL.depth
const BASE_HW = GOAL.baseHalfWidth // base outline flares wider than the mouth
const R = GOAL.baseCornerRadius
const PR = GOAL.postRadius
const TUBE_Y = 0.03 // base tubing rests on the ice

// Both goals: regulation tubular steel frame (posts, crossbar, flared base
// outline with rounded corners, sloped back supports), draped netting
// surfaces, and the white base pad.
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
  const red = new MeshStandardMaterial({ color: 0xc8102e, roughness: 0.38, metalness: 0.25 })
  const white = new MeshStandardMaterial({ color: 0xf2f3f5, roughness: 0.85 })

  // ---- posts & crossbar
  const post = new CylinderGeometry(PR, PR, H, 12)
  for (const s of [-1, 1]) {
    const p = new Mesh(post, red)
    p.position.set(0, H / 2, s * HW)
    p.castShadow = true
    g.add(p)
  }
  const crossbar = new Mesh(new CylinderGeometry(PR, PR, GOAL.width + PR * 2, 12), red)
  crossbar.rotation.x = Math.PI / 2
  crossbar.position.set(0, H, 0)
  crossbar.castShadow = true
  g.add(crossbar)

  // ---- base outline: post bottom → outward flare → straight side →
  // 18"-radius corner → back bar → mirrored return
  const basePts = sampleBaseOutline()
  const baseCurve = new CatmullRomCurve3(basePts, false, 'catmullrom', 0.05)
  const baseTube = new Mesh(new TubeGeometry(baseCurve, 96, 0.028, 8), red)
  baseTube.castShadow = true
  g.add(baseTube)

  // ---- top back supports: from each post top, arcing down to the base
  // just before the back corners
  const supports: [Vector3[], Vector3[]] = [[], []]
  for (const s of [-1, 1] as const) {
    const pts = sampleTopSupport(s)
    supports[s < 0 ? 0 : 1] = pts
    const tube = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), 32, 0.02, 8),
      red,
    )
    tube.castShadow = true
    g.add(tube)
  }

  // ---- white protective pad along the back base bar
  const padLen = 2 * (BASE_HW - R)
  const pad = new Mesh(new CylinderGeometry(0.05, 0.05, padLen, 10), white)
  pad.rotation.x = Math.PI / 2
  pad.position.set(-D, 0.05, 0)
  g.add(pad)

  // ---- netting
  const netMat = makeNetMaterial()

  // back/top drape: crossbar → over the back supports → back base bar
  const drapeRows: Vector3[][] = [
    lineRow(0, H, HW, 13),
    lineRow(-0.55, 0.82, HW * 0.97, 13),
    lineRow(-0.93, 0.28, BASE_HW - R + 0.12, 13),
    lineRow(-D, TUBE_Y + 0.02, BASE_HW - R, 13),
  ]
  g.add(new Mesh(loftGrid(drapeRows), netMat))

  // side panels: ruled surface between the top support curve and the base
  // outline flare on the same side
  for (const s of [-1, 1] as const) {
    const top = resample(supports[s < 0 ? 0 : 1], 12)
    const bottom = resample(sampleBaseSide(s), 12)
    g.add(new Mesh(loftGrid([top, bottom]), netMat))
  }

  return g
}

// One row of the drape grid: straight line across z at (x, y), n samples.
function lineRow(x: number, y: number, halfWidth: number, n: number): Vector3[] {
  const row: Vector3[] = []
  for (let i = 0; i < n; i++) {
    row.push(new Vector3(x, y, -halfWidth + (2 * halfWidth * i) / (n - 1)))
  }
  return row
}

// Base outline polyline from +z post bottom around to -z post bottom.
function sampleBaseOutline(): Vector3[] {
  const pts: Vector3[] = []
  const half = (s: 1 | -1) => {
    const p: Vector3[] = []
    // flare: post bottom out to the full base width
    p.push(new Vector3(0, TUBE_Y, s * HW))
    p.push(new Vector3(-0.09, TUBE_Y, s * (HW + (BASE_HW - HW) * 0.75)))
    p.push(new Vector3(-0.18, TUBE_Y, s * BASE_HW))
    // straight side back to the corner
    p.push(new Vector3(-(D - R) * 0.7, TUBE_Y, s * BASE_HW))
    // corner arc (radius R) into the back bar
    const cx = -(D - R)
    const cz = s * (BASE_HW - R)
    for (let i = 1; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2)
      p.push(new Vector3(cx - R * Math.sin(a), TUBE_Y, cz + s * R * Math.cos(a)))
    }
    return p
  }
  pts.push(...half(1))
  // back bar midpoint keeps the curve straight across
  pts.push(new Vector3(-D, TUBE_Y, 0))
  pts.push(...half(-1).reverse())
  return pts
}

// The +z or -z portion of the base outline (for the side net's bottom edge).
function sampleBaseSide(s: 1 | -1): Vector3[] {
  const p: Vector3[] = [
    new Vector3(0, TUBE_Y, s * HW),
    new Vector3(-0.09, TUBE_Y, s * (HW + (BASE_HW - HW) * 0.75)),
    new Vector3(-0.18, TUBE_Y, s * BASE_HW),
    new Vector3(-(D - R) * 0.7, TUBE_Y, s * BASE_HW),
  ]
  const cx = -(D - R)
  const cz = s * (BASE_HW - R)
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    p.push(new Vector3(cx - R * Math.sin(a), TUBE_Y, cz + s * R * Math.cos(a)))
  }
  return p
}

// Top back support curve: post top arcing down to the base near the corner.
function sampleTopSupport(s: 1 | -1): Vector3[] {
  return [
    new Vector3(0, H, s * HW),
    new Vector3(-0.3, H * 0.86, s * HW * 0.99),
    new Vector3(-0.62, 0.62, s * (HW * 0.99 + 0.04)),
    new Vector3(-D + 0.05, 0.07, s * (BASE_HW - R)),
  ]
}

// Densify/regularize a polyline to n points via a Catmull-Rom fit.
function resample(pts: Vector3[], n: number): Vector3[] {
  const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.2)
  return curve.getSpacedPoints(n - 1)
}

// Triangulated surface through a grid of rows (each row same length). UVs
// scale with physical size so the net mesh reads at ~4 cm openings.
function loftGrid(rows: Vector3[][]): BufferGeometry {
  const m = rows.length
  const n = rows[0]!.length
  const positions = new Float32Array(m * n * 3)
  const uvs = new Float32Array(m * n * 2)
  const indices: number[] = []
  const TILE = 0.52 // meters covered by one net-texture repeat

  for (let r = 0; r < m; r++) {
    const row = rows[r]!
    for (let c = 0; c < n; c++) {
      const p = row[c]!
      positions.set([p.x, p.y, p.z], (r * n + c) * 3)
      // approximate physical UVs from accumulated distances
      const uDist = c > 0 ? row[c - 1]!.distanceTo(p) : 0
      const prevU = c > 0 ? uvs[(r * n + c - 1) * 2]! : 0
      const vDist = r > 0 ? rows[r - 1]![c]!.distanceTo(p) : 0
      const prevV = r > 0 ? uvs[((r - 1) * n + c) * 2 + 1]! : 0
      uvs[(r * n + c) * 2] = prevU + uDist / TILE
      uvs[(r * n + c) * 2 + 1] = prevV + vDist / TILE
    }
  }
  for (let r = 0; r < m - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const a = r * n + c
      indices.push(a, a + 1, a + n, a + 1, a + n + 1, a + n)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('uv', new BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function makeNetMaterial(): MeshStandardMaterial {
  const tex = makeNetTexture()
  return new MeshStandardMaterial({
    map: tex,
    alphaMap: tex,
    alphaTest: 0.35,
    side: DoubleSide,
    roughness: 0.9,
    color: 0xf0f0f0,
  })
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
  return tex
}
