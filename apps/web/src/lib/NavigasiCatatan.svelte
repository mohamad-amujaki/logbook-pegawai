<script lang="ts">
	import { page } from "$app/state";

	const kalender = $derived(page.url.pathname.startsWith("/app/catatan/kalender"));
</script>

<nav class="flex items-center gap-6 border-b border-border text-sm" aria-label="Tampilan catatan">
	<a
		class="border-b-2 px-1 py-3"
		class:border-accent={!kalender}
		class:font-medium={!kalender}
		class:text-accent={!kalender}
		class:border-transparent={kalender}
		class:text-muted={kalender}
		href="/app/catatan">Daftar</a
	>
	<a
		class="border-b-2 px-1 py-3"
		class:border-accent={kalender}
		class:font-medium={kalender}
		class:text-accent={kalender}
		class:border-transparent={!kalender}
		class:text-muted={!kalender}
		href="/app/catatan/kalender">Kalender</a
	>
</nav>
