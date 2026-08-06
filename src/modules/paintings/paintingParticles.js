// paintingParticles.js — 油画笔触粒子系统 + 2D↔3D 穹顶过渡
const T = () => window.THREE

const VERT = /* glsl */ `
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
uniform float uDomeMode;
uniform float uBrushLength;
varying vec3 vColor;
varying float vBrightness;
varying float vStrokeAngle;
varying float vAlpha;
void main() {
  vec3 pos = mix(aFlatPos, aDomePos, uProgress);
  float ns = 0.008 + uProgress * 0.03;
  vec3 noise = vec3(
    sin(aFlatPos.y*12.0+uTime)*cos(aFlatPos.z*12.0+uTime*0.7),
    cos(aFlatPos.x*12.0+uTime*0.8)*sin(aFlatPos.z*12.0+uTime*0.6),
    sin(aFlatPos.x*12.0+uTime*0.5)*cos(aFlatPos.y*12.0+uTime*0.9)
  ) * uNoiseAmp * ns;
  pos += noise;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = (1.2 + aBrightness*2.8 + aEdgeStrength*1.5) * uPointScale;
  gl_PointSize = clamp(size*(300.0/-mv.z), 0.5, 10.0);
  vColor = aColor;
  vBrightness = aBrightness;
  vStrokeAngle = aStrokeAngle;
  vAlpha = 0.85 + uProgress*0.1;
}`

const FRAG = /* glsl */ `
uniform float uBrushLength;
uniform float uTime;
varying vec3 vColor;
varying float vBrightness;
varying float vStrokeAngle;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float ca = cos(-vStrokeAngle + uTime*0.05);
  float sa = sin(-vStrokeAngle + uTime*0.05);
  vec2 r = vec2(c.x*ca - c.y*sa, c.x*sa + c.y*ca);
  float asp = 0.5 + uBrushLength*1.5;
  float dist = length(r * vec2(asp, 1.0)) * 2.0;
  float a = 1.0 - smoothstep(0.2, 1.0, dist);
  a *= a * vAlpha * (0.9 + vBrightness*0.2);
  vec3 col = vColor * (0.9 + vBrightness*0.2);
  col += vec3(0.08,0.06,0.02)*(1.0-dist)*vBrightness;
  if(a<0.02) discard;
  gl_FragColor = vec4(col, a);
}`

export class PaintingParticles {
  constructor(sampledData, options = {}) {
    this.sampledData = sampledData
    this.paintingWidth = options.paintingWidth ?? 4.0
    this.domeRadius = options.domeRadius ?? 5.0
    this.wrapAngle = options.wrapAngle ?? 1.6
    this.domeMode = options.domeMode ?? 0
    this.pointScale = options.pointScale ?? 1.0
    this.noiseAmp = options.noiseAmp ?? 0.3
    this.brushLength = options.brushLength ?? 1.0
    this.points = null
    this.material = null
    this._build()
  }

  _build() {
    const T3 = T()
    const { particles, imageWidth, imageHeight } = this.sampledData
    const count = particles.length
    const aspect = imageWidth / Math.max(1, imageHeight)
    const pH = this.paintingWidth / aspect

    const pos = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const brightnesses = new Float32Array(count)
    const strokeAngles = new Float32Array(count)
    const edgeStrengths = new Float32Array(count)
    const flatPos = new Float32Array(count * 3)
    const domePos = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const p = particles[i]
      const fx = (p.u - 0.5) * this.paintingWidth
      const fy = (0.5 - p.v) * pH
      flatPos[i * 3] = fx; flatPos[i * 3 + 1] = fy; flatPos[i * 3 + 2] = 0

      const [dx, dy, dz] = this._dome(p.u, p.v)
      domePos[i * 3] = dx; domePos[i * 3 + 1] = dy; domePos[i * 3 + 2] = dz

      pos[i * 3] = fx; pos[i * 3 + 1] = fy; pos[i * 3 + 2] = 0
      colors[i * 3] = p.r / 255; colors[i * 3 + 1] = p.g / 255; colors[i * 3 + 2] = p.b / 255
      brightnesses[i] = p.brightness
      strokeAngles[i] = p.strokeAngle
      edgeStrengths[i] = p.edgeStrength
    }

