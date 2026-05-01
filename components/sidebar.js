'use strict';

import router from '../js/router.js';
import state from '../js/state.js';

class Sidebar {
  constructor() {
    this.element = null;
  }

  getMenuItems() {
    const user = state.get('currentUser');
    const items = [
      { route: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
      { route: 'pos', icon: 'fa-cash-register', label: 'POS' },
      { route: 'products', icon: 'fa-box', label: 'Productos' },
      { route: 'categories', icon: 'fa-tags', label: 'Categorías' },
      { route: 'customers', icon: 'fa-users', label: 'Clientes' },
      { route: 'sales', icon: 'fa-money-bill', label: 'Ventas' },
      { route: 'cash', icon: 'fa-money-bill-wave', label: 'Caja' }
    ];

    if (user && user.role === 'admin') {
      items.push(
        { route: 'reports', icon: 'fa-chart-bar', label: 'Reportes' },
        { route: 'settings', icon: 'fa-gear', label: 'Configuración' }
      );
    }

    return items;
  }

  render() {
    const items = this.getMenuItems();
    const currentRoute = state.get('currentRoute') || 'dashboard';

    return `
      <div class="sidebar-header">
        <div class="sidebar-logo">P</div>
        <span class="sidebar-brand">POS Premium</span>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-section">
          <div class="sidebar-section-title">Principal</div>
          ${items.map(item => `
            <div class="sidebar-item ${item.route === currentRoute ? 'active' : ''}" data-route="${item.route}">
              <span class="sidebar-item__icon"><i class="fa-solid ${item.icon}"></i></span>
              <span>${item.label}</span>
            </div>
          `).join('')}
        </div>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-item" id="logout-btn">
          <span class="sidebar-item__icon"><i class="fa-solid fa-right-from-bracket"></i></span>
          <span>Cerrar Sesión</span>
        </div>
      </div>
    `;
  }

  mount(container) {
    this.element = container;
    container.innerHTML = this.render();

    container.addEventListener('click', (e) => {
      const item = e.target.closest('.sidebar-item');
      if (!item) return;

      if (item.id === 'logout-btn') {
        state.set('currentUser', null);
        window.location.reload();
        return;
      }

      const route = item.dataset.route;
      if (route) {
        router.navigate(route);
      }
    });

    state.on('state:currentRoute', (route) => {
      container.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.toggle('active', item.dataset.route === route);
      });
    });

    this.initHoverMode();
  }

  initHoverMode() {
    const app = document.getElementById('app');
    if (!app) return;

    let hoverTimeout;
    let isHovering = false;

    const sidebarMode = state.get('sidebarMode') || 'expanded';
    const sidebarCollapsed = sidebarMode === 'collapsed' || sidebarMode === 'hover';

    if (!sidebarCollapsed) return;

    document.addEventListener('mousemove', (e) => {
      if (e.clientX <= 10 && !isHovering) {
        isHovering = true;
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          app.classList.add('sidebar-hover-active');
        }, 300);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (e.clientX > 300 && isHovering) {
        isHovering = false;
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          app.classList.remove('sidebar-hover-active');
        }, 300);
      }
    });

    const sidebar = this.element;
    if (sidebar) {
      sidebar.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
      });

      sidebar.addEventListener('mouseleave', () => {
        isHovering = false;
        hoverTimeout = setTimeout(() => {
          app.classList.remove('sidebar-hover-active');
        }, 300);
      });
    }

    // Auto-activar hover mode para POS
    state.on('state:currentRoute', (route) => {
      if (route === 'pos') {
        app.classList.add('sidebar-collapsed');
        app.classList.remove('sidebar-hidden');
        state.set('sidebarMode', 'hover');
      } else if (state.get('sidebarMode') === 'hover') {
        // Restaurar expanded para otras rutas
        app.classList.remove('sidebar-collapsed', 'sidebar-hover-active');
        state.set('sidebarMode', 'expanded');
      }
    });
  }
}

export default Sidebar;
