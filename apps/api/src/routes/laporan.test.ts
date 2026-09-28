import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { bagiBatch, kePdf, keXlsx, type Laporan } from "./laporan";

const contoh: Laporan = {
	judul: "Aktivitas harian",
	subjudul: "Periode 2026-09-01 sampai 2026-09-30",
	dibuatPada: "2026-09-28T10:00:00.000Z",
	ringkasan: [{ label: "Catatan", nilai: "1" }],
	kolom: ["Pegawai", "Waktu terverifikasi"],
	baris: [["Pegawai Contoh", "6 jam 30 mnt"]],
};

describe("ekspor laporan", () => {
	it("memecah cakupan besar agar aman untuk batas parameter D1", () => {
		const batch = bagiBatch(Array.from({ length: 112 }, (_, i) => `pegawai-${i + 1}`));
		expect(batch.map((bagian) => bagian.length)).toEqual([80, 32]);
	});

	it("menghasilkan berkas PDF biner", async () => {
		const pdf = await kePdf(contoh, "Administrator");
		expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
		expect(pdf.byteLength).toBeGreaterThan(500);
	});

	it("menghasilkan workbook XLSX yang dapat dibaca", () => {
		const bytes = keXlsx(contoh);
		const workbook = XLSX.read(bytes, { type: "array" });
		expect(workbook.SheetNames).toContain("Laporan");
		const sheet = workbook.Sheets.Laporan;
		expect(sheet?.A1?.v).toBe("Aktivitas harian");
		expect(sheet?.A7?.v).toBe("Pegawai");
	});
});
