// shadowPlayModule.js — module 6: body is window to reality, surroundings are shadow/particle world
import { drawMirrored } from '../../utils/canvas.js'

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

const WORLDS = [
  { id: 'void', name: '暗影虚空', bg: '#050508', colors: ['#8866cc', '#6666aa', '#aa88ee'], count: 100, size: 1.5, speed: 0.2 },
  { id: 'cosmic', name: '星河环绕', bg: '#020818', colors: ['#ffffff', '#aaccff', '#ccddff'], count: 120, size: 1.3, speed: 0.15 },
  { id: 'inferno', name: '火焰深渊', bg: '#0a0200', colors: ['#ff4400', '#ff8800', '#ffcc00', '#ff2200'], count: 80, size: 2, speed: 0.5 },
  { id: 'aurora', name: '极光天幕', bg: '#001208', colors: ['#44ff88', '#88ffbb', '#aaffcc', '#22ff66'], count: 90, size: 1.6, speed: 0.25 },
  { id: 'storm', name: '雷暴之夜', bg: '#0a0a10', colors: ['#ffffff', '#ccccff', '#6666aa'], count: 60, size: 1.4, speed: 0.6 },
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

    this._worldIdx = 0
    this._particles = []
    this._initWorld(WORLDS[0])

    this.params = {
      maskSoftness: 6, edgeGlow: 0.4, edgeGlowColor: '#8866ff',
      repelStrength: 0.3, vortexStrength: 0.2, worldBrightness: 1,
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
        vx: (Math.random() - 0.5) * w.speed * 0.02,
        vy: (Math.random() - 0.5) * w.speed * 0.02 - 0.002,
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
    this._worldCanvas.width = w; this._worldCanvas.height = h

    const dctx = this.displayCtx
    const wctx = this._worldCtx
    const world = this.getCurrentWorld()

    // Draw world (the shadow around the body)
    wctx.fillStyle = world.bg
    wctx.fillRect(0, 0, w, h)

    const mask = frameData.mask

    // Precompute mask gradient for repel force
    let maskGradX = null, maskGradY = null
    if (mask && mask.data && mask.width > 0) {
      const mw = mask.width, mh = mask.height
      maskGradX = new Float32Array(mw * mh)
      maskGradY = new Float32Array(mw * mh)
      for (let my = 1; my < mh - 1; my++) {
        for (let mx = 1; mx < mw - 1; mx++) {
          const i = my * mw + mx
          maskGradX[i] = (mask.data[i + 1] - mask.data[i - 1]) * 0.5
          maskGradY[i] = (mask.data[(my + 1) * mw + mx] - mask.data[(my - 1) * mw + mx]) * 0.5
        }
      }
    }

    // Collect hand positions for vortex
    const hands = []
    for (const id of ['left', 'right']) {
      const h = frameData[id + 'Hand'] || frameData.hands?.[id]
      if (h?.palmCenter) hands.push({ x: 1 - h.palmCenter.x, y: h.palmCenter.y })
    }

    // Animate particles with edge repel and hand vortex
    for (const pt of this._particles) {
      pt.x += pt.vx * dt * 60; pt.y += pt.vy * dt * 60

      // Edge repel: push particles away from body silhouette edge
      if (maskGradX && maskGradY) {
        const mx = clamp(Math.round(pt.x * (mask.width - 1)), 0, mask.width - 1)
        const my = clamp(Math.round(pt.y * (mask.height - 1)), 0, mask.height - 1)
        const gi = my * mask.width + mx
        const gx = maskGradX[gi], gy = maskGradY[gi]
        const gLen = Math.hypot(gx, gy)
        if (gLen > 0.01) {
          // Gradient points from low mask (outside) to high mask (body).
          // We want to push particles AWAY from the body edge, so push in gradient direction
          const str = this.params.repelStrength * 0.008 * gLen
          pt.x += gx * str; pt.y += gy * str
        }
      }

      // Hand vortex: particles near hands get pushed tangentially
      for (const hand of hands) {
        const dx = pt.x - hand.x, dy = pt.y - hand.y
        const d = Math.hypot(dx, dy)
        if (d < 0.18) {
          const force = (1 - d / 0.18) * this.params.vortexStrength * 0.004
          pt.x += -dy * force; pt.y += dx * force
        }
      }

      if (pt.x < 0) pt.x = 1; if (pt.x > 1) pt.x = 0
      if (pt.y < 0) pt.y = 1; if (pt.y > 1) pt.y = 0
      pt.phase += dt * 2
      const alpha = 0.35 + 0.3 * Math.sin(pt.phase)
      wctx.beginPath()
      wctx.arc(pt.x * w, pt.y * h, pt.size, 0, Math.PI * 2)
      wctx.fillStyle = this._hexToRgba(pt.color, alpha)
      wctx.fill()
    }

    // Draw camera to source (mirrored)
    const video = frameData.video || this.video
    if (video && video.readyState >= 2) {
      drawMirrored(this._sourceCtx, video, w, h)
    } else {
      this._sourceCtx.fillStyle = '#0a0a0f'
      this._sourceCtx.fillRect(0, 0, w, h)
    }

    const sourceData = this._sourceCtx.getImageData(0, 0, w, h)
    const worldData = wctx.getImageData(0, 0, w, h)
    const output = dctx.createImageData(w, h)
    const softness = this.params.maskSoftness
    const glowStr = this.params.edgeGlow
    const glowColor = this._parseColor(this.params.edgeGlowColor)

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // maskVal: 1 = body, 0 = background
        let maskVal = 0.3
        if (mask && mask.data && mask.width > 0) {
          const mx = clamp(Math.round((x / w) * (mask.width - 1)), 0, mask.width - 1)
          const my = clamp(Math.round((y / h) * (mask.height - 1)), 0, mask.height - 1)
          maskVal = mask.data[my * mask.width + mx] || 0
        }

        const si = (y * w + x) * 4
        const sr = sourceData.data[si], sg = sourceData.data[si + 1], sb = sourceData.data[si + 2]
        const wr = worldData.data[si], wg = worldData.data[si + 1], wb = worldData.data[si + 2]

        // REVERSED: body shows camera, surroundings show world
        // blend = 1 inside body → show camera; blend = 0 outside → show world
        const blend = clamp((maskVal - 0.5) * (softness / 4) + 0.5, 0, 1)
        let r = sr * blend + wr * (1 - blend)
        let g = sg * blend + wg * (1 - blend)
        let b = sb * blend + wb * (1 - blend)

        // Edge glow: highlight the transition zone
        if (glowStr > 0) {
          const edge = Math.abs(maskVal - 0.5)
          if (edge < 0.15) {
            const glow = (1 - edge / 0.15) * glowStr
            r = clamp(r + glowColor.r * glow * 255, 0, 255)
            g = clamp(g + glowColor.g * glow * 255, 0, 255)
            b = clamp(b + glowColor.b * glow * 255, 0, 255)
          }
        }

        output.data[si] = r
        output.data[si + 1] = g
        output.data[si + 2] = b
        output.data[si + 3] = 255
      }
    }

    dctx.putImageData(output, 0, 0)
  }

  _generateDemoMask(w, h) {
    this._demoTime += 0.016
    const t = this._demoTime
    const mask = new Float32Array(w * h)
    const cx = 0.5 + Math.sin(t * 0.4) * 0.05
    const cy = 0.45 + Math.cos(t * 0.3) * 0.03
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = x / w, ny = y / h
        const dx = (nx - cx) / 0.25, dy = (ny - cy) / 0.45
        mask[y * w + x] = clamp(1 - Math.sqrt(dx * dx + dy * dy), 0, 1)
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

  _hexToRgba(hex, alpha) {
    const c = hex.replace('#', '')
    return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${alpha})`
  }

  _parseColor(hex) {
    const c = hex.replace('#', '')
    return { r: parseInt(c.slice(0, 2), 16) / 255, g: parseInt(c.slice(2, 4), 16) / 255, b: parseInt(c.slice(4, 6), 16) / 255 }
  }

  reset() { this._demoTime = 0; this._initWorld(WORLDS[this._worldIdx]) }
  dispose() {}
}
