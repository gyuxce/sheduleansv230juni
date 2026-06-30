import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityForm } from "./availability-form";

export default async function AvailabilityPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "sensei");
  const supabase = await createClient();
  const { data: sensei, error } = await supabase.from("senseis").select("id").eq("organization_id", membership.organization_id).eq("member_id", membership.id).single();
  if (error || !sensei) throw new Error("Profil sensei belum tersedia. Hubungi admin organisasi.");
  return <><header className="page-header"><div><h1>Buka Ketersediaan</h1><p className="muted">Rentang otomatis dipecah mengikuti durasi slot organisasi.</p></div></header><section className="card form-card"><AvailabilityForm senseiId={sensei.id} /></section></>;
}
