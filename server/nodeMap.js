// Maps the Firebase-style path strings the front-end already uses (with the
// leading "mde/" stripped) onto either a relational "collection" table
// (record-per-id, needed for delta polling) or a single JSON "blob" row in
// kv_blobs. Keeping these path strings identical to what index.html already
// sends means the client's ~100 call sites need no path rewriting — only
// the fbGet/fbSet/fbPatch/fbPutRecord/fbPatchRecord/fbDelRecord helper
// bodies change.

const COLLECTIONS = {
  tx: { table: 'tx', fields: ['date', 'type', 'amount', 'category'], blobCol: 'extra' },
  ps: {
    table: 'ps',
    fields: ['sid', 'no', 'date', 'status', 'amt', 'players', 'dur', 'payment', 'st', 'et'],
    blobCol: 'extra',
  },
  gaji_hist: { table: 'gaji_hist', fields: [], blobCol: 'data' },
  syer_hist: { table: 'syer_hist', fields: [], blobCol: 'data' },
  backups: { table: 'backups', fields: [], blobCol: 'data' },
};

const NODE_MAP = {
  tx: { type: 'collection', collection: 'tx' },
  ps: { type: 'collection', collection: 'ps' },
  'gaji/hist': { type: 'collection', collection: 'gaji_hist' },
  'syer/hist': { type: 'collection', collection: 'syer_hist' },
  backup: { type: 'collection', collection: 'backups' },

  meta: { type: 'blob', key: 'meta' },
  users: { type: 'blob', key: 'users' },
  ps_meta: { type: 'blob', key: 'ps_meta' },
  ps_stations: { type: 'blob', key: 'ps_stations' },
  ps_colors: { type: 'blob', key: 'ps_colors' },
  'psbooking/rates': { type: 'blob', key: 'psbooking_rates' },
  psbooking: { type: 'blob', key: 'psbooking_legacy' },
  modules: { type: 'blob', key: 'modules' },
  docs: { type: 'blob', key: 'docs' },
  gaji: { type: 'blob', key: 'gaji' },
  staff: { type: 'blob', key: 'staff' },
  core: { type: 'blob', key: 'core' },
  'syer/cfg': { type: 'blob', key: 'syer_cfg' },
};

// Longest-prefix match so node keys containing "/" (e.g. "gaji/hist",
// "psbooking/rates") are matched before shorter keys, and so a trailing
// "/<id>" or "/_changes" segment is correctly split off as `rest`.
function resolveNode(fullPath) {
  const keys = Object.keys(NODE_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (fullPath === key) return { key, rest: '' };
    if (fullPath.startsWith(key + '/')) return { key, rest: fullPath.slice(key.length + 1) };
  }
  return null;
}

// Splits a client-sent record into its named columns plus a catch-all blob
// of everything else, so unrecognized/future fields are never dropped.
function splitRecord(record, cfg) {
  const cols = {};
  const blob = { ...record };
  delete blob.id;
  cfg.fields.forEach(f => {
    cols[f] = record[f] !== undefined && record[f] !== null ? record[f] : null;
    delete blob[f];
  });
  return { cols, blob };
}

// Reassembles a full record (as the client expects it) from a DB row.
function joinRecord(row, cfg) {
  const blob = parseJsonCol(row[cfg.blobCol]) || {};
  const record = { ...blob, id: row.id };
  cfg.fields.forEach(f => {
    if (row[f] !== null && row[f] !== undefined) record[f] = row[f];
  });
  return record;
}

// mysql2 auto-parses JSON columns into objects already; only parse if the
// driver/config ever hands back a raw string instead.
function parseJsonCol(val) {
  if (val === null || val === undefined) return null;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

module.exports = { NODE_MAP, COLLECTIONS, resolveNode, splitRecord, joinRecord, parseJsonCol };
