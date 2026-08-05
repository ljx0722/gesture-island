// app.js — 粒子交互AI教学 主入口
import { Pipeline } from './core/pipeline.js'
import { ParticleModule } from './modules/particles/particleModule.js'
import { PaintingModule } from './modules/paintings/paintingModule.js'
import { FilterModule } from './modules/filters/filterModule.js'
import { StatusDisplay } from './ui/status.js'
import { ParamPanel } from './ui/paramPanel.js'
import { PRESETS } from './modules/particles/particlePresets.js'
import { PAINTING_PRESETS } from './modules/paintings/paintingPresets.js'
import { FILTER_PRESETS } from './modules/filters/filterPresets.js'
import { preloadHandTracker } from './tracking/handTracker.js'
import { HAND_CONNECTIONS } from './tracking/handFeatures.js'
import { AudioManager } from './ui/audioManager.js'
import { Onboarding } from './ui/onboarding.js'
import { ChallengeMode } from './ui/challengeMode.js'

// DOM refs
const container = document.getElementById('canvas-container')
const threeCanvas = document.getElementById('three-canvas')
const cameraCanvas = document.getElementById('camera-canvas')
const videoEl = document.getElementById('camera-video')
const tabBtns = document.querySelectorAll('.tab-btn')
const paramToggle = document.getElementById('param-toggle')
const btnCamera = document.getElementById('btn-camera')
const btnDemo = document.getElementById('btn-demo')
const btnReset = document.getElementById('btn-reset')
const smoothSlider = document.getElementById('smoothing-slider')
const presetGallery = document.getElementById('preset-gallery')
const filterSelector = document.getElementById('filter-selector')
const paintingSelector = document.getElementById('painting-selector')
const handPreview = document.getElementById('hand-preview')
const handPreviewCanvas = document.getElementById('hand-preview-canvas')

// State
let currentModule = 'particles'
let sharedRenderer = null
let pipeline = null
let particleModule = null
let filterModule = null
let paintingModule = null
let statusDisplay = null
let paramPanel = null
let audioManager = null
let onboarding = null
let challengeMode = null
let cameraActive = false
let demoActive = false
let moduleInitialized = { particles: false, filters: false, paintings: false }
let animationId = 0
let lastTime = 0

// ── Init ──
async function init() {
  statusDisplay = new StatusDisplay()
  paramPanel = new ParamPanel()
  audioManager = new AudioManager()
  onboarding = new Onboarding()
  challengeMode = new ChallengeMode()
  challengeMode.setAudio(audioManager)

  // Bind events FIRST — before any module loading can fail
  _bindEvents()
  _setupMouseGestures()

  // Create pipeline
  pipeline = new Pipeline({ videoElement: videoEl, smoothingAlpha: parseFloat(smoothSlider.value) })

  // Create shared WebGL renderer
  const T = window.THREE
  sharedRenderer = new T.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true })
  sharedRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  const cw = container.clientWidth || window.innerWidth || 1024
  const ch = container.clientHeight || window.innerHeight || 768
  sharedRenderer.setSize(cw, ch, false)

  // WebGL context loss handling
  threeCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    console.warn('WebGL context lost — pausing render')
    particleModule?.stop()
    paintingModule?.stop()
  })
  threeCanvas.addEventListener('webglcontextrestored', () => {
    console.log('WebGL context restored — reloading')
    location.reload()
  })

  // Init particle module (default tab)
  try {
    document.getElementById('app').style.display = 'flex'
    await new Promise(resolve => requestAnimationFrame(resolve))
    resizeCanvas()
    await _initParticlesModule()
    particleModule?.setGestureOpenness(0.5)
    statusDisplay.hideLoading()
  } catch (e) {
    console.error('Particle module init error:', e)
    statusDisplay.showError('粒子模块加载失败: ' + e.message)
  }

  // Start render loop
  _startRenderLoop()

  // Preload hand tracker in background so camera starts faster later
  preloadHandTracker().catch(() => {})

  // Show onboarding for first-time visitors
  if (!onboarding.done) {
    setTimeout(() => onboarding.show(), 500)
  }
}

