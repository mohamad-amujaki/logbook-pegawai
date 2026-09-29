PRAGMA foreign_keys = ON;

ALTER TABLE catatan_harian ADD COLUMN divalidasi_otomatis INTEGER NOT NULL DEFAULT 0;

CREATE INDEX catatan_status_diajukan_idx ON catatan_harian(status, diajukan_pada);
