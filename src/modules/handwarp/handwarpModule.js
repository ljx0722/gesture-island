// handwarpModule.js — module 4: pinch to tear open holes in the screen, revealing a particle world inside
import { drawMirrored } from '../../utils/canvas.js'

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2) }

const WORLDS = [
  { id: 'starfield', name: '星空深渊', bg: '#050515', colors: ['#ffffff', '#aaccff', '#ffddaa'], count: 80, size: 1.8, speed: 0.3 },
  { id: 'fire', name: '火焰裂隙', bg: '#1a0500', colors: ['#ff6600', '#ff3300', '#ffcc00', '#ff9900'], count: 60, size: 2.2, speed: 0.6 },
  { id: 'rainbow', name: '彩虹裂缝', bg: '#0a0a0a', colors: ['#ff6666', '#ffcc66', '#66ff66', '#66ccff', '#cc66ff'], count: 70, size: 1.6, speed: 0.4 },
  { id: 'ice', name: '冰川裂口', bg: '#001020', colors: ['#aaddff', '#ffffff', '#ccddff', '#88bbff'], count: 90, size: 1.5, speed: 0.25 },
  { id: 'galaxy', name: '银河旋转', bg: '#100520', colors: ['#ffccff', '#cc99ff', '#ffd700', '#ffffff'], count: 70, size: 1.7, speed: 0.35 },
]

export class HandwarpModule {
  constructor(displayCanvas, videoElement) {
    this.displayCanvas = displayCanvas
    this.displayCtx = displayCanvas.getContext('2d', { alpha: false })
    this.video = videoElement

    this._worldIdx = 0
    this._particles = []
    this._initWorld(WORLDS[0])

    // Offscreen
    this._sourceCanvas = document.createElement('canvas')
    this._sourceCtx = this._sourceCanvas.getContext('2d', { willReadFrequently: true })
    this._maskCanvas = document.createElement('canvas')
    this._maskCtx = this._maskCanvas.getContext('2d')
    this._worldCanvas = document.createElement('canvas')
    this._worldCtx = this._worldCanvas.getContext('2d')

    this._tearMask = null // ImageData of tear mask, alpha=255 inside tear, 0 outside
    this._prevPinchPos = {} // keyed by hand id → {x,y}

    this.params = {
      tearSize: 32, healSpeed: 1.8, edgeRoughness: 0.6, edgeGlow: 0.7,
      edgeGlowColor: '#88ccff', worldBrightness: 1, particleCount: 80, particleSpeed: 0.3,
    }

    this.time = 0
    this._demoTime = 0
    this.demoMode = false
  }

  // ── public API ──

  async init() {}
  getCurrentWorld() { return WORLDS[this._worldIdx] }
  getAllWorlds() { return WORLDS }
  nextWorld() { this._worldIdx = (this._worldIdx + 1) % WORLDS.length; this._initWorld(WORLDS[this._worldIdx]); return WORLDS[this._worldIdx] }
  prevWorld() { this._worldIdx = (this._worldIdx - 1 + WORLDS.length) % WORLDS.length; this._initWorld(WORLDS[this._worldIdx]); return WORLDS[this._worldIdx] }
  selectWorld(i) { this._worldIdx = i % WORLDS.length; this._initWorld(WORLDS[this._worldIdx]); return WORLDS[this._worldIdx] }

