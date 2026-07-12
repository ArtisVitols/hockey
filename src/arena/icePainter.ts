import { CanvasTexture, SRGBColorSpace, RepeatWrapping } from 'three'
import { RINK, GOAL, ICE_TEX } from '../config'

const RED = '#c8102e'
const BLUE = '#0033a0'
const CREASE_BLUE = '#a8cfe8'

// Paints the full NHL sheet (lines, circles, dots, creases, logo) onto a
// canvas used as the ice albedo. World meters map linearly to pixels.
export function paintIceTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = ICE_TEX.width
  canvas.height = ICE_TEX.height
  const ctx = canvas.getContext('2d')!

  const S = ICE_TEX.width / RINK.length // px per meter
  const px = (x: number) => (x + RINK.halfLength) * S
  const pz = (z: number) => (z + RINK.halfWidth) * S

  // -- base ice: bright white with subtle cool mottling
  ctx.fillStyle = '#f4f7fa'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < 900; i++) {
    const r = 20 + Math.random() * 90
    ctx.fillStyle = `rgba(${205 + Math.random() * 30}, ${218 + Math.random() * 25}, ${235 + Math.random() * 20}, ${0.05 + Math.random() * 0.06})`
    ctx.beginPath()
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Paint sits under millimeters of ice — draw markings slightly translucent.
  ctx.globalAlpha = 0.88

  const vline = (x: number, w: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(px(x) - (w * S) / 2, 0, w * S, canvas.height)
  }

  // -- blue lines & goal lines
  vline(-RINK.blueLineFromCenter, 0.3, BLUE)
  vline(RINK.blueLineFromCenter, 0.3, BLUE)
  vline(-GOAL.lineX, 0.05, RED)
  vline(GOAL.lineX, 0.05, RED)

  // -- center red line: red with regular white interval markings (the rule
  // requires a design that distinguishes it from the blue lines)
  vline(0, 0.3, RED)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  const dashH = 0.25 * S
  for (let y = dashH; y < canvas.height; y += dashH * 3.6) {
    ctx.fillRect(px(0) - 0.15 * S, y, 0.3 * S, dashH)
  }

  const circle = (x: number, z: number, r: number, color: string, lineW: number) => {
    ctx.strokeStyle = color
    ctx.lineWidth = lineW * S
    ctx.beginPath()
    ctx.arc(px(x), pz(z), r * S, 0, Math.PI * 2)
    ctx.stroke()
  }
  const dot = (x: number, z: number, r: number, color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(px(x), pz(z), r * S, 0, Math.PI * 2)
    ctx.fill()
  }

  // Regulation red faceoff spot: 61 cm circle, white interior with a red
  // vertical band across the middle (7.6 cm white slivers face the goals).
  const faceoffSpot = (x: number, z: number) => {
    const r = 0.305
    dot(x, z, r, '#ffffff')
    ctx.save()
    ctx.beginPath()
    ctx.arc(px(x), pz(z), r * S, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = RED
    const band = (r - 0.076) * S
    ctx.fillRect(px(x) - band, pz(z) - r * S, band * 2, r * 2 * S)
    ctx.restore()
    circle(x, z, r, RED, 0.05)
  }

  // -- center circle + solid blue 30 cm spot
  circle(0, 0, RINK.centerCircleRadius, BLUE, 0.05)
  dot(0, 0, 0.15, BLUE)

  // -- end-zone faceoff circles with hash marks and double-L marks,
  // and neutral-zone spots
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * RINK.endZoneDotFromCenterX
      const cz = sz * RINK.dotY
      circle(cx, cz, RINK.faceoffCircleRadius, RED, 0.05)
      faceoffSpot(cx, cz)
      ctx.fillStyle = RED
      // hash marks outside the circle, both sides
      for (const hz of [-1, 1]) {
        for (const hx of [-1, 1]) {
          ctx.fillRect(
            px(cx + hx * 0.9) - 0.025 * S,
            pz(cz + hz * RINK.faceoffCircleRadius) - (hz > 0 ? 0 : 0.55 * S),
            0.05 * S,
            0.55 * S,
          )
        }
      }
      // double-L player position marks flanking the spot
      for (const lx of [-1, 1]) {
        for (const lz of [-1, 1]) {
          // leg parallel to the goal line
          ctx.fillRect(
            px(cx + lx * 0.6) - 0.025 * S,
            pz(cz + lz * 0.2) - (lz > 0 ? 0 : 0.9 * S),
            0.05 * S,
            0.9 * S,
          )
          // foot pointing away from the spot
          ctx.fillRect(
            px(cx + lx * 0.6) - (lx > 0 ? 0 : 0.55 * S),
            pz(cz + lz * 1.1) - 0.025 * S,
            0.55 * S,
            0.05 * S,
          )
        }
      }
      faceoffSpot(sx * RINK.neutralDotFromCenterX, sz * RINK.dotY)
    }
  }

  // -- goal creases: straight sides 30 cm outside each post joined by a
  // 1.83 m arc, light blue fill, red outline, side hash marks 1.22 m out
  for (const sx of [-1, 1]) {
    const gx = px(sx * GOAL.lineX)
    const gz = pz(0)
    const r = RINK.creaseRadius * S
    const halfW = 1.22 * S // posts (0.915) + 30 cm
    const a = Math.asin((1.22 / RINK.creaseRadius))
    const arcX = Math.cos(a) * r // x-extent where the arc meets the sides

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(gx, gz - halfW)
    ctx.lineTo(gx - sx * arcX, gz - halfW)
    if (sx > 0) ctx.arc(gx, gz, r, -(Math.PI - a), Math.PI - a, true)
    else ctx.arc(gx, gz, r, -a, a, false)
    ctx.lineTo(gx, gz + halfW)
    ctx.closePath()
    ctx.fillStyle = CREASE_BLUE
    ctx.globalAlpha = 0.75
    ctx.fill()
    ctx.globalAlpha = 0.88
    ctx.strokeStyle = RED
    ctx.lineWidth = 0.05 * S
    ctx.stroke()
    ctx.restore()

    // crease side hash marks 1.22 m from the goal line
    ctx.fillStyle = RED
    for (const hz of [-1, 1]) {
      ctx.fillRect(
        gx - sx * 1.22 * S - 0.025 * S,
        pz(hz * 1.22) - (hz > 0 ? 0.13 * S : 0),
        0.05 * S,
        0.13 * S,
      )
    }
  }

  // -- referee's crease: red semicircle at the boards at center ice
  // (international rinks have no goalie trapezoid)
  ctx.strokeStyle = RED
  ctx.lineWidth = 0.05 * S
  ctx.beginPath()
  ctx.arc(px(0), pz(RINK.halfWidth), RINK.refereeCreaseRadius * S, Math.PI, Math.PI * 2)
  ctx.stroke()

  ctx.globalAlpha = 1
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// Tiling skate-scratch texture: directional streaks used to modulate the ice
// roughness (bright = scuffed, dark = clean gloss).
export function makeScratchTexture(): CanvasTexture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#404040'
  ctx.fillRect(0, 0, size, size)

  ctx.lineCap = 'round'
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const len = 30 + Math.random() * 200
    // mostly along the length of the rink, with some curved variety
    const ang = (Math.random() - 0.5) * 0.9 + (Math.random() < 0.12 ? Math.PI / 2 : 0)
    const bright = Math.random() < 0.5
    ctx.strokeStyle = bright
      ? `rgba(255,255,255,${0.03 + Math.random() * 0.09})`
      : `rgba(0,0,0,${0.03 + Math.random() * 0.07})`
    ctx.lineWidth = 0.6 + Math.random() * 1.6
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(
      x + (Math.cos(ang) * len) / 2 + (Math.random() - 0.5) * 14,
      y + (Math.sin(ang) * len) / 2 + (Math.random() - 0.5) * 14,
      x + Math.cos(ang) * len,
      y + Math.sin(ang) * len,
    )
    ctx.stroke()
  }

  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}
