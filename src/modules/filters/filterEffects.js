// filterEffects.js — 15 种滤镜的像素处理函数
// Each function receives: (r, g, b, x, y, maskAlpha, params, time)
// Returns: { r, g, b }

export function applyVintageHalftone(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299 * r + 0.587 * g + 0.114 * b
  gray = gray * p.contrast + (128 - 128 * p.contrast)
  const dotPattern = Math.sin(x * p.dotSize * 0.3) * Math.cos(y * p.dotSize * 0.3) * 0.5 + 0.5
  if (gray < 85) return lerpPixel(r, g, b, 42, 10, 10, p.intensity)
  if (gray < 170) return lerpPixel(r, g, b, 139, 26, 26, p.intensity)
  return lerpPixel(r, g, b, 245, 230, 210, p.intensity)
  // Add grain: omitted for simplicity — use per-pixel noise in render loop
}

export function applyCoolBlue(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299 * r + 0.587 * g + 0.114 * b
  gray = gray * (1 - p.desaturation) + (r + g + b) / 3 * p.desaturation
  const nr = lerp(r, gray, p.desaturation)
  const ng = lerp(g, gray, p.desaturation)
  const nb = lerp(b, gray + 60 * p.blueShift, p.desaturation)
  const scanline = (Math.sin(y * 0.5) * 0.5 + 0.5) * p.scanlineOpacity
  return {
    r: lerp(r, nr * 0.65 + 10, p.intensity),
    g: lerp(g, ng * 0.75 + 20, p.intensity),
    b: lerp(b, nb * 1.1 + 30, p.intensity),
  }
}

export function applyVintageGreen(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299 * r + 0.587 * g + 0.114 * b
  if (gray < 85) return { r: lerp(r, 26, p.intensity), g: lerp(g, 42, p.intensity), b: lerp(b, 10, p.intensity) }
  if (gray < 170) return { r: lerp(r, 74, p.intensity), g: lerp(g, 90, p.intensity), b: lerp(b, 58, p.intensity) }
  return { r: lerp(r, 230, p.intensity), g: lerp(g, 224, p.intensity), b: lerp(b, 208, p.intensity) }
}

export function applyWarmSepia(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299 * r + 0.587 * g + 0.114 * b
  const sepiaR = Math.min(255, gray * 1.1 + 30 * p.warmth)
  const sepiaG = Math.min(255, gray * 0.95 + 15 * p.warmth)
  const sepiaB = Math.min(255, gray * 0.7 - 10 * p.warmth)
  // Vignette
  const cx = x, cy = y // in local coords — approximate
  // Simplified: return sepia-toned
  return {
    r: lerp(r, sepiaR, p.intensity),
    g: lerp(g, sepiaG, p.intensity),
    b: lerp(b, sepiaB, p.intensity),
  }
}

export function applyNeonCyberpunk(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299 * r + 0.587 * g + 0.114 * b
  // Duotone: magenta highlights, cyan shadows
  const balance = p.duotoneBalance
  if (gray > 128) {
    // Magenta side
    return {
      r: lerp(r, 220 + gray * 0.1, p.intensity),
      g: lerp(g, gray * 0.3, p.intensity),
      b: lerp(b, 180 + gray * 0.2, p.intensity),
    }
  } else {
    // Cyan side
    return {
      r: lerp(r, gray * 0.2, p.intensity),
      g: lerp(g, 160 + gray * 0.3, p.intensity),
      b: lerp(b, 200 + gray * 0.2, p.intensity),
    }
  }
}

export function applyBWSilver(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299 * r + 0.587 * g + 0.114 * b
  gray = ((gray - 128) * p.contrast + 128)
  gray = Math.max(0, Math.min(255, gray))
  const sr = gray, sg = gray * 0.98 + 4 * p.silverTone, sb = gray * 0.95 + 6 * p.silverTone
  return {
    r: lerp(r, sr, p.intensity),
    g: lerp(g, sg, p.intensity),
    b: lerp(b, sb, p.intensity),
  }
}

export function applyPopArt(r, g, b, x, y, maskAlpha, p, t) {
  // Boost saturation then quantize
  const gray = 0.299 * r + 0.587 * g + 0.114 * b
  const sr = lerp(gray, r, p.saturation)
  const sg = lerp(gray, g, p.saturation)
  const sb = lerp(gray, b, p.saturation)
  // Ben-Day dots pattern
  const dot = (Math.sin(x * p.dotSize) * Math.sin(y * p.dotSize) > 0.5) ? 0 : 1
  return {
    r: lerp(r, Math.round(sr / 64) * 64, p.intensity),
    g: lerp(g, Math.round(sg / 64) * 64, p.intensity),
    b: lerp(b, Math.round(sb / 64) * 64, p.intensity),
  }
}

