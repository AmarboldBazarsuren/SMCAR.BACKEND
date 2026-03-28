/**
 * SMCar.mn Admin Routes
 * Файл: backend/src/routes/adminRoutes.js
 * Үүрэг: Admin panel-д зориулсан бүх API endpoint-ууд
 * Бүгд JWT token шаардана (login-аас бусад)
 */

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { uploadBanner, uploadVehicleImages } = require('../middleware/uploadMiddleware');

// Controllers
const { login, getMe, changePassword } = require('../controllers/adminAuthController');
const { getPricingConfig, updatePricingConfig, getTaxConfig, updateTaxConfig, calculatePrice } = require('../controllers/adminPricingController');
const { getAllBanners, createBanner, updateBanner, deleteBanner } = require('../controllers/adminBannerController');
const { getAllManualVehicles, getManualVehicleById, createManualVehicle, updateManualVehicle, deleteManualVehicle, deleteVehicleImage } = require('../controllers/adminVehicleController');

// ============================================================
// AUTH ROUTES - Нэвтрэх (token шаардахгүй)
// ============================================================
router.post('/auth/login', login);

// Token шаардах route-ууд - protect middleware хэрэглэнэ
router.get('/auth/me', protect, getMe);
router.put('/auth/change-password', protect, changePassword);

// ============================================================
// PRICING ROUTES - Ханш, татвар тохиргоо
// ============================================================
router.get('/pricing', protect, getPricingConfig);
router.put('/pricing', protect, updatePricingConfig);

router.get('/pricing/tax', protect, getTaxConfig);
router.put('/pricing/tax', protect, updateTaxConfig);

// Татвар тооцоолох тест
router.post('/pricing/calculate', protect, calculatePrice);

// ============================================================
// BANNER ROUTES - Нүүр хуудасны banner зураг
// ============================================================
router.get('/banners', protect, getAllBanners);
router.post('/banners', protect, uploadBanner, createBanner);
router.put('/banners/:id', protect, uploadBanner, updateBanner);
router.delete('/banners/:id', protect, deleteBanner);

// ============================================================
// VEHICLE ROUTES - Гараар нэмсэн машинууд
// ============================================================
router.get('/vehicles', protect, getAllManualVehicles);
router.get('/vehicles/:id', protect, getManualVehicleById);
router.post('/vehicles', protect, uploadVehicleImages, createManualVehicle);
router.put('/vehicles/:id', protect, uploadVehicleImages, updateManualVehicle);
router.delete('/vehicles/:id', protect, deleteManualVehicle);
router.delete('/vehicles/:id/images/:imageId', protect, deleteVehicleImage);

module.exports = router;