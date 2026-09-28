<script lang="ts">
	import { onMount } from "svelte";
	import { ApiError, api } from "$lib/api";
	import SelectCari from "$lib/SelectCari.svelte";

	type Jenis =
		| "AKTIVITAS_HARIAN"
		| "JAM_EFEKTIF"
		| "VALIDASI"
		| "KETERHUBUNGAN_KATALOG"
		| "KELENGKAPAN_SKP";
	type Laporan = {
		judul: string;
		subjudul: string;
		dibuatPada: string;
		ringkasan: { label: string; nilai: string }[];
		kolom: string[];
		baris: string[][];
		pagination: {
			page: number;
			pageSize: number;
			totalRows: number;
			totalPages: number;
		};
	};
	type Unit = { id: string; nama: string; kode: string; indukId: string | null; indukNama: string | null };
	type Tim = { id: string; nama: string; kode: string; unitKerjaId: string };
	type Pegawai = { id: string; namaLengkap: string; nip: string; unitKerjaId: string; timKerjaId: string | null };

	const jenisLaporan: { id: Jenis; label: string; deskripsi: string }[] = [
		{ id: "AKTIVITAS_HARIAN", label: "Aktivitas harian", deskripsi: "Catatan, waktu, output, status, dan pemetaan katalog." },
		{ id: "JAM_EFEKTIF", label: "Jam efektif", deskripsi: "Waktu tercatat dan terverifikasi per pegawai." },
		{ id: "VALIDASI", label: "Validasi catatan", deskripsi: "Pengajuan menunggu, disetujui, dan ditolak." },
		{ id: "KETERHUBUNGAN_KATALOG", label: "Keterhubungan katalog", deskripsi: "Catatan yang tertaut pada produk dan tahapan." },
		{ id: "KELENGKAPAN_SKP", label: "Kelengkapan SKP", deskripsi: "Identitas, sasaran, IKI, bobot, dan rencana aksi." },
	];

	const sekarang = new Date();
	let jenis = $state<Jenis>("AKTIVITAS_HARIAN");
	let dari = $state(`${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}-01`);
	let sampai = $state(
		`${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}-${String(new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0).getDate()).padStart(2, "0")}`,
	);
	let unitId = $state("");
	let timId = $state("");
	let pegawaiId = $state("");
	let units = $state<Unit[]>([]);
	let tim = $state<Tim[]>([]);
	let pegawai = $state<Pegawai[]>([]);
	let laporan = $state<Laporan | null>(null);
	let memuat = $state(false);
	let mengunduh = $state("");
	let error = $state("");
	let halaman = $state(1);
	let barisPerHalaman = $state(25);

	const unitKerja = $derived(units.filter((u) => u.indukId));
	const opsiUnit = $derived(
		unitKerja.map((u) => ({ id: u.id, label: u.nama, sub: u.kode, detail: u.indukNama ?? undefined })),
	);
	const opsiTim = $derived(
		tim
			.filter((t) => !unitId || t.unitKerjaId === unitId)
			.map((t) => ({ id: t.id, label: t.nama, sub: t.kode })),
	);
	const opsiPegawai = $derived(
		pegawai
			.filter((p) => (!unitId || p.unitKerjaId === unitId) && (!timId || p.timKerjaId === timId))
			.map((p) => ({ id: p.id, label: p.namaLengkap, sub: p.nip })),
	);

	onMount(async () => {
		const [dataUnit, dataTim, dataPegawai] = await Promise.all([
			api<Unit[]>("/master/unit"),
			api<Tim[]>("/master/tim"),
			api<Pegawai[]>("/master/pegawai"),
		]);
		units = dataUnit;
		tim = dataTim;
		pegawai = dataPegawai;
	});

	function filter(denganPagination = false, page = halaman) {
		return {
			jenis,
			dari,
			sampai,
			...(unitId ? { unitKerjaId: unitId } : {}),
			...(timId ? { timKerjaId: timId } : {}),
			...(pegawaiId ? { pegawaiId } : {}),
			...(denganPagination ? { page, pageSize: barisPerHalaman } : {}),
		};
	}

	function gantiUnit(id: string) {
		unitId = id;
		timId = "";
		pegawaiId = "";
		halaman = 1;
		laporan = null;
	}

	function gantiTim(id: string) {
		timId = id;
		pegawaiId = "";
		halaman = 1;
		laporan = null;
	}

	function resetPratinjau() {
		halaman = 1;
		laporan = null;
	}

	async function tampilkan(page = halaman) {
		error = "";
		if (!dari || !sampai || dari > sampai) {
			error = "Periode laporan belum valid.";
			return;
		}
		memuat = true;
		try {
			laporan = await api<Laporan>("/laporan/preview", {
				method: "POST",
				body: JSON.stringify(filter(true, page)),
			});
			halaman = laporan.pagination.page;
		} catch (err) {
			error = err instanceof ApiError ? err.message : "Laporan tidak dapat ditampilkan.";
		} finally {
			memuat = false;
		}
	}

	async function unduh(format: "pdf" | "xlsx") {
		error = "";
		mengunduh = format;
		try {
			const response = await fetch(`/api/laporan/export/${format}`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(filter()),
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.error ?? "Berkas laporan tidak dapat dibuat.");
			}
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const tautan = document.createElement("a");
			tautan.href = url;
			tautan.download = `laporan-${jenis.toLowerCase()}-${dari}.${format}`;
			tautan.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			error = err instanceof Error ? err.message : "Berkas laporan tidak dapat diunduh.";
		} finally {
			mengunduh = "";
		}
	}

	function waktu(iso: string): string {
		return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
	}

	function gantiJumlahBaris(event: Event) {
		barisPerHalaman = Number((event.currentTarget as HTMLSelectElement).value);
		halaman = 1;
		void tampilkan(1);
	}
