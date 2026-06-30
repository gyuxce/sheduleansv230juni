import { MemberInviteForm } from "@/components/member-invite-form";

export type MemberListItem = {
  id: string;
  status: string;
  created_at: string;
  profile: { full_name: string; email: string | null } | null;
};

export function MemberManagementPage({ orgSlug, role, members }: { orgSlug: string; role: "sensei" | "murid"; members: MemberListItem[] }) {
  const label = role === "sensei" ? "Sensei" : "Murid";
  return <><header className="page-header"><div><p className="role-badge">Admin</p><h1>Kelola {label}</h1><p className="muted">Undang akun baru dan pantau status keanggotaannya.</p></div></header><div className="grid two-columns member-layout"><section className="card"><h2>Undang {label}</h2><MemberInviteForm orgSlug={orgSlug} role={role} /></section><section className="card"><h2>Daftar {label}</h2><div className="list">{members.length ? members.map((member) => <article className="member-row" key={member.id}><div><strong>{member.profile?.full_name || "Nama belum diisi"}</strong><p className="muted">{member.profile?.email ?? "Email belum tersedia"}</p></div><span className="status-pill">{member.status}</span></article>) : <p className="muted">Belum ada {label.toLowerCase()}.</p>}</div></section></div></>;
}
