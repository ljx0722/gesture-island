// particleModule.js — 模块①：Three.js 场景 + 手势驱动
import { ParticleModel } from './particleModel.js'
import { ParticleAnimation } from './particleAnimation.js'
import { ParticleUploader } from './particleUploader.js'
import { PRESETS } from './particlePresets.js'
import { HAND_CONNECTIONS } from '../../tracking/handFeatures.js'

export class ParticleModule {
  constructor(container, renderer) {
    const T = window.THREE
    this._T = T

    this.renderer = renderer
    this.renderer.outputColorSpace = T.SRGBColorSpace
    this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    this.scene = new T.Scene()
    this.scene.background = new T.Color('#0a0a0f')
    this.camera = new T.PerspectiveCamera(55, this._safeW(container) / Math.max(1, this._safeH(container)), 0.1, 50)
    this.camera.position.set(0, 0, 4.2)
    this.camera.lookAt(0, 0, 0)

    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, this.renderer.domElement)
      this.controls.enableDamping = true
      this.controls.dampingFactor = 0.08
      this.controls.minDistance = 1.5
      this.controls.maxDistance = 12
      this.controls.target.set(0, 0, 0)
    } else { this.controls = null }

    this.scene.add(new T.AmbientLight(0x222244, 0.6))

    this.currentPresetIdx = 0
    this.particleModel = null
    this.animation = null
    this.uploader = new ParticleUploader()
    this.group = new T.Group()
    this.scene.add(this.group)

    this._animId = 0; this._lastTime = 0; this._gestureOpenness = 0; this._running = false
    this._handPos = null; this._handVelocity = 0

    this.params = {
      pointScale: 1.6, scatterDist: 1.5, noiseAmp: 0.6,
      lerpSpeed: 3.0, rotationSpeed: 0.25, opacity: 0.9,
      color: '#6c8cff', pointShape: 0,
    }

    this._onResize = () => {
      const w = this._safeW(container), h = this._safeH(container)
      if (w > 0 && h > 0) {
        this.renderer.setSize(w, h, false)
        this.camera.aspect = w / h
        this.camera.updateProjectionMatrix()
      }
    }
    window.addEventListener('resize', this._onResize)
  }

  _safeW(c) { return c.clientWidth || window.innerWidth || 1024 }
  _safeH(c) { return c.clientHeight || window.innerHeight || 768 }
  resize() { this._onResize() }

  async init() { this._loadPreset(1) } // Start with "星空" — larger and more visible

  _loadPreset(index) {
    this.currentPresetIdx = Math.min(index, PRESETS.length - 1)
    this._replaceModel(PRESETS[this.currentPresetIdx].generate())
  }

  _replaceModel(geometry) {
    if (this.particleModel) {
      this.group.remove(this.particleModel.points)
      this.particleModel.dispose()
    }

    this.particleModel = new ParticleModel(geometry, {
      pointScale: this.params.pointScale, scatterDist: this.params.scatterDist,
      noiseAmp: this.params.noiseAmp, color: this.params.color, opacity: this.params.opacity,
      pointShape: this.params.pointShape,
    })
    this.group.add(this.particleModel.points)

    this.animation = new ParticleAnimation(this.particleModel, {
      lerpSpeed: this.params.lerpSpeed, rotationSpeed: this.params.rotationSpeed,
    })
  }

  onGestureFrame(frameData) {
    this._gestureOpenness = frameData.openness ?? 0

    // Hand velocity for particle turbulence
    const hand = frameData.primaryHand || frameData.leftHand || frameData.rightHand
    if (hand?.palmCenter) {
      if (this._handPos) {
        const dx = hand.palmCenter.x - this._handPos.x
        const dy = hand.palmCenter.y - this._handPos.y
        this._handVelocity = Math.sqrt(dx * dx + dy * dy) * 10
      }
      this._handPos = { x: hand.palmCenter.x, y: hand.palmCenter.y }
    } else {
      this._handVelocity *= 0.9
    }
    this.animation?.setHandVelocity(this._handVelocity)

    // Pinch → zoom scale (closer to camera)
    if (frameData.isPinching && this._handPos) {
      const pinchScale = 1.0 - (1 - frameData.openness) * 0.5
      this.camera.position.z = 4.2 * pinchScale
      this.camera.lookAt(0, 0, 0)
    } else if (this._handPos) {
      this.camera.position.z += (4.2 - this.camera.position.z) * 0.1
    }

    // Two-hand distance → global particle scale
    if (frameData.twoHandDistance > 0) {
      const scale = 0.5 + Math.min(frameData.twoHandDistance * 2.5, 2.0)
      this.particleModel?.updateParams({ pointScale: this.params.pointScale * scale * 0.8 })
    }

    // Point gesture → repel direction to shader
    if (frameData.isPointing && hand?.palmCenter) {
      this.animation?.setPointRepel(hand.palmCenter.x, hand.palmCenter.y, 0.4)
    } else {
      this.animation?.setPointRepel(0, 0, 0)
    }

    // Hand rotation → rotation speed bias
    const rot = frameData.handRotation || 0
    if (Math.abs(rot) > 0.1) {
      this.params.rotationSpeed = 0.25 + rot * 0.5
    } else {
      this.params.rotationSpeed += (0.25 - this.params.rotationSpeed) * 0.05
    }
  }

  setGestureOpenness(value) { this._gestureOpenness = value }

  start() {
    if (this._running) return
    this._running = true; this._lastTime = performance.now()
    const loop = (now) => {
      if (!this._running) return
      this._animId = requestAnimationFrame(loop)
      const dt = Math.min((now - this._lastTime) / 1000, 0.1)
      this._lastTime = now
      this.animation?.setTargetProgress(this._gestureOpenness)
      this.animation?.update(dt)
      this.group.rotation.y += this.animation?.getRotation(dt) || 0
      if (this.controls) this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    this._animId = requestAnimationFrame(loop)
  }

  stop() { this._running = false; cancelAnimationFrame(this._animId) }

  nextPreset() { this._loadPreset((this.currentPresetIdx + 1) % PRESETS.length); return PRESETS[this.currentPresetIdx] }
  prevPreset() { this._loadPreset((this.currentPresetIdx - 1 + PRESETS.length) % PRESETS.length); return PRESETS[this.currentPresetIdx] }
  selectPreset(i) { this._loadPreset(i); return PRESETS[this.currentPresetIdx] }
  getCurrentPreset() { return PRESETS[this.currentPresetIdx] }
  getAllPresets() { return PRESETS }

  async uploadModel(file) {
    const geometry = await this.uploader.loadFromFile(file)
    this._replaceModel(geometry)
  }

  setParams(params) {
    Object.assign(this.params, params)
    if (typeof this.params.pointShape === 'string') this.params.pointShape = parseInt(this.params.pointShape)
    if (typeof this.params.color !== 'string' || !this.params.color.startsWith('#')) this.params.color = '#6c8cff'
    this.particleModel?.updateParams(this.params)
    if (this.animation && params.lerpSpeed !== undefined) this.animation.lerpSpeed = params.lerpSpeed
    if (this.animation && params.rotationSpeed !== undefined) this.animation.rotationSpeed = params.rotationSpeed
  }

  setDemoMode(enabled) { this.animation?.setDemoMode(enabled) }

  reset() {
    this._loadPreset(this.currentPresetIdx)
    this.animation?.reset()
    this._gestureOpenness = 0
  }

  dispose() {
    this.stop()
    window.removeEventListener('resize', this._onResize)
    this.particleModel?.dispose()
    this.controls?.dispose?.()
    // Renderer is shared — do NOT dispose it here
  }
}
