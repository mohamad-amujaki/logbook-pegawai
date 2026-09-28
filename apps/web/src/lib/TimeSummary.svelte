<script lang="ts">
	let { tercatat, terverifikasi, target }: { tercatat: number; terverifikasi: number; target?: number } =
		$props();

	function waktu(menit: number): string {
		const jam = Math.floor(menit / 60);
		const sisa = menit % 60;
		return jam === 0 ? `${sisa} mnt` : sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} mnt`;
	}
</script>

<div class="grid grid-cols-2 border border-border-strong">
	<div class="border-r border-border p-4">
		<p class="font-mono text-xl font-bold text-brand">{waktu(terverifikasi)}</p>
		<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Waktu terverifikasi</p>
	</div>
	<div class="p-4">
		<p class="font-mono text-xl font-bold text-accent">{waktu(tercatat)}</p>
		<p class="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Waktu tercatat</p>
	</div>
</div>
{#if target !== undefined}
	<p class="mt-2 text-xs text-muted">Target waktu efektif: {waktu(target)}.</p>
{/if}
