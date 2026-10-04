import {
	catatanHarian,
	db,
	integrasiKehadiran,
	pegawai,
	pemetaanEmailKehadiran,
} from "@logbook/db";
import {
	durasiKalenderMenit,
	tanggalWib,
	validasiWaktu,
	type KehadiranIngestInput,
} from "@logbook/schemas";
import { eq } from "drizzle-orm";
import { buatId } from "./id";
import { kirimNotifikasi } from "./notify";

export type HasilPegawai =
	| { ok: true; pegawai: typeof pegawai.$inferSelect }
	| { ok: false; code: "NIP_REQUIRED" | "PEGAWAI_NOT_FOUND"; pesan: string };

export function tentukanKodePegawai(input: {
	nip?: string | null;
	email: string;
	lewatNip: typeof pegawai.$inferSelect | undefined;
	lewatEmail: typeof pegawai.$inferSelect | undefined;
}): HasilPegawai {
	if (input.lewatNip) {
		if (input.lewatNip.status !== "aktif") {
			return {
				ok: false,
				code: "PEGAWAI_NOT_FOUND",
				pesan: "NIP tidak aktif di master logbook Biro OSDM.",
			};
		}
		return { ok: true, pegawai: input.lewatNip };
	}
	if (input.lewatEmail) {
		if (input.lewatEmail.status !== "aktif") {
			return {
				ok: false,
				code: "PEGAWAI_NOT_FOUND",
				pesan: "Email dinas tidak terhubung ke pegawai aktif.",
			};
		}
		return { ok: true, pegawai: input.lewatEmail };
	}
	if (!input.nip) {
		return {
			ok: false,
			code: "NIP_REQUIRED",
			pesan: "Hubungkan NIP agar kehadiran masuk logbook.",
		};
	}
	return {
		ok: false,
		code: "PEGAWAI_NOT_FOUND",
		pesan: "NIP belum ada di master logbook Biro OSDM.",
	};
}

export function bangunIsianDraf(input: KehadiranIngestInput) {
	const selesai =
		input.tanggalSelesai && !Number.isNaN(new Date(input.tanggalSelesai).getTime())
			? input.tanggalSelesai
			: new Date(
					new Date(input.tanggalMulai).getTime() + Math.max(input.menitEfektif, 60) * 60_000,
				).toISOString();
	const durasi = durasiKalenderMenit(input.tanggalMulai, selesai);
	const menit =
		input.menitEfektif > 0
			? Math.min(input.menitEfektif, durasi > 0 ? durasi : input.menitEfektif)
			: durasi;
	return {
		jenisTugas: "TUSI_LAINNYA" as const,
		isiManual: true,
		namaManualProduk: "Kehadiran rapat",
		namaManualTahapan: input.kodeRapat,
		uraian: input.uraian,
		waktuMulai: input.tanggalMulai,
		waktuSelesai: selesai,
		menitEfektif: menit > 0 ? menit : 60,
		jumlahOutput: input.output ?? 1,
		satuanOutput: "rapat",
		kategori: "BIASA" as const,
		buktiUrl: input.buktiUrl || null,
		buktiJudul: "Bukti kehadiran",
		tanggal: tanggalWib(input.tanggalMulai),
	};
}

export function putuskanUndo(statusCatatan: string | null): "hapus_draf" | "tandai" | "abaikan" {
	switch (statusCatatan) {
		case "DRAFT":
			return "hapus_draf";
		case "SUBMIT":
		case "TERVERIFIKASI":
		case "DITOLAK":
			return "tandai";
		case null:
			return "abaikan";
		default:
			return "abaikan";
	}
}

async function cariPegawai(input: KehadiranIngestInput): Promise<HasilPegawai> {
	const nip = input.nip && /^\d{18}$/.test(input.nip) ? input.nip : null;
	const email = input.email.trim().toLowerCase();
	const lewatNip = nip
		? (await db.select().from(pegawai).where(eq(pegawai.nip, nip)).limit(1))[0]
		: undefined;
	const peta = (
		await db
			.select()
			.from(pemetaanEmailKehadiran)
			.where(eq(pemetaanEmailKehadiran.email, email))
			.limit(1)
	)[0];
	const lewatEmail = peta
		? (await db.select().from(pegawai).where(eq(pegawai.id, peta.pegawaiId)).limit(1))[0]
		: undefined;
	return tentukanKodePegawai({ nip, email, lewatNip, lewatEmail });
}

function draftUrl(asalAplikasi: string, catatanId: string) {
	return `${asalAplikasi.replace(/\/$/, "")}/app/catatan/${catatanId}`;
}

