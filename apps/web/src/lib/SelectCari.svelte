<script lang="ts">
	export type OpsiCari = {
		id: string;
		label: string;
		sub?: string;
		detail?: string;
	};

	let {
		label = "",
		placeholder = "Ketik untuk mencari…",
		pesanKosong = "Tidak ada yang cocok. Coba kata yang lebih pendek.",
		satuan = "hasil",
		opsi,
		nilai,
		onubah,
		error = "",
		bolehKosong = true,
		bolehTambah = false,
		ontambah,
		minimalCari = 0,
		pesanKetik = "Ketik untuk mencari.",
	}: {
		label?: string;
		placeholder?: string;
		pesanKosong?: string;
		satuan?: string;
		opsi: OpsiCari[];
		nilai: string;
		onubah: (id: string) => void;
		error?: string;
		bolehKosong?: boolean;
		bolehTambah?: boolean;
		ontambah?: (teks: string) => void | Promise<void>;
		minimalCari?: number;
		pesanKetik?: string;
	} = $props();

	let buka = $state(false);
	let kata = $state("");
	let aktif = $state(0);
	let menambah = $state(false);
	let akar: HTMLDivElement | undefined = $state();
	let kotak: HTMLInputElement | undefined = $state();

	const terpilih = $derived(opsi.find((o) => o.id === nilai) ?? null);

	const cukupKetik = $derived(kata.trim().length >= minimalCari);

	const hasil = $derived.by(() => {
		if (!cukupKetik) return [];
		const q = kata.trim().toLowerCase();
		const digits = kata.replace(/\D/g, "");
		if (!q) return opsi;
		return opsi.filter((o) => {
			const nama = o.label.toLowerCase();
			const sub = (o.sub ?? "").toLowerCase();
			return nama.includes(q) || sub.includes(q) || (digits.length > 0 && sub.includes(digits));
		});
	});
	const bisaTambah = $derived.by(() => {
		const q = kata.trim();
		if (!bolehTambah || !ontambah || q.length < 3) return false;
		return !opsi.some((o) => o.label.toLowerCase() === q.toLowerCase());
	});
	const indeksTambah = $derived(bisaTambah ? hasil.length : -1);

	$effect(() => {
		kata;
		aktif = 0;
	});

	$effect(() => {
		if (!buka) return;
		function tutup(e: MouseEvent) {
			if (akar && !akar.contains(e.target as Node)) buka = false;
		}
		window.addEventListener("mousedown", tutup);
		return () => window.removeEventListener("mousedown", tutup);
	});

	function potong(teks: string, q: string): { a: string; b: string; c: string } {
		if (!q) return { a: teks, b: "", c: "" };
		const i = teks.toLowerCase().indexOf(q.toLowerCase());
		if (i < 0) return { a: teks, b: "", c: "" };
		return { a: teks.slice(0, i), b: teks.slice(i, i + q.length), c: teks.slice(i + q.length) };
	}

	function pilih(o: OpsiCari) {
		onubah(o.id);
		kata = "";
		buka = false;
	}

	async function tambah() {
		const q = kata.trim();
		if (!ontambah || q.length < 3 || menambah) return;
		menambah = true;
		try {
			await ontambah(q);
			kata = "";
			buka = false;
		} finally {
			menambah = false;
		}
	}

	function kosongkan() {
		onubah("");
		kata = "";
		buka = false;
	}

	function bukaCari() {
		buka = true;
		kata = "";
		queueMicrotask(() => kotak?.focus());
	}

	function keyboard(e: KeyboardEvent) {
		const batas = bisaTambah ? hasil.length : Math.max(hasil.length - 1, 0);
		if (e.key === "ArrowDown") {
			e.preventDefault();
			buka = true;
			aktif = Math.min(aktif + 1, batas);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			aktif = Math.max(aktif - 1, 0);
		} else if (e.key === "Enter" && buka) {
			e.preventDefault();
			if (bisaTambah && (hasil.length === 0 || aktif === indeksTambah)) tambah();
			else if (hasil[aktif]) pilih(hasil[aktif]);
		} else if (e.key === "Escape") {
			buka = false;
		}
	}
</script>

<div class="relative space-y-1" bind:this={akar}>
	{#if label}
		<p class="text-sm font-medium">{label}</p>
	{/if}

	{#if terpilih && !buka}
		<div
			class="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
			class:border-error={error}
			class:border-border={!error}
		>
			<button class="min-w-0 flex-1 text-left" type="button" onclick={bukaCari}>
				<p class="truncate text-sm">{terpilih.label}</p>
				{#if terpilih.sub}
					<p class="font-mono text-xs text-muted">{terpilih.sub}</p>
				{/if}
			</button>
			<div class="flex shrink-0 items-center gap-3">
				{#if bolehKosong}
					<button class="text-sm text-muted" type="button" onclick={kosongkan}>Hapus</button>
				{/if}
				<button class="text-sm text-accent" type="button" onclick={bukaCari}>Ganti</button>
			</div>
		</div>
	{:else}
		<input
			bind:this={kotak}
			class="w-full rounded-md border px-3 py-2 text-sm"
			class:border-error={error}
			class:border-border={!error}
			placeholder={placeholder}
			autocomplete="off"
			bind:value={kata}
			onfocus={() => (buka = true)}
			onkeydown={keyboard}
		/>
		{#if buka}
			<div
				class="absolute left-0 right-0 z-20 mt-px border border-border bg-surface shadow-[0_1px_2px_rgba(20,48,51,0.06)]"
			>
				<ul class="max-h-72 min-h-0 overflow-auto">
					{#if !cukupKetik}
						<li class="px-3 py-3 text-sm text-muted">{pesanKetik}</li>
					{:else}
						{#each hasil as o, i}
							{@const nama = potong(o.label, kata.trim())}
							<li>
								<button
									class="w-full px-3 py-2 text-left hover:bg-accent-muted"
									class:bg-accent-muted={i === aktif || o.id === nilai}
									type="button"
									onclick={() => pilih(o)}
								>
									<p class="text-sm">
										{nama.a}<mark class="bg-transparent font-semibold text-accent">{nama.b}</mark>{nama.c}
									</p>
									{#if o.sub}
										<p class="font-mono text-xs text-muted">{o.sub}</p>
									{/if}
									{#if o.detail}
										<p class="text-xs text-muted">{o.detail}</p>
									{/if}
								</button>
							</li>
						{/each}
						{#if hasil.length === 0 && !bisaTambah}
							<li class="px-3 py-3 text-sm text-muted">{pesanKosong}</li>
						{/if}
						{#if bisaTambah}
							<li>
								<button
									class="w-full px-3 py-2 text-left text-accent hover:bg-accent-muted disabled:opacity-60"
									class:bg-accent-muted={aktif === indeksTambah}
									type="button"
									disabled={menambah}
									onclick={tambah}>{menambah ? "Menambah…" : `Tambah “${kata.trim()}”`}</button
								>
							</li>
						{/if}
					{/if}
				</ul>
				{#if cukupKetik}
					<p class="border-t border-border px-3 py-1 text-xs text-muted">{hasil.length} {satuan}</p>
				{/if}
			</div>
		{/if}
	{/if}

	{#if error}
		<p class="text-sm text-error">{error}</p>
	{/if}
</div>
