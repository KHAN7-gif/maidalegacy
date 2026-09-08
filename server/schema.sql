-- MDE Finance Pro — MySQL schema
-- Replaces the Firebase Realtime Database tree that lived under `mde/`.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + an idempotent seed insert.

CREATE TABLE IF NOT EXISTS tx (
  id          VARCHAR(40)   PRIMARY KEY,
  date        DATE          NULL,
  type        VARCHAR(20)   NOT NULL DEFAULT 'income',
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  category    VARCHAR(100)  NOT NULL DEFAULT 'Lain-lain',
  extra       JSON          NULL,
  updated_at  BIGINT        NOT NULL,
  deleted_at  BIGINT        NULL,
  INDEX idx_tx_updated (updated_at),
  INDEX idx_tx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ps (
  id          VARCHAR(40)   PRIMARY KEY,
  sid         INT           NULL,
  no          INT           NULL,
  date        DATE          NULL,
  status      VARCHAR(20)   NULL,
  amt         DECIMAL(12,2) NULL,
  players     INT           NULL,
  dur         INT           NULL,
  payment     VARCHAR(20)   NULL,
  st          VARCHAR(32)   NULL,
  et          VARCHAR(32)   NULL,
  extra       JSON          NULL,
  updated_at  BIGINT        NOT NULL,
  deleted_at  BIGINT        NULL,
  INDEX idx_ps_updated (updated_at),
  INDEX idx_ps_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gaji_hist (
  id          VARCHAR(40)   PRIMARY KEY,
  data        JSON          NOT NULL,
  updated_at  BIGINT        NOT NULL,
  deleted_at  BIGINT        NULL,
  INDEX idx_gaji_hist_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS syer_hist (
  id          VARCHAR(40)   PRIMARY KEY,
  data        JSON          NOT NULL,
  updated_at  BIGINT        NOT NULL,
  deleted_at  BIGINT        NULL,
  INDEX idx_syer_hist_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- mde/backup/{key} — hourly backup snapshots, written once, rarely read.
CREATE TABLE IF NOT EXISTS backups (
  id          VARCHAR(40)   PRIMARY KEY,
  data        JSON          NOT NULL,
  updated_at  BIGINT        NOT NULL,
  deleted_at  BIGINT        NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Everything else that was always read/written as a single JSON blob node.
CREATE TABLE IF NOT EXISTS kv_blobs (
  path        VARCHAR(64)   PRIMARY KEY,
  data        JSON          NOT NULL,
  updated_at  BIGINT        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO kv_blobs (path, data, updated_at) VALUES
  ('meta',              '{}',            0),
  ('users',             '{"list":[]}',   0),
  ('ps_meta',           '{}',            0),
  ('ps_stations',       '{"list":[]}',   0),
  ('ps_colors',         '{}',            0),
  ('psbooking_rates',   '{}',            0),
  ('psbooking_legacy',  '{}',            0),
  ('modules',           '{}',            0),
  ('docs',              '{}',            0),
  ('gaji',              '{}',            0),
  ('staff',             '{}',            0),
  ('core',              '{}',            0),
  ('syer_cfg',          '{}',            0)
ON DUPLICATE KEY UPDATE path = path;
