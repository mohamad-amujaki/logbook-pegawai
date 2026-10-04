import {
	catatanHarian,
	db,
	integrasiKehadiran,
	pegawai,
	pemetaanEmailKehadiran,
} from "@logbook/db";
import {
	durasiKalenderMenit,
	NAMA_PRODUK_KEHADIRAN,
	NAMA_TAHAPAN_KEHADIRAN,
	tanggalWib,
	validasiWaktu,
	type KehadiranIngestInput,
} from "@logbook/schemas";
import { eq } from "drizzle-orm";
import { catatAuditSistem } from "./audit";
import { buatId } from "./id";
import { kirimNotifikasi } from "./notify";

async function auditKehadiran(
	aksi: string,
	input: KehadiranIngestInput,
	hasil: { status: string; http: number; pegawaiId?: string },
) {
	try {
		await catatAuditSistem(aksi, {
			alasan: input.idempotencyKey,
			sesudah: {
				pegawaiId: hasil.pegawaiId ?? null,
				kodeRapat: input.kodeRapat,
				status: hasil.status,
				http: hasil.http,
			},
		});
	} catch {
		// Integrasi tetap jalan meski audit gagal.
	}
}

export type HasilPegawai =
	| { ok: true; pegawai: typeof pegawai.$inferSelect }
	| { ok: false; code: "NIP_REQUIRED" | "PEGAWAI_NOT_FOUND" | "IDENTITAS_BENTROK"; pesan: string };

