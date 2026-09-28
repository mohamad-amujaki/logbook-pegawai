import { z } from "zod";
import {
	ASPEK_IKI,
	JENIS_IKI,
	JENIS_LAPORAN,
	JENIS_TUGAS,
	KATEGORI_CATATAN,
	PERAN_AKUN,
} from "./enums";

const nip = z
	.string()
	.trim()
	.regex(/^\d{18}$/, "NIP harus 18 digit angka.");

export const loginSchema = z.object({
	nip,
	sandi: z.string().min(1, "Kata sandi wajib diisi."),
});

export const gantiSandiSchema = z
	.object({
		sandiBaru: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
		ulangiSandi: z.string().min(1, "Ulangi sandi wajib diisi."),
	})
	.refine((v) => v.sandiBaru === v.ulangiSandi, {
		message: "Ulangi sandi tidak sama.",
		path: ["ulangiSandi"],
	});

export const catatanSchema = z.object({
	jenisTugas: z.enum(JENIS_TUGAS),
	ikiId: z.string().min(1, "Pilih IKI."),
	rencanaAksiId: z.string().min(1, "Pilih rencana aksi."),
	produkId: z.string().optional(),
	tahapanId: z.string().optional(),
	aktivitasId: z.string().optional(),
	isiManual: z.boolean(),
	namaManualProduk: z.string().optional(),
	namaManualTahapan: z.string().optional(),
	usulanNormaWaktu: z.number().int().positive().optional(),
	uraian: z.string().trim().min(10, "Uraian minimal 10 karakter."),
	waktuMulai: z.string().min(1, "Waktu mulai wajib diisi."),
	waktuSelesai: z.string().min(1, "Waktu selesai wajib diisi."),
	menitEfektif: z.number().int().positive("Waktu efektif harus lebih dari 0 menit."),
	jumlahOutput: z.number().positive("Jumlah output harus lebih dari 0."),
	satuanOutput: z.string().min(1, "Satuan output wajib diisi."),
	kategori: z.enum(KATEGORI_CATATAN),
	buktiUrl: z
		.string()
		.url("Tautan bukti harus berupa URL, diawali https://.")
		.optional()
		.or(z.literal("")),
	buktiJudul: z.string().optional(),
});

export const validasiSchema = z.object({
	catatanId: z.string().min(1),
	aksi: z.enum(["setujui", "tolak"]),
	catatan: z.string().optional(),
});

export const validasiMassalSchema = z.object({
	catatanIds: z.array(z.string().min(1)).min(1, "Pilih paling tidak satu catatan."),
	aksi: z.literal("setujui"),
});

export const catatanMassalSchema = z.object({
	catatanIds: z.array(z.string().min(1)).min(1, "Pilih paling tidak satu catatan."),
});

export const skpHeaderSchema = z.object({
	tahun: z.number().int().min(2020).max(2100),
	nipPemberiPertimbangan: nip,
	nipPejabatPenilai: nip,
	nipAtasanPejabatPenilai: nip,
});

export const produkSchema = z.object({
	kode: z.string().min(1),
	nama: z.string().min(2),
	kodeProsesL1: z.string().optional(),
	status: z.enum(["aktif", "nonaktif"]).default("aktif"),
});

export const tahapanSchema = z.object({
	kode: z.string().min(1),
	nama: z.string().min(2),
	produkId: z.string().min(1),
	urutan: z.number().int().default(1),
});

export const aktivitasSchema = z.object({
	kode: z.string().min(1),
	nama: z.string().min(2),
	tahapanId: z.string().min(1),
	uraian: z.string().optional(),
	normaWaktuMenit: z.number().positive(),
	status: z.enum(["aktif", "nonaktif"]).default("aktif"),
});

const kodeUnit = z
	.string()
	.trim()
	.max(12, "Kode maksimal 12 karakter.")
	.optional()
	.or(z.literal(""));

export const unitKerjaBaruSchema = z.object({
	nama: z.string().trim().min(3, "Nama minimal 3 karakter."),
	kode: kodeUnit,
	indukId: z.string().min(1).nullable().optional(),
});

export const unitKerjaUbahSchema = z.object({
	nama: z.string().trim().min(3, "Nama minimal 3 karakter."),
	kode: kodeUnit,
	indukId: z.string().min(1).nullable().optional(),
	status: z.enum(["aktif", "nonaktif"]).default("aktif"),
});

