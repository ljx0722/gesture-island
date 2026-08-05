// particleAnimation.js — 消散/聚合动画 + 噪声 + 旋转 + 指向排斥
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
    this._repelX = 0; this._repelY = 0; this._repelStr = 0
  }

  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.1)
    this.elapsed += dt

    if (this.demoMode) {
      this._demoTime += dt
      this.targetProgress = (Math.sin(this._demoTime * Math.PI * 2 / 8) + 1) / 2
    }

    this.currentProgress = lerp(this.currentProgress, this.targetProgress, clamp(this.lerpSpeed * dt, 0, 1))

    this.model.setProgress(this.currentProgress)
    this.model.setTime(this.elapsed)
    this.model.setRepel(this._repelX, this._repelY, this._repelStr)
    this._repelStr *= 0.95
  }

  setHandVelocity(v) { this.model.setHandVelocity(v) }
  setPointRepel(x, y, str) { this._repelX = x; this._repelY = y; this._repelStr += (str - this._repelStr) * 0.2 }

  setTargetProgress(value) { this.targetProgress = clamp(value, 0, 1) }

  setDemoMode(enabled) { this.demoMode = enabled; this._demoTime = 0 }

  getRotation(deltaTime) {
    if (!this.autoRotate) return 0
    return this.rotationSpeed * deltaTime
  }

  reset() {
    this.currentProgress = 0
    this.targetProgress = 0
    this.elapsed = 0
    this._demoTime = 0
    this._repelX = 0; this._repelY = 0; this._repelStr = 0
  }
}
