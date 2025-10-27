// autoTestAPI.js (محدث) — يلتقط OTP من الاستجابة ويستخدم أرقام عشوائية
const axios = require('axios');
const baseURL = 'http://localhost:3000/api';
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function randPhone() {
    // شكل رقمي محلي؛ عدّله إذا تريد صيغة أخرى (مثال: 09xxxxxxxx)
    return '05' + rand(10000000, 99999999).toString();
}

function randEmail() {
    return `test${Date.now()}${rand(100,999)}@example.com`;
}

async function testCustomers() {
    console.log('=== Testing Customers ===');
    const phone = randPhone();
    const email = randEmail();
    const customer = { FullName: "Auto Test User", Phone: phone, Email: email, Password: "123456" };

    try {
        // 1) Create
        let res = await axios.post(`${baseURL}/customers`, customer);
        console.log('✅ Add Customer:', res.data.message || res.data);

        // 2) Request OTP (login-otp) — server should return { data: { otp } } in dev
        res = await axios.post(`${baseURL}/customers/login-otp`, { Phone: phone });
        console.log('✅ Send OTP response:', res.data.message || res.data);

        // try to read OTP from response (data.otp) — fallback to default if not present
        const otp = res.data?.data?.otp || res.data?.otp || null;
        if (!otp) {
            throw new Error('OTP not returned by server response. Make sure server returns { data: { otp } } in development.');
        }

        // 3) Verify OTP
        res = await axios.post(`${baseURL}/customers/verify-otp`, { Phone: phone, OTP: otp });
        console.log('✅ Verify OTP:', res.data.message || res.data);

        const token = res.data?.data?.token;
        if (!token) throw new Error('No JWT returned after verify-otp');

        // 4) Get profile using token
        res = await axios.get(`${baseURL}/customers/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Customer profile:', res.data);
    } catch (err) {
        console.error('❌ Test failed (Customers):', err.response ? err.response.data : err.message);
    }
}

async function testDriver() {
    console.log('=== Testing Driver ===');
    // DriverID uses string primary key as in schema above
    const driverID = `DRV${Date.now()}`;
    const phone = randPhone();
    const driver = {
        DriverID: driverID,
        FullName: "Auto Test Driver",
        Phone: phone,
        Password: "driverpass",
        IsActive: 1
    };

    try {
        // 1) Create driver
        let res = await axios.post(`${baseURL}/driver`, driver);
        console.log('✅ Add Driver:', res.data.message || res.data);

        // 2) Get all driver
        res = await axios.get(`${baseURL}/driver`);
        console.log('✅ All Driver count:', Array.isArray(res.data.data) ? res.data.data.length : (res.data.length || 'unknown'));

        // 3) Update driver
        res = await axios.put(`${baseURL}/driver/${driverID}`, { FullName: "Updated Driver" });
        console.log('✅ Update Driver:', res.data.message || res.data);

        // 4) Delete driver
        res = await axios.delete(`${baseURL}/driver/${driverID}`);
        console.log('✅ Delete Driver:', res.data.message || res.data);
    } catch (err) {
        console.error('❌ Test failed (Driver):', err.response ? err.response.data : err.message);
    }
}

async function testStores() {
    console.log('=== Testing Stores ===');
    const phone = randPhone();
    const store = {
        StoreName: `Auto Store ${Date.now()}`,
        CategoryID: null,
        CityID: null,
        AreaID: null,
        Address: "Auto Address",
        Phone: phone,
        Email: randEmail(),
        Description: "Auto test store",
        IsActive: 1,
        LogoURL: null,
        Rating: 0
    };

    try {
        // 1) Create store
        let res = await axios.post(`${baseURL}/stores`, store);
        console.log('✅ Add Store:', res.data.message || res.data);

        // 2) Get all stores
        res = await axios.get(`${baseURL}/stores`);
        console.log('✅ All Stores count:', Array.isArray(res.data.data) ? res.data.data.length : (res.data.length || 'unknown'));

        // If your stores route supports login-otp, we could request OTP here similarly.
        // 3) Delete store — need StoreID returned or read from list (we'll read last inserted)
        // Try to read inserted StoreID from DB via listing: find by phone
        res = await axios.get(`${baseURL}/stores`);
        const list = res.data?.data || res.data || [];
        const created = list.find(s => s.Phone === phone);
        if (created && created.StoreID) {
            const id = created.StoreID;
            res = await axios.put(`${baseURL}/stores/${id}`, { StoreName: "Updated Auto Store" });
            console.log('✅ Update Store:', res.data.message || res.data);

            res = await axios.delete(`${baseURL}/stores/${id}`);
            console.log('✅ Delete Store:', res.data.message || res.data);
        } else {
            console.log('ℹ️ Could not find created store by phone (skipping update/delete)');
        }
    } catch (err) {
        console.error('❌ Test failed (Stores):', err.response ? err.response.data : err.message);
    }
}

(async function runAll() {
    await testCustomers();
    await testDriver();
    await testStores();
    console.log('--- Tests finished ---');
})();
