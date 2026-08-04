// app.js — 粒子交互AI教学 主入口
// 三模块 Tab 切换 + 共享 Pipeline + 全局 UI 生命周期

import { Pipeline } from './core/pipeline.js'
import { ParticleModule } from './modules/particles/particleModule.js'
import { PaintingModule } from './modules/paintings/paintingModule.js'
import { FilterModule } from './modules/filters/filterModule.js'
import { StatusDisplay } from './ui/status.js'
import { ParamPanel } from './ui/paramPanel.js'
import { PRESETS } from './modules/particles/particlePresets.js'
import { PAINTING_PRESETS } from './modules/paintings/paintingPresets.js'
import { FILTER_PRESETS } from './modules/filters/filterPresets.js'

// ── DOM refs ──
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
const barLeft = document.getElementById('bar-left')

// ── State ──
let currentModule = 'particles' // 'particles' | 'filters' | 'paintings'
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

  // Pipe video element to pipeline
  pipeline = new Pipeline({ videoElement: videoEl, smoothingAlpha: parseFloat(smoothSlider.value) })

  // Init particle module immediately (default tab)
  threeCanvas.width = container.clientWidth
  threeCanvas.height = container.clientHeight
  particleModule = new ParticleModule(container, threeCanvas)
  await particleModule.init()
  particleModule.start()
  moduleInitialized.particles = true
  _renderPresetGallery()
  _showParamPanel('particles')

  // Start render loop for module①
  _startRenderLoop()

  // Bind UI events
  _bindEvents()
}

// ── Render Loop ──
function _startRenderLoop() {
  const loop = (now) => {
    animationId = requestAnimationFrame(loop)
    const dt = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now
    statusDisplay.updateFPS()

    if (currentModule === 'filters' && filterModule && demoActive && !cameraActive) {
      filterModule.renderDemo(dt)
    }
  }
  lastTime = performance.now()
  animationId = requestAnimationFrame(loop)
}

// ── Module Switching ──
async function switchModule(moduleId) {
  if (currentModule === moduleId) return

  // Hide all canvases
  threeCanvas.classList.add('hidden')
  cameraCanvas.classList.add('hidden')

  // Hide all module UIs
  document.querySelectorAll('.module-ui').forEach(el => el.classList.add('hidden'))

  currentModule = moduleId
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.module === moduleId))

  if (moduleId === 'particles') {
    threeCanvas.classList.remove('hidden')
    if (!moduleInitialized.particles) {
      particleModule = new ParticleModule(container, threeCanvas)
      await particleModule.init()
      moduleInitialized.particles = true
    }
    particleModule.start()
    if (filterModule) filterModule.stop?.()
    if (paintingModule) paintingModule.stop()
    _renderPresetGallery()
    _showParamPanel('particles')
    // Stop camera pipeline if running
    if (pipeline && cameraActive) {
      pipeline.stopLoop()
      pipeline.stopCamera()
      cameraActive = false
      btnCamera.textContent = '启动摄像头'
      btnCamera.classList.remove('on')
    }
    if (demoActive) {
      demoActive = false
      btnDemo.classList.remove('on')
      particleModule.setDemoMode(false)
      particleModule.setGestureOpenness(0)
    }
  }

  else if (moduleId === 'filters') {
    cameraCanvas.classList.remove('hidden')
    cameraCanvas.width = container.clientWidth
    cameraCanvas.height = container.clientHeight

    if (!moduleInitialized.filters) {
      statusDisplay.showLoading('正在加载人物分割模型...')
      try {
        filterModule = new FilterModule(cameraCanvas, videoEl)
        await filterModule.init({
          onProgress: ({ stage, progress, text }) => {
            statusDisplay.setLoadingProgress(stage, progress, text)
          },
        })
        moduleInitialized.filters = true
        statusDisplay.hideLoading()
      } catch (e) {
        statusDisplay.hideLoading()
        statusDisplay.showError(`模块加载失败：${e.message}`)
        return
      }
    }

    if (particleModule) particleModule.stop()
    if (paintingModule) paintingModule.stop()
    _renderFilterSelector()
    _showParamPanel('filters')

    // Start camera and pipeline
    await _startCamera()
  }

  else if (moduleId === 'paintings') {
    threeCanvas.classList.remove('hidden')
    threeCanvas.width = container.clientWidth
    threeCanvas.height = container.clientHeight

    if (!moduleInitialized.paintings) {
      statusDisplay.showLoading('正在加载画作...')
      try {
        paintingModule = new PaintingModule(container, threeCanvas)
        await paintingModule.init()
        paintingModule.start()
        moduleInitialized.paintings = true
        statusDisplay.hideLoading()
      } catch (e) {
        statusDisplay.hideLoading()
        statusDisplay.showError(`画作加载失败：${e.message}`)
        return
      }
    } else {
      paintingModule.start()
    }

    if (particleModule) particleModule.stop()
    if (filterModule) filterModule.stop?.()
    _renderPaintingSelector()
    _showParamPanel('paintings')

    if (pipeline && cameraActive) {
      pipeline.stopLoop()
      pipeline.stopCamera()
      cameraActive = false
      btnCamera.textContent = '启动摄像头'
      btnCamera.classList.remove('on')
    }
    if (demoActive) {
      demoActive = false
      btnDemo.classList.remove('on')
      paintingModule.setDemoMode(false)
    }
  }
}

