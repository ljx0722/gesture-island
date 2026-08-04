// particleUploader.js — GLB/GLTF 上传解析为粒子
export class ParticleUploader {
  async loadFromFile(file) {
    const T = window.THREE
    if (!T.GLTFLoader) throw new Error('GLTFLoader 未加载，无法解析模型文件')
    const url = URL.createObjectURL(file)
    try {
      const loader = new T.GLTFLoader()
      const gltf = await loader.loadAsync(url)
      URL.revokeObjectURL(url)
      const geos = []
      gltf.scene.traverse(child => {
        if (child.isMesh && child.geometry) {
          const cloned = child.geometry.clone()
          cloned.applyMatrix4(child.matrixWorld)
          geos.push(cloned)
        }
      })
      if (geos.length === 0) throw new Error('模型中没有可用的几何体')
      // Simple merge
      if (geos.length === 1) return geos[0]
      return mergeGeosSimple(geos)
    } catch (e) {
      URL.revokeObjectURL(url)
      throw new Error(`模型解析失败：${e.message || '未知错误'}`)
    }
  }
}

function mergeGeosSimple(geos) {
  const T = window.THREE
  const allPos = []
  for (const geo of geos) {
    let g = geo
    if (g.index !== null) g = g.toNonIndexed()
    const pos = g.attributes.position.array
    for (let i = 0; i < pos.length; i++) allPos.push(pos[i])
  }
  const merged = new T.BufferGeometry()
  merged.setAttribute('position', new T.BufferAttribute(new Float32Array(allPos), 3))
  return merged
}
