// lightTrailsModule.js — module 5: fingertip light painting on canvas
const FINGERTIP_INDICES = [4, 8, 12, 16, 20]
const MAX_HISTORY = 60

const PRESETS = [
  { id: 'rainbow', name: '彩虹画笔', baseColor: null, trailWidth: 8, fade: 0.94, glow: true, hueShift: 0.4 },
  { id: 'neon', name: '霓虹灯管', baseColor: '#00ffcc', trailWidth: 6, fade: 0.92, glow: true, hueShift: 0 },
  { id: 'fire', name: '火焰之舞', baseColor: '#ff6600', trailWidth: 10, fade: 0.90, glow: true, hueShift: 0.05 },
  { id: 'galaxy', name: '星河', baseColor: '#6c8cff', trailWidth: 5, fade: 0.96, glow: true, hueShift: 0.15 },
  { id: 'sparkle', name: '星光闪烁', baseColor: '#ffffff', trailWidth: 4, fade: 0.93, glow: true, hueShift: 0.25 },
]

function lerp(a, b, t) { return a + (b - a) * t }

export class LightTrailsModule {
  constructor(displayCanvas, videoElement) {
    this.displayCanvas = displayCanvas
    this.displayCtx = displayCanvas.getContext('2d', { alpha: false })
    this.video = videoElement

    // Trail layer — separate offscreen canvas for additive-like blending
    this._trailCanvas = document.createElement('canvas')
    this._trailCtx = this._trailCanvas.getContext('2d')
    this._cameraCanvas = document.createElement('canvas')
    this._cameraCtx = this._cameraCanvas.getContext('2d')

    this._history = {} // keyed by handId + fingerIndex → [{x,y,time}]
    this._presetIdx = 0
    this.params = {
      trailWidth: 8, fade: 0.94, glowIntensity: 0.7,
      hueShift: 0.4, baseColor: null, gestureColorShift: false,
    }
    this._applyPreset(PRESETS[0])

    this.time = 0
    this._demoTime = 0
    this.demoMode = false
  }

  // ── public API ──

  async init() {}

  getCurrentPreset() { return PRESETS[this._presetIdx] }
  getAllPresets() { return PRESETS }

  nextPreset() { this._presetIdx = (this._presetIdx + 1) % PRESETS.length; this._applyPreset(PRESETS[this._presetIdx]); return PRESETS[this._presetIdx] }
  prevPreset() { this._presetIdx = (this._presetIdx - 1 + PRESETS.length) % PRESETS.length; this._applyPreset(PRESETS[this._presetIdx]); return PRESETS[this._presetIdx] }
  selectPreset(i) { this._presetIdx = i % PRESETS.length; this._applyPreset(PRESETS[this._presetIdx]); return PRESETS[this._presetIdx] }

  _applyPreset(p) {
    Object.assign(this.params, {
      trailWidth: p.trailWidth, fade: p.fade, hueShift: p.hueShift,
      baseColor: p.baseColor, glowIntensity: p.glow ? 0.7 : 0,
      gestureColorShift: p.id === 'rainbow' || p.id === 'galaxy',
    })
  }

  setParams(p) { Object.assign(this.params, p) }

  // ── main render ──

