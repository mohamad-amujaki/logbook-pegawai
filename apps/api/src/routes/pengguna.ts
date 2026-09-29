import { akun, akunPeran, auditLog, db, hashPassword, pegawai, sesi, unitKerja } from "@logbook/db";
import { daftarPeranAkunSchema, statusAkunSchema } from "@logbook/schemas";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { adminOnly } from "../lib/authorization";
import { catatAudit } from "../lib/audit";
import { buatId } from "../lib/id";
import { requireAuth } from "../middleware/auth";

function sandiSementara(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
	const bytes = crypto.getRandomValues(new Uint8Array(14));
	return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function jumlahAdminAktif(): Promise<number> {
	const rows = await db
		.select({ jumlah: count() })
		.from(akunPeran)
		.innerJoin(akun, eq(akunPeran.akunId, akun.id))
		.where(and(eq(akunPeran.peran, "ADMIN"), eq(akun.status, "AKTIF")));
	return rows[0]?.jumlah ?? 0;
}

export const penggunaRoutes = new Hono()
	.use("*", requireAuth)
	.use("*", async (c, next) => {
		if (!adminOnly(c.get("user"))) return c.json({ error: "Hanya administrator." }, 403);
		await next();
	})
	.get("/", async (c) => {
		const rows = await db
			.select({
				id: akun.id,
				pegawaiId: pegawai.id,
				nip: pegawai.nip,
				nama: pegawai.namaLengkap,
				jabatan: pegawai.jabatan,
				unitKerjaId: pegawai.unitKerjaId,
				unitNama: unitKerja.nama,
				statusPegawai: pegawai.status,
				status: akun.status,
				wajibGantiSandi: akun.wajibGantiSandi,
				terakhirLoginPada: akun.terakhirLoginPada,
				ditangguhkanPada: akun.ditangguhkanPada,
				alasanPenangguhan: akun.alasanPenangguhan,
			})
			.from(akun)
			.innerJoin(pegawai, eq(akun.pegawaiId, pegawai.id))
			.innerJoin(unitKerja, eq(pegawai.unitKerjaId, unitKerja.id));
		const roles = await db
			.select({
				id: akunPeran.id,
				akunId: akunPeran.akunId,
				peran: akunPeran.peran,
				unitKerjaId: akunPeran.unitKerjaId,
				unitNama: unitKerja.nama,
			})
			.from(akunPeran)
			.leftJoin(unitKerja, eq(akunPeran.unitKerjaId, unitKerja.id));
		return c.json(
			rows
				.map((row) => ({
					...row,
					peran: roles.filter((r) => r.akunId === row.id),
				}))
				.sort((a, b) => a.nama.localeCompare(b.nama, "id")),
		);
	})
	.get("/:id/audit", async (c) => {
		const rows = await db
			.select({
				id: auditLog.id,
				aktorAkunId: auditLog.aktorAkunId,
				targetAkunId: auditLog.targetAkunId,
				aksi: auditLog.aksi,
				alasan: auditLog.alasan,
				sebelumJson: auditLog.sebelumJson,
				sesudahJson: auditLog.sesudahJson,
				createdAt: auditLog.createdAt,
			})
			.from(auditLog)
			.where(eq(auditLog.targetAkunId, c.req.param("id")))
			.orderBy(desc(auditLog.createdAt))
			.limit(100);
		return c.json(rows);
	})
	.post("/:id/reset-sandi", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const target = (
			await db
				.select({ id: akun.id, pegawaiId: pegawai.id, nip: pegawai.nip })
				.from(akun)
				.innerJoin(pegawai, eq(akun.pegawaiId, pegawai.id))
				.where(eq(akun.id, id))
				.limit(1)
		)[0];
		if (!target) return c.json({ error: "Pengguna tidak ditemukan." }, 404);
		const sementara = sandiSementara();
		const sekarang = new Date().toISOString();
		const hash = await hashPassword(sementara);
		await db
			.update(akun)
			.set({ passwordHash: hash, wajibGantiSandi: true, updatedAt: sekarang })
			.where(eq(akun.id, id));
		await db
			.update(pegawai)
			.set({ passwordHash: hash, wajibGantiSandi: true, updatedAt: sekarang })
			.where(eq(pegawai.id, target.pegawaiId));
		await db.update(sesi).set({ dicabutPada: sekarang }).where(eq(sesi.akunId, id));
		await catatAudit(user, id, "RESET_SANDI");
		return c.json({ ok: true, sandiSementara: sementara });
	})
	.post("/:id/tangguhkan", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		if (id === user.akunId) {
			return c.json({ error: "Anda tidak dapat menangguhkan akun sendiri." }, 400);
		}
		const parsed = statusAkunSchema.safeParse(await c.req.json());
		if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message }, 400);
		const role = await db
			.select({ peran: akunPeran.peran })
			.from(akunPeran)
			.where(eq(akunPeran.akunId, id));
		if (role.some((r) => r.peran === "ADMIN") && (await jumlahAdminAktif()) <= 1) {
			return c.json({ error: "Administrator aktif terakhir tidak dapat ditangguhkan." }, 400);
		}
		const sekarang = new Date().toISOString();
		await db
			.update(akun)
			.set({
				status: "DITANGGUHKAN",
				ditangguhkanPada: sekarang,
				ditangguhkanOlehId: user.akunId,
				alasanPenangguhan: parsed.data.alasan,
				updatedAt: sekarang,
			})
			.where(eq(akun.id, id));
		await db.update(sesi).set({ dicabutPada: sekarang }).where(eq(sesi.akunId, id));
		await catatAudit(user, id, "TANGGUHKAN", { alasan: parsed.data.alasan });
		return c.json({ ok: true });
	})
	.post("/:id/aktifkan", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const target = (
			await db.select({ pegawaiId: akun.pegawaiId }).from(akun).where(eq(akun.id, id)).limit(1)
		)[0];
		if (!target) return c.json({ error: "Pengguna tidak ditemukan." }, 404);
		const sekarang = new Date().toISOString();
		await db
			.update(akun)
			.set({
				status: "AKTIF",
				ditangguhkanPada: null,
				ditangguhkanOlehId: null,
				alasanPenangguhan: null,
				updatedAt: sekarang,
			})
			.where(eq(akun.id, id));
		await db
			.update(pegawai)
			.set({ status: "aktif", updatedAt: sekarang })
			.where(eq(pegawai.id, target.pegawaiId));
		await catatAudit(user, id, "AKTIFKAN");
		return c.json({ ok: true });
	})
	.put("/:id/peran", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const target = (
			await db.select({ pegawaiId: akun.pegawaiId }).from(akun).where(eq(akun.id, id)).limit(1)
		)[0];
		if (!target) return c.json({ error: "Pengguna tidak ditemukan." }, 404);
		const parsed = daftarPeranAkunSchema.safeParse(await c.req.json());
		if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message }, 400);
		const lama = await db
			.select({ peran: akunPeran.peran, unitKerjaId: akunPeran.unitKerjaId })
			.from(akunPeran)
			.where(eq(akunPeran.akunId, id));
		const adminLama = lama.some((r) => r.peran === "ADMIN");
		const adminBaru = parsed.data.peran.some((r) => r.peran === "ADMIN");
		if (id === user.akunId && adminLama && !adminBaru) {
			return c.json({ error: "Anda tidak dapat mencabut peran administrator sendiri." }, 400);
		}
		if (adminLama && !adminBaru && (await jumlahAdminAktif()) <= 1) {
			return c.json({ error: "Administrator aktif terakhir tidak dapat dicabut." }, 400);
		}
		const unitIds = parsed.data.peran
			.map((r) => r.unitKerjaId)
			.filter((unitId): unitId is string => Boolean(unitId));
		if (unitIds.length > 0) {
			const unitAda = await db
				.select({ id: unitKerja.id })
				.from(unitKerja)
				.where(inArray(unitKerja.id, unitIds));
			if (unitAda.length !== new Set(unitIds).size) {
				return c.json({ error: "Cakupan unit kerja tidak valid." }, 400);
			}
		}
		await db.delete(akunPeran).where(eq(akunPeran.akunId, id));
		const sekarang = new Date().toISOString();
		for (const peran of parsed.data.peran) {
			await db.insert(akunPeran).values({
				id: buatId("peran"),
				akunId: id,
				peran: peran.peran,
				unitKerjaId: peran.peran === "PENGELOLA_UNIT" ? peran.unitKerjaId : null,
				diberikanOlehId: user.akunId,
				createdAt: sekarang,
			});
		}
		await db
			.update(pegawai)
			.set({
				isAdmin: adminBaru,
				isKepalaBiro: parsed.data.peran.some((r) => r.peran === "KEPALA_BIRO"),
				updatedAt: sekarang,
			})
			.where(eq(pegawai.id, target.pegawaiId));
		await catatAudit(user, id, "UBAH_PERAN", { sebelum: lama, sesudah: parsed.data.peran });
		return c.json({ ok: true });
	});
