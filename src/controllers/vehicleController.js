/**
 * SMCar.mn Vehicle Controller (Public)
 * Файл: backend/src/controllers/vehicleController.js
 *
 * Засвар:
 * - getEncarVehicleDetail: Encar.com-с шууд үнэ, CC, түлш авна
 *   apicars.info-н буруу өгөгдлийг бүгдийг override хийнэ
 */

const encarService = require('../services/encarService');
const taxService = require('../services/taxService');
const { getEncarCarDetail } = require('../services/encarDirectService');
const ManualVehicle = require('../models/ManualVehicle');
const Banner = require('../models/Banner');
const PricingConfig = require('../models/PricingConfig');
const VehicleCache = require('../models/VehicleCache');

// ============================================================
// GET /api/vehicles
// ============================================================
const getEncarVehicles = async (req, res) => {
  try {
    const {
      manufacturer, modelGroup, model,
      year_min, year_max, price_min, price_max,
      fuelType, limit = 20, offset = 0,
    } = req.query;

    const data = await encarService.getVehicles({
      manufacturer, modelGroup, model,
      year_min, year_max, price_min, price_max,
      fuelType, limit: Number(limit), offset: Number(offset),
    });

    const pricingConfig = await PricingConfig.getActive();
    const wonToMNT = pricingConfig.wonToMNT;

    const vehicles = (data.data?.vehicles || []).map((v) => ({
      ...v,
      priceMNT: v.priceKRW ? Math.round(v.priceKRW * wonToMNT) : null,
      wonToMNT,
    }));

    res.status(200).json({
      success: true,
      source: data.fromCache ? 'cache' : 'apicars',
      fromCache: data.fromCache || false,
      count: vehicles.length,
      total: data.data?.total || 0,
      limit: Number(limit),
      offset: Number(offset),
      wonToMNT,
      data: vehicles,
    });
  } catch (error) {
    console.error(`❌ GetEncarVehicles алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Машинуудыг татаж чадсангүй.',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// GET /api/vehicles/encar/:id
// Encar.com-оос шууд зөв үнэ, CC, түлш авна
// ============================================================
const getEncarVehicleDetail = async (req, res) => {
  const { id } = req.params;
  try {
    // 1. apicars.info-с үндсэн мэдээлэл татах (зураг, загвар, он гэх мэт)
    const data = await encarService.getVehicleById(id);
    const vehicle = data.data;
    if (!vehicle) return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });

    // 2. Encar.com-оос шууд үнэ, CC, түлш татах
    let priceSource = 'apicars';
    let correctedPriceKRW = vehicle.priceKRW;
    let correctedDisplacement = vehicle.displacement;
    let correctedFuelType = vehicle.fuelType;

    try {
      const encarDetail = await getEncarCarDetail(id);

      if (encarDetail) {
        // ── Үнэ засах ──
        if (encarDetail.priceKRW) {
          const diff = vehicle.priceKRW
            ? Math.abs(encarDetail.priceKRW - vehicle.priceKRW) / encarDetail.priceKRW * 100
            : 100;
          if (diff > 1 || !vehicle.priceKRW) {
            console.log(`✅ Үнэ засав: ₩${vehicle.priceKRW?.toLocaleString()} → ₩${encarDetail.priceKRW.toLocaleString()} (${diff.toFixed(1)}% зөрүү)`);
          }
          correctedPriceKRW = encarDetail.priceKRW;
          priceSource = 'encar_direct';
        }

        // ── CC засах ──
        if (encarDetail.displacement && encarDetail.displacement > 0) {
          console.log(`✅ CC засав: ${correctedDisplacement}cc → ${encarDetail.displacement}cc`);
          correctedDisplacement = encarDetail.displacement;
        } else {
          // Encar.com API-с CC ирээгүй бол raw car объектоос өөр талбараас хайх
          const rawCar = encarDetail.rawCar || {};
          const fallbackCC = Number(
            rawCar.spec?.displacement ||
            rawCar.Spec?.Displacement ||
            rawCar.vehicleSpec?.displacement ||
            rawCar.CarSpec?.Displacement ||
            0
          );
          if (fallbackCC > 0) {
            console.log(`✅ CC (fallback) засав: ${correctedDisplacement}cc → ${fallbackCC}cc`);
            correctedDisplacement = fallbackCC;
          } else {
            console.warn(`⚠️  Encar CC ирсэнгүй, apicars CC ашиглана: ${correctedDisplacement}cc`);
          }
        }

        // ── Түлш засах ──
        if (encarDetail.fuelType) {
          console.log(`✅ Түлш засав: "${correctedFuelType}" → "${encarDetail.fuelType}"`);
          correctedFuelType = encarDetail.fuelType;
        }
      }
    } catch (encarErr) {
      console.warn(`⚠️  Encar direct detail алдаа: ${encarErr.message} — apicars өгөгдөл ашиглана`);
    }

    // 3. Засварласан утгуудыг vehicle объектод хадгалах
    vehicle.priceKRW = correctedPriceKRW;
    vehicle.displacement = correctedDisplacement;
    vehicle.fuelType = correctedFuelType;
    vehicle.fuel = correctedFuelType;
    vehicle.priceSource = priceSource;

    console.log(`📋 Эцсийн өгөгдөл: үнэ=₩${correctedPriceKRW?.toLocaleString()}, CC=${correctedDisplacement}cc, түлш=${correctedFuelType}`);

    // 4. Татвар тооцоолох
    let pricing = null;
    if (vehicle.priceKRW && vehicle.year && vehicle.displacement) {
      try {
        pricing = await taxService.calculateTotalPrice({
          priceKRW: vehicle.priceKRW,
          year: vehicle.year,
          engineCC: vehicle.displacement,
          fuelType: vehicle.fuelType || 'Бензин',
        });
      } catch (taxErr) {
        console.warn(`⚠️  Татвар тооцоолоход алдаа: ${taxErr.message}`);
      }
    } else {
      console.warn(`⚠️  Татвар тооцоолох мэдээлэл дутуу: priceKRW=${vehicle.priceKRW}, year=${vehicle.year}, displacement=${vehicle.displacement}`);
    }

    res.status(200).json({
      success: true,
      source: 'apicars',
      priceSource,
      data: vehicle,
      pricing,
    });
  } catch (error) {
    console.error(`❌ GetEncarVehicleDetail алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Машины мэдээлэл татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/vehicles/manual
// ============================================================
const getManualVehicles = async (req, res) => {
  try {
    const { brand, limit = 20, page = 1 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = { isActive: true };
    if (brand) filter.brand = new RegExp(brand, 'i');

    const [vehicles, total] = await Promise.all([
      ManualVehicle.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      ManualVehicle.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      source: 'manual',
      count: vehicles.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: vehicles,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Машинуудыг татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/vehicles/manual/:id
// ============================================================
const getManualVehicleDetail = async (req, res) => {
  try {
    const vehicle = await ManualVehicle.findOne({ _id: req.params.id, isActive: true });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });

    let pricing = null;
    try {
      pricing = await taxService.calculateTotalPrice({
        priceKRW: vehicle.priceKRW,
        year: vehicle.year,
        engineCC: vehicle.engineCC,
        fuelType: vehicle.fuelType || 'Бензин',
      });
    } catch (taxErr) {
      console.warn(`⚠️  Татвар: ${taxErr.message}`);
    }

    res.status(200).json({ success: true, source: 'manual', data: vehicle, pricing });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Машины мэдээлэл татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/vehicles/brands
// ============================================================
const getBrands = async (req, res) => {
  try {
    const data = await encarService.getBrands();
    res.status(200).json({ success: true, data: data.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Брэндийн жагсаалт татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/vehicles/brands/:brand/models
// ============================================================
const getModels = async (req, res) => {
  try {
    const data = await encarService.getModelsByBrand(req.params.brand);
    res.status(200).json({ success: true, data: data.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Загварын жагсаалт татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/vehicles/brand-stats
// ============================================================
const getBrandStats = async (req, res) => {
  try {
    const { getBrandStats: getCachedStats } = require('../services/cacheService');
    const stats = await getCachedStats();

    if (stats) {
      res.status(200).json({ success: true, fromCache: true, data: stats });
    } else {
      res.status(200).json({
        success: true,
        fromCache: false,
        data: null,
        message: 'Cache шинэчлэгдэж байна, хэсэг хүлээгээд дахин оролдоорой',
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Брэндийн статистик татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/exchange-rate
// ============================================================
const getExchangeRate = async (req, res) => {
  try {
    const data = await encarService.getExchangeRate();
    res.status(200).json({ success: true, data: data.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Ханш татаж чадсангүй' });
  }
};

// ============================================================
// POST /api/vehicles/calculate-price
// ============================================================
const calculatePrice = async (req, res) => {
  const { priceKRW, year, engineCC, fuelType } = req.body;
  if (!priceKRW || !year || !engineCC) {
    return res.status(400).json({ success: false, message: 'priceKRW, year, engineCC утгуудыг оруулна уу' });
  }
  try {
    const result = await taxService.calculateTotalPrice({
      priceKRW: Number(priceKRW),
      year: Number(year),
      engineCC: Number(engineCC),
      fuelType: fuelType || 'Бензин',
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Үнэ тооцоолоход алдаа гарлаа' });
  }
};

// ============================================================
// GET /api/banners
// ============================================================
const getActiveBanners = async (req, res) => {
  try {
    const banners = await Banner.getActiveBanners();
    res.status(200).json({ success: true, count: banners.length, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Banner татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/health
// ============================================================
const healthCheck = async (req, res) => {
  const apiStatus = await encarService.testConnection();
  const cacheStats = await VehicleCache.getStats().catch(() => null);

  res.status(200).json({
    success: true,
    message: 'SMCar.mn API ажиллаж байна',
    timestamp: new Date().toISOString(),
    vehicleAPI: apiStatus,
    cache: cacheStats,
  });
};

module.exports = {
  getEncarVehicles,
  getEncarVehicleDetail,
  getManualVehicles,
  getManualVehicleDetail,
  getBrands,
  getModels,
  getBrandStats,
  getExchangeRate,
  calculatePrice,
  getActiveBanners,
  healthCheck,
};