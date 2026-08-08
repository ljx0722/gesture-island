// shadowPlayModule.js — module 6: body silhouette surrounded by a breathing shadow world
import { drawMirrored } from '../../utils/canvas.js'

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
function hexToRgb(hex) { const c=hex.replace('#',''); return {r:parseInt(c.slice(0,2),16),g:parseInt(c.slice(2,4),16),b:parseInt(c.slice(4,6),16)} }
function hexToRgba(hex, alpha) { const {r,g,b}=hexToRgb(hex); return `rgba(${r},${g},${b},${alpha})` }

const WORLDS = [
  { id: 'void', name: '暗影虚空',
    topColor: '#160a28', botColor: '#020106',
    particles: [{ colors: ['#8866cc', '#aa66ee', '#6633aa'], count: 80, size: 1.6, speed: 0.18, vyBias: 0.003, behavior: 'float' }],
    glowColor: '#9966dd', glowPulse: 0.3 },
  { id: 'cosmic', name: '星河环绕',
    topColor: '#041020', botColor: '#010308',
    particles: [
      { colors: ['#ffffff', '#ccddff'], count: 80, size: 1.2, speed: 0.1, vyBias: 0, behavior: 'float' },
      { colors: ['#ffd700', '#ffcc88'], count: 30, size: 1.6, speed: 0.25, vyBias: 0.002, behavior: 'spiral' },
    ],
    glowColor: '#88aadd', glowPulse: 0.25 },
  { id: 'inferno', name: '火焰深渊',
    topColor: '#180500', botColor: '#020100',
    particles: [
      { colors: ['#ff4400', '#ff8800', '#ffcc00'], count: 60, size: 2.2, speed: 0.5, vyBias: 0.008, behavior: 'rise' },
      { colors: ['#ff2200', '#ff6600'], count: 25, size: 3, speed: 0.7, vyBias: 0.012, behavior: 'rise' },
    ],
    glowColor: '#ff6622', glowPulse: 0.5 },
  { id: 'neon', name: '霓虹深渊',
    topColor: '#100018', botColor: '#020208',
    particles: [
      { colors: ['#ff40d8', '#ff80ff'], count: 50, size: 1.5, speed: 0.3, vyBias: 0, behavior: 'float' },
      { colors: ['#40ffff', '#80ffff'], count: 50, size: 1.5, speed: 0.3, vyBias: 0, behavior: 'float' },
    ],
    glowColor: '#ff40d8', glowPulse: 0.4 },
  { id: 'storm', name: '雷暴之夜',
    topColor: '#080810', botColor: '#020204',
    particles: [
      { colors: ['#cccccc', '#aaaaaa'], count: 50, size: 1.3, speed: 0.35, vyBias: -0.005, behavior: 'fall' },
      { colors: ['#ffffff'], count: 15, size: 2.5, speed: 1.5, vyBias: 0, behavior: 'flash' },
    ],
    glowColor: '#ccddff', glowPulse: 0.15 },
]

export class ShadowPlayModule {
  constructor(displayCanvas, videoElement) {
    this.displayCanvas = displayCanvas
    this.displayCtx = displayCanvas.getContext('2d', { alpha: false })
    this.video = videoElement
    this._sourceCanvas = document.createElement('canvas')
    this._sourceCtx = this._sourceCanvas.getContext('2d', { willReadFrequently: true })
    this._worldCanvas = document.createElement('canvas')
    this._worldCtx = this._worldCanvas.getContext('2d')

    // Downscale processing canvas for composite
    this._downCanvas = document.createElement('canvas')
    this._downCtx = this._downCanvas.getContext('2d')
    this._downData = null // pre-allocated ImageData

    this._worldIdx = 0
    this._particleGroups = []
    this._initWorld(WORLDS[0])

    this.params = {
      maskSoftness: 6, edgeGlow: 0.5, repelStrength: 0.4, vortexStrength: 0.3, worldBrightness: 1,
    }
    this.time = 0; this._demoTime = 0; this.demoMode = false
  }

  async init() {}
  getCurrentWorld() { return WORLDS[this._worldIdx] }
  getAllWorlds() { return WORLDS }
  nextWorld() { this._worldIdx = (this._worldIdx + 1) % WORLDS.length; this._initWorld(WORLDS[this._worldIdx]); return WORLDS[this._worldIdx] }
  prevWorld() { this._worldIdx = (this._worldIdx - 1 + WORLDS.length) % WORLDS.length; this._initWorld(WORLDS[this._worldIdx]); return WORLDS[this._worldIdx] }
  selectWorld(i) { this._worldIdx = i % WORLDS.length; this._initWorld(WORLDS[this._worldIdx]); return WORLDS[this._worldIdx] }

