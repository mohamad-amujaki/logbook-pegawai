<script lang="ts">
	let {
		judul,
		deskripsi,
		labelAksi,
		onaksi,
	}: { judul: string; deskripsi: string; labelAksi?: string; onaksi?: () => void } = $props();
</script>

<div class="border border-dashed border-border-strong px-5 py-8 text-center">
	<p class="text-sm font-medium">{judul}</p>
	<p class="mx-auto mt-1 max-w-xl text-sm text-muted">{deskripsi}</p>
	{#if labelAksi && onaksi}
		<button class="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" type="button" onclick={onaksi}>{labelAksi}</button>
	{/if}
</div>
