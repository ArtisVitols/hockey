import {
  BufferGeometry,
  BufferAttribute,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  DoubleSide,
  BoxGeometry,
  RepeatWrapping,
} from 'three'
import { RINK } from '../config'
import { perimeterPoints } from '../physics/geometry'
import { paintIceTexture, makeScratchTexture } from './icePainter'
import { createIceMaterial } from '../render/iceMaterial'

export interface RinkResult {
  group: Group
  iceMesh: Mesh
}

export function buildRink(): RinkResult {
  const group = new Group()

  // ---- ice sheet (rounded-rect shape so corners follow the boards)
  const shape = roundedRectShape()
  const iceGeo = new ShapeGeometry(shape, 24)
  remapShapeUVs(iceGeo)
  iceGeo.rotateX(-Math.PI / 2)

  const { material: iceMat, reflectionTarget } = createIceMaterial(paintIceTexture(), makeScratchTexture())
  const iceMesh = new Mesh(iceGeo, iceMat)
  iceMesh.receiveShadow = true
  group.add(iceMesh)
  group.add(reflectionTarget)

  // ---- boards (inward-facing ribbon around the perimeter)
  const pts = perimeterPoints()
  const boardsGeo = wallRibbon(pts, 0, RINK.boardHeight, true)
  const boardsMat = new MeshStandardMaterial({
    map: makeBoardsTexture(),
    roughness: 0.55,
    metalness: 0.05,
  })
  const boards = new Mesh(boardsGeo, boardsMat)
  boards.receiveShadow = true
  group.add(boards)

  // top rail (cap) along the boards
  const railGeo = wallRibbon(pts, RINK.boardHeight, RINK.boardHeight + 0.06, true, 0.09)
  const rail = new Mesh(railGeo, new MeshStandardMaterial({ color: 0x10214d, roughness: 0.4 }))
  group.add(rail)

  // ---- plexiglass above the boards
  const glassGeo = wallRibbon(pts, RINK.boardHeight + 0.06, RINK.boardHeight + 0.06 + RINK.glassHeight, true)
  const glassMat = new MeshPhysicalMaterial({
    color: 0xdfeaf2,
    transparent: true,
    opacity: 0.14,
    roughness: 0.05,
    metalness: 0,
    envMapIntensity: 1.6,
    side: DoubleSide,
    depthWrite: false,
  })
  const glass = new Mesh(glassGeo, glassMat)
  group.add(glass)

  // ---- glass stanchions
  const stanchionGeo = new BoxGeometry(0.06, RINK.glassHeight, 0.1)
  const stanchionMat = new MeshStandardMaterial({ color: 0x3a4048, roughness: 0.5, metalness: 0.6 })
  for (let i = 0; i < pts.length; i += 6) {
    const p = pts[i]!
    const next = pts[(i + 1) % pts.length]!
    const post = new Mesh(stanchionGeo, stanchionMat)
    post.position.set(p.x, RINK.boardHeight + 0.06 + RINK.glassHeight / 2, p.z)
    post.rotation.y = -Math.atan2(next.z - p.z, next.x - p.x)
    group.add(post)
  }

  // ---- dark surround floor outside the boards
  const floorGeo = new ShapeGeometry(outerFloorShape())
  floorGeo.rotateX(-Math.PI / 2)
  const floor = new Mesh(floorGeo, new MeshStandardMaterial({ color: 0x11151c, roughness: 0.9 }))
  floor.position.y = -0.01
  group.add(floor)

  return { group, iceMesh }
}

