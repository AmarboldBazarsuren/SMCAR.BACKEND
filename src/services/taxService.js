/**
 * SMCar.mn Tax Service
 * Файл: backend/src/services/taxService.js
 */

const TaxConfig = require('../models/TaxConfig');
const PricingConfig = require('../models/PricingConfig');

const getCarAge = (year) => {
  const currentYear = new Date().getFullYear();
  return currentYear - year;
};

const getExciseTax = (engineCC, carAge, fuelType, taxEntries) => {
  const entry = taxEntries.find(
    (e) => engineCC >= e.engineMin && engineCC <= e.engineMax
  );

  if (!entry) {
    console.warn(`⚠️  TaxService: ${engineCC}cc-д тохирох татварын мэдээлэл олдсонгүй`);
    return 0;
  }

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

  // Хосолмол / Цахилгаан / Шингэрүүлсэн хий → хагасыг нь авна
  // Монгол нэрс болон English нэрс хоёуланг нь танина
  const hybridOrElectricTerms = [
    // English
    'electric', 'hybrid', 'lpg', 'ev', 'hev', 'phev', 'hydrogen',
    // Монгол
    'цахилгаан', 'хосолмол', 'шингэрүүлсэн хий', 'устөрөгч',
  ];
  const koreanTerms = ['전기', '하이브리드', '하이', '수소'];

  const fuelLower = (fuelType || '').toLowerCase();
  const isHybridOrElectric =
    hybridOrElectricTerms.some((t) => fuelLower.includes(t)) ||
    koreanTerms.some((t) => (fuelType || '').includes(t));

  const tax = isHybridOrElectric ? Math.round(baseTax / 2) : baseTax;

  console.log(
    `📊 Онцгой татвар: ${engineCC}cc, ${carAge} жил, ${fuelType} → ₮${tax.toLocaleString()} ${isHybridOrElectric ? '(хосолмол/цахилгаан ×0.5)' : ''}`
  );
  return tax;
};

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

const calculateTotalPrice = async (params) => {
  const { priceKRW, year, engineCC, fuelType = 'Бензин' } = params;

  console.log('='.repeat(50));
  console.log(`🧮 Татвар тооцоолж байна:`);
  console.log(`   Үнэ: ₩${priceKRW.toLocaleString()}`);
  console.log(`   Он: ${year} | Хөдөлгүүр: ${engineCC}cc | Түлш: ${fuelType}`);

  const [pricingConfig, taxConfig] = await Promise.all([
    PricingConfig.getActive(),
    TaxConfig.getActive(),
  ]);

  const { wonToMNT, mongolServiceFee, shippingCosts, customsDutyRate, vatRate } = pricingConfig;
  console.log(`   Ханш: 1₩ = ${wonToMNT}₮`);

  const basePriceMNT = Math.round(priceKRW * wonToMNT);
  console.log(`   1️⃣  Үндсэн үнэ MNT: ₮${basePriceMNT.toLocaleString()}`);
  console.log(`   2️⃣  Үйлчилгээний хөлс: ₮${mongolServiceFee.toLocaleString()}`);

  const shippingCost = getShippingCost(engineCC, shippingCosts);
  console.log(`   3️⃣  Тээврийн зардал: ₮${shippingCost.toLocaleString()}`);

  const carAge = getCarAge(year);
  console.log(`   🗓️  Машины нас: ${carAge} жил`);
  const exciseTax = getExciseTax(engineCC, carAge, fuelType, taxConfig.entries);
  console.log(`   4️⃣  Онцгой татвар: ₮${exciseTax.toLocaleString()}`);

  const taxableBase = basePriceMNT + shippingCost + exciseTax;
  const customsDuty = Math.round(taxableBase * (customsDutyRate / 100));
  const vat = Math.round(exciseTax * (vatRate / 100));
  const totalCustomsAndVAT = customsDuty + vat;

  console.log(`   5️⃣  Татварын суурь: ₮${taxableBase.toLocaleString()}`);
  console.log(`       Гаалийн татвар (${customsDutyRate}%): ₮${customsDuty.toLocaleString()}`);
  console.log(`       НӨАТ (${vatRate}%): ₮${vat.toLocaleString()}`);
  console.log(`       Гаалийн татвар/НӨАТ нийт: ₮${totalCustomsAndVAT.toLocaleString()}`);

  const totalPriceMNT =
    basePriceMNT + mongolServiceFee + shippingCost + exciseTax + totalCustomsAndVAT;

  console.log(`   ✅ НИЙТ ДҮН: ₮${totalPriceMNT.toLocaleString()}`);
  console.log('='.repeat(50));

  return {
    priceKRW,
    year,
    engineCC,
    fuelType,
    carAge,
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
    totalPriceMNT,
    advancePaymentMNT: Math.round(totalPriceMNT * 0.85),
    remainingPaymentMNT: Math.round(totalPriceMNT * 0.15),
  };
};

module.exports = { calculateTotalPrice, getExciseTax, getShippingCost, getCarAge };