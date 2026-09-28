<script lang="ts">
	let {
		jumlah,
		anak,
	}: { jumlah: number; anak?: import("svelte").Snippet } = $props();
</script>

{#if jumlah > 0}
	<div class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-4 flex flex-wrap items-center justify-between gap-3 border border-border-strong bg-surface px-4 py-3 shadow-sm lg:bottom-3">
		<p class="text-sm font-medium">{jumlah} data dipilih</p>
		{#if anak}<div class="flex flex-wrap gap-2">{@render anak()}</div>{/if}
	</div>
{/if}
