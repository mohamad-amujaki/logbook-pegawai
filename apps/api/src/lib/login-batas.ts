export const JENDELA_LOGIN_MS = 15 * 60_000;
export const BATAS_NIP_IP = 10;
export const BATAS_IP = 40;
export const PESAN_LOGIN_GAGAL = "NIP atau kata sandi tidak sesuai.";
export const PESAN_LOGIN_TERKUNCI = "Terlalu banyak percobaan. Coba lagi 15 menit.";

export function ipDariHeader(cf?: string | null, forwarded?: string | null): string {
	const langsung = cf?.trim();
	if (langsung) return langsung.slice(0, 64);
	const pertama = forwarded?.split(",")[0]?.trim();
	if (pertama) return pertama.slice(0, 64);
	return "unknown";
}

export function kunciNipIp(nip: string, ip: string): string {
	return `nip-ip:${nip}:${ip}`;
}

export function kunciIp(ip: string): string {
	return `ip:${ip}`;
}

export function loginTerkunci(jumlahNipIp: number, jumlahIp: number): boolean {
	return jumlahNipIp >= BATAS_NIP_IP || jumlahIp >= BATAS_IP;
}
