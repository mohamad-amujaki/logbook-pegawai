<script lang="ts">
	import { page } from "$app/state";

	let { children } = $props();

	const menu = [
		{
			grup: "Kepegawaian",
			item: [
				{ href: "/app/master/pegawai", label: "Pegawai" },
				{ href: "/app/master/unitkerja", label: "Unit kerja" },
				{ href: "/app/master/tim", label: "Tim kerja" },
			],
		},
		{
			grup: "Katalog Produk Unit Kerja/Proses Bisnis",
			item: [
				{ href: "/app/master/produk", label: "Produk/Proses bisnis" },
				{ href: "/app/master/tahapan", label: "Tahapan" },
				{ href: "/app/master/aktivitas", label: "Aktivitas" },
			],
		},
	];

	function aktif(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<h1 class="text-xl font-semibold">Master data</h1>
<p class="mt-1 text-sm text-muted">Satu jenis data per halaman. Pilih menu di bawah.</p>

<nav class="mt-6 flex flex-wrap items-end gap-8 border-b border-border">
	{#each menu as g}
		<div>
			<p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{g.grup}</p>
			<div class="flex gap-4">
				{#each g.item as m}
					<a
						class="border-b-2 pb-2 text-sm"
						class:border-accent={aktif(m.href)}
						class:text-accent={aktif(m.href)}
						class:border-transparent={!aktif(m.href)}
						href={m.href}>{m.label}</a
					>
				{/each}
			</div>
		</div>
	{/each}
</nav>

<div class="mt-6">
	{@render children()}
</div>
