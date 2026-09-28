<script lang="ts">
	import { onMount } from "svelte";
	import { ApiError, api } from "$lib/api";
	import IkonAksi from "$lib/IkonAksi.svelte";
	import PanelFokus from "$lib/PanelFokus.svelte";
	import SelectCari from "$lib/SelectCari.svelte";

	type Unit = {
		id: string;
		kode: string;
		nama: string;
		indukId: string | null;
		indukNama: string | null;
		indukKode: string | null;
		status: string;
		jumlahPegawai: number;
		jumlahTim: number;
		jumlahAnak: number;
	};
	type Panel =
		| { mode: "baru"; jenis: "eselon" | "unit" }
		| { mode: "ubah"; id: string }
		| { mode: "hapus"; id: string; nama: string; jenis: "eselon" | "unit" };

	let units = $state<Unit[]>([]);
	let kata = $state("");
	let eselonId = $state("");
	let pesan = $state("");
	let panel = $state<Panel | null>(null);
	let formNama = $state("");
	let formKode = $state("");
	let formIndukId = $state("");
	let formStatus = $state<"aktif" | "nonaktif">("aktif");
	let errorPanel = $state("");
	let simpanPanel = $state(false);

	const eselon = $derived(units.filter((u) => !u.indukId));
	const kerja = $derived(units.filter((u) => u.indukId));
	const opsiEselon = $derived(
		eselon.map((u) => ({
			id: u.id,
			label: u.nama,
			sub: u.kode,
			detail: `${u.jumlahAnak} unit kerja`,
		})),
	);
	const grup = $derived.by(() => {
		const q = kata.trim().toLowerCase();
		const induk = eselonId ? eselon.filter((e) => e.id === eselonId) : eselon;
		return induk
			.map((e) => {
				const semuaAnak = kerja.filter((u) => u.indukId === e.id);
				const indukCocok =
					!q || e.nama.toLowerCase().includes(q) || e.kode.toLowerCase().includes(q);
				const anak = q && !indukCocok
					? semuaAnak.filter((u) => u.nama.toLowerCase().includes(q) || u.kode.toLowerCase().includes(q))
					: semuaAnak;
				return { eselon: e, anak };
			})
			.filter((g) => {
				if (!q) return true;
				const indukCocok =
					g.eselon.nama.toLowerCase().includes(q) || g.eselon.kode.toLowerCase().includes(q);
				return indukCocok || g.anak.length > 0;
			});
	});

	async function muat() {
		units = await api<Unit[]>("/master/unit");
	}
	onMount(muat);

	function kosongkanForm() {
		formNama = "";
		formKode = "";
		formIndukId = eselonId || eselon[0]?.id || "";
		formStatus = "aktif";
		errorPanel = "";
	}

	function bukaBaru(jenis: "eselon" | "unit") {
		kosongkanForm();
		panel = { mode: "baru", jenis };
	}

	function bukaUbah(u: Unit) {
		formNama = u.nama;
		formKode = u.kode;
		formIndukId = u.indukId ?? "";
		formStatus = u.status === "nonaktif" ? "nonaktif" : "aktif";
		errorPanel = "";
		panel = { mode: "ubah", id: u.id };
	}

	function bukaHapus(u: Unit) {
		errorPanel = "";
		panel = {
			mode: "hapus",
			id: u.id,
			nama: u.nama,
			jenis: u.indukId ? "unit" : "eselon",
		};
	}

	function tutupPanel() {
		panel = null;
		kosongkanForm();
	}

	function judulPanel(p: Panel) {
		switch (p.mode) {
			case "baru":
				return p.jenis === "eselon" ? "Eselon I baru" : "Unit kerja baru";
			case "ubah": {
				const u = units.find((x) => x.id === p.id);
				return u?.indukId ? "Ubah unit kerja" : "Ubah Eselon I";
			}
			case "hapus":
				return p.jenis === "eselon" ? "Hapus Eselon I" : "Hapus unit kerja";
			default: {
				const tidakAda: never = p;
				return tidakAda;
			}
		}
	}

	async function tambahEselon(nama: string) {
		errorPanel = "";
		try {
			const unit = await api<Unit>("/master/unit", {
				method: "POST",
				body: JSON.stringify({ nama }),
			});
			await muat();
			formIndukId = unit.id;
		} catch (err) {
			errorPanel = err instanceof Error ? err.message : "Tidak dapat menambah Eselon I.";
		}
	}

	async function kirimPanel(e: Event) {
		e.preventDefault();
		if (!panel || panel.mode === "hapus") return;
		errorPanel = "";
		pesan = "";
		if (formNama.trim().length < 3) {
			errorPanel = "Nama minimal 3 karakter.";
			return;
		}
		const sedangUbah = panel.mode === "ubah" ? units.find((u) => u.id === panel.id) : null;
		const jadiUnit = panel.mode === "baru" ? panel.jenis === "unit" : Boolean(sedangUbah?.indukId);
		if (jadiUnit && !formIndukId) {
			errorPanel = "Eselon I wajib dipilih.";
			return;
		}
		simpanPanel = true;
		const isi = {
			nama: formNama.trim(),
			kode: formKode.trim() || undefined,
			indukId: jadiUnit ? formIndukId : null,
			status: formStatus,
		};
		try {
			if (panel.mode === "baru") {
				await api("/master/unit", { method: "POST", body: JSON.stringify(isi) });
				pesan = jadiUnit
					? `Unit kerja “${formNama.trim()}” ditambahkan.`
					: `Eselon I “${formNama.trim()}” ditambahkan.`;
				tutupPanel();
				await muat();
			} else if (panel.mode === "ubah") {
				await api(`/master/unit/${panel.id}`, {
					method: "PUT",
					body: JSON.stringify(isi),
				});
				pesan = `“${formNama.trim()}” disimpan.`;
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
			await api(`/master/unit/${panel.id}`, { method: "DELETE" });
			tutupPanel();
			pesan = `${nama} dihapus.`;
			await muat();
		} catch (err) {
			errorPanel = err instanceof Error ? err.message : "Tidak dapat menghapus unit.";
		} finally {
			simpanPanel = false;
		}
	}

	function isiTeks(u: Unit) {
		if (!u.indukId) {
			return u.jumlahAnak === 0 ? "Belum ada unit" : `${u.jumlahAnak} unit kerja`;
		}
		const bagian: string[] = [];
		if (u.jumlahPegawai) bagian.push(`${u.jumlahPegawai} pegawai`);
		if (u.jumlahTim) bagian.push(`${u.jumlahTim} tim`);
		if (bagian.length === 0) return "Kosong";
		return bagian.join(" · ");
	}

	function bolehHapus(u: Unit) {
		if (!u.indukId) return u.jumlahAnak === 0;
		return u.jumlahPegawai === 0 && u.jumlahTim === 0;
	}
</script>

<div class="flex flex-wrap items-baseline justify-between gap-4">
	<div>
		<h2 class="text-lg font-semibold">Unit kerja</h2>
		<p class="mt-1 text-sm text-muted">
			Dua tingkat: Eselon I, lalu unit kerja. Pegawai dan tim hanya menempel di unit kerja.
		</p>
	</div>
	<div class="flex flex-wrap items-center gap-4">
		<button class="text-sm text-accent" type="button" onclick={() => bukaBaru("eselon")}>Eselon I baru</button>
		<IkonAksi jenis="tambah" label="Unit kerja baru" onklik={() => bukaBaru("unit")} />
	</div>
</div>

<div class="mt-6 grid gap-4 md:grid-cols-2">
	<div>
		<label class="text-sm font-medium" for="uk-cari">Cari</label>
		<input
			id="uk-cari"
			class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
			placeholder="Nama atau kode"
			bind:value={kata}
		/>
	</div>
	<SelectCari
		label="Eselon I"
		placeholder="Semua Eselon I"
		pesanKosong="Tidak ada Eselon I yang cocok."
		satuan="Eselon I"
		opsi={opsiEselon}
		nilai={eselonId}
		onubah={(id) => (eselonId = id)}
	/>
</div>

{#if pesan}<p class="mt-4 text-sm text-success">{pesan}</p>{/if}

<div class="tabel-geser mt-6">
<table class="w-full min-w-[36rem] text-sm">
	<thead>
		<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
			<th class="border-b border-border-strong px-3 py-2">Unit</th>
			<th class="border-b border-border-strong px-3 py-2">Kode</th>
			<th class="border-b border-border-strong px-3 py-2">Isi</th>
			<th class="border-b border-border-strong px-3 py-2"></th>
		</tr>
	</thead>
	<tbody>
		{#each grup as g, i}
			<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
				<td class="border-b border-border px-3 py-3 font-medium">{g.eselon.nama}</td>
				<td class="border-b border-border px-3 py-3 font-mono text-xs">{g.eselon.kode}</td>
				<td class="border-b border-border px-3 py-3 text-muted">
					{isiTeks(g.eselon)}
					{#if g.eselon.status === "nonaktif"}
						<span> · Nonaktif</span>
					{/if}
				</td>
				<td class="border-b border-border px-3 py-3">
					<div class="flex items-center gap-3">
						<IkonAksi jenis="ubah" label="Ubah" hanyaIkon onklik={() => bukaUbah(g.eselon)} />
						{#if bolehHapus(g.eselon)}
							<IkonAksi jenis="hapus" label="Hapus" bahaya hanyaIkon onklik={() => bukaHapus(g.eselon)} />
						{/if}
					</div>
				</td>
			</tr>
			{#each g.anak as u}
				<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
					<td class="border-b border-border py-3 pr-3 pl-10">{u.nama}</td>
					<td class="border-b border-border px-3 py-3 font-mono text-xs">{u.kode}</td>
					<td class="border-b border-border px-3 py-3 text-muted">
						{isiTeks(u)}
						{#if u.status === "nonaktif"}
							<span> · Nonaktif</span>
						{/if}
					</td>
					<td class="border-b border-border px-3 py-3">
						<div class="flex items-center gap-3">
							<IkonAksi jenis="ubah" label="Ubah" hanyaIkon onklik={() => bukaUbah(u)} />
							{#if bolehHapus(u)}
								<IkonAksi jenis="hapus" label="Hapus" bahaya hanyaIkon onklik={() => bukaHapus(u)} />
							{/if}
						</div>
					</td>
				</tr>
			{/each}
		{:else}
			<tr>
				<td class="px-3 py-6 text-sm text-muted" colspan="4">
					{#if kata || eselonId}
						Tidak ada unit yang cocok dengan filter ini.
					{:else}
						Belum ada Eselon I. Tambah Eselon I, lalu unit kerja di bawahnya.
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
</div>

{#if panel}
	<PanelFokus judul={judulPanel(panel)} ontutup={tutupPanel}>
		{#if panel.mode === "hapus"}
			<p class="text-sm">Hapus {panel.nama}?</p>
			<p class="mt-3 text-sm text-muted">
				{#if panel.jenis === "eselon"}
					Hanya Eselon I kosong yang dapat dihapus.
				{:else}
					Hanya unit tanpa pegawai dan tim yang dapat dihapus. Yang masih terpakai dinonaktifkan lewat Ubah.
				{/if}
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
			{@const sedang = panel.mode === "ubah" ? units.find((u) => u.id === panel.id) : null}
			{@const formUnit = panel.mode === "baru" ? panel.jenis === "unit" : Boolean(sedang?.indukId)}
			<form class="space-y-4" onsubmit={kirimPanel}>
				{#if formUnit}
					<SelectCari
						label="Eselon I"
						placeholder="Ketik nama Eselon I…"
						pesanKosong="Tidak ada yang cocok. Ketik nama resmi, minimal 3 huruf, lalu pilih Tambah."
						satuan="Eselon I"
						opsi={opsiEselon}
						nilai={formIndukId}
						bolehKosong={false}
						bolehTambah
						onubah={(id) => (formIndukId = id)}
						ontambah={tambahEselon}
					/>
					<p class="text-xs text-muted">
						Contoh: Sekretariat Jenderal. Jika belum ada, ketik nama resmi lalu pilih Tambah.
					</p>
				{/if}
				<div>
					<label class="text-sm font-medium" for="uk-nama">{formUnit ? "Nama unit kerja" : "Nama Eselon I"}</label>
					<input
						id="uk-nama"
						class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
						placeholder={formUnit ? "Biro Organisasi dan Sumber Daya Manusia" : "Sekretariat Jenderal"}
						bind:value={formNama}
					/>
				</div>
				<div>
					<label class="text-sm font-medium" for="uk-kode">Kode</label>
					<input
						id="uk-kode"
						class="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
						placeholder={formUnit ? "OSDM" : "SETJEN"}
						bind:value={formKode}
					/>
					<p class="mt-1 text-xs text-muted">Kosongkan untuk diisi otomatis dari nama.</p>
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
