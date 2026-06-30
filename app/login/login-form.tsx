"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  return (
    <form action={formAction} className="form">
      {state.error ? <div className="error" role="alert">{state.error}</div> : null}
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="button" disabled={pending} type="submit">
        {pending ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
