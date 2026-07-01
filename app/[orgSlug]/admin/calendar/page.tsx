import { RoleCalendarPage } from "@/components/role-calendar-page";

export default async function AdminCalendarPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  return <RoleCalendarPage orgSlug={orgSlug} role="admin" />;
}
