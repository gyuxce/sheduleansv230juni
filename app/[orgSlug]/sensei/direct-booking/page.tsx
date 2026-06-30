import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { DirectBookingForm } from "./direct-booking-form";

export default async function DirectBookingPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params; const membership = await requireMembership(orgSlug, "sensei"); const supabase = await createClient();
  const { data: sensei } = await supabase.from("senseis").select("id,can_self_book").eq("organization_id", membership.organization_id).eq("member_id", membership.id).single();
  if (!sensei?.can_self_book) redirect(`/${orgSlug}/sensei/dashboard`);
  const { data: students, error } = await supabase.from("students").select("id,current_level").eq("organization_id", membership.organization_id).order("created_at");
  if (error) throw new Error(`Gagal mengambil murid: ${error.message}`);
  return <><header className="page-header"><div><h1>Input Booking Manual</h1><p className="muted">Booking masuk ke antrean approval admin.</p></div></header><section className="card form-card"><DirectBookingForm senseiId={sensei.id} students={(students ?? []).map((item) => ({ id: item.id, label: `${item.id.slice(0, 8)} · ${item.current_level ?? "Level belum diisi"}` }))} /></section></>;
}
