// full-api-auto-run.js
// Usage: node full-api-auto-run.js
// Requires: npm i axios fs-extra
const axios = require('axios');
const fse = require('fs-extra');
const path = require('path');

const API_BASE_ROOT = process.env.API_BASE_ROOT || 'http://localhost:3000/api';
const ROUTES_DIR = process.env.ROUTES_DIR || path.join(process.cwd(), 'routes');
const REPORT_FILE = path.join(process.cwd(), 'full-api-auto-report.json');

// set test credentials here (match your DB)
const TEST_USER = process.env.TEST_USER || 'admin1';
const TEST_PASS = process.env.TEST_PASS || '123456';

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function discoverRoutes() {
  const files = await fse.readdir(ROUTES_DIR);
  const routeFiles = files.filter(f => f.endsWith('.js') && !f.startsWith('_'));
  return routeFiles.map(f => `/api/${f.replace('.js','')}`);
}

// Best-effort body generator by path name
function guessBodyForPath(p) {
  const low = p.toLowerCase();
  if (low.includes('driver')) return { fullname: 'AutoDriver', phone: '059' + Math.floor(1000000 + Math.random()*8999999) };
  if (low.includes('customer')) return { fullname: 'AutoCustomer', phone: '059' + Math.floor(1000000 + Math.random()*8999999) };
  if (low.includes('unit')) return { unitname: 'Box', unitcategory: 'Packing' };
  if (low.includes('store')) return { storename: 'AutoStore ' + Date.now(), phone: '059' + Math.floor(1000000 + Math.random()*8999999) , categoryid: 1 };
  if (low.includes('product')) return { productname: 'AutoProduct ' + Date.now(), price: 10, stock: 5, storeid: 1 };
  if (low.includes('order')) return { customerid: 1, storeid: 1, status: 'Pending', totalamount: 10, deliveryfee: 2, items: [{ productid: 1, quantity: 1, price: 10 }]};
  if (low.includes('apply-coupon')) return { couponcode: 'TEST10', orderamount: 100 };
  if (low.includes('auth/login') || low.endsWith('/auth')) return { username: TEST_USER, password: TEST_PASS };
  return { dummy: true };
}

async function tryRequest(method, url, headers = {}, body = null) {
  try {
    const config = { headers, validateStatus: s => true, timeout: 10000 };
    let res;
    if (method === 'get' || method === 'delete') {
      res = await axios[method](url, config);
    } else {
      res = await axios[method](url, body, config);
    }
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    return { ok: false, error: err.message, status: err.response?.status, data: err.response?.data };
  }
}

async function run() {
  const report = { startedAt: new Date().toISOString(), results: [] };
  const routes = await discoverRoutes();
  console.log('Discovered routes:', routes.length);
  // attempt login first: try common auth paths
  let token = null;
  const authCandidates = ['/api/auth','/api/auth/login','/api/sessions','/api/login'].map(p => API_BASE_ROOT.replace(/\/api\/?$/,'') + p.replace(/^\/api/,''));
  // but simpler: try /api/auth/login relative to base root
  const loginUrl = API_BASE_ROOT + '/auth/login';
  try {
    const loginRes = await tryRequest('post', loginUrl, {'Content-Type':'application/json'}, { username: TEST_USER, password: TEST_PASS });
    if (loginRes.ok && [200,201].includes(loginRes.status)) {
      // find token in common places
      token = loginRes.data?.data?.token || loginRes.data?.token || loginRes.data?.sessiontoken || loginRes.data?.data?.sessiontoken;
      console.log('Login attempt:', loginRes.status, 'token?', !!token);
      report.login = loginRes;
    } else {
      report.login = loginRes;
      console.log('Login failed or not present:', loginRes.status);
    }
  } catch(e) {
    report.login = { ok:false, error: e.message };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (const r of routes) {
    const fullUrl = API_BASE_ROOT.replace(/\/api$/,'') + r.replace(/^\/api/,''); // ensure full url like http://host:port/api/xxx
    const entry = { route: r, testedAt: new Date().toISOString(), attempts: [] };
    console.log('Testing', r);

    // 1) Try GET
    const getRes = await tryRequest('get', fullUrl, headers);
    entry.attempts.push({ method: 'GET', result: getRes });
    // if GET returns 200/201/204/401/403/404 -> record and maybe try POST if GET is 404 or GET is allowed but POST also exists
    // We'll attempt POST when GET is 404 or GET is 200 (to test create).
    let shouldTryPost = false;
    if (!getRes.ok) shouldTryPost = true;
    else if (getRes.status === 404) shouldTryPost = true;
    else if ([200,201].includes(getRes.status)) shouldTryPost = true; // try POST as well
    else if ([401,403].includes(getRes.status)) {
      // forbidden/unauthorized — try POST only if we have token
      shouldTryPost = !!token;
    }

    if (shouldTryPost) {
      const body = guessBodyForPath(r);
      const postRes = await tryRequest('post', fullUrl, headers, body);
      entry.attempts.push({ method: 'POST', body, result: postRes });
    }

    report.results.push(entry);
    await sleep(80);
  }

  report.finishedAt = new Date().toISOString();
  await fse.writeJson(REPORT_FILE, report, { spaces: 2 });
  console.log('Done. Report written to', REPORT_FILE);
}

run().catch(err => {
  console.error('Fatal:', err);
});
