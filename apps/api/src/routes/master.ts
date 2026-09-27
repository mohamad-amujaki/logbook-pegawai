import {
	aktivitas,
	catatanHarian,
	db,
	hashPassword,
	iki,
	notifikasi,
	pegawai,
	produk,
	rencanaAksi,
	rhk,
	rhkPimpinan,
	sesi,
	skp,
	tahapan,
	timKerja,
	unitKerja,
	usulanKatalog,
} from "@logbook/db";
import {
	aktivitasSchema,
	anggotaTimSchema,
	pegawaiBaruSchema,
	pegawaiUbahSchema,
	produkSchema,
	tahapanSchema,
	timKerjaSchema,
	timKerjaUbahSchema,
	unitKerjaBaruSchema,
	unitKerjaUbahSchema,
} from "@logbook/schemas";
import { zValidator } from "@hono/zod-validator";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { buatId } from "../lib/id";
import { requireAuth } from "../middleware/auth";

function adminOnly(user: { isAdmin: boolean; isKepalaBiro: boolean }) {
	return user.isAdmin || user.isKepalaBiro;
}

async function pastikanUnitDanTim(unitKerjaId: string, timKerjaId: string | null | undefined) {
	const unit = (
		await db
			.select({ id: unitKerja.id, indukId: unitKerja.indukId })
			.from(unitKerja)
			.where(eq(unitKerja.id, unitKerjaId))
			.limit(1)
	)[0];
	if (!unit) return { error: "Unit kerja tidak ditemukan.", field: "unitKerjaId" as const };
	if (!unit.indukId)
		return { error: "Pilih unit kerja, bukan Eselon I.", field: "unitKerjaId" as const };
	if (!timKerjaId) return null;
	const tim = (
		await db
			.select({ id: timKerja.id, unitKerjaId: timKerja.unitKerjaId })
			.from(timKerja)
			.where(eq(timKerja.id, timKerjaId))
			.limit(1)
	)[0];
	if (!tim) return { error: "Tim kerja tidak ditemukan.", field: "timKerjaId" as const };
	if (tim.unitKerjaId !== unitKerjaId) {
		return { error: "Tim kerja harus dari unit yang sama.", field: "timKerjaId" as const };
	}
	return null;
}

