// audioManager.js — Web Audio API synthesized sound effects
const THEMES = {
  none: null,
  dream: { root: 261.63, type: 'sine', notes: [0, 4, 7, 12], interval: 1800 },
  space: { root: 146.83, type: 'triangle', notes: [0, 7, 12, 19], interval: 2200 },
  forest: { root: 196, type: 'sine', notes: [0, 3, 7, 10], interval: 2000 },
  magic: { root: 329.63, type: 'triangle', notes: [0, 4, 9, 16], interval: 1500 },
}

export class AudioManager {
  constructor() {
    this.ctx = null
    this._muted = localStorage.getItem('gesture_island_muted') === '1'
    this._initialized = false
    this._theme = localStorage.getItem('gesture_island_sound_theme') || 'none'
    this._themeTimer = null
    this._themeStep = 0
  }

  _ensure() {
    if (!this._initialized) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { this.ctx = null }
      this._initialized = true
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {})
  }

  activate() { this._ensure() }
  isMuted() { return this._muted }
  getTheme() { return this._theme }

  toggle() {
    this._muted = !this._muted
    localStorage.setItem('gesture_island_muted', this._muted ? '1' : '0')
    if (this._muted) this.stopTheme()
    else this.startTheme(this._theme)
    return this._muted
  }

  setTheme(theme) {
    this._theme = THEMES[theme] ? theme : 'none'
    localStorage.setItem('gesture_island_sound_theme', this._theme)
    if (this._theme === 'none' || this._muted) this.stopTheme()
    else this.startTheme(this._theme)
  }

  startTheme(theme = this._theme) {
    this.stopTheme()
    if (!THEMES[theme] || this._muted) return
    this._theme = theme
    this._themeStep = 0
    const tick = () => {
      if (this._theme !== theme || this._muted) return
      const cfg = THEMES[theme]
      const semitone = cfg.notes[this._themeStep++ % cfg.notes.length]
      this._tone(cfg.root * Math.pow(2, semitone / 12), 0.8, cfg.type, 0.025)
      this._themeTimer = setTimeout(tick, cfg.interval)
    }
    this._ensure()
    tick()
  }

  stopTheme() {
    clearTimeout(this._themeTimer)
    this._themeTimer = null
  }

  _tone(freq, duration = 0.12, type = 'sine', vol = 0.12) {
    if (this._muted) return
    this._ensure()
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type; osc.frequency.value = freq
    gain.gain.setValueAtTime(Math.max(0.001, vol), t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.connect(gain); gain.connect(this.ctx.destination)
    osc.start(t); osc.stop(t + duration)
  }

  gestureDetected(gesture = 'open') {
    const tones = { open: [880, 1320], fist: [220, 165], pinch: [1047, 1568], point: [660, 990], none: [] }
    const [first, second] = tones[gesture] || tones.open
    if (!first) return
    this._tone(first, 0.1, gesture === 'fist' ? 'sine' : 'triangle', 0.07)
    setTimeout(() => this._tone(second, 0.08, 'sine', 0.045), 60)
  }
  moduleSwitch(moduleId) {
    const colors = { particles: [523, 659], filters: [440, 660], paintings: [659, 784], handwarp: [330, 440], lighttrails: [784, 1047], shadowplay: [196, 261] }
    const [f1, f2] = colors[moduleId] || [440, 550]
    this._tone(f1, 0.08, 'triangle', 0.07); setTimeout(() => this._tone(f2, 0.1, 'sine', 0.06), 60)
  }
  filterSwitch() { this._tone(660, 0.06, 'triangle', 0.08); setTimeout(() => this._tone(880, 0.08, 'triangle', 0.06), 50) }
  presetSwitch() { this._tone(440, 0.08, 'sine', 0.06); setTimeout(() => this._tone(550, 0.06), 40); setTimeout(() => this._tone(660, 0.06), 80) }
  uploadDone() { this._tone(523, 0.12, 'sine', 0.12); setTimeout(() => this._tone(659, 0.1), 80); setTimeout(() => this._tone(784, 0.15), 160) }
  cameraOn() { this._tone(330, 0.1, 'triangle', 0.06); setTimeout(() => this._tone(660, 0.12, 'triangle', 0.08), 80) }
  challengeScore() { this._tone(1047, 0.06, 'square', 0.06); setTimeout(() => this._tone(1319, 0.08, 'square', 0.06), 50) }
  challengeCombo() { this._tone(784, 0.06, 'square', 0.05); setTimeout(() => this._tone(1047, 0.06), 40); setTimeout(() => this._tone(1319, 0.06), 80); setTimeout(() => this._tone(1568, 0.1), 120) }
  screenshotSound() { this._tone(880, 0.1, 'triangle', 0.08) }
  saveSound() { this._tone(523, 0.1, 'sine', 0.08); setTimeout(() => this._tone(784, 0.16, 'triangle', 0.06), 80) }
}