</script>

<div>
	<h1 class="text-xl font-semibold">Laporan kinerja</h1>
	<p class="mt-1 text-sm text-muted">Susun, tinjau, dan unduh laporan kinerja berdasarkan periode serta unit kerja.</p>
</div>

<section class="mt-6">
	<h2 class="text-sm font-semibold">1. Pilih jenis laporan</h2>
	<div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
		{#each jenisLaporan as item}
			<button
				class="min-h-24 rounded-md border px-4 py-3 text-left"
				class:border-accent={jenis === item.id}
				class:bg-accent-muted={jenis === item.id}
				class:border-border={jenis !== item.id}
				type="button"
				onclick={() => {
					jenis = item.id;
					resetPratinjau();
				}}
			>
				<span class="block text-sm font-medium">{item.label}</span>
				<span class="mt-1 block text-xs text-muted">{item.deskripsi}</span>
			</button>
		{/each}
	</div>
</section>

<section class="mt-8">
	<h2 class="text-sm font-semibold">2. Tentukan periode dan cakupan</h2>
	<div class="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
		<div>
			<label class="text-sm font-medium" for="laporan-dari">Tanggal awal</label>
			<input id="laporan-dari" class="mt-1 min-h-11 w-full rounded-md border border-border px-3" type="date" bind:value={dari} onchange={resetPratinjau} />
		</div>
		<div>
			<label class="text-sm font-medium" for="laporan-sampai">Tanggal akhir</label>
			<input id="laporan-sampai" class="mt-1 min-h-11 w-full rounded-md border border-border px-3" type="date" bind:value={sampai} onchange={resetPratinjau} />
		</div>
		<SelectCari label="Unit kerja" placeholder="Semua yang diizinkan" pesanKosong="Tidak ada unit kerja yang cocok." satuan="unit kerja" opsi={opsiUnit} nilai={unitId} onubah={gantiUnit} />
		<SelectCari label="Tim kerja" placeholder="Semua tim" pesanKosong="Tidak ada tim yang cocok." satuan="tim" opsi={opsiTim} nilai={timId} onubah={gantiTim} />
		<SelectCari label="Pegawai" placeholder="Semua pegawai" pesanKosong="Tidak ada pegawai yang cocok." satuan="pegawai" opsi={opsiPegawai} nilai={pegawaiId} onubah={(id) => {
			pegawaiId = id;
			resetPratinjau();
		}} />
	</div>
	<p class="mt-2 text-xs text-muted">Pilihan data tetap dibatasi sesuai hak akses Anda.</p>
	<button class="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" type="button" disabled={memuat} onclick={() => tampilkan(1)}>
		{memuat ? "Menyiapkan…" : "Tampilkan laporan"}
	</button>
</section>

{#if error}<p class="mt-4 text-sm text-error">{error}</p>{/if}

{#if laporan}
	<section class="mt-10 border-t border-border-strong pt-6">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<h2 class="text-lg font-semibold">{laporan.judul}</h2>
				<p class="mt-1 text-sm text-muted">{laporan.subjudul}</p>
				<p class="mt-1 text-xs text-muted">Data dibuat pada {waktu(laporan.dibuatPada)}.</p>
			</div>
			<div class="flex flex-wrap gap-3">
				<button class="rounded-md border border-border px-4 py-2 text-sm text-accent disabled:opacity-60" type="button" disabled={Boolean(mengunduh)} onclick={() => unduh("pdf")}>
					{mengunduh === "pdf" ? "Membuat PDF…" : "Unduh PDF"}
				</button>
				<button class="rounded-md border border-border px-4 py-2 text-sm text-accent disabled:opacity-60" type="button" disabled={Boolean(mengunduh)} onclick={() => unduh("xlsx")}>
					{mengunduh === "xlsx" ? "Membuat Excel…" : "Unduh Excel"}
				</button>
			</div>
		</div>

		<div class="mt-5 grid grid-cols-2 border border-border-strong md:grid-cols-4">
			{#each laporan.ringkasan as ringkas}
				<div class="border border-border p-3">
					<p class="font-mono text-lg font-bold text-brand">{ringkas.nilai}</p>
					<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">{ringkas.label}</p>
				</div>
			{/each}
		</div>

		<div class="mt-6 flex flex-wrap items-end justify-between gap-4">
			<div>
				<h3 class="text-sm font-semibold">Pratinjau hasil</h3>
				<p class="mt-1 text-xs text-muted">
					{#if laporan.pagination.totalRows === 0}
						Tidak ada baris untuk ditampilkan.
					{:else}
						Menampilkan {(laporan.pagination.page - 1) * laporan.pagination.pageSize + 1}–{Math.min(
							laporan.pagination.page * laporan.pagination.pageSize,
							laporan.pagination.totalRows,
						)} dari {laporan.pagination.totalRows} baris.
					{/if}
					Ringkasan dan berkas ekspor mencakup seluruh hasil.
				</p>
			</div>
			<label class="text-xs font-medium text-muted" for="baris-per-halaman">
				Baris per halaman
				<select
					id="baris-per-halaman"
					class="ml-2 min-h-10 rounded-md border border-border bg-surface px-3 text-sm text-text"
					value={barisPerHalaman}
					disabled={memuat}
					onchange={gantiJumlahBaris}
				>
					<option value="25">25</option>
					<option value="50">50</option>
					<option value="100">100</option>
				</select>
			</label>
		</div>

		<div class="tabel-geser mt-3">
			<table class="w-full min-w-[48rem] text-sm">
				<thead>
					<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
						{#each laporan.kolom as kolom}<th class="border-b border-border-strong px-3 py-2">{kolom}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each laporan.baris as baris, i}
						<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
							{#each baris as nilai}<td class="border-b border-border px-3 py-3">{nilai}</td>{/each}
						</tr>
					{:else}
						<tr><td class="px-3 py-6 text-muted" colspan={laporan.kolom.length}>Tidak ada data pada periode dan cakupan yang dipilih.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
			<p class="text-sm text-muted">
				{memuat
					? "Memuat halaman laporan…"
					: `Halaman ${laporan.pagination.page} dari ${laporan.pagination.totalPages}`}
			</p>
			<div class="flex gap-2">
				<button
					class="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
					type="button"
					disabled={memuat || laporan.pagination.page <= 1}
					onclick={() => tampilkan(laporan.pagination.page - 1)}
				>
					Sebelumnya
				</button>
				<button
					class="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
					type="button"
					disabled={memuat || laporan.pagination.page >= laporan.pagination.totalPages}
					onclick={() => tampilkan(laporan.pagination.page + 1)}
				>
					Berikutnya
				</button>
			</div>
		</div>
	</section>
{:else}
	<div class="mt-10 border-t border-border pt-6">
		<p class="text-sm text-muted">Pilih jenis laporan dan periode, kemudian tampilkan laporan.</p>
	</div>
{/if}
