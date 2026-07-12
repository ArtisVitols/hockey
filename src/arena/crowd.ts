import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three'
import { RINK } from '../config'

const ROWS = 16
const SEAT_STEP = 0.6
const ROW_STEP = 0.85
const ROW_RISE = 0.48

// Instanced crowd on four grandstands around the rink. Static boxes with
// varied jacket colors read as a crowd at broadcast distance for one draw
// call per stand structure + one for all spectators.
export function buildCrowd(): Group {
  const group = new Group()

  // stands: sloped dark slabs
  const standMat = new MeshStandardMaterial({ color: 0x151a22, roughness: 0.95 })
  // rot chosen so local +back (see below) points away from the rink
  const sides = [
    { cx: 0, cz: RINK.halfWidth + 4, len: RINK.length + 10, rot: 0 },
    { cx: 0, cz: -(RINK.halfWidth + 4), len: RINK.length + 10, rot: Math.PI },
    { cx: RINK.halfLength + 4, cz: 0, len: RINK.width + 6, rot: Math.PI / 2 },
    { cx: -(RINK.halfLength + 4), cz: 0, len: RINK.width + 6, rot: -Math.PI / 2 },
  ]

  // count seats first
  let totalSeats = 0
  for (const s of sides) totalSeats += Math.floor(s.len / SEAT_STEP) * ROWS

  const seatGeo = new BoxGeometry(0.38, 0.5, 0.3)
  const seatMat = new MeshStandardMaterial({ roughness: 0.9 })
  const crowd = new InstancedMesh(seatGeo, seatMat, totalSeats)
  const mat4 = new Matrix4()
  const color = new Color()
  const palette = [0x37415a, 0x5a3a3a, 0x3a5a46, 0x54506c, 0x6c6c74, 0x2c3444, 0x0a3a7c, 0xb01020]

  let idx = 0
  for (const s of sides) {
    const cols = Math.floor(s.len / SEAT_STEP)
    const cos = Math.cos(s.rot)
    const sin = Math.sin(s.rot)
    for (let r = 0; r < ROWS; r++) {
      const back = 1.5 + r * ROW_STEP
      const y = 2.6 + r * ROW_RISE
      for (let c = 0; c < cols; c++) {
        const along = (c - cols / 2) * SEAT_STEP + (r % 2) * 0.3
        // local (along, back) → world
        const lx = along * cos + back * sin
        const lz = -along * sin + back * cos
        mat4.makeTranslation(s.cx + lx, y + Math.random() * 0.08, s.cz + lz)
        crowd.setMatrixAt(idx, mat4)
        color.setHex(palette[Math.floor(Math.random() * palette.length)]!)
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.12)
        crowd.setColorAt(idx, color)
        idx++
      }
    }

    // slab under the seats
    const slabLen = s.len
    const slabDepth = ROWS * ROW_STEP + 2
    const slab = new Mesh(new PlaneGeometry(slabLen, slabDepth + 4), standMat)
    const midBack = 1.5 + (ROWS / 2) * ROW_STEP
    slab.position.set(s.cx + midBack * sin, 2.2 + (ROWS / 2) * ROW_RISE - 1, s.cz + midBack * cos)
    slab.rotation.y = s.rot + Math.PI
    slab.rotation.x = -Math.atan2(ROW_RISE, ROW_STEP) + Math.PI / 2
    group.add(slab)
  }
  crowd.instanceMatrix.needsUpdate = true
  group.add(crowd)

  // dark fascia band between glass and first row
  const fasciaMat = new MeshBasicMaterial({ color: 0x0c1016 })
  for (const s of sides) {
    const fascia = new Mesh(new PlaneGeometry(s.len, 2.4), fasciaMat)
    fascia.position.set(s.cx + 1.2 * Math.sin(s.rot), 1.6, s.cz + 1.2 * Math.cos(s.rot))
    fascia.rotation.y = s.rot + Math.PI
    group.add(fascia)
  }

  return group
}
