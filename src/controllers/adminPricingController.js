/**
 * SMCar.mn Admin Pricing Controller
 * Файл: backend/src/controllers/adminPricingController.js
 * Үүрэг: Валютын ханш, тээврийн зардал, татварын хувь тохиргоо
 * Admin panel-аас 1₩ = хэдэн ₮ гэж оруулдаг хэсэг
 * Routes: /api/admin/pricing
 */

const PricingConfig = require('../models/PricingConfig');
const TaxConfig = require('../models/TaxConfig');

// ============================================================
// GET /api/admin/pricing - Одоогийн тохиргоо авах
// ============================================================
const getPricingConfig = async (req, res) => {
  try {
    console.log('📋 PricingConfig татаж байна...');
    const config = await PricingConfig.getActive();

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error(`❌ GetPricingConfig алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Тохиргоо татаж чадсангүй',
    });
  }
};

// ============================================================
// PUT /api/admin/pricing - Тохиргоо шинэчлэх
// Admin panel дээр Won → MNT ханш, тээврийн зардал гэх мэтийг өөрчлөх
// ============================================================
const updatePricingConfig = async (req, res) => {
  const {
    wonToMNT,
    mongolServiceFee,
    shippingCosts,
    customsDutyRate,
    vatRate,
  } = req.body;

  console.log('⚙️  PricingConfig шинэчлэж байна...');
  console.log('   Шинэ утгууд:', req.body);

  // Validation
  if (wonToMNT !== undefined && (isNaN(wonToMNT) || wonToMNT <= 0)) {
    return res.status(400).json({
      success: false,
      message: '1 Won-ийн MNT ханш буруу байна. 0-ээс их тоо оруулна уу',
    });
  }

  try {
    const config = await PricingConfig.getActive();

    // Зөвхөн өгсөн утгуудыг шинэчлэх
    if (wonToMNT !== undefined) config.wonToMNT = wonToMNT;
    if (mongolServiceFee !== undefined) config.mongolServiceFee = mongolServiceFee;
    if (customsDutyRate !== undefined) config.customsDutyRate = customsDutyRate;
    if (vatRate !== undefined) config.vatRate = vatRate;

    // Тээврийн зардалын дэлгэрэнгүй шинэчлэх
    if (shippingCosts) {
      if (shippingCosts.small !== undefined) config.shippingCosts.small = shippingCosts.small;
      if (shippingCosts.medium !== undefined) config.shippingCosts.medium = shippingCosts.medium;
      if (shippingCosts.large !== undefined) config.shippingCosts.large = shippingCosts.large;
      if (shippingCosts.xlarge !== undefined) config.shippingCosts.xlarge = shippingCosts.xlarge;
    }

    config.updatedBy = req.admin.email;
    await config.save();

    console.log(`✅ PricingConfig шинэчлэгдлээ. 1₩ = ${config.wonToMNT}₮`);

    res.status(200).json({
      success: true,
      message: 'Тохиргоо амжилттай хадгалагдлаа',
      data: config,
    });
  } catch (error) {
    console.error(`❌ UpdatePricingConfig алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Тохиргоо хадгалахад алдаа гарлаа',
    });
  }
};

// ============================================================
// GET /api/admin/pricing/tax - Онцгой татварын хүснэгт авах
// ============================================================
const getTaxConfig = async (req, res) => {
  try {
    console.log('📋 TaxConfig татаж байна...');
    const config = await TaxConfig.getActive();

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error(`❌ GetTaxConfig алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Татварын тохиргоо татаж чадсангүй',
    });
  }
};

// ============================================================
// PUT /api/admin/pricing/tax - Онцгой татварын хүснэгт шинэчлэх
// Admin panel дээр engine size × age → татвар утгуудыг өөрчлөх
// ============================================================
const updateTaxConfig = async (req, res) => {
  const { entries } = req.body;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Татварын хүснэгт entries байхгүй байна',
    });
  }

  console.log(`⚙️  TaxConfig шинэчлэж байна... (${entries.length} мөр)`);

  try {
    const config = await TaxConfig.getActive();
    config.entries = entries;
    config.updatedBy = req.admin.email;
    await config.save();

    console.log(`✅ TaxConfig шинэчлэгдлээ`);

    res.status(200).json({
      success: true,
      message: 'Татварын хүснэгт амжилттай хадгалагдлаа',
      data: config,
    });
  } catch (error) {
    console.error(`❌ UpdateTaxConfig алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Татварын тохиргоо хадгалахад алдаа гарлаа',
    });
  }
};

// ============================================================
// POST /api/admin/pricing/calculate - Татвар тооцоолох тест
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
    const { calculateTotalPrice } = require('../services/taxService');
    const result = await calculateTotalPrice({
      priceKRW: Number(priceKRW),
      year: Number(year),
      engineCC: Number(engineCC),
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(`❌ CalculatePrice алдаа: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Үнэ тооцоолоход алдаа гарлаа',
    });
  }
};

module.exports = {
  getPricingConfig,
  updatePricingConfig,
  getTaxConfig,
  updateTaxConfig,
  calculatePrice,
};