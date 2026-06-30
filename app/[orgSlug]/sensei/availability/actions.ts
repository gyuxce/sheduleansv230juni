"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function openAvailability(input: { senseiId: string; startsAt: string; endsAt: string; level?: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_availability", {
    p_sensei_id: input.senseiId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_level: input.level || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: (data as { message?: string } | null)?.message ?? "Ketersediaan berhasil dibuka" };
}
