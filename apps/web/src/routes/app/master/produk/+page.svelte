<script lang="ts">
	import { onMount } from "svelte";
	import { ApiError, api } from "$lib/api";
	import IkonAksi from "$lib/IkonAksi.svelte";
	import PanelFokus from "$lib/PanelFokus.svelte";

	type Produk = {
		id: string;
		kode: string;
		nama: string;
		kodeProsesL1: string | null;
		status: string;
	};
	type Tahapan = { id: string; produkId: string };
	type Panel =
		| { mode: "baru" }
		| { mode: "ubah"; id: string }
		| { mode: "hapus"; id: string; nama: string };

	const opsiPerHalaman = [5, 10, 15, 20] as const;

	let produk = $state<Produk[]>([]);
	let tahapan = $state<Tahapan[]>([]);
	let kata = $state("");
	let perHalaman = $state<(typeof opsiPerHalaman)[number]>(10);
	let halaman = $state(1);
	let pesan = $state("");
	let panel = $state<Panel | null>(null);
	let formKode = $state("");
	let formNama = $state("");
	let formProses = $state("");
	let formStatus = $state<"aktif" | "nonaktif">("aktif");
	let errorPanel = $state("");
	let simpanPanel = $state(false);

	const kataCari = $derived(kata.trim().toLowerCase());
	const tersaring = $derived.by(() => {
		if (!kataCari) return produk;
		return produk.filter((p) => {
			const nama = p.nama.toLowerCase();
			const kode = p.kode.toLowerCase();
			const proses = (p.kodeProsesL1 ?? "").toLowerCase();
			return nama.includes(kataCari) || kode.includes(kataCari) || proses.includes(kataCari);
		});
	});
	const totalHalaman = $derived(Math.max(1, Math.ceil(tersaring.length / perHalaman)));
	const tampil = $derived(tersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman));
	const dari = $derived(tersaring.length === 0 ? 0 : (halaman - 1) * perHalaman + 1);
	const sampai = $derived(Math.min(halaman * perHalaman, tersaring.length));

	function jumlahTahapan(id: string) {
		return tahapan.filter((t) => t.produkId === id).length;
	}

	async function muat() {
		const data = await api<{ produk: Produk[]; tahapan: Tahapan[] }>("/master/katalog");
		produk = data.produk;
		tahapan = data.tahapan;
	}
	onMount(muat);

	function kosongkanForm() {
		formKode = "";
		formNama = "";
		formProses = "";
		formStatus = "aktif";
		errorPanel = "";
	}

	function bukaBaru() {
		kosongkanForm();
		panel = { mode: "baru" };
	}

	function bukaUbah(p: Produk) {
		formKode = p.kode;
		formNama = p.nama;
		formProses = p.kodeProsesL1 ?? "";
		formStatus = p.status === "nonaktif" ? "nonaktif" : "aktif";
		errorPanel = "";
		panel = { mode: "ubah", id: p.id };
	}

	function bukaHapus(p: Produk) {
		errorPanel = "";
		panel = { mode: "hapus", id: p.id, nama: p.nama };
	}

	function tutupPanel() {
		panel = null;
		kosongkanForm();
	}

	function keHalaman(n: number) {
		halaman = Math.min(totalHalaman, Math.max(1, n));
	}

	function setPerHalaman(n: number) {
		perHalaman = opsiPerHalaman.find((x) => x === n) ?? 10;
		halaman = 1;
	}

	function rapikanNama(teks: string) {
		return teks.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
	}

	function kirimDariPapan(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			(e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	}

	function judulPanel(p: Panel) {
		switch (p.mode) {
			case "baru":
				return "Produk/proses bisnis baru";
			case "ubah":
				return "Ubah produk/proses bisnis";
			case "hapus":
				return "Hapus produk/proses bisnis";
			default: {
				const tidakAda: never = p;
				return tidakAda;
			}
		}
	}

	async function kirimPanel(e: Event) {
		e.preventDefault();
		if (!panel || panel.mode === "hapus") return;
		errorPanel = "";
		pesan = "";
		if (!formKode.trim()) {
			errorPanel = "Kode wajib diisi.";
			return;
		}
		const nama = rapikanNama(formNama);
		if (nama.length < 2) {
			errorPanel = "Nama minimal 2 karakter.";
			return;
		}
		simpanPanel = true;
		const isi = {
			kode: formKode.trim(),
			nama,
			kodeProsesL1: formProses.trim() || undefined,
			status: formStatus,
		};
		try {
			if (panel.mode === "baru") {
				await api("/master/produk", { method: "POST", body: JSON.stringify(isi) });
				pesan = `“${nama}” ditambahkan. Lanjut isi tahapan.`;
				tutupPanel();
				halaman = 1;
				await muat();
			} else if (panel.mode === "ubah") {
				await api(`/master/produk/${panel.id}`, {
					method: "PUT",
					body: JSON.stringify(isi),
				});
				pesan = `“${nama}” disimpan.`;
				tutupPanel();
				await muat();
			} else {
				const tidakAda: never = panel;
				void tidakAda;
			}
		} catch (err) {
			errorPanel = err instanceof ApiError ? err.message : "Tidak dapat menyimpan. Periksa isian, lalu coba lagi.";
		} finally {
			simpanPanel = false;
		}
	}

	async function hapusPanel() {
		if (panel?.mode !== "hapus") return;
		errorPanel = "";
		pesan = "";
		simpanPanel = true;
		const nama = panel.nama;
		try {
			await api(`/master/produk/${panel.id}`, { method: "DELETE" });
			if (tampil.length === 1 && halaman > 1) halaman -= 1;
			tutupPanel();
			pesan = `${nama} dihapus.`;
			await muat();
		} catch (err) {
			errorPanel = err instanceof Error ? err.message : "Tidak dapat menghapus.";
		} finally {
			simpanPanel = false;
		}
	}
</script>

<div class="flex flex-wrap items-baseline justify-between gap-4">
	<div>
		<h2 class="text-lg font-semibold">Produk/Proses bisnis</h2>
		<p class="mt-1 text-sm text-muted">
			Yang dipilih pegawai di catatan harian. Merujuk peta proses bisnis KMK.
		</p>
	</div>
	<IkonAksi jenis="tambah" label="Produk/proses bisnis baru" onklik={bukaBaru} />
</div>

<div class="mt-6 max-w-md">
	<label class="text-sm font-medium" for="prd-cari">Cari</label>
	<input
		id="prd-cari"
		class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
		placeholder="Nama, kode, atau kode proses"
		bind:value={kata}
		oninput={() => (halaman = 1)}
	/>
</div>

{#if pesan}<p class="mt-4 text-sm text-success">{pesan}</p>{/if}

<table class="mt-6 w-full text-sm">
	<thead>
		<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
			<th class="border-b border-border-strong px-3 py-2">Kode</th>
			<th class="border-b border-border-strong px-3 py-2">Nama</th>
			<th class="border-b border-border-strong px-3 py-2">Tahapan</th>
			<th class="border-b border-border-strong px-3 py-2">Status</th>
			<th class="border-b border-border-strong px-3 py-2"></th>
		</tr>
	</thead>
	<tbody>
		{#each tampil as p, i}
			<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
				<td class="border-b border-border px-3 py-3">
					<p class="font-mono text-xs">{p.kode}</p>
					{#if p.kodeProsesL1}
						<p class="font-mono text-xs text-muted">{p.kodeProsesL1}</p>
					{/if}
				</td>
				<td class="border-b border-border px-3 py-3">{p.nama}</td>
				<td class="border-b border-border px-3 py-3 tabular-nums text-muted">
					{jumlahTahapan(p.id) === 0 ? "Belum ada" : `${jumlahTahapan(p.id)} tahapan`}
				</td>
				<td class="border-b border-border px-3 py-3">{p.status === "nonaktif" ? "Nonaktif" : "Aktif"}</td>
				<td class="border-b border-border px-3 py-3">
					<div class="flex items-center gap-3">
						<IkonAksi jenis="ubah" label="Ubah" hanyaIkon onklik={() => bukaUbah(p)} />
						<IkonAksi jenis="hapus" label="Hapus" bahaya hanyaIkon onklik={() => bukaHapus(p)} />
					</div>
				</td>
			</tr>
		{:else}
			<tr>
				<td class="px-3 py-6 text-sm text-muted" colspan="5">
					{#if kataCari}
						Tidak ada yang cocok dengan “{kata.trim()}”.
					{:else}
						Belum ada produk/proses bisnis.
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<div class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
	<div class="flex flex-wrap items-baseline gap-x-6 gap-y-2">
		<p class="text-sm tabular-nums">{dari}–{sampai} dari {tersaring.length}</p>
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

{#if panel}
	<PanelFokus judul={judulPanel(panel)} ontutup={tutupPanel}>
		{#if panel.mode === "hapus"}
			<p class="text-sm">Hapus {panel.nama}?</p>
			<p class="mt-3 text-sm text-muted">
				Hanya yang tanpa tahapan dan catatan harian yang dapat dihapus. Yang masih terpakai dinonaktifkan lewat Ubah.
			</p>
			{#if errorPanel}<p class="mt-3 text-sm text-error">{errorPanel}</p>{/if}
			<div class="mt-4 flex flex-wrap items-center gap-4">
				<button
					class="rounded-md bg-error px-4 py-2 text-sm font-medium text-white"
					type="button"
					disabled={simpanPanel}
					onclick={hapusPanel}>Ya, hapus</button
				>
				<button class="text-sm text-accent" type="button" onclick={tutupPanel}>Batal</button>
			</div>
		{:else}
			<form class="space-y-4" onsubmit={kirimPanel}>
				<div>
					<label class="text-sm font-medium" for="prd-kode">Kode</label>
					<input
						id="prd-kode"
						class="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
						placeholder="PRD-KINERJA"
						bind:value={formKode}
					/>
				</div>
				<div>
					<label class="text-sm font-medium" for="prd-nama">Nama</label>
					<textarea
						id="prd-nama"
						class="mt-1 min-h-20 w-full resize-y rounded-md border border-border px-3 py-2 text-sm"
						rows="3"
						placeholder="Pengelolaan Kinerja Pegawai ASN"
						bind:value={formNama}
						onkeydown={kirimDariPapan}
					></textarea>
					<p class="mt-1 text-xs text-muted">
						Nama resmi sesuai peta proses. Enter untuk baris baru. Ctrl+Enter untuk simpan.
					</p>
				</div>
				<div>
					<label class="text-sm font-medium" for="prd-proses">Kode proses L1</label>
					<input
						id="prd-proses"
						class="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
						placeholder="1.6"
						bind:value={formProses}
					/>
					<p class="mt-1 text-xs text-muted">Opsional. Kode di peta proses bisnis KMK.</p>
				</div>
				{#if panel.mode === "ubah"}
					<div class="flex items-baseline gap-4 text-sm">
						<span class="text-muted">Status</span>
						<button
							class:font-medium={formStatus === "aktif"}
							class:text-accent={formStatus === "aktif"}
							class:text-muted={formStatus !== "aktif"}
							type="button"
							onclick={() => (formStatus = "aktif")}>Aktif</button
						>
						<button
							class:font-medium={formStatus === "nonaktif"}
							class:text-accent={formStatus === "nonaktif"}
							class:text-muted={formStatus !== "nonaktif"}
							type="button"
							onclick={() => (formStatus = "nonaktif")}>Nonaktif</button
						>
					</div>
				{/if}
				{#if errorPanel}<p class="text-sm text-error">{errorPanel}</p>{/if}
				<div class="flex flex-wrap items-center gap-4">
					<button class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" type="submit" disabled={simpanPanel}>
						Simpan
					</button>
					<button class="text-sm text-accent" type="button" onclick={tutupPanel}>Batal</button>
				</div>
			</form>
		{/if}
	</PanelFokus>
{/if}
