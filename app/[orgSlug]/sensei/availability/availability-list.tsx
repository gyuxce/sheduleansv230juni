"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeAvailability } from "./actions";

type Slot = { id: string; starts_at: string; ends_at: string; level: string | null; version: number };

export function AvailabilityList({ slots }: { slots: Slot[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  const close = (slot: Slot) => {
    if (!window.confirm("Tutup slot availability ini?")) return;
    startTransition(async () => {
      const result = await closeAvailability(slot.id, slot.version);
      setFeedback(result);
      if (!result.error) router.refresh();
    });
  };

  return <section className="card"><div className="section-heading"><h2>Slot terbuka</h2><p className="muted">Slot dapat ditutup selama belum dibooking murid.</p></div>{feedback.error ? <div className="error">{feedback.error}</div> : null}{feedback.message ? <div className="notice">{feedback.message}</div> : null}<div className="schedule-list">{slots.length ? slots.map((slot) => <article className="schedule-row" key={slot.id}><div><strong>{new Date(slot.starts_at).toLocaleString("id-ID")}</strong><p className="muted">Sampai {new Date(slot.ends_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · Level {slot.level ?? "-"}</p></div><button className="danger-button" disabled={pending} onClick={() => close(slot)} type="button">Tutup</button></article>) : <p className="muted">Belum ada slot available.</p>}</div></section>;
}
