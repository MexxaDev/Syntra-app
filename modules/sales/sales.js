'use strict';

import { saleRepo, customerRepo } from '../../db/repositories.js';
import Table from '../../components/table.js';
import { SALES_COLUMNS, SALES_ACTIONS, prepareSaleRows, showSaleDetail } from './salesTable.js';

class Sales {
  constructor() {
    this.sales = [];
    this.customers = [];
  }

  async load() {
    const container = document.getElementById('sales-list');
    if (container) {
      container.innerHTML = '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando ventas...</div>';
    }
    try {
      this.sales = await saleRepo.findAll();
      this.customers = await customerRepo.findAll();
      this.render();
    } catch (error) {
      console.error('Error loading sales:', error);
      if (container) {
        container.innerHTML = '<div style="text-align:center;padding:var(--space-8);color:var(--color-danger);"><i class="fa-solid fa-triangle-exclamation" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Error al cargar las ventas</div>';
      }
    }
  }

  async filter() {
    const dateFrom = document.getElementById('sales-date-from')?.value;
    const dateTo = document.getElementById('sales-date-to')?.value;

    let filtered = [...this.sales];

    if (dateFrom) {
      const fromTime = new Date(dateFrom).getTime();
      filtered = filtered.filter(s => {
        if (!s.date) return false;
        return new Date(s.date).getTime() >= fromTime;
      });
    }
    if (dateTo) {
      const toTime = new Date(dateTo + 'T23:59:59').getTime();
      filtered = filtered.filter(s => {
        if (!s.date) return false;
        return new Date(s.date).getTime() <= toTime;
      });
    }

    this.render(filtered);
  }

  render(sales = this.sales) {
    const container = document.getElementById('sales-list');
    if (!container) return;

    if (sales.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-money-bill-wave"></i></div>
          <h3 class="empty-state__title">No hay ventas</h3>
          <p class="empty-state__description">No se encontraron ventas con los filtros seleccionados.</p>
        </div>
      `;
      return;
    }

    const sorted = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
    const rows = prepareSaleRows(sorted, this.customers);
    const table = new Table({
      columns: SALES_COLUMNS,
      data: rows,
      actions: SALES_ACTIONS,
      onRowClick: (row) => showSaleDetail(row)
    });
    table.mount(container);
  }
}

export default new Sales();
