import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
	const res = await fetch("/api/me");
	if (res.ok) {
		const me = (await res.json()) as { user?: { wajibGantiSandi?: boolean } };
		redirect(303, me.user?.wajibGantiSandi ? "/ganti-sandi" : "/app");
	}
	redirect(303, "/login");
};
