import Link from "next/link";
import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";

type DashboardStats = {
  total_senseis: number;
  total_students: number;
  classes_today: number;
  classes_this_week: number;
  pending_approval: number;
  available_slots: number;
  utilization: { sensei_id: string; name: string; booked_minutes: number; available_minutes: number; percentage: number }[];
};

const emptyStats: DashboardStats = {
  total_senseis: 0, total_students: 0, classes_today: 0, classes_this_week: 0,
  pending_approval: 0, available_slots: 0, utilization: [],
};

export default async function AdminDashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_dashboard_stats", { p_organization_id: membership.organization_id });
  if (error) throw new Error(`Gagal mengambil statistik dashboard: ${error.message}`);
  const stats = (data as DashboardStats | null) ?? emptyStats;
  const cards = [
    ["Total Sensei", stats.total_senseis], ["Total Murid", stats.total_students],
    ["Kelas Hari Ini", stats.classes_today], ["Jadwal Minggu Ini", stats.classes_this_week],
    ["Menunggu Approval", stats.pending_approval], ["Slot Tersedia", stats.available_slots],
  ] as const;

  return <><header className="page-header"><div><p className="role-badge">Admin</p><h1>Dashboard Statistik</h1><p className="muted">Ringkasan operasional organisasi saat ini.</p></div>{stats.pending_approval ? <Link className="button" href={`/${orgSlug}/admin/bookings`}>Buka approval</Link> : null}</header><section className="stats-grid">{cards.map(([label, value]) => <article className="card stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section><section className="card utilization-card"><div className="section-heading"><div><h2>Utilisasi Sensei</h2><p className="muted">Durasi booked dibanding booked + available dalam jendela 60 hari.</p></div></div><div className="utilization-list">{stats.utilization.length ? stats.utilization.map((item) => <article className="utilization-row" key={item.sensei_id}><div className="utilization-label"><strong>{item.name}</strong><span>{item.percentage}%</span></div><div className="progress" aria-label={`Utilisasi ${item.name} ${item.percentage}%`}><span style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }} /></div><small>{Math.round(item.booked_minutes / 60)} jam booked · {Math.round(item.available_minutes / 60)} jam tersedia</small></article>) : <p className="muted">Belum ada data jadwal sensei.</p>}</div></section></>;
}
