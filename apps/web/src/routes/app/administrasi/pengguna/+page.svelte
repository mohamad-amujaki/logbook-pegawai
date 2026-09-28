<script lang="ts">
	import { onMount } from "svelte";
	import { ApiError, api } from "$lib/api";
	import IkonAksi from "$lib/IkonAksi.svelte";
	import PanelFokus from "$lib/PanelFokus.svelte";
	import SelectCari from "$lib/SelectCari.svelte";

	type Peran = {
		id: string;
		peran: "ADMIN" | "KEPALA_BIRO" | "PENGELOLA_UNIT";
		unitKerjaId: string | null;
		unitNama: string | null;
	};
	type Pengguna = {
		id: string;
		pegawaiId: string;
		nip: string;
		nama: string;
		jabatan: string;
		unitKerjaId: string;
		unitNama: string;
		statusPegawai: string;
		status: "AKTIF" | "DITANGGUHKAN";
		wajibGantiSandi: boolean;
		terakhirLoginPada: string | null;
		ditangguhkanPada: string | null;
		alasanPenangguhan: string | null;
		peran: Peran[];
	};
	type Unit = { id: string; nama: string; kode: string; indukId: string | null; indukNama: string | null };

	let pengguna = $state<Pengguna[]>([]);
	let units = $state<Unit[]>([]);
	let kata = $state("");
	let status = $state("");
	let peran = $state("");
	let unitId = $state("");
	let detailId = $state("");
	let formAdmin = $state(false);
	let formKepala = $state(false);
	let formPengelola = $state(false);
	let formUnitIds = $state<string[]>([]);
	let alasan = $state("");
	let sandiSementara = $state("");
	let pesan = $state("");
	let error = $state("");
	let sibuk = $state(false);

	const detail = $derived(pengguna.find((p) => p.id === detailId) ?? null);
	const opsiUnit = $derived(
		units
			.filter((u) => u.indukId)
			.map((u) => ({ id: u.id, label: u.nama, sub: u.kode, detail: u.indukNama ?? undefined })),
	);
	const hasil = $derived.by(() => {
		const q = kata.trim().toLowerCase();
		return pengguna.filter((p) => {
			if (status && p.status !== status) return false;
			if (unitId && p.unitKerjaId !== unitId) return false;
			if (peran && !p.peran.some((r) => r.peran === peran)) return false;
			if (!q) return true;
			return [p.nama, p.nip, p.jabatan, p.unitNama].some((nilai) =>
				nilai.toLowerCase().includes(q),
			);
		});
	});
	const ringkasan = $derived({
		aktif: pengguna.filter((p) => p.status === "AKTIF").length,
		ganti: pengguna.filter((p) => p.status === "AKTIF" && p.wajibGantiSandi).length,
		ditangguhkan: pengguna.filter((p) => p.status === "DITANGGUHKAN").length,
		pengelola: pengguna.filter((p) => p.peran.some((r) => r.peran === "PENGELOLA_UNIT")).length,
	});

	async function muat() {
		const [dataPengguna, dataUnit] = await Promise.all([
			api<Pengguna[]>("/pengguna"),
			api<Unit[]>("/master/unit"),
		]);
		pengguna = dataPengguna;
		units = dataUnit;
	}

	onMount(muat);

	function buka(p: Pengguna) {
		detailId = p.id;
		formAdmin = p.peran.some((r) => r.peran === "ADMIN");
		formKepala = p.peran.some((r) => r.peran === "KEPALA_BIRO");
		const unitPengelola = p.peran
			.filter((r) => r.peran === "PENGELOLA_UNIT" && r.unitKerjaId)
			.map((r) => r.unitKerjaId as string);
		formPengelola = unitPengelola.length > 0;
		formUnitIds = unitPengelola.length > 0 ? unitPengelola : [p.unitKerjaId];
		alasan = "";
		sandiSementara = "";
		error = "";
		pesan = "";
	}

	function tutup() {
		detailId = "";
		error = "";
		sandiSementara = "";
	}

	async function simpanPeran() {
		if (!detail) return;
		if (formPengelola && formUnitIds.length === 0) {
			error = "Pilih sekurang-kurangnya satu unit kerja untuk peran Pengelola unit.";
			return;
		}
		const daftar = [
			...(formAdmin ? [{ peran: "ADMIN" }] : []),
			...(formKepala ? [{ peran: "KEPALA_BIRO" }] : []),
			...(formPengelola
				? formUnitIds.map((id) => ({ peran: "PENGELOLA_UNIT", unitKerjaId: id }))
				: []),
		];
		sibuk = true;
		error = "";
		try {
			await api(`/pengguna/${detail.id}/peran`, {
				method: "PUT",
				body: JSON.stringify({ peran: daftar }),
			});
			pesan = `Peran ${detail.nama} diperbarui.`;
			await muat();
			tutup();
		} catch (err) {
			error = err instanceof ApiError ? err.message : "Tidak dapat menyimpan peran.";
		} finally {
			sibuk = false;
		}
	}

	async function resetSandi() {
		if (!detail) return;
		sibuk = true;
		error = "";
		try {
			const hasil = await api<{ sandiSementara: string }>(`/pengguna/${detail.id}/reset-sandi`, {
				method: "POST",
			});
			sandiSementara = hasil.sandiSementara;
			await muat();
		} catch (err) {
			error = err instanceof ApiError ? err.message : "Tidak dapat mengatur ulang sandi.";
		} finally {
			sibuk = false;
		}
	}

	async function ubahStatus() {
		if (!detail) return;
		if (detail.status === "AKTIF" && alasan.trim().length < 3) {
			error = "Tuliskan alasan penangguhan, minimal 3 karakter.";
			return;
		}
		sibuk = true;
		error = "";
		try {
			const aksi = detail.status === "AKTIF" ? "tangguhkan" : "aktifkan";
			await api(`/pengguna/${detail.id}/${aksi}`, {
				method: "POST",
				body: JSON.stringify({ alasan: alasan.trim() || "Diaktifkan kembali." }),
			});
			pesan =
				detail.status === "AKTIF"
					? `Akses ${detail.nama} ditangguhkan.`
					: `Akses ${detail.nama} diaktifkan kembali.`;
			await muat();
			tutup();
		} catch (err) {
			error = err instanceof ApiError ? err.message : "Tidak dapat mengubah status akun.";
		} finally {
			sibuk = false;
		}
	}

	function labelPeran(p: Pengguna): string {
		if (p.peran.length === 0) return "Pegawai";
		return p.peran
			.map((r) =>
				r.peran === "ADMIN"
					? "Administrator"
					: r.peran === "KEPALA_BIRO"
						? "Kepala Biro"
						: `Pengelola ${r.unitNama ?? "unit"}`,
			)
			.join(" · ");
	}

	function ubahUnitKelola(id: string, dipilih: boolean) {
		formUnitIds = dipilih
			? [...new Set([...formUnitIds, id])]
			: formUnitIds.filter((unit) => unit !== id);
	}

	function waktu(iso: string | null): string {
		return iso
			? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
					new Date(iso),
				)
			: "Belum pernah";
	}
