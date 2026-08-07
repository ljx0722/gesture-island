// shadowPlayModule.js — module 6: body silhouette as a window into another world
const WORLDS = [
  { id: 'starfield', name: '星空之门', bgColor: '#050510', particles: true, particleColor: ['#ffffff', '#aaccff', '#ffddaa'], particleCount: 120, particleSize: 1.5, particleSpeed: 0.3 },
  { id: 'neonvoid', name: '霓虹深渊', bgColor: '#100010', particles: true, particleColor: ['#ff40d8', '#40ffff', '#ffe040'], particleCount: 100, particleSize: 2, particleSpeed: 0.5 },
  { id: 'fireworld', name: '火焰世界', bgColor: '#1a0a00', particles: true, particleColor: ['#ff6600', '#ff3300', '#ffcc00'], particleCount: 80, particleSize: 2.5, particleSpeed: 0.6 },
  { id: 'ocean', name: '深海之心', bgColor: '#001030', particles: true, particleColor: ['#00aaff', '#00ffcc', '#ffffff'], particleCount: 150, particleSize: 1.2, particleSpeed: 0.2 },
  { id: 'rainbow', name: '彩虹梦境', bgColor: '#0a0a1a', particles: true, particleColor: ['#ff6666', '#ffcc66', '#66ff66', '#66ccff', '#cc66ff'], particleCount: 100, particleSize: 1.8, particleSpeed: 0.4 },
]

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)) }

export class ShadowPlayModule {
  constructor(displayCanvas, videoElement) {
    this.displayCanvas = displayCanvas
    this.displayCtx = displayCanvas.getContext('2d', { alpha: false })
    this.video = videoElement

    this._sourceCanvas = document.createElement('canvas')
    this._sourceCtx = this._sourceCanvas.getContext('2d', { willReadFrequently: true })
    this._worldCanvas = document.createElement('canvas')
    this._worldCtx = this._worldCanvas.getContext('2d')

    this._worldIdx = 0
    this._particles = []
    this._initParticles(WORLDS[0])

    this.params = {
      maskSoftness: 8, edgeGlow: 0.5, edgeGlowColor: '#ffffff',
      particleSize: 1.5, particleSpeed: 0.3, worldAlpha: 0.9,
    }

    this.time = 0
    this._demoTime = 0
    this.demoMode = false
    this._needsMask = true // signal pipeline to start mask segmentation
  }

  // ── public API ──

  get needsMask() { return this._needsMask }

  async init() {}

  getCurrentWorld() { return WORLDS[this._worldIdx] }
  getAllWorlds() { return WORLDS }

  nextWorld() { this._worldIdx = (this._worldIdx + 1) % WORLDS.length; this._initParticles(WORLDS[this._worldIdx]); return WORLDS[this._worldIdx] }
  prevWorld() { this._worldIdx = (this._worldIdx - 1 + WORLDS.length) % WORLDS.length; this._initParticles(WORLDS[this._worldIdx]); return WORLDS[this._worldIdx] }
  selectWorld(i) { this._worldIdx = i % WORLDS.length; this._initParticles(WORLDS[this._worldIdx]); return WORLDS[this._worldIdx] }

