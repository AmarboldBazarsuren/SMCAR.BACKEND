/**
 * SMCar.mn Public Routes
 * Файл: backend/src/routes/publicRoutes.js
 * Үүрэг: Нэвтрэлт шаардахгүй нийтийн API endpoint-ууд
 */

const express = require('express');
const router = express.Router();
const {
  getEncarVehicles,
  getEncarVehicleDetail,
  getManualVehicles,
  getManualVehicleDetail,
  getBrands,
  getModels,
  getExchangeRate,
  calculatePrice,
  getActiveBanners,
  healthCheck,
} = require('../controllers/vehicleController');

// Системийн байдал шалгах
router.get('/health', healthCheck);

// Banner зургууд
router.get('/banners', getActiveBanners);

// Валютын ханш (encar.mn-оос шууд)
router.get('/exchange-rate', getExchangeRate);

// Encar машинуудын жагсаалт
// GET /api/vehicles?manufacturer=Hyundai&modelGroup=Tucson&year_min=2020&limit=20&offset=0
router.get('/vehicles', getEncarVehicles);

// Encar машины дэлгэрэнгүй + бүх зураг + татвар тооцоолол
router.get('/vehicles/encar/:id', getEncarVehicleDetail);

// Admin гараар нэмсэн машинууд
router.get('/vehicles/manual', getManualVehicles);

// Гараар нэмсэн машины дэлгэрэнгүй
router.get('/vehicles/manual/:id', getManualVehicleDetail);

// Брэндүүд
router.get('/vehicles/brands', getBrands);

// Тодорхой брэндийн загварууд (encar.mn/api/model-groups-аас)
router.get('/vehicles/brands/:brand/models', getModels);

// Үнэ тооцоолох (нийтийн)
// POST body: { priceKRW, year, engineCC }
router.post('/vehicles/calculate-price', calculatePrice);

module.exports = router;