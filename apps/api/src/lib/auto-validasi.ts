import { catatanHarian, db, skp } from "@logbook/db";
import {
	BATAS_HARI_VALIDASI,
	durasiKalenderMenit,
	layakAutoVerifikasi,
	melewatiTenggatValidasi,
} from "@logbook/schemas";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { kirimNotifikasi } from "./notify";

const SEHARI_MS = 24 * 60 * 60 * 1000;

/**
 * Setujui otomatis catatan SUBMIT yang melewati tenggat validasi dan tidak mencurigakan.
 * Idempoten: hanya baris berstatus SUBMIT yang tersentuh, aman dipanggil berulang.
 */
export async function rekonsiliasiAutoValidasi(sekarang: Date = new Date()): Promise<number> {
	const batas = new Date(sekarang.getTime() - BATAS_HARI_VALIDASI * SEHARI_MS).toISOString();
	const kandidat = await db
		.select({
			id: catatanHarian.id,
			pegawaiId: catatanHarian.pegawaiId,
			tanggal: catatanHarian.tanggal,
			diajukanPada: catatanHarian.diajukanPada,
			waktuMulai: catatanHarian.waktuMulai,
			waktuSelesai: catatanHarian.waktuSelesai,
			menitEfektif: catatanHarian.menitEfektif,
		})
		.from(catatanHarian)
		.where(
			and(
				eq(catatanHarian.status, "SUBMIT"),
				isNotNull(catatanHarian.diajukanPada),
				lte(catatanHarian.diajukanPada, batas),
			),
		);

	const layak = kandidat.filter(
		(r) =>
			melewatiTenggatValidasi(r.diajukanPada, sekarang) &&
			layakAutoVerifikasi(r.menitEfektif, durasiKalenderMenit(r.waktuMulai, r.waktuSelesai)),
	);
	if (layak.length === 0) return 0;

	const now = sekarang.toISOString();
	const berubah = await db
		.update(catatanHarian)
		.set({
			status: "TERVERIFIKASI",
			catatanValidasi: null,
			divalidasiOlehId: null,
			divalidasiPada: now,
			divalidasiOtomatis: true,
			updatedAt: now,
		})
		.where(
			and(
				inArray(
					catatanHarian.id,
					layak.map((r) => r.id),
				),
				eq(catatanHarian.status, "SUBMIT"),
			),
		)
		.returning({
			id: catatanHarian.id,
			pegawaiId: catatanHarian.pegawaiId,
			tanggal: catatanHarian.tanggal,
		});

	if (berubah.length === 0) return 0;
	await kabari(berubah);
	return berubah.length;
}

async function kabari(berubah: { id: string; pegawaiId: string; tanggal: string }[]) {
	const perPegawai = new Map<string, number>();
	for (const b of berubah) perPegawai.set(b.pegawaiId, (perPegawai.get(b.pegawaiId) ?? 0) + 1);

	for (const [pegawaiId, jumlah] of perPegawai) {
		await kirimNotifikasi({
			pegawaiId,
			judul: "Catatan disetujui otomatis",
			isi:
				jumlah === 1
					? `Catatan disetujui otomatis karena tidak divalidasi dalam ${BATAS_HARI_VALIDASI} hari.`
					: `${jumlah} catatan disetujui otomatis karena tidak divalidasi dalam ${BATAS_HARI_VALIDASI} hari.`,
			tautan: "/app/catatan",
		});
	}

	const perAtasan = new Map<string, number>();
	const header = await db
		.select({ pegawaiId: skp.pegawaiId, atasanId: skp.pemberiPertimbanganId, tahun: skp.tahun })
		.from(skp)
		.where(inArray(skp.pegawaiId, [...perPegawai.keys()]));
	for (const [pegawaiId, jumlah] of perPegawai) {
		const tahun = Number(
			(berubah.find((b) => b.pegawaiId === pegawaiId)?.tanggal ?? "").slice(0, 4),
		);
		const cocok = header.find((h) => h.pegawaiId === pegawaiId && h.tahun === tahun);
		if (!cocok?.atasanId) continue;
		perAtasan.set(cocok.atasanId, (perAtasan.get(cocok.atasanId) ?? 0) + jumlah);
	}

	for (const [atasanId, jumlah] of perAtasan) {
		await kirimNotifikasi({
			pegawaiId: atasanId,
			judul: "Catatan disetujui otomatis",
			isi: `${jumlah} catatan disetujui otomatis karena melewati tenggat validasi ${BATAS_HARI_VALIDASI} hari.`,
			tautan: "/app/validasi",
		});
	}
}