function resizeCanvas() {
  const w = container.clientWidth || window.innerWidth || 1024
  const h = container.clientHeight || window.innerHeight || 768
  if (w > 0 && h > 0) {
    threeCanvas.width = w
    threeCanvas.height = h
    cameraCanvas.width = w
    cameraCanvas.height = h
  }
  particleModule?.resize?.()
  paintingModule?.resize?.()
}

async function _initParticlesModule() {
  particleModule = new ParticleModule(container, sharedRenderer)
  await particleModule.init()
  particleModule.start()
  moduleInitialized.particles = true
  _renderPresetGallery()
  _showParamPanel('particles')
}

async function _initPaintingsModule() {
  paintingModule = new PaintingModule(container, sharedRenderer)
  await paintingModule.init()
  paintingModule.start()
  moduleInitialized.paintings = true
}

async function _initFilterModule() {
  filterModule = new FilterModule(cameraCanvas, videoEl)
  await filterModule.init({
    onProgress: ({ stage, progress, text }) => {
      statusDisplay.setLoadingProgress(stage, progress, text)
    },
  })
  moduleInitialized.filters = true
}

// ── Render Loop ──
function _startRenderLoop() {
  const loop = (now) => {
    animationId = requestAnimationFrame(loop)
    const dt = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now
    statusDisplay.updateFPS()

    // Challenge mode timeout check
    if (challengeMode?.active) challengeMode.checkTimeout(now)

    // Demo mode filter rendering
    if (currentModule === 'filters' && filterModule && demoActive && !cameraActive) {
      filterModule.renderDemo(dt)
    }

    // Mouse gesture smooth lerp
    if (!cameraActive && !demoActive && mouseTargetOpenness !== mouseOpenness) {
      mouseOpenness += (mouseTargetOpenness - mouseOpenness) * Math.min(8 * dt, 1)
      if (Math.abs(mouseTargetOpenness - mouseOpenness) < 0.001) mouseOpenness = mouseTargetOpenness
      _applyMouseOpenness()
    }
  }
  lastTime = performance.now()
  animationId = requestAnimationFrame(loop)
}

// ── Gesture → Module ──
let lastGestureType = 'none'
function _handleGesture(frameData) {
  if (demoActive) return
  const gesture = frameData.gestureType
  if (gesture !== lastGestureType) {
    lastGestureType = gesture
    const labels = { open: '张开手掌', fist: '握拳', pinch: '捏合', point: '指向', none: '待机' }
    statusDisplay.setHandStatus(frameData.handCount, labels[gesture] || '')
    if (gesture !== 'none') audioManager?.gestureDetected()
    challengeMode?.onGesture(gesture, frameData.openness ?? 0)
  }

  if (currentModule === 'particles' && particleModule) {
    particleModule.onGestureFrame(frameData)
  } else if (currentModule === 'paintings' && paintingModule) {
    paintingModule.onGestureFrame(frameData)
  }
}

// ── Mouse gesture simulation ──
let mouseActive = false
let mouseOpenness = 0.5
let mouseTargetOpenness = 0.5

