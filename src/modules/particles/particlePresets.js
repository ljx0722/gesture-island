// particlePresets.js — 程序化几何体预设库（20+ 种）
// Uses window.THREE (loaded in index.html)
const THREE = () => window.THREE

// Simple local geometry merger (avoids CDN addon dependency)
function mergeGeos(geometries) {
  const T = THREE()
  if (geometries.length === 0) return new T.BufferGeometry()
  if (geometries.length === 1) return geometries[0]

  // Convert all to non-indexed, collect positions
  const allPos = []
  for (const geo of geometries) {
    let g = geo
    if (g.index !== null) g = g.toNonIndexed()
    const pos = g.attributes.position.array
    for (let i = 0; i < pos.length; i++) allPos.push(pos[i])
  }
  const merged = new T.BufferGeometry()
  merged.setAttribute('position', new T.BufferAttribute(new Float32Array(allPos), 3))
  return merged
}

function mergeGroup(group) {
  const geos = []
  group.traverse(child => {
    if (child.isMesh && child.geometry) {
      const cloned = child.geometry.clone()
      cloned.applyMatrix4(child.matrixWorld)
      geos.push(cloned)
    }
  })
  return mergeGeos(geos)
}

export const PRESET_CATEGORIES = ['自然', '天文', '几何', '动物', '爱心']

