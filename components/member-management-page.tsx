import { MemberInviteForm } from "@/components/member-invite-form";
import { MemberAdminActions } from "@/components/member-admin-actions";

export type MemberListItem = {
  id: string;
  profile_id: string;
  status: string;
  created_at: string;
  profile: { full_name: string; email: string | null } | null;
};

export function MemberManagementPage({ orgSlug, role, members }: { orgSlug: string; role: "sensei" | "murid"; members: MemberListItem[] }) {
  const label = role === "sensei" ? "Sensei" : "Murid";
  return <><header className="page-header"><div><p className="role-badge">Admin</p><h1>Kelola {label}</h1><p className="muted">Buat akun login baru dan pantau status keanggotaannya.</p></div></header><div className="grid two-columns member-layout"><section className="card"><h2>Buat akun {label}</h2><MemberInviteForm orgSlug={orgSlug} role={role} /></section><section className="card"><h2>Daftar {label}</h2><div className="list">{members.length ? members.map((member) => <article className="member-row member-row-admin" key={member.id}><div className="member-identity"><strong>{member.profile?.full_name || "Nama belum diisi"}</strong><p className="muted">{member.profile?.email ?? "Email belum tersedia"}</p><span className={`status-pill member-status-${member.status}`}>{member.status}</span></div><MemberAdminActions orgSlug={orgSlug} memberId={member.id} profileId={member.profile_id} status={member.status} /></article>) : <p className="muted">Belum ada {label.toLowerCase()}.</p>}</div></section></div></>;
}
