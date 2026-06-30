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
