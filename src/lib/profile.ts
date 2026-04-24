import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProfileSummary = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "status" | "display_name"
>;

function getFallbackDisplayName(user: User): string | null {
  const metaDisplayName = user.user_metadata?.display_name;
  if (typeof metaDisplayName === "string" && metaDisplayName.trim().length > 0) {
    return metaDisplayName.trim();
  }

  if (typeof user.email === "string" && user.email.includes("@")) {
    return user.email.split("@")[0];
  }

  return null;
}

function getFallbackEmail(user: User): string {
  if (typeof user.email === "string" && user.email.trim().length > 0) {
    return user.email.trim();
  }

  return `${user.id}@placeholder.local`;
}

export async function getOrCreateProfileSummary(
  user: User,
): Promise<ProfileSummary | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("status, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[profiles] failed to load profile", error);
    return null;
  }

  if (profile) {
    return profile;
  }

  const { data: upsertedProfile, error: upsertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: getFallbackEmail(user),
        display_name: getFallbackDisplayName(user),
        status: "active",
      },
      { onConflict: "id" },
    )
    .select("status, display_name")
    .maybeSingle();

  if (upsertError) {
    console.error("[profiles] failed to create missing profile", upsertError);
    return null;
  }

  return upsertedProfile;
}
