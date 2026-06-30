"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createOrganization(_: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const timezone = String(formData.get("timezone") ?? "Asia/Jakarta");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", { p_name: name, p_slug: slug, p_timezone: timezone });
  if (error) return { error: error.message };
  redirect(`/${(data as { slug: string }).slug}/admin/dashboard`);
}
