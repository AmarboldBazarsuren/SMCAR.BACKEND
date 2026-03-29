/**
 * SMCar.mn Updated Public Routes
 * Файл: backend/src/routes/publicRoutes.js
 *
 * Нэмэгдсэн: /api/vehicles/brand-stats — нүүр хуудасны брэнд статистик
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
  getBrandStats,
} = require('../controllers/vehicleController');

router.get('/health', healthCheck);
router.get('/banners', getActiveBanners);
router.get('/exchange-rate', getExchangeRate);
router.get('/vehicles', getEncarVehicles);
router.get('/vehicles/encar/:id', getEncarVehicleDetail);
router.get('/vehicles/manual', getManualVehicles);
router.get('/vehicles/manual/:id', getManualVehicleDetail);
router.get('/vehicles/brands', getBrands);
router.get('/vehicles/brands/:brand/models', getModels);
router.post('/vehicles/calculate-price', calculatePrice);

// ⭐ Шинэ: Брэндийн статистик (нүүр хуудасны жагсаалтад)
router.get('/vehicles/brand-stats', getBrandStats);

module.exports = router;