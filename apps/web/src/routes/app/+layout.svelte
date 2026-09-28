<script lang="ts">
	import { onMount } from "svelte";
	import { afterNavigate, goto } from "$app/navigation";
	import { page } from "$app/state";
	import { api, type Me, type OrangRingkas } from "$lib/api";
	import AvatarInisial from "$lib/AvatarInisial.svelte";

	let { children, data } = $props();
	let me = $state<Me | null>(data.me);

	$effect(() => {
		me = data.me;
	});
	let panel = $state(false);
	let menuProfil = $state(false);
	let bungkusProfil = $state<HTMLDivElement | null>(null);
	let notifs = $state<
		{ id: string; judul: string; isi: string; tautan: string | null; dibaca: boolean; createdAt: string }[]
	>([]);

	const tautan = [
		{ href: "/app", label: "Beranda", tepat: true },
		{ href: "/app/catatan", label: "Catatan" },
		{ href: "/app/skp", label: "SKP" },
		{ href: "/app/jke", label: "JKE" },
		{ href: "/app/validasi", label: "Validasi" },
	];

	onMount(() => {
		function klikLuar(e: MouseEvent) {
			if (bungkusProfil && !bungkusProfil.contains(e.target as Node)) menuProfil = false;
		}
		function padaEscape(e: KeyboardEvent) {
			if (e.key === "Escape") {
				menuProfil = false;
				panel = false;
			}
		}
		document.addEventListener("click", klikLuar);
		document.addEventListener("keydown", padaEscape);

		return () => {
			document.removeEventListener("click", klikLuar);
			document.removeEventListener("keydown", padaEscape);
		};
	});

	afterNavigate(() => {
		menuProfil = false;
		panel = false;
	});

	function aktif(href: string, tepat = false) {
		if (tepat) return page.url.pathname === href;
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}

	async function bukaNotif() {
		menuProfil = false;
		panel = !panel;
		if (panel) notifs = await api("/notifikasi");
	}

	async function bukaProfil() {
		panel = false;
		menuProfil = !menuProfil;
		if (menuProfil) me = await api<Me>("/me");
	}

	async function baca(n: (typeof notifs)[0]) {
		await api(`/notifikasi/${n.id}/baca`, { method: "POST" });
		if (n.tautan) await goto(n.tautan);
		panel = false;
		me = await api<Me>("/me");
	}

	async function keluar() {
		await api("/auth/logout", { method: "POST" });
		await goto("/login");
	}

	function namaAtasan(orang: OrangRingkas | null) {
		return orang?.namaLengkap ?? "Belum dipilih";
	}
</script>

