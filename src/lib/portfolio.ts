import { supabase } from "@/integrations/supabase/client";

const DEFAULT_PORTFOLIO_NAME = "Default Portfolio";

export async function getOrCreatePortfolio(userId: string) {
  const { data: existing, error: fetchError } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      name: DEFAULT_PORTFOLIO_NAME,
    })
    .select("id")
    .single();

  if (!createError && created) {
    return created;
  }

  if (createError?.code === "23505") {
    // Concurrent create race: read again and use existing row.
    const { data: racedExisting, error: raceFetchError } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (raceFetchError) {
      throw raceFetchError;
    }
    if (racedExisting) {
      return racedExisting;
    }
  }

  throw createError ?? new Error("Failed to create portfolio");
}
