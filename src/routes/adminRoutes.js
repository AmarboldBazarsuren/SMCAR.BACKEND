/**
 * SMCar.mn Admin Routes — Cache endpoint нэмэгдсэн
 * Файл: backend/src/routes/adminRoutes.js
 *
 * Нэмэгдсэн:
 * POST /api/admin/cache/refresh — Cache хүчээр шинэчлэх
 * GET  /api/admin/cache/stats   — Cache статистик харах
 */

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { uploadBanner, uploadVehicleImages } = require('../middleware/uploadMiddleware');
const { forceRefresh, stopCacheScheduler, startCacheScheduler } = require('../services/cacheService');
const VehicleCache = require('../models/VehicleCache');

// Controllers
const { login, getMe, changePassword } = require('../controllers/adminAuthController');
const { getPricingConfig, updatePricingConfig, getTaxConfig, updateTaxConfig, calculatePrice } = require('../controllers/adminPricingController');
const { getAllBanners, createBanner, updateBanner, deleteBanner } = require('../controllers/adminBannerController');
const { getAllManualVehicles, getManualVehicleById, createManualVehicle, updateManualVehicle, deleteManualVehicle, deleteVehicleImage } = require('../controllers/adminVehicleController');

// ============================================================
// AUTH ROUTES
// ============================================================
router.post('/auth/login', login);
router.get('/auth/me', protect, getMe);
router.put('/auth/change-password', protect, changePassword);

// ============================================================
// PRICING ROUTES
// ============================================================
router.get('/pricing', protect, getPricingConfig);
router.put('/pricing', protect, updatePricingConfig);
router.get('/pricing/tax', protect, getTaxConfig);
router.put('/pricing/tax', protect, updateTaxConfig);
router.post('/pricing/calculate', protect, calculatePrice);

// ============================================================
// BANNER ROUTES
// ============================================================
router.get('/banners', protect, getAllBanners);
router.post('/banners', protect, uploadBanner, createBanner);
router.put('/banners/:id', protect, uploadBanner, updateBanner);
router.delete('/banners/:id', protect, deleteBanner);

// ============================================================
// VEHICLE ROUTES
// ============================================================
router.get('/vehicles', protect, getAllManualVehicles);
router.get('/vehicles/:id', protect, getManualVehicleById);
router.post('/vehicles', protect, uploadVehicleImages, createManualVehicle);
router.put('/vehicles/:id', protect, uploadVehicleImages, updateManualVehicle);
router.delete('/vehicles/:id', protect, deleteManualVehicle);
router.delete('/vehicles/:id/images/:imageId', protect, deleteVehicleImage);

// ============================================================
// ⭐ CACHE ROUTES — Admin-аас cache удирдах
// ============================================================

// Cache статистик харах
router.get('/cache/stats', protect, async (req, res) => {
  try {
    const stats = await VehicleCache.getStats();
    const topHits = await VehicleCache.find({})
      .sort({ hitCount: -1 })
      .limit(10)
      .select('cacheKey hitCount expiresAt cacheType lastAccessedAt');

    res.status(200).json({
      success: true,
      stats,
      topHits,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Cache статистик татаж чадсангүй' });
  }
});

// Cache хүчээр шинэчлэх (дуудахад 2-3 минут болно)
router.post('/cache/refresh', protect, async (req, res) => {
  try {
    console.log(`🔥 Admin хүчээр cache шинэчлэж байна: ${req.admin.email}`);

    // Background-д ажиллуулна (хариуг хүлээхгүй)
    forceRefresh().catch(err => {
      console.error('Cache refresh алдаа:', err.message);
    });

    res.status(200).json({
      success: true,
      message: 'Cache шинэчлэлт эхэллээ. 2-3 минутын дараа дуусна.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Cache шинэчлэхэд алдаа гарлаа' });
  }
});

// Cache бүгдийг устгах
router.delete('/cache/clear', protect, async (req, res) => {
  try {
    const count = await VehicleCache.clearAll();
    console.log(`🗑️  Admin cache устгалаа: ${req.admin.email} (${count} entry)`);
    res.status(200).json({
      success: true,
      message: `${count} cache entry устгалаа`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Cache устгахад алдаа гарлаа' });
  }
});

module.exports = router;