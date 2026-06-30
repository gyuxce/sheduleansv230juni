import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";

type ProfileData = { full_name: string; email: string | null };
type MemberWithProfile = { id: string; profile: ProfileData | null };

export default async function SenseiStudentsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "sensei");
  const supabase = await createClient();
  const { data: sensei, error: senseiError } = await supabase.from("senseis")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("member_id", membership.id)
    .single();
  if (senseiError || !sensei) throw new Error("Profil sensei tidak ditemukan.");

  const { data: classRows, error: classError } = await supabase.from("classes")
    .select("student_id,starts_at,status")
    .eq("organization_id", membership.organization_id)
    .eq("sensei_id", sensei.id)
    .not("student_id", "is", null)
    .in("status", ["pending_confirmation", "booked", "completed"])
    .order("starts_at", { ascending: false })
    .limit(500);
  if (classError) throw new Error(`Gagal mengambil riwayat murid: ${classError.message}`);

  const studentIds = [...new Set((classRows ?? []).flatMap((row) => row.student_id ? [row.student_id] : []))];
  const { data: students, error: studentError } = studentIds.length
    ? await supabase.from("students").select("id,member_id,current_level").in("id", studentIds)
    : { data: [], error: null };
  if (studentError) throw new Error(`Gagal mengambil murid: ${studentError.message}`);

  const memberIds = (students ?? []).map((student) => student.member_id);
  const { data: members, error: memberError } = memberIds.length
    ? await supabase.from("organization_members")
      .select("id,profile:profiles!organization_members_profile_id_fkey(full_name,email)")
      .in("id", memberIds)
    : { data: [], error: null };
  if (memberError) throw new Error(`Gagal mengambil profil murid: ${memberError.message}`);

  const memberMap = new Map(((members ?? []) as unknown as MemberWithProfile[]).map((member) => [member.id, member.profile]));
  const rows = (students ?? []).map((student) => {
    const relatedClasses = (classRows ?? []).filter((item) => item.student_id === student.id);
    const scheduledClass = relatedClasses.find((item) => item.status === "booked");
    const profile = memberMap.get(student.member_id);
    return { ...student, profile, scheduledClass };
  }).sort((a, b) => (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? "", "id"));

  return <><header className="page-header"><div><p className="role-badge">Sensei</p><h1>Murid Saya</h1><p className="muted">Murid yang pernah atau sedang memiliki kelas bersama Anda.</p></div></header><section className="student-list">{rows.length ? rows.map((student) => <article className="card student-card" key={student.id}><div className="student-avatar" aria-hidden="true">{(student.profile?.full_name || "M").slice(0, 1).toUpperCase()}</div><div className="student-info"><h2>{student.profile?.full_name || "Nama belum diisi"}</h2><p className="muted">{student.profile?.email ?? "Email belum tersedia"}</p><div className="student-meta"><span>Level {student.current_level || "-"}</span><span>{student.scheduledClass ? `Jadwal booked ${new Date(student.scheduledClass.starts_at).toLocaleString("id-ID")}` : "Belum ada kelas booked"}</span></div></div></article>) : <article className="card empty-state"><h2>Belum ada murid terhubung</h2><p className="muted">Murid akan muncul setelah melakukan booking atau setelah sensei membuat booking manual.</p></article>}</section></>;
}
