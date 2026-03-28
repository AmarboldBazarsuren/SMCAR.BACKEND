/**
 * SMCar.mn Тогтмол утгууд
 * Файл: backend/src/config/constants.js
 * Үүрэг: Системийн тогтмол утгууд - татвар, хэмжилт гэх мэт
 */

// ============================================================
// ОНЦГОЙ АЛБАН ТАТВАРЫН ХҮСНЭГТ
// Эх сурвалж: 2020.12.06-ны батлагдсан хүснэгт (Image 1)
// Хөдөлгүүрийн цилиндрийн багтаамж vs Үйлдвэрлэсэн оноос хойших хугацаа
// ============================================================
const EXCISE_TAX_TABLE = {
  // Хөдөлгүүрийн хэмжээ (cc) => [0-3 жил, 4-6 жил, 7-9 жил, 10+ жил]
  '0-1500': {
    label: '1500cc ба түүнээс доош',
    maxCC: 1500,
    taxes: [750000, 1600000, 3350000, 10000000],
  },
  '1501-2500': {
    label: '1501-2500cc',
    maxCC: 2500,
    taxes: [2300000, 3200000, 5000000, 11700000],
  },
  '2501-3500': {
    label: '2501-3500cc',
    maxCC: 3500,
    taxes: [3050000, 4000000, 6700000, 13350000],
  },
  '3501-4500': {
    label: '3501-4500cc',
    maxCC: 4500,
    taxes: [6850750, 8000000, 10850000, 17500000],
  },
  '4501+': {
    label: '4501cc ба түүнээс дээш',
    maxCC: Infinity,
    taxes: [14210000, 27200000, 39150000, 65975000],
  },
};

// Хугацааны индекс (0-based)
// 0 = 0-3 жил
// 1 = 4-6 жил
// 2 = 7-9 жил
// 3 = 10+ жил
const AGE_BRACKETS = [
  { label: '0-3 жил', min: 0, max: 3, index: 0 },
  { label: '4-6 жил', min: 4, max: 6, index: 1 },
  { label: '7-9 жил', min: 7, max: 9, index: 2 },
  { label: '10+ жил', min: 10, max: Infinity, index: 3 },
];

// ============================================================
// ГААЛИЙН ТАТВАРЫН ТООЦООЛЛЫН ТОМЬЁО
// Эх: Image 1-ийн тайлбар
// ============================================================
const TAX_FORMULA = {
  // Гаалийн татварын хувь (15.5%)
  CUSTOMS_DUTY_RATE: 0.155,
  // НӨАТ хувь (10%)
  VAT_RATE: 0.10,
};

// ============================================================
// CARAPIS API
// ============================================================
const CARAPIS = {
  BASE_URL: 'https://api.carapis.com',
  ENCAR_VEHICLES_ENDPOINT: '/encar/vehicles',
  ENCAR_VEHICLE_DETAIL_ENDPOINT: '/encar/vehicle',
  ENCAR_BRANDS_ENDPOINT: '/encar/brands',
  ENCAR_MODELS_ENDPOINT: '/encar/models',
  ENCAR_MARKET_STATS_ENDPOINT: '/encar/market-stats',
  // Free plan: 60 req/min, 1000 req/hr, 10000 req/day
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// ============================================================
// ФАЙЛ UPLOAD
// ============================================================
const UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  BANNER_FOLDER: 'uploads/banners',
  VEHICLE_FOLDER: 'uploads/vehicles',
};

module.exports = {
  EXCISE_TAX_TABLE,
  AGE_BRACKETS,
  TAX_FORMULA,
  CARAPIS,
  UPLOAD,
};