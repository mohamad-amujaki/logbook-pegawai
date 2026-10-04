import { kehadiranIngestSchema } from "@logbook/schemas";
import { Hono } from "hono";
import { verifikasiPermintaanKehadiran } from "../lib/kehadiran-hmac";
import { prosesCheckinKehadiran, prosesUndoKehadiran } from "../lib/kehadiran-integrasi";

const APLIKASI_BAWAAN = "https://logbook-pegawai.mujaki.workers.dev";

export const kehadiranRoutes = new Hono().post("/:aksi", async (c) => {
	const aksi = c.req.param("aksi");
	if (aksi !== "checkin" && aksi !== "undo") {
		return c.json({ error: "Jalur integrasi tidak dikenali." }, 404);
	}

	const badan = await c.req.text();
	const verifikasi = await verifikasiPermintaanKehadiran({
		rahasia: c.env?.KEHADIRAN_HMAC_SECRET ?? process.env.KEHADIRAN_HMAC_SECRET,
		stempel: c.req.header("x-kehadiran-timestamp"),
		tandaTangan: c.req.header("x-kehadiran-signature"),
		badan,
	});
	if (!verifikasi.ok) {
		return c.json({ error: verifikasi.pesan }, verifikasi.status);
	}

	let json: unknown;
	try {
		json = JSON.parse(badan) as unknown;
	} catch {
		return c.json({ error: "Badan permintaan bukan JSON." }, 400);
	}

	const parsed = kehadiranIngestSchema.safeParse(json);
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, 400);
	}

	const asal = c.env?.APP_ORIGIN || process.env.APP_ORIGIN || APLIKASI_BAWAAN;
	const hasil =
		aksi === "checkin"
			? await prosesCheckinKehadiran(parsed.data, asal)
			: await prosesUndoKehadiran(parsed.data);
	return c.json(hasil.body, hasil.http);
});
