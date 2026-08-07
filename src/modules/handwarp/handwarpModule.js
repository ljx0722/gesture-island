// handwarpModule.js — module 4: real-time camera displacement driven by hand force fields
import { drawMirrored } from '../../utils/canvas.js'

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)) }
function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2) }

const EFFECTS = [
  { id: 'vortex', name: '漩涡扭曲', icon: '🌀' },
  { id: 'tear', name: '画面撕裂', icon: '⚡' },
  { id: 'ripple', name: '水波扩散', icon: '🌊' },
  { id: 'stretch', name: '拉伸变形', icon: '↔' },
  { id: 'gravity', name: '重力拖拽', icon: '🧲' },
]

export class HandwarpModule {
  constructor(displayCanvas, videoElement) {
    this.displayCanvas = displayCanvas
    this.displayCtx = displayCanvas.getContext('2d', { alpha: false })
    this.video = videoElement

    this.activeEffect = 'vortex'
    this.params = {
      vortexStrength: 35, tearStrength: 30, rippleStrength: 25, stretchStrength: 40,
      gravityStrength: 15, effectRadius: 180, tearThreshold: 0.15, rippleDecay: 0.85,
      stretchSmooth: 0.12,
    }

    // Offscreen canvases
    this._sourceCanvas = document.createElement('canvas')
    this._sourceCtx = this._sourceCanvas.getContext('2d', { willReadFrequently: true })
    this._outputCanvas = document.createElement('canvas')

    // Temporal state
    this.time = 0
    this._prevHands = []
    this._rippleSources = [] // { x, y, time, strength }
    this._demoTime = 0
    this.demoMode = false
  }

  // ── public API ──

  async init() {} // no async setup needed

  getCurrentEffect() { return EFFECTS.find(e => e.id === this.activeEffect) || EFFECTS[0] }
  getAllEffects() { return EFFECTS }

  selectEffect(id) { if (EFFECTS.some(e => e.id === id)) this.activeEffect = id; return this.getCurrentEffect() }
  nextEffect() {
    const idx = EFFECTS.findIndex(e => e.id === this.activeEffect)
    this.activeEffect = EFFECTS[(idx + 1) % EFFECTS.length].id
    return this.getCurrentEffect()
  }
  prevEffect() {
    const idx = EFFECTS.findIndex(e => e.id === this.activeEffect)
    this.activeEffect = EFFECTS[(idx - 1 + EFFECTS.length) % EFFECTS.length].id
    return this.getCurrentEffect()
  }

  setParams(p) { Object.assign(this.params, p) }

  // ── main render ──

