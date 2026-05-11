'use strict';

import { saleRepo, productRepo, customerRepo, categoryRepo } from '../../db/repositories.js';
import { getPayments, PAYMENT_COLORS } from '../../utils/payments.js';
import { drawBarChart, drawDoughnutChart, drawPieChart } from '../../utils/charts.js';
import state from '../../js/state.js';

class Reports {
  constructor() {
    this.sales = [];
    this.products = [];
    this.customers = [];
    this.categories = [];
    this.currentPeriod = 30;
  }

  async load() {
    const container = document.getElementById('reports');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>
          Cargando reportes...
        </div>
      `;
    }

    try {
      const [sales, products, customers, categories] = await Promise.all([
        saleRepo.findAll(),
        productRepo.findAll(),
        customerRepo.findAll(),
        categoryRepo.findAll()
      ]);

      this.sales = sales || [];
      this.products = products || [];
      this.customers = customers || [];
      this.categories = categories || [];

      this.render();
    } catch (error) {
      console.error('Error loading reports:', error);
      if (container) {
        container.innerHTML = `
          <div style="text-align:center;padding:var(--space-8);color:var(--color-danger);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:48px;margin-bottom:var(--space-3);display:block;"></i>
            <h3>Error al cargar reportes</h3>
            <p style="margin-top:var(--space-2);color:var(--color-text-secondary);">Revisa la consola para más detalles</p>
          </div>
        `;
      }
    }
  }

  render() {
    const container = document.getElementById('reports');
    if (!container) return;

    const settings = state.get('settings') || {};
    const currencySymbol = settings.currencySymbol || '$';

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-header__title">Reportes</h1>
        <p class="page-header__subtitle">Análisis avanzado de ventas</p>
      </div>

      <div class="kpi-grid">
        ${this.renderSummaryCards(currencySymbol)}
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Ventas por Período</h3>
            <div class="chart-period-selector" id="report-period-selector">
              <button class="chart-period-btn" data-period="7">7 días</button>
              <button class="chart-period-btn active" data-period="30">30 días</button>
              <button class="chart-period-btn" data-period="90">90 días</button>
              <button class="chart-period-btn" data-period="365">Año</button>
            </div>
          </div>
          <canvas id="report-main-chart" height="350" aria-label="Gráfico de ventas por período"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Distribución por Categoría</h3>
          </div>
          <canvas id="report-category-chart" height="350" aria-label="Gráfico de distribución por categoría"></canvas>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Métodos de Pago</h3>
          </div>
          <canvas id="report-payment-chart" height="280" aria-label="Gráfico de métodos de pago"></canvas>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Top 10 Productos</h3>
          </div>
          <div id="report-top-products"></div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      setTimeout(() => {
        this.initMainChart();
        this.initCategoryChart(currencySymbol, this.categories);
        this.initPaymentChart(currencySymbol);
        this.renderTopProductsDetailed(currencySymbol);
      }, 100);

      this.attachPeriodSelector();
    });
  }

  renderSummaryCards(currencySymbol) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonth = y + '-' + m;

    const salesToday = this.sales.filter(s => s.date && s.date.startsWith(today));
    const salesMonth = this.sales.filter(s => s.date && s.date.startsWith(thisMonth));

    const totalToday = salesToday.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const totalMonth = salesMonth.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

    const avgTicket = salesMonth.length > 0 ? totalMonth / salesMonth.length : 0;

    const productCounts = {};
    this.sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          productCounts[item.productId] = (productCounts[item.productId] || 0) + (item.quantity || 0);
        });
      }
    });
    const totalItems = Object.values(productCounts).reduce((sum, q) => sum + q, 0);

    return `
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--primary">
            <i class="fa-solid fa-dollar-sign"></i>
          </div>
        </div>
        <div class="kpi-card__value">${currencySymbol} ${totalToday.toFixed(2)}</div>
        <div class="kpi-card__label">Ventas Hoy</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--success">
            <i class="fa-solid fa-chart-line"></i>
          </div>
        </div>
        <div class="kpi-card__value">${currencySymbol} ${totalMonth.toFixed(2)}</div>
        <div class="kpi-card__label">Ventas Mes</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--warning">
            <i class="fa-solid fa-ticket"></i>
          </div>
        </div>
        <div class="kpi-card__value">${currencySymbol} ${avgTicket.toFixed(2)}</div>
        <div class="kpi-card__label">Ticket Promedio</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--info">
            <i class="fa-solid fa-box"></i>
          </div>
        </div>
        <div class="kpi-card__value">${totalItems}</div>
        <div class="kpi-card__label">Unidades Vendidas</div>
      </div>
    `;
  }

  initMainChart() {
    const canvas = document.getElementById('report-main-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const data = this.getSalesByPeriod(this.currentPeriod);
    const labels = this.getPeriodLabels(this.currentPeriod);

    this.drawBarLineChart(ctx, labels, data, 'Ventas', ['#7C3AED', '#A78BFA', '#C4B5FD']);
  }

  initCategoryChart(currencySymbol, categories) {
    const canvas = document.getElementById('report-category-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const categoryData = this.getSalesByCategory(categories);

    drawDoughnutChart(ctx, categoryData.labels, categoryData.data, ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'], currencySymbol);
  }

  initPaymentChart(currencySymbol) {
    const canvas = document.getElementById('report-payment-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const methods = { cash: 0, debit: 0, transfer: 0, account: 0 };
    const labels = { cash: 'Efectivo', debit: 'Débito', transfer: 'Transferencia', account: 'Cuenta Corriente' };

    this.sales.forEach(sale => {
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

    drawPieChart(ctx, methodLabels, methodData, methodColors, currencySymbol);
  }

  renderTopProductsDetailed(currencySymbol) {
    const container = document.getElementById('report-top-products');
    if (!container) return;

    const productCounts = {};
    this.sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (!productCounts[item.productId]) {
            const product = this.products.find(p => p.id === item.productId);
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
      container.innerHTML = '<p style="color:var(--color-text-secondary);font-size:var(--text-sm);padding:var(--space-4);">No hay datos disponibles</p>';
      return;
    }

    container.innerHTML = topProducts.map((prod, i) => `
      <div class="top-product-item">
        <div class="top-product-item__image">
          ${prod.image ? `<img src="${prod.image}" alt="${prod.name}">` : `<i class="fa-solid fa-box"></i>`}
        </div>
        <div style="flex:1;">
          <div style="font-weight:var(--font-medium);font-size:var(--text-sm);">${i + 1}. ${prod.name}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);">${prod.quantity} vendidos - ${currencySymbol} ${prod.total.toFixed(2)}</div>
        </div>
        <div style="font-weight:var(--font-bold);font-size:var(--text-sm);color:var(--color-primary);">
          #${i + 1}
        </div>
      </div>
    `).join('');
  }

  attachPeriodSelector() {
    const selector = document.getElementById('report-period-selector');
    if (!selector) return;

    selector.querySelectorAll('.chart-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selector.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentPeriod = parseInt(btn.dataset.period);
        this.initMainChart();
      });
    });
  }

  getSalesByPeriod(days) {
    const dateMap = {};
    this.sales.forEach(s => {
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

  getSalesByCategory(categories) {
    const categoryTotals = {};

    this.sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          const product = this.products.find(p => p.id === item.productId);
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

  drawBarLineChart(ctx, labels, data, label, colors) {
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth || 400;
    const height = canvas.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...data, 1);

    let lastHoverIndex = -1;

    function drawChart(hoverIndex) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

      if (hoverIndex >= 0 && hoverIndex < data.length && data[hoverIndex] > 0) {
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(`${labels[hoverIndex]}: $${Math.round(data[hoverIndex])}`, padding.left, padding.top - 10);
      }

      ctx.restore();
    }

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const barIndex = Math.floor((mouseX - padding.left) / (chartWidth / labels.length));

      if (barIndex !== lastHoverIndex) {
        lastHoverIndex = barIndex;
        canvas.style.cursor = (barIndex >= 0 && barIndex < data.length && data[barIndex] > 0) ? 'pointer' : 'default';
        drawChart(lastHoverIndex);
      }
    };

    canvas.onmouseleave = () => {
      if (lastHoverIndex >= 0) {
        lastHoverIndex = -1;
        canvas.style.cursor = 'default';
        drawChart(-1);
      }
    };

    drawChart(-1);
  }
}

export default new Reports();
