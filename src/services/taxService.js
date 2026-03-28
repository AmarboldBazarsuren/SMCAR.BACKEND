/**
 * SMCar.mn Tax Service
 * Файл: backend/src/services/taxService.js
 * Үүрэг: Машины татвар, гааль, нийт үнийг тооцоолох
 *
 * Тооцооллын томьёо (Image 1-ийн дагуу):
 * 1. Үндсэн үнэ (KRW) → MNT хөрвүүлэх
 * 2. Онцгой албан татвар = Хүснэгтээс (engine cc × машины нас)
 * 3. Тээврийн зардал = Машины хэмжээгээр
 * 4. Гаалийн татвар = (Үндсэн үнэ MNT + Тээврийн зардал + Онцгой татвар) × 15.5%
 * 5. НӨАТ = Гаалийн татвар + Онцгой татвар × 10%
 * 6. Нийт дүн = Үндсэн үнэ MNT + Тээвэр + Онцгой татвар + Гаалийн татвар/НӨАТ + Үйлчилгээний хөлс
 */

const TaxConfig = require('../models/TaxConfig');
const PricingConfig = require('../models/PricingConfig');

/**
 * Машины насыг жилээр тооцоолох
 * @param {number} year - Машины үйлдвэрлэсэн он
 * @returns {number} - Машины нас (жил)
 */
const getCarAge = (year) => {
  const currentYear = new Date().getFullYear();
  return currentYear - year;
};

/**
 * Онцгой албан татвар олох
 * @param {number} engineCC - Хөдөлгүүрийн cc
 * @param {number} carAge - Машины нас (жил)
 * @param {Array} taxEntries - TaxConfig-ийн entries
 * @returns {number} - Онцгой татвар (MNT ₮)
 */
const getExciseTax = (engineCC, carAge, taxEntries) => {
  // Engine range олох
  const entry = taxEntries.find(
    (e) => engineCC >= e.engineMin && engineCC <= e.engineMax
  );

  if (!entry) {
    console.warn(`⚠️  TaxService: ${engineCC}cc-д тохирох татварын мэдээлэл олдсонгүй`);
    return 0;
  }

  // Машины насны ангилалаар татвар олох
  let tax;
  if (carAge <= 3) {
    tax = entry.tax0to3;
  } else if (carAge <= 6) {
    tax = entry.tax4to6;
  } else if (carAge <= 9) {
    tax = entry.tax7to9;
  } else {
    tax = entry.tax10plus;
  }

  console.log(`📊 Онцгой татвар: ${engineCC}cc, ${carAge} жил → ₮${tax.toLocaleString()}`);
  return tax;
};

/**
 * Тээврийн зардал олох
 * @param {number} engineCC - Хөдөлгүүрийн cc
 * @param {Object} shippingCosts - PricingConfig-ийн shippingCosts
 * @returns {number} - Тээврийн зардал (MNT ₮)
 */
const getShippingCost = (engineCC, shippingCosts) => {
  let cost;
  if (engineCC <= 1500) {
    cost = shippingCosts.small;
  } else if (engineCC <= 2500) {
    cost = shippingCosts.medium;
  } else if (engineCC <= 3500) {
    cost = shippingCosts.large;
  } else {
    cost = shippingCosts.xlarge;
  }
  console.log(`🚢 Тээврийн зардал: ${engineCC}cc → ₮${cost.toLocaleString()}`);
  return cost;
};

/**
 * Машины бүх татвар, нийт үнийг тооцоолох үндсэн функц
 *
 * @param {Object} params
 * @param {number} params.priceKRW - Солонгос дахь үнэ (₩ вон)
 * @param {number} params.year - Машины үйлдвэрлэсэн он
 * @param {number} params.engineCC - Хөдөлгүүрийн хэмжээ (cc)
 * @returns {Object} - Бүрэн тооцооллын үр дүн
 */
