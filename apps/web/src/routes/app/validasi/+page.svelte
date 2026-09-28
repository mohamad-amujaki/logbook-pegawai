<script lang="ts">
	import { onMount } from "svelte";
	import { api, ApiError } from "$lib/api";
	import { jamRentang, labelJenis, labelKategori, labelStatus, menitKeJam } from "$lib/format";
	import PanelFokus from "$lib/PanelFokus.svelte";
	import SelectCari, { type OpsiCari } from "$lib/SelectCari.svelte";

	type Tab = "antrian" | "riwayat";
	type Periode = "semua" | "hari" | "bulan" | "rentang";

	type Baris = {
		id: string;
		pegawaiId: string;
		nama: string;
		nip: string;
		jabatan: string;
		tanggal: string;
		waktuMulai: string;
		waktuSelesai: string;
		jenisTugas: string;
		uraian: string;
		menitEfektif: number;
		durasiMenit: number;
		selisihMenit: number;
		status: string;
		isiManual: boolean;
		namaManualProduk: string | null;
		namaManualTahapan: string | null;
		produkNama: string | null;
		tahapanNama: string | null;
		kategori: string;
		buktiUrl: string | null;
		buktiJudul: string | null;
		jumlahOutput: number;
		satuanOutput: string;
		catatanValidasi: string | null;
		divalidasiPada: string | null;
	};

	type Data = { adaBawahan: boolean; baris: Baris[] };

	const opsiPerHalaman = [5, 10, 15, 20] as const;

	let data = $state<Data | null>(null);
	let tab = $state<Tab>("antrian");
	let periode = $state<Periode>("semua");
	let dari = $state("");
	let sampai = $state("");
	let pegawaiId = $state("");
	let perHalaman = $state<(typeof opsiPerHalaman)[number]>(10);
	let halaman = $state(1);
	let terpilih = $state<string[]>([]);
	let konfirmMassal = $state(false);
	let tolakId = $state("");
	let alasanTolak = $state("");
	let pesanTolak = $state("");
	let kotakTolak: HTMLTextAreaElement | undefined = $state();
	let sibuk = $state(false);
	let pesan = $state("");

	const semua = $derived(data?.baris ?? []);
	const stat = $derived.by(() => {
		const menunggu = semua.filter((b) => b.status === "SUBMIT");
		return {
			menunggu: menunggu.length,
			perluDiskusi: menunggu.filter((b) => b.kategori === "PERLU_DISKUSI").length,
			ditinjau: semua.filter((b) => b.status === "TERVERIFIKASI" || b.status === "DITOLAK").length,
		};
	});

	const opsiPegawai = $derived<OpsiCari[]>(
		[...new Map(semua.map((b) => [b.pegawaiId, b])).values()].map((b) => ({
			id: b.pegawaiId,
			label: b.nama,
			sub: b.nip,
			detail: b.jabatan,
		})),
	);

	const tabBaris = $derived.by(() => {
		if (tab === "antrian") {
			return semua
				.filter((b) => b.status === "SUBMIT")
				.slice()
				.sort((a, b) => {
					const diskusi = Number(b.kategori === "PERLU_DISKUSI") - Number(a.kategori === "PERLU_DISKUSI");
					if (diskusi !== 0) return diskusi;
					return a.waktuMulai.localeCompare(b.waktuMulai);
				});
		}
		if (tab === "riwayat") {
			return semua
				.filter((b) => b.status === "TERVERIFIKASI" || b.status === "DITOLAK")
				.slice()
				.sort((a, b) => (b.divalidasiPada ?? b.waktuMulai).localeCompare(a.divalidasiPada ?? a.waktuMulai));
		}
		const _habis: never = tab;
		return _habis;
	});

	const baris = $derived.by(() => {
		const batas = rentangPeriode(periode, dari, sampai);
		return tabBaris.filter((b) => {
			if (pegawaiId && b.pegawaiId !== pegawaiId) return false;
			if (batas && (b.tanggal < batas.dari || b.tanggal > batas.sampai)) return false;
			return true;
		});
	});

	const totalHalaman = $derived(Math.max(1, Math.ceil(baris.length / perHalaman)));
	const tampil = $derived(baris.slice((halaman - 1) * perHalaman, halaman * perHalaman));
	const dariBaris = $derived(baris.length === 0 ? 0 : (halaman - 1) * perHalaman + 1);
	const sampaiBaris = $derived(Math.min(halaman * perHalaman, baris.length));
	const semuaHalamanTerpilih = $derived(
		tab === "antrian" && tampil.length > 0 && tampil.every((b) => terpilih.includes(b.id)),
	);
	const sebagianHalamanTerpilih = $derived(
		tab === "antrian" && tampil.some((b) => terpilih.includes(b.id)) && !semuaHalamanTerpilih,
	);
	const catatanTolak = $derived(semua.find((b) => b.id === tolakId) ?? null);
	const adaFilter = $derived(
		Boolean(pegawaiId) || Boolean(dari) || Boolean(sampai) || periode !== (tab === "riwayat" ? "bulan" : "semua"),
	);

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

	function labelKatalog(b: Baris): string {
		if (b.isiManual) {
			const nama = [b.namaManualProduk, b.namaManualTahapan].filter(Boolean).join(" / ");
			return nama ? `Isi manual — ${nama}` : "Isi manual";
		}
		if (!b.produkNama && !b.tahapanNama) return "—";
		return `${b.produkNama ?? "—"} / ${b.tahapanNama ?? "—"}`;
	}

	function resetAksi() {
		terpilih = [];
		konfirmMassal = false;
		tolakId = "";
		alasanTolak = "";
		pesanTolak = "";
		halaman = 1;
	}

	async function muat() {
		try {
			data = await api<Data>("/validasi");
			if (pegawaiId && !data.baris.some((b) => b.pegawaiId === pegawaiId)) pegawaiId = "";
			terpilih = terpilih.filter((id) => data?.baris.some((b) => b.id === id && b.status === "SUBMIT") ?? false);
			if (terpilih.length === 0) konfirmMassal = false;
		} catch (err) {
			pesan = err instanceof ApiError ? err.message : "Tidak dapat memuat antrian validasi.";
			data ??= { adaBawahan: false, baris: [] };
		}
	}

	function gantiTab(next: Tab) {
		if (next === tab) return;
		tab = next;
		periode = next === "riwayat" ? "bulan" : "semua";
		resetAksi();
		pesan = "";
	}

	function hapusFilter() {
		periode = tab === "riwayat" ? "bulan" : "semua";
		dari = "";
		sampai = "";
		pegawaiId = "";
		resetAksi();
	}

	function gantiPeriode() {
		resetAksi();
	}

	function pilihPegawai(id: string) {
		pegawaiId = id;
		resetAksi();
	}

	function keHalaman(n: number) {
		halaman = Math.min(totalHalaman, Math.max(1, n));
		if (!sibuk) batalTolak();
	}

	function setPerHalaman(n: number) {
		perHalaman = opsiPerHalaman.find((x) => x === n) ?? 10;
		halaman = 1;
	}

	function toggleSatu(id: string, on: boolean) {
		konfirmMassal = false;
		terpilih = on ? [...new Set([...terpilih, id])] : terpilih.filter((x) => x !== id);
	}

	function toggleHalaman(on: boolean) {
		konfirmMassal = false;
		const ids = tampil.map((b) => b.id);
		if (on) terpilih = [...new Set([...terpilih, ...ids])];
		else terpilih = terpilih.filter((id) => !ids.includes(id));
	}

	function mulaiTolak(id: string) {
		pesan = "";
		pesanTolak = "";
		tolakId = id;
		alasanTolak = "";
		konfirmMassal = false;
		queueMicrotask(() => kotakTolak?.focus());
	}

	function batalTolak() {
		if (sibuk) return;
		tolakId = "";
		alasanTolak = "";
		pesanTolak = "";
	}

	async function setujui(id: string) {
		pesan = "";
		sibuk = true;
		try {
			await api("/validasi", { method: "POST", body: JSON.stringify({ catatanId: id, aksi: "setujui" }) });
			await muat();
		} catch (err) {
			pesan = err instanceof ApiError ? err.message : "Tidak dapat menyetujui catatan.";
		} finally {
			sibuk = false;
		}
	}

	async function tolak() {
		if (!catatanTolak) return;
		pesanTolak = "";
		const alasan = alasanTolak.trim();
		if (!alasan) {
			pesanTolak = "Alasan wajib diisi saat menolak.";
			return;
		}
		sibuk = true;
		try {
			await api("/validasi", {
				method: "POST",
				body: JSON.stringify({ catatanId: catatanTolak.id, aksi: "tolak", catatan: alasan }),
			});
			tolakId = "";
			alasanTolak = "";
			pesanTolak = "";
			await muat();
		} catch (err) {
			pesanTolak = err instanceof ApiError ? err.message : "Tidak dapat menolak catatan.";
		} finally {
			sibuk = false;
		}
	}

	function kirimTolakDariPapan(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			void tolak();
		}
	}

	async function setujuiMassal() {
		pesan = "";
		if (terpilih.length === 0) return;
		sibuk = true;
		try {
			await api("/validasi/massal", {
				method: "POST",
				body: JSON.stringify({ catatanIds: terpilih, aksi: "setujui" }),
			});
			konfirmMassal = false;
			terpilih = [];
			await muat();
		} catch (err) {
			pesan = err instanceof ApiError ? err.message : "Tidak dapat menyetujui catatan terpilih.";
		} finally {
			sibuk = false;
		}
	}

	function teksKosong(): string {
		if (!data?.adaBawahan) {
			return "Belum ada pegawai yang memilih Anda sebagai pemberi pertimbangan di SKP tahun ini.";
		}
		if (tab === "antrian" && tabBaris.length === 0) return "Tidak ada catatan menunggu.";
		if (tab === "riwayat" && tabBaris.length === 0) return "Belum ada catatan yang ditinjau.";
		return "Tidak ada catatan yang cocok dengan filter.";
	}

	onMount(muat);
