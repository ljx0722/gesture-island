// paintingSampler.js — 像素采样 + 色彩提取 + Sobel 笔触方向
export class PaintingSampler {
  constructor(options = {}) {
    this.sampleDensity = options.sampleDensity ?? 3
    this.skipThreshold = options.skipThreshold ?? 15
  }

  async sample(imageUrl) {
    const image = await this._loadImage(imageUrl)
    const { data, width, height } = this._getImageData(image)
    const particles = []

    for (let y = 0; y < height; y += this.sampleDensity) {
      for (let x = 0; x < width; x += this.sampleDensity) {
        const idx = (y * width + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b

        if (luminance < this.skipThreshold) continue

        // Sobel edge detection
        const gx = this._sobelX(data, width, height, x, y)
        const gy = this._sobelY(data, width, height, x, y)
        const strokeAngle = Math.atan2(gy, gx)
        const edgeStrength = Math.sqrt(gx * gx + gy * gy)

        particles.push({
          u: x / Math.max(1, width - 1),
          v: y / Math.max(1, height - 1),
          r, g, b,
          luminance: luminance / 255,
          strokeAngle,
          edgeStrength: edgeStrength / 2000,
          brightness: luminance / 255,
        })
      }
    }

    return { particles, imageWidth: width, imageHeight: height }
  }

  _loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('画作图片加载失败'))
      img.src = url
    })
  }

  _getImageData(image) {
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(image, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return { data: imageData.data, width: canvas.width, height: canvas.height }
  }

  _pixelAt(data, width, height, x, y) {
    const cx = Math.max(0, Math.min(width - 1, x))
    const cy = Math.max(0, Math.min(height - 1, y))
    const idx = (cy * width + cx) * 4
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
  }

  _sobelX(data, width, height, x, y) {
    const kernel = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
    let sum = 0
    for (let ky = -1; ky <= 1; ky++) {
      for (let kx = -1; kx <= 1; kx++) {
        sum += this._pixelAt(data, width, height, x + kx, y + ky) * kernel[(ky + 1) * 3 + (kx + 1)]
      }
    }
    return sum
  }

  _sobelY(data, width, height, x, y) {
    const kernel = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
    let sum = 0
    for (let ky = -1; ky <= 1; ky++) {
      for (let kx = -1; kx <= 1; kx++) {
        sum += this._pixelAt(data, width, height, x + kx, y + ky) * kernel[(ky + 1) * 3 + (kx + 1)]
      }
    }
    return sum
  }
}
