// patchRenderer.js — 三块动态四边形生成 + Canvas 2D 裁剪渲染
export class PatchRenderer {
  constructor(options = {}) {
    this.edgeBlurRadius = options.edgeBlurRadius ?? 2.5
    this.edgeOpacity = options.edgeOpacity ?? 0.12
    this.patchGap = options.patchGap ?? 0
  }

  /**
   * Generate three quads between left and right hand finger pairs
   * Returns: [
   *   { id: 'red',   vertices: [{x,y},{x,y},{x,y},{x,y}] },
   *   { id: 'blue',  vertices: [...] },
   *   { id: 'green', vertices: [...] },
   * ]
   */
  generateQuads(leftHand, rightHand, canvasWidth, canvasHeight) {
    const L = leftHand.landmarks
    const R = rightHand.landmarks

    // Map normalized coords (0-1) to canvas pixels
    const toPixel = (pt) => ({
      x: pt.x * canvasWidth,
      y: pt.y * canvasHeight,
    })

    const patches = []

    // Finger pair definitions: [fingerIdx, prevFingerIdx, nextFingerIdx, id]
    const pairs = [
      { idx: 4, prev: -1, next: 8, id: 'red' },    // Thumb
      { idx: 8, prev: 4, next: 12, id: 'blue' },    // Index
      { idx: 12, prev: 8, next: 16, id: 'green' },  // Middle
    ]

    for (const pair of pairs) {
      const i = pair.idx

      // Upper edge
      let upperLeft, upperRight
      if (pair.prev === -1) {
        // Thumb: extend upward from fingertip toward wrist direction
        const dirL = { x: L[4].x - L[0].x, y: L[4].y - L[0].y }
        const dirR = { x: R[4].x - R[0].x, y: R[4].y - R[0].y }
        const dist = 0.05 // offset in normalized coords
        upperLeft = { x: L[4].x + dirL.x * 2 * dist, y: L[4].y + dirL.y * 2 * dist }
        upperRight = { x: R[4].x + dirR.x * 2 * dist, y: R[4].y + dirR.y * 2 * dist }
      } else {
        upperLeft = { x: (L[i].x + L[pair.prev].x) / 2, y: (L[i].y + L[pair.prev].y) / 2 }
        upperRight = { x: (R[i].x + R[pair.prev].x) / 2, y: (R[i].y + R[pair.prev].y) / 2 }
      }

      // Lower edge
      let lowerLeft, lowerRight
      if (pair.next === 16) {
        // Middle finger: extend toward ring finger
        lowerLeft = { x: (L[i].x + L[16].x) / 2, y: (L[i].y + L[16].y) / 2 }
        lowerRight = { x: (R[i].x + R[16].x) / 2, y: (R[i].y + R[16].y) / 2 }
      } else {
        lowerLeft = { x: (L[i].x + L[pair.next].x) / 2, y: (L[i].y + L[pair.next].y) / 2 }
        lowerRight = { x: (R[i].x + R[pair.next].x) / 2, y: (R[i].y + R[pair.next].y) / 2 }
      }

      patches.push({
        id: pair.id,
        vertices: [
          toPixel(upperLeft),
          toPixel(upperRight),
          toPixel(lowerRight),
          toPixel(lowerLeft),
        ],
      })
    }

    return patches
  }

  /**
   * Clip and draw a single patch region on the display canvas
   */
  drawPatchClip(ctx, vertices) {
    if (vertices.length < 3) return
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y)
    }
    ctx.closePath()
    ctx.clip()
  }

  /**
   * Draw soft white edge outline for a patch
   */
  drawPatchEdge(ctx, vertices) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y)
    }
    ctx.closePath()
    ctx.strokeStyle = `rgba(255,255,255,${this.edgeOpacity})`
    ctx.lineWidth = this.edgeBlurRadius
    ctx.shadowColor = 'rgba(255,255,255,0.15)'
    ctx.shadowBlur = 4
    ctx.stroke()
    ctx.restore()
  }

  /**
   * Check if a quad has reasonable area (not degenerate)
   */
  isDegenerate(vertices) {
    if (vertices.length < 3) return true
    // Shoelace formula for area
    let area = 0
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length
      area += vertices[i].x * vertices[j].y
      area -= vertices[j].x * vertices[i].y
    }
    area = Math.abs(area) / 2
    return area < 100 // Less than 100px² is degenerate
  }
}
