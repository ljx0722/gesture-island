// paintingModule.js — 模块③入口：场景 + 画作选择 + 手势驱动
import { PaintingSampler } from './paintingSampler.js'
import { PaintingParticles } from './paintingParticles.js'
import { PAINTING_PRESETS } from './paintingPresets.js'
import { clamp } from '../../utils/math.js'

export class PaintingModule {
  constructor(container, renderer) {
    const T = window.THREE
    this.container = container

    this.renderer = renderer
    this.renderer.outputColorSpace = T.SRGBColorSpace
    this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0

    this.scene = new T.Scene()
    this.camera = new T.PerspectiveCamera(55, this._safeW(container) / Math.max(1, this._safeH(container)), 0.1, 30)
    this.camera.position.set(0, 0.2, 5.5)

    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, this.renderer.domElement)
      this.controls.enableDamping = true; this.controls.dampingFactor = 0.08
      this.controls.minDistance = 1.5; this.controls.maxDistance = 15; this.controls.target.set(0, 0, 0)
    } else { this.controls = null }

    this.scene.add(new T.AmbientLight(0xffffff, 0.4))
    this.sampler = new PaintingSampler({ sampleDensity: 3, maxDimension: 1280, maxParticles: 120000 })
    this.paintingParticles = null
    this.group = new T.Group()
    this.scene.add(this.group)

    this._currentIdx = 0; this._progress = 0; this._targetProgress = 0
    this._lerpSpeed = 2.5; this._elapsed = 0
    this._animId = 0; this._lastTime = 0; this._running = false
    this._gestureOpenness = 0; this._demoMode = false; this._demoTime = 0
    this._customPainting = null; this._customObjectUrl = null

    this.params = { sampleDensity: 3, domeRadius: 5.0, wrapAngle: 1.6, domeMode: 0, pointScale: 1.0, noiseAmp: 0.3, brushLength: 1.0, bgColor: '#0a0a1a', noiseSpeed: 1, noiseScale: 12, brightness: 1, contrast: 1, saturation: 1, colorTemperature: 0, opacity: 0.95, brushRoundness: 0.5, yawSensitivity: 0.8, pitchSensitivity: 0.6, pinchZoom: 1, twoHandSpread: 0.3, fistSlowdown: 0.8, autoRotate: false, autoRotateSpeed: 0.05 }

    this._onResize = () => {
      const w = this._safeW(container), h = this._safeH(container)
      if (w > 0 && h > 0) {
        this.renderer.setSize(w, h, false)
        this.camera.aspect = w / h; this.camera.updateProjectionMatrix()
      }
    }
    window.addEventListener('resize', this._onResize)
  }

  _safeW(c) { return c.clientWidth || window.innerWidth || 1024 }
  _safeH(c) { return c.clientHeight || window.innerHeight || 768 }
  _initSize(c) { this.renderer.setSize(this._safeW(c), this._safeH(c), false) }
  resize() { this._onResize() }

  async init() { await this._loadPainting(0) }

  _configFor(preset) {
    const defaults = preset?.defaults || {}
    return {
      ...defaults,
      pointScale: defaults.pointScale ?? defaults.particleScale ?? 1.0,
      ...this.params,
    }
  }

  async _loadPainting(index) {
    this._currentIdx = Math.min(index, PAINTING_PRESETS.length - 1)
    this._customPainting = null
    const preset = PAINTING_PRESETS[this._currentIdx]
    await this._loadPaintingSource(preset)
  }

  async _loadPaintingSource(preset) {
    const cfg = this._configFor(preset)
    this.sampler.sampleDensity = cfg.sampleDensity ?? 3

    if (this.paintingParticles) {
      this.group.remove(this.paintingParticles.points); this.paintingParticles.dispose()
    }

    const data = await this.sampler.sample(preset.image)
    this.paintingParticles = new PaintingParticles(data, {
      paintingWidth: 4.0, domeRadius: cfg.domeRadius, wrapAngle: cfg.wrapAngle,
      domeMode: cfg.domeMode, pointScale: cfg.pointScale,
      noiseAmp: cfg.noiseAmp, brushLength: cfg.brushLength,
    })
    this.group.add(this.paintingParticles.points)
    this.scene.background = new window.THREE.Color(cfg.bgColor || '#0a0a1a')
  }

  async uploadPainting(file) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      throw new Error('请选择 PNG、JPG 或 WebP 图片')
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('图片不能超过 10MB，请换一张小一点的图片')
    }

    const url = URL.createObjectURL(file)
    const previousUrl = this._customObjectUrl
    const custom = {
      id: 'custom-upload',
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || '我的图片',
      artist: '我的图片',
      year: '',
      image: url,
      defaults: { ...this.params, bgColor: this.params.bgColor || '#0a0a1a' },
    }

    try {
      await this._loadPaintingSource(custom)
      this._customPainting = custom
      this._customObjectUrl = url
      if (previousUrl) URL.revokeObjectURL(previousUrl)
      return custom
    } catch (e) {
      URL.revokeObjectURL(url)
      throw e
    }
  }

  onGestureFrame(frameData) {
    const openness = frameData.openness ?? frameData.primaryHand?.openness ?? 0
    this._gestureOpenness = clamp(openness, 0, 1)
    if (!this._demoMode) this.setTargetProgress(this._gestureOpenness)

    // Hand position controls painting rotation
    const hand = frameData.primaryHand || frameData.leftHand || frameData.rightHand
    if (hand?.palmCenter && !this._demoMode) {
      this.group.rotation.y = (hand.palmCenter.x - 0.5) * Math.PI * (this.params.yawSensitivity ?? 0.8)
      this.group.rotation.x = (hand.palmCenter.y - 0.5) * (this.params.pitchSensitivity ?? 0.6)
    }

    // Pinch → zoom camera in/out
    const pinchScale = frameData.isPinching ? 1.0 + (1 - frameData.openness) * 3.0 * (this.params.pinchZoom ?? 1) : 1.0
    this.camera.position.z += ((5.5 / pinchScale) - this.camera.position.z) * 0.1

    // Two-hand distance → dome radius (non-destructive, gesture biases user param)
    if (frameData.twoHandDistance > 0) {
      const gestureDome = 1.0 + Math.min(frameData.twoHandDistance * 8, 8) * (this.params.twoHandSpread ?? 0.3)
      this._gestureDome = gestureDome
      const baseDome = this.params.domeRadius ?? 5.0
      this.paintingParticles?.updateParams({ domeRadius: baseDome + (this._gestureDome - 5.0) * 0.3 })
    } else {
      this._gestureDome = 0
    }

    // Point → reset view
    if (frameData.isPointing && hand?.palmCenter) {
      this._progress = 0; this._targetProgress = 0
      this.group.rotation.set(0, 0, 0)
    }

    // Fist → pause/unpause demo or reset rotation
    const ws = frameData.isFist ? (1 - (this.params.fistSlowdown ?? 0.8) * 0.8) : 1.0
    this._lerpSpeed = 2.5 * ws
  }
  setGestureOpenness(value) {
    this._gestureOpenness = clamp(value, 0, 1)
    if (!this._demoMode) this.setTargetProgress(this._gestureOpenness)
  }

  start() {
    if (this._running) return
    this._running = true; this._lastTime = performance.now()
    const loop = (now) => {
      if (!this._running) return
      this._animId = requestAnimationFrame(loop)
      const dt = Math.min((now - this._lastTime) / 1000, 0.1)
      this._lastTime = now; this._elapsed += dt
      if (this._demoMode) { this._demoTime += dt; this._targetProgress = (Math.sin(this._demoTime * Math.PI * 2 / 8) + 1) / 2 }
      this._progress += (this._targetProgress - this._progress) * clamp(this._lerpSpeed * dt, 0, 1)
      this.paintingParticles?.setProgress(this._progress)
      this.paintingParticles?.setTime(this._elapsed)
      if (this._demoMode && this.params.autoRotate) this.group.rotation.y += (this.params.autoRotateSpeed ?? 0.05) * dt
      if (this.controls) this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    this._animId = requestAnimationFrame(loop)
  }

  stop() { this._running = false; cancelAnimationFrame(this._animId) }
  setTargetProgress(v) { this._targetProgress = clamp(v, 0, 1) }
  setDemoMode(enabled) { this._demoMode = enabled; this._demoTime = 0 }
  reset() { this._progress = 0; this._targetProgress = 0; this._elapsed = 0; this._demoTime = 0; this.paintingParticles?.setProgress(0) }

  async nextPainting() { await this._loadPainting((this._currentIdx + 1) % PAINTING_PRESETS.length); return PAINTING_PRESETS[this._currentIdx] }
  async prevPainting() { await this._loadPainting((this._currentIdx - 1 + PAINTING_PRESETS.length) % PAINTING_PRESETS.length); return PAINTING_PRESETS[this._currentIdx] }
  async selectPainting(i) { await this._loadPainting(i); return PAINTING_PRESETS[this._currentIdx] }
  getCurrentPainting() { return this._customPainting || PAINTING_PRESETS[this._currentIdx] }
  getAllPaintings() { return PAINTING_PRESETS }

  async setSampleDensity(value) {
    const density = Math.max(1, Math.min(8, Number(value) || 3))
    if (density === this.params.sampleDensity) return
    this.params.sampleDensity = density
    const current = this.getCurrentPainting()
    if (!current || this._customPainting) return
    await this._loadPaintingSource(current)
  }

  setParams(params) {
    Object.assign(this.params, params)
    if (typeof this.params.domeMode === 'string') this.params.domeMode = parseInt(this.params.domeMode)
    this.paintingParticles?.updateParams(this.params)
    if (params.bgColor) this.scene.background = new window.THREE.Color(params.bgColor)
  }

  dispose() {
    this.stop()
    window.removeEventListener('resize', this._onResize)
    if (this._customObjectUrl) URL.revokeObjectURL(this._customObjectUrl)
    this.paintingParticles?.dispose()
    this.controls?.dispose?.()
    // Renderer is shared — do NOT dispose it here
  }
}
