// maskSegmenter.js — MediaPipe Selfie Segmentation (shared bootstrap)
import { getMediaPipeModules } from './mediapipeBootstrap.js'

export async function createMaskSegmenter(options = {}) {
  const {
    modelPath = '/mediapipe/selfie_segmenter.tflite',
    fallbackModelPath = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
    onProgress = null,
  } = options

  onProgress?.({ stage: 'mask', progress: 0.2, text: '正在加载分割模型库...' })
  const { FilesetResolver, ImageSegmenter } = await getMediaPipeModules()

  onProgress?.({ stage: 'mask', progress: 0.5, text: '正在初始化人物分割引擎...' })
  const vision = await FilesetResolver.forVisionTasks('/mediapipe')

  onProgress?.({ stage: 'mask', progress: 0.8, text: '正在加载分割模型权重...' })
  let segmenter
  const tryCreate = async (path, delegate) => {
    return await ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: path, delegate },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    })
  }

  const delegates = ['GPU', 'CPU']
  for (const delegate of delegates) {
    try { segmenter = await tryCreate(modelPath, delegate); break }
    catch (e1) {
      if (fallbackModelPath) {
        try { segmenter = await tryCreate(fallbackModelPath, delegate); break }
        catch (e2) { console.warn(`Mask segmenter ${delegate} delegate failed for both paths:`, e2.message || e2) }
      } else {
        console.warn(`Mask segmenter ${delegate} delegate failed:`, e1.message || e1)
      }
    }
  }
  if (!segmenter) {
    throw new Error('人物分割模型加载失败，请在网络良好的环境下重试')
  }

  onProgress?.({ stage: 'mask', progress: 1.0, text: '人物分割模型加载完成' })

  return {
    segment(video, timestamp) {
      const result = segmenter.segmentForVideo(video, timestamp)
      if (!result.confidenceMasks || result.confidenceMasks.length === 0) return null
      const mask = result.confidenceMasks[0]
      return { width: mask.width, height: mask.height, data: mask.getAsFloat32Array() }
    },
    close() { segmenter?.close(); segmenter = null },
  }
}