  render(frameData, dt) {
    this.time += dt
    const { video, leftHand, rightHand } = frameData
    const w = this.displayCanvas.width || this.displayCanvas.clientWidth || 640
    const h = this.displayCanvas.height || this.displayCanvas.clientHeight || 480

    if (this.displayCanvas.width !== w || this.displayCanvas.height !== h) {
      this.displayCanvas.width = w; this.displayCanvas.height = h
    }

    // Downscale for performance
    const MAX = 640
    const scale = clamp(Math.min(1, MAX / Math.max(w, h)), 0.25, 1)
    const pw = Math.max(1, Math.round(w * scale))
    const ph = Math.max(1, Math.round(h * scale))

    this._sourceCanvas.width = w; this._sourceCanvas.height = h
    this._outputCanvas.width = pw; this._outputCanvas.height = ph

    // Draw mirrored camera
    const ctx = this.displayCtx
    if (video && video.readyState >= 2) {
      drawMirrored(this._sourceCtx, video, w, h)
    } else {
      this._sourceCtx.fillStyle = '#0a0a0f'
      this._sourceCtx.fillRect(0, 0, w, h)
    }

    const hands = this._collectHands(frameData)
    if (hands.length < 1 && !this.demoMode) {
      ctx.drawImage(this._sourceCanvas, 0, 0)
      return
    }

    // Track velocity and gesture transitions for ripple triggers
    this._updateHandHistory(hands, dt)
    this._checkGestureTransitions(frameData)

    const sourceData = this._sourceCtx.getImageData(0, 0, w, h)
    const outputData = new ImageData(pw, ph)

    const invScale = 1 / scale
    for (let py = 0; py < ph; py++) {
      for (let px = 0; px < pw; px++) {
        const wx = px * invScale, wy = py * invScale
        let dx = 0, dy = 0
        const active = this.activeEffect

        for (const h of hands) {
          const sx = h.x * w, sy = h.y * h
          const d = dist(wx, wy, sx, sy)
          const R = this.params.effectRadius

          if (active === 'vortex') {
            dx += this._vortexForce(wx, wy, sx, sy, d, R, h).dx
            dy += this._vortexForce(wx, wy, sx, sy, d, R, h).dy
          }
          if (active === 'tear') {
            dx += this._tearForce(wx, wy, sx, sy, d, R, h).dx
            dy += this._tearForce(wx, wy, sx, sy, d, R, h).dy
          }
          if (active === 'gravity') {
            dx += this._gravityForce(wx, wy, sx, sy, d, R, h).dx
            dy += this._gravityForce(wx, wy, sx, sy, d, R, h).dy
          }
        }

        // Ripple (hand-independent, time-decaying rings)
        if (active === 'ripple') {
          for (const rs of this._rippleSources) {
            const age = (this.time - rs.time) * 1000 // ms
            if (age > 2000) continue
            const rd = dist(wx, wy, rs.x * w, rs.y * h)
            const decay = Math.exp(-age / 800)
            const wave = Math.sin(rd * 0.04 - age * 0.01) * rs.strength * decay
            const angle = wx !== rs.x * w ? Math.atan2(wy - rs.y * h, wx - rs.x * w) : 0
            dx += Math.cos(angle) * wave * 20
            dy += Math.sin(angle) * wave * 20
          }
        }

        // Stretch (two-hand pinch)
        if (active === 'stretch' && hands.length >= 2 && hands[0].pinching && hands[1].pinching) {
          const a = { x: hands[0].x * w, y: hands[0].y * h }
          const b = { x: hands[1].x * w, y: hands[1].y * h }
          const midx = (a.x + b.x) / 2, midy = (a.y + b.y) / 2
          const lx = b.x - a.x, ly = b.y - a.y
          const len = Math.hypot(lx, ly) || 1
          const nx = lx / len, ny = ly / len
          const proj = (wx - midx) * nx + (wy - midy) * ny
          const perp = Math.abs((wx - midx) * ny - (wy - midy) * nx)
          const halfLen = len / 2
          if (Math.abs(proj) < halfLen && perp < R) {
            const factor = proj / halfLen
            const blend = 1 - perp / R
            dx += nx * factor * this.params.stretchStrength * blend
            dy += ny * factor * this.params.stretchStrength * blend
          }
        }

        dx = clamp(dx, -w, w)
        dy = clamp(dy, -h, h)

        const sx = clamp(Math.round(wx + dx), 0, w - 1)
        const sy = clamp(Math.round(wy + dy), 0, h - 1)
        const si = (sy * w + sx) * 4
        const oi = (py * pw + px) * 4
        outputData.data[oi] = sourceData.data[si]
        outputData.data[oi + 1] = sourceData.data[si + 1]
        outputData.data[oi + 2] = sourceData.data[si + 2]
        outputData.data[oi + 3] = 255
      }
    }

    const tmp = this._outputCanvas.getContext('2d')
    tmp.putImageData(outputData, 0, 0)
    ctx.drawImage(this._outputCanvas, 0, 0, pw, ph, 0, 0, w, h)
  }

  // ── force functions ──

  _vortexForce(wx, wy, sx, sy, d, R, hand) {
    if (d > R) return { dx: 0, dy: 0 }
    const angle = Math.atan2(wy - sy, wx - sx)
    const strength = (1 - d / R) * this.params.vortexStrength * 0.5
    return { dx: -Math.sin(angle) * strength, dy: Math.cos(angle) * strength }
  }

