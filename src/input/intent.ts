// The single input contract shared by humans and AI brains.
export interface PlayerIntent {
  // desired movement direction in world space, each -1..1
  moveX: number
  moveZ: number
  // world-space aim point on the ice
  aimX: number
  aimZ: number
  // held while charging a slap shot; releasing fires with the charge
  shootHeld: boolean
  // one-frame triggers
  passPressed: boolean
  wristShotPressed: boolean
  pokePressed: boolean
  checkPressed: boolean
  // -1 / +1 = deke left/right relative to heading, 0 = none
  dekeDir: -1 | 0 | 1
  sprint: boolean
}

export function emptyIntent(): PlayerIntent {
  return {
    moveX: 0,
    moveZ: 0,
    aimX: 0,
    aimZ: 0,
    shootHeld: false,
    passPressed: false,
    wristShotPressed: false,
    pokePressed: false,
    checkPressed: false,
    dekeDir: 0,
    sprint: false,
  }
}

export function clearTriggers(i: PlayerIntent): void {
  i.passPressed = false
  i.wristShotPressed = false
  i.pokePressed = false
  i.checkPressed = false
  i.dekeDir = 0
}
