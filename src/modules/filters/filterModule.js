// filterModule.js — 模块②入口：摄像头滤镜渲染管线
import { createMaskSegmenter } from '../../tracking/maskSegmenter.js'
import { MaskProcessor } from './maskProcessor.js'
import { PatchRenderer } from './patchRenderer.js'
import { FILTER_APPLIERS } from './filterEffects.js'
import { FILTER_PRESETS, getFilterById } from './filterPresets.js'
import { drawMirrored } from '../../utils/canvas.js'
import { HAND_CONNECTIONS } from '../../tracking/handFeatures.js'

export class FilterModule {
  constructor(displayCanvas, videoElement) {
    this.displayCanvas = displayCanvas
    this.displayCtx = displayCanvas.getContext('2d', { alpha: false })
    this.video = videoElement
    this.maskSegmenter = null
    this.maskProcessor = new MaskProcessor()
    this.patchRenderer = new PatchRenderer()

    this.currentFilterId = 'vintage-halftone'
    this.filterParams = {}
    this.preparedFilterParams = {}
    this._blendFactor = 0
    this._gestureIntensity = 0
    this._gestureSpeed = 0
    this.time = 0

    // Offscreen canvases
    this._sourceCanvas = document.createElement('canvas')
    this._sourceCtx = this._sourceCanvas.getContext('2d', { willReadFrequently: true })
    this._processCanvas = document.createElement('canvas')
    this._processCtx = this._processCanvas.getContext('2d', { willReadFrequently: true })
    this._downCanvas = document.createElement('canvas')
    this._downCtx = this._downCanvas.getContext('2d', { willReadFrequently: true })
    this._demoCanvas = document.createElement('canvas')

    // Load default params
    this._loadDefaultParams()

    // Demo mode state
    this.demoMode = false
    this._demoHands = null
    this._demoTime = 0
  }

  _loadDefaultParams() {
    const preset = getFilterById(this.currentFilterId)
    this.filterParams = {}
    if (preset) {
      for (const [key, p] of Object.entries(preset.params)) {
        this.filterParams[key] = p.default
      }
    }
    this._prepareFilterParams()
  }

  _prepareFilterParams() {
    const preset = getFilterById(this.currentFilterId)
    const prepared = { ...this.filterParams }
    if (preset) {
      for (const [key, def] of Object.entries(preset.params)) {
        const type = def.type || 'range'
        if (type === 'range' && typeof prepared[key] === 'number') {
          prepared[key] = Math.max(def.min, Math.min(def.max, prepared[key]))
        }
        if (type === 'color') {
          prepared[`${key.replace(/Color$/, '')}Rgb`] = this._hexToRgb(prepared[key] || def.default)
        }
      }
    }
    this.preparedFilterParams = prepared
  }

