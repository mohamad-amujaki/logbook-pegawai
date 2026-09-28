# PRD — Logbook Kinerja Pegawai ASN Kementerian Kesehatan

| Atribut | Isi |
|---|---|
| Nama produk | Logbook Kinerja Pegawai ASN Kemenkes |
| Versi | 1.3 |
| Status | Prototype produksi — sinkron dengan implementasi dan rollout |
| Tanggal | 28 September 2026 (rev. 1.3 — Access, Reports, and UX Overhaul) |
| Pemilik produk | Product owner, pegawai Biro OSDM |
| Realisasi | §26 Status implementasi produksi rev. 1.3 (kondisi kode saat ini) |
| Sumber konsep awal | [Percakapan DeepSeek](https://chat.deepseek.com/share/v2zpxd9idx6a3kgvsz) |
| Referensi resmi | KMK HK.01.07/MENKES/65/2026; Standar Interoperabilitas Logbook Kemenkes v1 2026.09.26 |
| Tech | [TECH.md](./TECH.md) — Svelte 5, Bun, Hono, Zod, Drizzle, SQLite/D1, Cloudflare |
| Audiens | Product owner, Biro OSDM, atasan, tim pengembang, keamanan informasi |

Dokumen ini merangkum konsep awal, hasil review, keputusan wawancara product owner (27 September 2026), dan realisasi produk sampai rollout 28 September 2026. Rilis pertama adalah **prototype aplikasi terpisah** yang melengkapi e-Kinerja, dipakai internal Biro OSDM untuk demo ke pimpinan.

---

## 1. Ringkasan eksekutif

Logbook Kinerja adalah aplikasi web terpisah untuk menyempurnakan pencatatan harian yang sudah ada di e-Kinerja. Masalah yang harus dijawab: atasan tidak melihat produktivitas; jam kerja efektif (bisa di dalam atau di luar jam kantor) tidak terukur; dan catatan harian tidak menempel ke produk/tahapan pada peta proses bisnis KMK 65/2026.

Di aplikasi lama, mengisi satu atau banyak catatan tidak beda; waktu mulai, waktu selesai, dan jumlah output tidak terlihat. Prototype ini menampilkan ketiga field itu, menautkan catatan ke produk/tahapan (atau isi manual sebagai masukan OSDM), dan menampilkan klasemen pemenuhan jam kerja efektif per pegawai, per unit, serta rata-rata unit.

Produk ini **bukan pengganti absensi** dan **bukan pengganti e-Kinerja**. Interoperabilitas ke e-Kinerja, Srikandi, SIMKA, dan SILK lewat API Hub adalah fase berikutnya.

---

## 2. Latar belakang dan masalah

e-Kinerja sudah dipakai, tetapi tidak menjawab tiga kebutuhan Biro OSDM:

1. Atasan tidak bisa melihat siapa yang produktif di jam kerja, siapa yang masuk tetapi minim kinerja, atau siapa yang sering tidak berkinerja.
2. Jam kerja efektif tidak dihitung. Kerja di luar jam kantor dan kerja di dalam jam kantor sama-sama perlu tercatat, lalu dibandingkan dengan target efektif 6,5 jam (bukan 7,5 jam kehadiran).
3. Catatan harian tidak terkorelasi dengan produk dan tahapan pada Keputusan Menteri Kesehatan nomor HK.01.07/MENKES/65/2026 tentang proses bisnis di lingkungan Kemenkes.

Yang memaksa pengisian adalah atasan langsung. Unit pertama: Biro OSDM (~120 orang), lalu piloting Biro Umum (~200 orang). Prototype internal OSDM dipakai untuk demo ke pimpinan.

Regulasi dan acuan: KMK 65/2026, UU ASN, PP 30/2019, PermenPANRB 6/2022, UU PDP 27/2022, Standar Interoperabilitas Logbook Kemenkes (pola API Hub mengikuti SATUSEHAT, onboarding belakangan).

---

## 3. Tujuan, non-tujuan, dan metrik

### 3.1 Tujuan

- Setiap catatan harian tertaut ke produk dan tahapan pada peta proses bisnis KMK, atau tercatat sebagai isi manual untuk kurasi OSDM.
- Pegawai dan atasan melihat pemenuhan jam kerja efektif per orang dan per unit organisasi.
- Atasan dapat menyetujui atau menolak catatan; yang ditolak tidak masuk akumulasi jam efektif.
- Master pegawai, SKP, dan katalog dapat diisi di prototype (form + impor Excel), tanpa menunggu interoperabilitas.
- Administrator dapat mengelola akses pengguna, status akun, peran, cakupan unit, reset sandi, dan pencabutan sesi tanpa menghapus riwayat kepegawaian.
- Pegawai dan pejabat yang berwenang dapat menyusun laporan formal dari dataset yang sama, sesuai cakupan akses, lalu mengunduh PDF atau XLSX.

### 3.2 Non-tujuan (sengaja tidak dikerjakan di prototype)

- Mengganti e-Kinerja atau menjadi sistem penilaian predikat akhir.
- Mengganti absensi / e-presensi.
- API Hub (Srikandi, SIMKA, SILK, e-Kinerja) — fase berikutnya.
- Persetujuan SKP oleh atasan — SKP cukup disimpan sebagai master.
- Kurasi lengkap peta KMK sampai level 6 digit sebelum demo.
- Mengaitkan angka jam efektif ke tunjangan atau sanksi.

### 3.3 Definisi berhasil (dari product owner)

Berhasil jika catatan harian terkoneksi ke produk dan tahapan dalam peta bisnis, serta pegawai dan atasan dapat melihat pemenuhan jam kerja efektif per pegawai dan per unit.

Metrik prototype / demo:

| Metrik | Cara baca |
|---|---|
| Klasemen pemenuhan jam efektif | Per pegawai di bawah koordinasi atasan, per unit, dan rata-rata unit |
| % catatan tertaut katalog KMK vs isi manual | Semakin banyak tertaut, katalog semakin dipakai |
| % catatan terverifikasi | Jam efektif resmi hanya dari yang disetujui |
| Rata-rata selisih durasi vs menit efektif | Bahan evaluasi kewajaran, bukan pengurang otomatis |

---

## 4. Pengguna dan persona

| Peran | Kebutuhan utama | Kekhawatiran |
|---|---|---|
| ASN | Input cepat, pin aktivitas, pantau jam kerja, unggah tautan bukti | Form panjang, katalog sulit dicari, dihakimi jika jam kurang |
| Atasan langsung | Antrian validasi singkat, bukti bisa dibuka, bulk approve akhir minggu | Volume catatan menumpuk, takut menyetujui data fiktif |
| Pejabat penilai | Rekap SKP dan logbook periode | Data tidak lengkap di akhir periode |
| Admin unit | Kelengkapan logbook unit, data pegawai unit | Mutasi dan atasan yang salah |
| Admin pusat / Biro OSDM | Master katalog, usulan baru, konfigurasi jam kerja, audit | Usulan manual menumpuk, data SIMPEG tidak bersih |
| Pimpinan | Dashboard agregat, bukan transaksi | Angka yang tidak bisa dijelaskan |

Peran “Penyusun SOP” dan “Verifikator SOP” dari konsep awal **tidak masuk MVP**. Cukup Admin Pusat dan Admin Unit untuk katalog. Workflow SOP formal ditunda sampai katalog stabil.

---

## 5. Ruang lingkup

### 5.1 In scope — prototype (rilis 1)

1. Login NIP + kata sandi awal, plus RBAC (ASN, atasan, admin OSDM, pimpinan).
2. Form master: unit, jabatan, pegawai, atasan, SKP (RHK, IKI, rencana aksi), katalog produk/tahapan sesuai struktur KMK.
3. Form catatan harian: jenis tugas, satu produk/tahapan (atau isi manual), uraian, output, mulai, selesai, menit efektif, tautan bukti, kategori Biasa/Perlu Diskusi.
4. Validasi atasan: setujui atau tolak; pegawai memperbaiki lalu diajukan lagi.
5. Dashboard jam kerja efektif (target 6,5 jam) + klasemen per unit kerja dan per tim kerja.
6. Antrian isi manual untuk Biro OSDM.
7. Impor/ekspor Excel master (setelah file sampel tersedia).
8. Pusat notifikasi in-app sederhana (bukan email).
9. Manajemen pengguna: aktivasi/penangguhan akun, reset sandi, pencabutan sesi, peran, cakupan unit, dan audit tindakan.
10. Laporan kinerja bercakupan peran: aktivitas harian, jam efektif terverifikasi, validasi, keterhubungan katalog, dan kelengkapan SKP; pratinjau serta ekspor PDF/XLSX.
11. Navigasi responsif berbasis kelompok pekerjaan, pemantauan, dan administrasi.

### 5.2 Out of scope — fase berikutnya

- API Hub dan entri otomatis `auto_validated`.
- Interoperabilitas e-Kinerja / SIMKA / SILK / Srikandi.
- Persetujuan workflow SKP.
- Kurasi penuh registry KMK level 6 digit.
- SSO, TTE, absensi, WhatsApp, mobile native.

---

## 6. Keputusan desain (hasil review konsep awal)

Bagian ini adalah rekomendasi agar konsep lebih dapat dibangun dan dipakai.

### 6.1 Satukan dokumen, jangan pecah per modul tanpa PRD induk

Konsep awal menghasilkan empat PRD modul yang bagus sebagai lampiran teknis, tetapi tidak punya satu sumber kebenaran: prioritas MVP, relasi antarmodul, dan apa yang sengaja tidak dikerjakan. Dokumen ini menjadi PRD induk. Detail API, DDL, dan wireframe pindah ke spesifikasi teknis.

### 6.2 Bedakan jam kerja tercatat, kehadiran, dan kinerja

Konsep awal memakai waktu efektif logbook sebagai pemenuhan jam kerja. Itu rawan dimanipulasi dan bentrok dengan aturan kehadiran.

Keputusan:

- Istilah baku UI:
  - **Waktu tercatat** = menit efektif catatan TUSI/TUSI Lainnya berstatus `SUBMIT` atau `TERVERIFIKASI`.
  - **Waktu terverifikasi** = menit efektif catatan TUSI/TUSI Lainnya berstatus `TERVERIFIKASI`.
  - **Jam kerja efektif** tetap dipakai sebagai nama konsep/rekap, bukan kehadiran atau absensi.
- Jam kantor resmi 7,5 jam. Target jam kerja efektif **6,5 jam (390 menit)** — 1 jam sisanya untuk istirahat, bank, poliklinik, temu kolega, atau kepentingan pribadi.
- Yang diakumulasi ke 6,5 jam: **menit efektif yang diisi pegawai** pada catatan **TUSI / TUSI Lainnya** yang **disetujui atasan**.
- Non TUSI **wajib dicatat** agar atasan melihat ke mana waktu pergi, tetapi **tidak menambah** jam efektif. Pegawai yang hanya mengisi Non TUSI tampil **0 jam efektif**.
- Durasi kalender = selesai − mulai. Jika menit efektif lebih kecil (contoh 80 dari 120), yang masuk akumulasi adalah 80. Selisihnya (40) tampil sebagai bahan evaluasi atasan, bukan pengurang otomatis.
- Jam efektif **tidak terikat jam kantor**; kerja di luar jam kerja tetap boleh dihitung jika jenisnya TUSI/TUSI Lainnya dan disetujui.
- Catatan ditolak: menitnya tidak terakumulasi sampai pegawai memperbaiki dan atasan menyetujui.
- Jangan menautkan tunjangan atau sanksi ke angka ini di prototype.

### 6.3 Hubungkan SKP dan logbook secara eksplisit

Konsep awal memisahkan SKP (RHK/IKI/aksi) dan logbook (produk/tahapan). Tanpa jembatan, logbook tidak membantu penilaian.

Keputusan:

- Setiap catatan **wajib** memilih jenis tugas: TUSI / TUSI Lainnya / Non TUSI.
- Setiap catatan menempel ke **tepat satu** produk/tahapan, atau isi manual jika belum ada di master.
- SKP di prototype cukup diinput sebagai master (identitas, RHK, IKI, target, satuan, rencana aksi). Tidak ada alur persetujuan SKP.
- Tautan catatan ke IKI/rencana aksi: opsional di prototype; boleh diisi jika master SKP sudah ada.

### 6.4 Rapikan hierarki katalog tanpa membuang data bisnis

Lima tingkat (Produk → Tahapan → Proses Bisnis → Proses Bisnis Turunan → Aktivitas SOP) terlalu dalam untuk input harian.

Keputusan:

- Model data tetap menyimpan hierarki lengkap sesuai kebutuhan Biro OSDM.
- Input harian hanya memilih **Produk, Tahapan, dan Aktivitas SOP**. Proses bisnis dan turunan tampil sebagai konteks, bukan langkah wajib.
- Jalan pintas utama: pin, sering digunakan, dan pencarian. Traversal pohon hanya untuk admin katalog dan kasus jarang.
- Aktivitas yang sudah dipakai di logbook tidak dihapus; hanya dinonaktifkan.

### 6.5 Isi manual adalah sinyal katalog, bukan jalan pintas permanen

Jika setiap pegawai bebas mengisi manual, katalog tidak pernah lengkap dan validasi atasan menjadi sulit.

Keputusan:

- Isi manual **diizinkan**. Atasan **tetap boleh menyetujui**.
- Entri manual masuk antrian masukan Biro OSDM untuk menambah produk/tahapan resmi KMK.
- Nama produk dan tahapan usulan wajib diisi jika toggle isi manual = Ya.

### 6.6 Bukti dukung: tautan dulu, unggah menyusul

Konsep awal hanya tautan URL. Link mati adalah risiko nyata.

Keputusan MVP:

- Bukti = URL + judul + jenis. Maksimal 5 tautan per catatan.
- Validasi skema `https://`. Whitelist domain dapat diaktifkan kemudian (kemenkes.go.id, SharePoint, Drive institusi).
- Atasan menandai bukti Sesuai / Tidak Sesuai.
- Unggah berkas, pemindaian virus, dan penyimpanan objek ditunda ke fase 2.
- Kewajiban bukti dikonfigurasi per jenis aktivitas; default wajib untuk TUSI.

### 6.7 Validasi atasan harus punya delegasi dan SLA

Konsep awal tidak mengatur atasan cuti atau atasan yang salah.

Keputusan:

- Relasi atasan **tidak** disimpan di master DUK. Relasi hidup di **form SKP** tahun berjalan.
- Setiap SKP wajib mengisi dua peran (boleh NIP yang sama):
  1. **Pemberi pertimbangan kinerja** — dalam produk ini disebut **atasan langsung**.
  2. **Pejabat penilai kinerja**.
- Keduanya harus pegawai yang sudah ada di master.
- Validasi catatan harian dan klasemen bawahan memakai **pemberi pertimbangan**. Pejabat penilai melihat rekap periode.
- Atasan dapat mendelegasikan validasi ke pegawai lain untuk rentang tanggal, dengan jejak audit.
- SLA validasi default 3 hari kerja; reminder H+2 dan H+3.
- Bulk approve diizinkan, tetapi wajib konfirmasi dan tetap tercatat per catatan.
- Tolak vs revisi dibedakan: revisi mengembalikan ke pegawai; tolak dipakai jika catatan tidak sah (duplikat, fiktif, salah orang).

### 6.8 SKP mengikuti PermenPANRB 6/2022, versi 1 SKP aktif per tahun

Struktur mengikuti formulir e-Kinerja (contoh SKP product owner, 2026) plus child rencana aksi:

```
SKP (1 pegawai + 1 tahun)
 ├── Pemberi pertimbangan kinerja (atasan langsung) — wajib, FK pegawai
 ├── Pejabat penilai kinerja — wajib, FK pegawai (boleh sama dengan pemberi pertimbangan)
 └── A. Utama          ← prototype hanya ini; B. Tambahan fase berikutnya
      └── RHK Pimpinan yang Diintervensi (cascading)
           └── Rencana Hasil Kerja (1..n)
                ├── Aspek: Kuantitas | Kualitas | Waktu | Biaya
                ├── Indikator Kinerja Individu (1 per RHK)
                ├── Target tahunan (angka + satuan)
                └── Rencana Aksi (1..n, child IKI)
                     ├── Uraian rencana aksi
                     └── Target per triwulan: TW1, TW2, TW3, TW4
                          (wajib masing-masing; default 0)
```

- Identitas pegawai otomatis dari master. **Pegawai sendiri** memilih pemberi pertimbangan dan pejabat penilai di form SKP-nya, dari daftar master pegawai. Bukan diisi admin. Boleh NIP yang sama.
- Satu RHK pimpinan dapat diintervensi oleh banyak RHK individu.
- Setiap IKI wajib punya minimal satu rencana aksi. Target TW1–TW4 selalu ada, kosong diisi 0.
- Prototype: form input master. Tidak ada alur persetujuan SKP.
- Sinkron e-Kinerja: fase berikutnya.

### 6.9 Data pegawai: single source yang jujur

Jangan berjanji sinkron SIMPEG/SIASN di MVP.

Keputusan:

- Sumber impor prototype: file DUK Biro OSDM (110 baris, 1 sheet `LAPORAN DUK`).
- Kolom asli DUK: `nama_lengkap`, `nip`, `pangkat_golongan`, `tmt`, `jabatan`, `unit_kerja`.
- NIP di Excel berawalan `'` (teks); normalisasi ke 18 digit.
- `pangkat_golongan` di DUK = kode golongan saja (`III/d`, `IV/b`, juga `V`/`VII`/`IX` untuk PPPK), bukan “Penata Tk. I — III/d”.
- `tmt` = TMT golongan/jabatan (tanggal).
- Semua baris saat ini `unit_kerja` = “Biro Organisasi dan Sumber Daya Manusia”. Tidak ada bagian/tim.
- DUK **tidak punya** atasan — itu benar, karena atasan diisi di SKP.
- Jabatan struktural di file ini hanya 1: Kepala Biro. Sisanya JFT/JFU.

### 6.10 Potong fitur yang membuat MVP terlambat

Ditunda dari konsep awal: versioning SOP 5 versi, import katalog massal di hari pertama, skor kualitas 1–5 oleh atasan, WhatsApp, TTE, duplikasi SKP tahun lalu sebagai must, analitik beban kerja kementerian, mobile offline.

---

## 7. Alur bisnis utama

```
Admin OSDM mengisi master (pegawai, atasan, SKP, katalog KMK, target 6,5 jam)
        ↓
ASN mengisi catatan harian
  (jenis tugas + 1 produk/tahapan atau isi manual + waktu + output + kategori)
        ↓
Atasan setujui atau tolak
        ↓
Yang disetujui + TUSI/TUSI Lainnya → akumulasi jam efektif
Yang ditolak → tidak dihitung; pegawai perbaiki → diajukan lagi
Non TUSI disetujui → tercatat, 0 kontribusi ke jam efektif
        ↓
Klasemen atasan / unit + antrian isi manual untuk OSDM
```

Status catatan: `DRAFT` → `SUBMIT` → `TERVERIFIKASI` | `DITOLAK` (ditolak bisa diedit lalu submit ulang).

Status SKP prototype: `TERSIMPAN` saja.

---

## 8. Kebutuhan fungsional

Prioritas: **M** = Must MVP, **S** = Should pasca-MVP dekat, **C** = Could fase lanjut.

### 8.1 Autentikasi dan akses

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-AUTH-01 | Login dengan NIP dan kata sandi awal, sesi berbatas waktu, logout | M |
| FR-AUTH-02 | RBAC sesuai matriks peran | M |
| FR-AUTH-03 | Pegawai hanya melihat data sendiri, kecuali peran yang berwenang | M |
| FR-AUTH-04 | SSO Kemenkes / LDAP | S |
| FR-AUTH-05 | Reset kata sandi melalui email dinas | M |
| FR-AUTH-06 | Kredensial dan status akses disimpan di akun terpisah dari data organisasi pegawai | M |
| FR-AUTH-07 | Status akun AKTIF/DITANGGUHKAN, pencabutan seluruh sesi, dan wajib ganti sandi | M |
| FR-AUTH-08 | Peran ADMIN, KEPALA_BIRO, dan PENGELOLA_UNIT dengan cakupan unit kerja | M |
| FR-AUTH-09 | Administrator aktif terakhir dan peran administrator sendiri dilindungi dari pencabutan | M |

### 8.1b Manajemen pengguna

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-USR-01 | Daftar pengguna dengan pencarian serta filter unit, peran, dan status | M |
| FR-USR-02 | Administrator mengatur peran dan satu atau lebih cakupan unit Pengelola Unit | M |
| FR-USR-03 | Administrator menangguhkan/mengaktifkan akun dengan alasan | M |
| FR-USR-04 | Reset sandi menghasilkan sandi sementara sekali tampil, mewajibkan penggantian, dan mencabut sesi | M |
| FR-USR-05 | Tindakan keamanan/peran dicatat pada audit log append-only | M |

### 8.2 Modul Pegawai

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-PG-01 | CRUD pegawai: nama, NIP, pangkat, golongan, jabatan, unit kerja, status | M |
| FR-PG-02 | Mapping atasan tidak di master pegawai; dipilih di form SKP | M |
| FR-PG-03 | Soft-delete / nonaktif; pegawai nonaktif hilang dari dropdown transaksi | M |
| FR-PG-04 | Cari dan filter nama, NIP, unit, jabatan, status | M |
| FR-PG-05 | Import Excel dengan pratinjau dan laporan baris gagal | M |
| FR-PG-06 | Export Excel sesuai filter | M |
| FR-PG-07 | ASN mengedit email, nomor HP, foto | S |
| FR-PG-08 | Riwayat jabatan dan golongan | S |
| FR-PG-09 | Audit trail perubahan NIP, unit, jabatan, atasan | M |
| FR-PG-10 | Master unit kerja dan master jabatan | M |
| FR-PG-11 | Master tim kerja berelasi ke unit kerja; pegawai dianggotakan ke satu tim | M |
| FR-PG-11b | Tim kerja agile: admin dapat tambah, ubah nama, nonaktifkan, pindah anggota tanpa menunggu restruktur organisasi | M |

Validasi: NIP 18 digit unik; nama minimal 3 karakter; unit dan jabatan dari master; golongan dari master; hanya Admin Pusat mengubah NIP.

### 8.3 Modul SKP

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-SKP-01 | Buat 1 SKP aktif per pegawai per tahun; identitas otomatis | M |
| FR-SKP-01b | Pegawai sendiri wajib memilih pemberi pertimbangan (atasan langsung) dan pejabat penilai di SKP-nya; boleh NIP sama | M |
| FR-SKP-02 | CRUD RHK (nama, deskripsi, kategori utama/penunjang, urutan) | M |
| FR-SKP-03 | CRUD IKI (nama, aspek kuantitas/kualitas/waktu/biaya, target, satuan) | M |
| FR-SKP-04 | CRUD rencana aksi (≥1 per IKI): uraian + target TW1–TW4 (wajib, default 0) | M |
| FR-SKP-04b | Prototype hanya kelompok A. Utama | M |
| FR-SKP-05 | Submit, approve, revisi, tolak oleh atasan | C |
| FR-SKP-06 | Kunci edit setelah disetujui; buka lewat pengajuan revisi | C |
| FR-SKP-07 | Export PDF/Excel SKP | M |
| FR-SKP-08 | Master satuan | M |
| FR-SKP-09 | Dashboard kelengkapan SKP per unit | S |
| FR-SKP-10 | Duplikasi SKP tahun lalu | S |
| FR-SKP-11 | Cascading RHK dari SKP atasan | C |
| FR-SKP-12 | Sinkron e-Kinerja BKN | C |

### 8.4 Modul Produk dan Tahapan

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-KT-01 | CRUD Produk, Tahapan, Proses Bisnis, Proses Bisnis Turunan, Aktivitas SOP | M |
| FR-KT-02 | Aktivitas SOP punya uraian, norma waktu > 0, satuan default menit, output, status | M |
| FR-KT-03 | Pencarian katalog dan tampilan pohon untuk admin | M |
| FR-KT-04 | Pin produk, tahapan, atau aktivitas; maksimal 10 per tipe; bisa dilepas | M |
| FR-KT-05 | Daftar “sering digunakan” Top 10 dari 30 hari terakhir | S |
| FR-KT-06 | Nonaktifkan item yang sudah terpakai; jangan hard-delete | M |
| FR-KT-07 | Publish/nonaktif katalog per unit pemilik | M |
| FR-KT-08 | Total norma waktu per tahapan/produk | S |
| FR-KT-09 | Import/export katalog | S |
| FR-KT-10 | Versioning SOP | C |

Input pegawai memakai Produk + Tahapan + Aktivitas. Proses dan turunan tetap dikelola admin.

### 8.5 Modul Catatan Harian

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-LG-01 | Tambah catatan: jenis aktivitas, produk/tahapan/aktivitas, uraian, mulai, selesai, waktu efektif, jumlah dan satuan output | M |
| FR-LG-02 | Jenis aktivitas: TUSI, TUSI Lainnya, Non TUSI | M |
| FR-LG-03 | Pilih dari pin, pencarian, atau (kemudian) sering digunakan | M |
| FR-LG-04 | Isi manual jika item tidak ada; wajib nama produk dan tahapan usulan | M |
| FR-LG-05 | Usulan norma waktu opsional pada isi manual | M |
| FR-LG-06 | Tautan IKI atau rencana aksi SKP (opsional di prototype) | S |
| FR-LG-06b | Kategori Biasa / Perlu Diskusi | M |
| FR-LG-06c | Satu catatan = satu produk/tahapan | M |
| FR-LG-07 | Waktu efektif otomatis dari selisih mulai–selesai; boleh dikurangi dengan alasan | M |
| FR-LG-08 | Simpan draft, edit, submit | M |
| FR-LG-09 | Filter daftar: tanggal, jenis, produk, status | M |
| FR-LG-10 | Hapus hanya draft milik sendiri | M |
| FR-LG-11 | Duplikasi catatan ke hari yang sama atau berikutnya | S |
| FR-LG-12 | Tampilan kalender | S |

Validasi waktu:

- Selesai > mulai.
- Waktu efektif > 0 dan ≤ durasi mulai–selesai.
- Lintas hari diizinkan, tetapi diberi tanda.
- Total waktu efektif harian > 24 jam ditolak; > 10 jam diberi peringatan.
- Uraian minimal 10 karakter.
- Jumlah output > 0.
- Waktu tumpang tindih antar catatan tidak diblokir; sistem menampilkan peringatan/keterangan.
- Uraian Non TUSI bebas diketik (bukan dropdown baku).

### 8.6 Jam kerja tercatat

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-JK-01 | Akumulasi waktu efektif per hari, minggu, bulan | M |
| FR-JK-02 | Bandingkan dengan target konfigurabel; tampilkan terpenuhi / kurang / lebih / tidak ada catatan | M |
| FR-JK-03 | Kartu harian di beranda logbook | M |
| FR-JK-04 | Grafik mingguan dan bulanan | S |
| FR-JK-05 | Admin mengatur target, jam masuk/pulang, hari kerja per unit | M |
| FR-JK-06 | Kalender libur nasional dan cuti bersama mengecualikan target | M |
| FR-JK-07 | Pengecualian manual cuti/izin/sakit per pegawai | M |
| FR-JK-08 | Reminder in-app/email jika belum terpenuhi mendekati jam pulang | S |
| FR-JK-09 | Rekap atasan untuk bawahan | M |

Jam efektif resmi = menit efektif catatan **terverifikasi** berjenis TUSI atau TUSI Lainnya. Non TUSI dan catatan ditolak = 0. Draft/submit tampil sebagai angka sementara. Target default 390 menit/hari.

### 8.7 Bukti dukung

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-BD-01 | Tambah 0–5 tautan per catatan: judul, URL https, jenis, deskripsi | M |
| FR-BD-02 | Edit/hapus bukti sebelum terverifikasi | M |
| FR-BD-03 | Buka tautan dari form pegawai dan antrian atasan | M |
| FR-BD-04 | Wajib bukti untuk TUSI (konfigurabel) | M |
| FR-BD-05 | Atasan menandai Sesuai / Tidak Sesuai | S |
| FR-BD-06 | Unggah berkas | C |

### 8.8 Validasi atasan

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-VL-01 | Antrian catatan bawahan: menunggu, terlambat SLA, riwayat | M |
| FR-VL-02 | Setujui atau tolak; komentar wajib saat tolak; pegawai memperbaiki lalu submit ulang | M |
| FR-VL-03 | Lihat uraian, waktu, output, tautan SKP, bukti | M |
| FR-VL-04 | Delegasi validasi berjangka | M |
| FR-VL-05 | Bulk approve dengan konfirmasi | S |
| FR-VL-06 | Atasan boleh menyesuaikan waktu efektif dengan alasan | S |
| FR-VL-07 | Reminder SLA dan notifikasi hasil ke ASN | M |

### 8.9 Usulan katalog (Biro OSDM)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-US-01 | Setiap isi manual membuat usulan katalog | M |
| FR-US-02 | Daftar usulan dikelompokkan berdasarkan kemiripan nama | S |
| FR-US-03 | Setujui (buat item katalog + tautkan catatan) atau tolak dengan alasan | M |
| FR-US-04 | Notifikasi hasil ke pegawai pengusul | S |

### 8.10 Dashboard, laporan, notifikasi, audit

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-DB-01 | Beranda ASN: jam kerja hari ini, SKP aktif, catatan pending, pin | M |
| FR-DB-02 | Klasemen pemenuhan jam efektif: nama lengkap, NIP, jabatan; filter harian / bulanan / rentang tanggal | M |
| FR-DB-02b | Antrian validasi + selisih durasi vs menit efektif sebagai bahan evaluasi | M |
| FR-DB-02c | Agregat unit kerja terlihat oleh Kepala Biro dan Admin | M |
| FR-DB-02d | Klasemen per unit kerja dan per tim kerja | M |
| FR-DB-03 | Beranda OSDM: usulan katalog, kelengkapan unit piloting | M |
| FR-LP-01 | Export catatan, rekap jam kerja, SKP | M |
| FR-LP-02 | Katalog laporan: aktivitas harian, jam efektif terverifikasi, validasi, keterhubungan katalog, kelengkapan SKP | M |
| FR-LP-03 | Filter periode, Eselon I/unit/tim/pegawai sesuai cakupan akses server | M |
| FR-LP-04 | Pratinjau laporan menampilkan ringkasan dan detail dari dataset yang sama dengan ekspor | M |
| FR-LP-05 | Ekspor PDF dan XLSX biner berisi judul, filter, waktu/pembuat, ringkasan, dan detail | M |
| FR-NT-01 | Pusat notifikasi in-app: ikon di top nav + daftar; tanpa email di prototype | M |
| FR-NT-02 | Picu: catatan disetujui/ditolak, catatan masuk antrian atasan, usulan katalog ditinjau | M |
| FR-NT-03 | Tandai sudah dibaca; klik membuka catatan/SKP terkait | M |
| FR-NT-04 | Reminder jam efektif dan email | S |
| FR-AU-01 | Audit trail: siapa, kapan, apa, nilai lama/baru untuk data kritis | M |

---

## 9. Matriks peran

| Kapabilitas | ASN | Atasan | Penilai | Admin unit | Admin pusat / OSDM | Pimpinan |
|---|---|---|---|---|---|---|
| Isi logbook sendiri | Ya | Ya | Ya | Ya | Ya | Ya |
| Validasi bawahan | Tidak | Ya | Lihat | Tidak | Override darurat | Tidak |
| Kelola SKP sendiri | Ya | Ya | Ya | Ya | Ya | Ya |
| Pilih atasan & penilai di SKP sendiri | Ya | Ya | Ya | Ya | Ya | Ya |
| Setujui SKP bawahan | Tidak | Tidak (prototype) | Lihat | Tidak | Tidak | Tidak |
| CRUD pegawai unit sendiri | Tidak | Tidak | Tidak | Ya | Ya | Tidak |
| CRUD semua pegawai | Tidak | Tidak | Tidak | Tidak | Ya | Tidak |
| Kelola katalog | Tidak | Tidak | Tidak | Terbatas unit | Ya | Tidak |
| Tindak usulan katalog | Tidak | Tidak | Tidak | Tidak | Ya | Tidak |
| Atur target jam kerja | Tidak | Tidak | Tidak | Usulan | Ya | Tidak |
| Dashboard agregat | Sendiri | Bawahan | Yang dinilai | Unit | Semua | Ya |
| Delegasi validasi | Tidak | Ya | Tidak | Tidak | Ya | Tidak |

Override darurat Admin Pusat wajib beralasan dan masuk audit trail.

---

## 10. Model data ringkas (konsep)

> **Realisasi:** struktur tabel yang benar-benar dibuat berbeda dari konsep di bawah — lihat §25.4. Diagram ini adalah rancangan awal dan dipertahankan sebagai acuan.

```
unit_kerja ── tim_kerja ── anggota_tim
     │                 jabatan           master_satuan
     └──── pegawai ────┘                    │
            ├── akun ── akun_peran
            │     ├── sesi
            │     └── audit_log
            │                               │
            │                               │
            ├── skp
            │     ├── pemberi_pertimbangan_id ──► pegawai   (atasan langsung)
            │     ├── pejabat_penilai_id ──► pegawai        (boleh sama)
            │     └── rhk_pimpinan_diintervensi ── rhk ── (aspek, iki, target_tahunan)
            │                                              └── rencana_aksi
            │                                                   └── target_tw1..tw4 (wajib, default 0)
            │
            ├── pin_favorit
            ├── catatan_harian ── bukti_dukung
            │         ├── produk / tahapan / aktivitas_sop (nullable)
            │         ├── iki / rencana_aksi (nullable)
            │         └── usulan_katalog
            │
            ├── notifikasi (pegawai_id, judul, isi, dibaca, tautan, created_at)
            └── rekap_jam_kerja

produk ── tahapan ── proses_bisnis ── proses_bisnis_turunan ── aktivitas_sop
master_jam_kerja
kalender_libur
delegasi_validasi
```

Prinsip data:

- Soft-delete untuk master dan pegawai.
- Identitas organisasi pegawai dipisahkan dari kredensial, status akses, sesi, dan peran akun.
- `audit_log` bersifat append-only dan merekam aktor, target, aksi, alasan, serta nilai sebelum/sesudah.
- `catatan_harian.produk_id` / `tahapan_id` / `aktivitas_id` nullable jika `isi_manual = true`.
- `rekap_jam_kerja` dapat berupa tabel materialisasi yang dihitung ulang saat catatan berubah.
- Jangan simpan NIK/NPWP di MVP.

---

## 11. Aturan bisnis kritis

1. Satu SKP aktif per pegawai per tahun; di prototype hanya disimpan.
2. Satu catatan = satu produk/tahapan, atau isi manual.
3. Catatan terverifikasi terkunci sampai ditolak/dibuka ulang oleh atasan.
4. Jam efektif resmi hanya dari catatan terverifikasi berjenis TUSI atau TUSI Lainnya.
5. Non TUSI tercatat tetapi kontribusi jam efektif = 0.
6. Menit yang dihitung = menit efektif input pegawai; selisih vs durasi = bahan evaluasi.
7. Catatan ditolak tidak terakumulasi; pegawai boleh memperbaiki dan mengajukan lagi.
8. Isi manual boleh disetujui atasan dan selalu masuk masukan OSDM.
9. Target efektif default 6,5 jam; jam kantor 7,5 jam hanya konteks, bukan pembatas input.
10. Sistem tidak menolak input hanya karena jam efektif kurang.

---

## 12. Integrasi

| Sistem | MVP | Kemudian | Tujuan |
|---|---|---|---|
| Import Excel master | Ya (setelah file sampel) | — | Bootstrap prototype |
| e-Kinerja (aplikasi existing) | Tidak | Ya | Interoperabilitas |
| API Hub (Srikandi, SIMKA, SILK, dll.) | Tidak | Ya | Entri otomatis |
| SSO Kemenkes | Tidak | Ya | Autentikasi institusi |
| Absensi / e-presensi | Tidak | Ya | Bukan sumber jam efektif |

---

## 13. Kepatuhan, privasi, dan keamanan

- Data pribadi minimal: nama, NIP, kontak, foto opsional. Dasar pemrosesan: pelaksanaan tugas pemerintahan.
- Hak akses berdasarkan unit dan relasi atasan. Jangan membuka seluruh kementerian ke semua atasan.
- HTTPS, hashing kata sandi, proteksi CSRF, rate limit login, session timeout.
- Audit trail tidak boleh dihapus lewat UI.
- Backup harian, retensi mengikuti kebijakan arsip Kemenkes (usulan: logbook 5 tahun, audit 10 tahun).
- Hosting sesuai kebijakan TIK Kemenkes / Government Cloud.
- Klasifikasi data: terbatas. Ekspor massal hanya admin.
- Tidak menampilkan data pegawai nonaktif di pencarian publik internal kecuali admin.

---

## 14. Kebutuhan non-fungsional

| Area | Syarat |
|---|---|
| Performa | Form catatan < 2 detik; daftar 10.000 pegawai terpaginasi < 3 detik; pohon katalog lazy-load |
| Ketersediaan | 99,5% pada hari dan jam kerja |
| Kapasitas awal | 1.000 pengguna bersamaan di lingkungan piloting; arsitektur siap naik ke seluruh Kemenkes |
| Peramban | Chrome, Edge, Firefox versi 2 tahun terakhir; Safari iOS |
| Perangkat | Desktop dan HP; input catatan harus nyaman di layar 390px |
| Autosave | Draft catatan dan SKP tersimpan setiap 30 detik |
| Observabilitas | Log aplikasi, error tracking, uptime check |
| Bahasa | Indonesia |

---

## 15. Pengalaman pengguna (prinsip)

1. Input catatan harian selesai dalam ≤ 60 detik jika memakai pin.
2. Pin dan pencarian lebih penting daripada pohon lima tingkat.
3. Jam kerja hari ini selalu terlihat tanpa menghitung manual.
4. Form tidak menampilkan field admin (proses bisnis turunan, versi SOP) ke ASN.
5. Pesan error menyebut field dan cara memperbaiki, bukan kode teknis.
6. Atasan melihat bukti dan waktu di satu layar, tanpa buka banyak tab wajib.
7. Kosongkan state: jika belum ada SKP, beranda menuntun buat SKP dulu, bukan menampilkan form logbook yang gagal diam-diam.

---

## 16. Kriteria penerimaan produk (MVP)

1. Admin dapat menambah pegawai, atasan, SKP, dan item katalog, lalu pegawai dapat login.
2. ASN dapat mengisi catatan dengan waktu mulai, selesai, menit efektif, output, jenis tugas, dan satu produk/tahapan atau isi manual.
3. Non TUSI tampil di riwayat tetapi tidak menambah jam efektif.
4. Jika menit efektif < durasi, akumulasi memakai menit efektif dan selisih tampil di layar atasan.
5. Atasan dapat setujui/tolak; yang ditolak hilang dari akumulasi sampai diperbaiki dan disetujui.
6. Klasemen menampilkan pemenuhan vs 6,5 jam per bawahan, per unit, dan rata-rata unit.
7. Isi manual yang disetujui tetap masuk antrian masukan Biro OSDM.
8. Kategori Biasa / Perlu Diskusi tersimpan dan dapat difilter atasan.

---

## 17. Roadmap

| Fase | Isi | Hasil yang diharapkan |
|---|---|---|
| 0 — Prototype | Form master + catatan + validasi + klasemen; data Biro OSDM ~120 orang | Demo ke pimpinan |
| 1 — Piloting | Biro Umum ~200 orang; impor Excel; kurasi katalog KMK bertahap | Dipakai harian di 2 biro |
| 2 — Adopsi | SSO, grouping usulan, grafik, unggah bukti | Gesekan input turun |
| 3 — Interoperabilitas | API Hub ke Srikandi, SIMKA, SILK, e-Kinerja | Entri otomatis, lebih sedikit input manual |
| 4 — Skala | Norma waktu vs aktual, analitik kementerian | Dipakai lintas eselon |

Jangan memperluas ke seluruh Kemenkes sebelum unit piloting mencapai metrik isian harian dan SLA validasi.

---

## 18. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Logbook dipakai sebagai absensi gelap | Konflik aturan, data dimanipulasi | Label “jam kerja tercatat”; validasi atasan; jangan tautkan tunjangan |
| Katalog kosong di hari pertama | Isi manual meledak | Seed katalog unit piloting sebelum go-live |
| Atasan tidak memvalidasi | Rekap resmi kosong | SLA, reminder, delegasi, dashboard keterlambatan |
| Relasi atasan salah | Antrian masuk ke orang yang tidak berwenang | Admin unit wajib review mapping sebelum piloting |
| Form terlalu panjang | Adopsi rendah | Pin, autosave, field admin disembunyikan |
| Usulan katalog menumpuk | OSDM kewalahan | Grouping kemiripan, kuota tinjauan, top-N |
| Link bukti mati | Validasi semu | Fase 2 unggah; atasan menandai tidak sesuai |
| Integrasi BKN terlambat | Ekspektasi salah | Kontrak MVP tanpa e-Kinerja |
| PDP / data berlebih | Risiko hukum | Minimalkan field pegawai |
| Performa pohon katalog | Admin frustrasi | Lazy-load, pencarian, bukan render 1.000 node sekaligus |

---

## 19. Asumsi dan pertanyaan terbuka

### Asumsi (terkunci wawancara)

- Product owner = pegawai Biro OSDM.
- Aplikasi terpisah dari e-Kinerja; fokus prototype.
- Target jam efektif 6,5 jam; jam kantor 7,5 jam.
- Katalog merujuk KMK 65/2026, belum dikurasi; cukup form master.
- File sampel Excel akan disiapkan product owner per sheet.
- Pengguna prototype: internal OSDM untuk demo pimpinan; perluasan Biro Umum belakangan.

### Pertanyaan yang masih terbuka

Sandi awal prototype: NIP, wajib diganti setelah login pertama (kecuali product owner menetapkan lain).

---

## 20. Catatan review terhadap konsep DeepSeek

Yang sudah kuat dan dipertahankan:

- Empat modul sesuai permintaan bisnis.
- Hierarki SKP RHK → IKI → rencana aksi triwulanan.
- Isi manual sebagai umpan balik ke Biro OSDM.
- Pin dan sering digunakan untuk mempercepat input.
- Validasi atasan, bukti dukung, dan pemantauan jam kerja.

Yang diperbaiki di dokumen ini:

- Ada PRD induk, non-tujuan, dan MVP yang tegas.
- Jam kerja diposisikan sebagai jam tercatat, bukan absensi.
- SKP dan logbook dihubungkan.
- Hierarki katalog diringkas di UX.
- Delegasi atasan dan SLA ditambahkan.
- Field PDP yang tidak perlu dibuang dari MVP.
- Integrasi eksternal diturunkan dari janji menjadi fase.
- Metrik dibuat lebih sulit dimanipulasi.
- Peran SOP formal dipotong dari MVP.

---

## 21. Lampiran — definisi istilah

| Istilah | Arti |
|---|---|
| ASN | Aparatur Sipil Negara, termasuk PNS dan PPPK kecuali aturan unit memisahkan |
| SKP | Sasaran Kinerja Pegawai periode tahunan |
| RHK | Rencana Hasil Kerja |
| IKI | Indikator Kinerja Individu |
| TUSI | Tugas pokok dan fungsi jabatan |
| Norma waktu | Standar menit untuk menyelesaikan satu aktivitas SOP |
| Jam kerja tercatat | Akumulasi waktu efektif logbook, bukan kehadiran resmi |
| Isi manual | Entri produk/tahapan yang belum ada di katalog |
| Pin | Pintasan personal ke item katalog |
| OSDM | Organisasi dan Sumber Daya Manusia |
| Jam kerja efektif | Akumulasi menit efektif catatan TUSI/TUSI Lainnya yang disetujui; target 6,5 jam |
| Durasi kalender | Selisih waktu selesai − mulai; pembanding evaluasi, bukan angka akumulasi |
| KMK 65/2026 | Keputusan Menteri Kesehatan tentang peta proses bisnis |

---

## 22. Keputusan terkunci dari wawancara (27 September 2026)

| Topik | Keputusan |
|---|---|
| Peran narasumber | Product owner + pegawai Biro OSDM |
| Hubungan e-Kinerja | Aplikasi terpisah; menyempurnakan; interoperabilitas belakangan |
| Sukses | Catatan tertaut peta bisnis + visibilitas jam efektif per orang/unit |
| Target | 7,5 jam kantor; 6,5 jam efektif |
| Angka akumulasi | Menit efektif yang diisi pegawai (contoh 80), bukan durasi 120 |
| Selisih durasi vs efektif | Bahan evaluasi atasan |
| Non TUSI | Dicatat, tidak dihitung; hanya Non TUSI = 0 jam efektif |
| Validasi | Setujui / tolak; ditolak tidak terakumulasi; bisa diperbaiki |
| Isi manual | Boleh; atasan boleh setujui; jadi masukan OSDM |
| Kardinalitas | Satu catatan = satu produk/tahapan |
| SKP | Master/input saja di rilis 1 |
| Kategori | Biasa / Perlu Diskusi dipakai di prototype |
| API Hub | Fase berikutnya |
| Katalog KMK | Ada di keputusan, belum dikurasi; form master saja |
| Pengguna pertama | Internal OSDM ~120, demo pimpinan; lalu Biro Umum ~200 |
| Data sampel | Excel per sheet, belum tersedia |
| Identitas di klasemen | Nama lengkap, NIP, dan jabatan |
| Filter klasemen | Harian, bulanan, dan rentang tanggal |
| Overlap waktu catatan | Tidak diblokir; hanya peringatan/keterangan |
| Uraian Non TUSI | Bebas diketik, bukan daftar baku |
| Siapa lihat agregat Biro OSDM | Kepala Biro Organisasi dan SDM, serta Admin |
| Rencana aksi | Child setiap IKI; uraian + target TW1–TW4 wajib, default 0 |
| Kelompok SKP | Prototype hanya A. Utama; B. Tambahan belakangan |
| Atasan | Diisi **pegawai sendiri** di form SKP: pemberi pertimbangan (atasan langsung) + pejabat penilai; boleh orang sama |
| Validasi logbook | Dilakukan pemberi pertimbangan; pejabat penilai melihat rekap |
| Klasemen | Per unit kerja dan per tim kerja; identitas nama lengkap + NIP + jabatan |
| Login | NIP + kata sandi awal |
| Tim kerja | Berelasi ke unit kerja; master agile; seed 10 tim Biro OSDM |
| Notifikasi | Pusat in-app sederhana di prototype; email ditunda |
| Tim kerja | Berelasi ke unit kerja; master agile (bisa cepat diubah); seed 10 tim Biro OSDM |

---

## 22b. Seed tim kerja Biro OSDM

Relasi: `unit_kerja` 1 — n `tim_kerja`. Unit awal: Biro Organisasi dan Sumber Daya Manusia.

Tim kerja **bukan** struktur organisasi kaku. Admin dapat menambah, mengganti nama, menonaktifkan, dan memindahkan anggota kapan saja. Catatan harian dan klasemen historis tetap memakai tim pada saat transaksi (simpan `tim_kerja_id` di rekap), supaya ganti tim tidak mengubah angka masa lalu.

Seed prototype:

| Kode | Nama tim kerja |
|---|---|
| TK-ORTALA | Tim Kerja Organisasi dan Tata Laksana |
| TK-PENATAAN-ASN | Tim Kerja Penataan ASN |
| TK-ADMIN-ASN | Tim Kerja Administrasi ASN |
| TK-KINERJA-ASN | Tim Kerja Pengelolaan Kinerja Pegawai ASN |
| TK-KARIER-ASN | Tim Kerja Pengembangan Karier ASN |
| TK-TALENTA | Tim Kerja Seleksi dan Penempatan Talenta |
| TK-DISIPLIN | Tim Kerja Penegakan Disiplin dan Pemberian Penghargaan |
| TK-KP-KJ | Tim Kerja Kenaikan Pangkat dan Kenaikan Jabatan |
| TK-SI-ASN | Tim Kerja Sistem Informasi ASN |
| TK-DUKMAN | Tim Kerja Dukungan Manajemen |

Pegawai tanpa tim tetap masuk klasemen unit kerja, dengan label “Belum ada tim”.

---

## 23. Rekomendasi layar atasan (selain klasemen)

Klasemen pemenuhan vs 6,5 jam tetap layar utama. Lengkapi dengan indikator yang mencegah “sibuk di kertas”:

| Indikator | Mengapa perlu |
|---|---|
| Komposisi TUSI / TUSI Lainnya / Non TUSI | Membedakan kerja substansi vs waktu pribadi yang tercatat |
| Selisih durasi vs menit efektif | Sinyal isian tidak wajar (contoh 120 vs 80) |
| Jumlah isi manual | Sinyal katalog KMK belum lengkap |
| Antrian belum diverifikasi | Klasemen sementara vs resmi tidak tertukar |
| Pegawai 0 entri vs 0 jam efektif | Yang tidak mengisi vs yang hanya mengisi Non TUSI |
| Filter “Perlu Diskusi” | Atasan mulai dari yang berisiko, bukan dari peringkat 1 |
| Rata-rata unit sebagai garis | Peringkat individu dibaca terhadap unit, bukan juara-juaraan |

Untuk demo pimpinan: tampilkan 3 kartu di atas klasemen — rata-rata unit, % pegawai ≥ 6,5 jam efektif, % catatan tertaut KMK. Jangan pakai peringkat sebagai hukuman.

---

## 24. Lampiran — sheet Excel yang perlu disiapkan

Satu file, satu sheet per master. Kosongkan baris jika belum ada; header jangan diubah.

| Sheet | Kolom wajib |
|---|---|
| unit_kerja | kode_unit, nama_unit, parent_kode_unit, status |
| jabatan | kode_jabatan, nama_jabatan, jenjang |
| pangkat_golongan | kode_golongan, nama_pangkat, urutan |
| pegawai (dari DUK) | nama_lengkap, nip, pangkat_golongan, tmt, jabatan, unit_kerja |
| tim_kerja | kode_tim, nama_tim, kode_unit, status (aktif/nonaktif), urutan |
| anggota_tim | nip, kode_tim, berlaku_mulai, berlaku_sampai (opsional) |
| skp | nip, tahun, nip_pemberi_pertimbangan, nip_pejabat_penilai, catatan |
| rhk_pimpinan | nip, tahun, kode_rhk_pimpinan, uraian_rhk_pimpinan, kelompok (utama), urutan |
| rhk | kode_rhk_pimpinan, kode_rhk, uraian_rhk, aspek (kuantitas/kualitas/waktu/biaya), indikator_kinerja_individu, target_tahunan, satuan |
| rencana_aksi | kode_rhk, kode_aksi, uraian, target_tw1, target_tw2, target_tw3, target_tw4 (wajib, default 0) |
| kmk_kelompok | kode, nama, jenis (pendukung/utama/lainnya) |
| kmk_proses_l1 | kode, nama, kode_kelompok |
| produk | kode_produk, nama_produk, kode_proses_l1, kode_unit_pemilik, status |
| tahapan | kode_tahapan, nama_tahapan, kode_produk, urutan |
| master_satuan | kode, nama |
| konfigurasi_jam | nama, target_menit_efektif (390), jam_kantor_menit (450), hari_kerja |
| (hapus non_tusi_baku) | Non TUSI bebas diketik di form catatan; tidak perlu sheet master |
| catatan_contoh | opsional, untuk demo: nip, tanggal, jenis, kode_produk, kode_tahapan, mulai, selesai, menit_efektif, output, satuan, kategori |

---

## 25. Status implementasi prototype (realisasi kode)

> Snapshot historis rev. 1.2 (27 September 2026). Status ini dipertahankan untuk melihat perubahan antarrevisi dan **telah digantikan oleh §26**. Jika bagian ini bertentangan dengan §26, gunakan §26 sebagai kondisi kode dan produksi saat ini.

### 25.1 Stack yang terpasang

| Lapisan | Realisasi |
|---|---|
| Web | SvelteKit 2 + Svelte 5 (runes `$state`/`$props`/`$derived`) + Tailwind CSS 4 (CSS-first, token di `apps/web/src/app.css`) |
| API | Hono dengan `basePath /api`; cookie sesi httpOnly; belum ada token CSRF |
| Validasi | Zod di `packages/schemas`, dipakai bersama API dan form |
| DB | Drizzle ORM + `bun:sqlite` (dev, `local.db`); target Cloudflare D1 |
| Auth | PBKDF2-SHA256 100.000 iterasi + salt 16 byte; tabel `sesi` + cookie `logbook_sesi` (7 hari, SameSite=Lax) |
| Lint | Biome 2.5 (versi dipin di root `devDependencies`); `bun run check` hijau |
| Tes | Vitest di `packages/schemas` (aturan jam efektif) |

### 25.2 Layar yang sudah ada

| Rute | Isi |
|---|---|
| `/` | Gerbang sesi: cek `/me` → arahkan ke `/login`, `/ganti-sandi`, atau `/app` |
| `/login` | NIP + kata sandi; validasi klien, error per-field, status memuat, toggle tampilkan sandi |
| `/ganti-sandi` | Ganti sandi wajib; sandi baru ≠ NIP, minimal 8 karakter |
| `/app` | Beranda per-peran: kartu jam efektif hari ini (tercatat + resmi), tombol Catatan baru; ketua tim melihat tabel anggotanya; admin/kepala biro melihat 3 kartu unit |
| `/app/catatan` | Tabel catatan sendiri + aksi Kirim (untuk DRAFT/DITOLAK) |
| `/app/catatan/baru` | Form catatan: pin & sering digunakan, isi manual, tautan bukti, kategori Biasa/Perlu Diskusi |
| `/app/skp` | Header SKP (3 relasi peran), pohon RHK pimpinan → RHK → IKI → rencana aksi, CRUD inline |
| `/app/jke` | Klasemen jam efektif: filter harian/bulanan/rentang, kelompok unit/tim, cari pegawai, paginasi |
| `/app/validasi` | Antrian + riwayat: setujui, tolak (alasan wajib), setujui massal, paginasi |
| `/app/master/*` | Pegawai, Unit kerja, Tim kerja, Produk/Proses bisnis, Tahapan, Aktivitas |
| Notifikasi | Panel samping dari ikon lonceng di header (bukan halaman penuh) |

Belum ada layar: usulan katalog Biro OSDM, impor/ekspor Excel, audit trail, pengaturan jam kerja/kalender libur, ekspor laporan.

### 25.3 Endpoint API

```
GET    /api/health
POST   /api/auth/login              POST /api/auth/ganti-sandi        POST /api/auth/logout
GET    /api/me
GET    /api/catatan                 POST /api/catatan                 POST /api/catatan/:id/submit
GET    /api/catatan/pintasan        POST /api/catatan/pin             DELETE /api/catatan/pin/:id
GET    /api/validasi                POST /api/validasi                POST /api/validasi/massal
GET    /api/klasemen
GET    /api/notifikasi              POST /api/notifikasi/:id/baca     POST /api/notifikasi/baca-semua
GET    /api/master/katalog
POST/PUT/DELETE  /api/master/produk[/:id]      POST/PUT/DELETE /api/master/tahapan[/:id]
POST/PUT/DELETE  /api/master/aktivitas[/:id]   POST /api/master/anggota-tim
GET/POST /api/master/tim            PUT /api/master/tim/:id
GET/POST /api/master/pegawai        PUT/DELETE /api/master/pegawai/:id
GET/POST /api/master/unit           PUT/DELETE /api/master/unit/:id
GET    /api/skp                     PUT /api/skp/header
POST/PUT/DELETE  /api/skp/rhk-pimpinan[/:id]   POST/PUT/DELETE /api/skp/rhk[/:id]
POST/PUT/DELETE  /api/skp/iki[/:id]            POST/PUT/DELETE /api/skp/rencana-aksi[/:id]
```

Semua endpoint selain `/api/health` dan `POST /api/auth/login` memerlukan sesi (`requireAuth`).

### 25.4 Model data aktual

16 tabel di `packages/db/src/schema.ts` (mirror DDL di `packages/db/src/migrate.ts`):

```
unit_kerja ──(induk_id, self)── unit_kerja
     └── tim_kerja (ketua_pegawai_id ──► pegawai)
            └── pegawai (unit_kerja_id, tim_kerja_id)
                   ├── sesi
                   ├── skp ── rhk_pimpinan ── rhk ── iki ── rencana_aksi
                   ├── catatan_harian ── usulan_katalog
                   ├── pin_katalog
                   └── notifikasi

produk ── tahapan ── aktivitas
```

Perbedaan penting terhadap konsep §10:

- **Tidak ada** tabel `jabatan`, `pangkat_golongan`, `master_satuan`, `proses_bisnis`, `proses_bisnis_turunan`, `bukti_dukung`, `rekap_jam_kerja`, `master_jam_kerja`, `kalender_libur`, `delegasi_validasi`, `audit_log`, `anggota_tim`, `pin_favorit`, `non_tusi_baku`.
- Katalog hanya **tiga tingkat** (produk → tahapan → aktivitas). Proses bisnis KMK hanya berupa field teks `produk.kode_proses_l1`, bukan tabel.
- Keanggotaan tim = kolom `pegawai.tim_kerja_id` (satu tim per pegawai), bukan tabel `anggota_tim`. Ketua tim = `tim_kerja.ketua_pegawai_id`.
- Bukti = kolom `catatan_harian.bukti_url` + `bukti_judul` (satu tautan), bukan tabel terpisah.
- `unit_kerja` dua tingkat: Eselon I (`induk_id` NULL) dan unit kerja (punya `induk_id`).
- `skp` punya **tiga** relasi peran: `pemberi_pertimbangan_id`, `pejabat_penilai_id`, `atasan_pejabat_penilai_id`.
- `iki` punya `jenis` (`CORE`/`BEYOND`) dan `bobot`; `rencana_aksi` menempel ke `iki_id` dan menyimpan TW1–TW4 serta `akumulasi`.
- `rekap_jam_kerja` tidak dimaterialisasi; klasemen dihitung saat permintaan.
- Belum ada soft-delete: master dihapus keras dengan penjagaan (produk/tahapan/aktivitas), sedangkan hapus pegawai menghapus anak-anaknya (SKP, catatan, notifikasi, sesi).

### 25.5 Aturan jam efektif yang terpasang

Di `packages/schemas/src/jam-efektif.ts`, dipakai UI dan API:

- `TARGET_MENIT_EFEKTIF = 390`.
- `masukJamEfektif(jenis, status)`: NON_TUSI → false; selain itu hanya `TERVERIFIKASI`.
- `masukJamTercatat(jenis, status)`: NON_TUSI → false; `TERVERIFIKASI` dan `SUBMIT` → true; `DRAFT`/`DITOLAK` → false. Dipakai untuk angka "jam tercatat" (termasuk yang menunggu validasi).
- `selisihEvaluasi(durasi, menitEfektif) = max(0, durasi − menitEfektif)`.
- `statusPemenuhan(menit)`: 0 → `NOL`; < 390 → `KURANG`; 390–467 → `TERPENUHI`; ≥ 468 (1,2× target) → `LEBIH`.
- `persenPemenuhan(menit, target)` dibulatkan satu desimal.
- `validasiWaktu`: durasi ≤ 0, menit efektif ≤ 0, menit efektif > durasi, dan durasi > 24 jam masing-masing memunculkan pesan galat.
- `adaOverlap` mendeteksi tumpang tindih; catatan tetap disimpan dengan peringatan (tidak diblokir).
- Klasemen: target = 390 × jumlah hari unik pada rentang (minimal 1), sehingga periode harian memakai target 390.
- Beranda menampilkan **jam tercatat** sebagai angka utama dan **resmi** (terverifikasi) sebagai angka sekunder.

### 25.6 Peran aktual

Yang ada di kode: `isAdmin`, `isKepalaBiro`, dan peran fungsional "pemberi pertimbangan" (dari SKP tahun berjalan). **Tidak ada** peran "admin unit".

- Tulis master (produk, tahapan, aktivitas, tim, pegawai, unit) → `isAdmin || isKepalaBiro`.
- Read master (`/master/katalog`, `/master/tim`, `/master/pegawai`, `/master/unit`) → semua pengguna login (UI menu Master hanya tampil untuk admin/kepala biro).
- Validasi → hanya pemberi pertimbangan pegawai terkait (dicek dari SKP tahun berjalan).
- Klasemen → dibatasi ke `unit_kerja_id` pengguna; `grup=tim` membatasi ke tim pengguna kecuali admin/kepala biro.
- SKP → hanya milik sendiri (kepemilikan dicek berjenjang sampai RHK/IKI/rencana aksi).

### 25.7 Cakupan kebutuhan fungsional (§8) vs realisasi

Status: **T** = terpasang, **S** = sebagian, **B** = belum.

| Kode | Ringkas | Status |
|---|---|---|
| FR-AUTH-01 | Login NIP, sesi, logout | T |
| FR-AUTH-02 | RBAC matriks peran | S (tanpa admin unit) |
| FR-AUTH-03 | Isolasi data per peran | T |
| FR-AUTH-04 | SSO Kemenkes | B |
| FR-AUTH-05 | Reset sandi via email | B (admin reset ke NIP) |
| FR-PG-01 | CRUD pegawai | T (tanpa field status; hapus keras) |
| FR-PG-02 | Atasan dipilih di form SKP | T |
| FR-PG-03 | Soft-delete / nonaktif pegawai | B |
| FR-PG-04 | Cari & filter pegawai | S (cari + filter unit/tim; tanpa status) |
| FR-PG-05 | Impor Excel + pratinjau | B (hanya seed DUK) |
| FR-PG-06 | Ekspor Excel | B |
| FR-PG-07 | Edit email/HP/foto | B |
| FR-PG-08 | Riwayat jabatan & golongan | B |
| FR-PG-09 | Audit trail perubahan kritis | B |
| FR-PG-10 | Master unit kerja & jabatan | S (unit ada; jabatan teks bebas) |
| FR-PG-11 | Master tim + keanggotaan | T (satu tim per pegawai) |
| FR-PG-11b | Tim kerja agile | T |
| FR-SKP-01 | Satu SKP/tahun, identitas otomatis | T |
| FR-SKP-01b | Pegawai pilih atasan & penilai | T (+ atasan pejabat penilai) |
| FR-SKP-02 | CRUD RHK | T |
| FR-SKP-03 | CRUD IKI (aspek/target/satuan) | T (+ jenis CORE/BEYOND, bobot) |
| FR-SKP-04 | Rencana aksi ≥1/IKI + TW1–TW4 | T |
| FR-SKP-04b | Hanya kelompok A. Utama | T (tanpa konsep kelompok) |
| FR-SKP-05 | Submit/approve/revisi/tolak SKP | B |
| FR-SKP-06 | Kunci edit setelah disetujui | B |
| FR-SKP-07 | Ekspor PDF/Excel SKP | B |
| FR-SKP-08 | Master satuan | B (satuan teks bebas) |
| FR-SKP-09 | Dashboard kelengkapan SKP | S (banner "SKP belum lengkap") |
| FR-SKP-10 | Duplikasi SKP tahun lalu | B |
| FR-SKP-11 | Cascading RHK dari atasan | B (RHK pimpinan diketik manual) |
| FR-SKP-12 | Sinkron e-Kinerja | B |
| FR-KT-01 | CRUD Produk/Tahapan/Aktivitas | T (3 tingkat; proses bisnis hanya field teks) |
| FR-KT-02 | Aktivitas: uraian, norma waktu, status | T |
| FR-KT-03 | Pencarian katalog + pohon admin | S (tabel + saringan; tanpa pohon) |
| FR-KT-04 | Pin maks 10 per tipe | T |
| FR-KT-05 | Sering digunakan Top 10 / 30 hari | T |
| FR-KT-06 | Nonaktifkan, jangan hard-delete | S (ada status; hapus keras dengan penjagaan) |
| FR-KT-07 | Publish per unit pemilik | B |
| FR-KT-08 | Total norma waktu per tahapan/produk | B |
| FR-KT-09 | Impor/ekspor katalog | B |
| FR-KT-10 | Versioning SOP | B |
| FR-LG-01 | Tambah catatan lengkap | T |
| FR-LG-02 | Jenis: TUSI/TUSI Lainnya/Non TUSI | T |
| FR-LG-03 | Pilih dari pin/pencarian | T |
| FR-LG-04 | Isi manual + nama wajib | T |
| FR-LG-05 | Usulan norma waktu opsional | T |
| FR-LG-06 | Tautan ke IKI/rencana aksi | B |
| FR-LG-06b | Kategori Biasa/Perlu Diskusi | T |
| FR-LG-06c | Satu catatan = satu produk/tahapan | T |
| FR-LG-07 | Waktu efektif + selisih | T |
| FR-LG-08 | Simpan draft, submit | T |
| FR-LG-09 | Filter daftar catatan | B |
| FR-LG-10 | Hapus draft milik sendiri | B |
| FR-LG-11 | Duplikasi catatan | B |
| FR-LG-12 | Tampilan kalender | B |
| FR-JK-01 | Akumulasi harian/mingguan/bulanan | S (harian/bulanan/rentang; tanpa mingguan) |
| FR-JK-02 | Banding target + status | T |
| FR-JK-03 | Kartu harian di beranda | T |
| FR-JK-04 | Grafik mingguan/bulanan | B |
| FR-JK-05 | Admin atur target/jam kerja | B (konstanta 390/450) |
| FR-JK-06 | Kalender libur nasional | B |
| FR-JK-07 | Pengecualian cuti/izin | B |
| FR-JK-08 | Reminder jam efektif | B |
| FR-JK-09 | Rekap atasan untuk bawahan | T (beranda ketua tim + JKE) |
| FR-BD-01 | 0–5 tautan + jenis | S (1 tautan: URL + judul) |
| FR-BD-02 | Edit/hapus bukti | S |
| FR-BD-03 | Buka tautan dari form & antrian | T |
| FR-BD-04 | Wajib bukti untuk TUSI | B |
| FR-BD-05 | Tandai Sesuai/Tidak Sesuai | B |
| FR-BD-06 | Unggah berkas | B |
| FR-VL-01 | Antrian + terlambat SLA + riwayat | S (antrian/riwayat; tanpa SLA) |
| FR-VL-02 | Setujui/tolak, komentar wajib saat tolak | T |
| FR-VL-03 | Lihat uraian/waktu/output/bukti | T (tanpa tautan SKP) |
| FR-VL-04 | Delegasi validasi | B |
| FR-VL-05 | Bulk approve | T |
| FR-VL-06 | Atasan menyesuaikan menit efektif | B |
| FR-VL-07 | Reminder SLA + notifikasi hasil | S (notifikasi hasil ada) |
| FR-US-01 | Setiap isi manual membuat usulan | T (data tersimpan) |
| FR-US-02 | Grouping kemiripan usulan | B |
| FR-US-03 | Setujui/tolak usulan | B (belum ada endpoint/UI) |
| FR-US-04 | Notifikasi hasil usulan | B |
| FR-DB-01 | Beranda ASN | T |
| FR-DB-02 | Klasemen + filter harian/bulanan/rentang | T |
| FR-DB-02b | Antrian + selisih durasi vs efektif | T |
| FR-DB-02c | Agregat unit untuk Kepala Biro & Admin | T |
| FR-DB-02d | Klasemen per unit & per tim | T |
| FR-DB-03 | Beranda OSDM (usulan, kelengkapan) | B |
| FR-LP-01 | Ekspor catatan/rekap/SKP | B |
| FR-NT-01 | Pusat notifikasi in-app | T (panel samping) |
| FR-NT-02 | Pemicu notifikasi | S (submit→atasan, hasil validasi→ASN; usulan tidak) |
| FR-NT-03 | Tandai dibaca + buka tautan | T |
| FR-NT-04 | Reminder + email | B |
| FR-AU-01 | Audit trail | B |

### 25.8 Deviasi terhadap konsep §1–§24

1. **Hierarki katalog diringkas** dari lima tingkat menjadi tiga tabel; proses bisnis tersimpan sebagai kode teks.
2. **SKP memakai tiga peran atasan** (menambah "atasan pejabat penilai"); diri sendiri tidak boleh dipilih, dan atasan pejabat penilai ≠ pejabat penilai.
3. **IKI bukan lagi satu per RHK**: RHK punya banyak IKI; rencana aksi menempel ke IKI.
4. **Bukti satu tautan** per catatan (bukan 0–5 tautan + jenis + penandaan atasan).
5. **Validasi tanpa delegasi/SLA**; hanya setujui/tolak + setujui massal. Tidak ada "revisi" terpisah dari "tolak".
6. **Klasemen menambah konsep "jam tercatat"** (termasuk catatan menunggu validasi) di samping "jam resmi".
7. **Login memakai rate limit in-memory** 10 percobaan/15 menit per NIP; belum ada token CSRF.
8. **Hapus master bersifat keras** dengan penjagaan ketergantungan; hapus pegawai menghapus data turunannya.
9. **Unit kerja dua tingkat** (Eselon I + unit), bukan master jabatan/pangkat terpisah.

### 25.9 Belum terpasang (usulan prioritas lanjutan)

1. Usulan katalog OSDM (daftar, grouping, setujui/tolak, notifikasi) — data sudah terkumpul di `usulan_katalog`.
2. Impor/ekspor Excel master dan laporan (FR-PG-05/06, FR-LP-01, FR-KT-09).
3. Audit trail (FR-AU-01), soft-delete/nonaktif pegawai (FR-PG-03).
4. Delegasi validasi + SLA + reminder (FR-VL-04, FR-VL-07, FR-NT-04).
5. Filter daftar catatan, edit/hapus draft, tampilan kalender (FR-LG-09/10/12).
6. Tautan catatan ke IKI/rencana aksi SKP (FR-LG-06).
7. Konfigurasi target/jam kerja + kalender libur (FR-JK-05/06/07).
8. Multi-tautan bukti + penandaan Sesuai/Tidak Sesuai (FR-BD-01/05).

---

## 26. Status implementasi produksi rev. 1.3

> Bagian ini adalah sumber kebenaran realisasi per 28 September 2026 setelah **Access, Reports, and UX Overhaul**. Implementasi telah dimigrasikan dan dideploy ke Cloudflare Workers/D1.

### 26.1 Arsitektur akun, akses, dan audit

- Data organisasi tetap berada di `pegawai`; kredensial dan lifecycle akses berada di tabel `akun`.
- `akun` menyimpan hash sandi, status `AKTIF`/`DITANGGUHKAN`, wajib ganti sandi, waktu login terakhir, dan informasi penangguhan.
- `akun_peran` menyimpan `ADMIN`, `KEPALA_BIRO`, dan `PENGELOLA_UNIT`. Satu Pengelola Unit dapat menerima satu atau lebih cakupan `unit_kerja`.
- `sesi` tertaut ke akun dan dapat dicabut tanpa menghapus riwayat.
- `audit_log` append-only merekam tindakan akun/peran, aktor, target, alasan, serta nilai sebelum/sesudah.
- Semua pegawai lama telah dibackfill menjadi akun aktif. Kolom autentikasi lama pada `pegawai` dipertahankan sementara untuk rollback.
- Pegawai baru otomatis menerima akun aktif dengan sandi awal, lalu wajib mengganti sandi.
- Penangguhan akun, reset sandi, dan penonaktifan pegawai mencabut sesi aktif.
- Akun sendiri tidak dapat menangguhkan atau mencabut peran administratornya. Administrator aktif terakhir dilindungi.
- Penghapusan pegawai diganti menjadi penonaktifan aman; SKP, catatan, notifikasi, dan riwayat tidak lagi dihapus berantai.
- Kepemilikan child SKP diverifikasi berjenjang sebelum membuat/mengubah RHK, IKI, dan rencana aksi.

### 26.2 Matriks akses aktual

| Kapabilitas | Pegawai | Ketua tim/atasan | Pengelola Unit | Kepala Biro | Admin |
|---|---|---|---|---|---|
| Catatan dan SKP sendiri | Ya | Ya | Ya | Ya | Ya |
| Validasi catatan | Tidak | Bawahan dari SKP | Tidak otomatis | Sesuai relasi SKP | Sesuai relasi SKP |
| Laporan aktivitas/jam/validasi/katalog/SKP | Sendiri | Tim yang dipimpin | Unit yang diberikan | Hierarki biro | Semua |
| Kelola akun dan peran | Tidak | Tidak | Tidak | Tidak | Ya |
| Kelola master | Tidak | Tidak | Tidak | Sesuai UI administrasi | Ya |
| Lihat audit akun | Tidak | Tidak | Tidak | Tidak | Ya |

Kepemimpinan tim dan relasi validasi tetap diturunkan dari Tim/SKP; keduanya tidak diduplikasi sebagai peran manual.

### 26.3 Manajemen pengguna

Rute web: `/app/administrasi/pengguna`.

Fungsi yang terpasang:

- Ringkasan akun aktif, wajib ganti sandi, ditangguhkan, dan Pengelola Unit.
- Pencarian nama/NIP/jabatan dan filter status, peran, serta unit.
- Tabel formal pengguna dengan organisasi, peran, status, dan login terakhir.
- Pengaturan peran Admin, Kepala Biro, dan Pengelola Unit multiscoped.
- Penangguhan wajib alasan dan aktivasi kembali.
- Reset sandi aman: sandi sementara ditampilkan sekali, pengguna wajib menggantinya, seluruh sesi lama dicabut.
- Audit tindakan akun dan perubahan peran.

Endpoint:

```
GET  /api/pengguna
GET  /api/pengguna/:id/audit
PUT  /api/pengguna/:id/peran
POST /api/pengguna/:id/reset-sandi
POST /api/pengguna/:id/tangguhkan
POST /api/pengguna/:id/aktifkan
```

### 26.4 Laporan kinerja

Rute web: `/app/laporan`.

Jenis laporan:

1. Aktivitas harian.
2. Jam efektif terverifikasi.
3. Hasil validasi catatan.
4. Keterhubungan katalog kinerja.
5. Kelengkapan SKP.

Alur UI: **jenis laporan → periode → cakupan organisasi → pratinjau → PDF/XLSX**.

Aturan:

- Filter tersedia untuk periode, unit, tim, dan pegawai.
- API selalu menerapkan cakupan akses; pilihan klien tidak dapat memperluas hak akses.
- Pratinjau dan ekspor memakai dataset builder yang sama.
- Pratinjau dipaginasi oleh server dengan pilihan 25, 50, atau 100 baris; ringkasan tetap menghitung seluruh hasil.
- Perubahan jenis/filter mengembalikan pratinjau ke halaman pertama; ekspor tetap mencakup seluruh hasil sesuai filter, bukan hanya halaman aktif.
- PDF dibuat dengan `pdf-lib`; XLSX dibuat dengan `xlsx`.
- Berkas memuat judul, periode/filter, waktu pembuatan, pembuat, ringkasan, dan baris detail.

Endpoint:

```
POST /api/laporan/preview
POST /api/laporan/export/pdf
POST /api/laporan/export/xlsx
```

### 26.5 Terminologi waktu

Terminologi baku seluruh UI:

- **Waktu tercatat**: catatan TUSI/TUSI Lainnya berstatus `SUBMIT` dan `TERVERIFIKASI`.
- **Waktu terverifikasi**: catatan TUSI/TUSI Lainnya berstatus `TERVERIFIKASI` saja.
- `DRAFT`, `DITOLAK`, dan `NON_TUSI` tidak menambah kedua angka tersebut.
- Target default tetap 390 menit per hari.
- Rekap jam efektif memprioritaskan waktu terverifikasi; waktu tercatat menjadi konteks sekunder.

### 26.6 Navigasi dan UX aktual

Navigasi desktop dikelompokkan:

- **Pekerjaan saya:** Beranda, Catatan harian, SKP.
- **Pemantauan:** Rekap jam efektif, Validasi catatan, Laporan kinerja.
- **Administrasi:** Pegawai & organisasi, Katalog kinerja, Manajemen pengguna.

Navigasi HP memakai empat tujuan tetap: **Beranda, Catatan, SKP, Menu**. Menu membuka Pemantauan dan Administrasi sesuai peran. Badge menampilkan jumlah validasi yang menunggu.

Penyempurnaan halaman:

- Beranda memprioritaskan tindakan pribadi dan memisahkan waktu tercatat/terverifikasi.
- Catatan harian memiliki narasi tujuan, filter berlabel, pencarian uraian/produk, ringkasan hasil, kalender, empty state, dan bulk action sticky.
- SKP memakai langkah penyelesaian terpandu, penjelasan Core/Beyond, aksi baris terlihat, dan saran langkah berikutnya.
- Rekap jam efektif menampilkan rentang aktif dan tidak menekankan peringkat ketika semua angka nol.
- Validasi catatan memperjelas antrian/riwayat, kolom, filter ringkasan, alasan penolakan wajib, dan konfirmasi massal.
- Pegawai menampilkan konteks status/peran/hierarki, kolom aksi eksplisit, kontrol perpindahan massal sticky, dan narasi penonaktifan aman.
- Komponen bersama tersedia untuk page header, empty state, selection bar, navigasi catatan, dan ringkasan waktu.

### 26.7 Model data aktual rev. 1.3

Tabel inti:

```
unit_kerja ── tim_kerja ── pegawai ── akun ── akun_peran
                                │         └── sesi
                                │
                                ├── skp ── rhk_pimpinan ── rhk ── iki ── rencana_aksi
                                ├── catatan_harian ── usulan_katalog
                                ├── pin_katalog
                                └── notifikasi

produk ── tahapan ── aktivitas
akun ── audit_log
```

Tambahan rev. 1.3:

- `pegawai.status`.
- `akun`, `akun_peran`, dan `audit_log`.
- `sesi.akun_id` dan `sesi.dicabut_pada`.
- `catatan_harian.diajukan_pada`.
- Snapshot `unit_kerja_id` dan `tim_kerja_id` pada catatan untuk menjaga konteks organisasi historis.
- Indeks akun/peran/sesi, audit, pegawai-unit-tim, serta catatan-periode/status untuk laporan.
- Constraint unik satu SKP per pegawai per tahun.

### 26.8 Status kebutuhan yang berubah sejak rev. 1.2

| Kode | Status rev. 1.3 | Catatan |
|---|---|---|
| FR-AUTH-02 | T | RBAC relasional + Pengelola Unit |
| FR-AUTH-03 | T | Cakupan laporan ditegakkan server |
| FR-AUTH-05 | S | Reset oleh admin dengan sandi sementara; belum melalui email |
| FR-AUTH-06–09 | T | Akun terpisah, lifecycle, scoped role, last-admin protection |
| FR-USR-01–05 | T | API dan UI Manajemen Pengguna |
| FR-PG-01 | T | Status pegawai tersedia |
| FR-PG-03 | T | Penonaktifan aman menggantikan hard-delete |
| FR-PG-04 | T | Cari + filter hierarki/status/peran |
| FR-PG-09 | S | Audit tindakan akun/peran tersedia; audit semua master belum lengkap |
| FR-SKP-09 | T | Laporan kelengkapan SKP tersedia |
| FR-LG-09 | T | Filter dan pencarian daftar |
| FR-LG-12 | T | Tampilan kalender tersedia |
| FR-VL-05 | T | Bulk approve + konfirmasi |
| FR-LP-01 | T | Ekspor laporan PDF/XLSX |
| FR-LP-02–05 | T | Lima dataset, cakupan server, pratinjau, ekspor biner |
| FR-AU-01 | S | Audit akun/peran terpasang; perluasan audit domain operasional tetap lanjutan |

### 26.9 Verifikasi dan rollout

- Migrasi D1 bersifat aditif dan telah diuji terhadap backup produksi sebelum diterapkan.
- Hasil backfill produksi: seluruh 112 pegawai memiliki akun aktif; tidak ada sesi tanpa akun dan tidak ada catatan lama tanpa snapshot unit.
- Tes otomatis mencakup aturan jam efektif, matriks otorisasi, signature PDF, dan parsing XLSX.
- Biome, migrasi lokal, API Worker dry-run, web production build, serta smoke test browser desktop/HP lulus.
- Urutan rollout: backup D1 → migrasi → verifikasi row count → deploy API → deploy web → smoke test produksi.
- Produksi:
  - Web: `https://logbook-pegawai.mujaki.workers.dev`
  - API: `https://logbook-api.mujaki.workers.dev`

### 26.10 Prioritas lanjutan setelah rev. 1.3

1. Usulan katalog OSDM: grouping, setujui/tolak, dan notifikasi hasil.
2. Impor/ekspor Excel master dan katalog.
3. Memperluas audit append-only ke seluruh perubahan master dan transaksi kritis.
4. Delegasi validasi, SLA, reminder, dan email.
5. Konfigurasi target/jam kerja, kalender libur, cuti/izin.
6. Multi-tautan atau unggah bukti dengan penandaan Sesuai/Tidak Sesuai.
7. SSO Kemenkes dan interoperabilitas API Hub.
