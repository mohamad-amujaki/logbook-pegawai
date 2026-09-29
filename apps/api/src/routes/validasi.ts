import { catatanHarian, db, pegawai, produk, skp, tahapan } from "@logbook/db";
import {
	durasiKalenderMenit,
	selisihEvaluasi,
	validasiMassalSchema,
	validasiSchema,
} from "@logbook/schemas";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { Hono } from "hono";
import { rekonsiliasiAutoValidasi } from "../lib/auto-validasi";
import { kirimNotifikasi } from "../lib/notify";
import { requireAuth } from "../middleware/auth";

function zodString(
	hasil: { success: false; error: { issues: { message?: string; path: (string | number)[] }[] } },
	c: { json: (body: unknown, status: 400) => Response },
) {
	const first = hasil.error.issues[0];
	const field = first?.path[0];
	return c.json(
		{
			error: first?.message ?? "Isian belum lengkap.",
			field: typeof field === "string" ? field : undefined,
		},
		400,
	);
}

async function idBawahan(userId: string): Promise<string[]> {
	const tahun = new Date().getFullYear();
	const bawahan = await db
		.select({ pegawaiId: skp.pegawaiId })
		.from(skp)
		.where(and(eq(skp.tahun, tahun), eq(skp.pemberiPertimbanganId, userId)));
	return bawahan.map((b) => b.pegawaiId);
}

function bentukBaris(row: {
	catatan: typeof catatanHarian.$inferSelect;
	nama: string;
	nip: string;
	jabatan: string;
	produkNama: string | null;
	tahapanNama: string | null;
}) {
	const { catatan } = row;
	const durasiMenit = durasiKalenderMenit(catatan.waktuMulai, catatan.waktuSelesai);
	return {
		id: catatan.id,
		pegawaiId: catatan.pegawaiId,
		nama: row.nama,
		nip: row.nip,
		jabatan: row.jabatan,
		tanggal: catatan.tanggal,
		waktuMulai: catatan.waktuMulai,
		waktuSelesai: catatan.waktuSelesai,
		jenisTugas: catatan.jenisTugas,
		uraian: catatan.uraian,
		menitEfektif: catatan.menitEfektif,
		durasiMenit,
		selisihMenit: selisihEvaluasi(durasiMenit, catatan.menitEfektif),
		status: catatan.status,
		isiManual: catatan.isiManual,
		namaManualProduk: catatan.namaManualProduk,
		namaManualTahapan: catatan.namaManualTahapan,
		produkNama: row.produkNama,
		tahapanNama: row.tahapanNama,
		kategori: catatan.kategori,
		buktiUrl: catatan.buktiUrl,
		buktiJudul: catatan.buktiJudul,
		jumlahOutput: catatan.jumlahOutput,
		satuanOutput: catatan.satuanOutput,
		catatanValidasi: catatan.catatanValidasi,
		divalidasiPada: catatan.divalidasiPada,
		divalidasiOtomatis: catatan.divalidasiOtomatis,
	};
}