function _setupMouseGestures() {
  const targetEl = document.getElementById('canvas-container')

  targetEl.addEventListener('mousedown', (e) => {
    if (cameraActive || demoActive) return
    mouseActive = true
    mouseTargetOpenness = 0.05 // hold = fist
    _applyMouseOpenness()
  })

  targetEl.addEventListener('mouseup', () => {
    if (cameraActive || demoActive) return
    mouseActive = false
    mouseTargetOpenness = 1.0 // release = open
    _applyMouseOpenness()
  })

  targetEl.addEventListener('mouseleave', () => {
    if (cameraActive || demoActive) return
    mouseActive = false
    mouseTargetOpenness = 0.5
    _applyMouseOpenness()
  })

  targetEl.addEventListener('wheel', (e) => {
    if (cameraActive || demoActive) return
    e.preventDefault()
    mouseTargetOpenness = Math.max(0, Math.min(1, mouseTargetOpenness - e.deltaY * 0.001))
    _applyMouseOpenness()
  }, { passive: false })

  // Touch support
  targetEl.addEventListener('touchstart', (e) => {
    if (cameraActive || demoActive) return
    if (e.touches.length === 1) {
      mouseActive = true
      mouseTargetOpenness = 0.05
      _applyMouseOpenness()
    }
  })

  targetEl.addEventListener('touchend', () => {
    if (cameraActive || demoActive) return
    mouseActive = false
    mouseTargetOpenness = 1.0
    _applyMouseOpenness()
  })
}

function _applyMouseOpenness() {
  if (cameraActive || demoActive) return
  // Smooth lerp in render loop
  const frameData = {
    handCount: mouseActive ? 1 : 0,
    openness: mouseOpenness,
    gestureType: mouseOpenness > 0.7 ? 'open' : mouseOpenness < 0.3 ? 'fist' : 'none',
    leftHand: null,
    rightHand: null,
    hands: { left: null, right: null },
    events: [],
    gesture: { gesture: mouseOpenness > 0.7 ? 'open' : mouseOpenness < 0.3 ? 'fist' : 'none', pinch: mouseOpenness < 0.3 },
    primaryHand: { openness: mouseOpenness },
  }

  if (currentModule === 'particles' && particleModule) {
    particleModule.onGestureFrame(frameData)
  } else if (currentModule === 'paintings' && paintingModule) {
    paintingModule.onGestureFrame(frameData)
  }
}

// ── Pipeline subscription ──
function _subscribePipeline() {
  pipeline.subscribe((frameData) => {
    statusDisplay.setHandStatus(frameData.handCount)
    _handleGesture(frameData)
    if (currentModule === 'filters' && filterModule && !demoActive) {
      filterModule.render(frameData, 0.016)
    }
    _renderHandPreview(frameData)
  })
}

// ── Hand preview (top-right mini window) ──
function _renderHandPreview(frameData) {
  if (!handPreviewCanvas) return
  const pw = handPreviewCanvas.width
  const ph = handPreviewCanvas.height
  const ctx = handPreviewCanvas.getContext('2d', { alpha: false })
  if (!ctx) return

  // Draw mirrored camera frame scaled down
  const video = frameData.video
  if (video && video.readyState >= 2) {
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -pw, 0, pw, ph)
    ctx.restore()
  } else {
    ctx.fillStyle = '#0a0a0f'
    ctx.fillRect(0, 0, pw, ph)
  }

  // Draw hand skeletons
  const toPixel = (pt) => ({ x: pt.x * pw, y: pt.y * ph })

  for (const hand of [frameData.leftHand, frameData.rightHand]) {
    if (!hand?.landmarks) continue
    ctx.save()
    ctx.strokeStyle = 'rgba(108,140,255,0.6)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = toPixel(hand.landmarks[a])
      const pb = toPixel(hand.landmarks[b])
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
    }
    ctx.stroke()
    for (const pt of hand.landmarks) {
      const p = toPixel(pt)
      ctx.fillStyle = 'rgba(108,140,255,0.9)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

// ── Module Switching ──
async function switchModule(moduleId) {
  if (currentModule === moduleId) return

  // Stop inactive Three.js render loops and dispose GPU resources
  if (currentModule === 'particles') {
    particleModule?.stop()
    particleModule?.dispose()
    moduleInitialized.particles = false
  }
  if (currentModule === 'paintings') {
    paintingModule?.stop()
    paintingModule?.dispose()
    moduleInitialized.paintings = false
  }

  threeCanvas.classList.add('hidden')
  cameraCanvas.classList.add('hidden')
  document.querySelectorAll('.module-ui').forEach(el => el.classList.add('hidden'))

  currentModule = moduleId
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.module === moduleId))
  resizeCanvas()

  try {
    if (moduleId === 'particles') {
      threeCanvas.classList.remove('hidden')
      if (particleModule) particleModule.start()
      else await _initParticlesModule()
      _renderPresetGallery()
      _showParamPanel('particles')
      statusDisplay.setStatus('就绪')
    } else if (moduleId === 'filters') {
      cameraCanvas.classList.remove('hidden')
      if (!moduleInitialized.filters) {
        statusDisplay.showLoading('正在加载人物分割模型...')
        await _initFilterModule()
        statusDisplay.hideLoading()
      }
      _renderFilterSelector()
      _showParamPanel('filters')
    } else if (moduleId === 'paintings') {
      threeCanvas.classList.remove('hidden')
      if (!moduleInitialized.paintings) {
        statusDisplay.showLoading('正在加载画作...')
        await _initPaintingsModule()
        statusDisplay.hideLoading()
      } else {
        paintingModule.start()
      }
      _renderPaintingSelector()
      _showParamPanel('paintings')
      statusDisplay.setStatus('就绪')
    }
  } catch (e) {
    console.error('Module switch error:', e)
    statusDisplay.hideLoading()
    statusDisplay.showError(`模块加载失败：${e.message}`)
  }
}

