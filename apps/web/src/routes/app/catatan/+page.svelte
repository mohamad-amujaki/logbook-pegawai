<script lang="ts">
	import { onMount } from "svelte";
	import { api } from "$lib/api";
	import { labelJenis, labelStatus } from "$lib/format";

	type Row = {
		catatan: {
			id: string;
			tanggal: string;
			jenisTugas: string;
			uraian: string;
			menitEfektif: number;
			status: string;
			isiManual: boolean;
		};
		produkNama: string | null;
		tahapanNama: string | null;
	};

	let rows = $state<Row[]>([]);

	onMount(async () => {
		rows = await api("/catatan");
	});

	async function submit(id: string) {
		await api(`/catatan/${id}/submit`, { method: "POST" });
		rows = await api("/catatan");
	}
</script>

<div class="mb-4 flex items-center justify-between">
	<h1 class="text-xl font-semibold">Catatan harian</h1>
	<a class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" href="/app/catatan/baru">Catatan baru</a>
</div>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead>
			<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
				<th class="border-b border-border-strong px-3 py-2">Tanggal</th>
				<th class="border-b border-border-strong px-3 py-2">Jenis</th>
				<th class="border-b border-border-strong px-3 py-2">Produk / tahapan</th>
				<th class="border-b border-border-strong px-3 py-2">Uraian</th>
				<th class="border-b border-border-strong px-3 py-2">Menit</th>
				<th class="border-b border-border-strong px-3 py-2">Status</th>
				<th class="border-b border-border-strong px-3 py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r, i}
				<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
					<td class="border-b border-border px-3 py-3 font-mono">{r.catatan.tanggal}</td>
					<td class="border-b border-border px-3 py-3">{labelJenis(r.catatan.jenisTugas)}</td>
					<td class="border-b border-border px-3 py-3">
						{r.catatan.isiManual ? "Isi manual" : `${r.produkNama ?? "—"} / ${r.tahapanNama ?? "—"}`}
					</td>
					<td class="border-b border-border px-3 py-3">{r.catatan.uraian}</td>
					<td class="border-b border-border px-3 py-3 font-mono">{r.catatan.menitEfektif}</td>
					<td class="border-b border-border px-3 py-3">{labelStatus(r.catatan.status)}</td>
					<td class="border-b border-border px-3 py-3">
						{#if r.catatan.status === "DRAFT" || r.catatan.status === "DITOLAK"}
							<button class="text-accent" type="button" onclick={() => submit(r.catatan.id)}>Kirim</button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if rows.length === 0}
		<p class="mt-6 text-sm text-muted">Belum ada catatan hari ini.</p>
	{/if}
</div>
