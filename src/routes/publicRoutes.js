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
  calculatePrice,
  getActiveBanners,
  healthCheck,
} = require('../controllers/vehicleController');

// Системийн байдал шалгах
router.get('/health', healthCheck);

// Banner зургууд
router.get('/banners', getActiveBanners);

// Encar машинуудын жагсаалт (Carapis API-аас)
// GET /api/vehicles?brand=Hyundai&model=Tucson&year_min=2020&limit=20
router.get('/vehicles', getEncarVehicles);

// Encar машины дэлгэрэнгүй + татвар тооцоолол
router.get('/vehicles/encar/:id', getEncarVehicleDetail);

// Admin гараар нэмсэн машинууд
router.get('/vehicles/manual', getManualVehicles);

// Гараар нэмсэн машины дэлгэрэнгүй
router.get('/vehicles/manual/:id', getManualVehicleDetail);

// Брэндүүд
router.get('/vehicles/brands', getBrands);

// Тодорхой брэндийн загварууд
router.get('/vehicles/brands/:brand/models', getModels);

// Үнэ тооцоолох (нийтийн)
// POST body: { priceKRW, year, engineCC }
router.post('/vehicles/calculate-price', calculatePrice);

module.exports = router;