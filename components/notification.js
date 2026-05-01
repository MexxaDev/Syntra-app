'use strict';

import { notificationRepo } from '../db/repositories.js';
import state from '../js/state.js';

class Notification {
  static container = null;

  static init() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'notification-container';
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
    `;
    document.body.appendChild(this.container);
  }

  static async create({ title, message, type = 'info', userId = null }) {
    const notification = {
      id: `notif_${Date.now()}`,
      title,
      message,
      type,
      userId,
      read: false,
      date: new Date().toISOString()
    };

    try {
      await notificationRepo.create(notification);
      this.showToast(notification);
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  static showToast(notification) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 300px;
      max-width: 400px;
      border-left: 4px solid ${this.getTypeColor(notification.type)};
      animation: slideIn 0.3s ease;
    `;

    toast.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div>
          <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${notification.title}</div>
          <div style="font-size:13px;color:#666;">${notification.message}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:#999;font-size:18px;">×</button>
      </div>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  static getTypeColor(type) {
    const colors = {
      'info': '#3b82f6',
      'success': '#10b981',
      'warning': '#f59e0b',
      'error': '#ef4444'
    };
    return colors[type] || colors.info;
  }

  static async getAll(limit = 50) {
    const notifications = await notificationRepo.findAll();
    return notifications
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  static async markAsRead(id) {
    const notification = await notificationRepo.findById(id);
    if (notification) {
      notification.read = true;
      await notificationRepo.update(notification);
    }
  }

  static async getUnreadCount() {
    const notifications = await notificationRepo.findAll();
    return notifications.filter(n => !n.read).length;
  }
}

export default Notification;
