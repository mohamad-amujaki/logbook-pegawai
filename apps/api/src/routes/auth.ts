import { db, hashPassword, pegawai, sesi, verifyPassword } from "@logbook/db";
import { gantiSandiSchema, loginSchema } from "@logbook/schemas";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
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

export const authRoutes = new Hono()
	.post("/login", async (c) => {
		const parsed = loginSchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return c.json(
				{ error: first?.message ?? "NIP dan kata sandi wajib diisi.", field: first?.path[0] },
				400,
			);
		}
		const { nip, sandi } = parsed.data;
		if (tooMany(nip)) {
			return c.json({ error: "Terlalu banyak percobaan. Coba lagi 15 menit." }, 429);
		}

		const found = await db.select().from(pegawai).where(eq(pegawai.nip, nip)).limit(1);
		const user = found[0];
		if (!user) {
			record(nip);
			return c.json({ error: "NIP tidak terdaftar.", field: "nip" }, 401);
		}

		const ok = await verifyPassword(sandi, user.passwordHash);
		if (!ok) {
			record(nip);
			return c.json({ error: "Kata sandi tidak sesuai.", field: "sandi" }, 401);
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
			path: "/",
			maxAge: 7 * 24 * 60 * 60,
		});

		return c.json({
			wajibGantiSandi: user.wajibGantiSandi,
			nama: user.namaLengkap,
		});
	})
	.post("/ganti-sandi", requireAuth, async (c) => {
		const user = c.get("user");
		const parsed = gantiSandiSchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return c.json(
				{ error: first?.message ?? "Sandi baru belum lengkap.", field: first?.path[0] },
				400,
			);
		}
		const { sandiBaru } = parsed.data;
		if (sandiBaru === user.nip) {
			return c.json(
				{ error: "Kata sandi baru tidak boleh sama dengan NIP.", field: "sandiBaru" },
				400,
			);
		}
		const hash = await hashPassword(sandiBaru);
		await db
			.update(pegawai)
			.set({ passwordHash: hash, wajibGantiSandi: false, updatedAt: new Date().toISOString() })
			.where(eq(pegawai.id, user.id));
		return c.json({ ok: true });
	})
	.post("/logout", requireAuth, async (c) => {
		const sid = c.req.header("cookie")?.match(/logbook_sesi=([^;]+)/)?.[1];
		if (sid) await db.delete(sesi).where(eq(sesi.id, sid));
		deleteCookie(c, "logbook_sesi", { path: "/" });
		return c.json({ ok: true });
	});
