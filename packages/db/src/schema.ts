/** Satu sumber tabel. Ubah di sini, lalu sesuaikan migrate.ts. */
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
	type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const timestamps = {
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
};

export const unitKerja = sqliteTable("unit_kerja", {
	id: text("id").primaryKey(),
	kode: text("kode").notNull().unique(),
	nama: text("nama").notNull(),
	indukId: text("induk_id").references((): AnySQLiteColumn => unitKerja.id),
	status: text("status").notNull().default("aktif"),
	...timestamps,
});

export const timKerja = sqliteTable("tim_kerja", {
	id: text("id").primaryKey(),
	kode: text("kode").notNull().unique(),
	nama: text("nama").notNull(),
	unitKerjaId: text("unit_kerja_id")
		.notNull()
		.references(() => unitKerja.id),
	status: text("status").notNull().default("aktif"),
	urutan: integer("urutan").notNull().default(1),
	ketuaPegawaiId: text("ketua_pegawai_id").references((): AnySQLiteColumn => pegawai.id),
	...timestamps,
});

export const pegawai = sqliteTable(
	"pegawai",
	{
		id: text("id").primaryKey(),
		nip: text("nip").notNull().unique(),
		namaLengkap: text("nama_lengkap").notNull(),
		pangkatGolongan: text("pangkat_golongan").notNull(),
		tmt: text("tmt"),
		jabatan: text("jabatan").notNull(),
		unitKerjaId: text("unit_kerja_id")
			.notNull()
			.references(() => unitKerja.id),
		timKerjaId: text("tim_kerja_id").references(() => timKerja.id),
		status: text("status").notNull().default("aktif"),
		passwordHash: text("password_hash").notNull(),
		wajibGantiSandi: integer("wajib_ganti_sandi", { mode: "boolean" }).notNull().default(true),
		isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
		isKepalaBiro: integer("is_kepala_biro", { mode: "boolean" }).notNull().default(false),
		...timestamps,
	},
	(t) => [index("pegawai_unit_tim_idx").on(t.unitKerjaId, t.timKerjaId)],
);

export const akun = sqliteTable(
	"akun",
	{
		id: text("id").primaryKey(),
		pegawaiId: text("pegawai_id")
			.notNull()
			.references(() => pegawai.id),
		passwordHash: text("password_hash").notNull(),
		wajibGantiSandi: integer("wajib_ganti_sandi", { mode: "boolean" }).notNull().default(true),
		status: text("status").notNull().default("AKTIF"),
		terakhirLoginPada: text("terakhir_login_pada"),
		ditangguhkanPada: text("ditangguhkan_pada"),
		ditangguhkanOlehId: text("ditangguhkan_oleh_id").references((): AnySQLiteColumn => akun.id),
		alasanPenangguhan: text("alasan_penangguhan"),
		...timestamps,
	},
	(t) => [unique("akun_pegawai").on(t.pegawaiId), index("akun_status_idx").on(t.status)],
);

