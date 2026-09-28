<script lang="ts">
	let {
		judul,
		deskripsi,
		anak,
	}: { judul: string; deskripsi?: string; anak?: import("svelte").Snippet } = $props();
</script>

<header class="flex flex-wrap items-start justify-between gap-4">
	<div>
		<h1 class="text-xl font-semibold">{judul}</h1>
		{#if deskripsi}<p class="mt-1 max-w-3xl text-sm text-muted">{deskripsi}</p>{/if}
	</div>
	{#if anak}<div>{@render anak()}</div>{/if}
</header>
