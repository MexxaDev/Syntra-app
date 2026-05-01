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

    this.updateToggleIcon();
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
