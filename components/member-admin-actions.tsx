"use client";

import { useState, useTransition } from "react";
import { resetMemberPassword, setMemberStatus } from "@/app/[orgSlug]/admin/members/actions";

export function MemberAdminActions({ orgSlug, memberId, profileId, status }: { orgSlug: string; memberId: string; profileId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  const toggleStatus = () => {
    const nextStatus = status === "active" ? "suspended" : "active";
    if (!window.confirm(nextStatus === "suspended" ? "Suspend akses member ini?" : "Aktifkan kembali member ini?")) return;
    startTransition(async () => setFeedback(await setMemberStatus({ orgSlug, memberId, status: nextStatus })));
  };
  const reset = () => startTransition(async () => {
    const result = await resetMemberPassword({ orgSlug, profileId, password });
    setFeedback(result);
    if (!result.error) { setPassword(""); setShowPassword(false); }
  });

  return <div className="member-actions"><div className="member-action-buttons"><button className="small-button" disabled={pending} onClick={() => setShowPassword((value) => !value)} type="button">Reset password</button><button className={status === "active" ? "small-button danger-text" : "small-button success-text"} disabled={pending} onClick={toggleStatus} type="button">{status === "active" ? "Suspend" : "Aktifkan"}</button></div>{showPassword ? <div className="password-reset"><input aria-label="Password sementara baru" minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder="Password baru min. 8 karakter" type="password" value={password} /><button className="small-button" disabled={pending || password.length < 8} onClick={reset} type="button">Simpan</button></div> : null}{feedback.error ? <small className="inline-error">{feedback.error}</small> : null}{feedback.message ? <small className="inline-success">{feedback.message}</small> : null}</div>;
}
