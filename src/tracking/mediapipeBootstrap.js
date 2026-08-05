// mediapipeBootstrap.js — shared MediaPipe loader for handTracker + maskSegmenter
let FilesetResolver = null
let HandLandmarker = null
let ImageSegmenter = null
let _promise = null

export function preloadMediaPipe() {
  if (!_promise) {
    _promise = (async () => {
      if (FilesetResolver) return { FilesetResolver, HandLandmarker, ImageSegmenter }
      try {
        const m = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm')
        FilesetResolver = m.FilesetResolver
        HandLandmarker = m.HandLandmarker
        ImageSegmenter = m.ImageSegmenter
      } catch {
        try {
          const m = await import('https://unpkg.com/@mediapipe/tasks-vision@0.10.18/dist/vision_bundle.mjs')
          FilesetResolver = m.FilesetResolver
          HandLandmarker = m.HandLandmarker
          ImageSegmenter = m.ImageSegmenter
        } catch {
          // Silently fail — callers will retry
        }
      }
      return { FilesetResolver, HandLandmarker, ImageSegmenter }
    })()
  }
  return _promise
}

export async function getMediaPipeModules() {
  // If preload already succeeded, return cached
  if (FilesetResolver && HandLandmarker && ImageSegmenter) {
    return { FilesetResolver, HandLandmarker, ImageSegmenter }
  }
  // Wait for preload or load now
  await preloadMediaPipe()
  if (!FilesetResolver || !HandLandmarker) {
    // Fallback inline load
    try {
      const m = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm')
      FilesetResolver = m.FilesetResolver
      HandLandmarker = m.HandLandmarker
      ImageSegmenter = m.ImageSegmenter
    } catch {
      try {
        const m = await import('https://unpkg.com/@mediapipe/tasks-vision@0.10.18/dist/vision_bundle.mjs')
        FilesetResolver = m.FilesetResolver
        HandLandmarker = m.HandLandmarker
        ImageSegmenter = m.ImageSegmenter
      } catch (e2) {
        throw new Error(`手势模型加载失败：无法从CDN加载MediaPipe库。请检查网络连接后重试。`)
      }
    }
  }
  return { FilesetResolver, HandLandmarker, ImageSegmenter }
}
