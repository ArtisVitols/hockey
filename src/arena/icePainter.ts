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

  // -- center red line (solid with white dash pattern)
  vline(0, 0.3, RED)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  const dashH = 0.28 * S
  for (let y = dashH / 2; y < canvas.height; y += dashH * 2.2) {
    ctx.fillRect(px(0) - 0.05 * S, y, 0.1 * S, dashH)
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

  // -- center circle + dot
  circle(0, 0, RINK.centerCircleRadius, BLUE, 0.05)
  dot(0, 0, 0.15, BLUE)

  // -- end-zone faceoff circles with hash marks, and neutral-zone dots
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * RINK.endZoneDotFromCenterX
      const cz = sz * RINK.dotY
      circle(cx, cz, RINK.faceoffCircleRadius, RED, 0.05)
      dot(cx, cz, 0.3, RED)
      // hash marks on both sides of the circle
      ctx.fillStyle = RED
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
      dot(sx * RINK.neutralDotFromCenterX, sz * RINK.dotY, 0.3, RED)
    }
  }

  // -- goal creases (filled light blue, red outline, flat edge on goal line)
  for (const sx of [-1, 1]) {
    const gx = px(sx * GOAL.lineX)
    const gz = pz(0)
    const r = RINK.creaseRadius * S
    const inward = -sx // toward center ice
    ctx.save()
    ctx.beginPath()
    if (inward > 0) ctx.arc(gx, gz, r, -Math.PI / 2, Math.PI / 2)
    else ctx.arc(gx, gz, r, Math.PI / 2, (Math.PI * 3) / 2)
    ctx.closePath()
    ctx.fillStyle = CREASE_BLUE
    ctx.globalAlpha = 0.75
    ctx.fill()
    ctx.globalAlpha = 0.88
    ctx.strokeStyle = RED
    ctx.lineWidth = 0.05 * S
    ctx.stroke()
    ctx.restore()
  }

  // -- goalie trapezoid behind each goal line
  ctx.strokeStyle = RED
  ctx.lineWidth = 0.05 * S
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(px(sx * GOAL.lineX), pz(sz * 3.35))
      ctx.lineTo(px(sx * RINK.halfLength), pz(sz * 4.27))
      ctx.stroke()
    }
  }

  // -- center-ice logo
  drawCenterLogo(ctx, px(0), pz(0), 3.2 * S)

  ctx.globalAlpha = 1
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function drawCenterLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save()
  ctx.globalAlpha = 0.55
  // outer ring
  ctx.strokeStyle = '#12275e'
  ctx.lineWidth = radius * 0.09
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.92, 0, Math.PI * 2)
  ctx.stroke()
  // inner disc
  ctx.fillStyle = 'rgba(60, 110, 180, 0.25)'
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.84, 0, Math.PI * 2)
  ctx.fill()
  // crossed sticks
  ctx.strokeStyle = '#12275e'
  ctx.lineCap = 'round'
  ctx.lineWidth = radius * 0.11
  for (const a of [-0.6, 0.6]) {
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(a) * radius * 0.62, cy - Math.sin(a) * radius * 0.62)
    ctx.lineTo(cx + Math.cos(a) * radius * 0.62, cy + Math.sin(a) * radius * 0.62)
    ctx.stroke()
  }
  // puck
  ctx.fillStyle = '#c8102e'
  ctx.beginPath()
  ctx.arc(cx, cy + radius * 0.3, radius * 0.13, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
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
