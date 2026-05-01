'use strict';

class Toast {
  static container = null;

  static init(container) {
    this.container = container;
  }

  static show(title, message, type = 'success', duration = 3000) {
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠'}</span>
      <div class="toast__content">
        <div class="toast__title">${title}</div>
        <div class="toast__message">${message}</div>
      </div>
      <button class="toast__close">✕</button>
    `;

    this.container.appendChild(toast);

    toast.querySelector('.toast__close').addEventListener('click', () => {
      this.dismiss(toast);
    });

    setTimeout(() => this.dismiss(toast), duration);
  }

  static dismiss(toast) {
    toast.style.animation = 'slideOutRight var(--transition-normal)';
    setTimeout(() => toast.remove(), 300);
  }

  static success(title, message) {
    this.show(title, message, 'success');
  }

  static error(title, message) {
    this.show(title, message, 'error', 5000);
  }

  static warning(title, message) {
    this.show(title, message, 'warning', 4000);
  }
}

export default Toast;
