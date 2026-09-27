# DESIGN — Logbook Kinerja Pegawai ASN Kemenkes

| Field | Value |
|-------|-------|
| **Versi** | 2.0 |
| **Status** | Siap eksekusi |
| **Tanggal** | 27 September 2026 |
| **PRD** | [PRD.md](./PRD.md) v1.1 |
| **Logo** | [assets/logo-kemenkes.png](./assets/logo-kemenkes.png) |
| **Referensi visual** | Editorial / data-first (umkm.vantis.sh) — **bukan** warna terracotta atau navy generik |

Dokumen ini adalah kontrak UI. Setiap screen baru dicek ke sini sebelum diterima.

---

## Review v1.0 (template yang diganti)

File sebelumnya adalah sisa aplikasi **Kehadiran Rapat**: navy `#1E3A8A`, screen tiket/QR, copy “Welcome back”, stack Svelte. Itu sendiri AI slop — identitas instansi diganti navy “pemerintahan generik”.

| Before (v1.0) | After (v2.0) | Why |
|---|---|---|
| Navy `#1E3A8A` sebagai accent | Cyan/teal dari logo Kemenkes | Navy adalah klise “gov template”; logo sudah punya identitas |
| Screen rapat, tiket, QR scan | Screen logbook, SKP, klasemen, validasi | Kontrak harus milik produk ini |
| Terracotta → navy sebagai “adaptasi formal” | Swatch logo + turunan aksesibel | Formal tidak berarti biru dongker |
| `kode_rapat` / `kode_tiket` di mono | NIP, menit, persen, kode produk | Mono untuk data identitas, bukan dekorasi |
| Stack Svelte diasumsikan | Komponen netral (belum pilih framework) | Prototype belum di-scaffold |

---

## 1. Design principles

Aplikasi kerja harian ASN. Terasa **resmi, cepat, dapat diaudit** — bukan SaaS startup dan bukan portal 2012.

1. **Editorial, bukan decorative** — hierarki dari tipe dan jarak, bukan warna atau ikon.
2. **Data-first** — klasemen, tabel catatan, stat jam efektif adalah UI utama.
3. **Mobile-first untuk input catatan** — form harian harus nyaman di HP.
4. **Desktop-first untuk atasan dan admin** — klasemen, validasi, master data.
5. **Restraint** — animasi hanya di momen jarang (lihat §8). Input harian tidak dianimasi.

North star: setiap screen terasa seperti alat kerja Biro OSDM yang sengaja dirancang, bukan template yang di-generate.

---

## 2. Anti-patterns (wajib dicek)

### Visual

```
❌ Gradient (ungu-biru, aurora, mesh, “health tech glow”)
❌ Glassmorphism / backdrop-blur
❌ shadow-lg / shadow-xl pada card
❌ rounded-2xl / rounded-3xl / rounded-full pada container
❌ Lebih dari 2 accent merek selain semantic
❌ Navy/purple generik “karena instansi”
❌ Latar lime `#D2DC02` flamboyan
❌ Abstract SVG / blob / 3D plus
❌ Dark mode di prototype
❌ Emoji sebagai ikon UI
❌ Ikon di setiap kartu statistik
❌ Sidebar ikon + label untuk ≤ 8 menu
❌ Hero “Transformasi Kinerja ASN”
```

### Layout

```
❌ Feature grid 3 kolom (ikon + judul + deskripsi)
❌ Card list untuk data tabular (klasemen dan catatan = tabel)
❌ Split-screen login (form kiri, ilustrasi kanan)
❌ FAB
❌ Breadcrumb untuk navigasi ≤ 2 level
```

### Copy

```
❌ "Welcome back, [nama]!"
❌ "Get Started" / "Streamline your workflow"
❌ "Oops!" / "Something went wrong"
❌ "Success! 🎉"
❌ "Loading..." (pakai "Memuat...")
```

### Komponen

```
❌ Tema default shadcn tanpa override token
❌ Toast ber-emoji
❌ Empty state ilustrasi generic
❌ Modal untuk aksi sederhana (utamakan inline)
❌ Progress bar gradient
```

---

## 3. Color identity — dari logo Kemenkes

Sampel piksel dari `assets/logo-kemenkes.png`:

| Peran di logo | Hex tepat | Catatan |
|---|---|---|
| Wordmark “Kemenkes” + lengan kanan atas plus | `#0CB5CC` | Cyan |
| Lengan kiri plus (teal) | `#17B2A0` | Teal |
| Lengan kanan bawah plus | `#D2DC02` | Lime |