export async function prosesCheckinKehadiran(input: KehadiranIngestInput, asalAplikasi: string) {
	const identitas = await cariPegawai(input);
	if (!identitas.ok) {
		return {
			http: 404 as const,
			body: { status: "perlu_nip", code: identitas.code, pesan: identitas.pesan },
		};
	}

	const isian = bangunIsianDraf(input);
	const galatWaktu = validasiWaktu(isian.waktuMulai, isian.waktuSelesai, isian.menitEfektif);
	if (galatWaktu[0]) {
		return { http: 400 as const, body: { status: "dilewati", pesan: galatWaktu[0] } };
	}

	const existing = (
		await db
			.select()
			.from(integrasiKehadiran)
			.where(eq(integrasiKehadiran.kunciIdempotensi, input.idempotencyKey))
			.limit(1)
	)[0];

	if (existing?.status === "aktif" && existing.catatanHarianId) {
		return {
			http: 200 as const,
			body: {
				status: "disiapkan",
				draftUrl: draftUrl(asalAplikasi, existing.catatanHarianId),
				pesan: "Draf logbook kinerja sudah disiapkan.",
			},
		};
	}

	const now = new Date().toISOString();
	const catatanId = buatId("ctt");
	await db.insert(catatanHarian).values({
		id: catatanId,
		pegawaiId: identitas.pegawai.id,
		unitKerjaIdSnapshot: identitas.pegawai.unitKerjaId,
		timKerjaIdSnapshot: identitas.pegawai.timKerjaId,
		produkId: null,
		tahapanId: null,
		aktivitasId: null,
		ikiId: null,
		rencanaAksiId: null,
		usulanNormaWaktu: isian.menitEfektif,
		...isian,
		status: "DRAFT",
		createdAt: now,
		updatedAt: now,
	});

	if (existing) {
		await db
			.update(integrasiKehadiran)
			.set({
				catatanHarianId: catatanId,
				pegawaiId: identitas.pegawai.id,
				status: "aktif",
				updatedAt: now,
			})
			.where(eq(integrasiKehadiran.id, existing.id));
	} else {
		await db.insert(integrasiKehadiran).values({
			id: buatId("ikh"),
			kunciIdempotensi: input.idempotencyKey,
			catatanHarianId: catatanId,
			pegawaiId: identitas.pegawai.id,
			kodeRapat: input.kodeRapat,
			pesertaId: input.pesertaId,
			status: "aktif",
			createdAt: now,
			updatedAt: now,
		});
	}

	try {
		await kirimNotifikasi({
			pegawaiId: identitas.pegawai.id,
			judul: "Draf dari kehadiran rapat",
			isi: `Draf catatan sudah disiapkan: ${input.judulRapat}. Lengkapi IKI lalu ajukan.`,
			tautan: `/app/catatan/${catatanId}`,
		});
	} catch {
		// Draf tetap sah meski notifikasi gagal.
	}

	return {
		http: 200 as const,
		body: {
			status: "disiapkan",
			draftUrl: draftUrl(asalAplikasi, catatanId),
			pesan: "Draf logbook kinerja sudah disiapkan.",
		},
	};
}

export async function prosesUndoKehadiran(input: KehadiranIngestInput) {
	const existing = (
		await db
			.select()
			.from(integrasiKehadiran)
			.where(eq(integrasiKehadiran.kunciIdempotensi, input.idempotencyKey))
			.limit(1)
	)[0];
	if (!existing) {
		return {
			http: 200 as const,
			body: { status: "dilewati", pesan: "Tidak ada draf kehadiran yang perlu dicabut." },
		};
	}

	const catatan = existing.catatanHarianId
		? (
				await db
					.select()
					.from(catatanHarian)
					.where(eq(catatanHarian.id, existing.catatanHarianId))
					.limit(1)
			)[0]
		: undefined;
	const aksi = putuskanUndo(catatan?.status ?? null);
	const now = new Date().toISOString();

	if (aksi === "hapus_draf" && catatan) {
		await db
			.update(integrasiKehadiran)
			.set({ catatanHarianId: null, status: "dicabut", updatedAt: now })
			.where(eq(integrasiKehadiran.id, existing.id));
		await db.delete(catatanHarian).where(eq(catatanHarian.id, catatan.id));
		return {
			http: 200 as const,
			body: { status: "disiapkan", pesan: "Draf logbook dari kehadiran telah dicabut." },
		};
	}

	if (aksi === "tandai" && catatan) {
		await db
			.update(catatanHarian)
			.set({
				catatanValidasi:
					"Kehadiran pada sistem Kehadiran Rapat dibatalkan. Catatan ini tidak dihapus karena sudah diajukan atau diverifikasi.",
				updatedAt: now,
			})
			.where(eq(catatanHarian.id, catatan.id));
		await db
			.update(integrasiKehadiran)
			.set({ status: "dicabut", updatedAt: now })
			.where(eq(integrasiKehadiran.id, existing.id));
		return {
			http: 200 as const,
			body: {
				status: "disiapkan",
				pesan: "Catatan logbook tetap ada karena sudah diajukan atau diverifikasi.",
			},
		};
	}

	await db
		.update(integrasiKehadiran)
		.set({ status: "dicabut", updatedAt: now })
		.where(eq(integrasiKehadiran.id, existing.id));
	return {
		http: 200 as const,
		body: { status: "dilewati", pesan: "Tidak ada draf kehadiran yang perlu dicabut." },
	};
}
