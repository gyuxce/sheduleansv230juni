import { notFound } from "next/navigation";
import { RoleCalendarPage } from "@/components/role-calendar-page";
import { roles, type Role } from "@/lib/types/auth";

export default async function CalendarPage({ params }: { params: Promise<{ orgSlug: string; role: string }> }) {
  const { orgSlug, role: value } = await params;
  if (!roles.includes(value as Role)) notFound();
  return <RoleCalendarPage orgSlug={orgSlug} role={value as Role} />;
}