</script>

<h1 class="text-xl font-semibold">Validasi</h1>
<p class="mt-1 text-sm text-muted">Antrian catatan yang menunggu pertimbangan Anda.</p>

{#if data}
	<section class="mt-6 grid grid-cols-3 border border-border-strong">
		<div class="border border-border p-3 sm:p-6">
			<p class="font-mono text-xl font-bold text-brand sm:text-3xl">{stat.menunggu}</p>
			<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Menunggu</p>
		</div>
		<div class="border border-border p-3 sm:p-6">
			<p class="font-mono text-xl font-bold text-accent sm:text-3xl">{stat.perluDiskusi}</p>
			<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Perlu diskusi</p>
		</div>
		<div class="border border-border p-3 sm:p-6">
			<p class="font-mono text-xl font-bold text-accent sm:text-3xl">{stat.ditinjau}</p>
			<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Sudah ditinjau</p>
		</div>
	</section>

	<div class="mt-6 flex flex-wrap items-baseline gap-6 text-sm">
		<button
			class={tab === "antrian" ? "font-medium text-accent" : "text-muted"}
			type="button"
			onclick={() => gantiTab("antrian")}>Menunggu</button
		>
		<button
			class={tab === "riwayat" ? "font-medium text-accent" : "text-muted"}
			type="button"
			onclick={() => gantiTab("riwayat")}>Riwayat</button
		>
	</div>

	<div class="mt-4 flex flex-wrap items-start gap-3 text-sm">
		<select class="min-h-11 rounded-md border border-border px-3 py-2" bind:value={periode} onchange={gantiPeriode}>
			<option value="semua">Semua</option>
			<option value="hari">Harian</option>
			<option value="bulan">Bulanan</option>
			<option value="rentang">Rentang tanggal</option>
		</select>
		{#if periode === "rentang"}
			<input class="rounded-md border border-border px-3 py-2" type="date" bind:value={dari} onchange={gantiPeriode} />
			<input class="rounded-md border border-border px-3 py-2" type="date" bind:value={sampai} onchange={gantiPeriode} />
		{/if}
		<div class="relative z-10 w-full min-w-0 sm:w-80">
			<SelectCari
				placeholder="Cari nama atau NIP…"
				pesanKosong="Tidak ada pegawai yang cocok."
				pesanKetik="Ketik nama atau NIP."
				satuan="pegawai"
				minimalCari={2}
				opsi={opsiPegawai}
				nilai={pegawaiId}
				onubah={pilihPegawai}
			/>
		</div>
		{#if adaFilter}
			<button class="min-h-11 text-accent" type="button" onclick={hapusFilter}>Hapus filter</button>
		{/if}
	</div>

	{#if pesan}
		<p class="mt-4 text-sm text-error" role="alert">{pesan}</p>
	{/if}

	{#if tab === "antrian" && terpilih.length > 0}
		<div class="mt-6 flex flex-wrap items-center justify-between gap-3 border border-border px-3 py-3 text-sm">
			{#if konfirmMassal}
				<p>Setujui {terpilih.length} catatan? Keputusan tercatat per catatan.</p>
				<div class="flex items-center gap-4">
					<button class="text-muted" type="button" disabled={sibuk} onclick={() => (konfirmMassal = false)}
						>Batal</button
					>
					<button
						class="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-60"
						type="button"
						disabled={sibuk}
						onclick={setujuiMassal}>{sibuk ? "Menyetujui…" : "Setujui"}</button
					>
				</div>
			{:else}
				<p>{terpilih.length} catatan dipilih</p>
				<div class="flex items-center gap-4">
					<button class="text-muted" type="button" onclick={() => { terpilih = []; konfirmMassal = false; }}
						>Batal pilih</button
					>
					<button class="text-accent" type="button" onclick={() => (konfirmMassal = true)}>Setujui yang dipilih</button>
				</div>
			{/if}
		</div>
	{/if}

	<div class="tabel-geser mt-6">
		<table class="w-full min-w-[56rem] text-sm">
			<thead>
				<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
					{#if tab === "antrian"}
						<th class="w-10 border-b border-border-strong px-3 py-2">
							<input
								type="checkbox"
								checked={semuaHalamanTerpilih}
								{@attach (el: HTMLInputElement) => {
									el.indeterminate = sebagianHalamanTerpilih;
								}}
								disabled={tampil.length === 0 || sibuk}
								aria-label="Pilih semua di halaman ini"
								onchange={(e) => toggleHalaman(e.currentTarget.checked)}
							/>
						</th>
					{/if}
					<th class="border-b border-border-strong px-3 py-2">Pegawai</th>
					<th class="border-b border-border-strong px-3 py-2">Waktu</th>
					<th class="border-b border-border-strong px-3 py-2">Katalog</th>
					<th class="border-b border-border-strong px-3 py-2">Uraian</th>
					<th class="border-b border-border-strong px-3 py-2">Jam</th>
					<th class="border-b border-border-strong px-3 py-2">Bukti</th>
					{#if tab === "riwayat"}
						<th class="border-b border-border-strong px-3 py-2">Status</th>
					{:else}
						<th class="border-b border-border-strong px-3 py-2">Aksi</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each tampil as b, i (b.id)}
					<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
						{#if tab === "antrian"}
							<td class="border-b border-border px-3 py-3 align-top">
								<input
									type="checkbox"
									checked={terpilih.includes(b.id)}
									disabled={sibuk}
									aria-label="Pilih {b.nama}"
									onchange={(e) => toggleSatu(b.id, e.currentTarget.checked)}
								/>
							</td>
						{/if}
						<td class="border-b border-border px-3 py-3 align-top">
							<div>{b.nama}</div>
							<div class="font-mono text-xs text-muted">{b.nip}</div>
						</td>
						<td class="border-b border-border px-3 py-3 align-top font-mono text-xs">
							<div>{b.tanggal}</div>
							<div class="text-muted">{jamRentang(b.waktuMulai, b.waktuSelesai)}</div>
						</td>
						<td class="border-b border-border px-3 py-3 align-top">
							<div>{labelJenis(b.jenisTugas)}</div>
							<div class="text-xs text-muted">{labelKatalog(b)}</div>
							{#if labelKategori(b.kategori)}
								<div class="text-xs text-accent">{labelKategori(b.kategori)}</div>
							{/if}
						</td>
						<td class="border-b border-border px-3 py-3 align-top">
							<p class="line-clamp-2">{b.uraian}</p>
							<p class="mt-1 text-xs text-muted">{b.jumlahOutput} {b.satuanOutput}</p>
						</td>
						<td class="border-b border-border px-3 py-3 align-top font-mono">
							<div>{menitKeJam(b.menitEfektif)}</div>
							{#if b.selisihMenit > 0}
								<div class="text-xs text-muted">Selisih {menitKeJam(b.selisihMenit)}</div>
							{/if}
						</td>
						<td class="border-b border-border px-3 py-3 align-top">
							{#if b.buktiUrl}
								<a class="text-accent" href={b.buktiUrl} target="_blank" rel="noreferrer">Buka</a>
							{:else}
								<span class="text-muted">—</span>
							{/if}
						</td>
						{#if tab === "riwayat"}
							<td class="border-b border-border px-3 py-3 align-top">
								<div>{labelStatus(b.status)}</div>
								{#if b.status === "DITOLAK" && b.catatanValidasi}
									<p class="mt-1 line-clamp-2 text-xs text-muted">{b.catatanValidasi}</p>
								{/if}
							</td>
						{:else}
							<td class="border-b border-border px-3 py-3 align-top">
								<div class="flex flex-wrap gap-3">
									<button class="text-accent" type="button" disabled={sibuk} onclick={() => setujui(b.id)}
										>Setujui</button
									>
									<button class="text-error" type="button" disabled={sibuk} onclick={() => mulaiTolak(b.id)}
										>Tolak</button
									>
								</div>
							</td>
						{/if}
					</tr>
				{:else}
					<tr>
						<td class="px-3 py-6 text-sm text-muted" colspan={tab === "antrian" ? 8 : 7}>{teksKosong()}</td>
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
{/if}

{#if catatanTolak}
	<PanelFokus judul="Tolak catatan" ontutup={batalTolak}>
		<form
			class="space-y-4"
			onsubmit={(e) => {
				e.preventDefault();
				void tolak();
			}}
		>
			<div>
				<p class="text-sm font-medium">{catatanTolak.nama}</p>
				<p class="mt-1 font-mono text-xs text-muted">
					{catatanTolak.nip} · {catatanTolak.tanggal} · {jamRentang(catatanTolak.waktuMulai, catatanTolak.waktuSelesai)}
				</p>
				<p class="mt-2 line-clamp-2 text-sm text-muted">{catatanTolak.uraian}</p>
			</div>
			<div>
				<label class="text-sm font-medium" for="alasan-tolak">Alasan penolakan</label>
				<textarea
					id="alasan-tolak"
					bind:this={kotakTolak}
					class="mt-1 min-h-20 w-full resize-y rounded-md border border-border px-3 py-2 text-sm"
					class:border-error={!!pesanTolak}
					rows="3"
					placeholder="Jelaskan yang perlu diperbaiki."
					bind:value={alasanTolak}
					disabled={sibuk}
					onkeydown={kirimTolakDariPapan}
				></textarea>
				<p class="mt-1 text-xs text-muted">Alasan dikirim ke pegawai. Ctrl+Enter untuk menolak.</p>
				{#if pesanTolak}
					<p class="mt-1 text-sm text-error" role="alert">{pesanTolak}</p>
				{/if}
			</div>
			<div class="flex flex-wrap items-center justify-end gap-4">
				<button class="text-sm text-accent" type="button" disabled={sibuk} onclick={batalTolak}>Batal</button>
				<button
					class="rounded-md bg-error px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
					type="submit"
					disabled={sibuk || !alasanTolak.trim()}>{sibuk ? "Menolak…" : "Tolak catatan"}</button
				>
			</div>
		</form>
	</PanelFokus>
{/if}
