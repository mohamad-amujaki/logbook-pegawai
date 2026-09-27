import { db, notifikasi } from "@logbook/db";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

export const notifikasiRoutes = new Hono()
	.use(requireAuth)
	.get("/", async (c) => {
		const user = c.get("user");
		const rows = await db
			.select()
			.from(notifikasi)
			.where(eq(notifikasi.pegawaiId, user.id))
			.orderBy(desc(notifikasi.createdAt))
			.limit(50);
		return c.json(rows);
	})
	.post("/:id/baca", async (c) => {
		const user = c.get("user");
		await db
			.update(notifikasi)
			.set({ dibaca: true })
			.where(and(eq(notifikasi.id, c.req.param("id")), eq(notifikasi.pegawaiId, user.id)));
		return c.json({ ok: true });
	})
	.post("/baca-semua", async (c) => {
		const user = c.get("user");
		await db.update(notifikasi).set({ dibaca: true }).where(eq(notifikasi.pegawaiId, user.id));
		return c.json({ ok: true });
	});
