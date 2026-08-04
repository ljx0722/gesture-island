// pipeline.js — 共享编排器：协调摄像头 + 手部追踪 + 平滑 + 遮罩 + 渲染
import { CameraManager } from './camera.js'
import { createHandTracker } from '../tracking/handTracker.js'
import { sortLeftRight, getHandCount } from '../tracking/handSorter.js'
import { smoothFrame } from './smoothing.js'

export class Pipeline {
  constructor(config = {}) {
    this.camera = new CameraManager()
    this.handTracker = null
    this.maskSegmenter = null
    this.smoothingAlpha = config.smoothingAlpha ?? 0.35
    this.handInterval = config.handInterval ?? (1000 / 30)
    this.maskInterval = config.maskInterval ?? (1000 / 15)
    this.video = config.videoElement

    this._running = false
    this._animId = 0
    this._lastHandTime = 0
    this._lastMaskTime = 0
    this._prevFrame = null
    this._subscribers = new Set()
    this._needsMask = false
  }

  setSmoothingAlpha(alpha) {
    this.smoothingAlpha = alpha
  }

  setNeedsMask(needs) {
    this._needsMask = needs
  }

  subscribe(callback) {
    this._subscribers.add(callback)
    return () => this._subscribers.delete(callback)
  }

  async initHandTracker(options = {}) {
    this.handTracker = await createHandTracker({
      onProgress: options.onProgress,
      wasmPath: options.wasmPath || '/mediapipe',
    })
  }

  async initMaskSegmenter(options = {}) {
    this.maskSegmenter = await createMaskSegmenter({
      onProgress: options.onProgress,
    })
  }

  async startCamera(videoEl, options = {}) {
    await this.camera.start(videoEl || this.video, options)
  }

  stopCamera() {
    this.camera.stop()
  }

  isCameraActive() {
    return this.camera.isActive()
  }

  startLoop() {
    if (this._running) return
    this._running = true
    this._prevFrame = null

    const loop = (timestamp) => {
      if (!this._running) return
      this._animId = requestAnimationFrame(loop)

      const video = this.camera.video || this.video
      if (!video || video.readyState < 2) return

      let hands = { left: null, right: null }
      let mask = null

      // Hand detection
      if (this.handTracker && timestamp - this._lastHandTime >= this.handInterval) {
        this._lastHandTime = timestamp
        const raw = this.handTracker.detect(video, timestamp)
        if (raw && raw.hands.length > 0) {
          const smoothed = smoothFrame(this._prevFrame, raw, this.smoothingAlpha)
          hands = sortLeftRight(smoothed.hands)
          this._prevFrame = smoothed
        } else {
          this._prevFrame = null
        }
      }

      // Mask segmentation (only for filter module)
      if (this._needsMask && this.maskSegmenter && timestamp - this._lastMaskTime >= this.maskInterval) {
        this._lastMaskTime = timestamp
        mask = this.maskSegmenter.segment(video, timestamp)
      }

      // Notify subscribers
      const frameData = {
        timestamp,
        hands,
        leftHand: hands.left,
        rightHand: hands.right,
        handCount: getHandCount(hands),
        mask,
        video,
        cameraActive: this.camera.isActive(),
      }

      for (const cb of this._subscribers) {
        try { cb(frameData) } catch (e) { console.error('Pipeline subscriber error:', e) }
      }
    }

    this._animId = requestAnimationFrame(loop)
  }

  stopLoop() {
    this._running = false
    cancelAnimationFrame(this._animId)
    this.handTracker?.close()
    this.maskSegmenter?.close()
  }

  destroy() {
    this.stopLoop()
    this.stopCamera()
    this._subscribers.clear()
    this.handTracker = null
    this.maskSegmenter = null
  }
}
