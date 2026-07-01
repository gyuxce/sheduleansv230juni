import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { BookingActions } from "./booking-actions";

type EntityMember = { id: string; member_id: string };
type MemberProfile = { id: string; profile: { full_name: string } | null };

export default async function BookingApprovalPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "admin");
  const supabase = await createClient();
  const { data, error } = await supabase.from("classes").select("id,sensei_id,student_id,starts_at,ends_at,level,version").eq("organization_id", membership.organization_id).eq("status", "pending_confirmation").order("starts_at");
  if (error) throw new Error(`Gagal mengambil approval: ${error.message}`);

  const senseiIds = [...new Set((data ?? []).map((item) => item.sensei_id))];
  const studentIds = [...new Set((data ?? []).flatMap((item) => item.student_id ? [item.student_id] : []))];
  const [{ data: senseis }, { data: students }] = await Promise.all([
    senseiIds.length ? supabase.from("senseis").select("id,member_id").in("id", senseiIds) : Promise.resolve({ data: [] }),
    studentIds.length ? supabase.from("students").select("id,member_id").in("id", studentIds) : Promise.resolve({ data: [] }),
  ]);
  const entities = [...((senseis ?? []) as EntityMember[]), ...((students ?? []) as EntityMember[])];
  const memberIds = [...new Set(entities.map((entity) => entity.member_id))];
  const { data: members } = memberIds.length
    ? await supabase.from("organization_members").select("id,profile:profiles!organization_members_profile_id_fkey(full_name)").in("id", memberIds)
    : { data: [] };
  const memberNames = new Map(((members ?? []) as unknown as MemberProfile[]).map((member) => [member.id, member.profile?.full_name ?? "Nama belum diisi"]));
  const entityNames = new Map(entities.map((entity) => [entity.id, memberNames.get(entity.member_id) ?? "Nama belum diisi"]));

  return <><header className="page-header"><div><p className="role-badge">Admin</p><h1>Approval Booking</h1><p className="muted">Setujui atau tolak booking yang menunggu konfirmasi.</p></div></header><section className="list">{data?.length ? data.map((item) => <article className="card booking-row" key={item.id}><div><h2>{new Date(item.starts_at).toLocaleString("id-ID")}</h2><p className="muted">Sensei {entityNames.get(item.sensei_id) ?? "-"} · Murid {item.student_id ? entityNames.get(item.student_id) ?? "-" : "-"}</p><div className="booking-meta"><span>Level {item.level ?? "-"}</span><span>{new Date(item.starts_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}–{new Date(item.ends_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span></div></div><BookingActions classId={item.id} version={item.version} /></article>) : <article className="card empty-state"><h2>Tidak ada antrean</h2><p className="muted">Booking baru yang menunggu keputusan akan muncul di sini.</p></article>}</section></>;
}
