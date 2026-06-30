import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireMembership } from "@/lib/auth/membership";
import { roles, type Role } from "@/lib/types/auth";
import { createClient } from "@/lib/supabase/server";
import type { NotificationItem } from "@/components/notification-bell";

export default async function RoleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string; role: string }> }) {
  const { orgSlug, role: roleParam } = await params;
  if (!roles.includes(roleParam as Role)) notFound();
  const role = roleParam as Role;
  const membership = await requireMembership(orgSlug, role);
  let canSelfBook = false;
  if (role === "sensei") {
    const supabase = await createClient();
    const { data } = await supabase.from("senseis").select("can_self_book").eq("organization_id", membership.organization_id).eq("member_id", membership.id).maybeSingle();
    canSelfBook = data?.can_self_book ?? false;
  }
  const supabase = await createClient();
  const { data: notifications } = await supabase.from("notifications")
    .select("id,type,message,read_at,created_at")
    .eq("organization_id", membership.organization_id)
    .eq("member_id", membership.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return <AppShell orgSlug={orgSlug} role={role} organizationName={membership.organization.name} organizationId={membership.organization_id} memberId={membership.id} initialNotifications={(notifications ?? []) as NotificationItem[]} canSelfBook={canSelfBook}>{children}</AppShell>;
}
