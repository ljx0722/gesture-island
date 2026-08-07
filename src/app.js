// app.js — 粒子交互AI教学 主入口
import { Pipeline } from './core/pipeline.js'
import { ParticleModule } from './modules/particles/particleModule.js'
import { PaintingModule } from './modules/paintings/paintingModule.js'
import { FilterModule } from './modules/filters/filterModule.js'
import { HandwarpModule } from './modules/handwarp/handwarpModule.js'
import { LightTrailsModule } from './modules/lighttrails/lightTrailsModule.js'
import { ShadowPlayModule } from './modules/shadowplay/shadowPlayModule.js'
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
import { GestureAnimator } from './ui/gestureAnimator.js'
import { ProjectStore } from './ui/projectStore.js'
import { flattenSceneSchema } from './core/sceneParamSchema.js'

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
const hintsText = document.getElementById('hints-text')
const gestureDemoLabel = document.getElementById('gesture-demo-label')
const gestureDemoHint = document.getElementById('gesture-demo-hint')
const gestureAnimCanvas = document.getElementById('gesture-anim-canvas')

// State
let currentModule = 'particles'
let sharedRenderer = null
let pipeline = null
let particleModule = null
let filterModule = null
let handwarpModule = null
let lighttrailsModule = null
let shadowplayModule = null
let paintingModule = null
let statusDisplay = null
let paramPanel = null
let audioManager = null
let projectStore = null
let onboarding = null
let challengeMode = null
let cameraActive = false
let demoActive = false
let moduleInitialized = { particles: false, filters: false, paintings: false, handwarp: false, lighttrails: false, shadowplay: false }
let animationId = 0
let lastTime = 0

// ── Init ──
async function init() {
  statusDisplay = new StatusDisplay()
  paramPanel = new ParamPanel()
  audioManager = new AudioManager()
  projectStore = new ProjectStore()
  onboarding = new Onboarding()
  challengeMode = new ChallengeMode()
  challengeMode.setAudio(audioManager)

  // Bind events FIRST — before any module loading can fail
  _bindEvents()
  _setupMouseGestures()
  _setupHandPreviewDrag()

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
    particleModule?.setGestureOpenness(1.0)
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
  _updateHints('particles')
  _startGestureDemo()
  _showParamPanel('particles')
  const soundTheme = document.getElementById('sound-theme')
  if (soundTheme) soundTheme.value = audioManager.getTheme()
  const muteButton = document.getElementById('btn-mute')
  if (muteButton) muteButton.textContent = audioManager.isMuted() ? '静音' : '声音'
  _renderProjectList()
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
  _renderModuleControls('particles')
  // Don't auto-show param panel on first load — user opens it manually
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

function _initHandwarpModule() {
  if (handwarpModule) return
  handwarpModule = new HandwarpModule(cameraCanvas, videoEl)
  handwarpModule.init()
  moduleInitialized.handwarp = true
}

function _initLighttrailsModule() {
  if (lighttrailsModule) return
  lighttrailsModule = new LightTrailsModule(cameraCanvas, videoEl)
  lighttrailsModule.init()
  moduleInitialized.lighttrails = true
}

function _initShadowplayModule() {
  if (shadowplayModule) return
  shadowplayModule = new ShadowPlayModule(cameraCanvas, videoEl)
  shadowplayModule.init()
  moduleInitialized.shadowplay = true
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

    // Demo mode rendering
    if (currentModule === 'filters' && filterModule && demoActive && !cameraActive) {
      filterModule.renderDemo(dt)
    }
    if (currentModule === 'handwarp' && handwarpModule && demoActive && !cameraActive) {
      handwarpModule.renderDemo(dt)
    }
    if (currentModule === 'lighttrails' && lighttrailsModule && demoActive && !cameraActive) {
      lighttrailsModule.renderDemo(dt)
    }
    if (currentModule === 'shadowplay' && shadowplayModule && demoActive && !cameraActive) {
      shadowplayModule.renderDemo(dt)
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
    if (gesture !== 'none') audioManager?.gestureDetected(gesture)
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
    if (currentModule === 'handwarp' && handwarpModule && !demoActive) {
      handwarpModule.render(frameData, 0.016)
    }
    if (currentModule === 'lighttrails' && lighttrailsModule && !demoActive) {
      lighttrailsModule.render(frameData, 0.016)
    }
    if (currentModule === 'shadowplay' && shadowplayModule && !demoActive) {
      shadowplayModule.render(frameData, 0.016)
    }
    _renderHandPreview(frameData)
  })
}

