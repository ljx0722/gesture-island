// particleUploader.js — 用户上传 GLB/GLTF 解析为粒子
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries as mergeBufGeos } from 'three/addons/utils/BufferGeometryUtils.js'

export class ParticleUploader {
  constructor() {
    this.loader = new GLTFLoader()
  }

  async loadFromFile(file) {
    const url = URL.createObjectURL(file)
    try {
      const geometry = await this._loadGLTF(url)
      return geometry
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  async loadFromURL(url) {
    return this._loadGLTF(url)
  }

  _loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const geometries = []
          gltf.scene.traverse(child => {
            if (child.isMesh && child.geometry) {
              const cloned = child.geometry.clone()
              cloned.applyMatrix4(child.matrixWorld)
              geometries.push(cloned)
            }
          })
          if (geometries.length === 0) {
            reject(new Error('模型中没有找到可用的几何体。'))
            return
          }
          const merged = geometries.length === 1
            ? geometries[0]
            : mergeBufGeos(geometries, false)
          resolve(merged)
        },
        undefined,
        (err) => reject(new Error(`模型加载失败：${err.message || '未知错误'}`))
      )
    })
  }

  createFileInput(onLoaded, onError) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.glb,.gltf'
    input.style.display = 'none'
    input.addEventListener('change', async () => {
      const file = input.files[0]
      if (!file) return
      try {
        const geometry = await this.loadFromFile(file)
        onLoaded(geometry, file.name)
      } catch (e) {
        onError?.(e.message)
      }
    })
    return input
  }
}
