/**
 * SMCar.mn TaxConfig Model
 * Файл: backend/src/models/TaxConfig.js
 * Үүрэг: Онцгой албан татварын хүснэгтийн тохиргоо
 * Image 1-д харуулсан хүснэгтийн утгуудыг admin panel-аас өөрчилж болно
 *
 * Хүснэгт: Хөдөлгүүрийн хэмжээ × Машины нас → Онцгой татвар (₮)
 */

const mongoose = require('mongoose');

// Нэг татварын мөр (engine range × age bracket)
const taxEntrySchema = new mongoose.Schema(
  {
    // Хөдөлгүүрийн хэмжээний дээд хязгаар (cc)
    engineLabel: {
      type: String,
      required: true,
      // Жишээ: '1500cc ба түүнээс доош', '1501-2500cc'
    },
    engineMin: {
      type: Number,
      required: true, // cc - доод хязгаар
    },
    engineMax: {
      type: Number,
      required: true, // cc - дээд хязгаар (Infinity = 999999 гэж хадгалана)
    },
    // Машины насны 4 ангилал дахь татвар (₮)
    // [0-3 жил, 4-6 жил, 7-9 жил, 10+ жил]
    tax0to3: {
      type: Number,
      required: true,
    },
    tax4to6: {
      type: Number,
      required: true,
    },
    tax7to9: {
      type: Number,
      required: true,
    },
    tax10plus: {
      type: Number,
      required: true,
    },
  },
  { _id: true }
);

const taxConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: 'Стандарт татварын хүснэгт',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    entries: [taxEntrySchema],
    updatedBy: {
      type: String,
      default: 'admin',
    },
    note: {
      type: String,
      default: 'Эх сурвалж: 2020.12.06 батлагдсан онцгой албан татварын хүснэгт',
    },
  },
  {
    timestamps: true,
  }
);

// Default татварын хүснэгт (Image 1-ийн утгууд)
const DEFAULT_TAX_ENTRIES = [
  {
    engineLabel: '1500cc ба түүнээс доош',
    engineMin: 0,
    engineMax: 1500,
    tax0to3: 750000,
    tax4to6: 1600000,
    tax7to9: 3350000,
    tax10plus: 10000000,
  },
  {
    engineLabel: '1501-2500cc',
    engineMin: 1501,
    engineMax: 2500,
    tax0to3: 2300000,
    tax4to6: 3200000,
    tax7to9: 5000000,
    tax10plus: 11700000,
  },
  {
    engineLabel: '2501-3500cc',
    engineMin: 2501,
    engineMax: 3500,
    tax0to3: 3050000,
    tax4to6: 4000000,
    tax7to9: 6700000,
    tax10plus: 13350000,
  },
  {
    engineLabel: '3501-4500cc',
    engineMin: 3501,
    engineMax: 4500,
    tax0to3: 6850750,
    tax4to6: 8000000,
    tax7to9: 10850000,
    tax10plus: 17500000,
  },
  {
    engineLabel: '4501cc ба түүнээс дээш',
    engineMin: 4501,
    engineMax: 999999,
    tax0to3: 14210000,
    tax4to6: 27200000,
    tax7to9: 39150000,
    tax10plus: 65975000,
  },
];

// Идэвхтэй татварын тохиргоог авах, байхгүй бол default үүсгэх
taxConfigSchema.statics.getActive = async function () {
  let config = await this.findOne({ isActive: true }).sort({ createdAt: -1 });

  if (!config) {
    console.log('⚙️  TaxConfig олдсонгүй, default хүснэгт үүсгэж байна...');
    config = await this.create({
      isActive: true,
      entries: DEFAULT_TAX_ENTRIES,
    });
    console.log('✅ Default TaxConfig үүслээ (Image 1-ийн утгуудаар)');
  }

  return config;
};

const TaxConfig = mongoose.model('TaxConfig', taxConfigSchema);

module.exports = TaxConfig;