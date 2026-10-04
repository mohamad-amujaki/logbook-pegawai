const asalLokal = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);

export function asalCorsDiizinkan(asal: string, aplikasi?: string): string | undefined {
	if (!asal) return undefined;
	if (asalLokal.has(asal)) return asal;
	const tujuan = aplikasi?.replace(/\/$/, "");
	if (tujuan && asal === tujuan) return asal;
	return undefined;
}
