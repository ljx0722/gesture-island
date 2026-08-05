// handTracker.js — MediaPipe HandLandmarker 封装 (shared bootstrap)
import { handFeatures } from './handFeatures.js'
import { preloadMediaPipe, getMediaPipeModules } from './mediapipeBootstrap.js'

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

export function preloadHandTracker() {
  return preloadMediaPipe().catch(() => {})
}

export { PALM_INDICES }

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

  onProgress?.({ stage: 'hand', progress: 0.2, text: '正在加载MediaPipe WASM...' })
  const { FilesetResolver, HandLandmarker } = await getMediaPipeModules()

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
  try { landmarker = await create('GPU') }
  catch { console.warn('GPU delegate failed, falling back to CPU'); landmarker = await create('CPU') }

  onProgress?.({ stage: 'hand', progress: 1.0, text: '手势识别模型加载完成' })

  let identityTracker = null

  function buildDetection(landmarks, handedness, timestamp) {
    const points = landmarks.map(l => ({ x: 1 - l.x, y: l.y, z: l.z }))
    const palmCenter = average(PALM_INDICES.map(j => points[j]))
    const label = handedness?.[0]
    const hand = {
      id: '',
      handedness: normalizeHandedness(label?.categoryName),
      confidence: label?.score ?? 0,
      landmarks: points,
      palmCenter,
      pinchPoint: average([points[4], points[8]]),
      openness: 0,
    }
    hand.openness = handFeatures(hand).openness
    return hand
  }

  return {
    setIdentityTracker(tracker) { identityTracker = tracker },
    detect(video, timestamp) {
      const result = landmarker.detectForVideo(video, timestamp)
      const detections = result.landmarks.map((landmarks, i) =>
        buildDetection(landmarks, result.handedness[i], timestamp))
      const hands = identityTracker
        ? identityTracker.assign(detections, timestamp)
        : detections.map((h, i) => ({ ...h, id: `camera-hand-${i + 1}` }))
      return { timestamp, hands }
    },
    close() { landmarker?.close(); landmarker = null },
  }
}
