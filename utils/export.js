'use strict';

import db from '../db/indexeddb.js';

export async function exportDatabase() {
  const stores = [
    'products', 'categories', 'customers', 'sales',
    'sale_items', 'cash_sessions', 'cash_movements', 'settings', 'users'
  ];

  const data = {};

  for (const store of stores) {
    data[store] = await db.getAll(store);
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
   a.download = `pos-backup-${new Date().toISOString().substring(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

export function exportToCSV(data, filename) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => JSON.stringify(row[h] || '')).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
   a.download = `${filename}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}