    const geo = new T3.BufferGeometry()
    geo.setAttribute('position', new T3.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new T3.BufferAttribute(colors, 3))
    geo.setAttribute('aBrightness', new T3.BufferAttribute(brightnesses, 1))
    geo.setAttribute('aStrokeAngle', new T3.BufferAttribute(strokeAngles, 1))
    geo.setAttribute('aEdgeStrength', new T3.BufferAttribute(edgeStrengths, 1))
    geo.setAttribute('aFlatPos', new T3.BufferAttribute(flatPos, 3))
    geo.setAttribute('aDomePos', new T3.BufferAttribute(domePos, 3))

    this.material = new T3.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uProgress: { value: 0 }, uTime: { value: 0 },
        uNoiseAmp: { value: this.noiseAmp }, uNoiseSpeed: { value: 1 }, uNoiseScale: { value: 12 }, uPointScale: { value: this.pointScale },
        uBrightness: { value: 1 }, uContrast: { value: 1 }, uSaturation: { value: 1 }, uColorTemperature: { value: 0 },
        uOpacity: { value: 0.95 }, uBrushRoundness: { value: 0.5 },
        uDomeMode: { value: this.domeMode }, uBrushLength: { value: this.brushLength },
      },
      transparent: true, depthWrite: false, blending: T3.AdditiveBlending,
    })
    this.points = new T3.Points(geo, this.material)
  }

  _dome(u, v) {
    const angle = (u - 0.5) * Math.PI * this.wrapAngle
    const R = this.domeRadius
    if (this.domeMode === 0) {
      const el = v * Math.PI * 0.5
      return [Math.cos(el) * Math.sin(angle) * R, Math.sin(el) * R * 0.7, Math.cos(el) * Math.cos(angle) * R]
    } else if (this.domeMode === 1) {
      return [Math.sin(angle) * R, (v - 0.5) * R * 2, Math.cos(angle) * R]
    }
    const theta = v * Math.PI
    return [Math.sin(theta) * Math.sin(angle) * R, Math.cos(theta) * R, Math.sin(theta) * Math.cos(angle) * R]
  }

  setProgress(v) { this.material.uniforms.uProgress.value = v }
  setTime(v) { this.material.uniforms.uTime.value = v }

  updateParams(p) {
    if (p.pointScale !== undefined) this.material.uniforms.uPointScale.value = p.pointScale
    if (p.noiseAmp !== undefined) this.material.uniforms.uNoiseAmp.value = p.noiseAmp
    if (p.brushLength !== undefined) this.material.uniforms.uBrushLength.value = p.brushLength
    const uniformMap = { noiseSpeed: 'uNoiseSpeed', noiseScale: 'uNoiseScale', brightness: 'uBrightness', contrast: 'uContrast', saturation: 'uSaturation', colorTemperature: 'uColorTemperature', opacity: 'uOpacity', brushRoundness: 'uBrushRoundness' }
    for (const [key, uniform] of Object.entries(uniformMap)) {
      if (p[key] !== undefined) this.material.uniforms[uniform].value = p[key]
    }
    if (p.domeRadius !== undefined) { this.domeRadius = p.domeRadius; this._rebuildDome() }
    if (p.wrapAngle !== undefined) { this.wrapAngle = p.wrapAngle; this._rebuildDome() }
    if (p.domeMode !== undefined) { this.domeMode = p.domeMode; this.material.uniforms.uDomeMode.value = p.domeMode; this._rebuildDome() }
  }

  _rebuildDome() {
    const { particles } = this.sampledData
    const attr = this.points.geometry.attributes.aDomePos
    for (let i = 0; i < particles.length; i++) {
      const [dx, dy, dz] = this._dome(particles[i].u, particles[i].v)
      attr.array[i * 3] = dx; attr.array[i * 3 + 1] = dy; attr.array[i * 3 + 2] = dz
    }
    attr.needsUpdate = true
  }

  getParticleCount() { return this.sampledData.particles.length }

  dispose() {
    this.points?.geometry?.dispose()
    this.material?.dispose()
  }
}