// ── Camera ──
async function _startCamera() {
  if (cameraActive) return
  try {
    statusDisplay.showLoading('正在启动摄像头...')
    await pipeline.initHandTracker({
      onProgress: ({ stage, progress, text }) => {
        statusDisplay.setLoadingProgress(stage, progress, text)
      },
    })
    pipeline.setNeedsMask(true)

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
    pipeline.startLoop()

    // Subscribe pipeline to filter module
    pipeline.subscribe((frameData) => {
      statusDisplay.setHandStatus(frameData.handCount)
      if (currentModule === 'filters' && filterModule && !demoActive) {
        filterModule.render(frameData, 0.016)
      }
    })

    statusDisplay.hideLoading()
    statusDisplay.showToast('摄像头已启动，请将双手放入画面', 'info', 2000)
  } catch (e) {
    statusDisplay.hideLoading()
    statusDisplay.showError(e.message)
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
    } else if (currentModule === 'paintings' && paintingModule) {
      paintingModule.setDemoMode(true)
    } else if (currentModule === 'filters' && filterModule) {
      filterModule.demoMode = true
      statusDisplay.setHandStatus(2)
    }
  } else {
    btnDemo.classList.remove('on')
    if (currentModule === 'particles' && particleModule) {
      particleModule.setDemoMode(false)
      particleModule.setGestureOpenness(0)
    } else if (currentModule === 'paintings' && paintingModule) {
      paintingModule.setDemoMode(false)
    } else if (currentModule === 'filters' && filterModule) {
      filterModule.demoMode = false
      statusDisplay.setHandStatus(cameraActive ? 0 : 0)
    }
  }
}

// ── Reset ──
function reset() {
  if (currentModule === 'particles' && particleModule) {
    particleModule.reset()
  } else if (currentModule === 'paintings' && paintingModule) {
    paintingModule.reset()
  } else if (currentModule === 'filters' && filterModule) {
    filterModule.resetFilterParams()
    _showParamPanel('filters')
  }
  statusDisplay.reset()
}

