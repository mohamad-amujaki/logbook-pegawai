import { describe, expect, it } from "vitest";
import {
	akumulasiMenitEfektif,
	akumulasiMenitTercatat,
	adaOverlap,
	durasiKalenderMenit,
	layakAutoVerifikasi,
	masukJamEfektif,
	masukJamTercatat,
	melewatiTenggatValidasi,
	selisihEvaluasi,
	statusPemenuhan,
	validasiBackdate,
	validasiWaktu,
} from "./jam-efektif";

describe("jam efektif", () => {
	it("mengakumulasi menit yang diisi (80), bukan durasi 120", () => {
		const durasi = durasiKalenderMenit("2026-09-27T08:00:00", "2026-09-27T10:00:00");
		expect(durasi).toBe(120);
		expect(selisihEvaluasi(durasi, 80)).toBe(40);
		expect(
			akumulasiMenitEfektif([{ jenisTugas: "TUSI", status: "TERVERIFIKASI", menitEfektif: 80 }]),
		).toBe(80);
	});

	it("Non TUSI tidak menambah jam efektif meski disetujui", () => {
		expect(masukJamEfektif("NON_TUSI", "TERVERIFIKASI")).toBe(false);
		expect(
			akumulasiMenitEfektif([
				{ jenisTugas: "NON_TUSI", status: "TERVERIFIKASI", menitEfektif: 420 },
			]),
		).toBe(0);
		expect(statusPemenuhan(0)).toBe("NOL");
	});

	it("catatan ditolak tidak terakumulasi", () => {
		expect(
			akumulasiMenitEfektif([
				{ jenisTugas: "TUSI", status: "DITOLAK", menitEfektif: 390 },
				{ jenisTugas: "TUSI", status: "SUBMIT", menitEfektif: 200 },
			]),
		).toBe(0);
	});

	it("jam tercatat memuat yang menunggu validasi, bukan draf atau ditolak", () => {
		expect(masukJamTercatat("TUSI", "SUBMIT")).toBe(true);
		expect(masukJamTercatat("TUSI", "DRAFT")).toBe(false);
		expect(masukJamTercatat("NON_TUSI", "SUBMIT")).toBe(false);
		expect(
			akumulasiMenitTercatat([
				{ jenisTugas: "TUSI", status: "TERVERIFIKASI", menitEfektif: 80 },
				{ jenisTugas: "TUSI", status: "SUBMIT", menitEfektif: 200 },
				{ jenisTugas: "TUSI", status: "DRAFT", menitEfektif: 60 },
				{ jenisTugas: "TUSI", status: "DITOLAK", menitEfektif: 90 },
			]),
		).toBe(280);
	});

	it("menolak menit efektif > durasi", () => {
		const errors = validasiWaktu("2026-09-27T08:00:00", "2026-09-27T09:00:00", 90);
		expect(errors.length).toBeGreaterThan(0);
	});

	it("mendeteksi waktu tumpang tindih", () => {
		expect(
			adaOverlap(
				"2026-09-27T08:00:00",
				"2026-09-27T10:00:00",
				"2026-09-27T09:00:00",
				"2026-09-27T11:00:00",
			),
		).toBe(true);
		expect(
			adaOverlap(
				"2026-09-27T08:00:00",
				"2026-09-27T09:00:00",
				"2026-09-27T09:00:00",
				"2026-09-27T10:00:00",
			),
		).toBe(false);
	});

	it("menerima backdate sampai H-4 dan menolak yang lebih lama", () => {
		const sekarang = new Date("2026-09-29T03:00:00.000Z"); // 10:00 WIB
		expect(validasiBackdate("2026-09-29T08:00", sekarang)).toBeNull();
		expect(validasiBackdate("2026-09-25T08:00", sekarang)).toBeNull();
		expect(validasiBackdate("2026-09-24T08:00", sekarang)).not.toBeNull();
	});

	it("memakai tanggal WIB, bukan UTC, sebagai acuan hari", () => {
		// 2026-09-29T23:30Z = 2026-09-30 06:30 WIB, jadi H-4 = 2026-09-26.
		const malamWib = new Date("2026-09-29T23:30:00.000Z");
		expect(validasiBackdate("2026-09-26T08:00", malamWib)).toBeNull();
		expect(validasiBackdate("2026-09-25T08:00", malamWib)).not.toBeNull();
	});

	it("hanya catatan wajar yang layak auto-verifikasi", () => {
		expect(layakAutoVerifikasi(80, 120)).toBe(true);
		expect(layakAutoVerifikasi(30, 180)).toBe(false);
	});

	it("melewati tenggat validasi setelah 4 hari", () => {
		const sekarang = new Date("2026-09-29T00:00:00.000Z");
		expect(melewatiTenggatValidasi(null, sekarang)).toBe(false);
		expect(melewatiTenggatValidasi("2026-09-26T00:00:00.000Z", sekarang)).toBe(false);
		expect(melewatiTenggatValidasi("2026-09-25T00:00:00.000Z", sekarang)).toBe(true);
	});
});
