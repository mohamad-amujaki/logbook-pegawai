<script lang="ts">
	let {
		jenis,
		label,
		bahaya = false,
		hanyaIkon = false,
		terisi = false,
		onklik,
	}: {
		jenis: "tambah" | "ubah" | "hapus" | "semat";
		label: string;
		bahaya?: boolean;
		hanyaIkon?: boolean;
		terisi?: boolean;
		onklik: () => void;
	} = $props();
</script>

<button
	class="inline-flex items-center gap-1 text-sm"
	class:text-error={bahaya}
	class:text-accent={!bahaya}
	type="button"
	title={label}
	aria-label={label}
	onclick={onklik}
>
	{#if jenis === "tambah"}
		<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path stroke="currentColor" stroke-width="1.5" d="M8 3v10M3 8h10" />
		</svg>
	{:else if jenis === "ubah"}
		<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path stroke="currentColor" stroke-width="1.5" d="M11.5 2.5 13.5 4.5 6 12H4v-2z" />
		</svg>
	{:else if jenis === "hapus"}
		<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path stroke="currentColor" stroke-width="1.5" d="M3 5h10M6 5V3h4v2M5 5l.5 8h5L11 5" />
		</svg>
	{:else if jenis === "semat"}
		<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill={terisi ? "currentColor" : "none"} aria-hidden="true">
			<path
				stroke="currentColor"
				stroke-width="1.5"
				d="M4.5 2.5h7v11.2L8 11.3l-3.5 2.4V2.5z"
			/>
		</svg>
	{:else}
		{((): never => jenis)()}
	{/if}
	{#if !hanyaIkon}<span>{label}</span>{/if}
</button>
