
// routes/stores.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { supabase } = require('../supabase');
const crypto = require('crypto');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stores ORDER BY createdat DESC LIMIT 50;');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body;

    
    const otp = generateOTP();
    const plainPassword = body.password ? body.password : generateRandomPassword(8); const password = makeStoredPassword(plainPassword);

    let photoUrl = null;
    if (body.photoBase64) photoUrl = await uploadPhoto('stores', Date.now(), body.photoBase64);

    const columns = [];
    const values = [];
    const params = [];
    let i = 1;
    for (let key in body) { if (key !== 'photoBase64') { columns.push(key); values.push(body[key]); params.push('$' + i); i++; } }
    if (photoUrl) { columns.push('photourl'); values.push(photoUrl); params.push('$' + i); i++; }
    
    columns.push('otp'); values.push(otp); params.push('$'+i); i++;
    columns.push('password'); values.push(password); params.push('$'+i); i++;

    const q = `INSERT INTO stores (${columns.join(',')}) VALUES (${params.join(',')}) RETURNING *;`;
    const result = await pool.query(q, values);
    const data = result.rows[0];
    if (data.password) delete data.password;

    res.json({ success: true, data, plainPassword, });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    for (let key in body) { if (key !== 'photoBase64') { updates.push(key + '=$' + i); values.push(body[key]); i++; } }
    if (body.photoBase64) { const url = await uploadPhoto('stores', id, body.photoBase64); updates.push('photourl=$' + i); values.push(url); i++; }
    const q = `UPDATE stores SET ${updates.join(',')}, lastupdated=NOW() WHERE id=${i} RETURNING *;`;
    values.push(id);
    const result = await pool.query(q, values);
    const data = result.rows[0];
    if (data.password) delete data.password;
    res.json({ success: true, data });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('DELETE FROM stores WHERE id=$1 RETURNING *;', [id]);
    const data = result.rows[0];
    res.json({ success: true, data });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

// Helpers
function generateOTP() { return String(Math.floor(Math.random()*1000000)).padStart(6,'0'); }
function generateRandomPassword(len=8){ const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&@#$%'; const buf=crypto.randomBytes(len); let pw=letters[buf[0]%letters.length]; for(let i=1;i<len;i++) pw+=chars[buf[i]%chars.length]; return pw; }
function generateDriverID(){ return 'RTD-'+String(Math.floor(Math.random()*1000000)).padStart(7,'0'); }
function makeStoredPassword(pw){ const salt=crypto.randomBytes(16).toString('base64'); const hash=crypto.createHash('sha256').update(salt+pw,'utf8').digest('hex'); return `${salt}:${hash}`; }
async function uploadPhoto(table,id,base64){ if(!base64) return null; const buf=Buffer.from(base64,'base64'); const objPath=`${table}/${id}-${Date.now()}.jpg`; const {data,error}=await supabase.storage.from(table).upload(objPath,buf,{upsert:true}); if(error) throw error; const {data:urlData}=supabase.storage.from(table).getPublicUrl(objPath); return urlData.publicUrl; }
