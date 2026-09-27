<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { api, type Me } from "$lib/api";

	onMount(async () => {
		try {
			const me = await api<Me>("/me");
			if (me.user.wajibGantiSandi) {
				await goto("/ganti-sandi");
				return;
			}
			await goto("/app");
		} catch {
			await goto("/login");
		}
	});
</script>

<p class="p-8 text-sm text-muted">Memuat...</p>
