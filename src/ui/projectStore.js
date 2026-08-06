const STORAGE_KEY = 'gesture_island_projects'
const MAX_PROJECTS = 24

function readProjects() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, MAX_PROJECTS)))
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export class ProjectStore {
  list() {
    return readProjects().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  }

  save(project) {
    const now = new Date().toISOString()
    const next = {
      ...cloneValue(project),
      id: project.id || createId(),
      title: String(project.title || '未命名作品').trim().slice(0, 40) || '未命名作品',
      updatedAt: now,
      createdAt: project.createdAt || now,
    }
    const projects = readProjects().filter(item => item.id !== next.id)
    projects.unshift(next)
    writeProjects(projects)
    return next
  }

  duplicate(id, transform = {}) {
    const source = this.get(id)
    if (!source) return null
    return this.save({
      ...cloneValue(source),
      id: null,
      title: `${source.title || '我的作品'} · 变奏`,
      ...cloneValue(transform),
    })
  }

  get(id) {
    return readProjects().find(item => item.id === id) || null
  }

  remove(id) {
    writeProjects(readProjects().filter(item => item.id !== id))
  }
}
