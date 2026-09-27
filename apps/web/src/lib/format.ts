export function jamPendek(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	const jam = String(d.getHours()).padStart(2, "0");
	const menit = String(d.getMinutes()).padStart(2, "0");
	return `${jam}.${menit}`;
}

export function jamRentang(mulaiIso: string, selesaiIso: string): string {
	return `${jamPendek(mulaiIso)}–${jamPendek(selesaiIso)}`;
}

export function menitKeJam(menit: number): string {
	const jam = Math.floor(menit / 60);
	const sisa = menit % 60;
	if (jam === 0) return `${sisa} mnt`;
	if (sisa === 0) return `${jam} jam`;
	return `${jam} jam ${sisa} mnt`;
}

export function labelJenis(jenis: string): string {
	if (jenis === "TUSI") return "Tusi";
	if (jenis === "TUSI_LAINNYA") return "Tusi lainnya";
	return "Non Tusi";
}

export function labelStatus(status: string): string {
	if (status === "TERVERIFIKASI") return "Terverifikasi";
	if (status === "SUBMIT") return "Menunggu";
	if (status === "DITOLAK") return "Ditolak";
	if (status === "TERPENUHI") return "Terpenuhi";
	if (status === "KURANG") return "Kurang";
	if (status === "LEBIH") return "Lebih";
	if (status === "NOL") return "0 jam";
	return "Draf";
}

export function labelKategori(kategori: string): string {
	return kategori === "PERLU_DISKUSI" ? "Perlu diskusi" : "";
}
