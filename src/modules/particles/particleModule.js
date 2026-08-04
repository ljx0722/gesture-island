// particleModule.js — 模块①入口：Three.js 场景 + 手势驱动
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ParticleModel } from './particleModel.js'
import { ParticleAnimation } from './particleAnimation.js'
import { ParticleUploader } from './particleUploader.js'
import { PRESETS } from './particlePresets.js'

export class ParticleModule {
  constructor(container, canvas) {
    this.container = container
    this.canvas = canvas

    // Three.js setup
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.setSize(container.clientWidth, container.clientHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(55, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 50)
    this.camera.position.set(0, 0.3, 5)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 1.5
    this.controls.maxDistance = 12
    this.controls.target.set(0, 0, 0)

    // Lighting
    this.scene.add(new THREE.AmbientLight(0x222244, 0.6))

    // Grid helper (subtle)
    // this.scene.add(new THREE.PolarGridHelper(3, 32, 24, 64, 0x333355, 0x333355))

    // State
    this.currentPresetIdx = 0
    this.particleModel = null
    this.animation = null
    this.uploader = new ParticleUploader()
    this.group = new THREE.Group()
    this.scene.add(this.group)

    this._animId = 0
    this._lastTime = 0
    this._gestureOpenness = 0
    this._running = false

    // Parameters
    this.params = {
      pointScale: 1.6,
      scatterDist: 1.5,
      noiseAmp: 0.6,
      lerpSpeed: 3.0,
      rotationSpeed: 0.25,
      opacity: 0.9,
      color: '#6c8cff',
    }

    // Handle resize
    this._onResize = this._handleResize.bind(this)
    window.addEventListener('resize', this._onResize)
  }

  async init() {
    this._loadPreset(0)
  }

  _loadPreset(index) {
    this.currentPresetIdx = Math.min(index, PRESETS.length - 1)
    const preset = PRESETS[this.currentPresetIdx]
    const geometry = preset.generate()

    this._replaceModel(geometry)
  }

  _replaceModel(geometry) {
    // Clean up old model
    if (this.particleModel) {
      this.group.remove(this.particleModel.points)
      this.particleModel.dispose()
    }

    // Downsample if too many vertices
    const maxVertices = 80000
    let geo = geometry
    if (geo.attributes.position.count > maxVertices && geo.index === null) {
      const step = Math.ceil(geo.attributes.position.count / maxVertices)
      const oldPos = geo.attributes.position.array
      const newCount = Math.floor(oldPos.length / (3 * step))
      const newPos = new Float32Array(newCount * 3)
      for (let i = 0; i < newCount; i++) {
        newPos[i * 3] = oldPos[i * step * 3]
        newPos[i * 3 + 1] = oldPos[i * step * 3 + 1]
        newPos[i * 3 + 2] = oldPos[i * step * 3 + 2]
      }
      geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(newPos, 3))
    }

    this.particleModel = new ParticleModel(geo, {
      pointScale: this.params.pointScale,
      scatterDist: this.params.scatterDist,
      noiseAmp: this.params.noiseAmp,
      color: this.params.color,
      opacity: this.params.opacity,
    })

    this.group.add(this.particleModel.points)

    this.animation = new ParticleAnimation(this.particleModel, {
      lerpSpeed: this.params.lerpSpeed,
      rotationSpeed: this.params.rotationSpeed,
    })
  }

  // Called each frame from pipeline
  onGestureFrame(frameData) {
    this._gestureOpenness = frameData.leftHand?.openness ?? frameData.rightHand?.openness ?? 0
  }

  // Called from app.js for non-camera mode
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

      const dt = (now - this._lastTime) / 1000
      this._lastTime = now

      // Update animation
      this.animation.setTargetProgress(this._gestureOpenness)
      this.animation.update(dt)

      // Auto rotate group
      this.group.rotation.y += this.animation.getRotation(dt)

      // Update controls
      this.controls.update()

      // Render
      this.renderer.render(this.scene, this.camera)
    }

    this._animId = requestAnimationFrame(loop)
  }

  stop() {
    this._running = false
    cancelAnimationFrame(this._animId)
  }

  // UI actions
  nextPreset() {
    this._loadPreset((this.currentPresetIdx + 1) % PRESETS.length)
    return PRESETS[this.currentPresetIdx]
  }

  prevPreset() {
    this._loadPreset((this.currentPresetIdx - 1 + PRESETS.length) % PRESETS.length)
    return PRESETS[this.currentPresetIdx]
  }

  selectPreset(index) {
    this._loadPreset(index)
    return PRESETS[this.currentPresetIdx]
  }

  getCurrentPreset() {
    return PRESETS[this.currentPresetIdx]
  }

  getAllPresets() {
    return PRESETS
  }

  async uploadModel(file) {
    const geometry = await this.uploader.loadFromFile(file)
    this._replaceModel(geometry)
  }

  // Parameters
  setParams(params) {
    Object.assign(this.params, params)
    this.particleModel?.updateParams({
      pointScale: params.pointScale,
      scatterDist: params.scatterDist,
      noiseAmp: params.noiseAmp,
      opacity: params.opacity,
      color: params.color,
    })
    if (this.animation && params.lerpSpeed !== undefined) {
      this.animation.lerpSpeed = params.lerpSpeed
    }
    if (this.animation && params.rotationSpeed !== undefined) {
      this.animation.rotationSpeed = params.rotationSpeed
    }
  }

  setDemoMode(enabled) {
    this.animation?.setDemoMode(enabled)
  }

  reset() {
    this._loadPreset(this.currentPresetIdx)
    this.animation?.reset()
    this._gestureOpenness = 0
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
    this.particleModel?.dispose()
    this.renderer?.dispose()
    this.controls?.dispose()
  }
}
