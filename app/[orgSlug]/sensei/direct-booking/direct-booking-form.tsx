"use client";

import { useState, useTransition } from "react";
import { createDirectBooking } from "./actions";

export function DirectBookingForm({ senseiId, students }: { senseiId: string; students: { id: string; label: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  return <form className="form" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const startsAt = new Date(String(form.get("startsAt"))); const endsAt = new Date(String(form.get("endsAt")));
    startTransition(async () => setFeedback(await createDirectBooking({ senseiId, studentId: String(form.get("studentId")), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), level: String(form.get("level") ?? ""), notes: String(form.get("notes") ?? "") })));
  }}>
    {feedback.error ? <div className="error">{feedback.error}</div> : null}{feedback.message ? <div className="notice">{feedback.message}</div> : null}
    <label className="field">Murid<select name="studentId" required><option value="">Pilih murid</option>{students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}</select></label>
    <label className="field">Mulai<input name="startsAt" type="datetime-local" required /></label><label className="field">Selesai<input name="endsAt" type="datetime-local" required /></label>
    <label className="field">Level<input name="level" /></label><label className="field">Catatan<input name="notes" /></label>
    <button className="button" disabled={pending}>{pending ? "Mengirim..." : "Ajukan booking"}</button>
  </form>;
}