`#0CB5CC` dan `#17B2A0` **gagal** kontras WCAG untuk teks kecil di atas putih. `#D2DC02` lebih buruk lagi. Jangan pakai swatch logo mentah untuk body text atau tombol berisi teks.

### 3.1 Token

```css
:root {
  /* Merek — hanya logo, mark 3px, angka besar */
  --color-brand-cyan:   #0CB5CC;
  --color-brand-teal:   #17B2A0;
  --color-brand-lime:   #D2DC02;

  /* Accent UI — cyan logo yang digelapkan agar ≥ 4.5:1 di atas putih */
  --color-accent:       #0A6E7A;
  --color-accent-hover: #085862;
  --color-accent-muted: #E6F6F8;

  /* Latar */
  --color-bg:           #F7FBFC;   /* off-white kebiruan, bukan stone generik */
  --color-surface:      #FFFFFF;
  --color-surface-alt:  #F1F7F8;

  /* Teks */
  --color-text:         #143033;   /* teal-black, bukan slate-900 Tailwind */
  --color-text-muted:   #5A7174;
  --color-text-inverse: #FFFFFF;

  /* Semantic — logbook, bukan “hadir rapat” */
  --color-success:      #0B6B4F;   /* jam efektif terpenuhi */
  --color-success-bg:   #E3F5EE;
  --color-warning:      #8A5A00;   /* kurang / overlap / perlu diskusi */
  --color-warning-bg:   #FBF3D9;
  --color-error:        #9B1C1C;   /* ditolak */
  --color-error-bg:     #FDECEC;
  --color-info:         #0A6E7A;   /* menunggu validasi — sama accent */
  --color-info-bg:      #E6F6F8;

  /* Border */
  --color-border:       #D5E3E6;
  --color-border-strong:#B7CDD1;
}
```

### 3.2 Aturan pakai

- Maks **satu** accent merek per screen untuk aksi: `--color-accent`.
- `--color-brand-cyan` hanya: logo, fokus ring tebal, angka stat besar.
- `--color-brand-lime` hanya: sepotong mark 3px (mis. indikator “terpenuhi” di klasemen) — **bukan** fill, **bukan** teks.
- `--color-brand-teal` tidak dipakai fill luas; cukup di logo.
- Semantic hanya untuk badge status, bukan background section.
- Jangan menambah ungu, oranye neon, atau navy “supaya lebih formal”.

### 3.3 Badge status logbook

| Status | Latar | Teks |
|---|---|---|
| `DRAFT` | `--color-surface-alt` | `--color-text-muted` |
| `SUBMIT` / menunggu | `--color-info-bg` | `--color-accent` |
| `TERVERIFIKASI` | `--color-success-bg` | `--color-success` |
| `DITOLAK` | `--color-error-bg` | `--color-error` |
| `PERLU DISKUSI` | `--color-warning-bg` | `--color-warning` |
| Jam efektif terpenuhi | `--color-success-bg` | `--color-success` |
| Jam efektif kurang | `--color-warning-bg` | `--color-warning` |
| 0 jam efektif | `--color-error-bg` | `--color-error` |
| Isi manual | `--color-accent-muted` | `--color-accent` |
| Non TUSI | `--color-surface-alt` | `--color-text-muted` |

---

## 4. Typography

```css
:root {
  --font-sans: 'Instrument Sans', 'Helvetica Neue', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', 'Consolas', monospace;

  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --text-3xl:  2rem;

  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;

  --leading-tight:   1.25;
  --leading-normal:  1.5;
  --tracking-wide:   0.05em;
}
```

- Satu sans untuk seluruh UI.
- Mono **hanya** untuk NIP, menit (`390`), persen klasemen, kode produk/tahapan, timestamp.
- IBM Plex Mono, bukan JetBrains — lebih netral untuk instansi, tetap tabular.

| Level | Size | Weight | Pakai |
|---|---|---|---|
| Display | `--text-3xl` | 700 | Angka jam efektif, peringkat |
| H1 | `--text-xl` | 600 | Judul halaman |
| H2 | `--text-lg` | 600 | Section |
| Body | `--text-base` | 400 | Label form, uraian |
| Small | `--text-sm` | 400 | Sel tabel, helper |
| Caption | `--text-xs` | 500 | Badge uppercase |

