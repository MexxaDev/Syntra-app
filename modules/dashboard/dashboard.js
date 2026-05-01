"use strict";

import { saleRepo, productRepo, settingRepo, customerRepo, cashSessionRepo, cashMovementRepo } from "../../db/repositories.js";
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
        ${Array(8).fill(0).map(() => `
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
      const [sales, products, customers, sessions, movements] = await Promise.all([
        saleRepo.findAll(),
        productRepo.findAll(),
        customerRepo.findAll(),
        cashSessionRepo.findAll(),
        cashMovementRepo.findAll()
      ]);

      this.cache.sales = sales || [];
      this.cache.products = products || [];
      this.cache.customers = customers || [];
      this.cache.sessions = sessions || [];
      this.cache.movements = movements || [];
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
    const customers = this.cache.customers || [];

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const thisMonth = y + "-" + m;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const salesToday = sales.filter(s => s.date && s.date.startsWith(today));
    const salesYesterday = sales.filter(s => s.date && s.date.startsWith(yesterdayStr));
    const salesMonth = sales.filter(s => s.date && s.date.startsWith(thisMonth));

    const totalToday = salesToday.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const totalYesterday = salesYesterday.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const totalMonth = salesMonth.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

    const avgTicket = salesMonth.length > 0 ? totalMonth / salesMonth.length : 0;
    const transactions = salesMonth.length;
    const estimatedProfit = totalMonth * 0.3;

    const customersToday = customers.filter(c => {
      if (!c.createdAt) return false;
      return c.createdAt.startsWith(today);
    });

    const productsSoldToday = salesToday.reduce((sum, s) => {
      if (s.items && Array.isArray(s.items)) {
        return sum + s.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
      }
      return sum;
    }, 0);

    const currentSession = this.cache.sessions.find(s => !s.closedAt) || null;

    const sparklineData7 = this.getLast7DaysSales(sales);

    this.element.innerHTML = `
      <div class="page-header">
        <h1 class="page-header__title">Dashboard</h1>
        <p class="page-header__subtitle">Resumen completo de tu negocio</p>
      </div>

      <div class="kpi-grid" id="kpi-cards">
        ${this.renderKPICard('fa-dollar-sign', 'Ventas Hoy', currencySymbol + ' ' + totalToday.toFixed(2), this.getChangePercent(totalToday, totalYesterday), 'primary', sparklineData7)}
        ${this.renderKPICard('fa-chart-line', 'Ventas Mes', currencySymbol + ' ' + totalMonth.toFixed(2), this.getChangePercent(totalMonth, totalYesterday * 30), 'success', sparklineData7)}
        ${this.renderKPICard('fa-ticket', 'Ticket Prom.', currencySymbol + ' ' + avgTicket.toFixed(2), '+0%', 'warning', sparklineData7)}
        ${this.renderKPICard('fa-credit-card', 'Transacc.', transactions.toString(), '+0%', 'info', sparklineData7.map(v => v / 100))}
        ${this.renderKPICard('fa-coins', 'Utilidad', currencySymbol + ' ' + estimatedProfit.toFixed(2), '+0%', 'success', sparklineData7.map(v => v * 0.3))}
        ${this.renderKPICard('fa-user-plus', 'Cli. Nuevos', customersToday.length.toString(), '+0%', 'info', null)}
        ${this.renderKPICard('fa-box', 'Prods. Vend.', productsSoldToday.toString(), '+0%', 'warning', null)}
        ${this.renderKPICard('fa-cash-register', 'Caja', currentSession ? currencySymbol + ' ' + this.getCashAmount(currentSession, salesToday).toFixed(2) : 'Cerrada', currentSession ? 'Abierta' : 'Cerrada', currentSession ? 'success' : 'danger', null)}
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
          <canvas id="chart-main-sales" height="300"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Ventas por Categoría</h3>
          </div>
          <canvas id="chart-categories" height="300"></canvas>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:var(--space-6);">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Métodos de Pago</h3>
          </div>
          <canvas id="chart-payment-methods" height="250"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Horas Pico</h3>
          </div>
          <canvas id="chart-peak-hours" height="250"></canvas>
        </div>
      </div>

      <div class="alerts-grid" style="margin-top:var(--space-6);">
        <div class="alert-card">
          <div class="chart-card__header">
            <h3 class="chart-title"><i class="fa-solid fa-bell"></i> Alertas Inteligentes</h3>
          </div>
          <div id="smart-alerts">
            ${this.renderSmartAlerts(sales, products, currentSession, customers)}
          </div>
        </div>
        <div class="alert-card">
          <div class="chart-card__header">
            <h3 class="chart-title"><i class="fa-solid fa-cash-register"></i> Caja en Tiempo Real</h3>
          </div>
          <div id="cash-status">
            ${this.renderCashStatus(currentSession, salesToday)}
          </div>
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
        <div id="recent-sales-table">
          ${this.renderRecentSalesTable(salesMonth.slice(-10).reverse())}
        </div>
      </div>

      <div class="chart-card" style="margin-top:var(--space-6);">
        <div class="chart-card__header">
          <h3 class="chart-title">Métricas Avanzadas</h3>
        </div>
        <div id="advanced-metrics">
          ${this.renderAdvancedMetrics(sales, products, today)}
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      setTimeout(() => {
        this.initMainChart('7', sales);
        this.initCategoriesChart(sales, products);
        this.initPaymentMethodsChart(sales);
        this.initPeakHoursChart(sales);
      }, 100);

      this.attachPeriodSelector(sales);
    });
  }

  renderKPICard(icon, label, value, change, colorClass, sparklineData) {
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

    const sparkline = sparklineData && sparklineData.length > 1 ? this.generateSparkline(sparklineData, colorClass) : '';

    return `
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--${colorClass}">
            <i class="fa-solid ${icon}"></i>
          </div>
          ${sparkline}
        </div>
        <div class="kpi-card__value">${value}</div>
        <div class="kpi-card__label">${label}</div>
        ${changeHtml}
      </div>
    `;
  }

  generateSparkline(data, colorClass) {
    if (!data || data.length < 2) return '';

    const width = 120;
    const height = 48;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    });

    const colorMap = {
      'primary': '#7C3AED',
      'success': '#10B981',
      'warning': '#F59E0B',
      'info': '#3B82F6',
      'danger': '#EF4444'
    };

    const color = colorMap[colorClass] || '#7C3AED';

    return `
      <svg class="kpi-card__sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="position:absolute;bottom:8px;right:8px;width:${width}px;height:${height}px;opacity:0.3;">
        <polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="0,${height} ${points.join(' ')} ${width},${height}" fill="${color}" opacity="0.1"/>
      </svg>
    `;
  }

  getLast7DaysSales(sales) {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySales = sales.filter(s => s.date && s.date.startsWith(dateStr));
      const total = daySales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
      data.push(total);
    }
    return data;
  }

  getChangePercent(current, previous) {
    if (!previous || previous === 0) return current > 0 ? '+100%' : '+0%';
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? '+' : '';
    return sign + change.toFixed(1) + '%';
  }

  getCashAmount(session, salesToday) {
    if (!session) return 0;
    const cashSales = salesToday.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const movementsIn = this.cache.movements
      .filter(m => m.sessionId === session.id && m.type === 'in')
      .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    const movementsOut = this.cache.movements
      .filter(m => m.sessionId === session.id && m.type === 'out')
      .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    return (parseFloat(session.initialAmount) || 0) + cashSales + movementsIn - movementsOut;
  }

  renderSmartAlerts(sales, products, currentSession, customers) {
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

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const salesToday = sales.filter(s => s.date && s.date.startsWith(today));
    if (salesToday.length === 0) {
      alerts.push({ type: 'warning', icon: 'fa-chart-line', text: 'Sin ventas registradas hoy' });
    }

    const customersWithDebt = customers.filter(c => (parseFloat(c.balance) || 0) < 0);
    if (customersWithDebt.length > 0) {
      alerts.push({ type: 'danger', icon: 'fa-user-clock', text: `${customersWithDebt.length} cliente(s) con deuda` });
    }

    if (alerts.length === 0) {
      return '<div style="text-align:center;padding:var(--space-4);color:var(--color-success);"><i class="fa-solid fa-check-circle"></i> Todo en orden</div>';
    }

    return alerts.map(alert => `
      <div class="alert-item">
        <div class="alert-item__icon alert-item__icon--${alert.type}">
          <i class="fa-solid ${alert.icon}"></i>
        </div>
        <span style="font-size:var(--text-sm);">${alert.text}</span>
      </div>
    `).join('');
  }

  renderCashStatus(session, salesToday) {
    if (!session) {
      return `
        <div style="text-align:center;padding:var(--space-6);">
          <i class="fa-solid fa-cash-register" style="font-size:48px;color:var(--color-gray-300);margin-bottom:var(--space-3);display:block;"></i>
          <p style="color:var(--color-text-secondary);">Caja cerrada</p>
          <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2);">Abre caja desde el módulo de Caja</p>
        </div>
      `;
    }

    const cashSales = salesToday.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const cardSales = salesToday.filter(s => s.paymentMethod === 'debit').reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const expectedCash = (parseFloat(session.initialAmount) || 0) + cashSales;

    return `
      <div style="display:flex;flex-direction:column;gap:var(--space-3);padding:var(--space-3);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:var(--text-sm);color:var(--color-text-secondary);">Estado:</span>
          <span class="badge badge-success" style="font-size:var(--text-xs);">Abierta</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:var(--text-sm);color:var(--color-text-secondary);">Monto Inicial:</span>
          <span style="font-weight:var(--font-semibold);">$${parseFloat(session.initialAmount || 0).toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:var(--text-sm);color:var(--color-text-secondary);">Efectivo:</span>
          <span style="font-weight:var(--font-semibold);">$${cashSales.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:var(--text-sm);color:var(--color-text-secondary);">Tarjeta:</span>
          <span style="font-weight:var(--font-semibold);">$${cardSales.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid var(--color-border);padding-top:var(--space-2);margin-top:var(--space-2);">
          <span style="font-weight:var(--font-semibold);">Efectivo Esperado:</span>
          <span style="font-weight:var(--font-bold);color:var(--color-primary);">$${expectedCash.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:var(--text-sm);color:var(--color-text-secondary);">Responsable:</span>
          <span style="font-size:var(--text-sm);">${session.userId || 'N/A'}</span>
        </div>
      </div>
    `;
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

  renderRecentSalesTable(sales) {
    if (sales.length === 0) {
      return '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);padding:var(--space-4);">No hay ventas registradas</p>';
    }

    return `
      <table class="sales-table">
        <thead>
          <tr>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Monto</th>
            <th>Pago</th>
          </tr>
        </thead>
        <tbody>
          ${sales.map(sale => `
            <tr>
              <td style="font-size:var(--text-sm);">${sale.date ? new Date(sale.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
              <td style="font-size:var(--text-sm);">${sale.customerId ? (this.cache.customers.find(c => c.id === sale.customerId)?.name || 'Consumidor Final') : 'Consumidor Final'}</td>
              <td style="font-weight:var(--font-semibold);font-size:var(--text-sm);">$${parseFloat(sale.total || 0).toFixed(2)}</td>
              <td><span class="badge badge-primary" style="font-size:var(--text-xs);">${this.getPaymentMethodLabel(sale.paymentMethod)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  renderAdvancedMetrics(sales, products, today) {
    const salesToday = sales.filter(s => s.date && s.date.startsWith(today));
    const totalToday = salesToday.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

    const hourlySales = {};
    salesToday.forEach(sale => {
      if (sale.date) {
        const hour = new Date(sale.date).getHours();
        hourlySales[hour] = (hourlySales[hour] || 0) + (parseFloat(sale.total) || 0);
      }
    });

    const avgPerHour = Object.keys(hourlySales).length > 0
      ? totalToday / Object.keys(hourlySales).length
      : 0;

    const lastWeekSales = sales.filter(s => {
      if (!s.date) return false;
      const saleDate = new Date(s.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return saleDate >= weekAgo;
    });
    const lastWeekTotal = lastWeekSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const weekBeforeSales = sales.filter(s => {
      if (!s.date) return false;
      const saleDate = new Date(s.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      return saleDate >= twoWeeksAgo && saleDate < weekAgo;
    });
    const weekBeforeTotal = weekBeforeSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

    const productCounts = {};
    salesToday.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (!productCounts[item.productId]) {
            const product = products.find(p => p.id === item.productId);
            productCounts[item.productId] = {
              name: item.name || (product ? product.name : 'Unknown'),
              quantity: 0
            };
          }
          productCounts[item.productId].quantity += (item.quantity || 0);
        });
      }
    });

    const starProduct = Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)[0];

    const highestTicket = salesToday.length > 0
      ? salesToday.reduce((max, s) => (parseFloat(s.total) || 0) > (parseFloat(max.total) || 0) ? s : max, salesToday[0])
      : null;

    return `
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:var(--space-4);padding:var(--space-4);">
        <div>
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-bottom:var(--space-1);">Margen Estimado Hoy</div>
          <div style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-success);">$${(totalToday * 0.3).toFixed(2)}</div>
        </div>
        <div>
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-bottom:var(--space-1);">Promedio por Hora</div>
          <div style="font-size:var(--text-lg);font-weight:var(--font-bold);">$${avgPerHour.toFixed(2)}</div>
        </div>
        <div>
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-bottom:var(--space-1);">Ticket Más Alto Hoy</div>
          <div style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-primary);">${highestTicket ? '$' + parseFloat(highestTicket.total).toFixed(2) : 'N/A'}</div>
        </div>
        <div>
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-bottom:var(--space-1);">Producto Estrella Hoy</div>
          <div style="font-size:var(--text-sm);font-weight:var(--font-semibold);">${starProduct ? starProduct.name : 'N/A'}</div>
        </div>
        <div style="grid-column:1/-1;">
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-bottom:var(--space-1);">Comparación Semana Pasada</div>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="font-size:var(--text-lg);font-weight:var(--font-bold);">$${lastWeekTotal.toFixed(2)}</span>
            <span class="badge ${lastWeekTotal >= weekBeforeTotal ? 'badge-success' : 'badge-danger'}" style="font-size:var(--text-xs);">
              ${lastWeekTotal >= weekBeforeTotal ? '+' : ''}{{((lastWeekTotal - weekBeforeTotal) / (weekBeforeTotal || 1) * 100).toFixed(1)}}%
            </span>
            <span style="font-size:var(--text-xs);color:var(--color-text-secondary);">vs semana anterior</span>
          </div>
        </div>
      </div>
    `;
  }

  getPaymentMethodLabel(method) {
    const labels = {
      'cash': 'Efectivo',
      'debit': 'Débito',
      'transfer': 'Transferencia',
      'account': 'Cuenta',
      'mixed': 'Mixto'
    };
    return labels[method] || method || 'N/A';
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

  initCategoriesChart(sales, products) {
    const canvas = document.getElementById('chart-categories');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const categoryData = this.getSalesByCategory(sales, products);

    this.drawDoughnutChart(ctx, categoryData.labels, categoryData.data, ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6']);
  }

  initPaymentMethodsChart(sales) {
    const canvas = document.getElementById('chart-payment-methods');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const methods = { cash: 0, debit: 0, transfer: 0, account: 0, mixed: 0 };
    const labels = { cash: 'Efectivo', debit: 'Débito', transfer: 'Transferencia', account: 'Cuenta', mixed: 'Mixto' };

    sales.forEach(sale => {
      if (sale.paymentMethod && methods[sale.paymentMethod] !== undefined) {
        methods[sale.paymentMethod] += parseFloat(sale.total) || 0;
      }
    });

    const methodKeys = Object.keys(methods).filter(k => methods[k] > 0);
    const methodData = methodKeys.map(k => methods[k]);
    const methodLabels = methodKeys.map(k => labels[k]);

    this.drawHorizontalBarChart(ctx, methodLabels, methodData, '#7C3AED');
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

    this.drawBarChart(ctx, labels, hourData, ['#7C3AED', '#A78BFA', '#C4B5FD', '#7C3AED', '#A78BFA', '#C4B5FD', '#7C3AED', '#A78BFA', '#C4B5FD', '#7C3AED', '#A78BFA', '#C4B5FD', '#7C3AED', '#A78BFA', '#C4B5FD', '#7C3AED', '#A78BFA', '#C4B5FD']);
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
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySales = sales.filter(s => s.date && s.date.startsWith(dateStr));
      const total = daySales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
      data.push(total);
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

  getSalesByCategory(sales, products) {
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
    products.forEach(p => {
      if (p.categoryId) {
        const cat = products.find(c => c.id === p.categoryId);
        if (cat) categoryMap[p.categoryId] = cat.name;
      }
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

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const barIndex = Math.floor((mouseX - padding.left) / (chartWidth / labels.length));

      if (barIndex >= 0 && barIndex < data.length && data[barIndex] > 0) {
        canvas.style.cursor = 'pointer';
        ctx.clearRect(padding.left, 0, chartWidth, padding.top);
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(`${labels[barIndex]}: $${Math.round(data[barIndex])}`, padding.left, padding.top - 10);
      } else {
        canvas.style.cursor = 'default';
      }
    };
  }

  drawDoughnutChart(ctx, labels, data, colors) {
    const canvas = ctx.canvas;
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 40;
    const total = data.reduce((sum, v) => sum + v, 0);

    ctx.clearRect(0, 0, width, height);

    if (total === 0) {
      ctx.fillStyle = '#6B7280';
      ctx.font = '14px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('No hay datos', centerX, centerY);
      return;
    }

    let currentAngle = -Math.PI / 2;

    data.forEach((value, i) => {
      const sliceAngle = (value / total) * 2 * Math.PI;

      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      if (value > 0) {
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
        const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round((value / total) * 100)}%`, labelX, labelY);
      }

      currentAngle += sliceAngle;
    });

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('$' + Math.round(total), centerX, centerY + 5);

    const legendY = height - 30;
    let legendX = (width - labels.length * 80) / 2;

    labels.forEach((label, i) => {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(legendX, legendY, 10, 10);
      ctx.fillStyle = '#374151';
      ctx.font = '10px Inter';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label, legendX + 15, legendY - 2);
      legendX += 80;
    });
  }

  drawHorizontalBarChart(ctx, labels, data, color) {
    const canvas = ctx.canvas;
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 100 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barHeight = chartHeight / labels.length * 0.6;
    const gap = chartHeight / labels.length * 0.4;
    const maxValue = Math.max(...data, 1);

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#E5E7EB';
    ctx.fillStyle = '#6B7280';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';

    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (chartWidth * i / 5);
      const value = (maxValue * i / 5);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();
      ctx.fillText(Math.round(value), x, padding.top + chartHeight + 20);
    }

    data.forEach((value, i) => {
      const y = padding.top + (chartHeight * i / labels.length) + gap / 2;
      const barWidth = (value / maxValue) * chartWidth;

      const gradient = ctx.createLinearGradient(padding.left, y, padding.left + barWidth, y);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + '99');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(padding.left, y, barWidth, barHeight, [0, 4, 4, 0]);
      ctx.fill();

      ctx.fillStyle = '#374151';
      ctx.font = '11px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(labels[i], padding.left - 10, y + barHeight / 2 + 4);

      if (value > 0) {
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(Math.round(value), padding.left + barWidth + 10, y + barHeight / 2 + 4);
      }
    });
  }

  drawBarChart(ctx, labels, data, colors) {
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
      gradient.addColorStop(0, colors[i % colors.length]);
      gradient.addColorStop(1, colors[(i + 1) % colors.length] || colors[i % colors.length]);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      ctx.fill();

      if (value > 0) {
        ctx.fillStyle = '#374151';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], x + barWidth / 2, height - padding.bottom + 15);
      }
    });
  }
}

export default new Dashboard();
