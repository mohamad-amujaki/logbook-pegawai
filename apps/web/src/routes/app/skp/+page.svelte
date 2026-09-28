<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { ASPEK_IKI, JENIS_IKI, type AspekIki, type JenisIki } from "@logbook/schemas";
	import { ApiError, api, type Me } from "$lib/api";
	import IkonAksi from "$lib/IkonAksi.svelte";
	import PanelFokus from "$lib/PanelFokus.svelte";
	import PilihPegawai, { type Orang } from "$lib/PilihPegawai.svelte";

	type Aksi = {
		id: string;
		uraian: string;
		satuan: string;
		targetTw1: number;
		targetTw2: number;
		targetTw3: number;
		targetTw4: number;
		akumulasi: boolean;
	};
	type Iki = {
		id: string;
		aspek: AspekIki;
		indikator: string;
		targetTahunan: string;
		satuan: string;
		jenis: JenisIki;
		bobot: number;
		rencanaAksi: Aksi[];
	};
	type Rhk = { id: string; uraian: string; iki: Iki[] };
	type Pimpinan = { id: string; uraian: string; rhk: Rhk[] };
	type Baris =
		| { tipe: "kosong-pimpinan"; p: Pimpinan }
		| { tipe: "kosong-rhk"; p: Pimpinan; r: Rhk; tampilPimpinan: boolean }
		| { tipe: "iki"; p: Pimpinan; r: Rhk; i: Iki; no: number; tampilPimpinan: boolean; tampilRhk: boolean };
	type Pilih =
		| { jenis: "pimpinan"; p: Pimpinan }
		| { jenis: "rhk"; p: Pimpinan; r: Rhk }
		| { jenis: "iki"; p: Pimpinan; r: Rhk; i: Iki }
		| { jenis: "aksi"; p: Pimpinan; r: Rhk; i: Iki; a: Aksi };
	type Panel =
		| { jenis: "pimpinan"; mode: "baru" | "ubah"; id?: string }
		| { jenis: "rhk"; mode: "baru" | "ubah"; pimpinanId: string; id?: string }
		| { jenis: "iki"; mode: "baru" | "ubah"; rhkId: string; id?: string }
		| { jenis: "aksi"; mode: "baru" | "ubah"; ikiId: string; rhkId: string; id?: string }
		| { jenis: "hapus"; sasaran: "pimpinan" | "rhk" | "iki" | "aksi"; id: string };
	type HapusSasaran = Extract<Panel, { jenis: "hapus" }>["sasaran"];

	const labelAspek: Record<AspekIki, string> = {
		KUANTITAS: "Kuantitas",
		KUALITAS: "Kualitas",
		WAKTU: "Waktu",
		BIAYA: "Biaya",
	};
	const labelJenis: Record<JenisIki, string> = {
		CORE: "Core",
		BEYOND: "Beyond",
	};

	let me = $state<Me | null>(null);
	let daftar = $state<Orang[]>([]);
	let tim = $state<{ id: string; nama: string }[]>([]);
	let pemberi = $state<Orang | null>(null);
	let penilai = $state<Orang | null>(null);
	let atasanPenilai = $state<Orang | null>(null);
	let errorPemberi = $state("");
	let errorPenilai = $state("");
	let errorAtasanPenilai = $state("");
	let errorUmum = $state("");
	let pesan = $state("");
	let pohon = $state<Pimpinan[]>([]);
	let pilih = $state<Pilih | null>(null);
	let panel = $state<Panel | null>(null);
	let errorPanel = $state("");
	let ubahAtasan = $state(false);
	let siapIdentitas = $state(false);

	let uraianTeks = $state("");
	let ikiAspek = $state<AspekIki>("KUANTITAS");
	let ikiIndikator = $state("");
	let ikiTarget = $state("");
	let ikiSatuan = $state("");
	let ikiJenis = $state<JenisIki>("CORE");
	let ikiBobot = $state(0);
	let aksiTw1 = $state(0);
	let aksiTw2 = $state(0);
	let aksiTw3 = $state(0);
	let aksiTw4 = $state(0);
	let aksiSatuan = $state("");
	let aksiAkumulasi = $state(false);

	const semuaIki = $derived(pohon.flatMap((p) => p.rhk.flatMap((r) => r.iki)));
	const bobotCore = $derived(semuaIki.filter((i) => i.jenis === "CORE").reduce((n, i) => n + i.bobot, 0));
	const bobotBeyond = $derived(semuaIki.filter((i) => i.jenis === "BEYOND").reduce((n, i) => n + i.bobot, 0));
	const ikiBeraksi = $derived(semuaIki.filter((i) => i.rencanaAksi.length > 0).length);
	const aksiLengkap = $derived(semuaIki.length > 0 && ikiBeraksi === semuaIki.length);
	const baris = $derived.by((): Baris[] => {
		const rows: Baris[] = [];
		let no = 0;
		for (const p of pohon) {
			if (p.rhk.length === 0) {
				rows.push({ tipe: "kosong-pimpinan", p });
				continue;
			}
			let pimpinanTampil = false;
			for (const r of p.rhk) {
				if (r.iki.length === 0) {
					rows.push({ tipe: "kosong-rhk", p, r, tampilPimpinan: !pimpinanTampil });
					pimpinanTampil = true;
					continue;
				}
				for (const [ii, i] of r.iki.entries()) {
					no += 1;
					rows.push({
						tipe: "iki",
						p,
						r,
						i,
						no,
						tampilPimpinan: !pimpinanTampil && ii === 0,
						tampilRhk: ii === 0,
					});
					pimpinanTampil = true;
				}
			}
		}
		return rows;
	});

	const judulPanel = $derived.by(() => {
		if (!panel) return "";
		switch (panel.jenis) {
			case "pimpinan":
				return panel.mode === "ubah" ? "Ubah sasaran pimpinan" : "Sasaran pimpinan baru";
			case "rhk":
				return panel.mode === "ubah" ? "Ubah RHK" : "RHK baru";
			case "iki":
				return panel.mode === "ubah" ? "Ubah IKI" : "IKI baru";
			case "aksi":
				return panel.mode === "ubah" ? "Ubah rencana aksi" : "Rencana aksi baru";
			case "hapus":
				return "Hapus dari SKP";
			default: {
				const tidakAda: never = panel;
				return tidakAda;
			}
		}
	});

	onMount(async () => {
		me = await api<Me>("/me");
		daftar = await api("/master/pegawai");
		tim = await api("/master/tim");
		const data = await api<{
			pemberiPertimbangan: Orang | null;
			pejabatPenilai: Orang | null;
			atasanPejabatPenilai: Orang | null;
			pohon: Pimpinan[];
		}>("/skp");
		pemberi = cocokkan(data.pemberiPertimbangan);
		penilai = cocokkan(data.pejabatPenilai);
		atasanPenilai = cocokkan(data.atasanPejabatPenilai);
		pohon = data.pohon ?? [];
		ubahAtasan = !pemberi || !penilai || !atasanPenilai || page.url.searchParams.get("ubah") === "1";
		siapIdentitas = true;
	});

	$effect(() => {
		if (siapIdentitas && page.url.searchParams.get("ubah") === "1") ubahAtasan = true;
	});

	function cocokkan(row: Orang | null) {
		if (!row) return null;
		return daftar.find((o) => o.id === row.id || o.nip === row.nip) ?? row;
	}

	function samakan() {
		if (!pemberi) {
			errorPemberi = "Pilih pemberi pertimbangan dulu, baru bisa disamakan ke pejabat penilai.";
			return;
		}
		penilai = pemberi;
		errorPenilai = "";
		if (atasanPenilai && atasanPenilai.id === pemberi.id) {
			errorAtasanPenilai = "Atasan pejabat penilai harus orang yang berbeda dari pejabat penilai.";
		}
	}

	async function muatPohon() {
		const data = await api<{ pohon: Pimpinan[] }>("/skp");
		pohon = data.pohon ?? [];
	}

	function terpilihPimpinan(id: string) {
		return pilih?.jenis === "pimpinan" && pilih.p.id === id;
	}
	function terpilihRhk(id: string) {
		return pilih?.jenis === "rhk" && pilih.r.id === id;
	}
	function terpilihIki(id: string) {
		return pilih?.jenis === "iki" && pilih.i.id === id;
	}
	function terpilihAksi(id: string) {
		return pilih?.jenis === "aksi" && pilih.a.id === id;
	}

	function tutupPanel() {
		panel = null;
		errorPanel = "";
	}

	function bukaPanelPimpinan(mode: "baru" | "ubah", p?: Pimpinan) {
		uraianTeks = mode === "ubah" && p ? p.uraian : "";
		errorPanel = "";
		panel = { jenis: "pimpinan", mode, id: p?.id };
	}

	function bukaPanelRhk(mode: "baru" | "ubah", pimpinanId: string, r?: Rhk) {
		uraianTeks = mode === "ubah" && r ? r.uraian : "";
		errorPanel = "";
		panel = { jenis: "rhk", mode, pimpinanId, id: r?.id };
	}

	function bukaPanelIki(mode: "baru" | "ubah", rhkId: string, i?: Iki) {
		ikiAspek = i?.aspek ?? "KUANTITAS";
		ikiIndikator = i?.indikator ?? "";
		ikiTarget = i?.targetTahunan ?? "";
		ikiSatuan = i?.satuan ?? "";
		ikiJenis = i?.jenis ?? "CORE";
		ikiBobot = i?.bobot ?? 0;
		errorPanel = "";
		panel = { jenis: "iki", mode, rhkId, id: i?.id };
	}

	function bukaPanelAksi(mode: "baru" | "ubah", i: Iki, rhkId: string, a?: Aksi) {
		uraianTeks = a?.uraian ?? "";
		aksiSatuan = a?.satuan || i.satuan;
		aksiTw1 = a?.targetTw1 ?? 0;
		aksiTw2 = a?.targetTw2 ?? 0;
		aksiTw3 = a?.targetTw3 ?? 0;
		aksiTw4 = a?.targetTw4 ?? 0;
		aksiAkumulasi = a?.akumulasi ?? false;
		errorPanel = "";
		panel = { jenis: "aksi", mode, ikiId: i.id, rhkId, id: a?.id };
	}

	function bukaHapus(sasaran: HapusSasaran, id: string) {
		errorPanel = "";
		panel = { jenis: "hapus", sasaran, id };
	}

	function tambahTw(sekarang: number, sebelum: number) {
		return sekarang - sebelum;
	}

	function targetAngka(teks: string) {
		const n = Number(teks.replace(",", "."));
		return Number.isFinite(n) ? n : null;
	}

	async function simpanHeader(e: Event) {
		e.preventDefault();
		errorPemberi = "";
		errorPenilai = "";
		errorAtasanPenilai = "";
		errorUmum = "";
		pesan = "";
		if (!pemberi) {
			errorPemberi = "Pemberi pertimbangan belum dipilih. Cari nama atau NIP, lalu klik salah satu hasil.";
			return;
		}
		if (!penilai) {
			errorPenilai = "Pejabat penilai belum dipilih. Cari nama atau NIP, atau samakan dengan pemberi pertimbangan.";
			return;
		}
		if (!atasanPenilai) {
			errorAtasanPenilai = "Atasan pejabat penilai belum dipilih. Cari nama atau NIP, lalu klik salah satu hasil.";
			return;
		}
		if (atasanPenilai.id === penilai.id) {
			errorAtasanPenilai = "Atasan pejabat penilai harus orang yang berbeda dari pejabat penilai.";
			return;
		}
		try {
			await api("/skp/header", {
				method: "PUT",
				body: JSON.stringify({
					tahun: new Date().getFullYear(),
					nipPemberiPertimbangan: pemberi.nip,
					nipPejabatPenilai: penilai.nip,
					nipAtasanPejabatPenilai: atasanPenilai.nip,
				}),
			});
			pesan = `Atasan tersimpan. Pertimbangan: ${pemberi.namaLengkap}. Penilai: ${penilai.namaLengkap}. Atasan penilai: ${atasanPenilai.namaLengkap}.`;
			ubahAtasan = false;
			if (page.url.searchParams.get("ubah") === "1") await goto("/app/skp", { replaceState: true });
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.field === "pemberi") errorPemberi = err.message;
				else if (err.field === "penilai") errorPenilai = err.message;
				else if (err.field === "atasanPenilai") errorAtasanPenilai = err.message;
				else errorUmum = err.message;
			} else {
				errorUmum = "Tidak dapat menyimpan. Periksa koneksi, lalu coba lagi.";
			}
		}
	}

	async function simpanPanel() {
		if (!panel || panel.jenis === "hapus") return;
		errorPanel = "";
		try {
			switch (panel.jenis) {
				case "pimpinan": {
					if (uraianTeks.trim().length < 3) {
						errorPanel = "Uraian sasaran pimpinan minimal 3 karakter.";
						return;
					}
					if (panel.mode === "ubah" && panel.id) {
						await api(`/skp/rhk-pimpinan/${panel.id}`, { method: "PUT", body: JSON.stringify({ uraian: uraianTeks }) });
					} else {
						await api("/skp/rhk-pimpinan", { method: "POST", body: JSON.stringify({ uraian: uraianTeks }) });
					}
					break;
				}
				case "rhk": {
					if (uraianTeks.trim().length < 3) {
						errorPanel = "Uraian RHK minimal 3 karakter.";
						return;
					}
					if (panel.mode === "ubah" && panel.id) {
						await api(`/skp/rhk/${panel.id}`, { method: "PUT", body: JSON.stringify({ uraian: uraianTeks }) });
					} else {
						await api("/skp/rhk", {
							method: "POST",
							body: JSON.stringify({ rhkPimpinanId: panel.pimpinanId, uraian: uraianTeks }),
						});
					}
					break;
				}
				case "iki": {
					if (ikiIndikator.trim().length < 3 || !ikiTarget.trim() || !ikiSatuan.trim()) {
						errorPanel = "IKI belum lengkap. Isi indikator, target, dan satuan.";
						return;
					}
					const body = {
						aspek: ikiAspek,
						indikator: ikiIndikator,
						targetTahunan: ikiTarget,
						satuan: ikiSatuan,
						jenis: ikiJenis,
						bobot: ikiBobot,
					};
					if (panel.mode === "ubah" && panel.id) {
						await api(`/skp/iki/${panel.id}`, { method: "PUT", body: JSON.stringify(body) });
					} else {
						await api("/skp/iki", { method: "POST", body: JSON.stringify({ rhkId: panel.rhkId, ...body }) });
					}
					break;
				}
				case "aksi": {
					if (uraianTeks.trim().length < 3) {
						errorPanel = "Uraian rencana aksi minimal 3 karakter.";
						return;
					}
					if (aksiSatuan.trim().length < 1) {
						errorPanel = "Satuan rencana aksi wajib diisi.";
						return;
					}
					const induk = semuaIki.find((i) => i.id === panel.ikiId);
					const target = induk ? targetAngka(induk.targetTahunan) : null;
					if (aksiAkumulasi && (aksiTw2 < aksiTw1 || aksiTw3 < aksiTw2 || aksiTw4 < aksiTw3)) {
						errorPanel = "Target kumulatif harus sama atau lebih besar dari TW sebelumnya.";
						return;
					}
					if (
						aksiAkumulasi &&
						induk &&
						aksiSatuan.trim() === induk.satuan &&
						target !== null &&
						aksiTw4 !== target
					) {
						errorPanel = `TW4 (${aksiTw4}) berbeda dari target tahunan IKI (${target} ${induk.satuan}). Disimpan, periksa lagi nanti.`;
					}
					const body = {
						uraian: uraianTeks,
						satuan: aksiSatuan.trim(),
						targetTw1: aksiTw1,
						targetTw2: aksiTw2,
						targetTw3: aksiTw3,
						targetTw4: aksiTw4,
						akumulasi: aksiAkumulasi,
					};
					if (panel.mode === "ubah" && panel.id) {
						await api(`/skp/rencana-aksi/${panel.id}`, { method: "PUT", body: JSON.stringify(body) });
					} else {
						await api("/skp/rencana-aksi", {
							method: "POST",
							body: JSON.stringify({ ikiId: panel.ikiId, rhkId: panel.rhkId, ...body }),
						});
					}
					break;
				}
				default: {
					const tidakAda: never = panel;
					return tidakAda;
				}
			}
			tutupPanel();
			await muatPohon();
		} catch (err) {
			errorPanel = err instanceof Error ? err.message : "Tidak dapat menyimpan.";
		}
	}

	function jalurHapus(sasaran: HapusSasaran, id: string) {
		switch (sasaran) {
			case "pimpinan":
				return `/skp/rhk-pimpinan/${id}`;
			case "rhk":
				return `/skp/rhk/${id}`;
			case "iki":
				return `/skp/iki/${id}`;
			case "aksi":
				return `/skp/rencana-aksi/${id}`;
			default: {
				const tidakAda: never = sasaran;
				return tidakAda;
			}
		}
	}

	async function hapusPanel() {
		if (panel?.jenis !== "hapus") return;
		try {
			await api(jalurHapus(panel.sasaran, panel.id), { method: "DELETE" });
			pilih = null;
			tutupPanel();
			await muatPohon();
		} catch (err) {
			errorPanel = err instanceof Error ? err.message : "Gagal menghapus.";
		}
	}

	function teksHapus(sasaran: HapusSasaran) {
		switch (sasaran) {
			case "pimpinan":
				return "Hapus sasaran pimpinan ini beserta semua RHK, IKI, dan rencana aksi di bawahnya?";
			case "rhk":
				return "Hapus RHK ini beserta IKI dan rencana aksinya?";
			case "iki":
				return "Hapus IKI ini beserta rencana aksinya?";
			case "aksi":
				return "Hapus rencana aksi ini?";
			default: {
				const tidakAda: never = sasaran;
				return tidakAda;
			}
		}
	}
