// paintingModule.js — 模块③入口：场景 + 画作选择 + 手势驱动 + 演示模式
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { PaintingSampler } from './paintingSampler.js'
import { PaintingParticles } from './paintingParticles.js'
import { PAINTING_PRESETS, getPaintingById } from './paintingPresets.js'
import { clamp } from '../../utils/math.js'

export class PaintingModule {
  constructor(container, canvas) {
    this.container = container
    this.canvas = canvas

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.setSize(container.clientWidth, container.clientHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(55, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 30)
    this.camera.position.set(0, 0.2, 5.5)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 1.5
    this.controls.maxDistance = 15
    this.controls.target.set(0, 0, 0)

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4))

    this.sampler = new PaintingSampler({ sampleDensity: 3 })
    this.paintingParticles = null
    this.group = new THREE.Group()
    this.scene.add(this.group)

    this._currentIdx = 0
    this._progress = 0
    this._targetProgress = 0
    this._lerpSpeed = 2.5
    this._elapsed = 0

    this._animId = 0
    this._lastTime = 0
    this._running = false
    this._gestureOpenness = 0
    this._demoMode = false
    this._demoTime = 0

    this.params = {
      sampleDensity: 3,
      domeRadius: 5.0,
      wrapAngle: 1.6,
      domeMode: 0,
      pointScale: 1.0,
      noiseAmp: 0.3,
      brushLength: 1.0,
    }

    this._onResize = this._handleResize.bind(this)
    window.addEventListener('resize', this._onResize)
  }

  async init() {
    await this._loadPainting(0)
  }

  async _loadPainting(index) {
    this._currentIdx = Math.min(index, PAINTING_PRESETS.length - 1)
    const preset = PAINTING_PRESETS[this._currentIdx]

    // Update sampler settings
    this.sampler.sampleDensity = this.params.sampleDensity

    // Clean up old
    if (this.paintingParticles) {
      this.group.remove(this.paintingParticles.points)
      this.paintingParticles.dispose()
    }

    // Sample the painting
    const data = await this.sampler.sample(preset.image)

    // Apply painting defaults merged with current params
    const cfg = { ...preset.defaults, ...this.params }

    this.paintingParticles = new PaintingParticles(data, {
      paintingWidth: 4.0,
      domeRadius: cfg.domeRadius,
      wrapAngle: cfg.wrapAngle,
      domeMode: cfg.domeMode,
      pointScale: cfg.pointScale,
      noiseAmp: cfg.noiseAmp,
      brushLength: cfg.brushLength,
    })

    this.group.add(this.paintingParticles.points)
    this.scene.background = new THREE.Color(cfg.bgColor)
  }

  onGestureFrame(frameData) {
    this._gestureOpenness = frameData.leftHand?.openness ?? frameData.rightHand?.openness ?? 0
  }

  setGestureOpenness(value) {
    this._gestureOpenness = value
  }

  start() {
    if (this._running) return
    this._running = true
    this._lastTime = performance.now()

    const loop = (now) => {
      if (!this._running) return
      this._animId = requestAnimationFrame(loop)
      const dt = Math.min((now - this._lastTime) / 1000, 0.1)
      this._lastTime = now
      this._elapsed += dt

      if (this._demoMode) {
        this._demoTime += dt
        this._targetProgress = (Math.sin(this._demoTime * Math.PI * 2 / 8) + 1) / 2
      }

      this._progress += (this._targetProgress - this._progress) * clamp(this._lerpSpeed * dt, 0, 1)
      this.paintingParticles?.setProgress(this._progress)
      this.paintingParticles?.setTime(this._elapsed)

      this.group.rotation.y += 0.05 * dt
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    this._animId = requestAnimationFrame(loop)
  }

  stop() {
    this._running = false
    cancelAnimationFrame(this._animId)
  }

  setTargetProgress(value) {
    this._targetProgress = clamp(value, 0, 1)
  }

  setDemoMode(enabled) {
    this._demoMode = enabled
    this._demoTime = 0
  }

  reset() {
    this._progress = 0
    this._targetProgress = 0
    this._elapsed = 0
    this._demoTime = 0
    this.paintingParticles?.setProgress(0)
  }

  async nextPainting() {
    const idx = (this._currentIdx + 1) % PAINTING_PRESETS.length
    await this._loadPainting(idx)
    return PAINTING_PRESETS[this._currentIdx]
  }

  async prevPainting() {
    const idx = (this._currentIdx - 1 + PAINTING_PRESETS.length) % PAINTING_PRESETS.length
    await this._loadPainting(idx)
    return PAINTING_PRESETS[this._currentIdx]
  }

  async selectPainting(index) {
    await this._loadPainting(index)
    return PAINTING_PRESETS[this._currentIdx]
  }

  getCurrentPainting() {
    return PAINTING_PRESETS[this._currentIdx]
  }

  getAllPaintings() {
    return PAINTING_PRESETS
  }

  setParams(params) {
    Object.assign(this.params, params)
    if (this.paintingParticles) {
      this.paintingParticles.updateParams({
        pointScale: params.pointScale,
        noiseAmp: params.noiseAmp,
        brushLength: params.brushLength,
        domeRadius: params.domeRadius,
        wrapAngle: params.wrapAngle,
        domeMode: params.domeMode,
      })
      if (params.domeRadius || params.wrapAngle || params.domeMode !== undefined) {
        this.paintingParticles._rebuildDomePositions()
      }
    }
    if (params.bgColor) {
      this.scene.background = new THREE.Color(params.bgColor)
    }
  }

  _handleResize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w > 0 && h > 0) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
  }

  dispose() {
    this.stop()
    window.removeEventListener('resize', this._onResize)
    this.paintingParticles?.dispose()
    this.renderer?.dispose()
    this.controls?.dispose()
  }
}
