"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function bookSlot(classId: string): Promise<{ message: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_available_slot", {
    p_class_id: classId,
    p_notes: null,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) return { message: "", error: error.message };
  revalidatePath("/", "layout");
  const result = data as { message?: string } | null;
  return { message: result?.message ?? "Booking berhasil diajukan" };
}

export async function adminCreateBooking(input: { organizationId: string; senseiId: string; studentId: string; startsAt: string; endsAt: string; level?: string; notes?: string; meetingUrl?: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_booking", {
    p_organization_id: input.organizationId,
    p_sensei_id: input.senseiId,
    p_student_id: input.studentId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_level: input.level || null,
    p_notes: input.notes || null,
    p_meeting_url: input.meetingUrl || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: (data as { message?: string } | null)?.message ?? "Kelas berhasil dibuat" };
}

export async function adminUpdateClass(input: { classId: string; version: number; meetingUrl?: string; notes?: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_update_class_details", {
    p_class_id: input.classId,
    p_expected_version: input.version,
    p_meeting_url: input.meetingUrl || null,
    p_notes: input.notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: (data as { message?: string } | null)?.message ?? "Detail kelas diperbarui" };
}

export async function adminTransitionClass(input: { classId: string; version: number; targetStatus: "cancelled" | "completed" }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_transition_class", {
    p_class_id: input.classId,
    p_expected_version: input.version,
    p_target_status: input.targetStatus,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: (data as { message?: string } | null)?.message ?? "Status kelas diperbarui" };
}