export const masterRoutes = new Hono()
	.use(requireAuth)
	.get("/katalog", async (c) => {
		const hanyaAktif = c.req.query("hanyaAktif") === "1";
		let listProduk = await db.select().from(produk).orderBy(asc(produk.nama));
		let listTahapan = await db.select().from(tahapan).orderBy(asc(tahapan.urutan));
		let listAktivitas = await db.select().from(aktivitas).orderBy(asc(aktivitas.nama));
		if (hanyaAktif) {
			listProduk = listProduk.filter((p) => p.status === "aktif");
			const produkAktif = new Set(listProduk.map((p) => p.id));
			listTahapan = listTahapan.filter((t) => produkAktif.has(t.produkId));
			const tahapanAda = new Set(listTahapan.map((t) => t.id));
			listAktivitas = listAktivitas.filter(
				(a) => a.status === "aktif" && tahapanAda.has(a.tahapanId),
			);
		}
		return c.json({ produk: listProduk, tahapan: listTahapan, aktivitas: listAktivitas });
	})
	.post("/produk", zValidator("json", produkSchema), async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const body = c.req.valid("json");
		const id = buatId("prd");
		try {
			await db.insert(produk).values({
				id,
				kode: body.kode.trim(),
				nama: body.nama.trim(),
				kodeProsesL1: body.kodeProsesL1?.trim() || null,
				status: body.status,
			});
		} catch {
			return c.json(
				{ error: "Kode sudah dipakai. Ganti kode, lalu simpan lagi.", field: "kode" },
				400,
			);
		}
		return c.json({ id });
	})
	.put("/produk/:id", zValidator("json", produkSchema), async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		const body = c.req.valid("json");
		const ada = await db.select({ id: produk.id }).from(produk).where(eq(produk.id, id)).limit(1);
		if (!ada[0]) return c.json({ error: "Produk/proses bisnis tidak ditemukan." }, 404);
		try {
			await db
				.update(produk)
				.set({
					kode: body.kode.trim(),
					nama: body.nama.trim(),
					kodeProsesL1: body.kodeProsesL1?.trim() || null,
					status: body.status,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(produk.id, id));
		} catch {
			return c.json(
				{ error: "Kode sudah dipakai. Ganti kode, lalu simpan lagi.", field: "kode" },
				400,
			);
		}
		return c.json({ ok: true });
	})
	.delete("/produk/:id", async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		const ada = (
			await db
				.select({ id: produk.id, nama: produk.nama })
				.from(produk)
				.where(eq(produk.id, id))
				.limit(1)
		)[0];
		if (!ada) return c.json({ error: "Produk/proses bisnis tidak ditemukan." }, 404);
		const jumlahTahapan =
			(await db.select({ jumlah: count() }).from(tahapan).where(eq(tahapan.produkId, id)))[0]
				?.jumlah ?? 0;
		if (jumlahTahapan > 0) {
			return c.json({ error: "Masih punya tahapan. Pindahkan atau hapus tahapannya dulu." }, 400);
		}
		const jumlahCatatan =
			(
				await db
					.select({ jumlah: count() })
					.from(catatanHarian)
					.where(eq(catatanHarian.produkId, id))
			)[0]?.jumlah ?? 0;
		if (jumlahCatatan > 0) {
			return c.json({ error: "Masih dipakai catatan harian. Nonaktifkan saja lewat Ubah." }, 400);
		}
		await db.delete(produk).where(eq(produk.id, id));
		return c.json({ ok: true, nama: ada.nama });
	})
	.post("/tahapan", zValidator("json", tahapanSchema), async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const body = c.req.valid("json");
		const id = buatId("thp");
		try {
			await db.insert(tahapan).values({
				id,
				kode: body.kode.trim(),
				nama: body.nama.trim(),
				produkId: body.produkId,
				urutan: body.urutan,
			});
		} catch {
			return c.json(
				{ error: "Kode sudah dipakai. Ganti kode, lalu simpan lagi.", field: "kode" },
				400,
			);
		}
		return c.json({ id });
	})
	.put("/tahapan/:id", zValidator("json", tahapanSchema), async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		const body = c.req.valid("json");
		const ada = await db
			.select({ id: tahapan.id })
			.from(tahapan)
			.where(eq(tahapan.id, id))
			.limit(1);
		if (!ada[0]) return c.json({ error: "Tahapan tidak ditemukan." }, 404);
		const induk = await db
			.select({ id: produk.id })
			.from(produk)
			.where(eq(produk.id, body.produkId))
			.limit(1);
		if (!induk[0])
			return c.json({ error: "Produk/proses bisnis tidak ditemukan.", field: "produkId" }, 400);
		try {
			await db
				.update(tahapan)
				.set({
					kode: body.kode.trim(),
					nama: body.nama.trim(),
					produkId: body.produkId,
					urutan: body.urutan,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(tahapan.id, id));
		} catch {
			return c.json(
				{ error: "Kode sudah dipakai. Ganti kode, lalu simpan lagi.", field: "kode" },
				400,
			);
		}
		return c.json({ ok: true });
	})
	.delete("/tahapan/:id", async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		const ada = (
			await db
				.select({ id: tahapan.id, nama: tahapan.nama })
				.from(tahapan)
				.where(eq(tahapan.id, id))
				.limit(1)
		)[0];
		if (!ada) return c.json({ error: "Tahapan tidak ditemukan." }, 404);
		const jumlahAktivitas =
			(await db.select({ jumlah: count() }).from(aktivitas).where(eq(aktivitas.tahapanId, id)))[0]
				?.jumlah ?? 0;
		if (jumlahAktivitas > 0) {
			return c.json(
				{ error: "Masih punya aktivitas. Pindahkan atau hapus aktivitasnya dulu." },
				400,
			);
		}
		const jumlahCatatan =
			(
				await db
					.select({ jumlah: count() })
					.from(catatanHarian)
					.where(eq(catatanHarian.tahapanId, id))
			)[0]?.jumlah ?? 0;
		if (jumlahCatatan > 0) {
			return c.json({ error: "Masih dipakai catatan harian. Ubah dulu, jangan dihapus." }, 400);
		}
		await db.delete(tahapan).where(eq(tahapan.id, id));
		return c.json({ ok: true, nama: ada.nama });
	})
	.post("/aktivitas", zValidator("json", aktivitasSchema), async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const body = c.req.valid("json");
		const id = buatId("akt");
		try {
			await db.insert(aktivitas).values({
				id,
				kode: body.kode.trim(),
				nama: body.nama.trim(),
				tahapanId: body.tahapanId,
				uraian: body.uraian,
				normaWaktuMenit: Math.round(body.normaWaktuMenit),
				status: body.status,
			});
		} catch {
			return c.json(
				{ error: "Kode sudah dipakai. Ganti kode, lalu simpan lagi.", field: "kode" },
				400,
			);
		}
		return c.json({ id });
	})
	.put("/aktivitas/:id", zValidator("json", aktivitasSchema), async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		const body = c.req.valid("json");
		const ada = await db
			.select({ id: aktivitas.id })
			.from(aktivitas)
			.where(eq(aktivitas.id, id))
			.limit(1);
		if (!ada[0]) return c.json({ error: "Aktivitas tidak ditemukan." }, 404);
		const induk = await db
			.select({ id: tahapan.id })
			.from(tahapan)
			.where(eq(tahapan.id, body.tahapanId))
			.limit(1);
		if (!induk[0]) return c.json({ error: "Tahapan tidak ditemukan.", field: "tahapanId" }, 400);
		try {
			await db
				.update(aktivitas)
				.set({
					kode: body.kode.trim(),
					nama: body.nama.trim(),
					tahapanId: body.tahapanId,
					uraian: body.uraian,
					normaWaktuMenit: Math.round(body.normaWaktuMenit),
					status: body.status,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(aktivitas.id, id));
		} catch {
			return c.json(
				{ error: "Kode sudah dipakai. Ganti kode, lalu simpan lagi.", field: "kode" },
				400,
			);
		}
		return c.json({ ok: true });
	})
	.delete("/aktivitas/:id", async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		const ada = (
			await db
				.select({ id: aktivitas.id, nama: aktivitas.nama })
				.from(aktivitas)
				.where(eq(aktivitas.id, id))
				.limit(1)
		)[0];
		if (!ada) return c.json({ error: "Aktivitas tidak ditemukan." }, 404);
		const jumlahCatatan =
			(
				await db
					.select({ jumlah: count() })
					.from(catatanHarian)
					.where(eq(catatanHarian.aktivitasId, id))
			)[0]?.jumlah ?? 0;
		if (jumlahCatatan > 0) {
			return c.json({ error: "Masih dipakai catatan harian. Nonaktifkan saja lewat Ubah." }, 400);
		}
		await db.delete(aktivitas).where(eq(aktivitas.id, id));
		return c.json({ ok: true, nama: ada.nama });
	})
	.get("/tim", async (c) => {
		const rows = await db.select().from(timKerja).orderBy(asc(timKerja.urutan));
		const orang = await db
			.select({
				id: pegawai.id,
				namaLengkap: pegawai.namaLengkap,
				nip: pegawai.nip,
				timKerjaId: pegawai.timKerjaId,
			})
			.from(pegawai);
		const hitung = await db
			.select({ timKerjaId: pegawai.timKerjaId, jumlah: count() })
			.from(pegawai)
			.groupBy(pegawai.timKerjaId);
		const jumlah = new Map(
			hitung.filter((h) => h.timKerjaId).map((h) => [h.timKerjaId as string, h.jumlah]),
		);
		return c.json(
			rows.map((t) => {
				const ketua = orang.find((p) => p.id === t.ketuaPegawaiId) ?? null;
				return {
					...t,
					ketuaNama: ketua?.namaLengkap ?? null,
					ketuaNip: ketua?.nip ?? null,
					jumlahAnggota: jumlah.get(t.id) ?? 0,
				};
			}),
		);
	})
	.post("/tim", zValidator("json", timKerjaSchema), async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const body = c.req.valid("json");
		const salahUnit = await pastikanUnitDanTim(body.unitKerjaId, null);
		if (salahUnit) return c.json(salahUnit, 400);
		const id = buatId("tim");
		await db.insert(timKerja).values({
			id,
			kode: body.kode,
			nama: body.nama,
			unitKerjaId: body.unitKerjaId,
			status: body.status,
			urutan: body.urutan,
		});
		return c.json({ id });
	})
	.put("/tim/:id", zValidator("json", timKerjaUbahSchema), async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		const body = c.req.valid("json");
		const ada = await db
			.select({ id: timKerja.id })
			.from(timKerja)
			.where(eq(timKerja.id, id))
			.limit(1);
		if (!ada[0]) return c.json({ error: "Tim kerja tidak ditemukan." }, 404);
		if (body.ketuaPegawaiId) {
			const ketua = await db
				.select({ id: pegawai.id })
				.from(pegawai)
				.where(eq(pegawai.id, body.ketuaPegawaiId))
				.limit(1);
			if (!ketua[0]) return c.json({ error: "Pegawai untuk ketua tim tidak ditemukan." }, 400);
		}
		const sekarang = new Date().toISOString();
		try {
			if (body.ketuaPegawaiId) {
				await db
					.update(timKerja)
					.set({ ketuaPegawaiId: null, updatedAt: sekarang })
					.where(eq(timKerja.ketuaPegawaiId, body.ketuaPegawaiId));
				await db
					.update(pegawai)
					.set({ timKerjaId: id, updatedAt: sekarang })
					.where(eq(pegawai.id, body.ketuaPegawaiId));
			}
			await db
				.update(timKerja)
				.set({
					kode: body.kode,
					nama: body.nama,
					status: body.status,
					ketuaPegawaiId: body.ketuaPegawaiId,
					updatedAt: sekarang,
				})
				.where(eq(timKerja.id, id));
		} catch {
			return c.json({ error: "Kode tim sudah dipakai. Ganti kode, lalu simpan lagi." }, 400);
		}
		return c.json({ ok: true });
	})
	.post("/anggota-tim", zValidator("json", anggotaTimSchema), async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const body = c.req.valid("json");
		const tujuan = (
			await db
				.select({ id: timKerja.id, unitKerjaId: timKerja.unitKerjaId })
				.from(timKerja)
				.where(eq(timKerja.id, body.timKerjaId))
				.limit(1)
		)[0];
		if (!tujuan) return c.json({ error: "Tim kerja tidak ditemukan.", field: "timKerjaId" }, 400);
		const unitTujuan = (
			await db
				.select({ id: unitKerja.id, indukId: unitKerja.indukId })
				.from(unitKerja)
				.where(eq(unitKerja.id, tujuan.unitKerjaId))
				.limit(1)
		)[0];
		if (!unitTujuan?.indukId) {
			return c.json(
				{ error: "Tim harus di unit kerja, bukan di Eselon I.", field: "timKerjaId" },
				400,
			);
		}
		const sebelum = await db
			.select({ id: pegawai.id, timKerjaId: pegawai.timKerjaId })
			.from(pegawai)
			.where(inArray(pegawai.id, body.pegawaiIds));
		const sekarang = new Date().toISOString();
		await db
			.update(pegawai)
			.set({ timKerjaId: body.timKerjaId, unitKerjaId: tujuan.unitKerjaId, updatedAt: sekarang })
			.where(inArray(pegawai.id, body.pegawaiIds));
		for (const p of sebelum) {
			if (p.timKerjaId && p.timKerjaId !== body.timKerjaId) {
				await db
					.update(timKerja)
					.set({ ketuaPegawaiId: null, updatedAt: sekarang })
					.where(and(eq(timKerja.id, p.timKerjaId), eq(timKerja.ketuaPegawaiId, p.id)));
			}
		}
		return c.json({ ok: true, jumlah: body.pegawaiIds.length });
	})
	.get("/pegawai", async (c) => {
		const rows = await db
			.select({
				id: pegawai.id,
				nip: pegawai.nip,
				namaLengkap: pegawai.namaLengkap,
				jabatan: pegawai.jabatan,
				pangkatGolongan: pegawai.pangkatGolongan,
				tmt: pegawai.tmt,
				unitKerjaId: pegawai.unitKerjaId,
				unitNama: unitKerja.nama,
				unitKode: unitKerja.kode,
				indukId: unitKerja.indukId,
				timKerjaId: pegawai.timKerjaId,
				timNama: timKerja.nama,
				isAdmin: pegawai.isAdmin,
				isKepalaBiro: pegawai.isKepalaBiro,
			})
			.from(pegawai)
			.innerJoin(unitKerja, eq(pegawai.unitKerjaId, unitKerja.id))
			.leftJoin(timKerja, eq(pegawai.timKerjaId, timKerja.id))
			.orderBy(asc(pegawai.namaLengkap));
		const induk = await db
			.select({ id: unitKerja.id, nama: unitKerja.nama, kode: unitKerja.kode })
			.from(unitKerja);
		const petaInduk = new Map(induk.map((u) => [u.id, u]));
		return c.json(
			rows.map((r) => ({
				...r,
				indukNama: r.indukId ? (petaInduk.get(r.indukId)?.nama ?? null) : null,
				indukKode: r.indukId ? (petaInduk.get(r.indukId)?.kode ?? null) : null,
			})),
		);
	})
	.post("/pegawai", async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const parsed = pegawaiBaruSchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return c.json(
				{ error: first?.message ?? "Data pegawai belum lengkap.", field: first?.path[0] },
				400,
			);
		}
		const body = parsed.data;
		const salahUnit = await pastikanUnitDanTim(body.unitKerjaId, body.timKerjaId);
		if (salahUnit) return c.json(salahUnit, 400);
		const adaNip = await db
			.select({ id: pegawai.id })
			.from(pegawai)
			.where(eq(pegawai.nip, body.nip))
			.limit(1);
		if (adaNip[0]) {
			return c.json(
				{ error: "NIP sudah terdaftar. Cek data yang ada, atau ubah NIP.", field: "nip" },
				400,
			);
		}
		const id = buatId("pg");
		const now = new Date().toISOString();
		await db.insert(pegawai).values({
			id,
			nip: body.nip,
			namaLengkap: body.namaLengkap,
			pangkatGolongan: body.pangkatGolongan,
			tmt: body.tmt || null,
			jabatan: body.jabatan,
			unitKerjaId: body.unitKerjaId,
			timKerjaId: body.timKerjaId || null,
			passwordHash: await hashPassword(body.nip),
			wajibGantiSandi: true,
			isAdmin: body.isAdmin,
			isKepalaBiro: body.isKepalaBiro,
			createdAt: now,
			updatedAt: now,
		});
		return c.json({ id });
	})
	.put("/pegawai/:id", async (c) => {
		const user = c.get("user");
		if (!adminOnly(user)) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		const parsed = pegawaiUbahSchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return c.json(
				{ error: first?.message ?? "Data pegawai belum lengkap.", field: first?.path[0] },
				400,
			);
		}
		const body = parsed.data;
		const lama = (
			await db
				.select({ id: pegawai.id, timKerjaId: pegawai.timKerjaId, isAdmin: pegawai.isAdmin })
				.from(pegawai)
				.where(eq(pegawai.id, id))
				.limit(1)
		)[0];
		if (!lama) return c.json({ error: "Pegawai tidak ditemukan." }, 404);
		if (id === user.id && lama.isAdmin && !body.isAdmin) {
			return c.json(
				{ error: "Anda tidak dapat mencabut peran admin dari akun sendiri.", field: "isAdmin" },
				400,
			);
		}
		const salahUnit = await pastikanUnitDanTim(body.unitKerjaId, body.timKerjaId);
		if (salahUnit) return c.json(salahUnit, 400);
		const bentrok = await db
			.select({ id: pegawai.id })
			.from(pegawai)
			.where(eq(pegawai.nip, body.nip))
			.limit(1);
		if (bentrok[0] && bentrok[0].id !== id) {
			return c.json({ error: "NIP sudah dipakai pegawai lain.", field: "nip" }, 400);
		}
		const now = new Date().toISOString();
		const timBaru = body.timKerjaId || null;
		if (lama.timKerjaId && lama.timKerjaId !== timBaru) {
			await db
				.update(timKerja)
				.set({ ketuaPegawaiId: null, updatedAt: now })
				.where(and(eq(timKerja.id, lama.timKerjaId), eq(timKerja.ketuaPegawaiId, id)));
		}
		const ubah: {
			nip: string;
			namaLengkap: string;
			pangkatGolongan: string;
			tmt: string | null;
			jabatan: string;
			unitKerjaId: string;
			timKerjaId: string | null;
			isAdmin: boolean;
			isKepalaBiro: boolean;
			updatedAt: string;
			passwordHash?: string;
			wajibGantiSandi?: boolean;
		} = {
			nip: body.nip,
			namaLengkap: body.namaLengkap,
			pangkatGolongan: body.pangkatGolongan,
			tmt: body.tmt || null,
			jabatan: body.jabatan,
			unitKerjaId: body.unitKerjaId,
			timKerjaId: timBaru,
			isAdmin: body.isAdmin,
			isKepalaBiro: body.isKepalaBiro,
			updatedAt: now,
		};
		if (body.resetSandi) {
			ubah.passwordHash = await hashPassword(body.nip);
			ubah.wajibGantiSandi = true;
		}
		await db.update(pegawai).set(ubah).where(eq(pegawai.id, id));
		return c.json({ ok: true });
	})
	.delete("/pegawai/:id", async (c) => {
		const user = c.get("user");
		if (!adminOnly(user)) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		if (id === user.id) {
			return c.json({ error: "Anda tidak dapat menghapus akun yang sedang dipakai." }, 400);
		}
		const ada = (
			await db
				.select({ id: pegawai.id, namaLengkap: pegawai.namaLengkap })
				.from(pegawai)
				.where(eq(pegawai.id, id))
				.limit(1)
		)[0];
		if (!ada) return c.json({ error: "Pegawai tidak ditemukan." }, 404);

		const now = new Date().toISOString();
		await db
			.update(timKerja)
			.set({ ketuaPegawaiId: null, updatedAt: now })
			.where(eq(timKerja.ketuaPegawaiId, id));
		await db
			.update(skp)
			.set({ pemberiPertimbanganId: null, updatedAt: now })
			.where(eq(skp.pemberiPertimbanganId, id));
		await db
			.update(skp)
			.set({ pejabatPenilaiId: null, updatedAt: now })
			.where(eq(skp.pejabatPenilaiId, id));
		await db
			.update(skp)
			.set({ atasanPejabatPenilaiId: null, updatedAt: now })
			.where(eq(skp.atasanPejabatPenilaiId, id));
		await db
			.update(catatanHarian)
			.set({ divalidasiOlehId: null, updatedAt: now })
			.where(eq(catatanHarian.divalidasiOlehId, id));

		const milikSkp = await db.select({ id: skp.id }).from(skp).where(eq(skp.pegawaiId, id));
		for (const h of milikSkp) await hapusPohonSkp(h.id);

		const catatan = await db
			.select({ id: catatanHarian.id })
			.from(catatanHarian)
			.where(eq(catatanHarian.pegawaiId, id));
		const catatanIds = catatan.map((row) => row.id);
		if (catatanIds.length > 0) {
			await db.delete(usulanKatalog).where(inArray(usulanKatalog.catatanHarianId, catatanIds));
		}
		await db.delete(usulanKatalog).where(eq(usulanKatalog.pegawaiId, id));
		await db.delete(catatanHarian).where(eq(catatanHarian.pegawaiId, id));
		await db.delete(notifikasi).where(eq(notifikasi.pegawaiId, id));
		await db.delete(sesi).where(eq(sesi.pegawaiId, id));
		await db.delete(pegawai).where(eq(pegawai.id, id));
		return c.json({ ok: true, nama: ada.namaLengkap });
	})
	.get("/unit", async (c) => {
		return c.json(await daftarUnit());
	})
	.post("/unit", async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const parsed = unitKerjaBaruSchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return c.json(
				{ error: first?.message ?? "Nama minimal 3 karakter.", field: first?.path[0] },
				400,
			);
		}
		const nama = parsed.data.nama;
		const indukId = parsed.data.indukId ?? null;
		const induk = await pastikanInduk(indukId);
		if ("error" in induk) return c.json(induk, 400);
		if (await namaSaudaraAda(nama, indukId)) {
			return c.json(
				{
					error: indukId
						? "Nama unit kerja ini sudah ada di Eselon I yang sama."
						: "Eselon I dengan nama ini sudah ada.",
					field: "nama",
				},
				400,
			);
		}
		const kodePakai = await kodeUnitUnik(parsed.data.kode || kodeDariNama(nama));
		const now = new Date().toISOString();
		const id = buatId("unit");
		await db.insert(unitKerja).values({
			id,
			kode: kodePakai,
			nama,
			indukId,
			status: "aktif",
			createdAt: now,
			updatedAt: now,
		});
		return c.json({ id, kode: kodePakai, nama, indukId, status: "aktif" });
	})
	.put("/unit/:id", async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		const parsed = unitKerjaUbahSchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return c.json(
				{ error: first?.message ?? "Data unit belum lengkap.", field: first?.path[0] },
				400,
			);
		}
		const lama = (
			await db
				.select({
					id: unitKerja.id,
					kode: unitKerja.kode,
					indukId: unitKerja.indukId,
				})
				.from(unitKerja)
				.where(eq(unitKerja.id, id))
				.limit(1)
		)[0];
		if (!lama) return c.json({ error: "Unit tidak ditemukan." }, 404);
		const indukId = parsed.data.indukId === undefined ? lama.indukId : parsed.data.indukId;
		if (indukId === id)
			return c.json(
				{ error: "Unit tidak dapat menjadi induk dirinya sendiri.", field: "indukId" },
				400,
			);
		const induk = await pastikanInduk(indukId);
		if ("error" in induk) return c.json(induk, 400);
		const jumlahAnak = await db
			.select({ jumlah: count() })
			.from(unitKerja)
			.where(eq(unitKerja.indukId, id));
		if ((jumlahAnak[0]?.jumlah ?? 0) > 0 && indukId) {
			return c.json(
				{
					error: "Eselon I yang masih punya unit kerja tidak dapat digeser menjadi unit.",
					field: "indukId",
				},
				400,
			);
		}
		if (!indukId && lama.indukId) {
			const isi = await isiUnit(id);
			if (isi.jumlahPegawai > 0 || isi.jumlahTim > 0) {
				return c.json(
					{ error: "Unit yang masih punya pegawai atau tim tidak dapat dijadikan Eselon I." },
					400,
				);
			}
		}
		if (await namaSaudaraAda(parsed.data.nama, indukId, id)) {
			return c.json(
				{
					error: indukId
						? "Nama unit kerja ini sudah ada di Eselon I yang sama."
						: "Eselon I dengan nama ini sudah ada.",
					field: "nama",
				},
				400,
			);
		}
		const kodePakai = parsed.data.kode?.trim()
			? await kodeUnitUnikUntuk(parsed.data.kode, id)
			: lama.kode;
		try {
			await db
				.update(unitKerja)
				.set({
					nama: parsed.data.nama,
					kode: kodePakai,
					indukId,
					status: parsed.data.status,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(unitKerja.id, id));
		} catch {
			return c.json({ error: "Kode sudah dipakai unit lain.", field: "kode" }, 400);
		}
		return c.json({ ok: true });
	})
	.delete("/unit/:id", async (c) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya admin." }, 403);
		const id = c.req.param("id");
		const ada = (
			await db
				.select({ id: unitKerja.id, nama: unitKerja.nama, indukId: unitKerja.indukId })
				.from(unitKerja)
				.where(eq(unitKerja.id, id))
				.limit(1)
		)[0];
		if (!ada) return c.json({ error: "Unit tidak ditemukan." }, 404);
		const jumlahAnak =
			(await db.select({ jumlah: count() }).from(unitKerja).where(eq(unitKerja.indukId, id)))[0]
				?.jumlah ?? 0;
		if (jumlahAnak > 0) {
			return c.json(
				{ error: "Eselon I masih punya unit kerja. Pindahkan atau hapus unitnya dulu." },
				400,
			);
		}
		const isi = await isiUnit(id);
		if (isi.jumlahPegawai > 0 || isi.jumlahTim > 0) {
			return c.json(
				{ error: "Unit masih dipakai pegawai atau tim. Pindahkan dulu, atau nonaktifkan." },
				400,
			);
		}
		await db.delete(unitKerja).where(eq(unitKerja.id, id));
		return c.json({ ok: true, nama: ada.nama });
	});

