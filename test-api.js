// test-api.js
// Node.js script to run simple CRUD smoke tests for configured endpoints.
// Usage: node test-api.js --config=tests.config.json --base=http://localhost:3000 --verbose
// Requires: npm i axios minimist

const fs = require('fs');
const axios = require('axios');
const argv = require('minimist')(process.argv.slice(2));

const configPath = argv.config || 'tests.config.json';
const BASE = (argv.base || 'http://localhost:3000').replace(/\/$/, '');
const VERBOSE = argv.v || argv.verbose;

if (!fs.existsSync(configPath)) {
  console.error('Config file not found:', configPath);
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Helper: robust id extraction from various API shapes
function extractId(result, idFieldCandidates = []) {
  if (!result) return null;

  // if top-level driver / customer / created object returned
  const directObj = result.driver || result.customer || result.product || result.order || result.data || result;
  const candidates = (idFieldCandidates || []).concat([
    'id','Id','ID',
    'driverid','DriverID','driverId',
    'customerid','CustomerID','CustomerId',
    'productid','ProductID','ProductId',
    'categoryid','CategoryID','CategoryId',
    'orderid','OrderID','OrderId',
    'paymentid','PaymentID','PaymentId',
    'ratingid','RatingID','RatingId'
  ]);

  // if result.data is an array (select returned rows), try first element
  if (Array.isArray(result.data) && result.data.length && typeof result.data[0] === 'object') {
    for (const c of candidates) if (result.data[0][c]) return result.data[0][c];
  }

  // check nested known shapes
  if (result.data && typeof result.data === 'object') {
    // sometimes data contains the created object directly
    for (const c of candidates) if (result.data[c]) return result.data[c];
    // or data has { driver: {...} }
    for (const k of Object.keys(result.data)) {
      const obj = result.data[k];
      if (obj && typeof obj === 'object') {
        for (const c of candidates) if (obj[c]) return obj[c];
      }
    }
  }

  // check top-level fields
  for (const c of candidates) {
    if (directObj && typeof directObj === 'object' && directObj[c]) return directObj[c];
    if (result[c]) return result[c];
    if (result.data && result.data[c]) return result.data[c];
  }

  return null;
}

async function testEndpoint(item) {
  const baseUrl = BASE + item.path;
  const report = { path: item.path, create: null, get: null, update: null, delete: null, errors: [] };

  try {
    // 1. CREATE (POST) if createPayload provided
    let createdId = null;
    let createdRaw = null;
    if (item.createPayload) {
      try {
        const url = baseUrl;
        const resp = await axios.post(url, item.createPayload, { headers: item.headers || {} });
        createdRaw = resp.data || resp;
        createdId = extractId(createdRaw, item.idFieldCandidates || []);
        report.create = { status: resp.status, data: createdRaw, id: createdId };
        if (VERBOSE) console.log(`[CREATE] ${url} -> ${resp.status}`, 'id=', createdId);
      } catch (err) {
        const detail = err.response ? (err.response.data || err.response.statusText) : err.message;
        report.errors.push({ op: 'create', error: err.message, detail });
        if (VERBOSE) console.error('[CREATE ERROR]', detail);
        // stop further ops for this endpoint
        return report;
      }
    } else {
      report.create = { skipped: true };
    }

    // 2. GET (list or item)
    try {
      if (createdId && item.getItemPath) {
        const url = BASE + item.getItemPath.replace(':id', createdId);
        const resp = await axios.get(url, { headers: item.headers || {} });
        report.get = { status: resp.status, data: resp.data };
        if (VERBOSE) console.log(`[GET ITEM] ${url} -> ${resp.status}`);
      } else {
        const url = baseUrl;
        const resp = await axios.get(url, { params: item.listQuery || {}, headers: item.headers || {} });
        report.get = { status: resp.status, data: resp.data };
        if (VERBOSE) console.log(`[GET LIST] ${url} -> ${resp.status}`);
      }
    } catch (e) {
      const detail = e.response ? (e.response.data || e.response.statusText) : e.message;
      report.errors.push({ op: 'get', error: e.message, detail });
      if (VERBOSE) console.error('[GET ERROR]', detail);
    }

    // 3. UPDATE (PUT/PATCH)
    if (createdId && item.updatePayload) {
      try {
        const url = (item.updatePath) ? BASE + item.updatePath.replace(':id', createdId) : baseUrl + '/' + createdId;
        const method = (item.updateMethod || 'put').toLowerCase();
        const resp = await axios[method](url, item.updatePayload, { headers: item.headers || {} });
        report.update = { status: resp.status, data: resp.data };
        if (VERBOSE) console.log(`[UPDATE] ${url} -> ${resp.status}`);
      } catch (e) {
        const detail = e.response ? (e.response.data || e.response.statusText) : e.message;
        report.update = null;
        report.errors.push({ op: 'update', error: e.message, detail });
        if (VERBOSE) console.error('[UPDATE ERROR]', detail);
      }
    } else {
      report.update = { skipped: true };
    }

    // 4. DELETE
    if (createdId && item.deleteAfter !== false) {
      try {
        const url = (item.deletePath) ? BASE + item.deletePath.replace(':id', createdId) : baseUrl + '/' + createdId;
        const resp = await axios.delete(url, { headers: item.headers || {} });
        report.delete = { status: resp.status, data: resp.data };
        if (VERBOSE) console.log(`[DELETE] ${url} -> ${resp.status}`);
      } catch (e) {
        const detail = e.response ? (e.response.data || e.response.statusText) : e.message;
        report.delete = null;
        report.errors.push({ op: 'delete', error: e.message, detail });
        if (VERBOSE) console.error('[DELETE ERROR]', detail);
      }
    } else {
      report.delete = { skipped: true };
    }

  } catch (err) {
    console.error('[CREATE ERROR FULL]', err.response ? err.response.data : err);
report.errors.push({ op: 'create', error: err.message, detail: err.response?.data || err });

  }

  return report;
}

(async () => {
  console.log('=== API Smoke Test Runner ===');
  const results = [];
  for (const item of cfg.endpoints) {
    process.stdout.write(`Testing ${item.path} ... `);
    try {
      const r = await testEndpoint(item);
      results.push(r);
      const ok = (r.errors.length === 0);
      console.log(ok ? 'OK' : 'FAIL');
    } catch (e) {
      console.log('ERROR', e.message);
      results.push({ path: item.path, error: e.message });
    }
  }

  // summary
  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(`\n[${r.path}]`);
    if (r.create) console.log(' create:', r.create.status || r.create);
    if (r.get) console.log(' get:', r.get.status || r.get);
    if (r.update) console.log(' update:', r.update.status || r.update);
    if (r.delete) console.log(' delete:', r.delete.status || r.delete);
    if (r.errors && r.errors.length) {
      console.log(' errors:', r.errors.map(e => `${e.op}:${typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)}`));
    }
  }

  // save full report
  fs.writeFileSync('test-api-report.json', JSON.stringify({ base: BASE, results, timestamp: new Date() }, null, 2));
  console.log('\nFull report saved to test-api-report.json');
})();
