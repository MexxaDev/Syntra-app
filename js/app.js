'use strict';

import db from '../db/indexeddb.js';
import state from './state.js';
import router from './router.js';
import { userRepo, settingRepo, categoryRepo, productRepo } from '../db/repositories.js';
import Sidebar from '../components/sidebar.js';
import Header from '../components/header.js';
import Toast from '../components/toast.js';
import POS from '../modules/pos/pos.js';
import Products from '../modules/products/products.js';
import Categories from '../modules/categories/categories.js';
import Customers from '../modules/customers/customers.js';
import Sales from '../modules/sales/sales.js';
import Cash from '../modules/cash/cash.js';
import Settings from '../modules/settings/settings.js';
import Dashboard from '../modules/dashboard/dashboard.js';
import Reports from '../modules/reports/reports.js';
import Notification from '../components/notification.js';

async function seedDatabase() {
  try {
    const response = await fetch('./data/seed.json');
    const seedData = await response.json();

    const users = await userRepo.findAll();
    if (users.length === 0) {
      for (const category of seedData.categories) {
        await categoryRepo.create(category);
      }
      for (const product of seedData.products) {
        await productRepo.create(product);
      }
      for (const user of seedData.users) {
        await userRepo.create(user);
      }
      for (const setting of seedData.settings) {
        await settingRepo.create(setting);
      }
      console.log('Seed data loaded');
    } else {
      const products = await productRepo.findAll();
      if (products.length < seedData.products.length) {
        for (const product of seedData.products) {
          const existing = products.find(p => p.id === product.id);
          if (!existing) {
            await productRepo.create(product);
          }
        }
        console.log('Additional products seeded');
      }

      const settings = await settingRepo.findAll();
      const settingsMap = {};
      settings.forEach(s => { settingsMap[s.key] = s; });

      for (const setting of seedData.settings) {
        if (!settingsMap[setting.key]) {
          await settingRepo.create(setting);
        }
      }
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

function initLogin() {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app');
  const shopContainer = document.getElementById('shop-container');

  const hash = window.location.hash.slice(1);
  if (hash === 'shop') {
    loginScreen.style.display = 'none';
    appContainer.style.display = 'none';
    if (shopContainer) {
      shopContainer.style.display = 'block';
      shopContainer.classList.add('active');
    }
    document.body.classList.add('shop-active');
    return;
  }

  const currentUser = state.get('currentUser');
  if (currentUser) {
    loginScreen.style.display = 'none';
    appContainer.style.display = 'grid';
    initApp();
    return;
  }

  loginScreen.innerHTML = `
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">P</div>
        <h1 class="login-title">POS Premium</h1>
        <p class="login-subtitle">Ingresá tus credenciales</p>
      </div>
      <form class="login-form" id="login-form">
        <div class="form-group">
          <label class="form-label">Usuario</label>
          <input type="text" class="form-input" id="login-username" placeholder="admin o cajero" required>
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <input type="password" class="form-input" id="login-password" placeholder="Contraseña" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">Ingresar</button>
      </form>
      <div class="login-footer">
        <p>Demo: admin / admin123 o cajero / cajero123</p>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const users = await userRepo.findAll();
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      state.set('currentUser', {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      });
      loginScreen.style.display = 'none';
      appContainer.style.display = 'grid';

      if (user.role === 'cajero') {
        appContainer.classList.add('sidebar-collapsed');
      }

      initApp();
      Toast.success('Bienvenido', `Hola ${user.name}`);
    } else {
      Toast.error('Error', 'Credenciales incorrectas');
    }
  });
}

function initApp() {
  const sidebar = new Sidebar();
  sidebar.mount(document.getElementById('sidebar'));

  const header = new Header();
  header.mount(document.getElementById('header'));

  Toast.init(document.getElementById('toast-container'));

  Notification.init();

  state.on('state:currentRoute', (route) => {
    loadModule(route);
  });

  if (state.get('currentUser')) {
    loadSettings();
    loadModule(state.get('currentRoute') || 'dashboard');
  }
}

async function loadModule(route) {
  try {
    switch (route) {
      case 'pos':
        await POS.loadProducts();
        const confirmBtn = document.getElementById('confirm-sale-btn');
        if (confirmBtn) {
          confirmBtn.onclick = () => POS.confirmSale();
        }
        const discountType = document.getElementById('discount-type');
        const discountValue = document.getElementById('discount-value');
        if (discountType) {
          discountType.onchange = (e) => {
            POS.setDiscount(e.target.value, discountValue?.value || 0);
          };
        }
        if (discountValue) {
          let discTimeout;
          discountValue.oninput = (e) => {
            clearTimeout(discTimeout);
            discTimeout = setTimeout(() => {
              const type = discountType?.value || 'percent';
              POS.setDiscount(type, e.target.value);
            }, 300);
          };
        }
        document.querySelectorAll('.payment-btn').forEach(btn => {
          btn.onclick = () => {
            document.querySelectorAll('.payment-btn').forEach(b => {
              b.className = 'btn btn-sm btn-secondary payment-btn';
            });
            btn.className = 'btn btn-sm btn-primary payment-btn';
            POS.setPaymentMethod(btn.dataset.method);
          };
        });
        setTimeout(() => {
          const barcodeInput = document.getElementById('pos-barcode-input');
          if (barcodeInput) {
            barcodeInput.focus();
          }
        }, 100);

        const app = document.getElementById('app');
        if (app) {
          app.classList.add('sidebar-collapsed');
          app.classList.remove('sidebar-hidden');
          state.set('sidebarMode', 'hover');
        }
        break;
      case 'products':
        await Products.load();
        const addProductBtn = document.getElementById('add-product-btn');
        if (addProductBtn) {
          addProductBtn.onclick = () => Products.openModal();
        }
        const productSearch = document.getElementById('product-search');
        if (productSearch) {
          let timeout;
          productSearch.oninput = (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => Products.search(e.target.value), 300);
          };
        }
        break;
      case 'categories':
        await Categories.load();
        const addCategoryBtn = document.getElementById('add-category-btn');
        if (addCategoryBtn) {
          addCategoryBtn.onclick = () => Categories.openModal();
        }
        break;
      case 'customers':
        const custContainer = document.getElementById('customers-content');
        if (custContainer) {
          await Customers.load();
        }
        break;
      case 'sales':
        const salesContainer = document.getElementById('sales-list');
        if (salesContainer) {
          await Sales.load();
          const filterBtn = document.getElementById('sales-filter-btn');
          if (filterBtn) {
            filterBtn.onclick = () => Sales.filter();
          }
        }
        break;
      case 'cash':
        const cashContainer = document.getElementById('cash-content');
        if (cashContainer) {
          await Cash.load();
        }
        break;
      case 'settings':
        const settingsContainer = document.getElementById('settings');
        if (settingsContainer) {
          await Settings.load();
        }
        break;
      case 'reports':
        const reportsContainer = document.getElementById('reports');
        if (reportsContainer) {
          await Reports.load();
        }
        break;
      case 'dashboard':
      default:
        const dashboardContainer = document.getElementById('dashboard');
        if (dashboardContainer) {
          await Dashboard.load();
        }
        break;
    }
  } catch (error) {
    console.error(`Error loading module ${route}:`, error);
  }
}

async function loadSettings() {
  const defaultSettings = [
    { key: 'businessName', value: 'Mi Negocio' },
    { key: 'currency', value: 'ARS' },
    { key: 'currencySymbol', value: '$' },
    { key: 'taxRate', value: '21' },
    { key: 'ticketFooter', value: 'Gracias por su compra!' },
    { key: 'logo', value: '' }
  ];

  try {
    const existingSettings = await settingRepo.findAll();
    const existingMap = {};
    existingSettings.forEach(s => { existingMap[s.key] = s; });

    for (const def of defaultSettings) {
      if (!existingMap[def.key]) {
        await settingRepo.create(def);
      }
    }

    const settings = await settingRepo.findAll();
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    state.set('settings', settingsObj);
  } catch (error) {
    console.error('Error loading settings:', error);
    state.set('settings', { currencySymbol: '$', taxRate: '21' });
  }
}

(async () => {
  try {
    await db.init();
    await seedDatabase();

    const hash = window.location.hash.slice(1);

    if (hash === 'shop') {
      initLogin();
    } else {
      initLogin();
    }

    router.init();
  } catch (error) {
    console.error('App initialization error:', error);
  }
})();
