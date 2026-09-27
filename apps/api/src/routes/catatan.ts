import {
	aktivitas,
	catatanHarian,
	db,
	pinKatalog,
	produk,
	skp,
	tahapan,
	usulanKatalog,
} from "@logbook/db";
import {
	adaOverlap,
	catatanSchema,
	durasiKalenderMenit,
	pinKatalogSchema,
	validasiWaktu,
} from "@logbook/schemas";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";
import { buatId } from "../lib/id";
import { kirimNotifikasi } from "../lib/notify";
import { requireAuth } from "../middleware/auth";

const KUOTA_PIN = 10;
const HARI_SERING = 30;

function kunciPin(
	jenis: "produk" | "jalur",
	produkId: string,
	tahapanId?: string,
	aktivitasId?: string,
) {
	if (jenis === "produk") return `produk:${produkId}`;
	return `jalur:${produkId}:${tahapanId ?? ""}:${aktivitasId ?? ""}`;
}

function hitungId(ids: (string | null)[]) {
	const map = new Map<string, number>();
	for (const id of ids) {
		if (!id) continue;
		map.set(id, (map.get(id) ?? 0) + 1);
	}
	return [...map.entries()]
		.map(([id, jumlah]) => ({ id, jumlah }))
		.sort((a, b) => b.jumlah - a.jumlah);
}

function tanggalSejak(hari: number) {
	const d = new Date();
	d.setDate(d.getDate() - hari);
	return d.toISOString().slice(0, 10);
}

