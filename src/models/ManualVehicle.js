/**
 * SMCar.mn ManualVehicle Model
 * Файл: backend/src/models/ManualVehicle.js
 * Үүрэг: Admin panel-аас гараар оруулсан машинуудын MongoDB schema
 * Encar API-аас ирэхгүй, admin өөрөө нэмдэг машинууд
 */

const mongoose = require('mongoose');

const manualVehicleSchema = new mongoose.Schema(
  {
    // ============================================================
    // ҮНДСЭН МЭДЭЭЛЭЛ
    // ============================================================
    title: {
      type: String,
      required: [true, 'Машины нэр заавал шаардлагатай'],
      trim: true,
    },
    brand: {
      type: String,
      required: [true, 'Брэнд нэр заавал шаардлагатай'],
      trim: true,
    },
    model: {
      type: String,
      required: [true, 'Загвар нэр заавал шаардлагатай'],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'Үйлдвэрлэсэн он заавал шаардлагатай'],
    },
    mileage: {
      type: Number,
      default: 0, // км
    },
    engineCC: {
      type: Number,
      required: [true, 'Хөдөлгүүрийн хэмжээ (cc) заавал шаардлагатай'],
    },
    fuelType: {
      type: String,
      enum: ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'LPG', 'Other'],
      default: 'Gasoline',
    },
    transmission: {
      type: String,
      enum: ['Automatic', 'Manual'],
      default: 'Automatic',
    },
    color: {
      type: String,
      default: '',
    },

    // ============================================================
    // ҮНЭ МЭДЭЭЛЭЛ
    // ============================================================
    priceKRW: {
      type: Number,
      required: [true, 'Солонгос вон дахь үнэ заавал шаардлагатай'],
    },
    // Нийт дүн (MNT) - автоматаар тооцоолно
    totalPriceMNT: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // ЗУРАГНУУД
    // ============================================================
    images: [
      {
        url: String,
        path: String,
        alt: { type: String, default: '' },
      },
    ],

    // ============================================================
    // НЭМЭЛТ МЭДЭЭЛЭЛ
    // ============================================================
    description: {
      type: String,
      default: '',
    },
    features: [String], // ['Leather Seats', 'Navigation', ...]
    location: {
      type: String,
      default: 'Seoul',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      default: 'manual', // 'manual' = admin гараар нэмсэн
    },

    // Encar link (optional)
    encarUrl: {
      type: String,
      default: null,
    },
    encarId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const ManualVehicle = mongoose.model('ManualVehicle', manualVehicleSchema);

module.exports = ManualVehicle;