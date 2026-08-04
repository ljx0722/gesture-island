// handSelectors.js — 手部选择器 + 双手配对（从 handSelectors.ts 移植）
import { sortLeftRight } from './handSorter.js'

/**
 * Sort hands by handedness label (preferring MediaPipe labels when available).
 */
export function handsByHandedness(frame) {
  const hands = frame?.hands ?? []
  return {
    left: hands.find(h => h.handedness === 'left') ?? null,
    right: hands.find(h => h.handedness === 'right') ?? null,
    unknown: hands.filter(h => h.handedness === 'unknown'),
  }
}

/**
 * Select the primary (dominant) hand from a list.
 * Prefers: previously tracked ID > right hand > highest confidence.
 */
export function selectPrimaryHand(hands, preferredId) {
  return hands.find(h => h.id === preferredId)
    ?? hands.find(h => h.handedness === 'right')
    ?? [...hands].sort((a, b) => b.confidence - a.confidence)[0]
    ?? null
}

/**
 * Create a hand pair from 2 detected hands.
 * Falls back to position-based sorting if handedness labels are unreliable.
 */
export function selectHandPair(hands) {
  if (hands.length < 2) return null
  const left = hands.find(h => h.handedness === 'left') ?? null
  const right = hands.find(h => h.handedness === 'right') ?? null
  const ordered = left && right
    ? [left, right]
    : [...hands].sort((a, b) => a.palmCenter.x - b.palmCenter.x)
  const first = ordered[0]
  const second = ordered[1]
  const center = {
    x: (first.palmCenter.x + second.palmCenter.x) / 2,
    y: (first.palmCenter.y + second.palmCenter.y) / 2,
    z: ((first.palmCenter.z || 0) + (second.palmCenter.z || 0)) / 2,
  }
  return {
    first,
    second,
    left,
    right,
    center,
    distance: Math.hypot(first.palmCenter.x - second.palmCenter.x, first.palmCenter.y - second.palmCenter.y),
    angle: Math.atan2(second.palmCenter.y - first.palmCenter.y, second.palmCenter.x - first.palmCenter.x),
  }
}

/** Position-based sort (no handedness labels). Re-exports from handSorter. */
export { sortLeftRight }
