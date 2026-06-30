"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types/auth";

export type InviteState = { error?: string; message?: string };

export async function inviteMember(_: InviteState, formData: FormData): Promise<InviteState> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const temporaryPassword = String(formData.get("temporaryPassword") ?? "");
  const level = String(formData.get("level") ?? "").trim();
  const canSelfBook = formData.get("canSelfBook") === "on";
  if (!orgSlug || !["sensei", "murid"].includes(role) || fullName.length < 2 || !email.includes("@") || temporaryPassword.length < 8) {
    return { error: "Data akun belum lengkap atau tidak valid." };
  }

  const membership = await requireMembership(orgSlug, "admin");
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Konfigurasi server belum lengkap." };
  }

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createUserError || !createdUser.user) {
    return { error: createUserError?.message ?? "Gagal membuat akun Supabase." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_register_member", {
    p_organization_id: membership.organization_id,
    p_profile_id: createdUser.user.id,
    p_role: role,
    p_full_name: fullName,
    p_level: level || null,
    p_can_self_book: role === "sensei" && canSelfBook,
  });
  if (error) {
    await admin.auth.admin.deleteUser(createdUser.user.id);
    return { error: error.message };
  }

  revalidatePath(`/${orgSlug}/admin/${role === "sensei" ? "senseis" : "students"}`);
  return { message: (data as { message?: string } | null)?.message ?? "Akun berhasil dibuat." };
}
