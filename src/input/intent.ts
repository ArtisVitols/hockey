// The single input contract shared by humans and (later) AI brains.
export interface PlayerIntent {
  // desired movement direction in world space, each -1..1
  moveX: number
  moveZ: number
  // world-space aim point on the ice
  aimX: number
  aimZ: number
  // held while charging a shot; releasing fires with the accumulated charge
  shootHeld: boolean
  // one-frame trigger for a pass toward the aim point
  passPressed: boolean
  sprint: boolean
}

export function emptyIntent(): PlayerIntent {
  return { moveX: 0, moveZ: 0, aimX: 0, aimZ: 0, shootHeld: false, passPressed: false, sprint: false }
}
