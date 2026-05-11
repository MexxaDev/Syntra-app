'use strict';

import state from '../js/state.js';

class Header {
  constructor() {
    this.element = null;
  }

  render() {
    const user = state.get('currentUser');
    const isCashier = user && user.role === 'cajero';
    const sidebarMode = state.get('sidebarMode') || 'expanded';
    const isCollapsed = sidebarMode === 'collapsed' || sidebarMode === 'hover';
    return `
      <div class="header-left">
        <button class="btn btn-ghost btn-icon" id="sidebar-toggle-btn" title="${isCollapsed ? 'Mostrar sidebar' : 'Ocultar sidebar'}">
          <i class="fa-solid ${isCollapsed ? 'fa-bars' : 'fa-xmark'}"></i>
        </button>
        <button class="btn btn-ghost btn-icon" id="mobile-menu-btn" style="${isCashier ? 'display:block;' : 'display:none;'}">
          <i class="fa-solid fa-bars"></i>
        </button>
        <div class="header-search">
          <span class="header-search__icon"><i class="fa-solid fa-magnifying-glass"></i></span>
          <input type="text" class="header-search__input" placeholder="Buscar productos, clientes...">
        </div>
      </div>
      <div class="header-right">
        <div class="alerts-btn-wrapper">
          <button class="alerts-btn" id="header-alerts-btn" title="Alertas">
            <i class="fa-solid fa-bell"></i>
            <span class="alerts-badge" id="header-alerts-badge" style="display:none"></span>
          </button>
          <div class="alerts-popover" id="header-alerts-popover">
            <div class="alerts-popover__header">
              <span class="alerts-popover__title">Notificaciones</span>
              <span class="alerts-popover__count" id="header-alerts-count" style="display:none"></span>
            </div>
            <div id="header-alerts-content"></div>
          </div>
        </div>
        <span style="font-size:var(--text-sm);color:var(--color-text-secondary);">
          ${user ? user.name : ''} (${user ? user.role : ''})
        </span>
      </div>
    `;
  }

  mount(container) {
    this.element = container;
    container.innerHTML = this.render();

    const mobileBtn = document.getElementById('mobile-menu-btn');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');

    if (window.innerWidth <= 768) {
      mobileBtn.style.display = 'block';
    }

    window.addEventListener('resize', () => {
      if (window.innerWidth <= 768) {
        mobileBtn.style.display = 'block';
      } else {
        mobileBtn.style.display = 'none';
      }
    });

    mobileBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('open');
    });

    toggleBtn.addEventListener('click', () => {
      const app = document.getElementById('app');
      const currentMode = state.get('sidebarMode') || 'expanded';

      if (currentMode === 'expanded') {
        state.set('sidebarMode', 'collapsed');
        app.classList.add('sidebar-collapsed');
        app.classList.remove('sidebar-hidden');
      } else if (currentMode === 'collapsed' || currentMode === 'hover') {
        state.set('sidebarMode', 'hidden');
        app.classList.add('sidebar-hidden');
        app.classList.remove('sidebar-collapsed');
      } else {
        state.set('sidebarMode', 'expanded');
        app.classList.remove('sidebar-collapsed', 'sidebar-hidden');
      }

      this.updateToggleIcon();
    });

    this._initAlertsPopover();
    this.updateToggleIcon();
  }

  _initAlertsPopover() {
    const btn = document.getElementById('header-alerts-btn');
    const popover = document.getElementById('header-alerts-popover');
    if (!btn || !popover) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (popover && !popover.contains(e.target) && e.target !== btn) {
        popover.classList.remove('active');
      }
    });
  }

  updateToggleIcon() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (!toggleBtn) return;

    const currentMode = state.get('sidebarMode') || 'expanded';
    const icon = toggleBtn.querySelector('i');
    if (currentMode === 'expanded') {
      icon.className = 'fa-solid fa-xmark';
      toggleBtn.title = 'Ocultar sidebar';
    } else {
      icon.className = 'fa-solid fa-bars';
      toggleBtn.title = 'Mostrar sidebar';
    }
  }
}

export default Header;