export function applyOilPainting(r, g, b, x, y, maskAlpha, p, t) {
  // Quantize to brush-stroke sized blocks then add relief edge
  const bx = Math.floor(x / p.brushSize) * p.brushSize
  const by = Math.floor(y / p.brushSize) * p.brushSize
  const jitter = ((bx * 7 + by * 13) % 100) / 100 * p.colorVariance * 40
  return {
    r: lerp(r, Math.min(255, r + jitter), p.intensity),
    g: lerp(g, Math.min(255, g + jitter * 0.8), p.intensity),
    b: lerp(b, Math.min(255, b + jitter * 0.6), p.intensity),
  }
}

export function applyWatercolor(r, g, b, x, y, maskAlpha, p, t) {
  // Soften colors, slight bleed
  const bleed = p.bleedRadius
  const softR = r * (1 - p.washSoftness * 0.3) + 240 * p.washSoftness * 0.3
  const softG = g * (1 - p.washSoftness * 0.3) + 240 * p.washSoftness * 0.3
  const softB = b * (1 - p.washSoftness * 0.3) + 235 * p.washSoftness * 0.3
  return {
    r: lerp(r, softR, p.intensity),
    g: lerp(g, softG, p.intensity),
    b: lerp(b, softB, p.intensity),
  }
}

export function applyPixelRetro(r, g, b, x, y, maskAlpha, p, t) {
  const px = Math.floor(x / p.pixelSize) * p.pixelSize
  const py = Math.floor(y / p.pixelSize) * p.pixelSize
  const levels = Math.pow(2, Math.round(p.colorDepth))
  return {
    r: lerp(r, Math.round(r / (256 / levels)) * (256 / levels), p.intensity),
    g: lerp(g, Math.round(g / (256 / levels)) * (256 / levels), p.intensity),
    b: lerp(b, Math.round(b / (256 / levels)) * (256 / levels), p.intensity),
  }
}

export function applyThermal(r, g, b, x, y, maskAlpha, p, t) {
  let gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  gray = Math.max(0, Math.min(1, (gray - 0.5) * p.heatSensitivity + 0.5))
  // Map to heat gradient: cold blue → green → yellow → hot red
  let hr, hg, hb
  if (gray < 0.33) {
    const t = gray / 0.33
    hr = lerp(0, 0, t); hg = lerp(0, 160, t); hb = lerp(200, 80, t)
  } else if (gray < 0.66) {
    const t = (gray - 0.33) / 0.33
    hr = lerp(0, 255, t); hg = lerp(160, 200, t); hb = lerp(80, 0, t)
  } else {
    const t = (gray - 0.66) / 0.34
    hr = lerp(255, 255, t); hg = lerp(200, 50, t); hb = lerp(0, 0, t)
  }
  return { r: lerp(r, hr, p.intensity), g: lerp(g, hg, p.intensity), b: lerp(b, hb, p.intensity) }
}

export function applySketchPencil(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299 * r + 0.587 * g + 0.114 * b
  // Edge detect via neighbor differences (simplified: use spatial noise as hatching)
  const hatch = (Math.sin(x * p.lineDensity * 0.1 + y * Math.tan(p.hatchAngle * Math.PI / 180) * p.lineDensity * 0.1) > 0) ? 20 : 0
  const sketchGray = 255 - Math.abs(gray - 128) * 2
  return {
    r: lerp(r, Math.max(0, sketchGray - hatch), p.intensity),
    g: lerp(g, Math.max(0, sketchGray - hatch), p.intensity),
    b: lerp(b, Math.max(0, sketchGray - hatch), p.intensity),
  }
}

export function applyRainbowHolo(r, g, b, x, y, maskAlpha, p, t) {
  const hue = ((x * 0.3 + y * 0.5 + t * p.prismSpeed) % 1) * 360
  const { r: hr, g: hg, b: hb } = hslToRgb(hue / 360, 0.8, 0.55)
  return {
    r: lerp(r, hr, p.intensity * p.rainbowIntensity),
    g: lerp(g, hg, p.intensity * p.rainbowIntensity),
    b: lerp(b, hb, p.intensity * p.rainbowIntensity),
  }
}

export function applyNegativeInvert(r, g, b, x, y, maskAlpha, p, t) {
  // S-curve then invert
  const curve = (v) => {
    const n = v / 255
    const sn = 1 / (1 + Math.exp(-p.curveSteepness * (n - 0.5)))
    return sn * 255
  }
  return {
    r: lerp(r, 255 - curve(r), p.intensity * p.inversionAmount),
    g: lerp(g, 255 - curve(g), p.intensity * p.inversionAmount),
    b: lerp(b, 255 - curve(b), p.intensity * p.inversionAmount),
  }
}

export function applyGlitchArt(r, g, b, x, y, maskAlpha, p, t) {
  if (Math.random() > p.glitchChance) return { r, g, b }
  const sliceIdx = Math.floor(y / p.sliceHeight)
  const shift = ((sliceIdx * 7 + Math.floor(t * 10)) % 100 < 40) ? p.rgbShiftX : 0
  const shiftY = ((sliceIdx * 13) % 100 < 30) ? p.rgbShiftY : 0
  return {
    r: clampByte(r + shift * 3),
    g: clampByte(g - shift),
    b: clampByte(b + shiftY * 2),
  }
}

