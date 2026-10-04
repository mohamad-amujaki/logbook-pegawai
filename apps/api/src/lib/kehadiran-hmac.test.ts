import { describe, expect, it } from "vitest";
import { hexSama, tandaTanganiKehadiran, verifikasiPermintaanKehadiran } from "./kehadiran-hmac";

describe("HMAC kehadiran", () => {
	it("menerima tanda tangan yang cocok dalam jendela waktu", async () => {
		const badan = '{"ok":true}';
		const stempel = "1700000000";
		const tanda = await tandaTanganiKehadiran("rahasia", stempel, badan);
		const hasil = await verifikasiPermintaanKehadiran({
			rahasia: "rahasia",
			stempel,
			tandaTangan: tanda,
			badan,
			sekarang: 1700000000,
		});
		expect(hasil).toEqual({ ok: true });
	});

	it("menolak stempel kedaluwarsa", async () => {
		const badan = "{}";
		const stempel = "1700000000";
		const tanda = await tandaTanganiKehadiran("rahasia", stempel, badan);
		const hasil = await verifikasiPermintaanKehadiran({
			rahasia: "rahasia",
			stempel,
			tandaTangan: tanda,
			badan,
			sekarang: 1700000401,
		});
		expect(hasil.ok).toBe(false);
		if (!hasil.ok) expect(hasil.status).toBe(401);
	});

	it("membandingkan hex secara konstan terhadap panjang sama", () => {
		expect(hexSama("ab", "ab")).toBe(true);
		expect(hexSama("ab", "ac")).toBe(false);
		expect(hexSama("ab", "abc")).toBe(false);
	});
});
