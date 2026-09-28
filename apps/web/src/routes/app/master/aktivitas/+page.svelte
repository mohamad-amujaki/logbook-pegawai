<script lang="ts">
	import { onMount } from "svelte";
	import { ApiError, api } from "$lib/api";
	import IkonAksi from "$lib/IkonAksi.svelte";
	import PanelFokus from "$lib/PanelFokus.svelte";
	import SelectCari from "$lib/SelectCari.svelte";

	type Tahapan = { id: string; kode: string; nama: string };
	type Aktivitas = {
		id: string;
		kode: string;
		nama: string;
		tahapanId: string;
		uraian: string | null;
		normaWaktuMenit: number;
		status: string;
	};
	type Panel =
		| { mode: "baru" }
		| { mode: "ubah"; id: string }
		| { mode: "hapus"; id: string; nama: string };

	const opsiPerHalaman = [5, 10, 15, 20] as const;

	let tahapan = $state<Tahapan[]>([]);
	let aktivitas = $state<Aktivitas[]>([]);
	let kata = $state("");
	let saringTahapan = $state("");
	let perHalaman = $state<(typeof opsiPerHalaman)[number]>(10);
	let halaman = $state(1);
	let pesan = $state("");
	let panel = $state<Panel | null>(null);
	let formTahapanId = $state("");
	let formKode = $state("");
	let formNama = $state("");
	let formUraian = $state("");
	let formNorma = $state(15);
	let formStatus = $state<"aktif" | "nonaktif">("aktif");
	let errorPanel = $state("");
	let simpanPanel = $state(false);

	const kataCari = $derived(kata.trim().toLowerCase());
	const opsiTahapan = $derived(
		tahapan.map((t) => ({
			id: t.id,
			label: t.nama,
			sub: t.kode,
		})),
	);
	const tersaring = $derived.by(() => {
		let list = aktivitas;
		if (saringTahapan) list = list.filter((a) => a.tahapanId === saringTahapan);
		if (kataCari) {
			list = list.filter((a) => {
				const induk = namaTahapan(a.tahapanId).toLowerCase();
				return (
					a.nama.toLowerCase().includes(kataCari) ||
					a.kode.toLowerCase().includes(kataCari) ||
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

	function namaTahapan(id: string) {
		return tahapan.find((t) => t.id === id)?.nama ?? "—";
	}

	async function muat() {
		const data = await api<{ tahapan: Tahapan[]; aktivitas: Aktivitas[] }>("/master/katalog");
		tahapan = data.tahapan;
		aktivitas = data.aktivitas;
	}
	onMount(muat);

	function kosongkanForm() {
		formTahapanId = saringTahapan || tahapan[0]?.id || "";
		formKode = "";
		formNama = "";
		formUraian = "";
		formNorma = 15;
		formStatus = "aktif";
		errorPanel = "";
	}

	function bukaBaru() {
		kosongkanForm();
		panel = { mode: "baru" };
	}

	function bukaUbah(a: Aktivitas) {
		formTahapanId = a.tahapanId;
		formKode = a.kode;
		formNama = a.nama;
		formUraian = a.uraian ?? "";
		formNorma = a.normaWaktuMenit;
		formStatus = a.status === "nonaktif" ? "nonaktif" : "aktif";
		errorPanel = "";
		panel = { mode: "ubah", id: a.id };
	}

	function bukaHapus(a: Aktivitas) {
		errorPanel = "";
		panel = { mode: "hapus", id: a.id, nama: a.nama };
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
				return "Aktivitas baru";
			case "ubah":
				return "Ubah aktivitas";
			case "hapus":
				return "Hapus aktivitas";
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
		if (!formTahapanId) {
			errorPanel = "Tahapan wajib dipilih.";
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
		if (formNorma <= 0) {
			errorPanel = "Norma waktu harus lebih dari 0 menit.";
			return;
		}
		simpanPanel = true;
		const isi = {
			kode: formKode.trim(),
			nama,
			tahapanId: formTahapanId,
			uraian: formUraian.trim() || undefined,
			normaWaktuMenit: Number(formNorma),
			status: formStatus,
		};
		try {
			if (panel.mode === "baru") {
				await api("/master/aktivitas", { method: "POST", body: JSON.stringify(isi) });
				pesan = `Aktivitas “${nama}” tersimpan. Norma ${formNorma} menit.`;
				tutupPanel();
				halaman = 1;
				await muat();
			} else if (panel.mode === "ubah") {
				await api(`/master/aktivitas/${panel.id}`, { method: "PUT", body: JSON.stringify(isi) });
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
			await api(`/master/aktivitas/${panel.id}`, { method: "DELETE" });
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
		<h2 class="text-lg font-semibold">Aktivitas</h2>
		<p class="mt-1 text-sm text-muted">Norma waktu (menit) adalah standar katalog, bukan jam efektif yang diisi pegawai.</p>
	</div>
	<IkonAksi jenis="tambah" label="Aktivitas baru" onklik={bukaBaru} />
</div>

{#if tahapan.length === 0}
	<p class="mt-6 text-sm text-muted">
		Belum ada tahapan. <a class="text-accent" href="/app/master/tahapan">Buat tahapan dulu.</a>
	</p>
{:else}
	<div class="mt-6 grid gap-4 md:grid-cols-2">
		<div>
			<label class="text-sm font-medium" for="akt-cari">Cari</label>
			<input
				id="akt-cari"
				class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
				placeholder="Nama, kode, atau tahapan"
				bind:value={kata}
				oninput={() => (halaman = 1)}
			/>
		</div>
		<SelectCari
			label="Tahapan"
			placeholder="Semua tahapan"
			pesanKosong="Tidak ada yang cocok."
			satuan="tahapan"
			opsi={opsiTahapan}
			nilai={saringTahapan}
			onubah={(id) => {
				saringTahapan = id;
				halaman = 1;
			}}
		/>
	</div>

	{#if pesan}<p class="mt-4 text-sm text-success">{pesan}</p>{/if}

	<div class="tabel-geser mt-6">
	<table class="w-full min-w-[40rem] text-sm">
		<thead>
			<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
				<th class="border-b border-border-strong px-3 py-2">Kode</th>
				<th class="border-b border-border-strong px-3 py-2">Aktivitas</th>
				<th class="border-b border-border-strong px-3 py-2">Tahapan</th>
				<th class="border-b border-border-strong px-3 py-2">Norma</th>
				<th class="border-b border-border-strong px-3 py-2">Status</th>
				<th class="border-b border-border-strong px-3 py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each tampil as a, i}
				<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
					<td class="border-b border-border px-3 py-3 font-mono text-xs">{a.kode}</td>
					<td class="border-b border-border px-3 py-3">{a.nama}</td>
					<td class="border-b border-border px-3 py-3">{namaTahapan(a.tahapanId)}</td>
					<td class="border-b border-border px-3 py-3 font-mono tabular-nums">{a.normaWaktuMenit} mnt</td>
					<td class="border-b border-border px-3 py-3">{a.status === "nonaktif" ? "Nonaktif" : "Aktif"}</td>
					<td class="border-b border-border px-3 py-3">
						<div class="flex items-center gap-3">
							<IkonAksi jenis="ubah" label="Ubah" hanyaIkon onklik={() => bukaUbah(a)} />
							<IkonAksi jenis="hapus" label="Hapus" bahaya hanyaIkon onklik={() => bukaHapus(a)} />
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td class="px-3 py-6 text-sm text-muted" colspan="6">
						{#if kataCari || saringTahapan}
							Tidak ada aktivitas yang cocok dengan filter ini.
						{:else}
							Belum ada aktivitas.
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	</div>

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
				Hanya aktivitas tanpa catatan harian yang dapat dihapus. Yang masih terpakai dinonaktifkan lewat Ubah.
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
					label="Tahapan"
					placeholder="Ketik nama atau kode…"
					pesanKosong="Tidak ada yang cocok."
					satuan="tahapan"
					opsi={opsiTahapan}
					nilai={formTahapanId}
					bolehKosong={false}
					onubah={(id) => (formTahapanId = id)}
				/>
				<div>
					<label class="text-sm font-medium" for="akt-kode">Kode</label>
					<input
						id="akt-kode"
						class="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
						placeholder="AKT-VERIF"
						bind:value={formKode}
					/>
				</div>
				<div>
					<label class="text-sm font-medium" for="akt-nama">Nama aktivitas</label>
					<textarea
						id="akt-nama"
						class="mt-1 min-h-20 w-full resize-y rounded-md border border-border px-3 py-2 text-sm"
						rows="3"
						placeholder="Verifikasi isian kinerja"
						bind:value={formNama}
						onkeydown={kirimDariPapan}
					></textarea>
					<p class="mt-1 text-xs text-muted">
						Nama resmi aktivitas. Enter untuk baris baru. Ctrl+Enter untuk simpan.
					</p>
				</div>
				<div>
					<label class="text-sm font-medium" for="akt-norma">Norma waktu (menit)</label>
					<input
						id="akt-norma"
						class="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
						type="number"
						min="1"
						bind:value={formNorma}
					/>
				</div>
				<div>
					<label class="text-sm font-medium" for="akt-uraian">Uraian</label>
					<input
						id="akt-uraian"
						class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
						placeholder="Opsional"
						bind:value={formUraian}
					/>
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
