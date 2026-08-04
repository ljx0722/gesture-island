// math.js — 通用数学工具
export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function distance2D(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1)
}

export function distance3D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0))
}

export function average(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + (p.z || 0) }), { x: 0, y: 0, z: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length }
}

export function normalize(p) {
  const len = Math.hypot(p.x, p.y, p.z || 0) || 1
  return { x: p.x / len, y: p.y / len, z: (p.z || 0) / len }
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) }
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: (a.z || 0) + (b.z || 0) }
}

export function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: (v.z || 0) * s }
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0)
}
