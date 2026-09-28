<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { api } from "$lib/api";
	import { labelStatus, menitKeJam } from "$lib/format";
	import SelectCari, { type OpsiCari } from "$lib/SelectCari.svelte";

	type Baris = {
		id: string;
		peringkat: number;
		namaLengkap: string;
		nip: string;
		jabatan: string;
		tim: string;
		menit: number;
		menitTercatat: number;
		persen: number;
		persenTercatat: number;
		status: string;
		statusTercatat: string;
	};

	type Data = {
		dari: string;
		sampai: string;
		stat: { rataMenit: number; persenCapai: number; persenTertaut: number };
		baris: Baris[];
	};

	const opsiPerHalaman = [5, 10, 15, 20] as const;

	let data = $state<Data | null>(null);
	let periode = $state("hari");
	let grup = $state("unit");
	let dari = $state("");
	let sampai = $state("");
	let pegawaiId = $state("");
	let perHalaman = $state<(typeof opsiPerHalaman)[number]>(10);
	let halaman = $state(1);

	const semua = $derived(data?.baris ?? []);
	const opsiPegawai = $derived<OpsiCari[]>(
		semua.map((b) => ({ id: b.id, label: b.namaLengkap, sub: b.nip, detail: b.jabatan })),
	);
	const baris = $derived(pegawaiId ? semua.filter((b) => b.id === pegawaiId) : semua);
	const totalHalaman = $derived(Math.max(1, Math.ceil(baris.length / perHalaman)));
	const tampil = $derived(baris.slice((halaman - 1) * perHalaman, halaman * perHalaman));
	const dariBaris = $derived(baris.length === 0 ? 0 : (halaman - 1) * perHalaman + 1);
	const sampaiBaris = $derived(Math.min(halaman * perHalaman, baris.length));

	async function muat() {
		halaman = 1;
		const q = new URLSearchParams({ periode, grup });
		if (periode === "rentang" && dari && sampai) {
			q.set("dari", dari);
			q.set("sampai", sampai);
		}
		data = await api(`/klasemen?${q}`);
		if (pegawaiId && !(data.baris ?? []).some((b) => b.id === pegawaiId)) pegawaiId = "";
	}

	function pilihPegawai(id: string) {
		pegawaiId = id;
		halaman = 1;
	}

	function keHalaman(n: number) {
		halaman = Math.min(totalHalaman, Math.max(1, n));
	}

	function setPerHalaman(n: number) {
		perHalaman = opsiPerHalaman.find((x) => x === n) ?? 10;
		halaman = 1;
	}

	onMount(() => {
		const dariUrl = page.url.searchParams.get("grup");
		if (dariUrl === "tim" || dariUrl === "unit") grup = dariUrl;
		void muat();
	});
</script>

<h1 class="text-xl font-semibold">Jam kerja efektif</h1>

