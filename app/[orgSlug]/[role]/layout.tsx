import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireMembership } from "@/lib/auth/membership";
import { roles, type Role } from "@/lib/types/auth";
import { createClient } from "@/lib/supabase/server";

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
  return <AppShell orgSlug={orgSlug} role={role} organizationName={membership.organization.name} canSelfBook={canSelfBook}>{children}</AppShell>;
}
