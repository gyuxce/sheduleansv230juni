import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { ExternalBusyForm } from "./external-busy-form";
import { ExternalBusyList } from "./external-busy-list";

export default async function ExternalBusyPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params; const membership = await requireMembership(orgSlug, "sensei"); const supabase = await createClient();
  const { data: sensei } = await supabase.from("senseis").select("id").eq("organization_id", membership.organization_id).eq("member_id", membership.id).single();
  if (!sensei) throw new Error("Profil sensei belum tersedia.");
  const { data: blocks, error } = await supabase.from("sensei_external_busy").select("id,starts_at,ends_at,source").eq("sensei_id", sensei.id).order("starts_at");
  if (error) throw new Error(`Gagal mengambil blok jadwal: ${error.message}`);
  return <><header className="page-header"><div><h1>Jadwal Eksternal</h1><p className="muted">Booking aktif tidak pernah dibatalkan otomatis.</p></div></header><div className="grid two-columns operations-grid"><section className="card"><h2>Tambah blok</h2><ExternalBusyForm senseiId={sensei.id} /></section><ExternalBusyList blocks={blocks ?? []} /></div></>;
}
