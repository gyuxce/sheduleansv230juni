import { AccountForms } from "@/components/account-forms";
import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types/auth";

export async function RoleAccountPage({ orgSlug, role }: { orgSlug: string; role: Role }) {
  await requireMembership(orgSlug, role);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login tidak ditemukan.");
  const { data: profile, error } = await supabase.from("profiles").select("full_name,email,phone").eq("id", user.id).single();
  if (error || !profile) throw new Error("Profil tidak ditemukan.");
  return <><header className="page-header"><div><p className="role-badge">{role}</p><h1>Akun Saya</h1><p className="muted">Kelola identitas dan keamanan akun Anda.</p></div></header><AccountForms orgSlug={orgSlug} role={role} profile={profile} /></>;
}
