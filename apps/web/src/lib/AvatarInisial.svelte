<script lang="ts">
	let { nama, ukuran = "md" }: { nama: string; ukuran?: "sm" | "md" } = $props();

	const huruf = $derived.by(() => {
		const parts = nama.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return "?";
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
	});
</script>

<span
	class="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-muted font-medium text-accent"
	class:h-8={ukuran === "md"}
	class:w-8={ukuran === "md"}
	class:text-xs={ukuran === "md"}
	class:h-6={ukuran === "sm"}
	class:w-6={ukuran === "sm"}
	class:text-[10px]={ukuran === "sm"}
	aria-hidden="true">{huruf}</span
>
