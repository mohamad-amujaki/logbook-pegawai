# TECH — Logbook Kinerja Pegawai ASN Kemenkes

| Field | Value |
|-------|-------|
| **Versi** | 1.2 |
| **Status** | Terkunci hasil wawancara + realisasi prototype, 29 September 2026 |
| **PRD** | [PRD.md](./PRD.md) v1.4 |
| **DESIGN** | [DESIGN.md](./DESIGN.md) v2.1 |
| **Realisasi** | §Status implementasi (realisasi) + PRD §26 (rev. 1.3) dan §27 (rev. 1.4) |

---

## Stack terkunci

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Runtime / package | Bun terbaru | Workspace monorepo |
| Bahasa | TypeScript | Strict |
| UI | Svelte 5 | Rune, bukan Svelte 4 syntax |
| Bundler UI | Vite | |
| CSS | Tailwind CSS terbaru | Token dari DESIGN.md; v4 CSS-first |
| API | Hono | Worker-friendly |
| Validasi | Zod + `@hono/zod-validator` | Schema dipakai bersama UI dan API |
| ORM | Drizzle | |
| Database lokal | SQLite | Dev |
| Database produksi | Cloudflare D1 | SQLite di edge |
| Deploy | Cloudflare Workers (web via `@sveltejs/adapter-cloudflare`, API Worker) + D1 | |
| Lint/format | Biome | Ganti ESLint + Prettier |
| Git hooks | Husky | `biome check` di pre-commit |
| Tes | Vitest | Unit + tes schema/aturan jam efektif |
| Auth prototype | NIP + kata sandi awal | Bukan SSO |
| Notifikasi | Tabel di DB + endpoint Hono; panel dimuat saat ikon lonceng dibuka | Belum polling, bukan email, bukan push |

---

## Status implementasi (realisasi)

Kondisi kode per 29 September 2026 (rincian lengkap di [PRD.md](./PRD.md) §26 untuk rev. 1.3 dan §27 untuk rev. 1.4):

| Lapisan | Realisasi |
|---|---|
| Runtime / package | Bun (Bun workspaces) |
| Web | SvelteKit 2 · Svelte 5 (runes `$state`/`$props`/`$derived`) · Vite 7 · Tailwind CSS 4 (`@tailwindcss/vite`) |
| API | Hono 4 · `@hono/zod-validator` · `basePath /api` · cookie sesi httpOnly · Worker dengan handler `fetch` + `scheduled` (cron harian 00:00 WIB) |
| DB | Drizzle ORM 0.44 · `bun:sqlite` (dev, `local.db`) · Cloudflare D1 (prod) · 19 tabel |
| Validasi | Zod 3 di `packages/schemas`, dipakai bersama UI dan API |
| Auth | Akun terpisah (`akun`, `akun_peran`, `audit_log`); PBKDF2-SHA256 100.000 iterasi + salt 16 byte (Web Crypto); cookie `logbook_sesi` httpOnly, SameSite=Lax, 7 hari; wajib ganti sandi sebelum mengakses aplikasi |
| Lint/format | Biome **2.5.14** (dipin di `devDependencies` root); `bun run check` hijau |
| Tes | Vitest: aturan jam efektif + backdate + auto-verifikasi (`packages/schemas`), otorisasi & laporan (`apps/api`) |

Fitur rev. 1.3–1.4 yang terpasang: manajemen akun/peran + audit akun, lima jenis laporan kinerja dengan ekspor PDF/XLSX, tampilan kalender catatan, alur **Non Tusi** tanpa katalog/SKP, **jendela backdate 4 hari**, dan **auto-verifikasi validasi** setelah 4 hari (penanda `divalidasi_otomatis`).

Belum terpasang: impor/ekspor Excel master dan katalog, kurasi usulan katalog, konfigurasi jam kerja/kalender libur, delegasi validasi + reminder/email, multi-tautan bukti, dan unggah berkas.

---

## Rekomendasi yang belum Anda sebut (usul, belum dikunci)

### Wajib ada agar stack ini jalan

| Item | Mengapa |
|---|---|
| **SvelteKit** (bukan Vite SPA polos) | Routing screen PRD, form, adapter Cloudflare resmi. Tetap Svelte 5 + Vite di dalam. |
| **wrangler** | Migrasi D1, secret, deploy. |
| **drizzle-kit** | Generate/apply migration ke SQLite lokal dan D1. |
| **Bun workspaces** | `apps/web`, `apps/api`, `packages/db`, `packages/schemas`. |
| **Hash sandi yang aman di Workers** | `bcrypt` berat/tidak cocok di Cloudflare. **Realisasi:** Web Crypto PBKDF2-SHA256 100.000 iterasi. |
| **Sesi di D1 + cookie httpOnly** | Bisa cabut akses; JWT murni sulit di-revoke. **Realisasi:** cookie `logbook_sesi`. |
| **Zona waktu Asia/Jakarta** | SQLite simpan UTC; tampilan `WIB`. **Realisasi:** `tanggalWib()` (offset tetap UTC+7) dipakai untuk aturan backdate; format tampilan lain masih mengikuti zona runtime. |
| **Seed dari DUK** | Script impor `data/LAPORAN DUK Pegawai Biro OSDM.xlsx`. **Realisasi:** `bun run db:seed` dari `data/duk-pegawai.json`. |

### Sebaiknya ada di prototype

