# Logbook Kinerja Pegawai ASN Kemenkes

Prototype web: catatan harian tertaut peta proses bisnis, jam kerja efektif 6,5 jam, validasi atasan, klasemen, notifikasi in-app.

Dokumen produk: [PRD.md](./PRD.md) · [DESIGN.md](./DESIGN.md) · [TECH.md](./TECH.md)

## Cara jalan (lokal)

Butuh [Bun](https://bun.sh).

```bash
bun install
bun run db:migrate
bun run db:seed
bun run dev:api    # terminal 1 — http://localhost:8787
bun run dev:web    # terminal 2 — http://localhost:5173
```

Sandi awal setiap pegawai = **NIP** (18 digit). Contoh:

| Peran | NIP |
|---|---|
| Product owner / admin | `198702172009121001` |
| Kepala Biro / admin | `198005022008122003` |
| Pegawai lain | lihat `data/duk-pegawai.json` |

Setelah login pertama, wajib ganti sandi.

## Peta folder (belajar dari sini)

```
packages/schemas    Aturan bisnis + Zod. Mulai dari jam-efektif.ts
packages/db         Tabel Drizzle, migrasi SQL, seed DUK
apps/api            Hono. Satu file route = satu urusan
apps/web            SvelteKit. Halaman di src/routes/app
```

Perhitungan jam efektif **hanya** di `packages/schemas/src/jam-efektif.ts` lalu diuji di `jam-efektif.test.ts`. Jangan hitung ulang di UI.

## Tes

```bash
bun run test
```

## Deploy (kemudian)

Ganti `@sveltejs/adapter-auto` ke `@sveltejs/adapter-cloudflare` di `apps/web`. API: Worker Hono + D1. Schema sama; ganti driver Drizzle ke `d1`. Jangan pakai file `local.db` yang sama dengan Workerd — itu yang membuat `SQLITE_BUSY` saat development.
