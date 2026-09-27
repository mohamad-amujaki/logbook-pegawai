import { describe, expect, it } from "vitest";
import {
	akumulasiMenitEfektif,
	akumulasiMenitTercatat,
	adaOverlap,
	durasiKalenderMenit,
	masukJamEfektif,
	masukJamTercatat,
	selisihEvaluasi,
	statusPemenuhan,
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
});
