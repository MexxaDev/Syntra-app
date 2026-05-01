'use strict';

import { saleRepo, customerRepo } from '../../db/repositories.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { format } from '../../utils/currency.js';
import state from '../../js/state.js';

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

    let html = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Método</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    sorted.forEach((saleItem, index) => {
      const customer = saleItem.customerId ? this.customers.find(c => c.id === saleItem.customerId) : null;
      const methodLabels = {
        'cash': 'Efectivo',
        'debit': 'Débito',
        'transfer': 'Transferencia',
        'account': 'Cuenta Corriente',
        'mixed': 'Mixto'
      };
      const method = methodLabels[saleItem.paymentMethod] || saleItem.paymentMethod;

      html += `
        <tr data-index="${index}" style="cursor:pointer;">
          <td>${saleItem.id.substring(0, 8)}</td>
          <td>${saleItem.date ? new Date(saleItem.date).toLocaleString('es-AR') : 'N/A'}</td>
          <td>${customer ? customer.name : 'Consumidor Final'}</td>
          <td style="font-weight:var(--font-semibold);">${format(saleItem.total)}</td>
          <td><span class="badge badge-primary">${method}</span></td>
          <td>
            <button class="btn btn-sm btn-ghost" data-action="view" data-index="${index}">Ver</button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;

    container.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        this.showSaleDetails(sorted[index]);
      });
    });

    container.querySelectorAll('tbody tr').forEach((tr, i) => {
      tr.addEventListener('click', () => {
        this.showSaleDetails(sorted[i]);
      });
    });
  }

  showSaleDetails(sale) {
    const customer = sale.customerId ? this.customers.find(c => c.id === sale.customerId) : null;
    const methodLabels = {
      'cash': 'Efectivo',
      'debit': 'Débito',
      'transfer': 'Transferencia',
      'account': 'Cuenta Corriente',
      'mixed': 'Mixto'
    };

    let itemsHtml = '';
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach(item => {
        itemsHtml += `
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border-light);font-size:var(--text-sm);">
            <span>${item.quantity}x ${item.name}</span>
            <span style="font-weight:var(--font-medium);">${format(item.subtotal || (item.price * item.quantity))}</span>
          </div>
        `;
      });
    }

    const body = `
      <div style="margin-bottom:var(--space-4);">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
          <span style="color:var(--color-text-secondary);">Ticket:</span>
          <span>#${sale.id.substring(0, 8)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
          <span style="color:var(--color-text-secondary);">Fecha:</span>
          <span>${sale.date ? new Date(sale.date).toLocaleString('es-AR') : 'N/A'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
          <span style="color:var(--color-text-secondary);">Cliente:</span>
          <span>${customer ? customer.name : 'Consumidor Final'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
          <span style="color:var(--color-text-secondary);">Método:</span>
          <span>${methodLabels[sale.paymentMethod] || sale.paymentMethod}</span>
        </div>
      </div>

      <div style="background:var(--color-gray-50);border-radius:var(--radius-lg);padding:var(--space-3);margin-bottom:var(--space-4);">
        ${itemsHtml || '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);">No hay detalles de items.</p>'}
      </div>

      <div style="border-top:1px solid var(--color-border);padding-top:var(--space-3);">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-sm);">
          <span>Subtotal:</span>
          <span>${format(sale.subtotal || 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-sm);">
          <span>Descuento:</span>
          <span>-${format(sale.discount || 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-sm);">
          <span>Impuestos:</span>
          <span>${format(sale.tax || 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:var(--text-lg);border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-2);">
          <span>TOTAL:</span>
          <span>${format(sale.total || 0)}</span>
        </div>
      </div>
    `;

    Modal.show({
      title: 'Detalles de Venta',
      body,
      footer: `
        <button class="btn btn-primary" id="sale-reprint-btn">
          <i class="fa-solid fa-print"></i> Re-imprimir Ticket
        </button>
        <button class="btn btn-secondary" id="sale-details-close">Cerrar</button>
      `
    });

    document.getElementById('sale-reprint-btn')?.addEventListener('click', () => {
      Modal.close();
      this.reprintTicket(sale);
    });
    document.getElementById('sale-details-close')?.addEventListener('click', () => Modal.close());
  }

  async reprintTicket(sale) {
    const settings = state.get('settings');
    const businessName = settings?.businessName || 'Mi Negocio';
    const taxRate = settings?.taxRate || '21';
    const ticketFooter = settings?.ticketFooter || 'Gracias por su compra!';

    let itemsHtml = '';
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach(item => {
        itemsHtml += `
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border-light);font-size:var(--text-sm);">
            <span>${item.quantity}x ${item.name}</span>
            <span style="font-weight:var(--font-medium);">${format(item.subtotal || (item.price * item.quantity))}</span>
          </div>
        `;
      });
    }

    const body = `
      <div style="font-family:monospace;max-width:300px;margin:0 auto;padding:20px;background:white;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:18px;font-weight:bold;">${businessName}</div>
          <div style="font-size:12px;color:#666;">Ticket #${sale.id.substring(0, 8)}</div>
          <div style="font-size:12px;color:#666;">${new Date(sale.date).toLocaleString('es-AR')}</div>
        </div>
        <div style="border-top:1px dashed #ccc;padding-top:10px;margin-bottom:10px;">
          ${itemsHtml || '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);">No hay detalles de items.</p>'}
        </div>
        <div style="border-top:1px solid var(--color-border);padding-top:var(--space-3);">
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-sm);">
            <span>Subtotal:</span>
            <span>${format(sale.subtotal || 0)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-sm);">
            <span>Descuento:</span>
            <span>-${format(sale.discount || 0)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-sm);">
            <span>Impuestos (${taxRate}%):</span>
            <span>${format(sale.tax || 0)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:var(--text-lg);border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-2);">
            <span>TOTAL:</span>
            <span>${format(sale.total || 0)}</span>
          </div>
        </div>
        <div style="text-align:center;margin-top:20px;font-size:12px;color:#666;">
          ${ticketFooter}
        </div>
      </div>
      <div style="text-align:center;margin-top:20px;">
        <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> Imprimir</button>
        <button class="btn btn-secondary" id="ticket-close-btn">Cerrar</button>
      </div>
    `;

    Modal.show({
      title: 'Ticket de Venta',
      body,
      footer: ''
    });

    requestAnimationFrame(() => {
      const closeBtn = document.getElementById('ticket-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => Modal.close());
    });
  }
}

export default new Sales();
