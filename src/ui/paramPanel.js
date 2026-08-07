// paramPanel.js — 可折叠参数面板（三模块通用）
export class ParamPanel {
  constructor() {
    this.el = document.getElementById('param-panel')
    this.body = document.getElementById('param-panel-body')
    this._module = null
    this._onParamChange = null
  }

  setModule(moduleId, presetParams, currentValues, onParamChange) {
    this._module = moduleId
    this._onParamChange = onParamChange
    this._render(presetParams, currentValues)
  }

  _render(paramDefs, values) {
    if (!paramDefs) { this.body.innerHTML = ''; return }
    this.body.innerHTML = ''

    let html = '<div style="display:flex;flex-direction:column;gap:12px;">'

    for (const [key, def] of Object.entries(paramDefs)) {
      const type = def.type || 'range'
      const value = values[key] ?? def.default
      const label = this._escape(def.label || key)

      if (type === 'color') {
        html += `
          <div class="param-row param-row-color">
            <label>${label}</label>
            <input type="color" value="${this._escape(value || '#ffffff')}" data-param="${key}" data-type="color" />
            <span class="param-value">${this._escape(value || '')}</span>
          </div>`
      } else if (type === 'select') {
        const options = (def.options || []).map(opt => {
          const option = typeof opt === 'string' ? { value: opt, label: opt } : opt
          const selected = String(option.value) === String(value) ? ' selected' : ''
          return `<option value="${this._escape(option.value)}"${selected}>${this._escape(option.label)}</option>`
        }).join('')
        html += `
          <div class="param-row param-row-select">
            <label>${label}</label>
            <select data-param="${key}" data-type="select">${options}</select>
            <span class="param-value">${this._escape(this._optionLabel(def, value))}</span>
          </div>`
      } else if (type === 'toggle') {
        html += `
          <div class="param-row param-row-toggle">
            <label>${label}</label>
            <button class="param-toggle-btn${value ? ' on' : ''}" type="button" data-param="${key}" data-type="toggle">${value ? '开' : '关'}</button>
            <span class="param-value">${value ? '开' : '关'}</span>
          </div>`
      } else if (type === 'button') {
        html += `
          <div class="param-row param-row-button">
            <label>${label}</label>
            <button class="param-action-btn" type="button" data-param="${key}" data-type="button" data-action="${this._escape(def.action || key)}">${this._escape(def.buttonLabel || def.label || key)}</button>
          </div>`
      } else {
        html += `
          <div class="param-row">
            <label>${label}</label>
            <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${value}"
              data-param="${key}" data-type="range" />
            <span class="param-value">${this._formatValue(value)}</span>
          </div>`
      }
    }

    html += '</div>'
    this.body.innerHTML = html

    this.body.querySelectorAll('[data-param]').forEach(input => {
      const type = input.dataset.type || 'range'
      const eventName = type === 'range' || type === 'color' ? 'input' : 'change'

      if (type === 'button') {
        input.addEventListener('click', () => {
          this._onParamChange?.(input.dataset.param, input.dataset.action)
        })
        return
      }

      if (type === 'toggle') {
        input.addEventListener('click', () => {
          const key = input.dataset.param
          const next = !input.classList.contains('on')
          input.classList.toggle('on', next)
          input.textContent = next ? '开' : '关'
          const span = input.parentElement.querySelector('.param-value')
          if (span) span.textContent = next ? '开' : '关'
          this._onParamChange?.(key, next)
        })
        return
      }

      input.addEventListener(eventName, () => {
        const key = input.dataset.param
        const val = type === 'range' ? parseFloat(input.value) : input.value
        const span = input.parentElement.querySelector('.param-value')
        if (span) {
          span.textContent = type === 'range' ? this._formatValue(val) : (type === 'select' ? this._optionLabel(paramDefs[key], val) : val)
        }
        this._onParamChange?.(key, val)
      })
    })
  }

  _formatValue(value) {
    return typeof value === 'number' ? value.toFixed(2).replace(/\.?0+$/, '') : value
  }

  _optionLabel(def, value) {
    const option = (def.options || []).map(opt => typeof opt === 'string' ? { value: opt, label: opt } : opt)
      .find(opt => String(opt.value) === String(value))
    return option?.label ?? value
  }

  _escape(value) {
    return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
  }

  toggle() {
    this.el.classList.toggle('hidden')
  }

  show() { this.el.classList.remove('hidden') }
  hide() { this.el.classList.add('hidden') }
}
