import {
	catatanHarian,
	db,
	iki,
	pegawai,
	produk,
	rencanaAksi,
	rhk,
	rhkPimpinan,
	skp,
	tahapan,
	timKerja,
	unitKerja,
} from "@logbook/db";
import { laporanFilterSchema, laporanPreviewSchema, type JenisLaporan } from "@logbook/schemas";
import { zValidator } from "@hono/zod-validator";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { Hono } from "hono";
import { requireAuth, type Authed } from "../middleware/auth";

type Filter = ReturnType<typeof laporanFilterSchema.parse>;
export type Laporan = {
	judul: string;
	subjudul: string;
	dibuatPada: string;
	ringkasan: { label: string; nilai: string }[];
	kolom: string[];
	baris: string[][];
};

const labelLaporan: Record<JenisLaporan, string> = {
	AKTIVITAS_HARIAN: "Aktivitas harian",
	JAM_EFEKTIF: "Jam efektif terverifikasi",
	VALIDASI: "Validasi catatan",
	KETERHUBUNGAN_KATALOG: "Keterhubungan katalog kinerja",
	KELENGKAPAN_SKP: "Kelengkapan SKP",
};

function menitLabel(menit: number): string {
	const jam = Math.floor(menit / 60);
	const sisa = menit % 60;
	return jam === 0 ? `${sisa} mnt` : sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} mnt`;
}

function tanggalJam(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? iso
		: new Intl.DateTimeFormat("id-ID", {
				dateStyle: "medium",
				timeStyle: "short",
				timeZone: "Asia/Jakarta",
			}).format(d);
}

export function bagiBatch<T>(daftar: T[], ukuran = 80): T[][] {
	const hasil: T[][] = [];
	for (let i = 0; i < daftar.length; i += ukuran) hasil.push(daftar.slice(i, i + ukuran));
	return hasil;
}

async function ambilAktivitas(ids: string[], filter: Filter) {
	const kondisi = [
		inArray(catatanHarian.pegawaiId, ids),
		gte(catatanHarian.tanggal, filter.dari),
		lte(catatanHarian.tanggal, filter.sampai),
	];
	if (filter.status) kondisi.push(eq(catatanHarian.status, filter.status));
	if (filter.jenisTugas) kondisi.push(eq(catatanHarian.jenisTugas, filter.jenisTugas));
	return db
		.select({
			id: catatanHarian.id,
			tanggal: catatanHarian.tanggal,
			waktuMulai: catatanHarian.waktuMulai,
			waktuSelesai: catatanHarian.waktuSelesai,
			pegawaiId: pegawai.id,
			nama: pegawai.namaLengkap,
			nip: pegawai.nip,
			unit: unitKerja.nama,
			tim: timKerja.nama,
			jenisTugas: catatanHarian.jenisTugas,
			uraian: catatanHarian.uraian,
			menitEfektif: catatanHarian.menitEfektif,
			status: catatanHarian.status,
			produk: produk.nama,
			tahapan: tahapan.nama,
			divalidasiPada: catatanHarian.divalidasiPada,
			diajukanPada: catatanHarian.diajukanPada,
		})
		.from(catatanHarian)
		.innerJoin(pegawai, eq(catatanHarian.pegawaiId, pegawai.id))
		.innerJoin(unitKerja, eq(pegawai.unitKerjaId, unitKerja.id))
		.leftJoin(timKerja, eq(pegawai.timKerjaId, timKerja.id))
		.leftJoin(produk, eq(catatanHarian.produkId, produk.id))
		.leftJoin(tahapan, eq(catatanHarian.tahapanId, tahapan.id))
		.where(and(...kondisi));
}

async function pegawaiDalamCakupan(user: Authed): Promise<string[]> {
	if (user.isAdmin) {
		return (await db.select({ id: pegawai.id }).from(pegawai)).map((p) => p.id);
	}
	const unitIds = new Set(user.unitKelolaIds);
	if (user.isKepalaBiro) {
		const unitSaya = (
			await db
				.select({ id: unitKerja.id, indukId: unitKerja.indukId })
				.from(unitKerja)
				.where(eq(unitKerja.id, user.unitKerjaId))
				.limit(1)
		)[0];
		const root = unitSaya?.indukId ?? unitSaya?.id;
		if (root) {
			const satuEselon = await db.select().from(unitKerja);
			for (const unit of satuEselon) {
				if (unit.id === root || unit.indukId === root) unitIds.add(unit.id);
			}
		}
	}
	const timDipimpin = await db
		.select({ id: timKerja.id })
		.from(timKerja)
		.where(eq(timKerja.ketuaPegawaiId, user.id));
	const daftar = await db
		.select({
			id: pegawai.id,
			unitKerjaId: pegawai.unitKerjaId,
			timKerjaId: pegawai.timKerjaId,
		})
		.from(pegawai);
	const timIds = new Set(timDipimpin.map((t) => t.id));
	const ids = daftar
		.filter(
			(p) =>
				unitIds.has(p.unitKerjaId) ||
				(Boolean(p.timKerjaId) && timIds.has(p.timKerjaId as string)) ||
				p.id === user.id,
		)
		.map((p) => p.id);
	return ids.length > 0 ? ids : [user.id];
}

async function dataAktivitas(user: Authed, filter: Filter) {
	const cakupan = await pegawaiDalamCakupan(user);
	if (filter.pegawaiId && !cakupan.includes(filter.pegawaiId)) {
		throw new Error("Anda tidak memiliki akses ke pegawai tersebut.");
	}
	let ids = cakupan;
	if (filter.pegawaiId) ids = [filter.pegawaiId];
	if (filter.unitKerjaId || filter.timKerjaId) {
		const orang: { id: string; unitKerjaId: string; timKerjaId: string | null }[] = [];
		for (const batch of bagiBatch(ids)) {
			orang.push(
				...(await db
					.select({
						id: pegawai.id,
						unitKerjaId: pegawai.unitKerjaId,
						timKerjaId: pegawai.timKerjaId,
					})
					.from(pegawai)
					.where(inArray(pegawai.id, batch))),
			);
		}
		ids = orang
			.filter(
				(p) =>
					(!filter.unitKerjaId || p.unitKerjaId === filter.unitKerjaId) &&
					(!filter.timKerjaId || p.timKerjaId === filter.timKerjaId),
			)
			.map((p) => p.id);
	}
	if (ids.length === 0) return [];
	const hasil: Awaited<ReturnType<typeof ambilAktivitas>> = [];
	for (const batch of bagiBatch(ids)) {
		hasil.push(...(await ambilAktivitas(batch, filter)));
	}
	return hasil;
}

async function buatLaporan(user: Authed, filter: Filter): Promise<Laporan> {
	const dibuatPada = new Date().toISOString();
	const labelCakupan: string[] = [];
	if (filter.unitKerjaId) {
		const unit = (
			await db
				.select({ nama: unitKerja.nama })
				.from(unitKerja)
				.where(eq(unitKerja.id, filter.unitKerjaId))
				.limit(1)
		)[0];
		if (unit) labelCakupan.push(`Unit ${unit.nama}`);
	}
	if (filter.timKerjaId) {
		const tim = (
			await db
				.select({ nama: timKerja.nama })
				.from(timKerja)
				.where(eq(timKerja.id, filter.timKerjaId))
				.limit(1)
		)[0];
		if (tim) labelCakupan.push(`Tim ${tim.nama}`);
	}
	if (filter.pegawaiId) {
		const orang = (
			await db
				.select({ nama: pegawai.namaLengkap })
				.from(pegawai)
				.where(eq(pegawai.id, filter.pegawaiId))
				.limit(1)
		)[0];
		if (orang) labelCakupan.push(`Pegawai ${orang.nama}`);
	}
	const subjudul = [`Periode ${filter.dari} sampai ${filter.sampai}`, ...labelCakupan].join(" | ");
	if (filter.jenis === "KELENGKAPAN_SKP") {
		let ids = await pegawaiDalamCakupan(user);
		if (filter.pegawaiId && !ids.includes(filter.pegawaiId)) {
			throw new Error("Anda tidak memiliki akses ke pegawai tersebut.");
		}
		if (filter.pegawaiId) ids = [filter.pegawaiId];
		const semuaOrang: {
			id: string;
			nama: string;
			nip: string;
			unit: string;
			unitKerjaId: string;
			timKerjaId: string | null;
		}[] = [];
		for (const batch of bagiBatch(ids)) {
			semuaOrang.push(
				...(await db
					.select({
						id: pegawai.id,
						nama: pegawai.namaLengkap,
						nip: pegawai.nip,
						unit: unitKerja.nama,
						unitKerjaId: pegawai.unitKerjaId,
						timKerjaId: pegawai.timKerjaId,
					})
					.from(pegawai)
					.innerJoin(unitKerja, eq(pegawai.unitKerjaId, unitKerja.id))
					.where(inArray(pegawai.id, batch))),
			);
		}
		const orang = semuaOrang.filter(
			(p) =>
				(!filter.unitKerjaId || p.unitKerjaId === filter.unitKerjaId) &&
				(!filter.timKerjaId || p.timKerjaId === filter.timKerjaId),
		);
		const tahun = Number(filter.dari.slice(0, 4));
		const skps = await db.select().from(skp).where(eq(skp.tahun, tahun));
		const pimpinan = await db.select().from(rhkPimpinan);
		const daftarRhk = await db.select().from(rhk);
		const daftarIki = await db.select().from(iki);
		const aksi = await db.select().from(rencanaAksi);
		const baris = orang.map((p) => {
			const header = skps.find((s) => s.pegawaiId === p.id);
			const pimpinIds = pimpinan.filter((r) => r.skpId === header?.id).map((r) => r.id);
			const rhkIds = daftarRhk.filter((r) => pimpinIds.includes(r.rhkPimpinanId)).map((r) => r.id);
			const ikiSaya = daftarIki.filter((i) => rhkIds.includes(i.rhkId));
			const lengkapIdentitas = Boolean(
				header?.pemberiPertimbanganId && header?.pejabatPenilaiId && header?.atasanPejabatPenilaiId,
			);
			const lengkapAksi =
				ikiSaya.length > 0 && ikiSaya.every((i) => aksi.some((a) => a.ikiId === i.id));
			return [
				p.nama,
				p.nip,
				p.unit,
				lengkapIdentitas ? "Lengkap" : "Belum lengkap",
				String(pimpinIds.length),
				String(rhkIds.length),
				String(ikiSaya.length),
				lengkapAksi ? "Lengkap" : "Belum lengkap",
			];
		});
		const lengkap = baris.filter((r) => r[3] === "Lengkap" && r[7] === "Lengkap").length;
		return {
			judul: labelLaporan[filter.jenis],
			subjudul: `Tahun ${tahun}`,
			dibuatPada,
			ringkasan: [
				{ label: "Pegawai", nilai: String(baris.length) },
				{ label: "SKP lengkap", nilai: String(lengkap) },
			],
			kolom: ["Pegawai", "NIP", "Unit kerja", "Identitas", "Sasaran", "RHK", "IKI", "Aksi"],
			baris,
		};
	}

	const aktivitas = await dataAktivitas(user, filter);
	if (filter.jenis === "AKTIVITAS_HARIAN") {
		return {
			judul: labelLaporan[filter.jenis],
			subjudul,
			dibuatPada,
			ringkasan: [
				{ label: "Catatan", nilai: String(aktivitas.length) },
				{
					label: "Waktu terverifikasi",
					nilai: menitLabel(
						aktivitas
							.filter((r) => r.status === "TERVERIFIKASI" && r.jenisTugas !== "NON_TUSI")
							.reduce((n, r) => n + r.menitEfektif, 0),
					),
				},
			],
			kolom: [
				"Tanggal",
				"Pegawai",
				"Unit kerja",
				"Tim",
				"Jenis",
				"Uraian",
				"Waktu efektif",
				"Status",
				"Produk",
				"Tahapan",
			],
			baris: aktivitas.map((r) => [
				r.tanggal,
				r.nama,
				r.unit,
				r.tim ?? "-",
				r.jenisTugas,
				r.uraian,
				menitLabel(r.menitEfektif),
				r.status,
				r.produk ?? "-",
				r.tahapan ?? "-",
			]),
		};
	}

	const perPegawai = new Map<
		string,
		{
			nama: string;
			nip: string;
			unit: string;
			tim: string;
			tercatat: number;
			terverifikasi: number;
		}
	>();
	for (const r of aktivitas) {
		const nilai = perPegawai.get(r.pegawaiId) ?? {
			nama: r.nama,
			nip: r.nip,
			unit: r.unit,
			tim: r.tim ?? "-",
			tercatat: 0,
			terverifikasi: 0,
		};
		if (r.jenisTugas !== "NON_TUSI" && ["SUBMIT", "TERVERIFIKASI"].includes(r.status)) {
			nilai.tercatat += r.menitEfektif;
		}
		if (r.jenisTugas !== "NON_TUSI" && r.status === "TERVERIFIKASI") {
			nilai.terverifikasi += r.menitEfektif;
		}
		perPegawai.set(r.pegawaiId, nilai);
	}
	if (filter.jenis === "JAM_EFEKTIF") {
		const nilai = [...perPegawai.values()].sort((a, b) => b.terverifikasi - a.terverifikasi);
		return {
			judul: labelLaporan[filter.jenis],
			subjudul,
			dibuatPada,
			ringkasan: [
				{ label: "Pegawai", nilai: String(nilai.length) },
				{
					label: "Total terverifikasi",
					nilai: menitLabel(nilai.reduce((n, r) => n + r.terverifikasi, 0)),
				},
			],
			kolom: ["Pegawai", "NIP", "Unit kerja", "Tim", "Waktu tercatat", "Waktu terverifikasi"],
			baris: nilai.map((r) => [
				r.nama,
				r.nip,
				r.unit,
				r.tim,
				menitLabel(r.tercatat),
				menitLabel(r.terverifikasi),
			]),
		};
	}
	if (filter.jenis === "VALIDASI") {
		const nilai = [...perPegawai.entries()].map(([pegawaiId, p]) => {
			const milik = aktivitas.filter((r) => r.pegawaiId === pegawaiId);
			return [
				p.nama,
				p.nip,
				p.unit,
				String(milik.filter((r) => r.status === "SUBMIT").length),
				String(milik.filter((r) => r.status === "TERVERIFIKASI").length),
				String(milik.filter((r) => r.status === "DITOLAK").length),
			];
		});
		return {
			judul: labelLaporan[filter.jenis],
			subjudul,
			dibuatPada,
			ringkasan: [
				{ label: "Diajukan", nilai: String(aktivitas.filter((r) => r.diajukanPada).length) },
				{ label: "Menunggu", nilai: String(aktivitas.filter((r) => r.status === "SUBMIT").length) },
				{
					label: "Disetujui",
					nilai: String(aktivitas.filter((r) => r.status === "TERVERIFIKASI").length),
				},
			],
			kolom: ["Pegawai", "NIP", "Unit kerja", "Menunggu", "Disetujui", "Ditolak"],
			baris: nilai,
		};
	}

	const terverifikasi = aktivitas.filter((r) => r.status === "TERVERIFIKASI");
	const tertaut = terverifikasi.filter((r) => r.produk);
	const persen =
		terverifikasi.length === 0 ? 0 : Math.round((tertaut.length / terverifikasi.length) * 100);
	return {
		judul: labelLaporan.KETERHUBUNGAN_KATALOG,
		subjudul,
		dibuatPada,
		ringkasan: [
			{ label: "Catatan terverifikasi", nilai: String(terverifikasi.length) },
			{ label: "Tertaut katalog", nilai: `${persen}%` },
		],
		kolom: ["Pegawai", "NIP", "Unit kerja", "Total", "Tertaut", "Persentase"],
		baris: [...perPegawai.entries()].map(([pegawaiId, p]) => {
			const milik = terverifikasi.filter((r) => r.pegawaiId === pegawaiId);
			const jumlahTertaut = milik.filter((r) => r.produk).length;
			return [
				p.nama,
				p.nip,
				p.unit,
				String(milik.length),
				String(jumlahTertaut),
				milik.length === 0 ? "0%" : `${Math.round((jumlahTertaut / milik.length) * 100)}%`,
			];
		}),
	};
}

function amanPdf(value: string): string {
	return value.replace(/[^\x20-\x7e\u00a0-\u00ff]/g, "-");
}

export async function kePdf(laporan: Laporan, pembuat: string): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	let page = pdf.addPage([842, 595]);
	let y = 558;
	const tulis = (teks: string, x: number, ukuran = 8, tebal = false) => {
		page.drawText(amanPdf(teks), {
			x,
			y,
			size: ukuran,
			font: tebal ? bold : font,
			color: rgb(0.08, 0.19, 0.2),
		});
	};
	tulis(laporan.judul, 36, 16, true);
	y -= 20;
	tulis(laporan.subjudul, 36, 9);
	y -= 14;
	tulis(`Dibuat ${tanggalJam(laporan.dibuatPada)} oleh ${pembuat}`, 36, 8);
	y -= 20;
	tulis(laporan.ringkasan.map((r) => `${r.label}: ${r.nilai}`).join(" | "), 36, 9, true);
	y -= 24;
	const lebar = 770 / laporan.kolom.length;
	const header = () => {
		laporan.kolom.forEach((kolom, i) => {
			tulis(kolom.slice(0, 22), 36 + i * lebar, 7, true);
		});
		y -= 14;
	};
	header();
	for (const row of laporan.baris) {
		if (y < 35) {
			page = pdf.addPage([842, 595]);
			y = 558;
			header();
		}
		row.forEach((cell, i) => {
			tulis(String(cell).slice(0, 24), 36 + i * lebar, 6.5);
		});
		y -= 13;
	}
	return pdf.save();
}

export function keXlsx(laporan: Laporan, pembuat = ""): Uint8Array {
	const workbook = XLSX.utils.book_new();
	const data = [
		[laporan.judul],
		[laporan.subjudul],
		[`Dibuat ${tanggalJam(laporan.dibuatPada)}${pembuat ? ` oleh ${pembuat}` : ""}`],
		[],
		...laporan.ringkasan.map((r) => [r.label, r.nilai]),
		[],
		laporan.kolom,
		...laporan.baris,
	];
	const sheet = XLSX.utils.aoa_to_sheet(data);
	XLSX.utils.book_append_sheet(workbook, sheet, "Laporan");
	return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

export const laporanRoutes = new Hono()
	.use("*", requireAuth)
	.post("/preview", zValidator("json", laporanPreviewSchema), async (c) => {
		try {
			const filter = c.req.valid("json");
			const laporan = await buatLaporan(c.get("user"), filter);
			const totalRows = laporan.baris.length;
			const totalPages = Math.max(1, Math.ceil(totalRows / filter.pageSize));
			const page = Math.min(filter.page, totalPages);
			const awal = (page - 1) * filter.pageSize;
			return c.json({
				...laporan,
				baris: laporan.baris.slice(awal, awal + filter.pageSize),
				pagination: {
					page,
					pageSize: filter.pageSize,
					totalRows,
					totalPages,
				},
			});
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : "Laporan gagal dibuat." },
				403,
			);
		}
	})
	.post("/export/:format", zValidator("json", laporanFilterSchema), async (c) => {
		const format = c.req.param("format");
		if (format !== "pdf" && format !== "xlsx") {
			return c.json({ error: "Format laporan tidak didukung." }, 400);
		}
		try {
			const user = c.get("user");
			const laporan = await buatLaporan(user, c.req.valid("json"));
			const nama = `laporan-${c.req.valid("json").jenis.toLowerCase()}-${c.req.valid("json").dari}`;
			const isi =
				format === "pdf"
					? await kePdf(laporan, user.namaLengkap)
					: keXlsx(laporan, user.namaLengkap);
			return new Response(isi, {
				headers: {
					"Content-Type":
						format === "pdf"
							? "application/pdf"
							: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					"Content-Disposition": `attachment; filename="${nama}.${format}"`,
				},
			});
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : "Laporan gagal dibuat." },
				403,
			);
		}
	});
