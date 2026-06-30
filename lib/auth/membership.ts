import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CurrentMembership, Role } from "@/lib/types/auth";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getMemberships = cache(async (): Promise<CurrentMembership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, organization:organizations!inner(slug, name)")
    .eq("profile_id", user.id)
    .eq("status", "active");

  if (error) throw new Error(`Gagal mengambil membership: ${error.message}`);
  return (data ?? []) as unknown as CurrentMembership[];
});

export async function requireMembership(orgSlug: string, role?: Role) {
  const memberships = await getMemberships();
  const membership = memberships.find((item) => item.organization.slug === orgSlug);

  if (!membership) redirect("/unauthorized");
  if (role && membership.role !== role) redirect(`/${orgSlug}/${membership.role}/dashboard`);
  return membership;
}

export async function getDefaultDashboard() {
  const memberships = await getMemberships();
  const membership = memberships[0];
  return membership ? `/${membership.organization.slug}/${membership.role}/dashboard` : "/onboarding";
}
