"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createDirectBooking(input: { senseiId: string; studentId: string; startsAt: string; endsAt: string; level?: string; notes?: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_direct_booking", {
    p_sensei_id: input.senseiId, p_student_id: input.studentId,
    p_starts_at: input.startsAt, p_ends_at: input.endsAt,
    p_level: input.level || null, p_notes: input.notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: (data as { message?: string } | null)?.message ?? "Booking berhasil diajukan" };
}
