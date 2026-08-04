// particleModel.js — 顶点提取 + THREE.Points 创建（发光软圆点 ShaderMaterial）
import * as THREE from 'three'

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  attribute vec3 basePosition;
  attribute vec3 scatterDir;
  attribute float randomSeed;

  uniform float uProgress;
  uniform float uTime;
  uniform float uScatterDist;
  uniform float uNoiseAmp;
  uniform float uPointScale;

  varying float vAlpha;
  varying float vRandom;

  void main() {
    vec3 noise = vec3(
      sin(basePosition.y * 12.0 + uTime) * cos(basePosition.z * 12.0 + uTime * 0.7),
      cos(basePosition.x * 12.0 + uTime * 0.8) * sin(basePosition.z * 12.0 + uTime * 0.6),
      sin(basePosition.x * 12.0 + uTime * 0.5) * cos(basePosition.y * 12.0 + uTime * 0.9)
    ) * uNoiseAmp * 0.025;

    float effectiveProgress = uProgress * (0.85 + randomSeed * 0.3);
    vec3 displaced = basePosition + scatterDir * effectiveProgress * uScatterDist + noise;
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uPointScale * (280.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 12.0);

    // Fade alpha as particles scatter
    vAlpha = 1.0 - effectiveProgress * 0.7;
    vRandom = randomSeed;
  }
`

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vRandom;

  void main() {
    // Soft radial circle
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.15, 1.0, dist);
    alpha *= alpha; // Sharper falloff for glow look
    alpha *= vAlpha * uOpacity;

    // Slight brightness variation per particle
    alpha *= 0.75 + vRandom * 0.25;

    // Bright center, fading edges
    vec3 color = uColor * (1.0 + (1.0 - dist) * 0.6);

    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`

export class ParticleModel {
  constructor(geometry, options = {}) {
    this.geometry = geometry
    this.pointScale = options.pointScale ?? 1.6
    this.scatterDist = options.scatterDist ?? 1.5
    this.noiseAmp = options.noiseAmp ?? 0.6
    this.color = new THREE.Color(options.color ?? '#6c8cff')
    this.opacity = options.opacity ?? 0.9

    this.points = null
    this.material = null
    this._buildPoints()
  }

  _buildPoints() {
    const geo = this._prepareGeometry(this.geometry)
    const basePositions = new Float32Array(geo.attributes.position.array)

    // Compute centroid and scatter directions
    let cx = 0, cy = 0, cz = 0
    for (let i = 0; i < basePositions.length; i += 3) {
      cx += basePositions[i]
      cy += basePositions[i + 1]
      cz += basePositions[i + 2]
    }
    const count = basePositions.length / 3
    cx /= count; cy /= count; cz /= count

    const scatterDirs = new Float32Array(basePositions.length)
    const randomSeeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const px = basePositions[i * 3] - cx
      const py = basePositions[i * 3 + 1] - cy
      const pz = basePositions[i * 3 + 2] - cz
      const len = Math.sqrt(px * px + py * py + pz * pz) || 1
      scatterDirs[i * 3] = px / len
      scatterDirs[i * 3 + 1] = py / len
      scatterDirs[i * 3 + 2] = pz / len
      randomSeeds[i] = Math.random()
    }

    const pointGeo = new THREE.BufferGeometry()
    pointGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(basePositions), 3))
    pointGeo.setAttribute('basePosition', new THREE.BufferAttribute(basePositions, 3))
    pointGeo.setAttribute('scatterDir', new THREE.BufferAttribute(scatterDirs, 3))
    pointGeo.setAttribute('randomSeed', new THREE.BufferAttribute(randomSeeds, 1))

    this.material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uScatterDist: { value: this.scatterDist },
        uNoiseAmp: { value: this.noiseAmp },
        uPointScale: { value: this.pointScale },
        uColor: { value: this.color },
        uOpacity: { value: this.opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.points = new THREE.Points(pointGeo, this.material)
  }

  _prepareGeometry(geometry) {
    // Indexed → non-indexed for per-vertex attributes
    if (geometry.index !== null) {
      geometry = geometry.toNonIndexed()
    }
    // Deduplicate vertices (optional — skip for now to keep count manageable)
    return geometry
  }

  setProgress(value) {
    this.material.uniforms.uProgress.value = value
  }

  setTime(value) {
    this.material.uniforms.uTime.value = value
  }

  setColor(hex) {
    this.color.set(hex)
    this.material.uniforms.uColor.value = this.color
  }

  updateParams({ pointScale, scatterDist, noiseAmp, opacity, color }) {
    if (pointScale !== undefined) this.material.uniforms.uPointScale.value = pointScale
    if (scatterDist !== undefined) this.material.uniforms.uScatterDist.value = scatterDist
    if (noiseAmp !== undefined) this.material.uniforms.uNoiseAmp.value = noiseAmp
    if (opacity !== undefined) this.material.uniforms.uOpacity.value = opacity
    if (color !== undefined) {
      this.color.set(color)
      this.material.uniforms.uColor.value = this.color
    }
  }

  dispose() {
    this.points?.geometry?.dispose()
    this.material?.dispose()
  }
}