export function applyCustomMagic(r, g, b, x, y, maskAlpha, p, t) {
  const intensity = p.intensity ?? 0.85
  const scale = Math.max(0.1, p.patternScale ?? 1.5)
  const speed = p.animationSpeed ?? 1
  const time = t * speed
  const primary = p.primaryRgb || [255, 79, 216]
  const secondary = p.secondaryRgb || [64, 220, 255]
  const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  let pattern = 0

  if (p.pattern === 'dots') {
    const cell = 18 / scale
    const cx = ((x + time * 25) % cell) - cell / 2
    const cy = ((y - time * 15) % cell) - cell / 2
    pattern = 1 - Math.min(1, Math.sqrt(cx * cx + cy * cy) / (cell * 0.42))
  } else if (p.pattern === 'stripes') {
    pattern = Math.sin((x * 0.08 + y * 0.04) * scale + time * 3) * 0.5 + 0.5
  } else if (p.pattern === 'checker') {
    const cell = Math.max(4, 28 / scale)
    pattern = ((Math.floor((x + time * 18) / cell) + Math.floor(y / cell)) % 2) ? 0.85 : 0.15
  } else if (p.pattern === 'stars') {
    const n = noise2d(Math.floor(x / 12), Math.floor(y / 12), Math.floor(time * 4))
    const twinkle = Math.sin(time * 8 + n * 20) * 0.5 + 0.5
    pattern = n > 0.72 ? twinkle : Math.sin((x + y) * 0.025 * scale + time) * 0.25 + 0.35
  } else {
    pattern = Math.sin(x * 0.025 * scale + Math.sin(y * 0.018 * scale + time) * 2 + time * 2) * 0.5 + 0.5
  }

  let c1 = primary
  let c2 = secondary
  if (p.rainbow) {
    const hue = (x * 0.0015 * scale + y * 0.001 * scale + time * 0.08 + gray * 0.25) % 1
    const rainbowA = hslToRgb(hue, 0.9, 0.58)
    const rainbowB = hslToRgb((hue + 0.35) % 1, 0.9, 0.55)
    c1 = [rainbowA.r, rainbowA.g, rainbowA.b]
    c2 = [rainbowB.r, rainbowB.g, rainbowB.b]
  }

  let tr = lerp(c1[0], c2[0], pattern)
  let tg = lerp(c1[1], c2[1], pattern)
  let tb = lerp(c1[2], c2[2], pattern)

  if (p.mixMode === 'duotone') {
    tr = lerp(c1[0], c2[0], gray)
    tg = lerp(c1[1], c2[1], gray)
    tb = lerp(c1[2], c2[2], gray)
  } else if (p.mixMode === 'poster') {
    const band = Math.floor(gray * 4) / 3
    tr = lerp(c1[0], c2[0], Math.min(1, band))
    tg = lerp(c1[1], c2[1], Math.min(1, band))
    tb = lerp(c1[2], c2[2], Math.min(1, band))
  } else if (p.mixMode === 'glow') {
    const glow = 0.65 + pattern * 0.55
    tr *= glow; tg *= glow; tb *= glow
  } else {
    tr = lerp(r, tr, 0.75)
    tg = lerp(g, tg, 0.75)
    tb = lerp(b, tb, 0.75)
  }

  const sparkle = (p.sparkle ?? 0.35) * (noise2d(Math.floor(x / 5), Math.floor(y / 5), Math.floor(time * 8)) > 0.86 ? 85 : 0)
  return {
    r: clampByte(lerp(r, tr + sparkle, intensity)),
    g: clampByte(lerp(g, tg + sparkle, intensity)),
    b: clampByte(lerp(b, tb + sparkle, intensity)),
  }
}

// ── utility ──
function lerp(a, b, t) { return a + (b - a) * t }
function lerpPixel(orig, tr, tg, tb, intensity) {
  return {
    r: lerp(orig, tr, intensity),
    g: lerp(orig, tg, intensity),
    b: lerp(orig, tb, intensity),
  }
}
function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v))) }
function noise2d(x, y, seed = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return s - Math.floor(s)
}

function hslToRgb(h, s, l) {
  let r, g, b
  if (s === 0) { r = g = b = l }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

// ── Filter apply map ──
export const FILTER_APPLIERS = {
  'vintage-halftone': applyVintageHalftone,
  'cool-blue': applyCoolBlue,
  'vintage-green': applyVintageGreen,
  'warm-sepia': applyWarmSepia,
  'neon-cyberpunk': applyNeonCyberpunk,
  'bw-silver':  applyBWSilver,
  'pop-art':    applyPopArt,
  'oil-painting': applyOilPainting,
  'watercolor': applyWatercolor,
  'pixel-retro': applyPixelRetro,
  'thermal':    applyThermal,
  'sketch-pencil': applySketchPencil,
  'rainbow-holo': applyRainbowHolo,
  'negative-invert': applyNegativeInvert,
  'glitch-art': applyGlitchArt,
  'custom-magic': applyCustomMagic,
}
