import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";

type SenseiProfile = { id: string; member_id: string };
type MemberProfile = { id: string; profile: { full_name: string } | null };

const statusLabels: Record<string, string> = {
  pending_confirmation: "Menunggu approval",
  booked: "Booked",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export default async function StudentHistoryPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "murid");
  const supabase = await createClient();
  const { data: classes, error } = await supabase.from("classes")
    .select("id,sensei_id,starts_at,ends_at,level,status,meeting_url,notes")
    .eq("organization_id", membership.organization_id)
    .neq("status", "available")
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Gagal mengambil riwayat kelas: ${error.message}`);

  const senseiIds = [...new Set((classes ?? []).map((item) => item.sensei_id))];
  const { data: senseis } = senseiIds.length
    ? await supabase.from("senseis").select("id,member_id").in("id", senseiIds)
    : { data: [] };
  const typedSenseis = (senseis ?? []) as SenseiProfile[];
  const memberIds = typedSenseis.map((sensei) => sensei.member_id);
  const { data: members } = memberIds.length
    ? await supabase.from("organization_members")
      .select("id,profile:profiles!organization_members_profile_id_fkey(full_name)")
      .in("id", memberIds)
    : { data: [] };
  const profiles = new Map(((members ?? []) as unknown as MemberProfile[]).map((member) => [member.id, member.profile?.full_name ?? "Sensei"]));
  const senseiNames = new Map(typedSenseis.map((sensei) => [sensei.id, profiles.get(sensei.member_id) ?? "Sensei"]));

  return <><header className="page-header"><div><p className="role-badge">Murid</p><h1>Riwayat Kelas</h1><p className="muted">Semua booking dan kelas Anda dalam satu daftar.</p></div></header><section className="history-list">{classes?.length ? classes.map((item) => <article className="card history-card" key={item.id}><div className="history-date"><strong>{new Date(item.starts_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</strong><span>{new Date(item.starts_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span></div><div className="history-info"><h2>{senseiNames.get(item.sensei_id) ?? "Sensei"}</h2><p className="muted">Level {item.level ?? "-"} · {new Date(item.ends_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>{item.notes ? <p className="history-notes">{item.notes}</p> : null}</div><span className={`class-status status-${item.status}`}>{statusLabels[item.status] ?? item.status}</span></article>) : <article className="card empty-state"><h2>Belum ada riwayat kelas</h2><p className="muted">Booking yang Anda buat akan muncul di halaman ini.</p></article>}</section></>;
}
