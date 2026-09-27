<script lang="ts">
	import "../app.css";
	let { children } = $props();
</script>

<svelte:head>
	<title>Logbook Kinerja — Kemenkes</title>
</svelte:head>

{@render children()}