---

## 5. Spacing, radius, shadow

Base 4px. Radius maksimum **6px**. Card **tanpa shadow** — border saja.

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;

  --shadow-subtle: 0 1px 2px rgba(20, 48, 51, 0.06); /* dropdown/modal saja */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}
```

`rounded-full` hanya untuk avatar. Tidak ada `rounded-xl`.

---

## 6. Component patterns

Top nav horizontal, **bukan** sidebar. Max-width konten desktop 1120px. Ikon notifikasi di kanan nav, sebelum nama/Keluar.

### 6.1 Button

| Varian | Style | Pakai |
|---|---|---|
| Primary | bg accent, teks putih | Simpan, submit, setujui |
| Secondary | border accent, teks accent | Batal, ekspor |
| Ghost | teks accent, tanpa border | Aksi baris tabel |
| Danger | bg error, teks putih | Tolak |

`:active { transform: scale(0.97); }` wajib. Tidak ada tombol gradient atau pil.

### 6.2 Input

Label di atas field. Fokus: `border-color: var(--color-accent)`. Error di bawah field. Tidak ada floating label.

### 6.3 Stat grid

Border tipis, tanpa ikon, angka `tabular-nums` warna `--color-accent` atau `--color-brand-cyan` jika ≥ `--text-2xl`.

Prototype atasan — 3 kartu di atas klasemen:

```
┌────────────────┬────────────────┬────────────────┐
│  5,8 jam       │  62%           │  41%           │
│  RATA-RATA UNIT│  ≥ 6,5 JAM     │  TERTAUT KMK   │
└────────────────┴────────────────┴────────────────┘
```

### 6.4 Tabel klasemen

Kolom: peringkat, nama lengkap, NIP (mono), jabatan, jam efektif, % vs 6,5 jam, status, komposisi TUSI. Bukan kartu pegawai.

### 6.5 Form catatan (mobile)

Lebar max 480px. Urutan: jenis tugas → produk/tahapan atau isi manual → uraian → mulai/selesai → menit efektif → output → bukti → kategori → simpan/submit. Tombol submit full-width di HP.

---

## 7. Screen inventory (prototype)

| # | Screen | Prioritas | Layout |
|---|---|---|---|
| 1 | Login (NIP + sandi awal) | P0 | Form tengah, max 400px, logo Kemenkes, tanpa ilustrasi |
| 2 | Beranda ASN | P0 | Kartu jam efektif hari ini + daftar catatan singkat |
| 3 | Form catatan harian | P0 | Satu kolom, mobile-first |
| 4 | Daftar catatan | P0 | Tabel + filter |
| 5 | Antrian validasi atasan | P0 | Tabel + setujui/tolak |
| 6 | Klasemen unit & tim | P0 | 3 stat + tabel; filter harian/bulanan/rentang |
| 7 | Form SKP | P1 | Identitas + pilih atasan/penilai + RHK bertingkat |
| 8 | Master pegawai / tim / katalog | P1 | Tabel + form |
| 9 | Usulan isi manual (OSDM) | P1 | Tabel |
| 10 | Pusat notifikasi | P0 | Panel dari ikon nav, bukan halaman penuh |

### Login + ganti sandi awal

```
[logo Kemenkes]

Masuk
Logbook Kinerja

NIP        [ 198702172009121001 ]
Kata sandi [                    ]

[          MASUK          ]

Reset sandi: hubungi Admin Biro OSDM
```

Layar wajib ganti sandi (setelah login dengan sandi = NIP):

```
[logo Kemenkes]

Ganti kata sandi
Pakai sandi baru sebelum mengisi catatan.

Sandi baru       [                    ]
Ulangi sandi     [                    ]

[          SIMPAN          ]
```

Tanpa “Welcome back”, tanpa split art, tanpa kekuatan sandi berwarna-warni. NIP mono, `inputmode="numeric"`.

### Beranda setelah login (peran, bukan menu besar)

ASN: satu kartu jam efektif hari ini (target 6,5 jam) + daftar 5 catatan terakhir + aksi “Catatan baru”.

Pemberi pertimbangan: angka antrian menunggu + tautan Validasi + klasemen ringkas bawahan.

Kepala Biro / Admin: 3 stat unit (rata-rata, % ≥ 6,5 jam, % tertaut KMK) + klasemen + master.

Top nav: Catatan · SKP · Klasemen · Validasi (jika atasan) · Master (jika admin) · ikon notifikasi · Keluar.

### Pusat notifikasi

Ikon lonceng di nav, titik accent jika ada yang belum dibaca. Bukan toast bertumpuk, bukan email.

Klik → panel kanan (desktop) atau sheet penuh (HP), max ~400px:

```
Notifikasi                    Tandai semua dibaca

