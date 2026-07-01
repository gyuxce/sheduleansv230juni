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

export async function closeAvailability(classId: string, version: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_available_slot", {
    p_class_id: classId,
    p_expected_version: version,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: (data as { message?: string } | null)?.message ?? "Slot berhasil ditutup" };
}

type RecurringInput = { senseiId: string; startsOn: string; endsOn: string; weekdays: number[]; localStart: string; localEnd: string; level?: string };

export async function createRecurringAvailability(input: RecurringInput) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_recurring_availability", {
    p_sensei_id: input.senseiId, p_starts_on: input.startsOn, p_ends_on: input.endsOn,
    p_weekdays: input.weekdays, p_local_start: input.localStart, p_local_end: input.localEnd,
    p_level: input.level || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  const result = data as { message?: string; created_count?: number; skipped_count?: number } | null;
  return { message: `${result?.message ?? "Availability berulang dibuat"}. ${result?.created_count ?? 0} slot dibuat, ${result?.skipped_count ?? 0} dilewati.` };
}

export async function updateRecurringAvailability(input: RecurringInput & { seriesId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_recurring_availability", {
    p_series_id: input.seriesId, p_starts_on: input.startsOn, p_ends_on: input.endsOn,
    p_weekdays: input.weekdays, p_local_start: input.localStart, p_local_end: input.localEnd,
    p_level: input.level || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  const result = data as { message?: string; created_count?: number; skipped_count?: number } | null;
  return { message: `${result?.message ?? "Rangkaian diperbarui"}. ${result?.created_count ?? 0} slot dibuat, ${result?.skipped_count ?? 0} dilewati.` };
}

export async function cancelRecurringAvailability(seriesId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_recurring_availability", { p_series_id: seriesId });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: (data as { message?: string } | null)?.message ?? "Rangkaian dibatalkan" };
}