<div class="mt-4 flex flex-wrap items-start gap-3 text-sm">
	<select class="min-h-11 rounded-md border border-border px-3 py-2" bind:value={periode} onchange={muat}>
		<option value="hari">Harian</option>
		<option value="bulan">Bulanan</option>
		<option value="rentang">Rentang tanggal</option>
	</select>
	<select class="min-h-11 rounded-md border border-border px-3 py-2" bind:value={grup} onchange={muat}>
		<option value="unit">Unit kerja</option>
		<option value="tim">Tim kerja</option>
	</select>
	{#if periode === "rentang"}
		<input class="rounded-md border border-border px-3 py-2" type="date" bind:value={dari} onchange={muat} />
		<input class="rounded-md border border-border px-3 py-2" type="date" bind:value={sampai} onchange={muat} />
	{/if}
	<div class="relative z-10 w-full min-w-0 sm:w-80">
		<SelectCari
			placeholder="Cari nama atau NIP…"
			pesanKosong="Tidak ada pegawai yang cocok."
			pesanKetik="Ketik nama atau NIP."
			satuan="pegawai"
			minimalCari={2}
			opsi={opsiPegawai}
			nilai={pegawaiId}
			onubah={pilihPegawai}
		/>
	</div>
</div>

{#if data}
	<section class="mt-6 grid grid-cols-3 border border-border-strong">
		<div class="border border-border p-3 sm:p-6">
			<p class="font-mono text-xl font-bold text-brand sm:text-3xl">{menitKeJam(data.stat.rataMenit)}</p>
			<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Rata-rata</p>
		</div>
		<div class="border border-border p-3 sm:p-6">
			<p class="font-mono text-xl font-bold text-accent sm:text-3xl">{data.stat.persenCapai}%</p>
			<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">≥ 6,5 jam</p>
		</div>
		<div class="border border-border p-3 sm:p-6">
			<p class="font-mono text-xl font-bold text-accent sm:text-3xl">{data.stat.persenTertaut}%</p>
			<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Link Peta Proses Bisnis</p>
		</div>
	</section>
	<p class="mt-2 text-xs text-muted">Hanya catatan yang sudah disetujui.</p>

	<p class="mt-6 text-xs text-muted">
		Diurutkan dari jam tercatat tertinggi. Angka resmi hanya dari catatan yang sudah disetujui.
	</p>
	<div class="tabel-geser mt-2">
	<table class="w-full min-w-[48rem] text-sm">
		<thead>
			<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
				<th class="border-b border-border-strong px-3 py-2">#</th>
				<th class="border-b border-border-strong px-3 py-2">Nama</th>
				<th class="border-b border-border-strong px-3 py-2">Jabatan</th>
				<th class="border-b border-border-strong px-3 py-2">Tim</th>
				<th class="border-b border-border-strong px-3 py-2">Jam efektif</th>
				<th class="border-b border-border-strong px-3 py-2">%</th>
				<th class="border-b border-border-strong px-3 py-2">Status</th>
			</tr>
		</thead>
		<tbody>
			{#each tampil as b, i}
				<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
					<td class="border-b border-border px-3 py-3 font-mono">{b.peringkat}</td>
					<td class="border-b border-border px-3 py-3">
						<div>{b.namaLengkap}</div>
						<div class="font-mono text-xs text-muted">NIP {b.nip}</div>
					</td>
					<td class="border-b border-border px-3 py-3">{b.jabatan}</td>
					<td class="border-b border-border px-3 py-3">{b.tim}</td>
					<td class="border-b border-border px-3 py-3 font-mono">
						<div>{menitKeJam(b.menitTercatat)}</div>
						{#if b.menitTercatat !== b.menit}
							<div class="text-xs text-muted">Resmi {menitKeJam(b.menit)}</div>
						{/if}
					</td>
					<td class="border-b border-border px-3 py-3 font-mono">{b.persenTercatat}</td>
					<td class="border-b border-border px-3 py-3">{labelStatus(b.statusTercatat)}</td>
				</tr>
			{:else}
				<tr>
					<td class="px-3 py-6 text-sm text-muted" colspan="7">
						{#if pegawaiId}
							Pegawai ini tidak ada di filter periode atau kelompok ini.
						{:else}
							Belum ada data jam efektif untuk periode ini.
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	</div>

	<div class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
		<div class="flex flex-wrap items-baseline gap-x-6 gap-y-2">
			<p class="text-sm tabular-nums">{dariBaris}–{sampaiBaris} dari {baris.length}</p>
			<div class="flex items-baseline gap-3 text-sm">
				<span class="text-muted">Per halaman</span>
				{#each opsiPerHalaman as n}
					<button
						class="tabular-nums"
						class:font-medium={n === perHalaman}
						class:text-accent={n === perHalaman}
						class:text-muted={n !== perHalaman}
						type="button"
						onclick={() => setPerHalaman(n)}>{n}</button
					>
				{/each}
			</div>
		</div>
		{#if totalHalaman > 1}
			<nav class="flex items-center gap-4 text-sm">
				<button
					class="text-accent disabled:text-muted"
					type="button"
					disabled={halaman === 1}
					onclick={() => keHalaman(halaman - 1)}>Sebelumnya</button
				>
				<p class="tabular-nums text-muted">{halaman} / {totalHalaman}</p>
				<button
					class="text-accent disabled:text-muted"
					type="button"
					disabled={halaman === totalHalaman}
					onclick={() => keHalaman(halaman + 1)}>Berikutnya</button
				>
			</nav>
		{/if}
	</div>
{/if}