// ── Camera (works on ANY tab) ──
async function _startCamera() {
  if (cameraActive) return
  try {
    statusDisplay.showLoading('正在加载手势识别模型...')
    await pipeline.initHandTracker({
      onProgress: ({ stage, progress, text }) => {
        statusDisplay.setLoadingProgress(stage, progress, text)
      },
    })

    // Only init mask when on filters tab
    if (currentModule === 'filters') {
      pipeline.setNeedsMask(true)
      if (!pipeline.maskSegmenter) {
        await pipeline.initMaskSegmenter({
          onProgress: ({ stage, progress, text }) => {
            statusDisplay.setLoadingProgress(stage, progress, text)
          },
        })
      }
    } else {
      pipeline.setNeedsMask(false)
    }

    statusDisplay.showLoading('正在启动摄像头...')
    await pipeline.startCamera(videoEl, {
      events: {
        onEnded: () => {
          cameraActive = false
          btnCamera.textContent = '启动摄像头'
          btnCamera.classList.remove('on')
          statusDisplay.showWarning('摄像头连接已中断')
        },
      },
    })
    cameraActive = true
    btnCamera.textContent = '关闭摄像头'
    btnCamera.classList.add('on')
    pipeline.resetGestureState()
    pipeline.startLoop()
    _subscribePipeline()
    handPreview?.classList.remove('hidden')
    paramPanel.show()
    statusDisplay.hideLoading()
    statusDisplay.showToast('摄像头已启动，请将双手放入画面', 'info', 2500)
  } catch (e) {
    statusDisplay.hideLoading()
    console.error('Camera start error:', e)
    statusDisplay.showError(e.message || '摄像头启动失败')
  }
}

async function _stopCamera() {
  pipeline.stopLoop()
  pipeline.stopCamera()
  cameraActive = false
  btnCamera.textContent = '启动摄像头'
  btnCamera.classList.remove('on')
  statusDisplay.setHandStatus(0)
  handPreview?.classList.add('hidden')
}

// ── Demo Mode ──
function toggleDemo() {
  demoActive = !demoActive

  if (demoActive) {
    btnDemo.classList.add('on')
    if (currentModule === 'particles' && particleModule) {
      particleModule.setDemoMode(true)
      statusDisplay.setStatus('演示模式')
    } else if (currentModule === 'paintings' && paintingModule) {
      paintingModule.setDemoMode(true)
      statusDisplay.setStatus('演示模式')
    } else if (currentModule === 'filters' && filterModule) {
      filterModule.demoMode = true
      statusDisplay.setHandStatus(2, '演示')
    }
  } else {
    btnDemo.classList.remove('on')
    if (currentModule === 'particles' && particleModule) {
      particleModule.setDemoMode(false)
    } else if (currentModule === 'paintings' && paintingModule) {
      paintingModule.setDemoMode(false)
    } else if (currentModule === 'filters' && filterModule) {
      filterModule.demoMode = false
    }
    statusDisplay.setStatus('就绪')
  }
}

