<script lang="ts">
	import { onMount } from "svelte";
	import { api } from "$lib/api";
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
	};

	type Pegawai = {
		id: string;
		namaLengkap: string;
		nip: string;
		jabatan: string;
		timKerjaId: string | null;
		timNama: string | null;
	};

	let tim = $state<Tim[]>([]);
	let pegawai = $state<Pegawai[]>([]);
	let units = $state<{ id: string; nama: string; indukId: string | null }[]>([]);
	let kode = $state("");
	let nama = $state("");
	let suntingId = $state("");
	let ubahKode = $state("");
	let ubahNama = $state("");
	let ubahStatus = $state<"aktif" | "nonaktif">("aktif");
	let ubahKetuaId = $state("");
	let pesan = $state("");
	let error = $state("");

	const opsiKetua = $derived.by(() => {
		const anggota = pegawai.filter((p) => p.timKerjaId === suntingId);
		const lain = pegawai.filter((p) => p.timKerjaId !== suntingId);
		return [...anggota, ...lain].map((p) => ({
			id: p.id,
			label: p.namaLengkap,
			sub: p.nip,
			detail: p.timKerjaId === suntingId ? p.jabatan : `${p.jabatan} · ${p.timNama ?? "Belum ada tim"}`,
		}));
	});

	async function muat() {
		tim = await api("/master/tim");
		pegawai = await api("/master/pegawai");
		units = await api("/master/unit");
	}
	onMount(muat);

	function bukaUbah(t: Tim) {
		suntingId = t.id;
		ubahKode = t.kode;
		ubahNama = t.nama;
		ubahStatus = t.status === "nonaktif" ? "nonaktif" : "aktif";
		ubahKetuaId = t.ketuaPegawaiId ?? "";
		error = "";
		pesan = "";
	}

	async function tambah(e: Event) {
		e.preventDefault();
		error = "";
		pesan = "";
		if (!kode.trim() || !nama.trim()) {
			error = "Kode dan nama tim wajib diisi.";
			return;
		}
		const unit = units.find((u) => u.indukId) ?? units[0];
		if (!unit?.indukId) {
			error = "Unit kerja belum ada. Tambah di menu Unit kerja.";
			return;
		}
		try {
			await api("/master/tim", {
				method: "POST",
				body: JSON.stringify({ kode: kode.trim(), nama: nama.trim(), unitKerjaId: unit.id }),
			});
			pesan = `Tim “${nama.trim()}” ditambahkan. Isi ketua lewat Ubah.`;
			kode = "";
			nama = "";
			await muat();
		} catch (err) {
			error = err instanceof Error ? err.message : "Gagal menambah tim. Cek kode belum dipakai.";
		}
	}

	async function simpanUbah(e: Event) {
		e.preventDefault();
		error = "";
		pesan = "";
		if (!ubahKode.trim() || !ubahNama.trim()) {
			error = "Kode dan nama tim wajib diisi.";
			return;
		}
		try {
			await api(`/master/tim/${suntingId}`, {
				method: "PUT",
				body: JSON.stringify({
					kode: ubahKode.trim(),
					nama: ubahNama.trim(),
					status: ubahStatus,
					ketuaPegawaiId: ubahKetuaId || null,
				}),
			});
			const namaKetua = pegawai.find((p) => p.id === ubahKetuaId)?.namaLengkap;
			pesan = namaKetua
				? `Tim “${ubahNama.trim()}” disimpan. Ketua: ${namaKetua}.`
				: `Tim “${ubahNama.trim()}” disimpan.`;
			suntingId = "";
			await muat();
		} catch (err) {
			error = err instanceof Error ? err.message : "Gagal menyimpan perubahan tim.";
		}
	}
</script>

<h2 class="text-lg font-semibold">Tim kerja</h2>
<p class="mt-1 text-sm text-muted">
	Ubah di baris tabel, bukan jendela baru. Ketua otomatis menjadi anggota tim itu.
</p>

<form class="mt-6 flex w-full max-w-4xl flex-wrap gap-2 text-sm" onsubmit={tambah}>
	<input class="w-40 rounded-md border border-border px-3 py-2 font-mono" placeholder="Kode" bind:value={kode} />
	<input class="min-h-11 w-full min-w-0 flex-1 rounded-md border border-border px-3 py-2 sm:min-w-64" placeholder="Nama tim kerja" bind:value={nama} />
	<button class="rounded-md bg-accent px-4 py-2 font-medium text-white" type="submit">Tambah tim</button>
