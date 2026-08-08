// filterPresets.js — 15 种滤镜定义 + 参数 schema
export const FILTER_CATEGORIES = ['复古', '科技', '艺术', '实验', '魔法']

export const FILTER_PRESETS = [
  {
    id: 'vintage-halftone', name: '复古半色调', category: '复古',
    params: {
      intensity:    { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      dotSize:      { label: '网点大小', min: 2, max: 12, step: 0.5, default: 4 },
      contrast:     { label: '对比度', min: 0.5, max: 2.5, step: 0.05, default: 1.3 },
      grainAmount:  { label: '颗粒', min: 0, max: 1, step: 0.01, default: 0.4 },
    }
  },
  {
    id: 'cool-blue', name: '冷调青蓝', category: '复古',
    params: {
      intensity:      { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      blueShift:      { label: '蓝色偏移', min: 0, max: 1, step: 0.01, default: 0.55 },
      desaturation:   { label: '去饱和', min: 0, max: 1, step: 0.01, default: 0.5 },
      scanlineOpacity:{ label: '扫描线', min: 0, max: 1, step: 0.01, default: 0.25 },
    }
  },
  {
    id: 'vintage-green', name: '复古绿调', category: '复古',
    params: {
      intensity:    { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      greenShift:   { label: '绿色偏移', min: 0, max: 1, step: 0.01, default: 0.5 },
      rgbOffset:    { label: 'RGB错位', min: 0, max: 5, step: 0.1, default: 1.2 },
      ditherAmount: { label: '抖动', min: 0, max: 1, step: 0.01, default: 0.35 },
    }
  },
  {
    id: 'warm-sepia', name: '暖黄旧照', category: '复古',
    params: {
      intensity:        { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      warmth:           { label: '暖度', min: 0, max: 1, step: 0.01, default: 0.6 },
      vignetteStrength: { label: '暗角', min: 0, max: 1, step: 0.01, default: 0.4 },
      paperAge:         { label: '纸纹老旧', min: 0, max: 1, step: 0.01, default: 0.35 },
    }
  },
  {
    id: 'neon-cyberpunk', name: '霓虹赛博', category: '科技',
    params: {
      intensity:       { label: '强度', min: 0, max: 1, step: 0.01, default: 0.85 },
      neonGlow:        { label: '霓虹辉光', min: 0, max: 1, step: 0.01, default: 0.7 },
      duotoneBalance:  { label: '双色平衡', min: 0, max: 1, step: 0.01, default: 0.5 },
      flickerSpeed:    { label: '闪烁频率', min: 0, max: 5, step: 0.1, default: 0.5 },
    }
  },
  {
    id: 'bw-silver', name: '黑白银盐', category: '复古',
    params: {
      intensity:  { label: '强度', min: 0, max: 1, step: 0.01, default: 0.85 },
      contrast:   { label: '对比度', min: 0.5, max: 3, step: 0.05, default: 1.8 },
      grainSize:  { label: '颗粒大小', min: 1, max: 5, step: 0.1, default: 2 },
      silverTone: { label: '银盐调', min: 0, max: 1, step: 0.01, default: 0.4 },
    }
  },
  {
    id: 'pop-art', name: '波普艺术', category: '艺术',
    params: {
      intensity:         { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      saturation:        { label: '饱和度', min: 0.5, max: 3, step: 0.05, default: 1.8 },
      dotSize:           { label: '网点大小', min: 2, max: 10, step: 0.5, default: 4 },
      outlineThickness:  { label: '轮廓线', min: 0, max: 1, step: 0.01, default: 0.3 },
    }
  },
  {
    id: 'oil-painting', name: '油画厚涂', category: '艺术',
    params: {
      intensity:        { label: '强度', min: 0, max: 1, step: 0.01, default: 0.75 },
      brushSize:        { label: '笔触大小', min: 3, max: 15, step: 0.5, default: 6 },
      reliefStrength:   { label: '浮雕感', min: 0, max: 1, step: 0.01, default: 0.5 },
      colorVariance:    { label: '色彩抖动', min: 0, max: 1, step: 0.01, default: 0.35 },
    }
  },
  {
    id: 'watercolor', name: '水彩晕染', category: '艺术',
    params: {
      intensity:     { label: '强度', min: 0, max: 1, step: 0.01, default: 0.7 },
      washSoftness:  { label: '柔化', min: 0, max: 1, step: 0.01, default: 0.6 },
      bleedRadius:   { label: '晕开半径', min: 1, max: 10, step: 0.5, default: 4 },
      paperTexture:  { label: '纸纹理', min: 0, max: 1, step: 0.01, default: 0.5 },
    }
  },
  {
    id: 'pixel-retro', name: '像素复古', category: '科技',
    params: {
      intensity:    { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      pixelSize:    { label: '像素大小', min: 2, max: 16, step: 1, default: 6 },
      colorDepth:   { label: '色深', min: 3, max: 8, step: 1, default: 6 },
      ditherPattern:{ label: '抖动模式', min: 0, max: 2, step: 1, default: 1 },
    }
  },
  {
    id: 'thermal', name: '热感红外', category: '科技',
    params: {
      intensity:      { label: '强度', min: 0, max: 1, step: 0.01, default: 0.85 },
      heatSensitivity: { label: '热感度', min: 0.5, max: 3, step: 0.05, default: 1.5 },
      coldHue:        { label: '冷端色相', min: 180, max: 270, step: 1, default: 240 },
      hotHue:         { label: '热端色相', min: 0, max: 60, step: 1, default: 0 },
    }
  },
  {
    id: 'sketch-pencil', name: '素描铅笔', category: '艺术',
    params: {
      intensity:     { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      lineDensity:   { label: '排线密度', min: 0.3, max: 3, step: 0.05, default: 1.2 },
      hatchAngle:    { label: '排线角度', min: 0, max: 90, step: 5, default: 30 },
      edgeThreshold: { label: '边缘阈值', min: 0.05, max: 0.5, step: 0.01, default: 0.15 },
    }
  },
  {
    id: 'rainbow-holo', name: '彩虹全息', category: '科技',
    params: {
      intensity:        { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      prismSpeed:       { label: '光棱速度', min: 0.1, max: 3, step: 0.05, default: 0.6 },
      rainbowIntensity: { label: '彩虹强度', min: 0, max: 1, step: 0.01, default: 0.65 },
      shiftHue:         { label: '色相偏移', min: 0, max: 1, step: 0.01, default: 0.3 },
    }
  },
  {
    id: 'negative-invert', name: '负片反转', category: '实验',
    params: {
      intensity:       { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      inversionAmount: { label: '反转量', min: 0, max: 1, step: 0.01, default: 0.85 },
      curveSteepness:  { label: '曲线陡度', min: 0.5, max: 4, step: 0.05, default: 2.0 },
    }
  },
  {
    id: 'custom-magic', name: '自定义魔法滤镜', category: '魔法',
    params: {
      intensity:      { label: '魔法强度', min: 0, max: 1, step: 0.01, default: 0.85 },
      primaryColor:   { type: 'color', label: '主颜色', default: '#ff4fd8' },
      secondaryColor: { type: 'color', label: '副颜色', default: '#40dcff' },
      pattern:        { type: 'select', label: '图案', default: 'waves', options: [
        { value: 'waves', label: '波浪' },
        { value: 'dots', label: '圆点' },
        { value: 'stripes', label: '条纹' },
        { value: 'checker', label: '棋盘' },
        { value: 'stars', label: '星光' },
      ] },
      patternScale:   { label: '图案大小', min: 0.3, max: 5, step: 0.05, default: 1.5 },
      animationSpeed: { label: '动画速度', min: 0, max: 4, step: 0.05, default: 1.0 },
      mixMode:        { type: 'select', label: '混合方式', default: 'glow', options: [
        { value: 'tint', label: '染色' },
        { value: 'duotone', label: '双色' },
        { value: 'glow', label: '发光' },
        { value: 'poster', label: '海报' },
      ] },
      sparkle:        { label: '闪光', min: 0, max: 1, step: 0.01, default: 0.35 },
      rainbow:        { type: 'toggle', label: '彩虹模式', default: false },
      randomize:      { type: 'button', label: '随机魔法', buttonLabel: '随机魔法', action: 'randomizeCustomFilter' },
    }
  },
  {
    id: 'kaleidoscope', name: '万花筒', category: '魔法',
    params: {
      intensity: { label: '强度', min: 0, max: 1, step: 0.01, default: 0.85 },
      segments:  { label: '镜面数', min: 2, max: 8, step: 1, default: 4 },
    }
  },
  {
    id: 'candy-paint', name: '糖果涂鸦', category: '魔法',
    params: {
      intensity:  { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      colorShift: { label: '色相偏移', min: 0, max: 1, step: 0.01, default: 0.25 },
      speed:      { label: '流动速度', min: 0.1, max: 3, step: 0.05, default: 1.0 },
      dripAmount: { label: '滴落效果', min: 0, max: 1, step: 0.01, default: 0.4 },
    }
  },
  {
    id: 'toon-shader', name: '卡通渲染', category: '艺术',
    params: {
      intensity:     { label: '强度', min: 0, max: 1, step: 0.01, default: 0.85 },
      posterLevels:  { label: '色阶数', min: 2, max: 8, step: 1, default: 5 },
      edgeStrength:  { label: '描边粗细', min: 0.1, max: 1, step: 0.05, default: 0.3 },
    }
  },
  {
    id: 'film-noir', name: '黑色电影', category: '复古',
    params: {
      intensity:        { label: '强度', min: 0, max: 1, step: 0.01, default: 0.9 },
      contrast:         { label: '对比度', min: 1, max: 4, step: 0.1, default: 2 },
      grainAmount:      { label: '颗粒感', min: 0, max: 1, step: 0.05, default: 0.6 },
      vignetteStrength: { label: '暗角', min: 0, max: 1, step: 0.05, default: 0.7 },
    }
  },
  {
    id: 'mosaic', name: '马赛克', category: '科技',
    params: {
      intensity:  { label: '强度', min: 0, max: 1, step: 0.01, default: 0.9 },
      blockSize:  { label: '块大小', min: 4, max: 40, step: 2, default: 16 },
      colorShift: { label: '色彩偏移', min: 0.2, max: 1, step: 0.05, default: 0.6 },
    }
  },
  {
    id: 'emboss', name: '浮雕', category: '艺术',
    params: {
      intensity:    { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      reliefDepth:  { label: '浮雕深度', min: 0.5, max: 3, step: 0.1, default: 1.5 },
    }
  },
  {
    id: 'dream-glow', name: '梦幻柔光', category: '色彩',
    params: {
      intensity:  { label: '强度', min: 0, max: 1, step: 0.01, default: 0.7 },
      glowAmount: { label: '光晕', min: 0, max: 1, step: 0.05, default: 0.5 },
      softness:   { label: '柔化', min: 0, max: 1, step: 0.05, default: 0.4 },
    }
  },
  {
    id: 'vibrance', name: '鲜艳增强', category: '色彩',
    params: {
      intensity:     { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      vibranceBoost: { label: '鲜艳度', min: 0.2, max: 1.5, step: 0.05, default: 0.6 },
    }
  },
  {
    id: 'glitch-art', name: '故障艺术', category: '科技',
    params: {
      intensity:   { label: '强度', min: 0, max: 1, step: 0.01, default: 0.8 },
      glitchChance:{ label: '故障概率', min: 0.1, max: 1, step: 0.05, default: 0.7 },
      rgbShiftX:   { label: 'RGB偏移X', min: 1, max: 30, step: 1, default: 8 },
      rgbShiftY:   { label: 'RGB偏移Y', min: 1, max: 20, step: 1, default: 4 },
      sliceHeight: { label: '切片高度', min: 2, max: 24, step: 2, default: 8 },
    }
  },
]

export function getFilterById(id) {
  return FILTER_PRESETS.find(f => f.id === id)
}
