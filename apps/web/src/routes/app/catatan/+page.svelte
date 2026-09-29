<script lang="ts">
	import { onMount } from "svelte";
	import { api, ApiError } from "$lib/api";
	import { jamRentang, labelJenis, labelStatus, menitKeJam } from "$lib/format";
	import NavigasiCatatan from "$lib/NavigasiCatatan.svelte";
	import PanelFokus from "$lib/PanelFokus.svelte";
	import PageHeader from "$lib/PageHeader.svelte";
	import SelectionBar from "$lib/SelectionBar.svelte";
	import SelectCari, { type OpsiCari } from "$lib/SelectCari.svelte";

	type Periode = "hari" | "bulan" | "rentang" | "semua";
	type Row = {
		catatan: {
			id: string;
			tanggal: string;
			waktuMulai: string;
			waktuSelesai: string;
			jenisTugas: string;
			uraian: string;
			menitEfektif: number;
			status: string;
			isiManual: boolean;
			divalidasiOtomatis: boolean;
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
	let pencarian = $state("");
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

	function durasiKalender(mulai: string, selesai: string): number {
		const durasi = (new Date(selesai).getTime() - new Date(mulai).getTime()) / 60000;
		return Number.isFinite(durasi) && durasi > 0 ? Math.round(durasi) : 0;
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
		const cari = pencarian.trim().toLocaleLowerCase("id");
		return rows.filter((r) => {
			if (batas && (r.catatan.tanggal < batas.dari || r.catatan.tanggal > batas.sampai)) return false;
			if (jenis && r.catatan.jenisTugas !== jenis) return false;
			if (status && r.catatan.status !== status) return false;
			if (produkId === ID_MANUAL) {
				if (!r.catatan.isiManual) return false;
			} else if (produkId && r.catatan.produkId !== produkId) return false;
			if (
				cari &&
				!r.catatan.uraian.toLocaleLowerCase("id").includes(cari) &&
				!(r.produkNama ?? "").toLocaleLowerCase("id").includes(cari) &&
				!(r.tahapanNama ?? "").toLocaleLowerCase("id").includes(cari)
			)
				return false;
			return true;
		});
	});

	const totalHalaman = $derived(Math.max(1, Math.ceil(baris.length / perHalaman)));
	const tampil = $derived(baris.slice((halaman - 1) * perHalaman, halaman * perHalaman));
	const dariBaris = $derived(baris.length === 0 ? 0 : (halaman - 1) * perHalaman + 1);
	const sampaiBaris = $derived(Math.min(halaman * perHalaman, baris.length));
	const adaFilter = $derived(
		periode !== "bulan" ||
			Boolean(jenis) ||
			Boolean(status) ||
			Boolean(produkId) ||
			Boolean(pencarian) ||
			Boolean(dari) ||
			Boolean(sampai),
	);
	const kosongKarenaFilter = $derived(
		Boolean(jenis) || Boolean(status) || Boolean(produkId) || Boolean(pencarian) || periode === "rentang",
	);
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
		pencarian = "";
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
		pesan = "";
		try {
			rows = await api("/catatan");
		} catch (err) {
			rows = [];
			pesan =
				err instanceof ApiError ? err.message : "Tidak dapat memuat catatan. Muat ulang halaman.";
			return;
		}
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

<PageHeader
	judul="Catatan harian"
	deskripsi="Catat pekerjaan dan hasilnya, lalu kirim untuk divalidasi agar masuk ke waktu terverifikasi."
>
	{#snippet anak()}
		<a
			class="inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white active:scale-[0.97]"
			href="/app/catatan/baru">Catatan baru</a
		>
	{/snippet}
</PageHeader>

<div class="mt-2">
	<NavigasiCatatan />
</div>

<div class="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
	<label>
		<span class="mb-1 block font-medium">Periode</span>
		<select class="min-h-11 w-full rounded-md border border-border px-3 py-2" bind:value={periode} onchange={gantiPeriode}>
			<option value="hari">Harian</option>
			<option value="bulan">Bulanan</option>
			<option value="rentang">Rentang tanggal</option>
			<option value="semua">Semua</option>
		</select>
	</label>
	{#if periode === "rentang"}
		<label><span class="mb-1 block font-medium">Dari tanggal</span><input class="min-h-11 w-full rounded-md border border-border px-3 py-2" type="date" bind:value={dari} onchange={resetHalaman} /></label>
		<label><span class="mb-1 block font-medium">Sampai tanggal</span><input class="min-h-11 w-full rounded-md border border-border px-3 py-2" type="date" bind:value={sampai} onchange={resetHalaman} /></label>
	{/if}
	<label>
		<span class="mb-1 block font-medium">Jenis tugas</span>
		<select class="min-h-11 w-full rounded-md border border-border px-3 py-2" bind:value={jenis} onchange={gantiJenis}>
			<option value="">Semua jenis</option><option value="TUSI">Tusi</option><option value="TUSI_LAINNYA">Tusi lainnya</option><option value="NON_TUSI">Non Tusi</option>
		</select>
	</label>
	<label>
		<span class="mb-1 block font-medium">Status catatan</span>
		<select class="min-h-11 w-full rounded-md border border-border px-3 py-2" bind:value={status} onchange={gantiStatus}>
			<option value="">Semua status</option><option value="DRAFT">Draf</option><option value="SUBMIT">Menunggu</option><option value="TERVERIFIKASI">Terverifikasi</option><option value="DITOLAK">Ditolak</option>
		</select>
	</label>
	<div class="relative z-10 min-w-0">
		<SelectCari
			label="Produk"
			placeholder="Cari produk…"
			pesanKosong="Tidak ada produk yang cocok."
			satuan="produk"
			opsi={opsiProduk}
			nilai={produkId}
			onubah={pilihProduk}
		/>
	</div>
	<label class="lg:col-span-2">
		<span class="mb-1 block font-medium">Cari uraian atau produk</span>
		<input class="min-h-11 w-full rounded-md border border-border px-3 py-2" placeholder="Ketik kata kunci…" bind:value={pencarian} oninput={resetHalaman} />
	</label>
</div>

<p class="mt-4 text-sm">
	<strong>{baris.length} catatan ditemukan.</strong>
	<span class="text-muted"> Milik Anda, urut dari yang terbaru.</span>
	{#if adaFilter}
		<button class="ml-3 text-accent" type="button" onclick={hapusFilter}>Hapus filter</button>
	{/if}
</p>

{#if pesan}
	<p class="mt-4 text-sm text-error" role="alert">{pesan}</p>
{/if}

<SelectionBar jumlah={terpilih.length}>
	{#snippet anak()}
		{#if konfirmMassal}
			<p class="text-sm">Kirim {terpilih.length} catatan untuk divalidasi?</p>
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
	{/snippet}
</SelectionBar>

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
				<th class="border-b border-border-strong px-3 py-2">Tanggal dan waktu</th>
				<th class="border-b border-border-strong px-3 py-2">Jenis</th>
				<th class="border-b border-border-strong px-3 py-2">Produk / tahapan</th>
				<th class="border-b border-border-strong px-3 py-2">Uraian</th>
				<th class="border-b border-border-strong px-3 py-2">Waktu efektif</th>
				<th class="border-b border-border-strong px-3 py-2">Status</th>
				<th class="border-b border-border-strong px-3 py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each tampil as r, i (r.catatan.id)}
				{@const durasi = durasiKalender(r.catatan.waktuMulai, r.catatan.waktuSelesai)}
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
					<td class="border-b border-border px-3 py-3 font-mono">
						<div>{r.catatan.tanggal}</div>
						<div class="mt-1 whitespace-nowrap text-xs text-muted">
							{jamRentang(r.catatan.waktuMulai, r.catatan.waktuSelesai)}
						</div>
					</td>
					<td class="border-b border-border px-3 py-3">{labelJenis(r.catatan.jenisTugas)}</td>
					<td class="border-b border-border px-3 py-3">
						{#if r.catatan.isiManual}
							Isi manual
						{:else if r.produkNama || r.tahapanNama}
							{r.produkNama ?? "—"} / {r.tahapanNama ?? "—"}
						{:else}
							—
						{/if}
					</td>
					<td class="border-b border-border px-3 py-3">{r.catatan.uraian}</td>
					<td class="border-b border-border px-3 py-3 font-mono">
						<div>{menitKeJam(r.catatan.menitEfektif)}</div>
						{#if durasi > 0 && durasi !== r.catatan.menitEfektif}
							<div class="mt-1 text-xs text-muted">Durasi {menitKeJam(durasi)}</div>
						{/if}
					</td>
					<td class="border-b border-border px-3 py-3">
						{#if r.catatan.status === "DITOLAK"}
							<button class="text-accent" type="button" onclick={() => (alasanId = r.catatan.id)}>Ditolak</button>
						{:else}
							{labelStatus(r.catatan.status, r.catatan.divalidasiOtomatis)}
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
							Tidak ada catatan yang cocok. Hapus atau ubah filter untuk memperluas hasil.
						{:else}
							Belum ada catatan pada periode ini.
							<a class="ml-1 text-accent" href="/app/catatan/baru">Buat catatan baru</a>
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
