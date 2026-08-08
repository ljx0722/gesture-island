// handwarpModule.js — pinch hands to pull/stretch a tear hole into any shape
// The tear starts as a circle and stays on screen. Pinching near its edge drags it.
import { drawMirrored } from '../../utils/canvas.js'

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2) }

const TEAR_VERTICES = 48
const GRAB_RADIUS = 0.12 // % of screen — how close pinch must be to tear edge to grab it
const PULL_NEIGHBORS = 6   // how many neighbor vertices get pulled (each side)
const SMOOTH_PASSES = 1

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
    this._maskCanvas = document.createElement('canvas')
    this._maskCtx = this._maskCanvas.getContext('2d')

    // Pre-allocated composite scratch canvas
    this._compositeCanvas = document.createElement('canvas')
    this._compositeCtx = this._compositeCanvas.getContext('2d')

    // Tear polygon — starts as circle, gets deformed by pinching
    this._initTearVertices()
    this._activePulls = {} // handId -> {vertexIdx}

    this.params = {
      edgeGlow: 0.7, edgeGlowColor: '#88ccff', worldBrightness: 1,
      particleSpeed: 0.3, grabRadius: 0.12,
    }

    this.time = 0; this._demoTime = 0; this.demoMode = false
  }

  // ── tear polygon ──

  _initTearVertices() {
    const cx = 0.5, cy = 0.45, rx = 0.22, ry = 0.28
    this._tearVertices = []
    for (let i = 0; i < TEAR_VERTICES; i++) {
      const a = (i / TEAR_VERTICES) * Math.PI * 2
      this._tearVertices.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry })
    }
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
        vx: (Math.random() - 0.5) * w.speed * 0.015, vy: (Math.random() - 0.5) * w.speed * 0.015 - 0.003,
        color: w.colors[Math.floor(Math.random() * w.colors.length)], size: w.size * (0.4 + Math.random() * 0.6),
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
    this._worldCanvas.width = w; this._worldCanvas.height = h
    this._maskCanvas.width = w; this._maskCanvas.height = h

    const ctx = this.displayCtx, mctx = this._maskCtx, wctx = this._worldCtx
    const world = this.getCurrentWorld()
    const verts = this._tearVertices

    // 1. Draw camera to display
    const video = frameData.video || this.video
    if (video && video.readyState >= 2) {
      drawMirrored(this._sourceCtx, video, w, h)
    } else {
      this._sourceCtx.fillStyle = '#0a0a0f'; this._sourceCtx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(this._sourceCanvas, 0, 0)

    // 2. Collect pinching hands and pull tear vertices
    const pinchHands = this._collectPinchHands(frameData)
    const grabR = this.params.grabRadius

    // Build map of which vertex each hand is pulling
    const newPulls = {}
    for (const hand of pinchHands) {
      const prev = this._activePulls[hand.id]
      let bestIdx = -1, bestDist = grabR
      const startIdx = prev?.vertexIdx ?? 0
      // Search near previous grab point first
      for (let di = -TEAR_VERTICES / 4; di <= TEAR_VERTICES / 4; di++) {
        const idx = ((startIdx + di) % TEAR_VERTICES + TEAR_VERTICES) % TEAR_VERTICES
        const d = dist(hand.x, hand.y, verts[idx].x, verts[idx].y)
        if (d < bestDist) { bestDist = d; bestIdx = idx }
      }
      if (bestIdx >= 0) {
        newPulls[hand.id] = { vertexIdx: bestIdx }
      }
    }

    // Pull vertices toward pinching hands (with neighbor falloff)
    for (const [handId, pull] of Object.entries(newPulls)) {
      const hand = pinchHands.find(h => h.id === handId)
      if (!hand) continue
      const vi = pull.vertexIdx
      // Pull main vertex and neighbors with gaussian-like falloff
      for (let di = -PULL_NEIGHBORS; di <= PULL_NEIGHBORS; di++) {
        const idx = ((vi + di) % TEAR_VERTICES + TEAR_VERTICES) % TEAR_VERTICES
        const weight = Math.exp(-(di * di) / (PULL_NEIGHBORS * 0.6))
        const v = verts[idx]
        v.x += (hand.x - v.x) * 0.25 * weight * dt * 60
        v.y += (hand.y - v.y) * 0.25 * weight * dt * 60
        // Clamp vertices to stay on screen
        v.x = clamp(v.x, 0.02, 0.98)
        v.y = clamp(v.y, 0.02, 0.98)
      }
    }

    // Smooth the polygon lightly
    for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
      const smoothed = verts.map(v => ({ x: v.x, y: v.y }))
      for (let i = 0; i < TEAR_VERTICES; i++) {
        const prev = smoothed[(i - 1 + TEAR_VERTICES) % TEAR_VERTICES]
        const next = smoothed[(i + 1) % TEAR_VERTICES]
        verts[i].x = prev.x * 0.15 + verts[i].x * 0.7 + next.x * 0.15
        verts[i].y = prev.y * 0.15 + verts[i].y * 0.7 + next.y * 0.15
      }
    }

    this._activePulls = newPulls

    // 3. Draw tear polygon on mask (white = inside tear)
    mctx.clearRect(0, 0, w, h)
    mctx.beginPath()
    mctx.moveTo(verts[0].x * w, verts[0].y * h)
    for (let i = 1; i < TEAR_VERTICES; i++) mctx.lineTo(verts[i].x * w, verts[i].y * h)
    mctx.closePath()
    mctx.fillStyle = '#fff'
    mctx.fill()

    // 4. Draw world (particles) on world canvas
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

    // 5. Composite: world clipped to tear mask, over camera
    this._compositeCanvas.width = w; this._compositeCanvas.height = h
    const tctx = this._compositeCtx
    tctx.globalCompositeOperation = 'source-over'
    tctx.drawImage(this._worldCanvas, 0, 0)
    tctx.globalCompositeOperation = 'destination-in'
    tctx.drawImage(this._maskCanvas, 0, 0)
    ctx.drawImage(this._compositeCanvas, 0, 0)

    // 6. Edge glow
    if (this.params.edgeGlow > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.shadowBlur = 16 * this.params.edgeGlow
      ctx.shadowColor = this.params.edgeGlowColor
      ctx.drawImage(this._maskCanvas, 0, 0)
      // draw again for shadow
      ctx.drawImage(this._maskCanvas, 0, 0)
      ctx.restore()
    }
  }

  // ── pinch detection ──

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
    return [
      { id: 'demoL', x: 0.3 + Math.sin(t * 0.4) * 0.08, y: 0.45 + Math.cos(t * 0.35) * 0.06 },
      { id: 'demoR', x: 0.7 + Math.sin(t * 0.45 + 1.5) * 0.1, y: 0.5 + Math.cos(t * 0.38 + 1.5) * 0.07 },
    ]
  }

  renderDemo(dt) { this.demoMode = true; this.render({}, dt); this.demoMode = false }

  _hexToRgba(hex, alpha) {
    const c = hex.replace('#', '')
    return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${alpha})`
  }

  reset() { this._initTearVertices(); this._activePulls = {}; this._demoTime = 0; this._initWorld(WORLDS[this._worldIdx]) }
  dispose() { this._maskCanvas.width = 0; this._sourceCanvas.width = 0; this._worldCanvas.width = 0; this._compositeCanvas.width = 0 }
}
