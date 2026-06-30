import { AppShell } from "@/components/app-shell";
import type { NotificationItem } from "@/components/notification-bell";
import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types/auth";

export async function RoleShellLayout({ children, orgSlug, role }: { children: React.ReactNode; orgSlug: string; role: Role }) {
  const membership = await requireMembership(orgSlug, role);
  const supabase = await createClient();
  let canSelfBook = false;

  if (role === "sensei") {
    const { data } = await supabase.from("senseis")
      .select("can_self_book")
      .eq("organization_id", membership.organization_id)
      .eq("member_id", membership.id)
      .maybeSingle();
    canSelfBook = data?.can_self_book ?? false;
  }

  const { data: notifications } = await supabase.from("notifications")
    .select("id,type,message,read_at,created_at")
    .eq("organization_id", membership.organization_id)
    .eq("member_id", membership.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <AppShell
      orgSlug={orgSlug}
      role={role}
      organizationName={membership.organization.name}
      organizationId={membership.organization_id}
      memberId={membership.id}
      initialNotifications={(notifications ?? []) as NotificationItem[]}
      canSelfBook={canSelfBook}
    >
      {children}
    </AppShell>
  );
}