  _initWorld(w) {
    this._particleGroups = (w.particles || []).map(cfg => {
      const pts = []
      for (let i = 0; i < cfg.count; i++) {
        pts.push({
          x: Math.random(), y: Math.random(),
          size: cfg.size * (0.4 + Math.random() * 0.6),
          phase: Math.random() * Math.PI * 2, life: Math.random(),
          angle: Math.random() * Math.PI * 2, radius: 0.05 + Math.random() * 0.15,
        })
      }
      return { cfg, pts }
    })
  }

  setParams(p) { Object.assign(this.params, p) }

  render(frameData, dt) {
    this.time += dt
    const w = this.displayCanvas.width || this.displayCanvas.clientWidth || 640
    const h = this.displayCanvas.height || this.displayCanvas.clientHeight || 480
    this.displayCanvas.width = w; this.displayCanvas.height = h
    this._sourceCanvas.width = w; this._sourceCanvas.height = h
    this._worldCanvas.width = w; this._worldCanvas.height = h

    const wctx = this._worldCtx, dctx = this.displayCtx, world = this.getCurrentWorld()
    const brightness = this.params.worldBrightness ?? 1

    // Gradient background on world canvas
    const top = hexToRgb(world.topColor), bot = hexToRgb(world.botColor)
    const grad = wctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, `rgb(${top.r},${top.g},${top.b})`)
    grad.addColorStop(1, `rgb(${bot.r},${bot.g},${bot.b})`)
    wctx.fillStyle = grad
    wctx.fillRect(0, 0, w, h)

    // Get mask for repulsion / vortex
    const mask = frameData.mask

    // Collect hands for vortex
    const hands = []
    for (const id of ['left', 'right']) {
      const hd = frameData[id + 'Hand'] || frameData.hands?.[id]
      if (hd?.palmCenter) hands.push({ x: 1 - hd.palmCenter.x, y: hd.palmCenter.y })
    }

    // Animate and draw particles
    for (const group of this._particleGroups) {
      const cfg = group.cfg
      for (const pt of group.pts) {
        // Base motion
        if (cfg.behavior === 'rise') {
          pt.y -= cfg.speed * dt * 0.4 + cfg.vyBias * dt * 60
          if (pt.y < -0.05) { pt.y = 1.05; pt.x = Math.random() }
        } else if (cfg.behavior === 'fall') {
          pt.y += cfg.speed * dt * 0.4
          if (pt.y > 1.05) { pt.y = -0.05; pt.x = Math.random() }
        } else if (cfg.behavior === 'flash') {
          pt.life -= dt * 0.3
          if (pt.life < 0) { pt.x = Math.random(); pt.y = Math.random(); pt.life = 1; pt.size = cfg.size * (0.5 + Math.random()) }
        } else if (cfg.behavior === 'spiral') {
          pt.angle += cfg.speed * dt * 2
          pt.radius += 0.0004
          if (pt.radius > 0.25) pt.radius = 0.05
          pt.x = 0.5 + Math.cos(pt.angle) * pt.radius
          pt.y = 0.5 + Math.sin(pt.angle) * pt.radius * 0.7
        } else {
          pt.x += (Math.random() - 0.5) * cfg.speed * dt * 2
          pt.y += (Math.random() - 0.5) * cfg.speed * dt * 2 + cfg.vyBias * dt * 60
          if (pt.x < 0) pt.x = 1; if (pt.x > 1) pt.x = 0
          if (pt.y < 0) pt.y = 1; if (pt.y > 1) pt.y = 0
        }

        // Vortex around hands
        for (const hand of hands) {
          const dx = pt.x - hand.x, dy = pt.y - hand.y
          const d = Math.hypot(dx, dy)
          if (d < 0.2) {
            const force = (1 - d / 0.2) * this.params.vortexStrength * dt * 0.8
            pt.x += -dy * force; pt.y += dx * force
          }
        }

        // Repel from body edge
        if (mask && mask.data && mask.width > 0) {
          const mx = clamp(Math.round(pt.x * (mask.width - 1)), 0, mask.width - 1)
          const my = clamp(Math.round(pt.y * (mask.height - 1)), 0, mask.height - 1)
          const mVal = mask.data[my * mask.width + mx] || 0
          if (mVal > 0.3 && mVal < 0.7) {
            // Near body edge — push outward
            const str = (mVal - 0.5) * this.params.repelStrength * dt * 0.12
            pt.x += (pt.x - 0.5) * str; pt.y += (pt.y - 0.45) * str
          }
        }

        if (cfg.behavior === 'flash') {
          if (pt.life > 0.85) {
            const alpha = Math.min(1, (1 - pt.life) * 6) * brightness
            wctx.beginPath(); wctx.arc(pt.x * w, pt.y * h, pt.size * 3, 0, Math.PI * 2)
            wctx.fillStyle = hexToRgba(cfg.colors[0], alpha)
            wctx.fill()
            // Lightning bolt
            if (Math.random() < 0.3) {
              wctx.strokeStyle = hexToRgba('#ffffff', alpha * 0.7)
              wctx.lineWidth = 2
              wctx.beginPath(); wctx.moveTo(pt.x * w, pt.y * h)
              for (let i = 0; i < 3; i++) {
                wctx.lineTo(pt.x * w + (i - 1) * 60 + (Math.random() - 0.5) * 100, pt.y * h + i * 80 + (Math.random() - 0.5) * 60)
              }
              wctx.stroke()
            }
          }
        } else {
          pt.phase += dt * (1.5 + cfg.speed * 2)
          const alpha = clamp((0.25 + 0.25 * Math.sin(pt.phase)) * brightness, 0, 1)
          wctx.beginPath(); wctx.arc(pt.x * w, pt.y * h, pt.size, 0, Math.PI * 2)
          wctx.fillStyle = hexToRgba(cfg.colors[Math.floor(Math.random() * cfg.colors.length)], alpha)
          wctx.fill()
        }
      }
    }

