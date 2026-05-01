"use strict";

import { settingRepo } from "../../db/repositories.js";

class ShopWhatsApp {
  async buildMessage(data, items, settings) {
    const businessName = settings.businessName || "Mi Negocio";
    const whatsappNumber = settings.shop_whatsapp || "";

    if (!whatsappNumber) {
      throw new Error("No se configuro el numero de WhatsApp");
    }

    let message = "Hola, quiero realizar un pedido.\n\n";
    message += "Nombre: " + data.firstName + " " + data.lastName + "\n";
    message += "Telefono: " + data.phone + "\n";
    message += "Tipo: " + (data.orderType === "delivery" ? "Delivery" : "Take Away") + "\n";

    if (data.orderType === "delivery") {
      message += "\nDireccion: " + data.address + "\n";
      if (data.neighborhood) {
        message += "Barrio: " + data.neighborhood + "\n";
      }
      if (data.addressRef) {
        message += "Referencia: " + data.addressRef + "\n";
      }
    }

    message += "\nPedido:\n";
    var self = this;
    items.forEach(function(item) {
      var itemTotal = item.price * item.quantity;
      message += "- " + item.name + " x" + item.quantity + " - $" + self.formatPrice(itemTotal) + "\n";
      if (item.note) {
        message += "  (" + item.note + ")\n";
      }
    });

    var subtotal = items.reduce(function(t, i) { return t + (i.price * i.quantity); }, 0);
    message += "\nSubtotal: $" + this.formatPrice(subtotal) + "\n";

    if (data.generalNote) {
      message += "\nNota:\n" + data.generalNote + "\n";
    }

    message += "\nGracias.";

    return {
      "message": message,
      "whatsappNumber": whatsappNumber
    };
  }

  formatPrice(price) {
    return price.toLocaleString("es-AR");
  }

  openWhatsApp(messageText, phoneNumber) {
    var encodedMessage = encodeURIComponent(messageText);
    var cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
    var url = "https://wa.me/" + cleanNumber + "?text=" + encodedMessage;
    window.open(url, "_blank");
  }

  async sendOrder(data, items) {
    try {
      var settings = await this.getSettings();
      var result = await this.buildMessage(data, items, settings);
      this.openWhatsApp(result.message, result.whatsappNumber);
      return true;
    } catch (error) {
      console.error("Error sending WhatsApp:", error);
      throw error;
    }
  }

  async getSettings() {
    var allSettings = await settingRepo.findAll();
    var settingsObj = {};
    allSettings.forEach(function(s) {
      settingsObj[s.key] = s.value;
    });
    return settingsObj;
  }
}

export default new ShopWhatsApp();
