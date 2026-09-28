<script lang="ts">
	import { onMount } from "svelte";
	import { api, ApiError } from "$lib/api";
	import { labelJenis, labelStatus, menitKeJam } from "$lib/format";
	import NavigasiCatatan from "$lib/NavigasiCatatan.svelte";
	import PanelFokus from "$lib/PanelFokus.svelte";

	type Tampilan = "bulan" | "minggu" | "hari";
	type Baris = {
		catatan: {
			id: string;
			tanggal: string;
			waktuMulai: string;
			waktuSelesai: string;
			uraian: string;
			status: string;
			jenisTugas: string;
			menitEfektif: number;
			jumlahOutput: number;
			satuanOutput: string;
			kategori: string;
			catatanValidasi: string | null;
			buktiUrl: string | null;
		};
		produkNama: string | null;
		tahapanNama: string | null;
		aktivitasNama: string | null;
	};

	const JAM_AWAL = 0;
	const JAM_AKHIR = 24;
	const TINGGI_JAM = 64;
	const SLOT_MENIT = 30;
	const SLOT = Array.from(
		{ length: ((JAM_AKHIR - JAM_AWAL) * 60) / SLOT_MENIT },
		(_, i) => JAM_AWAL * 60 + i * SLOT_MENIT,
	);
	const JAM = Array.from({ length: JAM_AKHIR - JAM_AWAL + 1 }, (_, i) => JAM_AWAL + i);
	const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
	const PILIHAN_TAMPILAN: { id: Tampilan; label: string }[] = [
		{ id: "bulan", label: "Bulan" },
		{ id: "minggu", label: "Minggu" },
		{ id: "hari", label: "Hari" },
	];

	let baris = $state<Baris[]>([]);
	let tampilan = $state<Tampilan>("minggu");
	let acuan = $state(tanggalIso(new Date()));
	let detailId = $state("");
	let memuat = $state(true);
	let sibuk = $state(false);
	let pesan = $state("");
	let sekarang = $state(new Date());
	let wadahWaktu: HTMLDivElement | undefined = $state();

	const tanggalAcuan = $derived(dariTanggalIso(acuan));
	const hariTampilan = $derived.by(() => {
		switch (tampilan) {
			case "hari":
				return [tanggalAcuan];
			case "minggu":
				return hariDalamMinggu(tanggalAcuan);
			case "bulan":
				return hariDalamKalenderBulan(tanggalAcuan);
			default: {
				const _habis: never = tampilan;
				return _habis;
			}
		}
	});
	const labelPeriode = $derived(labelRentang(tampilan, tanggalAcuan));
	const detail = $derived(baris.find((b) => b.catatan.id === detailId) ?? null);
	const agendaBulan = $derived(
		hariTampilan
			.filter((d) => d.getMonth() === tanggalAcuan.getMonth())
			.map((tanggal) => ({ tanggal, baris: catatanTanggal(tanggal) }))
			.filter((x) => x.baris.length > 0),
	);

	$effect(() => {
		if (tampilan === "bulan" || memuat) return;
		acuan;
		baris;
		requestAnimationFrame(() => gulirKeWaktuAwal());
	});

	function tanggalIso(d: Date): string {
		const tahun = d.getFullYear();
		const bulan = String(d.getMonth() + 1).padStart(2, "0");
		const hari = String(d.getDate()).padStart(2, "0");
		return `${tahun}-${bulan}-${hari}`;
	}

	function dariTanggalIso(nilai: string): Date {
		const [tahun, bulan, hari] = nilai.split("-").map(Number);
		return new Date(tahun ?? 0, (bulan ?? 1) - 1, hari ?? 1);
	}

	function tambahHari(d: Date, jumlah: number): Date {
		const hasil = new Date(d);
		hasil.setDate(hasil.getDate() + jumlah);
		return hasil;
	}

	function awalMinggu(d: Date): Date {
		const hasil = new Date(d.getFullYear(), d.getMonth(), d.getDate());
		const selisih = (hasil.getDay() + 6) % 7;
		hasil.setDate(hasil.getDate() - selisih);
		return hasil;
	}

	function hariDalamMinggu(d: Date): Date[] {
		const awal = awalMinggu(d);
		return Array.from({ length: 7 }, (_, i) => tambahHari(awal, i));
	}

	function hariDalamKalenderBulan(d: Date): Date[] {
		const awal = awalMinggu(new Date(d.getFullYear(), d.getMonth(), 1));
		return Array.from({ length: 42 }, (_, i) => tambahHari(awal, i));
	}

	function labelRentang(mode: Tampilan, d: Date): string {
		const bulanTahun = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
		const tanggalBulan = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long" });
		if (mode === "bulan") return kapital(bulanTahun.format(d));
		if (mode === "hari") {
			return kapital(
				new Intl.DateTimeFormat("id-ID", {
					weekday: "long",
					day: "numeric",
					month: "long",
					year: "numeric",
				}).format(d),
			);
		}
		const awal = awalMinggu(d);
		const akhir = tambahHari(awal, 6);
		if (awal.getFullYear() !== akhir.getFullYear()) {
			return `${tanggalBulan.format(awal)} ${awal.getFullYear()}–${tanggalBulan.format(akhir)} ${akhir.getFullYear()}`;
		}
		if (awal.getMonth() !== akhir.getMonth()) {
			return `${tanggalBulan.format(awal)}–${tanggalBulan.format(akhir)} ${akhir.getFullYear()}`;
		}
		return `${awal.getDate()}–${tanggalBulan.format(akhir)} ${akhir.getFullYear()}`;
	}

	function kapital(teks: string): string {
		return teks.charAt(0).toUpperCase() + teks.slice(1);
	}

	function labelTanggal(d: Date): string {
		return kapital(
			new Intl.DateTimeFormat("id-ID", {
				weekday: "long",
				day: "numeric",
				month: "long",
			}).format(d),
		);
	}

	function labelTanggalPendek(d: Date): string {
		return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
	}

	function jamMenit(nilai: string): string {
		const d = new Date(nilai);
		if (Number.isNaN(d.getTime())) return nilai.slice(11, 16);
		return new Intl.DateTimeFormat("id-ID", {
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		}).format(d);
	}

	function batasHari(d: Date): { mulai: number; selesai: number } {
		const mulai = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
		return { mulai, selesai: mulai + 24 * 60 * 60 * 1000 };
	}

	function rentangPadaHari(b: Baris, d: Date): { mulai: number; selesai: number } | null {
		const batas = batasHari(d);
		const mulaiCatatan = new Date(b.catatan.waktuMulai).getTime();
		const selesaiCatatan = new Date(b.catatan.waktuSelesai).getTime();
		if (
			Number.isNaN(mulaiCatatan) ||
			Number.isNaN(selesaiCatatan) ||
			mulaiCatatan >= batas.selesai ||
			selesaiCatatan <= batas.mulai
		) {
			return null;
		}
		return {
			mulai: Math.max(0, (mulaiCatatan - batas.mulai) / 60000),
			selesai: Math.min(24 * 60, (selesaiCatatan - batas.mulai) / 60000),
		};
	}

	function catatanTanggal(d: Date): Baris[] {
		return baris
			.filter((b) => rentangPadaHari(b, d) !== null)
			.slice()
			.sort((a, b) => a.catatan.waktuMulai.localeCompare(b.catatan.waktuMulai));
	}

	function catatanTerlihat(d: Date): Baris[] {
		return catatanTanggal(d);
	}

	function tataLetakHari(d: Date): { baris: Baris; jalur: number; jumlahJalur: number }[] {
		const terlihat = catatanTerlihat(d);
		const akhirJalur: number[] = [];
		const sementara = terlihat.map((b) => {
			const rentang = rentangPadaHari(b, d) ?? { mulai: 0, selesai: 0 };
			const { mulai, selesai } = rentang;
			let jalur = akhirJalur.findIndex((akhir) => akhir <= mulai);
			if (jalur < 0) jalur = akhirJalur.length;
			akhirJalur[jalur] = selesai;
			return { baris: b, jalur };
		});
		const jumlahJalur = Math.max(akhirJalur.length, 1);
		return sementara.map((item) => ({ ...item, jumlahJalur }));
	}

	function gayaCatatan(b: Baris, d: Date, jalur: number, jumlahJalur: number): string {
		const rentang = rentangPadaHari(b, d) ?? { mulai: 0, selesai: 0 };
		const mulai = Math.max(rentang.mulai, JAM_AWAL * 60);
		const selesai = Math.min(rentang.selesai, JAM_AKHIR * 60);
		const atas = ((mulai - JAM_AWAL * 60) / 60) * TINGGI_JAM;
		const tinggi = Math.max(((selesai - mulai) / 60) * TINGGI_JAM, 34);
		const kiri = (jalur / jumlahJalur) * 100;
		const lebar = 100 / jumlahJalur;
		return `top: ${atas}px; height: ${tinggi}px; left: calc(${kiri}% + 0.25rem); width: calc(${lebar}% - 0.5rem);`;
	}

	function jamDariMenit(menit: number): string {
		if (menit >= 24 * 60) return "24.00";
		const jam = String(Math.floor(menit / 60)).padStart(2, "0");
		const sisa = String(Math.round(menit % 60)).padStart(2, "0");
		return `${jam}.${sisa}`;
	}

	function waktuPadaHari(b: Baris, d: Date): string {
		const rentang = rentangPadaHari(b, d);
		if (!rentang) return `${jamMenit(b.catatan.waktuMulai)}–${jamMenit(b.catatan.waktuSelesai)}`;
		return `${jamDariMenit(rentang.mulai)}–${jamDariMenit(rentang.selesai)}`;
	}

	function keteranganLintasHari(b: Baris, d: Date): string {
		const batas = batasHari(d);
		const mulai = new Date(b.catatan.waktuMulai).getTime();
		const selesai = new Date(b.catatan.waktuSelesai).getTime();
		if (mulai < batas.mulai) return "Lanjutan dari hari sebelumnya";
		if (selesai > batas.selesai) return "Berlanjut ke hari berikutnya";
		return "";
	}

	function durasiKalender(b: Baris): number {
		const durasi =
			(new Date(b.catatan.waktuSelesai).getTime() - new Date(b.catatan.waktuMulai).getTime()) / 60000;
		return Number.isFinite(durasi) && durasi > 0 ? Math.round(durasi) : 0;
	}

	function kelasStatus(status: string): string {
		switch (status) {
			case "DRAFT":
				return "border-border-strong bg-surface-alt text-muted";
			case "SUBMIT":
				return "border-accent bg-accent-muted text-accent";
			case "TERVERIFIKASI":
				return "border-success bg-success-bg text-success";
			case "DITOLAK":
				return "border-error bg-error-bg text-error";
			default:
				return "border-border-strong bg-surface-alt text-text";
		}
	}

	function isoSlot(d: Date, menit: number): string {
		const jam = String(Math.floor(menit / 60)).padStart(2, "0");
		const m = String(menit % 60).padStart(2, "0");
		return `${tanggalIso(d)}T${jam}:${m}`;
	}

	function tautanSlot(d: Date, menit: number): string {
		const mulai = isoSlot(d, menit);
		const selesai = isoSlot(d, menit + SLOT_MENIT);
		return `/app/catatan/baru?mulai=${encodeURIComponent(mulai)}&selesai=${encodeURIComponent(selesai)}`;
	}

	function gantiTampilan(next: Tampilan) {
		tampilan = next;
		localStorage.setItem("tampilan-kalender-catatan", next);
	}

	function geser(arah: -1 | 1) {
		const d = new Date(tanggalAcuan);
		switch (tampilan) {
			case "hari":
				d.setDate(d.getDate() + arah);
				break;
			case "minggu":
				d.setDate(d.getDate() + arah * 7);
				break;
			case "bulan":
				d.setMonth(d.getMonth() + arah);
				break;
			default: {
				const _habis: never = tampilan;
				return _habis;
			}
		}
		acuan = tanggalIso(d);
	}

	function gulirKeWaktuAwal() {
		if (!wadahWaktu) return;
		const rentang = hariTampilan
			.flatMap((tanggal) =>
				catatanTanggal(tanggal)
					.map((b) => rentangPadaHari(b, tanggal)?.mulai)
					.filter((menit): menit is number => typeof menit === "number"),
			)
			.sort((a, b) => a - b);
		const hariIniTerlihat = hariTampilan.some((d) => tanggalIso(d) === tanggalIso(sekarang));
		const sasaran =
			rentang[0] !== undefined
				? Math.max(0, rentang[0] - 60)
				: hariIniTerlihat
					? Math.max(0, sekarang.getHours() * 60 + sekarang.getMinutes() - 60)
					: 8 * 60;
		wadahWaktu.scrollTop = (sasaran / 60) * TINGGI_JAM;
	}

	function keSekarang() {
		sekarang = new Date();
		acuan = tanggalIso(sekarang);
		tampilan = "hari";
		requestAnimationFrame(() => gulirKeWaktuAwal());
	}

	async function muat() {
		memuat = true;
		pesan = "";
		try {
			baris = await api<Baris[]>("/catatan");
		} catch (err) {
			pesan = err instanceof ApiError ? err.message : "Tidak dapat memuat kalender catatan.";
		} finally {
			memuat = false;
		}
	}

	async function kirim() {
		if (!detail) return;
		sibuk = true;
		pesan = "";
		try {
			await api(`/catatan/${detail.catatan.id}/submit`, { method: "POST" });
			await muat();
		} catch (err) {
			pesan = err instanceof ApiError ? err.message : "Tidak dapat mengirim catatan.";
		} finally {
			sibuk = false;
		}
	}

	onMount(() => {
		const tersimpan = localStorage.getItem("tampilan-kalender-catatan");
		if (tersimpan === "bulan" || tersimpan === "minggu" || tersimpan === "hari") {
			tampilan = tersimpan;
		} else if (window.matchMedia("(max-width: 639px)").matches) {
			tampilan = "hari";
		}
		void muat();
		const timer = window.setInterval(() => {
			sekarang = new Date();
		}, 60_000);
		return () => window.clearInterval(timer);
	});
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1 class="text-xl font-semibold">Catatan harian</h1>
		<p class="mt-1 text-sm text-muted">Lihat catatan berdasarkan tanggal dan waktu pelaksanaan selama 24 jam.</p>
	</div>
	<a
		class="inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white active:scale-[0.97]"
		href="/app/catatan/baru">Catatan baru</a
	>
