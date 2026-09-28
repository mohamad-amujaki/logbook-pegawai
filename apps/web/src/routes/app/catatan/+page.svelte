<script lang="ts">
	import { onMount } from "svelte";
	import { api, ApiError } from "$lib/api";
	import { labelJenis, labelStatus } from "$lib/format";
	import PanelFokus from "$lib/PanelFokus.svelte";
	import SelectCari, { type OpsiCari } from "$lib/SelectCari.svelte";

	type Periode = "hari" | "bulan" | "rentang" | "semua";
	type Row = {
		catatan: {
			id: string;
			tanggal: string;
			jenisTugas: string;
			uraian: string;
			menitEfektif: number;
			status: string;
			isiManual: boolean;
			produkId: string | null;
			catatanValidasi: string | null;
		};
		produkNama: string | null;
		tahapanNama: string | null;
	};

	const ID_MANUAL = "__manual__";
	const opsiPerHalaman = [5, 10, 15, 20] as const;

	let rows = $state<Row[]>([]);
	let periode = $state<Periode>("bulan");
	let dari = $state("");
	let sampai = $state("");
	let jenis = $state("");
	let status = $state("");
	let produkId = $state("");
	let perHalaman = $state<(typeof opsiPerHalaman)[number]>(10);
	let halaman = $state(1);
	let terpilih = $state<string[]>([]);
	let konfirmMassal = $state(false);
	let alasanId = $state("");
	let sibuk = $state(false);
	let pesan = $state("");

	function bolehKirim(status: string) {
		return status === "DRAFT" || status === "DITOLAK";
	}

	const opsiProduk = $derived.by(() => {
		const map = new Map<string, OpsiCari>();
		let adaManual = false;
		for (const r of rows) {
			if (r.catatan.isiManual) {
				adaManual = true;
				continue;
			}
			const id = r.catatan.produkId;
			if (!id || map.has(id)) continue;
			map.set(id, { id, label: r.produkNama ?? id });
		}
		const list = [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "id"));
		if (adaManual) list.push({ id: ID_MANUAL, label: "Isi manual" });
		return list;
	});

	const baris = $derived.by(() => {
		const batas = rentangPeriode(periode, dari, sampai);
		return rows.filter((r) => {
			if (batas && (r.catatan.tanggal < batas.dari || r.catatan.tanggal > batas.sampai)) return false;
			if (jenis && r.catatan.jenisTugas !== jenis) return false;
			if (status && r.catatan.status !== status) return false;
			if (produkId === ID_MANUAL) return r.catatan.isiManual;
			if (produkId && r.catatan.produkId !== produkId) return false;
			return true;
		});
	});

	const totalHalaman = $derived(Math.max(1, Math.ceil(baris.length / perHalaman)));
	const tampil = $derived(baris.slice((halaman - 1) * perHalaman, halaman * perHalaman));
	const dariBaris = $derived(baris.length === 0 ? 0 : (halaman - 1) * perHalaman + 1);
	const sampaiBaris = $derived(Math.min(halaman * perHalaman, baris.length));
	const adaFilter = $derived(
		periode !== "bulan" || Boolean(jenis) || Boolean(status) || Boolean(produkId) || Boolean(dari) || Boolean(sampai),
	);
	const kosongKarenaFilter = $derived(Boolean(jenis) || Boolean(status) || Boolean(produkId) || periode === "rentang");
	const bisaKirim = $derived(tampil.filter((r) => bolehKirim(r.catatan.status)));
	const semuaHalamanTerpilih = $derived(
		bisaKirim.length > 0 && bisaKirim.every((r) => terpilih.includes(r.catatan.id)),
	);
	const sebagianHalamanTerpilih = $derived(
		bisaKirim.some((r) => terpilih.includes(r.catatan.id)) && !semuaHalamanTerpilih,
	);
	const catatanAlasan = $derived(rows.find((r) => r.catatan.id === alasanId) ?? null);

	$effect(() => {
		if (halaman > totalHalaman) halaman = totalHalaman;
	});

	function tanggalIso(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const hari = String(d.getDate()).padStart(2, "0");
		return `${y}-${m}-${hari}`;
	}

	function rentangPeriode(p: Periode, awal: string, akhir: string): { dari: string; sampai: string } | null {
		if (p === "semua") return null;
		const now = new Date();
		if (p === "hari") {
			const t = tanggalIso(now);
			return { dari: t, sampai: t };
		}
		if (p === "bulan") {
			const awalBulan = new Date(now.getFullYear(), now.getMonth(), 1);
			const akhirBulan = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			return { dari: tanggalIso(awalBulan), sampai: tanggalIso(akhirBulan) };
		}
		if (p === "rentang") {
			if (!awal || !akhir) return null;
			return { dari: awal, sampai: akhir };
		}
		const _habis: never = p;
		return _habis;
	}

	function resetPilih() {
		terpilih = [];
		konfirmMassal = false;
	}

	function resetHalaman() {
		halaman = 1;
	}

	function gantiPeriode(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		switch (v) {
			case "hari":
			case "bulan":
			case "rentang":
			case "semua":
				periode = v;
				break;
			default:
				return;
		}
		if (periode !== "rentang") {
			dari = "";
			sampai = "";
		}
		resetPilih();
		resetHalaman();
	}

	function gantiJenis(e: Event) {
		jenis = (e.currentTarget as HTMLSelectElement).value;
		resetPilih();
		resetHalaman();
	}

	function gantiStatus(e: Event) {
		status = (e.currentTarget as HTMLSelectElement).value;
		resetPilih();
		resetHalaman();
	}

	function pilihProduk(id: string) {
		produkId = id;
		resetPilih();
		resetHalaman();
	}

	function keHalaman(n: number) {
		halaman = Math.min(totalHalaman, Math.max(1, n));
	}

	function setPerHalaman(n: number) {
		perHalaman = opsiPerHalaman.find((x) => x === n) ?? 10;
		resetHalaman();
	}

	function hapusFilter() {
		periode = "bulan";
		dari = "";
		sampai = "";
		jenis = "";
		status = "";
		produkId = "";
		resetPilih();
		resetHalaman();
	}

	function toggleSatu(id: string, on: boolean) {
		konfirmMassal = false;
		terpilih = on ? [...new Set([...terpilih, id])] : terpilih.filter((x) => x !== id);
	}

	function toggleHalaman(on: boolean) {
		konfirmMassal = false;
		const ids = bisaKirim.map((r) => r.catatan.id);
		if (on) terpilih = [...new Set([...terpilih, ...ids])];
		else terpilih = terpilih.filter((id) => !ids.includes(id));
	}

	async function muat() {
		rows = await api("/catatan");
		if (produkId && !opsiProduk.some((o) => o.id === produkId)) produkId = "";
		terpilih = terpilih.filter((id) =>
			rows.some((r) => r.catatan.id === id && bolehKirim(r.catatan.status)),
		);
		if (terpilih.length === 0) konfirmMassal = false;
	}

	async function submit(id: string) {
		pesan = "";
		sibuk = true;
		try {
			await api(`/catatan/${id}/submit`, { method: "POST" });
			terpilih = terpilih.filter((x) => x !== id);
			await muat();
		} catch (err) {
			pesan = err instanceof ApiError ? err.message : "Tidak dapat mengirim catatan.";
		} finally {
			sibuk = false;
		}
	}

	async function kirimMassal() {
		pesan = "";
		if (terpilih.length === 0) return;
		sibuk = true;
		try {
			await api("/catatan/massal", {
				method: "POST",
				body: JSON.stringify({ catatanIds: terpilih }),
			});
			konfirmMassal = false;
			terpilih = [];
			await muat();
		} catch (err) {
			pesan = err instanceof ApiError ? err.message : "Tidak dapat mengirim catatan terpilih.";
		} finally {
			sibuk = false;
		}
	}

	onMount(() => {
		void muat();
	});
