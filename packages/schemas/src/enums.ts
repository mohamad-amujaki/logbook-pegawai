/** Nilai tetap yang dipakai form, API, dan perhitungan jam efektif. */

export const JENIS_TUGAS = ["TUSI", "TUSI_LAINNYA", "NON_TUSI"] as const;
export type JenisTugas = (typeof JENIS_TUGAS)[number];

export const STATUS_CATATAN = ["DRAFT", "SUBMIT", "TERVERIFIKASI", "DITOLAK"] as const;
export type StatusCatatan = (typeof STATUS_CATATAN)[number];

export const KATEGORI_CATATAN = ["BIASA", "PERLU_DISKUSI"] as const;

export const ASPEK_IKI = ["KUANTITAS", "KUALITAS", "WAKTU", "BIAYA"] as const;
export type AspekIki = (typeof ASPEK_IKI)[number];

export const JENIS_IKI = ["CORE", "BEYOND"] as const;
export type JenisIki = (typeof JENIS_IKI)[number];

export const TARGET_MENIT_EFEKTIF = 390;

export const STATUS_AKUN = ["AKTIF", "DITANGGUHKAN"] as const;
export type StatusAkun = (typeof STATUS_AKUN)[number];

export const PERAN_AKUN = ["ADMIN", "KEPALA_BIRO", "PENGELOLA_UNIT"] as const;
export type PeranAkun = (typeof PERAN_AKUN)[number];

export const JENIS_LAPORAN = [
	"AKTIVITAS_HARIAN",
	"JAM_EFEKTIF",
	"VALIDASI",
	"KETERHUBUNGAN_KATALOG",
	"KELENGKAPAN_SKP",
] as const;
export type JenisLaporan = (typeof JENIS_LAPORAN)[number];
