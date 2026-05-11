"use strict";

import { saleRepo, productRepo, customerRepo, cashSessionRepo, cashMovementRepo, categoryRepo } from "../../db/repositories.js";
import { getPayments, getMethodTotal, PAYMENT_COLORS } from '../../utils/payments.js';
import { drawBarChart, drawDoughnutChart, drawPieChart } from '../../utils/charts.js';
import Table from '../../components/table.js';
import { SALES_COLUMNS, SALES_ACTIONS, prepareSaleRows, showSaleDetail } from '../sales/salesTable.js';
import state from "../../js/state.js";

class Dashboard {
  constructor() {
    this.element = null;
    this.cache = {
      sales: null,
      products: null,
      customers: null,
      sessions: null,
      movements: null,
      categories: null,
      lastLoad: 0
    };
  }

  async load() {
    this.element = document.getElementById("dashboard");
    const now = Date.now();
    if (now - this.cache.lastLoad < 30000 && this.cache.sales && this.cache.products) {
      this.renderWithCache();
      return;
    }

    if (this.element) {
      this.element.innerHTML = this.getLoadingSkeleton();
    }

    await this.loadStats();
  }

  getLoadingSkeleton() {
    return `
      <div class="page-header">
        <h1 class="page-header__title">Dashboard</h1>
        <p class="page-header__subtitle">Resumen completo de tu negocio</p>
      </div>
      <div class="kpi-grid" id="kpi-cards">
        ${Array(4).fill(0).map(() => `
          <div class="kpi-card">
            <div class="skeleton" style="width:48px;height:48px;border-radius:var(--radius-lg);margin-bottom:var(--space-4);"></div>
            <div class="skeleton" style="width:60%;height:32px;border-radius:var(--radius-sm);margin-bottom:var(--space-2);"></div>
            <div class="skeleton" style="width:40%;height:16px;border-radius:var(--radius-sm);"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async loadStats() {
    try {
      const [sales, products, customers, sessions, movements, categories] = await Promise.all([
        saleRepo.findAll(),
        productRepo.findAll(),
        customerRepo.findAll(),
        cashSessionRepo.findAll(),
        cashMovementRepo.findAll(),
        categoryRepo.findAll()
      ]);

      this.cache.sales = sales || [];
      this.cache.products = products || [];
      this.cache.customers = customers || [];
      this.cache.sessions = sessions || [];
      this.cache.movements = movements || [];
      this.cache.categories = categories || [];
      this.cache.lastLoad = Date.now();

      const settings = state.get("settings") || {};
      const currencySymbol = settings.currencySymbol || "$";
      this.renderDashboard(currencySymbol);
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
      this.cache.sales = [];
      this.cache.products = [];
      this.cache.customers = [];
      this.cache.sessions = [];
      this.cache.movements = [];
      this.cache.categories = [];
      if (this.element) {
        this.element.innerHTML = `
          <div class="page-header">
            <h1 class="page-header__title">Dashboard</h1>
            <p class="page-header__subtitle">Resumen completo de tu negocio</p>
          </div>
          <div style="text-align:center;padding:var(--space-16);color:var(--color-danger);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:48px;margin-bottom:var(--space-4);display:block;"></i>
            <h3>Error al cargar estadisticas</h3>
            <p style="margin-top:var(--space-2);color:var(--color-text-secondary);">Revisa la consola para mas detalles</p>
          </div>
        `;
      }
    }
  }

  renderWithCache() {
    const settings = state.get("settings") || {};
    const currencySymbol = settings.currencySymbol || "$";
    this.renderDashboard(currencySymbol);
  }

  renderDashboard(currencySymbol) {
    if (!this.element) return;

    const sales = this.cache.sales || [];
    const products = this.cache.products || [];
    const categories = this.cache.categories || [];
    const customers = this.cache.customers || [];

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const thisMonth = y + "-" + m;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const salesToday = [];
    const salesYesterday = [];
    const salesMonth = [];
    let totalToday = 0;
    let totalYesterday = 0;
    let totalMonth = 0;

    sales.forEach(s => {
      if (!s.date) return;
      const d = s.date.substring(0, 10);
      const t = parseFloat(s.total) || 0;
      if (d === today) { salesToday.push(s); totalToday += t; }
      if (d === yesterdayStr) { salesYesterday.push(s); totalYesterday += t; }
      if (d.startsWith(thisMonth)) { salesMonth.push(s); totalMonth += t; }
    });

    const avgTicket = salesMonth.length > 0 ? totalMonth / salesMonth.length : 0;

    const currentSession = this.cache.sessions.find(s => !s.closedAt) || null;

    const alerts = this.getSmartAlerts(sales, products, currentSession, customers);

    this.element.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-header__title">Dashboard</h1>
          <p class="page-header__subtitle">Resumen completo de tu negocio</p>
        </div>
      </div>

      <div class="kpi-grid" id="kpi-cards">
        ${this.renderKPICard('fa-dollar-sign', 'Ventas Hoy', currencySymbol + ' ' + totalToday.toFixed(2), this.getChangePercent(totalToday, totalYesterday), 'primary')}
        ${this.renderKPICard('fa-chart-line', 'Ventas Mes', currencySymbol + ' ' + totalMonth.toFixed(2), this.getChangePercent(totalMonth, totalYesterday * 30), 'success')}
        ${this.renderKPICard('fa-ticket', 'Ticket Prom.', currencySymbol + ' ' + avgTicket.toFixed(2), '+0%', 'warning')}
        ${this.renderKPICard('fa-cash-register', 'Caja', currentSession ? currencySymbol + ' ' + this.getCashAmount(currentSession, salesToday).toFixed(2) : 'Cerrada', currentSession ? 'Abierta' : 'Cerrada', currentSession ? 'success' : 'danger')}
      </div>

      <div class="charts-grid" id="charts-section">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Ventas</h3>
            <div class="chart-period-selector" id="period-selector">
              <button class="chart-period-btn active" data-period="7">7 días</button>
              <button class="chart-period-btn" data-period="30">30 días</button>
              <button class="chart-period-btn" data-period="90">90 días</button>
              <button class="chart-period-btn" data-period="365">Año</button>
            </div>
          </div>
          <canvas id="chart-main-sales" height="300" aria-label="Gráfico de ventas por período"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Ventas por Categoría</h3>
          </div>
          <canvas id="chart-categories" height="300" aria-label="Gráfico de ventas por categoría"></canvas>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:var(--space-6);">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Métodos de Pago</h3>
          </div>
          <canvas id="chart-payment-methods" height="250" aria-label="Gráfico de métodos de pago"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Horas Pico</h3>
          </div>
          <canvas id="chart-peak-hours" height="250" aria-label="Gráfico de horas pico"></canvas>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:var(--space-6);">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Top Productos</h3>
          </div>
          <div id="top-products-detailed">
            ${this.renderTopProductsDetailed(sales, products)}
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Top Clientes</h3>
          </div>
          <div id="top-customers">
            ${this.renderTopCustomers(sales, customers)}
          </div>
        </div>
      </div>

      <div class="chart-card" style="margin-top:var(--space-6);">
        <div class="chart-card__header">
          <h3 class="chart-title">Últimas Ventas</h3>
        </div>
        <div id="recent-sales-table"></div>
      </div>
    `;

    this._syncHeaderAlerts(alerts);

    requestAnimationFrame(() => {
      setTimeout(() => {
        this.initMainChart('7', sales);
        this.initCategoriesChart(sales, products, categories, currencySymbol);
        this.initPaymentMethodsChart(sales);
        this.initPeakHoursChart(sales);
        this.initRecentSalesTable(salesMonth, customers);
      }, 100);

      this.attachPeriodSelector(sales);
    });
  }

  renderKPICard(icon, label, value, change, colorClass) {
    const changeNum = typeof change === 'string' ? parseFloat(change) : change;
    const isPositive = changeNum > 0 || (typeof change === 'string' && change.includes('Abierta'));
    const isNegative = changeNum < 0 || (typeof change === 'string' && change.includes('Cerrada'));

    let changeHtml = '';
    if (typeof change === 'string' && (change.includes('Abierta') || change.includes('Cerrada'))) {
      changeHtml = `<div class="kpi-card__change ${isPositive ? 'kpi-card__change--positive' : 'kpi-card__change--negative'}">${change}</div>`;
    } else {
      const arrow = isPositive ? '<i class="fa-solid fa-arrow-up"></i>' : '<i class="fa-solid fa-arrow-down"></i>';
      changeHtml = `<div class="kpi-card__change ${isPositive ? 'kpi-card__change--positive' : 'kpi-card__change--negative'}">${arrow} ${change}</div>`;
    }

    return `
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--${colorClass}">
            <i class="fa-solid ${icon}"></i>
          </div>
        </div>
        <div class="kpi-card__value">${value}</div>
        <div class="kpi-card__label">${label}</div>
        ${changeHtml}
      </div>
    `;
  }

  getChangePercent(current, previous) {
    if (!previous || previous === 0) return current > 0 ? '+100%' : '+0%';
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? '+' : '';
    return sign + change.toFixed(1) + '%';
  }

  getCashAmount(session, salesToday) {
    if (!session) return 0;
    const cashSales = salesToday.reduce((sum, s) => sum + getMethodTotal(s, 'cash'), 0);
    const movementsIn = this.cache.movements
      .filter(m => m.sessionId === session.id && m.type === 'in')
      .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    const movementsOut = this.cache.movements
      .filter(m => m.sessionId === session.id && m.type === 'out')
      .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    return (parseFloat(session.initialAmount) || 0) + cashSales + movementsIn - movementsOut;
  }

  getSmartAlerts(sales, products, currentSession, customers) {
    const alerts = [];

    const lowStock = products.filter(p => p.stock <= 5);
    if (lowStock.length > 0) {
      alerts.push({ type: 'warning', icon: 'fa-box-open', text: `${lowStock.length} producto(s) con stock bajo` });
    }

    const inactiveProducts = products.filter(p => p.visible === false || p.inactive === true);
    if (inactiveProducts.length > 0) {
      alerts.push({ type: 'info', icon: 'fa-eye-slash', text: `${inactiveProducts.length} producto(s) inactivo(s)` });
    }

    if (!currentSession) {
      alerts.push({ type: 'danger', icon: 'fa-cash-register', text: 'Caja no está abierta' });
    }

    const today = new Date().toISOString().split("T")[0];
    const salesToday = sales.filter(s => s.date && s.date.startsWith(today));
    if (salesToday.length === 0) {
      alerts.push({ type: 'warning', icon: 'fa-chart-line', text: 'Sin ventas registradas hoy' });
    }

    const customersWithDebt = customers.filter(c => (parseFloat(c.balance) || 0) < 0);
    if (customersWithDebt.length > 0) {
      alerts.push({ type: 'danger', icon: 'fa-user-clock', text: `${customersWithDebt.length} cliente(s) con deuda` });
    }

    return alerts;
  }

  renderSmartAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      return '<div style="text-align:center;padding:var(--space-6);color:var(--color-success);"><i class="fa-solid fa-check-circle" style="font-size:24px;display:block;margin-bottom:var(--space-2);"></i><span style="font-size:var(--text-sm);">Todo en orden</span></div>';
    }

    return alerts.map(alert => `
      <div class="alert-item">
        <div class="alert-item__icon alert-item__icon--${alert.type}">
          <i class="fa-solid ${alert.icon}"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-sm);font-weight:var(--font-medium);">${alert.text}</div>
        </div>
        <span class="alert-item__type alert-item__type--${alert.type}">${alert.type === 'danger' ? 'Crítico' : alert.type === 'warning' ? 'Atención' : 'Info'}</span>
      </div>
    `).join('');
  }

  _syncHeaderAlerts(alerts) {
    const btn = document.getElementById('header-alerts-btn');
    const badge = document.getElementById('header-alerts-badge');
    const count = document.getElementById('header-alerts-count');
    const content = document.getElementById('header-alerts-content');
    if (!btn || !badge || !content) return;

    const hasAlerts = alerts.length > 0;
    if (hasAlerts) {
      btn.classList.add('alerts-btn--has-alerts');
      badge.textContent = alerts.length;
      badge.style.display = '';
      if (count) {
        count.textContent = alerts.length;
        count.style.display = '';
      }
    } else {
      btn.classList.remove('alerts-btn--has-alerts');
      badge.style.display = 'none';
      if (count) count.style.display = 'none';
    }
    content.innerHTML = this.renderSmartAlerts(alerts);
  }

  renderTopProductsDetailed(sales, products) {
    const productCounts = {};
    sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (!productCounts[item.productId]) {
            const product = products.find(p => p.id === item.productId);
            productCounts[item.productId] = {
              name: item.name || (product ? product.name : 'Unknown'),
              quantity: 0,
              total: 0,
              image: product ? product.image : ''
            };
          }
          productCounts[item.productId].quantity += (item.quantity || 0);
          productCounts[item.productId].total += (parseFloat(item.subtotal) || 0);
        });
      }
    });

    const topProducts = Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    if (topProducts.length === 0) {
      return '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);padding:var(--space-4);">No hay datos disponibles</p>';
    }

    return topProducts.map((prod, i) => `
      <div class="top-product-item">
        <div class="top-product-item__image">
          ${prod.image ? `<img src="${prod.image}" alt="${prod.name}">` : `<i class="fa-solid fa-box"></i>`}
        </div>
        <div style="flex:1;">
          <div style="font-weight:var(--font-medium);font-size:var(--text-sm);">${i + 1}. ${prod.name}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);">${prod.quantity} vendidos - $${prod.total.toFixed(2)}</div>
        </div>
        <div style="font-weight:var(--font-bold);font-size:var(--text-sm);color:var(--color-primary);">
          #${i + 1}
        </div>
      </div>
    `).join('');
  }

  renderTopCustomers(sales, customers) {
    const customerCounts = {};
    sales.forEach(sale => {
      if (sale.customerId) {
        if (!customerCounts[sale.customerId]) {
          const customer = customers.find(c => c.id === sale.customerId);
          customerCounts[sale.customerId] = {
            name: customer ? customer.name : 'Unknown',
            total: 0,
            count: 0
          };
        }
        customerCounts[sale.customerId].total += (parseFloat(sale.total) || 0);
        customerCounts[sale.customerId].count += 1;
      }
    });

    const topCustomers = Object.values(customerCounts)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    if (topCustomers.length === 0) {
      return '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);padding:var(--space-4);">No hay datos disponibles</p>';
    }

    return topCustomers.map((cust, i) => `
      <div class="top-product-item">
        <div class="top-product-item__image" style="background:var(--color-info-light);color:var(--color-info);">
          <i class="fa-solid fa-user"></i>
        </div>
        <div style="flex:1;">
          <div style="font-weight:var(--font-medium);font-size:var(--text-sm);">${cust.name}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);">${cust.count} ventas - $${cust.total.toFixed(2)}</div>
        </div>
        <div style="font-weight:var(--font-bold);font-size:var(--text-sm);color:var(--color-primary);">
          $${cust.total.toFixed(2)}
        </div>
      </div>
    `).join('');
  }

  initRecentSalesTable(salesMonth, customers) {
    const container = document.getElementById('recent-sales-table');
    if (!container) return;

    const last10 = salesMonth.slice(-10).reverse();
    if (last10.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:var(--space-6);color:var(--color-text-secondary);font-size:var(--text-sm);">No hay ventas registradas este mes</div>';
      return;
    }

    const rows = prepareSaleRows(last10, customers || []);
    const table = new Table({
      columns: SALES_COLUMNS,
      data: rows,
      actions: SALES_ACTIONS,
      onRowClick: (row) => showSaleDetail(row)
    });
    table.mount(container);
  }

  initMainChart(period, sales) {
    const canvas = document.getElementById('chart-main-sales');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const days = parseInt(period);
    const data = this.getSalesByPeriod(sales, days);
    const labels = this.getPeriodLabels(days);

    this.drawBarLineChart(ctx, labels, data, 'Ventas');
  }

  initCategoriesChart(sales, products, categories, currencySymbol) {
    const canvas = document.getElementById('chart-categories');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const categoryData = this.getSalesByCategory(sales, products, categories);

    drawDoughnutChart(ctx, categoryData.labels, categoryData.data, ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'], currencySymbol);
  }

  initPaymentMethodsChart(sales) {
    const canvas = document.getElementById('chart-payment-methods');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const methods = { cash: 0, debit: 0, transfer: 0, account: 0 };
    const labels = { cash: 'Efectivo', debit: 'Débito', transfer: 'Transferencia', account: 'Cuenta Corriente' };

    sales.forEach(sale => {
      const payments = getPayments(sale);
      payments.forEach(p => {
        if (methods[p.method] !== undefined) {
          methods[p.method] += p.amount;
        }
      });
    });

    const methodKeys = Object.keys(methods).filter(k => methods[k] > 0);
    const methodData = methodKeys.map(k => methods[k]);
    const methodLabels = methodKeys.map(k => labels[k]);
    const methodColors = methodKeys.map(k => PAYMENT_COLORS[k] || '#6B7280');

    const settings = state.get("settings") || {};
    const currencySymbol = settings.currencySymbol || "$";
    drawPieChart(ctx, methodLabels, methodData, methodColors, currencySymbol);
  }

  initPeakHoursChart(sales) {
    const canvas = document.getElementById('chart-peak-hours');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const hourData = new Array(18).fill(0);

    sales.forEach(sale => {
      if (sale.date) {
        const hour = new Date(sale.date).getHours();
        if (hour >= 6 && hour <= 23) {
          hourData[hour - 6] += parseFloat(sale.total) || 0;
        }
      }
    });

    const labels = [];
    for (let i = 6; i <= 23; i++) {
      labels.push(i + ':00');
    }

    drawBarChart(ctx, labels, hourData, ['#7C3AED', '#A78BFA', '#C4B5FD', '#7C3AED', '#A78BFA', '#C4B5FD', '#7C3AED', '#A78BFA', '#C4B5FD', '#7C3AED', '#A78BFA', '#C4B5FD', '#7C3AED', '#A78BFA', '#C4B5FD', '#7C3AED', '#A78BFA', '#C4B5FD']);
  }

  attachPeriodSelector(sales) {
    const selector = document.getElementById('period-selector');
    if (!selector) return;

    selector.querySelectorAll('.chart-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selector.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.initMainChart(btn.dataset.period, sales);
      });
    });
  }

  getSalesByPeriod(sales, days) {
    const dateMap = {};
    sales.forEach(s => {
      if (s.date) {
        const day = s.date.substring(0, 10);
        dateMap[day] = (dateMap[day] || 0) + (parseFloat(s.total) || 0);
      }
    });
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      data.push(dateMap[dateStr] || 0);
    }
    return data;
  }

  getPeriodLabels(days) {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push((d.getMonth() + 1) + '/' + d.getDate());
    }
    return labels;
  }

  getSalesByCategory(sales, products, categories) {
    const categoryTotals = {};

    sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          const categoryId = product ? product.categoryId : 'unknown';
          categoryTotals[categoryId] = (categoryTotals[categoryId] || 0) + (parseFloat(item.subtotal) || 0);
        });
      }
    });

    const categoryMap = {};
    (categories || []).forEach(c => {
      categoryMap[c.id] = c.name;
    });

    return {
      labels: Object.keys(categoryTotals).map(k => categoryMap[k] || 'Sin categoría'),
      data: Object.values(categoryTotals)
    };
  }

  drawBarLineChart(ctx, labels, data, label) {
    const canvas = ctx.canvas;
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...data, 1);

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#E5E7EB';
    ctx.fillStyle = '#6B7280';
    ctx.font = '11px Inter';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight * i / 5);
      const value = maxValue - (maxValue * i / 5);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText('$' + Math.round(value), padding.left - 5, y + 4);
    }

    const barWidth = chartWidth / labels.length * 0.6;
    const gap = chartWidth / labels.length * 0.4;

    data.forEach((value, i) => {
      const x = padding.left + (chartWidth * i / labels.length) + gap / 2;
      const barHeight = (value / maxValue) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartHeight);
      gradient.addColorStop(0, '#7C3AED');
      gradient.addColorStop(1, '#C4B5FD');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      ctx.fill();

      if (value > 0) {
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('$' + Math.round(value), x + barWidth / 2, y - 8);
      }
    });

    ctx.fillStyle = '#374151';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    labels.forEach((label, i) => {
      const x = padding.left + (chartWidth * i / labels.length) + chartWidth / labels.length / 2;
      ctx.fillText(label, x, height - padding.bottom + 20);
    });

    let lastHoverIndex = -1;
    let hoverTimer = null;
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const barIndex = Math.floor((mouseX - padding.left) / (chartWidth / labels.length));

      if (barIndex === lastHoverIndex) return;
      lastHoverIndex = barIndex;

      if (hoverTimer) cancelAnimationFrame(hoverTimer);
      hoverTimer = requestAnimationFrame(() => {
        ctx.clearRect(padding.left, 0, chartWidth, padding.top);
        if (barIndex >= 0 && barIndex < data.length && data[barIndex] > 0) {
          canvas.style.cursor = 'pointer';
          ctx.fillStyle = '#111827';
          ctx.font = 'bold 12px Inter';
          ctx.textAlign = 'left';
          ctx.fillText(`${labels[barIndex]}: $${Math.round(data[barIndex])}`, padding.left, padding.top - 10);
        } else {
          canvas.style.cursor = 'default';
        }
      });
    };
  }
}

export default new Dashboard();
