/*
RoadTrip API - Local Server Testing Script
✅ يشتغل مباشرة على السيرفر المحلي بدون الحاجة لـ JWT
- اختبار CRUD لجميع الجداول: Customers, Stores, Products, Orders
- عرض النتائج مباشرة على Console
- تجاوز المصادقة للسيرفر المحلي
*/

require('dotenv').config();
const axios = require('axios');

const BASE = process.env.API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: BASE,
  headers: {
    'Content-Type': 'application/json',
    // لا يوجد Authorization لأنه سيرفر محلي بدون JWT
  },
});

function randSuffix() {
  return Math.random().toString(36).substring(2, 8);
}

async function runTests() {
  const customer = {};
  const store = {};
  const product = {};
  const order = {};

  try {
    console.log('--- Testing Customers ---');

    // GET all customers
    try {
      const res = await api.get('/api/customers');
      console.log('GET /customers result:', res.data);
    } catch (e) {
      console.error('GET /customers failed:', e.response ? e.response.data : e.message);
    }

    // POST create customer
    try {
      const payload = {
        FullName: `Test User ${randSuffix()}`,
        Phone: `05${Math.floor(10000000 + Math.random()*89999999)}`,
        Email: `test+${randSuffix()}@example.com`,
        Password: 'P@ssw0rd!'
      };
      const res = await api.post('/api/customers', payload);
      console.log('POST /customers result:', res.data);
      customer.id = res.data.id || res.data.ID;
    } catch (e) {
      console.error('POST /customers failed:', e.response ? e.response.data : e.message);
    }

    // PATCH update customer
    if (customer.id) {
      try {
        const res = await api.patch(`/api/customers/${customer.id}`, { FullName: `Updated User ${randSuffix()}` });
        console.log('PATCH /customers result:', res.data);
      } catch (e) {
        console.error('PATCH /customers failed:', e.response ? e.response.data : e.message);
      }
    }

    // DELETE customer
    if (customer.id) {
      try {
        await api.delete(`/api/customers/${customer.id}`);
        console.log('DELETE /customers success');
      } catch (e) {
        console.error('DELETE /customers failed:', e.response ? e.response.data : e.message);
      }
    }

    console.log('--- Testing Stores ---');
    // POST create store
    try {
      const payload = { Name: `Test Store ${randSuffix()}`, CategoryID: 1, CityID: 1, Address: 'Test Address' };
      const res = await api.post('/api/stores', payload);
      console.log('POST /stores result:', res.data);
      store.id = res.data.id || res.data.ID;
    } catch (e) {
      console.error('POST /stores failed:', e.response ? e.response.data : e.message);
    }

    console.log('--- Testing Products ---');
    if (store.id) {
      try {
        const payload = { StoreID: store.id, Name: `Test Product ${randSuffix()}`, CategoryID: 2, Price: 10.5, PhotoURL: 'http://example.com/test.jpg' };
        const res = await api.post('/api/products', payload);
        console.log('POST /products result:', res.data);
        product.id = res.data.id || res.data.ID;
      } catch (e) {
        console.error('POST /products failed:', e.response ? e.response.data : e.message);
      }
    }

    console.log('--- Testing Orders ---');
    if (customer.id && store.id && product.id) {
      try {
        const payload = { CustomerID: customer.id, StoreID: store.id, OrderItems: [{ ProductID: product.id, Quantity: 2 }], TotalPrice: 2 * 10.5 };
        const res = await api.post('/api/orders', payload);
        console.log('POST /orders result:', res.data);
        order.id = res.data.id || res.data.ID;
      } catch (e) {
        console.error('POST /orders failed:', e.response ? e.response.data : e.message);
      }
    }

    // Cleanup
    console.log('--- Cleanup ---');
    if (order.id) await api.delete(`/api/orders/${order.id}`).catch(()=>{});
    if (product.id) await api.delete(`/api/products/${product.id}`).catch(()=>{});
    if (store.id) await api.delete(`/api/stores/${store.id}`).catch(()=>{});
    if (customer.id) await api.delete(`/api/customers/${customer.id}`).catch(()=>{});
    console.log('Cleanup finished');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

runTests();