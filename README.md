# LaporPAK! — Sistem Audit & Pelaporan Infrastruktur Publik Dua Arah Berbasis Peta

> **URL Live Produksi:** `https://laporpak-techcomfest2027.vercel.app/`  
> **Tautan Simulasi Dewan Juri (Techcomfest 2027):**  
> `https://laporpak-techcomfest2027.vercel.app/?jury_token=<JURY_SECRET_TOKEN>`

## Struktur Pembagian Kerja Tim
- **Arya (Backend & Integrasi):** `prisma/`, `backend/src/`, `api/`
- **Fatih (Frontend UI/UX & Maskot):** `frontend/src/pages/`, `frontend/src/components/`, `public/mascots/`
- **Reza (Fullstack, Infra, Kamera & Demo):** `backend/src/middlewares/`, `frontend/src/components/camera/`, `frontend/src/components/jury/`

## Menjalankan di Lokal (Node >= 20)
1. Simpan `.env` di **root folder repo** (lihat contoh di `.env.example`).
2. Install dependency:
   ```bash
   npm install
   npm --prefix frontend install --include=dev
   ```
3. Jalankan backend + frontend di 2 terminal dari root repo:
   ```bash
   # Terminal 1 (Backend API :5050)
   npm run dev

   # Terminal 2 (Frontend Vite :5173)
   npm --prefix frontend run dev
   ```
4. Buka `http://localhost:5173` di browser (Vite otomatis mem-proxy `/api`, `/samples`, dan `/geo` ke `:5050`).