{#if me}
	<div class="min-h-screen">
		<header class="sticky top-0 z-30 border-b border-border-strong bg-surface">
			<div
				class="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-3 gap-y-1 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:flex-nowrap sm:gap-x-4 sm:py-3 sm:pt-[max(0.75rem,env(safe-area-inset-top))]"
			>
				<img src="/logo-kemenkes.png" alt="Kemenkes" class="h-7 w-auto shrink-0 sm:h-8" />
				<nav
					class="nav-geser order-last flex w-full min-w-0 flex-nowrap gap-1 text-sm sm:order-none sm:w-auto sm:flex-1 sm:gap-3"
				>
					{#each tautan as t}
						<a
							class="inline-flex shrink-0 items-center px-2 py-2 hover:text-accent sm:px-0 sm:py-0"
							class:text-accent={aktif(t.href, t.tepat)}
							class:font-medium={aktif(t.href, t.tepat)}
							href={t.href}>{t.label}</a
						>
					{/each}
					{#if me.user.isAdmin || me.user.isKepalaBiro}
						<a
							class="inline-flex shrink-0 items-center px-2 py-2 hover:text-accent sm:px-0 sm:py-0"
							class:text-accent={aktif("/app/master")}
							class:font-medium={aktif("/app/master")}
							href="/app/master">Master</a
						>
					{/if}
				</nav>
				<div class="relative z-20 ml-auto flex shrink-0 items-center gap-1 sm:ml-0 sm:gap-2">
					<button
						class="relative inline-flex h-11 w-11 items-center justify-center text-text hover:text-accent"
						onclick={(e) => {
							e.stopPropagation();
							void bukaNotif();
						}}
						type="button"
						aria-label="Notifikasi"
						aria-expanded={panel}
					>
						<svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
							<path
								stroke="currentColor"
								stroke-width="1.5"
								d="M10 3.5c-2.4 0-4 1.7-4 4.2v2.1c0 .6-.3 1.2-.8 1.6L4.5 12h11l-.7-.6c-.5-.4-.8-1-.8-1.6V7.7c0-2.5-1.6-4.2-4-4.2Z"
							/>
							<path stroke="currentColor" stroke-width="1.5" d="M8.2 14.2a1.8 1.8 0 0 0 3.6 0" />
						</svg>
						{#if me.belumDibaca > 0}
							<span class="absolute right-1 top-1 h-2 w-2 bg-brand"></span>
						{/if}
					</button>
					<div class="relative" bind:this={bungkusProfil}>
						<button
							class="inline-flex h-11 w-11 items-center justify-center"
							onclick={(e) => {
								e.stopPropagation();
								void bukaProfil();
							}}
							type="button"
							aria-label="Profil pegawai"
							aria-expanded={menuProfil}
							aria-haspopup="menu"
						>
							<AvatarInisial nama={me.user.namaLengkap} />
						</button>
						{#if menuProfil}
							<div
								class="absolute right-0 z-40 mt-2 max-h-[min(28rem,calc(100dvh-5rem))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto border border-border-strong bg-surface p-4 shadow-[0_1px_2px_rgba(20,48,51,0.06)]"
								role="menu"
							>
								<p class="text-xs font-medium uppercase tracking-wide text-muted">Pegawai</p>
								<div class="mt-2 flex items-start gap-3">
									<AvatarInisial nama={me.user.namaLengkap} ukuran="sm" />
									<div class="min-w-0">
										<p class="text-sm font-medium">{me.user.namaLengkap}</p>
										<p class="font-mono text-xs text-muted">{me.user.nip}</p>
										<p class="mt-1 text-xs text-muted">{me.user.jabatan}</p>
										<p class="text-xs text-muted">{me.user.timNama ?? "Belum ada tim kerja"}</p>
									</div>
								</div>

								<p class="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Pemberi pertimbangan</p>
								<p class="mt-1 text-sm" class:text-muted={!me.pemberiPertimbangan}>
									{namaAtasan(me.pemberiPertimbangan)}
								</p>
								{#if me.pemberiPertimbangan}
									<p class="text-xs text-muted">{me.pemberiPertimbangan.jabatan}</p>
								{/if}

								<p class="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Pejabat penilai kinerja</p>
								<p class="mt-1 text-sm" class:text-muted={!me.pejabatPenilai}>
									{namaAtasan(me.pejabatPenilai)}
								</p>
								{#if me.pejabatPenilai}
									<p class="text-xs text-muted">{me.pejabatPenilai.jabatan}</p>
								{/if}

								<p class="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Atasan pejabat penilai</p>
								<p class="mt-1 text-sm" class:text-muted={!me.atasanPejabatPenilai}>
									{namaAtasan(me.atasanPejabatPenilai)}
								</p>
								{#if me.atasanPejabatPenilai}
									<p class="text-xs text-muted">{me.atasanPejabatPenilai.jabatan}</p>
								{/if}

								<div class="mt-4 flex items-center justify-between border-t border-border pt-3">
									<a class="text-sm text-accent" href="/app/skp?ubah=1">Ubah atasan</a>
									<button class="text-sm text-accent" onclick={keluar} type="button">Keluar</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</header>

		{#if panel}
			<button
				class="fixed inset-0 z-20 bg-[rgb(20_48_51/0.28)] sm:hidden"
				type="button"
				aria-label="Tutup notifikasi"
				onclick={() => (panel = false)}
			></button>
			<aside
				class="fixed inset-x-0 bottom-0 z-40 max-h-[80dvh] w-full overflow-auto border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-auto sm:right-0 sm:top-14 sm:h-[70vh] sm:max-w-[400px] sm:border-l sm:border-t-0 sm:pb-4"
			>
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-lg font-semibold">Notifikasi</h2>
					<button
						class="text-xs text-accent"
						type="button"
						onclick={async () => {
							await api("/notifikasi/baca-semua", { method: "POST" });
							notifs = await api("/notifikasi");
							me = await api<Me>("/me");
						}}>Tandai semua dibaca</button
					>
				</div>
				{#if notifs.length === 0}
					<p class="text-sm text-muted">Tidak ada notifikasi.</p>
				{:else}
					<ul class="space-y-3">
						{#each notifs as n}
							<li>
								<button class="w-full text-left" type="button" onclick={() => baca(n)}>
									<p class="text-sm font-medium" class:text-muted={n.dibaca}>{n.judul}</p>
									<p class="text-sm">{n.isi}</p>
									<p class="font-mono text-xs text-muted">{n.createdAt}</p>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</aside>
		{/if}

		<main
			class="mx-auto max-w-[1120px] px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
		>
			{@render children()}
		</main>
	</div>
{:else}
	<p class="p-8 text-sm text-muted">Membuka logbook...</p>
{/if}
