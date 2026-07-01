"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRecurringAvailability, createRecurringAvailability, updateRecurringAvailability } from "./actions";

export type AvailabilitySeries = {
  id: string; starts_on: string; ends_on: string; weekdays: number[];
  local_start: string; local_end: string; level: string | null; status: string;
};

const days = [[1,"Sen"],[2,"Sel"],[3,"Rab"],[4,"Kam"],[5,"Jum"],[6,"Sab"],[7,"Min"]] as const;

function SeriesForm({ senseiId, series, onDone }: { senseiId: string; series?: AvailabilitySeries; onDone?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  return <form className="form recurring-form" onSubmit={(event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const weekdays = form.getAll("weekdays").map(Number); if (!weekdays.length) { setFeedback({ error: "Pilih minimal satu hari." }); return; } const input = { senseiId, startsOn: String(form.get("startsOn")), endsOn: String(form.get("endsOn")), weekdays, localStart: String(form.get("localStart")), localEnd: String(form.get("localEnd")), level: String(form.get("level") ?? "") }; startTransition(async () => { const result = series ? await updateRecurringAvailability({ ...input, seriesId: series.id }) : await createRecurringAvailability(input); setFeedback(result); if (!result.error) { if (!series) formElement.reset(); onDone?.(); router.refresh(); } }); }}>{feedback.error ? <div className="error">{feedback.error}</div> : null}{feedback.message ? <div className="notice">{feedback.message}</div> : null}<div className="form-grid"><label className="field">Mulai berlaku<input defaultValue={series?.starts_on} name="startsOn" required type="date" /></label><label className="field">Sampai tanggal<input defaultValue={series?.ends_on} name="endsOn" required type="date" /></label><label className="field">Jam mulai<input defaultValue={series?.local_start.slice(0,5)} name="localStart" required type="time" /></label><label className="field">Jam selesai<input defaultValue={series?.local_end.slice(0,5)} name="localEnd" required type="time" /></label></div><fieldset className="weekday-field"><legend>Ulangi setiap</legend><div>{days.map(([value,label]) => <label key={value}><input defaultChecked={series?.weekdays.includes(value)} name="weekdays" type="checkbox" value={value} /><span>{label}</span></label>)}</div></fieldset><label className="field">Level<input defaultValue={series?.level ?? ""} name="level" placeholder="Contoh: N5" /></label><button className="button" disabled={pending}>{pending ? "Menyimpan..." : series ? "Simpan perubahan seri" : "Buat availability berulang"}</button></form>;
}

export function RecurringAvailability({ senseiId, series, unavailable }: { senseiId: string; series: AvailabilitySeries[]; unavailable?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  if (unavailable) return <section className="card"><div className="warning"><strong>Recurring availability belum aktif.</strong><span>Jalankan migration terbaru di Supabase.</span></div></section>;
  return <section className="recurring-section"><div className="card"><div className="section-heading"><h2>Availability berulang mingguan</h2><p className="muted">Slot bentrok akan dilewati otomatis tanpa menggagalkan seluruh rangkaian.</p></div><SeriesForm senseiId={senseiId} /></div><div className="card"><div className="section-heading"><h2>Rangkaian aktif</h2><p className="muted">Edit hanya mengganti slot available mendatang; booking yang sudah ada tetap aman.</p></div>{feedback.error ? <div className="error">{feedback.error}</div> : null}{feedback.message ? <div className="notice">{feedback.message}</div> : null}<div className="series-list">{series.length ? series.map((item) => <article className="series-row" key={item.id}><div className="series-summary"><strong>{item.weekdays.map((day) => days.find(([value]) => value===day)?.[1]).join(", ")}</strong><span>{item.local_start.slice(0,5)}–{item.local_end.slice(0,5)} · {item.starts_on} sampai {item.ends_on}</span><small>Level {item.level ?? "-"}</small></div><div className="series-actions"><button className="small-button" onClick={() => setEditing(editing===item.id ? undefined : item.id)} type="button">{editing===item.id ? "Tutup edit" : "Edit"}</button><button className="danger-button" disabled={pending} onClick={() => { if (!window.confirm("Batalkan seluruh slot available mendatang dalam rangkaian ini?")) return; startTransition(async () => { const result=await cancelRecurringAvailability(item.id); setFeedback(result); if(!result.error) router.refresh(); }); }} type="button">Hapus seri</button></div>{editing===item.id ? <div className="series-edit"><SeriesForm senseiId={senseiId} series={item} onDone={() => { setEditing(undefined); router.refresh(); }} /></div> : null}</article>) : <p className="muted">Belum ada availability berulang aktif.</p>}</div></div></section>;
}
