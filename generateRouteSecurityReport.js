/**
 * generateRouteSecurityReport.js
 *
 * يفحص مجلد routes/ في مشروع Express ويولد تقريرًا عن كل Route:
 * - path, methods
 * - middleware function names (من introspection إن أمكن)
 * - كلمات مفتاحية موجودة في نص الملف (static scan)
 * - توصية مبسطة لتحسين الحماية
 *
 * إخراج: route-security-report.json وطبعة ملخّصة على الـ console
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const outJson = path.join(__dirname, 'route-security-report.json');

const SENSITIVE_KEYWORDS = [
  'verifyToken','verify','authenticate','authorize','checkRole',
  'isAdmin','requireRole','role','jwt','req.user','session','passport',
  'bearer','Authorization','verifyTokenMiddleware','ensureAuthenticated'
];

// Heuristics: filenames that commonly should require admin role or extra protection
const SENSITIVE_FILES = [
  'systemSettings','rolePermissions','roles','transactions','payments',
  'users','stores','storeRatings','drivers','auditTrail'
];

function fileStaticScan(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const found = [];
    SENSITIVE_KEYWORDS.forEach(k => {
      const re = new RegExp('\\b' + k + '\\b', 'i');
      if (re.test(text)) found.push(k);
    });
    // also find custom middleware names by scanning for "function <name>(" or "const <name> ="
    const funcNames = [];
    const funcRe = /(?:function|const|let|var)\s+([A-Za-z0-9_]+)\s*(?:=|\()/g;
    let m;
    while ((m = funcRe.exec(text))) {
      const n = m[1];
      if (/verify|auth|check|role|session|ensure/i.test(n)) funcNames.push(n);
    }
    return { keywords: found, probableMiddlewareNames: Array.from(new Set(funcNames)) };
  } catch (err) {
    return { keywords: [], probableMiddlewareNames: [] };
  }
}

function inspectRouterModule(filePath) {
  try {
    // delete from require cache to allow re-require fresh
    delete require.cache[require.resolve(filePath)];
    const router = require(filePath);
    // if module exports a function that expects (app) it might fail; handle that
    if (!router || !router.stack) return { ok: false, reason: 'no router.stack', router: null };
    const routes = [];
    router.stack.forEach(layer => {
      // layer.route => direct route
      if (layer.route) {
        const routePath = layer.route.path || '/';
        const methods = Object.keys(layer.route.methods || {}).map(m => m.toUpperCase());
        // collect middleware/handlers names
        const mnames = (layer.route.stack || []).map(s => s.handle && s.handle.name ? s.handle.name : (s.name || '<anonymous>'));
        routes.push({ path: routePath, methods, middleware: mnames });
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        // nested router: inspect substack
        layer.handle.stack.forEach(l2 => {
          if (l2.route) {
            const routePath = l2.route.path || '/';
            const methods = Object.keys(l2.route.methods || {}).map(m => m.toUpperCase());
            const mnames = (l2.route.stack || []).map(s => s.handle && s.handle.name ? s.handle.name : (s.name || '<anonymous>'));
            routes.push({ path: routePath, methods, middleware: mnames });
          }
        });
      } else {
        // could be a router-level middleware: layer.name may be the middleware function name
        // We'll capture at router-level later if needed
      }
    });
    return { ok: true, routes };
  } catch (err) {
    return { ok: false, reason: String(err), router: null };
  }
}

function recommendForFile(filename, routeEntry, staticInfo) {
  const recs = [];
  const middleware = (routeEntry.middleware || []).join(' ').toLowerCase();
  const keywords = (staticInfo.keywords || []).map(k => k.toLowerCase());
  // If verifyToken appears either in middleware names or in static keywords -> auth present
  const hasAuth = middleware.includes('verify') || keywords.includes('verifytoken') || keywords.includes('authenticate') || keywords.some(k => /auth/i.test(k));
  if (!hasAuth) {
    // if route filename is sensitive, recommend authentication + role check
    const base = filename.toLowerCase();
    if (SENSITIVE_FILES.some(s => base.includes(s.toLowerCase()))) {
      recs.push('Add authentication (verifyToken) and role-based authorization (admin/owner) — HIGH PRIORITY');
    } else {
      recs.push('Add authentication (verifyToken) if route exposes or modifies user-sensitive data');
    }
  } else {
    // has some auth; does it include role check?
    const hasRole = middleware.includes('role') || keywords.some(k => /role|isadmin|authorize|checkrole/i.test(k));
    if (!hasRole) {
      // heuristics: if filename in sensitive list then recommend role check
      const base = filename.toLowerCase();
      if (SENSITIVE_FILES.some(s => base.includes(s.toLowerCase()))) {
        recs.push('Add role-based authorization (checkRole/isAdmin) — sensitive endpoint');
      } else {
        recs.push('Consider adding role checks if endpoint should be limited to certain users');
      }
    } else {
      recs.push('Auth and role-check middleware detected — OK (review naming and logic)');
    }
  }

  // If middleware names are mostly anonymous, recommend naming middleware functions
  const anonCount = (routeEntry.middleware || []).filter(n => n === '<anonymous>' || n === 'bound dispatch' || n === '').length;
  if (anonCount > 0) {
    recs.push('Some handlers are anonymous — consider naming middleware/handlers for clearer reports');
  }

  return recs;
}

// Main
const report = {
  generatedAt: new Date().toISOString(),
  routes: []
};

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js')).sort();

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  const baseName = path.basename(file, '.js');

  const staticInfo = fileStaticScan(filePath);
  const dynamic = inspectRouterModule(filePath);

  if (dynamic.ok) {
    // dynamic.routes is array of {path, methods, middleware}
    dynamic.routes.forEach(r => {
      const recs = recommendForFile(baseName, r, staticInfo);
      report.routes.push({
        file: file,
        fileBase: baseName,
        path: r.path,
        methods: r.methods,
        middleware: r.middleware,
        staticKeywords: staticInfo.keywords,
        staticProbableMiddleware: staticInfo.probableMiddlewareNames,
        recommendations: recs
      });
    });
    // also check for router-level middleware (router.stack entries that are not routes)
    // gather top-level middleware names if any
    const routerMiddleware = dynamic.routes.length === 0 ? [] : []; // not used now
  } else {
    // Could not require module: fallback to a placeholder using static scan
    const probable = staticInfo.probableMiddlewareNames;
    // try to find exported base route paths by guessing from filenames
    const guessedPath = '/' + baseName;
    const methodsGuess = ['GET','POST','PUT','DELETE'];
    const recs = recommendForFile(baseName, { middleware: probable, path: guessedPath, methods: methodsGuess }, staticInfo);
    report.routes.push({
      file,
      fileBase: baseName,
      path: guessedPath,
      methods: methodsGuess,
      middleware: probable.length ? probable : ['<unknown>'],
      staticKeywords: staticInfo.keywords,
      staticProbableMiddleware: staticInfo.probableMiddlewareNames,
      recommendations: recs,
      note: `Module require failed or module not exporting router.stack — static analysis used. reason: ${dynamic.reason}`
    });
  }
});

// Summarize top priorities
const summary = {
  totalRoutes: report.routes.length,
  highPriority: report.routes.filter(r => r.recommendations.some(x => /HIGH PRIORITY/i.test(x))).length,
  needAuth: report.routes.filter(r => r.recommendations.some(x => /Add authentication/i.test(x))).length,
  namedMiddlewareIssues: report.routes.filter(r => r.recommendations.some(x => /anonymous/i.test(x))).length
};

report.summary = summary;

// Save JSON
fs.writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8');
console.log('✅ Route security report generated:', outJson);
console.log(`Total routes discovered: ${report.routes.length}`);
console.log('High priority (sensitive endpoints missing auth/role):', summary.highPriority);
console.log('Routes needing authentication:', summary.needAuth);
console.log('Routes with anonymous handlers (recommend naming):', summary.namedMiddlewareIssues);

// Print a compact sample view
console.log('\n--- Sample report (first 12 routes) ---');
report.routes.slice(0,12).forEach(r => {
  console.log(`\nFile: ${r.file}  Path: ${r.path}  Methods: ${r.methods.join(', ')}`);
  console.log(`  Middleware: ${r.middleware.join(', ')}`);
  if (r.staticKeywords && r.staticKeywords.length) console.log(`  Static keywords: ${r.staticKeywords.join(', ')}`);
  if (r.recommendations && r.recommendations.length) {
    console.log('  Recommendations:');
    r.recommendations.forEach(x => console.log('   -', x));
  }
  if (r.note) console.log('  Note:', r.note);
});

console.log('\n📌 الآن افتح الملف route-security-report.json لمشاهدة التقرير الكامل (JSON) أو أرسله لي إذا تريد ملخّصًا أوسع.');