export const akunPeran = sqliteTable(
	"akun_peran",
	{
		id: text("id").primaryKey(),
		akunId: text("akun_id")
			.notNull()
			.references(() => akun.id),
		peran: text("peran").notNull(),
		unitKerjaId: text("unit_kerja_id").references(() => unitKerja.id),
		diberikanOlehId: text("diberikan_oleh_id").references(() => akun.id),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(t) => [
		unique("akun_peran_cakupan").on(t.akunId, t.peran, t.unitKerjaId),
		index("akun_peran_akun_idx").on(t.akunId),
		index("akun_peran_unit_idx").on(t.unitKerjaId),
	],
);

export const sesi = sqliteTable(
	"sesi",
	{
		id: text("id").primaryKey(),
		pegawaiId: text("pegawai_id")
			.notNull()
			.references(() => pegawai.id),
		akunId: text("akun_id").references(() => akun.id),
		berakhirPada: text("berakhir_pada").notNull(),
		dicabutPada: text("dicabut_pada"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(t) => [index("sesi_akun_idx").on(t.akunId, t.berakhirPada)],
);

export const produk = sqliteTable("produk", {
	id: text("id").primaryKey(),
	kode: text("kode").notNull().unique(),
	nama: text("nama").notNull(),
	kodeProsesL1: text("kode_proses_l1"),
	status: text("status").notNull().default("aktif"),
	...timestamps,
});

export const tahapan = sqliteTable("tahapan", {
	id: text("id").primaryKey(),
	kode: text("kode").notNull().unique(),
	nama: text("nama").notNull(),
	produkId: text("produk_id")
		.notNull()
		.references(() => produk.id),
	urutan: integer("urutan").notNull().default(1),
	...timestamps,
});

export const aktivitas = sqliteTable("aktivitas", {
	id: text("id").primaryKey(),
	kode: text("kode").notNull().unique(),
	nama: text("nama").notNull(),
	tahapanId: text("tahapan_id")
		.notNull()
		.references(() => tahapan.id),
	uraian: text("uraian"),
	normaWaktuMenit: integer("norma_waktu_menit").notNull(),
	status: text("status").notNull().default("aktif"),
	...timestamps,
});

export const skp = sqliteTable("skp", {
	id: text("id").primaryKey(),
	pegawaiId: text("pegawai_id")
		.notNull()
		.references(() => pegawai.id),
	tahun: integer("tahun").notNull(),
	pemberiPertimbanganId: text("pemberi_pertimbangan_id").references(() => pegawai.id),
	pejabatPenilaiId: text("pejabat_penilai_id").references(() => pegawai.id),
	atasanPejabatPenilaiId: text("atasan_pejabat_penilai_id").references(() => pegawai.id),
	...timestamps,
});

export const rhkPimpinan = sqliteTable("rhk_pimpinan", {
	id: text("id").primaryKey(),
	skpId: text("skp_id")
		.notNull()
		.references(() => skp.id),
	uraian: text("uraian").notNull(),
	urutan: integer("urutan").notNull().default(1),
});

export const rhk = sqliteTable("rhk", {
	id: text("id").primaryKey(),
	rhkPimpinanId: text("rhk_pimpinan_id")
		.notNull()
		.references(() => rhkPimpinan.id),
	uraian: text("uraian").notNull(),
	aspek: text("aspek").notNull(),
	indikator: text("indikator").notNull(),
	targetTahunan: text("target_tahunan").notNull(),
	satuan: text("satuan"),
	urutan: integer("urutan").notNull().default(1),
});

export const iki = sqliteTable("iki", {
	id: text("id").primaryKey(),
	rhkId: text("rhk_id")
		.notNull()
		.references(() => rhk.id),
	aspek: text("aspek").notNull(),
	indikator: text("indikator").notNull(),
	targetTahunan: text("target_tahunan").notNull(),
	satuan: text("satuan").notNull(),
	jenis: text("jenis").notNull().default("CORE"),
	bobot: integer("bobot").notNull().default(0),
	urutan: integer("urutan").notNull().default(1),
});

export const rencanaAksi = sqliteTable("rencana_aksi", {
	id: text("id").primaryKey(),
	rhkId: text("rhk_id")
		.notNull()
		.references(() => rhk.id),
	ikiId: text("iki_id").references(() => iki.id),
	uraian: text("uraian").notNull(),
	satuan: text("satuan").notNull().default(""),
	targetTw1: integer("target_tw1").notNull().default(0),
	targetTw2: integer("target_tw2").notNull().default(0),
	targetTw3: integer("target_tw3").notNull().default(0),
	targetTw4: integer("target_tw4").notNull().default(0),
	akumulasi: integer("akumulasi", { mode: "boolean" }).notNull().default(false),
});

export const catatanHarian = sqliteTable(
	"catatan_harian",
	{
		id: text("id").primaryKey(),
		pegawaiId: text("pegawai_id")
			.notNull()
			.references(() => pegawai.id),
		tanggal: text("tanggal").notNull(),
		jenisTugas: text("jenis_tugas").notNull(),
		produkId: text("produk_id").references(() => produk.id),
		tahapanId: text("tahapan_id").references(() => tahapan.id),
		aktivitasId: text("aktivitas_id").references(() => aktivitas.id),
		ikiId: text("iki_id").references(() => iki.id),
		rencanaAksiId: text("rencana_aksi_id").references(() => rencanaAksi.id),
		isiManual: integer("isi_manual", { mode: "boolean" }).notNull().default(false),
		namaManualProduk: text("nama_manual_produk"),
		namaManualTahapan: text("nama_manual_tahapan"),
		usulanNormaWaktu: integer("usulan_norma_waktu"),
		uraian: text("uraian").notNull(),
		waktuMulai: text("waktu_mulai").notNull(),
		waktuSelesai: text("waktu_selesai").notNull(),
		menitEfektif: integer("menit_efektif").notNull(),
		jumlahOutput: integer("jumlah_output").notNull(),
		satuanOutput: text("satuan_output").notNull(),
		kategori: text("kategori").notNull().default("BIASA"),
		buktiUrl: text("bukti_url"),
		buktiJudul: text("bukti_judul"),
		status: text("status").notNull().default("DRAFT"),
		catatanValidasi: text("catatan_validasi"),
		divalidasiOlehId: text("divalidasi_oleh_id").references(() => pegawai.id),
		divalidasiPada: text("divalidasi_pada"),
		diajukanPada: text("diajukan_pada"),
		unitKerjaIdSnapshot: text("unit_kerja_id_snapshot").references(() => unitKerja.id),
		timKerjaIdSnapshot: text("tim_kerja_id_snapshot").references(() => timKerja.id),
		...timestamps,
	},
	(t) => [
		index("catatan_pegawai_tanggal_idx").on(t.pegawaiId, t.tanggal),
		index("catatan_status_tanggal_idx").on(t.status, t.tanggal),
	],
);

export const pinKatalog = sqliteTable(
	"pin_katalog",
	{
		id: text("id").primaryKey(),
		pegawaiId: text("pegawai_id")
			.notNull()
			.references(() => pegawai.id),
		jenis: text("jenis").notNull(),
		produkId: text("produk_id")
			.notNull()
			.references(() => produk.id),
		tahapanId: text("tahapan_id").references(() => tahapan.id),
		aktivitasId: text("aktivitas_id").references(() => aktivitas.id),
		kunci: text("kunci").notNull(),
		urutan: integer("urutan").notNull().default(1),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(t) => [unique("pin_katalog_pegawai_kunci").on(t.pegawaiId, t.kunci)],
);

export const usulanKatalog = sqliteTable("usulan_katalog", {
	id: text("id").primaryKey(),
	catatanHarianId: text("catatan_harian_id")
		.notNull()
		.references(() => catatanHarian.id),
	pegawaiId: text("pegawai_id")
		.notNull()
		.references(() => pegawai.id),
	namaProduk: text("nama_produk").notNull(),
	namaTahapan: text("nama_tahapan").notNull(),
	normaWaktu: integer("norma_waktu"),
	status: text("status").notNull().default("MENUNGGU"),
	...timestamps,
});

export const notifikasi = sqliteTable("notifikasi", {
	id: text("id").primaryKey(),
	pegawaiId: text("pegawai_id")
		.notNull()
		.references(() => pegawai.id),
	judul: text("judul").notNull(),
	isi: text("isi").notNull(),
	tautan: text("tautan"),
	dibaca: integer("dibaca", { mode: "boolean" }).notNull().default(false),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const auditLog = sqliteTable(
	"audit_log",
	{
		id: text("id").primaryKey(),
		aktorAkunId: text("aktor_akun_id").references(() => akun.id),
		targetAkunId: text("target_akun_id").references(() => akun.id),
		aksi: text("aksi").notNull(),
		alasan: text("alasan"),
		sebelumJson: text("sebelum_json"),
		sesudahJson: text("sesudah_json"),
		requestId: text("request_id"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(t) => [index("audit_log_target_idx").on(t.targetAkunId, t.createdAt)],
);

export const schema = {
	unitKerja,
	timKerja,
	pegawai,
	akun,
	akunPeran,
	sesi,
	produk,
	tahapan,
	aktivitas,
	skp,
	rhkPimpinan,
	rhk,
	iki,
	rencanaAksi,
	catatanHarian,
	pinKatalog,
	usulanKatalog,
	notifikasi,
	auditLog,
};
