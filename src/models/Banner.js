/**
 * SMCar.mn Banner Model
 * Файл: backend/src/models/Banner.js
 * Үүрэг: Нүүр хуудасны banner зургуудын MongoDB schema
 * Admin panel-аас banner зураг upload хийхэд хэрэглэнэ
 */

const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Banner-ийн нэр заавал шаардлагатай'],
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, 'Зургийн URL заавал шаардлагатай'],
    },
    imagePath: {
      type: String, // Файлын физик байршил
    },
    linkUrl: {
      type: String,
      default: null, // Banner дарахад явах холбоос (optional)
    },
    description: {
      type: String,
      default: '',
    },
    order: {
      type: Number,
      default: 0, // Дэлгэцэнд харуулах дараалал
    },
    isActive: {
      type: Boolean,
      default: true, // false бол нүүр хуудаст харагдахгүй
    },
  },
  {
    timestamps: true,
  }
);

// Active banner-уудыг дарааллаар нь авах
bannerSchema.statics.getActiveBanners = function () {
  return this.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
};

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;