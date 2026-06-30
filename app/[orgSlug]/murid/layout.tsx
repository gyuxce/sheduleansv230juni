import { RoleShellLayout } from "@/components/role-shell-layout";

export default async function StudentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  return <RoleShellLayout orgSlug={orgSlug} role="murid">{children}</RoleShellLayout>;
}
