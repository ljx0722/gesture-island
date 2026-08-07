// mediapipeBootstrap.js — shared MediaPipe loader for handTracker + maskSegmenter
let FilesetResolver = null
let HandLandmarker = null
let ImageSegmenter = null
let _promise = null

function importWithTimeout(url, timeoutMs = 8000) {
  return Promise.race([
    import(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`MediaPipe import timed out after ${timeoutMs}ms`)), timeoutMs)),
  ])
}

export function preloadMediaPipe() {
  if (!_promise) {
    _promise = (async () => {
      if (FilesetResolver) return { FilesetResolver, HandLandmarker, ImageSegmenter }
      try {
        const m = await importWithTimeout('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm', 10000)
        FilesetResolver = m.FilesetResolver
        HandLandmarker = m.HandLandmarker
        ImageSegmenter = m.ImageSegmenter
      } catch (e) {
        console.warn('MediaPipe primary CDN failed:', e.message || e, '— trying fallback')
        try {
          const m = await importWithTimeout('https://unpkg.com/@mediapipe/tasks-vision@0.10.18/dist/vision_bundle.mjs', 10000)
          FilesetResolver = m.FilesetResolver
          HandLandmarker = m.HandLandmarker
          ImageSegmenter = m.ImageSegmenter
        } catch (e2) {
          console.error('MediaPipe fallback CDN also failed:', e2.message || e2)
        }
      }
      return { FilesetResolver, HandLandmarker, ImageSegmenter }
    })()
  }
  return _promise
}

export async function getMediaPipeModules() {
  if (FilesetResolver && HandLandmarker && ImageSegmenter) {
    return { FilesetResolver, HandLandmarker, ImageSegmenter }
  }
  await preloadMediaPipe()
  if (!FilesetResolver || !HandLandmarker) {
    throw new Error('无法加载手势识别引擎，请检查网络连接后刷新页面重试')
  }
  return { FilesetResolver, HandLandmarker, ImageSegmenter }
}