export function tentukanKodePegawai(input: {
	nip?: string | null;
	email: string;
	lewatNip: typeof pegawai.$inferSelect | undefined;
	lewatEmail: typeof pegawai.$inferSelect | undefined;
}): HasilPegawai {
	if (input.lewatNip && input.lewatEmail && input.lewatNip.id !== input.lewatEmail.id) {
		return {
			ok: false,
			code: "IDENTITAS_BENTROK",
			pesan: "NIP dan email tidak merujuk pegawai yang sama.",
		};
	}
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
		namaManualProduk: NAMA_PRODUK_KEHADIRAN,
		namaManualTahapan: NAMA_TAHAPAN_KEHADIRAN,
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

export function putuskanUndo(
	statusCatatan: string | null,
): "hapus_draf" | "tandai" | "cabut_integrasi" | "abaikan" {
	switch (statusCatatan) {
		case "DRAFT":
			return "hapus_draf";
		case "SUBMIT":
		case "DITOLAK":
			return "tandai";
		case "TERVERIFIKASI":
			return "cabut_integrasi";
		case null:
			return "abaikan";
		default:
			return "abaikan";
	}
}

function gagalIdentitas(hasil: Extract<HasilPegawai, { ok: false }>) {
	if (hasil.code === "IDENTITAS_BENTROK") {
		return {
			http: 409 as const,
			body: { status: "ditolak" as const, code: hasil.code, pesan: hasil.pesan },
		};
	}
	return {
		http: 404 as const,
		body: { status: "perlu_nip" as const, code: hasil.code, pesan: hasil.pesan },
	};
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
		const gagal = gagalIdentitas(identitas);
		await auditKehadiran("kehadiran.checkin", input, { status: gagal.body.status, http: gagal.http });
		return gagal;
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

	if (existing && existing.pegawaiId !== identitas.pegawai.id) {
		const hasil = {
			http: 409 as const,
			body: {
				status: "ditolak" as const,
				pesan: "Kunci idempotensi sudah terpakai untuk pegawai lain.",
			},
		};
		await auditKehadiran("kehadiran.checkin", input, {
			status: hasil.body.status,
			http: hasil.http,
			pegawaiId: identitas.pegawai.id,
		});
		return hasil;
	}

	if (existing?.status === "aktif" && existing.catatanHarianId) {
		const hasil = {
			http: 200 as const,
			body: {
				status: "disiapkan" as const,
				draftUrl: draftUrl(asalAplikasi, existing.catatanHarianId),
				pesan: "Draf logbook kinerja sudah disiapkan.",
			},
		};
		await auditKehadiran("kehadiran.checkin", input, {
			status: hasil.body.status,
			http: hasil.http,
			pegawaiId: identitas.pegawai.id,
		});
		return hasil;
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

	const hasil = {
		http: 200 as const,
		body: {
			status: "disiapkan" as const,
			draftUrl: draftUrl(asalAplikasi, catatanId),
			pesan: "Draf logbook kinerja sudah disiapkan.",
		},
	};
	await auditKehadiran("kehadiran.checkin", input, {
		status: hasil.body.status,
		http: hasil.http,
		pegawaiId: identitas.pegawai.id,
	});
	return hasil;
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

	const identitas = await cariPegawai(input);
	if (!identitas.ok) {
		const gagal = gagalIdentitas(identitas);
		await auditKehadiran("kehadiran.undo", input, { status: gagal.body.status, http: gagal.http });
		return gagal;
	}
	if (identitas.pegawai.id !== existing.pegawaiId) {
		const hasil = {
			http: 409 as const,
			body: {
				status: "ditolak" as const,
				pesan: "Undo kehadiran tidak cocok dengan pegawai pada draf tersebut.",
			},
		};
		await auditKehadiran("kehadiran.undo", input, {
			status: hasil.body.status,
			http: hasil.http,
			pegawaiId: identitas.pegawai.id,
		});
		return hasil;
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
	const selesaiUndo = async <T extends { http: number; body: { status: string } }>(hasil: T) => {
		await auditKehadiran("kehadiran.undo", input, {
			status: hasil.body.status,
			http: hasil.http,
			pegawaiId: existing.pegawaiId,
		});
		return hasil;
	};

	if (aksi === "hapus_draf" && catatan) {
		await db
			.update(integrasiKehadiran)
			.set({ catatanHarianId: null, status: "dicabut", updatedAt: now })
			.where(eq(integrasiKehadiran.id, existing.id));
		await db.delete(catatanHarian).where(eq(catatanHarian.id, catatan.id));
		return selesaiUndo({
			http: 200 as const,
			body: { status: "disiapkan", pesan: "Draf logbook dari kehadiran telah dicabut." },
		});
	}

	if (aksi === "tandai" && catatan) {
		await db
			.update(catatanHarian)
			.set({
				catatanValidasi:
					"Kehadiran pada sistem Kehadiran Rapat dibatalkan. Catatan ini tidak dihapus karena sudah diajukan.",
				updatedAt: now,
			})
			.where(eq(catatanHarian.id, catatan.id));
		await db
			.update(integrasiKehadiran)
			.set({ status: "dicabut", updatedAt: now })
			.where(eq(integrasiKehadiran.id, existing.id));
		return selesaiUndo({
			http: 200 as const,
			body: {
				status: "disiapkan",
				pesan: "Catatan logbook tetap ada karena sudah diajukan.",
			},
		});
	}

	if (aksi === "cabut_integrasi") {
		await db
			.update(integrasiKehadiran)
			.set({ status: "dicabut", updatedAt: now })
			.where(eq(integrasiKehadiran.id, existing.id));
		try {
			await kirimNotifikasi({
				pegawaiId: existing.pegawaiId,
				judul: "Kehadiran rapat dibatalkan",
				isi: "Kehadiran pada portal Kehadiran Rapat dibatalkan. Catatan yang sudah diverifikasi tidak diubah.",
				tautan: catatan ? `/app/catatan/${catatan.id}` : "/app/catatan",
			});
		} catch {
			// Cabut integrasi tetap sah meski notifikasi gagal.
		}
		return selesaiUndo({
			http: 200 as const,
			body: {
				status: "dilewati",
				pesan: "Catatan terverifikasi tidak diubah. Tautan kehadiran dicabut.",
			},
		});
	}

	await db
		.update(integrasiKehadiran)
		.set({ status: "dicabut", updatedAt: now })
		.where(eq(integrasiKehadiran.id, existing.id));
	return selesaiUndo({
		http: 200 as const,
		body: { status: "dilewati", pesan: "Tidak ada draf kehadiran yang perlu dicabut." },
	});
}
