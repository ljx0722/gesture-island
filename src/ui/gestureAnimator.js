// gestureAnimator.js — canvas-drawn hand skeleton that morphs between gestures
export class GestureAnimator {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this._w = canvas.width
    this._h = canvas.height

    // Finger tip positions for each gesture (relative to palm center)
    // Each shape has 5 finger tips + palm/wrist
    this._poses = {
      open: [ // fully spread
        { tips: [0.62,0.42, 0.75,0.22, 0.83,0.10, 0.85,-0.02, 0.78,-0.12], color: '#6c8cff' },
      ],
      fist: [ // clenched
        { tips: [0.62,0.52, 0.70,0.42, 0.74,0.34, 0.72,0.28, 0.65,0.30], color: '#ff8c6c' },
      ],
      pinch: [ // thumb-index touching
        { tips: [0.60,0.48, 0.72,0.30, 0.78,0.15, 0.74,0.08, 0.66,0.10], color: '#6cff8c' },
      ],
      point: [ // index extended, others curled
        { tips: [0.62,0.52, 0.75,0.14, 0.78,0.00, 0.74,0.30, 0.68,0.32], color: '#ffcc4f' },
      ],
    }

    this._connections = [
      [0,1],[1,2],[2,3],[3,4], // thumb
      [0,5],[5,6],[6,7],[7,8], // index
      [0,9],[9,10],[10,11],[11,12], // middle
      [0,13],[13,14],[14,15],[15,16], // ring
      [0,17],[17,18],[18,19],[19,20], // pinky
    ]

    // Current + target finger positions (21 landmarks, each [x,y])
    this._current = this._makeLandmarks('open')
    this._target = this._makeLandmarks('open')
    this._from = this._makeLandmarks('open')

    this._gestures = ['open', 'fist', 'pinch', 'point']
    this._labels = ['张开', '握拳', '捏合', '指向']
    this._gos = ['张开散开', '握拳聚集', '捏合缩放', '指向排斥']
    this._idx = 0
    this._timer = 0
    this._hold = 2800 // ms per gesture
    this._lerpProgress = 0
    this._animId = 0

    this._onLabelChange = null
  }

  onLabelChange(cb) { this._onLabelChange = cb }

  start() {
    this._advance()
    this._lastTime = performance.now()
    const loop = (now) => {
      this._animId = requestAnimationFrame(loop)
      const dt = Math.min((now - this._lastTime) / 1000, 0.1)
      this._lastTime = now
      this._timer += dt * 1000

      if (this._lerpProgress >= 1 && this._timer >= this._hold) {
        this._advance()
        this._timer = 0
      }

      // Lerp towards target
      if (this._lerpProgress < 1) {
        this._lerpProgress = Math.min(1, this._lerpProgress + dt * 2.5)
        const t = this._ease(this._lerpProgress)
        for (let i = 0; i < this._current.length; i++) {
          this._current[i][0] = this._from[i][0] + (this._target[i][0] - this._from[i][0]) * t
          this._current[i][1] = this._from[i][1] + (this._target[i][1] - this._from[i][1]) * t
        }
      }

      this._draw()
    }
    this._animId = requestAnimationFrame(loop)
  }

  stop() { cancelAnimationFrame(this._animId) }

  _advance() {
    this._idx = (this._idx + 1) % this._gestures.length
    const g = this._gestures[this._idx]
    this._from = this._current.map(p => [p[0], p[1]])
    this._target = this._makeLandmarks(g)
    this._lerpProgress = 0
    this._onLabelChange?.(this._labels[this._idx], this._gos[this._idx])
  }

  _makeLandmarks(poseName) {
    // Generate 21 landmarks from 5 finger tips
    // Simplified: palm = [0.5, 0.65], wrist = [0.5, 0.85]
    const tips = this._poses[poseName][0].tips
    const lm = []
    // Wrist
    lm.push([0.50, 0.88], [0.50, 0.78], [0.50, 0.70])
    // Palm
    lm.push([0.50, 0.62])
    // Thumb: wrist→palm→thumb_base→thumb_mid→thumb_tip
    lm.push([0.55, 0.58], [0.58, 0.50], [tips[0], tips[1]])
    // Index finger
    lm.push([0.58, 0.52], [0.66, 0.38], [0.70, 0.24], [tips[2], tips[3]])
    // Middle finger
    lm.push([0.54, 0.48], [0.56, 0.32], [0.58, 0.16], [tips[4], tips[5]])
    // Ring finger
    lm.push([0.46, 0.48], [0.42, 0.32], [0.40, 0.18], [tips[6], tips[7]])
    // Pinky
    lm.push([0.40, 0.52], [0.34, 0.40], [0.30, 0.28], [tips[8], tips[9]])
    return lm
  }

  _ease(t) { return t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2, 3)/2 }

  _draw() {
    const ctx = this.ctx
    const w = this._w, h = this._h
    ctx.clearRect(0, 0, w, h)

    const scale = h * 0.85
    const cx = w * 0.55, cy = h * 0.08

    // Draw connections
    ctx.strokeStyle = 'rgba(108,140,255,0.5)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (const [a, b] of this._connections) {
      const pa = this._current[a], pb = this._current[b]
      if (!pa || !pb) continue
      ctx.moveTo(cx + (pa[0]-0.5)*scale, cy + pa[1]*scale)
      ctx.lineTo(cx + (pb[0]-0.5)*scale, cy + pb[1]*scale)
    }
    ctx.stroke()

    // Draw landmarks
    for (let i = 0; i < this._current.length; i++) {
      const p = this._current[i]
      if (!p) continue
      const px = cx + (p[0]-0.5)*scale, py = cy + p[1]*scale
      ctx.fillStyle = i === 0 ? 'rgba(108,140,255,0.9)' : 'rgba(108,140,255,0.6)'
      ctx.beginPath()
      ctx.arc(px, py, i === 0 ? 3 : 2, 0, Math.PI*2)
      ctx.fill()
    }
  }
}
