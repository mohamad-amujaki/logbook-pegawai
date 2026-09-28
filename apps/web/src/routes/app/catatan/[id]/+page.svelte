<script lang="ts">
	import { page } from "$app/state";
	import FormCatatan from "$lib/FormCatatan.svelte";
</script>

<FormCatatan id={page.params.id} />
