// onboarding.js — first-time user guide overlay
const STORAGE_KEY = 'gesture_island_onboarded'

export class Onboarding {
  constructor() {
    this.el = null
    this._step = 0
    this._done = false
    if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) {
      this._done = true
    }
  }

  get done() { return this._done }

  show() {
    if (this._done) return
    if (this.el) this.el.remove()

    const el = document.createElement('div')
    el.id = 'onboarding-overlay'
    el.innerHTML = `
      <div class="onboarding-backdrop"></div>
      <div class="onboarding-card">
        <div class="onboarding-steps">
          <span class="onboarding-dot active"></span>
          <span class="onboarding-dot"></span>
          <span class="onboarding-dot"></span>
        </div>
        <div class="onboarding-body" id="onboarding-body"></div>
        <div class="onboarding-actions">
          <button id="onboarding-skip">跳过</button>
          <button id="onboarding-next">下一步</button>
        </div>
      </div>`
    document.body.appendChild(el)
    this.el = el
    this._step = 0
    this._renderStep()

    el.querySelector('#onboarding-skip').addEventListener('click', () => this._finish())
    el.querySelector('#onboarding-next').addEventListener('click', () => this._next())
  }

  _renderStep() {
    const body = this.el.querySelector('#onboarding-body')
    const dots = this.el.querySelectorAll('.onboarding-dot')
    dots.forEach((d, i) => d.classList.toggle('active', i === this._step))
    const nextBtn = this.el.querySelector('#onboarding-next')

    if (this._step === 0) {
      body.innerHTML = `
        <div class="onboarding-icon">&#128075;</div>
        <h3>欢迎来到手势实验岛！</h3>
        <p>把手放到摄像头前试试这些手势：</p>
        <div class="onboarding-gestures">
          <span>&#9995; 张开手掌</span>
          <span>&#9994; 握拳</span>
          <span>&#129311; 捏合</span>
        </div>
        <p class="onboarding-hint">没有摄像头？点击"演示模式"也可以玩</p>`
      nextBtn.textContent = '下一步'
    } else if (this._step === 1) {
      body.innerHTML = `
        <div class="onboarding-icon">&#127918;</div>
        <h3>三大魔法模块</h3>
        <p><b>粒子魔法</b> — 手势控制粒子动画</p>
        <p><b>魔法滤镜</b> — 双手区域实时变色</p>
        <p><b>我的画展</b> — 上传图片变成粒子画</p>`
      nextBtn.textContent = '下一步'
    } else {
      body.innerHTML = `
        <div class="onboarding-icon">&#128640;</div>
        <h3>准备好了吗？</h3>
        <p>点击<b>演示模式</b>可以不需摄像头直接体验</p>
        <p>按 <kbd>?</kbd> 随时查看快捷键</p>
        <p>点击左上角齿轮打开参数面板</p>`
      nextBtn.textContent = '开始探索'
    }
  }

  _next() {
    if (this._step >= 2) { this._finish(); return }
    this._step++
    this._renderStep()
  }

  _finish() {
    this.el?.remove()
    this.el = null
    this._done = true
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, '1')
  }
}