</script>

<div class="flex flex-wrap items-baseline justify-between gap-4">
	<div>
		<h1 class="text-xl font-semibold">Manajemen pengguna</h1>
		<p class="mt-1 text-sm text-muted">Kelola aktivasi akun, peran, dan keamanan akses pengguna.</p>
	</div>
</div>

<section class="mt-6 grid grid-cols-2 border border-border-strong lg:grid-cols-4">
	<div class="border border-border p-3 sm:p-5">
		<p class="font-mono text-xl font-bold text-brand">{ringkasan.aktif}</p>
		<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Akun aktif</p>
	</div>
	<div class="border border-border p-3 sm:p-5">
		<p class="font-mono text-xl font-bold text-accent">{ringkasan.ganti}</p>
		<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Wajib ganti sandi</p>
	</div>
	<div class="border border-border p-3 sm:p-5">
		<p class="font-mono text-xl font-bold text-accent">{ringkasan.ditangguhkan}</p>
		<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Ditangguhkan</p>
	</div>
	<div class="border border-border p-3 sm:p-5">
		<p class="font-mono text-xl font-bold text-accent">{ringkasan.pengelola}</p>
		<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Pengelola unit</p>
	</div>
</section>

<div class="mt-6 grid gap-4 lg:grid-cols-4">
	<div>
		<label class="text-sm font-medium" for="pengguna-cari">Cari pengguna</label>
		<input
			id="pengguna-cari"
			class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2 text-sm"
			placeholder="Nama, NIP, atau jabatan"
			bind:value={kata}
		/>
	</div>
	<div>
		<label class="text-sm font-medium" for="pengguna-status">Status akun</label>
		<select id="pengguna-status" class="mt-1 min-h-11 w-full rounded-md border border-border px-3" bind:value={status}>
			<option value="">Semua status</option>
			<option value="AKTIF">Aktif</option>
			<option value="DITANGGUHKAN">Ditangguhkan</option>
		</select>
	</div>
	<div>
		<label class="text-sm font-medium" for="pengguna-peran">Peran</label>
		<select id="pengguna-peran" class="mt-1 min-h-11 w-full rounded-md border border-border px-3" bind:value={peran}>
			<option value="">Semua peran</option>
			<option value="ADMIN">Administrator</option>
			<option value="KEPALA_BIRO">Kepala Biro</option>
			<option value="PENGELOLA_UNIT">Pengelola unit</option>
		</select>
	</div>
	<SelectCari
		label="Unit kerja"
		placeholder="Semua unit kerja"
		pesanKosong="Tidak ada unit kerja yang cocok."
		satuan="unit kerja"
		opsi={opsiUnit}
		nilai={unitId}
		onubah={(id) => (unitId = id)}
	/>
</div>

