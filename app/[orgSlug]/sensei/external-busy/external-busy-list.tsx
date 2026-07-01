"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExternalBusy } from "./actions";

type BusyBlock = { id: string; starts_at: string; ends_at: string; source: string };

export function ExternalBusyList({ blocks }: { blocks: BusyBlock[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  const remove = (id: string) => {
    if (!window.confirm("Hapus blok jadwal ini? Availability tidak akan terbuka otomatis.")) return;
    startTransition(async () => {
      const result = await deleteExternalBusy(id);
      setFeedback(result);
      if (!result.error) router.refresh();
    });
  };

  return <section className="card"><div className="section-heading"><h2>Blok jadwal</h2><p className="muted">Menghapus blok tidak membuat availability baru.</p></div>{feedback.error ? <div className="error">{feedback.error}</div> : null}{feedback.message ? <div className="notice">{feedback.message}</div> : null}<div className="schedule-list">{blocks.length ? blocks.map((block) => <article className="schedule-row" key={block.id}><div><strong>{new Date(block.starts_at).toLocaleString("id-ID")}</strong><p className="muted">Sampai {new Date(block.ends_at).toLocaleString("id-ID")} · {block.source}</p></div><button className="danger-button" disabled={pending} onClick={() => remove(block.id)} type="button">Hapus</button></article>) : <p className="muted">Belum ada blok jadwal.</p>}</div></section>;
}
