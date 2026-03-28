/**
 * SMCar.mn PricingConfig Model
 * Файл: backend/src/models/PricingConfig.js
 * Үүрэг: Валютын ханш, үйлчилгээний хөлс тохиргоо
 * Admin panel-аас: 1 won = 2.3 эсвэл 2.5 гэх мэтээр гараар оруулна
 */

const mongoose = require('mongoose');

const pricingConfigSchema = new mongoose.Schema(
  {
    // ============================================================
    // ВАЛЮТЫН ХАНШ
    // Admin panel-аас ₩1 = ? ₮ гэж гараар оруулна
    // ============================================================
    wonToMNT: {
      type: Number,
      required: [true, 'Won → Төгрөг ханш заавал шаардлагатай'],
      default: 2.43, // 1 KRW = 2.43 MNT (жишээ)
      comment: '1 KRW = энэ тоо MNT. Admin panel-аас өдөр бүр шинэчилнэ',
    },

    // ============================================================
    // ТОГТМОЛ ЗАРДЛУУД
    // ============================================================
    mongolServiceFee: {
      type: Number,
      default: 800000, // 800,000 ₮ - Монгол үйлчилгээний шимтгэл
      comment: 'Монгол үйлчилгээний шимтгэл (₮)',
    },

    // ============================================================
    // ТЭЭВРИЙН ЗАРДАЛ - Машины хэмжээ/жингээс хамаарна
    // Admin panel-аас ангилал тус бүрд тогтооно
    // ============================================================
    shippingCosts: {
      // Жижиг машин (1500cc доош)
      small: {
        type: Number,
        default: 3500000,
        comment: '1500cc ба доош машины тээврийн зардал (₮)',
      },
      // Дунд машин (1501-2500cc)
      medium: {
        type: Number,
        default: 4500000,
        comment: '1501-2500cc машины тээврийн зардал (₮)',
      },
      // Том машин (2501-3500cc)
      large: {
        type: Number,
        default: 5343000,
        comment: '2501-3500cc машины тээврийн зардал (₮)',
      },
      // Маш том машин (3501cc+)
      xlarge: {
        type: Number,
        default: 6500000,
        comment: '3501cc+ машины тээврийн зардал (₮)',
      },
    },

    // ============================================================
    // ГААЛИЙН ТАТВАРЫН ХУВЬ
    // ============================================================
    customsDutyRate: {
      type: Number,
      default: 15.5, // 15.5%
      comment: 'Гаалийн татварын хувь (%)',
    },
    vatRate: {
      type: Number,
      default: 10, // 10%
      comment: 'НӨАТ хувь (%)',
    },

    // Тохиргоо идэвхтэй эсэх
    isActive: {
      type: Boolean,
      default: true,
    },

    // Сүүлд шинэчилсэн admin
    updatedBy: {
      type: String,
      default: 'admin',
    },
  },
  {
    timestamps: true,
  }
);

// Одоогийн идэвхтэй тохиргоог авах static method
pricingConfigSchema.statics.getActive = async function () {
  let config = await this.findOne({ isActive: true }).sort({ createdAt: -1 });

  if (!config) {
    console.log('⚙️  PricingConfig олдсонгүй, default тохиргоо үүсгэж байна...');
    config = await this.create({ isActive: true });
    console.log('✅ Default PricingConfig үүслээ');
  }

  return config;
};

const PricingConfig = mongoose.model('PricingConfig', pricingConfigSchema);

module.exports = PricingConfig;