  _initWorld(w) {
    this._particles = []
    for (let i = 0; i < w.count; i++) {
      this._particles.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * w.speed * 0.015,
        vy: (Math.random() - 0.5) * w.speed * 0.015 - 0.003,
        color: w.colors[Math.floor(Math.random() * w.colors.length)],
        size: w.size * (0.4 + Math.random() * 0.6),
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  setParams(p) { Object.assign(this.params, p) }

  // ── main render ──

  render(frameData, dt) {
    this.time += dt
    const w = this.displayCanvas.width || this.displayCanvas.clientWidth || 640
    const h = this.displayCanvas.height || this.displayCanvas.clientHeight || 480
    this.displayCanvas.width = w; this.displayCanvas.height = h
    this._sourceCanvas.width = w; this._sourceCanvas.height = h
    this._maskCanvas.width = w; this._maskCanvas.height = h
    this._worldCanvas.width = w; this._worldCanvas.height = h

    const dctx = this.displayCtx
    const world = this.getCurrentWorld()
    const maskCtx = this._maskCtx
    const wctx = this._worldCtx

    // Draw mirrored camera
    const video = frameData.video || this.video
    if (video && video.readyState >= 2) {
      drawMirrored(this._sourceCtx, video, w, h)
    } else {
      this._sourceCtx.fillStyle = '#0a0a0f'
      this._sourceCtx.fillRect(0, 0, w, h)
    }

    // Collect pinching hands
    const pinchHands = this._collectPinchHands(frameData)

    // Init mask (black = camera visible, white = tear visible)
    maskCtx.fillStyle = '#000'
    maskCtx.fillRect(0, 0, w, h)

    const tearSize = this.params.tearSize
    const roughness = this.params.edgeRoughness

    // Draw tear circles along current pinch positions and paths
    for (const h of pinchHands) {
      const key = h.id
      const cx = h.x * w, cy = h.y * h
      const prev = this._prevPinchPos[key]

      // Draw jagged tear blob at current position
      this._drawTearBlob(maskCtx, cx, cy, tearSize, roughness)

      // Draw connecting blobs along path to previous position
      if (prev) {
        const dx = cx - prev.x, dy = cy - prev.y
        const segDist = Math.hypot(dx, dy)
        const steps = Math.max(1, Math.floor(segDist / (tearSize * 0.5)))
        for (let s = 1; s <= steps; s++) {
          const t = s / steps
          const px = prev.x + dx * t, py = prev.y + dy * t
          this._drawTearBlob(maskCtx, px, py, tearSize * (0.8 + 0.2 * t), roughness)
        }
      }
      this._prevPinchPos[key] = { x: cx, y: cy }
    }

    // Clean up prev positions for hands no longer pinching
    const activeKeys = new Set(pinchHands.map(h => h.id))
    for (const k of Object.keys(this._prevPinchPos)) {
      if (!activeKeys.has(k)) delete this._prevPinchPos[k]
    }

    // Heal: if no one is pinching, dissolve the mask
    // (healing is visual-only since mask resets each frame — we simulate by not creating new mask)
    // Actually, we want the tear to PERSIST and slowly heal.
    // So we need a persistent mask that accumulates, not resets each frame.
    // Let's use the accumulated mask approach:
    // - _tearCanvas holds the persistent tear mask
    // - Each frame: heal (darken) the persistent mask a bit, then add new pinch blobs
    // - Render: composite using persistent mask
    if (!this._tearCanvas) {
      this._tearCanvas = document.createElement('canvas')
      this._tearCtx = this._tearCanvas.getContext('2d')
      this._tearCanvas.width = w; this._tearCanvas.height = h
      this._tearCtx.fillStyle = '#000'; this._tearCtx.fillRect(0, 0, w, h)
    }
    if (this._tearCanvas.width !== w || this._tearCanvas.height !== h) {
      this._tearCanvas.width = w; this._tearCanvas.height = h
      this._tearCtx.fillStyle = '#000'; this._tearCtx.fillRect(0, 0, w, h)
    }

    const tearCtx = this._tearCtx

    // Heal step: darken existing mask
    const healRate = this.params.healSpeed * dt
    tearCtx.globalCompositeOperation = 'source-over'
    tearCtx.fillStyle = `rgba(0,0,0,${healRate})`
    tearCtx.fillRect(0, 0, w, h)

    // Add new pinch blobs to persistent mask (brighten)
    tearCtx.globalCompositeOperation = 'lighter'

    // Check for burst (fist → open)
    let burst = false
    const gesture = frameData.gestureType || 'none'
    if (gesture !== this._lastGesture && gesture === 'open' && this._lastGesture === 'fist') {
      burst = true
    }
    this._lastGesture = gesture

    for (const h of pinchHands) {
      const key = h.id
      const cx = h.x * w, cy = h.y * h
      const prev = this._prevPinchStates?.[key]
      const s = burst ? tearSize * 3 : tearSize

      this._drawTearBlob(tearCtx, cx, cy, s, roughness)

      if (prev) {
        const dx = cx - prev.x, dy = cy - prev.y
        const d = Math.hypot(dx, dy)
        const steps = Math.max(1, Math.floor(d / (tearSize * 0.5)))
        for (let si = 1; si <= steps; si++) {
          const t = si / steps
          this._drawTearBlob(tearCtx, prev.x + dx * t, prev.y + dy * t, s * (0.85 + 0.15 * t), roughness)
        }
      }
    }

    // Store current pinch states for next frame's path
    if (!this._prevPinchStates) this._prevPinchStates = {}
    const activePinchKeys = new Set(pinchHands.map(h => h.id))
    for (const k of Object.keys(this._prevPinchStates)) {
      if (!activePinchKeys.has(k)) delete this._prevPinchStates[k]
    }
    for (const h of pinchHands) {
      this._prevPinchStates[h.id] = { x: h.x * w, y: h.y * h }
    }

    tearCtx.globalCompositeOperation = 'source-over'

    // Get persistent tear mask as ImageData
    this._tearMask = tearCtx.getImageData(0, 0, w, h)

    // Draw world (particle background) onto world canvas
    wctx.fillStyle = world.bg
    wctx.fillRect(0, 0, w, h)
    for (const pt of this._particles) {
      pt.x += pt.vx * dt * 60; pt.y += pt.vy * dt * 60
      if (pt.x < 0) pt.x = 1; if (pt.x > 1) pt.x = 0
      if (pt.y < 0) pt.y = 1; if (pt.y > 1) pt.y = 0
      pt.phase += dt * 2
      const alpha = 0.35 + 0.35 * Math.sin(pt.phase)
      wctx.beginPath()
      wctx.arc(pt.x * w, pt.y * h, pt.size, 0, Math.PI * 2)
      wctx.fillStyle = this._hexToRgba(pt.color, alpha)
      wctx.fill()
    }

    // Composite: camera → tear mask → world
    const sourceData = this._sourceCtx.getImageData(0, 0, w, h)
    const worldData = wctx.getImageData(0, 0, w, h)
    const output = dctx.createImageData(w, h)
    const maskData = this._tearMask.data
    const edgeGlow = this.params.edgeGlow
    const glowColor = this._parseColor(this.params.edgeGlowColor)

    // Precompute edge detection for glow: dilate mask - erode mask
    const edgeMask = new Uint8Array(w * h)
    const kern = 3
    for (let y = kern; y < h - kern; y++) {
      for (let x = kern; x < w - kern; x++) {
        const idx = (y * w + x) * 4
        const center = maskData[idx] / 255
        if (center < 0.1) continue
        let minN = 1
        for (let dy = -kern; dy <= kern; dy++) {
          for (let dx = -kern; dx <= kern; dx++) {
            const ni = ((y + dy) * w + (x + dx)) * 4
            minN = Math.min(minN, maskData[ni] / 255)
          }
        }
        if (minN < 0.3) edgeMask[y * w + x] = 1
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const maskVal = maskData[i] / 255
        const si = i

        // Inside tear → show world, outside → show camera
        const cr = sourceData.data[si], cg = sourceData.data[si + 1], cb = sourceData.data[si + 2]
        const wr = worldData.data[i], wg = worldData.data[i + 1], wb = worldData.data[i + 2]

        let r = cr * (1 - maskVal) + wr * maskVal
        let g = cg * (1 - maskVal) + wg * maskVal
        let b = cb * (1 - maskVal) + wb * maskVal

        // Edge glow
        if (edgeGlow > 0 && edgeMask[y * w + x]) {
          r = clamp(r + glowColor.r * edgeGlow * 180, 0, 255)
          g = clamp(g + glowColor.g * edgeGlow * 180, 0, 255)
          b = clamp(b + glowColor.b * edgeGlow * 180, 0, 255)
        }

        output.data[i] = r
        output.data[i + 1] = g
        output.data[i + 2] = b
        output.data[i + 3] = 255
      }
    }

    dctx.putImageData(output, 0, 0)
  }

  _drawTearBlob(ctx, cx, cy, radius, roughness) {
    ctx.beginPath()
    const steps = 14
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2
      const jitter = roughness > 0 ? (Math.random() - 0.5) * radius * 0.7 * roughness + (Math.sin(i * 5) * radius * 0.25 * roughness) : 0
      const r = radius + jitter
      const px = cx + Math.cos(angle) * r
      const py = cy + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = '#fff'
    ctx.fill()
  }

  _collectPinchHands(frameData) {
    if (this.demoMode) return this._demoPinchHands()
    const hands = []
    for (const id of ['left', 'right']) {
      const h = frameData[id + 'Hand'] || frameData.hands?.[id]
      if (!h?.palmCenter || !frameData.isPinching) continue
      hands.push({ id, x: 1 - h.palmCenter.x, y: h.palmCenter.y })
    }
    return hands
  }

  _demoPinchHands() {
    this._demoTime += 0.016
    const t = this._demoTime
    return [
      { id: 'demoL', x: 0.3 + Math.sin(t * 0.6) * 0.12 + Math.sin(t * 1.7) * 0.04, y: 0.45 + Math.cos(t * 0.5) * 0.1 + Math.cos(t * 1.3) * 0.03 },
      { id: 'demoR', x: 0.65 + Math.sin(t * 0.65 + 1) * 0.1 + Math.sin(t * 1.5) * 0.04, y: 0.5 + Math.cos(t * 0.55 + 1) * 0.1 + Math.cos(t * 1.4) * 0.03 },
    ]
  }

  renderDemo(dt) {
    this.demoMode = true
    this.render({}, dt)
    this.demoMode = false
  }

  _hexToRgba(hex, alpha) {
    const c = hex.replace('#', '')
    return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${alpha})`
  }

  _parseColor(hex) {
    const c = hex.replace('#', '')
    return { r: parseInt(c.slice(0, 2), 16) / 255, g: parseInt(c.slice(2, 4), 16) / 255, b: parseInt(c.slice(4, 6), 16) / 255 }
  }

  reset() { this._tearCanvas = null; this._prevPinchPos = {}; this._prevPinchStates = {}; this._demoTime = 0; this._initWorld(WORLDS[this._worldIdx]) }
  dispose() {}
}
