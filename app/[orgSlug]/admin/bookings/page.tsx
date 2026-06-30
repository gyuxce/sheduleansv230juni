import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import { BookingActions } from "./booking-actions";

export default async function BookingApprovalPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const membership = await requireMembership(orgSlug, "admin");
  const supabase = await createClient();
  const { data, error } = await supabase.from("classes").select("id,sensei_id,student_id,starts_at,ends_at,level,version").eq("organization_id", membership.organization_id).eq("status", "pending_confirmation").order("starts_at");
  if (error) throw new Error(`Gagal mengambil approval: ${error.message}`);
  return <><header className="page-header"><div><h1>Approval Booking</h1><p className="muted">Setujui atau tolak booking yang menunggu konfirmasi.</p></div></header><section className="list">{data?.length ? data.map((item) => <article className="card booking-row" key={item.id}><div><h2>{new Date(item.starts_at).toLocaleString("id-ID")}</h2><p className="muted">Sensei: {item.sensei_id} · Murid: {item.student_id} · Level: {item.level ?? "-"}</p></div><BookingActions classId={item.id} version={item.version} /></article>) : <article className="card"><p className="muted">Tidak ada booking yang menunggu persetujuan.</p></article>}</section></>;
}
