'use strict';

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'debit', label: 'Débito' },
  { id: 'transfer', label: 'Transferencia' },
  { id: 'account', label: 'Cuenta Corriente' }
];

const METHOD_LABELS = {
  cash: 'Efectivo',
  debit: 'Débito',
  transfer: 'Transferencia',
  account: 'Cuenta Corriente'
};

export const PAYMENT_COLORS = {
  cash: '#10B981',
  debit: '#8B5CF6',
  transfer: '#3B82F6',
  account: '#F59E0B'
};

export function getPaymentMethodLabel(method) {
  return METHOD_LABELS[method] || method || 'N/A';
}

export function getPayments(sale) {
  if (sale.payments && Array.isArray(sale.payments) && sale.payments.length > 0) {
    return sale.payments.map(p => ({
      method: p.method,
      amount: parseFloat(p.amount) || 0
    }));
  }
  if (sale.paymentMethod) {
    return [{ method: sale.paymentMethod, amount: parseFloat(sale.total) || 0 }];
  }
  return [];
}

export function getPaymentType(sale) {
  if (sale.paymentType === 'COMBINADO') return 'COMBINADO';
  const payments = getPayments(sale);
  if (payments.length > 1) return 'COMBINADO';
  return 'SIMPLE';
}

export function getMethodTotal(sale, method) {
  const payments = getPayments(sale);
  return payments
    .filter(p => p.method === method)
    .reduce((sum, p) => sum + p.amount, 0);
}

export function formatPayments(sale) {
  const payments = getPayments(sale);
  return payments.map(p => `${getPaymentMethodLabel(p.method)}: $${p.amount.toFixed(2)}`).join(', ');
}

export function validatePayments(payments, total) {
  if (!payments || payments.length === 0) {
    return { valid: false, error: 'Agregá al menos un método de pago' };
  }
  for (const p of payments) {
    if (!p.method) {
      return { valid: false, error: 'Seleccioná un método de pago' };
    }
    if (isNaN(p.amount) || p.amount < 0) {
      return { valid: false, error: 'Montos de pago inválidos' };
    }
  }
  const sum = payments.reduce((s, p) => s + p.amount, 0);
  const diff = Math.abs(sum - total);
  if (diff > 0.01) {
    return { valid: false, error: `La suma de los pagos ($${sum.toFixed(2)}) no coincide con el total ($${total.toFixed(2)})` };
  }
  return { valid: true, error: null };
}
