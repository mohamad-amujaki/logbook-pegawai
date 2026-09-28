import { redirect } from "@sveltejs/kit";
import type { Me } from "$lib/api";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ fetch }) => {
	const res = await fetch("/api/me");
	if (!res.ok) redirect(303, "/login");
	const me = (await res.json()) as Me;
	if (me.user.wajibGantiSandi) redirect(303, "/ganti-sandi");
	return { me };
};
