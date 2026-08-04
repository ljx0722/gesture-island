// paintingParticles.js — 油画笔触粒子系统 + 2D↔3D 穹顶过渡 Shader
import * as THREE from 'three'

const PAINTING_VERTEX_SHADER = /* glsl */ `
  attribute float aBrightness;
  attribute float aStrokeAngle;
  attribute float aEdgeStrength;
  attribute vec3 aFlatPos;
  attribute vec3 aDomePos;
  attribute vec3 aColor;

  uniform float uProgress;
  uniform float uTime;
  uniform float uNoiseAmp;
  uniform float uPointScale;
  uniform float uDomeMode; // 0=hemisphere, 1=cylinder, 2=sphere
  uniform float uBrushLength;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vStrokeAngle;
  varying float vAlpha;

  void main() {
    // Interpolate between flat painting and dome positions
    vec3 pos = mix(aFlatPos, aDomePos, uProgress);

    // Add floating noise (stronger in dome mode)
    float noiseScale = 0.008 + uProgress * 0.03;
    vec3 noise = vec3(
      sin(aFlatPos.y * 12.0 + uTime) * cos(aFlatPos.z * 12.0 + uTime * 0.7),
      cos(aFlatPos.x * 12.0 + uTime * 0.8) * sin(aFlatPos.z * 12.0 + uTime * 0.6),
      sin(aFlatPos.x * 12.0 + uTime * 0.5) * cos(aFlatPos.y * 12.0 + uTime * 0.9)
    ) * uNoiseAmp * noiseScale;
    pos += noise;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Particle size: larger for bright particles (thick paint) and dome mode
    float size = (1.2 + aBrightness * 2.8 + aEdgeStrength * 1.5) * uPointScale;
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 10.0);

    vColor = aColor;
    vBrightness = aBrightness;
    vStrokeAngle = aStrokeAngle;
    vAlpha = 0.85 + uProgress * 0.1;
  }
`

const PAINTING_FRAGMENT_SHADER = /* glsl */ `
  uniform float uBrushLength;
  uniform float uTime;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vStrokeAngle;
  varying float vAlpha;

  void main() {
    // Rotate point coord by stroke angle to create elongated brush strokes
    vec2 centered = gl_PointCoord - 0.5;
    float cosA = cos(-vStrokeAngle + uTime * 0.05);
    float sinA = sin(-vStrokeAngle + uTime * 0.05);
    vec2 rotated = vec2(
      centered.x * cosA - centered.y * sinA,
      centered.x * sinA + centered.y * cosA
    );

    // Elliptical distance: stretched along stroke direction
    float aspect = 0.5 + uBrushLength * 1.5;
    float dist = length(rotated * vec2(aspect, 1.0)) * 2.0;
    float alpha = 1.0 - smoothstep(0.2, 1.0, dist);
    alpha *= alpha; // sharper core

    // Color variation: slight brightness jitter simulates uneven paint
    float jitter = 0.9 + vBrightness * 0.2;
    vec3 color = vColor * jitter;

    // Bright center highlight
    color += vec3(0.08, 0.06, 0.02) * (1.0 - dist) * vBrightness;

    alpha *= vAlpha;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(color, alpha);
  }
`

export class PaintingParticles {
  constructor(sampledData, options = {}) {
    this.sampledData = sampledData
    this.paintingWidth = options.paintingWidth ?? 4.0
    this.domeRadius = options.domeRadius ?? 5.0
    this.wrapAngle = options.wrapAngle ?? 1.6
    this.domeMode = options.domeMode ?? 0 // 0=hemisphere, 1=cylinder, 2=sphere
    this.pointScale = options.pointScale ?? 1.0
    this.noiseAmp = options.noiseAmp ?? 0.3
    this.brushLength = options.brushLength ?? 1.0

    this.points = null
    this.material = null
    this._buildParticles()
  }

