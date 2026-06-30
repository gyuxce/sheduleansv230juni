"use client";

import { useState, useTransition } from "react";
import { createExternalBusy } from "./actions";

export function ExternalBusyForm({ senseiId }: { senseiId: string }) {
  const [pending, startTransition] = useTransition(); const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  return <form className="form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const startsAt = new Date(String(form.get("startsAt"))); const endsAt = new Date(String(form.get("endsAt"))); startTransition(async () => setFeedback(await createExternalBusy({ senseiId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), source: String(form.get("source") ?? "Pekerjaan lain"), notes: String(form.get("notes") ?? "") }))); }}>
    {feedback.error ? <div className="error">{feedback.error}</div> : null}{feedback.message ? <div className="notice">{feedback.message}</div> : null}
    <label className="field">Mulai<input name="startsAt" type="datetime-local" required /></label><label className="field">Selesai<input name="endsAt" type="datetime-local" required /></label><label className="field">Sumber<input name="source" defaultValue="Pekerjaan lain" required /></label><label className="field">Catatan<input name="notes" /></label><button className="button" disabled={pending}>{pending ? "Menyimpan..." : "Blokir jadwal"}</button>
  </form>;
}
