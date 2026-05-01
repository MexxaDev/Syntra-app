'use strict';

import state from './state.js';

class Router {
  constructor() {
    this.privateRoutes = [
      'dashboard',
      'pos',
      'products',
      'categories',
      'customers',
      'sales',
      'cash',
      'reports',
      'settings'
    ];
    this.publicRoutes = ['shop'];
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  handleRoute() {
    let hash = window.location.hash.slice(1) || 'dashboard';

    state.set('currentRoute', hash);

    if (this.publicRoutes.includes(hash)) {
      this.showPublicRoute(hash);
    } else {
      if (!this.privateRoutes.includes(hash)) {
        hash = 'dashboard';
        window.location.hash = hash;
      }
      this.showPrivateRoute(hash);
    }
  }

  navigate(route) {
    window.location.hash = route;
  }

  async showPublicRoute(route) {
    const loginScreen = document.getElementById('login-screen');
    const app = document.getElementById('app');
    const shopContainer = document.getElementById('shop-container');

    // Hide ALL admin elements
    if (loginScreen) loginScreen.style.display = 'none';
    if (app) app.style.display = 'none';

    // Show shop with proper isolation
    if (shopContainer) {
      shopContainer.style.display = 'block';
      shopContainer.classList.add('active');
    }

    // Add class to body for CSS isolation
    document.body.classList.add('shop-active');
    document.body.classList.remove('app-active');

    state.set('currentRoute', route);

    if (route === 'shop') {
      try {
        const { default: Shop } = await import('../modules/shop/shop.js');
        await Shop.load();
      } catch (error) {
        console.error('Error loading Shop module:', error);
      }
    }
  }

  showPrivateRoute(route) {
    const app = document.getElementById('app');
    const shopContainer = document.getElementById('shop-container');

    // Remove shop isolation
    document.body.classList.remove('shop-active');
    document.body.classList.add('app-active');

    if (app) app.style.display = 'grid';
    if (shopContainer) {
      shopContainer.style.display = 'none';
      shopContainer.classList.remove('active');
    }

    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById(route);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === route);
    });
  }
}

export default new Router();