  _buildParticles() {
    const { particles, imageWidth, imageHeight } = this.sampledData
    const count = particles.length
    const aspect = imageWidth / Math.max(1, imageHeight)
    const paintingHeight = this.paintingWidth / aspect

    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const brightnesses = new Float32Array(count)
    const strokeAngles = new Float32Array(count)
    const edgeStrengths = new Float32Array(count)
    const flatPositions = new Float32Array(count * 3)
    const domePositions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const p = particles[i]

      // Flat position (2D painting plane)
      const fx = (p.u - 0.5) * this.paintingWidth
      const fy = (0.5 - p.v) * paintingHeight
      const fz = 0
      flatPositions[i * 3] = fx
      flatPositions[i * 3 + 1] = fy
      flatPositions[i * 3 + 2] = fz

      // Dome position
      const [dx, dy, dz] = this._computeDomePosition(p.u, p.v)
      domePositions[i * 3] = dx
      domePositions[i * 3 + 1] = dy
      domePositions[i * 3 + 2] = dz

      // Start at flat position
      positions[i * 3] = fx
      positions[i * 3 + 1] = fy
      positions[i * 3 + 2] = fz

      colors[i * 3] = p.r / 255
      colors[i * 3 + 1] = p.g / 255
      colors[i * 3 + 2] = p.b / 255

      brightnesses[i] = p.brightness
      strokeAngles[i] = p.strokeAngle
      edgeStrengths[i] = p.edgeStrength
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(brightnesses, 1))
    geo.setAttribute('aStrokeAngle', new THREE.BufferAttribute(strokeAngles, 1))
    geo.setAttribute('aEdgeStrength', new THREE.BufferAttribute(edgeStrengths, 1))
    geo.setAttribute('aFlatPos', new THREE.BufferAttribute(flatPositions, 3))
    geo.setAttribute('aDomePos', new THREE.BufferAttribute(domePositions, 3))

    this.material = new THREE.ShaderMaterial({
      vertexShader: PAINTING_VERTEX_SHADER,
      fragmentShader: PAINTING_FRAGMENT_SHADER,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uNoiseAmp: { value: this.noiseAmp },
        uPointScale: { value: this.pointScale },
        uDomeMode: { value: this.domeMode },
        uBrushLength: { value: this.brushLength },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.points = new THREE.Points(geo, this.material)
  }

  _computeDomePosition(u, v) {
    const angle = (u - 0.5) * Math.PI * this.wrapAngle

    if (this.domeMode === 0) {
      // Hemisphere dome
      const elevation = v * Math.PI * 0.5
      return [
        Math.cos(elevation) * Math.sin(angle) * this.domeRadius,
        Math.sin(elevation) * this.domeRadius * 0.7,
        Math.cos(elevation) * Math.cos(angle) * this.domeRadius,
      ]
    } else if (this.domeMode === 1) {
      // Cylinder
      return [
        Math.sin(angle) * this.domeRadius,
        (v - 0.5) * this.domeRadius * 2,
        Math.cos(angle) * this.domeRadius,
      ]
    } else {
      // Full sphere
      const theta = v * Math.PI
      return [
        Math.sin(theta) * Math.sin(angle) * this.domeRadius,
        Math.cos(theta) * this.domeRadius,
        Math.sin(theta) * Math.cos(angle) * this.domeRadius,
      ]
    }
  }

  setProgress(value) {
    this.material.uniforms.uProgress.value = value
  }

  setTime(value) {
    this.material.uniforms.uTime.value = value
  }

  updateParams({ pointScale, noiseAmp, brushLength, domeRadius, wrapAngle, domeMode }) {
    if (pointScale !== undefined) this.material.uniforms.uPointScale.value = pointScale
    if (noiseAmp !== undefined) this.material.uniforms.uNoiseAmp.value = noiseAmp
    if (brushLength !== undefined) this.material.uniforms.uBrushLength.value = brushLength
    if (domeRadius !== undefined) { this.domeRadius = domeRadius; this._rebuildDomePositions() }
    if (wrapAngle !== undefined) { this.wrapAngle = wrapAngle; this._rebuildDomePositions() }
    if (domeMode !== undefined) {
      this.domeMode = domeMode
      this.material.uniforms.uDomeMode.value = domeMode
      this._rebuildDomePositions()
    }
  }

  _rebuildDomePositions() {
    const { particles } = this.sampledData
    const attr = this.points.geometry.attributes.aDomePos
    for (let i = 0; i < particles.length; i++) {
      const [dx, dy, dz] = this._computeDomePosition(particles[i].u, particles[i].v)
      attr.array[i * 3] = dx
      attr.array[i * 3 + 1] = dy
      attr.array[i * 3 + 2] = dz
    }
    attr.needsUpdate = true
  }

  getParticleCount() {
    return this.sampledData.particles.length
  }

  dispose() {
    this.points?.geometry?.dispose()
    this.material?.dispose()
  }
}
