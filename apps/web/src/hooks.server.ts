import { dev } from "$app/environment";
import type { Handle } from "@sveltejs/kit";

const asalApi = process.env.API_ORIGIN ?? "http://localhost:8787";

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith("/api")) {
		const inisialisasi: RequestInit & { duplex?: "half" } = {
			method: event.request.method,
			redirect: "manual",
		};
		if (event.request.method !== "GET" && event.request.method !== "HEAD") {
			inisialisasi.body = event.request.body;
			inisialisasi.duplex = "half";
		}

		const api = event.platform?.env?.API;
		if (api && !dev) {
			inisialisasi.headers = event.request.headers;
			const tujuan = new URL(event.url.pathname + event.url.search, event.url.origin);
			return api.fetch(new Request(tujuan, inisialisasi));
		}

		const headers = new Headers();
		const cookie = event.request.headers.get("cookie");
		if (cookie) headers.set("cookie", cookie);
		const tipe = event.request.headers.get("content-type");
		if (tipe) headers.set("content-type", tipe);
		const stempel = event.request.headers.get("x-kehadiran-timestamp");
		if (stempel) headers.set("x-kehadiran-timestamp", stempel);
		const tanda = event.request.headers.get("x-kehadiran-signature");
		if (tanda) headers.set("x-kehadiran-signature", tanda);
		inisialisasi.headers = headers;
		const tujuan = new URL(event.url.pathname + event.url.search, asalApi);
		return fetch(new Request(tujuan, inisialisasi));
	}

	const response = await resolve(event);
	if (response.headers.get("content-type")?.includes("text/html")) {
		response.headers.set("Cache-Control", "no-store");
	}
	return response;
};
