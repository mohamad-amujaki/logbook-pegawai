import { createD1Db, runWithDb } from "@logbook/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { catatanRoutes } from "./routes/catatan";
import { klasemenRoutes } from "./routes/klasemen";
import { laporanRoutes } from "./routes/laporan";
import { masterRoutes } from "./routes/master";
import { meRoutes } from "./routes/me";
import { notifikasiRoutes } from "./routes/notifikasi";
import { penggunaRoutes } from "./routes/pengguna";
import { skpRoutes } from "./routes/skp";
import { validasiRoutes } from "./routes/validasi";

export type ApiBindings = {
	DB?: D1Database;
	APP_ORIGIN?: string;
};

const asalLokal = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);

function asalDiizinkan(asal: string, cadangan?: string): string {
	if (asalLokal.has(asal) || asal.endsWith(".workers.dev")) return asal;
	if (cadangan) return cadangan;
	return "http://localhost:5173";
}

export const app = new Hono<{ Bindings: ApiBindings }>().basePath("/api");

app.use("*", async (c, next) => {
	if (c.env?.DB) {
		await c.env.DB.prepare("PRAGMA foreign_keys = ON").run();
		return runWithDb(createD1Db(c.env.DB), () => next());
	}
	await next();
});

app.use(
	"*",
	cors({
		origin: (asal, c) => asalDiizinkan(asal ?? "", c.env?.APP_ORIGIN),
		credentials: true,
	}),
);

app.get("/", (c) => c.json({ ok: true, layanan: "logbook-api" }));
app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);
app.route("/me", meRoutes);
app.route("/catatan", catatanRoutes);
app.route("/validasi", validasiRoutes);
app.route("/klasemen", klasemenRoutes);
app.route("/laporan", laporanRoutes);
app.route("/notifikasi", notifikasiRoutes);
app.route("/pengguna", penggunaRoutes);
app.route("/master", masterRoutes);
app.route("/skp", skpRoutes);
