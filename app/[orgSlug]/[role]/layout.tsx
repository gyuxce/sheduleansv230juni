import { notFound } from "next/navigation";
import { roles, type Role } from "@/lib/types/auth";
import { RoleShellLayout } from "@/components/role-shell-layout";

export default async function RoleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string; role: string }> }) {
  const { orgSlug, role: roleParam } = await params;
  if (!roles.includes(roleParam as Role)) notFound();
  const role = roleParam as Role;
  return <RoleShellLayout orgSlug={orgSlug} role={role}>{children}</RoleShellLayout>;
}
