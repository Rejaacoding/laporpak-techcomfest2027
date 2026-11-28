# Product Context — Masalah, Persona & Aturan Bisnis LaporPAK!

## Mengapa LaporPAK! Dibangun
Aplikasi pelaporan warga konvensional sering gagal di dua sisi: laporan menumpuk tanpa tenggat mengikat, atau instansi menutup laporan secara sepihak tanpa bukti perbaikan yang bisa diuji publik. LaporPAK! menutup celah itu dengan **Audit Dua Arah**: dinas diikat tenggat SLA + skor integritas publik (`0–100`), sementara warga sekitar mengawal penutupan lewat foto perbandingan sebelum–sesudah dan kuorum berbasis jarak GPS.

## Persona Pengguna
1. **Warga Pelapor & Saksi Sekitar (`WARGA`):**
   - Akun baru mulai pada `trustScore = 0.5` (hak melapor dan *Sudah Beres*), naik ke `1.0` setelah 1 kontribusi valid untuk membuka hak *Klaim Palsu* (`max 2.0`, penalti `-0.5` atau lantai `0.1` pada pelanggaran pertama akun baru).
   - Batas kuota warga: maksimal `5` tiket aktif per akun, `10` tiket per 24 jam, `5` pengiriman per jam (2x strike -> cooldown 24 jam).
   - Pelapor luar kota bebas syarat GPS hanya saat mengonfirmasi pada jam ke-`48–72` dan `disputeCount === 0`.
2. **Petugas Instansi Pemda (`ADMIN_DINAS`):**
   - `DISHUB` (PJU, Kabel/Tiang), `DPU` (Jalan Ambles, Jalan Berlubang, Drainase), `DLH` (Pohon Tumbang, Sampah Liar), `SATPOLPP` (Reklame/Bangunan Liar).
   - Skor awal dinas `80.0`: selesai bersih tepat waktu `+2`, `AUTO_CLOSED` 72 jam `0` (netral), lewat SLA `-3` (atau `-6` jika dukungan `>= 10` warga), eskalasi sengketa ke-2 `-5` permanen.
3. **Dewan Juri (`/?jury_token=...`):**
   - Panel simulasi `5` alat (role switcher 8 role termasuk `WARGA_VALIDATOR_2` & `WARGA_BARU`, preset GPS, mock kamera 16 foto `.webp` + PDF sample, percepatan waktu `+25h`/`+49h`, reset demo). Seluruh aksi juri terisolasi ke baris `isDemoData = true`.

## Mesin 10 Status & 8 Kategori SLA
- **Kategori & SLA:**
  - *Darurat (24 jam):* `JALAN_AMBLES`, `KABEL_MENJUNTAI`, `POHON_TUMBANG`
  - *Menengah (72 jam):* `PJU_MATI`, `SAMPAH_LIAR`, `SALURAN_TERSUMBAT`, `REKLAME_LIAR`
  - *Standar (168 jam):* `JALAN_BERLUBANG`
- **Status (`TICKET_STATUSES`):** `OPEN`, `IN_PROGRESS`, `OVERDUE`, `PENDING_VALIDATION`, `DISPUTED`, `ESCALATED`, `CLOSED`, `AUTO_CLOSED`, `OUT_OF_SCOPE`, `REJECTED_SPAM`.

## Prinsip UI/UX & Bahasa
- Bahasa Indonesia awam tanpa jargon teknis (halaman rapor dinamai **Catatan Kerja Dinas** di `/catatan` & `/dinas/catatan`).
- Progressive Depth Themes via `[data-theme]`: `warm` (warga, `/catatan`, `/dinas/catatan`), `blueprint` (`/lapor`, `/peta`), `slate` (gelap khusus `/dinas`, `/dinas/peta`).
