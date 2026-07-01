import Link from "next/link";
import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";

type SenseiDashboard = {
  next_class: null | {
    id: string;
    starts_at: string;
    ends_at: string;
    level: string | null;
    meeting_url: string | null;
    student_name: string;
  };
  classes_today: number;
  pending_count: number;
  available_count: number;
  active_students: number;
};

const emptyDashboard: SenseiDashboard = {
  next_class: null,
  classes_today: 0,
  pending_count: 0,
  available_count: 0,
  active_students: 0,
};

export default async function SenseiDashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "sensei");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sensei_dashboard", {
    p_organization_id: membership.organization_id,
  });
  const stats = error ? emptyDashboard : ((data as SenseiDashboard | null) ?? emptyDashboard);
  const cards = [
    ["Kelas hari ini", stats.classes_today],
    ["Menunggu approval", stats.pending_count],
    ["Slot tersedia", stats.available_count],
    ["Murid aktif", stats.active_students],
  ] as const;

  return <><header className="page-header"><div><p className="role-badge">Sensei</p><h1>Dashboard Sensei</h1><p className="muted">Ringkasan aktivitas mengajar dan ketersediaan Anda.</p></div><Link className="button" href={`/${orgSlug}/sensei/availability`}>Buka ketersediaan</Link></header>{error ? <div className="warning"><strong>Ringkasan belum aktif.</strong><span>Jalankan migration operasional sensei terbaru di Supabase.</span></div> : null}<section className="stats-grid sensei-stats">{cards.map(([label, value]) => <article className="card stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section><section className="card next-class-card"><div><p className="eyebrow">Kelas berikutnya</p>{stats.next_class ? <><h2>{new Date(stats.next_class.starts_at).toLocaleString("id-ID")}</h2><p className="muted">Murid {stats.next_class.student_name} · Level {stats.next_class.level ?? "-"}</p></> : <><h2>Belum ada kelas terjadwal</h2><p className="muted">Buka availability agar murid dapat mengajukan booking.</p></>}</div>{stats.next_class?.meeting_url ? <a className="button" href={stats.next_class.meeting_url} target="_blank" rel="noreferrer">Buka meeting</a> : <Link className="button button-secondary" href={`/${orgSlug}/sensei/calendar`}>Lihat kalender</Link>}</section></>;
}
