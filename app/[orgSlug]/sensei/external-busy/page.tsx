import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { ExternalBusyForm } from "./external-busy-form";

export default async function ExternalBusyPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params; const membership = await requireMembership(orgSlug, "sensei"); const supabase = await createClient();
  const { data: sensei } = await supabase.from("senseis").select("id").eq("organization_id", membership.organization_id).eq("member_id", membership.id).single();
  if (!sensei) throw new Error("Profil sensei belum tersedia.");
  const { data: blocks } = await supabase.from("sensei_external_busy").select("id,starts_at,ends_at,source").eq("sensei_id", sensei.id).gte("ends_at", new Date().toISOString()).order("starts_at");
  return <><header className="page-header"><div><h1>Jadwal Eksternal</h1><p className="muted">Booking aktif tidak pernah dibatalkan otomatis.</p></div></header><div className="grid two-columns"><section className="card"><ExternalBusyForm senseiId={sensei.id} /></section><section className="card"><h2>Blok mendatang</h2><div className="list">{blocks?.length ? blocks.map((block) => <p key={block.id} className="muted">{new Date(block.starts_at).toLocaleString("id-ID")} · {block.source}</p>) : <p className="muted">Belum ada blok jadwal.</p>}</div></section></div></>;
}
