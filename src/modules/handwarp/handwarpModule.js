// handwarpModule.js — module 4: pinch thumb+index to tear holes in screen, revealing a particle world
// Uses Canvas 2D composite operations — no per-pixel ImageData loops for 60fps performance.
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

    // Offscreen canvases
    this._sourceCanvas = document.createElement('canvas')
    this._sourceCtx = this._sourceCanvas.getContext('2d')
    this._worldCanvas = document.createElement('canvas')
    this._worldCtx = this._worldCanvas.getContext('2d')

    // Persistent tear mask — white where torn, accumulates across frames
    this._tearCanvas = null
    this._tearCtx = null

    this._prevPinch = {} // { id: {x, y} }
    this._lastGesture = null

    this.params = {
      tearSize: 34, healSpeed: 1.8, edgeRoughness: 0.55, edgeGlow: 0.7,
      edgeGlowColor: '#88ccff', worldBrightness: 1, particleSpeed: 0.3,
    }

    this.time = 0
    this._demoTime = 0
    this.demoMode = false
  }

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

  _ensureCanvases(w, h) {
    this._sourceCanvas.width = w; this._sourceCanvas.height = h
    this._worldCanvas.width = w; this._worldCanvas.height = h
    if (!this._tearCanvas) {
      this._tearCanvas = document.createElement('canvas')
      this._tearCtx = this._tearCanvas.getContext('2d')
      this._tearCanvas.width = w; this._tearCanvas.height = h
      this._tearCtx.fillStyle = '#000'; this._tearCtx.fillRect(0, 0, w, h)
    }
    if (this._tearCanvas.width !== w || this._tearCanvas.height !== h) {
      const old = this._tearCtx.getImageData(0, 0, this._tearCanvas.width, this._tearCanvas.height)
      this._tearCanvas.width = w; this._tearCanvas.height = h
      this._tearCtx.putImageData(old, 0, 0)
    }
  }

  _drawTearBlob(ctx, cx, cy, radius, roughness) {
    ctx.beginPath()
    const steps = 14
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2
      const jitter = roughness > 0 ? (Math.random() - 0.5) * radius * 0.7 * roughness + Math.sin(i * 5) * radius * 0.25 * roughness : 0
      const r = radius + jitter
      const px = cx + Math.cos(angle) * r, py = cy + Math.sin(angle) * r
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
      const hand = frameData[id + 'Hand'] || frameData.hands?.[id]
      if (!hand?.landmarks || !hand.landmarks[4] || !hand.landmarks[8]) continue
      const thumb = hand.landmarks[4], index = hand.landmarks[8]
      const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y, (thumb.z || 0) - (index.z || 0))
      const palmW = Math.hypot(hand.landmarks[5].x - hand.landmarks[17].x, hand.landmarks[5].y - hand.landmarks[17].y) || 0.1
      if (pinchDist < palmW * 0.35) {
        hands.push({ id, x: 1 - hand.palmCenter.x, y: hand.palmCenter.y })
      }
    }
    return hands
  }

  _demoPinchHands() {
    this._demoTime += 0.016; const t = this._demoTime
    const phase = Math.sin(t * 0.6)
    return phase > 0.1 ? [{ id: 'demoL', x: 0.35 + Math.sin(t * 0.7) * 0.08, y: 0.45 + Math.cos(t * 0.5) * 0.06 }] : []
  }

  render(frameData, dt) {
    this.time += dt
    const w = this.displayCanvas.width || this.displayCanvas.clientWidth || 640
    const h = this.displayCanvas.height || this.displayCanvas.clientHeight || 480
    this.displayCanvas.width = w; this.displayCanvas.height = h
    this._ensureCanvases(w, h)

    const ctx = this.displayCtx
    const tctx = this._tearCtx
    const wctx = this._worldCtx
    const world = this.getCurrentWorld()

    // 1. Draw camera to display (full screen)
    const video = frameData.video || this.video
    if (video && video.readyState >= 2) {
      drawMirrored(this._sourceCtx, video, w, h)
    } else {
      this._sourceCtx.fillStyle = '#0a0a0f'; this._sourceCtx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(this._sourceCanvas, 0, 0)

    // 2. Heal persistent tear mask (darken toward black)
    const healRate = this.params.healSpeed * dt
    tctx.globalCompositeOperation = 'source-over'
    if (healRate > 0.005) {
      tctx.fillStyle = `rgba(0,0,0,${healRate})`
      tctx.fillRect(0, 0, w, h)
    }

    // 3. Add new tear blobs (brighten where pinching)
    const pinchHands = this._collectPinchHands(frameData)
    tctx.globalCompositeOperation = 'lighter'

    // Burst: fist → open → instant large tear
    const gesture = frameData.gestureType || 'none'
    let burst = false
    if (gesture !== this._lastGesture && gesture === 'open' && this._lastGesture === 'fist') burst = true
    this._lastGesture = gesture

    for (const hand of pinchHands) {
      const cx = hand.x * w, cy = hand.y * h
      const prev = this._prevPinch[hand.id]
      const s = burst ? this.params.tearSize * 2.5 : this.params.tearSize

      this._drawTearBlob(tctx, cx, cy, s, this.params.edgeRoughness)

      if (prev) {
        const dx = cx - prev.x, dy = cy - prev.y
        const d = Math.hypot(dx, dy)
        const steps = Math.max(1, Math.floor(d / (this.params.tearSize * 0.4)))
        for (let si = 1; si <= steps; si++) {
          const t = si / steps
          this._drawTearBlob(tctx, prev.x + dx * t, prev.y + dy * t, s * (0.85 + 0.15 * t), this.params.edgeRoughness)
        }
      }
      this._prevPinch[hand.id] = { x: cx, y: cy }
    }
    for (const k of Object.keys(this._prevPinch)) {
      if (!pinchHands.find(h => h.id === k)) delete this._prevPinch[k]
    }
    tctx.globalCompositeOperation = 'source-over'

    // 4. Draw world (particles) onto world canvas
    wctx.fillStyle = world.bg
    wctx.fillRect(0, 0, w, h)
    for (const pt of this._particles) {
      pt.x += pt.vx * dt * 60; pt.y += pt.vy * dt * 60
      if (pt.x < 0) pt.x = 1; if (pt.x > 1) pt.x = 0
      if (pt.y < 0) pt.y = 1; if (pt.y > 1) pt.y = 0
      pt.phase += dt * 2
      const alpha = (0.35 + 0.35 * Math.sin(pt.phase)) * (this.params.worldBrightness ?? 1)
      wctx.beginPath(); wctx.arc(pt.x * w, pt.y * h, pt.size, 0, Math.PI * 2)
      wctx.fillStyle = this._hexToRgba(pt.color, alpha)
      wctx.fill()
    }

    // 5. Clip world to tear mask using composite
    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = w; tmpCanvas.height = h
    const tmp = tmpCanvas.getContext('2d')
    tmp.drawImage(this._worldCanvas, 0, 0)     // world
    tmp.globalCompositeOperation = 'destination-in'
    tmp.drawImage(this._tearCanvas, 0, 0)       // clip to tear mask

    // 6. Draw world (clipped) over camera
    ctx.drawImage(tmpCanvas, 0, 0)

    // 7. Edge glow with shadow
    if (this.params.edgeGlow > 0) {
      const glowCanvas = document.createElement('canvas')
      glowCanvas.width = w; glowCanvas.height = h
      const gctx = glowCanvas.getContext('2d')
      gctx.shadowBlur = 14 * this.params.edgeGlow
      gctx.shadowColor = this.params.edgeGlowColor
      gctx.globalCompositeOperation = 'source-over'
      gctx.drawImage(this._tearCanvas, 0, 0)
      // shadow is drawn around non-transparent pixels
      // extract shadow by drawing mask again over itself
      gctx.shadowBlur = 14 * this.params.edgeGlow
      gctx.globalCompositeOperation = 'source-over'
      gctx.drawImage(this._tearCanvas, 0, 0)
      // composite glow onto display (only where tear exists, to avoid full-screen glow)
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = this.params.edgeGlow * 0.5
      ctx.drawImage(glowCanvas, 0, 0)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  renderDemo(dt) {
    this.demoMode = true; this.render({}, dt); this.demoMode = false
  }

  _hexToRgba(hex, alpha) {
    const c = hex.replace('#', '')
    return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${alpha})`
  }

  reset() { this._tearCanvas = null; this._prevPinch = {}; this._demoTime = 0; this._initWorld(WORLDS[this._worldIdx]) }
  dispose() { this._tearCanvas = null; this._tearCtx = null; this._sourceCanvas.width = 0; this._worldCanvas.width = 0 }
}
