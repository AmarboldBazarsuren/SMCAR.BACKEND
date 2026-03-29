/**
 * SMCar.mn Vehicle Controller (Public)
 * Файл: backend/src/controllers/vehicleController.js
 * Үүрэг: Нийтийн хэрэглэгчдэд зориулсан машин харуулах API
 * encar.mn + encar.com API-г шууд ашиглана (Carapis байхгүй)
 */

const encarService = require('../services/encarService');
const taxService = require('../services/taxService');
const ManualVehicle = require('../models/ManualVehicle');
const Banner = require('../models/Banner');
const PricingConfig = require('../models/PricingConfig');

// ============================================================
// GET /api/vehicles - Машинуудын жагсаалт
// ============================================================
const getEncarVehicles = async (req, res) => {
  try {
    const {
      manufacturer,
      modelGroup,
      model,         // ЗАСВАР: model параметр нэмэгдлээ
      year_min, year_max,
      price_min, price_max,
      fuelType,
      limit = 20,
      offset = 0,
    } = req.query;

    console.log(`🔍 Машин хайлт: manufacturer=${manufacturer}, modelGroup=${modelGroup}, model=${model}, limit=${limit}, offset=${offset}`);

    const data = await encarService.getVehicles({
      manufacturer,
      modelGroup,
      model,         // ЗАСВАР: encarService-д дамжуулж байна
      year_min, year_max,
      price_min, price_max,
      fuelType,
      limit: Number(limit),
      offset: Number(offset),
    });

    // Валютын ханш авах
    const pricingConfig = await PricingConfig.getActive();
    const wonToMNT = pricingConfig.wonToMNT;

    // Үнийг MNT-д хөрвүүлэх
    const vehicles = (data.data?.vehicles || []).map((v) => ({
      ...v,
      priceMNT: v.priceKRW ? Math.round(v.priceKRW * wonToMNT) : null,
      wonToMNT,
    }));

    res.status(200).json({
      success: true,
      source: 'encar',
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
      message: 'Машинуудыг татаж чадсангүй. Дараа дахин оролдоорой.',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// GET /api/vehicles/encar/:id - Машины дэлгэрэнгүй + татвар тооцоолол
// ============================================================
const getEncarVehicleDetail = async (req, res) => {
  const { id } = req.params;

  try {
    console.log(`🔍 Машин дэлгэрэнгүй + татвар: ID ${id}`);

    const data = await encarService.getVehicleById(id);
    const vehicle = data.data;

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });
    }

    // Татвар тооцоолох
    let pricing = null;
    if (vehicle.priceKRW && vehicle.year && vehicle.displacement) {
      try {
        pricing = await taxService.calculateTotalPrice({
          priceKRW: vehicle.priceKRW,
          year: vehicle.year,
          engineCC: vehicle.displacement,
        });
      } catch (taxErr) {
        console.warn(`⚠️  Татвар тооцоолоход алдаа: ${taxErr.message}`);
      }
    }

    res.status(200).json({
      success: true,
      source: 'encar',
      data: vehicle,
      pricing,
    });
  } catch (error) {
    console.error(`❌ GetEncarVehicleDetail алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Машины мэдээлэл татаж чадсангүй',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// GET /api/vehicles/manual - Admin гараар нэмсэн машинууд
// ============================================================
const getManualVehicles = async (req, res) => {
  try {
    const { brand, limit = 20, page = 1 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { isActive: true };
    if (brand) filter.brand = new RegExp(brand, 'i');

    const [vehicles, total] = await Promise.all([
      ManualVehicle.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ManualVehicle.countDocuments(filter),
    ]);

    console.log(`✅ Гараар нэмсэн машин: ${vehicles.length} (Нийт: ${total})`);

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
    console.error(`❌ GetManualVehicles алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Машинуудыг татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/vehicles/manual/:id - Гараар нэмсэн машины дэлгэрэнгүй
// ============================================================
const getManualVehicleDetail = async (req, res) => {
  try {
    const vehicle = await ManualVehicle.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Машин олдсонгүй' });
    }

    // Татвар дахин тооцоолох (хамгийн сүүлийн ханшаар)
    let pricing = null;
    try {
      pricing = await taxService.calculateTotalPrice({
        priceKRW: vehicle.priceKRW,
        year: vehicle.year,
        engineCC: vehicle.engineCC,
      });
    } catch (taxErr) {
      console.warn(`⚠️  Татвар тооцоолоход алдаа: ${taxErr.message}`);
    }

    res.status(200).json({
      success: true,
      source: 'manual',
      data: vehicle,
      pricing,
    });
  } catch (error) {
    console.error(`❌ GetManualVehicleDetail алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Машины мэдээлэл татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/vehicles/brands - Брэндүүдийн жагсаалт
// ============================================================
const getBrands = async (req, res) => {
  try {
    const data = await encarService.getBrands();
    res.status(200).json({ success: true, data: data.data });
  } catch (error) {
    console.error(`❌ GetBrands алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Брэндийн жагсаалт татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/vehicles/brands/:brand/models - Загваруудын жагсаалт
// ============================================================
const getModels = async (req, res) => {
  try {
    const data = await encarService.getModelsByBrand(req.params.brand);
    res.status(200).json({ success: true, data: data.data });
  } catch (error) {
    console.error(`❌ GetModels алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Загварын жагсаалт татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/exchange-rate - Валютын ханш
// ============================================================
const getExchangeRate = async (req, res) => {
  try {
    const data = await encarService.getExchangeRate();
    res.status(200).json({ success: true, data: data.data });
  } catch (error) {
    console.error(`❌ GetExchangeRate алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Ханш татаж чадсангүй' });
  }
};

// ============================================================
// POST /api/vehicles/calculate-price - Үнэ тооцоолох
// ============================================================
const calculatePrice = async (req, res) => {
  const { priceKRW, year, engineCC } = req.body;

  if (!priceKRW || !year || !engineCC) {
    return res.status(400).json({
      success: false,
      message: 'priceKRW, year, engineCC утгуудыг оруулна уу',
    });
  }

  try {
    const result = await taxService.calculateTotalPrice({
      priceKRW: Number(priceKRW),
      year: Number(year),
      engineCC: Number(engineCC),
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`❌ CalculatePrice алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Үнэ тооцоолоход алдаа гарлаа' });
  }
};

// ============================================================
// GET /api/banners - Нүүр хуудасны banner зургууд
// ============================================================
const getActiveBanners = async (req, res) => {
  try {
    const banners = await Banner.getActiveBanners();
    res.status(200).json({ success: true, count: banners.length, data: banners });
  } catch (error) {
    console.error(`❌ GetActiveBanners алдаа: ${error.message}`);
    res.status(500).json({ success: false, message: 'Banner татаж чадсангүй' });
  }
};

// ============================================================
// GET /api/health - Системийн байдал шалгах
// ============================================================
const healthCheck = async (req, res) => {
  console.log('🏥 Health check хийгдлээ');
  const encarStatus = await encarService.testConnection();

  res.status(200).json({
    success: true,
    message: 'SMCar.mn API ажиллаж байна',
    timestamp: new Date().toISOString(),
    encarAPI: encarStatus,
  });
};

module.exports = {
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
};