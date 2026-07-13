import { Bone, Object3D, Quaternion, Vector3 } from 'three'

// Logical bone names used by the hockey clip factory. A rig maps whichever
// of these it has; clips skip bones a rig is missing.
export type RigBone =
  | 'hips'
  | 'spine'
  | 'spine1'
  | 'spine2'
  | 'neck'
  | 'head'
  | 'shoulderL'
  | 'armL'
  | 'foreArmL'
  | 'handL'
  | 'shoulderR'
  | 'armR'
  | 'foreArmR'
  | 'handR'
  | 'upLegL'
  | 'legL'
  | 'footL'
  | 'toeL'
  | 'upLegR'
  | 'legR'
  | 'footR'
  | 'toeR'

export interface RigBoneInfo {
  bone: Bone
  restLocalQ: Quaternion
  restLocalP: Vector3
  // parent's rest orientation in character space (wrapper-relative);
  // used to convert world-space authoring deltas into bone-local space
  parentRestWorldQ: Quaternion
  // optional world-space rotation applied under every authored delta —
  // used to bring T-pose rigs (Mixamo) into an arms-down neutral
  baselineWorldQ?: Quaternion
}

export interface Rig {
  bones: Partial<Record<RigBone, RigBoneInfo>>
  // multiply a character-space vertical offset (m) into hips-local units
  hipsUnitScale: number
}

// Mixamo skeleton names (Xbot). GLTFLoader may strip the `:` from names,
// so match with and without it.
const MIXAMO: Record<RigBone, string> = {
  hips: 'Hips',
  spine: 'Spine',
  spine1: 'Spine1',
  spine2: 'Spine2',
  neck: 'Neck',
  head: 'Head',
  shoulderL: 'LeftShoulder',
  armL: 'LeftArm',
  foreArmL: 'LeftForeArm',
  handL: 'LeftHand',
  shoulderR: 'RightShoulder',
  armR: 'RightArm',
  foreArmR: 'RightForeArm',
  handR: 'RightHand',
  upLegL: 'LeftUpLeg',
  legL: 'LeftLeg',
  footL: 'LeftFoot',
  toeL: 'LeftToeBase',
  upLegR: 'RightUpLeg',
  legR: 'RightLeg',
  footR: 'RightFoot',
  toeR: 'RightToeBase',
}

// The procedural skeleton's own names (identity rest rotations).
const PROCEDURAL: Partial<Record<RigBone, string>> = {
  hips: 'hips',
  spine: 'spine',
  spine2: 'chest',
  head: 'head',
  armL: 'upperArmL',
  foreArmL: 'lowerArmL',
  armR: 'upperArmR',
  foreArmR: 'lowerArmR',
  upLegL: 'thighL',
  legL: 'shinL',
  footL: 'footL',
  upLegR: 'thighR',
  legR: 'shinR',
  footR: 'footR',
}

const _q = new Quaternion()

// Capture a rig from a character wrapper. `root` must already be oriented
// so the character faces +X in wrapper space (world-authoring convention),
// and world matrices must be current (call updateWorldMatrix first).
export function captureRig(root: Object3D, kind: 'mixamo' | 'procedural'): Rig {
  const names = kind === 'mixamo' ? MIXAMO : PROCEDURAL
  const byName = new Map<string, Bone>()
  root.traverse((o) => {
    if ((o as Bone).isBone) {
      // normalize: strip mixamorig prefix and colon
      const n = o.name.replace(/^mixamorig:?/, '')
      byName.set(n, o as Bone)
    }
  })

  root.updateWorldMatrix(true, true)
  const rootWorldInv = root.getWorldQuaternion(new Quaternion()).invert()

  const bones: Partial<Record<RigBone, RigBoneInfo>> = {}
  for (const key of Object.keys(names) as RigBone[]) {
    const name = names[key]
    if (!name) continue
    const bone = byName.get(name)
    if (!bone) continue
    const parent = bone.parent!
    parent.getWorldQuaternion(_q)
    bones[key] = {
      bone,
      restLocalQ: bone.quaternion.clone(),
      restLocalP: bone.position.clone(),
      // express the parent orientation in wrapper (character) space
      parentRestWorldQ: rootWorldInv.clone().multiply(_q.clone()),
    }
  }

  // hips vertical unit conversion: character-space meters → hips-local units
  let hipsUnitScale = 1
  const hips = bones.hips
  if (hips) {
    const parentScale = new Vector3()
    hips.bone.parent!.getWorldScale(parentScale)
    const rootScale = new Vector3()
    root.getWorldScale(rootScale)
    // world units per hips-local unit, relative to the wrapper's scale
    const perUnit = parentScale.y / (rootScale.y || 1)
    hipsUnitScale = perUnit > 1e-8 ? 1 / perUnit : 1
  }

  return { bones, hipsUnitScale }
}