export const timKerjaSchema = z.object({
	kode: z.string().min(1),
	nama: z.string().min(2),
	unitKerjaId: z.string().min(1),
	status: z.enum(["aktif", "nonaktif"]).default("aktif"),
	urutan: z.number().int().default(1),
});

export const timKerjaUbahSchema = z.object({
	kode: z.string().min(1),
	nama: z.string().min(2),
	unitKerjaId: z.string().min(1),
	status: z.enum(["aktif", "nonaktif"]),
	ketuaPegawaiId: z.string().min(1).nullable(),
});

export const anggotaTimSchema = z.object({
	pegawaiIds: z.array(z.string().min(1)).min(1),
	timKerjaId: z.string().min(1),
});

export const statusAkunSchema = z.object({
	alasan: z.string().trim().min(3, "Alasan minimal 3 karakter.").max(500),
});

export const peranAkunSchema = z
	.object({
		peran: z.enum(PERAN_AKUN),
		unitKerjaId: z.string().min(1).nullable().optional(),
	})
	.refine((v) => v.peran !== "PENGELOLA_UNIT" || Boolean(v.unitKerjaId), {
		message: "Cakupan unit kerja wajib dipilih untuk Pengelola unit.",
		path: ["unitKerjaId"],
	});

export const daftarPeranAkunSchema = z.object({
	peran: z.array(peranAkunSchema).max(20),
});

export const laporanFilterSchema = z
	.object({
		jenis: z.enum(JENIS_LAPORAN),
		dari: z.string().date(),
		sampai: z.string().date(),
		unitKerjaId: z.string().min(1).optional(),
		timKerjaId: z.string().min(1).optional(),
		pegawaiId: z.string().min(1).optional(),
		status: z.string().optional(),
		jenisTugas: z.enum(JENIS_TUGAS).optional(),
	})
	.refine((v) => v.dari <= v.sampai, {
		message: "Tanggal awal tidak boleh setelah tanggal akhir.",
		path: ["sampai"],
	});

export const laporanPreviewSchema = z.intersection(
	laporanFilterSchema,
	z.object({
		page: z.coerce.number().int().min(1).default(1),
		pageSize: z.coerce.number().int().min(1).max(100).default(25),
	}),
);

const tmt = z
	.string()
	.trim()
	.refine((v) => v === "" || /^\d{2}-\d{2}-\d{4}$/.test(v), "TMT pakai format 01-04-2025.");

export const pegawaiBaruSchema = z.object({
	nip,
	namaLengkap: z.string().trim().min(3, "Nama lengkap minimal 3 karakter."),
	pangkatGolongan: z.string().trim().min(2, "Pangkat/golongan wajib diisi."),
	tmt: tmt.optional(),
	jabatan: z.string().trim().min(3, "Jabatan minimal 3 karakter."),
	unitKerjaId: z.string().min(1, "Unit kerja wajib dipilih."),
	timKerjaId: z.string().nullable().optional(),
	isAdmin: z.boolean().default(false),
	isKepalaBiro: z.boolean().default(false),
});

export const pegawaiUbahSchema = pegawaiBaruSchema.extend({
	resetSandi: z.boolean().default(false),
});

export const rencanaAksiSchema = z.object({
	uraian: z.string().min(3),
	satuan: z.string().trim().min(1, "Satuan rencana aksi wajib diisi."),
	targetTw1: z.number().default(0),
	targetTw2: z.number().default(0),
	targetTw3: z.number().default(0),
	targetTw4: z.number().default(0),
	akumulasi: z.boolean().default(false),
});

export const rhkSchema = z.object({
	uraian: z.string().min(3),
	rhkPimpinanId: z.string().min(1),
});

export const ikiSchema = z.object({
	rhkId: z.string().min(1),
	aspek: z.enum(ASPEK_IKI),
	indikator: z.string().min(3),
	targetTahunan: z.string().min(1),
	satuan: z.string().min(1),
	jenis: z.enum(JENIS_IKI),
	bobot: z.number().min(0).max(100),
});

export const pinKatalogSchema = z
	.object({
		jenis: z.enum(["produk", "jalur"]),
		produkId: z.string().min(1),
		tahapanId: z.string().optional(),
		aktivitasId: z.string().optional(),
	})
	.superRefine((v, ctx) => {
		if (v.jenis === "jalur" && !v.tahapanId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Jalur wajib punya tahapan.",
				path: ["tahapanId"],
			});
		}
	});

export const uraianSkpSchema = z.object({
	uraian: z.string().min(3),
});

export const ikiUbahSchema = ikiSchema.omit({ rhkId: true });
