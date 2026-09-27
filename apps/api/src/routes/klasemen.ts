import { catatanHarian, db, pegawai, timKerja } from "@logbook/db";
import {
	akumulasiMenitEfektif,
	akumulasiMenitTercatat,
	persenPemenuhan,
	statusPemenuhan,
	TARGET_MENIT_EFEKTIF,
} from "@logbook/schemas";
import { and, eq, gte, lte } from "drizzle-orm";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

function rentang(q: { dari?: string; sampai?: string; periode?: string }) {
	const today = new Date().toISOString().slice(0, 10);
	if (q.dari && q.sampai) return { dari: q.dari, sampai: q.sampai };
	if (q.periode === "bulan") {
		const d = new Date();
		const dari = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
		return { dari, sampai: today };
	}
	return { dari: today, sampai: today };
}

export const klasemenRoutes = new Hono().use(requireAuth).get("/", async (c) => {
	const user = c.get("user");
	const { dari, sampai } = rentang({
		dari: c.req.query("dari") ?? undefined,
		sampai: c.req.query("sampai") ?? undefined,
		periode: c.req.query("periode") ?? "hari",
	});
	const grup = c.req.query("grup") ?? "unit";

	let orang = await db
		.select({
			id: pegawai.id,
			namaLengkap: pegawai.namaLengkap,
			nip: pegawai.nip,
			jabatan: pegawai.jabatan,
			timKerjaId: pegawai.timKerjaId,
			timNama: timKerja.nama,
		})
		.from(pegawai)
		.leftJoin(timKerja, eq(pegawai.timKerjaId, timKerja.id))
		.where(eq(pegawai.unitKerjaId, user.unitKerjaId));

	if (grup === "tim") {
		if (user.timKerjaId) {
			orang = orang.filter((o) => o.timKerjaId === user.timKerjaId);
		} else if (!user.isAdmin && !user.isKepalaBiro) {
			orang = orang.filter((o) => o.timKerjaId === null);
		}
	}

	const catatan = await db
		.select()
		.from(catatanHarian)
		.where(and(gte(catatanHarian.tanggal, dari), lte(catatanHarian.tanggal, sampai)));

	const baris = orang
		.map((o) => {
			const milik = catatan.filter((ct) => ct.pegawaiId === o.id);
			const entri = milik.map((ct) => ({
				jenisTugas: ct.jenisTugas as "TUSI" | "TUSI_LAINNYA" | "NON_TUSI",
				status: ct.status as "DRAFT" | "SUBMIT" | "TERVERIFIKASI" | "DITOLAK",
				menitEfektif: ct.menitEfektif,
			}));
			const menit = akumulasiMenitEfektif(entri);
			const menitTercatat = akumulasiMenitTercatat(entri);
			const hari = Math.max(1, uniqueDays(milik.map((m) => m.tanggal)));
			const target = TARGET_MENIT_EFEKTIF * (dari === sampai ? 1 : hari);
			return {
				id: o.id,
				namaLengkap: o.namaLengkap,
				nip: o.nip,
				jabatan: o.jabatan,
				timKerjaId: o.timKerjaId,
				tim: o.timNama ?? "Belum ada tim",
				menit,
				menitTercatat,
				persen: persenPemenuhan(menit, target),
				persenTercatat: persenPemenuhan(menitTercatat, target),
				status: statusPemenuhan(menit, target),
				statusTercatat: statusPemenuhan(menitTercatat, target),
				jumlahCatatan: milik.length,
			};
		})
		.sort(
			(a, b) =>
				b.menitTercatat - a.menitTercatat ||
				b.menit - a.menit ||
				a.namaLengkap.localeCompare(b.namaLengkap, "id"),
		)
		.map((row, i) => ({ peringkat: i + 1, ...row }));

	const rata = baris.length ? Math.round(baris.reduce((s, b) => s + b.menit, 0) / baris.length) : 0;
	const capai = baris.filter((b) => b.status === "TERPENUHI" || b.status === "LEBIH").length;
	const tertaut = catatan.filter((ct) => !ct.isiManual).length;
	const persenTertaut = catatan.length ? Math.round((tertaut / catatan.length) * 100) : 0;

	return c.json({
		dari,
		sampai,
		stat: {
			rataMenit: rata,
			persenCapai: baris.length ? Math.round((capai / baris.length) * 100) : 0,
			persenTertaut,
		},
		baris,
	});
});

function uniqueDays(dates: string[]) {
	return new Set(dates).size || 1;
}
