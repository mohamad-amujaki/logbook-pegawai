<script lang="ts">
	import IkonAksi from "./IkonAksi.svelte";

	export type OpsiKatalog = {
		id: string;
		label: string;
		sub?: string;
		detail?: string;
	};

	let {
		label = "",
		placeholder = "Ketik nama atau kode…",
		pesanKosong = "Tidak ada yang cocok. Coba kata yang lebih pendek.",
		pesanNonaktif = "",
		satuan = "hasil",
		opsi,
		nilai,
		onubah,
		error = "",
		bolehKosong = true,
		disabled = false,
		bolehPin = false,
		disematkanIds = [],
		seringIds = [],
		onpin,
	}: {
		label?: string;
		placeholder?: string;
		pesanKosong?: string;
		pesanNonaktif?: string;
		satuan?: string;
		opsi: OpsiKatalog[];
		nilai: string;
		onubah: (id: string) => void;
		error?: string;
		bolehKosong?: boolean;
		disabled?: boolean;
		bolehPin?: boolean;
		disematkanIds?: string[];
		seringIds?: string[];
		onpin?: (id: string) => void;
	} = $props();

	let buka = $state(false);
	let kata = $state("");
	let aktif = $state(0);
	let akar: HTMLDivElement | undefined = $state();
	let kotak: HTMLInputElement | undefined = $state();

	const terpilih = $derived(opsi.find((o) => o.id === nilai) ?? null);
	const setSemat = $derived(new Set(disematkanIds));
	const setSering = $derived(new Set(seringIds));

	function cocok(o: OpsiKatalog, q: string) {
		if (!q) return true;
		const nama = o.label.toLowerCase();
		const sub = (o.sub ?? "").toLowerCase();
		const digits = q.replace(/\D/g, "");
		return nama.includes(q) || sub.includes(q) || (digits.length > 0 && sub.includes(digits));
	}

	const terfilter = $derived.by(() => {
		const q = kata.trim().toLowerCase();
		return opsi.filter((o) => cocok(o, q));
	});
	const grupSemat = $derived(terfilter.filter((o) => setSemat.has(o.id)));
	const grupSering = $derived(terfilter.filter((o) => setSering.has(o.id) && !setSemat.has(o.id)));
	const grupSemua = $derived(terfilter.filter((o) => !setSemat.has(o.id) && !setSering.has(o.id)));
	const datar = $derived([...grupSemat, ...grupSering, ...grupSemua]);
	const sedangCari = $derived(kata.trim().length > 0);

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

	function pilih(o: OpsiKatalog) {
		onubah(o.id);
		kata = "";
		buka = false;
	}

	function kosongkan() {
		onubah("");
		kata = "";
		buka = false;
	}

	function bukaCari() {
		if (disabled) return;
		buka = true;
		kata = "";
		queueMicrotask(() => kotak?.focus());
	}

	function keyboard(e: KeyboardEvent) {
		const batas = Math.max(datar.length - 1, 0);
		if (e.key === "ArrowDown") {
			e.preventDefault();
			buka = true;
			aktif = Math.min(aktif + 1, batas);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			aktif = Math.max(aktif - 1, 0);
		} else if (e.key === "Enter" && buka) {
			e.preventDefault();
			if (datar[aktif]) pilih(datar[aktif]);
		} else if (e.key === "Escape") {
			buka = false;
		}
	}

	function indeks(o: OpsiKatalog) {
		return datar.findIndex((x) => x.id === o.id);
	}
</script>

{#snippet baris(o: OpsiKatalog, i: number)}
	{@const nama = potong(o.label, kata.trim())}
	<li class="flex items-stretch">
		<button
			class="min-w-0 flex-1 px-3 py-2 text-left hover:bg-accent-muted"
			class:bg-accent-muted={i === aktif || o.id === nilai}
			type="button"
			onclick={() => pilih(o)}
		>
			<p class="whitespace-pre-wrap text-sm">
				{nama.a}<mark class="bg-transparent font-semibold text-accent">{nama.b}</mark>{nama.c}
			</p>
			{#if o.sub}
				<p class="font-mono text-xs text-muted">{o.sub}</p>
			{/if}
			{#if o.detail}
				<p class="text-xs text-muted">{o.detail}</p>
			{/if}
		</button>
		{#if bolehPin && onpin}
			<div class="flex items-start px-2 pt-2">
				<IkonAksi
					jenis="semat"
					label={setSemat.has(o.id) ? "Lepas" : "Sematkan"}
					hanyaIkon
					terisi={setSemat.has(o.id)}
					onklik={() => onpin(o.id)}
				/>
			</div>
		{/if}
	</li>
{/snippet}

<div class="relative space-y-1" class:z-10={buka} bind:this={akar}>
	{#if label}
		<p class="text-sm font-medium">{label}</p>
	{/if}

	{#if disabled}
		<div class="rounded-md border border-border px-3 py-2 text-sm text-muted">{pesanNonaktif}</div>
	{:else if terpilih && !buka}
		<div
			class="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
			class:border-error={error}
			class:border-border={!error}
		>
			<button class="min-w-0 flex-1 text-left" type="button" onclick={bukaCari}>
				<p class="line-clamp-2 whitespace-pre-wrap text-sm">{terpilih.label}</p>
				{#if terpilih.sub}
					<p class="font-mono text-xs text-muted">{terpilih.sub}</p>
				{/if}
			</button>
			<div class="flex shrink-0 items-center gap-3 pt-0.5">
				{#if bolehKosong}
					<button class="text-sm text-muted" type="button" onclick={kosongkan}>Hapus</button>
				{/if}
				<button class="text-sm text-accent" type="button" onclick={bukaCari}>Ganti</button>
			</div>
		</div>
	{:else}
		<input
			bind:this={kotak}
			class="min-h-11 w-full rounded-md border px-3 py-2 text-sm"
			class:border-error={error}
			class:border-border={!error}
			placeholder={placeholder}
			autocomplete="off"
			bind:value={kata}
			onfocus={() => (buka = true)}
			onkeydown={keyboard}
		/>
		{#if buka}
			<ul class="max-h-64 overflow-auto border border-border bg-surface">
				{#if sedangCari}
					{#each datar as o, i}
						{@render baris(o, i)}
					{/each}
				{:else}
					{#if grupSemat.length > 0}
						<li class="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted">Disematkan</li>
						{#each grupSemat as o}
							{@render baris(o, indeks(o))}
						{/each}
					{/if}
					{#if grupSering.length > 0}
						<li class="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted">Sering dipakai</li>
						{#each grupSering as o}
							{@render baris(o, indeks(o))}
						{/each}
					{/if}
					{#if grupSemua.length > 0}
						<li class="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted">Semua</li>
						{#each grupSemua as o}
							{@render baris(o, indeks(o))}
						{/each}
					{/if}
				{/if}
				{#if datar.length === 0}
					<li class="px-3 py-3 text-sm text-muted">{pesanKosong}</li>
				{/if}
			</ul>
			<p class="text-xs text-muted">{datar.length} {satuan}</p>
		{/if}
	{/if}

	{#if error}
		<p class="text-sm text-error">{error}</p>
	{/if}
</div>
