import type { Authed } from "../middleware/auth";

export function adminOnly(user: Authed): boolean {
	return user.peran.includes("ADMIN");
}

export function dapatKelolaPengguna(user: Authed): boolean {
	return adminOnly(user);
}

export function dapatMelihatUnit(user: Authed, unitKerjaId: string): boolean {
	return (
		adminOnly(user) ||
		user.peran.includes("KEPALA_BIRO") ||
		user.unitKelolaIds.includes(unitKerjaId) ||
		user.unitKerjaId === unitKerjaId
	);
}

export function cakupanLaporan(user: Authed): "global" | "unit" | "sendiri" {
	if (adminOnly(user) || user.peran.includes("KEPALA_BIRO")) return "global";
	if (user.unitKelolaIds.length > 0) return "unit";
	return "sendiri";
}
