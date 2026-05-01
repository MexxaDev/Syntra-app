'use strict';

import { customerRepo, saleRepo } from '../../db/repositories.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { validateCustomer } from '../../utils/validators.js';

class Customers {
  constructor() {
    this.customers = [];
  }

  async load() {
    const container = document.getElementById('customers-content') || document.getElementById('customers');
    if (container) {
      container.innerHTML = '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando clientes...</div>';
    }
    this.customers = await customerRepo.findAll();
    this.render();
  }

  render() {
    const container = document.getElementById('customers') || document.getElementById('customers-content');
    if (!container) return;

    let listContainer = container.querySelector('#customers-list') || container.querySelector('.table-container');

    if (!listContainer) {
      if (container.id === 'customers-content') {
        listContainer = container;
      } else {
        const div = document.createElement('div');
        div.id = 'customers-list';
        container.appendChild(div);
        listContainer = div;
      }
    }

    if (this.customers.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-users"></i></div>
          <h3 class="empty-state__title">No hay clientes</h3>
          <p class="empty-state__description">Agregá tu primer cliente.</p>
          <button class="btn btn-primary" id="add-first-customer">+ Nuevo Cliente</button>
        </div>
      `;
      document.getElementById('add-first-customer')?.addEventListener('click', () => this.openModal());
      return;
    }

    let html = `
      <div class="products-toolbar">
        <div class="products-search">
          <input type="text" class="form-input" placeholder="Buscar clientes..." id="customer-search">
        </div>
        <button class="btn btn-primary" id="add-customer-btn">+ Nuevo Cliente</button>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Dirección</th>
              <th>Saldo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.customers.forEach((customer, index) => {
      const saldo = parseFloat(customer.balance) || 0;
      html += `
        <tr data-index="${index}">
          <td>${customer.name}</td>
          <td>${customer.phone || '-'}</td>
          <td>${customer.address || '-'}</td>
          <td style="font-weight:var(--font-semibold);">$${saldo.toFixed(2)}</td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost" data-action="add-balance" data-index="${index}">+ Saldo</button>
              <button class="btn btn-sm btn-ghost" data-action="edit" data-index="${index}">Editar</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-index="${index}">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    listContainer.innerHTML = html;

    document.getElementById('add-customer-btn')?.addEventListener('click', () => this.openModal());
    document.getElementById('customer-search')?.addEventListener('input', (e) => this.search(e.target.value));

    listContainer.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index);
        const customer = this.customers[index];

        if (action === 'edit') this.openModal(customer);
        else if (action === 'delete') this.deleteCustomer(customer.id);
        else if (action === 'add-balance') this.openAddBalance(customer);
      });
    });
  }

  search(query) {
    if (!query) {
      this.render();
      return;
    }
    const filtered = this.customers.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.phone && c.phone.includes(query))
    );
    const prevData = this.customers;
    this.customers = filtered;
    this.render();
    this.customers = prevData;
  }

  openModal(customer = null) {
    const isEdit = !!customer;
    const title = isEdit ? 'Editar Cliente' : 'Nuevo Cliente';

    const body = `
      <div class="form-group">
        <label class="form-label">Nombre</label>
        <input type="text" class="form-input" id="cust-name" value="${customer ? customer.name : ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Teléfono</label>
        <input type="text" class="form-input" id="cust-phone" value="${customer ? customer.phone : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Dirección</label>
        <input type="text" class="form-input" id="cust-address" value="${customer ? customer.address : ''}">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="cust-cancel">Cancelar</button>
      <button class="btn btn-primary" id="cust-save">Guardar</button>
    `;

    Modal.show({ title, body, footer });

    document.getElementById('cust-cancel').addEventListener('click', () => Modal.close());

    document.getElementById('cust-save').addEventListener('click', async () => {
      const name = document.getElementById('cust-name').value;
      const phone = document.getElementById('cust-phone').value;
      const address = document.getElementById('cust-address').value;

      const errors = validateCustomer({ name });
      if (errors.length) {
        Toast.error('Error', errors[0]);
        return;
      }

      try {
        if (isEdit) {
          await customerRepo.update({ ...customer, name, phone, address });
          Toast.success('Éxito', 'Cliente actualizado');
        } else {
          await customerRepo.create({
            id: `cust_${Date.now()}`,
            name, phone, address,
            balance: 0,
            createdAt: new Date().toISOString()
          });
          Toast.success('Éxito', 'Cliente creado');
        }
        Modal.close();
        this.load();
      } catch (error) {
        Toast.error('Error', 'No se pudo guardar el cliente');
      }
    });
  }

  openAddBalance(customer) {
    const body = `
      <div style="margin-bottom:var(--space-3);">
        <strong>${customer.name}</strong><br>
        <span style="color:var(--color-text-secondary);font-size:var(--text-sm);">Saldo actual: $${(customer.balance || 0).toFixed(2)}</span>
      </div>
      <div class="form-group">
        <label class="form-label">Monto a agregar</label>
        <input type="number" class="form-input" id="balance-amount" min="0" step="0.01" placeholder="0.00">
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="bal-cancel">Cancelar</button>
      <button class="btn btn-primary" id="bal-save">Agregar</button>
    `;

    Modal.show({ title: 'Agregar Saldo', body, footer });

    document.getElementById('bal-cancel').addEventListener('click', () => Modal.close());

    document.getElementById('bal-save').addEventListener('click', async () => {
      const amount = parseFloat(document.getElementById('balance-amount').value);
      if (!amount || amount <= 0) {
        Toast.error('Error', 'Ingresá un monto válido');
        return;
      }

      try {
        customer.balance = (customer.balance || 0) + amount;
        await customerRepo.update(customer);
        Toast.success('Éxito', `Se agregaron $${amount.toFixed(2)} al saldo`);
        Modal.close();
        this.load();
      } catch (error) {
        Toast.error('Error', 'No se pudo actualizar el saldo');
      }
    });
  }

  async deleteCustomer(id) {
    Modal.show({
      title: 'Confirmar Eliminación',
      body: '<p>¿Estás seguro de eliminar este cliente?</p>',
      footer: `
        <button class="btn btn-secondary" id="cancel-del-cust">Cancelar</button>
        <button class="btn btn-danger" id="confirm-del-cust">Eliminar</button>
      `
    });
    document.getElementById('cancel-del-cust')?.addEventListener('click', () => Modal.close());
    document.getElementById('confirm-del-cust')?.addEventListener('click', async () => {
      try {
        const sales = await saleRepo.query('customerId', id);
        if (sales && sales.length > 0) {
          Toast.error('Error', 'No se puede eliminar: el cliente tiene ventas asociadas');
          Modal.close();
          return;
        }
        await customerRepo.delete(id);
        Toast.success('Éxito', 'Cliente eliminado');
        Modal.close();
        this.load();
      } catch (error) {
        Toast.error('Error', 'No se pudo eliminar el cliente');
      }
    });
  }
}

export default new Customers();