// ── Reset ──
function reset() {
  if (pipeline) pipeline.resetGestureState()
  if (currentModule === 'particles' && particleModule) {
    particleModule.reset()
    statusDisplay.setStatus('就绪')
  } else if (currentModule === 'paintings' && paintingModule) {
    paintingModule.reset()
    statusDisplay.setStatus('就绪')
  } else if (currentModule === 'filters' && filterModule) {
    filterModule.resetFilterParams()
    _showParamPanel('filters')
  }
}

// ── UI Rendering ──
function _renderPresetGallery() {
  presetGallery.classList.remove('hidden')
  let html = ''
  PRESETS.forEach((p, i) => {
    html += `<button class="preset-chip selector-chip${i === (particleModule?.currentPresetIdx ?? 0) ? ' active' : ''}" data-preset="${i}">${p.name}</button>`
  })
  html += `<button class="upload-btn selector-action" id="upload-model-btn">上传模型</button>`
  presetGallery.innerHTML = html

  presetGallery.querySelectorAll('.preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.preset)
      particleModule?.selectPreset(idx)
      _renderPresetGallery()
      _showParamPanel('particles')
    })
  })

  document.getElementById('upload-model-btn')?.addEventListener('click', () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.glb,.gltf'
    input.addEventListener('change', async () => {
      const file = input.files[0]
      if (!file) return
      if (file.size > 20 * 1024 * 1024) {
        statusDisplay.showError('模型文件不能超过 20MB，请换一个小一点的模型')
        return
      }
      try {
        statusDisplay.showLoading('正在解析模型...')
        await particleModule.uploadModel(file)
        statusDisplay.hideLoading()
        statusDisplay.showToast(`已加载：${file.name}`, 'info', 2000)
        _showParamPanel('particles')
      } catch (e) {
        statusDisplay.hideLoading()
        statusDisplay.showError(e.message)
      }
    })
    input.click()
  })
}

function _renderFilterSelector() {
  filterSelector.classList.remove('hidden')
  const current = filterModule?.currentFilterId || 'vintage-halftone'
  const currentFilter = FILTER_PRESETS.find(f => f.id === current)
  let html = `<button class="filter-arrow selector-arrow" id="filter-prev">◀</button>
    <span class="filter-name selector-name">${currentFilter?.name || ''}</span>
    <button class="filter-arrow selector-arrow" id="filter-next">▶</button>
    <div class="filter-dots selector-dots">`
  FILTER_PRESETS.forEach(f => {
    html += `<span class="filter-dot selector-dot${f.id === current ? ' active' : ''}" data-filter="${f.id}" title="${f.name}"></span>`
  })
  html += `</div>`
  filterSelector.innerHTML = html

  document.getElementById('filter-prev')?.addEventListener('click', () => {
    filterModule?.prevFilter()
    _renderFilterSelector()
    _showParamPanel('filters')
  })
  document.getElementById('filter-next')?.addEventListener('click', () => {
    filterModule?.nextFilter()
    _renderFilterSelector()
    _showParamPanel('filters')
  })
  filterSelector.querySelectorAll('.filter-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      filterModule?.selectFilter(dot.dataset.filter)
      _renderFilterSelector()
      _showParamPanel('filters')
    })
  })
}

