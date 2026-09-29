import { type JenisTugas, type StatusCatatan, TARGET_MENIT_EFEKTIF } from "./enums";

/** Selisih jam mulai–selesai, dibulatkan ke menit. */
export function durasiKalenderMenit(mulaiIso: string, selesaiIso: string): number {
	const mulai = new Date(mulaiIso);
	const selesai = new Date(selesaiIso);
	return Math.round((selesai.getTime() - mulai.getTime()) / 60_000);
}

export function validasiWaktu(
	mulaiIso: string,
	selesaiIso: string,
	menitEfektif: number,
): string[] {
	const errors: string[] = [];
	const durasi = durasiKalenderMenit(mulaiIso, selesaiIso);
	if (Number.isNaN(durasi) || durasi <= 0) {
		errors.push("Waktu selesai harus lebih besar dari waktu mulai.");
	}
	if (menitEfektif <= 0) {
		errors.push("Waktu efektif harus lebih dari 0 menit.");
	}
	if (durasi > 0 && menitEfektif > durasi) {
		errors.push("Waktu efektif tidak boleh melebihi selisih jam mulai dan selesai.");
	}
	if (durasi > 24 * 60) {
		errors.push("Satu catatan tidak boleh lebih dari 24 jam.");
	}
	return errors;
}

/** Yang masuk akumulasi 6,5 jam resmi: TUSI/TUSI Lainnya yang sudah disetujui. */
export function masukJamEfektif(jenis: JenisTugas, status: StatusCatatan): boolean {
	if (jenis === "NON_TUSI") return false;
	return status === "TERVERIFIKASI";
}

/** Tercatat: resmi plus TUSI/TUSI Lainnya yang menunggu validasi. Draf dan ditolak tidak masuk. */
export function masukJamTercatat(jenis: JenisTugas, status: StatusCatatan): boolean {
	if (jenis === "NON_TUSI") return false;
	switch (status) {
		case "TERVERIFIKASI":
		case "SUBMIT":
			return true;
		case "DRAFT":
		case "DITOLAK":
			return false;
		default: {
			const _habis: never = status;
			return _habis;
		}
	}
}

export function selisihEvaluasi(durasiMenit: number, menitEfektif: number): number {
	return Math.max(0, durasiMenit - menitEfektif);
}

export type EntriJam = {
	jenisTugas: JenisTugas;
	status: StatusCatatan;
	menitEfektif: number;
};

export function akumulasiMenitEfektif(entri: EntriJam[]): number {
	return entri
		.filter((e) => masukJamEfektif(e.jenisTugas, e.status))
		.reduce((sum, e) => sum + e.menitEfektif, 0);
}

export function akumulasiMenitTercatat(entri: EntriJam[]): number {
	return entri
		.filter((e) => masukJamTercatat(e.jenisTugas, e.status))
		.reduce((sum, e) => sum + e.menitEfektif, 0);
}

export function persenPemenuhan(menit: number, target = TARGET_MENIT_EFEKTIF): number {
	if (target <= 0) return 0;
	return Math.round((menit / target) * 1000) / 10;
}

export function statusPemenuhan(
	menit: number,
	target = TARGET_MENIT_EFEKTIF,
): "TERPENUHI" | "KURANG" | "LEBIH" | "NOL" {
	if (menit <= 0) return "NOL";
	if (menit >= target * 1.2) return "LEBIH";
	if (menit >= target) return "TERPENUHI";
	return "KURANG";
}

export function adaOverlap(
	aMulai: string,
	aSelesai: string,
	bMulai: string,
	bSelesai: string,
): boolean {
	const a0 = new Date(aMulai).getTime();
	const a1 = new Date(aSelesai).getTime();
	const b0 = new Date(bMulai).getTime();
	const b1 = new Date(bSelesai).getTime();
	return a0 < b1 && b0 < a1;
}

export { TARGET_MENIT_EFEKTIF };

/** Jendela pengisian catatan: paling lama sekian hari kalender ke belakang. */
export const BATAS_HARI_BACKDATE = 4;

/** Tenggat validasi: setelah sekian hari sejak diajukan, catatan disetujui otomatis. */
export const BATAS_HARI_VALIDASI = 4;

/** Selisih durasi kalender vs menit efektif yang masih dianggap wajar untuk auto-verifikasi. */
export const SELISIH_ANOMALI_MENIT = 60;

const OFFSET_WIB_MENIT = 7 * 60;
const SEHARI_MS = 24 * 60 * 60 * 1000;

/** Tanggal (YYYY-MM-DD) menurut zona Asia/Jakarta, tanpa bergantung zona waktu server. */
export function tanggalWib(waktu: Date | string): string {
	const d = typeof waktu === "string" ? new Date(waktu) : waktu;
	return new Date(d.getTime() + OFFSET_WIB_MENIT * 60_000).toISOString().slice(0, 10);
}

function geserTanggal(tanggal: string, hari: number): string {
	const d = new Date(`${tanggal}T00:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + hari);
	return d.toISOString().slice(0, 10);
}

/**
 * Periksa apakah catatan masih dalam jendela pengisian (default H-4 s.d. hari ini).
 * Mengembalikan pesan galat, atau null bila sah.
 */
export function validasiBackdate(waktuMulai: string, sekarang: Date = new Date()): string | null {
	if (!/^\d{4}-\d{2}-\d{2}/.test(waktuMulai)) return "Waktu mulai tidak valid.";
	const tanggal = waktuMulai.slice(0, 10);
	const batas = geserTanggal(tanggalWib(sekarang), -BATAS_HARI_BACKDATE);
	if (tanggal < batas) {
		return `Catatan hanya bisa diisi untuk ${BATAS_HARI_BACKDATE} hari terakhir (sejak ${batas}).`;
	}
	return null;
}

/**
 * Auto-verifikasi tanpa kecuali hanya untuk catatan yang tidak mencurigakan:
 * selisih durasi kalender vs menit efektif tidak melebihi ambang.
 */
export function layakAutoVerifikasi(menitEfektif: number, durasiMenit: number): boolean {
	return selisihEvaluasi(durasiMenit, menitEfektif) <= SELISIH_ANOMALI_MENIT;
}

/** Apakah catatan SUBMIT sudah melewati tenggat validasi sejak diajukan. */
export function melewatiTenggatValidasi(
	diajukanPada: string | null,
	sekarang: Date = new Date(),
): boolean {
	if (!diajukanPada) return false;
	const ajukan = new Date(diajukanPada).getTime();
	if (Number.isNaN(ajukan)) return false;
	return sekarang.getTime() - ajukan >= BATAS_HARI_VALIDASI * SEHARI_MS;
}
