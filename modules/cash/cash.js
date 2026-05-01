'use strict';

import { cashSessionRepo, cashMovementRepo, saleRepo } from '../../db/repositories.js';
import { format } from '../../utils/currency.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import state from '../../js/state.js';

class Cash {
  constructor() {
    this.currentSession = null;
    this.movements = [];
    this.sales = [];
  }

  async load() {
    const container = document.getElementById('cash-content');
    if (container) {
      container.innerHTML = '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando caja...</div>';
    }
    try {
      await this.checkCurrentSession();
      await this.loadMovements();
      this.render();
    } catch (error) {
      console.error('Error loading cash module:', error);
      if (container) {
        container.innerHTML = '<div style="text-align:center;padding:var(--space-8);color:var(--color-danger);"><i class="fa-solid fa-triangle-exclamation" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Error al cargar el modulo de caja</div>';
      }
    }
  }

  async checkCurrentSession() {
    try {
      const sessions = await cashSessionRepo.findAll();
      this.currentSession = sessions.find(s => !s.closedAt) || null;
      this.sales = await saleRepo.findAll() || [];
    } catch (error) {
      console.error('Error checking cash session:', error);
      this.currentSession = null;
      this.sales = [];
    }
  }

  async loadMovements() {
    if (!this.currentSession || !this.currentSession.id) {
      this.movements = [];
      return;
    }
    try {
      this.movements = await cashMovementRepo.query('sessionId', this.currentSession.id) || [];
    } catch (error) {
      console.error('Error loading movements:', error);
      this.movements = [];
    }
  }

  render() {
    const container = document.getElementById('cash-content');
    if (!container) return;

    if (this.currentSession) {
      this.renderOpenSession(container);
    } else {
      this.renderClosedSession(container);
    }
  }

