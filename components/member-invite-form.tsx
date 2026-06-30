"use client";

import { useActionState } from "react";
import { inviteMember, type InviteState } from "@/app/[orgSlug]/admin/members/actions";

export function MemberInviteForm({ orgSlug, role }: { orgSlug: string; role: "sensei" | "murid" }) {
  const [state, action, pending] = useActionState(inviteMember, {} as InviteState);
  return (
    <form action={action} className="form">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="role" value={role} />
      {state.error ? <div className="error">{state.error}</div> : null}
      {state.message ? <div className="notice">{state.message}</div> : null}
      <label className="field">Nama lengkap<input name="fullName" minLength={2} required /></label>
      <label className="field">Email<input name="email" type="email" required /></label>
      <label className="field">Password sementara<input name="temporaryPassword" type="password" minLength={8} autoComplete="new-password" required /><small className="field-help">Minimal 8 karakter. Berikan password ini langsung kepada pengguna.</small></label>
      <label className="field">{role === "sensei" ? "Level mengajar" : "Level saat ini"}<input name="level" placeholder="Contoh: N5" /></label>
      {role === "sensei" ? <label className="checkbox"><input name="canSelfBook" type="checkbox" /> Izinkan input booking manual</label> : null}
      <button className="button" disabled={pending}>{pending ? "Membuat..." : `Buat akun ${role === "sensei" ? "sensei" : "murid"}`}</button>
    </form>
  );
}
