import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Bone,
  type Object3D,
} from 'three'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { captureRig, type Rig } from './rigMap'
import type { ProceduralPlayerColors } from './proceduralPlayer'

export interface BuiltPlayer {
  root: Group
  rig: Rig
}

const _v = new Vector3()
const _axisX = new Vector3(1, 0, 0)

// Clone the Xbot mannequin, orient it to face +X (the game's character
// convention), scale to hockey height, tint the suit per team, and attach
// procedural gear shells to the bones via world-pose attach().
export function buildGlbPlayer(gltf: GLTF, colors: ProceduralPlayerColors, goalie: boolean): BuiltPlayer {
  const clone = cloneSkeleton(gltf.scene)
  const root = new Group()
  const inner = new Group()
  inner.add(clone)
  root.add(inner)
  // Xbot faces +Z; rotate so the character faces +X in root space
  inner.rotation.y = Math.PI / 2

  // Scale from BONE positions, not Box3: skinned vertices follow bone
  // matrices (the mesh node's own transform is ignored in 'attached' bind
  // mode), so bounding boxes lie about the rendered size.
  root.updateWorldMatrix(true, true)
  const boneY = (suffix: string): number => {
    let y = 0
    clone.traverse((o: Object3D) => {
      if ((o as Bone).isBone && o.name.replace(/^mixamorig:?/, '') === suffix) {
        y = o.getWorldPosition(_v).y
      }
    })
    return y
  }
  const rawH = boneY('Head') - Math.min(boneY('LeftFoot'), boneY('RightFoot')) + 0.16
  const s = (goalie ? 1.86 : 1.82) / (rawH || 1.8)
  inner.scale.setScalar(s)
  root.updateWorldMatrix(true, true)
  // drop the feet onto the ice (foot bone sits at ankle height)
  const footY = Math.min(boneY('LeftFoot'), boneY('RightFoot'))
  inner.position.y -= footY - 0.075
  root.updateWorldMatrix(true, true)

  // team tint on the suit
  const suit = new MeshStandardMaterial({ color: colors.jersey, roughness: 0.72 })
  const joints = new MeshStandardMaterial({ color: colors.pants, roughness: 0.55 })
  clone.traverse((o: Object3D) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.frustumCulled = false
    const name = (mesh.material as MeshStandardMaterial)?.name ?? ''
    mesh.material = name.includes('Joints') ? joints : suit
  })

  const rig = captureRig(root, 'mixamo')

  if (new URLSearchParams(window.location.search).has('rigdebug')) {
    for (const k of ['hips', 'spine2', 'head', 'footL', 'handR'] as const) {
      const bone = rig.bones[k]?.bone
      if (bone) {
        bone.getWorldPosition(_v)
        console.log(`[rig] ${k} world=(${_v.x.toFixed(2)}, ${_v.y.toFixed(2)}, ${_v.z.toFixed(2)})`)
      }
    }
  }

  // arms-down baseline: Xbot rests in a T-pose; every clip composes on top.
  // The right arm extends toward +Z, so +X rotation brings it down (and
  // mirrored for the left).
  const down = 1.15
  if (rig.bones.armL) rig.bones.armL.baselineWorldQ = new Quaternion().setFromAxisAngle(_axisX, -down)
  if (rig.bones.armR) rig.bones.armR.baselineWorldQ = new Quaternion().setFromAxisAngle(_axisX, down)

  addGear(root, rig, colors, goalie)

  return { root, rig }
}

// place a mesh at a bone's rest world position (+offset in character space),
// then attach so it follows the bone
function attachAt(
  root: Group,
  bone: Bone | undefined,
  mesh: Mesh,
  ox: number,
  oy: number,
  oz: number,
): void {
  if (!bone) {
    mesh.geometry.dispose()
    return
  }
  mesh.castShadow = true
  bone.getWorldPosition(_v)
  mesh.position.set(_v.x + ox, _v.y + oy, _v.z + oz)
  root.add(mesh)
  bone.attach(mesh)
}

