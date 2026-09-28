import { db, hashPassword, pegawai, sesi, verifyPassword } from "@logbook/db";
import { gantiSandiSchema, loginSchema } from "@logbook/schemas";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { buatId } from "../lib/id";
import { requireAuth } from "../middleware/auth";

const attempts = new Map<string, number[]>();

function tooMany(nip: string): boolean {
	const now = Date.now();
	const windowMs = 15 * 60_000;
	const list = (attempts.get(nip) ?? []).filter((t) => now - t < windowMs);
	attempts.set(nip, list);
	return list.length >= 10;
}

function record(nip: string) {
	const list = attempts.get(nip) ?? [];
	list.push(Date.now());
	attempts.set(nip, list);
}

function dariForm(c: Context): boolean {
	return !(c.req.header("content-type") ?? "").includes("application/json");
}

function gagalLogin(c: Context, pesan: string, field: string | undefined, status: 400 | 401 | 429) {
	if (dariForm(c)) {
		return c.redirect(`/login?galat=${encodeURIComponent(pesan)}`, 303);
	}
	return c.json({ error: pesan, field }, status);
}

async function bacaLogin(c: Context) {
	if (dariForm(c)) {
		const body = await c.req.parseBody();
		return loginSchema.safeParse({
			nip: String(body.nip ?? ""),
			sandi: String(body.sandi ?? ""),
		});
	}
	return loginSchema.safeParse(await c.req.json());
}

export const authRoutes = new Hono()
	.post("/login", async (c) => {
		const parsed = await bacaLogin(c);
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return gagalLogin(
				c,
				first?.message ?? "NIP dan kata sandi wajib diisi.",
				typeof first?.path[0] === "string" ? first.path[0] : undefined,
				400,
			);
		}
		const { nip, sandi } = parsed.data;
		if (tooMany(nip)) {
			return gagalLogin(c, "Terlalu banyak percobaan. Coba lagi 15 menit.", undefined, 429);
		}

		const found = await db.select().from(pegawai).where(eq(pegawai.nip, nip)).limit(1);
		const user = found[0];
		if (!user) {
			record(nip);
			return gagalLogin(c, "NIP tidak terdaftar.", "nip", 401);
		}

		const ok = await verifyPassword(sandi, user.passwordHash);
		if (!ok) {
			record(nip);
			return gagalLogin(c, "Kata sandi tidak sesuai.", "sandi", 401);
		}

		const sid = buatId("ses");
		const berakhir = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
		await db.insert(sesi).values({
			id: sid,
			pegawaiId: user.id,
			berakhirPada: berakhir,
		});

		setCookie(c, "logbook_sesi", sid, {
			httpOnly: true,
			sameSite: "Lax",
			secure: new URL(c.req.url).protocol === "https:",
			path: "/",
			maxAge: 7 * 24 * 60 * 60,
		});

		if (dariForm(c)) {
			return c.redirect(user.wajibGantiSandi ? "/ganti-sandi" : "/app", 303);
		}
		return c.json({
			wajibGantiSandi: user.wajibGantiSandi,
			nama: user.namaLengkap,
		});
	})
	.post("/ganti-sandi", requireAuth, async (c) => {
		const user = c.get("user");
		const parsed = dariForm(c)
			? gantiSandiSchema.safeParse(await c.req.parseBody())
			: gantiSandiSchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			const pesan = first?.message ?? "Sandi baru belum lengkap.";
			if (dariForm(c)) return c.redirect(`/ganti-sandi?galat=${encodeURIComponent(pesan)}`, 303);
			return c.json({ error: pesan, field: first?.path[0] }, 400);
		}
		const { sandiBaru } = parsed.data;
		if (sandiBaru === user.nip) {
			const pesan = "Kata sandi baru tidak boleh sama dengan NIP.";
			if (dariForm(c)) return c.redirect(`/ganti-sandi?galat=${encodeURIComponent(pesan)}`, 303);
			return c.json({ error: pesan, field: "sandiBaru" }, 400);
		}
		const hash = await hashPassword(sandiBaru);
		await db
			.update(pegawai)
			.set({ passwordHash: hash, wajibGantiSandi: false, updatedAt: new Date().toISOString() })
			.where(eq(pegawai.id, user.id));
		if (dariForm(c)) return c.redirect("/app", 303);
		return c.json({ ok: true });
	})
	.post("/logout", requireAuth, async (c) => {
		const sid = c.req.header("cookie")?.match(/logbook_sesi=([^;]+)/)?.[1];
		if (sid) await db.delete(sesi).where(eq(sesi.id, sid));
		deleteCookie(c, "logbook_sesi", { path: "/" });
		return c.json({ ok: true });
	});
