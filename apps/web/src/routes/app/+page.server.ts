import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
	const res = await fetch("/api/klasemen?periode=hari");
	if (!res.ok) return { klasemen: null };
	return { klasemen: await res.json() };
};
