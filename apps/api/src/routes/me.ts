import { db, notifikasi, pegawai, skp, timKerja } from "@logbook/db";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

async function ringkas(id: string | null) {
	if (!id) return null;
	const row = await db
		.select({
			id: pegawai.id,
			nip: pegawai.nip,
			namaLengkap: pegawai.namaLengkap,
			jabatan: pegawai.jabatan,
		})
		.from(pegawai)
		.where(eq(pegawai.id, id))
		.limit(1);
	return row[0] ?? null;
}

export const meRoutes = new Hono().use(requireAuth).get("/", async (c) => {
	const user = c.get("user");
	const unread = await db
		.select()
		.from(notifikasi)
		.where(and(eq(notifikasi.pegawaiId, user.id), eq(notifikasi.dibaca, false)));
	const skpSaya = await db
		.select()
		.from(skp)
		.where(and(eq(skp.pegawaiId, user.id), eq(skp.tahun, new Date().getFullYear())))
		.limit(1);
	const header = skpSaya[0];
	const tim = user.timKerjaId
		? await db
				.select({ nama: timKerja.nama })
				.from(timKerja)
				.where(eq(timKerja.id, user.timKerjaId))
				.limit(1)
		: [];
	const pimpin = await db
		.select({ id: timKerja.id, nama: timKerja.nama })
		.from(timKerja)
		.where(eq(timKerja.ketuaPegawaiId, user.id))
		.limit(1);

	return c.json({
		user: {
			...user,
			timNama: tim[0]?.nama ?? null,
		},
		ketuaTim: pimpin[0] ?? null,
		belumDibaca: unread.length,
		skpLengkap: Boolean(
			header?.pemberiPertimbanganId && header?.pejabatPenilaiId && header?.atasanPejabatPenilaiId,
		),
		pemberiPertimbangan: await ringkas(header?.pemberiPertimbanganId ?? null),
		pejabatPenilai: await ringkas(header?.pejabatPenilaiId ?? null),
		atasanPejabatPenilai: await ringkas(header?.atasanPejabatPenilaiId ?? null),
	});
});