// ── Hand preview drag ──
function _setupHandPreviewDrag() {
  const panel = handPreview
  if (!panel) return
  const title = panel.querySelector('.overlay-panel__title')
  if (!title) return

  let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0

  title.addEventListener('pointerdown', (e) => {
    dragging = true; title.setPointerCapture(e.pointerId)
    const rect = panel.getBoundingClientRect()
    startX = e.clientX; startY = e.clientY
    origLeft = rect.left; origTop = rect.top
    panel.style.transition = 'none'
  })
  title.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const dx = e.clientX - startX, dy = e.clientY - startY
    panel.style.left = (origLeft + dx) + 'px'
    panel.style.top = (origTop + dy) + 'px'
    panel.style.right = 'auto'; panel.style.bottom = 'auto'
  })
  title.addEventListener('pointerup', () => {
    dragging = false; panel.style.transition = ''
  })
  title.addEventListener('pointercancel', () => {
    dragging = false; panel.style.transition = ''
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
  if (currentModule === 'filters') { filterModule?.dispose(); moduleInitialized.filters = false }
  if (currentModule === 'handwarp') { handwarpModule?.dispose(); moduleInitialized.handwarp = false }
  if (currentModule === 'lighttrails') { lighttrailsModule?.dispose(); moduleInitialized.lighttrails = false }
  if (currentModule === 'shadowplay') { shadowplayModule?.dispose(); moduleInitialized.shadowplay = false }

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
      _renderModuleControls('particles')
      _showParamPanel('particles')
      _updateHints('particles')
      statusDisplay.setStatus('就绪')
    } else if (moduleId === 'filters') {
      cameraCanvas.classList.remove('hidden')
      if (!moduleInitialized.filters) {
        statusDisplay.showLoading('正在加载人物分割模型...')
        await _initFilterModule()
        statusDisplay.hideLoading()
      }
      _renderModuleControls('filters')
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
      _renderModuleControls('paintings')
      _showParamPanel('paintings')
      statusDisplay.setStatus('就绪')
    } else if (moduleId === 'handwarp') {
      cameraCanvas.classList.remove('hidden')
      _initHandwarpModule()
      _renderModuleControls('handwarp')
      _showParamPanel('handwarp')
      statusDisplay.setStatus('就绪')
    } else if (moduleId === 'lighttrails') {
      cameraCanvas.classList.remove('hidden')
      _initLighttrailsModule()
      _renderModuleControls('lighttrails')
      _showParamPanel('lighttrails')
      statusDisplay.setStatus('就绪')
    } else if (moduleId === 'shadowplay') {
      cameraCanvas.classList.remove('hidden')
      pipeline.setNeedsMask(true)
      _initShadowplayModule()
      _renderModuleControls('shadowplay')
      _showParamPanel('shadowplay')
      statusDisplay.setStatus('就绪')
    }
    audioManager?.moduleSwitch(moduleId)
    _updateHints(moduleId)
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

    // Only init mask when on filters or shadowplay tab
    if (currentModule === 'filters' || currentModule === 'shadowplay') {
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
    } else if (currentModule === 'handwarp' && handwarpModule) {
      statusDisplay.setHandStatus(2, '演示')
    } else if (currentModule === 'lighttrails' && lighttrailsModule) {
      statusDisplay.setHandStatus(2, '演示')
    } else if (currentModule === 'shadowplay' && shadowplayModule) {
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
  } else if (currentModule === 'handwarp' && handwarpModule) {
    handwarpModule.reset()
    _showParamPanel('handwarp')
  } else if (currentModule === 'lighttrails' && lighttrailsModule) {
    lighttrailsModule.reset()
    _showParamPanel('lighttrails')
  } else if (currentModule === 'shadowplay' && shadowplayModule) {
    shadowplayModule.reset()
    _showParamPanel('shadowplay')
  }
}

// ── UI Rendering ──
function _renderModuleControls(moduleId) {
  const renderers = {
    particles: _renderPresetGallery, filters: _renderFilterSelector, paintings: _renderPaintingSelector,
    handwarp: _renderWarpSelector, lighttrails: _renderLighttrailsSelector, shadowplay: _renderShadowplaySelector,
  }
  renderers[moduleId]?.()
}