  _initParticles(world) {
    this._particles = []
    if (!world.particles) return
    for (let i = 0; i < world.particleCount; i++) {
      this._particles.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * world.particleSpeed * 0.02,
        vy: (Math.random() - 0.5) * world.particleSpeed * 0.02 - 0.002,
        color: world.particleColor[Math.floor(Math.random() * world.particleColor.length)],
        size: world.particleSize * (0.5 + Math.random()),
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  setParams(p) {
    Object.assign(this.params, p)
    // Update live particle config
    const world = WORLDS[this._worldIdx]
    if (p.particleSize !== undefined) {
      for (const pt of this._particles) pt.size = p.particleSize * (0.5 + Math.random())
    }
  }

  // ── main render ──

  render(frameData, dt) {
    this.time += dt
    const w = this.displayCanvas.width || this.displayCanvas.clientWidth || 640
    const h = this.displayCanvas.height || this.displayCanvas.clientHeight || 480

    this.displayCanvas.width = w; this.displayCanvas.height = h
    this._sourceCanvas.width = w; this._sourceCanvas.height = h
    this._worldCanvas.width = w; this._worldCanvas.height = h

    const dctx = this.displayCtx
    const wctx = this._worldCtx
    const world = this.getCurrentWorld()

    // Draw the "world" inside the silhouette
    wctx.fillStyle = world.bgColor
    wctx.fillRect(0, 0, w, h)

    // Animate particles in the world
    for (const pt of this._particles) {
      pt.x += pt.vx * dt * 60; pt.y += pt.vy * dt * 60
      if (pt.x < 0) pt.x = 1; if (pt.x > 1) pt.x = 0
      if (pt.y < 0) pt.y = 1; if (pt.y > 1) pt.y = 0
      pt.phase += dt * 2
      const alpha = 0.4 + 0.3 * Math.sin(pt.phase)
      wctx.beginPath()
      wctx.arc(pt.x * w, pt.y * h, pt.size, 0, Math.PI * 2)
      wctx.fillStyle = this._colorToRgba(pt.color, alpha)
      wctx.fill()
    }

    // Draw mirrored camera to source
    const video = frameData.video || this.video
    if (video && video.readyState >= 2) {
      this._sourceCtx.save()
      this._sourceCtx.scale(-1, 1)
      this._sourceCtx.drawImage(video, -w, 0, w, h)
      this._sourceCtx.restore()
    } else {
      this._sourceCtx.fillStyle = '#0a0a0f'
      this._sourceCtx.fillRect(0, 0, w, h)
    }

    const sourceData = this._sourceCtx.getImageData(0, 0, w, h)
    const worldData = wctx.getImageData(0, 0, w, h)
    const outputData = dctx.createImageData(w, h)

    const mask = frameData.mask
    const softness = this.params.maskSoftness
    const glowStr = this.params.edgeGlow

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Get mask value (0 = background, 1 = person)
        let maskVal = 0.25 // default blend if no mask
        if (mask && mask.data && mask.width > 0) {
          const mx = Math.round((x / w) * mask.width)
          const my = Math.round((y / h) * mask.height)
          if (mx >= 0 && mx < mask.width && my >= 0 && my < mask.height) {
            maskVal = mask.data[my * mask.width + mx] || 0
          }
        }

        const si = (y * w + x) * 4
        const sr = sourceData.data[si]
        const sg = sourceData.data[si + 1]
        const sb = sourceData.data[si + 2]
        const wr = worldData.data[si]
        const wg = worldData.data[si + 1]
        const wb = worldData.data[si + 2]

        // Soft threshold: blend camera → world based on mask
        const blend = clamp((maskVal - 0.5) * (softness / 4) + 0.5, 0, 1)
        const r = sr * (1 - blend) + wr * blend
        const g = sg * (1 - blend) + wg * blend
        const b = sb * (1 - blend) + wb * blend

        // Edge glow: pixels near the mask threshold get highlighted
        if (glowStr > 0) {
          const edge = Math.abs(maskVal - 0.5) // 0 at the edge, 0.5 far from edge
          if (edge < 0.15) {
            const glow = (1 - edge / 0.15) * glowStr
            const color = this._parseHexColor(this.params.edgeGlowColor)
            outputData.data[si] = clamp(r + color.r * glow * 255, 0, 255)
            outputData.data[si + 1] = clamp(g + color.g * glow * 255, 0, 255)
            outputData.data[si + 2] = clamp(b + color.b * glow * 255, 0, 255)
          } else {
            outputData.data[si] = r
            outputData.data[si + 1] = g
            outputData.data[si + 2] = b
          }
        } else {
          outputData.data[si] = r
          outputData.data[si + 1] = g
          outputData.data[si + 2] = b
        }

        outputData.data[si + 3] = 255
      }
    }

    dctx.putImageData(outputData, 0, 0)
  }

  // ── helpers ──

  _colorToRgba(color, alpha) {
    if (color.startsWith('#')) return this._hexToRgba(color, alpha)
    if (color.startsWith('rgb(')) return color.replace(')', `,${alpha})`).replace('rgb', 'rgba')
    return `rgba(255,255,255,${alpha})`
  }

  _hexToRgba(hex, alpha) {
    const c = hex.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  _parseHexColor(hex) {
    const c = hex.replace('#', '')
    return {
      r: parseInt(c.slice(0, 2), 16) / 255,
      g: parseInt(c.slice(2, 4), 16) / 255,
      b: parseInt(c.slice(4, 6), 16) / 255,
    }
  }

  // ── demo mode ──

  _generateDemoMask(w, h) {
    // Synthetic person-shaped mask for demo
    this._demoTime += 0.016
    const t = this._demoTime
    const mask = new Float32Array(w * h)
    const cx = 0.5 + Math.sin(t * 0.4) * 0.05
    const cy = 0.45 + Math.cos(t * 0.3) * 0.03
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = x / w, ny = y / h
        // Elliptical person shape
        const dx = (nx - cx) / 0.25
        const dy = (ny - cy) / 0.45
        const dist = Math.sqrt(dx * dx + dy * dy)
        mask[y * w + x] = clamp(1 - dist, 0, 1)
      }
    }
    return { data: mask, width: w, height: h }
  }

  renderDemo(dt) {
    this.demoMode = true
    const w = this.displayCanvas.width || 640
    const h = this.displayCanvas.height || 480
    this.render({ mask: this._generateDemoMask(w, h) }, dt)
    this.demoMode = false
  }

  reset() { this._demoTime = 0; this._initParticles(WORLDS[this._worldIdx]) }
  dispose() {}
}
