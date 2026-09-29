import { createD1Db, runWithDb } from "@logbook/db";
import { app, type ApiBindings } from "./app";
import { rekonsiliasiAutoValidasi } from "./lib/auto-validasi";

const APLIKASI = "https://logbook-pegawai.mujaki.workers.dev";

export default {
	fetch(request: Request, env: ApiBindings, ctx: ExecutionContext) {
		const url = new URL(request.url);
		if (url.pathname === "/" || url.pathname === "") {
			return Response.redirect(APLIKASI, 302);
		}
		return app.fetch(request, env, ctx);
	},
	async scheduled(_event: ScheduledController, env: ApiBindings) {
		if (!env.DB) return;
		const db = createD1Db(env.DB);
		await runWithDb(db, () => rekonsiliasiAutoValidasi());
	},
};