function _renderPresetGallery() {
  presetGallery.classList.remove('hidden')
  const idx = particleModule?.currentPresetIdx ?? 0
  const current = PRESETS[idx]
  let html = `<button class="selector-arrow" id="preset-prev">◀</button>
    <span class="selector-name">${current?.name || ''}</span>
    <button class="selector-arrow" id="preset-next">▶</button>
    <div class="selector-dots">`
  PRESETS.forEach((p, i) => {
    html += `<span class="selector-dot${i === idx ? ' active' : ''}" data-preset="${i}" title="${p.name}"></span>`
  })
  html += `</div>
    <button class="selector-action selector-action-upload" id="upload-model-btn">上传模型</button>`
  presetGallery.innerHTML = html

  document.getElementById('preset-prev')?.addEventListener('click', () => {
    particleModule?.prevPreset()
    _renderPresetGallery()
    _showParamPanel('particles')
    audioManager?.presetSwitch()
  })
  document.getElementById('preset-next')?.addEventListener('click', () => {
    particleModule?.nextPreset()
    _renderPresetGallery()
    _showParamPanel('particles')
    audioManager?.presetSwitch()
  })
  presetGallery.querySelectorAll('.selector-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      particleModule?.selectPreset(parseInt(dot.dataset.preset))
      _renderPresetGallery()
      _showParamPanel('particles')
      audioManager?.presetSwitch()
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
  let html = `<button class="selector-arrow" id="filter-prev">◀</button>
    <span class="selector-name">${currentFilter?.name || ''}</span>
    <button class="selector-arrow" id="filter-next">▶</button>
    <div class="selector-dots">`
  FILTER_PRESETS.forEach(f => {
    html += `<span class="selector-dot${f.id === current ? ' active' : ''}" data-filter="${f.id}" title="${f.name}"></span>`
  })
  html += `</div>`
  filterSelector.innerHTML = html

  document.getElementById('filter-prev')?.addEventListener('click', () => {
    filterModule?.prevFilter()
    _renderFilterSelector()
    _showParamPanel('filters')
    audioManager?.filterSwitch()
  })
  document.getElementById('filter-next')?.addEventListener('click', () => {
    filterModule?.nextFilter()
    _renderFilterSelector()
    _showParamPanel('filters')
    audioManager?.filterSwitch()
  })
  filterSelector.querySelectorAll('.selector-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      filterModule?.selectFilter(dot.dataset.filter)
      _renderFilterSelector()
      _showParamPanel('filters')
      audioManager?.filterSwitch()
    })
  })
}

