<script lang="ts">
	export type Orang = {
		id: string;
		nip: string;
		namaLengkap: string;
		jabatan: string;
		timKerjaId: string | null;
		timNama: string | null;
	};

	let {
		label,
		cariPlaceholder = "Ketik nama atau NIP — hasil muncul langsung",
		daftar,
		tim,
		terpilih,
		error = "",
		kecualikanId = "",
		onpilih,
	}: {
		label: string;
		cariPlaceholder?: string;
		daftar: Orang[];
		tim: { id: string; nama: string }[];
		terpilih: Orang | null;
		error?: string;
		kecualikanId?: string;
		onpilih: (orang: Orang | null) => void;
	} = $props();

	let buka = $state(false);
	let kata = $state("");
	let timId = $state("");
	let aktif = $state(0);
	let kotak: HTMLInputElement | undefined = $state();

	function normal(teks: string) {
		return teks.toLowerCase().replace(/[.,']/g, " ").replace(/\s+/g, " ").trim();
	}

	const tersaring = $derived(
		daftar.filter((o) => o.id !== kecualikanId).filter((o) => !timId || o.timKerjaId === timId),
	);

	const hasil = $derived.by(() => {
		const q = normal(kata);
		const nipQ = kata.replace(/\D/g, "");
		if (!q && !nipQ) return tersaring.slice(0, 12);
		return tersaring
			.filter((o) => {
				const nama = normal(o.namaLengkap);
				return nama.includes(q) || (nipQ.length > 0 && o.nip.includes(nipQ));
			})
			.slice(0, 12);
	});

	$effect(() => {
		if (kata.length > 0) buka = true;
		aktif = 0;
	});

	function pilih(o: Orang) {
		onpilih(o);
		buka = false;
		kata = "";
	}

	function potong(teks: string, q: string): { a: string; b: string; c: string } {
		if (!q) return { a: teks, b: "", c: "" };
		const i = teks.toLowerCase().indexOf(q.toLowerCase());
		if (i < 0) return { a: teks, b: "", c: "" };
		return { a: teks.slice(0, i), b: teks.slice(i, i + q.length), c: teks.slice(i + q.length) };
	}

	function keyboard(e: KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			buka = true;
			aktif = Math.min(aktif + 1, Math.max(hasil.length - 1, 0));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			aktif = Math.max(aktif - 1, 0);
		} else if (e.key === "Enter" && buka && hasil[aktif]) {
			e.preventDefault();
			pilih(hasil[aktif]);
		} else if (e.key === "Escape") {
			buka = false;
		}
	}
</script>

<div class="space-y-1">
	<p class="text-sm font-medium">{label}</p>
	{#if terpilih && !buka}
		<div
			class="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
			class:border-error={error}
			class:border-border={!error}
		>
			<div>
				<p class="text-sm">{terpilih.namaLengkap}</p>
				<p class="font-mono text-xs text-muted">{terpilih.nip}</p>
				<p class="text-xs text-muted">{terpilih.jabatan}</p>
			</div>
			<button
				class="text-sm text-accent"
				type="button"
				onclick={() => {
					buka = true;
					queueMicrotask(() => kotak?.focus());
				}}>Ganti</button
			>
		</div>
	{:else}
		<div class="flex w-full flex-col gap-2 sm:flex-row">
			<input
				bind:this={kotak}
				class="min-h-11 min-w-0 w-full rounded-md border px-3 py-2 text-sm sm:flex-[3]"
				class:border-error={error}
				class:border-border={!error}
				placeholder={cariPlaceholder}
				autocomplete="off"
				bind:value={kata}
				onfocus={() => (buka = true)}
				onkeydown={keyboard}
			/>
			<select class="min-h-11 w-full rounded-md border border-border px-2 py-2 text-sm sm:w-48 sm:shrink-0" bind:value={timId}>
				<option value="">Semua tim</option>
				{#each tim as t}
					<option value={t.id}>{t.nama}</option>
				{/each}
			</select>
		</div>
		{#if kata.length === 0 && buka}
			<p class="text-xs text-muted">Mulai ketik — daftar tersaring tiap huruf, tanpa tekan Enter.</p>
		{/if}
		{#if buka}
			<ul class="max-h-72 overflow-auto border border-border bg-surface">
				{#each hasil as o, i}
					{@const nama = potong(o.namaLengkap, kata.trim())}
					<li>
						<button
							class="w-full px-3 py-2 text-left hover:bg-accent-muted"
							class:bg-accent-muted={i === aktif}
							type="button"
							onclick={() => pilih(o)}
						>
							<p class="text-sm">
								{nama.a}<mark class="bg-transparent font-semibold text-accent">{nama.b}</mark>{nama.c}
							</p>
							<p class="font-mono text-xs text-muted">{o.nip}</p>
							<p class="text-xs text-muted">{o.jabatan}{#if o.timNama} · {o.timNama}{/if}</p>
						</button>
					</li>
				{:else}
					<li class="px-3 py-3 text-sm text-muted">
						Tidak ada pegawai yang cocok dengan “{kata}”. Coba nama pendek (contoh: Handayani) atau pilih Semua tim.
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
	{#if error}
		<p class="text-sm text-error">{error}</p>
	{/if}
</div>
