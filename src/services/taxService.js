/**
 * SMCar.mn Tax Service
 * Файл: backend/src/services/taxService.js
 *
 * Image 3-ийн дагуу тооцооллын томьёо:
 * ┌─────────────────────────────────────────────────┐
 * │ Үндсэн үнэ (KRW)           = 39,800,000₩       │
 * │ Үндсэн үнэ (MNT)           = 97,846,000₮       │  ← KRW × wonToMNT
 * │ Монгол үйлчилгээний шимтгэл =    800,000₮       │  ← тогтмол
 * │ Тээврийн зардал             =  5,343,000₮       │  ← хэмжээгээр
 * │ Онцгой албан татвар         =  8,000,000₮       │  ← хүснэгтээс
 * │ Гаалийн татвар/НӨАТ         = 17,234,295₮       │  ← томьёогоор
 * └─────────────────────────────────────────────────┘
 *
 * Гаалийн татвар/НӨАТ томьёо:
 * Татварын баазын нийлбэр = үндсэн үнэ MNT + тээвэр + онцгой татвар + үйлчилгээний хөлс
 * Гаалийн татвар = татварын баазын нийлбэр × 15.5%
 * НӨАТ = (татварын баазын нийлбэр + гаалийн татвар) × 10%
 * Гаалийн татвар/НӨАТ нийт = гаалийн татвар + НӨАТ
 *
 * Шалгалт (Image 3):
 * Үндсэн үнэ: 97,846,000
 * + Тээвэр: 5,343,000
 * + Онцгой татвар: 8,000,000 (2021 он = 4-6 жил, 2501-3500cc Бензин)
 * + Үйлчилгээ: 800,000
 * = Нийлбэр: 111,989,000
 * × 15.5% = 17,358,295 (гааль)  ← Image 3: 17,234,295 (ойролцоо)
 * Тиймээс: нийлбэр × 15.5% = гааль, нийлбэр × 10% = НӨАТ, хоёрыг нэмнэ
 */

const TaxConfig = require('../models/TaxConfig');
const PricingConfig = require('../models/PricingConfig');

/**
 * Машины насыг жилээр тооцоолох
 */
const getCarAge = (year) => {
  const currentYear = new Date().getFullYear();
  return currentYear - year;
};

/**
 * Онцгой албан татвар олох (Image 2 хүснэгт)
 * Хэрэглэгчийн явуулсан Image 2-ын хүснэгтийн дагуу:
 *  - Бензин/Дизель болон Хосолмол/Цахилгаан гэж хуваана
 *  - Хосолмол/Цахилгаан нь Бензин/Дизелийн хагас
 */
const getExciseTax = (engineCC, carAge, fuelType, taxEntries) => {
  // Engine range олох
  const entry = taxEntries.find(
    (e) => engineCC >= e.engineMin && engineCC <= e.engineMax
  );

  if (!entry) {
    console.warn(`⚠️  TaxService: ${engineCC}cc-д тохирох татварын мэдээлэл олдсонгүй`);
    return 0;
  }

  // Машины насны ангилалаар татвар олох
  let baseTax;
  if (carAge <= 3) {
    baseTax = entry.tax0to3;
  } else if (carAge <= 6) {
    baseTax = entry.tax4to6;
  } else if (carAge <= 9) {
    baseTax = entry.tax7to9;
  } else {
    baseTax = entry.tax10plus;
  }

  // Хосолмол / Цахилгаан / Шингэрүүлсэн хий → хагасыг нь авна (Image 2)
  const isHybridOrElectric = ['Electric', 'Hybrid', 'LPG', 'EV'].some(
    (t) => (fuelType || '').toLowerCase().includes(t.toLowerCase())
  ) || ['전기', '하이브리드', '하이'].some((t) => (fuelType || '').includes(t));

  const tax = isHybridOrElectric ? Math.round(baseTax / 2) : baseTax;

  console.log(
    `📊 Онцгой татвар: ${engineCC}cc, ${carAge} жил, ${fuelType} → ₮${tax.toLocaleString()} ${isHybridOrElectric ? '(хосолмол/цахилгаан ×0.5)' : ''}`
  );
  return tax;
};

/**
 * Тээврийн зардал олох
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
 * Нийт үнэ тооцоолох
 *
 * @param {Object} params
 * @param {number} params.priceKRW - Солонгос дахь үнэ (жинхэнэ KRW, 만원 биш)
 * @param {number} params.year     - Машины үйлдвэрлэсэн он
 * @param {number} params.engineCC - Хөдөлгүүрийн хэмжээ (cc)
 * @param {string} [params.fuelType] - Түлшний төрөл (Gasoline, Diesel, Electric, Hybrid...)
 */
