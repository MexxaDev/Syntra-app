'use strict';

import { productRepo, customerRepo, saleRepo, saleItemRepo, categoryRepo } from '../../db/repositories.js';
import Toast from '../../components/toast.js';
import Modal from '../../components/modal.js';
import state from '../../js/state.js';
import { format } from '../../utils/currency.js';
import { getProductImage } from '../../utils/imageHelper.js';
import { PAYMENT_METHODS, getPaymentMethodLabel, getPayments, getPaymentType, validatePayments } from '../../utils/payments.js';
import { renderTicketBody, showTicketModal } from '../../utils/ticket.js';
import cashService from '../cash/cashService.js';

class POS {
  constructor() {
    this.cart = [];
    this.products = [];
    this.categories = [];
    this.customers = [];
    this.currentCustomer = null;
    this.currentCategory = null;
    this.discount = 0;
    this.discountType = 'percent';
    this.payments = [{ method: 'cash', amount: 0 }];
    this._isProcessing = false;
  }

  async loadProducts() {
    await cashService.requireActiveSession();

    const [products, customers, categories] = await Promise.all([
      productRepo.findAll(),
      customerRepo.findAll(),
      categoryRepo.findAll()
    ]);

    this.products = products;
    this.categories = categories;
    this.customers = customers;

    this.renderProducts();
    this._injectCategoryPills();
    this.renderCart();
    this.renderCustomerSelect();
    this.setupBarcodeInput();
    this._renderPaymentUI();
    this._injectCashButton();
  }