async function daftarUnit() {
	const rows = await db.select().from(unitKerja).orderBy(asc(unitKerja.nama));
	const peta = new Map(rows.map((u) => [u.id, u]));
	const hitungPegawai = await db
		.select({ unitKerjaId: pegawai.unitKerjaId, jumlah: count() })
		.from(pegawai)
		.groupBy(pegawai.unitKerjaId);
	const hitungTim = await db
		.select({ unitKerjaId: timKerja.unitKerjaId, jumlah: count() })
		.from(timKerja)
		.groupBy(timKerja.unitKerjaId);
	const pegawaiMap = new Map(hitungPegawai.map((h) => [h.unitKerjaId, h.jumlah]));
	const timMap = new Map(hitungTim.map((h) => [h.unitKerjaId, h.jumlah]));
	return rows.map((u) => {
		const induk = u.indukId ? peta.get(u.indukId) : null;
		return {
			id: u.id,
			kode: u.kode,
			nama: u.nama,
			indukId: u.indukId,
			indukNama: induk?.nama ?? null,
			indukKode: induk?.kode ?? null,
			status: u.status,
			jumlahPegawai: pegawaiMap.get(u.id) ?? 0,
			jumlahTim: timMap.get(u.id) ?? 0,
			jumlahAnak: rows.filter((x) => x.indukId === u.id).length,
		};
	});
}

