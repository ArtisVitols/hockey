// All units are meters. International/IIHF rink (dimensions.com):
// 61 m x 30 m, 8.5 m corners, goal lines 4 m from the ends, blue lines
// 8.83 m from center, 9 m faceoff circles, 3.66 m goal crease.
export const RINK = {
  length: 61,
  width: 30,
  halfLength: 30.5,
  halfWidth: 15,
  cornerRadius: 8.5,
  boardHeight: 1.07,
  // boards + safety glass total 3.5 m on international rinks
  glassHeight: 2.43,
  goalLineFromEnd: 4,
  blueLineFromCenter: 8.83,
  centerCircleRadius: 4.5,
  faceoffCircleRadius: 4.5,
  // end-zone dots 6.7 m from the goal line
  endZoneDotFromCenterX: 19.8,
  dotY: 7,
  // neutral-zone dots 1.5 m from the blue lines
  neutralDotFromCenterX: 7.33,
  creaseRadius: 1.83,
  refereeCreaseRadius: 3,
} as const

// Regulation goal (dimensions.com): 72"×48" mouth, 40" deep, 2" posts,
// 88" overall base width with 18"-radius base corners.
export const GOAL = {
  width: 1.83,
  height: 1.22,
  depth: 1.0,
  postRadius: 0.025,
  baseHalfWidth: 1.1175,
  baseCornerRadius: 0.457,
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
