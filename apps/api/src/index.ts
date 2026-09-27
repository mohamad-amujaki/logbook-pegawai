import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { catatanRoutes } from "./routes/catatan";
import { klasemenRoutes } from "./routes/klasemen";
import { masterRoutes } from "./routes/master";
import { meRoutes } from "./routes/me";
import { notifikasiRoutes } from "./routes/notifikasi";
import { skpRoutes } from "./routes/skp";
import { validasiRoutes } from "./routes/validasi";

const app = new Hono().basePath("/api");

app.use(
	"*",
	cors({
		origin: process.env.APP_ORIGIN ?? "http://localhost:5173",
		credentials: true,
	}),
);

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);
app.route("/me", meRoutes);
app.route("/catatan", catatanRoutes);
app.route("/validasi", validasiRoutes);
app.route("/klasemen", klasemenRoutes);
app.route("/notifikasi", notifikasiRoutes);
app.route("/master", masterRoutes);
app.route("/skp", skpRoutes);

const port = Number(process.env.PORT ?? 8787);
export default { port, fetch: app.fetch };

console.log(`API Logbook di http://localhost:${port}`);
