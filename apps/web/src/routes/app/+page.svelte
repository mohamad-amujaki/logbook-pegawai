<script lang="ts">
	import { onMount } from "svelte";
	import { api, type Me } from "$lib/api";
	import { labelStatus, menitKeJam } from "$lib/format";
	import { TARGET_MENIT_EFEKTIF } from "@logbook/schemas";

	type Baris = {
		id: string;
		namaLengkap: string;
		nip: string;
		timKerjaId: string | null;
		menit: number;
		menitTercatat: number;
		persen: number;
		persenTercatat: number;
		status: string;
		statusTercatat: string;
	};

	let me = $state<Me | null>(null);
	let klasemen = $state<{
		stat: { rataMenit: number; persenCapai: number; persenTertaut: number };
		baris: Baris[];
	} | null>(null);

	onMount(async () => {
		me = await api<Me>("/me");
		klasemen = await api("/klasemen?periode=hari");
	});

	const saya = $derived(klasemen?.baris.find((b) => b.nip === me?.user.nip));
	const anggotaTim = $derived.by(() => {
		const timId = me?.ketuaTim?.id;
		if (!timId) return [];
		return (klasemen?.baris ?? [])
			.filter((b) => b.timKerjaId === timId)
			.slice()
			.sort(
				(a, b) =>
					b.menitTercatat - a.menitTercatat ||
					b.menit - a.menit ||
					a.namaLengkap.localeCompare(b.namaLengkap, "id"),
			);
	});
	const statTim = $derived.by(() => {
		const capai = anggotaTim.filter((b) => b.statusTercatat === "TERPENUHI" || b.statusTercatat === "LEBIH").length;
		const menunggu = anggotaTim.filter((b) => b.menitTercatat > b.menit).length;
		return { anggota: anggotaTim.length, capai, menunggu };
	});
	const lihatUnit = $derived(Boolean(me?.user.isAdmin || me?.user.isKepalaBiro));
</script>

{#if me}
	<h1 class="text-xl font-semibold">Beranda</h1>
	{#if !me.skpLengkap}
		<p class="mt-3 border border-warning-bg bg-warning-bg px-3 py-2 text-sm">
			Lengkapi SKP — pilih pemberi pertimbangan, pejabat penilai, dan atasan pejabat penilai.
			<a class="text-accent" href="/app/skp">Buka SKP</a>
		</p>
	{/if}

	<section class="mt-6 grid grid-cols-3 border border-border-strong">
		<div class="border border-border p-6">
			<p class="font-mono text-3xl font-bold text-brand">{menitKeJam(saya?.menitTercatat ?? saya?.menit ?? 0)}</p>
			<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Jam efektif</p>
			{#if saya && saya.menitTercatat !== saya.menit}
				<p class="text-xs text-muted">Resmi {menitKeJam(saya.menit)}</p>
			{/if}
		</div>
		<div class="border border-border p-6">
			<p class="font-mono text-3xl font-bold text-accent">{saya?.persenTercatat ?? 0}%</p>
			<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Vs 6,5 jam</p>
		</div>
		<div class="border border-border p-6">
			<p class="font-mono text-3xl font-bold text-accent">{labelStatus(saya?.statusTercatat ?? "NOL")}</p>
			<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Status</p>
		</div>
	</section>
	<p class="mt-2 text-xs text-muted">
		Target {TARGET_MENIT_EFEKTIF} menit. Termasuk catatan yang menunggu validasi.
	</p>

	<div class="mt-6">
		<a class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover" href="/app/catatan/baru"
			>Catatan baru</a
		>
	</div>

	{#if me.ketuaTim}
		<h2 class="mt-10 text-lg font-semibold">{me.ketuaTim.nama}</h2>
		<p class="mt-1 text-xs text-muted">Pemenuhan jam tercatat anggota hari ini.</p>

		<section class="mt-4 grid grid-cols-3 border border-border-strong">
			<div class="border border-border p-6">
				<p class="font-mono text-3xl font-bold text-brand">{statTim.anggota}</p>
				<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Anggota</p>
			</div>
			<div class="border border-border p-6">
				<p class="font-mono text-3xl font-bold text-accent">{statTim.capai}</p>
				<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">≥ 6,5 jam</p>
			</div>
			<div class="border border-border p-6">
				<p class="font-mono text-3xl font-bold text-accent">{statTim.menunggu}</p>
				<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Menunggu</p>
			</div>
		</section>

		<table class="mt-6 w-full text-sm">
			<thead>
				<tr class="text-left text-xs font-medium uppercase tracking-wide text-muted">
					<th class="border-b border-border-strong px-3 py-2">#</th>
					<th class="border-b border-border-strong px-3 py-2">Nama</th>
					<th class="border-b border-border-strong px-3 py-2">Jam tercatat</th>
					<th class="border-b border-border-strong px-3 py-2">%</th>
					<th class="border-b border-border-strong px-3 py-2">Status</th>
				</tr>
			</thead>
			<tbody>
				{#each anggotaTim as b, i}
					<tr class={i % 2 === 1 ? "bg-surface-alt" : ""}>
						<td class="border-b border-border px-3 py-3 font-mono">{i + 1}</td>
						<td class="border-b border-border px-3 py-3">
							<div>{b.namaLengkap}</div>
							<div class="font-mono text-xs text-muted">NIP {b.nip}</div>
						</td>
						<td class="border-b border-border px-3 py-3 font-mono">
							<div>{menitKeJam(b.menitTercatat)}</div>
							{#if b.menitTercatat !== b.menit}
								<div class="text-xs text-muted">Resmi {menitKeJam(b.menit)}</div>
							{/if}
						</td>
						<td class="border-b border-border px-3 py-3 font-mono">{b.persenTercatat}</td>
						<td class="border-b border-border px-3 py-3">{labelStatus(b.statusTercatat)}</td>
					</tr>
				{:else}
					<tr>
						<td class="px-3 py-6 text-sm text-muted" colspan="5">Belum ada anggota di tim ini.</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="mt-4 text-sm">
			<a class="text-accent" href="/app/jke?grup=tim">Buka JKE tim</a>
		</p>
	{/if}

	{#if lihatUnit && klasemen}
		<h2 class="mt-10 text-lg font-semibold">Unit kerja</h2>
		<section class="mt-4 grid grid-cols-3 border border-border-strong">
			<div class="border border-border p-6">
				<p class="font-mono text-3xl font-bold text-brand">{menitKeJam(klasemen.stat.rataMenit)}</p>
				<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Rata-rata</p>
			</div>
			<div class="border border-border p-6">
				<p class="font-mono text-3xl font-bold text-accent">{klasemen.stat.persenCapai}%</p>
				<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">≥ 6,5 jam</p>
			</div>
			<div class="border border-border p-6">
				<p class="font-mono text-3xl font-bold text-accent">{klasemen.stat.persenTertaut}%</p>
				<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Link Peta Proses Bisnis</p>
			</div>
		</section>
		<p class="mt-2 text-xs text-muted">Hanya catatan yang sudah disetujui.</p>
	{/if}
{/if}
