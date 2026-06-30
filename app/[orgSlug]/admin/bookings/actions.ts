"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function decideBooking(classId: string, approve: boolean, version: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_booking", { p_class_id: classId, p_approve: approve, p_expected_version: version });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: (data as { message?: string } | null)?.message ?? "Booking diperbarui" };
}
