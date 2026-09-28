<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		judul,
		ontutup,
		children,
	}: {
		judul: string;
		ontutup: () => void;
		children: Snippet;
	} = $props();

	$effect(() => {
		function esc(e: KeyboardEvent) {
			if (e.key === "Escape") ontutup();
		}
		window.addEventListener("keydown", esc);
		return () => window.removeEventListener("keydown", esc);
	});
</script>

<div class="fixed inset-0 z-40 flex items-end justify-center sm:items-start sm:px-4 sm:py-12">
	<button
		type="button"
		class="absolute inset-0 bg-[rgb(20_48_51/0.28)]"
		aria-label="Tutup panel"
		onclick={ontutup}
	></button>
	<div
		class="panel-fokus relative max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-md border border-border-strong bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-md sm:pb-5"
		role="dialog"
		aria-modal="true"
		aria-labelledby="judul-panel"
	>
		<div class="mb-4 flex items-start justify-between gap-3">
			<h2 id="judul-panel" class="text-lg font-semibold">{judul}</h2>
			<button class="text-sm text-accent" type="button" onclick={ontutup}>Tutup</button>
		</div>
		{@render children()}
	</div>
</div>

<style>
	.panel-fokus {
		animation: panel-fokus 180ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	@keyframes panel-fokus {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
