// maskProcessor.js — 遮罩下采样 + 箱式模糊 + 双线性上采样查找
export class MaskProcessor {
  constructor(options = {}) {
    this.scaleFactor = options.scaleFactor ?? 4
    this.blurPasses = options.blurPasses ?? 3
    this._smallData = null
    this._smallW = 0
    this._smallH = 0
    this._fullW = 0
    this._fullH = 0
  }

  process(rawMask, videoWidth, videoHeight) {
    this._fullW = videoWidth
    this._fullH = videoHeight
    this._smallW = Math.ceil(videoWidth / this.scaleFactor)
    this._smallH = Math.ceil(videoHeight / this.scaleFactor)

    // Downsample
    const smallData = new Uint8ClampedArray(this._smallW * this._smallH)
    for (let sy = 0; sy < this._smallH; sy++) {
      for (let sx = 0; sx < this._smallW; sx++) {
        let sum = 0, count = 0
        for (let dy = 0; dy < this.scaleFactor; dy++) {
          for (let dx = 0; dx < this.scaleFactor; dx++) {
            const px = sx * this.scaleFactor + dx
            const py = sy * this.scaleFactor + dy
            if (px < videoWidth && py < videoHeight) {
              sum += rawMask[py * videoWidth + px] || 0
              count++
            }
          }
        }
        smallData[sy * this._smallW + sx] = count > 0 ? Math.round((sum / count) * 255) : 0
      }
    }

    // Box blur passes
    for (let pass = 0; pass < this.blurPasses; pass++) {
      this._boxBlur(smallData, this._smallW, this._smallH, 3)
    }

    this._smallData = smallData
  }

  _boxBlur(data, w, h, radius) {
    const horiz = new Uint8ClampedArray(data.length)
    // Horizontal pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          if (nx >= 0 && nx < w) { sum += data[y * w + nx]; count++ }
        }
        horiz[y * w + x] = Math.round(sum / count)
      }
    }
    // Vertical pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy
          if (ny >= 0 && ny < h) { sum += horiz[ny * w + x]; count++ }
        }
        data[y * w + x] = Math.round(sum / count)
      }
    }
  }

  getAlphaAt(x, y) {
    if (!this._smallData) return 0
    const sx = x / this.scaleFactor
    const sy = y / this.scaleFactor
    const ix = Math.floor(sx), iy = Math.floor(sy)
    const fx = sx - ix, fy = sy - iy

    const sample = (cx, cy) => {
      if (cx < 0 || cx >= this._smallW || cy < 0 || cy >= this._smallH) return 0
      return this._smallData[cy * this._smallW + cx]
    }

    // Bilinear interpolation
    const a = sample(ix, iy)
    const b = sample(ix + 1, iy)
    const c = sample(ix, iy + 1)
    const d = sample(ix + 1, iy + 1)
    return Math.round(a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy)
  }

  getMaskData() {
    return this._smallData
  }

  getDimensions() {
    return { width: this._smallW, height: this._smallH, scaleFactor: this.scaleFactor }
  }
}
