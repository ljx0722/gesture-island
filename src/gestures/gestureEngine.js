// gestureEngine.js — 手势分类状态机（从 GestureEngine.ts 移植）
import { handFeatures } from '../tracking/handFeatures.js'
import { selectPrimaryHand } from '../tracking/handSelectors.js'

export const DEFAULT_CONFIG = {
  pinchThreshold: 0.75,
  openThreshold: 0.72,
  fistThreshold: 0.25,
  confirmFrames: 2,
  lostAfterMs: 140,
}

export class GestureEngine {
  constructor(config = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config }
    this._memory = new Map()
    this._candidate = new Map()
    this._primaryHandId = null
  }

  setConfig(config) {
    this._config = { ...this._config, ...config }
    this._candidate.clear()
  }

  reset() {
    this._memory.clear()
    this._candidate.clear()
    this._primaryHandId = null
  }

  /**
   * Process a HandFrame and return a rich GestureSnapshot.
   * Each hand gets its own gesture classification, velocity, and events.
   */
  update(frame) {
    const currentIds = new Set(frame.hands.map(h => h.id))
    const allEvents = []
    const snapshots = frame.hands.map(hand => this._updateHand(hand, frame.timestamp))
    snapshots.forEach(s => allEvents.push(...s.events))

    // Emit hand-lost for hands that disappeared
    this._memory.forEach((mem, handId) => {
      if (currentIds.has(handId) || frame.timestamp - mem.lastSeen <= this._config.lostAfterMs) return
      allEvents.push({ type: 'hand-lost', handId })
      this._memory.delete(handId)
      this._candidate.delete(handId)
      if (this._primaryHandId === handId) this._primaryHandId = null
    })

    const primaryHand = selectPrimaryHand(frame.hands, this._primaryHandId)
    this._primaryHandId = primaryHand?.id ?? this._primaryHandId
    const primary = snapshots.find(s => s.handId === this._primaryHandId) ?? null

    const byId = new Map(snapshots.map(s => [s.handId, s]))
    const byHandedness = {
      left: snapshots.find(s => s.handedness === 'left') ?? null,
      right: snapshots.find(s => s.handedness === 'right') ?? null,
      unknown: snapshots.filter(s => s.handedness === 'unknown'),
    }

    return {
      timestamp: frame.timestamp,
      events: allEvents,
      hands: snapshots,
      byId,
      byHandedness,
      primaryHandId: primary?.handId ?? null,
      hand: primary?.hand ?? null,
      velocity: primary?.velocity ?? 0,
      speed: primary?.speed ?? 0,
      pinch: primary?.pinch ?? false,
      gesture: primary?.gesture ?? 'none',
    }
  }

  _updateHand(hand, timestamp) {
    const features = handFeatures(hand)
    const previous = this._memory.get(hand.id)
    const seconds = previous ? Math.max((timestamp - previous.lastTimestamp) / 1000, 0.001) : 0.016
    const velocity = previous
      ? Math.hypot(hand.palmCenter.x - previous.lastPoint.x, hand.palmCenter.y - previous.lastPoint.y) / seconds
      : 0

    const pinch = features.pinch < this._config.pinchThreshold
    const rawGesture = pinch ? 'pinch'
      : features.openness > this._config.openThreshold ? 'open'
      : features.openness < this._config.fistThreshold ? 'fist'
      : features.extension[1] && !features.extension[2] && !features.extension[3] && !features.extension[4] ? 'point'
      : 'none'

    const prior = this._candidate.get(hand.id)
    const count = prior?.gesture === rawGesture ? prior.count + 1 : 1
    this._candidate.set(hand.id, { gesture: rawGesture, count })
    const gesture = count >= this._config.confirmFrames ? rawGesture : (previous?.gesture ?? 'none')

    const events = []
    if (!previous) events.push({ type: 'hand-found', handId: hand.id })
    if (!previous || previous.pinching !== pinch) {
      events.push(pinch
        ? { type: 'pinch-start', handId: hand.id, at: hand.pinchPoint }
        : { type: 'pinch-end', handId: hand.id })
    } else if (pinch) {
      events.push({ type: 'pinch-move', handId: hand.id, at: hand.pinchPoint })
    }
    if (gesture !== previous?.gesture) {
      if (gesture === 'open') events.push({ type: 'open-palm', handId: hand.id })
      if (gesture === 'fist') events.push({ type: 'fist', handId: hand.id })
      if (gesture === 'point') events.push({ type: 'point', handId: hand.id })
    }

    this._memory.set(hand.id, {
      pinching: pinch,
      lastPoint: hand.palmCenter,
      lastTimestamp: timestamp,
      lastSeen: timestamp,
      hand,
      gesture,
    })

    return {
      handId: hand.id,
      handedness: hand.handedness,
      hand,
      velocity,
      speed: velocity,
      pinch,
      gesture,
      events,
      stale: false,
    }
  }
}
