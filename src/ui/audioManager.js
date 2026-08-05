// audioManager.js — Web Audio API synthesized sound effects
export class AudioManager {
  constructor() {
    this.ctx = null
    this._muted = false
    this._initialized = false
  }

  _ensure() {
    if (!this._initialized) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { this.ctx = null }
      this._initialized = true
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }

  toggle() { this._muted = !this._muted; return this._muted }

  _tone(freq, duration = 0.12, type = 'sine', vol = 0.12) {
    if (this._muted) return
    this._ensure()
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type; osc.frequency.value = freq
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.connect(gain); gain.connect(this.ctx.destination)
    osc.start(t); osc.stop(t + duration)
  }

  gestureDetected() { this._tone(880, 0.1, 'sine', 0.1); setTimeout(() => this._tone(1320, 0.08, 'sine', 0.07), 60) }
  filterSwitch() { this._tone(660, 0.06, 'triangle', 0.08); setTimeout(() => this._tone(880, 0.08, 'triangle', 0.06), 50) }
  presetSwitch() { this._tone(440, 0.08, 'sine', 0.06); setTimeout(() => this._tone(550, 0.06), 40); setTimeout(() => this._tone(660, 0.06), 80) }
  uploadDone() { this._tone(523, 0.12, 'sine', 0.12); setTimeout(() => this._tone(659, 0.1), 80); setTimeout(() => this._tone(784, 0.15), 160) }
  cameraOn() { this._tone(330, 0.1, 'triangle', 0.06); setTimeout(() => this._tone(660, 0.12, 'triangle', 0.08), 80) }
  challengeScore() { this._tone(1047, 0.06, 'square', 0.06); setTimeout(() => this._tone(1319, 0.08, 'square', 0.06), 50) }
  challengeCombo() { this._tone(784, 0.06, 'square', 0.05); setTimeout(() => this._tone(1047, 0.06), 40); setTimeout(() => this._tone(1319, 0.08), 80); setTimeout(() => this._tone(1568, 0.12), 120) }
  screenshotSound() { this._tone(880, 0.1, 'triangle', 0.08) }
}
