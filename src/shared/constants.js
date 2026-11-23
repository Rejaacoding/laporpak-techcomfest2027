export const DEPARTMENTS = {
  DISHUB: { code: 'DISHUB', name: 'Dinas Perhubungan (Dishub)', email: 'dishub@laporpak.id' },
  DPU: { code: 'DPU', name: 'Dinas PU Bina Marga', email: 'dpu@laporpak.id' },
  DLH: { code: 'DLH', name: 'Dinas Lingkungan Hidup (DLH)', email: 'dlh@laporpak.id' },
  SATPOLPP: { code: 'SATPOLPP', name: 'Satpol PP', email: 'satpolpp@laporpak.id' },
};

export const TICKET_CATEGORIES = {
  JALAN_AMBLES: { label: 'Jalan Ambles Parah', defaultDept: 'DPU', tier: 'DARURAT', slaHours: 24, nightRelaxed: true },
  KABEL_MENJUNTAI: { label: 'Kabel / Tiang Bahaya', defaultDept: 'DISHUB', tier: 'DARURAT', slaHours: 24, nightRelaxed: true },
  POHON_TUMBANG: { label: 'Pohon Tumbang / Halang Jalan', defaultDept: 'DLH', tier: 'DARURAT', slaHours: 24, nightRelaxed: true },
  PJU_MATI: { label: 'Lampu PJU Mati', defaultDept: 'DISHUB', tier: 'MENENGAH', slaHours: 72, nightRelaxed: true },
  SAMPAH_LIAR: { label: 'Tumpukan Sampah Liar', defaultDept: 'DLH', tier: 'MENENGAH', slaHours: 72, nightRelaxed: false },
  SALURAN_TERSUMBAT: { label: 'Saluran Air / Drainase Tersumbat', defaultDept: 'DPU', tier: 'MENENGAH', slaHours: 72, nightRelaxed: true },
  REKLAME_LIAR: { label: 'Reklame / Bangunan Liar Bahaya', defaultDept: 'SATPOLPP', tier: 'MENENGAH', slaHours: 72, nightRelaxed: false },
  JALAN_BERLUBANG: { label: 'Jalan / Aspal Berlubang', defaultDept: 'DPU', tier: 'STANDAR', slaHours: 168, nightRelaxed: false },
};

export const TICKET_STATUSES = {
  OPEN: { label: 'Laporan Masuk', pinColor: 'blue' },
  IN_PROGRESS: { label: 'Sedang Ditangani', pinColor: 'yellow' },
  OVERDUE: { label: 'Melewati Tenggat', pinColor: 'red' },
  PENDING_VALIDATION: { label: 'Menunggu Cek Warga', pinColor: 'orange' },
  DISPUTED: { label: 'Dibantah Warga', pinColor: 'purple' },
  ESCALATED: { label: 'Eskalasi Pengawasan', pinColor: 'darkred' },
  CLOSED: { label: 'Tuntas Terverifikasi', pinColor: 'green' },
  AUTO_CLOSED: { label: 'Tutup Otomatis (72j)', pinColor: 'lightgreen' },
  OUT_OF_SCOPE: { label: 'Kewenangan Instansi Lain', pinColor: 'gray' },
  REJECTED_SPAM: { label: 'Ditolak (Spam)', pinColor: 'darkgray' },
};
