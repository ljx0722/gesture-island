// canvas.js — Canvas 2D 工具
export function createOffscreenCanvas(width, height, willRead = false) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function getContext(canvas, willRead = false) {
  return canvas.getContext('2d', { willReadFrequently: willRead })
}

export function getImageDataScaled(sourceCanvas, targetWidth, targetHeight) {
  const off = createOffscreenCanvas(targetWidth, targetHeight)
  const ctx = getContext(off)
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight)
  return ctx.getImageData(0, 0, targetWidth, targetHeight)
}

export function drawMirrored(ctx, video, canvasWidth, canvasHeight) {
  ctx.save()
  ctx.translate(canvasWidth, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight)
  ctx.restore()
}

export function fitCover(videoWidth, videoHeight, containerWidth, containerHeight) {
  const videoRatio = videoWidth / videoHeight
  const containerRatio = containerWidth / containerHeight
  let drawWidth, drawHeight, offsetX, offsetY

  if (videoRatio > containerRatio) {
    drawHeight = containerHeight
    drawWidth = drawHeight * videoRatio
    offsetX = (containerWidth - drawWidth) / 2
    offsetY = 0
  } else {
    drawWidth = containerWidth
    drawHeight = drawWidth / videoRatio
    offsetX = 0
    offsetY = (containerHeight - drawHeight) / 2
  }

  return { drawWidth, drawHeight, offsetX, offsetY }
}