  _hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '')
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [255, 255, 255]
    return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
  }

  async init(options = {}) {
    this.maskSegmenter = await createMaskSegmenter({
      onProgress: options.onProgress,
    })
  }

  getCurrentFilter() {
    return getFilterById(this.currentFilterId)
  }

  getAllFilters() {
    return FILTER_PRESETS
  }

  selectFilter(id) {
    this.currentFilterId = id
    const preset = getFilterById(id)
    if (preset) {
      const newParams = {}
      for (const [key, p] of Object.entries(preset.params)) {
        // Keep existing param values if they exist, otherwise use default
        newParams[key] = this.filterParams[key] ?? p.default
      }
      this.filterParams = newParams
      this._prepareFilterParams()
    }
    return preset
  }

  nextFilter() {
    const idx = FILTER_PRESETS.findIndex(f => f.id === this.currentFilterId)
    const next = (idx + 1) % FILTER_PRESETS.length
    return this.selectFilter(FILTER_PRESETS[next].id)
  }

  prevFilter() {
    const idx = FILTER_PRESETS.findIndex(f => f.id === this.currentFilterId)
    const prev = (idx - 1 + FILTER_PRESETS.length) % FILTER_PRESETS.length
    return this.selectFilter(FILTER_PRESETS[prev].id)
  }

  /**
   * Main render frame called from pipeline or demo loop
   */
  render(frameData, dt) {
    this.time += dt

    const { video, hands, leftHand, rightHand, mask } = frameData
    const w = this.displayCanvas.width || this.displayCanvas.clientWidth
    const h = this.displayCanvas.height || this.displayCanvas.clientHeight

    // Gesture-driven blend factor from two-hand distance
    const twoDist = frameData.twoHandDistance || 0
    const blendFactor = twoDist > 0 ? Math.min(1, twoDist * 3) : 0
    this._blendFactor += (blendFactor - this._blendFactor) * 0.1
    const openness = frameData.openness ?? 0
    const gestureGain = this.filterParams.gestureSensitivity ?? 1
    this._gestureIntensity += (Math.max(0, Math.min(1, openness * gestureGain)) - this._gestureIntensity) * 0.12
    const gestureSpeed = frameData.speed ?? frameData.velocity ?? 0
    this._gestureSpeed += (gestureSpeed - this._gestureSpeed) * 0.12
    const gestureParams = { ...this.preparedFilterParams, gestureIntensity: this._gestureIntensity, gestureSpeed: this._gestureSpeed, twoHandBlend: this._blendFactor }

    if (this.displayCanvas.width !== w || this.displayCanvas.height !== h) {
      this.displayCanvas.width = w
      this.displayCanvas.height = h
    }

    const ctx = this.displayCtx

    // Downscale processing for performance (max 640px wide)
    const MAX_PROC = 640
    const scale = Math.min(1, MAX_PROC / Math.max(w, h))
    const pw = Math.max(1, Math.round(w * scale))
    const ph = Math.max(1, Math.round(h * scale))

    // Resize offscreen canvases
    this._downCanvas.width = pw; this._downCanvas.height = ph
    this._sourceCanvas.width = w; this._sourceCanvas.height = h
    this._processCanvas.width = pw; this._processCanvas.height = ph

    drawMirrored(this._sourceCtx, video, w, h)

    let processedMask = false
    if (mask && mask.data && !this.demoMode) {
      this.maskProcessor.process(mask.data, mask.width, mask.height)
      processedMask = true
    }

    let patches = []
    const hasBothHands = leftHand && rightHand
    const hasOneHand = leftHand || rightHand
    if (hasBothHands) {
      patches = this.patchRenderer.generateQuads(leftHand, rightHand, w, h)
    }

    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this._sourceCanvas, 0, 0, w, h)

    const applyFilter = FILTER_APPLIERS[this.currentFilterId]

    // Single-hand: fullscreen filter fallback
    if (!hasBothHands && hasOneHand && applyFilter) {
      // Downscale source to process size
      this._downCtx.drawImage(this._sourceCanvas, 0, 0, pw, ph)
      const sourceData = this._downCtx.getImageData(0, 0, pw, ph)
      const filteredData = this._downCtx.createImageData(pw, ph)
      for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
          const idx = (py * pw + px) * 4
          const wx = Math.round(px / scale), wy = Math.round(py / scale)
          let ma = 255
          if (processedMask) ma = this.maskProcessor.getAlphaAt(wx, wy)
          const r = sourceData.data[idx], g = sourceData.data[idx + 1], b = sourceData.data[idx + 2]
          if (ma > 10) {
            const result = applyFilter(r, g, b, wx, wy, ma, gestureParams, this.time)
            filteredData.data[idx] = result.r
            filteredData.data[idx + 1] = result.g
            filteredData.data[idx + 2] = result.b
            filteredData.data[idx + 3] = 255
          } else {
            filteredData.data[idx] = r
            filteredData.data[idx + 1] = g
            filteredData.data[idx + 2] = b
            filteredData.data[idx + 3] = 255
          }
        }
      }
      this._processCtx.putImageData(filteredData, 0, 0)
      ctx.drawImage(this._processCanvas, 0, 0, pw, ph, 0, 0, w, h)
      this._drawHandSkeletons(ctx, leftHand, rightHand, w, h)
      return
    }

    if (patches.length === 0) {
      this._drawHandSkeletons(ctx, leftHand, rightHand, w, h)
      return
    }

    for (const patch of patches) {
      if (this.patchRenderer.isDegenerate(patch.vertices)) continue

      const xs = patch.vertices.map(v => v.x), ys = patch.vertices.map(v => v.y)
      const bx = Math.max(0, Math.floor(Math.min(...xs)))
      const by = Math.max(0, Math.floor(Math.min(...ys)))
      const bw = Math.min(w - bx, Math.ceil(Math.max(...xs) - bx))
      const bh = Math.min(h - by, Math.ceil(Math.max(...ys) - by))
      if (bw <= 0 || bh <= 0) continue

      // Process at downscaled resolution for performance
      const sbx = Math.round(bx * scale), sby = Math.round(by * scale)
      const sbw = Math.max(1, Math.round(bw * scale)), sbh = Math.max(1, Math.round(bh * scale))

      this._downCtx.drawImage(this._sourceCanvas, bx, by, bw, bh, 0, 0, sbw, sbh)
      const sourceData = this._downCtx.getImageData(0, 0, sbw, sbh)
      const filteredData = this._downCtx.createImageData(sbw, sbh)

      for (let py = 0; py < sbh; py++) {
        for (let px = 0; px < sbw; px++) {
          const idx = (py * sbw + px) * 4
          const wx = bx + Math.round(px / scale), wy = by + Math.round(py / scale)
          const r = sourceData.data[idx], g = sourceData.data[idx + 1], b = sourceData.data[idx + 2], a = sourceData.data[idx + 3]
          let maskAlpha = 255
          if (processedMask || this.demoMode) {
            maskAlpha = processedMask ? this.maskProcessor.getAlphaAt(wx, wy) : 200
          }
          if (maskAlpha > 10 && applyFilter) {
            const result = applyFilter(r, g, b, wx, wy, maskAlpha, gestureParams, this.time)
            filteredData.data[idx] = result.r
            filteredData.data[idx + 1] = result.g
            filteredData.data[idx + 2] = result.b
            filteredData.data[idx + 3] = a
          } else {
            filteredData.data[idx] = r
            filteredData.data[idx + 1] = g
            filteredData.data[idx + 2] = b
            filteredData.data[idx + 3] = a
          }
        }
      }

      this._processCtx.putImageData(filteredData, 0, 0)
      this.patchRenderer.drawPatchClip(ctx, patch.vertices)
      ctx.drawImage(this._processCanvas, 0, 0, sbw, sbh, bx, by, bw, bh)
      ctx.restore()
      this.patchRenderer.drawPatchEdge(ctx, patch.vertices)
    }

    this._drawHandSkeletons(ctx, leftHand, rightHand, w, h)
  }

  _drawHandSkeletons(ctx, leftHand, rightHand, w, h) {
    const toPixel = (pt) => ({ x: (1 - pt.x) * w, y: pt.y * h })

    for (const hand of [leftHand, rightHand]) {
      if (!hand?.landmarks) continue
      ctx.save()
      // Skeleton lines
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = toPixel(hand.landmarks[a])
        const pb = toPixel(hand.landmarks[b])
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
      }
      ctx.stroke()

      // Keypoint dots
      for (const pt of hand.landmarks) {
        const p = toPixel(pt)
        ctx.fillStyle = 'rgba(108,140,255,0.8)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }

  /**
   * Generate synthetic hands for demo mode
   */
  _generateDemoHands(w, h) {
    this._demoTime += 0.016
    const t = this._demoTime

    // Two hands slowly orbiting
    const leftCx = w * 0.25 + Math.sin(t * 0.7) * w * 0.05
    const leftCy = h * 0.55 + Math.cos(t * 0.5) * h * 0.08
    const rightCx = w * 0.75 + Math.sin(t * 0.7 + 1) * w * 0.05
    const rightCy = h * 0.5 + Math.cos(t * 0.5 + 1) * h * 0.08

    const makeHand = (cx, cy, side) => {
      const landmarks = []
      const handSize = h * 0.12
      const palmX = cx
      const palmY = cy + handSize * 0.3

      // Simplified 21 landmark hand shape
      for (let i = 0; i < 21; i++) {
        let x = palmX, y = palmY
        if (i === 0) { x = palmX; y = palmY + handSize * 0.3 } // Wrist
        else if (i <= 4) { const ang = -0.6 + (i - 1) * 0.2; x = palmX + Math.cos(ang) * handSize * (0.4 + (i - 1) * 0.1); y = palmY - Math.sin(ang) * handSize * (0.4 + (i - 1) * 0.1) }
        else if (i <= 8) { const ang = -0.6 + (i - 5) * 0.18; x = palmX + Math.cos(ang) * handSize * (0.35 + (i - 5) * 0.09); y = palmY - Math.sin(ang) * handSize * (0.35 + (i - 5) * 0.09) }
        else if (i <= 12) { const ang = -0.5 + (i - 9) * 0.17; x = palmX + Math.cos(ang) * handSize * (0.3 + (i - 9) * 0.08); y = palmY - Math.sin(ang) * handSize * (0.3 + (i - 9) * 0.08) }
        else if (i <= 16) { const ang = -0.4 + (i - 13) * 0.16; x = palmX + Math.cos(ang) * handSize * (0.25 + (i - 13) * 0.07); y = palmY - Math.sin(ang) * handSize * (0.25 + (i - 13) * 0.07) }
        else { const ang = -0.3 + (i - 17) * 0.15; x = palmX + Math.cos(ang) * handSize * (0.2 + (i - 17) * 0.06); y = palmY - Math.sin(ang) * handSize * (0.2 + (i - 17) * 0.06) }

        // Slight oscillation
        x += Math.sin(t * 2 + i * 0.5) * 3
        y += Math.cos(t * 2.3 + i * 0.4) * 3

        landmarks.push({ x: x / w, y: y / h, z: 0 })
      }

      return {
        landmarks,
        palmCenter: { x: palmX / w, y: palmY / h, z: 0 },
        pinchPoint: { x: (landmarks[4].x + landmarks[8].x) / 2, y: (landmarks[4].y + landmarks[8].y) / 2, z: 0 },
        openness: 0.5 + Math.sin(t * 0.8) * 0.4,
        id: `demo-${side}`,
        handedness: side,
      }
    }

    return {
      leftHand: makeHand(leftCx, leftCy, 'left'),
      rightHand: makeHand(rightCx, rightCy, 'right'),
      hands: [makeHand(leftCx, leftCy, 'left'), makeHand(rightCx, rightCy, 'right')],
    }
  }

  /**
   * Render demo frame (no camera)
   */
  renderDemo(dt) {
    const w = this.displayCanvas.width || this.displayCanvas.clientWidth
    const h = this.displayCanvas.height || this.displayCanvas.clientHeight

    if (this.displayCanvas.width !== w || this.displayCanvas.height !== h) {
      this.displayCanvas.width = w
      this.displayCanvas.height = h
    }

    const hands = this._generateDemoHands(w, h)
    const frameData = {
      video: null,
      hands: hands.hands,
      leftHand: hands.leftHand,
      rightHand: hands.rightHand,
      mask: null,
    }

    // Fill background with dark gradient for demo
    const ctx = this.displayCtx
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.5)
    grad.addColorStop(0, '#1a1a2e')
    grad.addColorStop(1, '#0a0a0f')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // Draw the patches without video source — use synthetic texture
    const patches = this.patchRenderer.generateQuads(hands.leftHand, hands.rightHand, w, h)
    const applyFilter = FILTER_APPLIERS[this.currentFilterId]

    for (const patch of patches) {
      if (this.patchRenderer.isDegenerate(patch.vertices)) continue

      const xs = patch.vertices.map(v => v.x), ys = patch.vertices.map(v => v.y)
      const bx = Math.max(0, Math.floor(Math.min(...xs)))
      const by = Math.max(0, Math.floor(Math.min(...ys)))
      const bw = Math.min(w - bx, Math.ceil(Math.max(...xs) - bx))
      const bh = Math.min(h - by, Math.ceil(Math.max(...ys) - by))
      if (bw <= 0 || bh <= 0) continue

      // Create synthetic pixel data (demo: colored noise / gradient field)
      const data = ctx.createImageData(bw, bh)
      for (let py = 0; py < bh; py++) {
        for (let px = 0; px < bw; px++) {
          const idx = (py * bw + px) * 4
          const wx = bx + px, wy = by + py
          // Gradient with noise simulating a person silhouette
          const gradVal = 100 + Math.sin(wx * 0.01) * 40 + Math.cos(wy * 0.01) * 40 + (Math.random() - 0.5) * 20
          const r = Math.min(255, gradVal + 40)
          const gg = Math.min(255, gradVal + 15)
          const bb = Math.min(255, gradVal - 10)

          const demoGestureParams = { ...this.preparedFilterParams, gestureIntensity: 0.5, gestureSpeed: 0, twoHandBlend: 0.5 }
          const result = applyFilter(r, gg, bb, wx, wy, 200, demoGestureParams, this.time)
          data.data[idx] = result.r
          data.data[idx + 1] = result.g
          data.data[idx + 2] = result.b
          data.data[idx + 3] = 255
        }
      }

      this.patchRenderer.drawPatchClip(ctx, patch.vertices)
      this._demoCanvas.width = bw; this._demoCanvas.height = bh
      const tempCtx = this._demoCanvas.getContext('2d')
      tempCtx.putImageData(data, 0, 0)
      ctx.drawImage(this._demoCanvas, 0, 0, bw, bh, bx, by, bw, bh)
      ctx.restore()

      this.patchRenderer.drawPatchEdge(ctx, patch.vertices)
    }

    // Draw skeletons
    this._drawHandSkeletons(ctx, hands.leftHand, hands.rightHand, w, h)
  }

  setFilterParam(key, value) {
    this.filterParams[key] = value
    this._prepareFilterParams()
  }

  setFilterParams(params) {
    Object.assign(this.filterParams, params)
    this._prepareFilterParams()
  }

  resetFilterParams() {
    this._loadDefaultParams()
  }

  dispose() {
    this.maskSegmenter?.close?.()
    this.maskSegmenter = null
    this._sourceCanvas.width = 0; this._processCanvas.width = 0
    this._downCanvas.width = 0; this._demoCanvas.width = 0
  }
}
