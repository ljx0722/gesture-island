// handIdentity.js — 跨帧手部 ID 追踪（从 handIdentity.ts 移植）
function trackDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export class HandIdentityTracker {
  constructor() {
    this._tracks = []
    this._nextId = 1
  }

  /**
   * Assign stable IDs to hand detections across frames.
   * Matches by palm center proximity (< 0.45 threshold), penalizing
   * handedness label conflicts. Tracks expire after 250ms without re-detection.
   */
  assign(detections, timestamp) {
    const available = [...this._tracks]
    const hands = detections.map(detection => {
      const match = available
        .map((track, index) => ({
          track,
          index,
          cost: trackDistance(track.center, detection.palmCenter)
            + (track.handedness !== 'unknown' && detection.handedness !== 'unknown'
               && track.handedness !== detection.handedness ? 1 : 0),
        }))
        .filter(({ cost }) => cost < 0.45)
        .sort((a, b) => a.cost - b.cost)[0]

      const track = match?.track ?? {
        id: `camera-hand-${this._nextId++}`,
        handedness: detection.handedness,
        center: detection.palmCenter,
        lastSeen: timestamp,
      }
      if (match) available.splice(match.index, 1)
      track.handedness = detection.handedness === 'unknown' ? track.handedness : detection.handedness
      track.center = detection.palmCenter
      track.lastSeen = timestamp
      return {
        ...detection,
        id: track.id,
        handedness: detection.handedness === 'unknown' ? track.handedness : detection.handedness,
      }
    })

    this._tracks = [
      ...this._tracks.filter(t => timestamp - t.lastSeen <= 250 && !hands.some(h => h.id === t.id)),
      ...hands.map(h => ({ id: h.id, handedness: h.handedness, center: h.palmCenter, lastSeen: timestamp })),
    ]
    return hands
  }

  reset() {
    this._tracks = []
    this._nextId = 1
  }
}
