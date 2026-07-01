import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityForm } from "./availability-form";
import { AvailabilityList } from "./availability-list";

export default async function AvailabilityPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "sensei");
  const supabase = await createClient();
  const { data: sensei, error } = await supabase.from("senseis").select("id").eq("organization_id", membership.organization_id).eq("member_id", membership.id).single();
  if (error || !sensei) throw new Error("Profil sensei belum tersedia. Hubungi admin organisasi.");
  const { data: slots, error: slotError } = await supabase.from("classes")
    .select("id,starts_at,ends_at,level,version")
    .eq("sensei_id", sensei.id)
    .eq("status", "available")
    .order("starts_at")
    .limit(200);
  if (slotError) throw new Error(`Gagal mengambil availability: ${slotError.message}`);
  return <><header className="page-header"><div><h1>Buka Ketersediaan</h1><p className="muted">Rentang otomatis dipecah mengikuti durasi slot organisasi.</p></div></header><div className="grid two-columns operations-grid"><section className="card"><h2>Tambah availability</h2><AvailabilityForm senseiId={sensei.id} /></section><AvailabilityList slots={slots ?? []} /></div></>;
}
