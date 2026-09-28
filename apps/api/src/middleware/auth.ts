import { akun, akunPeran, db, pegawai, sesi } from "@logbook/db";
import type { PeranAkun } from "@logbook/schemas";
import { and, eq, isNull } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";

export type Authed = {
	akunId: string;
	id: string;
	nip: string;
	namaLengkap: string;
	jabatan: string;
	unitKerjaId: string;
	timKerjaId: string | null;
	wajibGantiSandi: boolean;
	isAdmin: boolean;
	isKepalaBiro: boolean;
	peran: PeranAkun[];
	unitKelolaIds: string[];
};

export const requireAuth = createMiddleware<{ Variables: { user: Authed } }>(async (c, next) => {
	const sid = getCookie(c, "logbook_sesi");
	if (!sid) return c.json({ error: "Sesi tidak ditemukan. Masuk kembali." }, 401);

	const rows = await db
		.select({
			sesiId: sesi.id,
			berakhirPada: sesi.berakhirPada,
			akunId: akun.id,
			statusAkun: akun.status,
			id: pegawai.id,
			nip: pegawai.nip,
			namaLengkap: pegawai.namaLengkap,
			jabatan: pegawai.jabatan,
			unitKerjaId: pegawai.unitKerjaId,
			timKerjaId: pegawai.timKerjaId,
			wajibGantiSandi: akun.wajibGantiSandi,
		})
		.from(sesi)
		.innerJoin(akun, eq(sesi.akunId, akun.id))
		.innerJoin(pegawai, eq(akun.pegawaiId, pegawai.id))
		.where(and(eq(sesi.id, sid), isNull(sesi.dicabutPada)))
		.limit(1);

	const user = rows[0];
	if (user?.statusAkun !== "AKTIF" || new Date(user.berakhirPada) < new Date()) {
		return c.json({ error: "Sesi berakhir. Masuk kembali." }, 401);
	}
	const daftarPeran = await db
		.select({ peran: akunPeran.peran, unitKerjaId: akunPeran.unitKerjaId })
		.from(akunPeran)
		.where(eq(akunPeran.akunId, user.akunId));
	const peran = daftarPeran.map((r) => r.peran as PeranAkun);
	const unitKelolaIds = daftarPeran
		.filter((r) => r.peran === "PENGELOLA_UNIT" && r.unitKerjaId)
		.map((r) => r.unitKerjaId as string);

	c.set("user", {
		akunId: user.akunId,
		id: user.id,
		nip: user.nip,
		namaLengkap: user.namaLengkap,
		jabatan: user.jabatan,
		unitKerjaId: user.unitKerjaId,
		timKerjaId: user.timKerjaId,
		wajibGantiSandi: user.wajibGantiSandi,
		isAdmin: peran.includes("ADMIN"),
		isKepalaBiro: peran.includes("KEPALA_BIRO"),
		peran,
		unitKelolaIds,
	});
	if (
		user.wajibGantiSandi &&
		!["/api/auth/ganti-sandi", "/api/auth/logout", "/api/me"].includes(c.req.path)
	) {
		return c.json({ error: "Ganti kata sandi terlebih dahulu.", code: "WAJIB_GANTI_SANDI" }, 403);
	}
	await next();
});