export const validasiRoutes = new Hono()
	.use(requireAuth)
	.get("/", async (c) => {
		const user = c.get("user");
		await rekonsiliasiAutoValidasi();
		const ids = await idBawahan(user.id);
		if (ids.length === 0) return c.json({ adaBawahan: false, baris: [] });

		const rows = await db
			.select({
				catatan: catatanHarian,
				nama: pegawai.namaLengkap,
				nip: pegawai.nip,
				jabatan: pegawai.jabatan,
				produkNama: produk.nama,
				tahapanNama: tahapan.nama,
			})
			.from(catatanHarian)
			.innerJoin(pegawai, eq(catatanHarian.pegawaiId, pegawai.id))
			.leftJoin(produk, eq(catatanHarian.produkId, produk.id))
			.leftJoin(tahapan, eq(catatanHarian.tahapanId, tahapan.id))
			.where(and(inArray(catatanHarian.pegawaiId, ids), ne(catatanHarian.status, "DRAFT")))
			.orderBy(desc(catatanHarian.waktuMulai));

		return c.json({ adaBawahan: true, baris: rows.map(bentukBaris) });
	})
	.post(
		"/",
		zValidator("json", validasiSchema, (hasil, c) => {
			if (!hasil.success) return zodString(hasil, c);
		}),
		async (c) => {
			const user = c.get("user");
			const { catatanId, aksi, catatan } = c.req.valid("json");
			if (aksi === "tolak" && !catatan?.trim()) {
				return c.json({ error: "Alasan wajib diisi saat menolak." }, 400);
			}

			const ids = await idBawahan(user.id);
			const rows = await db
				.select()
				.from(catatanHarian)
				.where(eq(catatanHarian.id, catatanId))
				.limit(1);
			const row = rows[0];
			if (!row || !ids.includes(row.pegawaiId))
				return c.json({ error: "Catatan tidak ditemukan." }, 404);
			if (row.status !== "SUBMIT") return c.json({ error: "Catatan ini sudah ditinjau." }, 400);

			const status = aksi === "setujui" ? "TERVERIFIKASI" : "DITOLAK";
			const now = new Date().toISOString();
			await db
				.update(catatanHarian)
				.set({
					status,
					catatanValidasi: catatan?.trim() || null,
					divalidasiOlehId: user.id,
					divalidasiPada: now,
					updatedAt: now,
				})
				.where(eq(catatanHarian.id, catatanId));

			await kirimNotifikasi({
				pegawaiId: row.pegawaiId,
				judul: aksi === "setujui" ? "Catatan disetujui" : "Catatan ditolak",
				isi:
					aksi === "setujui"
						? `Verifikasi ${new Date().toLocaleString("id-ID")}.`
						: `${catatan}. Perbaiki, lalu kirim lagi.`,
				tautan: "/app/catatan",
			});

			return c.json({ ok: true });
		},
	)
	.post(
		"/massal",
		zValidator("json", validasiMassalSchema, (hasil, c) => {
			if (!hasil.success) return zodString(hasil, c);
		}),
		async (c) => {
			const user = c.get("user");
			const { catatanIds } = c.req.valid("json");
			const unik = [...new Set(catatanIds)];
			const ids = await idBawahan(user.id);
			if (ids.length === 0)
				return c.json({ error: "Tidak ada catatan yang dapat disetujui." }, 400);

			const rows = await db.select().from(catatanHarian).where(inArray(catatanHarian.id, unik));
			if (
				rows.length !== unik.length ||
				rows.some((r) => !ids.includes(r.pegawaiId) || r.status !== "SUBMIT")
			) {
				return c.json({ error: "Sebagian catatan tidak bisa disetujui. Muat ulang antrian." }, 400);
			}

			const now = new Date().toISOString();
			await db
				.update(catatanHarian)
				.set({
					status: "TERVERIFIKASI",
					catatanValidasi: null,
					divalidasiOlehId: user.id,
					divalidasiPada: now,
					updatedAt: now,
				})
				.where(and(inArray(catatanHarian.id, unik), eq(catatanHarian.status, "SUBMIT")));

			const perPegawai = new Map<string, number>();
			for (const row of rows) {
				perPegawai.set(row.pegawaiId, (perPegawai.get(row.pegawaiId) ?? 0) + 1);
			}
			for (const [pegawaiId, jumlah] of perPegawai) {
				await kirimNotifikasi({
					pegawaiId,
					judul: "Catatan disetujui",
					isi:
						jumlah === 1
							? `Verifikasi ${new Date().toLocaleString("id-ID")}.`
							: `${jumlah} catatan disetujui. ${new Date().toLocaleString("id-ID")}.`,
					tautan: "/app/catatan",
				});
			}

			return c.json({ ok: true, jumlah: unik.length });
		},
	);
