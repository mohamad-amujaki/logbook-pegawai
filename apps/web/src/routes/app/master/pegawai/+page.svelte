<script lang="ts">
	import { onMount } from "svelte";
	import { ApiError, api, type Me } from "$lib/api";
	import IkonAksi from "$lib/IkonAksi.svelte";
	import PageHeader from "$lib/PageHeader.svelte";
	import PanelFokus from "$lib/PanelFokus.svelte";
	import SelectCari from "$lib/SelectCari.svelte";

	type Pegawai = {
		id: string;
		namaLengkap: string;
		nip: string;
		jabatan: string;
		pangkatGolongan: string;
		tmt: string | null;
		unitKerjaId: string;
		unitNama: string;
		unitKode: string;
		indukId: string | null;
		indukNama: string | null;
		indukKode: string | null;
		timKerjaId: string | null;
		timNama: string | null;
		isAdmin: boolean;
		isKepalaBiro: boolean;
	};
	type Tim = { id: string; kode: string; nama: string; unitKerjaId: string };
	type Unit = {
		id: string;
		kode: string;
		nama: string;
		indukId: string | null;
		indukNama: string | null;
		indukKode: string | null;
		status: string;
	};
	type Panel = { mode: "baru" } | { mode: "ubah"; id: string } | { mode: "hapus"; id: string; nama: string; nip: string };

	const opsiPerHalaman = [5, 10, 15, 20] as const;

	let pegawai = $state<Pegawai[]>([]);
	let tim = $state<Tim[]>([]);
	let units = $state<Unit[]>([]);
	let pilih = $state<string[]>([]);
	let kata = $state("");
	let eselonId = $state("");
	let unitId = $state("");
	let saring = $state("");
	let timId = $state("");
	let perHalaman = $state<(typeof opsiPerHalaman)[number]>(10);
	let halaman = $state(1);
	let pesan = $state("");
	let error = $state("");
	let mengirim = $state(false);
	let panel = $state<Panel | null>(null);
	let formNip = $state("");
	let formNama = $state("");
	let formPangkat = $state("");
	let formTmt = $state("");
	let formJabatan = $state("");
	let formUnitId = $state("");
	let formEselonId = $state("");
	let formTimId = $state("");
	let formAdmin = $state(false);
	let formKepala = $state(false);
	let formResetSandi = $state(false);
	let errorPanel = $state("");
	let errorNip = $state("");
	let simpanPanel = $state(false);
	let sayaId = $state("");

	const kataCari = $derived(kata.trim().toLowerCase());
	const digitCari = $derived(kata.replace(/\D/g, ""));
	const tanpaTim = $derived(
		pegawai.filter((p) => !p.timKerjaId && (!unitId || p.unitKerjaId === unitId)).length,
	);
	const timUnit = $derived(unitId ? tim.filter((t) => t.unitKerjaId === unitId) : tim);
	const tersaring = $derived.by(() => {
		let list = pegawai;
		if (eselonId) list = list.filter((p) => p.indukId === eselonId);
		if (unitId) list = list.filter((p) => p.unitKerjaId === unitId);
		if (saring === "kosong") list = list.filter((p) => !p.timKerjaId);
		else if (saring) list = list.filter((p) => p.timKerjaId === saring);
		if (kataCari) {
			list = list.filter((p) => {
				const nama = p.namaLengkap.toLowerCase();
				const jabatan = p.jabatan.toLowerCase();
				const unit = p.unitNama.toLowerCase();
				const induk = (p.indukNama ?? "").toLowerCase();
				return (
					nama.includes(kataCari) ||
					jabatan.includes(kataCari) ||
					unit.includes(kataCari) ||
					induk.includes(kataCari) ||
					p.unitKode.toLowerCase().includes(kataCari) ||
					(p.indukKode ?? "").toLowerCase().includes(kataCari) ||
					p.nip.includes(digitCari || kataCari)
				);
			});
		}
		return list;
	});
	const totalHalaman = $derived(Math.max(1, Math.ceil(tersaring.length / perHalaman)));
	const tampil = $derived(tersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman));
	const dari = $derived(tersaring.length === 0 ? 0 : (halaman - 1) * perHalaman + 1);
	const sampai = $derived(Math.min(halaman * perHalaman, tersaring.length));
	const labelSaring = $derived.by(() => {
		const potong: string[] = [];
		if (unitId) potong.push(units.find((u) => u.id === unitId)?.nama ?? "unit");
		else if (eselonId) potong.push(units.find((u) => u.id === eselonId)?.nama ?? "Eselon I");
		if (saring === "kosong") potong.push("belum ada tim");
		else if (saring) potong.push(tim.find((t) => t.id === saring)?.nama ?? "tim");
		if (kataCari) potong.push(`“${kata.trim()}”`);
		return potong.join(" · ");
	});
	const idHalaman = $derived(tampil.map((p) => p.id));
	const semuaHalaman = $derived(idHalaman.length > 0 && idHalaman.every((id) => pilih.includes(id)));
	const sebagianHalaman = $derived(idHalaman.some((id) => pilih.includes(id)) && !semuaHalaman);
	const namaPilih = $derived(
		pilih
			.map((id) => pegawai.find((p) => p.id === id)?.namaLengkap)
			.filter((n): n is string => Boolean(n)),
	);
	const unitKerja = $derived(units.filter((u) => u.indukId && u.status !== "nonaktif"));
	const eselon = $derived(units.filter((u) => !u.indukId && u.status !== "nonaktif"));
	const opsiEselon = $derived(
		eselon.map((u) => ({
			id: u.id,
			label: u.nama,
			sub: u.kode,
		})),
	);
	const opsiUnit = $derived(
		unitKerja
			.filter((u) => !eselonId || u.indukId === eselonId)
			.map((u) => ({
			id: u.id,
			label: u.nama,
			sub: u.indukNama ? `${u.indukNama} · ${u.kode}` : u.kode,
			})),
	);
	const opsiUnitForm = $derived(
		unitKerja
			.filter((u) => !formEselonId || u.indukId === formEselonId)
			.map((u) => ({
				id: u.id,
				label: u.nama,
				sub: u.kode,
			})),
	);
	const opsiTimSaring = $derived([
		{ id: "kosong", label: "Belum ada tim", sub: `${tanpaTim} orang` },
		...timUnit.map((t) => ({
			id: t.id,
			label: t.nama,
			sub: t.kode,
		})),
	]);
	const opsiTimTujuan = $derived(
		timUnit.map((t) => ({
			id: t.id,
			label: t.nama,
			sub: t.kode,
		})),
	);
	const timForm = $derived(formUnitId ? tim.filter((t) => t.unitKerjaId === formUnitId) : tim);
	const opsiTimForm = $derived(
		timForm.map((t) => ({
			id: t.id,
			label: t.nama,
			sub: t.kode,
		})),
	);

	async function muat() {
		const me = await api<Me>("/me");
		sayaId = me.user.id;
		const [daftar, daftarTim, daftarUnit] = await Promise.all([
			api<Pegawai[]>("/master/pegawai"),
			api<Tim[]>("/master/tim"),
			api<Unit[]>("/master/unit"),
		]);
		pegawai = daftar;
		tim = daftarTim;
		units = daftarUnit;
	}

	onMount(muat);

	function terpilih(id: string) {
		return pilih.includes(id);
	}

	function loncatKe(id: string) {
		const idx = tersaring.findIndex((p) => p.id === id);
		if (idx >= 0) halaman = Math.floor(idx / perHalaman) + 1;
	}

	function setUnit(id: string) {
		unitId = id;
		if (saring && saring !== "kosong") {
			const t = tim.find((x) => x.id === saring);
			if (t && id && t.unitKerjaId !== id) saring = "";
		}
		if (timId) {
			const t = tim.find((x) => x.id === timId);
			if (t && id && t.unitKerjaId !== id) timId = "";
		}
		halaman = 1;
	}

	function setEselon(id: string) {
		eselonId = id;
		const unit = units.find((u) => u.id === unitId);
		if (unit && id && unit.indukId !== id) {
			unitId = "";
			saring = "";
		}
		halaman = 1;
	}

	function setSaring(nilai: string) {
		saring = nilai;
		halaman = 1;
	}

	function toggle(id: string) {
		pilih = terpilih(id) ? pilih.filter((x) => x !== id) : [...pilih, id];
	}

	function toggleHalaman() {
		if (semuaHalaman) {
			pilih = pilih.filter((id) => !idHalaman.includes(id));
			return;
		}
		pilih = [...new Set([...pilih, ...idHalaman])];
	}

	function keHalaman(n: number) {
		halaman = Math.min(totalHalaman, Math.max(1, n));
	}

	function setPerHalaman(n: number) {
		const opsi = opsiPerHalaman.find((x) => x === n) ?? 10;
		perHalaman = opsi;
		if (pilih.length === 1) {
			loncatKe(pilih[0]);
			return;
		}
		halaman = 1;
	}

	function setFormEselon(id: string) {
		formEselonId = id;
		const u = units.find((x) => x.id === formUnitId);
		if (u && u.indukId !== id) {
			formUnitId = "";
			formTimId = "";
		}
	}

	function setFormUnit(id: string) {
		formUnitId = id;
		const u = units.find((x) => x.id === id);
		if (u?.indukId) formEselonId = u.indukId;
		const t = tim.find((x) => x.id === formTimId);
		if (t && t.unitKerjaId !== id) formTimId = "";
	}

	async function tambahEselon(nama: string) {
		errorPanel = "";
		try {
			const unit = await api<Unit>("/master/unit", {
				method: "POST",
				body: JSON.stringify({ nama }),
			});
			units = [...units, unit].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
			setFormEselon(unit.id);
		} catch (err) {
			errorPanel = err instanceof Error ? err.message : "Tidak dapat menambah Eselon I.";
		}
	}

	async function tambahUnit(nama: string) {
		errorPanel = "";
		if (!formEselonId) {
			errorPanel = "Pilih Eselon I dulu, lalu tambah unit kerja.";
			return;
		}
		try {
			const unit = await api<Unit>("/master/unit", {
				method: "POST",
				body: JSON.stringify({ nama, indukId: formEselonId }),
			});
			units = [...units, unit].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
			setFormUnit(unit.id);
		} catch (err) {
			errorPanel = err instanceof Error ? err.message : "Tidak dapat menambah unit kerja.";
		}
	}

	async function pindah(e: Event) {
		e.preventDefault();
		error = "";
		pesan = "";
		if (pilih.length === 0) {
			error = "Centang pegawai yang akan dipindah.";
			return;
		}
		if (!timId) {
			error = "Pilih tim tujuan.";
			return;
		}
		mengirim = true;
		try {
			await api("/master/anggota-tim", {
				method: "POST",
				body: JSON.stringify({ pegawaiIds: pilih, timKerjaId: timId }),
			});
			const tujuan = tim.find((t) => t.id === timId);
			const namaTim = tujuan?.nama ?? "tim";
			pesan =
				pilih.length === 1
					? `${namaPilih[0] ?? "Pegawai"} dipindah ke ${namaTim}.`
					: `${pilih.length} pegawai dipindah ke ${namaTim}.`;
			pilih = [];
			await muat();
		} catch (err) {
			error = err instanceof Error ? err.message : "Gagal memindahkan anggota tim.";
		} finally {
			mengirim = false;
		}
	}

	function kosongkanForm() {
		formNip = "";
		formNama = "";
		formPangkat = "";
		formTmt = "";
		formJabatan = "";
		formUnitId = "";
		formEselonId = "";
		formTimId = "";
		formAdmin = false;
		formKepala = false;
		formResetSandi = false;
		errorPanel = "";
		errorNip = "";
	}

	function bukaBaru() {
		kosongkanForm();
		const awal = unitId && unitKerja.some((u) => u.id === unitId) ? unitId : (unitKerja[0]?.id ?? "");
		formUnitId = awal;
		formEselonId = unitKerja.find((u) => u.id === awal)?.indukId ?? eselon[0]?.id ?? "";
		panel = { mode: "baru" };
	}

	function bukaHapus(p: Pegawai) {
		errorPanel = "";
		panel = { mode: "hapus", id: p.id, nama: p.namaLengkap, nip: p.nip };
	}

	function bukaUbah(p: Pegawai) {
		formNip = p.nip;
		formNama = p.namaLengkap;
		formPangkat = p.pangkatGolongan;
		formTmt = p.tmt ?? "";
		formJabatan = p.jabatan;
		formUnitId = p.unitKerjaId;
		formEselonId = p.indukId ?? units.find((u) => u.id === p.unitKerjaId)?.indukId ?? "";
		formTimId = p.timKerjaId ?? "";
		formAdmin = p.isAdmin;
		formKepala = p.isKepalaBiro;
		formResetSandi = false;
		errorPanel = "";
		errorNip = "";
		panel = { mode: "ubah", id: p.id };
	}

	function tutupPanel() {
		panel = null;
		kosongkanForm();
	}

	async function hapusPanel() {
		if (panel?.mode !== "hapus") return;
		errorPanel = "";
		pesan = "";
		simpanPanel = true;
		const nama = panel.nama;
		const id = panel.id;
		try {
			await api(`/master/pegawai/${id}`, { method: "DELETE" });
			pilih = pilih.filter((x) => x !== id);
			if (tampil.length === 1 && halaman > 1) halaman -= 1;
			tutupPanel();
			pesan = `${nama} dinonaktifkan dan tidak lagi dapat masuk. Riwayat tetap tersimpan.`;
			await muat();
		} catch (err) {
			errorPanel = err instanceof Error ? err.message : "Tidak dapat menghapus pegawai.";
		} finally {
			simpanPanel = false;
		}
	}

	async function kirimPanel(e: Event) {
		e.preventDefault();
		if (!panel || panel.mode === "hapus") return;
		errorPanel = "";
		errorNip = "";
		pesan = "";
		if (!/^\d{18}$/.test(formNip.trim())) {
			errorNip = "NIP harus 18 digit angka.";
			return;
		}
		if (formNama.trim().length < 3) {
			errorPanel = "Nama lengkap minimal 3 karakter.";
			return;
		}
		if (formPangkat.trim().length < 2) {
			errorPanel = "Pangkat/golongan wajib diisi.";
			return;
		}
		if (formTmt.trim() && !/^\d{2}-\d{2}-\d{4}$/.test(formTmt.trim())) {
			errorPanel = "TMT pakai format 01-04-2025.";
			return;
		}
		if (formJabatan.trim().length < 3) {
			errorPanel = "Jabatan minimal 3 karakter.";
			return;
		}
		if (!formUnitId) {
			errorPanel = "Unit kerja wajib dipilih.";
			return;
		}
		simpanPanel = true;
		const isi = {
			nip: formNip.trim(),
			namaLengkap: formNama.trim(),
			pangkatGolongan: formPangkat.trim(),
			tmt: formTmt.trim(),
			jabatan: formJabatan.trim(),
			unitKerjaId: formUnitId,
			timKerjaId: formTimId || null,
			isAdmin: formAdmin,
			isKepalaBiro: formKepala,
		};
		try {
			if (panel.mode === "baru") {
				const hasil = await api<{ id: string }>("/master/pegawai", {
					method: "POST",
					body: JSON.stringify(isi),
				});
				pesan = `${formNama.trim()} ditambahkan. Sandi awal = NIP, wajib diganti saat masuk pertama.`;
				tutupPanel();
				await muat();
				loncatKe(hasil.id);
			} else if (panel.mode === "ubah") {
				const id = panel.id;
				await api(`/master/pegawai/${id}`, {
					method: "PUT",
					body: JSON.stringify({ ...isi, resetSandi: formResetSandi }),
				});
				pesan = formResetSandi
					? `${formNama.trim()} disimpan. Sandi direset ke NIP.`
					: `${formNama.trim()} disimpan.`;
				tutupPanel();
				await muat();
				loncatKe(id);
			} else {
				const tidakAda: never = panel;
				void tidakAda;
			}
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.field === "nip") errorNip = err.message;
				else errorPanel = err.message;
			} else {
				errorPanel = "Tidak dapat menyimpan. Periksa isian, lalu coba lagi.";
			}
		} finally {
			simpanPanel = false;
		}
	}
