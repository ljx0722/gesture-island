// camera.js — 摄像头管理（从 CameraManager.ts 移植）
const virtualCameraPattern = /\b(obs|virtual|manycam|snap camera|ndi|screen capture|unity|xsplit|vcam)\b/i

export class CameraManager {
  constructor() {
    this.stream = null
    this.video = null
    this._cleanupListeners = null
    this._cleanupFrameMonitor = null
    this.selectedDevice = null
    this.frameStatus = 'idle'
    this.decodedFrames = 0
  }

  async listDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return []
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')
    return devices.map((device, index) => ({
      deviceId: device.deviceId,
      groupId: device.groupId,
      label: device.label.trim(),
      displayLabel: device.label.trim() || `摄像头 ${index + 1}`,
      isLikelyVirtual: virtualCameraPattern.test(device.label),
    }))
  }

  async start(video, options = {}) {
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      throw new Error('摄像头需要 HTTPS 安全连接，请使用 HTTPS 地址打开。')
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器不支持摄像头访问。')

    this.stop()
    this.video = video
    const events = options.events ?? options

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: options.deviceId
          ? { deviceId: { exact: options.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })

      const track = this.stream.getVideoTracks()[0]
      if (!track) throw new Error('没有检测到可用摄像头。')

      const trackSettings = typeof track.getSettings === 'function' ? track.getSettings() : {}
      const devices = await this.listDevices()
      const actualDeviceId = trackSettings.deviceId ?? options.deviceId ?? ''
      this.selectedDevice = devices.find(d => d.deviceId === actualDeviceId)
        ?? devices.find(d => d.deviceId === options.deviceId)
        ?? null

      const onEnded = () => { this._setFrameStatus('ended', events); events.onEnded?.() }
      const onMute = () => this._setFrameStatus('waiting', events)
      const onUnmute = () => this._setFrameStatus('validating', events)
      track.addEventListener('ended', onEnded)
      track.addEventListener('mute', onMute)
      track.addEventListener('unmute', onUnmute)
      this._cleanupListeners = () => {
        track.removeEventListener('ended', onEnded)
        track.removeEventListener('mute', onMute)
        track.removeEventListener('unmute', onUnmute)
      }

      video.srcObject = this.stream
      await video.play()
      await this._waitUntilPlayable(video)
      if (!this.isActive()) throw new Error('摄像头视频流已中断，请重新连接。')
      this._startFrameMonitor(video, events)
      return { device: this.selectedDevice, diagnostics: this.getDiagnostics() }
    } catch (error) {
      this.stop()
      if (error instanceof DOMException && error.name === 'NotAllowedError')
        throw new Error('摄像头权限被拒绝，请在浏览器地址栏允许摄像头访问权限。')
      if (error instanceof DOMException && error.name === 'NotReadableError')
        throw new Error('摄像头正被其他应用占用，或系统隐私开关已关闭。')
      if (error instanceof DOMException && error.name === 'NotFoundError')
        throw new Error('没有检测到可用摄像头，请连接摄像头后重试。')
      if (error instanceof DOMException && error.name === 'OverconstrainedError')
        throw new Error('所选摄像头当前不可用，请切换其他设备。')
      throw error
    }
  }

  stop() {
    this._cleanupFrameMonitor?.()
    this._cleanupFrameMonitor = null
    this._cleanupListeners?.()
    this._cleanupListeners = null
    this.stream?.getTracks().forEach(t => t.stop())
    if (this.video) this.video.srcObject = null
    this.stream = null
    this.video = null
    this.selectedDevice = null
    this.frameStatus = 'idle'
    this.decodedFrames = 0
  }

  isActive() {
    return Boolean(this.stream?.getVideoTracks().some(t => t.readyState === 'live'))
  }

  getDiagnostics() {
    const track = this.stream?.getVideoTracks()[0]
    const settings = track && typeof track.getSettings === 'function' ? track.getSettings() : {}
    return {
      deviceId: settings.deviceId ?? this.selectedDevice?.deviceId ?? '',
      deviceLabel: this.selectedDevice?.displayLabel ?? track?.label ?? '未知摄像头',
      trackState: track?.readyState ?? 'none',
      trackMuted: track?.muted ?? false,
      width: settings.width ?? 0,
      height: settings.height ?? 0,
      frameRate: settings.frameRate ?? 0,
      videoWidth: this.video?.videoWidth ?? 0,
      videoHeight: this.video?.videoHeight ?? 0,
      decodedFrames: this.decodedFrames,
      frameStatus: this.frameStatus,
    }
  }

  _setFrameStatus(status, events) {
    if (this.frameStatus === status) return
    this.frameStatus = status
    events.onFrameStatus?.(status, this.getDiagnostics())
  }

  _startFrameMonitor(video, events) {
    this._setFrameStatus('validating', events)
    const canvas = document.createElement('canvas')
    canvas.width = 32; canvas.height = 18
    let ctx = null
    try { ctx = canvas.getContext('2d', { willReadFrequently: true }) } catch { ctx = null }
    let stopped = false
    let frameCallback = 0
    let animationFrame = 0
    let lastMediaTime = -1
    let lastFrameAt = performance.now()
    let lastSample = null
    let unchangedSamples = 0
    let lastSampleAt = 0

    const inspect = (mediaTime) => {
      if (stopped) return
      const now = performance.now()
      if (mediaTime !== lastMediaTime) {
        lastMediaTime = mediaTime
        lastFrameAt = now
        this.decodedFrames++
        if (ctx && now - lastSampleAt >= 500 && video.videoWidth > 0) {
          lastSampleAt = now
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
            if (lastSample) {
              let diff = 0
              for (let i = 0; i < pixels.length; i += 16) diff += Math.abs(pixels[i] - lastSample[i])
              unchangedSamples = (diff / (pixels.length / 16)) < 0.8 ? unchangedSamples + 1 : 0
            }
            lastSample = new Uint8ClampedArray(pixels)
            this._setFrameStatus(unchangedSamples >= 6 ? 'blank' : 'flowing', events)
          } catch { this._setFrameStatus('flowing', events) }
        } else if (!ctx) this._setFrameStatus('flowing', events)
      } else if (now - lastFrameAt > 3000) this._setFrameStatus('frozen', events)
    }

    const requestVideoFrame = 'requestVideoFrameCallback' in video
      ? function schedule() {
          frameCallback = video.requestVideoFrameCallback((_now, meta) => { inspect(meta.mediaTime); schedule() })
        }
      : null

    const fallback = () => {
      inspect(video.currentTime)
      animationFrame = requestAnimationFrame(fallback)
    }

    if (requestVideoFrame) requestVideoFrame()
    else animationFrame = requestAnimationFrame(fallback)

    const noFrameTimer = setTimeout(() => {
      if (!stopped && this.decodedFrames === 0) this._setFrameStatus('frozen', events)
    }, 5000)

    this._cleanupFrameMonitor = () => {
      stopped = true
      clearTimeout(noFrameTimer)
      if (frameCallback && 'cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(frameCallback)
      cancelAnimationFrame(animationFrame)
    }
  }

  _waitUntilPlayable(video) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0)
      return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('摄像头画面未能开始播放，请重新连接。')), 8000)
      const ready = () => { if (video.videoWidth > 0 && video.videoHeight > 0) finish() }
      const fail = () => finish(new Error('摄像头画面播放失败，请重新连接。'))
      const finish = (err) => {
        clearTimeout(timeout)
        video.removeEventListener('loadedmetadata', ready)
        video.removeEventListener('canplay', ready)
        video.removeEventListener('playing', ready)
        video.removeEventListener('error', fail)
        if (err) reject(err); else resolve()
      }
      video.addEventListener('loadedmetadata', ready)
      video.addEventListener('canplay', ready)
      video.addEventListener('playing', ready)
      video.addEventListener('error', fail)
    })
  }
}