  _injectCategoryPills() {
    const container = document.querySelector('.pos-products');
    if (!container) return;

    let pillsContainer = document.getElementById('pos-category-pills');
    if (pillsContainer) {
      pillsContainer.remove();
    }

    pillsContainer = document.createElement('div');
    pillsContainer.id = 'pos-category-pills';
    pillsContainer.className = 'pos-category-pills';

    pillsContainer.innerHTML = `
      <button class="pos-category-pill ${!this.currentCategory ? 'active' : ''}" data-category-id="all">Todos</button>
      ${this.categories.map(cat => `
        <button class="pos-category-pill ${this.currentCategory === cat.id ? 'active' : ''}" data-category-id="${cat.id}">${cat.name}</button>
      `).join('')}
    `;

    const searchBar = container.querySelector('.pos-search-bar');
    const productList = document.getElementById('pos-product-list');
    if (searchBar && productList) {
      searchBar.after(pillsContainer);
    } else {
      container.insertBefore(pillsContainer, productList);
    }

    pillsContainer.querySelectorAll('.pos-category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const categoryId = pill.dataset.categoryId;
        this.currentCategory = categoryId === 'all' ? null : categoryId;

        pillsContainer.querySelectorAll('.pos-category-pill').forEach(p => {
          p.classList.remove('active');
        });
        pill.classList.add('active');

        this.renderProducts();
      });
    });
  }

  setupBarcodeInput() {
    const barcodeInput = document.getElementById('pos-barcode-input');
    if (!barcodeInput) return;

    setTimeout(() => barcodeInput.focus(), 100);

    let timeout;
    barcodeInput.oninput = (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const code = e.target.value.trim();
        if (code.length > 2) {
          this.searchBarcode(code);
        }
      }, 100);
    };

    barcodeInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = barcodeInput.value.trim();
        if (code) {
          this.searchBarcode(code);
        }
      }
    };
  }

  async searchBarcode(code) {
    const barcodeInput = document.getElementById('pos-barcode-input');
    let product = this.products.find(p =>
      (p.barcode && p.barcode === code) || p.id === code
    );

    if (!product) {
      product = this.products.find(p =>
        p.sku && p.sku === code
      );
    }

    if (product) {
      this.addToCart(product.id);
      if (barcodeInput) {
        barcodeInput.value = '';
        barcodeInput.focus();
      }
      Toast.success('Agregado', `${product.name} agregado al carrito`);
    } else {
      Toast.error('No encontrado', `Producto con código "${code}" no encontrado`);
      if (barcodeInput) {
        barcodeInput.value = '';
        barcodeInput.focus();
      }
    }
  }

  renderProducts() {
    const container = document.getElementById('pos-product-list');
    if (!container) return;

    const searchInput = document.querySelector('.pos-search-bar .form-input');
    const query = searchInput ? searchInput.value.toLowerCase() : '';

    let products = this.products;
    if (query) {
      products = products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.includes(query))
      );
    }
    if (this.currentCategory) {
      products = products.filter(p => p.categoryId === this.currentCategory);
    }

    if (products.length === 0) {
      container.innerHTML = '<p class="pos-cart-empty" style="padding:var(--space-4);">No hay productos disponibles.</p>';
      return;
    }

    const placeholder = getProductImage({ name: 'Product', image: '' }, []);

    container.innerHTML = products.map(product => {
      const imageSrc = getProductImage(product, this.categories);
      return `
        <div class="pos-product-card" data-id="${product.id}">
          <div class="pos-product-card__image">
            <img src="${imageSrc}" alt="${product.name}" loading="lazy" onerror="this.onerror=null;this.src='${placeholder}';">
          </div>
          <div class="pos-product-card__name">${product.name}</div>
          <div class="pos-product-card__price">${format(product.price)}</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.pos-product-card').forEach(card => {
      card.addEventListener('click', () => {
        const productId = card.dataset.id;
        this.addToCart(productId);
      });
    });

    if (searchInput) {
      let timeout;
      searchInput.oninput = (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.renderProducts(), 300);
      };
    }
  }

  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const existing = this.cart.find(item => item.id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({ ...product, quantity: 1 });
    }
    this.renderCart();
  }

  renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = '<div class="pos-cart-empty"><i class="fa-solid fa-cart-shopping"></i>El carrito está vacío</div>';
      this.updateTotal();
      return;
    }

    const placeholder = getProductImage({ name: 'Product', image: '' }, []);

    container.innerHTML = this.cart.map((item, index) => {
      const imageSrc = getProductImage(item, this.categories);
      return `
        <div class="pos-cart-item">
          <div class="pos-cart-item__image">
            <img src="${imageSrc}" alt="${item.name}" loading="lazy" onerror="this.onerror=null;this.src='${placeholder}';">
          </div>
          <div class="pos-cart-item__info">
            <div class="pos-cart-item__name">${item.name}</div>
            <div class="pos-cart-item__price">${format(item.price)} x ${item.quantity}</div>
          </div>
          <div class="pos-cart-item__actions">
            <button class="pos-cart-item__btn pos-cart-item__btn--remove" data-index="${index}">&minus;</button>
            <span class="pos-cart-item__qty">${item.quantity}</span>
            <button class="pos-cart-item__btn pos-cart-item__btn--add" data-index="${index}">+</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.pos-cart-item__btn--remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.removeFromCart(idx);
      });
    });

    container.querySelectorAll('.pos-cart-item__btn--add').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.cart[idx].quantity += 1;
        this.renderCart();
      });
    });

    this.updateTotal();
  }

  removeFromCart(index) {
    if (this.cart[index].quantity > 1) {
      this.cart[index].quantity -= 1;
    } else {
      this.cart.splice(index, 1);
    }
    this.renderCart();
  }

  renderCustomerSelect() {
    const container = document.getElementById('pos-customer-select');
    if (!container) return;

    let options = '<option value="">Consumidor Final</option>';
    options += this.customers.map(c => {
      const saldo = c.balance || 0;
      return `<option value="${c.id}" data-balance="${saldo}">${c.name} (Saldo: ${format(saldo)})</option>`;
    }).join('');

    container.innerHTML = options;

    container.onchange = (e) => {
      const customerId = e.target.value;
      this.currentCustomer = customerId ? this.customers.find(c => c.id === customerId) : null;
      this.updateCustomerInfo();
    };
  }

  updateCustomerInfo() {
    const infoContainer = document.getElementById('customer-info');
    if (!infoContainer) return;

    if (this.currentCustomer) {
      infoContainer.innerHTML = `Saldo: <strong>${format(this.currentCustomer.balance || 0)}</strong>`;
    } else {
      infoContainer.innerHTML = '';
    }
  }

  updateTotal() {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = this.discountType === 'percent'
      ? subtotal * (this.discount / 100)
      : this.discount;
    const total = subtotal - discountAmount;

    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount');
    const totalEl = document.getElementById('cart-total');

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (discountEl) discountEl.textContent = `-$${discountAmount.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    if (this.payments.length === 1) {
      this.payments[0].amount = total;
    }

    this._updatePaymentSummary();
  }

  setDiscount(type, value) {
    this.discountType = type;
    this.discount = parseFloat(value) || 0;
    this.updateTotal();
  }

  _getTotal() {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = this.discountType === 'percent'
      ? subtotal * (this.discount / 100)
      : this.discount;
    return subtotal - discountAmount;
  }

  _renderPaymentUI() {
    const container = document.querySelector('.pos-cart-footer');
    if (!container) return;

    const existing = document.getElementById('pos-multi-payment');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'pos-multi-payment';

    const total = this._getTotal();

    if (this.payments.length === 1) {
      this.payments[0].amount = total;
    }

    const paid = this.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, total - paid);

    wrapper.innerHTML = `
      <div id="payment-status-bar">
        <div class="payment-status">
          <span class="payment-status__label">Total a cobrar:</span>
          <span class="payment-status__value" id="payment-total-display">${format(total)}</span>
        </div>
        <div class="payment-status">
          <span class="payment-status__label">Ingresado:</span>
          <span class="payment-status__value" id="payment-paid-display">${format(paid)}</span>
        </div>
        <div class="payment-status">
          <span class="payment-status__label">Restante:</span>
          <span class="payment-status__remaining ${remaining <= 0.01 ? 'paid' : ''}" id="payment-remaining-display">${format(remaining)}</span>
        </div>
        ${remaining > 0.01 ? `<div class="payment-progress"><div class="payment-progress__bar" style="width:${total > 0 ? Math.min(100, (paid / total) * 100) : 0}%;background:var(--color-primary);"></div></div>` : ''}
        <div class="payment-divider"></div>
      </div>
      <div id="payment-rows">
        ${this._renderPaymentRows()}
      </div>
      <div class="payment-btn-group">
        <button class="btn btn-ghost btn-sm payment-add-btn" id="add-payment-btn">
          <i class="fa-solid fa-plus"></i> Agregar método
        </button>
        <button class="btn btn-ghost btn-sm" id="reset-payments-btn">
          <i class="fa-solid fa-rotate-left"></i>
        </button>
      </div>
    `;

    const confirmBtn = document.getElementById('confirm-sale-btn');
    container.insertBefore(wrapper, confirmBtn);

    document.getElementById('add-payment-btn').onclick = () => {
      this.payments.push({ method: 'cash', amount: 0 });
      this._updatePaymentUI();
    };

    document.getElementById('reset-payments-btn').onclick = () => {
      this.payments = [{ method: 'cash', amount: 0 }];
      this._updatePaymentUI();
    };

    this._attachPaymentRowEvents();
    this._updatePaymentUI();
  }

  _renderPaymentRows() {
    return this.payments.map((p, i) => {
      const paid = this.payments.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
      const total = this._getTotal();
      const isCash = p.method === 'cash';
      const allCash = this.payments.every(x => x.method === 'cash');
      const cashIdx = this.payments.findIndex(x => x.method === 'cash');
      const showReceived = isCash && (allCash || (cashIdx === i));
      const changeVal = Math.max(0, (parseFloat(p._received) || 0) - (parseFloat(p.amount) || 0));

      return `
        <div class="payment-row" data-index="${i}">
          <select class="payment-row__method" data-index="${i}">
            ${PAYMENT_METHODS.map(m => `<option value="${m.id}" ${m.id === p.method ? 'selected' : ''}>${m.label}</option>`).join('')}
          </select>
          <div class="payment-row__amount-wrap">
            <input type="number" class="payment-row__amount" data-index="${i}" value="${p.amount || ''}" min="0" step="0.01" placeholder="0.00">
            ${showReceived ? `
              <input type="number" class="payment-row__received" data-index="${i}" value="${p._received || ''}" placeholder="Recibido" min="0" step="0.01">
              <span class="payment-row__change ${changeVal > 0 ? 'has-change' : ''}" data-index="${i}">${format(changeVal)}</span>
            ` : ''}
          </div>
          ${this.payments.length > 1 ? `<button class="payment-row__remove" data-index="${i}"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div>
      `;
    }).join('');
  }

  _attachPaymentRowEvents() {
    document.querySelectorAll('.payment-row__method').forEach(sel => {
      sel.onchange = (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.payments[idx].method = e.target.value;
        this._updatePaymentUI();
      };
    });

    document.querySelectorAll('.payment-row__amount').forEach(inp => {
      inp.oninput = (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.payments[idx].amount = parseFloat(e.target.value) || 0;
        this._updatePaymentSummary();
        this._updateChange(idx);
      };
      inp.onfocus = (e) => e.target.select();
    });

    document.querySelectorAll('.payment-row__received').forEach(inp => {
      inp.oninput = (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.payments[idx]._received = parseFloat(e.target.value) || 0;
        this._updateChange(idx);
        this._updatePaymentSummary();
      };
      inp.onfocus = (e) => e.target.select();
    });

    document.querySelectorAll('.payment-row__remove').forEach(btn => {
      btn.onclick = (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.payments.splice(idx, 1);
        this._updatePaymentUI();
      };
    });
  }

  _updatePaymentSummary() {
    const total = this._getTotal();
    const paid = this.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, total - paid);

    const totalEl = document.getElementById('payment-total-display');
    const paidEl = document.getElementById('payment-paid-display');
    const remainEl = document.getElementById('payment-remaining-display');

    if (totalEl) totalEl.textContent = format(total);
    if (paidEl) paidEl.textContent = format(paid);
    if (remainEl) {
      remainEl.textContent = format(remaining);
      remainEl.className = 'payment-status__remaining' + (remaining <= 0.01 ? ' paid' : '');
    }

    const progressBar = document.querySelector('#payment-status-bar .payment-progress');
    if (progressBar && total > 0) {
      const pct = Math.min(100, (paid / total) * 100);
      const bar = progressBar.querySelector('.payment-progress__bar');
      if (bar) bar.style.width = pct + '%';
    }

    const confirmBtn = document.getElementById('confirm-sale-btn');
    if (confirmBtn) {
      const diff = Math.abs(paid - total);
      if (diff <= 0.01 && total > 0) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Venta';
        confirmBtn.onclick = () => this.confirmSale();
      } else {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `Falta ${format(remaining)}`;
      }
    }
  }

  _updatePaymentUI() {
    const wrapper = document.getElementById('pos-multi-payment');
    if (!wrapper) return;

    const total = this._getTotal();
    const paid = this.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, total - paid);

    const totalEl = document.getElementById('payment-total-display');
    const paidEl = document.getElementById('payment-paid-display');
    const remainEl = document.getElementById('payment-remaining-display');

    if (totalEl) totalEl.textContent = format(total);
    if (paidEl) paidEl.textContent = format(paid);
    if (remainEl) {
      remainEl.textContent = format(remaining);
      remainEl.className = 'payment-status__remaining' + (remaining <= 0.01 ? ' paid' : '');
    }

    const rows = document.getElementById('payment-rows');
    if (rows) {
      rows.innerHTML = this._renderPaymentRows();
      this._attachPaymentRowEvents();
    }

    const confirmBtn = document.getElementById('confirm-sale-btn');
    if (confirmBtn) {
      const diff = Math.abs(paid - total);
      if (diff <= 0.01 && total > 0) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Venta';
        confirmBtn.onclick = () => this.confirmSale();
      } else {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `Falta ${format(remaining)}`;
      }
    }
  }

  _updateChange(idx) {
    const receivedEl = document.querySelector(`.payment-row__received[data-index="${idx}"]`);
    const changeEl = document.querySelector(`.payment-row__change[data-index="${idx}"]`);
    if (!receivedEl || !changeEl) return;
    const amount = parseFloat(this.payments[idx]?.amount) || 0;
    const received = parseFloat(receivedEl.value) || 0;
    const change = Math.max(0, received - amount);
    changeEl.textContent = format(change);
    changeEl.className = 'payment-row__change' + (change > 0 ? ' has-change' : '');
  }

  async confirmSale() {
    if (this._isProcessing) return;
    if (this.cart.length === 0) {
      Toast.error('Error', 'El carrito está vacío');
      return;
    }

    if (!cashService.currentSession) {
      Toast.error('Error', 'No hay una sesión de caja abierta');
      return;
    }

    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = this.discountType === 'percent'
      ? subtotal * (this.discount / 100)
      : this.discount;
    const total = subtotal - discountAmount;

    const validation = validatePayments(this.payments, total);
    if (!validation.valid) {
      Toast.error('Error', validation.error);
      return;
    }

    const accountPayment = this.payments.find(p => p.method === 'account');
    if (accountPayment && accountPayment.amount > 0) {
      if (!this.currentCustomer) {
        Toast.error('Error', 'Seleccioná un cliente para usar cuenta corriente');
        return;
      }
      const balance = this.currentCustomer.balance || 0;
      if (balance < accountPayment.amount) {
        Toast.error('Error', 'Saldo insuficiente en la cuenta corriente');
        return;
      }
    }

    const primaryMethod = this.payments[0]?.method || 'cash';
    const cashPayment = this.payments.find(p => p.method === 'cash');
    const cashReceived = cashPayment ? (parseFloat(cashPayment._received) || cashPayment.amount) : 0;
    const change = cashPayment ? Math.max(0, cashReceived - cashPayment.amount) : 0;

    this._isProcessing = true;
    const confirmBtn = document.getElementById('confirm-sale-btn');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
    }

    const sale = {
      id: `sale_${Date.now()}`,
      date: new Date().toISOString(),
      sessionId: cashService.currentSession?.id,
      customerId: this.currentCustomer ? this.currentCustomer.id : null,
      items: this.cart.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
      })),
      subtotal,
      discount: discountAmount,
      tax: 0,
      total,
      paymentMethod: primaryMethod,
      paymentType: this.payments.length > 1 ? 'COMBINADO' : 'SIMPLE',
      payments: this.payments.map(p => ({
        method: p.method,
        amount: parseFloat(p.amount) || 0
      })),
      cashReceived: cashPayment ? cashReceived : null,
      change: cashPayment ? change : null,
      userId: state.get('currentUser')?.id
    };

    try {
      await saleRepo.create(sale);

      for (const item of sale.items) {
        await saleItemRepo.create({
          id: `si_${Date.now()}_${item.productId}`,
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        });

        const product = this.products.find(p => p.id === item.productId);
        if (product) {
          product.stock -= item.quantity;
          await productRepo.update(product);
        }
      }

      const accountPayment = this.payments.find(p => p.method === 'account');
      if (accountPayment && accountPayment.amount > 0 && this.currentCustomer) {
        this.currentCustomer.balance = (this.currentCustomer.balance || 0) - accountPayment.amount;
        await customerRepo.update(this.currentCustomer);
      }

      await cashService.recordSale(sale);

      Toast.success('Éxito', `Venta #${sale.id.substring(0, 8)} confirmada`);
      this.showTicket(sale);
      this.cart = [];
      this.currentCustomer = null;
      this.discount = 0;
      this.payments = [{ method: 'cash', amount: 0 }];
      this.renderCart();
      this.renderCustomerSelect();
    } catch (error) {
      console.error('Error saving sale:', error);
      Toast.error('Error', 'No se pudo guardar la venta');
    } finally {
      this._isProcessing = false;
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Venta';
      }
    }
  }

  showTicket(sale) {
    const settings = state.get('settings');
    const body = renderTicketBody(sale, settings);
    showTicketModal('Ticket de Venta', body);
  }

  _injectCashButton() {
    const header = document.querySelector('.pos-cart-header');
    if (!header) return;
    const existing = document.getElementById('pos-cash-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'pos-cash-btn';
    btn.className = 'pos-cash-btn';
    btn.innerHTML = '<i class="fa-solid fa-cash-register"></i>';
    btn.title = 'Gestión de Caja';
    btn.setAttribute('aria-label', 'Gestión de Caja');
    header.appendChild(btn);

    btn.onclick = () => this.showCashModal();
  }

  showCashModal() {
    if (!cashService.currentSession) {
      Toast.error('Error', 'No hay sesión de caja abierta');
      return;
    }

    const body = `
      <div style="margin-bottom:var(--space-4);">
        <label class="form-label">Tipo de operación</label>
        <select class="form-input" id="cash-op-type">
          <option value="in">Ingreso Manual</option>
          <option value="out">Egreso Manual</option>
          <option value="close">Cierre de Caja</option>
        </select>
      </div>
      <div id="cash-op-dynamic">
        <div class="form-group">
          <label class="form-label">Monto</label>
          <input type="number" class="form-input" id="cash-op-amount" min="0" step="0.01" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
          <input type="text" class="form-input" id="cash-op-obs" placeholder="Motivo del movimiento">
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="cash-modal-close-btn">Cerrar</button>
      <button class="btn btn-primary" id="cash-modal-exec-btn">Ejecutar</button>
    `;

    Modal.show({
      title: 'Gestión de Caja',
      body,
      footer
    });

    document.getElementById('cash-modal-close-btn').onclick = () => Modal.close();

    document.getElementById('cash-op-type').onchange = (e) => {
      const dynamic = document.getElementById('cash-op-dynamic');
      if (e.target.value === 'close') {
        dynamic.innerHTML = '<div style="text-align:center;padding:var(--space-4);"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;"></i><p style="margin-top:var(--space-2);">Cargando resumen...</p></div>';
        this._loadCloseSummary();
      } else {
        dynamic.innerHTML = `
          <div class="form-group">
            <label class="form-label">Monto</label>
            <input type="number" class="form-input" id="cash-op-amount" min="0" step="0.01" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
            <input type="text" class="form-input" id="cash-op-obs" placeholder="Motivo del movimiento">
          </div>
        `;
      }
    };

    document.getElementById('cash-modal-exec-btn').onclick = async () => {
      const type = document.getElementById('cash-op-type')?.value;
      if (type === 'close') {
        await this._executeClose();
        return;
      }
      const amount = document.getElementById('cash-op-amount')?.value;
      const obs = document.getElementById('cash-op-obs')?.value || '';
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        Toast.error('Error', 'Ingresá un monto válido');
        return;
      }
      try {
        await cashService.addMovement(type, amount, obs);
        const label = type === 'in' ? 'Ingreso' : 'Egreso';
        Toast.success('Éxito', `${label} registrado correctamente`);
        Modal.close();
      } catch (err) {
        Toast.error('Error', err.message);
      }
    };
  }

  async _loadCloseSummary() {
    const summary = await cashService.getSessionSummary();
    if (!summary) {
      document.getElementById('cash-op-dynamic').innerHTML = '<p style="color:var(--color-danger);">Error al cargar resumen</p>';
      return;
    }

    const dynamic = document.getElementById('cash-op-dynamic');
    const s = summary;
    dynamic.innerHTML = `
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
        <div class="cash-summary__row cash-summary__expected"><span>Total Esperado en Efectivo</span><span>${format(s.expectedTotal)}</span></div>
        <div style="margin-top:var(--space-4);">
          <label class="form-label">Monto Real Contado</label>
          <input type="number" class="form-input form-input-lg" id="close-final-amount" min="0" step="0.01" placeholder="0.00" style="font-size:var(--text-lg);font-weight:var(--font-bold);">
        </div>
        <div class="form-group">
          <label class="form-label">Observación <span style="color:var(--color-text-muted);font-weight:var(--font-normal);">(opcional)</span></label>
          <input type="text" class="form-input" id="close-observation" placeholder="Motivo del cierre">
        </div>
      </div>
    `;
  }

  async _executeClose() {
    const finalAmount = document.getElementById('close-final-amount')?.value;
    const observation = document.getElementById('close-observation')?.value || '';
    if (!finalAmount || isNaN(parseFloat(finalAmount)) || parseFloat(finalAmount) < 0) {
      Toast.error('Error', 'Ingresá un monto final válido');
      return;
    }
    try {
      await cashService.closeSession(finalAmount, observation);
      const expected = parseFloat(document.querySelector('.cash-summary__expected span:last-child')?.textContent?.replace(/[^\d.-]/g, '') || '0');
      const diff = parseFloat(finalAmount) - expected;
      const absDiff = Math.abs(diff);
      if (absDiff > 0.01) {
        Toast.warning('Caja Cerrada', `Diferencia: ${format(diff)}`);
      } else {
        Toast.success('Caja Cerrada', 'Cierre exitoso. Diferencia: $0.00');
      }
      Modal.close();
      setTimeout(() => cashService.requireActiveSession(), 800);
    } catch (err) {
      Toast.error('Error', err.message);
    }
  }
}

export default new POS();
