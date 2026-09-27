<script lang="ts">
	import { onMount } from "svelte";
	import { ApiError, api } from "$lib/api";
	import IkonAksi from "$lib/IkonAksi.svelte";
	import PanelFokus from "$lib/PanelFokus.svelte";
	import SelectCari from "$lib/SelectCari.svelte";

	type Produk = { id: string; kode: string; nama: string };
	type Tahapan = { id: string; kode: string; nama: string; produkId: string; urutan: number };
	type Aktivitas = { id: string; tahapanId: string };
	type Panel =
		| { mode: "baru" }
		| { mode: "ubah"; id: string }
		| { mode: "hapus"; id: string; nama: string };

	const opsiPerHalaman = [5, 10, 15, 20] as const;

	let produk = $state<Produk[]>([]);
	let tahapan = $state<Tahapan[]>([]);
	let aktivitas = $state<Aktivitas[]>([]);
	let kata = $state("");
	let saringProduk = $state("");
	let perHalaman = $state<(typeof opsiPerHalaman)[number]>(10);
	let halaman = $state(1);
	let pesan = $state("");
	let panel = $state<Panel | null>(null);
	let formProdukId = $state("");
	let formKode = $state("");
	let formNama = $state("");
	let errorPanel = $state("");
	let simpanPanel = $state(false);

	const kataCari = $derived(kata.trim().toLowerCase());
	const opsiProduk = $derived(
		produk.map((p) => ({
			id: p.id,
			label: p.nama,
			sub: p.kode,
		})),
	);
	const tersaring = $derived.by(() => {
		let list = tahapan;
		if (saringProduk) list = list.filter((t) => t.produkId === saringProduk);
		if (kataCari) {
			list = list.filter((t) => {
				const induk = namaProduk(t.produkId).toLowerCase();
				return (
					t.nama.toLowerCase().includes(kataCari) ||
					t.kode.toLowerCase().includes(kataCari) ||
					induk.includes(kataCari)
				);
			});
		}
		return list;
	});
	const totalHalaman = $derived(Math.max(1, Math.ceil(tersaring.length / perHalaman)));
	const tampil = $derived(tersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman));
	const dari = $derived(tersaring.length === 0 ? 0 : (halaman - 1) * perHalaman + 1);
	const sampai = $derived(Math.min(halaman * perHalaman, tersaring.length));

	function namaProduk(id: string) {
		return produk.find((p) => p.id === id)?.nama ?? "—";
	}

	function jumlahAktivitas(id: string) {
		return aktivitas.filter((a) => a.tahapanId === id).length;
	}

	async function muat() {
		const data = await api<{ produk: Produk[]; tahapan: Tahapan[]; aktivitas: Aktivitas[] }>("/master/katalog");
		produk = data.produk;
		tahapan = data.tahapan;
		aktivitas = data.aktivitas;
	}
	onMount(muat);

	function kosongkanForm() {
		formProdukId = saringProduk || produk[0]?.id || "";
		formKode = "";
		formNama = "";
		errorPanel = "";
	}

	function bukaBaru() {
		kosongkanForm();
		panel = { mode: "baru" };
	}

	function bukaUbah(t: Tahapan) {
		formProdukId = t.produkId;
		formKode = t.kode;
		formNama = t.nama;
		errorPanel = "";
		panel = { mode: "ubah", id: t.id };
	}

	function bukaHapus(t: Tahapan) {
		errorPanel = "";
		panel = { mode: "hapus", id: t.id, nama: t.nama };
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
				return "Tahapan baru";
			case "ubah":
				return "Ubah tahapan";
			case "hapus":
				return "Hapus tahapan";
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
		if (!formProdukId) {
			errorPanel = "Produk/proses bisnis wajib dipilih.";
			return;
		}
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
			produkId: formProdukId,
			urutan: 1,
		};
		try {
			if (panel.mode === "baru") {
				await api("/master/tahapan", { method: "POST", body: JSON.stringify(isi) });
				pesan = `Tahapan “${nama}” tersimpan di ${namaProduk(formProdukId)}.`;
				tutupPanel();
				halaman = 1;
				await muat();
			} else if (panel.mode === "ubah") {
				await api(`/master/tahapan/${panel.id}`, { method: "PUT", body: JSON.stringify(isi) });
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
			await api(`/master/tahapan/${panel.id}`, { method: "DELETE" });
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
		<h2 class="text-lg font-semibold">Tahapan</h2>
		<p class="mt-1 text-sm text-muted">Setiap tahapan wajib menempel ke satu produk/proses bisnis.</p>
	</div>
	<IkonAksi jenis="tambah" label="Tahapan baru" onklik={bukaBaru} />
</div>

{#if produk.length === 0}
	<p class="mt-6 text-sm text-muted">
		Belum ada produk/proses bisnis. <a class="text-accent" href="/app/master/produk">Buat dulu.</a>
	</p>
{:else}
	<div class="mt-6 grid gap-4 md:grid-cols-2">
		<div>
			<label class="text-sm font-medium" for="thp-cari">Cari</label>
			<input
				id="thp-cari"
				class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
				placeholder="Nama, kode, atau produk"
				bind:value={kata}
				oninput={() => (halaman = 1)}
			/>
		</div>
		<SelectCari
			label="Produk/proses bisnis"
			placeholder="Semua produk"
			pesanKosong="Tidak ada yang cocok."
			satuan="produk"
			opsi={opsiProduk}
			nilai={saringProduk}
			onubah={(id) => {
				saringProduk = id;
				halaman = 1;
			}}
		/>
	</div>

	{#if pesan}<p class="mt-4 text-sm text-success">{pesan}</p>{/if}

	<table class="mt-6 w-full text-sm">
		<thead>
			<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
				<th class="border-b border-border-strong px-3 py-2">Kode</th>
				<th class="border-b border-border-strong px-3 py-2">Tahapan</th>
				<th class="border-b border-border-strong px-3 py-2">Produk/proses bisnis</th>
				<th class="border-b border-border-strong px-3 py-2">Aktivitas</th>
				<th class="border-b border-border-strong px-3 py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each tampil as t, i}
				<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
					<td class="border-b border-border px-3 py-3 font-mono text-xs">{t.kode}</td>
					<td class="border-b border-border px-3 py-3">{t.nama}</td>
					<td class="border-b border-border px-3 py-3">{namaProduk(t.produkId)}</td>
					<td class="border-b border-border px-3 py-3 tabular-nums text-muted">
						{jumlahAktivitas(t.id) === 0 ? "Belum ada" : `${jumlahAktivitas(t.id)} aktivitas`}
					</td>
					<td class="border-b border-border px-3 py-3">
						<div class="flex items-center gap-3">
							<IkonAksi jenis="ubah" label="Ubah" hanyaIkon onklik={() => bukaUbah(t)} />
							<IkonAksi jenis="hapus" label="Hapus" bahaya hanyaIkon onklik={() => bukaHapus(t)} />
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td class="px-3 py-6 text-sm text-muted" colspan="5">
						{#if kataCari || saringProduk}
							Tidak ada tahapan yang cocok dengan saringan ini.
						{:else}
							Belum ada tahapan.
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
{/if}

{#if panel}
	<PanelFokus judul={judulPanel(panel)} ontutup={tutupPanel}>
		{#if panel.mode === "hapus"}
			<p class="text-sm">Hapus {panel.nama}?</p>
			<p class="mt-3 text-sm text-muted">
				Hanya tahapan tanpa aktivitas dan catatan harian yang dapat dihapus.
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
				<SelectCari
					label="Produk/proses bisnis"
					placeholder="Ketik nama atau kode…"
					pesanKosong="Tidak ada yang cocok."
					satuan="produk"
					opsi={opsiProduk}
					nilai={formProdukId}
					bolehKosong={false}
					onubah={(id) => (formProdukId = id)}
				/>
				<div>
					<label class="text-sm font-medium" for="thp-kode">Kode</label>
					<input
						id="thp-kode"
						class="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
						placeholder="THP-CATAT"
						bind:value={formKode}
					/>
				</div>
				<div>
					<label class="text-sm font-medium" for="thp-nama">Nama tahapan</label>
					<textarea
						id="thp-nama"
						class="mt-1 min-h-20 w-full resize-y rounded-md border border-border px-3 py-2 text-sm"
						rows="3"
						placeholder="Pencatatan kinerja harian"
						bind:value={formNama}
						onkeydown={kirimDariPapan}
					></textarea>
					<p class="mt-1 text-xs text-muted">
						Nama resmi tahapan. Enter untuk baris baru. Ctrl+Enter untuk simpan.
					</p>
				</div>
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
