const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const { sql } = require('../db'); // فرضاً هنا postgres client

// 🔧 Middleware للتحقق من صلاحية Admin
function isAdmin(req, res, next) {
    const user = req.user; // JWT middleware يضيف req.user
    if (!user || user.type !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    next();
}

// 🧩 دالة موحدة للردود
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({
        success,
        message,
        timestamp: new Date(),
        data
    });
}

// ---------------------------
// GET / - قائمة الكوبونات مع بحث/فلترة/pagination
// ---------------------------
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 20, search = '', discountType, validOnly } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 20;
        const offset = (page - 1) * limit;

        let where = 'WHERE 1=1';
        const params = [];

        if (search) {
            where += ` AND ("Code" ILIKE $${params.length + 1} OR "Description" ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }
        if (discountType) {
            where += ` AND "DiscountType" = $${params.length + 1}`;
            params.push(discountType);
        }
        if (validOnly === 'true') {
            where += ' AND "StartDate" <= NOW() AND "EndDate" >= NOW() AND ("MaxUsage" = 0 OR "UsageCount" < "MaxUsage")';
        }

        const countResult = await sql`SELECT COUNT(*) AS "TotalCount" FROM "couponsadvanced" ${sql.raw(where)}`;
        const totalCount = parseInt(countResult[0].TotalCount, 10);

        const coupons = await sql`
            SELECT "CouponID", "Code", "DiscountType", "DiscountValue", "StartDate", "EndDate", "MinOrderAmount",
                   "MaxUsage", "UsageCount", "Description", "CreatedAt", "UpdatedAt"
            FROM "couponsadvanced"
            ${sql.raw(where)}
            ORDER BY "StartDate" DESC
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `;

        const formatted = coupons.map(c => ({
            ...c,
            StartDate: c.StartDate?.toISOString(),
            EndDate: c.EndDate?.toISOString(),
            CreatedAt: c.CreatedAt?.toISOString(),
            UpdatedAt: c.UpdatedAt?.toISOString()
        }));

        sendResponse(res, true, 'CouponsAdvanced retrieved successfully', {
            page,
            limit,
            totalCount,
            coupons: formatted
        });
    } catch (err) {
        console.error(err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ---------------------------
// GET /:id - جلب كوبون حسب ID
// ---------------------------
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return sendResponse(res, false, 'Invalid CouponID', null, 400);

        const result = await sql`SELECT * FROM "couponsadvanced" WHERE "CouponID" = ${id}`;
        if (!result.length) return sendResponse(res, false, 'Coupon not found', null, 404);

        const coupon = result[0];
        coupon.StartDate = coupon.StartDate?.toISOString();
        coupon.EndDate = coupon.EndDate?.toISOString();
        coupon.CreatedAt = coupon.CreatedAt?.toISOString();
        coupon.UpdatedAt = coupon.UpdatedAt?.toISOString();

        sendResponse(res, true, 'Coupon retrieved successfully', coupon);
    } catch (err) {
        console.error(err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ---------------------------
// GET /validate/:code?orderAmount=xx
// تحقق سريع بصلاحية الكوبون
// ---------------------------
router.get('/validate/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const orderAmount = parseFloat(req.query.orderAmount || 0);

        const result = await sql`SELECT * FROM "couponsadvanced" WHERE "Code" = ${code}`;
        if (!result.length) return sendResponse(res, false, 'Coupon not found', null, 404);

        const coupon = result[0];
        const now = new Date();

        if (coupon.StartDate && new Date(coupon.StartDate) > now) return sendResponse(res, false, 'Coupon not active yet', null, 400);
        if (coupon.EndDate && new Date(coupon.EndDate) < now) return sendResponse(res, false, 'Coupon expired', null, 400);
        if (coupon.MaxUsage && coupon.MaxUsage > 0 && coupon.UsageCount >= coupon.MaxUsage) return sendResponse(res, false, 'Coupon usage limit reached', null, 400);
        if (coupon.MinOrderAmount && parseFloat(coupon.MinOrderAmount) > orderAmount)
            return sendResponse(res, false, `Minimum orders amount not met. Minimum: ${coupon.MinOrderAmount}`, null, 400);

        coupon.StartDate = coupon.StartDate?.toISOString();
        coupon.EndDate = coupon.EndDate?.toISOString();
        coupon.CreatedAt = coupon.CreatedAt?.toISOString();
        coupon.UpdatedAt = coupon.UpdatedAt?.toISOString();

        sendResponse(res, true, 'Coupon is valid', { coupon });
    } catch (err) {
        console.error(err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ---------------------------
// POST / - إنشاء كوبون جديد (Admin)
// ---------------------------
router.post('/', isAdmin, async (req, res) => {
    try {
        const { Code, DiscountType, DiscountValue, StartDate, EndDate, MinOrderAmount = 0, MaxUsage = 0, Description = null } = req.body;
        if (!Code || !DiscountType || DiscountValue === undefined || !StartDate || !EndDate)
            return sendResponse(res, false, 'Missing required fields', null, 400);

        const exists = await sql`SELECT "CouponID" FROM "couponsadvanced" WHERE "Code" = ${Code.trim()}`;
        if (exists.length) return sendResponse(res, false, 'Coupon code already exists', null, 409);

        await sql`
            INSERT INTO "CouponsAdvanced"
            ("Code","DiscountType","DiscountValue","StartDate","EndDate","MinOrderAmount","MaxUsage","UsageCount","Description","CreatedAt")
            VALUES
            (${Code.trim()}, ${DiscountType}, ${DiscountValue}, ${StartDate}, ${EndDate}, ${MinOrderAmount}, ${MaxUsage}, 0, ${Description}, NOW())
        `;

        sendResponse(res, true, 'CouponAdvanced created successfully');
    } catch (err) {
        console.error(err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ---------------------------
// PUT /:id - تحديث كوبون (Admin)
// ---------------------------
router.put('/:id', isAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const updates = req.body;
        const allowed = ['Code','DiscountType','DiscountValue','StartDate','EndDate','MinOrderAmount','MaxUsage','UsageCount','Description'];
        const fields = Object.keys(updates).filter(k => allowed.includes(k));
        if (!fields.length) return sendResponse(res, false, 'No updatable fields provided', null, 400);

        const couponCheck = await sql`SELECT * FROM "couponsadvanced" WHERE "CouponID" = ${id}`;
        if (!couponCheck.length) return sendResponse(res, false, 'Coupon not found', null, 404);

        if (fields.includes('Code')) {
            const dup = await sql`SELECT "CouponID" FROM "couponsadvanced" WHERE "Code" = ${updates.Code} AND "CouponID" <> ${id}`;
            if (dup.length) return sendResponse(res, false, 'Another coupon with this code exists', null, 409);
        }

        const setClauses = fields.map((f, i) => `"${f}" = $${i+1}`).join(', ');
        const values = fields.map(f => updates[f]);
        await sql`UPDATE "CouponsAdvanced" SET ${sql.raw(setClauses)}, "UpdatedAt" = NOW() WHERE "CouponID" = ${id}`.bind(values);

        sendResponse(res, true, 'CouponAdvanced updated successfully');
    } catch (err) {
        console.error(err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ---------------------------
// PATCH /:id/increment - زيادة UsageCount
// ---------------------------
router.patch('/:id/increment', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return sendResponse(res, false, 'Invalid CouponID', null, 400);

        await sql.begin(async (tx) => {
            const rows = await tx`SELECT * FROM "couponsadvanced" WHERE "CouponID" = ${id} FOR UPDATE`;
            if (!rows.length) throw new Error('Coupon not found');

            const coupon = rows[0];
            const now = new Date();
            if (coupon.StartDate && new Date(coupon.StartDate) > now) throw new Error('Coupon not active yet');
            if (coupon.EndDate && new Date(coupon.EndDate) < now) throw new Error('Coupon expired');
            if (coupon.MaxUsage && coupon.MaxUsage > 0 && coupon.UsageCount >= coupon.MaxUsage) throw new Error('Coupon usage limit reached');

            const newUsage = (coupon.UsageCount || 0) + 1;
            await tx`UPDATE "CouponsAdvanced" SET "UsageCount" = ${newUsage}, "UpdatedAt" = NOW() WHERE "CouponID" = ${id}`;

            sendResponse(res, true, 'Coupon usage incremented successfully', { CouponID: id, UsageCount: newUsage });
        });
    } catch (err) {
        console.error(err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ---------------------------
// DELETE /:id - حذف كوبون (Admin)
// ---------------------------
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return sendResponse(res, false, 'Invalid CouponID', null, 400);

        const exists = await sql`SELECT "CouponID" FROM "couponsadvanced" WHERE "CouponID" = ${id}`;
        if (!exists.length) return sendResponse(res, false, 'Coupon not found', null, 404);

        await sql`DELETE FROM "couponsadvanced" WHERE "CouponID" = ${id}`;
        sendResponse(res, true, 'CouponAdvanced deleted successfully');
    } catch (err) {
        console.error(err);
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
