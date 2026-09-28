<script lang="ts">
	import { onMount } from "svelte";
	import { ApiError, api } from "$lib/api";
	import IkonAksi from "$lib/IkonAksi.svelte";
	import PanelFokus from "$lib/PanelFokus.svelte";
	import SelectCari from "$lib/SelectCari.svelte";

	type Tim = {
		id: string;
		kode: string;
		nama: string;
		status: string;
		ketuaPegawaiId: string | null;
		ketuaNama: string | null;
		ketuaNip: string | null;
		jumlahAnggota: number;
		unitKerjaId: string;
		unitNama: string | null;
		unitKode: string | null;
		indukNama: string | null;
		indukKode: string | null;
	};

	type Pegawai = {
		id: string;
		namaLengkap: string;
		nip: string;
		jabatan: string;
		timKerjaId: string | null;
		timNama: string | null;
	};

	type Unit = {
		id: string;
		kode: string;
		nama: string;
		indukId: string | null;
		indukNama: string | null;
		indukKode: string | null;
		status: string;
	};

	let tim = $state<Tim[]>([]);
	let pegawai = $state<Pegawai[]>([]);
	let units = $state<Unit[]>([]);
	let kata = $state("");
	let filterEselonId = $state("");
	let filterUnitId = $state("");
	let panelMode = $state<"baru" | "ubah" | "">("");
	let suntingId = $state("");
	let formKode = $state("");
	let formNama = $state("");
	let formEselonId = $state("");
	let formUnitId = $state("");
	let formStatus = $state<"aktif" | "nonaktif">("aktif");
	let formKetuaId = $state("");
	let pesan = $state("");
	let error = $state("");
	let menyimpan = $state(false);
	let konfirmasiPindah = $state(false);

	const eselon = $derived(units.filter((u) => !u.indukId));
	const unitKerja = $derived(units.filter((u) => u.indukId));
	const opsiEselon = $derived(
		eselon.map((u) => ({ id: u.id, label: u.nama, sub: u.kode })),
	);
	const opsiUnitFilter = $derived(
		unitKerja
			.filter((u) => !filterEselonId || u.indukId === filterEselonId)
			.map((u) => ({
				id: u.id,
				label: u.nama,
				sub: u.kode,
				detail: u.indukNama ?? undefined,
			})),
	);
	const opsiUnitForm = $derived(
		unitKerja
			.filter((u) => u.indukId === formEselonId)
			.map((u) => ({
				id: u.id,
				label: u.nama,
				sub: u.kode,
				detail: u.status === "nonaktif" ? "Nonaktif" : undefined,
			})),
	);
	const hasil = $derived.by(() => {
		const q = kata.trim().toLowerCase();
		return tim.filter((t) => {
			if (filterUnitId && t.unitKerjaId !== filterUnitId) return false;
			const unit = units.find((u) => u.id === t.unitKerjaId);
			if (filterEselonId && unit?.indukId !== filterEselonId) return false;
			if (!q) return true;
			return [t.kode, t.nama, t.ketuaNama, t.unitNama, t.indukNama]
				.filter(Boolean)
				.some((nilai) => nilai?.toLowerCase().includes(q));
		});
	});
	const opsiKetua = $derived.by(() => {
		const padaUnit = pegawai.filter((p) => p.unitKerjaId === formUnitId);
		const anggota = padaUnit.filter((p) => p.timKerjaId === suntingId);
		const lain = padaUnit.filter((p) => p.timKerjaId !== suntingId);
		return [...anggota, ...lain].map((p) => ({
			id: p.id,
			label: p.namaLengkap,
			sub: p.nip,
			detail: p.timKerjaId === suntingId ? p.jabatan : `${p.jabatan} · ${p.timNama ?? "Belum ada tim"}`,
		}));
	});

	async function muat() {
		const [dataTim, dataPegawai, dataUnit] = await Promise.all([
			api<Tim[]>("/master/tim"),
			api<Pegawai[]>("/master/pegawai"),
			api<Unit[]>("/master/unit"),
		]);
		tim = dataTim;
		pegawai = dataPegawai;
		units = dataUnit;
	}
	onMount(muat);

	function kosongkanForm() {
		formKode = "";
		formNama = "";
		formEselonId = "";
		formUnitId = "";
		formStatus = "aktif";
		formKetuaId = "";
		suntingId = "";
		error = "";
		konfirmasiPindah = false;
	}

	function bukaBaru() {
		kosongkanForm();
		const unit = units.find((u) => u.id === filterUnitId);
		if (unit?.indukId) {
			formEselonId = unit.indukId;
			formUnitId = unit.id;
		} else if (filterEselonId) {
			formEselonId = filterEselonId;
		}
		panelMode = "baru";
		pesan = "";
	}

	function bukaUbah(t: Tim) {
		const unit = units.find((u) => u.id === t.unitKerjaId);
		suntingId = t.id;
		formKode = t.kode;
		formNama = t.nama;
		formEselonId = unit?.indukId ?? "";
		formUnitId = t.unitKerjaId;
		formStatus = t.status === "nonaktif" ? "nonaktif" : "aktif";
		formKetuaId = t.ketuaPegawaiId ?? "";
		error = "";
		pesan = "";
		konfirmasiPindah = false;
		panelMode = "ubah";
	}

	function tutupPanel() {
		panelMode = "";
		kosongkanForm();
	}

	function ubahFilterEselon(id: string) {
		filterEselonId = id;
		filterUnitId = "";
	}

	function ubahFormEselon(id: string) {
		formEselonId = id;
		formUnitId = "";
		formKetuaId = "";
		konfirmasiPindah = false;
	}

	function ubahFormUnit(id: string) {
		if (formUnitId !== id) formKetuaId = "";
		formUnitId = id;
		konfirmasiPindah = false;
	}

	function resetFilter() {
		kata = "";
		filterEselonId = "";
		filterUnitId = "";
	}

	async function simpan(e?: Event, perpindahanDikonfirmasi = false) {
		e?.preventDefault();
		error = "";
		pesan = "";
		if (!formKode.trim() || !formNama.trim()) {
			error = "Kode dan nama tim wajib diisi.";
			return;
		}
		if (!formEselonId || !formUnitId) {
			error = "Eselon I dan unit kerja wajib dipilih.";
			return;
		}
		const sedang = tim.find((t) => t.id === suntingId);
		const pindahUnit = panelMode === "ubah" && sedang?.unitKerjaId !== formUnitId;
		if (pindahUnit && (sedang?.jumlahAnggota ?? 0) > 0 && !perpindahanDikonfirmasi) {
			konfirmasiPindah = true;
			return;
		}
		menyimpan = true;
		try {
			if (panelMode === "baru") {
				await api("/master/tim", {
					method: "POST",
					body: JSON.stringify({
						kode: formKode.trim(),
						nama: formNama.trim(),
						unitKerjaId: formUnitId,
						status: formStatus,
					}),
				});
				pesan = `Tim “${formNama.trim()}” ditambahkan.`;
			} else if (panelMode === "ubah") {
				await api(`/master/tim/${suntingId}`, {
					method: "PUT",
					body: JSON.stringify({
						kode: formKode.trim(),
						nama: formNama.trim(),
						unitKerjaId: formUnitId,
						status: formStatus,
						ketuaPegawaiId: formKetuaId || null,
					}),
				});
				pesan = pindahUnit
					? `Tim “${formNama.trim()}” dan anggotanya dipindahkan.`
					: `Tim “${formNama.trim()}” disimpan.`;
			}
			tutupPanel();
			await muat();
		} catch (err) {
			error =
				err instanceof ApiError
					? err.message
					: "Tidak dapat menyimpan tim. Periksa isian, lalu coba lagi.";
		} finally {
			menyimpan = false;
		}
	}
