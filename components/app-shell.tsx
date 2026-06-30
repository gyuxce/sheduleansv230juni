import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { Role } from "@/lib/types/auth";
import { NotificationBell, type NotificationItem } from "@/components/notification-bell";

const navigation: Record<Role, { label: string; path: string; requiresSelfBook?: boolean }[]> = {
  admin: [
    { label: "Dashboard", path: "dashboard" },
    { label: "Kalender", path: "calendar" },
    { label: "Approval Booking", path: "bookings" },
    { label: "Sensei", path: "senseis" },
    { label: "Murid", path: "students" },
    { label: "Activity Log", path: "activity" },
  ],
  sensei: [
    { label: "Dashboard", path: "dashboard" },
    { label: "Kalender Saya", path: "calendar" },
    { label: "Ketersediaan", path: "availability" },
    { label: "Input Booking", path: "direct-booking", requiresSelfBook: true },
    { label: "Jadwal Eksternal", path: "external-busy" },
    { label: "Murid", path: "students" },
  ],
  murid: [
    { label: "Dashboard", path: "dashboard" },
    { label: "Booking Kelas", path: "calendar" },
    { label: "Riwayat Kelas", path: "history" },
  ],
};

export function AppShell({ children, orgSlug, role, organizationName, organizationId, memberId, initialNotifications, canSelfBook = false }: { children: React.ReactNode; orgSlug: string; role: Role; organizationName: string; organizationId: string; memberId: string; initialNotifications: NotificationItem[]; canSelfBook?: boolean }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={`/${orgSlug}/${role}/dashboard`}>日本語 {organizationName}</Link>
        <p className="sidebar-role">Login sebagai {role === "murid" ? "murid" : role}</p>
        <NotificationBell organizationId={organizationId} memberId={memberId} initialItems={initialNotifications} />
        <nav className="nav" aria-label="Navigasi utama">
          {navigation[role].filter((item) => !item.requiresSelfBook || canSelfBook).map((item) => <Link key={item.path} href={`/${orgSlug}/${role}/${item.path}`}>{item.label}</Link>)}
          <form action={logout}><button className="button" type="submit">Keluar</button></form>
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