Catatan ditolak
Perbaiki uraian, lalu kirim lagi.     27 Sep 14:02
────────────────────────────────
Catatan disetujui
Verifikasi 27 Sep 13:40.              27 Sep 13:40
────────────────────────────────
Menunggu validasi
1 catatan dari Ahmad.                 27 Sep 13:12
```

- Baris belum dibaca: teks penuh + mark 3px accent di kiri (bukan latar meriah).
- Klik baris → buka catatan/usulan terkait, tandai dibaca.
- Kosong: “Tidak ada notifikasi.”
- Prototype hanya 3 pemicu: hasil validasi ke ASN, catatan baru ke pemberi pertimbangan, usulan katalog ditinjau ke pengusul.

---

## 8. Copy

Indonesia formal ringan. Tanpa emoji. Error menyebut field dan cara memperbaiki.

| Konteks | On-brand | AI slop |
|---|---|---|
| Login gagal | NIP atau kata sandi tidak sesuai | Oops! Something went wrong |
| Submit catatan | Catatan dikirim, menunggu validasi | Success! 🎉 |
| Tolak | Catatan ditolak. Perbaiki lalu kirim lagi | Your request was denied |
| Jam kurang | Jam efektif 4,2 dari 6,5 jam | You're behind on your goals! |
| Overlap waktu | Waktu tumpang tindih dengan catatan lain | Warning |
| Isi manual | Belum ada di peta KMK — masuk masukan OSDM | Custom entry created |
| Kosong | Belum ada catatan hari ini | No data yet. Get started |
| Notifikasi kosong | Tidak ada notifikasi | You're all caught up! 🎉 |
| Catatan ditolak | Catatan ditolak. Perbaiki, lalu kirim lagi | Your request was denied |
| Memuat | Memuat... | Loading... |
| Keluar | Keluar | Sign out |

---

## 9. Motion

Input catatan dan ketik NIP: **tanpa** animasi.

| Momen | Boleh | Durasi |
|---|---|---|
| Hover / fokus field | CSS 150ms, properti spesifik | 150ms |
| Buka modal tolak | Fade + 4px slide, ease-out | 180ms |
| Angka klasemen (jarang) | Counter delta | ≤ 400ms |
| Tombol tekan | scale(0.97) | 80ms |

Tidak menganimasikan: buka form catatan, pindah tab klasemen, filter tanggal, keyboard shortcut.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Vibe coding protocol

Sebelum screen pertama: token CSS, font, logo, komponen Button / Input / Badge / Table / StatGrid / TopNav.

Template prompt:

```
Buatkan [screen] sesuai DESIGN.md dan PRD.md.

Accent: #0A6E7A (bukan navy, bukan purple)
Brand mark: #0CB5CC hanya logo/angka besar; lime #D2DC02 hanya mark 3px
Bg: #F7FBFC · teks: #143033 · radius max 6px · card tanpa shadow
Font: Instrument Sans; IBM Plex Mono untuk NIP/menit/kode
Copy: Indonesia formal ringan, tanpa emoji

NO gradient, NO rounded-2xl, NO sidebar, NO hero, NO ilustrasi login
Data tabular = tabel
```

### Checklist terima UI

| # | Cek |
|---|---|
| 1 | Accent hanya teal Kemenkes, bukan navy/purple? |
| 2 | Lime tidak dipakai fill atau teks? |
| 3 | Satu sans + mono hanya untuk NIP/angka? |
| 4 | Radius ≤ 6px? |
| 5 | Card tanpa shadow-lg? |
| 6 | Copy Indonesia, tanpa emoji? |
| 7 | Klasemen/catatan = tabel? |
| 8 | Form catatan nyaman di 390px? |
| 9 | Logo Kemenkes di login/header, tidak diganti ikon generik? |
| 10 | Tidak ada gradient? |
| 11 | Button punya `:active`? |
| 12 | `prefers-reduced-motion`? |

---

**Status:** DESIGN.md v2.0 adalah kontrak visual Logbook Kemenkes. Pakai bersama PRD.md setiap kali UI dibuat.
