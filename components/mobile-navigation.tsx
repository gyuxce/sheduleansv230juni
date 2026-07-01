"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/login/actions";

export type NavigationItem = { label: string; path: string };

const icons: Record<string, string> = {
  dashboard: "⌂", calendar: "▦", bookings: "✓", availability: "+", history: "↺",
  senseis: "先", students: "人", activity: "≡", "direct-booking": "+", "external-busy": "×",
};

export function MobileNavigation({ orgSlug, role, items }: { orgSlug: string; role: string; items: NavigationItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = items.slice(0, 3);
  const href = (path: string) => `/${orgSlug}/${role}/${path}`;

  return <><nav className="mobile-bottom-nav" aria-label="Navigasi mobile">{primary.map((item) => <Link className={pathname === href(item.path) ? "mobile-nav-item active" : "mobile-nav-item"} href={href(item.path)} key={item.path} prefetch onClick={() => setOpen(false)}><span aria-hidden="true">{icons[item.path] ?? "•"}</span><small>{item.label.replace(" Booking", "")}</small></Link>)}<button className={open ? "mobile-nav-item active" : "mobile-nav-item"} onClick={() => setOpen((value) => !value)} type="button"><span aria-hidden="true">☰</span><small>Menu</small></button></nav>{open ? <div className="mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }} role="presentation"><section className="mobile-menu-sheet"><div className="mobile-menu-header"><div><strong>Semua menu</strong><span>Login sebagai {role}</span></div><button aria-label="Tutup menu" onClick={() => setOpen(false)} type="button">×</button></div><div className="mobile-menu-grid">{items.map((item) => <Link className={pathname === href(item.path) ? "mobile-menu-link active" : "mobile-menu-link"} href={href(item.path)} key={item.path} prefetch onClick={() => setOpen(false)}><span aria-hidden="true">{icons[item.path] ?? "•"}</span><strong>{item.label}</strong></Link>)}</div><form action={logout}><button className="mobile-signout" type="submit">Keluar dari akun</button></form></section></div> : null}</>;
}
