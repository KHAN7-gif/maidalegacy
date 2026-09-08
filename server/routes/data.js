// Generic Firebase-REST-shaped API: GET/PUT/PATCH/DELETE over the paths
// defined in nodeMap.js, plus a "/_changes?since=" delta endpoint used by
// the front-end's polling-based replacement for Firebase's SSE stream.
const express = require('express');
const pool = require('../db');
const { NODE_MAP, COLLECTIONS, resolveNode, splitRecord, joinRecord, parseJsonCol } = require('../nodeMap');

const router = express.Router();

router.get('/_ping', (req, res) => res.json({ ok: true, time: Date.now() }));

router.all('*', async (req, res) => {
  const fullPath = req.path.replace(/^\/+/, '');
  const match = resolveNode(fullPath);
  if (!match) return res.status(404).json({ error: 'unknown node: ' + fullPath });
  const node = NODE_MAP[match.key];

  try {
    if (node.type === 'blob') return await handleBlob(req, res, node, match.rest);
    return await handleCollection(req, res, node, match.rest);
  } catch (e) {
    console.error('[api]', req.method, fullPath, e);
    res.status(500).json({ error: 'internal error' });
  }
});

async function handleBlob(req, res, node, rest) {
  const key = node.key;

  if (rest === '_changes') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
    const since = Number(req.query.since || 0);
    const [rows] = await pool.query('SELECT data, updated_at FROM kv_blobs WHERE path = ?', [key]);
    const server_time = Date.now();
    if (!rows.length) return res.json({ changed: false, data: null, updated_at: 0, server_time });
    const changed = rows[0].updated_at > since;
    return res.json({
      changed,
      data: changed ? parseJsonCol(rows[0].data) : undefined,
      updated_at: rows[0].updated_at,
      server_time,
    });
  }

  if (rest !== '') return res.status(404).json({ error: 'not found' });

  if (req.method === 'GET') {
    const [rows] = await pool.query('SELECT data FROM kv_blobs WHERE path = ?', [key]);
    return res.json(rows.length ? parseJsonCol(rows[0].data) : null);
  }
  if (req.method === 'PUT') {
    await upsertBlob(key, req.body || {});
    return res.json({ ok: true });
  }
  if (req.method === 'PATCH') {
    const [rows] = await pool.query('SELECT data FROM kv_blobs WHERE path = ?', [key]);
    const current = rows.length ? parseJsonCol(rows[0].data) : {};
    await upsertBlob(key, { ...current, ...(req.body || {}) });
    return res.json({ ok: true });
  }
  return res.status(405).json({ error: 'method not allowed' });
}

async function upsertBlob(key, data) {
  await pool.query(
    'INSERT INTO kv_blobs (path, data, updated_at) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)',
    [key, JSON.stringify(data), Date.now()]
  );
}

async function handleCollection(req, res, node, rest) {
  const cfg = COLLECTIONS[node.collection];
  const table = cfg.table;

  if (rest === '_changes') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
    const since = Number(req.query.since || 0);
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE updated_at > ?`, [since]);
    return res.json({
      rows: rows.map(row => ({
        id: row.id,
        data: row.deleted_at ? null : joinRecord(row, cfg),
        updated_at: row.updated_at,
      })),
      server_time: Date.now(),
    });
  }

  if (rest === '') {
    if (req.method === 'GET') {
      const [rows] = await pool.query(`SELECT * FROM ${table} WHERE deleted_at IS NULL`);
      const out = {};
      rows.forEach(row => {
        out[row.id] = joinRecord(row, cfg);
      });
      return res.json(out);
    }
    if (req.method === 'PATCH') {
      for (const [id, value] of Object.entries(req.body || {})) {
        await upsertOrDelete(table, cfg, id, value);
      }
      return res.json({ ok: true });
    }
    if (req.method === 'PUT') {
      // Full-collection replace. No current front-end call site does this
      // (writes always go through PATCH-by-map or PUT-by-id), implemented
      // for parity with Firebase's fbSet on a collection path.
      const now = Date.now();
      await pool.query(`UPDATE ${table} SET deleted_at = ? WHERE deleted_at IS NULL`, [now]);
      for (const [id, value] of Object.entries(req.body || {})) {
        await upsertOrDelete(table, cfg, id, value);
      }
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  }

  // rest is a single record id (ids never contain "/", see _fbKey in index.html)
  const id = rest;
  if (req.method === 'GET') {
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`, [id]);
    return res.json(rows.length ? joinRecord(rows[0], cfg) : null);
  }
  if (req.method === 'PUT') {
    await upsertOrDelete(table, cfg, id, req.body);
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    await pool.query(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`, [Date.now(), id]);
    return res.json({ ok: true });
  }
  return res.status(405).json({ error: 'method not allowed' });
}

async function upsertOrDelete(table, cfg, id, value) {
  const now = Date.now();
  if (value === null || value === undefined) {
    await pool.query(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`, [now, id]);
    return;
  }
  const { cols, blob } = splitRecord({ ...value, id }, cfg);
  const colNames = ['id', ...cfg.fields, cfg.blobCol, 'updated_at', 'deleted_at'];
  const colValues = [id, ...cfg.fields.map(f => cols[f]), JSON.stringify(blob), now, null];
  const placeholders = colNames.map(() => '?').join(', ');
  const updates = colNames
    .filter(c => c !== 'id')
    .map(c => `${c} = VALUES(${c})`)
    .join(', ');
  await pool.query(
    `INSERT INTO ${table} (${colNames.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
    colValues
  );
}

module.exports = router;
