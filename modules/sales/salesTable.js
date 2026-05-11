'use strict';

import Modal from '../../components/modal.js';
import { format } from '../../utils/currency.js';
import { getPayments, getPaymentType, getPaymentMethodLabel } from '../../utils/payments.js';
import { renderTicketBody, showTicketModal } from '../../utils/ticket.js';
import state from '../../js/state.js';

export const SALES_COLUMNS = [
  { key: '_id', label: 'ID' },
  { key: '_date', label: 'Fecha' },
  { key: '_customer', label: 'Cliente' },
  { key: '_total', label: 'Total', format: (val) => `<strong>${val}</strong>` },
  { key: '_method', label: 'Método' }
];

export const SALES_ACTIONS = [
  { name: 'view', label: 'Ver', class: 'btn-ghost', icon: 'fa-solid fa-eye', onClick: (row) => showSaleDetail(row) }
];

export function prepareSaleRows(sales, customers) {
  const cust = customers || [];
  return (sales || []).map(sale => {
    const customer = sale.customerId ? cust.find(c => c.id === sale.customerId) : null;
    const paymentType = getPaymentType(sale);
    const methodBadge = paymentType === 'COMBINADO'
      ? '<span class="badge badge-warning">COMBINADO</span>'
      : `<span class="badge badge-primary">${getPaymentMethodLabel(sale.paymentMethod)}</span>`;

    return {
      _id: sale.id ? sale.id.substring(0, 8) : 'N/A',
      _date: sale.date ? new Date(sale.date).toLocaleString('es-AR') : 'N/A',
      _customer: customer ? customer.name : 'Consumidor Final',
      _total: format(sale.total),
      _method: methodBadge,
      _sale: sale,
      _customers: cust
    };
  });
}

export function showSaleDetail(row) {
  const sale = row._sale;
  const customers = row._customers || [];
  const customer = sale.customerId ? customers.find(c => c.id === sale.customerId) : null;

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

  const payments = getPayments(sale);
  const paymentType = getPaymentType(sale);

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
      <div style="margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px dashed var(--color-border-light);">
        <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-bottom:var(--space-1);font-weight:var(--font-semibold);">MÉTODOS DE PAGO</div>
        ${payments.map(p => `
          <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);">
            <span>${getPaymentMethodLabel(p.method)}</span>
            <span>${format(p.amount)}</span>
          </div>
        `).join('')}
        ${paymentType === 'COMBINADO' ? `<div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:var(--space-1);text-align:right;">Tipo: COMBINADO</div>` : ''}
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
    reprintSaleTicket(sale);
  });
  document.getElementById('sale-details-close')?.addEventListener('click', () => Modal.close());
}

export function reprintSaleTicket(sale) {
  const settings = state.get('settings');
  const body = renderTicketBody(sale, settings);
  showTicketModal('Ticket de Venta', body);
}
