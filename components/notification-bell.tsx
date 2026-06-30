"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell({ organizationId, memberId, initialItems }: { organizationId: string; memberId: string; initialItems: NotificationItem[] }) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [open, setOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("notifications")
      .select("id,type,message,read_at,created_at")
      .eq("organization_id", organizationId)
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as NotificationItem[]);
  }, [memberId, organizationId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`notifications:${memberId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `member_id=eq.${memberId}` }, loadNotifications)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadNotifications, memberId]);

  const unread = items.filter((item) => !item.read_at).length;
  const markAllRead = async () => {
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("organization_id", organizationId).eq("member_id", memberId).is("read_at", null);
    await loadNotifications();
  };

  return (
    <div className="notification">
      <button className="notification-button" type="button" onClick={() => setOpen((value) => !value)} aria-label={`Notifikasi, ${unread} belum dibaca`}>
        <span aria-hidden="true">●</span> Notifikasi {unread ? <strong>{unread}</strong> : null}
      </button>
      {open ? <div className="notification-panel">
        <div className="notification-header"><strong>Notifikasi</strong>{unread ? <button type="button" onClick={markAllRead}>Tandai dibaca</button> : null}</div>
        <div className="notification-list">{items.length ? items.map((item) => <article className={item.read_at ? "notification-item" : "notification-item unread"} key={item.id}><p>{item.message}</p><time>{new Date(item.created_at).toLocaleString("id-ID")}</time></article>) : <p className="notification-empty">Belum ada notifikasi.</p>}</div>
      </div> : null}
    </div>
  );
}
