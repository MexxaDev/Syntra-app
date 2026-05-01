'use strict';

class Modal {
  static backdrop = null;

  static init() {
    if (this.backdrop) return;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.innerHTML = '<div class="modal"><div class="modal-header"><h3 class="modal-title"></h3><button class="modal-close">✕</button></div><div class="modal-body"></div><div class="modal-footer"></div></div>';
    document.body.appendChild(this.backdrop);

    this.backdrop.querySelector('.modal-close').addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }

  static show({ title = '', body = '', footer = '', onClose = null }) {
    this.init();
    this.backdrop.querySelector('.modal-title').textContent = title;
    this.backdrop.querySelector('.modal-body').innerHTML = body;
    this.backdrop.querySelector('.modal-footer').innerHTML = footer;
    this._onClose = onClose;
    requestAnimationFrame(() => this.backdrop.classList.add('active'));
  }

  static close() {
    this.backdrop.classList.remove('active');
    if (this._onClose) this._onClose();
  }
}

export default Modal;
