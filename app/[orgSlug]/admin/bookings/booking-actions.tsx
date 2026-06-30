"use client";

import { useState, useTransition } from "react";
import { decideBooking } from "./actions";

export function BookingActions({ classId, version }: { classId: string; version: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const decide = (approve: boolean) => startTransition(async () => {
    const result = await decideBooking(classId, approve, version);
    setError(result.error);
  });
  return <div className="actions"><button className="button" disabled={pending} onClick={() => decide(true)}>Approve</button><button className="button button-secondary" disabled={pending} onClick={() => decide(false)}>Reject</button>{error ? <span className="error">{error}</span> : null}</div>;
}
