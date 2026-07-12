import {
  Bone,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  Uint16BufferAttribute,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Bone indices — the animation clips reference these by name.
export const BONES = {
  hips: 0,
  spine: 1,
  chest: 2,
  head: 3,
  upperArmL: 4,
  lowerArmL: 5,
  upperArmR: 6,
  lowerArmR: 7,
  thighL: 8,
  shinL: 9,
  footL: 10,
  thighR: 11,
  shinR: 12,
  footR: 13,
} as const

export interface ProceduralPlayerColors {
  jersey: number
  pants: number
  accent: number
  skin: number
}

export interface ProceduralPlayer {
  mesh: SkinnedMesh
  skeleton: Skeleton
}

// Rigid-skinned hockey player assembled from primitives. Pads and gear hide
// the joints, so per-part rigid weights read fine at broadcast distance.
export function buildProceduralPlayer(colors: ProceduralPlayerColors, goalie = false): ProceduralPlayer {
  // ---- skeleton (positions are world-space bind pose)
  const world: Record<keyof typeof BONES, [number, number, number]> = {
    hips: [0, 0.98, 0],
    spine: [0, 1.16, 0],
    chest: [0, 1.34, 0],
    head: [0, 1.64, 0],
    upperArmL: [0, 1.44, -0.28],
    lowerArmL: [0, 1.12, -0.32],
    upperArmR: [0, 1.44, 0.28],
    lowerArmR: [0, 1.12, 0.32],
    thighL: [0, 0.94, -0.13],
    shinL: [0, 0.54, -0.14],
    footL: [0, 0.1, -0.15],
    thighR: [0, 0.94, 0.13],
    shinR: [0, 0.54, 0.14],
    footR: [0, 0.1, 0.15],
  }
  const parent: Record<keyof typeof BONES, keyof typeof BONES | null> = {
    hips: null,
    spine: 'hips',
    chest: 'spine',
    head: 'chest',
    upperArmL: 'chest',
    lowerArmL: 'upperArmL',
    upperArmR: 'chest',
    lowerArmR: 'upperArmR',
    thighL: 'hips',
    shinL: 'thighL',
    footL: 'shinL',
    thighR: 'hips',
    shinR: 'thighR',
    footR: 'shinR',
  }

  const names = Object.keys(BONES) as Array<keyof typeof BONES>
  const bones: Bone[] = names.map((n) => {
    const b = new Bone()
    b.name = n
    return b
  })
  for (const n of names) {
    const b = bones[BONES[n]]!
    const p = parent[n]
    const wp = world[n]
    if (p === null) {
      b.position.set(...wp)
    } else {
      const pp = world[p]
      b.position.set(wp[0] - pp[0], wp[1] - pp[1], wp[2] - pp[2])
      bones[BONES[p]]!.add(b)
    }
  }

  // ---- materials (indexed groups on the merged geometry)
  const jerseyMat = new MeshStandardMaterial({ color: new Color(colors.jersey), roughness: 0.75 })
  const pantsMat = new MeshStandardMaterial({ color: new Color(colors.pants), roughness: 0.7 })
  const accentMat = new MeshStandardMaterial({ color: new Color(colors.accent), roughness: 0.6 })
  const skinMat = new MeshStandardMaterial({ color: new Color(colors.skin), roughness: 0.6 })
  const darkMat = new MeshStandardMaterial({ color: 0x16181c, roughness: 0.45 })
  const stickMat = new MeshStandardMaterial({ color: 0x9a7845, roughness: 0.8 })
  const materials = [jerseyMat, pantsMat, accentMat, skinMat, darkMat, stickMat]
  const MAT = { jersey: 0, pants: 1, accent: 2, skin: 3, dark: 4, stick: 5 } as const

  // ---- body parts: geometry + owning bone + material index
  const parts: BufferGeometry[] = []
  const partMats: number[] = []
  const add = (geo: BufferGeometry, at: [number, number, number], bone: number, mat: number) => {
    geo.translate(...at)
    const count = geo.getAttribute('position').count
    const si = new Uint16Array(count * 4)
    const sw = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      si[i * 4] = bone
      sw[i * 4] = 1
    }
    geo.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4))
    geo.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4))
    parts.push(geo)
    partMats.push(mat)
  }

  const scale = goalie ? 1.12 : 1 // goalies read bulkier

  // torso: shoulder-padded chest + lower torso (arms must clear the sides)
  add(new BoxGeometry(0.4 * scale, 0.34, 0.46 * scale), [0, 1.42, 0], BONES.chest, MAT.jersey)
  add(new BoxGeometry(0.34 * scale, 0.28, 0.38 * scale), [0, 1.12, 0], BONES.spine, MAT.jersey)
  add(new BoxGeometry(0.32, 0.18, 0.36), [0, 0.96, 0], BONES.hips, MAT.pants)

  // head: face + helmet shell
  add(new SphereGeometry(0.115, 12, 10), [0, 1.7, 0], BONES.head, MAT.skin)
  add(new SphereGeometry(0.135, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), [0, 1.72, 0], BONES.head, MAT.dark)

  // arms: padded sleeves + gloves
  for (const s of [-1, 1]) {
    const uy = s < 0 ? BONES.upperArmL : BONES.upperArmR
    const ly = s < 0 ? BONES.lowerArmL : BONES.lowerArmR
    add(new CapsuleGeometry(0.075, 0.22, 3, 8), [0, 1.3, s * 0.3], uy, MAT.jersey)
    add(new CapsuleGeometry(0.065, 0.18, 3, 8), [0, 0.98, s * 0.32], ly, MAT.jersey)
    add(new BoxGeometry(0.13, 0.16, 0.13), [0, 0.83, s * 0.32], ly, MAT.accent)
  }

  // legs: breezers, shin pads, skates
  for (const s of [-1, 1]) {
    const th = s < 0 ? BONES.thighL : BONES.thighR
    const sh = s < 0 ? BONES.shinL : BONES.shinR
    const ft = s < 0 ? BONES.footL : BONES.footR
    add(new BoxGeometry(0.19, 0.4, 0.2), [0, 0.76, s * 0.135], th, MAT.pants)
    add(new CylinderGeometry(0.085, 0.075, 0.4, 8), [0, 0.32, s * 0.145], sh, goalie ? MAT.accent : MAT.jersey)
    // skate boot + blade
    add(new BoxGeometry(0.26, 0.12, 0.11), [0.04, 0.07, s * 0.15], ft, MAT.dark)
    add(new BoxGeometry(0.24, 0.035, 0.012), [0.04, 0.012, s * 0.15], ft, MAT.accent)
  }

  // stick in the right hand: shaft runs from the glove down-forward to the
  // ice, blade at its tip
  const shaft = new CylinderGeometry(0.017, 0.017, 1.15, 6)
  shaft.rotateZ(-1.02)
  add(shaft, [0.48, 0.46, 0.32], BONES.lowerArmR, MAT.stick)
  const blade = new BoxGeometry(0.32, 0.08, 0.03)
  blade.rotateY(0.25)
  add(blade, [1.08, 0.05, 0.32], BONES.lowerArmR, MAT.stick)

  // goalie extras: leg pads + blocker
  if (goalie) {
    for (const s of [-1, 1]) {
      const sh = s < 0 ? BONES.shinL : BONES.shinR
      add(new BoxGeometry(0.16, 0.55, 0.26), [0.06, 0.33, s * 0.16], sh, MAT.accent)
    }
    add(new BoxGeometry(0.22, 0.26, 0.05), [0.1, 0.95, 0.36], BONES.lowerArmR, MAT.accent)
  }

  // ---- merge with material groups
  const merged = mergeGeometries(parts, true)!
  // mergeGeometries(useGroups=true) creates one group per part; remap to shared materials
  merged.groups.forEach((g, i) => (g.materialIndex = partMats[i]!))

  const mesh = new SkinnedMesh(merged, materials)
  mesh.castShadow = true
  const skeleton = new Skeleton(bones)
  mesh.add(bones[BONES.hips]!)
  mesh.bind(skeleton)
  mesh.frustumCulled = false // skinning moves verts; default bounds are wrong

  // free per-part scratch attributes
  const pos = merged.getAttribute('position') as BufferAttribute
  pos.needsUpdate = true

  return { mesh, skeleton }
}
