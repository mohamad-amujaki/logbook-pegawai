<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { gantiSandiSchema } from "@logbook/schemas";
	import { ApiError, api, type Me } from "$lib/api";

	let wajibGanti = $state(true);
	let sandiLama = $state("");
	let sandiBaru = $state("");
	let ulangiSandi = $state("");
	let error = $state("");
	let errorSandiLama = $state("");
	let errorSandiBaru = $state("");
	let errorUlangi = $state("");
	let loading = $state(false);

	let elSandiLama = $state<HTMLInputElement | null>(null);
	let elSandiBaru = $state<HTMLInputElement | null>(null);
	let elUlangi = $state<HTMLInputElement | null>(null);

	onMount(async () => {
		try {
			const me = await api<Me>("/me");
			wajibGanti = me.user.wajibGantiSandi;
		} catch {
			await goto("/login");
		}
	});

	function padaSandiLama() {
		errorSandiLama = "";
		error = "";
	}

	function padaSandiBaru() {
		errorSandiBaru = "";
		error = "";
	}

	function padaUlangi() {
		errorUlangi = "";
		error = "";
	}

	async function simpan(e: Event) {
		e.preventDefault();
		if (loading) return;
		error = "";
		errorSandiLama = "";
		errorSandiBaru = "";
		errorUlangi = "";

		const hasil = gantiSandiSchema.safeParse({
			sandiLama: wajibGanti ? undefined : sandiLama,
			sandiBaru,
			ulangiSandi,
		});
		if (!hasil.success) {
			for (const isu of hasil.error.issues) {
				if (isu.path[0] === "sandiLama") errorSandiLama = isu.message;
				else if (isu.path[0] === "sandiBaru") errorSandiBaru = isu.message;
				else if (isu.path[0] === "ulangiSandi") errorUlangi = isu.message;
			}
			if (errorSandiLama) elSandiLama?.focus();
			else if (errorSandiBaru) elSandiBaru?.focus();
			else if (errorUlangi) elUlangi?.focus();
			return;
		}

		loading = true;
		try {
			await api("/auth/ganti-sandi", {
				method: "POST",
				body: JSON.stringify(hasil.data),
			});
			await goto("/app");
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.field === "sandiLama") {
					errorSandiLama = err.message;
					elSandiLama?.focus();
				} else if (err.field === "sandiBaru") {
					errorSandiBaru = err.message;
					elSandiBaru?.focus();
				} else if (err.field === "ulangiSandi") {
					errorUlangi = err.message;
					elUlangi?.focus();
				} else {
					error = err.message;
				}
			} else {
				error = "Gagal menyimpan. Periksa jaringan, lalu coba lagi.";
			}
		} finally {
			loading = false;
		}
	}
</script>

<main
	class="mx-auto flex min-h-dvh max-w-[400px] flex-col justify-center px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] py-[max(1.5rem,env(safe-area-inset-bottom))]"
>
	<img src="/logo-kemenkes.png" alt="Kemenkes" class="mb-8 h-12 w-auto object-contain object-left" />
	<h1 class="text-xl font-semibold">Ganti kata sandi</h1>
	<p class="mt-1 text-sm text-muted">
		{wajibGanti ? "Pakai sandi baru sebelum mengisi catatan." : "Masukkan sandi saat ini, lalu sandi baru."}
	</p>

	<form class="mt-8 space-y-4" method="post" action="/api/auth/ganti-sandi" onsubmit={simpan}>
		{#if !wajibGanti}
			<div>
				<label class="block text-sm" for="sandi-lama">Sandi saat ini</label>
				<input
					id="sandi-lama"
					name="sandiLama"
					class="mt-1 min-h-11 w-full rounded-md border px-3 py-2"
					class:border-error={errorSandiLama}
					class:border-border={!errorSandiLama}
					type="password"
					autocomplete="current-password"
					aria-invalid={errorSandiLama ? "true" : undefined}
					aria-describedby={errorSandiLama ? "galat-sandi-lama" : undefined}
					bind:value={sandiLama}
					oninput={padaSandiLama}
					bind:this={elSandiLama}
				/>
				{#if errorSandiLama}<p id="galat-sandi-lama" class="mt-1 text-sm text-error" role="alert">{errorSandiLama}</p>{/if}
			</div>
		{/if}
		<div>
			<label class="block text-sm" for="sandi-baru">Sandi baru</label>
			<input
				id="sandi-baru"
				name="sandiBaru"
				class="mt-1 min-h-11 w-full rounded-md border px-3 py-2"
				class:border-error={errorSandiBaru}
				class:border-border={!errorSandiBaru}
				type="password"
				autocomplete="new-password"
				aria-invalid={errorSandiBaru ? "true" : undefined}
				aria-describedby={errorSandiBaru ? "galat-sandi-baru" : undefined}
				bind:value={sandiBaru}
				oninput={padaSandiBaru}
				bind:this={elSandiBaru}
			/>
			{#if errorSandiBaru}<p id="galat-sandi-baru" class="mt-1 text-sm text-error" role="alert">{errorSandiBaru}</p>{/if}
		</div>
		<div>
			<label class="block text-sm" for="ulangi-sandi">Ulangi sandi</label>
			<input
				id="ulangi-sandi"
				name="ulangiSandi"
				class="mt-1 min-h-11 w-full rounded-md border px-3 py-2"
				class:border-error={errorUlangi}
				class:border-border={!errorUlangi}
				type="password"
				autocomplete="new-password"
				aria-invalid={errorUlangi ? "true" : undefined}
				aria-describedby={errorUlangi ? "galat-ulangi-sandi" : undefined}
				bind:value={ulangiSandi}
				oninput={padaUlangi}
				bind:this={elUlangi}
			/>
			{#if errorUlangi}<p id="galat-ulangi-sandi" class="mt-1 text-sm text-error" role="alert">{errorUlangi}</p>{/if}
		</div>
		{#if error}
			<p class="text-sm text-error" role="alert">{error}</p>
		{/if}
		<button
			type="submit"
			class="min-h-11 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
			disabled={loading}
			aria-busy={loading ? "true" : undefined}
		>
			{loading ? "Menyimpan..." : "Simpan"}
		</button>
	</form>
</main>
