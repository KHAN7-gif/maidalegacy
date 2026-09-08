// One-off script: exports the live Firebase Realtime Database tree and
// imports it into the MySQL schema created by schema.sql. Idempotent
// (upserts by primary key) — safe to run into a staging DB first, then
// re-run for the real cutover. Run with: npm run migrate
require('dotenv').config();
const pool = require('./db');
const { COLLECTIONS, splitRecord } = require('./nodeMap');

const FIREBASE_URL = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');

async function main() {
  if (!FIREBASE_URL) throw new Error('Set FIREBASE_DATABASE_URL in .env before running the migration.');

  console.log('Fetching full export from', FIREBASE_URL);
  const res = await fetch(`${FIREBASE_URL}/mde.json`);
  if (!res.ok) throw new Error(`Firebase export failed: ${res.status} ${await res.text()}`);
  const root = (await res.json()) || {};

  const counts = {};

  await migrateCollection('tx', root.tx, counts);
  await migrateCollection('ps', root.ps, counts);
  await migrateCollection('gaji_hist', root.gaji && root.gaji.hist, counts);
  await migrateCollection('syer_hist', root.syer && root.syer.hist, counts);
  await migrateCollection('backups', root.backup, counts);

  await migrateBlob('meta', root.meta, counts);
  await migrateBlob('users', root.users, counts);
  await migrateBlob('ps_meta', root.ps_meta, counts);
  await migrateBlob('ps_stations', root.ps_stations, counts);
  await migrateBlob('ps_colors', root.ps_colors, counts);
  await migrateBlob('psbooking_rates', root.psbooking && root.psbooking.rates, counts);
  await migrateBlob('psbooking_legacy', root.psbooking, counts);
  await migrateBlob('modules', root.modules, counts);
  await migrateBlob('docs', root.docs, counts);
  await migrateBlob('gaji', root.gaji, counts);
  await migrateBlob('staff', root.staff, counts);
  await migrateBlob('core', root.core, counts);
  await migrateBlob('syer_cfg', root.syer && root.syer.cfg, counts);

  console.log('\nMigration summary (compare against Firebase Console child counts):');
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  await pool.end();
}

async function migrateCollection(name, obj, counts) {
  const cfg = COLLECTIONS[name];
  const table = cfg.table;
  const entries = Object.entries(obj || {});
  let n = 0;
  for (const [id, record] of entries) {
    if (!record || typeof record !== 'object') continue;
    const updatedAt = Number(record._updatedAt || record._ts || record.ts || Date.now());
    const { cols, blob } = splitRecord({ ...record, id }, cfg);
    const colNames = ['id', ...cfg.fields, cfg.blobCol, 'updated_at', 'deleted_at'];
    const colValues = [id, ...cfg.fields.map(f => cols[f]), JSON.stringify(blob), updatedAt, null];
    const placeholders = colNames.map(() => '?').join(', ');
    const updates = colNames
      .filter(c => c !== 'id')
      .map(c => `${c} = VALUES(${c})`)
      .join(', ');
    await pool.query(
      `INSERT INTO ${table} (${colNames.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
      colValues
    );
    n++;
  }
  counts[name] = n;
}

async function migrateBlob(key, data, counts) {
  if (data === undefined) data = null;
  await pool.query(
    'INSERT INTO kv_blobs (path, data, updated_at) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)',
    [key, JSON.stringify(data === null ? {} : data), Date.now()]
  );
  counts[key] = data === null ? '(empty, kept default)' : '1 blob';
}

main()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\nMigration failed:', err);
    process.exit(1);
  });
