import { describe, expect, it } from "vitest";
import { bangunIsianDraf, putuskanUndo, tentukanKodePegawai } from "./kehadiran-integrasi";
import { adalahCatatanKehadiran, type KehadiranIngestInput } from "@logbook/schemas";

const pegawaiAktif = {
	id: "pg1",
	nip: "199001012000011111",
	namaLengkap: "ASN Uji",
	pangkatGolongan: "III/a",
	tmt: null,
	jabatan: "Analis",
	unitKerjaId: "unit1",
	timKerjaId: null,
	status: "aktif",
	passwordHash: "x",
	wajibGantiSandi: false,
	isAdmin: false,
	isKepalaBiro: false,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const payload: KehadiranIngestInput = {
	action: "checkin",
	idempotencyKey: "RPT-1:199001012000011111:peserta-1",
	pesertaId: "peserta-1",
	kodeRapat: "RPT-1",
	nip: "199001012000011111",
	email: "asn@example.test",
	nama: "ASN Uji",
	judulRapat: "Rapat Uji",
	metodeKehadiran: "daring",
	tanggalMulai: "2026-10-02T07:00:00.000Z",
	tanggalSelesai: "2026-10-02T08:30:00.000Z",
	menitEfektif: 90,
	uraian: "Menghadiri rapat: Rapat Uji (daring, RPT-1)",
	output: 1,
	buktiUrl: "https://kehadiran-rapat.web.id/r/RPT-1/tiket?checkin=CHK-1",
};

describe("tentukanKodePegawai", () => {
	it("mengutamakan NIP aktif", () => {
		const hasil = tentukanKodePegawai({
			nip: pegawaiAktif.nip,
			email: "asn@example.test",
			lewatNip: pegawaiAktif,
			lewatEmail: undefined,
		});
		expect(hasil.ok).toBe(true);
	});

	it("memakai pemetaan email jika NIP kosong", () => {
		const hasil = tentukanKodePegawai({
			nip: null,
			email: "asn@example.test",
			lewatNip: undefined,
			lewatEmail: pegawaiAktif,
		});
		expect(hasil.ok).toBe(true);
	});

	it("meminta NIP bila tidak ada cadangan email", () => {
		const hasil = tentukanKodePegawai({
			nip: null,
			email: "tamu@example.test",
			lewatNip: undefined,
			lewatEmail: undefined,
		});
		expect(hasil).toMatchObject({ ok: false, code: "NIP_REQUIRED" });
	});

	it("menolak bila NIP dan email merujuk pegawai berbeda", () => {
		const hasil = tentukanKodePegawai({
			nip: pegawaiAktif.nip,
			email: "lain@example.test",
			lewatNip: pegawaiAktif,
			lewatEmail: { ...pegawaiAktif, id: "pg2", nip: "198001012000011111" },
		});
		expect(hasil).toMatchObject({ ok: false, code: "IDENTITAS_BENTROK" });
	});

	it("menerima bila NIP dan email merujuk pegawai yang sama", () => {
		const hasil = tentukanKodePegawai({
			nip: pegawaiAktif.nip,
			email: "asn@example.test",
			lewatNip: pegawaiAktif,
			lewatEmail: pegawaiAktif,
		});
		expect(hasil.ok).toBe(true);
	});
});

describe("bangunIsianDraf", () => {
	it("mengisi draf Tusi Lainnya dari jadwal rapat", () => {
		const isian = bangunIsianDraf(payload);
		expect(isian.jenisTugas).toBe("TUSI_LAINNYA");
		expect(isian.isiManual).toBe(true);
		expect(isian.namaManualProduk).toBe("Kehadiran Rapat");
		expect(isian.namaManualTahapan).toBe("Otomatis");
		expect(isian.menitEfektif).toBe(90);
		expect(isian.tanggal).toBe("2026-10-02");
		expect(isian.satuanOutput).toBe("rapat");
		expect(adalahCatatanKehadiran(isian)).toBe(true);
		expect(adalahCatatanKehadiran({ isiManual: true, namaManualProduk: "Kehadiran rapat" })).toBe(
			true,
		);
	});
});

describe("putuskanUndo", () => {
	it("mencabut draf dan menandai catatan yang sudah diajukan", () => {
		expect(putuskanUndo("DRAFT")).toBe("hapus_draf");
		expect(putuskanUndo("SUBMIT")).toBe("tandai");
		expect(putuskanUndo("DITOLAK")).toBe("tandai");
		expect(putuskanUndo("TERVERIFIKASI")).toBe("cabut_integrasi");
		expect(putuskanUndo(null)).toBe("abaikan");
	});
});