function _renderPaintingSelector() {
  paintingSelector.classList.remove('hidden')
  let html = ''
  const currentPainting = paintingModule?.getCurrentPainting()
  PAINTING_PRESETS.forEach((p, i) => {
    html += `<button class="painting-pill selector-chip${!paintingModule?._customPainting && i === (paintingModule?._currentIdx ?? 0) ? ' active' : ''}" data-painting="${i}">${p.title}</button>`
  })
  if (paintingModule?._customPainting) {
    html += `<button class="painting-pill selector-chip active" type="button">${currentPainting.title}</button>`
  }
  html += `<button class="upload-btn selector-action" id="upload-painting-btn">上传图片</button>`
  html += `<button class="fullscreen-btn selector-action" id="fullscreen-btn">全屏</button>`
  paintingSelector.innerHTML = html

  paintingSelector.querySelectorAll('.painting-pill[data-painting]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.painting)
      statusDisplay.showLoading('正在切换画作...')
      await paintingModule?.selectPainting(idx)
      statusDisplay.hideLoading()
      _renderPaintingSelector()
      _showParamPanel('paintings')
    })
  })
  document.getElementById('upload-painting-btn')?.addEventListener('click', () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp'
    input.addEventListener('change', async () => {
      const file = input.files[0]
      if (!file) return
      try {
        statusDisplay.showLoading('正在把图片变成粒子画...')
        await paintingModule?.uploadPainting(file)
        statusDisplay.hideLoading()
        statusDisplay.showToast(`已加载：${file.name}`, 'info', 2000)
        _renderPaintingSelector()
        _showParamPanel('paintings')
      } catch (e) {
        statusDisplay.hideLoading()
        statusDisplay.showError(e.message)
      }
    })
    input.click()
  })

  document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen().catch(() => {})
  })
}

// ── Param Panel ──
function _showParamPanel(moduleId) {
  if (moduleId === 'particles') {
    const params = particleModule?.params || {}
    paramPanel.setModule('particles', {
      pointScale: { label: '粒子大小', min: 0.3, max: 5, step: 0.1, default: 1.6 },
      scatterDist: { label: '散射距离', min: 0.1, max: 3, step: 0.05, default: 1.5 },
      noiseAmp: { label: '噪声幅度', min: 0, max: 1, step: 0.01, default: 0.6 },
      lerpSpeed: { label: '过渡速度', min: 0.5, max: 10, step: 0.1, default: 3.0 },
      rotationSpeed: { label: '旋转速度', min: 0, max: 2, step: 0.01, default: 0.25 },
      opacity: { label: '不透明度', min: 0.1, max: 1, step: 0.01, default: 0.9 },
    }, params, (key, val) => {
      params[key] = val
      particleModule?.setParams(params)
    })
  } else if (moduleId === 'filters') {
    const filter = filterModule?.getCurrentFilter()
    if (!filter) return
    paramPanel.setModule('filters', filter.params, filterModule?.filterParams || {}, (key, val) => {
      if (val === 'randomizeCustomFilter') {
        _randomizeCustomFilter()
        return
      }
      filterModule?.setFilterParam(key, val)
    })
  } else if (moduleId === 'paintings') {
    const params = paintingModule?.params || {}
    paramPanel.setModule('paintings', {
      pointScale: { label: '粒子大小', min: 0.3, max: 5, step: 0.1, default: 1.0 },
      noiseAmp: { label: '浮动幅度', min: 0, max: 1, step: 0.01, default: 0.3 },
      brushLength: { label: '笔触长度', min: 0.3, max: 3, step: 0.05, default: 1.0 },
      domeRadius: { label: '穹顶半径', min: 1, max: 10, step: 0.1, default: 5.0 },
      wrapAngle: { label: '包裹角度', min: 0.5, max: 2, step: 0.05, default: 1.6 },
    }, params, (key, val) => {
      params[key] = val
      paintingModule?.setParams(params)
    })
  }
  paramPanel.show()
}

