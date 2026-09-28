function teksErrorApi(body: { error?: unknown; message?: unknown }): string {
	const cadangan = "Permintaan gagal. Muat ulang halaman, lalu coba lagi.";
	if (typeof body.error === "string" && body.error.trim()) return body.error;
	if (typeof body.message === "string" && body.message.trim()) return body.message;
	const issues = (body.error as { issues?: { message?: string }[] } | undefined)?.issues;
	const dariZod = issues?.find((i) => typeof i.message === "string")?.message;
	if (dariZod) return dariZod;
	return cadangan;
}

export class ApiError extends Error {
	field?: string;
	constructor(message: string, field?: string) {
		super(message);
		this.field = field;
	}
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(`/api${path}`, {
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(init.headers ?? {}),
		},
		...init,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const body = data as { error?: unknown; field?: string; message?: unknown };
		throw new ApiError(teksErrorApi(body), typeof body.field === "string" ? body.field : undefined);
	}
	return data as T;
}

export type OrangRingkas = {
	id: string;
	nip: string;
	namaLengkap: string;
	jabatan: string;
};

export type Me = {
	user: {
		id: string;
		nip: string;
		namaLengkap: string;
		jabatan: string;
		wajibGantiSandi: boolean;
		isAdmin: boolean;
		isKepalaBiro: boolean;
		peran: ("ADMIN" | "KEPALA_BIRO" | "PENGELOLA_UNIT")[];
		unitKelolaIds: string[];
		timKerjaId: string | null;
		timNama: string | null;
	};
	belumDibaca: number;
	skpLengkap: boolean;
	pemberiPertimbangan: OrangRingkas | null;
	pejabatPenilai: OrangRingkas | null;
	atasanPejabatPenilai: OrangRingkas | null;
	ketuaTim: { id: string; nama: string } | null;
	menungguValidasi: number;
	dapatMemvalidasi: boolean;
	dapatMelihatLaporan: boolean;
	dapatMengelolaPengguna: boolean;
};
