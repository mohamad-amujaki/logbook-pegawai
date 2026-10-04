const JENDELA_DETIK = 300;

export async function tandaTanganiKehadiran(
	rahasia: string,
	stempel: string,
	badan: string,
): Promise<string> {
	const kunci = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(rahasia),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const tanda = await crypto.subtle.sign(
		"HMAC",
		kunci,
		new TextEncoder().encode(`${stempel}.${badan}`),
	);
	return [...new Uint8Array(tanda)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexSama(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let beda = 0;
	for (let i = 0; i < a.length; i += 1) {
		beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return beda === 0;
}

export async function verifikasiPermintaanKehadiran(input: {
	rahasia?: string;
	stempel: string | null;
	tandaTangan: string | null;
	badan: string;
	sekarang?: number;
}): Promise<{ ok: true } | { ok: false; status: 401 | 503; pesan: string }> {
	if (!input.rahasia) {
		return { ok: false, status: 503, pesan: "Integrasi kehadiran belum dikonfigurasi." };
	}
	const stempel = input.stempel?.trim() ?? "";
	const tanda = (input.tandaTangan ?? "").trim().toLowerCase();
	const unix = Number(stempel);
	const sekarang = input.sekarang ?? Math.floor(Date.now() / 1000);
	if (!stempel || !Number.isFinite(unix) || Math.abs(sekarang - unix) > JENDELA_DETIK) {
		return { ok: false, status: 401, pesan: "Stempel waktu integrasi tidak valid." };
	}
	const harapan = await tandaTanganiKehadiran(input.rahasia, stempel, input.badan);
	if (!hexSama(harapan, tanda)) {
		return { ok: false, status: 401, pesan: "Tanda tangan integrasi tidak valid." };
	}
	return { ok: true };
}
