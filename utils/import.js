'use strict';

import db from '../db/indexeddb.js';

export function importDatabase(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);

        for (const [storeName, items] of Object.entries(data)) {
          if (Array.isArray(items)) {
            await db.clear(storeName);
            for (const item of items) {
              await db.add(storeName, item);
            }
          }
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
}
