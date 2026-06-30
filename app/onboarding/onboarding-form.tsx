"use client";

import { useActionState } from "react";
import { createOrganization } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createOrganization, {});
  return <form action={action} className="form">{state.error ? <div className="error">{state.error}</div> : null}<label className="field">Nama organisasi<input name="name" required minLength={2} /></label><label className="field">Slug URL<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="sakura-gakuen" /></label><label className="field">Zona waktu<select name="timezone" defaultValue="Asia/Jakarta"><option>Asia/Jakarta</option><option>Asia/Makassar</option><option>Asia/Jayapura</option><option>Asia/Bangkok</option><option>Asia/Tokyo</option></select></label><button className="button" disabled={pending}>{pending ? "Membuat..." : "Buat organisasi"}</button></form>;
}