async function pastikanInduk(indukId: string | null) {
	if (!indukId) return { ok: true as const };
	const induk = (
		await db
			.select({ id: unitKerja.id, indukId: unitKerja.indukId })
			.from(unitKerja)
			.where(eq(unitKerja.id, indukId))
			.limit(1)
	)[0];
	if (!induk) return { error: "Eselon I tidak ditemukan.", field: "indukId" as const };
	if (induk.indukId)
		return { error: "Induk harus Eselon I, bukan unit kerja.", field: "indukId" as const };
	return { ok: true as const };
}

async function namaSaudaraAda(nama: string, indukId: string | null, kecualiId?: string) {
	const rows = await db
		.select({ id: unitKerja.id, nama: unitKerja.nama, indukId: unitKerja.indukId })
		.from(unitKerja);
	return rows.some(
		(u) =>
			u.id !== kecualiId &&
			(u.indukId ?? null) === (indukId ?? null) &&
			u.nama.toLowerCase() === nama.toLowerCase(),
	);
}

async function isiUnit(id: string) {
	const jumlahPegawai =
		(await db.select({ jumlah: count() }).from(pegawai).where(eq(pegawai.unitKerjaId, id)))[0]
			?.jumlah ?? 0;
	const jumlahTim =
		(await db.select({ jumlah: count() }).from(timKerja).where(eq(timKerja.unitKerjaId, id)))[0]
			?.jumlah ?? 0;
	return { jumlahPegawai, jumlahTim };
}

