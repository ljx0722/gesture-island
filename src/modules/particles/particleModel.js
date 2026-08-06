// particleModel.js — 顶点提取 + THREE.Points + 发光软圆点 ShaderMaterial
const THREE = () => window.THREE

const VERT = /* glsl */ `
attribute vec3 basePosition;
attribute vec3 scatterDir;
attribute float randomSeed;
uniform float uProgress;
uniform float uTime;
uniform float uScatterDist;
uniform float uNoiseAmp;
uniform float uPointScale;
uniform float uHandVelocity;
uniform float uHandInfluence;
uniform float uFlowSpeed;
uniform float uNoiseScale;
uniform float uBurstStrength;
uniform float uRepelRadius;
uniform float uGlow;
uniform float uColorSpread;
uniform float uTrail;
uniform vec2 uRepel;
uniform float uRepelStr;
varying float vAlpha;
varying float vRandom;
void main() {
  vec3 noise = vec3(
    sin(basePosition.y*uNoiseScale+uTime*uFlowSpeed)*cos(basePosition.z*uNoiseScale+uTime*uFlowSpeed*0.7),
    cos(basePosition.x*uNoiseScale+uTime*uFlowSpeed*0.8)*sin(basePosition.z*uNoiseScale+uTime*uFlowSpeed*0.6),
    sin(basePosition.x*uNoiseScale+uTime*uFlowSpeed*0.5)*cos(basePosition.y*uNoiseScale+uTime*uFlowSpeed*0.9)
  )*uNoiseAmp*0.025;
  float ep = uProgress*(0.85+randomSeed*0.3);
  float velTurb = uHandVelocity*uHandInfluence * sin(basePosition.x*8.0+uTime*3.0) * cos(basePosition.y*8.0-uTime*2.0) * 0.15;
  float repel = uRepelStr * (1.0 - smoothstep(0.0, uRepelRadius, length(basePosition.xy - uRepel)));
  vec3 displaced = basePosition+scatterDir*(ep+velTurb+uBurstStrength*uHandVelocity*0.04-repel*0.6)*uScatterDist+noise;
  vec4 mv = modelViewMatrix*vec4(displaced,1.0);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = clamp(uPointScale*(280.0/-mv.z),0.5,12.0);
  vAlpha = 1.0-ep*0.7;
  vRandom = randomSeed;
}`

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPointShape;
uniform float uGlow;
uniform float uColorSpread;
uniform float uTrail;
varying float vAlpha;
varying float vRandom;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d;
  if (uPointShape < 0.5) {
    d = length(c) * 2.0;
  } else if (uPointShape < 1.5) {
    d = max(abs(c.x), abs(c.y)) * 2.0;
  } else if (uPointShape < 2.5) {
    float sx = c.x * 1.4, sy = c.y * 1.4;
    float rr = abs(sx) + abs(sy);
    d = rr * 1.6;
  } else {
    float a = atan(c.y, c.x);
    float r = length(c) * 2.0;
    d = r * (0.65 + 0.35 * cos(a * 5.0));
  }
  float a = 1.0 - smoothstep(0.15, 1.0, d);
  a *= a * vAlpha * uOpacity * (0.75 + vRandom * 0.25);
  vec3 spreadColor = vec3(vRandom, 1.0-vRandom, 0.5+0.5*sin(vRandom*6.283));
  vec3 col = mix(uColor, spreadColor, uColorSpread) * (1.0 + (1.0 - d) * (0.3+uGlow*0.6));
  a *= 1.0 + uTrail*vRandom*0.25;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`

export class ParticleModel {
  constructor(geometry, options = {}) {
    const T = THREE()
    this._T = T
    this.pointScale = options.pointScale ?? 1.6
    this.scatterDist = options.scatterDist ?? 1.5
    this.noiseAmp = options.noiseAmp ?? 0.6
    this.color = new T.Color(options.color ?? '#6c8cff')
    this.opacity = options.opacity ?? 0.9
    this.pointShape = options.pointShape ?? 0
    this.points = null
    this.material = null
    this._build(geometry)
  }

  _build(geometry) {
    const T = this._T
    let geo = geometry
    if (geo.index !== null) geo = geo.toNonIndexed()
    const src = geo.attributes.position.array
    const count = src.length / 3

    // Downsample if needed
    let step = 1
    if (count > 80000) step = Math.ceil(count / 80000)
    const n = Math.floor(count / step)
    const basePos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      basePos[i * 3] = src[i * step * 3]
      basePos[i * 3 + 1] = src[i * step * 3 + 1]
      basePos[i * 3 + 2] = src[i * step * 3 + 2]
    }

    // Center the source geometry so every preset starts at the visual origin.
    let cx = 0, cy = 0, cz = 0
    for (let i = 0; i < n; i++) {
      cx += basePos[i * 3]; cy += basePos[i * 3 + 1]; cz += basePos[i * 3 + 2]
    }
    cx /= n; cy /= n; cz /= n
    for (let i = 0; i < n; i++) {
      basePos[i * 3] -= cx
      basePos[i * 3 + 1] -= cy
      basePos[i * 3 + 2] -= cz
    }

    const dirs = new Float32Array(n * 3), seeds = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const px = basePos[i * 3], py = basePos[i * 3 + 1], pz = basePos[i * 3 + 2]
      const len = Math.sqrt(px * px + py * py + pz * pz) || 1
      dirs[i * 3] = px / len; dirs[i * 3 + 1] = py / len; dirs[i * 3 + 2] = pz / len
      seeds[i] = Math.random()
    }

    const pgeo = new T.BufferGeometry()
    pgeo.setAttribute('position', new T.BufferAttribute(basePos.slice(), 3))
    pgeo.setAttribute('basePosition', new T.BufferAttribute(basePos, 3))
    pgeo.setAttribute('scatterDir', new T.BufferAttribute(dirs, 3))
    pgeo.setAttribute('randomSeed', new T.BufferAttribute(seeds, 1))

    this.material = new T.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uProgress: { value: 0 }, uTime: { value: 0 },
        uScatterDist: { value: this.scatterDist }, uNoiseAmp: { value: this.noiseAmp },
        uPointScale: { value: this.pointScale }, uColor: { value: this.color },
        uOpacity: { value: this.opacity }, uHandVelocity: { value: 0 },
        uHandInfluence: { value: 0.5 }, uFlowSpeed: { value: 1 }, uNoiseScale: { value: 12 },
        uBurstStrength: { value: 0.4 }, uRepelRadius: { value: 0.5 }, uGlow: { value: 0.6 },
        uColorSpread: { value: 0 }, uTrail: { value: 0 },
        uRepel: { value: new T.Vector2(0, 0) },
        uRepelStr: { value: 0 },
        uPointShape: { value: this.pointShape },
      },
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    })
    this.points = new T.Points(pgeo, this.material)
  }

  setProgress(v) { this.material.uniforms.uProgress.value = v }
  setTime(v) { this.material.uniforms.uTime.value = v }
  setHandVelocity(v) { this.material.uniforms.uHandVelocity.value = Math.min(v, 5) }
  setRepel(x, y, str) {
    this.material.uniforms.uRepel.value.set(x - 0.5, y - 0.5)
    this.material.uniforms.uRepelStr.value = Math.min(str, 1)
  }
  setColor(hex) { this.color.set(hex); this.material.uniforms.uColor.value = this.color }

  updateParams(p) {
    if (p.pointScale !== undefined) this.material.uniforms.uPointScale.value = p.pointScale
    if (p.scatterDist !== undefined) this.material.uniforms.uScatterDist.value = p.scatterDist
    if (p.noiseAmp !== undefined) this.material.uniforms.uNoiseAmp.value = p.noiseAmp
    if (p.opacity !== undefined) this.material.uniforms.uOpacity.value = p.opacity
    if (p.color !== undefined) { this.color.set(p.color); this.material.uniforms.uColor.value = this.color }
    const uniformMap = {
      flowSpeed: 'uFlowSpeed', noiseScale: 'uNoiseScale', glow: 'uGlow', colorSpread: 'uColorSpread',
      trail: 'uTrail', burstStrength: 'uBurstStrength', repelRadius: 'uRepelRadius', handInfluence: 'uHandInfluence',
    }
    for (const [key, uniform] of Object.entries(uniformMap)) {
      if (p[key] !== undefined) this.material.uniforms[uniform].value = p[key]
    }
    if (p.pointShape !== undefined) { this.pointShape = p.pointShape; this.material.uniforms.uPointShape.value = p.pointShape }
  }

  dispose() {
    this.points?.geometry?.dispose()
    this.material?.dispose()
  }
}
