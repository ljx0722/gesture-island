// handTracker.js — MediaPipe HandLandmarker 封装
let HandLandmarker = null
let FilesetResolver = null
let instance = null

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]

const PALM_INDICES = [0, 5, 9, 13, 17]

function average(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), { x: 0, y: 0, z: 0 })
  const n = points.length
  return { x: sum.x / n, y: sum.y / n, z: sum.z / n }
}

function normalizeHandedness(label) {
  const v = label?.trim().toLowerCase()
  return (v === 'left' || v === 'right') ? v : 'unknown'
}

export { HAND_CONNECTIONS, PALM_INDICES }

export async function createHandTracker(options = {}) {
  const {
    numHands = 2,
    minDetectionConfidence = 0.55,
    minPresenceConfidence = 0.5,
    minTrackingConfidence = 0.5,
    modelPath = '/mediapipe/hand_landmarker.task',
    wasmPath = '/mediapipe',
    onProgress = null,
  } = options

  // Dynamic import from CDN if not already loaded
  if (!FilesetResolver) {
    try {
      onProgress?.({ stage: 'hand', progress: 0.2, text: '正在加载MediaPipe WASM...' })
      const visionModule = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm')
      FilesetResolver = visionModule.FilesetResolver
      HandLandmarker = visionModule.HandLandmarker
    } catch (e) {
      // Try unpkg fallback
      try {
        const visionModule = await import('https://unpkg.com/@mediapipe/tasks-vision@0.10.18/dist/vision_bundle.mjs')
        FilesetResolver = visionModule.FilesetResolver
        HandLandmarker = visionModule.HandLandmarker
      } catch (e2) {
        throw new Error(`手势模型加载失败：无法从CDN加载MediaPipe库。请检查网络连接后重试。(${e.message})`)
      }
    }
  }

  onProgress?.({ stage: 'hand', progress: 0.5, text: '正在初始化手势识别引擎...' })
  const vision = await FilesetResolver.forVisionTasks(wasmPath)

  const create = (delegate) =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelPath, delegate },
      runningMode: 'VIDEO',
      numHands,
      minHandDetectionConfidence: minDetectionConfidence,
      minHandPresenceConfidence: minPresenceConfidence,
      minTrackingConfidence,
    })

  onProgress?.({ stage: 'hand', progress: 0.8, text: '正在加载手势模型权重...' })
  let landmarker
  try {
    landmarker = await create('GPU')
  } catch {
    console.warn('GPU delegate failed, falling back to CPU')
    landmarker = await create('CPU')
  }

  onProgress?.({ stage: 'hand', progress: 1.0, text: '手势识别模型加载完成' })

  let running = false
  let animId = 0
  let lastDetectMs = 0
  const targetIntervalMs = 1000 / 30
  let identityTracker = null

  return {
    setIdentityTracker(tracker) { identityTracker = tracker },

    start(video) {
      running = true
      const tick = () => {
        if (!running) return
        const now = performance.now()
        if (video.readyState >= 2 && now - lastDetectMs >= targetIntervalMs) {
          lastDetectMs = now
          try {
            const result = landmarker.detectForVideo(video, now)
            const detections = result.landmarks.map((landmarks, i) => {
              const points = landmarks.map(l => ({ x: 1 - l.x, y: l.y, z: l.z }))
              const palmCenter = average(PALM_INDICES.map(j => points[j]))
              const label = result.handedness[i]?.[0]
              const hand = {
                id: '',
                handedness: normalizeHandedness(label?.categoryName),
                confidence: label?.score ?? 0,
                landmarks: points,
                palmCenter,
                pinchPoint: average([points[4], points[8]]),
                openness: 0,
              }
              // Simple openness heuristic
              const tips = [4, 8, 12, 16, 20]
              const bases = [2, 5, 9, 13, 17]
              const extended = tips.map((t, j) => {
                const tipDist = Math.hypot(points[t].x - points[0].x, points[t].y - points[0].y)
                const baseDist = Math.hypot(points[bases[j]].x - points[0].x, points[bases[j]].y - points[0].y)
                return tipDist > baseDist
              })
              hand.openness = extended.filter(Boolean).length / extended.length
              return hand
            })
            const hands = identityTracker ? identityTracker.assign(detections, now) : detections.map((h, i) => ({ ...h, id: `hand-${i}` }))
            return { timestamp: now, hands }
          } catch {}
        }
        animId = requestAnimationFrame(tick)
        return null
      }
      animId = requestAnimationFrame(tick)
    },

    stop() {
      running = false
      cancelAnimationFrame(animId)
    },

    detect(video, timestamp) {
      const result = landmarker.detectForVideo(video, timestamp)
      const detections = result.landmarks.map((landmarks, i) => {
        const points = landmarks.map(l => ({ x: 1 - l.x, y: l.y, z: l.z }))
        const palmCenter = average(PALM_INDICES.map(j => points[j]))
        const label = result.handedness[i]?.[0]
        const tips = [4, 8, 12, 16, 20]
        const bases = [2, 5, 9, 13, 17]
        const extended = tips.map((t, j) => {
          const tipD = Math.hypot(points[t].x - points[0].x, points[t].y - points[0].y)
          const baseD = Math.hypot(points[bases[j]].x - points[0].x, points[bases[j]].y - points[0].y)
          return tipD > baseD
        })
        const hand = {
          id: '',
          handedness: normalizeHandedness(label?.categoryName),
          confidence: label?.score ?? 0,
          landmarks: points,
          palmCenter,
          pinchPoint: average([points[4], points[8]]),
          openness: extended.filter(Boolean).length / extended.length,
        }
        return hand
      })
      const hands = identityTracker ? identityTracker.assign(detections, timestamp) : detections.map((h, i) => ({ ...h, id: `hand-${i}` }))
      return { timestamp, hands }
    },

    close() {
      landmarker?.close()
      landmarker = null
    },
  }
}
