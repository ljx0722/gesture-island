// paramPanel.js — 可折叠参数面板（三模块通用）
export class ParamPanel {
  constructor() {
    this.el = document.getElementById('param-panel')
    this._module = null
    this._onParamChange = null
  }

  setModule(moduleId, presetParams, currentValues, onParamChange) {
    this._module = moduleId
    this._onParamChange = onParamChange
    this._render(presetParams, currentValues)
  }

  _render(paramDefs, values) {
    if (!paramDefs) { this.el.innerHTML = ''; return }

    let html = '<div style="display:flex;flex-direction:column;gap:12px;">'
    html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px;">参数面板</div>'

    for (const [key, def] of Object.entries(paramDefs)) {
      const value = values[key] ?? def.default
      html += `
        <div class="param-row">
          <label>${def.label}</label>
          <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${value}"
            data-param="${key}" />
          <span class="param-value">${typeof value === 'number' ? value.toFixed(2).replace(/\.?0+$/, '') : value}</span>
        </div>`
    }

    html += '</div>'
    this.el.innerHTML = html

    // Bind events
    this.el.querySelectorAll('input[type="range"]').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.dataset.param
        const val = parseFloat(input.value)
        const span = input.parentElement.querySelector('.param-value')
        if (span) span.textContent = val.toFixed(2).replace(/\.?0+$/, '')
        this._onParamChange?.(key, val)
      })
    })
  }

  toggle() {
    this.el.classList.toggle('hidden')
  }

  show() { this.el.classList.remove('hidden') }
  hide() { this.el.classList.add('hidden') }
}
