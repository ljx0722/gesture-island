// particlePresets.js — 程序化几何体预设库（20+ 种）
import * as THREE from 'three'
import { mergeGeometries as mergeBufGeos } from 'three/addons/utils/BufferGeometryUtils.js'

export const PRESET_CATEGORIES = ['自然', '天文', '几何', '动物', '爱心', '字符']

export const PRESETS = [
  {
    id: 'flower', name: '花朵', category: '自然',
    generate() {
      const group = new THREE.Group()
      const petalCount = 8
      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2
        const petalGeo = new THREE.SphereGeometry(0.25, 8, 4)
        petalGeo.scale(0.35, 0.12, 0.7)
        const petal = new THREE.Mesh(petalGeo)
        petal.position.set(Math.cos(angle) * 0.3, 0.1, Math.sin(angle) * 0.3)
        petal.rotation.y = -angle
        petal.rotation.z = 0.4
        group.add(petal)
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8))
      group.add(center)
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.2, 8))
      stem.position.y = -0.65
      group.add(stem)
      return mergeGroupGeometries(group)
    }
  },
  {
    id: 'star', name: '星空', category: '天文',
    generate() {
      const pointsGeo = new THREE.SphereGeometry(2, 0, 0)
      const count = pointsGeo.attributes.position.count
      const positions = new Float32Array(count * 3)
      const src = pointsGeo.attributes.position.array
      for (let i = 0; i < count; i++) {
        const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2]
        const len = Math.sqrt(x * x + y * y + z * z)
        const r = 1.8 + Math.random() * 0.5
        positions[i * 3] = (x / len) * r
        positions[i * 3 + 1] = (y / len) * r
        positions[i * 3 + 2] = (z / len) * r
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      return geo
    }
  },
  {
    id: 'butterfly', name: '蝴蝶', category: '动物',
    generate() {
      const group = new THREE.Group()
      for (let s = -1; s <= 1; s += 2) {
        const wingShape = []
        for (let t = 0; t <= 1; t += 0.02) {
          const angle = t * Math.PI
          const r = Math.sin(angle) * 0.9
          wingShape.push(new THREE.Vector2(Math.cos(angle) * r * s * 0.8, Math.sin(angle) * r * 0.6 + 0.1))
        }
        const shape = new THREE.Shape(wingShape)
        const wingGeo = new THREE.ShapeGeometry(shape, 24)
        const wing = new THREE.Mesh(wingGeo)
        group.add(wing)
      }
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.5, 8))
      group.add(body)
      return mergeGroupGeometries(group)
    }
  },
  {
    id: 'torus-knot', name: '环面结', category: '几何',
    generate() {
      return new THREE.TorusKnotGeometry(1, 0.3, 80, 16)
    }
  },
  {
    id: 'mobius', name: '莫比乌斯带', category: '几何',
    generate() {
      const segments = 80, strips = 30
      const positions = []
      const indices = []
      for (let i = 0; i <= segments; i++) {
        const u = (i / segments) * Math.PI * 2
        for (let j = 0; j <= strips; j++) {
          const v = (j / strips - 0.5) * 0.6
          const cu = Math.cos(u), su = Math.sin(u), hu = Math.cos(u / 2), shu = Math.sin(u / 2)
          const x = cu + v * hu * cu
          const y = su + v * hu * su
          const z = v * shu
          positions.push(x, y, z)
        }
      }
      for (let i = 0; i < segments; i++) {
        for (let j = 0; j < strips; j++) {
          const a = i * (strips + 1) + j, b = a + strips + 1, c = a + 1, d = b + 1
          indices.push(a, b, c, b, d, c)
        }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()
      return geo
    }
  },
  {
    id: 'spiral-tower', name: '螺旋塔', category: '几何',
    generate() {
      const turns = 6, pointsPerTurn = 60
      const positions = []
      const indices = []
      for (let i = 0; i <= turns * pointsPerTurn; i++) {
        const t = i / pointsPerTurn
        const angle = t * Math.PI * 2
        const r = 0.2 + t * 0.25
        const y = t * 2.5 - 1.25
        for (let j = 0; j < 8; j++) {
          const a = angle + (j / 8) * Math.PI * 2
          positions.push(Math.cos(a) * r, y, Math.sin(a) * r)
        }
      }
      const cols = 8
      for (let ring = 0; ring < turns * pointsPerTurn; ring++) {
        for (let j = 0; j < cols; j++) {
          const a = ring * cols + j, b = (ring + 1) * cols + j
          const c = ring * cols + (j + 1) % cols, d = (ring + 1) * cols + (j + 1) % cols
          indices.push(a, b, c, b, d, c)
        }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()
      return geo
    }
  },
  {
    id: 'fractal-tree', name: '分形树', category: '几何',
    generate() {
      const branches = []
      function branch(start, dir, length, thickness) {
        if (length < 0.08) return
        const end = start.clone().add(dir.clone().multiplyScalar(length))
        branches.push({ start: start.clone(), end: end.clone(), thickness })
        const right = dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.5 + Math.random() * 0.3)
        const left = dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.5 - Math.random() * 0.3)
        branch(end, right, length * 0.7, thickness * 0.6)
        branch(end, left, length * 0.7, thickness * 0.6)
      }
      branch(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0), 1, 0.15)

      const group = new THREE.Group()
      for (const b of branches) {
        const mid = b.start.clone().add(b.end).multiplyScalar(0.5)
        const len = b.start.distanceTo(b.end)
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(b.thickness, b.thickness * 0.8, len, 6))
        cyl.position.copy(mid)
        const dir = b.end.clone().sub(b.start).normalize()
        cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
        group.add(cyl)
      }
      return mergeGroupGeometries(group)
    }
  },
  {
    id: 'icosahedron', name: '二十面体', category: '几何',
    generate() {
      return new THREE.IcosahedronGeometry(1.2, 2)
    }
  },
  {
    id: 'heart', name: '爱心', category: '爱心',
    generate() {
      const positions = [], indices = []
      const res = 40
      for (let i = 0; i <= res; i++) {
        const u = (i / res) * Math.PI * 2
        for (let j = 0; j <= res; j++) {
          const v = (j / res) * Math.PI - Math.PI / 2
          const r = Math.sin(u)
          const x = r * Math.cos(v) * 1.4
          const y = Math.cos(u) * 1.4 + 0.3 * Math.sin(u) * Math.sin(u)
          const z = r * Math.sin(v) * 0.8
          positions.push(x, y, z)
        }
      }
      for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
          const a = i * (res + 1) + j, b = a + res + 1, c = a + 1, d = b + 1
          indices.push(a, b, c, b, d, c)
        }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()
      return geo
    }
  },
  {
    id: 'snowflake', name: '雪花', category: '自然',
    generate() {
      const group = new THREE.Group()
      for (let arm = 0; arm < 6; arm++) {
        const angle = (arm / 6) * Math.PI * 2
        const armGroup = new THREE.Group()
        const main = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 1.2, 6))
        main.position.y = 0.6
        armGroup.add(main)
        for (let b = 0; b < 3; b++) {
          const branchPos = 0.3 + b * 0.3
          for (let s = -1; s <= 1; s += 2) {
            const br = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.35, 5))
            br.position.set(s * 0.25, branchPos, 0)
            br.rotation.z = s * 0.8
            armGroup.add(br)
          }
        }
        armGroup.rotation.z = angle
        group.add(armGroup)
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8))
      group.add(center)
      return mergeGroupGeometries(group)
    }
  },
  {
    id: 'planet-ring', name: '行星环', category: '天文',
    generate() {
      const group = new THREE.Group()
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16)))
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 16, 60))
      ring.rotation.x = Math.PI / 2.5
      group.add(ring)
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.06, 12, 60))
      ring2.rotation.x = Math.PI / 2.3
      group.add(ring2)
      return mergeGroupGeometries(group)
    }
  },
  {
    id: 'diamond', name: '钻石', category: '几何',
    generate() {
      return new THREE.OctahedronGeometry(0.9, 0)
    }
  },
  {
    id: 'donut', name: '甜甜圈', category: '几何',
    generate() {
      return new THREE.TorusGeometry(0.8, 0.4, 20, 40)
    }
  },
  {
    id: 'spring', name: '弹簧', category: '几何',
    generate() {
      const points = []
      const turns = 8, segs = 200
      for (let i = 0; i <= segs; i++) {
        const t = i / segs
        const angle = t * Math.PI * 2 * turns
        points.push(new THREE.Vector3(Math.cos(angle) * 0.7, t * 3 - 1.5, Math.sin(angle) * 0.7))
      }
      const curve = new THREE.CatmullRomCurve3(points)
      return new THREE.TubeGeometry(curve, 120, 0.12, 12, false)
    }
  },
  {
    id: 'cone-stack', name: '松树', category: '自然',
    generate() {
      const group = new THREE.Group()
      for (let i = 0; i < 5; i++) {
        const y = -1.2 + i * 0.55
        const r = 0.9 - i * 0.15
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.7, 16, 4))
        cone.position.y = y
        group.add(cone)
      }
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.5, 8))
      trunk.position.y = -1.6
      group.add(trunk)
      return mergeGroupGeometries(group)
    }
  },
  {
    id: 'wave', name: '波浪', category: '几何',
    generate() {
      const geo = new THREE.PlaneGeometry(3, 2, 60, 30)
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i)
        pos.setZ(i, Math.sin(x * 3) * Math.cos(y * 2) * 0.4 + Math.cos(x * 5 + y * 3) * 0.15)
      }
      geo.computeVertexNormals()
      return geo
    }
  },
  {
    id: 'nebula', name: '星云', category: '天文',
    generate() {
      const count = 3000
      const positions = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const arm = Math.floor(Math.random() * 4)
        const armAngle = (arm / 4) * Math.PI * 2
        const dist = Math.random() * 2.5
        const spread = (1 - dist / 2.5) * 0.6
        const angle = armAngle + dist * 1.5 + (Math.random() - 0.5) * spread
        const r = dist
        const h = (Math.random() - 0.5) * spread * 2
        positions[i * 3] = Math.cos(angle) * r
        positions[i * 3 + 1] = h
        positions[i * 3 + 2] = Math.sin(angle) * r
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      return geo
    }
  },
  {
    id: 'cube-grid', name: '立方矩阵', category: '几何',
    generate() {
      const group = new THREE.Group()
      for (let x = -1; x <= 1; x += 0.5) {
        for (let y = -1; y <= 1; y += 0.5) {
          for (let z = -1; z <= 1; z += 0.5) {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2))
            box.position.set(x, y, z)
            group.add(box)
          }
        }
      }
      return mergeGroupGeometries(group)
    }
  },
  {
    id: 'sphere-shell', name: '球壳', category: '几何',
    generate() {
      const outer = new THREE.SphereGeometry(1.2, 32, 20)
      const inner = new THREE.SphereGeometry(0.8, 32, 20)
      return mergeGeometries([outer, inner])
    }
  },
  {
    id: 'gyroid', name: '螺旋面', category: '几何',
    generate() {
      const size = 2, res = 40
      const positions = [], indices = []
      for (let i = 0; i <= res; i++) {
        const u = (i / res - 0.5) * size
        for (let j = 0; j <= res; j++) {
          const v = (j / res - 0.5) * size
          const f = Math.sin(u * 3) * Math.cos(v * 3) + Math.sin(v * 3) * Math.cos(u * 3)
          positions.push(u, v, f * 0.4)
        }
      }
      for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
          const a = i * (res + 1) + j, b = a + res + 1, c = a + 1, d = b + 1
          indices.push(a, b, c, b, d, c)
        }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()
      return geo
    }
  },
  {
    id: 'dna-helix', name: 'DNA双螺旋', category: '几何',
    generate() {
      const group = new THREE.Group()
      for (let strand = 0; strand < 2; strand++) {
        const points = []
        const offset = strand * Math.PI
        for (let i = 0; i <= 200; i++) {
          const t = i / 200
          const angle = t * Math.PI * 2 * 4 + offset
          points.push(new THREE.Vector3(Math.cos(angle) * 0.5, t * 3 - 1.5, Math.sin(angle) * 0.5))
        }
        const curve = new THREE.CatmullRomCurve3(points)
        group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.06, 8, false)))
      }
      // Cross bars
      for (let i = 0; i <= 20; i++) {
        const t = i / 20
        const angle = t * Math.PI * 2 * 4
        const y = t * 3 - 1.5
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6))
        bar.position.set(0, y, 0)
        bar.rotation.y = angle
        group.add(bar)
      }
      return mergeGroupGeometries(group)
    }
  },
]

function mergeGroupGeometries(group) {
  const geometries = []
  group.traverse(child => {
    if (child.isMesh && child.geometry) {
      const cloned = child.geometry.clone()
      cloned.applyMatrix4(child.matrixWorld)
      geometries.push(cloned)
    }
  })
  return mergeGeometries(geometries)
}

export function mergeGeometries(geometries) {
  if (geometries.length === 0) return new THREE.BufferGeometry()
  if (geometries.length === 1) return geometries[0]
  return mergeBufGeos(geometries, false)
}

export function getPresetById(id) {
  return PRESETS.find(p => p.id === id)
}

export default PRESETS
