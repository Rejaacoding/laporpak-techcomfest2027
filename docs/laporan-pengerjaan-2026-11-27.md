# Laporan Pengerjaan — 27 November 2026

## Ringkasan

Hari ini fokus pada penyelesaian alur frontend–backend LaporPAK!, perbaikan error build/typecheck, pembuatan halaman detail tiket, implementasi fitur v3.5 (anti-buzzer dan rating), serta perapian kode mati. Seluruh halaman utama sudah diuji di browser pada desktop dan mobile tanpa error console/runtime.

## Status Git

### Commit hari ini

| Commit | Isi |
| :--- | :--- |
| `7faa525` | Mapper API murni (`ticketMappers`) dan dukungan title pada Toast |
| `e38d039` | Wiring halaman Warga (`/`, `/peta`, `/lapor`, `/catatan`) ke API |
| `e27bedf` | Wiring halaman Dinas dan `DinasActionModal` |
| `6d0454b` | Prisma Client digenerate otomatis saat install |
| `28cddb5` | Perbaikan typecheck, `tsconfig`, dan tipe React |
| `5350e0c` | Tema halaman Catatan menjadi terang (`warm`) |

### Belum di-commit

Sesuai permintaan, perubahan berikut masih berada di working tree:

- Port fitur backend v3.5: anti-buzzer 3 lapis, fast-resolve anomaly, rating warga.
- Halaman `/tiket/:id`, rating UI, dan tampilan rating di Catatan.
- Rename halaman dan file menjadi Catatan.
- Penghapusan kode mati dan deduplikasi Haversine.
- Perbaikan path backend setelah folder `src` dipindah ke `backend/`.
- Perbaikan cache `index.html` dan overflow `/login`.

## Pekerjaan yang Diselesaikan

### 1. Stabilisasi build dan Prisma

- Menambahkan `postinstall: prisma generate` agar `@prisma/client` tidak gagal diinisialisasi.
- Memasang dependency frontend yang hilang (`nsfwjs`, `@tensorflow/tfjs`).
- Menambahkan TypeScript, `@types/react`, `@types/react-dom`, `tsconfig.json`, dan `vite-env.d.ts`.
- Menambahkan script `npm run typecheck` di root dan frontend.

### 2. Wiring frontend ke API

Semua halaman utama kini memakai API melalui `frontend/src/services/api.js`:

| Halaman | Status |
| :--- | :--- |
| `/` Beranda Warga | Live tickets, pin peta, cluster, filter kategori, GPS, skeleton/retry |
| `/peta` Peta Warga | Live pin terproyeksi, pencarian, filter, GPS, preview tiket |
| `/lapor` Buat Laporan | Geolocation, cek radius, kuota, dukungan, kamera live, draft + idempotency |
| `/tiket/:id` Detail Tiket | Before/after slider, kuorum, validasi warga, segel audit, rating |
| `/dinas` Meja Dinas | Antrean live, KPI, alert, tabel, 8 aksi dinas |
| `/dinas/peta` Peta Dinas | Pin live, inspector, foto, aksi |
| `/catatan` Catatan Warga | Live `/api/rapor`, rating, klaster, label bahasa awam |
| `/dinas/catatan` Catatan Dinas | Filter kategori/wilayah, matriks, rating, empty state |

### 3. Halaman detail `/tiket/:id`

- Slider foto Sebelum vs Sesudah.
- Blur NSFW + Signed URL 60 detik.
- Metadata jarak dan waktu foto perbaikan (WIB).
- Bar kuorum dinamis, termasuk target 3.0 poin jika belum ada pendukung awal.
- Informasi masa tayang publik 6 jam.
- Tombol **Sudah Beres** dan **Klaim Palsu** dengan validasi GPS/radius.
- Klaim Palsu memakai `LiveCameraCapture`, nonce, dan unggahan bukti.
- Konfirmasi pelapor pada jendela 48–72 jam tanpa GPS.
- Verifikasi segel audit HMAC-SHA256.
- Timeline penanganan.
- Rating bintang 1–5 setelah laporan `CLOSED`.

### 4. Backend v3.5

- Masa tunggu publik 6 jam (`#33`).
- Kuorum jangkar saksi awal (`#34`).
- Shadow-zero dan deteksi kolusi akun/perangkat (`#35`).
- Penanda fast-resolve anomaly `#36`.
- Tabel `DepartmentRating`, endpoint `POST /api/tickets/:id/rate`, dan agregasi rating pada `GET /api/rapor` (`#37`).

### 5. Autentikasi dan panel juri

- Fallback lookup email Supabase untuk akun dinas: JWT dengan email dinas dipetakan ke akun `ADMIN_DINAS` yang sudah di-seed.
- Menambahkan role juri:
  - `WARGA_VALIDATOR_2` → `demo-warga-2`
  - `WARGA_BARU` → `demo-warga-baru`