  render(frameData, dt) {
    this.time += dt
    const w = this.displayCanvas.width || this.displayCanvas.clientWidth || 640
    const h = this.displayCanvas.height || this.displayCanvas.clientHeight || 480

    if (w !== this._trailCanvas.width || h !== this._trailCanvas.height) {
      this._trailCanvas.width = w; this._trailCanvas.height = h
      this._cameraCanvas.width = w; this._cameraCanvas.height = h
    }

    this.displayCanvas.width = w; this.displayCanvas.height = h
    const dctx = this.displayCtx
    const tctx = this._trailCtx

    // Fade trail layer
    tctx.globalCompositeOperation = 'source-over'
    tctx.fillStyle = `rgba(0,0,0,${1 - this.params.fade})`
    tctx.fillRect(0, 0, w, h)

    // Draw camera behind trails
    const video = frameData.video || this.video
    if (video && video.readyState >= 2) {
      this._cameraCtx.save()
      this._cameraCtx.scale(-1, 1)
      this._cameraCtx.drawImage(video, -w, 0, w, h)
      this._cameraCtx.restore()
    } else {
      this._cameraCtx.fillStyle = '#0a0a0f'
      this._cameraCtx.fillRect(0, 0, w, h)
    }

    // Collect fingertips
    const tips = this._collectFingertips(frameData)

    // Choose color based on gesture
    const shift = this.params.gestureColorShift
      ? (frameData.openness ?? 0.5) * this.params.hueShift
      : this.params.hueShift * (this.time * 0.3 % 1)

    // Draw trail circles at each tip
    tctx.globalCompositeOperation = 'lighter'
    for (const tip of tips) {
      const key = `${tip.handId}-${tip.finger}`
      if (!this._history[key]) this._history[key] = []

      const hist = this._history[key]
      hist.push({ x: tip.x, y: tip.y, time: this.time })
      while (hist.length > MAX_HISTORY) hist.shift()

      // Interpolate smooth curve through history
      if (hist.length > 1) {
        const width = this.params.trailWidth * (1 + tip.pinch * 0.8)
        const hue = ((tip.finger * 0.2 + shift + this.time * 0.1) % 1) * 360

        for (let i = 1; i < hist.length; i++) {
          const a = hist[i - 1], b = hist[i]
          const age = (this.time - a.time) / 3
          if (age > 1) continue
          const alpha = Math.max(0, 1 - age) * this.params.glowIntensity

          tctx.beginPath()
          tctx.moveTo(a.x * w, a.y * h)
          tctx.lineTo(b.x * w, b.y * h)
          tctx.lineWidth = width * (1 - age * 0.7)
          tctx.strokeStyle = this.params.baseColor
            ? this._hexToRgba(this.params.baseColor, alpha)
            : `hsla(${hue}, 100%, 60%, ${alpha})`
          tctx.lineCap = 'round'
          tctx.lineJoin = 'round'
          tctx.stroke()

          // Glow outer layer
          if (this.params.glowIntensity > 0) {
            tctx.lineWidth = width * 2.5 * (1 - age * 0.5)
            tctx.strokeStyle = this.params.baseColor
              ? this._hexToRgba(this.params.baseColor, alpha * 0.25)
              : `hsla(${hue}, 100%, 70%, ${alpha * 0.25})`
            tctx.stroke()
          }
        }
      }

      // Draw tip dot
      const dotRadius = this.params.trailWidth * 0.8
      const dotAlpha = this.params.glowIntensity * 0.9
      tctx.beginPath()
      tctx.arc(tip.x * w, tip.y * h, dotRadius, 0, Math.PI * 2)
      tctx.fillStyle = this.params.baseColor
        ? this._hexToRgba(this.params.baseColor, dotAlpha)
        : `hsla(${((tip.finger * 0.2 + shift) % 1) * 360}, 100%, 80%, ${dotAlpha})`
      tctx.fill()

      // Glow halo
      tctx.beginPath()
      tctx.arc(tip.x * w, tip.y * h, dotRadius * 3, 0, Math.PI * 2)
      tctx.fillStyle = this.params.baseColor
        ? this._hexToRgba(this.params.baseColor, dotAlpha * 0.15)
        : `hsla(${((tip.finger * 0.2 + shift) % 1) * 360}, 100%, 80%, ${dotAlpha * 0.15})`
      tctx.fill()
    }

    // Clean up history for hands no longer present
    const activeKeys = new Set(tips.map(t => `${t.handId}-${t.finger}`))
    for (const key of Object.keys(this._history)) {
      if (!activeKeys.has(key)) {
        const hist = this._history[key]
        if (hist.length > 0) {
          const last = hist[hist.length - 1]
          if (this.time - last.time > 2) delete this._history[key]
        }
      }
    }

    // Composite: camera → trail on top
    dctx.globalCompositeOperation = 'source-over'
    dctx.drawImage(this._cameraCanvas, 0, 0)
    dctx.drawImage(this._trailCanvas, 0, 0)
  }

  _collectFingertips(frameData) {
    const tips = []
    if (this.demoMode) {
      return this._generateDemoTips(
        this.displayCanvas.width || 640, this.displayCanvas.height || 480
      )
    }
    for (const id of ['left', 'right']) {
      const hand = frameData[id + 'Hand'] || frameData.hands?.[id]
      if (!hand?.landmarks) continue
      for (const fi of FINGERTIP_INDICES) {
        const pt = hand.landmarks[fi]
        if (!pt) continue
        tips.push({
          x: 1 - pt.x, // mirror for camera display
          y: pt.y,
          finger: fi,
          handId: id,
          pinch: frameData.isPinching ? 1 : 0,
        })
      }
    }
    return tips
  }

  _generateDemoTips(w, h) {
    this._demoTime += 0.016
    const t = this._demoTime
    const tips = []
    for (let handIdx = 0; handIdx < 2; handIdx++) {
      const offset = handIdx === 0 ? 0 : Math.PI * 0.8
      const cx = 0.25 + handIdx * 0.5 + Math.sin(t * 0.7 + offset) * 0.05
      const cy = 0.5 + Math.cos(t * 0.5 + offset) * 0.08
      for (let fi = 0; fi < FINGERTIP_INDICES.length; fi++) {
        const a = t * 1.2 + fi * 0.5 + offset
        const dx = (fi - 1.5) * 0.04 + Math.sin(a) * 0.03
        const dy = fi * 0.05 - 0.1 + Math.cos(a * 1.3) * 0.02
        tips.push({ x: cx + dx, y: cy + dy, finger: FINGERTIP_INDICES[fi], handId: `demo-${handIdx}`, pinch: 0 })
      }
    }
    return tips
  }

  renderDemo(dt) {
    this.demoMode = true
    this.render({}, dt)
    this.demoMode = false
  }

  // ── helpers ──

  _hexToRgba(hex, alpha) {
    const c = hex.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  reset() { this._history = {}; this._demoTime = 0 }
  dispose() {}
}
