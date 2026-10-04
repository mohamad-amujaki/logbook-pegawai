PRAGMA foreign_keys = ON;

CREATE TABLE pemetaan_email_kehadiran (
  email TEXT PRIMARY KEY,
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE integrasi_kehadiran (
  id TEXT PRIMARY KEY,
  kunci_idempotensi TEXT NOT NULL UNIQUE,
  catatan_harian_id TEXT REFERENCES catatan_harian(id),
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id),
  kode_rapat TEXT NOT NULL,
  peserta_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX integrasi_kehadiran_catatan_idx ON integrasi_kehadiran(catatan_harian_id);