</div>

<div class="mt-2">
	<NavigasiCatatan />
</div>

<div class="mt-5 flex flex-wrap items-center justify-between gap-3">
	<div class="grid grid-cols-3 overflow-hidden rounded-md border border-border text-sm">
		{#each PILIHAN_TAMPILAN as mode, i}
			<button
				class="min-h-11 px-4"
				class:border-r={i < 2}
				class:border-border={i < 2}
				class:bg-accent-muted={tampilan === mode.id}
				class:font-medium={tampilan === mode.id}
				class:text-accent={tampilan === mode.id}
				type="button"
				onclick={() => gantiTampilan(mode.id)}>{mode.label}</button
			>
		{/each}
	</div>
	<div class="flex items-center gap-2">
		<button
			class="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-lg text-accent"
			type="button"
			aria-label="Periode sebelumnya"
			onclick={() => geser(-1)}>‹</button
		>
		<button
			class="min-h-11 rounded-md border border-border px-4 text-sm text-accent"
			type="button"
			onclick={keSekarang}>Sekarang</button
		>
		<button
			class="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-lg text-accent"
			type="button"
			aria-label="Periode berikutnya"
			onclick={() => geser(1)}>›</button
		>
	</div>
</div>

<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
	<h2 class="text-base font-semibold">{labelPeriode}</h2>
	<label class="text-sm text-muted">
		Pilih tanggal
		<input class="ml-2 min-h-11 rounded-md border border-border px-3 py-2 text-text" type="date" bind:value={acuan} />
	</label>
</div>

{#if pesan}
	<p class="mt-4 text-sm text-error" role="alert">{pesan}</p>
{/if}

{#if memuat}
	<p class="mt-6 text-sm text-muted">Memuat kalender catatan…</p>
{:else if tampilan === "bulan"}
	<div class="mt-4 hidden overflow-hidden border border-border-strong sm:block">
		<div class="grid grid-cols-7 border-b border-border-strong bg-surface-alt">
			{#each NAMA_HARI as nama}
				<div class="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted">{nama}</div>
			{/each}
		</div>
		<div class="grid grid-cols-7">
			{#each hariTampilan as tanggal}
				{@const catatan = catatanTanggal(tanggal)}
				<div
					class="min-h-28 border-b border-r border-border p-2"
					class:bg-surface-alt={tanggal.getMonth() !== tanggalAcuan.getMonth()}
				>
					<div class="mb-2 flex items-center justify-between">
						<a
							class="inline-flex h-7 min-w-7 items-center justify-center text-sm"
							class:bg-accent-muted={tanggalIso(tanggal) === tanggalIso(new Date())}
							class:font-semibold={tanggalIso(tanggal) === tanggalIso(new Date())}
							class:text-accent={tanggalIso(tanggal) === tanggalIso(new Date())}
							href={tautanSlot(tanggal, 8 * 60)}
							aria-label="Tambah catatan {labelTanggal(tanggal)}">{tanggal.getDate()}</a
						>
						{#if catatan.length > 0}
							<span class="text-xs text-muted">{catatan.length}</span>
						{/if}
					</div>
					<div class="space-y-1">
						{#each catatan.slice(0, 2) as b}
							<button
								class={`block w-full truncate border-l-2 px-2 py-1 text-left text-xs ${kelasStatus(b.catatan.status)}`}
								type="button"
								onclick={() => (detailId = b.catatan.id)}
							>
								<span class="font-mono">{waktuPadaHari(b, tanggal)}</span>
								{b.catatan.uraian}
							</button>
						{/each}
						{#if catatan.length > 2}
							<button
								class="text-xs text-accent"
								type="button"
								onclick={() => {
									acuan = tanggalIso(tanggal);
									gantiTampilan("hari");
								}}>+{catatan.length - 2} catatan lainnya</button
							>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="mt-4 space-y-5 sm:hidden">
		{#each agendaBulan as agenda}
			<section>
				<div class="mb-2 flex items-center justify-between border-b border-border pb-2">
					<h3 class="text-sm font-medium">{labelTanggal(agenda.tanggal)}</h3>
					<a class="text-sm text-accent" href={tautanSlot(agenda.tanggal, 8 * 60)}>Tambah</a>
				</div>
				<div class="space-y-2">
					{#each agenda.baris as b}
						<button
							class={`flex w-full items-start gap-3 border-l-2 px-3 py-2 text-left ${kelasStatus(b.catatan.status)}`}
							type="button"
							onclick={() => (detailId = b.catatan.id)}
						>
							<span class="shrink-0 font-mono text-xs">
								{waktuPadaHari(b, agenda.tanggal)}
							</span>
							<span class="min-w-0 text-sm">
								<span class="line-clamp-2">{b.catatan.uraian}</span>
								{#if keteranganLintasHari(b, agenda.tanggal)}
									<span class="mt-1 block text-xs">{keteranganLintasHari(b, agenda.tanggal)}</span>
								{/if}
							</span>
						</button>
					{/each}
				</div>
			</section>
		{:else}
			<p class="border-y border-border py-6 text-sm text-muted">Belum ada catatan pada bulan ini.</p>
		{/each}
	</div>
{:else}
	<div bind:this={wadahWaktu} class="mt-4 max-h-[72vh] overflow-auto border border-border-strong">
		<div class={tampilan === "minggu" ? "min-w-[64rem]" : "min-w-[20rem]"}>
			<div
				class="sticky top-0 z-30 grid border-b border-border-strong bg-surface-alt"
				style={`grid-template-columns: 4rem repeat(${hariTampilan.length}, minmax(0, 1fr));`}
			>
				<div class="sticky left-0 z-40 border-r border-border bg-surface-alt"></div>
				{#each hariTampilan as tanggal}
					<div class="border-r border-border px-2 py-3 text-center">
						<p class="text-xs uppercase tracking-wide text-muted">
							{new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(tanggal)}
						</p>
						<p
							class="mt-1 text-sm"
							class:font-semibold={tanggalIso(tanggal) === tanggalIso(new Date())}
							class:text-accent={tanggalIso(tanggal) === tanggalIso(new Date())}
						>
							{labelTanggalPendek(tanggal)}
						</p>
					</div>
				{/each}
			</div>
			<div
				class="grid"
				style={`grid-template-columns: 4rem repeat(${hariTampilan.length}, minmax(0, 1fr));`}
			>
				<div
					class="sticky left-0 z-20 border-r border-border bg-surface-alt"
					style={`height: ${(JAM_AKHIR - JAM_AWAL) * TINGGI_JAM}px;`}
				>
					{#each JAM as jam}
						<span
							class={`absolute right-2 font-mono text-[11px] text-muted ${jam === 24 ? "-translate-y-full" : "-translate-y-1/2"}`}
							style={`top: ${(jam - JAM_AWAL) * TINGGI_JAM}px;`}>{String(jam).padStart(2, "0")}.00</span
						>
					{/each}
				</div>
				{#each hariTampilan as tanggal}
					{@const tataLetak = tataLetakHari(tanggal)}
					<div
						class="kalender-hari relative border-r border-border"
						style={`height: ${(JAM_AKHIR - JAM_AWAL) * TINGGI_JAM}px;`}
					>
						{#if tanggalIso(tanggal) === tanggalIso(sekarang)}
							<div
								class="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-accent"
								style={`top: ${((sekarang.getHours() * 60 + sekarang.getMinutes()) / 60) * TINGGI_JAM}px;`}
								aria-hidden="true"
							></div>
						{/if}
						{#each SLOT as menit}
							<a
								class="absolute inset-x-0 z-0 hover:bg-accent-muted focus:bg-accent-muted"
								style={`top: ${((menit - JAM_AWAL * 60) / 60) * TINGGI_JAM}px; height: ${(SLOT_MENIT / 60) * TINGGI_JAM}px;`}
								href={tautanSlot(tanggal, menit)}
								aria-label="Tambah catatan {labelTanggal(tanggal)} pukul {isoSlot(tanggal, menit).slice(11)}"
							>
								<span class="sr-only">Tambah catatan</span>
							</a>
						{/each}
						{#each tataLetak as item}
							<button
								class={`absolute z-10 overflow-hidden border-l-2 px-2 py-1 text-left text-xs ${kelasStatus(item.baris.catatan.status)}`}
								style={gayaCatatan(item.baris, tanggal, item.jalur, item.jumlahJalur)}
								type="button"
								title={item.baris.catatan.uraian}
								onclick={() => (detailId = item.baris.catatan.id)}
							>
								<span class="block font-mono">
									{waktuPadaHari(item.baris, tanggal)}
								</span>
								<span class="mt-0.5 block font-medium">{item.baris.catatan.uraian}</span>
								{#if keteranganLintasHari(item.baris, tanggal)}
									<span class="mt-1 block">{keteranganLintasHari(item.baris, tanggal)}</span>
								{/if}
							</button>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>
	<p class="mt-2 text-xs text-muted">Pilih slot waktu kosong untuk membuat catatan baru.</p>
{/if}

{#if detail}
	<PanelFokus judul="Detail catatan" ontutup={() => (detailId = "")}>
		<div class="space-y-5">
			<div>
				<p class="font-mono text-sm">
					{detail.catatan.tanggal} · {jamMenit(detail.catatan.waktuMulai)}–{jamMenit(detail.catatan.waktuSelesai)}
				</p>
				<p class="mt-2 whitespace-pre-wrap">{detail.catatan.uraian}</p>
			</div>
			<dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
				<div>
					<dt class="text-xs text-muted">Status</dt>
					<dd>{labelStatus(detail.catatan.status)}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted">Jenis tugas</dt>
					<dd>{labelJenis(detail.catatan.jenisTugas)}</dd>
				</div>
				<div class="col-span-2">
					<dt class="text-xs text-muted">Katalog</dt>
					<dd>{[detail.produkNama, detail.tahapanNama, detail.aktivitasNama].filter(Boolean).join(" / ") || "Isi manual"}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted">Waktu efektif</dt>
					<dd>{menitKeJam(detail.catatan.menitEfektif)}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted">Durasi kalender</dt>
					<dd>{menitKeJam(durasiKalender(detail))}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted">Output</dt>
					<dd>{detail.catatan.jumlahOutput} {detail.catatan.satuanOutput}</dd>
				</div>
			</dl>
			{#if detail.catatan.status === "DITOLAK" && detail.catatan.catatanValidasi}
				<div class="border border-error bg-error-bg px-3 py-3 text-sm">
					<p class="text-xs font-medium uppercase tracking-wide text-error">Alasan penolakan</p>
					<p class="mt-1 whitespace-pre-wrap">{detail.catatan.catatanValidasi}</p>
				</div>
			{/if}
			{#if detail.catatan.buktiUrl}
				<a class="inline-flex text-sm text-accent" href={detail.catatan.buktiUrl} target="_blank" rel="noreferrer"
					>Buka tautan bukti</a
				>
			{/if}
			{#if detail.catatan.status === "DRAFT" || detail.catatan.status === "DITOLAK"}
				<div class="flex flex-wrap items-center justify-end gap-4 border-t border-border pt-4">
					<a class="text-sm text-accent" href="/app/catatan/{detail.catatan.id}">Ubah catatan</a>
					<button
						class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
						type="button"
						disabled={sibuk}
						onclick={kirim}>{sibuk ? "Mengirim…" : "Kirim untuk divalidasi"}</button
					>
				</div>
			{/if}
		</div>
	</PanelFokus>
{/if}

<style>
	.kalender-hari {
		background-image: repeating-linear-gradient(
			to bottom,
			transparent 0,
			transparent 31px,
			var(--color-border) 32px
		);
	}
</style>
