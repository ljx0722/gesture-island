// particleAnimation.js — 消散/聚合动画 + 噪声 + 旋转
import { lerp, clamp } from '../../utils/math.js'

export class ParticleAnimation {
  constructor(model, options = {}) {
    this.model = model
    this.currentProgress = 0
    this.targetProgress = 0
    this.lerpSpeed = options.lerpSpeed ?? 3.0
    this.rotationSpeed = options.rotationSpeed ?? 0.25
    this.autoRotate = options.autoRotate ?? true
    this.elapsed = 0
    this.demoMode = false
    this._demoTime = 0
  }

  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.1) // Cap delta to avoid jumps
    this.elapsed += dt

    if (this.demoMode) {
      // Auto breathing: 0→1→0 sine wave, 8s period
      this._demoTime += dt
      this.targetProgress = (Math.sin(this._demoTime * Math.PI * 2 / 8) + 1) / 2
    }

    // Smooth lerp toward target
    this.currentProgress = lerp(this.currentProgress, this.targetProgress, clamp(this.lerpSpeed * dt, 0, 1))

    // Update shader uniforms
    this.model.setProgress(this.currentProgress)
    this.model.setTime(this.elapsed)
  }

  setTargetProgress(value) {
    this.targetProgress = clamp(value, 0, 1)
  }

  setDemoMode(enabled) {
    this.demoMode = enabled
    this._demoTime = 0
  }

  getRotation(deltaTime) {
    if (!this.autoRotate) return 0
    return this.rotationSpeed * deltaTime
  }

  reset() {
    this.currentProgress = 0
    this.targetProgress = 0
    this.elapsed = 0
    this._demoTime = 0
  }
}
