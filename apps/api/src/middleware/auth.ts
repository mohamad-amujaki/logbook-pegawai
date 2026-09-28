import { db, pegawai, sesi } from "@logbook/db";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";

type Authed = {
	id: string;
	nip: string;
	namaLengkap: string;
	jabatan: string;
	unitKerjaId: string;
	timKerjaId: string | null;
	wajibGantiSandi: boolean;
	isAdmin: boolean;
	isKepalaBiro: boolean;
};

export const requireAuth = createMiddleware<{ Variables: { user: Authed } }>(async (c, next) => {
	const sid = getCookie(c, "logbook_sesi");
	if (!sid) return c.json({ error: "Sesi tidak ditemukan. Masuk kembali." }, 401);

	const rows = await db
		.select({
			sesiId: sesi.id,
			berakhirPada: sesi.berakhirPada,
			id: pegawai.id,
			nip: pegawai.nip,
			namaLengkap: pegawai.namaLengkap,
			jabatan: pegawai.jabatan,
			unitKerjaId: pegawai.unitKerjaId,
			timKerjaId: pegawai.timKerjaId,
			wajibGantiSandi: pegawai.wajibGantiSandi,
			isAdmin: pegawai.isAdmin,
			isKepalaBiro: pegawai.isKepalaBiro,
		})
		.from(sesi)
		.innerJoin(pegawai, eq(sesi.pegawaiId, pegawai.id))
		.where(eq(sesi.id, sid))
		.limit(1);

	const user = rows[0];
	if (!user || new Date(user.berakhirPada) < new Date()) {
		return c.json({ error: "Sesi berakhir. Masuk kembali." }, 401);
	}

	c.set("user", {
		id: user.id,
		nip: user.nip,
		namaLengkap: user.namaLengkap,
		jabatan: user.jabatan,
		unitKerjaId: user.unitKerjaId,
		timKerjaId: user.timKerjaId,
		wajibGantiSandi: user.wajibGantiSandi,
		isAdmin: user.isAdmin,
		isKepalaBiro: user.isKepalaBiro,
	});
	await next();
});