  _tearForce(wx, wy, sx, sy, d, R, hand) {
    if (d > R || !hand.pinching) return { dx: 0, dy: 0 }
    const v = Math.abs(hand.vx) + Math.abs(hand.vy)
    if (v < this.params.tearThreshold) return { dx: 0, dy: 0 }
    const dx = hand.vx * this.params.tearStrength * (1 - d / R) * 2
    const dy = hand.vy * this.params.tearStrength * (1 - d / R) * 2
    // Perpendicular tear discontinuity
    const perpX = -hand.vy, perpY = hand.vx
    const perpLen = Math.hypot(perpX, perpY) || 1
    const proj = ((wx - sx) * perpX + (wy - sy) * perpY) / perpLen
    const side = Math.sign(proj)
    return { dx: dx + side * Math.abs(dx) * 0.4, dy: dy + side * Math.abs(dy) * 0.4 }
  }

  _gravityForce(wx, wy, sx, sy, d, R, hand) {
    if (d > R * 1.5) return { dx: 0, dy: 0 }
    const angle = Math.atan2(wy - sy, wx - sx)
    const strength = this.params.gravityStrength * (1 - d / (R * 1.5))
    return { dx: Math.cos(angle) * strength * -0.3, dy: Math.sin(angle) * strength * -0.3 }
  }

  // ── hand state ──

  _collectHands(frameData) {
    const hands = []
    if (this.demoMode) {
      const demo = this._generateDemoHands(
        this.displayCanvas.width || 640, this.displayCanvas.height || 480
      )
      return [demo.left, demo.right].filter(Boolean)
    }
    for (const id of ['left', 'right']) {
      const h = frameData[id + 'Hand'] || frameData.hands?.[id]
      if (!h?.palmCenter) continue
      hands.push({
        x: h.palmCenter.x,
        y: h.palmCenter.y,
        pinching: frameData.isPinching || false,
        vx: 0, vy: 0,
      })
    }
    return hands
  }

  _updateHandHistory(hands, dt) {
    for (let i = 0; i < hands.length; i++) {
      const prev = this._prevHands.find(p => p._id === i)
      if (prev) {
        hands[i].vx = (hands[i].x - prev.x) / Math.max(dt, 0.001) * 0.02
        hands[i].vy = (hands[i].y - prev.y) / Math.max(dt, 0.001) * 0.02
      }
      hands[i]._id = i
    }
    this._prevHands = hands.map(h => ({ _id: h._id, x: h.x, y: h.y }))
  }

  _checkGestureTransitions(frameData) {
    const gesture = frameData.gestureType || 'none'
    if (gesture !== this._lastGesture && gesture !== 'none') {
      const hand = frameData.primaryHand || frameData.leftHand || frameData.rightHand
      if (hand?.palmCenter) {
        this._rippleSources.push({
          x: hand.palmCenter.x, y: hand.palmCenter.y,
          time: this.time, strength: this.params.rippleStrength / 25,
        })
        if (this._rippleSources.length > 6) this._rippleSources.shift()
      }
    }
    this._lastGesture = gesture
  }

  // ── demo mode ──

  _generateDemoHands(w, h) {
    this._demoTime += 0.016
    const t = this._demoTime
    return {
      left: {
        x: 0.22 + Math.sin(t * 0.7) * 0.06,
        y: 0.52 + Math.cos(t * 0.5) * 0.08,
        pinching: Math.sin(t * 1.3) > 0.3,
        vx: Math.cos(t * 0.7) * 0.04, vy: -Math.sin(t * 0.5) * 0.06,
      },
      right: {
        x: 0.75 + Math.sin(t * 0.7 + 1) * 0.06,
        y: 0.48 + Math.cos(t * 0.5 + 1) * 0.08,
        pinching: Math.sin(t * 0.8 + 2) > 0.5,
        vx: Math.cos(t * 0.7 + 1) * 0.04, vy: -Math.sin(t * 0.5 + 1) * 0.06,
      },
    }
  }

  renderDemo(dt) {
    this.demoMode = true
    this.render({}, dt)
    this.demoMode = false
  }

  // ── lifecycle ──

  reset() {
    this._prevHands = []
    this._rippleSources = []
    this._lastGesture = null
    this._demoTime = 0
  }

  dispose() {}
}
