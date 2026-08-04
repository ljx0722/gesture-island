// status.js — 中文状态提示 + 加载进度
export class StatusDisplay {
  constructor() {
    this.toastEl = document.getElementById('status-toast')
    this.loadingEl = document.getElementById('loading-overlay')
    this.loadingTextEl = document.getElementById('loading-text')
    this.statusDot = document.getElementById('gesture-status')
    this.statusText = document.getElementById('status-text')
    this.fpsDisplay = document.getElementById('fps-display')

    this._toastTimer = null
    this._fpsFrames = 0
    this._fpsLastTime = performance.now()
  }

  showToast(message, type = 'info', duration = 3000) {
    const el = this.toastEl
    el.textContent = message
    el.className = `toast ${type}`
    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => { el.className = 'toast hidden' }, duration)
  }

  showError(message) { this.showToast(message, 'error', 5000) }
  showWarning(message) { this.showToast(message, 'warning', 4000) }

  showLoading(text = '正在加载...') {
    this.loadingEl.classList.remove('hidden')
    this.loadingTextEl.textContent = text
  }

  hideLoading() {
    this.loadingEl.classList.add('hidden')
  }

  setLoadingProgress(stage, progress, text) {
    this.loadingEl.classList.remove('hidden')
    const pct = Math.round(progress * 100)
    this.loadingTextEl.textContent = `${text} (${pct}%)`
  }

  setHandStatus(count, gestureLabel = '') {
    this.statusDot.className = count >= 2 ? 'status-dot active'
      : count === 1 ? 'status-dot warning'
      : 'status-dot offline'

    if (count >= 2) this.statusText.textContent = gestureLabel ? `双手已检测 · ${gestureLabel}` : '双手已检测'
    else if (count === 1) this.statusText.textContent = '请将双手放入画面'
    else this.statusText.textContent = '未检测到手部'
  }

  setStatus(text) {
    this.statusText.textContent = text
  }

  updateFPS() {
    this._fpsFrames++
    const now = performance.now()
    if (now - this._fpsLastTime >= 1000) {
      const fps = Math.round(this._fpsFrames / ((now - this._fpsLastTime) / 1000))
      this.fpsDisplay.textContent = `${fps} fps`
      this._fpsFrames = 0
      this._fpsLastTime = now
    }
  }

  reset() {
    this.statusDot.className = 'status-dot offline'
    this.statusText.textContent = '就绪'
    this.fpsDisplay.textContent = ''
    this.hideLoading()
  }
}