function addGear(root: Group, rig: Rig, colors: ProceduralPlayerColors, goalie: boolean): void {
  const b = rig.bones
  const accent = new MeshStandardMaterial({ color: colors.accent, roughness: 0.6 })
  const dark = new MeshStandardMaterial({ color: 0x16181c, roughness: 0.45 })
  const pants = new MeshStandardMaterial({ color: colors.pants, roughness: 0.7 })

  // helmet (snug cap)
  const helmet = new Mesh(
    new SphereGeometry(0.104, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    dark,
  )
  attachAt(root, b.head?.bone, helmet, 0.01, 0.045, 0)

  // breezers (hockey shorts shell)
  const breezer = new Mesh(new BoxGeometry(0.3, 0.24, 0.34), pants)
  attachAt(root, b.hips?.bone, breezer, 0, -0.03, 0)

  // gloves (big enough to swallow the bare hands and fingers)
  for (const side of ['handL', 'handR'] as const) {
    const glove = new Mesh(new BoxGeometry(0.16, 0.25, 0.16), accent)
    attachAt(root, b[side]?.bone, glove, 0, -0.105, 0)
  }

  // shin pads + skates
  for (const side of ['L', 'R'] as const) {
    const shin = new Mesh(new CylinderGeometry(0.075, 0.068, 0.36, 8), goalie ? accent : dark)
    attachAt(root, b[`leg${side}`]?.bone, shin, 0.035, -0.2, 0)
    const boot = new Mesh(new BoxGeometry(0.27, 0.11, 0.1), dark)
    attachAt(root, b[`foot${side}`]?.bone, boot, 0.06, -0.045, 0)
    const blade = new Mesh(new BoxGeometry(0.25, 0.035, 0.012), accent)
    attachAt(root, b[`foot${side}`]?.bone, blade, 0.06, -0.115, 0)
  }

  if (goalie) {
    // big leg pads, blocker, catcher, cage
    for (const side of ['L', 'R'] as const) {
      const pad = new Mesh(new BoxGeometry(0.17, 0.55, 0.26), accent)
      attachAt(root, b[`leg${side}`]?.bone, pad, 0.08, -0.22, 0)
    }
    const blocker = new Mesh(new BoxGeometry(0.06, 0.24, 0.26), accent)
    attachAt(root, b.foreArmR?.bone, blocker, 0.04, -0.16, 0)
    const catcher = new Mesh(new SphereGeometry(0.12, 10, 8), accent)
    attachAt(root, b.handL?.bone, catcher, 0, -0.02, 0)
    const cage = new Mesh(new BoxGeometry(0.05, 0.14, 0.16), accent)
    attachAt(root, b.head?.bone, cage, 0.1, -0.02, 0)
  }
}

// Stick meshes solved per-frame in playerVisual (two-hand hold). Shaft runs
// along local -Y from the grip; the blade sits at the tip.
export interface StickParts {
  group: Group
  length: number
}

export function makeStick(parent: Object3D, goalie: boolean): StickParts {
  const group = new Group()
  const wood = new MeshStandardMaterial({ color: 0x9a7845, roughness: 0.8 })
  const length = goalie ? 1.35 : 1.5
  if (goalie) {
    const shaft = new Mesh(new BoxGeometry(0.025, 0.6, 0.025), wood)
    shaft.position.y = -0.3
    group.add(shaft)
    const paddle = new Mesh(new BoxGeometry(0.028, 0.66, 0.09), wood)
    paddle.position.y = -0.6 - 0.33
    group.add(paddle)
    const blade = new Mesh(new BoxGeometry(0.03, 0.095, 0.36), wood)
    blade.position.set(0, -length + 0.05, 0.12)
    group.add(blade)
  } else {
    const shaft = new Mesh(new CylinderGeometry(0.014, 0.016, length, 6), wood)
    shaft.position.y = -length / 2
    group.add(shaft)
    const blade = new Mesh(new BoxGeometry(0.03, 0.064, 0.35), wood)
    blade.position.set(0, -length + 0.03, 0.14)
    group.add(blade)
  }
  group.traverse((o) => ((o as Mesh).castShadow = true))
  parent.add(group)
  return { group, length }
}