// ── UI Rendering ──
function _renderPresetGallery() {
  presetGallery.classList.remove('hidden')
  let html = ''
  PRESETS.forEach((p, i) => {
    html += `<button class="preset-chip${i === (particleModule?.currentPresetIdx ?? 0) ? ' active' : ''}" data-preset="${i}">${p.name}</button>`
  })
  html += `<button class="upload-btn" id="upload-model-btn">📁 上传模型</button>`
  presetGallery.innerHTML = html

  // Bind preset clicks
  presetGallery.querySelectorAll('.preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.preset)
      particleModule.selectPreset(idx)
      _renderPresetGallery()
      _showParamPanel('particles')
    })
  })

  // Upload button
  const uploadBtn = document.getElementById('upload-model-btn')
  uploadBtn?.addEventListener('click', () => {
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

  let html = `
    <button class="filter-arrow" id="filter-prev">◀</button>
    <span class="filter-name">${currentFilter?.name || ''}</span>
    <button class="filter-arrow" id="filter-next">▶</button>
    <div class="filter-dots">`
  FILTER_PRESETS.forEach((f, i) => {
    html += `<span class="filter-dot${f.id === current ? ' active' : ''}" data-filter="${f.id}" title="${f.name}"></span>`
  })
  html += `</div>`
  filterSelector.innerHTML = html

  document.getElementById('filter-prev')?.addEventListener('click', () => {
    const f = filterModule.prevFilter()
    _renderFilterSelector()
    _showParamPanel('filters')
  })
  document.getElementById('filter-next')?.addEventListener('click', () => {
    const f = filterModule.nextFilter()
    _renderFilterSelector()
    _showParamPanel('filters')
  })
  filterSelector.querySelectorAll('.filter-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      filterModule.selectFilter(dot.dataset.filter)
      _renderFilterSelector()
      _showParamPanel('filters')
    })
  })
}

function _renderPaintingSelector() {
  paintingSelector.classList.remove('hidden')
  let html = ''
  PAINTING_PRESETS.forEach((p, i) => {
    html += `<button class="painting-pill${i === (paintingModule?._currentIdx ?? 0) ? ' active' : ''}" data-painting="${i}">${p.title}</button>`
  })
  html += `<button class="fullscreen-btn" id="fullscreen-btn">⛶ 全屏</button>`
  paintingSelector.innerHTML = html

  paintingSelector.querySelectorAll('.painting-pill').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.painting)
      statusDisplay.showLoading('正在切换画作...')
      await paintingModule.selectPainting(idx)
      statusDisplay.hideLoading()
      _renderPaintingSelector()
      _showParamPanel('paintings')
    })
  })

  document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
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
  }

  else if (moduleId === 'filters') {
    const filter = filterModule?.getCurrentFilter()
    if (!filter) return
    const currentParams = filterModule?.filterParams || {}
    paramPanel.setModule('filters', filter.params, currentParams, (key, val) => {
      filterModule?.setFilterParam(key, val)
    })
  }

  else if (moduleId === 'paintings') {
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

// ── Events ──
function _bindEvents() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchModule(btn.dataset.module))
  })

  paramToggle.addEventListener('click', () => paramPanel.toggle())

  btnCamera.addEventListener('click', async () => {
    if (cameraActive) {
      await _stopCamera()
    } else {
      await _startCamera()
    }
  })

  btnDemo.addEventListener('click', toggleDemo)
  btnReset.addEventListener('click', reset)

  smoothSlider.addEventListener('input', () => {
    const val = parseFloat(smoothSlider.value)
    pipeline?.setSmoothingAlpha(val)
  })

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
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
      case 'Escape': if (demoActive) toggleDemo(); break
    }
  })

  // Handle resize
  window.addEventListener('resize', () => {
    const w = container.clientWidth
    const h = container.clientHeight
    if (threeCanvas) { threeCanvas.width = w; threeCanvas.height = h }
    if (cameraCanvas) { cameraCanvas.width = w; cameraCanvas.height = h }
  })

  // Visibility change: pause/resume
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
  document.getElementById('loading-overlay')?.classList.add('hidden')
  const toast = document.getElementById('status-toast')
  toast.textContent = `启动失败：${err.message}`
  toast.className = 'toast error'
})
