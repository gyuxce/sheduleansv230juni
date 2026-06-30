import { RoleShellLayout } from "@/components/role-shell-layout";

export default async function SenseiLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  return <RoleShellLayout orgSlug={orgSlug} role="sensei">{children}</RoleShellLayout>;
}
