// handSorter.js — 基于位置的左右手分类（不依赖 MediaPipe handedness 标签）
const PALM_INDICES = [0, 5, 9, 13, 17]

function avgX(hand) {
  if (!hand?.landmarks) return 0
  let sum = 0
  for (const i of PALM_INDICES) sum += hand.landmarks[i].x
  return sum / PALM_INDICES.length
}

export function sortLeftRight(hands) {
  const result = { left: null, right: null }

  if (!hands || hands.length === 0) return result

  if (hands.length === 1) {
    const x = avgX(hands[0])
    if (x < 0.5) result.left = hands[0]
    else result.right = hands[0]
    return result
  }

  // 2 hands: sort by average x position (after mirror: smaller x = user's left)
  const sorted = [...hands].sort((a, b) => avgX(a) - avgX(b))
  result.left = sorted[0]
  result.right = sorted[1]
  return result
}

export function getHandCount(result) {
  let count = 0
  if (result.left) count++
  if (result.right) count++
  return count
}
