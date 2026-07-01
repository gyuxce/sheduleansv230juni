"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import idLocale from "@fullcalendar/core/locales/id";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { CalendarClass, ClassStatus } from "@/lib/types/classes";
import { adminTransitionClass, adminUpdateClass, bookSlot } from "@/app/[orgSlug]/[role]/calendar/actions";

const colors: Record<ClassStatus, string> = {
  available: "#22c55e",
  pending_confirmation: "#eab308",
  booked: "#ef4444",
  cancelled: "#9ca3af",
  completed: "#64748b",
};

function EventDetailModal({ item, canManage, onClose }: { item: CalendarClass; canManage: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [meetingUrl, setMeetingUrl] = useState(item.meeting_url ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  const editable = canManage && ["pending_confirmation", "booked"].includes(item.status) && item.event_kind !== "external_busy";

  const transition = (targetStatus: "cancelled" | "completed") => {
    const label = targetStatus === "cancelled" ? "batalkan" : "tandai selesai";
    if (!window.confirm(`Yakin ingin ${label} kelas ini?`)) return;
    startTransition(async () => {
      const result = await adminTransitionClass({ classId: item.id, version: item.version, targetStatus });
      setFeedback(result);
      if (!result.error) { router.refresh(); onClose(); }
    });
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section aria-modal="true" className="event-modal" role="dialog"><div className="modal-header"><div><span className={`class-status status-${item.status}`}>{item.status.replaceAll("_", " ")}</span><h2>{item.event_kind === "external_busy" ? "Tidak tersedia" : item.student_name ? `Kelas ${item.student_name}` : "Slot availability"}</h2></div><button aria-label="Tutup detail" className="modal-close" onClick={onClose} type="button">×</button></div><div className="event-details"><div><span>Sensei</span><strong>{item.sensei_name ?? "-"}</strong></div><div><span>Murid</span><strong>{item.student_name ?? "-"}</strong></div><div><span>Mulai</span><strong>{new Date(item.starts_at).toLocaleString("id-ID")}</strong></div><div><span>Selesai</span><strong>{new Date(item.ends_at).toLocaleString("id-ID")}</strong></div><div><span>Level</span><strong>{item.level ?? "-"}</strong></div><div><span>Sumber</span><strong>{item.source_label ?? item.source?.replaceAll("_", " ") ?? "-"}</strong></div></div>{editable ? <div className="modal-form"><label className="field">Link meeting<input onChange={(event) => setMeetingUrl(event.target.value)} placeholder="https://..." type="url" value={meetingUrl} /></label><label className="field">Catatan<input onChange={(event) => setNotes(event.target.value)} value={notes} /></label><button className="button" disabled={pending} onClick={() => startTransition(async () => {
    const result = await adminUpdateClass({ classId: item.id, version: item.version, meetingUrl, notes });
    setFeedback(result);
    if (!result.error) router.refresh();
  })} type="button">Simpan detail</button></div> : item.notes || item.meeting_url ? <div className="event-readonly">{item.notes ? <p><strong>Catatan:</strong> {item.notes}</p> : null}{item.meeting_url ? <a href={item.meeting_url} rel="noreferrer" target="_blank">Buka link meeting</a> : null}</div> : null}{feedback.error ? <div className="error">{feedback.error}</div> : null}{feedback.message ? <div className="notice">{feedback.message}</div> : null}{canManage && item.event_kind !== "external_busy" ? <div className="modal-actions">{["available", "pending_confirmation", "booked"].includes(item.status) ? <button className="danger-button" disabled={pending} onClick={() => transition("cancelled")} type="button">Batalkan</button> : null}{item.status === "booked" ? <button className="small-button success-text" disabled={pending} onClick={() => transition("completed")} type="button">Tandai selesai</button> : null}</div> : null}</section></div>;
}

export function ClassCalendar({ classes, organizationId, canBook, canManage = false, senseiOptions = [] }: { classes: CalendarClass[]; organizationId: string; canBook: boolean; canManage?: boolean; senseiOptions?: { id: string; name: string }[] }) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [message, setMessage] = useState<string>();
  const [selected, setSelected] = useState<CalendarClass>();
  const [statusFilter, setStatusFilter] = useState("all");
  const [senseiFilter, setSenseiFilter] = useState("all");
  const [pending, startTransition] = useTransition();
  const events = useMemo(() => classes
    .filter((item) => statusFilter === "all" || item.status === statusFilter)
    .filter((item) => senseiFilter === "all" || item.sensei_id === senseiFilter)
    .map((item) => ({
      id: item.id,
      title: item.event_kind === "external_busy"
        ? `Tidak tersedia${item.source_label ? ` · ${item.source_label}` : ""}`
        : item.status === "available" ? `Slot tersedia${item.sensei_name ? ` · ${item.sensei_name}` : ""}` : `${item.student_name ?? "Kelas"} · ${item.status.replaceAll("_", " ")}`,
      start: item.starts_at,
      end: item.ends_at,
      backgroundColor: colors[item.status],
      borderColor: colors[item.status],
      extendedProps: item,
    })), [classes, senseiFilter, statusFilter]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`classes:${organizationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "classes", filter: `organization_id=eq.${organizationId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "sensei_external_busy", filter: `organization_id=eq.${organizationId}` }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [organizationId, router]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const applyResponsiveView = () => calendarRef.current?.getApi().changeView(media.matches ? "timeGridDay" : "timeGridWeek");
    applyResponsiveView();
    media.addEventListener("change", applyResponsiveView);
    return () => media.removeEventListener("change", applyResponsiveView);
  }, []);

  return <section className="card calendar-card">{message ? <p className={message.startsWith("Gagal") ? "error" : "notice"}>{message}</p> : null}<div className="calendar-filters"><label>Status<select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option value="all">Semua status</option><option value="available">Available</option><option value="pending_confirmation">Menunggu</option><option value="booked">Booked</option><option value="completed">Selesai</option></select></label>{senseiOptions.length ? <label>Sensei<select onChange={(event) => setSenseiFilter(event.target.value)} value={senseiFilter}><option value="all">Semua sensei</option>{senseiOptions.map((sensei) => <option key={sensei.id} value={sensei.id}>{sensei.name}</option>)}</select></label> : null}</div><FullCalendar ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }} locale={idLocale} events={events} height="auto" nowIndicator eventClick={(info) => {
    const item = info.event.extendedProps as CalendarClass;
    if (canBook && item.status === "available") {
      if (!window.confirm("Booking slot ini? Booking akan menunggu persetujuan admin.")) return;
      startTransition(async () => {
        const result = await bookSlot(item.id);
        setMessage(result.error ? `Gagal: ${result.error}` : result.message);
        if (!result.error) router.refresh();
      });
      return;
    }
    setSelected(item);
  }} eventClassNames={() => pending ? ["is-pending"] : []} />{selected ? <EventDetailModal key={`${selected.id}:${selected.version}`} item={selected} canManage={canManage} onClose={() => setSelected(undefined)} /> : null}</section>;
}
