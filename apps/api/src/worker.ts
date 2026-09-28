import { app, type ApiBindings } from "./app";

const APLIKASI = "https://logbook-pegawai.mujaki.workers.dev";

export default {
	fetch(request: Request, env: ApiBindings, ctx: ExecutionContext) {
		const url = new URL(request.url);
		if (url.pathname === "/" || url.pathname === "") {
			return Response.redirect(APLIKASI, 302);
		}
		return app.fetch(request, env, ctx);
	},
};