function roundedRectShape(): Shape {
  const hl = RINK.halfLength
  const hw = RINK.halfWidth
  const r = RINK.cornerRadius
  const s = new Shape()
  s.moveTo(-hl + r, -hw)
  s.lineTo(hl - r, -hw)
  s.absarc(hl - r, -hw + r, r, -Math.PI / 2, 0, false)
  s.lineTo(hl, hw - r)
  s.absarc(hl - r, hw - r, r, 0, Math.PI / 2, false)
  s.lineTo(-hl + r, hw)
  s.absarc(-hl + r, hw - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-hl, -hw + r)
  s.absarc(-hl + r, -hw + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

function outerFloorShape(): Shape {
  const s = new Shape()
  const m = 40 // margin beyond the boards
  s.moveTo(-RINK.halfLength - m, -RINK.halfWidth - m)
  s.lineTo(RINK.halfLength + m, -RINK.halfWidth - m)
  s.lineTo(RINK.halfLength + m, RINK.halfWidth + m)
  s.lineTo(-RINK.halfLength - m, RINK.halfWidth + m)
  s.closePath()
  s.holes.push(roundedRectShape())
  return s
}

// ShapeGeometry UVs equal the shape's XY coords; remap them to [0,1]
// so the painted ice texture spans the whole sheet.
function remapShapeUVs(geo: BufferGeometry): void {
  const uv = geo.getAttribute('uv') as BufferAttribute
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) + RINK.halfLength) / RINK.length, (uv.getY(i) + RINK.halfWidth) / RINK.width)
  }
  uv.needsUpdate = true
}

// Builds a vertical ribbon along a closed polyline between heights y0..y1.
// faceInward flips winding/normals toward the rink. Optional `inset` pushes
// the ribbon slightly outward (for the top rail overhang).
function wallRibbon(
  pts: Array<{ x: number; z: number }>,
  y0: number,
  y1: number,
  faceInward: boolean,
  outset = 0,
): BufferGeometry {
  const n = pts.length
  const positions = new Float32Array((n + 1) * 2 * 3)
  const uvs = new Float32Array((n + 1) * 2 * 2)
  const indices: number[] = []

  // cumulative arclength for u
  let total = 0
  const arc: number[] = [0]
  for (let i = 1; i <= n; i++) {
    const a = pts[i % n]!
    const b = pts[i - 1]!
    total += Math.hypot(a.x - b.x, a.z - b.z)
    arc.push(total)
  }

  for (let i = 0; i <= n; i++) {
    const p = pts[i % n]!
    const prev = pts[(i - 1 + n) % n]!
    const next = pts[(i + 1) % n]!
    // outward direction approximated from the local tangent
    let ox = 0
    let oz = 0
    if (outset > 0) {
      const tx = next.x - prev.x
      const tz = next.z - prev.z
      const tl = Math.hypot(tx, tz) || 1
      ox = (tz / tl) * outset
      oz = (-tx / tl) * outset
    }
    // u runs backward so the texture reads left-to-right from inside the rink
    const u = -(arc[i]! / total) * (total / 3)
    positions.set([p.x + ox, y0, p.z + oz], (i * 2 + 0) * 3)
    positions.set([p.x + ox, y1, p.z + oz], (i * 2 + 1) * 3)
    uvs.set([u, 0], (i * 2 + 0) * 2)
    uvs.set([u, 1], (i * 2 + 1) * 2)
    if (i < n) {
      const a = i * 2
      if (faceInward) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('uv', new BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// White dasher boards with a yellow kickplate and neutral ad panels.
// u tiles every ~3 m of board length.
function makeBoardsTexture(): CanvasTexture {
  const w = 1024
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#f5f6f7'
  ctx.fillRect(0, 0, w, h)

  // ad panel across the middle band
  const ads = ['GLACIER', 'RINKSIDE', 'NORTHBANK', 'ICE PRO']
  const brand = ads[Math.floor(Math.random() * ads.length)]!
  ctx.fillStyle = ['#0a3a7c', '#7c1020', '#0e5c38', '#333a44'][Math.floor(Math.random() * 4)]!
  ctx.fillRect(w * 0.08, h * 0.22, w * 0.84, h * 0.5)
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(h * 0.32)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(brand, w / 2, h * 0.47)

  // yellow kickplate at the ice edge (bottom of the ribbon: v=0)
  ctx.fillStyle = '#f2c230'
  ctx.fillRect(0, h * 0.86, w, h * 0.14)

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.anisotropy = 4
  return tex
}
