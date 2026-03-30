/**
 * SMCar.mn Encar Direct Price Service
 * Файл: backend/src/services/encarDirectService.js
 * 
 * Үүрэг: Encar.com-оос шууд машины үнэ татах
 * apicars.info-н price буруу байх тохиолдолд энийг ашиглана
 * 
 * Encar.com public API:
 * https://api.encar.com/search/car/list/premium?count=true&q=(Id:41275232)
 */

const axios = require('axios');

// In-memory cache (5 минут)
const priceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const encarPublicClient = axios.create({
  baseURL: 'https://api.encar.com',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.encar.com/',
    'Accept': 'application/json',
  },
  timeout: 10000,
});

/**
 * Encar.com-оос машины үнэ шууд авах
 * @param {string} carId - Encar car ID (жишээ: '41275232')
 * @returns {number|null} - KRW үнэ эсвэл null
 */
const getEncarPrice = async (carId) => {
  if (!carId) return null;

  // Cache шалгах
  const cached = priceCache.get(carId);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    console.log(`📦 Encar price cache HIT: ${carId} → ₩${cached.price?.toLocaleString()}`);
    return cached.price;
  }

  try {
    console.log(`🔍 Encar.com-оос үнэ татаж байна: ID ${carId}`);
    
    const res = await encarPublicClient.get('/search/car/list/premium', {
      params: {
        count: true,
        q: `(Id:${carId})`,
        sr: '|ModifiedDate|0|1',
      }
    });

    const cars = res.data?.SearchResults;
    if (!cars || cars.length === 0) {
      console.warn(`⚠️  Encar: Машин олдсонгүй ID=${carId}`);
      priceCache.set(carId, { price: null, time: Date.now() });
      return null;
    }

    const car = cars[0];
    // Encar.com-н Price нь 만원 нэгжтэй (× 10,000 = KRW)
    const priceManwon = car.Price || car.price;
    if (!priceManwon) {
      console.warn(`⚠️  Encar: Үнэ олдсонгүй ID=${carId}`);
      return null;
    }

    const priceKRW = Math.round(Number(priceManwon) * 10000);
    console.log(`✅ Encar.com үнэ: ID=${carId}, ${priceManwon}만원 = ₩${priceKRW.toLocaleString()}`);

    priceCache.set(carId, { price: priceKRW, time: Date.now() });
    return priceKRW;

  } catch (err) {
    console.warn(`⚠️  Encar.com үнэ татаж чадсангүй: ${err.message}`);
    priceCache.set(carId, { price: null, time: Date.now() });
    return null;
  }
};

/**
 * apicars.info-н price-г validate хийж, Encar.com-тай харьцуулах
 * Хэрэв зөрүү их бол Encar.com-н үнийг ашиглана
 * 
 * @param {string} carId 
 * @param {number} apicarsPrice - apicars.info-аас ирсэн үнэ (KRW болгосны дараа)
 * @returns {number} - Зөв KRW үнэ
 */
const validateAndCorrectPrice = async (carId, apicarsPrice) => {
  try {
    const encarPrice = await getEncarPrice(carId);
    
    if (!encarPrice) {
      // Encar-аас татаж чадаагүй → apicars.info-н үнийг ашиглана
      console.log(`ℹ️  Encar үнэ байхгүй, apicars үнэ ашиглана: ₩${apicarsPrice?.toLocaleString()}`);
      return apicarsPrice;
    }

    if (!apicarsPrice) return encarPrice;

    const diff = Math.abs(encarPrice - apicarsPrice);
    const diffPercent = (diff / encarPrice) * 100;
    
    console.log(`📊 Үнэ харьцуулалт ID=${carId}:`);
    console.log(`   apicars: ₩${apicarsPrice.toLocaleString()}`);
    console.log(`   Encar.com: ₩${encarPrice.toLocaleString()}`);
    console.log(`   Зөрүү: ${diffPercent.toFixed(1)}%`);

    // 2%-аас их зөрүүтэй бол Encar.com-н үнийг ашиглана
    if (diffPercent > 2) {
      console.log(`   ⚠️  Зөрүү их (${diffPercent.toFixed(1)}%) → Encar.com үнэ ашиглана`);
      return encarPrice;
    }

    return encarPrice; // Ямар ч тохиолдолд Encar.com-н үнэ илүү найдвартай
    
  } catch (err) {
    console.warn(`⚠️  validateAndCorrectPrice алдаа: ${err.message}`);
    return apicarsPrice;
  }
};

module.exports = {
  getEncarPrice,
  validateAndCorrectPrice,
};