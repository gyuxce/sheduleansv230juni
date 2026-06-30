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
import { bookSlot } from "@/app/[orgSlug]/[role]/calendar/actions";

const colors: Record<ClassStatus, string> = {
  available: "#22c55e",
  pending_confirmation: "#eab308",
  booked: "#ef4444",
  cancelled: "#9ca3af",
  completed: "#64748b",
};

export function ClassCalendar({ classes, organizationId, canBook }: { classes: CalendarClass[]; organizationId: string; canBook: boolean }) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const events = useMemo(() => classes.map((item) => ({
    id: item.id,
    title: item.status === "available" ? "Slot tersedia" : item.status.replaceAll("_", " "),
    start: item.starts_at,
    end: item.ends_at,
    backgroundColor: colors[item.status],
    borderColor: colors[item.status],
    extendedProps: item,
  })), [classes]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`classes:${organizationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "classes", filter: `organization_id=eq.${organizationId}` }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [organizationId, router]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const applyResponsiveView = () => {
      calendarRef.current?.getApi().changeView(media.matches ? "timeGridDay" : "timeGridWeek");
    };
    applyResponsiveView();
    media.addEventListener("change", applyResponsiveView);
    return () => media.removeEventListener("change", applyResponsiveView);
  }, []);

  return (
    <section className="card calendar-card">
      {message ? <p className={message.startsWith("Gagal") ? "error" : "notice"}>{message}</p> : null}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
        locale={idLocale}
        events={events}
        height="auto"
        nowIndicator
        eventClick={(info) => {
          const item = info.event.extendedProps as CalendarClass;
          if (!canBook || item.status !== "available") {
            setMessage(`${info.event.title}: ${info.event.start?.toLocaleString("id-ID") ?? ""}`);
            return;
          }
          if (!window.confirm("Booking slot ini? Booking akan menunggu persetujuan admin.")) return;
          startTransition(async () => {
            const result = await bookSlot(item.id);
            setMessage(result.error ? `Gagal: ${result.error}` : result.message);
            if (!result.error) router.refresh();
          });
        }}
        eventClassNames={() => pending ? ["is-pending"] : []}
      />
    </section>
  );
}