function _renderPaintingSelector() {
  paintingSelector.classList.remove('hidden')
  const current = paintingModule?.getCurrentPainting()
  const idx = paintingModule?._currentIdx ?? 0
  let html = `<button class="selector-arrow" id="painting-prev">◀</button>
    <span class="selector-name">${current?.title || ''}</span>
    <button class="selector-arrow" id="painting-next">▶</button>
    <div class="selector-dots">`
  PAINTING_PRESETS.forEach((p, i) => {
    const isActive = !paintingModule?._customPainting && i === idx
    html += `<span class="selector-dot${isActive ? ' active' : ''}" data-painting="${i}" title="${p.title}"></span>`
  })
  if (paintingModule?._customPainting) {
    html += `<span class="selector-dot active" title="${current.title}"></span>`
  }
  html += `</div>
    <button class="selector-action selector-action-upload" id="upload-painting-btn">上传图片</button>
    <button class="selector-action" id="fullscreen-btn">全屏</button>`
  paintingSelector.innerHTML = html

  document.getElementById('painting-prev')?.addEventListener('click', async () => {
    statusDisplay.showLoading('正在切换画作...')
    await paintingModule?.prevPainting()
    statusDisplay.hideLoading()
    _renderPaintingSelector()
    _showParamPanel('paintings')
    audioManager?.presetSwitch()
  })
  document.getElementById('painting-next')?.addEventListener('click', async () => {
    statusDisplay.showLoading('正在切换画作...')
    await paintingModule?.nextPainting()
    statusDisplay.hideLoading()
    _renderPaintingSelector()
    _showParamPanel('paintings')
    audioManager?.presetSwitch()
  })
  paintingSelector.querySelectorAll('.selector-dot[data-painting]').forEach(dot => {
    dot.addEventListener('click', async () => {
      const i = parseInt(dot.dataset.painting)
      statusDisplay.showLoading('正在切换画作...')
      await paintingModule?.selectPainting(i)
      statusDisplay.hideLoading()
      _renderPaintingSelector()
      _showParamPanel('paintings')
      audioManager?.presetSwitch()
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

function _renderWarpSelector() {
  const warpSelector = document.getElementById('warp-selector')
  if (!warpSelector) return
  warpSelector.classList.remove('hidden')
  const worlds = handwarpModule?.getAllWorlds() || []
  const current = handwarpModule?.getCurrentWorld()
  const idx = worlds.findIndex(w => w.id === current?.id)
  let html = '<button class="selector-arrow" id="warp-prev">◀</button>'
  html += `<span class="selector-name">${current?.name || ''}</span>`
  html += '<button class="selector-arrow" id="warp-next">▶</button>'
  html += '<div class="selector-dots">'
  worlds.forEach((w, i) => { html += `<span class="selector-dot${i === idx ? ' active' : ''}" data-warp="${i}" title="${w.name}"></span>` })
  html += '</div>'
  warpSelector.innerHTML = html

  document.getElementById('warp-prev')?.addEventListener('click', () => {
    handwarpModule?.prevWorld(); _renderWarpSelector(); audioManager?.presetSwitch()
  })
  document.getElementById('warp-next')?.addEventListener('click', () => {
    handwarpModule?.nextWorld(); _renderWarpSelector(); audioManager?.presetSwitch()
  })
  warpSelector.querySelectorAll('.selector-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      handwarpModule?.selectWorld(parseInt(dot.dataset.warp)); _renderWarpSelector()
      audioManager?.presetSwitch()
    })
  })
}

function _renderLighttrailsSelector() {
  const gallery = document.getElementById('trail-selector')
  if (!gallery) return
  gallery.classList.remove('hidden')
  const presets = lighttrailsModule?.getAllPresets() || []
  const current = lighttrailsModule?.getCurrentPreset()
  const idx = presets.findIndex(p => p.id === current?.id)
  let html = '<button class="selector-arrow" id="trail-prev">◀</button>'
  html += `<span class="selector-name">${current?.name || ''}</span>`
  html += '<button class="selector-arrow" id="trail-next">▶</button>'
  html += '<div class="selector-dots">'
  presets.forEach((p, i) => { html += `<span class="selector-dot${i === idx ? ' active' : ''}" data-trail="${i}" title="${p.name}"></span>` })
  html += '</div>'
  gallery.innerHTML = html
  document.getElementById('trail-prev')?.addEventListener('click', () => { lighttrailsModule?.prevPreset(); _renderLighttrailsSelector(); audioManager?.presetSwitch() })
  document.getElementById('trail-next')?.addEventListener('click', () => { lighttrailsModule?.nextPreset(); _renderLighttrailsSelector(); audioManager?.presetSwitch() })
  gallery.querySelectorAll('.selector-dot').forEach(dot => { dot.addEventListener('click', () => { lighttrailsModule?.selectPreset(parseInt(dot.dataset.trail)); _renderLighttrailsSelector(); audioManager?.presetSwitch() }) })
}

function _renderShadowplaySelector() {
  const gallery = document.getElementById('shadow-selector')
  if (!gallery) return
  gallery.classList.remove('hidden')
  const worlds = shadowplayModule?.getAllWorlds() || []
  const current = shadowplayModule?.getCurrentWorld()
  const idx = worlds.findIndex(w => w.id === current?.id)
  let html = '<button class="selector-arrow" id="shadow-prev">◀</button>'
  html += `<span class="selector-name">${current?.name || ''}</span>`
  html += '<button class="selector-arrow" id="shadow-next">▶</button>'
  html += '<div class="selector-dots">'
  worlds.forEach((w, i) => { html += `<span class="selector-dot${i === idx ? ' active' : ''}" data-shadow="${i}" title="${w.name}"></span>` })
  html += '</div>'
  gallery.innerHTML = html
  document.getElementById('shadow-prev')?.addEventListener('click', () => { shadowplayModule?.prevWorld(); _renderShadowplaySelector(); audioManager?.presetSwitch() })
  document.getElementById('shadow-next')?.addEventListener('click', () => { shadowplayModule?.nextWorld(); _renderShadowplaySelector(); audioManager?.presetSwitch() })
  gallery.querySelectorAll('.selector-dot').forEach(dot => { dot.addEventListener('click', () => { shadowplayModule?.selectWorld(parseInt(dot.dataset.shadow)); _renderShadowplaySelector(); audioManager?.presetSwitch() }) })
}

// ── Param Panel ──
function _showParamPanel(moduleId) {
  if (moduleId === 'particles') {
    paramPanel.setModule('particles', flattenSceneSchema('particles'), particleModule?.params || {}, (key, val) => {
      if (particleModule?.params) particleModule.params[key] = val
      particleModule?.setParams({ [key]: val })
    })
  } else if (moduleId === 'filters') {
    const filter = filterModule?.getCurrentFilter()
    if (!filter) return
    const commonFilterParams = {
      gestureSensitivity: { label: '手势灵敏度', min: 0.5, max: 1.5, step: 0.05, default: 1 },
      backgroundMix: { label: '背景融合', min: 0, max: 1, step: 0.05, default: 0 },
      edgeStrength: { label: '边缘效果', min: 0, max: 1, step: 0.05, default: 0.2 },
      animationSpeed: { label: '动画速度', min: 0, max: 3, step: 0.05, default: 1 },
    }
    paramPanel.setModule('filters', { ...commonFilterParams, ...filter.params }, filterModule?.filterParams || {}, (key, val) => {
      if (val === 'randomizeCustomFilter') {
        _randomizeCustomFilter()
        return
      }
      filterModule?.setFilterParam(key, val)
    })
  } else if (moduleId === 'paintings') {
    paramPanel.setModule('paintings', flattenSceneSchema('paintings'), paintingModule?.params || {}, async (key, val) => {
      if (paintingModule?.params) paintingModule.params[key] = val
      if (key === 'sampleDensity') await paintingModule?.setSampleDensity(val)
      else paintingModule?.setParams({ [key]: val })
    })
  } else if (moduleId === 'handwarp') {
    paramPanel.setModule('handwarp', flattenSceneSchema('handwarp'), handwarpModule?.params || {}, (key, val) => {
      if (handwarpModule?.params) handwarpModule.params[key] = val
      handwarpModule?.setParams({ [key]: val })
    })
  } else if (moduleId === 'lighttrails') {
    paramPanel.setModule('lighttrails', flattenSceneSchema('lighttrails'), lighttrailsModule?.params || {}, (key, val) => {
      if (lighttrailsModule?.params) lighttrailsModule.params[key] = val
      lighttrailsModule?.setParams({ [key]: val })
    })
  } else if (moduleId === 'shadowplay') {
    paramPanel.setModule('shadowplay', flattenSceneSchema('shadowplay'), shadowplayModule?.params || {}, (key, val) => {
      if (shadowplayModule?.params) shadowplayModule.params[key] = val
      shadowplayModule?.setParams({ [key]: val })
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

function _captureProjectState() {
  const state = {
    module: currentModule,
    audio: { theme: audioManager?.getTheme?.() || 'none', muted: audioManager?.isMuted?.() || false },
  }
  if (currentModule === 'particles' && particleModule) {
    state.scene = { module: 'particles', theme: ['星空', '自然', '几何', '幻想'][particleModule.currentPresetIdx % 4], presetIndex: particleModule.currentPresetIdx, params: { ...particleModule.params } }
  } else if (currentModule === 'filters' && filterModule) {
    state.scene = { module: 'filters', filterId: filterModule.currentFilterId, params: { ...filterModule.filterParams }, common: { gestureSensitivity: filterModule.filterParams.gestureSensitivity ?? 1, backgroundMix: filterModule.filterParams.backgroundMix ?? 0, edgeStrength: filterModule.filterParams.edgeStrength ?? 0.2 } }
  } else if (currentModule === 'paintings' && paintingModule) {
    state.scene = { module: 'paintings', paintingIndex: paintingModule._currentIdx, params: { ...paintingModule.params }, customTitle: paintingModule._customPainting?.title || '' }
  } else if (currentModule === 'handwarp' && handwarpModule) {
    state.scene = { module: 'handwarp', worldIdx: handwarpModule._worldIdx, params: { ...handwarpModule.params } }
  } else if (currentModule === 'lighttrails' && lighttrailsModule) {
    state.scene = { module: 'lighttrails', presetIdx: lighttrailsModule._presetIdx, params: { ...lighttrailsModule.params } }
  } else if (currentModule === 'shadowplay' && shadowplayModule) {
    state.scene = { module: 'shadowplay', worldIdx: shadowplayModule._worldIdx, params: { ...shadowplayModule.params } }
  }
  return state
}

function _saveProject() {
  const titleInput = document.getElementById('project-title')
  const noteInput = document.getElementById('project-note')
  const title = titleInput?.value.trim() || '我的手势作品'
  const project = projectStore.save({
    id: window._currentProjectId,
    title,
    note: noteInput?.value.trim() || '',
    ..._captureProjectState(),
  })
  window._currentProjectId = project.id
  titleInput.value = project.title
  _renderProjectList()
  audioManager?.saveSound()
  statusDisplay.showToast(`已保存《${project.title}》`, 'info', 1800)
}

function _restoreProject(project) {
  if (!project?.scene) return
  const scene = project.scene
  if (scene.module !== currentModule) {
    switchModule(scene.module).then(() => _restoreProject(project))
    return
  }
  if (scene.module === 'particles' && particleModule) {
    particleModule.selectPreset(scene.presetIndex || 0)
    particleModule.setParams(scene.params || {})
    _renderModuleControls('particles'); _showParamPanel('particles')
  } else if (scene.module === 'filters' && filterModule) {
    filterModule.selectFilter(scene.filterId || 'vintage-halftone')
    filterModule.setFilterParams(scene.params || {})
    _renderModuleControls('filters'); _showParamPanel('filters')
  } else if (scene.module === 'paintings' && paintingModule) {
    paintingModule.selectPainting(scene.paintingIndex || 0).then(() => {
      paintingModule.setParams(scene.params || {})
      _renderModuleControls('paintings'); _showParamPanel('paintings')
    })
  } else if (scene.module === 'handwarp' && handwarpModule) {
    handwarpModule.selectWorld(scene.worldIdx ?? 0)
    handwarpModule.setParams(scene.params || {})
    _renderWarpSelector(); _showParamPanel('handwarp')
  } else if (scene.module === 'lighttrails' && lighttrailsModule) {
    lighttrailsModule.selectPreset(scene.presetIdx ?? 0)
    lighttrailsModule.setParams(scene.params || {})
    _renderLighttrailsSelector(); _showParamPanel('lighttrails')
  } else if (scene.module === 'shadowplay' && shadowplayModule) {
    shadowplayModule.selectWorld(scene.worldIdx ?? 0)
    shadowplayModule.setParams(scene.params || {})
    _renderShadowplaySelector(); _showParamPanel('shadowplay')
  }
  window._currentProjectId = project.id
  document.getElementById('project-title').value = project.title || ''
  document.getElementById('project-note').value = project.note || ''
  audioManager?.setTheme(project.audio?.theme || 'none')
  statusDisplay.showToast(`已打开《${project.title}》`, 'info', 1500)
}

function _renderProjectList() {
  const list = document.getElementById('project-list')
  if (!list || !projectStore) return
  const projects = projectStore.list()
  const LABELS = { particles: '粒子魔法', filters: '魔法滤镜', paintings: '我的画展', handwarp: '手撕现实', lighttrails: '光之轨迹', shadowplay: '暗影剧场' }
  const moduleLabel = project => LABELS[project.module] || project.module || '未知模块'
  list.innerHTML = projects.length ? projects.map(project => `<button class="project-item" data-project-id="${project.id}"><strong>${_escapeHtml(project.title)}</strong><small>${_escapeHtml(moduleLabel(project))}</small></button>`).join('') : '<div class="project-empty">还没有作品，先创造一个吧</div>'
  list.querySelectorAll('.project-item').forEach(item => item.addEventListener('click', () => _restoreProject(projectStore.get(item.dataset.projectId))))
}

function _escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

function _createVariation() {
  const current = window._currentProjectId ? projectStore?.get(window._currentProjectId) : null
  if (!current) {
    statusDisplay.showToast('请先保存一个作品，再生成变奏', 'warning', 1500)
    return
  }
  const scene = JSON.parse(JSON.stringify(current.scene || {}))
  const params = scene.params || {}
  const vary = (key, amount, min, max) => {
    if (typeof params[key] !== 'number') return
    params[key] = Math.max(min, Math.min(max, params[key] + (Math.random() * 2 - 1) * amount))
  }
  if (scene.module === 'particles') {
    const colors = ['#6c8cff', '#ff6cb5', '#65e6c5', '#ffd166', '#c084fc', '#ff8a5c']
    params.color = colors[Math.floor(Math.random() * colors.length)]
    vary('scatterDist', 0.45, 0.1, 3)
    vary('noiseAmp', 0.2, 0, 1)
    vary('rotationSpeed', 0.2, 0, 2)
    vary('flowSpeed', 0.3, 0.2, 2)
    vary('glow', 0.25, 0, 1)
    vary('colorSpread', 0.2, 0, 1)
    vary('gestureSensitivity', 0.2, 0.5, 1.5)
    vary('burstStrength', 0.25, 0, 1)
    vary('repelStrength', 0.25, 0, 1)
    vary('cameraZoom', 0.2, 0, 1)
  } else if (scene.module === 'paintings') {
    const colors = ['#0a0a1a', '#172554', '#3b1d5a', '#123d3d', '#422006']
    params.bgColor = colors[Math.floor(Math.random() * colors.length)]
    vary('noiseAmp', 0.2, 0, 1)
    vary('wrapAngle', 0.2, 0.5, 2)
    vary('brightness', 0.2, 0.5, 1.8)
    vary('contrast', 0.2, 0.5, 2)
    vary('saturation', 0.2, 0, 1.5)
    vary('colorTemperature', 0.25, -1, 1)
    vary('noiseSpeed', 0.5, 0, 3)
    vary('brushRoundness', 0.25, 0, 1)
    vary('yawSensitivity', 0.2, 0.2, 1.5)
    vary('pinchZoom', 0.2, 0, 1)
  }
  const variation = projectStore.save({ ...current, id: null, title: `${current.title} · 变奏`, scene, audio: { ...current.audio } })
  _restoreProject(variation)
  _renderProjectList()
  audioManager?.saveSound()
  statusDisplay.showToast('已生成新的变奏版本，原作品保持不变', 'info', 1800)
}
function _toggleProjectPanel() {
  const panel = document.getElementById('project-panel')
  if (!panel) return
  panel.classList.toggle('hidden')
  if (!panel.classList.contains('hidden')) _renderProjectList()
}

function _inspire() {
  const colors = ['#6c8cff', '#ff6cb5', '#65e6c5', '#ffd166', '#c084fc', '#ff8a5c']
  const color = colors[Math.floor(Math.random() * colors.length)]
  if (currentModule === 'particles' && particleModule) {
    particleModule.setParams({
      color, scatterDist: 0.8 + Math.random() * 2.2, noiseAmp: Math.random() * 0.9,
      rotationSpeed: Math.max(0, (Math.random() - 0.2) * 0.8),
      flowSpeed: 0.3 + Math.random() * 1.7, noiseScale: 4 + Math.floor(Math.random() * 20),
      glow: Math.random(), colorSpread: Math.random() * 0.6,
      gestureSensitivity: 0.5 + Math.random(), burstStrength: Math.random(),
      repelStrength: Math.random(), cameraZoom: 0.2 + Math.random() * 0.8,
      autoRotate: Math.random() > 0.3,
    })
    _showParamPanel('particles')
  } else if (currentModule === 'paintings' && paintingModule) {
    paintingModule.setParams({
      bgColor: color, noiseAmp: Math.random() * 0.8, wrapAngle: 0.8 + Math.random() * 1.2,
      brightness: 0.6 + Math.random() * 1.2, contrast: 0.5 + Math.random() * 1.5,
      saturation: 0.2 + Math.random() * 1.3, colorTemperature: (Math.random() - 0.5) * 2,
      noiseSpeed: 0.1 + Math.random() * 2.9, noiseScale: 4 + Math.floor(Math.random() * 20),
      brushRoundness: Math.random(), yawSensitivity: 0.2 + Math.random() * 1.3,
      pinchZoom: Math.random(), autoRotate: Math.random() > 0.5,
      autoRotateSpeed: Math.random() * 0.5,
    })
    _showParamPanel('paintings')
  } else if (currentModule === 'filters' && filterModule) {
    _randomizeCustomFilter()
  }
  const themes = ['dream', 'space', 'forest', 'magic']
  const theme = themes[Math.floor(Math.random() * themes.length)]
  const themeSelect = document.getElementById('sound-theme')
  if (themeSelect) themeSelect.value = theme
  audioManager?.setTheme(theme)
  statusDisplay.showToast('灵感变奏完成：试试看这个版本', 'info', 1600)
}

function takeScreenshot() {
  const canvas = currentModule === 'filters' ? cameraCanvas : threeCanvas
  const tmp = document.createElement('canvas')
  tmp.width = canvas.width || canvas.clientWidth
  tmp.height = canvas.height || canvas.clientHeight
  const ctx = tmp.getContext('2d')
  ctx.drawImage(canvas, 0, 0)
  const link = document.createElement('a')
  link.download = `${document.getElementById('project-title')?.value.trim() || '我的手势作品'}.png`
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

// ── Gesture Demo Animation (Canvas skeleton morphing) ──
let gestureAnimator = null

function _startGestureDemo() {
  if (!gestureAnimCanvas) return
  gestureAnimator = new GestureAnimator(gestureAnimCanvas)
  gestureAnimator.onLabelChange((label, hint) => {
    if (gestureDemoLabel) gestureDemoLabel.textContent = label
    if (gestureDemoHint) {
      gestureDemoHint.textContent = hint
      gestureDemoHint.style.opacity = '1'
      setTimeout(() => { if (gestureDemoHint) gestureDemoHint.style.opacity = '0.6' }, 2000)
    }
  })
  gestureAnimator.start()
}
function _updateHints(moduleId) {
  if (!hintsText) return
  const map = {
    particles: '挥手扰动粒子 | ←→ 切换样式 | D 演示 | C 摄像头 | S 截图 | M 静音 | ? 指南',
    filters: '双手入镜成滤镜区 单手全屏 | ←→ 切换滤镜 | R 随机魔法 | D 演示 | C 摄像头 | S 截图',
    paintings: '移动手旋转画面 | ←→ 切换画作 | U 上传图片 | D 演示 | S 截图 | F 全屏',
    handwarp: '手撕画面 | ←→ 切换效果 | D 演示 | C 摄像头 | S 截图 | 捏合撕裂',
    lighttrails: '指尖画光痕 | ←→ 切换画笔 | D 演示 | C 摄像头 | S 截图',
    shadowplay: '身体是窗口 | ←→ 切换世界 | D 演示 | C 摄像头 | S 截图',
  }
  hintsText.textContent = map[moduleId] || map.particles
}

// ── Events ──
function _bindEvents() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchModule(btn.dataset.module))
  })

  paramToggle.addEventListener('click', () => {
    if (paramPanel.el.classList.contains('hidden')) {
      _showParamPanel(currentModule)
    } else {
      paramPanel.hide()
    }
  })

  btnCamera.addEventListener('click', async () => {
    audioManager?.activate()
    if (cameraActive) await _stopCamera()
    else await _startCamera()
  })

  btnDemo.addEventListener('click', () => toggleDemo())
  btnReset.addEventListener('click', () => reset())
  document.getElementById('btn-screenshot')?.addEventListener('click', () => takeScreenshot())
  document.getElementById('project-toggle')?.addEventListener('click', () => _toggleProjectPanel())
  document.getElementById('project-save')?.addEventListener('click', () => _saveProject())
  document.getElementById('project-variation')?.addEventListener('click', () => _createVariation())
  document.getElementById('btn-inspire')?.addEventListener('click', () => _inspire())
  document.getElementById('sound-theme')?.addEventListener('change', (e) => {
    audioManager?.activate()
    audioManager?.setTheme(e.target.value)
  })
  document.getElementById('btn-mute')?.addEventListener('click', () => {
    audioManager?.activate()
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
      case '4': switchModule('handwarp'); break
      case '5': switchModule('lighttrails'); break
      case '6': switchModule('shadowplay'); break
      case 'ArrowLeft':
        if (currentModule === 'particles') { particleModule?.prevPreset(); _renderModuleControls('particles'); _showParamPanel('particles'); audioManager?.presetSwitch() }
        else if (currentModule === 'filters') { filterModule?.prevFilter(); _renderModuleControls('filters'); _showParamPanel('filters'); audioManager?.filterSwitch() }
        else if (currentModule === 'paintings') { paintingModule?.prevPainting().then(() => { _renderModuleControls('paintings'); _showParamPanel('paintings'); audioManager?.presetSwitch() }) }
        else if (currentModule === 'handwarp') { handwarpModule?.prevWorld(); _renderWarpSelector(); audioManager?.presetSwitch() }
        else if (currentModule === 'lighttrails') { lighttrailsModule?.prevPreset(); _renderLighttrailsSelector(); audioManager?.presetSwitch() }
        else if (currentModule === 'shadowplay') { shadowplayModule?.prevWorld(); _renderShadowplaySelector(); audioManager?.presetSwitch() }
        break
      case 'ArrowRight':
        if (currentModule === 'particles') { particleModule?.nextPreset(); _renderModuleControls('particles'); _showParamPanel('particles'); audioManager?.presetSwitch() }
        else if (currentModule === 'filters') { filterModule?.nextFilter(); _renderModuleControls('filters'); _showParamPanel('filters'); audioManager?.filterSwitch() }
        else if (currentModule === 'paintings') { paintingModule?.nextPainting().then(() => { _renderModuleControls('paintings'); _showParamPanel('paintings'); audioManager?.presetSwitch() }) }
        else if (currentModule === 'handwarp') { handwarpModule?.nextWorld(); _renderWarpSelector(); audioManager?.presetSwitch() }
        else if (currentModule === 'lighttrails') { lighttrailsModule?.nextPreset(); _renderLighttrailsSelector(); audioManager?.presetSwitch() }
        else if (currentModule === 'shadowplay') { shadowplayModule?.nextWorld(); _renderShadowplaySelector(); audioManager?.presetSwitch() }
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
      case 'm': case 'M': if (!e.ctrlKey && !e.metaKey) { audioManager?.activate(); const muted = audioManager?.toggle(); document.getElementById('btn-mute').textContent = muted ? '静音' : '声音'; statusDisplay.showToast(muted ? '已静音' : '已开启声音', 'info', 1000) } break
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
      if (pipeline) pipeline.stopLoop()
    } else {
      if (currentModule === 'particles') particleModule?.start()
      else if (currentModule === 'paintings') paintingModule?.start()
      if (pipeline && cameraActive) pipeline.startLoop()
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
