<script lang="ts">
	import { goto } from "$app/navigation";
	import { api, ApiError } from "$lib/api";
	import PilihKatalog, { type OpsiKatalog } from "$lib/PilihKatalog.svelte";
	import { validasiWaktu } from "@logbook/schemas";

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

	let katalog = $state<Katalog | null>(null);
	let pintasan = $state<Pintasan | null>(null);
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
	let jumlahOutput = $state(1);
	let satuanOutput = $state("Dokumen");
	let kategori = $state<"BIASA" | "PERLU_DISKUSI">("BIASA");
	let buktiUrl = $state("");
	let error = $state("");
	let errorPin = $state("");
	let peringatan = $state("");

	$effect(() => {
		if (waktuMulai && waktuSelesai) {
			const d = (new Date(waktuSelesai).getTime() - new Date(waktuMulai).getTime()) / 60000;
			if (d > 0 && menitEfektif === 0) menitEfektif = Math.round(d);
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

	async function muatPintasan() {
		pintasan = await api<Pintasan>("/catatan/pintasan");
	}

	async function init() {
		katalog = await api<Katalog>("/master/katalog?hanyaAktif=1");
		await muatPintasan();
	}
	init();

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
		if (isiManual) {
			if (namaManualProduk.trim().length < 2 || namaManualTahapan.trim().length < 2) {
				return "Isi manual wajib nama produk dan tahapan usulan.";
			}
		} else if (!produkId || !tahapanId) {
			return "Pilih produk dan tahapan, atau centang isi manual.";
		}
		if (uraian.trim().length < 10) return "Uraian minimal 10 karakter.";
		if (!waktuMulai) return "Waktu mulai wajib diisi.";
		if (!waktuSelesai) return "Waktu selesai wajib diisi.";
		const waktu = validasiWaktu(waktuMulai, waktuSelesai, Number(menitEfektif));
		if (waktu[0]) return waktu[0];
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
			const res = await api<{ peringatanOverlap: string | null }>("/catatan", {
				method: "POST",
				body: JSON.stringify({
					jenisTugas,
					isiManual,
					produkId: produkId || undefined,
					tahapanId: tahapanId || undefined,
					aktivitasId: aktivitasId || undefined,
					namaManualProduk,
					namaManualTahapan,
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

<h1 class="text-xl font-semibold">Catatan baru</h1>
<form class="mx-auto mt-6 max-w-5xl space-y-6" onsubmit={simpan}>
	<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<fieldset class="text-sm">
			<legend class="mb-2">Jenis tugas</legend>
			<div class="flex flex-wrap gap-x-4 gap-y-1">
				<label><input type="radio" bind:group={jenisTugas} value="TUSI" /> Tusi</label>
				<label><input type="radio" bind:group={jenisTugas} value="TUSI_LAINNYA" /> Tusi lainnya</label>
				<label><input type="radio" bind:group={jenisTugas} value="NON_TUSI" /> Non Tusi</label>
			</div>
		</fieldset>
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={isiManual} />
			Isi manual (belum ada di katalog)
		</label>
	</div>

	<div class="grid gap-8 md:grid-cols-2 md:gap-x-8">
		<section class="space-y-4">
			<p class="text-sm font-medium">Katalog</p>
			{#if isiManual}
				<label class="block text-sm"
					>Nama produk<input
						class="mt-1 w-full rounded-md border border-border px-3 py-2"
						bind:value={namaManualProduk}
					/></label
				>
				<label class="block text-sm"
					>Nama tahapan<input
						class="mt-1 w-full rounded-md border border-border px-3 py-2"
						bind:value={namaManualTahapan}
					/></label
				>
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
					label="Aktivitas"
					satuan="aktivitas"
					placeholder="Opsional. Ketik nama atau kode…"
					opsi={opsiAktivitas}
					nilai={aktivitasId}
					onubah={(id) => (aktivitasId = id)}
					disabled={!tahapanId}
					pesanNonaktif="Pilih tahapan terlebih dahulu."
					seringIds={idAktivitasSering}
				/>
				<p class="text-xs text-muted">
					Ketik nama atau kode. Sematkan jalur yang berulang agar catatan berikutnya satu ketukan.
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

		<section class="space-y-4">
			<p class="text-sm font-medium">Pelaksanaan</p>
			<label class="block text-sm">
				Uraian
				<textarea class="mt-1 w-full rounded-md border border-border px-3 py-2" rows="3" bind:value={uraian}></textarea>
			</label>
			<div class="grid grid-cols-2 gap-3">
				<label class="block min-w-0 text-sm"
					>Mulai<input
						class="mt-1 w-full min-w-0 rounded-md border border-border px-3 py-2 text-sm"
						type="datetime-local"
						bind:value={waktuMulai}
					/></label
				>
				<label class="block min-w-0 text-sm"
					>Selesai<input
						class="mt-1 w-full min-w-0 rounded-md border border-border px-3 py-2 text-sm"
						type="datetime-local"
						bind:value={waktuSelesai}
					/></label
				>
			</div>
			<label class="block text-sm"
				>Waktu efektif (menit)<input
					class="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono"
					type="number"
					bind:value={menitEfektif}
				/></label
			>
			<div class="grid grid-cols-2 gap-3">
				<label class="block text-sm"
					>Jumlah output<input
						class="mt-1 w-full rounded-md border border-border px-3 py-2"
						type="number"
						bind:value={jumlahOutput}
					/></label
				>
				<label class="block text-sm"
					>Satuan<input class="mt-1 w-full rounded-md border border-border px-3 py-2" bind:value={satuanOutput} /></label
				>
			</div>
			<label class="block text-sm">
				Kategori
				<select class="mt-1 w-full rounded-md border border-border px-3 py-2" bind:value={kategori}>
					<option value="BIASA">Biasa</option>
					<option value="PERLU_DISKUSI">Perlu diskusi</option>
				</select>
			</label>
			<label class="block text-sm"
				>Tautan bukti<input class="mt-1 w-full rounded-md border border-border px-3 py-2" bind:value={buktiUrl} /></label
			>
			{#if error}<p class="text-sm text-error">{error}</p>{/if}
			{#if peringatan}<p class="text-sm text-warning">{peringatan}</p>{/if}
			<button class="w-full rounded-md bg-accent py-2 text-sm font-medium text-white hover:bg-accent-hover" type="submit"
				>Simpan draf</button
			>
		</section>
	</div>
</form>
