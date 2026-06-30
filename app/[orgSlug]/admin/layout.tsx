import { RoleShellLayout } from "@/components/role-shell-layout";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  return <RoleShellLayout orgSlug={orgSlug} role="admin">{children}</RoleShellLayout>;
}
