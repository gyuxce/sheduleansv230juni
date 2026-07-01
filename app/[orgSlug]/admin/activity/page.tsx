import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";

type MemberProfile = { id: string; profile: { full_name: string } | null };

const actionLabels: Record<string, string> = {
  availability_opened: "Availability dibuka",
  availability_cancelled: "Availability ditutup",
  availability_cancelled_by_external_busy: "Availability ditutup oleh blok eksternal",
  student_booked_slot: "Murid mengajukan booking",
  direct_booking_created: "Booking manual dibuat",
  booking_approved: "Booking disetujui",
  booking_rejected: "Booking ditolak",
};

export default async function ActivityLogPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "admin");
  const supabase = await createClient();
  const { data: logs, error } = await supabase.from("class_activity_log")
    .select("id,class_id,action,performed_by_member_id,created_at")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Gagal mengambil activity log: ${error.message}`);

  const actorIds = [...new Set((logs ?? []).map((log) => log.performed_by_member_id))];
  const { data: actors } = actorIds.length
    ? await supabase.from("organization_members")
      .select("id,profile:profiles!organization_members_profile_id_fkey(full_name)")
      .in("id", actorIds)
    : { data: [] };
  const actorNames = new Map(((actors ?? []) as unknown as MemberProfile[]).map((actor) => [actor.id, actor.profile?.full_name ?? "Pengguna"]));

  return <><header className="page-header"><div><p className="role-badge">Admin</p><h1>Activity Log</h1><p className="muted">Jejak perubahan jadwal dan booking, terbaru lebih dahulu.</p></div></header><section className="card activity-table"><div className="activity-list">{logs?.length ? logs.map((log) => <article className="activity-row" key={log.id}><div className="activity-dot" aria-hidden="true" /><div><strong>{actionLabels[log.action] ?? log.action}</strong><p>{actorNames.get(log.performed_by_member_id) ?? "Pengguna"} · {new Date(log.created_at).toLocaleString("id-ID")}</p><small>Class {log.class_id.slice(0, 8)}</small></div></article>) : <div className="empty-state"><h2>Belum ada aktivitas</h2><p className="muted">Aktivitas jadwal dan booking akan tercatat otomatis.</p></div>}</div></section></>;
}
