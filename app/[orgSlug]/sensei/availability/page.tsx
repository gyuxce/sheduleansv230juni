import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityForm } from "./availability-form";
import { AvailabilityList } from "./availability-list";
import { RecurringAvailability, type AvailabilitySeries } from "./recurring-availability";

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
  const { data: recurringSeries, error: seriesError } = await supabase.from("availability_series")
    .select("id,starts_on,ends_on,weekdays,local_start,local_end,level,status")
    .eq("sensei_id", sensei.id).eq("status", "active").order("created_at", { ascending: false });
  return <><header className="page-header"><div><h1>Buka Ketersediaan</h1><p className="muted">Gunakan slot sekali atau buat pola mingguan yang dapat diedit sebagai rangkaian.</p></div></header><div className="grid two-columns operations-grid"><section className="card"><h2>Availability sekali</h2><AvailabilityForm senseiId={sensei.id} /></section><AvailabilityList slots={slots ?? []} /></div><RecurringAvailability senseiId={sensei.id} series={(recurringSeries ?? []) as AvailabilitySeries[]} unavailable={Boolean(seriesError)} /></>;
}