</form>
{#if error && !suntingId}<p class="mt-2 text-sm text-error">{error}</p>{/if}
{#if pesan}<p class="mt-2 text-sm text-success">{pesan}</p>{/if}

<div class="tabel-geser mt-8">
<table class="w-full min-w-[40rem] text-sm">
	<thead>
		<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
			<th class="border-b border-border-strong px-3 py-2">Kode</th>
			<th class="border-b border-border-strong px-3 py-2">Nama</th>
			<th class="border-b border-border-strong px-3 py-2">Ketua</th>
			<th class="border-b border-border-strong px-3 py-2">Anggota</th>
			<th class="border-b border-border-strong px-3 py-2">Status</th>
			<th class="border-b border-border-strong px-3 py-2"></th>
		</tr>
	</thead>
	<tbody>
		{#each tim as t, i}
			<tr class={suntingId === t.id ? "bg-accent-muted" : i % 2 === 1 ? "bg-surface-alt" : ""}>
				<td class="border-b border-border px-3 py-3 font-mono text-xs">{t.kode}</td>
				<td class="border-b border-border px-3 py-3">{t.nama}</td>
				<td class="border-b border-border px-3 py-3">
					{#if t.ketuaNama}
						<p>{t.ketuaNama}</p>
						<p class="font-mono text-xs text-muted">{t.ketuaNip}</p>
					{:else}
						<span class="text-muted">Belum ada ketua</span>
					{/if}
				</td>
				<td class="border-b border-border px-3 py-3 tabular-nums">{t.jumlahAnggota}</td>
				<td class="border-b border-border px-3 py-3">{t.status}</td>
				<td class="border-b border-border px-3 py-3">
					<button class="text-accent" type="button" onclick={() => bukaUbah(t)}>Ubah</button>
				</td>
			</tr>
			{#if suntingId === t.id}
				<tr>
					<td class="border-b border-border-strong bg-surface-alt px-3 py-4" colspan="6">
						<form class="max-w-4xl space-y-4" onsubmit={simpanUbah}>
							<div class="flex flex-wrap gap-2">
								<input
									class="w-40 rounded-md border border-border px-3 py-2 font-mono"
									placeholder="Kode"
									bind:value={ubahKode}
								/>
								<input
									class="w-full min-w-0 flex-1 rounded-md border border-border px-3 py-2 sm:min-w-64"
									placeholder="Nama tim kerja"
									bind:value={ubahNama}
								/>
							</div>
							<div class="flex items-baseline gap-4 text-sm">
								<span class="text-muted">Status</span>
								<button
									class:font-medium={ubahStatus === "aktif"}
									class:text-accent={ubahStatus === "aktif"}
									class:text-muted={ubahStatus !== "aktif"}
									type="button"
									onclick={() => (ubahStatus = "aktif")}>Aktif</button
								>
								<button
									class:font-medium={ubahStatus === "nonaktif"}
									class:text-accent={ubahStatus === "nonaktif"}
									class:text-muted={ubahStatus !== "nonaktif"}
									type="button"
									onclick={() => (ubahStatus = "nonaktif")}>Nonaktif</button
								>
							</div>
							<SelectCari
								label="Ketua tim kerja"
								placeholder="Ketik nama atau NIP ketua…"
								pesanKosong="Tidak ada pegawai yang cocok. Coba nama pendek atau NIP."
								satuan="nama"
								opsi={opsiKetua}
								nilai={ubahKetuaId}
								onubah={(id) => (ubahKetuaId = id)}
							/>
							<p class="text-xs text-muted">
								Anggota tim ini tampil di atas daftar. Ketua yang dipilih otomatis masuk tim ini. Satu orang hanya ketua di satu tim.
							</p>
							{#if error && suntingId}<p class="text-sm text-error">{error}</p>{/if}
							<div class="flex flex-wrap items-center gap-4">
								<button class="rounded-md bg-accent px-4 py-2 font-medium text-white" type="submit">Simpan</button>
								<button class="text-accent" type="button" onclick={() => (suntingId = "")}>Batal</button>
							</div>
						</form>
					</td>
				</tr>
			{/if}
		{/each}
	</tbody>
</table>
</div>
