import { describe, expect, it } from "vitest";
import { ipDariHeader, kunciIp, kunciNipIp, loginTerkunci } from "./login-batas";
import { asalCorsDiizinkan } from "./cors";

describe("batas login", () => {
	it("membaca IP Cloudflare atau forwarded", () => {
		expect(ipDariHeader("1.2.3.4", "9.9.9.9")).toBe("1.2.3.4");
		expect(ipDariHeader(null, "5.5.5.5, 6.6.6.6")).toBe("5.5.5.5");
		expect(ipDariHeader(null, null)).toBe("unknown");
	});

	it("mengunci per NIP+IP atau per IP", () => {
		expect(loginTerkunci(10, 0)).toBe(true);
		expect(loginTerkunci(0, 40)).toBe(true);
		expect(loginTerkunci(9, 39)).toBe(false);
		expect(kunciNipIp("1", "2")).toBe("nip-ip:1:2");
		expect(kunciIp("2")).toBe("ip:2");
	});
});

describe("asal CORS", () => {
	it("hanya mengizinkan localhost dan origin aplikasi", () => {
		expect(asalCorsDiizinkan("http://localhost:5173", "https://logbook-pegawai.mujaki.workers.dev")).toBe(
			"http://localhost:5173",
		);
		expect(
			asalCorsDiizinkan(
				"https://logbook-pegawai.mujaki.workers.dev",
				"https://logbook-pegawai.mujaki.workers.dev",
			),
		).toBe("https://logbook-pegawai.mujaki.workers.dev");
		expect(asalCorsDiizinkan("https://evil.workers.dev", "https://logbook-pegawai.mujaki.workers.dev")).toBeUndefined();
	});
});