const calculateTotalPrice = async (params) => {
  const { priceKRW, year, engineCC, fuelType = 'Gasoline' } = params;

  console.log('='.repeat(50));
  console.log(`🧮 Татвар тооцоолж байна:`);
  console.log(`   Үнэ: ₩${priceKRW.toLocaleString()}`);
  console.log(`   Он: ${year} | Хөдөлгүүр: ${engineCC}cc | Түлш: ${fuelType}`);

  // Config татах
  const [pricingConfig, taxConfig] = await Promise.all([
    PricingConfig.getActive(),
    TaxConfig.getActive(),
  ]);

  const { wonToMNT, mongolServiceFee, shippingCosts, customsDutyRate, vatRate } = pricingConfig;
  console.log(`   Ханш: 1₩ = ${wonToMNT}₮`);

  // ──────────────────────────────────────────────
  // 1. Үндсэн үнэ KRW → MNT
  // ──────────────────────────────────────────────
  const basePriceMNT = Math.round(priceKRW * wonToMNT);
  console.log(`   1️⃣  Үндсэн үнэ MNT: ₮${basePriceMNT.toLocaleString()}`);

  // ──────────────────────────────────────────────
  // 2. Монгол үйлчилгээний шимтгэл (тогтмол)
  // ──────────────────────────────────────────────
  console.log(`   2️⃣  Үйлчилгээний хөлс: ₮${mongolServiceFee.toLocaleString()}`);

  // ──────────────────────────────────────────────
  // 3. Тээврийн зардал (хэмжээгээр)
  // ──────────────────────────────────────────────
  const shippingCost = getShippingCost(engineCC, shippingCosts);
  console.log(`   3️⃣  Тээврийн зардал: ₮${shippingCost.toLocaleString()}`);

  // ──────────────────────────────────────────────
  // 4. Онцгой албан татвар (хүснэгтээс)
  // ──────────────────────────────────────────────
  const carAge = getCarAge(year);
  console.log(`   🗓️  Машины нас: ${carAge} жил`);
  const exciseTax = getExciseTax(engineCC, carAge, fuelType, taxConfig.entries);
  console.log(`   4️⃣  Онцгой татвар: ₮${exciseTax.toLocaleString()}`);

  // ──────────────────────────────────────────────
  // 5. Гаалийн татвар/НӨАТ (Image 3-ийн дагуу)
  //
  // Гаалийн татварын суурь = үндсэн үнэ MNT + тээвэр + онцгой татвар
  //   (үйлчилгээний хөлс татварын суурьт ОРООГҮЙ)
  // Гаалийн татвар = суурь × 15.5%
  // НӨАТ = онцгой татвар × 10%
  // Нийт = гаалийн татвар + НӨАТ
  //
  // Шалгалт (Image 3):
  // суурь = 97,846,000 + 5,343,000 + 8,000,000 = 111,189,000
  // гааль = 111,189,000 × 15.5% = 17,234,295  ✓
  // НӨАТ  = 8,000,000 × 10% = 800,000
  // нийт  = 17,234,295 + 800,000 = 18,034,295
  // ──────────────────────────────────────────────
  const taxableBase = basePriceMNT + shippingCost + exciseTax;
  const customsDuty = Math.round(taxableBase * (customsDutyRate / 100));
  const vat = Math.round(exciseTax * (vatRate / 100));
  const totalCustomsAndVAT = customsDuty + vat;

  console.log(`   5️⃣  Татварын суурь: ₮${taxableBase.toLocaleString()}`);
  console.log(`       Гаалийн татвар (${customsDutyRate}%): ₮${customsDuty.toLocaleString()}`);
  console.log(`       НӨАТ (${vatRate}%): ₮${vat.toLocaleString()}`);
  console.log(`       Гаалийн татвар/НӨАТ нийт: ₮${totalCustomsAndVAT.toLocaleString()}`);

  // ──────────────────────────────────────────────
  // 6. НИЙТ ДҮН
  // ──────────────────────────────────────────────
  const totalPriceMNT =
    basePriceMNT + mongolServiceFee + shippingCost + exciseTax + totalCustomsAndVAT;

  console.log(`   ✅ НИЙТ ДҮН: ₮${totalPriceMNT.toLocaleString()}`);
  console.log('='.repeat(50));

  return {
    // Оролт
    priceKRW,
    year,
    engineCC,
    fuelType,
    carAge,

    // Тооцоолол
    wonToMNT,
    basePriceMNT,
    mongolServiceFee,
    shippingCost,
    exciseTax,
    customsDutyRate,
    customsDuty,
    vatRate,
    vat,
    totalCustomsAndVAT,

    // Нийт
    totalPriceMNT,

    // Урьдчилгаа 85% / үлдэгдэл 15%
    advancePaymentMNT: Math.round(totalPriceMNT * 0.85),
    remainingPaymentMNT: Math.round(totalPriceMNT * 0.15),
  };
};

module.exports = { calculateTotalPrice, getExciseTax, getShippingCost, getCarAge };