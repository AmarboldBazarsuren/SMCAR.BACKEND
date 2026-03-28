/**
 * SMCar.mn Seed Script
 * Файл: backend/src/scripts/seedAdmin.js
 * Үүрэг: Default admin бүртгэл, pricing config, tax config үүсгэх
 * Ажиллуулах: npm run seed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const PricingConfig = require('../models/PricingConfig');
const TaxConfig = require('../models/TaxConfig');

const seed = async () => {
  console.log('');
  console.log('🌱 SMCar.mn Seed script эхэллээ...');
  console.log('='.repeat(50));

  try {
    // MongoDB холбох
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB холбогдлоо');

    // ============================================================
    // 1. DEFAULT ADMIN ҮҮСГЭХ
    // ============================================================
    const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@smcar.mn';
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@12345';

    const existingAdmin = await Admin.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`ℹ️  Admin аль хэдийн байна: ${adminEmail}`);
    } else {
      await Admin.create({
        email: adminEmail,
        password: adminPassword,
        name: 'SMCar Admin',
        role: 'superadmin',
      });
      console.log('✅ Default admin үүслээ:');
      console.log(`   И-мэйл: ${adminEmail}`);
      console.log(`   Нууц үг: ${adminPassword}`);
      console.log('   ⚠️  Нэвтэрсний дараа нууц үгээ заавал солиорой!');
    }

    // ============================================================
    // 2. PRICING CONFIG ҮҮСГЭХ
    // ============================================================
    const existingPricing = await PricingConfig.findOne({ isActive: true });
    if (existingPricing) {
      console.log(`ℹ️  PricingConfig аль хэдийн байна (1₩ = ${existingPricing.wonToMNT}₮)`);
    } else {
      await PricingConfig.create({
        wonToMNT: 2.43,
        mongolServiceFee: 800000,
        shippingCosts: {
          small: 3500000,
          medium: 4500000,
          large: 5343000,
          xlarge: 6500000,
        },
        customsDutyRate: 15.5,
        vatRate: 10,
        isActive: true,
      });
      console.log('✅ Default PricingConfig үүслээ (1₩ = 2.43₮)');
    }

    // ============================================================
    // 3. TAX CONFIG ҮҮСГЭХ (Image 1 татварын хүснэгт)
    // ============================================================
    const existingTax = await TaxConfig.findOne({ isActive: true });
    if (existingTax) {
      console.log(`ℹ️  TaxConfig аль хэдийн байна (${existingTax.entries.length} мөр)`);
    } else {
      await TaxConfig.create({
        name: 'Стандарт онцгой татварын хүснэгт 2020',
        isActive: true,
        entries: [
          { engineLabel: '1500cc ба түүнээс доош', engineMin: 0, engineMax: 1500,
            tax0to3: 750000, tax4to6: 1600000, tax7to9: 3350000, tax10plus: 10000000 },
          { engineLabel: '1501-2500cc', engineMin: 1501, engineMax: 2500,
            tax0to3: 2300000, tax4to6: 3200000, tax7to9: 5000000, tax10plus: 11700000 },
          { engineLabel: '2501-3500cc', engineMin: 2501, engineMax: 3500,
            tax0to3: 3050000, tax4to6: 4000000, tax7to9: 6700000, tax10plus: 13350000 },
          { engineLabel: '3501-4500cc', engineMin: 3501, engineMax: 4500,
            tax0to3: 6850750, tax4to6: 8000000, tax7to9: 10850000, tax10plus: 17500000 },
          { engineLabel: '4501cc ба түүнээс дээш', engineMin: 4501, engineMax: 999999,
            tax0to3: 14210000, tax4to6: 27200000, tax7to9: 39150000, tax10plus: 65975000 },
        ],
      });
      console.log('✅ Default TaxConfig үүслээ (Image 1-ийн хүснэгтийн дагуу)');
    }

    console.log('');
    console.log('='.repeat(50));
    console.log('🎉 Seed амжилттай дууслаа!');
    console.log('');
    console.log('📋 Admin нэвтрэх мэдээлэл:');
    console.log(`   URL: http://localhost:5000/api/admin/auth/login`);
    console.log(`   И-мэйл: ${adminEmail}`);
    console.log(`   Нууц үг: ${adminPassword}`);
    console.log('');
    console.log('🚀 Серверийг эхлүүлэх: npm run dev');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Seed алдаа:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 MongoDB ажиллаж байгаа эсэхийг шалгаарай: mongod --version');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB холболт хаалаа');
    process.exit(0);
  }
};

seed();