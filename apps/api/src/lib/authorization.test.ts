import { describe, expect, it } from "vitest";
import type { Authed } from "../middleware/auth";
import { adminOnly, cakupanLaporan, dapatMelihatUnit } from "./authorization";

function user(overrides: Partial<Authed> = {}): Authed {
	return {
		akunId: "akun-1",
		id: "pegawai-1",
		nip: "199001012020011001",
		namaLengkap: "Pegawai",
		jabatan: "Analis",
		unitKerjaId: "unit-1",
		timKerjaId: "tim-1",
		wajibGantiSandi: false,
		isAdmin: false,
		isKepalaBiro: false,
		peran: [],
		unitKelolaIds: [],
		...overrides,
	};
}

describe("matriks otorisasi", () => {
	it("hanya peran ADMIN yang dapat mengelola akun", () => {
		expect(adminOnly(user())).toBe(false);
		expect(adminOnly(user({ peran: ["KEPALA_BIRO"], isKepalaBiro: true }))).toBe(false);
		expect(adminOnly(user({ peran: ["ADMIN"], isAdmin: true }))).toBe(true);
	});

	it("pengelola unit dibatasi pada unit yang diberikan", () => {
		const pengelola = user({
			peran: ["PENGELOLA_UNIT"],
			unitKelolaIds: ["unit-2"],
		});
		expect(dapatMelihatUnit(pengelola, "unit-2")).toBe(true);
		expect(dapatMelihatUnit(pengelola, "unit-3")).toBe(false);
		expect(cakupanLaporan(pengelola)).toBe("unit");
	});

	it("pegawai biasa hanya mendapat cakupan sendiri", () => {
		expect(cakupanLaporan(user())).toBe("sendiri");
	});
});
