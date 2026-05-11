'use strict';

import cashService from './cashService.js';
import { format } from '../../utils/currency.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import state from '../../js/state.js';

class Cash {
  async load() {
    const container = document.getElementById('cash-content');
    if (container) {
      container.innerHTML = '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando caja...</div>';
    }
    try {
      await cashService.getActiveSession();
      this.render();
    } catch (error) {
      console.error('Error loading cash module:', error);
      if (container) {
        container.innerHTML = '<div style="text-align:center;padding:var(--space-8);color:var(--color-danger);"><i class="fa-solid fa-triangle-exclamation" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Error al cargar el modulo de caja</div>';
      }
    }
  }

  render() {
    const container = document.getElementById('cash-content');
    if (!container) return;

    if (cashService.currentSession) {
      this.renderOpenSession(container);
    } else {
      this.renderClosedSession(container);
    }
  }

  async renderOpenSession(container) {
    const summary = await cashService.getSessionSummary();
    if (!summary) {
      container.innerHTML = '<p>Error al cargar resumen</p>';
      return;
    }
    const s = summary;
    const movements = await cashService.getMovements();

    container.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 class="card-title">Caja Abierta</h3>
            <p class="card-subtitle">${new Date(s.session.openedAt).toLocaleString('es-AR')} · ${s.session.userName || ''}</p>
          </div>
          <span class="badge badge-success" style="font-size:var(--text-sm);padding:var(--space-1) var(--space-3);">ABIERTA</span>
        </div>
        <div class="card-body">
          <div class="cash-summary">
            <div class="cash-summary__row"><span>Monto Inicial</span><span>${format(s.initialAmount)}</span></div>
            <div class="cash-summary__row"><span>Ingresos Manuales</span><span style="color:var(--color-success);">+${format(s.manualIn)}</span></div>
            <div class="cash-summary__row"><span>Egresos Manuales</span><span style="color:var(--color-danger);">-${format(s.manualOut)}</span></div>
            <div class="cash-summary__row"><span>Ventas Efectivo</span><span>${format(s.cashSales)}</span></div>
            <div class="cash-summary__row"><span>Ventas Transferencia</span><span>${format(s.transferSales)}</span></div>
            <div class="cash-summary__row"><span>Ventas Débito</span><span>${format(s.debitSales)}</span></div>
            <div class="cash-summary__row"><span>Ventas Cuenta Corriente</span><span>${format(s.accountSales)}</span></div>
            <div class="cash-summary__divider"></div>
            <div class="cash-summary__row cash-summary__total"><span>Total Ventas</span><span>${format(s.totalSales)}</span></div>
            <div class="cash-summary__row cash-summary__expected"><span>Efectivo Esperado</span><span>${format(s.expectedTotal)}</span></div>
          </div>
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5);">
            <button class="btn btn-secondary" id="add-movement-in"><i class="fa-solid fa-plus"></i> Ingreso</button>
            <button class="btn btn-secondary" id="add-movement-out"><i class="fa-solid fa-minus"></i> Egreso</button>
            <button class="btn btn-danger" id="close-session-btn" style="margin-left:auto;"><i class="fa-solid fa-lock"></i> Cerrar Caja</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Movimientos</h3>
          <p class="card-subtitle">${movements.length} registros</p>
        </div>
        <div class="card-body">
          ${this.renderMovementsList(movements)}
        </div>
      </div>
    `;

    document.getElementById('close-session-btn')?.addEventListener('click', () => this.closeSession());
    document.getElementById('add-movement-in')?.addEventListener('click', () => this.addMovement('in'));
    document.getElementById('add-movement-out')?.addEventListener('click', () => this.addMovement('out'));
  }

  renderMovementsList(movements) {
    if (movements.length === 0) {
      return '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);text-align:center;padding:var(--space-4);">No hay movimientos registrados.</p>';
    }

    const sorted = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date));
    const colors = { opening: 'var(--color-info)', in: 'var(--color-success)', out: 'var(--color-danger)', sale: 'var(--color-primary)' };
    let html = '<div class="movements-list">';
    sorted.forEach(m => {
      const labels = { opening: 'Apertura', in: 'Ingreso', out: 'Egreso', sale: 'Venta' };
      const typeLabel = labels[m.type] || m.type;
      const typeColor = colors[m.type] || 'var(--color-text)';
      const sign = m.type === 'out' ? '-' : '+';
      html += `
        <div class="movement-item">
          <div class="movement-item__info">
            <span class="movement-item__type" style="color:${typeColor};">${typeLabel}</span>
            ${m.description ? `<span class="movement-item__desc">${m.description}</span>` : ''}
          </div>
          <div class="movement-item__amount">
            <span class="movement-item__value">${sign}${format(m.amount)}</span>
            <div class="movement-item__time">${new Date(m.date).toLocaleTimeString('es-AR')}</div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  renderClosedSession(container) {
    container.innerHTML = `
      <div class="card" style="text-align:center;">
        <div class="card-body" style="padding:var(--space-10);">
          <div style="font-size:64px;margin-bottom:var(--space-4);color:var(--color-text-muted);"><i class="fa-solid fa-cash-register"></i></div>
          <h3 style="font-size:var(--text-xl);font-weight:var(--font-semibold);margin-bottom:var(--space-2);">Caja Cerrada</h3>
          <p style="color:var(--color-text-secondary);margin-bottom:var(--space-6);max-width:400px;margin-left:auto;margin-right:auto;">No hay una sesión de caja abierta. Iniciá una nueva jornada para comenzar a operar.</p>
          <button class="btn btn-primary btn-lg" id="open-session-btn"><i class="fa-solid fa-play"></i> Abrir Caja</button>
        </div>
      </div>
    `;

    document.getElementById('open-session-btn')?.addEventListener('click', () => this.openSession());
  }

