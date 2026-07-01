"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/membership";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types/auth";

export async function updateOwnProfile(input: { orgSlug: string; role: Role; fullName: string; phone?: string }) {
  await requireMembership(input.orgSlug, input.role);
  if (input.fullName.trim().length < 2) return { error: "Nama minimal 2 karakter." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi login tidak ditemukan." };
  const { error } = await supabase.from("profiles").update({ full_name: input.fullName.trim(), phone: input.phone?.trim() || null }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath(`/${input.orgSlug}/${input.role}`, "layout");
  return { message: "Profil berhasil diperbarui." };
}

export async function changeOwnPassword(input: { orgSlug: string; role: Role; password: string; confirmation: string }) {
  await requireMembership(input.orgSlug, input.role);
  if (input.password.length < 8) return { error: "Password minimal 8 karakter." };
  if (input.password !== input.confirmation) return { error: "Konfirmasi password tidak sama." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) return { error: error.message };
  return { message: "Password berhasil diganti." };
}
