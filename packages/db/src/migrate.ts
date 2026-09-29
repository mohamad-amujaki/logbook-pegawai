import { resolve } from "node:path";
import { Database } from "bun:sqlite";

const defaultFile = resolve(import.meta.dir, "../../../local.db");
const file = (process.env.DATABASE_URL ?? `file:${defaultFile}`).replace(/^file:/, "");
const sqlite = new Database(file, { create: true });
sqlite.exec("PRAGMA foreign_keys = ON;");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS unit_kerja (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  induk_id TEXT REFERENCES unit_kerja(id),
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tim_kerja (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  unit_kerja_id TEXT NOT NULL REFERENCES unit_kerja(id),
  status TEXT NOT NULL DEFAULT 'aktif',
  urutan INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pegawai (
  id TEXT PRIMARY KEY,
  nip TEXT NOT NULL UNIQUE,
  nama_lengkap TEXT NOT NULL,
  pangkat_golongan TEXT NOT NULL,
  tmt TEXT,
  jabatan TEXT NOT NULL,
  unit_kerja_id TEXT NOT NULL REFERENCES unit_kerja(id),
  tim_kerja_id TEXT REFERENCES tim_kerja(id),
  status TEXT NOT NULL DEFAULT 'aktif',
  password_hash TEXT NOT NULL,
  wajib_ganti_sandi INTEGER NOT NULL DEFAULT 1,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_kepala_biro INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS akun (
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
CREATE TABLE IF NOT EXISTS akun_peran (
  id TEXT PRIMARY KEY,
  akun_id TEXT NOT NULL REFERENCES akun(id),
  peran TEXT NOT NULL,
  unit_kerja_id TEXT REFERENCES unit_kerja(id),
  diberikan_oleh_id TEXT REFERENCES akun(id),
  created_at TEXT NOT NULL,
  UNIQUE (akun_id, peran, unit_kerja_id)
);
CREATE TABLE IF NOT EXISTS sesi (
  id TEXT PRIMARY KEY,
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id),
  akun_id TEXT REFERENCES akun(id),
  berakhir_pada TEXT NOT NULL,
  dicabut_pada TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS produk (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  kode_proses_l1 TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tahapan (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  produk_id TEXT NOT NULL REFERENCES produk(id),
  urutan INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS aktivitas (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  tahapan_id TEXT NOT NULL REFERENCES tahapan(id),
  uraian TEXT,
  norma_waktu_menit INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS skp (
  id TEXT PRIMARY KEY,
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id),
  tahun INTEGER NOT NULL,
  pemberi_pertimbangan_id TEXT REFERENCES pegawai(id),
  pejabat_penilai_id TEXT REFERENCES pegawai(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rhk_pimpinan (
  id TEXT PRIMARY KEY,
  skp_id TEXT NOT NULL REFERENCES skp(id),
  uraian TEXT NOT NULL,
  urutan INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rhk (
  id TEXT PRIMARY KEY,
  rhk_pimpinan_id TEXT NOT NULL REFERENCES rhk_pimpinan(id),
  uraian TEXT NOT NULL,
  aspek TEXT NOT NULL,
  indikator TEXT NOT NULL,
  target_tahunan TEXT NOT NULL,
  satuan TEXT,
  urutan INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS iki (
  id TEXT PRIMARY KEY,
  rhk_id TEXT NOT NULL REFERENCES rhk(id),
  aspek TEXT NOT NULL,
  indikator TEXT NOT NULL,
  target_tahunan TEXT NOT NULL,
  satuan TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT 'CORE',
  bobot INTEGER NOT NULL DEFAULT 0,
  urutan INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rencana_aksi (
  id TEXT PRIMARY KEY,
  rhk_id TEXT NOT NULL REFERENCES rhk(id),
  iki_id TEXT REFERENCES iki(id),
  uraian TEXT NOT NULL,
  satuan TEXT NOT NULL DEFAULT '',
  target_tw1 INTEGER NOT NULL DEFAULT 0,
  target_tw2 INTEGER NOT NULL DEFAULT 0,
  target_tw3 INTEGER NOT NULL DEFAULT 0,
  target_tw4 INTEGER NOT NULL DEFAULT 0,
  akumulasi INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS catatan_harian (
  id TEXT PRIMARY KEY,
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id),
  tanggal TEXT NOT NULL,
  jenis_tugas TEXT NOT NULL,
  produk_id TEXT REFERENCES produk(id),
  tahapan_id TEXT REFERENCES tahapan(id),
  aktivitas_id TEXT REFERENCES aktivitas(id),
  iki_id TEXT REFERENCES iki(id),
  rencana_aksi_id TEXT REFERENCES rencana_aksi(id),
  isi_manual INTEGER NOT NULL DEFAULT 0,
  nama_manual_produk TEXT,
  nama_manual_tahapan TEXT,
  usulan_norma_waktu INTEGER,
  uraian TEXT NOT NULL,
  waktu_mulai TEXT NOT NULL,
  waktu_selesai TEXT NOT NULL,
  menit_efektif INTEGER NOT NULL,
  jumlah_output INTEGER NOT NULL,
  satuan_output TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'BIASA',
  bukti_url TEXT,
  bukti_judul TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  catatan_validasi TEXT,
  divalidasi_oleh_id TEXT REFERENCES pegawai(id),
  divalidasi_pada TEXT,
  diajukan_pada TEXT,
  unit_kerja_id_snapshot TEXT REFERENCES unit_kerja(id),
  tim_kerja_id_snapshot TEXT REFERENCES tim_kerja(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pin_katalog (
  id TEXT PRIMARY KEY,
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id),
  jenis TEXT NOT NULL,
  produk_id TEXT NOT NULL REFERENCES produk(id),
  tahapan_id TEXT REFERENCES tahapan(id),
  aktivitas_id TEXT REFERENCES aktivitas(id),
  kunci TEXT NOT NULL,
  urutan INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (pegawai_id, kunci)
);
CREATE INDEX IF NOT EXISTS pin_katalog_pegawai ON pin_katalog(pegawai_id);
CREATE TABLE IF NOT EXISTS usulan_katalog (
  id TEXT PRIMARY KEY,
  catatan_harian_id TEXT NOT NULL REFERENCES catatan_harian(id),
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id),
  nama_produk TEXT NOT NULL,
  nama_tahapan TEXT NOT NULL,
  norma_waktu INTEGER,
  status TEXT NOT NULL DEFAULT 'MENUNGGU',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifikasi (
  id TEXT PRIMARY KEY,
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id),
  judul TEXT NOT NULL,
  isi TEXT NOT NULL,
  tautan TEXT,
  dibaca INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
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
`);

const kolomTim = sqlite.prepare("PRAGMA table_info(tim_kerja)").all() as { name: string }[];
if (!kolomTim.some((k) => k.name === "ketua_pegawai_id")) {
	sqlite.exec("ALTER TABLE tim_kerja ADD COLUMN ketua_pegawai_id TEXT REFERENCES pegawai(id)");
}

const kolomAksi = sqlite.prepare("PRAGMA table_info(rencana_aksi)").all() as { name: string }[];
if (!kolomAksi.some((k) => k.name === "iki_id")) {
	sqlite.exec("ALTER TABLE rencana_aksi ADD COLUMN iki_id TEXT REFERENCES iki(id)");
}

const kolomSkp = sqlite.prepare("PRAGMA table_info(skp)").all() as { name: string }[];
if (!kolomSkp.some((k) => k.name === "atasan_pejabat_penilai_id")) {
	sqlite.exec("ALTER TABLE skp ADD COLUMN atasan_pejabat_penilai_id TEXT REFERENCES pegawai(id)");
}

if (!kolomAksi.some((k) => k.name === "satuan")) {
	sqlite.exec("ALTER TABLE rencana_aksi ADD COLUMN satuan TEXT NOT NULL DEFAULT ''");
}

if (!kolomAksi.some((k) => k.name === "akumulasi")) {
	sqlite.exec("ALTER TABLE rencana_aksi ADD COLUMN akumulasi INTEGER NOT NULL DEFAULT 0");
}

const kolomCatatan = sqlite.prepare("PRAGMA table_info(catatan_harian)").all() as {
	name: string;
}[];
if (!kolomCatatan.some((k) => k.name === "iki_id")) {
	sqlite.exec("ALTER TABLE catatan_harian ADD COLUMN iki_id TEXT REFERENCES iki(id)");
}
if (!kolomCatatan.some((k) => k.name === "rencana_aksi_id")) {
	sqlite.exec(
		"ALTER TABLE catatan_harian ADD COLUMN rencana_aksi_id TEXT REFERENCES rencana_aksi(id)",
	);
}
if (!kolomCatatan.some((k) => k.name === "diajukan_pada")) {
	sqlite.exec("ALTER TABLE catatan_harian ADD COLUMN diajukan_pada TEXT");
}
if (!kolomCatatan.some((k) => k.name === "unit_kerja_id_snapshot")) {
	sqlite.exec(
		"ALTER TABLE catatan_harian ADD COLUMN unit_kerja_id_snapshot TEXT REFERENCES unit_kerja(id)",
	);
}
if (!kolomCatatan.some((k) => k.name === "tim_kerja_id_snapshot")) {
	sqlite.exec(
		"ALTER TABLE catatan_harian ADD COLUMN tim_kerja_id_snapshot TEXT REFERENCES tim_kerja(id)",
	);
}
if (!kolomCatatan.some((k) => k.name === "divalidasi_otomatis")) {
	sqlite.exec(
		"ALTER TABLE catatan_harian ADD COLUMN divalidasi_otomatis INTEGER NOT NULL DEFAULT 0",
	);
}

const kolomUnit = sqlite.prepare("PRAGMA table_info(unit_kerja)").all() as { name: string }[];
if (!kolomUnit.some((k) => k.name === "induk_id")) {
	sqlite.exec("ALTER TABLE unit_kerja ADD COLUMN induk_id TEXT REFERENCES unit_kerja(id)");
}
if (!kolomUnit.some((k) => k.name === "status")) {
	sqlite.exec("ALTER TABLE unit_kerja ADD COLUMN status TEXT NOT NULL DEFAULT 'aktif'");
}

const now = new Date().toISOString();
const setjen = sqlite.prepare("SELECT id FROM unit_kerja WHERE id = 'unit_setjen'").get() as {
	id: string;
} | null;
if (!setjen) {
	sqlite
		.prepare(
			"INSERT INTO unit_kerja (id, kode, nama, induk_id, status, created_at, updated_at) VALUES (?, ?, ?, NULL, 'aktif', ?, ?)",
		)
		.run("unit_setjen", "SETJEN", "Sekretariat Jenderal", now, now);
}
sqlite.exec(
	"UPDATE unit_kerja SET induk_id = 'unit_setjen' WHERE induk_id IS NULL AND id != 'unit_setjen'",
);

const kolomPegawai = sqlite.prepare("PRAGMA table_info(pegawai)").all() as { name: string }[];
if (!kolomPegawai.some((k) => k.name === "status")) {
	sqlite.exec("ALTER TABLE pegawai ADD COLUMN status TEXT NOT NULL DEFAULT 'aktif'");
}

const kolomSesi = sqlite.prepare("PRAGMA table_info(sesi)").all() as { name: string }[];
if (!kolomSesi.some((k) => k.name === "akun_id")) {
	sqlite.exec("ALTER TABLE sesi ADD COLUMN akun_id TEXT REFERENCES akun(id)");
}
if (!kolomSesi.some((k) => k.name === "dicabut_pada")) {
	sqlite.exec("ALTER TABLE sesi ADD COLUMN dicabut_pada TEXT");
}

sqlite.exec(`
INSERT OR IGNORE INTO akun (
  id, pegawai_id, password_hash, wajib_ganti_sandi, status, created_at, updated_at
)
SELECT id, id, password_hash, wajib_ganti_sandi, 'AKTIF', created_at, updated_at
FROM pegawai;
INSERT OR IGNORE INTO akun_peran (id, akun_id, peran, unit_kerja_id, created_at)
SELECT id || ':ADMIN', id, 'ADMIN', NULL, updated_at FROM pegawai WHERE is_admin = 1;
INSERT OR IGNORE INTO akun_peran (id, akun_id, peran, unit_kerja_id, created_at)
SELECT id || ':KEPALA_BIRO', id, 'KEPALA_BIRO', unit_kerja_id, updated_at
FROM pegawai WHERE is_kepala_biro = 1;
UPDATE sesi SET akun_id = pegawai_id WHERE akun_id IS NULL;
UPDATE catatan_harian
SET unit_kerja_id_snapshot = (
  SELECT p.unit_kerja_id FROM pegawai p WHERE p.id = catatan_harian.pegawai_id
)
WHERE unit_kerja_id_snapshot IS NULL;
UPDATE catatan_harian
SET tim_kerja_id_snapshot = (
  SELECT p.tim_kerja_id FROM pegawai p WHERE p.id = catatan_harian.pegawai_id
)
WHERE tim_kerja_id_snapshot IS NULL;
CREATE INDEX IF NOT EXISTS akun_status_idx ON akun(status);
CREATE INDEX IF NOT EXISTS akun_peran_akun_idx ON akun_peran(akun_id);
CREATE INDEX IF NOT EXISTS akun_peran_unit_idx ON akun_peran(unit_kerja_id);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit_log(target_akun_id, created_at);
CREATE INDEX IF NOT EXISTS sesi_akun_idx ON sesi(akun_id, berakhir_pada);
CREATE INDEX IF NOT EXISTS catatan_pegawai_tanggal_idx ON catatan_harian(pegawai_id, tanggal);
CREATE INDEX IF NOT EXISTS catatan_status_tanggal_idx ON catatan_harian(status, tanggal);
CREATE INDEX IF NOT EXISTS catatan_status_diajukan_idx ON catatan_harian(status, diajukan_pada);
CREATE INDEX IF NOT EXISTS pegawai_unit_tim_idx ON pegawai(unit_kerja_id, tim_kerja_id);
CREATE UNIQUE INDEX IF NOT EXISTS skp_pegawai_tahun_unique ON skp(pegawai_id, tahun);
`);

const tanpaAkun = sqlite
	.prepare(
		"SELECT COUNT(*) AS jumlah FROM pegawai p LEFT JOIN akun a ON a.pegawai_id = p.id WHERE a.id IS NULL",
	)
	.get() as { jumlah: number };
if (tanpaAkun.jumlah !== 0) {
	throw new Error(`Migrasi akun tidak lengkap: ${tanpaAkun.jumlah} pegawai belum memiliki akun.`);
}

console.log("Migrasi selesai:", file);
