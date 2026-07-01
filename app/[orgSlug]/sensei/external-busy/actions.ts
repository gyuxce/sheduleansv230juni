"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createExternalBusy(input: { senseiId: string; startsAt: string; endsAt: string; source: string; notes?: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_external_busy", { p_sensei_id: input.senseiId, p_starts_at: input.startsAt, p_ends_at: input.endsAt, p_source: input.source, p_notes: input.notes || null });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: (data as { message?: string } | null)?.message ?? "Jadwal eksternal ditambahkan" };
}

export async function deleteExternalBusy(busyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_external_busy", { p_busy_id: busyId });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: (data as { message?: string } | null)?.message ?? "Blok jadwal berhasil dihapus" };
}