| Item | Mengapa |
|---|---|
| **Cloudflare adapter** untuk web | Satu jalur deploy, bukan dua cara berbeda. |
| **Rate limit login** | NIP + sandi awal (NIP) mudah ditembak. |
| **lint-staged** + Husky | Hanya berkas yang berubah yang di-Biome. |
| **Vitest** untuk rumus jam efektif | 80 vs 120, Non TUSI = 0, tolak tidak terakumulasi. |
| **`xlsx` (SheetJS)** | Sudah dipakai untuk ekspor laporan PDF/XLSX; impor master belum ada. |
| **`wrangler types`** | Binding `D1Database` ter-type. |

### Ditunda (selaras PRD)

- R2 (unggah bukti) — prototype tautan URL.
- SSO / OAuth.
- Postgres / Neon.
- Playwright e2e — boleh belakangan.
- Turbo/Nx — Bun workspace cukup.

---

## D1 — batasan yang harus diterima

- Cocok untuk 120–300 pegawai prototype. Jangan anggap ini Postgres.
- Foreign key harus diaktifkan sadar (D1/SQLite sering default off).
- Transaksi dan query berat terbatas. Klasemen harian dihitung di query sederhana atau tabel rekap.
- File tidak masuk D1. Bukti = URL.
- Dev: file SQLite lokal via Drizzle. Prod: D1. Satu schema, dua driver.

---

## Struktur monorepo (aktual)

```
apps/web          SvelteKit + Svelte 5 + Tailwind + Vite
apps/api          Hono (Worker terpisah, root /api)
packages/db       Drizzle schema + klien bun:sqlite + migrasi inline
packages/schemas  Zod: catatan, SKP, auth, validasi, jam efektif
```

Catatan: `packages/config` pada usulan awal **tidak dibuat**; konfigurasi Biome dan TSConfig di root (`biome.json`, `tsconfig.base.json`). Skema tidak digenerate `drizzle-kit`: `packages/db/src/migrate.ts` menjalankan DDL idempoten untuk SQLite lokal, sedangkan D1 memakai `packages/db/migrations/*.sql` via `wrangler d1 migrations apply`.

API dan form memakai **schema Zod yang sama** — itu alasan monorepo, bukan banyak package kosmetik.

---

## Auth prototype

1. Impor DUK → pegawai (`bun run db:migrate` lalu `bun run db:seed`).
2. Sandi awal = NIP, di-hash PBKDF2, flag `wajib_ganti_sandi`.
3. Login: NIP + sandi → sesi DB → cookie `logbook_sesi` httpOnly, `SameSite=Lax` (tambahkan `Secure` saat produksi HTTPS).
4. Ganti sandi di login pertama.
5. Logout hapus sesi.
6. Rate limit login in-memory: 10 percobaan / 15 menit per NIP.
7. Kredensial dan lifecycle akses berada di `akun`; peran di `akun_peran` (`ADMIN`, `KEPALA_BIRO`, `PENGELOLA_UNIT` dengan cakupan unit). Relasi validasi diturunkan dari SKP, bukan peran manual.
8. Middleware `requireAuth` menolak akses dengan kode `WAJIB_GANTI_SANDI` kecuali ke `/auth/ganti-sandi`, `/auth/logout`, dan `/me`.
9. Penangguhan akun, reset sandi, dan penonaktifan pegawai mencabut sesi aktif; administrator aktif terakhir dilindungi.

---

## Keputusan tambahan (27 September 2026)

| Topik | Keputusan |
|---|---|
| Frontend | **SvelteKit** (Svelte 5 + Vite + adapter Cloudflare) |
| Backend | **Hono** sebagai API terpisah (`apps/api` Worker) |
| Akun | **Semua NIP** di DUK bisa login |
| Sandi awal | NIP, wajib diganti di login pertama |

### Topologi deploy

```
Cloudflare Pages / SvelteKit  →  apps/web
Cloudflare Worker (Hono)      →  apps/api   /api/*
Cloudflare D1                 →  packages/db
```

Web tidak menulis SQL langsung. Semua lewat Hono. Schema Zod di `packages/schemas`.

### UX login (semua NIP)

Tujuan: 110 orang bisa masuk tanpa pelatihan, tanpa terasa portal 2010 atau SaaS generik.

1. Satu kolom, max 400px, logo Kemenkes, judul “Masuk”, dua field: NIP dan kata sandi.
2. NIP: input `inputmode="numeric"`, `autocomplete="username"`, mono, strip spasi/tanda petik.
3. Sandi: `autocomplete="current-password"`. Login pertama: sandi = NIP.
4. Setelah sandi awal terdeteksi → **wajib ganti sandi** sebelum masuk beranda (bukan toast, satu layar penuh).
5. Ganti sandi: sandi baru ≠ NIP, minimal 8 karakter, konfirmasi. Tanpa “Welcome back”.
6. Lupa sandi prototype: **tidak ada self-service**. Teks: “Hubungi Admin Biro OSDM untuk reset.” Admin reset ke NIP.
7. Error spesifik: “NIP tidak terdaftar” vs “Kata sandi tidak sesuai” — untuk demo internal ini boleh; jangan samakan pesannya agar user 110 orang tidak bingung NIP-nya belum ter-seed.
8. Setelah masuk, beranda menyesuaikan peran (bukan satu dashboard penuh menu):
   - ASN: jam efektif hari ini + tombol “Catatan baru”
   - Pemberi pertimbangan: antrian validasi + klasemen tim/bawahan
   - Kepala Biro & Admin: 3 kartu unit + klasemen + tautan master
9. Top nav pendek: Catatan, SKP, Klasemen, (Validasi jika atasan), (Master jika admin), nama + Keluar. Maksimal 6 tautan.
10. First-run: jika SKP belum ada, banner satu baris “Lengkapi SKP — pilih pemberi pertimbangan dan pejabat penilai.” Bukan wizard 5 langkah.

Detail token dan anti-slop: [DESIGN.md](./DESIGN.md).
