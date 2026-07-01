"use client";

import { useState, useTransition } from "react";
import { adminCreateBooking } from "./actions";

type Option = { id: string; name: string };

export function AdminBookingForm({ organizationId, senseis, students }: { organizationId: string; senseis: Option[]; students: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  return <section className="card admin-booking"><button className="section-toggle" onClick={() => setOpen((value) => !value)} type="button"><span><strong>Booking manual admin</strong><small>Buat kelas booked tanpa menunggu approval</small></span><span>{open ? "Tutup" : "Buka form"}</span></button>{open ? <form className="form compact-form" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = new Date(String(form.get("startsAt")));
    const endsAt = new Date(String(form.get("endsAt")));
    if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf())) { setFeedback({ error: "Tanggal atau jam tidak valid." }); return; }
    startTransition(async () => setFeedback(await adminCreateBooking({
      organizationId,
      senseiId: String(form.get("senseiId")), studentId: String(form.get("studentId")),
      startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
      level: String(form.get("level") ?? ""), notes: String(form.get("notes") ?? ""), meetingUrl: String(form.get("meetingUrl") ?? ""),
    })));
  }}>
    {feedback.error ? <div className="error">{feedback.error}</div> : null}{feedback.message ? <div className="notice">{feedback.message}</div> : null}
    <div className="form-grid"><label className="field">Sensei<select name="senseiId" required><option value="">Pilih sensei</option>{senseis.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Murid<select name="studentId" required><option value="">Pilih murid</option>{students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Mulai<input name="startsAt" type="datetime-local" required /></label><label className="field">Selesai<input name="endsAt" type="datetime-local" required /></label><label className="field">Level<input name="level" /></label><label className="field">Link meeting<input name="meetingUrl" type="url" placeholder="https://..." /></label></div><label className="field">Catatan<input name="notes" /></label><button className="button" disabled={pending}>{pending ? "Menyimpan..." : "Buat kelas booked"}</button>
  </form> : null}</section>;
}