function _randomizeCustomFilter() {
  if (!filterModule || filterModule.currentFilterId !== 'custom-magic') return
  const colors = ['#ff4fd8', '#40dcff', '#ffe45c', '#7cff6b', '#ff7a3d', '#9b6bff', '#ffffff']
  const patterns = ['waves', 'dots', 'stripes', 'checker', 'stars']
  const modes = ['tint', 'duotone', 'glow', 'poster']
  const pick = (items) => items[Math.floor(Math.random() * items.length)]
  filterModule.setFilterParams({
    intensity: 0.65 + Math.random() * 0.35,
    primaryColor: pick(colors),
    secondaryColor: pick(colors),
    pattern: pick(patterns),
    patternScale: 0.7 + Math.random() * 3.8,
    animationSpeed: 0.4 + Math.random() * 2.8,
    mixMode: pick(modes),
    sparkle: Math.random() * 0.85,
    rainbow: Math.random() > 0.55,
  })
  _showParamPanel('filters')
  statusDisplay.showToast('随机魔法已生成', 'info', 1200)
}

// ── Screenshot ──
function takeScreenshot() {
  const canvas = currentModule === 'filters' ? cameraCanvas : threeCanvas
  const tmp = document.createElement('canvas')
  tmp.width = canvas.width || canvas.clientWidth
  tmp.height = canvas.height || canvas.clientHeight
  const ctx = tmp.getContext('2d')
  ctx.drawImage(canvas, 0, 0)
  const link = document.createElement('a')
  link.download = `gesture-island-${Date.now()}.png`
  link.href = tmp.toDataURL('image/png')
  link.click()
  audioManager?.screenshotSound()
  statusDisplay.showToast('截图已保存', 'info', 1500)
}

function _updateChallengeUI() {
  const bar = document.getElementById('challenge-bar')
  if (!bar) return
  if (challengeMode?.active) {
    bar.classList.remove('hidden')
    document.getElementById('btn-challenge').textContent = '挑战中'
    document.getElementById('btn-challenge').classList.add('on')
  } else {
    bar.classList.add('hidden')
    document.getElementById('challenge-score').textContent = '得分: 0'
    document.getElementById('challenge-combo').textContent = ''
    document.getElementById('challenge-gesture-icon').textContent = ''
    document.getElementById('challenge-gesture-label').textContent = ''
    document.getElementById('challenge-timer').textContent = ''
    document.getElementById('btn-challenge').textContent = '挑战'
    document.getElementById('btn-challenge').classList.remove('on')
  }
}

