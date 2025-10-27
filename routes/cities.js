const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');

// 🧩 دالة مساعدة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({
    success,
    message,
    timestamp: new Date(),
    data
  });
}

// 📍 جلب جميع المدن (مع بحث + Pagination)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const pool = await poolPromise;
    const request = pool.request();
    let whereClause = '';

    if (search) {
      request.input('Search', `%${search}%`);
      whereClause = 'WHERE CityName LIKE @Search';
    }

    const query = `
      SELECT CityID, CityName, CreatedAt
      FROM Cities
      ${whereClause}
      ORDER BY CityName ASC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `;

    const result = await request.query(query);
    sendResponse(res, true, 'Cities retrieved successfully', {
      count: result.recordset.length,
      cities: result.recordset
    });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// 📍 إضافة مدينة جديدة
router.post('/', async (req, res) => {
  try {
    const { CityName } = req.body;

    if (!CityName || CityName.trim() === '') {
      return sendResponse(res, false, 'CityName is required', null, 400);
    }

    const pool = await poolPromise;
    const request = pool.request().input('CityName', CityName.trim());

    // 🔍 تحقق من التكرار
    const check = await request.query('SELECT CityID FROM Cities WHERE CityName=@CityName');
    if (check.recordset.length > 0) {
      return sendResponse(res, false, 'City already exists', null, 409);
    }

    await pool.request()
      .input('CityName', CityName.trim())
      .query('INSERT INTO Cities (CityName, CreatedAt) VALUES (@CityName, GETDATE())');

    sendResponse(res, true, 'City added successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// 📍 تعديل مدينة موجودة
router.put('/:id', async (req, res) => {
  try {
    const { CityName } = req.body;
    const { id } = req.params;

    if (!CityName || CityName.trim() === '') {
      return sendResponse(res, false, 'CityName is required', null, 400);
    }

    const pool = await poolPromise;
    const request = pool.request().input('CityID', id);

    // تحقق من وجود المدينة
    const check = await request.query('SELECT * FROM Cities WHERE CityID=@CityID');
    if (check.recordset.length === 0) {
      return sendResponse(res, false, 'City not found', null, 404);
    }

    // تحقق من وجود اسم مكرر
    const dupCheck = await pool.request()
      .input('CityName', CityName.trim())
      .query('SELECT CityID FROM Cities WHERE CityName=@CityName AND CityID<>@CityID');

    if (dupCheck.recordset.length > 0) {
      return sendResponse(res, false, 'Another city with this name already exists', null, 409);
    }

    await pool.request()
      .input('CityID', id)
      .input('CityName', CityName.trim())
      .query('UPDATE Cities SET CityName=@CityName, UpdatedAt=GETDATE() WHERE CityID=@CityID');

    sendResponse(res, true, 'City updated successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// 📍 حذف مدينة
router.delete('/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;

    // تحقق من وجود المدينة
    const check = await pool.request().input('CityID', id).query('SELECT * FROM Cities WHERE CityID=@CityID');
    if (check.recordset.length === 0) {
      return sendResponse(res, false, 'City not found', null, 404);
    }

    // تحقق من ارتباط المدينة بمناطق قبل الحذف
    const areaCheck = await pool.request().input('CityID', id).query('SELECT COUNT(*) AS Total FROM Areas WHERE CityID=@CityID');
    if (areaCheck.recordset[0].Total > 0) {
      return sendResponse(res, false, 'Cannot delete city with linked areas', null, 400);
    }

    await pool.request().input('CityID', id).query('DELETE FROM Cities WHERE CityID=@CityID');
    sendResponse(res, true, 'City deleted successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
