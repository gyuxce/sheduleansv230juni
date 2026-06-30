const labels: Record<string, string> = {
  calendar: "Kalender Kelas",
  bookings: "Approval Booking",
  senseis: "Kelola Sensei",
  students: "Kelola Murid",
  activity: "Activity Log",
  availability: "Buka Ketersediaan",
  "external-busy": "Jadwal Eksternal",
  history: "Riwayat Kelas",
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <><header className="page-header"><div><h1>{labels[section] ?? "Halaman"}</h1><p className="muted">Modul ini disiapkan untuk tahap antarmuka setelah mesin booking aktif.</p></div></header><section className="card"><h2>Fondasi modul siap</h2><p className="muted">Routing dan proteksi role sudah terpasang. Komponen bisnis akan ditambahkan pada batch berikutnya.</p></section></>;
}