    // Draw camera
    const video = frameData.video || this.video
    if (video && video.readyState >= 2) {
      drawMirrored(this._sourceCtx, video, w, h)
    } else {
      this._sourceCtx.fillStyle = '#0a0a0f'; this._sourceCtx.fillRect(0, 0, w, h)
    }

    const sourceData = this._sourceCtx.getImageData(0, 0, w, h)
    const worldData = wctx.getImageData(0, 0, w, h)

    // Downscale composite for performance: max 480px wide
    const MAX = 480
    const scale = Math.min(1, MAX / Math.max(w, h))
    const dw = Math.max(1, Math.round(w * scale)), dh = Math.max(1, Math.round(h * scale))
    if (this._downCanvas.width !== dw || this._downCanvas.height !== dh) {
      this._downCanvas.width = dw; this._downCanvas.height = dh
      this._downData = null
    }
    if (!this._downData) this._downData = this._downCtx.createImageData(dw, dh)
    const output = this._downData
    const softness = this.params.maskSoftness
    const glowStr = this.params.edgeGlow
    const {r:gr, g:gg, b:gb} = hexToRgb(world.glowColor)
    const breathe = 1 + Math.sin(this.time * 1.5) * world.glowPulse
    const invScale = 1 / scale

    for (let dy = 0; dy < dh; dy++) {
      const y = Math.round(dy * invScale)
      for (let dx = 0; dx < dw; dx++) {
        const x = Math.round(dx * invScale)
        let maskVal = 0.3
        if (mask && mask.data && mask.width > 0) {
          const mx = clamp(Math.round((x / w) * (mask.width - 1)), 0, mask.width - 1)
          const my = clamp(Math.round((y / h) * (mask.height - 1)), 0, mask.height - 1)
          maskVal = mask.data[my * mask.width + mx] || 0
        }

        const si = (y * w + x) * 4
        const sr = sourceData.data[si], sg = sourceData.data[si + 1], sb = sourceData.data[si + 2]
        const wr = worldData.data[si], wg = worldData.data[si + 1], wb = worldData.data[si + 2]

        const blend = clamp((maskVal - 0.5) * (softness / 5) + 0.5, 0, 1)
        let r = sr * blend + wr * (1 - blend)
        let g = sg * blend + wg * (1 - blend)
        let b = sb * blend + wb * (1 - blend)

        if (glowStr > 0) {
          const edgeDist = Math.abs(maskVal - 0.5)
          if (edgeDist < 0.15) {
            const glow = (1 - edgeDist / 0.15) * glowStr * breathe
            r = clamp(r + gr * glow * 200, 0, 255)
            g = clamp(g + gg * glow * 200, 0, 255)
            b = clamp(b + gb * glow * 200, 0, 255)
          }
        }

        const di = (dy * dw + dx) * 4
        output.data[di] = r; output.data[di + 1] = g; output.data[di + 2] = b; output.data[di + 3] = 255
      }
    }

    this._downCtx.putImageData(output, 0, 0)
    dctx.drawImage(this._downCanvas, 0, 0, dw, dh, 0, 0, w, h)
  }

  _generateDemoMask(w, h) {
    this._demoTime += 0.016; const t = this._demoTime
    const mask = new Float32Array(w * h)
    const cx = 0.5 + Math.sin(t * 0.4) * 0.06, cy = 0.43 + Math.cos(t * 0.3) * 0.04
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x / w - cx) / 0.22, dy = (y / h - cy) / 0.44
        mask[y * w + x] = clamp(1 - Math.sqrt(dx * dx + dy * dy), 0, 1)
      }
    }
    return { data: mask, width: w, height: h }
  }

  renderDemo(dt) {
    this.demoMode = true
    const w = this.displayCanvas.width || 640, h = this.displayCanvas.height || 480
    this.render({ mask: this._generateDemoMask(w, h) }, dt)
    this.demoMode = false
  }

  reset() { this._demoTime = 0; this._initWorld(WORLDS[this._worldIdx]) }
  dispose() { this._sourceCanvas.width = 0; this._worldCanvas.width = 0; this._downCanvas.width = 0; this._downData = null }
}
