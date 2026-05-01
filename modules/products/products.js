'use strict';

import { productRepo, categoryRepo, saleItemRepo } from '../../db/repositories.js';
import Modal from '../../components/modal.js';
import Toast from '../../components/toast.js';
import { validateProduct } from '../../utils/validators.js';
import Table from '../../components/table.js';

class Products {
  constructor() {
    this.products = [];
    this.categories = [];
    this.table = null;
  }

  async load() {
    const container = document.getElementById('product-list');
    if (container) {
      container.innerHTML = '<div style="text-align:center;padding:var(--space-8);color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:var(--space-3);display:block;"></i>Cargando productos...</div>';
    }
    this.products = await productRepo.findAll();
    this.categories = await categoryRepo.findAll();
    this.render();
  }

  search(query) {
    if (!query) {
      this.render();
      return;
    }
    const filtered = this.products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.barcode && p.barcode.includes(query))
    );
    const prevData = this.products;
    this.products = filtered;
    this.render();
    this.products = prevData;
  }

  render() {
    const container = document.getElementById('product-list');
    if (!container) return;

    if (this.products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fa-solid fa-box-open"></i></div>
          <h3 class="empty-state__title">No hay productos</h3>
          <p class="empty-state__description">Comenzá agregando tu primer producto.</p>
          <button class="btn btn-primary" id="add-first-product">+ Nuevo Producto</button>
        </div>
      `;
      document.getElementById('add-first-product')?.addEventListener('click', () => this.openModal());
      return;
    }

    const columns = [
      { key: 'name', label: 'Nombre' },
      { key: 'price', label: 'Precio', format: (val) => `$${val}` },
      { key: 'stock', label: 'Stock' },
      { key: 'categoryId', label: 'Categoría', format: (val) => {
        const cat = this.categories.find(c => c.id === val);
        return cat ? cat.name : 'Sin categoría';
      }},
      { key: 'barcode', label: 'Código' }
    ];

    const actions = [
      { name: 'edit', label: 'Editar', class: 'btn-ghost', icon: 'fa-solid fa-pen' },
      { name: 'delete', label: 'Eliminar', class: 'btn-danger', icon: 'fa-solid fa-trash' }
    ];

    this.table = new Table({
      columns,
      data: this.products,
      actions,
      onRowClick: (product) => this.openModal(product)
    });

    container.innerHTML = '';
    this.table.mount(container);

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.rowIndex);
        this.openModal(this.products[index]);
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.rowIndex);
        const product = this.products[index];

        let hasSales = false;
        try {
          const saleItems = await saleItemRepo.query('productId', product.id);
          hasSales = saleItems && saleItems.length > 0;
        } catch (error) {
          console.error('Error checking sales history:', error);
        }

        const body = hasSales
          ? `<p>El producto "${product.name}" tiene ventas históricas.</p><p style="color:var(--color-warning);font-size:var(--text-sm);margin-top:var(--space-2);"><i class="fa-solid fa-triangle-exclamation"></i> ¿Querés marcarlo como inactivo en lugar de eliminarlo?</p>`
          : `<p>¿Estás seguro de eliminar el producto "${product.name}"?</p>`;

        const footer = `
          <button class="btn btn-secondary" id="cancel-delete">Cancelar</button>
          ${hasSales
            ? '<button class="btn btn-warning" id="confirm-soft-delete">Marcar Inactivo</button>'
            : '<button class="btn btn-danger" id="confirm-delete">Eliminar</button>'
          }
        `;

        Modal.show({ title: 'Confirmar Eliminación', body, footer });

        requestAnimationFrame(() => {
          document.getElementById('cancel-delete')?.addEventListener('click', () => Modal.close());

          if (hasSales) {
            document.getElementById('confirm-soft-delete')?.addEventListener('click', async () => {
              try {
                await productRepo.update({ ...product, visible: false, inactive: true });
                Toast.success('Éxito', 'Producto marcado como inactivo');
                Modal.close();
                this.load();
              } catch (error) {
                Toast.error('Error', 'No se pudo actualizar el producto');
              }
            });
          } else {
            document.getElementById('confirm-delete')?.addEventListener('click', async () => {
              try {
                await productRepo.delete(product.id);
                Toast.success('Éxito', 'Producto eliminado');
                Modal.close();
                this.load();
              } catch (error) {
                Toast.error('Error', 'No se pudo eliminar el producto');
              }
            });
          }
        });
      });
    });
  }

  resizeImage(file, maxWidth, maxHeight) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  openModal(product = null) {
    const isEdit = !!product;
    const title = isEdit ? 'Editar Producto' : 'Nuevo Producto';

    const categoryOptions = this.categories.map(cat =>
      `<option value="${cat.id}" ${product && product.categoryId === cat.id ? 'selected' : ''}>${cat.name}</option>`
    ).join('');

    const body = `
      <div class="form-group">
        <label class="form-label">Nombre</label>
        <input type="text" class="form-input" id="prod-name" value="${product ? product.name : ''}" required>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group">
          <label class="form-label">Precio</label>
          <input type="number" class="form-input" id="prod-price" value="${product ? product.price : ''}" min="0" step="0.01" required>
        </div>
        <div class="form-group">
          <label class="form-label">Stock</label>
          <input type="number" class="form-input" id="prod-stock" value="${product ? product.stock : ''}" min="0" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Categoría</label>
        <select class="form-input form-select" id="prod-category">
          <option value="">Sin categoría</option>
          ${categoryOptions}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group">
          <label class="form-label">Código de barras</label>
          <input type="text" class="form-input" id="prod-barcode" value="${product ? product.barcode : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">SKU</label>
          <input type="text" class="form-input" id="prod-sku" value="${product ? product.sku : ''}">
        </div>
      </div>
        <div class="form-group">
          <label class="form-label">Visible</label>
          <input type="checkbox" id="prod-visible" ${product ? (product.visible ? 'checked' : '') : 'checked'}>
        </div>
        <div class="form-group">
          <label class="form-label">Visible en Web (Shop)</label>
          <input type="checkbox" id="prod-visible-web" ${product ? (product.visible_web ? 'checked' : '') : ''}>
        </div>
        <div class="form-group">
          <label class="form-label">Precio Web (opcional)</label>
          <input type="number" class="form-input" id="prod-price-web" value="${product ? (product.price_web || '') : ''}" min="0" step="0.01" placeholder="Dejar vacío para usar precio normal">
        </div>
        <div class="form-group">
          <label class="form-label">Descripción Corta</label>
          <textarea class="form-input" id="prod-description" rows="2" placeholder="Descripción para el catálogo online">${product ? (product.description || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Imagen</label>
        <input type="file" class="form-input" id="prod-image" accept="image/*" style="padding:var(--space-2);">
        ${product && product.image ? `<div style="margin-top:var(--space-2);"><img src="${product.image}" style="width:80px;height:80px;object-fit:cover;border-radius:var(--radius-md);"></div>` : ''}
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" id="prod-cancel">Cancelar</button>
      <button class="btn btn-primary" id="prod-save">Guardar</button>
    `;

    Modal.show({ title, body, footer });

    document.getElementById('prod-cancel').addEventListener('click', () => Modal.close());

    document.getElementById('prod-save').addEventListener('click', async () => {
      const name = document.getElementById('prod-name').value;
      const price = parseFloat(document.getElementById('prod-price').value);
      const stock = parseInt(document.getElementById('prod-stock').value);
      const categoryId = document.getElementById('prod-category').value || null;
      const barcode = document.getElementById('prod-barcode').value;
      const sku = document.getElementById('prod-sku').value;
      const visible = document.getElementById('prod-visible').checked;
      const visibleWeb = document.getElementById('prod-visible-web').checked;
      const priceWeb = document.getElementById('prod-price-web').value;
      const description = document.getElementById('prod-description').value;
      const imageInput = document.getElementById('prod-image');

      const errors = validateProduct({ name, price, stock });
      if (errors.length) {
        Toast.error('Error', errors[0]);
        return;
      }

      let imageData = product ? product.image : '';
      if (imageInput.files && imageInput.files[0]) {
        imageData = await this.resizeImage(imageInput.files[0], 200, 200);
      }

      const productData = {
        name, price, stock, categoryId, barcode, sku, visible,
        visible_web: visibleWeb,
        price_web: priceWeb ? parseFloat(priceWeb) : null,
        description: description || '',
        image: imageData
      };

      try {
        if (isEdit) {
          await productRepo.update({ ...product, ...productData });
          Toast.success('Éxito', 'Producto actualizado');
        } else {
          await productRepo.create({ ...productData, id: `prod_${Date.now()}` });
          Toast.success('Éxito', 'Producto creado');
        }
        Modal.close();
        this.load();
      } catch (error) {
        Toast.error('Error', 'No se pudo guardar el producto');
      }
    });
  }
}

export default new Products();
