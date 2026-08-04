// maskSegmenter.js — MediaPipe Selfie Segmentation
let ImageSegmenter = null
let FilesetResolver = null

export async function createMaskSegmenter(options = {}) {
  const {
    modelPath = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
    onProgress = null,
  } = options

  if (!FilesetResolver) {
    try {
      onProgress?.({ stage: 'mask', progress: 0.2, text: '正在加载分割模型库...' })
      const visionModule = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm')
      FilesetResolver = visionModule.FilesetResolver
      ImageSegmenter = visionModule.ImageSegmenter
    } catch {
      try {
        const visionModule = await import('https://unpkg.com/@mediapipe/tasks-vision@0.10.18/dist/vision_bundle.mjs')
        FilesetResolver = visionModule.FilesetResolver
        ImageSegmenter = visionModule.ImageSegmenter
      } catch (e2) {
        throw new Error(`分割模型加载失败：${e2.message}`)
      }
    }
  }

  onProgress?.({ stage: 'mask', progress: 0.5, text: '正在初始化人物分割引擎...' })
  // Reuse same WASM path as hand tracker
  const vision = await FilesetResolver.forVisionTasks('/mediapipe')

  onProgress?.({ stage: 'mask', progress: 0.8, text: '正在加载分割模型权重...' })
  let segmenter
  try {
    segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    })
  } catch {
    console.warn('GPU delegate failed for segmentation, falling back to CPU')
    segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    })
  }

  onProgress?.({ stage: 'mask', progress: 1.0, text: '人物分割模型加载完成' })

  return {
    segment(video, timestamp) {
      const result = segmenter.segmentForVideo(video, timestamp)
      if (!result.confidenceMasks || result.confidenceMasks.length === 0) return null
      const mask = result.confidenceMasks[0]
      return {
        width: mask.width,
        height: mask.height,
        data: mask.getAsFloat32Array(),
      }
    },

    close() {
      segmenter?.close()
      segmenter = null
    },
  }
}
