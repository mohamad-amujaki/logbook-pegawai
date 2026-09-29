<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { api, ApiError } from "$lib/api";
	import PilihKatalog, { type OpsiKatalog } from "$lib/PilihKatalog.svelte";
	import { BATAS_HARI_BACKDATE, validasiBackdate, validasiWaktu, type JenisIki } from "@logbook/schemas";

	let { id = "" }: { id?: string } = $props();

	type Produk = { id: string; nama: string; kode: string };
	type Tahapan = { id: string; nama: string; kode: string; produkId: string };
	type Aktivitas = { id: string; nama: string; kode: string; tahapanId: string; normaWaktuMenit: number };

	type Katalog = {
		produk: Produk[];
		tahapan: Tahapan[];
		aktivitas: Aktivitas[];
	};

	type PinProduk = { id: string; produkId: string; nama: string; kode: string; tersedia: boolean };
	type PinJalur = {
		id: string;
		produkId: string;
		tahapanId: string | null;
		aktivitasId: string | null;
		produkNama: string;
		tahapanNama: string;
		aktivitasNama: string | null;
		tersedia: boolean;
	};
	type Sering = { id: string; nama: string; kode: string; jumlah: number; produkId?: string; tahapanId?: string };
	type Pintasan = {
		pinProduk: PinProduk[];
		pinJalur: PinJalur[];
		seringProduk: Sering[];
		seringTahapan: (Sering & { produkId: string })[];
		seringAktivitas: (Sering & { tahapanId: string })[];
	};

	type AksiOpsi = {
		id: string;
		uraian: string;
		satuan: string;
		targetTw1: number;
		targetTw2: number;
		targetTw3: number;
		targetTw4: number;
	};
	type IkiOpsi = {
		id: string;
		indikator: string;
		jenis: JenisIki;
		targetTahunan: string;
		satuan: string;
		rhkUraian: string;
		rencanaAksi: AksiOpsi[];
	};
	type PohonSkp = {
		rhk: {
			uraian: string;
			iki: {
				id: string;
				indikator: string;
				jenis: string;
				targetTahunan: string;
				satuan: string;
				rencanaAksi: AksiOpsi[];
			}[];
		}[];
	};

	let katalog = $state<Katalog | null>(null);
	let pintasan = $state<Pintasan | null>(null);
	let daftarIki = $state<IkiOpsi[]>([]);
	let skpSiap = $state(false);
	let ikiId = $state("");
	let aksiId = $state("");
	let jenisTugas = $state<"TUSI" | "TUSI_LAINNYA" | "NON_TUSI">("TUSI");
	let isiManual = $state(false);
	let produkId = $state("");
	let tahapanId = $state("");
	let aktivitasId = $state("");
	let namaManualProduk = $state("");
	let namaManualTahapan = $state("");
	let uraian = $state("");
	let waktuMulai = $state("");
	let waktuSelesai = $state("");
	let menitEfektif = $state(0);
	let menitManual = $state(false);
	let jumlahOutput = $state(1);
	let satuanOutput = $state("Dokumen");
	let kategori = $state<"BIASA" | "PERLU_DISKUSI">("BIASA");
	let buktiUrl = $state("");
	let alasanTolak = $state("");
	let error = $state("");
	let errorPin = $state("");
	let peringatan = $state("");

	$effect(() => {
		if (waktuMulai && waktuSelesai) {
			const d = (new Date(waktuSelesai).getTime() - new Date(waktuMulai).getTime()) / 60000;
			if (d <= 0) return;
			const durasi = Math.round(d);
			if (!menitManual || menitEfektif > durasi) menitEfektif = durasi;
		}
	});

	const tahapanOpsi = $derived(katalog?.tahapan.filter((t) => t.produkId === produkId) ?? []);
	const aktivitasOpsi = $derived(katalog?.aktivitas.filter((a) => a.tahapanId === tahapanId) ?? []);

	const opsiProduk = $derived<OpsiKatalog[]>(
		(katalog?.produk ?? []).map((p) => ({ id: p.id, label: p.nama, sub: p.kode })),
	);
	const opsiTahapan = $derived<OpsiKatalog[]>(tahapanOpsi.map((t) => ({ id: t.id, label: t.nama, sub: t.kode })));
	const opsiAktivitas = $derived<OpsiKatalog[]>(
		aktivitasOpsi.map((a) => ({
			id: a.id,
			label: a.nama,
			sub: a.kode,
			detail: `${a.normaWaktuMenit} menit`,
		})),
	);

	const idProdukSemat = $derived(pintasan?.pinProduk.map((p) => p.produkId) ?? []);
	const idProdukSering = $derived(pintasan?.seringProduk.map((p) => p.id) ?? []);
	const idTahapanSering = $derived(
		(pintasan?.seringTahapan ?? []).filter((t) => t.produkId === produkId).map((t) => t.id),
	);
	const idAktivitasSering = $derived(
		(pintasan?.seringAktivitas ?? []).filter((a) => a.tahapanId === tahapanId).map((a) => a.id),
	);

	const jalurSaatIni = $derived(
		pintasan?.pinJalur.find(
			(j) =>
				j.produkId === produkId &&
				j.tahapanId === tahapanId &&
				(j.aktivitasId ?? "") === (aktivitasId || ""),
		) ?? null,
	);

	const tahunCatatan = $derived(waktuMulai ? new Date(waktuMulai).getFullYear() : new Date().getFullYear());
	const ikiTerpilih = $derived(daftarIki.find((i) => i.id === ikiId) ?? null);
	const aksiOpsi = $derived(ikiTerpilih?.rencanaAksi ?? []);
	const aksiTerpilih = $derived(aksiOpsi.find((a) => a.id === aksiId) ?? null);
	const twCatatan = $derived.by(() => nomorTw(waktuMulai));

	const opsiIki = $derived<OpsiKatalog[]>(
		daftarIki.map((i) => ({
			id: i.id,
			label: i.indikator,
			detail: `${i.rhkUraian} · Target ${i.targetTahunan} ${i.satuan} · ${labelJenisIki(i.jenis)}`,
		})),
	);
	const opsiAksi = $derived<OpsiKatalog[]>(
		aksiOpsi.map((a) => ({
			id: a.id,
			label: a.uraian,
			detail: `TW1 ${a.targetTw1} · TW2 ${a.targetTw2} · TW3 ${a.targetTw3} · TW4 ${a.targetTw4}${a.satuan ? ` ${a.satuan}` : ""}`,
		})),
	);
	const aksiNonaktif = $derived(!ikiId || aksiOpsi.length === 0);
	const pesanAksiNonaktif = $derived(
		!ikiId
			? "Pilih IKI terlebih dahulu."
			: "IKI ini belum punya rencana aksi. Isi di SKP, atau pilih IKI lain.",
	);
	const nonTusi = $derived(jenisTugas === "NON_TUSI");
	const simpanNonaktif = $derived(!nonTusi && (!skpSiap || daftarIki.length === 0));
	const durasiKalender = $derived.by(() => {
		if (!waktuMulai || !waktuSelesai) return 0;
		const menit = (new Date(waktuSelesai).getTime() - new Date(waktuMulai).getTime()) / 60000;
		return menit > 0 ? Math.round(menit) : 0;
	});

	function keInputLokal(d: Date): string {
		const p = (n: number) => String(n).padStart(2, "0");
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
	}
	const batasAwal = $derived.by(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() - BATAS_HARI_BACKDATE);
		return keInputLokal(d);
	});
	const batasAkhir = $derived.by(() => {
		const d = new Date();
		d.setHours(23, 59, 0, 0);
		return keInputLokal(d);
	});

	function nomorTw(iso: string): 1 | 2 | 3 | 4 {
		const d = iso ? new Date(iso) : new Date();
		return (Math.floor(d.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
	}

	function labelDurasi(menit: number): string {
		if (menit < 60) return `${menit} menit`;
		const jam = Math.floor(menit / 60);
		const sisa = menit % 60;
		return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`;
	}

	function targetTw(a: AksiOpsi, tw: 1 | 2 | 3 | 4): number {
		switch (tw) {
			case 1:
				return a.targetTw1;
			case 2:
				return a.targetTw2;
			case 3:
				return a.targetTw3;
			case 4:
				return a.targetTw4;
			default: {
				const _never: never = tw;
				return _never;
			}
		}
	}

	function labelJenisIki(jenis: JenisIki): string {
		switch (jenis) {
			case "CORE":
				return "Core";
			case "BEYOND":
				return "Beyond";
			default: {
				const _never: never = jenis;
				return _never;
			}
		}
	}

	function rataIki(pohon: PohonSkp[]): IkiOpsi[] {
		const out: IkiOpsi[] = [];
		for (const p of pohon) {
			for (const r of p.rhk) {
				for (const i of r.iki) {
					out.push({
						id: i.id,
						indikator: i.indikator,
						jenis: i.jenis === "BEYOND" ? "BEYOND" : "CORE",
						targetTahunan: i.targetTahunan,
						satuan: i.satuan,
						rhkUraian: r.uraian,
						rencanaAksi: i.rencanaAksi,
					});
				}
			}
		}
		return out;
	}

	function sesuaikanTautan(baru: IkiOpsi[]) {
		const i = baru.find((x) => x.id === ikiId);
		if (!i) {
			ikiId = "";
			aksiId = "";
			return;
		}
		if (i.rencanaAksi.length === 1) {
			aksiId = i.rencanaAksi[0]?.id ?? "";
			return;
		}
		if (!i.rencanaAksi.some((a) => a.id === aksiId)) aksiId = "";
	}

	$effect(() => {
		const t = tahunCatatan;
		let batal = false;
		untrack(() => {
			skpSiap = false;
		});
		void (async () => {
			try {
				const data = await api<{ pohon: PohonSkp[] }>(`/skp?tahun=${t}`);
				if (batal) return;
				const rata = rataIki(data.pohon ?? []);
				untrack(() => {
					daftarIki = rata;
					sesuaikanTautan(rata);
					skpSiap = true;
				});
			} catch {
				if (batal) return;
				untrack(() => {
					daftarIki = [];
					ikiId = "";
					aksiId = "";
					skpSiap = true;
				});
			}
		})();
		return () => {
			batal = true;
		};
	});

	function keInputWaktu(nilai: string): string {
		if (!nilai) return "";
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(nilai)) return nilai;
		const d = new Date(nilai);
		if (Number.isNaN(d.getTime())) return nilai.slice(0, 16);
		const p = (n: number) => String(n).padStart(2, "0");
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
	}

	function jenisDari(nilai: string): "TUSI" | "TUSI_LAINNYA" | "NON_TUSI" {
		if (nilai === "TUSI_LAINNYA" || nilai === "NON_TUSI" || nilai === "TUSI") return nilai;
		return "TUSI";
	}

	async function muatPintasan() {
		pintasan = await api<Pintasan>("/catatan/pintasan");
	}

	async function init() {
		if (id) {
			const row = await api<{
				jenisTugas: string;
				ikiId: string | null;
				rencanaAksiId: string | null;
				isiManual: boolean;
				produkId: string | null;
				tahapanId: string | null;
				aktivitasId: string | null;
				namaManualProduk: string | null;
				namaManualTahapan: string | null;
				uraian: string;
				waktuMulai: string;
				waktuSelesai: string;
				menitEfektif: number;
				jumlahOutput: number;
				satuanOutput: string;
				kategori: "BIASA" | "PERLU_DISKUSI";
				buktiUrl: string | null;
				status: string;
				catatanValidasi: string | null;
			}>(`/catatan/${id}`);
			if (row.status === "TERVERIFIKASI" || row.status === "SUBMIT") {
				error = "Catatan ini tidak dapat diubah.";
				return;
			}
			jenisTugas = jenisDari(row.jenisTugas);
			ikiId = row.ikiId ?? "";
			aksiId = row.rencanaAksiId ?? "";
			isiManual = row.isiManual;
			produkId = row.produkId ?? "";
			tahapanId = row.tahapanId ?? "";
			aktivitasId = row.aktivitasId ?? "";
			namaManualProduk = row.namaManualProduk ?? "";
			namaManualTahapan = row.namaManualTahapan ?? "";
			uraian = row.uraian;
			waktuMulai = keInputWaktu(row.waktuMulai);
			waktuSelesai = keInputWaktu(row.waktuSelesai);
			menitEfektif = row.menitEfektif;
			const durasiBaris = Math.round(
				(new Date(waktuSelesai).getTime() - new Date(waktuMulai).getTime()) / 60000,
			);
			menitManual = durasiBaris > 0 && menitEfektif !== durasiBaris;
			jumlahOutput = row.jumlahOutput;
			satuanOutput = row.satuanOutput;
			kategori = row.kategori === "PERLU_DISKUSI" ? "PERLU_DISKUSI" : "BIASA";
			buktiUrl = row.buktiUrl ?? "";
			alasanTolak = row.status === "DITOLAK" ? (row.catatanValidasi ?? "") : "";
		} else {
			const mulai = page.url.searchParams.get("mulai");
			const selesai = page.url.searchParams.get("selesai");
			if (mulai && !Number.isNaN(new Date(mulai).getTime())) waktuMulai = keInputWaktu(mulai);
			if (selesai && !Number.isNaN(new Date(selesai).getTime())) waktuSelesai = keInputWaktu(selesai);
		}
		katalog = await api<Katalog>("/master/katalog?hanyaAktif=1");
		await muatPintasan();
	}
	onMount(() => {
		void init();
	});

	function ubahIki(id: string) {
		ikiId = id;
		const i = daftarIki.find((x) => x.id === id);
		const list = i?.rencanaAksi ?? [];
		aksiId = list.length === 1 ? (list[0]?.id ?? "") : "";
	}

	function pilihNonTusi() {
		satuanOutput = "Kali";
	}

	function ubahProduk(id: string) {
		if (id !== produkId) {
			tahapanId = "";
			aktivitasId = "";
		}
		produkId = id;
	}

	function ubahTahapan(id: string) {
		if (id !== tahapanId) aktivitasId = "";
		tahapanId = id;
	}

	function isiJalur(j: PinJalur) {
		if (!j.tersedia) return;
		produkId = j.produkId;
		tahapanId = j.tahapanId ?? "";
		aktivitasId = j.aktivitasId ?? "";
	}

	async function togglePinProduk(id: string) {
		errorPin = "";
		try {
			const ada = pintasan?.pinProduk.find((p) => p.produkId === id);
			if (ada) {
				await api(`/catatan/pin/${ada.id}`, { method: "DELETE" });
			} else {
				await api("/catatan/pin", { method: "POST", body: JSON.stringify({ jenis: "produk", produkId: id }) });
			}
			await muatPintasan();
		} catch (err) {
			errorPin = err instanceof ApiError ? err.message : "Tidak dapat menyimpan sematan produk.";
		}
	}

	async function sematkanJalur() {
		if (!produkId || !tahapanId) return;
		errorPin = "";
		try {
			await api("/catatan/pin", {
				method: "POST",
				body: JSON.stringify({
					jenis: "jalur",
					produkId,
					tahapanId,
					aktivitasId: aktivitasId || undefined,
				}),
			});
			await muatPintasan();
		} catch (err) {
			errorPin = err instanceof ApiError ? err.message : "Tidak dapat menyematkan jalur.";
		}
	}

	async function lepasPin(id: string) {
		errorPin = "";
		try {
			await api(`/catatan/pin/${id}`, { method: "DELETE" });
			await muatPintasan();
		} catch (err) {
			errorPin = err instanceof ApiError ? err.message : "Tidak dapat melepas sematan.";
		}
	}

	function pesanSimpan(): string {
		if (!nonTusi) {
			if (!ikiId) return "Pilih IKI.";
			if (ikiTerpilih && ikiTerpilih.rencanaAksi.length === 0) {
				return "IKI ini belum punya rencana aksi. Isi di SKP, atau pilih IKI lain.";
			}
			if (!aksiId) return "Pilih rencana aksi.";
			if (isiManual) {
				if (namaManualProduk.trim().length < 2 || namaManualTahapan.trim().length < 2) {
					return "Isi manual wajib nama produk dan tahapan usulan.";
				}
			} else if (!produkId || !tahapanId) {
				return "Pilih produk dan tahapan, atau centang isi manual.";
			}
		}
		if (uraian.trim().length < 10) return "Uraian minimal 10 karakter.";
		if (!waktuMulai) return "Waktu mulai wajib diisi.";
		if (!waktuSelesai) return "Waktu selesai wajib diisi.";
		const waktu = validasiWaktu(waktuMulai, waktuSelesai, Number(menitEfektif));
		if (waktu[0]) return waktu[0];
		if (!id) {
			const backdate = validasiBackdate(waktuMulai);
			if (backdate) return backdate;
		}
		if (Number(jumlahOutput) <= 0) return "Jumlah output harus lebih dari 0.";
		if (!satuanOutput.trim()) return "Satuan output wajib diisi.";
		if (buktiUrl.trim() && !/^https?:\/\//i.test(buktiUrl.trim())) {
			return "Tautan bukti harus berupa URL, diawali https://.";
		}
		return "";
	}

	async function simpan(e: Event) {
		e.preventDefault();
		error = "";
		const kurang = pesanSimpan();
		if (kurang) {
			error = kurang;
			return;
		}
		try {
			const tujuan = id ? `/catatan/${id}` : "/catatan";
			const res = await api<{ peringatanOverlap: string | null }>(tujuan, {
				method: id ? "PUT" : "POST",
				body: JSON.stringify({
					jenisTugas,
					ikiId: nonTusi ? "" : ikiId,
					rencanaAksiId: nonTusi ? "" : aksiId,
					isiManual: nonTusi ? false : isiManual,
					produkId: nonTusi ? undefined : produkId || undefined,
					tahapanId: nonTusi ? undefined : tahapanId || undefined,
					aktivitasId: nonTusi ? undefined : aktivitasId || undefined,
					namaManualProduk: nonTusi ? "" : namaManualProduk,
					namaManualTahapan: nonTusi ? "" : namaManualTahapan,
					uraian,
					waktuMulai,
					waktuSelesai,
					menitEfektif,
					jumlahOutput,
					satuanOutput,
					kategori,
					buktiUrl,
				}),
			});
			peringatan = res.peringatanOverlap ?? "";
			await goto("/app/catatan");
		} catch (err) {
			error = err instanceof ApiError ? err.message : "Tidak dapat menyimpan. Periksa isian, lalu coba lagi.";
		}
	}
</script>

<div class="mx-auto max-w-5xl">
	<a class="inline-flex min-h-11 items-center text-sm text-accent" href="/app/catatan">← Kembali ke catatan</a>
	<h1 class="mt-1 text-xl font-semibold">{id ? "Ubah catatan" : "Catatan baru"}</h1>
	<p class="mt-1 text-sm text-muted">
		{id ? "Perbarui catatan sesuai arahan atasan." : "Catat pekerjaan dan output yang diselesaikan."}
	</p>
</div>

{#if alasanTolak}
	<div class="mx-auto mt-5 max-w-5xl border border-error bg-error-bg px-4 py-3 text-sm">
		<p class="text-xs font-medium uppercase tracking-wide text-error">Alasan penolakan</p>
		<p class="mt-1 whitespace-pre-wrap">{alasanTolak}</p>
		<p class="mt-2 text-xs text-muted">Perbaiki isian, simpan, lalu kirim lagi dari daftar catatan.</p>
	</div>
{/if}

<form class="mx-auto mt-6 max-w-5xl space-y-8 pb-24 sm:pb-0" onsubmit={simpan}>
	{#if !nonTusi}
		<section class="space-y-4 border-t border-border-strong pt-5">
			<div>
				<h2 class="text-sm font-semibold">Target kinerja</h2>
				<p class="mt-1 text-sm text-muted">Pilih IKI, lalu rencana aksi yang dikerjakan hari ini.</p>
			</div>
			{#if skpSiap && daftarIki.length === 0}
				<div class="border border-border px-4 py-3">
					<p class="text-sm">Belum ada IKI pada SKP tahun ini.</p>
					<a class="mt-1 inline-block text-sm text-accent" href="/app/skp">Buka SKP</a>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2">
					<PilihKatalog
						label="IKI"
						satuan="IKI"
						placeholder="Ketik indikator…"
						opsi={opsiIki}
						nilai={ikiId}
						onubah={ubahIki}
						bolehKosong={false}
						disabled={!skpSiap}
						pesanNonaktif="Memuat IKI…"
					/>
					<PilihKatalog
						label="Rencana aksi"
						satuan="rencana aksi"
						placeholder="Ketik uraian rencana aksi…"
						opsi={opsiAksi}
						nilai={aksiId}
						onubah={(id) => (aksiId = id)}
						bolehKosong={false}
						disabled={aksiNonaktif}
						pesanNonaktif={pesanAksiNonaktif}
					/>
				</div>
			{/if}
			{#if ikiTerpilih && aksiTerpilih}
				<details class="border-y border-border py-3">
					<summary class="cursor-pointer text-sm font-medium text-accent">Ringkasan target</summary>
					<dl class="mt-3 grid gap-4 text-sm md:grid-cols-3">
						<div>
							<dt class="text-xs font-medium uppercase tracking-wide text-muted">RHK</dt>
							<dd class="mt-1 whitespace-pre-wrap">{ikiTerpilih.rhkUraian}</dd>
						</div>
						<div>
							<dt class="text-xs font-medium uppercase tracking-wide text-muted">IKI</dt>
							<dd class="mt-1 whitespace-pre-wrap">{ikiTerpilih.indikator}</dd>
							<dd class="mt-1 text-xs text-muted">
								Target {ikiTerpilih.targetTahunan}
								{ikiTerpilih.satuan} · {labelJenisIki(ikiTerpilih.jenis)}
							</dd>
						</div>
						<div>
							<dt class="text-xs font-medium uppercase tracking-wide text-muted">Rencana aksi</dt>
							<dd class="mt-1 whitespace-pre-wrap">{aksiTerpilih.uraian}</dd>
							<dd class="mt-1 text-xs text-muted">
								TW{twCatatan}
								{targetTw(aksiTerpilih, twCatatan)}{aksiTerpilih.satuan ? ` ${aksiTerpilih.satuan}` : ""}
							</dd>
						</div>
					</dl>
				</details>
			{/if}
		</section>
	{/if}

	<div class="grid gap-8 border-t border-border-strong pt-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-x-10">
		<section class="space-y-5">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 class="text-sm font-semibold">Jenis dan katalog</h2>
					<p class="mt-1 text-sm text-muted">
						{nonTusi ? "Catat kegiatan di luar Tusi/SKP." : "Tentukan sumber pekerjaan yang dicatat."}
					</p>
				</div>
				{#if !nonTusi}
					<label class="flex min-h-11 items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={isiManual} />
						Produk belum tersedia
					</label>
				{/if}
			</div>

			<fieldset>
				<legend class="mb-2 text-sm font-medium">Jenis tugas</legend>
				<div class="grid grid-cols-3 overflow-hidden rounded-md border border-border">
					<label
						class="flex min-h-11 cursor-pointer items-center justify-center border-r border-border px-2 text-center text-sm has-[:checked]:bg-accent-muted has-[:checked]:font-medium has-[:checked]:text-accent"
					>
						<input class="sr-only" type="radio" bind:group={jenisTugas} value="TUSI" />
						Tusi
					</label>
					<label
						class="flex min-h-11 cursor-pointer items-center justify-center border-r border-border px-2 text-center text-sm has-[:checked]:bg-accent-muted has-[:checked]:font-medium has-[:checked]:text-accent"
					>
						<input class="sr-only" type="radio" bind:group={jenisTugas} value="TUSI_LAINNYA" />
						Tusi lainnya
					</label>
					<label
						class="flex min-h-11 cursor-pointer items-center justify-center px-2 text-center text-sm has-[:checked]:bg-accent-muted has-[:checked]:font-medium has-[:checked]:text-accent"
					>
						<input
							class="sr-only"
							type="radio"
							bind:group={jenisTugas}
							value="NON_TUSI"
							onchange={pilihNonTusi}
						/>
						Non Tusi
					</label>
				</div>
			</fieldset>

			{#if nonTusi}
				<p class="border-l-2 border-accent pl-4 text-xs text-muted">
					Non Tusi tidak terhubung ke katalog atau SKP. Isi langsung uraian pelaksanaan dengan satuan
					"Kali". Catatan Non Tusi tetap tersimpan sebagai riwayat, tetapi tidak menambah jam efektif.
				</p>
			{:else if isiManual}
				<div class="space-y-4 border-l-2 border-accent pl-4">
					<p class="text-xs text-muted">Usulan ini akan ditinjau untuk ditambahkan ke katalog.</p>
					<label class="block text-sm"
						>Nama produk <span class="text-muted">(wajib)</span><input
							class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2"
							bind:value={namaManualProduk}
						/></label
					>
					<label class="block text-sm"
						>Nama tahapan <span class="text-muted">(wajib)</span><input
							class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2"
							bind:value={namaManualTahapan}
						/></label
					>
				</div>
			{:else}
				{#if (pintasan?.pinJalur.length ?? 0) > 0}
					<div>
						<p class="text-sm font-medium">Jalur disematkan</p>
						<ul class="mt-1 border-t border-border">
							{#each pintasan?.pinJalur ?? [] as j}
								<li class="flex items-start gap-3 border-b border-border py-2">
									<button
										class="min-w-0 flex-1 text-left"
										class:text-muted={!j.tersedia}
										type="button"
										disabled={!j.tersedia}
										onclick={() => isiJalur(j)}
									>
										<p class="line-clamp-2 whitespace-pre-wrap text-sm">
											{j.aktivitasNama ?? j.tahapanNama}
										</p>
										<p class="text-xs text-muted">{j.produkNama} · {j.tahapanNama}</p>
										{#if !j.tersedia}
											<p class="text-xs text-muted">Tidak tersedia</p>
										{/if}
									</button>
									<button class="shrink-0 text-sm text-accent" type="button" onclick={() => lepasPin(j.id)}
										>Lepas</button
									>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<PilihKatalog
					label="Produk"
					satuan="produk"
					opsi={opsiProduk}
					nilai={produkId}
					onubah={ubahProduk}
					bolehPin
					disematkanIds={idProdukSemat}
					seringIds={idProdukSering}
					onpin={togglePinProduk}
				/>
				<PilihKatalog
					label="Tahapan"
					satuan="tahapan"
					opsi={opsiTahapan}
					nilai={tahapanId}
					onubah={ubahTahapan}
					disabled={!produkId}
					pesanNonaktif="Pilih produk terlebih dahulu."
					seringIds={idTahapanSering}
				/>
				<PilihKatalog
					label="Aktivitas (opsional)"
					satuan="aktivitas"
					placeholder="Ketik nama atau kode…"
					opsi={opsiAktivitas}
					nilai={aktivitasId}
					onubah={(id) => (aktivitasId = id)}
					disabled={!tahapanId}
					pesanNonaktif="Pilih tahapan terlebih dahulu."
					seringIds={idAktivitasSering}
				/>
				<p class="text-xs text-muted">
					Sematkan jalur yang berulang agar catatan berikutnya lebih cepat diisi.
				</p>
				{#if produkId && tahapanId}
					{#if jalurSaatIni}
						<button class="text-sm text-accent" type="button" onclick={() => lepasPin(jalurSaatIni.id)}
							>Lepas jalur ini</button
						>
					{:else}
						<button class="text-sm text-accent" type="button" onclick={sematkanJalur}>Sematkan jalur ini</button>
					{/if}
				{/if}
				{#if errorPin}<p class="text-sm text-error">{errorPin}</p>{/if}
			{/if}
		</section>

		<section class="space-y-5">
			<div>
				<h2 class="text-sm font-semibold">Pelaksanaan</h2>
				<p class="mt-1 text-sm text-muted">Isi waktu, uraian pekerjaan, dan output yang dihasilkan.</p>
			</div>
			<label class="block text-sm">
				{nonTusi ? "Uraian pelaksanaan" : "Uraian"} <span class="text-muted">(wajib)</span>
				<textarea
					class="mt-1 min-h-28 w-full rounded-md border border-border px-3 py-2"
					rows="4"
					placeholder="Jelaskan pekerjaan dan hasilnya secara ringkas."
					bind:value={uraian}
				></textarea>
			</label>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label class="block min-w-0 text-sm"
					>Mulai <span class="text-muted">(wajib)</span><input
						class="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border px-3 py-2 text-sm"
						type="datetime-local"
						min={id ? undefined : batasAwal}
						max={batasAkhir}
						bind:value={waktuMulai}
					/></label
				>
				<label class="block min-w-0 text-sm"
					>Selesai <span class="text-muted">(wajib)</span><input
						class="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border px-3 py-2 text-sm"
						type="datetime-local"
						min={id ? undefined : batasAwal}
						max={batasAkhir}
						bind:value={waktuSelesai}
					/></label
				>
			</div>
			<p class="text-xs text-muted">
				Catatan bisa diisi untuk {BATAS_HARI_BACKDATE} hari terakhir sampai hari ini.
			</p>
			<label class="block text-sm"
				>Waktu efektif (menit) <span class="text-muted">(wajib)</span><input
					class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2 font-mono"
					type="number"
					min="1"
					max={durasiKalender || undefined}
					oninput={() => (menitManual = true)}
					bind:value={menitEfektif}
				/></label
			>
			{#if durasiKalender > 0}
				<p class="text-xs text-muted" aria-live="polite">
					Otomatis dari durasi (selesai − mulai), boleh dikurangi. Maksimal {durasiKalender} menit —
					saat ini {labelDurasi(Number(menitEfektif) || 0)}.
				</p>
			{/if}
			<div class="grid grid-cols-2 gap-3">
				<label class="block text-sm"
					>{nonTusi ? "Jumlah kegiatan" : "Jumlah output"} <span class="text-muted">(wajib)</span><input
						class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2"
						type="number"
						min="0.01"
						step="any"
						bind:value={jumlahOutput}
					/></label
				>
				<label class="block text-sm"
					>Satuan <span class="text-muted">(wajib)</span><input
						class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2"
						placeholder="Dokumen, laporan…"
						bind:value={satuanOutput}
					/></label
				>
			</div>
			<label class="block text-sm">
				Kategori
				<select class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2" bind:value={kategori}>
					<option value="BIASA">Biasa</option>
					<option value="PERLU_DISKUSI">Perlu diskusi</option>
				</select>
			</label>
			<label class="block text-sm"
				>Tautan bukti <span class="text-muted">(opsional)</span><input
					class="mt-1 min-h-11 w-full rounded-md border border-border px-3 py-2"
					type="url"
					inputmode="url"
					placeholder="https://…"
					bind:value={buktiUrl}
				/></label
			>
		</section>
	</div>

	{#if error}<p class="text-sm text-error" role="alert">{error}</p>{/if}
	{#if peringatan}<p class="text-sm text-warning">{peringatan}</p>{/if}

	<div
		class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-[auto_1fr] gap-3 border-t border-border-strong bg-surface px-4 py-3 sm:static sm:z-auto sm:flex sm:justify-end sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0"
	>
		<a
			class="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-4 text-sm text-accent"
			href="/app/catatan">Batal</a
		>
		<button
			class="min-h-11 rounded-md bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-hover active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 sm:min-w-40"
			type="submit"
			disabled={simpanNonaktif}>{id ? "Simpan perbaikan" : "Simpan draf"}</button
		>
	</div>
</form>
