"use client";

import { useState, useTransition } from "react";
import { openAvailability } from "./actions";

export function AvailabilityForm({ senseiId }: { senseiId: string }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  return (
    <form className="form" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const startsAt = new Date(String(form.get("startsAt")));
      const endsAt = new Date(String(form.get("endsAt")));
      if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf())) {
        setFeedback({ error: "Tanggal dan jam tidak valid." });
        return;
      }
      startTransition(async () => setFeedback(await openAvailability({
        senseiId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        level: String(form.get("level") ?? ""),
      })));
    }}>
      {feedback.error ? <div className="error">{feedback.error}</div> : null}
      {feedback.message ? <div className="notice">{feedback.message}</div> : null}
      <label className="field">Mulai<input name="startsAt" type="datetime-local" required /></label>
      <label className="field">Selesai<input name="endsAt" type="datetime-local" required /></label>
      <label className="field">Level (opsional)<input name="level" placeholder="Contoh: N5" /></label>
      <button className="button" disabled={pending} type="submit">{pending ? "Menyimpan..." : "Buka ketersediaan"}</button>
    </form>
  );
}
