// All units are meters (NHL rink: 200ft x 85ft).
export const RINK = {
  length: 60.96,
  width: 25.9,
  halfLength: 30.48,
  halfWidth: 12.95,
  cornerRadius: 8.53,
  boardHeight: 1.07,
  glassHeight: 1.83,
  goalLineFromEnd: 3.35,
  blueLineFromCenter: 7.62,
  centerCircleRadius: 4.57,
  faceoffCircleRadius: 4.57,
  endZoneDotFromCenterX: 21.03,
  dotY: 6.71,
  neutralDotFromCenterX: 6.1,
  creaseRadius: 1.83,
} as const

export const GOAL = {
  width: 1.83,
  height: 1.22,
  depth: 1.12,
  postRadius: 0.048,
  // x position of the goal line (and the goal mouth)
  lineX: RINK.halfLength - RINK.goalLineFromEnd,
} as const

export const PUCK = {
  radius: 0.0381,
  height: 0.0254,
  // ice friction: constant deceleration in m/s^2
  friction: 0.35,
  boardRestitution: 0.55,
  tangentialDamping: 0.92,
  maxSpeed: 45,
} as const

export const ICE_TEX = {
  width: 4096,
  height: Math.round((4096 * RINK.width) / RINK.length),
} as const
