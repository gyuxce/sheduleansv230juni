import { notFound } from "next/navigation";
import { ClassCalendar } from "@/components/class-calendar";
import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { roles, type Role } from "@/lib/types/auth";
import type { CalendarClass } from "@/lib/types/classes";

export default async function CalendarPage({ params }: { params: Promise<{ orgSlug: string; role: string }> }) {
  const { orgSlug, role: value } = await params;
  if (!roles.includes(value as Role)) notFound();
  const role = value as Role;
  const membership = await requireMembership(orgSlug, role);
  const from = new Date();
  from.setDate(from.getDate() - 45);
  const to = new Date();
  to.setDate(to.getDate() + 90);
  const supabase = await createClient();
  const { data, error } = await supabase.from("classes")
    .select("id,sensei_id,student_id,starts_at,ends_at,level,status,notes,meeting_url,version")
    .eq("organization_id", membership.organization_id)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .neq("status", "cancelled")
    .order("starts_at");
  if (error) throw new Error(`Gagal mengambil kalender: ${error.message}`);

  return <><header className="page-header"><div><h1>Kalender Kelas</h1><p className="muted">Klik slot hijau untuk membuat booking.</p></div></header><ClassCalendar classes={(data ?? []) as CalendarClass[]} organizationId={membership.organization_id} canBook={role === "murid"} /></>;
}
