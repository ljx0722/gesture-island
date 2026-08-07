export const PARAM_GROUPS = [
  { id: 'basic', label: '基础变化' },
  { id: 'fun', label: '趣味效果' },
  { id: 'gesture', label: '手势互动' },
  { id: 'advanced', label: '细节控制' },
  { id: 'rebuild', label: '重建画面' },
]

export const SCENE_PARAM_SCHEMA = {
  particles: {
    basic: {
      pointScale: { label: '粒子大小', min: 0.3, max: 5, step: 0.1, default: 1.8 },
      scatterDist: { label: '散开程度', min: 0.1, max: 3, step: 0.05, default: 1.5 },
      noiseAmp: { label: '流动幅度', min: 0, max: 1, step: 0.01, default: 0.6 },
      opacity: { label: '透明程度', min: 0.1, max: 1, step: 0.01, default: 0.9 },
      color: { type: 'color', label: '粒子颜色', default: '#6c8cff' },
      pointShape: { type: 'select', label: '粒子形状', default: 0, options: [{ value: 0, label: '圆形' }, { value: 1, label: '方形' }, { value: 2, label: '菱形' }, { value: 3, label: '星形' }] },
    },
    fun: {
      flowSpeed: { label: '流动速度', min: 0.2, max: 2, step: 0.05, default: 1 },
      noiseScale: { label: '纹理大小', min: 4, max: 24, step: 1, default: 12 },
      glow: { label: '发光感', min: 0, max: 1, step: 0.01, default: 0.6 },
      colorSpread: { label: '色彩变化', min: 0, max: 1, step: 0.01, default: 0 },
      trail: { label: '运动拖尾', min: 0, max: 1, step: 0.01, default: 0 },
    },
    gesture: {
      gestureSensitivity: { label: '手势灵敏度', min: 0.5, max: 1.5, step: 0.05, default: 1 },
      burstStrength: { label: '张手爆发', min: 0, max: 1, step: 0.01, default: 0.4 },
      handInfluence: { label: '挥手影响', min: 0, max: 1, step: 0.01, default: 0.5 },
      repelRadius: { label: '指向范围', min: 0.1, max: 1, step: 0.01, default: 0.5 },
      repelStrength: { label: '指向力度', min: 0, max: 1, step: 0.01, default: 0.4 },
      cameraZoom: { label: '捏合缩放', min: 0, max: 1, step: 0.05, default: 0.5 },
      twoHandScale: { label: '双手放大', min: 0.5, max: 2, step: 0.05, default: 0.8 },
    },
    advanced: {
      lerpSpeed: { label: '变化速度', min: 0.5, max: 10, step: 0.1, default: 3 },
      rotationSpeed: { label: '旋转速度', min: 0, max: 2, step: 0.01, default: 0.25 },
      autoRotate: { type: 'toggle', label: '自动旋转', default: true },
    },
  },
  paintings: {
    basic: {
      pointScale: { label: '笔触大小', min: 0.3, max: 5, step: 0.1, default: 1 },
      noiseAmp: { label: '流动幅度', min: 0, max: 1, step: 0.01, default: 0.3 },
      brushLength: { label: '笔触长度', min: 0.3, max: 3, step: 0.05, default: 1 },
      bgColor: { type: 'color', label: '背景颜色', default: '#0a0a1a' },
    },
    fun: {
      brightness: { label: '画面亮度', min: 0.5, max: 1.8, step: 0.05, default: 1 },
      contrast: { label: '明暗对比', min: 0.5, max: 2, step: 0.05, default: 1 },
      saturation: { label: '色彩鲜艳', min: 0, max: 1.5, step: 0.05, default: 1 },
      colorTemperature: { label: '冷暖色调', min: -1, max: 1, step: 0.05, default: 0 },
      opacity: { label: '透明程度', min: 0.2, max: 1, step: 0.05, default: 0.95 },
      brushRoundness: { label: '笔触圆润', min: 0, max: 1, step: 0.05, default: 0.5 },
    },
    gesture: {
      yawSensitivity: { label: '左右旋转', min: 0.2, max: 1.5, step: 0.05, default: 0.8 },
      pitchSensitivity: { label: '上下旋转', min: 0.1, max: 1, step: 0.05, default: 0.6 },
      pinchZoom: { label: '捏合放大', min: 0, max: 1, step: 0.05, default: 1 },
      twoHandSpread: { label: '双手撑开', min: 0, max: 1, step: 0.05, default: 0.3 },
      fistSlowdown: { label: '握拳慢放', min: 0, max: 1, step: 0.05, default: 0.8 },
    },
    advanced: {
      noiseSpeed: { label: '流动速度', min: 0, max: 3, step: 0.05, default: 1 },
      noiseScale: { label: '流动纹理', min: 4, max: 24, step: 1, default: 12 },
      domeRadius: { label: '空间半径', min: 1, max: 10, step: 0.1, default: 5 },
      wrapAngle: { label: '环绕范围', min: 0.5, max: 2, step: 0.05, default: 1.6 },
      domeMode: { type: 'select', label: '空间形状', default: 0, options: [{ value: 0, label: '半球' }, { value: 1, label: '圆柱' }, { value: 2, label: '球面' }] },
      autoRotate: { type: 'toggle', label: '自动旋转', default: false },
      autoRotateSpeed: { label: '自动旋转速度', min: 0, max: 0.5, step: 0.01, default: 0.05 },
    },
    rebuild: {
      sampleDensity: { label: '画面细腻度', min: 1, max: 8, step: 1, default: 3, applyMode: 'rebuild' },
    },
  },
  handwarp: {
    basic: {
      tearSize: { label: '撕口大小', min: 12, max: 60, step: 1, default: 32 },
      healSpeed: { label: '自愈速度', min: 0.3, max: 5, step: 0.1, default: 1.8 },
      edgeRoughness: { label: '毛刺程度', min: 0, max: 1, step: 0.05, default: 0.6 },
      edgeGlow: { label: '裂口辉光', min: 0, max: 1, step: 0.05, default: 0.7 },
      particleSpeed: { label: '粒子速度', min: 0.05, max: 1, step: 0.05, default: 0.3 },
      worldBrightness: { label: '世界亮度', min: 0.3, max: 1.5, step: 0.05, default: 1 },
    },
  },
  lighttrails: {
    basic: {
      trailWidth: { label: '画笔粗细', min: 2, max: 20, step: 1, default: 8 },
      fade: { label: '拖尾长度', min: 0.85, max: 0.99, step: 0.01, default: 0.94 },
      glowIntensity: { label: '发光强度', min: 0, max: 1, step: 0.05, default: 0.7 },
      hueShift: { label: '色彩变化', min: 0, max: 1, step: 0.05, default: 0.4 },
    },
  },
  shadowplay: {
    basic: {
      maskSoftness: { label: '轮廓柔化', min: 2, max: 16, step: 1, default: 6 },
      edgeGlow: { label: '边缘辉光', min: 0, max: 1, step: 0.05, default: 0.4 },
      repelStrength: { label: '粒子推斥', min: 0, max: 1, step: 0.05, default: 0.3 },
      vortexStrength: { label: '挥手涡旋', min: 0, max: 1, step: 0.05, default: 0.2 },
      worldBrightness: { label: '世界亮度', min: 0.3, max: 1.5, step: 0.05, default: 1 },
    },
  },
}

export function flattenSceneSchema(moduleId) {
  return Object.values(SCENE_PARAM_SCHEMA[moduleId] || {}).reduce((all, group) => ({ ...all, ...group }), {})
}