</script>

<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-xl font-semibold">Catatan harian</h1>
	<a
		class="inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white active:scale-[0.97]"
		href="/app/catatan/baru">Catatan baru</a
	>
</div>

<div class="flex flex-wrap items-start gap-3 text-sm">
	<select class="min-h-11 rounded-md border border-border px-3 py-2" bind:value={periode} onchange={gantiPeriode}>
		<option value="hari">Harian</option>
		<option value="bulan">Bulanan</option>
		<option value="rentang">Rentang tanggal</option>
		<option value="semua">Semua</option>
	</select>
	{#if periode === "rentang"}
		<input class="min-h-11 rounded-md border border-border px-3 py-2" type="date" bind:value={dari} onchange={resetHalaman} />
		<input
			class="min-h-11 rounded-md border border-border px-3 py-2"
			type="date"
			bind:value={sampai}
			onchange={resetHalaman}
		/>
	{/if}
	<select class="min-h-11 rounded-md border border-border px-3 py-2" bind:value={jenis} onchange={gantiJenis}>
		<option value="">Semua jenis</option>
		<option value="TUSI">Tusi</option>
		<option value="TUSI_LAINNYA">Tusi lainnya</option>
		<option value="NON_TUSI">Non Tusi</option>
	</select>
	<select class="min-h-11 rounded-md border border-border px-3 py-2" bind:value={status} onchange={gantiStatus}>
		<option value="">Semua status</option>
		<option value="DRAFT">Draf</option>
		<option value="SUBMIT">Menunggu</option>
		<option value="TERVERIFIKASI">Terverifikasi</option>
		<option value="DITOLAK">Ditolak</option>
	</select>
	<div class="relative z-10 w-full min-w-0 sm:w-80">
		<SelectCari
			placeholder="Cari produk…"
			pesanKosong="Tidak ada produk yang cocok."
			satuan="produk"
			opsi={opsiProduk}
			nilai={produkId}
			onubah={pilihProduk}
		/>
	</div>
</div>

<p class="mt-4 text-xs text-muted">
	Milik Anda. Urut dari yang terbaru.
	{#if adaFilter}
		<button class="ml-3 text-accent" type="button" onclick={hapusFilter}>Hapus filter</button>
	{/if}
</p>

{#if pesan}
	<p class="mt-4 text-sm text-error" role="alert">{pesan}</p>
{/if}

{#if terpilih.length > 0}
	<div class="mt-4 flex flex-wrap items-center justify-between gap-3 border border-border px-3 py-3 text-sm">
		{#if konfirmMassal}
			<p>Kirim {terpilih.length} catatan untuk divalidasi?</p>
			<div class="flex items-center gap-4">
				<button class="text-muted" type="button" disabled={sibuk} onclick={() => (konfirmMassal = false)}
					>Batal</button
				>
				<button
					class="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-60"
					type="button"
					disabled={sibuk}
					onclick={kirimMassal}>{sibuk ? "Mengirim…" : "Kirim"}</button
				>
			</div>
		{:else}
			<p>{terpilih.length} catatan dipilih</p>
			<div class="flex items-center gap-4">
				<button
					class="text-muted"
					type="button"
					onclick={() => {
						terpilih = [];
						konfirmMassal = false;
					}}>Batal pilih</button
				>
				<button class="text-accent" type="button" onclick={() => (konfirmMassal = true)}>Kirim yang dipilih</button>
			</div>
		{/if}
	</div>
{/if}

<div class="tabel-geser mt-2">
	<table class="w-full min-w-[48rem] text-sm">
		<thead>
			<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
				<th class="w-10 border-b border-border-strong px-3 py-2">
					<input
						type="checkbox"
						checked={semuaHalamanTerpilih}
						{@attach (el: HTMLInputElement) => {
							el.indeterminate = sebagianHalamanTerpilih;
						}}
						disabled={bisaKirim.length === 0 || sibuk}
						aria-label="Pilih semua di halaman ini"
						onchange={(e) => toggleHalaman(e.currentTarget.checked)}
					/>
				</th>
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
			{#each tampil as r, i (r.catatan.id)}
				<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
					<td class="border-b border-border px-3 py-3">
						<input
							type="checkbox"
							checked={terpilih.includes(r.catatan.id)}
							disabled={!bolehKirim(r.catatan.status) || sibuk}
							aria-label="Pilih catatan {r.catatan.tanggal}"
							onchange={(e) => toggleSatu(r.catatan.id, e.currentTarget.checked)}
						/>
					</td>
					<td class="border-b border-border px-3 py-3 font-mono">{r.catatan.tanggal}</td>
					<td class="border-b border-border px-3 py-3">{labelJenis(r.catatan.jenisTugas)}</td>
					<td class="border-b border-border px-3 py-3">
						{r.catatan.isiManual ? "Isi manual" : `${r.produkNama ?? "—"} / ${r.tahapanNama ?? "—"}`}
					</td>
					<td class="border-b border-border px-3 py-3">{r.catatan.uraian}</td>
					<td class="border-b border-border px-3 py-3 font-mono">{r.catatan.menitEfektif}</td>
					<td class="border-b border-border px-3 py-3">
						{#if r.catatan.status === "DITOLAK"}
							<button class="text-accent" type="button" onclick={() => (alasanId = r.catatan.id)}>Ditolak</button>
						{:else}
							{labelStatus(r.catatan.status)}
						{/if}
					</td>
					<td class="border-b border-border px-3 py-3">
						<div class="flex flex-wrap gap-3">
							{#if bolehKirim(r.catatan.status)}
								<a class="text-accent" href="/app/catatan/{r.catatan.id}">Ubah</a>
								<button class="text-accent" type="button" disabled={sibuk} onclick={() => submit(r.catatan.id)}
									>Kirim</button
								>
							{/if}
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td class="px-3 py-6 text-sm text-muted" colspan="8">
						{#if kosongKarenaFilter}
							Tidak ada catatan yang cocok. Ubah filter.
						{:else}
							Belum ada catatan pada periode ini.
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

{#if catatanAlasan}
	<PanelFokus judul="Alasan penolakan" ontutup={() => (alasanId = "")}>
		<div class="space-y-4">
			<div>
				<p class="font-mono text-xs text-muted">{catatanAlasan.catatan.tanggal}</p>
				<p class="mt-2 text-sm">{catatanAlasan.catatan.uraian}</p>
			</div>
			<div>
				<p class="text-xs font-medium uppercase tracking-wide text-muted">Alasan atasan</p>
				<p class="mt-1 whitespace-pre-wrap text-sm">
					{catatanAlasan.catatan.catatanValidasi?.trim() || "Tidak ada uraian alasan."}
				</p>
			</div>
			<p class="text-sm text-muted">Perbaiki catatan, simpan, lalu kirim lagi untuk divalidasi.</p>
			<a class="inline-flex text-sm text-accent" href="/app/catatan/{catatanAlasan.catatan.id}">Ubah catatan</a>
		</div>
	</PanelFokus>
{/if}