</script>

<div class="flex flex-wrap items-baseline justify-between gap-4">
	<div>
		<h2 class="text-lg font-semibold">Tim kerja</h2>
		<p class="mt-1 text-sm text-muted">
			Kelola tim kerja pada setiap unit kerja, termasuk ketua, anggota, dan status tim.
		</p>
	</div>
	<IkonAksi jenis="tambah" label="Tim kerja baru" onklik={bukaBaru} />
</div>

<div class="mt-6 grid gap-4 lg:grid-cols-3">
	<div>
		<label class="text-sm font-medium" for="tim-cari">Cari tim</label>
		<input
			id="tim-cari"
			class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2 text-sm"
			placeholder="Nama tim, kode, atau ketua"
			bind:value={kata}
		/>
	</div>
	<SelectCari
		label="Eselon I"
		placeholder="Semua Eselon I"
		pesanKosong="Tidak ada Eselon I yang cocok."
		satuan="Eselon I"
		opsi={opsiEselon}
		nilai={filterEselonId}
		onubah={ubahFilterEselon}
	/>
	<SelectCari
		label="Unit kerja"
		placeholder={filterEselonId ? "Semua unit kerja" : "Pilih Eselon I terlebih dahulu"}
		pesanKosong="Tidak ada unit kerja yang cocok."
		satuan="unit kerja"
		opsi={filterEselonId ? opsiUnitFilter : []}
		nilai={filterUnitId}
		onubah={(id) => (filterUnitId = id)}
	/>
