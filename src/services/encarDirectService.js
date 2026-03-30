/**
 * SMCar.mn Encar Direct Service
 * Файл: backend/src/services/encarDirectService.js
 *
 * Үүрэг: Encar.com-оос шууд машины үнэ, CC, түлш татах
 * apicars.info-н өгөгдөл буруу байх тохиолдолд энийг ашиглана
 *
 * Encar.com public API:
 * https://api.encar.com/search/car/list/premium?count=true&q=(Id:41275232)
 */

const axios = require('axios');

// In-memory cache (5 минут)
const detailCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const encarPublicClient = axios.create({
  baseURL: 'https://api.encar.com',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.encar.com/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Origin': 'https://www.encar.com',
  },
  timeout: 12000,
});

/**
 * Түлшний төрлийг монголчлах
 */
const FUEL_MAP = {
  '가솔린': 'Бензин',
  'gasoline': 'Бензин',
  'petrol': 'Бензин',
  '디젤': 'Дизель',
  'diesel': 'Дизель',
  '전기': 'Цахилгаан',
  'electric': 'Цахилгаан',
  '하이브리드': 'Хосолмол',
  'hybrid': 'Хосолмол',
  '가스': 'Шингэрүүлсэн хий',
  'lpg': 'Шингэрүүлсэн хий',
  'lpi': 'Шингэрүүлсэн хий',
  '수소': 'Устөрөгч',
  'hydrogen': 'Устөрөгч',
};

const normalizeFuel = (fuel) => {
  if (!fuel) return null;
  const key = fuel.toLowerCase().trim();
  if (FUEL_MAP[key]) return FUEL_MAP[key];
  // Агуулсан байвал хайх
  if (key.includes('diesel') || key.includes('디젤')) return 'Дизель';
  if (key.includes('electric') || key.includes('전기')) return 'Цахилгаан';
  if (key.includes('hybrid') || key.includes('하이브리드')) return 'Хосолмол';
  if (key.includes('lpg') || key.includes('lpi') || key.includes('가스')) return 'Шингэрүүлсэн хий';
  if (key.includes('gasoline') || key.includes('가솔린') || key.includes('petrol')) return 'Бензин';
  return null;
};

/**
 * Encar.com-оос машины бүрэн мэдээлэл авах (үнэ, CC, түлш)
 * @param {string} carId - Encar car ID
 * @returns {{ priceKRW, displacement, fuelType } | null}
 */
const getEncarCarDetail = async (carId) => {
  if (!carId) return null;

  // Cache шалгах
  const cached = detailCache.get(carId);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    console.log(`📦 Encar detail cache HIT: ${carId}`);
    return cached.data;
  }

  try {
    console.log(`🔍 Encar.com-оос машины мэдээлэл татаж байна: ID ${carId}`);

    const res = await encarPublicClient.get('/search/car/list/premium', {
      params: {
        count: true,
        q: `(Id:${carId})`,
        sr: '|ModifiedDate|0|1',
        // Нэмэлт талбаруудыг авах
      }
    });

    const cars = res.data?.SearchResults;
    if (!cars || cars.length === 0) {
      console.warn(`⚠️  Encar: Машин олдсонгүй ID=${carId}`);
      detailCache.set(carId, { data: null, time: Date.now() });
      return null;
    }

    const car = cars[0];
    console.log(`🔬 Encar raw car object keys: ${Object.keys(car).join(', ')}`);
    console.log(`🔬 Encar raw car sample:`, JSON.stringify(car, null, 2).substring(0, 800));

    // Үнэ: Encar.com Price нь 만원 нэгжтэй (× 10,000 = KRW)
    const priceManwon = car.Price || car.price;
    const priceKRW = priceManwon ? Math.round(Number(priceManwon) * 10000) : null;

    // CC: Encar API-д Displacement эсвэл EngineCc байна
    const displacement = Number(
      car.Displacement ||
      car.displacement ||
      car.EngineCc ||
      car.engineCc ||
      car.EngineCapacity ||
      car.engineCapacity ||
      car.CubicCapacity ||
      car.cc ||
      0
    ) || null;

    // Түлш: FuelName эсвэл Fuel
    const fuelRaw = car.FuelName || car.Fuel || car.FuelType || car.fuelType || car.fuel || '';
    const fuelType = normalizeFuel(fuelRaw) || null;

    const result = {
      priceKRW,
      displacement,
      fuelType,
      fuelRaw,
      rawCar: car, // debug үед ашиглах
    };

    console.log(`✅ Encar.com мэдээлэл: ID=${carId}`);
    console.log(`   Үнэ: ${priceManwon}만원 = ₩${priceKRW?.toLocaleString()}`);
    console.log(`   CC: ${displacement}cc (raw: ${car.Displacement || car.EngineCc || 'N/A'})`);
    console.log(`   Түлш: "${fuelRaw}" → "${fuelType}"`);

    detailCache.set(carId, { data: result, time: Date.now() });
    return result;

  } catch (err) {
    console.warn(`⚠️  Encar.com мэдээлэл татаж чадсангүй: ${err.message}`);
    detailCache.set(carId, { data: null, time: Date.now() });
    return null;
  }
};

/**
 * Encar.com-оос зөвхөн үнэ авах (хуучин API-тай нийцтэй байхын тулд)
 * @param {string} carId
 * @returns {number|null}
 */
const getEncarPrice = async (carId) => {
  const detail = await getEncarCarDetail(carId);
  return detail?.priceKRW || null;
};

/**
 * apicars.info-н өгөгдлийг Encar.com-тай харьцуулж засах
 * @param {string} carId
 * @param {number} apicarsPrice
 * @returns {number}
 */
const validateAndCorrectPrice = async (carId, apicarsPrice) => {
  try {
    const encarPrice = await getEncarPrice(carId);

    if (!encarPrice) {
      console.log(`ℹ️  Encar үнэ байхгүй, apicars үнэ ашиглана: ₩${apicarsPrice?.toLocaleString()}`);
      return apicarsPrice;
    }

    if (!apicarsPrice) return encarPrice;

    const diff = Math.abs(encarPrice - apicarsPrice);
    const diffPercent = (diff / encarPrice) * 100;

    if (diffPercent > 2) {
      console.log(`   ⚠️  Үнэ зөрүү (${diffPercent.toFixed(1)}%) → Encar.com үнэ ашиглана`);
      return encarPrice;
    }

    return encarPrice;
  } catch (err) {
    console.warn(`⚠️  validateAndCorrectPrice алдаа: ${err.message}`);
    return apicarsPrice;
  }
};

module.exports = {
  getEncarCarDetail,
  getEncarPrice,
  validateAndCorrectPrice,
};