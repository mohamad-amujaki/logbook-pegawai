import { db, iki, pegawai, rencanaAksi, rhk, rhkPimpinan, skp } from "@logbook/db";
import {
	ikiSchema,
	ikiUbahSchema,
	rencanaAksiSchema,
	rhkSchema,
	skpHeaderSchema,
	uraianSkpSchema,
} from "@logbook/schemas";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { buatId } from "../lib/id";
import { requireAuth } from "../middleware/auth";

async function headerTahun(pegawaiId: string, tahun: number) {
	let header = (
		await db
			.select()
			.from(skp)
			.where(and(eq(skp.pegawaiId, pegawaiId), eq(skp.tahun, tahun)))
			.limit(1)
	)[0];
	if (!header) {
		const id = buatId("skp");
		await db.insert(skp).values({ id, pegawaiId, tahun });
		const dibuat = (await db.select().from(skp).where(eq(skp.id, id)))[0];
		if (!dibuat) throw new Error("Gagal membuat header SKP.");
		header = dibuat;
	}
	return header;
}

export const skpRoutes = new Hono()
	.use(requireAuth)
	.get("/", async (c) => {
		const user = c.get("user");
		const tahun = Number(c.req.query("tahun") ?? new Date().getFullYear());
		const header = await db
			.select()
			.from(skp)
			.where(and(eq(skp.pegawaiId, user.id), eq(skp.tahun, tahun)))
			.limit(1);
		const h = header[0];
		if (!h) return c.json({ header: null, pohon: [] });

		const pimpinan = await db.select().from(rhkPimpinan).where(eq(rhkPimpinan.skpId, h.id));
		const pohon = [];
		for (const p of pimpinan) {
			const anak = await db.select().from(rhk).where(eq(rhk.rhkPimpinanId, p.id));
			const denganIki = [];
			for (const a of anak) {
				const listIki = await db.select().from(iki).where(eq(iki.rhkId, a.id));
				const denganAksi = [];
				for (const i of listIki) {
					const aksi = await db.select().from(rencanaAksi).where(eq(rencanaAksi.ikiId, i.id));
					denganAksi.push({ ...i, rencanaAksi: aksi });
				}
				denganIki.push({ id: a.id, uraian: a.uraian, urutan: a.urutan, iki: denganAksi });
			}
			pohon.push({ ...p, rhk: denganIki });
		}

		const pertimbangan = h.pemberiPertimbanganId
			? await db.select().from(pegawai).where(eq(pegawai.id, h.pemberiPertimbanganId)).limit(1)
			: [];
		const penilai = h.pejabatPenilaiId
			? await db.select().from(pegawai).where(eq(pegawai.id, h.pejabatPenilaiId)).limit(1)
			: [];
		const atasanPenilai = h.atasanPejabatPenilaiId
			? await db.select().from(pegawai).where(eq(pegawai.id, h.atasanPejabatPenilaiId)).limit(1)
			: [];

		return c.json({
			header: h,
			pemberiPertimbangan: pertimbangan[0] ?? null,
			pejabatPenilai: penilai[0] ?? null,
			atasanPejabatPenilai: atasanPenilai[0] ?? null,
			pohon,
		});
	})
	.put("/header", async (c) => {
		const user = c.get("user");
		const body = await c.req.json();
		const parsed = skpHeaderSchema.safeParse(body);
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			const path = first?.path[0];
			const field =
				path === "nipPejabatPenilai"
					? "penilai"
					: path === "nipAtasanPejabatPenilai"
						? "atasanPenilai"
						: "pemberi";
			const label =
				field === "penilai"
					? "Pejabat penilai"
					: field === "atasanPenilai"
						? "Atasan pejabat penilai"
						: "Pemberi pertimbangan";
			return c.json(
				{
					error: `${label} belum dipilih. Cari nama atau NIP, lalu pilih dari daftar.`,
					field,
				},
				400,
			);
		}

		const pemberi = await db
			.select()
			.from(pegawai)
			.where(eq(pegawai.nip, parsed.data.nipPemberiPertimbangan))
			.limit(1);
		const penilai = await db
			.select()
			.from(pegawai)
			.where(eq(pegawai.nip, parsed.data.nipPejabatPenilai))
			.limit(1);
		const atasanPenilai = await db
			.select()
			.from(pegawai)
			.where(eq(pegawai.nip, parsed.data.nipAtasanPejabatPenilai))
			.limit(1);

		if (!pemberi[0]) {
			return c.json(
				{
					error:
						"Pemberi pertimbangan tidak ada di data pegawai. Pilih dari hasil pencarian, jangan mengetik NIP di luar daftar.",
					field: "pemberi",
				},
				400,
			);
		}
		if (!penilai[0]) {
			return c.json(
				{
					error: "Pejabat penilai tidak ada di data pegawai. Pilih dari hasil pencarian.",
					field: "penilai",
				},
				400,
			);
		}
		if (!atasanPenilai[0]) {
			return c.json(
				{
					error: "Atasan pejabat penilai tidak ada di data pegawai. Pilih dari hasil pencarian.",
					field: "atasanPenilai",
				},
				400,
			);
		}
		if (pemberi[0].id === user.id) {
			return c.json(
				{
					error: "Anda tidak dapat memilih diri sendiri sebagai pemberi pertimbangan.",
					field: "pemberi",
				},
				400,
			);
		}
		if (penilai[0].id === user.id) {
			return c.json(
				{
					error: "Anda tidak dapat memilih diri sendiri sebagai pejabat penilai.",
					field: "penilai",
				},
				400,
			);
		}
		if (atasanPenilai[0].id === user.id) {
			return c.json(
				{
					error: "Anda tidak dapat memilih diri sendiri sebagai atasan pejabat penilai.",
					field: "atasanPenilai",
				},
				400,
			);
		}
		if (atasanPenilai[0].id === penilai[0].id) {
			return c.json(
				{
					error: "Atasan pejabat penilai harus orang yang berbeda dari pejabat penilai.",
					field: "atasanPenilai",
				},
				400,
			);
		}

		const existing = await db
			.select()
			.from(skp)
			.where(and(eq(skp.pegawaiId, user.id), eq(skp.tahun, parsed.data.tahun)))
			.limit(1);

		if (existing[0]) {
			await db
				.update(skp)
				.set({
					pemberiPertimbanganId: pemberi[0].id,
					pejabatPenilaiId: penilai[0].id,
					atasanPejabatPenilaiId: atasanPenilai[0].id,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(skp.id, existing[0].id));
			return c.json({ id: existing[0].id });
		}

		const id = buatId("skp");
		await db.insert(skp).values({
			id,
			pegawaiId: user.id,
			tahun: parsed.data.tahun,
			pemberiPertimbanganId: pemberi[0].id,
			pejabatPenilaiId: penilai[0].id,
			atasanPejabatPenilaiId: atasanPenilai[0].id,
		});
		return c.json({ id });
	})
	.post("/rhk-pimpinan", async (c) => {
		const user = c.get("user");
		const body = await c.req.json<{ uraian: string; tahun?: number }>();
		if (!body.uraian?.trim()) {
			return c.json(
				{ error: "Uraian RHK pimpinan masih kosong. Tulis sasaran pimpinan yang Anda intervensi." },
				400,
			);
		}
		const header = await headerTahun(user.id, body.tahun ?? new Date().getFullYear());
		const id = buatId("rhkp");
		await db
			.insert(rhkPimpinan)
			.values({ id, skpId: header.id, uraian: body.uraian.trim(), urutan: 1 });
		return c.json({ id });
	})
	.post("/rhk", async (c) => {
		const parsed = rhkSchema.safeParse(await c.req.json());
		if (!parsed.success) {
			return c.json({ error: "Uraian RHK minimal 3 karakter." }, 400);
		}
		const id = buatId("rhk");
		await db.insert(rhk).values({
			id,
			rhkPimpinanId: parsed.data.rhkPimpinanId,
			uraian: parsed.data.uraian.trim(),
			aspek: "KUANTITAS",
			indikator: "-",
			targetTahunan: "-",
			satuan: "-",
			urutan: 1,
		});
		return c.json({ id });
	})
	.post("/iki", async (c) => {
		const parsed = ikiSchema.safeParse(await c.req.json());
		if (!parsed.success) {
			return c.json(
				{ error: "IKI belum lengkap. Isi indikator, target, satuan, jenis, dan bobot." },
				400,
			);
		}
		const id = buatId("iki");
		await db.insert(iki).values({
			id,
			rhkId: parsed.data.rhkId,
			aspek: parsed.data.aspek,
			indikator: parsed.data.indikator.trim(),
			targetTahunan: parsed.data.targetTahunan.trim(),
			satuan: parsed.data.satuan.trim(),
			jenis: parsed.data.jenis,
			bobot: Math.round(parsed.data.bobot),
			urutan: 1,
		});
		return c.json({ id });
	})
	.post("/rencana-aksi", async (c) => {
		const body = await c.req.json();
		if (!body.ikiId || !body.rhkId) {
			return c.json({ error: "Rencana aksi harus menempel ke IKI." }, 400);
		}
		const parsed = rencanaAksiSchema.safeParse(body);
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return c.json({ error: first?.message ?? "Uraian rencana aksi minimal 3 karakter." }, 400);
		}
		const id = buatId("aks");
		await db.insert(rencanaAksi).values({
			id,
			rhkId: String(body.rhkId),
			ikiId: String(body.ikiId),
			...parsed.data,
		});
		return c.json({ id });
	})
	.put("/rhk-pimpinan/:id", async (c) => {
		const user = c.get("user");
		const parsed = uraianSkpSchema.safeParse(await c.req.json());
		if (!parsed.success)
			return c.json({ error: "Uraian sasaran pimpinan minimal 3 karakter." }, 400);
		if (!(await milikPimpinan(user.id, c.req.param("id"))))
			return c.json({ error: "Sasaran ini bukan milik SKP Anda." }, 403);
		await db
			.update(rhkPimpinan)
			.set({ uraian: parsed.data.uraian.trim() })
			.where(eq(rhkPimpinan.id, c.req.param("id")));
		return c.json({ ok: true });
	})
	.put("/rhk/:id", async (c) => {
		const user = c.get("user");
		const parsed = uraianSkpSchema.safeParse(await c.req.json());
		if (!parsed.success) return c.json({ error: "Uraian RHK minimal 3 karakter." }, 400);
		if (!(await milikRhk(user.id, c.req.param("id"))))
			return c.json({ error: "RHK ini bukan milik SKP Anda." }, 403);
		await db
			.update(rhk)
			.set({ uraian: parsed.data.uraian.trim() })
			.where(eq(rhk.id, c.req.param("id")));
		return c.json({ ok: true });
	})
	.put("/iki/:id", async (c) => {
		const user = c.get("user");
		const parsed = ikiUbahSchema.safeParse(await c.req.json());
		if (!parsed.success)
			return c.json(
				{ error: "IKI belum lengkap. Isi indikator, target, satuan, jenis, dan bobot." },
				400,
			);
		if (!(await milikIki(user.id, c.req.param("id"))))
			return c.json({ error: "IKI ini bukan milik SKP Anda." }, 403);
		await db
			.update(iki)
			.set({
				aspek: parsed.data.aspek,
				indikator: parsed.data.indikator.trim(),
				targetTahunan: parsed.data.targetTahunan.trim(),
				satuan: parsed.data.satuan.trim(),
				jenis: parsed.data.jenis,
				bobot: Math.round(parsed.data.bobot),
			})
			.where(eq(iki.id, c.req.param("id")));
		return c.json({ ok: true });
	})
	.put("/rencana-aksi/:id", async (c) => {
		const user = c.get("user");
		const parsed = rencanaAksiSchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return c.json({ error: first?.message ?? "Uraian rencana aksi minimal 3 karakter." }, 400);
		}
		if (!(await milikAksi(user.id, c.req.param("id"))))
			return c.json({ error: "Rencana aksi ini bukan milik SKP Anda." }, 403);
		await db
			.update(rencanaAksi)
			.set(parsed.data)
			.where(eq(rencanaAksi.id, c.req.param("id")));
		return c.json({ ok: true });
	})
	.delete("/rhk-pimpinan/:id", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		if (!(await milikPimpinan(user.id, id)))
			return c.json({ error: "Sasaran ini bukan milik SKP Anda." }, 403);
		const anak = await db.select({ id: rhk.id }).from(rhk).where(eq(rhk.rhkPimpinanId, id));
		for (const r of anak) await hapusRhkDanAnak(r.id);
		await db.delete(rhkPimpinan).where(eq(rhkPimpinan.id, id));
		return c.json({ ok: true });
	})
	.delete("/rhk/:id", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		if (!(await milikRhk(user.id, id)))
			return c.json({ error: "RHK ini bukan milik SKP Anda." }, 403);
		await hapusRhkDanAnak(id);
		return c.json({ ok: true });
	})
	.delete("/iki/:id", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		if (!(await milikIki(user.id, id)))
			return c.json({ error: "IKI ini bukan milik SKP Anda." }, 403);
		await hapusIkiDanAnak(id);
		return c.json({ ok: true });
	})
	.delete("/rencana-aksi/:id", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		if (!(await milikAksi(user.id, id)))
			return c.json({ error: "Rencana aksi ini bukan milik SKP Anda." }, 403);
		await db.delete(rencanaAksi).where(eq(rencanaAksi.id, id));
		return c.json({ ok: true });
	});

