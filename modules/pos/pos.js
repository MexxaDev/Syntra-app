'use strict';

import { productRepo, customerRepo, saleRepo, saleItemRepo } from '../../db/repositories.js';
import { settingRepo } from '../../db/repositories.js';
import Toast from '../../components/toast.js';
import state from '../../js/state.js';
import { format } from '../../utils/currency.js';

class POS {
  constructor() {
    this.cart = [];
    this.products = [];
    this.customers = [];
    this.currentCustomer = null;
    this.discount = 0;
    this.discountType = 'percent';
    this.paymentMethod = 'cash';
    this.cashReceived = 0;
    this.taxRate = 21;
  }

  async loadProducts() {
    this.products = await productRepo.findAll();
    this.customers = await customerRepo.findAll();
    const settings = await settingRepo.findAll();
    const settingsObj = {};
    settings.forEach(s => settingsObj[s.key] = s.value);
    this.taxRate = parseFloat(settingsObj.taxRate) || 21;
    this.renderProducts();
    this.renderCart();
    this.renderCustomerSelect();
    this.setupBarcodeInput();
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

    const searchInput = document.querySelector('.pos-products .form-input');
    const query = searchInput ? searchInput.value.toLowerCase() : '';

    let products = this.products;
    if (query) {
      products = products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.includes(query))
      );
    }

    if (products.length === 0) {
      container.innerHTML = '<p style="color:var(--color-text-secondary);padding:var(--space-4);">No hay productos disponibles.</p>';
      return;
    }

    container.innerHTML = products.map(product => `
      <div class="pos-product-card" data-id="${product.id}">
        <div class="pos-product-card__image">
          ${product.image ? `<img src="${product.image}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fa-solid fa-box"></i>`}
        </div>
        <div class="pos-product-card__name">${product.name}</div>
        <div class="pos-product-card__price">${format(product.price)}</div>
      </div>
    `).join('');

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
      container.innerHTML = '<div style="text-align:center;color:var(--color-text-secondary);padding:var(--space-8);"><i class="fa-solid fa-cart-shopping" style="font-size:48px;margin-bottom:var(--space-4);display:block;"></i>El carrito está vacío</div>';
      this.updateTotal();
      return;
    }

    container.innerHTML = this.cart.map((item, index) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-3);border-bottom:1px solid var(--color-border-light);">
        <div style="display:flex;align-items:center;gap:var(--space-3);flex:1;">
          <div style="width:40px;height:40px;border-radius:var(--radius-md);overflow:hidden;flex-shrink:0;background:var(--color-gray-100);display:flex;align-items:center;justify-content:center;">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fa-solid fa-box" style="color:var(--color-text-secondary);font-size:16px;"></i>`}
          </div>
          <div>
            <div style="font-weight:var(--font-medium);font-size:var(--text-sm);">${item.name}</div>
            <div style="color:var(--color-text-secondary);font-size:var(--text-xs);">${format(item.price)} x ${item.quantity}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <button class="btn-remove" data-index="${index}" style="width:24px;height:24px;border-radius:50%;background:var(--color-gray-100);">-</button>
          <span style="font-weight:var(--font-semibold);">${item.quantity}</span>
          <button class="btn-add" data-index="${index}" style="width:24px;height:24px;border-radius:50%;background:var(--color-primary-100);color:var(--color-primary);">+</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.removeFromCart(idx);
      });
    });

    container.querySelectorAll('.btn-add').forEach(btn => {
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
      infoContainer.innerHTML = `
        <div style="font-size:var(--text-sm);color:var(--color-text-secondary);">
          Saldo: <strong>${format(this.currentCustomer.balance || 0)}</strong>
        </div>
      `;
    } else {
      infoContainer.innerHTML = '';
    }
  }

  updateTotal() {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = this.discountType === 'percent'
      ? subtotal * (this.discount / 100)
      : this.discount;
    const tax = (subtotal - discountAmount) * (this.taxRate / 100);
    const total = subtotal - discountAmount + tax;

    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount');
    const taxEl = document.getElementById('cart-tax');
    const totalEl = document.getElementById('cart-total');
    const changeEl = document.getElementById('cart-change');

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (discountEl) discountEl.textContent = `-$${discountAmount.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    if (this.paymentMethod === 'cash' && this.cashReceived > 0) {
      const change = this.cashReceived - total;
      if (changeEl) changeEl.textContent = `$${Math.max(0, change).toFixed(2)}`;
    }
  }

  setDiscount(type, value) {
    this.discountType = type;
    this.discount = parseFloat(value) || 0;
    this.updateTotal();
  }

  setPaymentMethod(method) {
    this.paymentMethod = method;
    const cashSection = document.getElementById('cash-payment-section');
    if (cashSection) {
      cashSection.style.display = method === 'cash' ? 'block' : 'none';
    }
    this.updateTotal();
  }

  async confirmSale() {
    if (this.cart.length === 0) {
      Toast.error('Error', 'El carrito está vacío');
      return;
    }

    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = this.discountType === 'percent'
      ? subtotal * (this.discount / 100)
      : this.discount;
    const tax = (subtotal - discountAmount) * (this.taxRate / 100);
    const total = subtotal - discountAmount + tax;

    if (this.paymentMethod === 'account') {
      if (!this.currentCustomer) {
        Toast.error('Error', 'Seleccioná un cliente para usar cuenta corriente');
        return;
      }
      const balance = this.currentCustomer.balance || 0;
      if (balance < total) {
        Toast.error('Error', 'Saldo insuficiente en la cuenta corriente');
        return;
      }
    }

    if (this.paymentMethod === 'cash') {
      this.cashReceived = parseFloat(document.getElementById('cash-received')?.value) || 0;
      if (this.cashReceived < total) {
        Toast.error('Error', 'El monto recibido es insuficiente');
        return;
      }
    }

    const sale = {
      id: `sale_${Date.now()}`,
      date: new Date().toISOString(),
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
      tax,
      total,
      paymentMethod: this.paymentMethod,
      cashReceived: this.paymentMethod === 'cash' ? this.cashReceived : null,
      change: this.paymentMethod === 'cash' ? Math.max(0, this.cashReceived - total) : null,
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

      if (this.paymentMethod === 'account' && this.currentCustomer) {
        this.currentCustomer.balance = (this.currentCustomer.balance || 0) - total;
        await customerRepo.update(this.currentCustomer);
      }

      Toast.success('Éxito', `Venta #${sale.id.substring(0, 8)} confirmada`);
      this.showTicket(sale);
      this.cart = [];
      this.currentCustomer = null;
      this.discount = 0;
      this.cashReceived = 0;
      this.renderCart();
      this.renderCustomerSelect();
    } catch (error) {
      console.error('Error saving sale:', error);
      Toast.error('Error', 'No se pudo guardar la venta');
    }
  }

  async showTicket(sale) {
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
            <span>$${sale.subtotal.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-sm);">
            <span>Descuento:</span>
            <span>-$${sale.discount.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-sm);">
            <span>Impuestos (${taxRate}%):</span>
            <span>$${sale.tax.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:var(--text-lg);border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-2);">
            <span>TOTAL:</span>
            <span>$${sale.total.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;">
            <span>Método:</span>
            <span>${this.getPaymentMethodLabel(sale.paymentMethod)}</span>
          </div>
          ${sale.cashReceived ? `<div style="display:flex;justify-content:space-between;"><span>Recibido:</span><span>$${sale.cashReceived.toFixed(2)}</span></div>` : ''}
          ${sale.change ? `<div style="display:flex;justify-content:space-between;"><span>Cambio:</span><span>$${sale.change.toFixed(2)}</span></div>` : ''}
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

    const modalModule = await import('../../components/modal.js');
    const Modal = modalModule.default;
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

  getPaymentMethodLabel(method) {
    const labels = {
      'cash': 'Efectivo',
      'debit': 'Débito',
      'transfer': 'Transferencia',
      'account': 'Cuenta Corriente',
      'mixed': 'Mixto'
    };
    return labels[method] || method;
  }
}

export default new POS();