const calculateTotalPrice = async (params) => {
  const { priceKRW, year, engineCC } = params;

  console.log('='.repeat(50));
  console.log(`🧮 Татвар тооцоолж байна:`);
  console.log(`   Үнэ: ₩${priceKRW.toLocaleString()}`);
  console.log(`   Он: ${year}`);
  console.log(`   Хөдөлгүүр: ${engineCC}cc`);

  // Config татах
  const [pricingConfig, taxConfig] = await Promise.all([
    PricingConfig.getActive(),
    TaxConfig.getActive(),
  ]);

  const {
    wonToMNT,
    mongolServiceFee,
    shippingCosts,
    customsDutyRate,
    vatRate,
  } = pricingConfig;

  console.log(`   Ханш: 1₩ = ${wonToMNT}₮`);

  // ============================================================
  // ТООЦООЛОЛ
  // ============================================================

  // 1. Үндсэн үнэ KRW → MNT
  const basePriceMNT = Math.round(priceKRW * wonToMNT);
  console.log(`   1️⃣  Үндсэн үнэ MNT: ₮${basePriceMNT.toLocaleString()}`);

  // 2. Машины нас
  const carAge = getCarAge(year);
  console.log(`   🗓️  Машины нас: ${carAge} жил`);

  // 3. Онцгой албан татвар (хүснэгтээс)
  const exciseTax = getExciseTax(engineCC, carAge, taxConfig.entries);
  console.log(`   2️⃣  Онцгой татвар: ₮${exciseTax.toLocaleString()}`);

  // 4. Тээврийн зардал (хэмжээгээр)
  const shippingCost = getShippingCost(engineCC, shippingCosts);
  console.log(`   3️⃣  Тээврийн зардал: ₮${shippingCost.toLocaleString()}`);

  // 5. Гаалийн татвар = (Үндсэн үнэ + Тээвэр + Онцгой татвар) × customsDutyRate
  const taxableAmount = basePriceMNT + shippingCost + exciseTax;
  const customsDuty = Math.round(taxableAmount * (customsDutyRate / 100));
  console.log(`   4️⃣  Гаалийн татвар (${customsDutyRate}%): ₮${customsDuty.toLocaleString()}`);

  // 6. НӨАТ = Онцгой татвар × vatRate
  const exciseTaxVAT = Math.round(exciseTax * (vatRate / 100));
  console.log(`   5️⃣  НӨАТ (${vatRate}%): ₮${exciseTaxVAT.toLocaleString()}`);

  // 7. Гаалийн татвар/НӨАТ нийт
  const totalCustomsAndVAT = customsDuty + exciseTaxVAT;
  console.log(`   📋 Гаалийн татвар/НӨАТ нийт: ₮${totalCustomsAndVAT.toLocaleString()}`);

  // 8. Монгол үйлчилгээний шимтгэл
  console.log(`   6️⃣  Үйлчилгээний хөлс: ₮${mongolServiceFee.toLocaleString()}`);

  // 9. НИЙТ ДҮН
  const totalPriceMNT =
    basePriceMNT +
    shippingCost +
    exciseTax +
    totalCustomsAndVAT +
    mongolServiceFee;

  console.log(`   ✅ НИЙТ ДҮН: ₮${totalPriceMNT.toLocaleString()}`);
  console.log('='.repeat(50));

  return {
    // Оролтын мэдээлэл
    priceKRW,
    year,
    engineCC,
    carAge,

    // Тооцооллын дэлгэрэнгүй
    wonToMNT,
    basePriceMNT,
    mongolServiceFee,
    shippingCost,
    exciseTax,
    customsDutyRate,
    customsDuty,
    vatRate,
    exciseTaxVAT,
    totalCustomsAndVAT,

    // Нийт дүн
    totalPriceMNT,

    // Урьдчилгаа болон үлдэгдэл (жишээ: 85% урьдчилгаа)
    advancePaymentMNT: Math.round(totalPriceMNT * 0.85),
    remainingPaymentMNT: Math.round(totalPriceMNT * 0.15),
  };
};

module.exports = {
  calculateTotalPrice,
  getExciseTax,
  getShippingCost,
  getCarAge,
};