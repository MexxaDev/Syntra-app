'use strict';

import { settingRepo } from '../../db/repositories.js';
import { exportDatabase } from '../../utils/export.js';
import { importDatabase } from '../../utils/import.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import state from '../../js/state.js';

class Settings {
  constructor() {
    this.settings = {};
    this.logoDataUrl = '';
  }

  async load() {
    const settings = await settingRepo.findAll();
    this.settings = {};
    settings.forEach(s => {
      this.settings[s.key] = s.value;
    });

    this.logoDataUrl = this.settings.logo || '';
    this.render();
  }

  render() {
    const container = document.getElementById('settings');
    if (!container) return;

    const currency = this.settings.currency || 'ARS';
    const currencySymbol = this.settings.currencySymbol || '$';
    const taxRate = this.settings.taxRate || '21';
    const businessName = this.settings.businessName || '';
    const ticketFooter = this.settings.ticketFooter || '';

    const shopEnabled = this.settings.shop_enabled === 'true' || false;
    const shopWhatsapp = this.settings.shop_whatsapp || '';
    const shopHoursOpen = this.settings.shop_hours_open || '09:00';
    const shopHoursClose = this.settings.shop_hours_close || '23:00';
    const shopTakeaway = this.settings.shop_takeaway_enabled !== 'false';
    const shopDelivery = this.settings.shop_delivery_enabled !== 'false';
    const shopMinDelivery = this.settings.shop_min_delivery || '0';
    const shopDeliveryCost = this.settings.shop_delivery_cost || '0';

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-header__title">Configuración</h1>
        <p class="page-header__subtitle">Ajustes del sistema</p>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Datos del Negocio</h3>
        <div class="settings-section__desc">Información que aparecerá en los tickets</div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">Nombre del Negocio</label>
            <input type="text" class="form-input" id="setting-businessName" value="${businessName}">
          </div>
          <div class="form-group">
            <label class="form-label">Moneda</label>
            <select class="form-input form-select" id="setting-currency">
              <option value="ARS" ${currency === 'ARS' ? 'selected' : ''}>Peso Argentino (ARS)</option>
              <option value="USD" ${currency === 'USD' ? 'selected' : ''}>Dólar (USD)</option>
              <option value="EUR" ${currency === 'EUR' ? 'selected' : ''}>Euro (EUR)</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">Símbolo de Moneda</label>
            <input type="text" class="form-input" id="setting-currencySymbol" value="${currencySymbol}" maxlength="5" style="width:80px;">
          </div>
          <div class="form-group">
            <label class="form-label">Tasa de Impuestos (%)</label>
            <input type="number" class="form-input" id="setting-taxRate" value="${taxRate}" min="0" max="100" style="width:100px;">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Pie de Ticket</label>
          <textarea class="form-input" id="setting-ticketFooter" rows="3">${ticketFooter}</textarea>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Shop - Catálogo Online</h3>
        <div class="settings-section__desc">Configuración del catálogo público para clientes</div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
            <input type="checkbox" id="setting-shop-enabled" ${shopEnabled ? 'checked' : ''}>
            <span class="form-label" style="margin:0;">Activar Shop</span>
          </label>
          <p style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-top:var(--space-1);">
            Al activar, tu catálogo estará disponible en ${window.location.origin}#shop
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">WhatsApp (con código país)</label>
            <input type="text" class="form-input" id="setting-shop-whatsapp" value="${shopWhatsapp}" placeholder="5491123456789">
            <p style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:var(--space-1);">
              Número donde llegarán los pedidos
            </p>
          </div>
          <div class="form-group">
            <label class="form-label">Color Primario</label>
            <input type="color" class="form-input" id="setting-shop-color" value="${this.settings.shop_primary_color || '#7C3AED'}">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">Horario Apertura</label>
            <input type="time" class="form-input" id="setting-shop-open" value="${shopHoursOpen}">
          </div>
          <div class="form-group">
            <label class="form-label">Horario Cierre</label>
            <input type="time" class="form-input" id="setting-shop-close" value="${shopHoursClose}">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
              <input type="checkbox" id="setting-shop-takeaway" ${shopTakeaway ? 'checked' : ''}>
              <span class="form-label" style="margin:0;">Take Away</span>
            </label>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
              <input type="checkbox" id="setting-shop-delivery" ${shopDelivery ? 'checked' : ''}>
              <span class="form-label" style="margin:0;">Delivery</span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">Monto Mínimo Delivery</label>
            <input type="number" class="form-input" id="setting-shop-min-delivery" value="${shopMinDelivery}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Costo Envío</label>
            <input type="number" class="form-input" id="setting-shop-delivery-cost" value="${shopDeliveryCost}" min="0">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Banner Principal (URL)</label>
          <input type="text" class="form-input" id="setting-shop-banner" value="${this.settings.shop_banner || ''}" placeholder="https://...">
        </div>

        <div class="form-group">
          <label class="form-label">Link Público del Shop</label>
          <div style="display:flex;gap:var(--space-2);align-items:center;">
            <input type="text" class="form-input" value="${window.location.origin}#shop" readonly
                   style="background:var(--color-gray-50);cursor:copy;">
            <button class="btn btn-sm btn-secondary" id="copy-shop-url" title="Copiar link">
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
          <p style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:var(--space-1);">
            Compartí este link con tus clientes
          </p>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Logo del Negocio</h3>
        <div class="settings-section__desc">Tamaño máximo: 200x200px. Se guardará en formato Base64.</div>

        <div style="display:flex;gap:var(--space-4);align-items:flex-start;">
          <div>
            <input type="file" accept="image/*" id="setting-logo" style="display:none;">
            <button class="btn btn-secondary" id="upload-logo-btn">
              <i class="fa-solid fa-upload"></i> Subir Logo
            </button>
            <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:var(--space-2);">
              Formatos: JPG, PNG, SVG, WebP
            </div>
          </div>
          <div id="logo-preview" style="display:${this.logoDataUrl ? 'block' : 'none'};">
            <img src="${this.logoDataUrl}" style="max-width:200px;max-height:200px;border-radius:var(--radius-lg);border:1px solid var(--color-border);">
            <button class="btn btn-sm btn-danger" id="remove-logo-btn" style="margin-top:var(--space-2);">Eliminar</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section__title">Copias de Seguridad</h3>
        <div class="settings-section__desc">Exporta o importa todos los datos del sistema en formato JSON.</div>

        <div style="display:flex;gap:var(--space-3);">
          <button class="btn btn-secondary" id="export-backup">
            <i class="fa-solid fa-file-export"></i> Exportar Backup
          </button>
          <button class="btn btn-secondary" id="import-backup">
            <i class="fa-solid fa-file-import"></i> Importar Backup
          </button>
          <input type="file" accept=".json" id="import-file" style="display:none;">
        </div>
      </div>

      <div style="margin-top:var(--space-6);">
        <button class="btn btn-secondary" id="reset-settings" style="margin-right:var(--space-3);">
          <i class="fa-solid fa-rotate-left"></i> Restablecer Defectos
        </button>
        <button class="btn btn-primary btn-lg" id="save-settings">
          <i class="fa-solid fa-floppy-disk"></i> Guardar Configuración
        </button>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    const uploadBtn = document.getElementById('upload-logo-btn');
    const logoInput = document.getElementById('setting-logo');
    const removeBtn = document.getElementById('remove-logo-btn');
    const exportBtn = document.getElementById('export-backup');
    const importBtn = document.getElementById('import-backup');
    const importFile = document.getElementById('import-file');
    const saveBtn = document.getElementById('save-settings');
    const resetBtn = document.getElementById('reset-settings');

    uploadBtn?.addEventListener('click', () => logoInput?.click());

    logoInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        Toast.error('Error', 'Seleccioná un archivo de imagen válido');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > 200 || height > 200) {
            const ratio = Math.min(200 / width, 200 / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          this.logoDataUrl = canvas.toDataURL('image/png');
          const preview = document.getElementById('logo-preview');
          preview.innerHTML = `
            <img src="${this.logoDataUrl}" style="max-width:200px;max-height:200px;border-radius:var(--radius-lg);border:1px solid var(--color-border);">
            <button class="btn btn-sm btn-danger" id="remove-logo-btn" style="margin-top:var(--space-2);">Eliminar</button>
          `;
          preview.style.display = 'block';
          document.getElementById('remove-logo-btn')?.addEventListener('click', () => this.removeLogo());
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    removeBtn?.addEventListener('click', () => this.removeLogo());

    exportBtn?.addEventListener('click', () => {
      exportDatabase();
    });

    importBtn?.addEventListener('click', () => importFile?.click());

    importFile?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        await importDatabase(file);
        Toast.success('Éxito', 'Backup importado correctamente');
        await this.load();
        state.set('settings', this.settings);
      } catch (error) {
        Toast.error('Error', 'No se pudo importar el backup');
      }
    });

    saveBtn?.addEventListener('click', () => this.save());

    resetBtn?.addEventListener('click', () => {
      Modal.show({
        title: 'Confirmar Restablecer',
        body: '<p>¿Estás seguro de restablecer todos los valores por defecto?</p>',
        footer: `
          <button class="btn btn-secondary" id="cancel-reset">Cancelar</button>
          <button class="btn btn-danger" id="confirm-reset">Restablecer</button>
        `,
        onClose: null
      });

      requestAnimationFrame(() => {
        document.getElementById('cancel-reset')?.addEventListener('click', () => Modal.close());
        document.getElementById('confirm-reset')?.addEventListener('click', () => {
          Modal.close();
          this.resetToDefaults();
        });
      });
    });
  }

  removeLogo() {
    this.logoDataUrl = '';
    const preview = document.getElementById('logo-preview');
    if (preview) {
      preview.style.display = 'none';
      preview.innerHTML = '';
    }
  }

  async save() {
    const businessName = document.getElementById('setting-businessName')?.value || '';
    const currency = document.getElementById('setting-currency')?.value || 'ARS';
    const currencySymbol = document.getElementById('setting-currencySymbol')?.value || '$';
    const taxRate = document.getElementById('setting-taxRate')?.value || '21';
    const ticketFooter = document.getElementById('setting-ticketFooter')?.value || '';

    const shopEnabled = document.getElementById('setting-shop-enabled')?.checked || false;
    const shopWhatsapp = document.getElementById('setting-shop-whatsapp')?.value || '';
    const shopColor = document.getElementById('setting-shop-color')?.value || '#7C3AED';
    const shopOpen = document.getElementById('setting-shop-open')?.value || '09:00';
    const shopClose = document.getElementById('setting-shop-close')?.value || '23:00';
    const shopTakeaway = document.getElementById('setting-shop-takeaway')?.checked || false;
    const shopDelivery = document.getElementById('setting-shop-delivery')?.checked || false;
    const shopMinDelivery = document.getElementById('setting-shop-min-delivery')?.value || '0';
    const shopDeliveryCost = document.getElementById('setting-shop-delivery-cost')?.value || '0';
    const shopBanner = document.getElementById('setting-shop-banner')?.value || '';

    document.getElementById('copy-shop-url')?.addEventListener('click', () => {
      const url = `${window.location.origin}#shop`;
      navigator.clipboard.writeText(url).then(() => {
        Toast.success('Enlace copiado', 'El link del shop fue copiado al portapapeles');
      });
    });

    const settings = [
      { key: 'businessName', value: businessName },
      { key: 'currency', value: currency },
      { key: 'currencySymbol', value: currencySymbol },
      { key: 'taxRate', value: taxRate },
      { key: 'ticketFooter', value: ticketFooter },
      { key: 'logo', value: this.logoDataUrl },
      { key: 'shop_enabled', value: shopEnabled.toString() },
      { key: 'shop_whatsapp', value: shopWhatsapp },
      { key: 'shop_primary_color', value: shopColor },
      { key: 'shop_hours_open', value: shopOpen },
      { key: 'shop_hours_close', value: shopClose },
      { key: 'shop_takeaway_enabled', value: shopTakeaway.toString() },
      { key: 'shop_delivery_enabled', value: shopDelivery.toString() },
      { key: 'shop_min_delivery', value: shopMinDelivery },
      { key: 'shop_delivery_cost', value: shopDeliveryCost },
      { key: 'shop_banner', value: shopBanner }
    ];

    try {
      const existingSettings = await settingRepo.findAll();
      const existingMap = {};
      existingSettings.forEach(s => { existingMap[s.key] = s; });

      for (const setting of settings) {
        if (existingMap[setting.key]) {
          await settingRepo.update(setting);
        } else {
          await settingRepo.create(setting);
        }
      }

      this.settings = {};
      settings.forEach(s => { this.settings[s.key] = s.value; });
      state.set('settings', this.settings);

      Toast.success('Éxito', 'Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      Toast.error('Error', `No se pudo guardar: ${error.message}`);
    }
  }

  async resetToDefaults() {
    const defaults = [
      { key: 'businessName', value: 'Mi Negocio' },
      { key: 'currency', value: 'ARS' },
      { key: 'currencySymbol', value: '$' },
      { key: 'taxRate', value: '21' },
      { key: 'ticketFooter', value: 'Gracias por su compra!' },
      { key: 'logo', value: '' },
      { key: 'shop_enabled', value: 'false' },
      { key: 'shop_whatsapp', value: '' },
      { key: 'shop_primary_color', value: '#7C3AED' },
      { key: 'shop_hours_open', value: '09:00' },
      { key: 'shop_hours_close', value: '23:00' },
      { key: 'shop_takeaway_enabled', value: 'true' },
      { key: 'shop_delivery_enabled', value: 'true' },
      { key: 'shop_min_delivery', value: '0' },
      { key: 'shop_delivery_cost', value: '0' },
      { key: 'shop_banner', value: '' }
    ];

    try {
      const existingSettings = await settingRepo.findAll();
      const existingMap = {};
      existingSettings.forEach(s => { existingMap[s.key] = s; });

      for (const setting of defaults) {
        if (existingMap[setting.key]) {
          await settingRepo.update(setting);
        } else {
          await settingRepo.create(setting);
        }
      }

      this.logoDataUrl = '';
      Toast.success('Éxito', 'Configuración restablecida');
      await this.load();
      state.set('settings', this.settings);
    } catch (error) {
      console.error('Error resetting settings:', error);
      Toast.error('Error', `No se pudo restablecer: ${error.message}`);
    }
  }
}

export default new Settings();