// ── Events ──
function _bindEvents() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchModule(btn.dataset.module))
  })

  paramToggle.addEventListener('click', () => paramPanel.toggle())

  btnCamera.addEventListener('click', async () => {
    if (cameraActive) await _stopCamera()
    else await _startCamera()
  })

  btnDemo.addEventListener('click', () => toggleDemo())
  btnReset.addEventListener('click', () => reset())
  document.getElementById('btn-screenshot')?.addEventListener('click', () => takeScreenshot())
  document.getElementById('btn-mute')?.addEventListener('click', () => {
    const muted = audioManager?.toggle()
    document.getElementById('btn-mute').textContent = muted ? '静音' : '声音'
  })
  document.getElementById('btn-challenge')?.addEventListener('click', () => {
    if (challengeMode?.active) { challengeMode.stop(); _updateChallengeUI(); return }
    challengeMode?.start('easy')
    challengeMode.onScoreChange((score, combo, maxCombo) => {
      document.getElementById('challenge-score').textContent = `得分: ${score}`
      const comboEl = document.getElementById('challenge-combo')
      comboEl.textContent = combo >= 3 ? `Combo x${combo}!` : ''
    })
    challengeMode.onRoundChange((gesture, label, icon, time) => {
      document.getElementById('challenge-gesture-icon').textContent = icon
      document.getElementById('challenge-gesture-label').textContent = `请做: ${label}`
      document.getElementById('challenge-timer').textContent = `${(time / 1000).toFixed(1)}s`
    })
    _updateChallengeUI()
    statusDisplay.showToast('挑战开始！按手势提示做动作', 'info', 2000)
  })
  document.getElementById('btn-challenge-stop')?.addEventListener('click', () => {
    challengeMode?.stop()
    _updateChallengeUI()
    statusDisplay.showToast('挑战已结束', 'info', 1500)
  })

  smoothSlider.addEventListener('input', () => {
    pipeline?.setSmoothingAlpha(parseFloat(smoothSlider.value))
  })

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const html = document.documentElement
    const current = html.getAttribute('data-theme')
    html.setAttribute('data-theme', current === 'light' ? 'dark' : 'light')
    document.getElementById('theme-toggle').textContent = current === 'light' ? '☀' : '☾'
  })

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
    switch (e.key) {
      case '1': switchModule('particles'); break
      case '2': switchModule('filters'); break
      case '3': switchModule('paintings'); break
      case 'ArrowLeft':
        if (currentModule === 'particles') { particleModule?.prevPreset(); _renderPresetGallery(); _showParamPanel('particles'); audioManager?.presetSwitch() }
        else if (currentModule === 'filters') { filterModule?.prevFilter(); _renderFilterSelector(); _showParamPanel('filters'); audioManager?.filterSwitch() }
        else if (currentModule === 'paintings') { paintingModule?.prevPainting().then(() => { _renderPaintingSelector(); _showParamPanel('paintings'); audioManager?.presetSwitch() }) }
        break
      case 'ArrowRight':
        if (currentModule === 'particles') { particleModule?.nextPreset(); _renderPresetGallery(); _showParamPanel('particles'); audioManager?.presetSwitch() }
        else if (currentModule === 'filters') { filterModule?.nextFilter(); _renderFilterSelector(); _showParamPanel('filters'); audioManager?.filterSwitch() }
        else if (currentModule === 'paintings') { paintingModule?.nextPainting().then(() => { _renderPaintingSelector(); _showParamPanel('paintings'); audioManager?.presetSwitch() }) }
        break
      case 'c': case 'C': if (!e.ctrlKey && !e.metaKey) btnCamera.click(); break
      case '0': if (!e.ctrlKey && !e.metaKey) reset(); break
      case 's': case 'S': if (!e.ctrlKey && !e.metaKey) takeScreenshot(); break
      case 'd': case 'D': if (!e.ctrlKey && !e.metaKey) toggleDemo(); break
      case 'f': case 'F': if (!e.ctrlKey && !e.metaKey) {
        if (document.fullscreenElement) document.exitFullscreen()
        else document.documentElement.requestFullscreen().catch(() => {})
        break
      }
      case 'r': case 'R': if (!e.ctrlKey && !e.metaKey && currentModule === 'filters') _randomizeCustomFilter(); break
      case 'u': case 'U': if (!e.ctrlKey && !e.metaKey && currentModule === 'paintings') document.getElementById('upload-painting-btn')?.click(); break
      case 'm': case 'M': if (!e.ctrlKey && !e.metaKey) { const muted = audioManager?.toggle(); statusDisplay.showToast(muted ? '已静音' : '已开启声音', 'info', 1000) } break
      case '?': {
        if (onboarding) { onboarding._step = 0; onboarding._done = false; onboarding.show() }
        break
      }
      case 'Escape': if (demoActive) toggleDemo(); else if (challengeMode?.active) { challengeMode.stop(); _updateChallengeUI(); statusDisplay.showToast('挑战已结束', 'info', 1500) } break
    }
  })

  window.addEventListener('resize', resizeCanvas)

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (currentModule === 'particles') particleModule?.stop()
      else if (currentModule === 'paintings') paintingModule?.stop()
    } else {
      if (currentModule === 'particles') particleModule?.start()
      else if (currentModule === 'paintings') paintingModule?.start()
    }
  })
}

// ── Bootstrap ──
init().catch(err => {
  console.error('App init error:', err)
  const overlay = document.getElementById('loading-overlay')
  if (overlay) overlay.classList.add('hidden')
  const toast = document.getElementById('status-toast')
  if (toast) {
    toast.textContent = '启动失败：' + (err.message || '未知错误')
    toast.className = 'toast error'
  }
})