async function milikSkp(userId: string, skpId: string) {
	const row = await db
		.select({ id: skp.id })
		.from(skp)
		.where(and(eq(skp.id, skpId), eq(skp.pegawaiId, userId)))
		.limit(1);
	return Boolean(row[0]);
}

async function milikPimpinan(userId: string, id: string) {
	const row = await db.select().from(rhkPimpinan).where(eq(rhkPimpinan.id, id)).limit(1);
	return row[0] ? milikSkp(userId, row[0].skpId) : false;
}

async function milikRhk(userId: string, id: string) {
	const row = await db.select().from(rhk).where(eq(rhk.id, id)).limit(1);
	return row[0] ? milikPimpinan(userId, row[0].rhkPimpinanId) : false;
}

async function milikIki(userId: string, id: string) {
	const row = await db.select().from(iki).where(eq(iki.id, id)).limit(1);
	return row[0] ? milikRhk(userId, row[0].rhkId) : false;
}

async function milikAksi(userId: string, id: string) {
	const row = await db.select().from(rencanaAksi).where(eq(rencanaAksi.id, id)).limit(1);
	if (!row[0]) return false;
	if (row[0].ikiId) return milikIki(userId, row[0].ikiId);
	return milikRhk(userId, row[0].rhkId);
}

async function hapusIkiDanAnak(ikiId: string) {
	await db.delete(rencanaAksi).where(eq(rencanaAksi.ikiId, ikiId));
	await db.delete(iki).where(eq(iki.id, ikiId));
}

async function hapusRhkDanAnak(rhkId: string) {
	const list = await db.select({ id: iki.id }).from(iki).where(eq(iki.rhkId, rhkId));
	for (const i of list) await hapusIkiDanAnak(i.id);
	await db.delete(rencanaAksi).where(eq(rencanaAksi.rhkId, rhkId));
	await db.delete(rhk).where(eq(rhk.id, rhkId));
}