</script>

<h1 class="text-xl font-semibold">SKP {new Date().getFullYear()}</h1>
<p class="mt-1 text-sm text-muted">
	Klik baris pada tabel, lalu pilih aksi. Form buka di panel supaya fokus ke satu isian.
</p>

{#if siapIdentitas}
	<section class="mt-8 w-full max-w-4xl">
		<div class="flex flex-wrap items-baseline justify-between gap-3">
			<h2 class="text-lg font-semibold">Identitas penilaian</h2>
			{#if pemberi && penilai && atasanPenilai && !ubahAtasan}
				<button class="text-sm text-accent" type="button" onclick={() => (ubahAtasan = true)}>Ubah atasan</button>
			{/if}
		</div>
		{#if pemberi && penilai && atasanPenilai && !ubahAtasan}
			<dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-muted">Pegawai</dt>
					<dd class="mt-1">{me?.user.namaLengkap}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-muted">Pemberi pertimbangan</dt>
					<dd class="mt-1">{pemberi.namaLengkap}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-muted">Pejabat penilai</dt>
					<dd class="mt-1">{penilai.namaLengkap}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium uppercase tracking-wide text-muted">Atasan pejabat penilai</dt>
					<dd class="mt-1">{atasanPenilai.namaLengkap}</dd>
				</div>
			</dl>
			{#if pesan}<p class="mt-3 text-sm text-success">{pesan}</p>{/if}
		{:else}
			<form class="mt-4 space-y-6" onsubmit={simpanHeader}>
				<PilihPegawai
					label="Pemberi pertimbangan (atasan langsung)"
					{daftar}
					{tim}
					terpilih={pemberi}
					error={errorPemberi}
					kecualikanId={me?.user.id ?? ""}
					onpilih={(o) => {
						pemberi = o;
						errorPemberi = "";
					}}
				/>
				<div>
					<PilihPegawai
						label="Pejabat penilai kinerja"
						{daftar}
						{tim}
						terpilih={penilai}
						error={errorPenilai}
						kecualikanId={me?.user.id ?? ""}
						onpilih={(o) => {
							penilai = o;
							errorPenilai = "";
							if (atasanPenilai && o && atasanPenilai.id === o.id) {
								errorAtasanPenilai = "Atasan pejabat penilai harus orang yang berbeda dari pejabat penilai.";
							}
						}}
					/>
					<button class="mt-2 text-sm text-accent" type="button" onclick={samakan}>
						Samakan dengan pemberi pertimbangan
					</button>
				</div>
				<div>
					<PilihPegawai
						label="Atasan pejabat penilai kinerja"
						{daftar}
						{tim}
						terpilih={atasanPenilai}
						error={errorAtasanPenilai}
						kecualikanId={me?.user.id ?? ""}
						onpilih={(o) => {
							atasanPenilai = o;
							errorAtasanPenilai = "";
						}}
					/>
					<p class="mt-2 text-xs text-muted">
						Orang di atas pejabat penilai. Tidak boleh diri sendiri atau pejabat penilai.
					</p>
				</div>
				{#if errorUmum}<p class="text-sm text-error">{errorUmum}</p>{/if}
				{#if pesan}<p class="text-sm text-success">{pesan}</p>{/if}
				<div class="flex flex-wrap items-center gap-4">
					<button class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover" type="submit"
						>Simpan atasan</button
					>
					{#if pemberi && penilai && atasanPenilai}
						<button class="text-sm text-accent" type="button" onclick={() => (ubahAtasan = false)}>Batal</button>
					{/if}
				</div>
			</form>
		{/if}
	</section>
{/if}

<section class="mt-12">
	<div class="flex flex-wrap items-baseline justify-between gap-3">
		<h2 class="text-lg font-semibold">A. Utama</h2>
		<p class="text-sm tabular-nums">
			<span class={bobotCore === 100 ? "text-success" : "text-warning"}>Core {bobotCore}/100</span>
			<span class="text-muted"> · </span>
			<span class={bobotBeyond <= 20 ? "text-muted" : "text-warning"}>Beyond {bobotBeyond}/20</span>
			{#if semuaIki.length > 0}
				<span class="text-muted"> · </span>
				<span class={aksiLengkap ? "text-success" : "text-warning"}>Aksi {ikiBeraksi}/{semuaIki.length}</span>
			{/if}
		</p>
	</div>
	<p class="mt-1 text-sm text-muted">
		Setiap IKI wajib punya minimal satu rencana aksi. Klik baris untuk menambah atau mengubah.
	</p>

	<div class="mt-4">
		<IkonAksi jenis="tambah" label="Sasaran pimpinan" onklik={() => bukaPanelPimpinan("baru")} />
	</div>

	<div class="tabel-geser mt-6">
		<table class="w-full min-w-[860px] text-sm">
			<thead>
				<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
					<th class="border-b border-border-strong px-2 py-2">No</th>
					<th class="border-b border-border-strong px-2 py-2">RHK pimpinan</th>
					<th class="border-b border-border-strong px-2 py-2">RHK</th>
					<th class="border-b border-border-strong px-2 py-2">Aspek</th>
					<th class="border-b border-border-strong px-2 py-2">IKI</th>
					<th class="w-28 whitespace-nowrap border-b border-border-strong px-2 py-2">Target</th>
					<th class="border-b border-border-strong px-2 py-2">Satuan</th>
					<th class="border-b border-border-strong px-2 py-2">Jenis</th>
					<th class="border-b border-border-strong px-2 py-2">Bobot</th>
				</tr>
			</thead>
			<tbody>
				{#each baris as b}
					{#if b.tipe === "kosong-pimpinan"}
						<tr
							class="cursor-pointer"
							class:bg-accent-muted={terpilihPimpinan(b.p.id)}
							onclick={() => (pilih = { jenis: "pimpinan", p: b.p })}
						>
							<td class="border-b border-border px-2 py-3 text-muted">—</td>
							<td class="border-b border-border px-2 py-3">{b.p.uraian}</td>
							<td class="border-b border-border px-2 py-3 text-muted" colspan="7">Belum ada RHK</td>
						</tr>
					{:else if b.tipe === "kosong-rhk"}
						<tr
							class="cursor-pointer"
							class:bg-accent-muted={terpilihRhk(b.r.id) || (b.tampilPimpinan && terpilihPimpinan(b.p.id))}
							onclick={() => (pilih = { jenis: "rhk", p: b.p, r: b.r })}
						>
							<td class="border-b border-border px-2 py-3 text-muted">—</td>
							<!-- biome-ignore lint/a11y/useKeyWithClickEvents: sel tabel dapat diklik untuk memilih baris induk -->
							<td
								class="border-b border-border px-2 py-3"
								onclick={(e) => {
									e.stopPropagation();
									pilih = { jenis: "pimpinan", p: b.p };
								}}>{b.tampilPimpinan ? b.p.uraian : ""}</td
							>
							<td class="border-b border-border px-2 py-3">{b.r.uraian}</td>
							<td class="border-b border-border px-2 py-3 text-muted" colspan="6">Belum ada IKI</td>
						</tr>
					{:else if b.tipe === "iki"}
						<tr
							class="cursor-pointer"
							class:bg-accent-muted={terpilihIki(b.i.id)}
							onclick={() => (pilih = { jenis: "iki", p: b.p, r: b.r, i: b.i })}
						>
							<td class="border-b border-border px-2 py-3 tabular-nums">{b.no}</td>
							<!-- biome-ignore lint/a11y/useKeyWithClickEvents: sel tabel dapat diklik untuk memilih baris induk -->
							<td
								class="border-b border-border px-2 py-3"
								onclick={(e) => {
									e.stopPropagation();
									pilih = { jenis: "pimpinan", p: b.p };
								}}>{b.tampilPimpinan ? b.p.uraian : ""}</td
							>
							<!-- biome-ignore lint/a11y/useKeyWithClickEvents: sel tabel dapat diklik untuk memilih baris induk -->
							<td
								class="border-b border-border px-2 py-3"
								onclick={(e) => {
									e.stopPropagation();
									pilih = { jenis: "rhk", p: b.p, r: b.r };
								}}>{b.tampilRhk ? b.r.uraian : ""}</td
							>
							<td class="border-b border-border px-2 py-3">{labelAspek[b.i.aspek] ?? b.i.aspek}</td>
							<td class="border-b border-border px-2 py-3">{b.i.indikator}</td>
							<td class="w-28 whitespace-nowrap border-b border-border px-2 py-3 font-mono text-xs tabular-nums">{b.i.targetTahunan}</td>
							<td class="border-b border-border px-2 py-3">{b.i.satuan}</td>
							<td class="border-b border-border px-2 py-3">{labelJenis[b.i.jenis] ?? b.i.jenis}</td>
							<td class="border-b border-border px-2 py-3 font-mono tabular-nums">{b.i.bobot}%</td>
						</tr>
						{#if b.i.rencanaAksi.length === 0}
							<tr
								class="cursor-pointer"
								class:bg-accent-muted={terpilihIki(b.i.id)}
								onclick={() => (pilih = { jenis: "iki", p: b.p, r: b.r, i: b.i })}
							>
								<td class="border-b border-border px-2 py-2"></td>
								<td class="border-b border-border px-2 py-2"></td>
								<td class="border-b border-border px-2 py-2"></td>
								<td class="border-b border-border px-2 py-2"></td>
								<td class="border-b border-border px-2 py-2 text-muted" colspan="5">Belum ada rencana aksi</td>
							</tr>
						{/if}
						{#each b.i.rencanaAksi as a}
							<tr
								class="cursor-pointer"
								class:bg-accent-muted={terpilihAksi(a.id)}
								onclick={() => (pilih = { jenis: "aksi", p: b.p, r: b.r, i: b.i, a })}
							>
								<td class="border-b border-border px-2 py-2"></td>
								<td class="border-b border-border px-2 py-2"></td>
								<td class="border-b border-border px-2 py-2"></td>
								<td class="border-b border-border px-2 py-2"></td>
								<td class="border-b border-border px-2 py-2">
									<p class="text-xs text-muted">Aksi</p>
									<p>{a.uraian}</p>
									<span
										class="mt-2 inline-block rounded-md px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide"
										class:bg-accent-muted={a.akumulasi}
										class:text-accent={a.akumulasi}
										class:bg-surface-alt={!a.akumulasi}
										class:text-muted={!a.akumulasi}>{a.akumulasi ? "Kumulatif" : "Per triwulan"}</span
									>
								</td>
								<td class="w-28 whitespace-nowrap border-b border-border px-2 py-2 font-mono text-xs tabular-nums">
									<p>TW 1: {a.targetTw1}</p>
									<p>TW 2: {a.targetTw2}</p>
									<p>TW 3: {a.targetTw3}</p>
									<p>TW 4: {a.targetTw4}</p>
								</td>
								<td class="border-b border-border px-2 py-2">{a.satuan || "—"}</td>
								<td class="border-b border-border px-2 py-2"></td>
								<td class="border-b border-border px-2 py-2"></td>
							</tr>
						{/each}
					{/if}

					{#if (b.tipe === "kosong-pimpinan" && terpilihPimpinan(b.p.id)) || (b.tipe === "kosong-rhk" && (terpilihRhk(b.r.id) || (b.tampilPimpinan && terpilihPimpinan(b.p.id)))) || (b.tipe === "iki" && (terpilihIki(b.i.id) || (b.tampilRhk && terpilihRhk(b.r.id)) || (b.tampilPimpinan && terpilihPimpinan(b.p.id)) || b.i.rencanaAksi.some((a) => terpilihAksi(a.id))))}
						<tr>
							<td class="border-b border-border-strong bg-surface-alt px-2 py-3" colspan="9">
								{#if pilih}
									<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
										<p class="text-sm font-medium">
											{#if pilih.jenis === "pimpinan"}
												Sasaran pimpinan
											{:else if pilih.jenis === "rhk"}
												RHK
											{:else if pilih.jenis === "iki"}
												IKI
											{:else if pilih.jenis === "aksi"}
												Rencana aksi
											{/if}
										</p>
										{#if pilih.jenis === "pimpinan"}
											<IkonAksi jenis="ubah" label="Ubah" onklik={() => bukaPanelPimpinan("ubah", pilih.p)} />
											<IkonAksi jenis="tambah" label="RHK" onklik={() => bukaPanelRhk("baru", pilih.p.id)} />
											<IkonAksi jenis="hapus" label="Hapus" bahaya onklik={() => bukaHapus("pimpinan", pilih.p.id)} />
										{:else if pilih.jenis === "rhk"}
											<IkonAksi jenis="ubah" label="Ubah" onklik={() => bukaPanelRhk("ubah", pilih.p.id, pilih.r)} />
											<IkonAksi jenis="tambah" label="IKI" onklik={() => bukaPanelIki("baru", pilih.r.id)} />
											<IkonAksi jenis="hapus" label="Hapus" bahaya onklik={() => bukaHapus("rhk", pilih.r.id)} />
										{:else if pilih.jenis === "iki"}
											<IkonAksi jenis="ubah" label="Ubah" onklik={() => bukaPanelIki("ubah", pilih.r.id, pilih.i)} />
											<IkonAksi jenis="tambah" label="Aksi" onklik={() => bukaPanelAksi("baru", pilih.i, pilih.r.id)} />
											<IkonAksi jenis="hapus" label="Hapus" bahaya onklik={() => bukaHapus("iki", pilih.i.id)} />
										{:else if pilih.jenis === "aksi"}
											<IkonAksi jenis="ubah" label="Ubah" onklik={() => bukaPanelAksi("ubah", pilih.i, pilih.r.id, pilih.a)} />
											<IkonAksi jenis="hapus" label="Hapus" bahaya onklik={() => bukaHapus("aksi", pilih.a.id)} />
										{/if}
									</div>
								{/if}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>

	{#if pohon.length === 0}
		<p class="mt-6 text-sm text-muted">Belum ada baris. Tambah sasaran pimpinan, lalu isi RHK dan IKI.</p>
	{/if}
</section>

{#if panel}
	<PanelFokus judul={judulPanel} ontutup={tutupPanel}>
		{#if panel.jenis === "hapus"}
			<p class="text-sm">{teksHapus(panel.sasaran)}</p>
			{#if errorPanel}<p class="mt-2 text-sm text-error">{errorPanel}</p>{/if}
			<div class="mt-4 flex gap-3">
				<button class="rounded-md bg-error px-4 py-2 text-sm text-white" type="button" onclick={hapusPanel}>Ya, hapus</button>
				<button class="text-sm text-accent" type="button" onclick={tutupPanel}>Batal</button>
			</div>
		{:else if panel.jenis === "iki"}
			<div class="space-y-3 text-sm">
				<div class="flex flex-wrap items-baseline gap-3">
					<span class="text-muted">Aspek</span>
					{#each ASPEK_IKI as a}
						<button
							class:font-medium={ikiAspek === a}
							class:text-accent={ikiAspek === a}
							class:text-muted={ikiAspek !== a}
							type="button"
							onclick={() => (ikiAspek = a)}>{labelAspek[a]}</button
						>
					{/each}
				</div>
				<div class="flex flex-wrap items-baseline gap-3">
					<span class="text-muted">Jenis</span>
					{#each JENIS_IKI as j}
						<button
							class:font-medium={ikiJenis === j}
							class:text-accent={ikiJenis === j}
							class:text-muted={ikiJenis !== j}
							type="button"
							onclick={() => (ikiJenis = j)}>{labelJenis[j]}</button
						>
					{/each}
				</div>
				<label class="block">
					<span class="text-muted">Indikator</span>
					<textarea class="mt-1 w-full rounded-md border border-border px-3 py-2" rows="3" bind:value={ikiIndikator}></textarea>
				</label>
				<div class="flex flex-wrap gap-2">
					<label class="min-w-28 flex-1">
						<span class="text-muted">Target</span>
						<input class="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono" bind:value={ikiTarget} />
					</label>
					<label class="min-w-28 flex-1">
						<span class="text-muted">Satuan</span>
						<input class="mt-1 w-full rounded-md border border-border px-3 py-2" bind:value={ikiSatuan} />
					</label>
					<label class="w-24">
						<span class="text-muted">Bobot</span>
						<input class="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono" type="number" min="0" max="100" bind:value={ikiBobot} />
					</label>
				</div>
			</div>
			{#if errorPanel}<p class="mt-2 text-sm text-error">{errorPanel}</p>{/if}
			<div class="mt-4 flex gap-3">
				<button class="rounded-md bg-accent px-4 py-2 text-sm text-white" type="button" onclick={simpanPanel}>Simpan</button>
				<button class="text-sm text-accent" type="button" onclick={tutupPanel}>Batal</button>
			</div>
		{:else if panel.jenis === "aksi"}
			{@const induk = semuaIki.find((i) => i.id === panel.ikiId)}
			<div class="space-y-3 text-sm">
				<label class="block">
					<span class="text-muted">Uraian</span>
					<input class="mt-1 w-full rounded-md border border-border px-3 py-2" bind:value={uraianTeks} />
				</label>
				<label class="block">
					<span class="text-muted">Satuan</span>
					<input class="mt-1 w-full rounded-md border border-border px-3 py-2" bind:value={aksiSatuan} />
				</label>
				{#if induk}
					<p class="text-xs text-muted">
						Satuan IKI: {induk.satuan}. Boleh diganti jika aksi diukur berbeda.
					</p>
				{/if}
				<div class="flex flex-wrap items-baseline gap-4">
					<span class="text-muted">Cara hitung</span>
					<button
						class:font-medium={!aksiAkumulasi}
						class:text-accent={!aksiAkumulasi}
						class:text-muted={aksiAkumulasi}
						type="button"
						onclick={() => (aksiAkumulasi = false)}>Per triwulan</button
					>
					<button
						class:font-medium={aksiAkumulasi}
						class:text-accent={aksiAkumulasi}
						class:text-muted={!aksiAkumulasi}
						type="button"
						onclick={() => (aksiAkumulasi = true)}>Kumulatif</button
					>
				</div>
				<p class="text-xs text-muted">
					{#if aksiAkumulasi}
						Isi jumlah sampai triwulan itu. TW2 mencakup TW1, dst. TW4 biasanya sama dengan target tahunan IKI.
					{:else}
						Target tiap triwulan berdiri sendiri. Empat angka ini tidak dijumlahkan.
					{/if}
				</p>
				<div class="space-y-2">
					<label class="flex items-center justify-between gap-3">
						<span class="text-muted">TW1</span>
						<input class="w-24 rounded-md border border-border px-2 py-1 font-mono" type="number" bind:value={aksiTw1} />
					</label>
					<label class="flex items-center justify-between gap-3">
						<span class="text-muted">
							TW2{#if aksiAkumulasi}
								<span class="text-muted"> · +{tambahTw(aksiTw2, aksiTw1)}</span>{/if}
						</span>
						<input class="w-24 rounded-md border border-border px-2 py-1 font-mono" type="number" bind:value={aksiTw2} />
					</label>
					<label class="flex items-center justify-between gap-3">
						<span class="text-muted">
							TW3{#if aksiAkumulasi}
								<span class="text-muted"> · +{tambahTw(aksiTw3, aksiTw2)}</span>{/if}
						</span>
						<input class="w-24 rounded-md border border-border px-2 py-1 font-mono" type="number" bind:value={aksiTw3} />
					</label>
					<label class="flex items-center justify-between gap-3">
						<span class="text-muted">
							TW4{#if aksiAkumulasi}
								<span class="text-muted"> · +{tambahTw(aksiTw4, aksiTw3)}</span>{/if}
						</span>
						<input class="w-24 rounded-md border border-border px-2 py-1 font-mono" type="number" bind:value={aksiTw4} />
					</label>
				</div>
				{#if induk}
					<p class="text-xs text-muted">
						{#if aksiAkumulasi}
							Sampai akhir tahun {aksiTw4}{#if aksiSatuan}
								{aksiSatuan}{/if}. Target IKI {induk.targetTahunan}
							{induk.satuan}.
						{:else}
							Tidak dijumlahkan. Target IKI {induk.targetTahunan}
							{induk.satuan}.
						{/if}
					</p>
				{/if}
			</div>
			{#if errorPanel}<p class="mt-2 text-sm text-error">{errorPanel}</p>{/if}
			<div class="mt-4 flex gap-3">
				<button class="rounded-md bg-accent px-4 py-2 text-sm text-white" type="button" onclick={simpanPanel}>Simpan</button>
				<button class="text-sm text-accent" type="button" onclick={tutupPanel}>Batal</button>
			</div>
		{:else}
			<label class="block text-sm">
				<span class="text-muted">Uraian</span>
				<textarea class="mt-1 w-full rounded-md border border-border px-3 py-2" rows="3" bind:value={uraianTeks}></textarea>
			</label>
			{#if errorPanel}<p class="mt-2 text-sm text-error">{errorPanel}</p>{/if}
			<div class="mt-4 flex gap-3">
				<button class="rounded-md bg-accent px-4 py-2 text-sm text-white" type="button" onclick={simpanPanel}>Simpan</button>
				<button class="text-sm text-accent" type="button" onclick={tutupPanel}>Batal</button>
			</div>
		{/if}
	</PanelFokus>
{/if}
