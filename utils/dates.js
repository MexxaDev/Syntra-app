'use strict';

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function now() {
  return new Date().toISOString();
}

export function isToday(date) {
  const d = new Date(date).toISOString().split('T')[0];
  return d === today();
}

export function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

export function endOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
}

export function formatForDisplay(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