  renderOpenSession(container) {
    const cashSales = this.sales.filter(s =>
      s.paymentMethod === 'cash' &&
      s.date &&
      this.currentSession.openedAt &&
      s.date >= this.currentSession.openedAt
    );
    const expectedCash = cashSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const movementsIn = this.movements
      .filter(m => m.type === 'in')
      .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    const movementsOut = this.movements
      .filter(m => m.type === 'out')
      .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    const expectedTotal = (parseFloat(this.currentSession.initialAmount) || 0) + expectedCash + movementsIn - movementsOut;

    container.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card-header">
          <h3 class="card-title">Caja Abierta</h3>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-4);">
            <div>
              <div style="font-size:var(--text-sm);color:var(--color-text-secondary);">Apertura</div>
              <div style="font-weight:var(--font-semibold);">${new Date(this.currentSession.openedAt).toLocaleString('es-AR')}</div>
            </div>
            <div>
              <div style="font-size:var(--text-sm);color:var(--color-text-secondary);">Monto Inicial</div>
              <div style="font-weight:var(--font-bold);font-size:var(--text-lg);">${format(parseFloat(this.currentSession.initialAmount) || 0)}</div>
            </div>
            <div>
              <div style="font-size:var(--text-sm);color:var(--color-text-secondary);">Ventas Efectivo</div>
              <div style="font-weight:var(--font-semibold);">${format(expectedCash)}</div>
            </div>
            <div>
              <div style="font-size:var(--text-sm);color:var(--color-text-secondary);">Efectivo Esperado</div>
              <div style="font-weight:var(--font-bold);font-size:var(--text-lg);color:var(--color-primary);">${format(expectedTotal)}</div>
            </div>
          </div>
          <button class="btn btn-danger" id="close-session-btn">Cerrar Caja</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:var(--space-6);">
        <div class="card-header">
          <h3 class="card-title">Movimientos de Caja</h3>
        </div>
        <div class="card-body">
          <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);">
            <button class="btn btn-sm btn-primary" id="add-movement-in">+ Ingreso</button>
            <button class="btn btn-sm btn-secondary" id="add-movement-out">+ Egreso</button>
          </div>
          ${this.renderMovementsList()}
        </div>
      </div>
    `;

    document.getElementById('close-session-btn')?.addEventListener('click', () => this.closeSession(expectedTotal));
    document.getElementById('add-movement-in')?.addEventListener('click', () => this.addMovement('in'));
    document.getElementById('add-movement-out')?.addEventListener('click', () => this.addMovement('out'));
  }

  renderMovementsList() {
    if (this.movements.length === 0) {
      return '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);">No hay movimientos registrados.</p>';
    }

    let html = '<div style="display:flex;flex-direction:column;gap:var(--space-2);">';
    this.movements.forEach(m => {
      const typeLabel = m.type === 'in' ? 'Ingreso' : 'Egreso';
      const typeColor = m.type === 'in' ? 'var(--color-success)' : 'var(--color-danger)';
      html += `
        <div style="display:flex;justify-content:space-between;padding:var(--space-2);background:var(--color-gray-50);border-radius:var(--radius-md);font-size:var(--text-sm);">
          <div>
            <span style="color:${typeColor};font-weight:var(--font-medium);">${typeLabel}</span>
            ${m.description ? `<span style="color:var(--color-text-secondary);margin-left:var(--space-2);">${m.description}</span>` : ''}
          </div>
          <span style="font-weight:var(--font-semibold);">${m.type === 'in' ? '+' : '-'}${format(m.amount)}</span>
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  renderClosedSession(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Caja Cerrada</h3>
        </div>
        <div class="card-body" style="text-align:center;padding:var(--space-8);">
          <div style="font-size:48px;margin-bottom:var(--space-4);"><i class="fa-solid fa-cash-register"></i></div>
          <p style="color:var(--color-text-secondary);margin-bottom:var(--space-4);">No hay una sesion de caja abierta.</p>
          <button class="btn btn-primary" id="open-session-btn">Abrir Caja</button>
        </div>
      </div>
    `;

    document.getElementById('open-session-btn')?.addEventListener('click', () => this.openSession());
  }

  openSession() {
    const body = `
      <div class="form-group">
        <label class="form-label">Monto Inicial</label>
        <input type="number" class="form-input" id="initial-amount" min="0" step="0.01" placeholder="0.00">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="session-cancel">Cancelar</button>
      <button class="btn btn-primary" id="session-confirm">Abrir Caja</button>
    `;

    Modal.show({ title: 'Abrir Caja', body, footer });

    document.getElementById('session-cancel')?.addEventListener('click', () => Modal.close());

    document.getElementById('session-confirm')?.addEventListener('click', async () => {
      const amount = parseFloat(document.getElementById('initial-amount')?.value) || 0;

      try {
        this.currentSession = {
          id: `session_${Date.now()}`,
          initialAmount: amount,
          openedAt: new Date().toISOString(),
          closedAt: null,
          finalAmount: null,
          userId: state.get('currentUser')?.id
        };
        await cashSessionRepo.create(this.currentSession);
        Toast.success('Exito', 'Caja abierta correctamente');
        Modal.close();
        this.render();
      } catch (error) {
        Toast.error('Error', 'No se pudo abrir la caja');
      }
    });
  }

  closeSession(expectedTotal) {
    const body = `
      <div class="form-group">
        <label class="form-label">Monto Final Contado</label>
        <input type="number" class="form-input" id="final-amount" min="0" step="0.01" placeholder="0.00">
      </div>
      <div style="background:var(--color-gray-50);padding:var(--space-3);border-radius:var(--radius-md);margin-top:var(--space-3);font-size:var(--text-sm);">
        <div style="display:flex;justify-content:space-between;">
          <span>Efectivo Esperado:</span>
          <span>${format(expectedTotal)}</span>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="close-cancel">Cancelar</button>
      <button class="btn btn-danger" id="close-confirm">Cerrar Caja</button>
    `;

    Modal.show({ title: 'Cerrar Caja', body, footer });

    document.getElementById('close-cancel')?.addEventListener('click', () => Modal.close());

    document.getElementById('close-confirm')?.addEventListener('click', async () => {
      const finalAmount = parseFloat(document.getElementById('final-amount')?.value) || 0;
      const difference = finalAmount - expectedTotal;

      try {
        this.currentSession.closedAt = new Date().toISOString();
        this.currentSession.finalAmount = finalAmount;
        await cashSessionRepo.update(this.currentSession);

        Toast.success('Exito', `Caja cerrada. Diferencia: ${format(difference)}`);
        this.currentSession = null;
        Modal.close();
        this.render();
      } catch (error) {
        Toast.error('Error', 'No se pudo cerrar la caja');
      }
    });
  }

  addMovement(type) {
    const typeLabel = type === 'in' ? 'Ingreso' : 'Egreso';
    const body = `
      <div class="form-group">
        <label class="form-label">Monto</label>
        <input type="number" class="form-input" id="movement-amount" min="0" step="0.01" placeholder="0.00">
      </div>
      <div class="form-group">
        <label class="form-label">Descripcion (opcional)</label>
        <input type="text" class="form-input" id="movement-desc" placeholder="Motivo del movimiento">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="mov-cancel">Cancelar</button>
      <button class="btn btn-primary" id="mov-confirm">Registrar</button>
    `;

    Modal.show({ title: `Nuevo ${typeLabel}`, body, footer });

    document.getElementById('mov-cancel')?.addEventListener('click', () => Modal.close());

    document.getElementById('mov-confirm')?.addEventListener('click', async () => {
      const amount = parseFloat(document.getElementById('movement-amount')?.value) || 0;
      const description = document.getElementById('movement-desc')?.value || '';

      if (amount <= 0) {
        Toast.error('Error', 'Inresa un monto valido');
        return;
      }

      try {
        await cashMovementRepo.create({
          id: `mov_${Date.now()}`,
          sessionId: this.currentSession.id,
          type,
          amount,
          description,
          date: new Date().toISOString()
        });

        Toast.success('Exito', `${typeLabel} registrado`);
        Modal.close();
        await this.loadMovements();
        this.render();
      } catch (error) {
        Toast.error('Error', 'No se pudo registrar el movimiento');
      }
    });
  }
}

export default new Cash();
