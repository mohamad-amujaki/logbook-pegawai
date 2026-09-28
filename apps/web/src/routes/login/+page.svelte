<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { loginSchema } from "@logbook/schemas";
	import { ApiError, api } from "$lib/api";

	let nip = $state("");
	let sandi = $state("");
	let error = $state(page.url.searchParams.get("galat") ?? "");
	let errorNip = $state("");
	let errorSandi = $state("");
	let loading = $state(false);
	let tampilSandi = $state(false);

	let elNip = $state<HTMLInputElement | null>(null);
	let elSandi = $state<HTMLInputElement | null>(null);

	function padaNip(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const bersih = input.value.replace(/\D/g, "").slice(0, 18);
		input.value = bersih;
		nip = bersih;
		errorNip = "";
		error = "";
	}

	function padaSandi() {
		errorSandi = "";
		error = "";
	}

	async function masuk(e: Event) {
		e.preventDefault();
		if (loading) return;
		error = "";
		errorNip = "";
		errorSandi = "";

		const hasil = loginSchema.safeParse({ nip, sandi });
		if (!hasil.success) {
			for (const isu of hasil.error.issues) {
				if (isu.path[0] === "nip") errorNip = isu.message;
				else if (isu.path[0] === "sandi") errorSandi = isu.message;
			}
			if (errorNip) elNip?.focus();
			else if (errorSandi) elSandi?.focus();
			return;
		}

		loading = true;
		try {
			const res = await api<{ wajibGantiSandi: boolean }>("/auth/login", {
				method: "POST",
				body: JSON.stringify(hasil.data),
			});
			await goto(res.wajibGantiSandi ? "/ganti-sandi" : "/app");
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.field === "nip") {
					errorNip = err.message;
					elNip?.focus();
				} else if (err.field === "sandi") {
					errorSandi = err.message;
					elSandi?.focus();
				} else {
					error = err.message;
				}
			} else {
				error = "Gagal masuk. Periksa jaringan, lalu coba lagi.";
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
	<h1 class="text-xl font-semibold">Masuk</h1>
	<p class="mt-1 text-sm text-muted">Logbook Kinerja</p>

	<form class="mt-8 space-y-4" method="post" action="/api/auth/login" onsubmit={masuk}>
		<div>
			<label class="block text-sm" for="nip">NIP</label>
			<input
				id="nip"
				name="nip"
				class="mt-1 min-h-11 w-full rounded-md border px-3 py-2 font-mono"
				class:border-error={errorNip}
				class:border-border={!errorNip}
				inputmode="numeric"
				maxlength="18"
				autocomplete="username"
				autocapitalize="off"
				spellcheck="false"
				aria-invalid={errorNip ? "true" : undefined}
				aria-describedby={errorNip ? "galat-nip" : undefined}
				value={nip}
				oninput={padaNip}
				bind:this={elNip}
			/>
			{#if errorNip}<p id="galat-nip" class="mt-1 text-sm text-error" role="alert">{errorNip}</p>{/if}
		</div>
		<div>
			<div class="flex items-baseline justify-between">
				<label class="block text-sm" for="sandi">Kata sandi</label>
				<button
					type="button"
					class="text-xs text-accent hover:underline"
					aria-pressed={tampilSandi}
					aria-controls="sandi"
					onclick={() => (tampilSandi = !tampilSandi)}
				>
					{tampilSandi ? "Sembunyikan" : "Tampilkan"}
				</button>
			</div>
			<input
				id="sandi"
				name="sandi"
				class="mt-1 min-h-11 w-full rounded-md border px-3 py-2"
				class:border-error={errorSandi}
				class:border-border={!errorSandi}
				type={tampilSandi ? "text" : "password"}
				autocomplete="current-password"
				aria-invalid={errorSandi ? "true" : undefined}
				aria-describedby={errorSandi ? "galat-sandi" : undefined}
				bind:value={sandi}
				oninput={padaSandi}
				bind:this={elSandi}
			/>
			{#if errorSandi}<p id="galat-sandi" class="mt-1 text-sm text-error" role="alert">{errorSandi}</p>{/if}
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
			{loading ? "Memuat..." : "Masuk"}
		</button>
	</form>
	<p class="mt-6 text-xs text-muted">Reset sandi: hubungi Admin Biro OSDM. Sandi awal = NIP.</p>
</main>