export const PRESETS = [
  {
    id: 'flower', name: '花朵', category: '自然',
    generate() {
      const T = THREE()
      const group = new T.Group()
      const petalCount = 8
      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2
        const petalGeo = new T.SphereGeometry(0.25, 8, 4)
        petalGeo.scale(0.35, 0.12, 0.7)
        const petal = new T.Mesh(petalGeo)
        petal.position.set(Math.cos(angle) * 0.3, 0.1, Math.sin(angle) * 0.3)
        petal.rotation.y = -angle; petal.rotation.z = 0.4
        group.add(petal)
      }
      group.add(new T.Mesh(new T.SphereGeometry(0.2, 12, 8)))
      group.add(new T.Mesh(new T.CylinderGeometry(0.04, 0.06, 1.2, 8)).translateY(-0.65))
      return mergeGroup(group)
    }
  },
  {
    id: 'star', name: '星空', category: '天文',
    generate() {
      const T = THREE()
      const count = 2000
      const pos = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = 1.8 + Math.random() * 0.5
        pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r
        pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r
        pos[i * 3 + 2] = Math.cos(phi) * r
      }
      const geo = new T.BufferGeometry()
      geo.setAttribute('position', new T.BufferAttribute(pos, 3))
      return geo
    }
  },
  {
    id: 'butterfly', name: '蝴蝶', category: '动物',
    generate() {
      const T = THREE()
      const group = new T.Group()
      for (let s = -1; s <= 1; s += 2) {
        const wing = []
        for (let t = 0; t <= 1; t += 0.03) {
          const a = t * Math.PI, r = Math.sin(a) * 0.9
          wing.push(new T.Vector2(Math.cos(a) * r * s * 0.8, Math.sin(a) * r * 0.6 + 0.1))
        }
        group.add(new T.Mesh(new T.ShapeGeometry(new T.Shape(wing), 24)))
      }
      group.add(new T.Mesh(new T.CylinderGeometry(0.04, 0.03, 0.5, 8)))
      return mergeGroup(group)
    }
  },
  {
    id: 'torus-knot', name: '环面结', category: '几何',
    generate() { return new (THREE()).TorusKnotGeometry(1, 0.3, 80, 16) }
  },
  {
    id: 'mobius', name: '莫比乌斯带', category: '几何',
    generate() {
      const T = THREE()
      const seg = 80, strips = 30, pos = [], idx = []
      for (let i = 0; i <= seg; i++) {
        const u = (i / seg) * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u), hu = Math.cos(u / 2), shu = Math.sin(u / 2)
        for (let j = 0; j <= strips; j++) {
          const v = (j / strips - 0.5) * 0.6
          pos.push(cu + v * hu * cu, su + v * hu * su, v * shu)
        }
      }
      for (let i = 0; i < seg; i++)
        for (let j = 0; j < strips; j++) {
          const a = i * (strips + 1) + j, b = a + strips + 1, c = a + 1, d = b + 1
          idx.push(a, b, c, b, d, c)
        }
      const geo = new T.BufferGeometry()
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3))
      geo.setIndex(idx); geo.computeVertexNormals()
      return geo
    }
  },
  {
    id: 'spiral', name: '螺旋塔', category: '几何',
    generate() {
      const T = THREE()
      const points = []
      for (let i = 0; i <= 200; i++) {
        const t = i / 200, a = t * Math.PI * 2 * 6, r = 0.2 + t * 0.25, y = t * 2.5 - 1.25
        points.push(new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
      }
      return new T.TubeGeometry(new T.CatmullRomCurve3(points), 120, 0.12, 12, false)
    }
  },
  {
    id: 'tree', name: '分形树', category: '几何',
    generate() {
      const T = THREE()
      const group = new T.Group(), branches = []
      function branch(start, dir, len, thick) {
        if (len < 0.08) return
        const end = start.clone().add(dir.clone().multiplyScalar(len))
        branches.push({ start: start.clone(), end: end.clone(), thick })
        const r = dir.clone().applyAxisAngle(new T.Vector3(0, 0, 1), 0.5 + Math.random() * 0.3)
        const l = dir.clone().applyAxisAngle(new T.Vector3(0, 0, 1), -0.5 - Math.random() * 0.3)
        branch(end, r, len * 0.7, thick * 0.6)
        branch(end, l, len * 0.7, thick * 0.6)
      }
      branch(new T.Vector3(0, -1, 0), new T.Vector3(0, 1, 0), 1, 0.15)
      for (const b of branches) {
        const mid = b.start.clone().add(b.end).multiplyScalar(0.5)
        const len = b.start.distanceTo(b.end)
        const cyl = new T.Mesh(new T.CylinderGeometry(b.thick, b.thick * 0.8, len, 6))
        cyl.position.copy(mid)
        cyl.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.end.clone().sub(b.start).normalize())
        group.add(cyl)
      }
      return mergeGroup(group)
    }
  },
  {
    id: 'icosahedron', name: '二十面体', category: '几何',
    generate() { return new (THREE()).IcosahedronGeometry(1.2, 2) }
  },
  {
    id: 'heart', name: '爱心', category: '爱心',
    generate() {
      const T = THREE(), pos = [], idx = [], res = 40
      for (let i = 0; i <= res; i++) {
        const u = (i / res) * Math.PI * 2
        for (let j = 0; j <= res; j++) {
          const v = (j / res) * Math.PI - Math.PI / 2
          const r = Math.sin(u)
          pos.push(r * Math.cos(v) * 1.4, Math.cos(u) * 1.4 + 0.3 * Math.sin(u) * Math.sin(u), r * Math.sin(v) * 0.8)
        }
      }
      for (let i = 0; i < res; i++)
        for (let j = 0; j < res; j++) {
          const a = i * (res + 1) + j, b = a + res + 1, c = a + 1, d = b + 1
          idx.push(a, b, c, b, d, c)
        }
      const geo = new T.BufferGeometry()
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3))
      geo.setIndex(idx); geo.computeVertexNormals()
      return geo
    }
  },
  {
    id: 'snowflake', name: '雪花', category: '自然',
    generate() {
      const T = THREE(), group = new T.Group()
      for (let arm = 0; arm < 6; arm++) {
        const ag = (arm / 6) * Math.PI * 2, armG = new T.Group()
        armG.add(new T.Mesh(new T.CylinderGeometry(0.03, 0.015, 1.2, 6)).translateY(0.6))
        for (let b = 0; b < 3; b++) {
          for (let s = -1; s <= 1; s += 2) {
            const br = new T.Mesh(new T.CylinderGeometry(0.02, 0.01, 0.35, 5))
            br.position.set(s * 0.25, 0.3 + b * 0.3, 0); br.rotation.z = s * 0.8; armG.add(br)
          }
        }
        armG.rotation.z = ag; group.add(armG)
      }
      group.add(new T.Mesh(new T.SphereGeometry(0.12, 12, 8)))
      return mergeGroup(group)
    }
  },
  {
    id: 'planet', name: '行星环', category: '天文',
    generate() {
      const T = THREE(), group = new T.Group()
      group.add(new T.Mesh(new T.SphereGeometry(0.7, 24, 16)))
      const r1 = new T.Mesh(new T.TorusGeometry(1.1, 0.12, 16, 60)); r1.rotation.x = Math.PI / 2.5; group.add(r1)
      const r2 = new T.Mesh(new T.TorusGeometry(1.35, 0.06, 12, 60)); r2.rotation.x = Math.PI / 2.3; group.add(r2)
      return mergeGroup(group)
    }
  },
  {
    id: 'diamond', name: '钻石', category: '几何',
    generate() { return new (THREE()).OctahedronGeometry(0.9, 1) }
  },
  {
    id: 'donut', name: '甜甜圈', category: '几何',
    generate() { return new (THREE()).TorusGeometry(0.8, 0.4, 20, 40) }
  },
  {
    id: 'spring', name: '弹簧', category: '几何',
    generate() {
      const T = THREE(), pts = []
      for (let i = 0; i <= 200; i++) {
        const t = i / 200, a = t * Math.PI * 2 * 8
        pts.push(new T.Vector3(Math.cos(a) * 0.7, t * 3 - 1.5, Math.sin(a) * 0.7))
      }
      return new T.TubeGeometry(new T.CatmullRomCurve3(pts), 120, 0.12, 12, false)
    }
  },
  {
    id: 'pine', name: '松树', category: '自然',
    generate() {
      const T = THREE(), group = new T.Group()
      for (let i = 0; i < 5; i++) {
        group.add(new T.Mesh(new T.ConeGeometry(0.9 - i * 0.15, 0.7, 16, 4)).translateY(-1.2 + i * 0.55))
      }
      group.add(new T.Mesh(new T.CylinderGeometry(0.15, 0.2, 1.5, 8)).translateY(-1.6))
      return mergeGroup(group)
    }
  },
  {
    id: 'wave', name: '波浪', category: '几何',
    generate() {
      const T = THREE(), geo = new T.PlaneGeometry(3, 2, 60, 30)
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i)
        pos.setZ(i, Math.sin(x * 3) * Math.cos(y * 2) * 0.4 + Math.cos(x * 5 + y * 3) * 0.15)
      }
      geo.computeVertexNormals(); return geo
    }
  },
  {
    id: 'nebula', name: '星云', category: '天文',
    generate() {
      const T = THREE(), count = 3000, pos = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const arm = Math.floor(Math.random() * 4), armA = (arm / 4) * Math.PI * 2
        const dist = Math.random() * 2.5, spread = (1 - dist / 2.5) * 0.6
        const a = armA + dist * 1.5 + (Math.random() - 0.5) * spread
        pos[i * 3] = Math.cos(a) * dist
        pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 2
        pos[i * 3 + 2] = Math.sin(a) * dist
      }
      const geo = new T.BufferGeometry()
      geo.setAttribute('position', new T.BufferAttribute(pos, 3)); return geo
    }
  },
  {
    id: 'cube-grid', name: '立方矩阵', category: '几何',
    generate() {
      const T = THREE(), group = new T.Group()
      for (let x = -1; x <= 1; x += 0.5)
        for (let y = -1; y <= 1; y += 0.5)
          for (let z = -1; z <= 1; z += 0.5)
            group.add(new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.2)).translateX(x).translateY(y).translateZ(z))
      return mergeGroup(group)
    }
  },
  {
    id: 'sphere-shell', name: '球壳', category: '几何',
    generate() {
      const T = THREE()
      return mergeGeos([new T.SphereGeometry(1.2, 32, 20), new T.SphereGeometry(0.8, 32, 20)])
    }
  },
  {
    id: 'dna', name: 'DNA双螺旋', category: '几何',
    generate() {
      const T = THREE(), group = new T.Group()
      for (let strand = 0; strand < 2; strand++) {
        const pts = [], off = strand * Math.PI
        for (let i = 0; i <= 200; i++) {
          const t = i / 200, a = t * Math.PI * 2 * 4 + off
          pts.push(new T.Vector3(Math.cos(a) * 0.5, t * 3 - 1.5, Math.sin(a) * 0.5))
        }
        group.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 80, 0.06, 8, false)))
      }
      return mergeGroup(group)
    }
  },
]

export function getPresetById(id) { return PRESETS.find(p => p.id === id) }
export default PRESETS
