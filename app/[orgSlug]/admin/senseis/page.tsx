import { MemberManagementPage, type MemberListItem } from "@/components/member-management-page";
import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";

export default async function SenseisPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "admin");
  const supabase = await createClient();
  const { data, error } = await supabase.from("organization_members")
    .select("id,profile_id,status,created_at,profile:profiles!organization_members_profile_id_fkey(full_name,email)")
    .eq("organization_id", membership.organization_id).eq("role", "sensei").order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal mengambil sensei: ${error.message}`);
  return <MemberManagementPage orgSlug={orgSlug} role="sensei" members={(data ?? []) as unknown as MemberListItem[]} />;
}
