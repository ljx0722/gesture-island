// handFeatures.js — 手部特征提取（从 features.ts 移植，含掌宽归一化）
const connections = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0))
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export const HAND_CONNECTIONS = connections

export function palmWidth(hand) {
  return Math.max(distance(hand.landmarks[5], hand.landmarks[17]), 0.001)
}

export function normalizedDistance(hand, a, b) {
  return distance(hand.landmarks[a], hand.landmarks[b]) / palmWidth(hand)
}

export function fingerAngle(hand, a, b, c) {
  const p1 = hand.landmarks[a], p2 = hand.landmarks[b], p3 = hand.landmarks[c]
  const first = { x: p1.x - p2.x, y: p1.y - p2.y, z: (p1.z || 0) - (p2.z || 0) }
  const second = { x: p3.x - p2.x, y: p3.y - p2.y, z: (p3.z || 0) - (p2.z || 0) }
  const denom = Math.hypot(first.x, first.y, first.z) * Math.hypot(second.x, second.y, second.z)
  if (!denom) return 0
  return Math.acos(clamp((first.x * second.x + first.y * second.y + first.z * second.z) / denom, -1, 1))
}

/**
 * Compute scale-invariant hand features.
 * Uses palm-width-normalized distances so openness is consistent
 * regardless of hand-to-camera distance.
 */
export function handFeatures(hand) {
  const tipIndices = [4, 8, 12, 16, 20]
  const baseIndices = [2, 5, 9, 13, 17]
  const extension = tipIndices.map((tip, index) =>
    normalizedDistance(hand, tip, 0) > normalizedDistance(hand, baseIndices[index], 0)
  )
  const pinch = normalizedDistance(hand, 4, 8)
  const openness = extension.filter(Boolean).length / extension.length
  return { extension, pinch, openness, palmWidth: palmWidth(hand), indexAngle: fingerAngle(hand, 5, 6, 8) }
}

export function mirrorPoint(point) {
  return { ...point, x: 1 - point.x }
}

export function smoothPoint(previous, next, alpha = 0.35) {
  if (!previous) return { ...next }
  return {
    x: previous.x + (next.x - previous.x) * alpha,
    y: previous.y + (next.y - previous.y) * alpha,
    z: (previous.z || 0) + ((next.z || 0) - (previous.z || 0)) * alpha,
  }
}

export function smoothFrame(previous, next, alpha = 0.35) {
  if (!previous) return next
  const hands = next.hands.map(hand => {
    const old = previous.hands.find(c => c.id === hand.id)
    if (!old) return hand
    return {
      ...hand,
      landmarks: hand.landmarks.map((p, i) => smoothPoint(old.landmarks[i], p, alpha)),
      palmCenter: smoothPoint(old.palmCenter, hand.palmCenter, alpha),
      pinchPoint: smoothPoint(old.pinchPoint, hand.pinchPoint, alpha),
    }
  })
  return { ...next, hands }
}
