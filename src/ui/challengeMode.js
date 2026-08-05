// challengeMode.js — hand gesture challenge game for kids
const DIFFICULTIES = {
  easy: { label: '简单', timePerRound: 5000, gestures: ['open', 'fist'] },
  medium: { label: '中等', timePerRound: 3500, gestures: ['open', 'fist', 'pinch'] },
  hard: { label: '困难', timePerRound: 2500, gestures: ['open', 'fist', 'pinch', 'point'] },
}

const GESTURE_LABELS = { open: '张开手掌', fist: '握拳', pinch: '捏合', point: '指向', none: '待机' }
const GESTURE_ICONS = { open: '🖐', fist: '✊', pinch: '🤏', point: '☝' }

export class ChallengeMode {
  constructor() {
    this.active = false
    this.difficulty = 'easy'
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this._targetGesture = 'open'
    this._roundTimer = null
    this._roundStart = 0
    this._roundTime = 5000
    this._onScoreChange = null
    this._onRoundChange = null
    this._gestureAudio = null
  }

  setAudio(audioManager) { this._gestureAudio = audioManager }

  start(difficulty = 'easy') {
    this.active = true
    this.difficulty = difficulty
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    const cfg = DIFFICULTIES[difficulty]
    this._roundTime = cfg.timePerRound
    this._pickNewGesture()
    this._roundStart = performance.now()
    this._onScoreChange?.(this.score, this.combo, this.maxCombo)
    this._onRoundChange?.(this._targetGesture, GESTURE_LABELS[this._targetGesture], GESTURE_ICONS[this._targetGesture], this._roundTime)
  }

  stop() {
    this.active = false
    clearTimeout(this._roundTimer)
  }

  onScoreChange(cb) { this._onScoreChange = cb }
  onRoundChange(cb) { this._onRoundChange = cb }

  onGesture(gestureType, openness) {
    if (!this.active) return
    if (gestureType === this._targetGesture) {
      this.score += (this.combo + 1) * 10
      this.combo++
      if (this.combo > this.maxCombo) this.maxCombo = this.combo
      this._gestureAudio?.challengeScore()
      if (this.combo >= 5) this._gestureAudio?.challengeCombo()
      this._onScoreChange?.(this.score, this.combo, this.maxCombo)
      this._pickNewGesture()
      this._roundStart = performance.now()
      this._onRoundChange?.(this._targetGesture, GESTURE_LABELS[this._targetGesture], GESTURE_ICONS[this._targetGesture], this._roundTime)
    }
  }

  checkTimeout(now) {
    if (!this.active) return
    if (now - this._roundStart > this._roundTime) {
      this.combo = 0
      this._pickNewGesture()
      this._roundStart = now
      this._onScoreChange?.(this.score, 0, this.maxCombo)
      this._onRoundChange?.(this._targetGesture, GESTURE_LABELS[this._targetGesture], GESTURE_ICONS[this._targetGesture], this._roundTime)
    }
  }

  _pickNewGesture() {
    const gestures = DIFFICULTIES[this.difficulty].gestures
    let next
    do { next = gestures[Math.floor(Math.random() * gestures.length)] } while (next === this._targetGesture && gestures.length > 1)
    this._targetGesture = next
  }
}
