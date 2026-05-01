'use strict';

class Table {
  constructor({ columns = [], data = [], actions = [], onRowClick = null }) {
    this.columns = columns;
    this.data = data;
    this.actions = actions;
    this.onRowClick = onRowClick;
    this.element = null;
  }

  render() {
    if (this.data.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state__icon">📭</div>
          <h3 class="empty-state__title">No hay datos</h3>
          <p class="empty-state__description">No se encontraron registros.</p>
        </div>
      `;
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              ${this.columns.map(col => `<th>${col.label}</th>`).join('')}
              ${this.actions.length ? '<th>Acciones</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${this.data.map((row, index) => `
              <tr ${this.onRowClick ? `data-row-index="${index}"` : ''}>
                ${this.columns.map(col => `
                  <td>
                    ${col.format ? col.format(row[col.key], row) : (row[col.key] || '-')}
                  </td>
                `).join('')}
                ${this.actions.length ? `
                  <td>
                    <div class="flex gap-2">
                      ${this.actions.map(action => `
                        <button class="btn btn-sm ${action.class || 'btn-ghost'}" data-action="${action.name}" data-row-index="${index}">
                          ${action.icon || ''} ${action.label || ''}
                        </button>
                      `).join('')}
                    </div>
                  </td>
                ` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  mount(container) {
    this.element = container;
    container.innerHTML = this.render();

    if (this.onRowClick) {
      container.querySelectorAll('tbody tr').forEach(tr => {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          const index = parseInt(tr.dataset.rowIndex);
          this.onRowClick(this.data[index], index);
        });
      });
    }

    if (this.actions.length) {
      container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const actionName = btn.dataset.action;
          const index = parseInt(btn.dataset.rowIndex);
          const action = this.actions.find(a => a.name === actionName);
          if (action && action.onClick) {
            action.onClick(this.data[index], index);
          }
        });
      });
    }
  }

  update(data) {
    this.data = data;
    if (this.element) {
      this.element.innerHTML = this.render();
      this.mount(this.element);
    }
  }
}

export default Table;
