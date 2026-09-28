PRAGMA foreign_keys = ON;

CREATE TABLE akun (
  id TEXT PRIMARY KEY,
  pegawai_id TEXT NOT NULL UNIQUE REFERENCES pegawai(id),
  password_hash TEXT NOT NULL,
  wajib_ganti_sandi INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'AKTIF',
  terakhir_login_pada TEXT,
  ditangguhkan_pada TEXT,
  ditangguhkan_oleh_id TEXT REFERENCES akun(id),
  alasan_penangguhan TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE akun_peran (
  id TEXT PRIMARY KEY,
  akun_id TEXT NOT NULL REFERENCES akun(id),
  peran TEXT NOT NULL,
  unit_kerja_id TEXT REFERENCES unit_kerja(id),
  diberikan_oleh_id TEXT REFERENCES akun(id),
  created_at TEXT NOT NULL,
  UNIQUE (akun_id, peran, unit_kerja_id)
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  aktor_akun_id TEXT REFERENCES akun(id),
  target_akun_id TEXT REFERENCES akun(id),
  aksi TEXT NOT NULL,
  alasan TEXT,
  sebelum_json TEXT,
  sesudah_json TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL
);

ALTER TABLE pegawai ADD COLUMN status TEXT NOT NULL DEFAULT 'aktif';
ALTER TABLE sesi ADD COLUMN akun_id TEXT REFERENCES akun(id);
ALTER TABLE sesi ADD COLUMN dicabut_pada TEXT;
ALTER TABLE catatan_harian ADD COLUMN diajukan_pada TEXT;
ALTER TABLE catatan_harian ADD COLUMN unit_kerja_id_snapshot TEXT REFERENCES unit_kerja(id);
ALTER TABLE catatan_harian ADD COLUMN tim_kerja_id_snapshot TEXT REFERENCES tim_kerja(id);

INSERT INTO akun (
  id, pegawai_id, password_hash, wajib_ganti_sandi, status, created_at, updated_at
)
SELECT
  id, id, password_hash, wajib_ganti_sandi, 'AKTIF', created_at, updated_at
FROM pegawai;

INSERT INTO akun_peran (id, akun_id, peran, unit_kerja_id, created_at)
SELECT id || ':ADMIN', id, 'ADMIN', NULL, updated_at
FROM pegawai
WHERE is_admin = 1;

INSERT INTO akun_peran (id, akun_id, peran, unit_kerja_id, created_at)
SELECT id || ':KEPALA_BIRO', id, 'KEPALA_BIRO', unit_kerja_id, updated_at
FROM pegawai
WHERE is_kepala_biro = 1;

UPDATE sesi SET akun_id = pegawai_id;
UPDATE catatan_harian
SET unit_kerja_id_snapshot = (
  SELECT p.unit_kerja_id FROM pegawai p WHERE p.id = catatan_harian.pegawai_id
),
tim_kerja_id_snapshot = (
  SELECT p.tim_kerja_id FROM pegawai p WHERE p.id = catatan_harian.pegawai_id
);

CREATE INDEX akun_status_idx ON akun(status);
CREATE INDEX akun_peran_akun_idx ON akun_peran(akun_id);
CREATE INDEX akun_peran_unit_idx ON akun_peran(unit_kerja_id);
CREATE INDEX audit_log_target_idx ON audit_log(target_akun_id, created_at);
CREATE INDEX sesi_akun_idx ON sesi(akun_id, berakhir_pada);
CREATE INDEX catatan_pegawai_tanggal_idx ON catatan_harian(pegawai_id, tanggal);
CREATE INDEX catatan_status_tanggal_idx ON catatan_harian(status, tanggal);
CREATE INDEX pegawai_unit_tim_idx ON pegawai(unit_kerja_id, tim_kerja_id);
CREATE UNIQUE INDEX skp_pegawai_tahun_unique ON skp(pegawai_id, tahun);
