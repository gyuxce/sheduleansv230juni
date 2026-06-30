import Link from "next/link";
import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";

type StudentDashboard = {
  next_class: null | {
    id: string;
    starts_at: string;
    ends_at: string;
    level: string | null;
    meeting_url: string | null;
    sensei_name: string;
  };
  pending_count: number;
  completed_count: number;
  booked_count: number;
};

const emptyDashboard: StudentDashboard = { next_class: null, pending_count: 0, completed_count: 0, booked_count: 0 };

export default async function StudentDashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "murid");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_student_dashboard", { p_organization_id: membership.organization_id });
  const stats = error ? emptyDashboard : ((data as StudentDashboard | null) ?? emptyDashboard);

  return <><header className="page-header"><div><p className="role-badge">Murid</p><h1>Dashboard Murid</h1><p className="muted">Ringkasan booking dan jadwal belajar Anda.</p></div><Link className="button" href={`/${orgSlug}/murid/calendar`}>Booking kelas</Link></header>{error ? <div className="warning"><strong>Ringkasan belum aktif.</strong><span>Jalankan migration dashboard murid terbaru di Supabase.</span></div> : null}<section className="stats-grid student-stats"><article className="card stat-card"><span>Kelas terjadwal</span><strong>{stats.booked_count}</strong></article><article className="card stat-card"><span>Menunggu approval</span><strong>{stats.pending_count}</strong></article><article className="card stat-card"><span>Kelas selesai</span><strong>{stats.completed_count}</strong></article></section><section className="card next-class-card"><div><p className="eyebrow">Kelas berikutnya</p>{stats.next_class ? <><h2>{new Date(stats.next_class.starts_at).toLocaleString("id-ID")}</h2><p className="muted">Sensei {stats.next_class.sensei_name} · Level {stats.next_class.level ?? "-"}</p></> : <><h2>Belum ada kelas terjadwal</h2><p className="muted">Pilih slot hijau pada kalender untuk mengajukan booking.</p></>}</div>{stats.next_class?.meeting_url ? <a className="button" href={stats.next_class.meeting_url} target="_blank" rel="noreferrer">Buka meeting</a> : null}</section></>;
}