export const catatanRoutes = new Hono()
	.use(requireAuth)
	.get("/", async (c) => {
		const user = c.get("user");
		const rows = await db
			.select({
				catatan: catatanHarian,
				produkNama: produk.nama,
				tahapanNama: tahapan.nama,
				aktivitasNama: aktivitas.nama,
			})
			.from(catatanHarian)
			.leftJoin(produk, eq(catatanHarian.produkId, produk.id))
			.leftJoin(tahapan, eq(catatanHarian.tahapanId, tahapan.id))
			.leftJoin(aktivitas, eq(catatanHarian.aktivitasId, aktivitas.id))
			.where(eq(catatanHarian.pegawaiId, user.id))
			.orderBy(desc(catatanHarian.waktuMulai));
		return c.json(rows);
	})
	.get("/pintasan", async (c) => {
		const user = c.get("user");
		const pins = await db
			.select()
			.from(pinKatalog)
			.where(eq(pinKatalog.pegawaiId, user.id))
			.orderBy(asc(pinKatalog.createdAt));

		const listProduk = await db.select().from(produk);
		const listTahapan = await db.select().from(tahapan);
		const listAktivitas = await db.select().from(aktivitas);
		const petaProduk = new Map(listProduk.map((p) => [p.id, p]));
		const petaTahapan = new Map(listTahapan.map((t) => [t.id, t]));
		const petaAktivitas = new Map(listAktivitas.map((a) => [a.id, a]));

		const pinProduk = pins
			.filter((p) => p.jenis === "produk")
			.map((p) => {
				const pr = petaProduk.get(p.produkId);
				return {
					id: p.id,
					produkId: p.produkId,
					nama: pr?.nama ?? "Produk tidak ditemukan",
					kode: pr?.kode ?? "",
					tersedia: Boolean(pr && pr.status === "aktif"),
				};
			});

		const pinJalur = pins
			.filter((p) => p.jenis === "jalur")
			.map((p) => {
				const pr = petaProduk.get(p.produkId);
				const th = p.tahapanId ? petaTahapan.get(p.tahapanId) : undefined;
				const ak = p.aktivitasId ? petaAktivitas.get(p.aktivitasId) : undefined;
				const produkAktif = Boolean(pr && pr.status === "aktif");
				const aktivitasAktif = !p.aktivitasId || Boolean(ak && ak.status === "aktif");
				const tahapanAda = Boolean(th && th.produkId === p.produkId);
				const aktivitasCocok = !p.aktivitasId || Boolean(ak && ak.tahapanId === p.tahapanId);
				return {
					id: p.id,
					produkId: p.produkId,
					tahapanId: p.tahapanId,
					aktivitasId: p.aktivitasId,
					produkNama: pr?.nama ?? "Produk tidak ditemukan",
					tahapanNama: th?.nama ?? "Tahapan tidak ditemukan",
					aktivitasNama: ak?.nama ?? null,
					produkKode: pr?.kode ?? "",
					tahapanKode: th?.kode ?? "",
					aktivitasKode: ak?.kode ?? "",
					tersedia: produkAktif && tahapanAda && aktivitasAktif && aktivitasCocok,
				};
			});

		const sejak = tanggalSejak(HARI_SERING);
		const riwayat = await db
			.select({
				produkId: catatanHarian.produkId,
				tahapanId: catatanHarian.tahapanId,
				aktivitasId: catatanHarian.aktivitasId,
			})
			.from(catatanHarian)
			.where(
				and(
					eq(catatanHarian.pegawaiId, user.id),
					eq(catatanHarian.isiManual, false),
					gte(catatanHarian.tanggal, sejak),
				),
			);

		const seringProduk = hitungId(riwayat.map((r) => r.produkId))
			.map((x) => {
				const pr = petaProduk.get(x.id);
				if (pr?.status !== "aktif") return null;
				return { id: pr.id, nama: pr.nama, kode: pr.kode, jumlah: x.jumlah };
			})
			.filter((x) => x !== null);

		const seringTahapan = hitungId(riwayat.map((r) => r.tahapanId))
			.map((x) => {
				const th = petaTahapan.get(x.id);
				if (!th) return null;
				const pr = petaProduk.get(th.produkId);
				if (pr?.status !== "aktif") return null;
				return { id: th.id, produkId: th.produkId, nama: th.nama, kode: th.kode, jumlah: x.jumlah };
			})
			.filter((x) => x !== null);

		const seringAktivitas = hitungId(riwayat.map((r) => r.aktivitasId))
			.map((x) => {
				const ak = petaAktivitas.get(x.id);
				if (ak?.status !== "aktif") return null;
				const th = petaTahapan.get(ak.tahapanId);
				if (!th) return null;
				const pr = petaProduk.get(th.produkId);
				if (pr?.status !== "aktif") return null;
				return {
					id: ak.id,
					tahapanId: ak.tahapanId,
					nama: ak.nama,
					kode: ak.kode,
					jumlah: x.jumlah,
				};
			})
			.filter((x) => x !== null);

		return c.json({ pinProduk, pinJalur, seringProduk, seringTahapan, seringAktivitas });
	})
	.post("/pin", zValidator("json", pinKatalogSchema), async (c) => {
		const user = c.get("user");
		const body = c.req.valid("json");

		const pr = (await db.select().from(produk).where(eq(produk.id, body.produkId)).limit(1))[0];
		if (pr?.status !== "aktif") {
			return c.json({ error: "Produk tidak tersedia." }, 400);
		}

		if (body.jenis === "jalur") {
			const th = (
				await db
					.select()
					.from(tahapan)
					.where(eq(tahapan.id, body.tahapanId ?? ""))
					.limit(1)
			)[0];
			if (!th || th.produkId !== body.produkId) {
				return c.json({ error: "Tahapan tidak sesuai produk." }, 400);
			}
			if (body.aktivitasId) {
				const ak = (
					await db.select().from(aktivitas).where(eq(aktivitas.id, body.aktivitasId)).limit(1)
				)[0];
				if (ak?.status !== "aktif" || ak.tahapanId !== th.id) {
					return c.json({ error: "Aktivitas tidak sesuai tahapan." }, 400);
				}
			}
		}

		const kunci = kunciPin(body.jenis, body.produkId, body.tahapanId, body.aktivitasId);
		const sudah = (
			await db
				.select({ id: pinKatalog.id })
				.from(pinKatalog)
				.where(and(eq(pinKatalog.pegawaiId, user.id), eq(pinKatalog.kunci, kunci)))
				.limit(1)
		)[0];
		if (sudah) return c.json({ id: sudah.id, sudahAda: true });

		const jumlah = await db
			.select({ id: pinKatalog.id })
			.from(pinKatalog)
			.where(and(eq(pinKatalog.pegawaiId, user.id), eq(pinKatalog.jenis, body.jenis)));
		if (jumlah.length >= KUOTA_PIN) {
			return c.json(
				{
					error:
						body.jenis === "produk"
							? "Maksimal 10 produk disematkan. Lepas salah satu, lalu sematkan lagi."
							: "Maksimal 10 jalur disematkan. Lepas salah satu, lalu sematkan lagi.",
				},
				400,
			);
		}

		const id = buatId("pin");
		await db.insert(pinKatalog).values({
			id,
			pegawaiId: user.id,
			jenis: body.jenis,
			produkId: body.produkId,
			tahapanId: body.jenis === "jalur" ? body.tahapanId || null : null,
			aktivitasId: body.jenis === "jalur" ? body.aktivitasId || null : null,
			kunci,
			urutan: jumlah.length + 1,
		});
		return c.json({ id });
	})
	.delete("/pin/:id", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const row = (
			await db
				.select({ id: pinKatalog.id })
				.from(pinKatalog)
				.where(and(eq(pinKatalog.id, id), eq(pinKatalog.pegawaiId, user.id)))
				.limit(1)
		)[0];
		if (!row) return c.json({ error: "Sematan tidak ditemukan." }, 404);
		await db.delete(pinKatalog).where(eq(pinKatalog.id, id));
		return c.json({ ok: true });
	})
	.post(
		"/",
		zValidator("json", catatanSchema, (hasil, c) => {
			if (!hasil.success) {
				const first = hasil.error.issues[0];
				const field = first?.path[0];
				return c.json(
					{
						error:
							first?.message ?? "Isian belum lengkap. Periksa uraian, waktu, dan menit efektif.",
						field: typeof field === "string" ? field : undefined,
					},
					400,
				);
			}
		}),
		async (c) => {
			const user = c.get("user");
			const body = c.req.valid("json");
			const errors = validasiWaktu(body.waktuMulai, body.waktuSelesai, body.menitEfektif);
			if (errors[0]) return c.json({ error: errors[0] }, 400);

			if (body.isiManual && (!body.namaManualProduk?.trim() || !body.namaManualTahapan?.trim())) {
				return c.json({ error: "Isi manual wajib nama produk dan tahapan usulan." }, 400);
			}
			if (!body.isiManual && (!body.produkId || !body.tahapanId)) {
				return c.json({ error: "Pilih produk dan tahapan, atau centang isi manual." }, 400);
			}

			const milik = await db
				.select()
				.from(catatanHarian)
				.where(eq(catatanHarian.pegawaiId, user.id));
			const overlap = milik.some(
				(row) =>
					row.status !== "DITOLAK" &&
					adaOverlap(body.waktuMulai, body.waktuSelesai, row.waktuMulai, row.waktuSelesai),
			);

			const id = buatId("ctt");
			const tanggal = body.waktuMulai.slice(0, 10);
			await db.insert(catatanHarian).values({
				id,
				pegawaiId: user.id,
				tanggal,
				jenisTugas: body.jenisTugas,
				produkId: body.isiManual ? null : body.produkId || null,
				tahapanId: body.isiManual ? null : body.tahapanId || null,
				aktivitasId: body.isiManual ? null : body.aktivitasId || null,
				isiManual: body.isiManual,
				namaManualProduk: body.namaManualProduk,
				namaManualTahapan: body.namaManualTahapan,
				usulanNormaWaktu: body.usulanNormaWaktu,
				uraian: body.uraian,
				waktuMulai: body.waktuMulai,
				waktuSelesai: body.waktuSelesai,
				menitEfektif: body.menitEfektif,
				jumlahOutput: Math.round(body.jumlahOutput),
				satuanOutput: body.satuanOutput,
				kategori: body.kategori,
				buktiUrl: body.buktiUrl || null,
				buktiJudul: body.buktiJudul,
				status: "DRAFT",
			});

			return c.json({
				id,
				peringatanOverlap: overlap
					? "Waktu tumpang tindih dengan catatan lain. Catatan tetap disimpan."
					: null,
				selisihEvaluasi:
					durasiKalenderMenit(body.waktuMulai, body.waktuSelesai) - body.menitEfektif,
			});
		},
	)
	.post("/:id/submit", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const rows = await db
			.select()
			.from(catatanHarian)
			.where(and(eq(catatanHarian.id, id), eq(catatanHarian.pegawaiId, user.id)))
			.limit(1);
		const row = rows[0];
		if (!row) return c.json({ error: "Catatan tidak ditemukan." }, 404);
		if (row.status === "TERVERIFIKASI") {
			return c.json({ error: "Catatan terverifikasi tidak dapat diubah." }, 400);
		}

		await db
			.update(catatanHarian)
			.set({ status: "SUBMIT", updatedAt: new Date().toISOString() })
			.where(eq(catatanHarian.id, id));

		if (row.isiManual) {
			await db.insert(usulanKatalog).values({
				id: buatId("usl"),
				catatanHarianId: id,
				pegawaiId: user.id,
				namaProduk: row.namaManualProduk ?? "",
				namaTahapan: row.namaManualTahapan ?? "",
				normaWaktu: row.usulanNormaWaktu,
				status: "MENUNGGU",
			});
		}

		const tahun = new Date().getFullYear();
		const skpSaya = await db
			.select()
			.from(skp)
			.where(and(eq(skp.pegawaiId, user.id), eq(skp.tahun, tahun)))
			.limit(1);
		const atasanId = skpSaya[0]?.pemberiPertimbanganId;
		if (atasanId) {
			await kirimNotifikasi({
				pegawaiId: atasanId,
				judul: "Menunggu validasi",
				isi: `Catatan dari ${user.namaLengkap}.`,
				tautan: "/app/validasi",
			});
		}

		return c.json({ ok: true });
	});