</div>

<div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
	<p class="text-muted">{hasil.length} dari {tim.length} tim kerja</p>
	{#if kata || filterEselonId || filterUnitId}
		<button class="text-accent" type="button" onclick={resetFilter}>Hapus filter</button>
	{/if}
</div>

{#if pesan}<p class="mt-4 text-sm text-success">{pesan}</p>{/if}

<div class="tabel-geser mt-4">
	<table class="w-full min-w-[56rem] text-sm">
		<thead>
			<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
				<th class="border-b border-border-strong px-3 py-2">Kode</th>
				<th class="border-b border-border-strong px-3 py-2">Nama tim</th>
				<th class="border-b border-border-strong px-3 py-2">Unit kerja</th>
				<th class="border-b border-border-strong px-3 py-2">Ketua</th>
				<th class="border-b border-border-strong px-3 py-2">Anggota</th>
				<th class="border-b border-border-strong px-3 py-2">Status</th>
				<th class="border-b border-border-strong px-3 py-2">Aksi</th>
			</tr>
		</thead>
		<tbody>
			{#each hasil as t, i (t.id)}
				<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
					<td class="border-b border-border px-3 py-3 font-mono text-xs">{t.kode}</td>
					<td class="border-b border-border px-3 py-3 font-medium">{t.nama}</td>
					<td class="border-b border-border px-3 py-3">
						<p>{t.unitNama ?? "Unit kerja tidak ditemukan"}</p>
						<p class="mt-0.5 text-xs text-muted">
							{t.indukNama ?? "Eselon I tidak ditemukan"}
							{#if t.unitKode}<span class="font-mono"> · {t.unitKode}</span>{/if}
						</p>
					</td>
					<td class="border-b border-border px-3 py-3">
						{#if t.ketuaNama}
							<p>{t.ketuaNama}</p>
							<p class="font-mono text-xs text-muted">{t.ketuaNip}</p>
						{:else}
							<span class="text-muted">Belum ada ketua</span>
						{/if}
					</td>
					<td class="border-b border-border px-3 py-3 tabular-nums">{t.jumlahAnggota}</td>
					<td class="border-b border-border px-3 py-3">
						<span class:text-muted={t.status === "nonaktif"}>
							{t.status === "nonaktif" ? "Nonaktif" : "Aktif"}
						</span>
					</td>
					<td class="border-b border-border px-3 py-3">
						<IkonAksi jenis="ubah" label="Ubah tim" hanyaIkon onklik={() => bukaUbah(t)} />
					</td>
				</tr>
			{:else}
				<tr>
					<td class="px-3 py-6 text-sm text-muted" colspan="7">
						{#if kata || filterEselonId || filterUnitId}
							Tidak ada tim yang cocok. Ubah kata pencarian atau filter.
						{:else}
							Belum ada tim kerja. Pilih Tim kerja baru untuk menambahkan data.
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if panelMode}
	<PanelFokus judul={panelMode === "baru" ? "Tim kerja baru" : "Ubah tim kerja"} ontutup={tutupPanel}>
		<form class="space-y-4" onsubmit={simpan}>
			<SelectCari
				label="Eselon I"
				placeholder="Pilih Eselon I"
				pesanKosong="Tidak ada Eselon I yang cocok."
				satuan="Eselon I"
				opsi={opsiEselon}
				nilai={formEselonId}
				bolehKosong={false}
				onubah={ubahFormEselon}
			/>
			<p class="text-xs text-muted">Digunakan untuk menyaring pilihan unit kerja.</p>

			<SelectCari
				label="Unit kerja"
				placeholder={formEselonId ? "Pilih unit kerja" : "Pilih Eselon I terlebih dahulu"}
				pesanKosong="Tidak ada unit kerja yang cocok."
				satuan="unit kerja"
				opsi={opsiUnitForm}
				nilai={formUnitId}
				bolehKosong={false}
				onubah={ubahFormUnit}
			/>
			<p class="text-xs text-muted">Tim dan anggotanya terhubung ke unit kerja ini.</p>

			<div>
				<label class="text-sm font-medium" for="tim-kode">Kode tim</label>
				<input
					id="tim-kode"
					class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
					placeholder="TK-ORTALA"
					bind:value={formKode}
				/>
			</div>
			<div>
				<label class="text-sm font-medium" for="tim-nama">Nama tim kerja</label>
				<input
					id="tim-nama"
					class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2 text-sm"
					placeholder="Tim Kerja Organisasi dan Tata Laksana"
					bind:value={formNama}
				/>
			</div>

			{#if panelMode === "ubah"}
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

				<SelectCari
					label="Ketua tim"
					placeholder={formUnitId ? "Cari berdasarkan nama atau NIP" : "Pilih unit kerja terlebih dahulu"}
					pesanKosong="Tidak ada pegawai yang cocok pada unit kerja ini."
					satuan="pegawai"
					opsi={opsiKetua}
					nilai={formKetuaId}
					onubah={(id) => (formKetuaId = id)}
				/>
				<p class="text-xs text-muted">
					Ketua otomatis menjadi anggota tim. Pilihan dibatasi pada pegawai di unit kerja yang sama.
				</p>
			{/if}

			{#if konfirmasiPindah}
				<div class="border border-border-strong bg-surface-alt px-3 py-3 text-sm">
					<p class="font-medium">Pindahkan tim ke unit kerja ini?</p>
					<p class="mt-1 text-muted">Penempatan seluruh anggota tim juga akan disesuaikan.</p>
					<div class="mt-3 flex flex-wrap gap-4">
						<button
							class="rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-60"
							type="button"
							disabled={menyimpan}
							onclick={() => simpan(undefined, true)}>Ya, pindahkan</button
						>
						<button class="text-accent" type="button" onclick={() => (konfirmasiPindah = false)}
							>Batal</button
						>
					</div>
				</div>
			{:else}
				{#if error}<p class="text-sm text-error">{error}</p>{/if}
				<div class="flex flex-wrap items-center gap-4">
					<button
						class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
						type="submit"
						disabled={menyimpan}>{menyimpan ? "Menyimpan…" : "Simpan"}</button
					>
					<button class="text-sm text-accent" type="button" onclick={tutupPanel}>Batal</button>
				</div>
			{/if}
		</form>
	</PanelFokus>
{/if}