{#if pesan}<p class="mt-4 text-sm text-success">{pesan}</p>{/if}
<p class="mt-4 text-sm text-muted">{hasil.length} dari {pengguna.length} pengguna</p>

<div class="tabel-geser mt-3">
	<table class="w-full min-w-[54rem] text-sm">
		<thead>
			<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
				<th class="border-b border-border-strong px-3 py-2">Pengguna</th>
				<th class="border-b border-border-strong px-3 py-2">Unit kerja</th>
				<th class="border-b border-border-strong px-3 py-2">Peran</th>
				<th class="border-b border-border-strong px-3 py-2">Status akun</th>
				<th class="border-b border-border-strong px-3 py-2">Terakhir masuk</th>
				<th class="border-b border-border-strong px-3 py-2">Aksi</th>
			</tr>
		</thead>
		<tbody>
			{#each hasil as p, i (p.id)}
				<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
					<td class="border-b border-border px-3 py-3">
						<p class="font-medium">{p.nama}</p>
						<p class="font-mono text-xs text-muted">{p.nip}</p>
					</td>
					<td class="border-b border-border px-3 py-3">{p.unitNama}</td>
					<td class="border-b border-border px-3 py-3">{labelPeran(p)}</td>
					<td class="border-b border-border px-3 py-3">
						{p.status === "AKTIF" ? (p.wajibGantiSandi ? "Menunggu penggantian sandi" : "Aktif") : "Ditangguhkan"}
					</td>
					<td class="border-b border-border px-3 py-3">{waktu(p.terakhirLoginPada)}</td>
					<td class="border-b border-border px-3 py-3">
						<IkonAksi jenis="ubah" label="Kelola pengguna" hanyaIkon onklik={() => buka(p)} />
					</td>
				</tr>
			{:else}
				<tr><td class="px-3 py-6 text-muted" colspan="6">Tidak ada pengguna yang cocok. Ubah atau hapus filter.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

{#if detail}
	<PanelFokus judul="Kelola pengguna" ontutup={tutup}>
		<div class="space-y-6">
			<div>
				<p class="font-medium">{detail.nama}</p>
				<p class="font-mono text-xs text-muted">{detail.nip}</p>
				<p class="mt-1 text-sm text-muted">{detail.unitNama}</p>
			</div>

			<section>
				<h3 class="text-sm font-semibold">Peran akses</h3>
				<div class="mt-3 space-y-3 text-sm">
					<label class="flex items-center gap-3"><input type="checkbox" bind:checked={formAdmin} /> Administrator</label>
					<label class="flex items-center gap-3"><input type="checkbox" bind:checked={formKepala} /> Kepala Biro</label>
					<label class="flex items-center gap-3"><input type="checkbox" bind:checked={formPengelola} /> Pengelola unit</label>
					{#if formPengelola}
						<fieldset class="border border-border p-3">
							<legend class="px-1 text-xs font-medium uppercase tracking-wide text-muted">Cakupan unit kerja</legend>
							<div class="mt-1 max-h-48 space-y-2 overflow-y-auto">
								{#each unitKerja as unit}
									<label class="flex items-start gap-2">
										<input
											class="mt-0.5"
											type="checkbox"
											checked={formUnitIds.includes(unit.id)}
											onchange={(event) =>
												ubahUnitKelola(unit.id, event.currentTarget.checked)}
										/>
										<span>{unit.nama}<span class="block text-xs text-muted">{unit.indukNama ?? unit.kode}</span></span>
									</label>
								{/each}
							</div>
						</fieldset>
					{/if}
				</div>
				<button class="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" type="button" disabled={sibuk} onclick={simpanPeran}>
					Simpan peran
				</button>
			</section>

			<section class="border-t border-border pt-4">
				<h3 class="text-sm font-semibold">Keamanan akun</h3>
				<p class="mt-1 text-xs text-muted">Atur ulang sandi dan wajibkan pengguna membuat sandi baru saat masuk berikutnya.</p>
				<button class="mt-3 text-sm text-accent" type="button" disabled={sibuk} onclick={resetSandi}>Atur ulang sandi</button>
				{#if sandiSementara}
					<div class="mt-3 border border-warning bg-warning-bg px-3 py-3 text-sm">
						<p class="font-medium">Sandi sementara</p>
						<p class="mt-1 select-all font-mono">{sandiSementara}</p>
						<p class="mt-1 text-xs">Salin sekarang. Sandi ini hanya ditampilkan sekali.</p>
					</div>
				{/if}
			</section>

			<section class="border-t border-border pt-4">
				<h3 class="text-sm font-semibold">{detail.status === "AKTIF" ? "Tangguhkan akses" : "Aktifkan kembali"}</h3>
				{#if detail.status === "AKTIF"}
					<label class="mt-3 block text-sm font-medium" for="alasan-tangguh">Alasan</label>
					<textarea id="alasan-tangguh" class="mt-1 min-h-24 w-full rounded-md border border-border px-3 py-2 text-sm" bind:value={alasan}></textarea>
				{:else}
					<p class="mt-2 text-sm text-muted">{detail.alasanPenangguhan ?? "Tidak ada alasan tersimpan."}</p>
				{/if}
				<button class="mt-3 text-sm text-accent" type="button" disabled={sibuk} onclick={ubahStatus}>
					{detail.status === "AKTIF" ? "Tangguhkan akses" : "Aktifkan kembali"}
				</button>
			</section>
			{#if error}<p class="text-sm text-error">{error}</p>{/if}
		</div>
	</PanelFokus>
{/if}