  openSession() {
    const body = `
      <div class="cash-open-modal">
        <div class="cash-open-modal__icon">
          <i class="fa-solid fa-cash-register"></i>
        </div>
        <h2 class="cash-open-modal__title">Apertura de Caja</h2>
        <p class="cash-open-modal__desc">Ingresá el monto inicial para comenzar la jornada</p>
        <div class="form-group" style="margin-top:var(--space-6);">
          <label class="form-label">Monto Inicial</label>
          <input type="number" class="form-input form-input-lg" id="initial-amount" min="0" step="0.01" placeholder="0.00" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
          <input type="text" class="form-input" id="open-cash-obs" placeholder="Ej: Inicio de turno mañana">
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="session-cancel">Cancelar</button>
      <button class="btn btn-primary" id="session-confirm">Abrir Caja</button>
    `;

    Modal.show({ title: '', body, footer });

    document.getElementById('session-cancel')?.addEventListener('click', () => Modal.close());

    document.getElementById('session-confirm')?.addEventListener('click', async () => {
      const amount = document.getElementById('initial-amount')?.value;
      const obs = document.getElementById('open-cash-obs')?.value || '';
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
        Toast.error('Error', 'Ingresá un monto inicial válido');
        return;
      }
      try {
        await cashService.openSession(amount, obs);
        Toast.success('Éxito', 'Caja abierta correctamente');
        Modal.close();
        this.render();
      } catch (error) {
        Toast.error('Error', error.message);
      }
    });
  }

  async closeSession() {
    const summary = await cashService.getSessionSummary();
    if (!summary) return;
    const s = summary;

    const body = `
      <div class="cash-summary">
        <div class="cash-summary__header">
          <div><span class="cash-summary__label">Apertura</span><span class="cash-summary__value">${new Date(s.session.openedAt).toLocaleString('es-AR')}</span></div>
          <div><span class="cash-summary__label">Responsable</span><span class="cash-summary__value">${s.session.userName || 'N/A'}</span></div>
        </div>
        <div class="cash-summary__divider"></div>
        <div class="cash-summary__row"><span>Monto Inicial</span><span>${format(s.initialAmount)}</span></div>
        <div class="cash-summary__row"><span>Ingresos Manuales</span><span style="color:var(--color-success);">+${format(s.manualIn)}</span></div>
        <div class="cash-summary__row"><span>Egresos Manuales</span><span style="color:var(--color-danger);">-${format(s.manualOut)}</span></div>
        <div class="cash-summary__divider"></div>
        <div class="cash-summary__row"><span>Ventas Efectivo</span><span>${format(s.cashSales)}</span></div>
        <div class="cash-summary__row"><span>Ventas Transferencia</span><span>${format(s.transferSales)}</span></div>
        <div class="cash-summary__row"><span>Ventas Débito</span><span>${format(s.debitSales)}</span></div>
        <div class="cash-summary__row"><span>Ventas Cuenta Corriente</span><span>${format(s.accountSales)}</span></div>
        <div class="cash-summary__row cash-summary__total"><span>Total Ventas</span><span>${format(s.totalSales)}</span></div>
        <div class="cash-summary__divider"></div>
        <div class="cash-summary__row cash-summary__expected"><span>Efectivo Esperado</span><span>${format(s.expectedTotal)}</span></div>
        <div style="margin-top:var(--space-5);">
          <label class="form-label">Monto Real Contado</label>
          <input type="number" class="form-input form-input-lg" id="close-final-amount" min="0" step="0.01" placeholder="0.00" style="font-size:var(--text-lg);font-weight:var(--font-bold);">
        </div>
        <div class="form-group">
          <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
          <input type="text" class="form-input" id="close-observation" placeholder="Motivo del cierre">
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="close-cancel">Cancelar</button>
      <button class="btn btn-danger" id="close-confirm"><i class="fa-solid fa-lock"></i> Cerrar Caja</button>
    `;

    Modal.show({ title: 'Cierre de Caja', body, footer });

    document.getElementById('close-cancel')?.addEventListener('click', () => Modal.close());

    document.getElementById('close-confirm')?.addEventListener('click', async () => {
      const finalAmount = document.getElementById('close-final-amount')?.value;
      const observation = document.getElementById('close-observation')?.value || '';
      if (!finalAmount || isNaN(parseFloat(finalAmount)) || parseFloat(finalAmount) < 0) {
        Toast.error('Error', 'Ingresá un monto final válido');
        return;
      }
      try {
        await cashService.closeSession(finalAmount, observation);
        const diff = parseFloat(finalAmount) - s.expectedTotal;
        if (Math.abs(diff) > 0.01) {
          Toast.warning('Caja Cerrada', `Diferencia: ${format(diff)}`);
        } else {
          Toast.success('Caja Cerrada', 'Cierre exitoso. Diferencia: $0.00');
        }
        Modal.close();
        this.render();
      } catch (error) {
        Toast.error('Error', error.message);
      }
    });
  }

  addMovement(type) {
    const typeLabel = type === 'in' ? 'Ingreso' : 'Egreso';
    const body = `
      <div class="form-group">
        <label class="form-label">Monto</label>
        <input type="number" class="form-input" id="movement-amount" min="0" step="0.01" placeholder="0.00" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
        <input type="text" class="form-input" id="movement-desc" placeholder="Motivo del movimiento">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="mov-cancel">Cancelar</button>
      <button class="btn btn-primary" id="mov-confirm">Registrar ${typeLabel}</button>
    `;

    Modal.show({ title: `Nuevo ${typeLabel}`, body, footer });

    document.getElementById('mov-cancel')?.addEventListener('click', () => Modal.close());

    document.getElementById('mov-confirm')?.addEventListener('click', async () => {
      const amount = document.getElementById('movement-amount')?.value;
      const description = document.getElementById('movement-desc')?.value || '';
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        Toast.error('Error', 'Ingresá un monto válido');
        return;
      }
      try {
        await cashService.addMovement(type, amount, description);
        Toast.success('Éxito', `${typeLabel} registrado correctamente`);
        Modal.close();
        this.render();
      } catch (error) {
        Toast.error('Error', error.message);
      }
    });
  }
}

export default new Cash();
