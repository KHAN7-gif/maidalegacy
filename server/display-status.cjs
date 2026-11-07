// Mount before the existing /api middleware. Returns no customer or payment data.
const express = require('express');
const router = express.Router();
// Public signage projection only. No credentials are accepted from the browser.
router.use((req,res,next)=>{res.set('Access-Control-Allow-Origin','https://khan7-gif.github.io');next();});
const pool = require('./db');
const { COLLECTIONS, joinRecord, parseJsonCol } = require('./nodeMap');
router.get('/status', async (req, res) => {
  try {
    const [configs] = await pool.query('SELECT data FROM kv_blobs WHERE path = ?', ['ps_stations']);
    const stations = configs.length ? parseJsonCol(configs[0].data)?.list : null;
    if (!Array.isArray(stations)) return res.status(503).json({ error: 'stations not configured' });
    const [rows] = await pool.query('SELECT * FROM ps WHERE deleted_at IS NULL');
    const bookings = rows.map(row => joinRecord(row, COLLECTIONS.ps));
    const now = Date.now();
    res.set('Cache-Control', 'no-store');
    res.json({ stations: stations.filter(s => s.active !== false).map(s => {
      const active = bookings.filter(b => String(b.sid) === String(s.id) && b.status === 'a' && new Date(b.st).getTime() <= now && new Date(b.et).getTime() > now);
      const end = Math.max(0, ...active.map(b => new Date(b.et).getTime()));
      return { id: s.id, name: s.name, type: s.type, endsAt: end ? new Date(end).toISOString() : null };
    }) });
  } catch { res.status(503).json({ error: 'status unavailable' }); }
});
module.exports = router;