### 6. Rename halaman Rapor menjadi Catatan

- Route baru: `/catatan` dan `/dinas/catatan`.
- Route lama `/rapor` dan `/dinas/rapor` tetap tersedia sebagai redirect.
- File baru:
  - `frontend/src/pages/warga/CatatanPage.tsx`
  - `frontend/src/pages/dinas/CatatanPage.tsx`
- Komponen: `WargaCatatanPage`, `DinasCatatanPage`.
- Label navbar dan judul halaman menjadi **Catatan**.

### 7. Perbaikan bug dan perapian

- `/login` overflow 7px di mobile diperbaiki dengan menyembunyikan top nav legacy.
- `/peta` dan `/lapor` mendapat `h1` untuk aksesibilitas.
- `index.html` diberi `Cache-Control: no-store` agar aset build lama tidak tersaji setelah rebuild/deploy.
- Path backend diperbaiki setelah struktur berubah menjadi `backend/src`:
  - `.env` dan `node_modules`
  - `public/geo`
  - `.local-media`
  - `prisma/seed-core.js`
- Menghapus 6 file frontend mati:
  - `mockTickets.ts`
  - `pages/LaporPage.tsx`
  - `LiveCameraViewfinder.tsx`
  - `Button.jsx`
  - `Card.jsx`
  - `StatusBadge.jsx`
- Menghapus ±1.765 baris kode mati.
- Menggabungkan 3 implementasi Haversine menjadi satu `distanceMeters` di `ticketMappers`.

## Verifikasi

| Pemeriksaan | Hasil |
| :--- | :--- |
| `npm run typecheck` | 0 error |
| `npm run build` | Pass |
| Unit test frontend | 7/7 pass |
| Backend self-check | 17/17 suite pass (sebelum restrukturisasi folder backend) |
| Browser audit desktop 1280px | 11 route, 0 console/page error |
| Browser audit mobile 375px | 0 error, 0 horizontal overflow |
| `/tiket` konfirmasi warga | Vote tercatat (contoh 1.1/3.0 poin) |
| `/tiket` Klaim Palsu | `200`, status menjadi `DISPUTED` |
| `/tiket` rating | `201`, tampil di Catatan (`4.3/5`, 3 ulasan) |
| Segel audit | Rantai terverifikasi "Aman" |
| Email fallback dinas | JWT mock `DPU@laporpak.id` → `demo-admin-dpu` (`ADMIN_DINAS`) |
| Role juri baru | `WARGA_VALIDATOR_2` dan `WARGA_BARU` menampilkan alias masing-masing |

### Audit halaman

| Route | Error console | Overflow mobile | H1 |
| :--- | :--- | :--- | :--- |
| `/` | 0 | Tidak | Ada |
| `/peta` | 0 | Tidak | Ada |
| `/lapor` | 0 | Tidak | Ada |
| `/tiket/seed-tkt-15` | 0 | Tidak | Ada |
| `/tiket/seed-tkt-11` | 0 | Tidak | Ada |
| `/catatan` | 0 | Tidak | Ada |
| `/rapor` | 0 | Tidak | Redirect ke `/catatan` |
| `/login` | 0 | Tidak | Ada |
| `/dinas` | 0 | Tidak | Ada |
| `/dinas/peta` | 0 | Tidak | Ada |
| `/dinas/catatan` | 0 | Tidak | Ada |
| `/dinas/rapor` | 0 | Tidak | Redirect ke `/dinas/catatan` |

## Kendala dan Risiko

1. Migrasi v3.5 diterapkan melalui pooler karena koneksi direct PostgreSQL port 5432 tidak terjangkau. DDL sudah masuk, tetapi `_prisma_migrations` belum mencatat migrasi tersebut.
2. Self-check backend penuh belum dijalankan ulang setelah folder `src` dipindah ke `backend/`. Smoke test API dan seluruh halaman dinas sudah berhasil.
3. Login Supabase dinas asli belum diuji dengan kredensial nyata; fallback email diuji memakai JWT mock.
4. Bundle produksi masih memuat chunk besar dari `nsfwjs`/TensorFlow (warning >500 kB), belum menjadi error.
5. Perubahan hari ini belum di-commit sesuai permintaan.

## Langkah Berikutnya

1. Review working tree, lalu commit per kelompok fitur.
2. Jalankan ulang `npm run check` setelah struktur `backend/` final.
3. Uji login Supabase dengan akun dinas asli.
4. Load test ringan untuk `/api/tickets`, `/api/rapor`, dan `/tiket/:id`.
5. Pertimbangkan lazy-load terpisah untuk `nsfwjs` guna mengecilkan bundle awal.
