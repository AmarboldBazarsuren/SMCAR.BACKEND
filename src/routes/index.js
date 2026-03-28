/**
 * SMCar.mn Routes Index
 * Файл: backend/src/routes/index.js
 * Үүрэг: Бүх route-уудыг нэгтгэх үндсэн файл
 */

const express = require('express');
const router = express.Router();

const publicRoutes = require('./publicRoutes');
const adminRoutes = require('./adminRoutes');

// Нийтийн route-ууд
router.use('/', publicRoutes);

// Admin route-ууд
router.use('/admin', adminRoutes);

// API мэдээлэл
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚗 SMCar.mn API',
    version: '1.0.0',
    routes: {
      health: 'GET /api/health',
      banners: 'GET /api/banners',
      encarVehicles: 'GET /api/vehicles',
      encarVehicleDetail: 'GET /api/vehicles/encar/:id',
      manualVehicles: 'GET /api/vehicles/manual',
      manualVehicleDetail: 'GET /api/vehicles/manual/:id',
      brands: 'GET /api/vehicles/brands',
      models: 'GET /api/vehicles/brands/:brand/models',
      calculatePrice: 'POST /api/vehicles/calculate-price',
      adminLogin: 'POST /api/admin/auth/login',
    },
  });
});

module.exports = router;