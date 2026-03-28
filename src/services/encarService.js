/**
 * SMCar.mn Encar Service
 * Файл: backend/src/services/encarService.js
 * Үүрэг: Carapis API-р дамжуулж Encar.com-оос машины мэдээлэл татах
 * API Key: car_mq9s9lLWf33UP8qWJKTD0hGciPLHFh9xghBCnRZ_ASo
 */

const axios = require('axios');
const { CARAPIS } = require('../config/constants');

// Axios instance - API хүсэлт бүрт authorization header нэмэх
const apiClient = axios.create({
  baseURL: process.env.CARAPIS_BASE_URL || CARAPIS.BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.CARAPIS_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 секундын timeout
});

// ============================================================
// REQUEST INTERCEPTOR - Хүсэлт явуулахаас өмнө log хийх
// ============================================================
apiClient.interceptors.request.use(
  (config) => {
    console.log(`📡 Encar API хүсэлт: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    if (config.params) {
      console.log(`   Параметрүүд:`, config.params);
    }
    return config;
  },
  (error) => {
    console.error('❌ Encar API хүсэлтийн алдаа:', error.message);
    return Promise.reject(error);
  }
);

// ============================================================
// RESPONSE INTERCEPTOR - Хариу ирэхэд log хийх
// ============================================================
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ Encar API хариу: ${response.status} - ${response.config.url}`);

    // Rate limit мэдээлэл харуулах
    const remaining = response.headers['x-ratelimit-remaining'];
    const limit = response.headers['x-ratelimit-limit'];
    if (remaining !== undefined) {
      console.log(`   Rate Limit: ${remaining}/${limit} хүсэлт үлдсэн`);
      if (Number(remaining) < 10) {
        console.warn(`⚠️  Rate Limit бараг дуусах гэж байна! Үлдсэн: ${remaining}`);
      }
    }

    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      console.error(`❌ Encar API алдаа: ${status}`);
      console.error(`   URL: ${error.config?.url}`);
      console.error(`   Хариу:`, data);

      if (status === 401) {
        console.error('💡 Шийдэл: API key буруу эсвэл хугацаа дууссан байна');
        console.error(`   API Key: ${process.env.CARAPIS_API_KEY?.substring(0, 20)}...`);
      }

      if (status === 429) {
        console.error('💡 Шийдэл: Rate limit хэтэрсэн байна. Хэсэг хүлээгээд дахин оролдоорой');
      }

      if (status === 500) {
        console.error('💡 Carapis серверт алдаа гарсан байна. Дараа дахин оролдоорой');
      }
    } else if (error.request) {
      console.error('❌ Encar API-тэй холбогдоход алдаа: Хариу ирсэнгүй');
      console.error('💡 Шийдэл: Internet холболт болон https://api.carapis.com ажиллаж байгаа эсэхийг шалгаарай');
    } else {
      console.error('❌ Encar API алдаа:', error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================================
// API ФУНКЦУУД
// ============================================================

/**
 * Машинуудын жагсаалт татах
 * @param {Object} filters - Шүүлтүүр параметрүүд
 */
const getVehicles = async (filters = {}) => {
  const params = {
    limit: filters.limit || CARAPIS.DEFAULT_LIMIT,
    offset: filters.offset || 0,
    ...(filters.brand && { brand: filters.brand }),
    ...(filters.model && { model: filters.model }),
    ...(filters.year_min && { year_min: filters.year_min }),
    ...(filters.year_max && { year_max: filters.year_max }),
    ...(filters.price_min && { price_min: filters.price_min }),
    ...(filters.price_max && { price_max: filters.price_max }),
    ...(filters.location && { location: filters.location }),
  };

  console.log(`🔍 Encar машин хайж байна:`, params);

  const response = await apiClient.get(CARAPIS.ENCAR_VEHICLES_ENDPOINT, { params });
  const data = response.data;

  if (!data.success) {
    throw new Error(`Encar API амжилтгүй хариу: ${JSON.stringify(data)}`);
  }

  console.log(`✅ ${data.data?.vehicles?.length || 0} машин олдлоо (Нийт: ${data.data?.total})`);
  return data;
};

/**
 * Нэг машины дэлгэрэнгүй мэдээлэл татах
 * @param {string} id - Машины ID
 */
const getVehicleById = async (id) => {
  console.log(`🔍 Encar машин дэлгэрэнгүй: ID ${id}`);
  const response = await apiClient.get(`${CARAPIS.ENCAR_VEHICLE_DETAIL_ENDPOINT}/${id}`);
  const data = response.data;

  if (!data.success) {
    throw new Error(`Машин олдсонгүй: ID ${id}`);
  }

  console.log(`✅ Машин олдлоо: ${data.data?.title}`);
  return data;
};

/**
 * Брэндүүдийн жагсаалт татах
 */
const getBrands = async () => {
  console.log(`🔍 Encar брэндүүд татаж байна...`);
  const response = await apiClient.get(CARAPIS.ENCAR_BRANDS_ENDPOINT);
  const data = response.data;

  if (!data.success) {
    throw new Error('Брэндийн жагсаалт татаж чадсангүй');
  }

  console.log(`✅ ${data.data?.length} брэнд олдлоо`);
  return data;
};

/**
 * Тодорхой брэндийн загваруудыг татах
 * @param {string} brand - Брэндийн нэр
 */
const getModelsByBrand = async (brand) => {
  console.log(`🔍 Encar ${brand} загваруудыг татаж байна...`);
  const response = await apiClient.get(`${CARAPIS.ENCAR_MODELS_ENDPOINT}/${brand}`);
  const data = response.data;

  if (!data.success) {
    throw new Error(`${brand} брэндийн загваруудыг татаж чадсангүй`);
  }

  console.log(`✅ ${brand}: ${data.data?.length} загвар олдлоо`);
  return data;
};

/**
 * Зах зээлийн статистик татах
 * @param {Object} params - Хайлтын параметрүүд
 */
const getMarketStats = async (params = {}) => {
  console.log(`📊 Encar зах зээлийн статистик татаж байна...`);
  const response = await apiClient.get(CARAPIS.ENCAR_MARKET_STATS_ENDPOINT, { params });
  return response.data;
};

/**
 * API холболтыг тест хийх
 */
const testConnection = async () => {
  console.log('🔌 Encar API холболт тест хийж байна...');
  try {
    const response = await apiClient.get(CARAPIS.ENCAR_BRANDS_ENDPOINT, {
      params: { limit: 1 },
    });
    console.log('✅ Encar API холболт амжилттай!');
    return { success: true, message: 'API холболт ажиллаж байна' };
  } catch (error) {
    console.error('❌ Encar API холболт амжилтгүй:', error.message);
    return { success: false, message: error.message };
  }
};

module.exports = {
  getVehicles,
  getVehicleById,
  getBrands,
  getModelsByBrand,
  getMarketStats,
  testConnection,
};