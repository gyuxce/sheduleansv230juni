import { ClassCalendar } from "@/components/class-calendar";
import { AdminBookingForm } from "@/app/[orgSlug]/[role]/calendar/admin-booking-form";
import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types/auth";
import type { CalendarClass } from "@/lib/types/classes";

type EntityMember = { id: string; member_id: string };
type MemberProfile = { id: string; profile: { full_name: string } | null };

export async function RoleCalendarPage({ orgSlug, role }: { orgSlug: string; role: Role }) {
  const membership = await requireMembership(orgSlug, role);
  const from = new Date();
  from.setDate(from.getDate() - 45);
  const to = new Date();
  to.setDate(to.getDate() + 90);
  const supabase = await createClient();

  const [{ data, error }, { data: busyBlocks, error: busyError }, { data: senseis }, { data: students }] = await Promise.all([
    supabase.from("classes")
      .select("id,sensei_id,student_id,starts_at,ends_at,level,status,source,notes,meeting_url,version")
      .eq("organization_id", membership.organization_id)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .neq("status", "cancelled")
      .order("starts_at"),
    supabase.from("sensei_external_busy")
      .select("id,sensei_id,starts_at,ends_at,source,notes")
      .eq("organization_id", membership.organization_id)
      .gte("ends_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at"),
    supabase.from("senseis").select("id,member_id").eq("organization_id", membership.organization_id),
    supabase.from("students").select("id,member_id").eq("organization_id", membership.organization_id),
  ]);
  if (error) throw new Error(`Gagal mengambil kalender: ${error.message}`);
  if (busyError) throw new Error(`Gagal mengambil blok jadwal: ${busyError.message}`);

  const typedSenseis = (senseis ?? []) as EntityMember[];
  const typedStudents = (students ?? []) as EntityMember[];
  const memberIds = [...new Set([...typedSenseis, ...typedStudents].map((entity) => entity.member_id))];
  const { data: members } = memberIds.length
    ? await supabase.from("organization_members")
      .select("id,profile:profiles!organization_members_profile_id_fkey(full_name)")
      .in("id", memberIds)
    : { data: [] };
  const memberNames = new Map(((members ?? []) as unknown as MemberProfile[]).map((member) => [member.id, member.profile?.full_name ?? "Nama belum diisi"]));
  const senseiNames = new Map(typedSenseis.map((sensei) => [sensei.id, memberNames.get(sensei.member_id) ?? "Sensei"]));
  const studentNames = new Map(typedStudents.map((student) => [student.id, memberNames.get(student.member_id) ?? "Murid"]));
  const classEvents: CalendarClass[] = ((data ?? []) as CalendarClass[]).map((item) => ({
    ...item,
    event_kind: "class",
    sensei_name: senseiNames.get(item.sensei_id) ?? "Sensei",
    student_name: item.student_id ? studentNames.get(item.student_id) ?? "Murid" : undefined,
  }));
  const externalBusyEvents: CalendarClass[] = (busyBlocks ?? []).map((block) => ({
    id: `external-busy:${block.id}`,
    sensei_id: block.sensei_id,
    student_id: null,
    starts_at: block.starts_at,
    ends_at: block.ends_at,
    level: null,
    status: "cancelled",
    notes: block.notes,
    meeting_url: null,
    version: 1,
    event_kind: "external_busy",
    source_label: block.source,
    sensei_name: senseiNames.get(block.sensei_id) ?? "Sensei",
  }));
  const senseiOptions = typedSenseis.map((sensei) => ({ id: sensei.id, name: senseiNames.get(sensei.id) ?? "Sensei" }));
  const studentOptions = typedStudents.map((student) => ({ id: student.id, name: studentNames.get(student.id) ?? "Murid" }));

  return <><header className="page-header"><div><p className="role-badge">{role}</p><h1>Kalender Kelas</h1><p className="muted">Hijau: tersedia · kuning: menunggu · merah: booked · abu-abu: tidak tersedia.</p></div></header>{role === "admin" ? <AdminBookingForm organizationId={membership.organization_id} senseis={senseiOptions} students={studentOptions} /> : null}<ClassCalendar classes={[...classEvents, ...externalBusyEvents]} organizationId={membership.organization_id} canBook={role === "murid"} canManage={role === "admin"} senseiOptions={role === "admin" ? senseiOptions : []} /></>;
}
