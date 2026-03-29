/**
 * SMCar.mn Encar Service
 * Файл: backend/src/services/encarService.js
 * Үүрэг: encar.mn болон encar.com API-г шууд ашиглан машины мэдээлэл татах
 */

const axios = require('axios');

const ENCAR_IMAGE_BASE = 'https://ci.encar.com';
const ENCAR_API_BASE = 'http://api.encar.com';
const ENCAR_MN_BASE = 'https://encar.mn';

// ============================================================
// AXIOS INSTANCE - encar.com
// ============================================================
const encarClient = axios.create({
  baseURL: ENCAR_API_BASE,
  headers: {
    Referer: 'http://www.encar.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 15000,
});

// ============================================================
// AXIOS INSTANCE - encar.mn
// ============================================================
const encarMnClient = axios.create({
  baseURL: ENCAR_MN_BASE,
  headers: {
    Referer: 'https://encar.mn',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  timeout: 15000,
});

// ============================================================
// HELPER: Зургийн замыг бүтэн URL болгох
// ============================================================
const buildImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${ENCAR_IMAGE_BASE}${path}`;
};

// ============================================================
// HELPER: encar.com query filter үүсгэх
// Зөв формат: (And.Hidden.N._.SellType.일반._)
// ============================================================
const buildQuery = (filters = {}) => {
  const parts = [];

  parts.push('Hidden.N._');

  if (filters.manufacturer) {
    parts.push(`Manufacturer.${filters.manufacturer}._`);
  }

  const modelGroupValue = filters.modelGroup || filters.model;
  if (modelGroupValue) {
    parts.push(`ModelGroup.${modelGroupValue}._`);
  }

  if (filters.year_min || filters.year_max) {
    const min = filters.year_min ? `${filters.year_min}00` : '';
    const max = filters.year_max ? `${filters.year_max}12` : '';
    if (min && max) parts.push(`Year.range.${min}.${max}._`);
    else if (min) parts.push(`Year.range.${min}.._`);
    else if (max) parts.push(`Year.range..${max}._`);
  }

  if (filters.price_min || filters.price_max) {
    const min = filters.price_min || '';
    const max = filters.price_max || '';
    parts.push(`Price.range.${min}.${max}._`);
  }

  if (filters.fuelType) {
    parts.push(`FuelType.${filters.fuelType}._`);
  }

  parts.push('SellType.일반._');

  // join('.') — condition хооронд '.' нэмнэ
  return `(And.${parts.join('.')})`;
};

// ============================================================
// 1. МАШИНУУДЫН ЖАГСААЛТ
// ============================================================
const getVehicles = async (filters = {}) => {
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  const query = buildQuery(filters);
  const sr = `|ModifiedDate|${offset}|${limit}`;

  console.log(`🔍 Encar жагсаалт хайж байна: limit=${limit}, offset=${offset}`);
  console.log(`   Query (raw): ${query}`);

  // --- Формат 1: encodeURIComponent хийж URL-д шууд залгах ---
  const url = `/search/car/list/general?count=true&q=${encodeURIComponent(query)}&sr=${encodeURIComponent(sr)}`;
  console.log(`   URL: ${ENCAR_API_BASE}${url}`);

  let listRes;
  try {
    listRes = await encarClient.get(url);
  } catch (err) {
    // Алдааны дэлгэрэнгүй мэдээллийг харуулах
    console.error(`❌ encar.com хүсэлт алдаа:`);
    console.error(`   Status: ${err.response?.status}`);
    console.error(`   Response body: ${JSON.stringify(err.response?.data)}`);
    console.error(`   Message: ${err.message}`);

    // --- Формат 2: sr параметргүйгээр оролдох ---
    console.log(`🔄 sr параметргүйгээр дахин оролдож байна...`);
    try {
      const url2 = `/search/car/list/general?count=true&q=${encodeURIComponent(query)}&sr=|ModifiedDate|${offset}|${limit}`;
      console.log(`   URL2: ${ENCAR_API_BASE}${url2}`);
      listRes = await encarClient.get(url2);
      console.log(`✅ Формат 2 амжилттай!`);
    } catch (err2) {
      console.error(`❌ Формат 2 алдаа: ${err2.response?.status} - ${JSON.stringify(err2.response?.data)}`);

      // --- Формат 3: params объектоор явуулах (axios encode хийнэ) ---
      console.log(`🔄 axios params-аар дахин оролдож байна...`);
      try {
        listRes = await encarClient.get('/search/car/list/general', {
          params: {
            count: true,
            q: query,
            sr: `|ModifiedDate|${offset}|${limit}`,
          },
        });
        console.log(`✅ Формат 3 (axios params) амжилттай!`);
      } catch (err3) {
        console.error(`❌ Формат 3 алдаа: ${err3.response?.status} - ${JSON.stringify(err3.response?.data)}`);
        throw new Error(`encar.com API 3 форматаар оролдсон ч амжилтгүй. Status: ${err3.response?.status}`);
      }
    }
  }

  const total = listRes.data.Count || 0;
  const searchResults = listRes.data.SearchResults || [];

  console.log(`✅ encar.com-оос ${searchResults.length} машин олдлоо (Нийт: ${total})`);

  // Параллель байдлаар encar.mn-оос мэдээлэл татах
  const vehicles = await Promise.all(
    searchResults.map(async (item) => {
      try {
        const mnRes = await encarMnClient.get('/api/card', {
          params: { vehicle_id: item.Id },
        });

        const mnData = mnRes.data?.data || {};
        const photos = (item.Photos || []).map((p) => buildImageUrl(p.location));

        return {
          id: item.Id,
          manufacturer: mnData.manufacturer || '',
          model: mnData.model || '',
          grade: mnData.grade || '',
          modelGroup: mnData.modelgroup || '',
          year: mnData.year || null,
          mileage: mnData.mileage || 0,
          fuel: mnData.fuel || '',
          displacement: mnData.displacement || 0,
          priceKRW: mnData.price ? Number(mnData.price) : 0,
          photos: photos,
          firstPhoto: buildImageUrl(mnData.first_photo),
          secondPhoto: buildImageUrl(mnData.second_photo),
          officeCityState: item.OfficeCityState || '',
          source: 'encar',
        };
      } catch (err) {
        console.warn(`⚠️  encar.mn card алдаа (ID: ${item.Id}): ${err.message}`);

        const photos = (item.Photos || []).map((p) => buildImageUrl(p.location));
        return {
          id: item.Id,
          manufacturer: item.Manufacturer || '',
          model: item.Model || '',
          grade: item.Badge || '',
          modelGroup: item.Model || '',
          year: item.FormYear ? Number(item.FormYear) : null,
          mileage: item.Mileage || 0,
          fuel: item.FuelType || '',
          displacement: 0,
          priceKRW: item.Price ? item.Price * 10000 : 0,
          photos: photos,
          firstPhoto: photos[0] || null,
          secondPhoto: photos[1] || null,
          officeCityState: item.OfficeCityState || '',
          source: 'encar',
        };
      }
    })
  );

  return {
    success: true,
    data: { vehicles, total, limit, offset },
  };
};

// ============================================================
// 2. НЭГЖ МАШИНЫ ДЭЛГЭРЭНГҮЙ МЭДЭЭЛЭЛ
// ============================================================
const getVehicleById = async (id) => {
  console.log(`🔍 Машины дэлгэрэнгүй татаж байна: ID ${id}`);

  const [cardRes, imagesRes] = await Promise.allSettled([
    encarMnClient.get('/api/card', { params: { vehicle_id: id } }),
    encarMnClient.get('/api/detailed-images', { params: { vehicleId: id } }),
  ]);

  let cardData = {};
  if (cardRes.status === 'fulfilled' && cardRes.value.data?.data) {
    cardData = cardRes.value.data.data;
    console.log(`✅ encar.mn card мэдээлэл ирлээ: ${cardData.manufacturer} ${cardData.model}`);
  } else {
    console.warn(`⚠️  encar.mn card татаж чадсангүй: ID ${id}`);
  }

  let photos = [];
  if (imagesRes.status === 'fulfilled' && imagesRes.value.data?.data) {
    photos = imagesRes.value.data.data.map((path) => buildImageUrl(path));
    console.log(`✅ ${photos.length} зураг олдлоо`);
  } else {
    console.warn(`⚠️  Зураг татаж чадсангүй: ID ${id}`);
  }

  if (!cardData.vehicle_id && photos.length === 0) {
    throw new Error(`Машин олдсонгүй: ID ${id}`);
  }

  const vehicle = {
    id: cardData.vehicle_id || id,
    manufacturer: cardData.manufacturer || '',
    model: cardData.model || '',
    grade: cardData.grade || '',
    modelGroup: cardData.modelgroup || '',
    year: cardData.year || null,
    mileage: cardData.mileage || 0,
    fuel: cardData.fuel || '',
    displacement: cardData.displacement || 0,
    priceKRW: cardData.price ? Number(cardData.price) : 0,
    photos: photos,
    firstPhoto: buildImageUrl(cardData.first_photo) || photos[0] || null,
    source: 'encar',
  };

  console.log(`✅ Машин бэлэн: ${vehicle.manufacturer} ${vehicle.model} (${photos.length} зураг)`);
  return { success: true, data: vehicle };
};

// ============================================================
// 3. БРЭНДҮҮДИЙН ЖАГСААЛТ
// ============================================================
const getBrands = async () => {
  console.log(`🔍 Брэндүүд татаж байна...`);

  const staticBrands = [
    'Hyundai', 'Kia', 'Genesis', 'Chevrolet', 'Renault Korea',
    'KG Mobility', 'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen',
    'Toyota', 'Honda', 'Lexus', 'Porsche', 'Land Rover',
    'Volvo', 'Jaguar', 'Ford', 'Jeep', 'Mini',
  ];

  console.log(`✅ ${staticBrands.length} брэнд буцаалаа`);
  return { success: true, data: staticBrands };
};

// ============================================================
// 4. БРЭНДИЙН ЗАГВАРУУДЫН ЖАГСААЛТ
// ============================================================
const getModelsByBrand = async (brand) => {
  console.log(`🔍 ${brand} загваруудыг татаж байна...`);

  const res = await encarMnClient.get('/api/model-groups', {
    params: { manufacturer: brand },
  });

  if (!res.data?.success) {
    throw new Error(`${brand} брэндийн загваруудыг татаж чадсангүй`);
  }

  const models = res.data.data || [];
  console.log(`✅ ${brand}: ${models.length} загвар олдлоо`);

  return { success: true, data: models };
};

// ============================================================
// 5. ВАЛЮТЫН ХАНШ
// ============================================================
const getExchangeRate = async () => {
  console.log(`💱 Ханш татаж байна...`);

  const res = await encarMnClient.get('/api/exchange-rate');

  if (!res.data?.success) {
    throw new Error('Ханш татаж чадсангүй');
  }

  const rate = res.data.data?.rate || null;
  console.log(`✅ Ханш: 1₩ = ${rate}₮`);

  return { success: true, data: res.data.data };
};

// ============================================================
// 6. ХОЛБОЛТ ТЕСТ
// ============================================================
const testConnection = async () => {
  console.log('🔌 Encar API холболт тест хийж байна...');
  try {
    const query = '(And.Hidden.N._.SellType.일반._)';
    const url = `/search/car/list/general?count=true&q=${encodeURIComponent(query)}&sr=${encodeURIComponent('|ModifiedDate|0|1')}`;
    await encarClient.get(url);
    console.log('✅ Encar API холболт амжилттай!');
    return { success: true, message: 'API холболт ажиллаж байна' };
  } catch (error) {
    console.error('❌ Encar API холболт амжилтгүй:', error.response?.status, JSON.stringify(error.response?.data));
    return { success: false, message: error.message };
  }
};

module.exports = {
  getVehicles,
  getVehicleById,
  getBrands,
  getModelsByBrand,
  getExchangeRate,
  testConnection,
};