import { notFound } from "next/navigation";
import { roles, type Role } from "@/lib/types/auth";

const copy: Record<Role, { title: string; description: string; cards: string[] }> = {
  admin: { title: "Dashboard Admin", description: "Ringkasan operasional lembaga hari ini.", cards: ["Kelas hari ini", "Menunggu approval", "Slot tersedia"] },
  sensei: { title: "Dashboard Sensei", description: "Jadwal dan aktivitas mengajar Anda.", cards: ["Kelas berikutnya", "Murid hari ini", "Slot tersedia"] },
  murid: { title: "Dashboard Murid", description: "Booking dan jadwal belajar Anda.", cards: ["Kelas berikutnya", "Booking menunggu", "Riwayat kelas"] },
};

export default async function DashboardPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: value } = await params;
  if (!roles.includes(value as Role)) notFound();
  const page = copy[value as Role];
  return <><header className="page-header"><div><h1>{page.title}</h1><p className="muted">{page.description}</p></div></header><section className="grid">{page.cards.map((card) => <article className="card" key={card}><h2>{card}</h2><p className="muted">Data akan aktif setelah koneksi Supabase dan seed pertama.</p></article>)}</section></>;
}