async function kodeUnitUnikUntuk(dasar: string, kecualiId: string) {
	const kode = dasar.replace(/[^A-Z0-9]/gi, "").toUpperCase() || "UNIT";
	const lain = (await db.select({ id: unitKerja.id, kode: unitKerja.kode }).from(unitKerja)).filter(
		(u) => u.id !== kecualiId,
	);
	const ada = new Set(lain.map((u) => u.kode.toUpperCase()));
	if (!ada.has(kode)) return kode;
	let n = 2;
	while (ada.has(`${kode}${n}`)) n += 1;
	return `${kode}${n}`;
}

function kodeDariNama(nama: string) {
	const kata = nama
		.replace(/[^a-zA-Z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((w) => w.length > 0 && !/^(dan|di|pada|yang|untuk|dari|dan)$/i.test(w));
	if (kata.length === 0) return "UNIT";
	if (kata.length === 1) return kata[0].slice(0, 10).toUpperCase();
	return kata
		.map((w) => w[0])
		.join("")
		.slice(0, 10)
		.toUpperCase();
}

async function kodeUnitUnik(dasar: string) {
	const kode = dasar.replace(/[^A-Z0-9]/gi, "").toUpperCase() || "UNIT";
	const ada = new Set(
		(await db.select({ kode: unitKerja.kode }).from(unitKerja)).map((u) => u.kode.toUpperCase()),
	);
	if (!ada.has(kode)) return kode;
	let n = 2;
	while (ada.has(`${kode}${n}`)) n += 1;
	return `${kode}${n}`;
}

async function hapusPohonSkp(skpId: string) {
	const pimpinan = await db
		.select({ id: rhkPimpinan.id })
		.from(rhkPimpinan)
		.where(eq(rhkPimpinan.skpId, skpId));
	for (const p of pimpinan) {
		const anak = await db.select({ id: rhk.id }).from(rhk).where(eq(rhk.rhkPimpinanId, p.id));
		for (const r of anak) {
			const listIki = await db.select({ id: iki.id }).from(iki).where(eq(iki.rhkId, r.id));
			for (const i of listIki) {
				await db.delete(rencanaAksi).where(eq(rencanaAksi.ikiId, i.id));
				await db.delete(iki).where(eq(iki.id, i.id));
			}
			await db.delete(rencanaAksi).where(eq(rencanaAksi.rhkId, r.id));
			await db.delete(rhk).where(eq(rhk.id, r.id));
		}
		await db.delete(rhkPimpinan).where(eq(rhkPimpinan.id, p.id));
	}
	await db.delete(skp).where(eq(skp.id, skpId));
}
