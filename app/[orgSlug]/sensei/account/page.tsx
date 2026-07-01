import { RoleAccountPage } from "@/components/role-account-page";
export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) { const { orgSlug } = await params; return <RoleAccountPage orgSlug={orgSlug} role="sensei" />; }
