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

// State
let currentModule = 'particles'
let pipeline = null
let particleModule = null
let filterModule = null
let paintingModule = null
let statusDisplay = null
let paramPanel = null
let cameraActive = false
let demoActive = false
let moduleInitialized = { particles: false, filters: false, paintings: false }
let animationId = 0
let lastTime = 0

// ── Init ──
async function init() {
  statusDisplay = new StatusDisplay()
  paramPanel = new ParamPanel()

  // Bind events FIRST — before any module loading can fail
  _bindEvents()
  _setupMouseGestures()

  // Create pipeline
  pipeline = new Pipeline({ videoElement: videoEl, smoothingAlpha: parseFloat(smoothSlider.value) })

  // Init particle module (default tab)
  try {
    resizeCanvas()
    _initParticlesModule()
  } catch (e) {
    console.error('Particle module init error:', e)
    statusDisplay.showError('粒子模块加载失败: ' + e.message)
  }

  // Start render loop
  _startRenderLoop()
}

function resizeCanvas() {
  const w = container.clientWidth
  const h = container.clientHeight
  if (w > 0 && h > 0) {
    threeCanvas.width = w
    threeCanvas.height = h
    cameraCanvas.width = w
    cameraCanvas.height = h
  }
}

async function _initParticlesModule() {
  particleModule = new ParticleModule(container, threeCanvas)
  await particleModule.init()
  particleModule.start()
  moduleInitialized.particles = true
  _renderPresetGallery()
  _showParamPanel('particles')
}

async function _initPaintingsModule() {
  paintingModule = new PaintingModule(container, threeCanvas)
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
  })
}

// ── Module Switching ──
async function switchModule(moduleId) {
  if (currentModule === moduleId) return

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
    html += `<button class="preset-chip${i === (particleModule?.currentPresetIdx ?? 0) ? ' active' : ''}" data-preset="${i}">${p.name}</button>`
  })
  html += `<button class="upload-btn" id="upload-model-btn">上传模型</button>`
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
  let html = `<button class="filter-arrow" id="filter-prev">◀</button>
    <span class="filter-name">${currentFilter?.name || ''}</span>
    <button class="filter-arrow" id="filter-next">▶</button>
    <div class="filter-dots">`
  FILTER_PRESETS.forEach(f => {
    html += `<span class="filter-dot${f.id === current ? ' active' : ''}" data-filter="${f.id}" title="${f.name}"></span>`
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
    html += `<button class="painting-pill${!paintingModule?._customPainting && i === (paintingModule?._currentIdx ?? 0) ? ' active' : ''}" data-painting="${i}">${p.title}</button>`
  })
  if (paintingModule?._customPainting) {
    html += `<button class="painting-pill active" type="button">${currentPainting.title}</button>`
  }
  html += `<button class="upload-btn" id="upload-painting-btn">上传图片</button>`
  html += `<button class="fullscreen-btn" id="fullscreen-btn">全屏</button>`
  paintingSelector.innerHTML = html

  paintingSelector.querySelectorAll('.painting-pill').forEach(btn => {
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

  smoothSlider.addEventListener('input', () => {
    pipeline?.setSmoothingAlpha(parseFloat(smoothSlider.value))
  })

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return
    switch (e.key) {
      case '1': switchModule('particles'); break
      case '2': switchModule('filters'); break
      case '3': switchModule('paintings'); break
      case 'd': case 'D': if (!e.ctrlKey && !e.metaKey) toggleDemo(); break
      case 'f': case 'F': if (!e.ctrlKey && !e.metaKey) {
        if (document.fullscreenElement) document.exitFullscreen()
        else document.documentElement.requestFullscreen().catch(() => {})
        break
      }
      case 'r': case 'R': if (!e.ctrlKey && !e.metaKey && currentModule === 'filters') _randomizeCustomFilter(); break
      case 'u': case 'U': if (!e.ctrlKey && !e.metaKey && currentModule === 'paintings') document.getElementById('upload-painting-btn')?.click(); break
      case 'Escape': if (demoActive) toggleDemo(); break
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
