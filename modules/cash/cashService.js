'use strict';

import { cashSessionRepo, cashMovementRepo, saleRepo } from '../../db/repositories.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { getPayments, getMethodTotal } from '../../utils/payments.js';
import state from '../../js/state.js';

class CashService {
  constructor() {
    this.currentSession = null;
  }

  async getActiveSession() {
    try {
      const sessions = await cashSessionRepo.findAll();
      this.currentSession = sessions.find(s => !s.closedAt) || null;
    } catch {
      this.currentSession = null;
    }
    return this.currentSession;
  }

  async requireActiveSession() {
    await this.getActiveSession();
    if (!this.currentSession) {
      await this._showForcedOpenModal();
    }
    return this.currentSession;
  }

  async openSession(initialAmount, observation = '') {
    if (this.currentSession) {
      throw new Error('Ya hay una sesión de caja abierta');
    }
    const amount = parseFloat(initialAmount);
    if (isNaN(amount) || amount < 0) {
      throw new Error('Monto inicial inválido');
    }
    const user = state.get('currentUser');
    const session = {
      id: `session_${Date.now()}`,
      initialAmount: amount,
      openedAt: new Date().toISOString(),
      closedAt: null,
      finalAmount: null,
      userId: user?.id,
      userName: user?.name,
      observation: observation || ''
    };
    await cashSessionRepo.create(session);
    this.currentSession = session;

    await cashMovementRepo.create({
      id: `mov_${Date.now()}_open`,
      sessionId: session.id,
      type: 'opening',
      amount: amount,
      description: observation || 'Apertura de caja',
      date: new Date().toISOString(),
      userId: user?.id
    });

    return session;
  }

  async closeSession(finalAmount, observation = '') {
    if (!this.currentSession) {
      throw new Error('No hay sesión de caja abierta');
    }
    const amount = parseFloat(finalAmount);
    if (isNaN(amount) || amount < 0) {
      throw new Error('Monto final inválido');
    }
    this.currentSession.closedAt = new Date().toISOString();
    this.currentSession.finalAmount = amount;
    this.currentSession.closeObservation = observation || '';
    await cashSessionRepo.update(this.currentSession);
    this.currentSession = null;
  }

  async addMovement(type, amount, description = '') {
    if (!this.currentSession) {
      throw new Error('No hay sesión de caja abierta');
    }
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      throw new Error('Monto inválido');
    }
    const user = state.get('currentUser');
    const movement = {
      id: `mov_${Date.now()}`,
      sessionId: this.currentSession.id,
      type,
      amount: value,
      description: description || '',
      date: new Date().toISOString(),
      userId: user?.id
    };
    await cashMovementRepo.create(movement);
    return movement;
  }

  async recordSale(sale) {
    if (!this.currentSession) return;
    const user = state.get('currentUser');
    const payments = getPayments(sale);
    for (const p of payments) {
      await cashMovementRepo.create({
        id: `mov_${Date.now()}_sale_${sale.id.substring(0, 8)}_${p.method}`,
        sessionId: this.currentSession.id,
        type: 'sale',
        paymentMethod: p.method,
        amount: p.amount,
        description: `Venta #${sale.id.substring(0, 8)} ${p.method}`,
        date: new Date().toISOString(),
        userId: user?.id,
        saleId: sale.id
      });
    }
  }

  async getMovements() {
    if (!this.currentSession) return [];
    try {
      return await cashMovementRepo.query('sessionId', this.currentSession.id) || [];
    } catch {
      return [];
    }
  }

  async getSessionSummary() {
    if (!this.currentSession) return null;
    const movements = await this.getMovements();
    const allSales = await saleRepo.findAll() || [];
    const sessionSales = allSales.filter(s => s.sessionId === this.currentSession.id);

    const opening = movements.find(m => m.type === 'opening');
    const initialAmount = opening ? parseFloat(opening.amount) : (parseFloat(this.currentSession.initialAmount) || 0);
    const manualIn = movements.filter(m => m.type === 'in').reduce((s, m) => s + parseFloat(m.amount), 0);
    const manualOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + parseFloat(m.amount), 0);
    const cashSales = sessionSales.reduce((s, sale) => s + getMethodTotal(sale, 'cash'), 0);
    const transferSales = sessionSales.reduce((s, sale) => s + getMethodTotal(sale, 'transfer'), 0);
    const debitSales = sessionSales.reduce((s, sale) => s + getMethodTotal(sale, 'debit'), 0);
    const accountSales = sessionSales.reduce((s, sale) => s + getMethodTotal(sale, 'account'), 0);
    const totalSales = sessionSales.reduce((s, sale) => s + parseFloat(sale.total), 0);
    const expectedTotal = initialAmount + manualIn - manualOut + cashSales;

    return {
      initialAmount, manualIn, manualOut,
      cashSales, transferSales, debitSales, accountSales,
      totalSales, expectedTotal,
      session: this.currentSession,
      movements, salesCount: sessionSales.length
    };
  }

  _showForcedOpenModal() {
    return new Promise((resolve) => {
      const body = `
        <div class="cash-open-modal">
          <div class="cash-open-modal__icon">
            <i class="fa-solid fa-cash-register"></i>
          </div>
          <h2 class="cash-open-modal__title">Apertura de Caja</h2>
          <p class="cash-open-modal__desc">Ingresá el monto inicial para comenzar la jornada</p>
          <div class="form-group" style="margin-top:var(--space-6);">
            <label class="form-label">Monto Inicial</label>
            <input type="number" class="form-input form-input-lg" id="open-cash-amount" min="0" step="0.01" placeholder="0.00" autofocus>
          </div>
          <div class="form-group">
            <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
            <input type="text" class="form-input" id="open-cash-obs" placeholder="Ej: Inicio de turno mañana">
          </div>
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-6);">
            <button class="btn btn-secondary btn-lg" id="open-cash-cancel" style="flex:1;">
              <i class="fa-solid fa-arrow-left"></i> Salir del POS
            </button>
            <button class="btn btn-primary btn-lg" id="open-cash-confirm" style="flex:1;">
              <i class="fa-solid fa-check"></i> Abrir Caja
            </button>
          </div>
        </div>
      `;

      Modal.show({
        title: '',
        body,
        footer: '',
        closable: false
      });

      document.getElementById('open-cash-confirm').onclick = async () => {
        const amount = document.getElementById('open-cash-amount')?.value;
        const obs = document.getElementById('open-cash-obs')?.value || '';
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
          Toast.error('Error', 'Ingresá un monto inicial válido');
          return;
        }
        try {
          await this.openSession(amount, obs);
          Toast.success('Éxito', 'Caja abierta correctamente');
          Modal.close();
          resolve();
        } catch (err) {
          Toast.error('Error', err.message);
        }
      };

      document.getElementById('open-cash-cancel').onclick = () => {
        Modal.close();
        window.location.hash = 'dashboard';
        resolve();
      };
    });
  }
}

export default new CashService();
