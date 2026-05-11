"use strict";

export function drawBarChart(ctx, labels, data, colors) {
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

export function drawDoughnutChart(ctx, labels, data, colors, currencySymbol) {
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.offsetWidth || 400;
  const height = canvas.height;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 40;
  const total = data.reduce((sum, v) => sum + v, 0);
  const sym = currencySymbol || '$';

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
  ctx.fillText(sym + Math.round(total), centerX, centerY);

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

export function drawPieChart(ctx, labels, data, colors, currencySymbol) {
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.offsetWidth || 400;
  const height = canvas.height;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const centerX = width / 2;
  const centerY = height / 2 - 10;
  const radius = Math.min(centerX, centerY) - 20;
  const total = data.reduce((sum, v) => sum + v, 0);
  const sym = currencySymbol || '$';

  ctx.clearRect(0, 0, width, height);

  if (total === 0) {
    ctx.fillStyle = '#6B7280';
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('No hay datos', centerX, centerY);
    return;
  }

  let currentAngle = -Math.PI / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  data.forEach((value, i) => {
    const sliceAngle = (value / total) * 2 * Math.PI;

    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();

    currentAngle += sliceAngle;
  });

  ctx.restore();

  currentAngle = -Math.PI / 2;

  data.forEach((value, i) => {
    const sliceAngle = (value / total) * 2 * Math.PI;
    const pct = Math.round((value / total) * 100);

    if (pct >= 8) {
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius * 0.65);
      const labelY = centerY + Math.sin(labelAngle) * (radius * 0.65);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pct + '%', labelX, labelY);
    }

    currentAngle += sliceAngle;
  });

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.06)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
  ctx.fill();

  ctx.restore();

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 18px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sym + Math.round(total), centerX, centerY - 8);

  ctx.fillStyle = '#6B7280';
  ctx.font = '11px Inter';
  ctx.fillText('Total', centerX, centerY + 16);

  const legendY = height - (labels.length * 26 + 10);
  const legendX = 20;

  labels.forEach((label, i) => {
    const y = legendY + i * 26;
    const pct = Math.round((data[i] / total) * 100);
    const amount = sym + data[i].toFixed(2);

    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(legendX + 6, y + 6, 6, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#374151';
    ctx.font = '12px Inter';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, legendX + 18, y + 6);

    ctx.fillStyle = '#6B7280';
    ctx.font = '11px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(pct + '%  ' + amount, width - 20, y + 6);
  });
}

export function setupChartResize(canvas, drawFn) {
  if (!canvas || !drawFn) return;
  let rafId = null;
  const observer = new ResizeObserver(() => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      drawFn();
      rafId = null;
    });
  });
  observer.observe(canvas);
  return () => observer.disconnect();
}
