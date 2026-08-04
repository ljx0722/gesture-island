// smoothing.js — EMA 平滑 + 手部帧平滑
import { lerp } from '../utils/math.js'

export function smoothPoint(prev, next, alpha = 0.35) {
  if (!prev) return { ...next }
  return {
    x: lerp(prev.x, next.x, alpha),
    y: lerp(prev.y, next.y, alpha),
    z: lerp(prev.z || 0, next.z || 0, alpha),
  }
}

export function smoothHand(prevHand, nextHand, alpha = 0.35) {
  if (!prevHand) return nextHand
  return {
    ...nextHand,
    landmarks: nextHand.landmarks.map((p, i) => smoothPoint(prevHand.landmarks[i], p, alpha)),
    palmCenter: smoothPoint(prevHand.palmCenter, nextHand.palmCenter, alpha),
    pinchPoint: smoothPoint(prevHand.pinchPoint, nextHand.pinchPoint, alpha),
  }
}

export function smoothHands(prevHands, nextHands, alpha = 0.35) {
  if (!prevHands || prevHands.length === 0) return nextHands
  return nextHands.map(hand => {
    const old = prevHands.find(h => h.id === hand.id)
    return smoothHand(old, hand, alpha)
  })
}
