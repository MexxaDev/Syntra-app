'use strict';

import { saleRepo, productRepo, settingRepo, customerRepo } from '../../db/repositories.js';
import state from '../../js/state.js';

class Reports {
  constructor() {
    this.sales = [];
    this.products = [];
    this.customers = [];
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
      const [sales, products, customers] = await Promise.all([
        saleRepo.findAll(),
        productRepo.findAll(),
        customerRepo.findAll()
      ]);

      this.sales = sales || [];
      this.products = products || [];
      this.customers = customers || [];

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

      <div class="kpi-grid" style="margin-bottom:var(--space-8);">
        ${this.renderSummaryCards(currencySymbol)}
      </div>

      <div class="charts-grid" style="margin-bottom:var(--space-8);">
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
          <canvas id="report-main-chart" height="350"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Distribución por Categoría</h3>
          </div>
          <canvas id="report-category-chart" height="350"></canvas>
        </div>
      </div>

      <div class="charts-grid" style="margin-bottom:var(--space-8);">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Métodos de Pago</h3>
          </div>
          <canvas id="report-payment-chart" height="250"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Horas Pico</h3>
          </div>
          <canvas id="report-peak-chart" height="250"></canvas>
        </div>
      </div>

      <div class="charts-grid" style="margin-bottom:var(--space-8);">
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Top 10 Productos</h3>
          </div>
          <div id="report-top-products"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <h3 class="chart-title">Rendimiento Semanal</h3>
          </div>
          <canvas id="report-weekly-chart" height="250"></canvas>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      setTimeout(() => {
        this.initMainChart();
        this.initCategoryChart(currencySymbol);
        this.initPaymentChart(currencySymbol);
        this.initPeakChart();
        this.renderTopProductsDetailed(currencySymbol);
        this.initWeeklyChart(currencySymbol);
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
    const totalAll = this.sales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

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
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--success">
            <i class="fa-solid fa-coins"></i>
          </div>
        </div>
        <div class="kpi-card__value">${currencySymbol} ${(totalAll * 0.3).toFixed(2)}</div>
        <div class="kpi-card__label">Utilidad Est.</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--primary">
            <i class="fa-solid fa-chart-bar"></i>
          </div>
        </div>
        <div class="kpi-card__value">${this.sales.length}</div>
        <div class="kpi-card__label">Total Ventas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--warning">
            <i class="fa-solid fa-users"></i>
          </div>
        </div>
        <div class="kpi-card__value">${this.customers.length}</div>
        <div class="kpi-card__label">Clientes</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__header">
          <div class="kpi-card__icon kpi-card__icon--info">
            <i class="fa-solid fa-box-open"></i>
          </div>
        </div>
        <div class="kpi-card__value">${this.products.length}</div>
        <div class="kpi-card__label">Productos</div>
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

  initCategoryChart(currencySymbol) {
    const canvas = document.getElementById('report-category-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const categoryData = this.getSalesByCategory();

    this.drawDoughnutChart(ctx, categoryData.labels, categoryData.data, ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6']);
  }

  initPaymentChart(currencySymbol) {
    const canvas = document.getElementById('report-payment-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const methods = { cash: 0, debit: 0, transfer: 0, account: 0, mixed: 0 };
    const labels = { cash: 'Efectivo', debit: 'Débito', transfer: 'Transferencia', account: 'Cuenta', mixed: 'Mixto' };

    this.sales.forEach(sale => {
      if (sale.paymentMethod && methods[sale.paymentMethod] !== undefined) {
        methods[sale.paymentMethod] += parseFloat(sale.total) || 0;
      }
    });

    const methodKeys = Object.keys(methods).filter(k => methods[k] > 0);
    const methodData = methodKeys.map(k => methods[k]);
    const methodLabels = methodKeys.map(k => labels[k]);

    this.drawHorizontalBarChart(ctx, methodLabels, methodData, '#7C3AED');
  }

  initPeakChart() {
    const canvas = document.getElementById('report-peak-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const hourData = new Array(18).fill(0);

    this.sales.forEach(sale => {
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

  initWeeklyChart(currencySymbol) {
    const canvas = document.getElementById('report-weekly-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const weeklyData = new Array(7).fill(0);

    this.sales.forEach(sale => {
      if (sale.date) {
        const saleDate = new Date(sale.date);
        const now = new Date();
        const diffTime = now - saleDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays < 7) {
          weeklyData[6 - diffDays] += parseFloat(sale.total) || 0;
        }
      }
    });

    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push((d.getMonth() + 1) + '/' + d.getDate());
    }

    this.drawBarChart(ctx, labels, weeklyData, ['#10B981', '#34D399', '#6EE7B7', '#10B981', '#34D399', '#6EE7B7', '#10B981']);
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
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySales = this.sales.filter(s => s.date && s.date.startsWith(dateStr));
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

  getSalesByCategory() {
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
    this.products.forEach(p => {
      if (p.categoryId) {
        const cat = this.products.find(c => c.id === p.categoryId);
        if (cat) categoryMap[p.categoryId] = cat.name;
      }
    });

    return {
      labels: Object.keys(categoryTotals).map(k => categoryMap[k] || 'Sin categoría'),
      data: Object.values(categoryTotals)
    };
  }

  drawBarLineChart(ctx, labels, data, label, colors) {
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
        ctx.textBaseline = 'middle';
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
    ctx.textBaseline = 'middle';
    ctx.fillText('$' + Math.round(total), centerX, centerY);

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

export default new Reports();