</script>

<PageHeader
	judul="Pegawai"
	deskripsi="Kelola pegawai aktif, penempatan dalam struktur organisasi, tim kerja, dan peran akses."
>
	{#snippet anak()}<IkonAksi jenis="tambah" label="Pegawai baru" onklik={bukaBaru} />{/snippet}
</PageHeader>

<div class="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
	<p><strong>{pegawai.length}</strong> pegawai aktif</p>
	<p><strong>{pegawai.filter((p) => p.isAdmin).length}</strong> admin</p>
	<p><strong>{pegawai.filter((p) => p.isKepalaBiro).length}</strong> kepala biro</p>
	<p><strong>{tanpaTim}</strong> belum ditempatkan dalam tim</p>
</div>

<div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
	<div>
		<label class="text-sm font-medium" for="pg-cari">Cari</label>
		<input
			id="pg-cari"
			class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
			placeholder="Nama, NIP, jabatan, atau unit"
			bind:value={kata}
			oninput={() => (halaman = 1)}
		/>
	</div>
	<SelectCari
		label="Eselon I"
		placeholder="Semua Eselon I"
		pesanKosong="Tidak ada Eselon I yang cocok."
		satuan="Eselon I"
		opsi={opsiEselon}
		nilai={eselonId}
		onubah={setEselon}
	/>
	<SelectCari
		label="Unit kerja"
		placeholder="Semua unit"
		pesanKosong="Tidak ada unit yang cocok."
		satuan="unit"
		opsi={opsiUnit}
		nilai={unitId}
		onubah={setUnit}
	/>
	<SelectCari
		label="Tim"
		placeholder="Semua tim"
		pesanKosong="Tidak ada tim yang cocok."
		satuan="tim"
		opsi={opsiTimSaring}
		nilai={saring}
		onubah={setSaring}
	/>
</div>

<div class="tabel-geser mt-6">
<table class="w-full min-w-[48rem] text-sm">
	<thead>
		<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
			<th class="w-10 border-b border-border-strong px-3 py-2">
				<input
					type="checkbox"
					checked={semuaHalaman}
					indeterminate={sebagianHalaman}
					aria-label="Pilih semua di halaman ini"
					onchange={toggleHalaman}
				/>
			</th>
			<th class="border-b border-border-strong px-3 py-2">Nama</th>
			<th class="border-b border-border-strong px-3 py-2">Jabatan</th>
			<th class="border-b border-border-strong px-3 py-2">Unit kerja</th>
			<th class="border-b border-border-strong px-3 py-2">Tim</th>
			<th class="border-b border-border-strong px-3 py-2">Status / peran</th>
			<th class="border-b border-border-strong px-3 py-2">Aksi</th>
		</tr>
	</thead>
	<tbody>
		{#each tampil as p, i}
			<tr
				class={terpilih(p.id) ? "bg-accent-muted" : i % 2 === 1 ? "bg-surface-alt" : ""}
				onclick={() => toggle(p.id)}
			>
				<td class="border-b border-border px-3 py-3">
					<input
						type="checkbox"
						checked={terpilih(p.id)}
						aria-label="Pilih {p.namaLengkap}"
						onclick={(e) => e.stopPropagation()}
						onchange={() => toggle(p.id)}
					/>
				</td>
				<td class="border-b border-border px-3 py-3">
					<p>{p.namaLengkap}</p>
					<p class="font-mono text-xs text-muted">{p.nip}</p>
				</td>
				<td class="border-b border-border px-3 py-3">{p.jabatan}</td>
				<td class="border-b border-border px-3 py-3">
					<p>{p.unitNama}</p>
					<p class="text-xs text-muted">{p.indukNama ?? p.unitKode}</p>
				</td>
				<td class="border-b border-border px-3 py-3">{p.timNama ?? "Belum ada tim"}</td>
				<td class="border-b border-border px-3 py-3">
					<p>Aktif</p>
					<p class="text-xs text-muted">
						{[p.isAdmin ? "Admin" : "", p.isKepalaBiro ? "Kepala Biro" : ""].filter(Boolean).join(" · ") || "Pegawai"}
					</p>
				</td>
				<!-- biome-ignore lint/a11y/useKeyWithClickEvents: menahan klik baris agar aksi tombol tidak ikut memilih baris -->
				<td class="border-b border-border px-3 py-3" onclick={(e) => e.stopPropagation()}>
					<div class="flex items-center gap-3">
						<IkonAksi jenis="ubah" label="Ubah" hanyaIkon onklik={() => bukaUbah(p)} />
						{#if p.id !== sayaId}
							<IkonAksi jenis="hapus" label="Hapus" bahaya hanyaIkon onklik={() => bukaHapus(p)} />
						{/if}
					</div>
				</td>
			</tr>
		{:else}
			<tr>
				<td class="px-3 py-6 text-sm text-muted" colspan="7">
					{#if kataCari || eselonId || unitId || saring}
						Tidak ada pegawai yang cocok dengan filter ini.
					{:else}
						Belum ada data pegawai.
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
</div>

{#if pilih.length > 0}
	<form class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-6 space-y-3 border border-border-strong bg-surface p-4 text-sm shadow-sm lg:bottom-3" onsubmit={pindah}>
		<p class="text-sm">
			{pilih.length} dipilih
			{#if pilih.length <= 3}
				<span class="text-muted">({namaPilih.join(", ")})</span>
			{/if}
		</p>
		<div class="flex max-w-4xl flex-wrap items-end gap-3">
			<div class="w-full min-w-0 flex-1 sm:min-w-64">
				<SelectCari
					label="Tim tujuan"
					placeholder="Ketik nama atau kode tim…"
					pesanKosong="Tidak ada tim yang cocok."
					satuan="tim"
					opsi={opsiTimTujuan}
					nilai={timId}
					error={error && !timId ? error : ""}
					onubah={(id) => (timId = id)}
				/>
			</div>
			<button class="rounded-md bg-accent px-4 py-2 font-medium text-white" type="submit" disabled={mengirim}>
				Pindahkan
			</button>
			<button class="mb-1 text-accent" type="button" onclick={() => (pilih = [])}>Hapus pilihan</button>
		</div>
	</form>
{/if}
{#if error}<p class="mt-2 text-sm text-error">{error}</p>{/if}
{#if pesan}<p class="mt-2 text-sm text-success">{pesan}</p>{/if}

<div
	class="mt-6 flex flex-wrap items-center justify-between gap-4"
	class:border-t={pilih.length === 0}
	class:border-border={pilih.length === 0}
	class:pt-4={pilih.length === 0}
>
	<div class="flex flex-wrap items-baseline gap-x-6 gap-y-2">
		<p class="text-sm tabular-nums">
			{dari}–{sampai} dari {tersaring.length}{#if labelSaring}
				<span class="text-muted"> · {labelSaring}</span>{/if}
		</p>
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
	<PanelFokus
		judul={panel.mode === "baru" ? "Pegawai baru" : panel.mode === "ubah" ? "Ubah pegawai" : "Nonaktifkan pegawai"}
		ontutup={tutupPanel}
	>
		{#if panel.mode === "hapus"}
			<p class="text-sm">
				Nonaktifkan {panel.nama}
				<span class="font-mono text-xs text-muted">({panel.nip})</span>?
			</p>
			<p class="mt-3 text-sm text-muted">
				Pegawai tidak lagi dapat masuk atau dipilih untuk pekerjaan baru. Catatan harian dan SKP yang sudah ada tetap
				tersimpan sebagai riwayat.
			</p>
			{#if errorPanel}<p class="mt-3 text-sm text-error">{errorPanel}</p>{/if}
			<div class="mt-4 flex flex-wrap items-center gap-4">
				<button
					class="rounded-md bg-error px-4 py-2 text-sm font-medium text-white"
					type="button"
					disabled={simpanPanel}
					onclick={hapusPanel}>Ya, nonaktifkan</button
				>
				<button class="text-sm text-accent" type="button" onclick={tutupPanel}>Batal</button>
			</div>
		{:else}
			<form class="space-y-4" onsubmit={kirimPanel}>
				<div>
					<label class="text-sm font-medium" for="pg-nip">NIP</label>
					<input
						id="pg-nip"
						class="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
						class:border-error={errorNip}
						class:border-border={!errorNip}
						inputmode="numeric"
						maxlength="18"
						autocomplete="off"
						bind:value={formNip}
					/>
					{#if errorNip}<p class="mt-1 text-sm text-error">{errorNip}</p>{/if}
				</div>
				<div>
					<label class="text-sm font-medium" for="pg-nama">Nama lengkap</label>
					<input
						id="pg-nama"
						class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
						bind:value={formNama}
					/>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label class="text-sm font-medium" for="pg-pangkat">Pangkat / golongan</label>
						<input
							id="pg-pangkat"
							class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
							placeholder="IV/c"
							bind:value={formPangkat}
						/>
					</div>
					<div>
						<label class="text-sm font-medium" for="pg-tmt">TMT</label>
						<input
							id="pg-tmt"
							class="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
							placeholder="01-04-2025"
							bind:value={formTmt}
						/>
					</div>
				</div>
				<div>
					<label class="text-sm font-medium" for="pg-jabatan">Jabatan</label>
					<input
						id="pg-jabatan"
						class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
						bind:value={formJabatan}
					/>
				</div>
				<SelectCari
					label="Eselon I"
					placeholder="Ketik nama Eselon I…"
					pesanKosong="Tidak ada yang cocok. Ketik nama resmi, minimal 3 huruf, lalu pilih Tambah."
					satuan="Eselon I"
					opsi={opsiEselon}
					nilai={formEselonId}
					bolehKosong={false}
					bolehTambah
					onubah={setFormEselon}
					ontambah={tambahEselon}
				/>
				<SelectCari
					label="Unit kerja"
					placeholder="Ketik nama atau kode unit…"
					pesanKosong={formEselonId
						? "Tidak ada yang cocok. Ketik nama resmi, minimal 3 huruf, lalu pilih Tambah."
						: "Pilih Eselon I dulu."}
					satuan="unit"
					opsi={opsiUnitForm}
					nilai={formUnitId}
					bolehKosong={false}
					bolehTambah={Boolean(formEselonId)}
					onubah={setFormUnit}
					ontambah={tambahUnit}
				/>
				<p class="text-xs text-muted">
					Contoh: Sekretariat Jenderal — Biro Organisasi dan SDM. Unit baru masuk ke Eselon I yang dipilih.
				</p>
				<SelectCari
					label="Tim kerja"
					placeholder="Ketik nama atau kode tim — boleh dikosongkan"
					pesanKosong={formUnitId
						? "Tidak ada tim di unit ini. Kosongkan, atau pilih unit lain."
						: "Pilih unit kerja dulu."}
					satuan="tim"
					opsi={opsiTimForm}
					nilai={formTimId}
					onubah={(id) => (formTimId = id)}
				/>
				<div class="flex flex-wrap items-baseline gap-4 text-sm">
					<span class="text-muted">Peran</span>
					<button
						class:font-medium={formAdmin}
						class:text-accent={formAdmin}
						class:text-muted={!formAdmin}
						type="button"
						onclick={() => (formAdmin = !formAdmin)}>Admin</button
					>
					<button
						class:font-medium={formKepala}
						class:text-accent={formKepala}
						class:text-muted={!formKepala}
						type="button"
						onclick={() => (formKepala = !formKepala)}>Kepala Biro</button
					>
				</div>
				{#if panel.mode === "baru"}
					<p class="text-xs text-muted">Sandi awal = NIP. Pegawai wajib menggantinya saat masuk pertama.</p>
				{:else}
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={formResetSandi} />
						Reset sandi ke NIP
					</label>
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
